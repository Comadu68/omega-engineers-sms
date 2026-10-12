const dbHelper = require('../../database/db.cjs')

/**
 * Strict parser for numeric inputs.
 * Rejects:
 * - null, undefined (required)
 * - boolean, objects, arrays
 * - strings with partial numbers like '12abc'
 * - non-numeric strings like 'abc'
 * - whitespace-only or empty strings
 * - NaN, Infinity, -Infinity
 * Accepts:
 * - finite numbers (e.g. 10, 0, 4.5)
 * - valid numeric strings (e.g. '10', '0', '4.5', '  4.5  ')
 */
const parseStrictNumber = (val, fieldName) => {
  if (val === null || val === undefined) {
    throw new Error(`${fieldName} is required.`)
  }
  if (typeof val === 'boolean') {
    throw new Error(`${fieldName} must be a valid number, not a boolean.`)
  }
  if (typeof val === 'string') {
    const trimmed = val.trim()
    if (trimmed === '') {
      throw new Error(`${fieldName} cannot be empty.`)
    }
    const num = Number(trimmed)
    if (!Number.isFinite(num)) {
      throw new Error(`${fieldName} must be a valid finite number.`)
    }
    return num
  }
  if (typeof val === 'number') {
    if (!Number.isFinite(val)) {
      throw new Error(`${fieldName} must be a valid finite number.`)
    }
    return val
  }
  throw new Error(`${fieldName} must be a valid number.`)
}

const validatePositiveNumber = (val, fieldName) => {
  const num = parseStrictNumber(val, fieldName)
  if (num <= 0) {
    throw new Error(`${fieldName} must be greater than 0.`)
  }
  return num
}

const validateNonNegativeNumber = (val, fieldName) => {
  const num = parseStrictNumber(val, fieldName)
  if (num < 0) {
    throw new Error(`${fieldName} cannot be negative.`)
  }
  return num
}

const validateItemName = (name) => {
  if (name === undefined || name === null || typeof name !== 'string' || !name.trim()) {
    throw new Error('Item name is required and cannot be empty or whitespace.')
  }
  return name.trim()
}

const validateCategory = (category) => {
  if (category === undefined || category === null) return 'General Parts'
  if (typeof category !== 'string' || !category.trim()) {
    throw new Error('Category cannot be empty or whitespace.')
  }
  return category.trim()
}

const validateSku = (sku, existingItemId = null) => {
  if (sku === undefined || sku === null || sku === '') {
    return null
  }
  if (typeof sku !== 'string' || !sku.trim()) {
    throw new Error('SKU / Part number cannot be whitespace-only.')
  }
  const cleanSku = sku.trim()
  const dupQuery = existingItemId
    ? 'SELECT id FROM inventory_items WHERE sku = ? AND id != ?'
    : 'SELECT id FROM inventory_items WHERE sku = ?'
  const dupParams = existingItemId ? [cleanSku, existingItemId] : [cleanSku]
  const dup = dbHelper.queryOne(dupQuery, dupParams)
  if (dup) {
    throw new Error(`SKU / Part number "${cleanSku}" is already in use.`)
  }
  return cleanSku
}

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

  if (category && category !== 'all' && typeof category === 'string' && category.trim()) {
    conditions.push('i.category = ?')
    params.push(category.trim())
  }

  if (search && typeof search === 'string' && search.trim()) {
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
  if (!id) return null
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
} = {}) => {
  const cleanName = validateItemName(name)
  const cleanCategory = validateCategory(category)
  let cleanSku = validateSku(sku)
  if (!cleanSku) {
    cleanSku = `INV-${Math.floor(1000 + Math.random() * 9000)}`
    while (dbHelper.queryOne('SELECT id FROM inventory_items WHERE sku = ?', [cleanSku])) {
      cleanSku = `INV-${Math.floor(1000 + Math.random() * 9000)}`
    }
  }

  const cleanMinStock = minimumStockLevel !== undefined && minimumStockLevel !== null
    ? validateNonNegativeNumber(minimumStockLevel, 'Minimum stock level')
    : 5

  const cleanSellingPrice = currentSellingPrice !== undefined && currentSellingPrice !== null
    ? validateNonNegativeNumber(currentSellingPrice, 'Current selling price')
    : 0

  let parsedInitialBatch = null
  if (initialBatch && typeof initialBatch === 'object') {
    if (initialBatch.qty !== undefined && initialBatch.qty !== null && initialBatch.qty !== '') {
      const bQty = validatePositiveNumber(initialBatch.qty, 'Initial batch quantity')
      const bCost = initialBatch.unitCost !== undefined && initialBatch.unitCost !== null && initialBatch.unitCost !== ''
        ? validateNonNegativeNumber(initialBatch.unitCost, 'Initial batch unit cost')
        : 0
      parsedInitialBatch = {
        qty: bQty,
        unitCost: bCost,
        supplierId: initialBatch.supplierId || defaultSupplierId || null,
        supplierDocumentNo: initialBatch.supplierDocumentNo || '',
        receivedAt: initialBatch.receivedAt || new Date().toISOString().slice(0, 10),
        batchNo: initialBatch.batchNo || null,
        expiryDate: initialBatch.expiryDate || null,
        notes: initialBatch.notes || ''
      }
    }
  }

  return dbHelper.runTransaction(() => {
    const res = dbHelper.runSql(
      `INSERT INTO inventory_items (sku, name, category, default_supplier_id, minimum_stock_level, current_selling_price, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        cleanSku,
        cleanName,
        cleanCategory,
        defaultSupplierId || null,
        cleanMinStock,
        cleanSellingPrice,
        notes ? notes.trim() : ''
      ]
    )
    const itemId = res.lastInsertRowid

    if (parsedInitialBatch) {
      const batchNo = parsedInitialBatch.batchNo && parsedInitialBatch.batchNo.trim()
        ? parsedInitialBatch.batchNo.trim()
        : generateBatchNo(itemId)

      dbHelper.runSql(
        `INSERT INTO inventory_batches (batch_no, inventory_item_id, supplier_id, supplier_document_no, received_at, received_qty, remaining_qty, unit_cost, expiry_date, notes)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          batchNo,
          itemId,
          parsedInitialBatch.supplierId,
          parsedInitialBatch.supplierDocumentNo,
          parsedInitialBatch.receivedAt,
          parsedInitialBatch.qty,
          parsedInitialBatch.qty,
          parsedInitialBatch.unitCost,
          parsedInitialBatch.expiryDate,
          parsedInitialBatch.notes
        ]
      )
    }

    return get(itemId)
  })
}

