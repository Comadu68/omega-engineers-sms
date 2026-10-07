const dbHelper = require('../../database/db.cjs')

const generateBatchNo = (itemId) => {
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '')
  const randomSuffix = Math.floor(100 + Math.random() * 900)
  return `BATCH-${dateStr}-${itemId}-${randomSuffix}`
}

const list = ({ search = '', category = null, lowStockOnly = false } = {}) => {
  let sql = `
    SELECT i.id, i.sku, i.name, i.category, i.default_supplier_id AS defaultSupplierId,
           i.minimum_stock_level AS minimumStockLevel,
           i.current_selling_price AS currentSellingPrice,
           i.notes, i.is_active AS isActive,
           i.created_at AS createdAt,
           COALESCE(SUM(b.remaining_qty), 0) AS totalStock,
           COUNT(DISTINCT CASE WHEN b.remaining_qty > 0 THEN b.id END) AS activeBatchesCount,
           COALESCE(SUM(b.remaining_qty * b.unit_cost) / NULLIF(SUM(b.remaining_qty), 0), 0) AS weightedUnitCost,
           COALESCE(SUM(b.remaining_qty * b.unit_cost), 0) AS totalCostValuation,
           s.name AS defaultSupplierName
    FROM inventory_items i
    LEFT JOIN inventory_batches b ON b.inventory_item_id = i.id
    LEFT JOIN suppliers s ON s.id = i.default_supplier_id
  `
  const conditions = []
  const params = []

  if (category) {
    conditions.push('i.category = ?')
    params.push(category)
  }

  if (search && search.trim()) {
    conditions.push('(i.name LIKE ? OR i.sku LIKE ? OR i.category LIKE ?)')
    const term = `%${search.trim()}%`
    params.push(term, term, term)
  }

  if (conditions.length > 0) {
    sql += ' WHERE ' + conditions.join(' AND ')
  }

  sql += ' GROUP BY i.id'

  if (lowStockOnly) {
    sql += ' HAVING totalStock <= i.minimum_stock_level'
  }

  sql += ' ORDER BY i.name ASC'

  const items = dbHelper.queryAll(sql, params)
  return items.map((item) => ({
    ...item,
    isLowStock: item.totalStock <= item.minimumStockLevel
  }))
}

const get = (id) => {
  const item = dbHelper.queryOne(
    `SELECT i.id, i.sku, i.name, i.category, i.default_supplier_id AS defaultSupplierId,
            i.minimum_stock_level AS minimumStockLevel,
            i.current_selling_price AS currentSellingPrice,
            i.notes, i.is_active AS isActive,
            i.created_at AS createdAt,
            s.name AS defaultSupplierName
     FROM inventory_items i
     LEFT JOIN suppliers s ON s.id = i.default_supplier_id
     WHERE i.id = ?`,
    [id]
  )
  if (!item) return null

  const batches = dbHelper.queryAll(
    `SELECT b.id, b.batch_no AS batchNo, b.inventory_item_id AS inventoryItemId,
            b.supplier_id AS supplierId, b.supplier_document_no AS supplierDocumentNo,
            b.received_at AS receivedAt, b.received_qty AS receivedQty,
            b.remaining_qty AS remainingQty, b.unit_cost AS unitCost,
            b.expiry_date AS expiryDate, b.notes, b.created_at AS createdAt,
            s.name AS supplierName
     FROM inventory_batches b
     LEFT JOIN suppliers s ON s.id = b.supplier_id
     WHERE b.inventory_item_id = ?
     ORDER BY b.received_at DESC, b.id DESC`,
    [id]
  )

  const totalStock = batches.reduce((acc, b) => acc + (b.remainingQty || 0), 0)
  const totalCostValuation = batches.reduce((acc, b) => acc + (b.remainingQty || 0) * (b.unitCost || 0), 0)
  const weightedUnitCost = totalStock > 0 ? totalCostValuation / totalStock : 0

  return {
    ...item,
    totalStock,
    totalCostValuation,
    weightedUnitCost,
    isLowStock: totalStock <= item.minimumStockLevel,
    batches
  }
}

