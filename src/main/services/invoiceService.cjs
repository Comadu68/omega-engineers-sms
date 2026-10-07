const dbHelper = require('../../database/db.cjs')
const jobService = require('./jobService.cjs')

const generateInvoiceNo = () => {
  const maxInv = dbHelper.queryOne('SELECT MAX(id) AS maxId FROM invoices')
  const nextNumber = maxInv && maxInv.maxId ? 1000 + maxInv.maxId + 1 : 1001
  return `INV-${nextNumber}`
}

const list = ({ status = null, search = '', dateFrom = null, dateTo = null } = {}) => {
  let sql = `
    SELECT inv.id, inv.invoice_no AS invoiceNo, inv.job_card_id AS jobCardId,
           inv.customer_id AS customerId, inv.vehicle_id AS vehicleId,
           inv.subtotal, inv.discount, inv.total,
           inv.payment_status AS paymentStatus, inv.issued_at AS issuedAt,
           c.full_name AS customerName, c.phone AS customerPhone,
           v.registration_no AS registrationNo, v.make AS vehicleMake, v.model AS vehicleModel,
           j.job_no AS jobNo,
           COALESCE((SELECT SUM(p.amount) FROM payments p WHERE p.invoice_id = inv.id), 0) AS amountPaid,
           (inv.total - COALESCE((SELECT SUM(p.amount) FROM payments p WHERE p.invoice_id = inv.id), 0)) AS balance
    FROM invoices inv
    JOIN customers c ON c.id = inv.customer_id
    JOIN vehicles v ON v.id = inv.vehicle_id
    JOIN job_cards j ON j.id = inv.job_card_id
  `
  const conditions = []
  const params = []

  if (status) {
    conditions.push('inv.payment_status = ?')
    params.push(status)
  }

  if (dateFrom && dateTo) {
    conditions.push('date(inv.issued_at) BETWEEN ? AND ?')
    params.push(dateFrom, dateTo)
  } else if (dateFrom) {
    conditions.push('date(inv.issued_at) >= ?')
    params.push(dateFrom)
  } else if (dateTo) {
    conditions.push('date(inv.issued_at) <= ?')
    params.push(dateTo)
  }

  if (search && search.trim()) {
    conditions.push('(inv.invoice_no LIKE ? OR j.job_no LIKE ? OR c.full_name LIKE ? OR c.phone LIKE ? OR v.registration_no LIKE ?)')
    const term = `%${search.trim()}%`
    params.push(term, term, term, term, term)
  }

  if (conditions.length > 0) {
    sql += ' WHERE ' + conditions.join(' AND ')
  }

  sql += ' ORDER BY inv.id DESC'
  return dbHelper.queryAll(sql, params)
}

const get = (id) => {
  const sql = `
    SELECT inv.id, inv.invoice_no AS invoiceNo, inv.job_card_id AS jobCardId,
           inv.customer_id AS customerId, inv.vehicle_id AS vehicleId,
           inv.subtotal, inv.discount, inv.total,
           inv.payment_status AS paymentStatus, inv.issued_at AS issuedAt,
           c.full_name AS customerName, c.phone AS customerPhone, c.email AS customerEmail, c.address AS customerAddress,
           v.registration_no AS registrationNo, v.make AS vehicleMake, v.model AS vehicleModel, v.mileage AS vehicleMileage,
           j.job_no AS jobNo, j.complaint AS jobComplaint, j.completed_at AS jobCompletedAt,
           m.name AS mechanicName,
           COALESCE((SELECT SUM(p.amount) FROM payments p WHERE p.invoice_id = inv.id), 0) AS amountPaid,
           (inv.total - COALESCE((SELECT SUM(p.amount) FROM payments p WHERE p.invoice_id = inv.id), 0)) AS balance
    FROM invoices inv
    JOIN customers c ON c.id = inv.customer_id
    JOIN vehicles v ON v.id = inv.vehicle_id
    JOIN job_cards j ON j.id = inv.job_card_id
    LEFT JOIN job_assignments ja ON ja.job_card_id = j.id AND ja.unassigned_at IS NULL
    LEFT JOIN mechanics m ON m.id = ja.mechanic_id
    WHERE inv.id = ?
  `
  const invoice = dbHelper.queryOne(sql, [id])
  if (!invoice) return null

  const items = dbHelper.queryAll(
    `SELECT id, line_type AS lineType, description, qty,
            unit_price AS unitPrice, unit_cost_snapshot AS unitCostSnapshot,
            line_total AS lineTotal
     FROM invoice_items
     WHERE invoice_id = ?
     ORDER BY id ASC`,
    [id]
  )

  const payments = dbHelper.queryAll(
    `SELECT id, amount, payment_method AS paymentMethod, payment_date AS paymentDate,
            reference_no AS referenceNo, notes
     FROM payments
     WHERE invoice_id = ?
     ORDER BY payment_date DESC, id DESC`,
    [id]
  )

  // Compute next service sticker information (6 months from issue / completion)
  const issuedDate = new Date(invoice.issuedAt || Date.now())
  const nextServiceDate = new Date(issuedDate)
  nextServiceDate.setMonth(nextServiceDate.getMonth() + 6)
  const nextServiceDateFormatted = nextServiceDate.toISOString().slice(0, 10)
  const currentMileage = invoice.vehicleMileage || 0
  const nextServiceMileage = currentMileage > 0 ? currentMileage + 5000 : null

  return {
    ...invoice,
    items,
    payments,
    sticker: {
      stationName: 'OMEGA ENGINEERS',
      headline: 'Next Service Due',
      registrationNo: invoice.registrationNo,
      vehicleModel: `${invoice.vehicleMake || ''} ${invoice.vehicleModel || ''}`.trim(),
      dateFormatted: nextServiceDateFormatted,
      mileageText: nextServiceMileage ? `${nextServiceMileage.toLocaleString()} km` : '—',
      note: 'Keep this sticker on windshield'
    }
  }
}