const updateItem = (id, data) => {
  if (!id) throw new Error('Item id is required.')
  const existing = dbHelper.queryOne('SELECT id FROM inventory_items WHERE id = ?', [id])
  if (!existing) throw new Error('Item not found.')
  if (!data || typeof data !== 'object') throw new Error('Update data is required.')

  let cleanSku = undefined
  if (data.sku !== undefined && data.sku !== null) {
    if (typeof data.sku !== 'string' || !data.sku.trim()) {
      throw new Error('SKU / Part number cannot be whitespace-only.')
    }
    cleanSku = validateSku(data.sku, id)
  }

  let cleanName = undefined
  if (data.name !== undefined && data.name !== null) {
    cleanName = validateItemName(data.name)
  }

  let cleanCategory = undefined
  if (data.category !== undefined && data.category !== null) {
    cleanCategory = validateCategory(data.category)
  }

  let cleanMinStock = undefined
  if (data.minimumStockLevel !== undefined && data.minimumStockLevel !== null) {
    cleanMinStock = validateNonNegativeNumber(data.minimumStockLevel, 'Minimum stock level')
  }

  let cleanSellingPrice = undefined
  if (data.currentSellingPrice !== undefined && data.currentSellingPrice !== null) {
    cleanSellingPrice = validateNonNegativeNumber(data.currentSellingPrice, 'Current selling price')
  }

  let cleanIsActive = undefined
  if (data.isActive !== undefined && data.isActive !== null) {
    if (data.isActive !== 0 && data.isActive !== 1 && data.isActive !== true && data.isActive !== false) {
      throw new Error('isActive must be 0, 1, true, or false.')
    }
    cleanIsActive = data.isActive ? 1 : 0
  }

  return dbHelper.runTransaction(() => {
    dbHelper.runSql(
      `UPDATE inventory_items
       SET sku = COALESCE(?, sku),
           name = COALESCE(?, name),
           category = COALESCE(?, category),
           default_supplier_id = CASE WHEN ? THEN ? ELSE default_supplier_id END,
           minimum_stock_level = COALESCE(?, minimum_stock_level),
           current_selling_price = COALESCE(?, current_selling_price),
           notes = CASE WHEN ? THEN ? ELSE notes END,
           is_active = COALESCE(?, is_active),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [
        cleanSku !== undefined ? cleanSku : null,
        cleanName !== undefined ? cleanName : null,
        cleanCategory !== undefined ? cleanCategory : null,
        data.defaultSupplierId !== undefined ? 1 : 0,
        data.defaultSupplierId !== undefined ? (data.defaultSupplierId || null) : null,
        cleanMinStock !== undefined ? cleanMinStock : null,
        cleanSellingPrice !== undefined ? cleanSellingPrice : null,
        data.notes !== undefined ? 1 : 0,
        data.notes !== undefined ? (data.notes ? data.notes.trim() : '') : null,
        cleanIsActive !== undefined ? cleanIsActive : null,
        id
      ]
    )

    return get(id)
  })
}

const receiveBatch = ({
  inventoryItemId,
  batchNo = '',
  supplierId = null,
  supplierDocumentNo = '',
  receivedAt = '',
  receivedQty,
  unitCost = 0,
  expiryDate = null,
  notes = ''
} = {}) => {
  if (!inventoryItemId) {
    throw new Error('Inventory item is required.')
  }
  const item = dbHelper.queryOne('SELECT id, name FROM inventory_items WHERE id = ?', [inventoryItemId])
  if (!item) {
    throw new Error('Inventory item not found.')
  }

  const qty = validatePositiveNumber(receivedQty, 'Received quantity')
  const cost = unitCost !== undefined && unitCost !== null && unitCost !== ''
    ? validateNonNegativeNumber(unitCost, 'Unit cost')
    : 0

  let batchNumber = batchNo && typeof batchNo === 'string' && batchNo.trim()
    ? batchNo.trim()
    : generateBatchNo(inventoryItemId)

  if (batchNo && typeof batchNo === 'string' && batchNo.trim()) {
    const dup = dbHelper.queryOne('SELECT id FROM inventory_batches WHERE batch_no = ?', [batchNumber])
    if (dup) {
      throw new Error(`Batch number "${batchNumber}" is already in use.`)
    }
  }

  const dateStr = receivedAt || new Date().toISOString().slice(0, 10)

  return dbHelper.runTransaction(() => {
    const result = dbHelper.runSql(
      `INSERT INTO inventory_batches (batch_no, inventory_item_id, supplier_id, supplier_document_no, received_at, received_qty, remaining_qty, unit_cost, expiry_date, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        batchNumber,
        inventoryItemId,
        supplierId || null,
        supplierDocumentNo ? supplierDocumentNo.trim() : '',
        dateStr,
        qty,
        qty,
        cost,
        expiryDate || null,
        notes ? notes.trim() : ''
      ]
    )

    return dbHelper.queryOne(
      `SELECT b.*, s.name AS supplierName
       FROM inventory_batches b
       LEFT JOIN suppliers s ON s.id = b.supplier_id
       WHERE b.id = ?`,
      [result.lastInsertRowid]
    )
  })
}