const createItem = ({
  sku = '',
  name,
  category = 'General Parts',
  defaultSupplierId = null,
  minimumStockLevel = 5,
  currentSellingPrice = 0,
  notes = '',
  initialBatch = null
}) => {
  if (!name) throw new Error('Item name is required.')

  const generatedSku = sku && sku.trim() ? sku.trim() : `INV-${Math.floor(1000 + Math.random() * 9000)}`

  return dbHelper.runTransaction(() => {
    const res = dbHelper.runSql(
      `INSERT INTO inventory_items (sku, name, category, default_supplier_id, minimum_stock_level, current_selling_price, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        generatedSku,
        name.trim(),
        category.trim(),
        defaultSupplierId || null,
        Math.max(0, parseFloat(minimumStockLevel) || 0),
        Math.max(0, parseFloat(currentSellingPrice) || 0),
        notes.trim()
      ]
    )
    const itemId = res.lastInsertRowid

    if (initialBatch && parseFloat(initialBatch.qty) > 0) {
      const batchNo = initialBatch.batchNo || generateBatchNo(itemId)
      dbHelper.runSql(
        `INSERT INTO inventory_batches (batch_no, inventory_item_id, supplier_id, supplier_document_no, received_at, received_qty, remaining_qty, unit_cost, expiry_date, notes)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          batchNo,
          itemId,
          initialBatch.supplierId || defaultSupplierId || null,
          initialBatch.supplierDocumentNo || '',
          initialBatch.receivedAt || new Date().toISOString().slice(0, 10),
          parseFloat(initialBatch.qty),
          parseFloat(initialBatch.qty),
          Math.max(0, parseFloat(initialBatch.unitCost) || 0),
          initialBatch.expiryDate || null,
          initialBatch.notes || ''
        ]
      )
    }

    return get(itemId)
  })
}

const updateItem = (id, data) => {
  const existing = dbHelper.queryOne('SELECT id FROM inventory_items WHERE id = ?', [id])
  if (!existing) throw new Error('Item not found.')

  if (data.sku) {
    const dup = dbHelper.queryOne(
      'SELECT id FROM inventory_items WHERE sku = ? AND id != ?',
      [data.sku.trim(), id]
    )
    if (dup) throw new Error(`SKU / Part number ${data.sku} is already in use.`)
  }

  dbHelper.runSql(
    `UPDATE inventory_items
     SET sku = COALESCE(?, sku),
         name = COALESCE(?, name),
         category = COALESCE(?, category),
         default_supplier_id = COALESCE(?, default_supplier_id),
         minimum_stock_level = COALESCE(?, minimum_stock_level),
         current_selling_price = COALESCE(?, current_selling_price),
         notes = COALESCE(?, notes),
         is_active = COALESCE(?, is_active),
         updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`,
    [
      data.sku?.trim() || null,
      data.name?.trim() || null,
      data.category?.trim() || null,
      data.defaultSupplierId !== undefined ? data.defaultSupplierId : null,
      data.minimumStockLevel !== undefined ? Math.max(0, parseFloat(data.minimumStockLevel)) : null,
      data.currentSellingPrice !== undefined ? Math.max(0, parseFloat(data.currentSellingPrice)) : null,
      data.notes?.trim() ?? null,
      data.isActive !== undefined ? data.isActive : null,
      id
    ]
  )

  return get(id)
}