const getByJob = (jobId) => {
  const inv = dbHelper.queryOne('SELECT id FROM invoices WHERE job_card_id = ?', [jobId])
  return inv ? get(inv.id) : null
}

const generateFromJob = (jobId, { discount = 0, userId = null } = {}) => {
  return dbHelper.runTransaction(() => {
    // Check if invoice already exists for this job
    const existing = dbHelper.queryOne('SELECT id FROM invoices WHERE job_card_id = ?', [jobId])
    if (existing) {
      return get(existing.id)
    }

    const job = jobService.get(jobId)
    if (!job) throw new Error('Job Card not found.')

    const invoiceNo = generateInvoiceNo()
    const discountAmount = Math.max(0, parseFloat(discount) || 0)

    // Calculate subtotal from tasks and parts
    let subtotal = 0
    const invoiceLineItems = []

    // 1. Service tasks
    for (const t of job.tasks) {
      const charge = parseFloat(t.serviceCharge) || 0
      subtotal += charge
      invoiceLineItems.push({
        lineType: 'service',
        description: t.description,
        qty: 1,
        unitPrice: charge,
        unitCostSnapshot: 0,
        lineTotal: charge,
        sourceJobTaskId: t.id,
        sourceJobPartId: null
      })
    }

    // 2. Parts used
    for (const p of job.parts) {
      const lineTot = (parseFloat(p.qty) || 0) * (parseFloat(p.sellingPriceAtUse) || 0)
      subtotal += lineTot
      invoiceLineItems.push({
        lineType: 'part',
        description: `${p.itemName} (${p.itemSku}) [Batch: ${p.batchNo}]`,
        qty: parseFloat(p.qty),
        unitPrice: parseFloat(p.sellingPriceAtUse),
        unitCostSnapshot: parseFloat(p.unitCostAtUse),
        lineTotal: lineTot,
        sourceJobTaskId: null,
        sourceJobPartId: p.id
      })
    }

    const total = Math.max(0, subtotal - discountAmount)

    const invRes = dbHelper.runSql(
      `INSERT INTO invoices (invoice_no, job_card_id, customer_id, vehicle_id, subtotal, discount, total, payment_status, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'unpaid', ?)`,
      [
        invoiceNo,
        jobId,
        job.customerId,
        job.vehicleId,
        subtotal,
        discountAmount,
        total,
        userId
      ]
    )
    const invoiceId = invRes.lastInsertRowid

    // Insert line items
    for (const item of invoiceLineItems) {
      dbHelper.runSql(
        `INSERT INTO invoice_items (invoice_id, line_type, description, qty, unit_price, unit_cost_snapshot, line_total, source_job_task_id, source_job_part_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          invoiceId,
          item.lineType,
          item.description,
          item.qty,
          item.unitPrice,
          item.unitCostSnapshot,
          item.lineTotal,
          item.sourceJobTaskId,
          item.sourceJobPartId
        ]
      )
    }

    return get(invoiceId)
  })
}

const cancel = (id) => {
  dbHelper.runSql("UPDATE invoices SET payment_status = 'void' WHERE id = ?", [id])
  return get(id)
}

module.exports = {
  list,
  get,
  getByJob,
  generateFromJob,
  cancel
}