/**
 * Consumes parts using FIFO algorithm across oldest active batches.
 * Creates snapshots in job_parts table and reduces inventory_batches.remaining_qty.
 * If jobCardId is invalid or a subsequent step fails, transaction automatically rolls back.
 */
const consumeFifo = (jobCardId, inventoryItemId, requiredQty, sellingPriceOverride = null, userId = null) => {
  if (!inventoryItemId) throw new Error('Inventory item is required.')
  const needed = validatePositiveNumber(requiredQty, 'Quantity')

  return dbHelper.runTransaction(() => {
    const item = dbHelper.queryOne(
      'SELECT id, name, current_selling_price FROM inventory_items WHERE id = ?',
      [inventoryItemId]
    )
    if (!item) throw new Error('Inventory item not found.')

    let sellingPrice = item.current_selling_price
    if (sellingPriceOverride !== null && sellingPriceOverride !== undefined && sellingPriceOverride !== '') {
      sellingPrice = validateNonNegativeNumber(sellingPriceOverride, 'Selling price')
    }

    // Find all active batches ordered by received_at ASC, id ASC
    const activeBatches = dbHelper.queryAll(
      `SELECT id, batch_no, remaining_qty, unit_cost
       FROM inventory_batches
       WHERE inventory_item_id = ? AND remaining_qty > 0
       ORDER BY received_at ASC, id ASC`,
      [inventoryItemId]
    )

    const totalAvailable = activeBatches.reduce((acc, b) => acc + b.remaining_qty, 0)

    if (totalAvailable < needed) {
      throw new Error(
        `Insufficient stock for "${item.name}". Required: ${needed}, Available: ${totalAvailable}`
      )
    }

    let remainingNeeded = needed
    const createdParts = []

    for (const batch of activeBatches) {
      if (remainingNeeded <= 0) break

      const deduct = Math.min(batch.remaining_qty, remainingNeeded)
      const newRemaining = batch.remaining_qty - deduct

      // Update batch remaining
      dbHelper.runSql(
        'UPDATE inventory_batches SET remaining_qty = ? WHERE id = ?',
        [newRemaining, batch.id]
      )

      // Insert job_parts row with snapshots.
      // If jobCardId is an invalid foreign key, SQLite foreign key constraint
      // deterministically fails here, rolling back the batch update above.
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

      remainingNeeded -= deduct
    }

    return createdParts
  })
}

/**
 * Restores parts back to the respective inventory batch when removed from a job card.
 */
const restorePartQty = (jobPartId) => {
  if (!jobPartId) throw new Error('Job part ID is required.')
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