const receiveBatch = ({
  inventoryItemId,
  batchNo = '',
  supplierId = null,
  supplierDocumentNo = '',
  receivedAt = '',
  receivedQty,
  unitCost,
  expiryDate = null,
  notes = ''
}) => {
  if (!inventoryItemId || !receivedQty || parseFloat(receivedQty) <= 0) {
    throw new Error('Valid item and received quantity are required.')
  }
  const cost = parseFloat(unitCost) || 0
  const qty = parseFloat(receivedQty)
  const batchNumber = batchNo && batchNo.trim() ? batchNo.trim() : generateBatchNo(inventoryItemId)
  const dateStr = receivedAt || new Date().toISOString().slice(0, 10)

  const result = dbHelper.runSql(
    `INSERT INTO inventory_batches (batch_no, inventory_item_id, supplier_id, supplier_document_no, received_at, received_qty, remaining_qty, unit_cost, expiry_date, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      batchNumber,
      inventoryItemId,
      supplierId || null,
      supplierDocumentNo.trim(),
      dateStr,
      qty,
      qty,
      cost,
      expiryDate || null,
      notes.trim()
    ]
  )

  return dbHelper.queryOne(
    `SELECT b.*, s.name AS supplierName
     FROM inventory_batches b
     LEFT JOIN suppliers s ON s.id = b.supplier_id
     WHERE b.id = ?`,
    [result.lastInsertRowid]
  )
}

/**
 * Consumes parts using FIFO algorithm across oldest active batches.
 * Creates snapshots in job_parts table and reduces inventory_batches.remaining_qty.
 */
const consumeFifo = (jobCardId, inventoryItemId, requiredQty, sellingPriceOverride = null, userId = null) => {
  return dbHelper.runTransaction(() => {
    const item = dbHelper.queryOne(
      'SELECT id, name, current_selling_price FROM inventory_items WHERE id = ?',
      [inventoryItemId]
    )
    if (!item) throw new Error('Inventory item not found.')

    const sellingPrice = sellingPriceOverride !== null && sellingPriceOverride !== undefined
      ? parseFloat(sellingPriceOverride)
      : item.current_selling_price

    // Find all active batches ordered by received_at ASC, id ASC
    const activeBatches = dbHelper.queryAll(
      `SELECT id, batch_no, remaining_qty, unit_cost
       FROM inventory_batches
       WHERE inventory_item_id = ? AND remaining_qty > 0
       ORDER BY received_at ASC, id ASC`,
      [inventoryItemId]
    )

    const totalAvailable = activeBatches.reduce((acc, b) => acc + b.remaining_qty, 0)
    let needed = parseFloat(requiredQty)
    if (needed <= 0) throw new Error('Quantity must be greater than 0.')

    if (totalAvailable < needed) {
      throw new Error(
        `Insufficient stock for "${item.name}". Required: ${needed}, Available: ${totalAvailable}`
      )
    }

    const createdParts = []

    for (const batch of activeBatches) {
      if (needed <= 0) break

      const deduct = Math.min(batch.remaining_qty, needed)
      const newRemaining = batch.remaining_qty - deduct

      // Update batch remaining
      dbHelper.runSql(
        'UPDATE inventory_batches SET remaining_qty = ? WHERE id = ?',
        [newRemaining, batch.id]
      )

      // Insert job_parts row with snapshots
      const res = dbHelper.runSql(
        `INSERT INTO job_parts (job_card_id, inventory_item_id, inventory_batch_id, qty, unit_cost_at_use, selling_price_at_use, added_by)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          jobCardId,
          inventoryItemId,
          batch.id,
          deduct,
          batch.unit_cost,
          sellingPrice,
          userId
        ]
      )

      createdParts.push({
        id: res.lastInsertRowid,
        jobCardId,
        inventoryItemId,
        batchId: batch.id,
        batchNo: batch.batch_no,
        qty: deduct,
        unitCost: batch.unit_cost,
        sellingPrice,
        lineTotal: deduct * sellingPrice
      })

      needed -= deduct
    }

    return createdParts
  })
}

/**
 * Restores parts back to the respective inventory batch when removed from a job card.
 */
const restorePartQty = (jobPartId) => {
  return dbHelper.runTransaction(() => {
    const part = dbHelper.queryOne(
      'SELECT id, inventory_batch_id, qty FROM job_parts WHERE id = ?',
      [jobPartId]
    )
    if (!part) throw new Error('Job part record not found.')

    dbHelper.runSql(
      'UPDATE inventory_batches SET remaining_qty = remaining_qty + ? WHERE id = ?',
      [part.qty, part.inventory_batch_id]
    )

    dbHelper.runSql('DELETE FROM job_parts WHERE id = ?', [jobPartId])
    return { success: true }
  })
}

const getSummary = () => {
  const items = list()
  const totalItems = items.length
  const lowStockCount = items.filter((i) => i.isLowStock).length
  const totalStockValuation = items.reduce((acc, i) => acc + (i.totalCostValuation || 0), 0)
  const totalPotentialSalesValue = items.reduce(
    (acc, i) => acc + (i.totalStock || 0) * (i.currentSellingPrice || 0),
    0
  )

  return {
    totalItems,
    lowStockCount,
    totalStockValuation,
    totalPotentialSalesValue
  }
}

const getSuppliers = () => {
  return dbHelper.queryAll('SELECT * FROM suppliers ORDER BY name ASC')
}

const createSupplier = ({ name, phone = '', address = '', notes = '' }) => {
  if (!name) throw new Error('Supplier name is required.')
  const res = dbHelper.runSql(
    'INSERT INTO suppliers (name, phone, address, notes) VALUES (?, ?, ?, ?)',
    [name.trim(), phone.trim(), address.trim(), notes.trim()]
  )
  return dbHelper.queryOne('SELECT * FROM suppliers WHERE id = ?', [res.lastInsertRowid])
}

module.exports = {
  list,
  get,
  createItem,
  updateItem,
  receiveBatch,
  consumeFifo,
  restorePartQty,
  getSummary,
  getSuppliers,
  createSupplier
}
