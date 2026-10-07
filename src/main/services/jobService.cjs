const dbHelper = require('../../database/db.cjs')
const inventoryService = require('./inventoryService.cjs')

const generateJobNo = () => {
  const maxJob = dbHelper.queryOne('SELECT MAX(id) AS maxId FROM job_cards')
  const nextNumber = maxJob && maxJob.maxId ? 1000 + maxJob.maxId + 1 : 1001
  return `JC-${nextNumber}`
}

const list = ({ status = null, mechanicId = null, search = '', dateFrom = null, dateTo = null } = {}) => {
  let sql = `
    SELECT j.id, j.job_no AS jobNo, j.status, j.complaint, j.service_details AS serviceDetails,
           j.odometer, j.opened_at AS openedAt, j.completed_at AS completedAt,
           j.cancelled_at AS cancelledAt, j.cancellation_reason AS cancellationReason,
           j.customer_id AS customerId, j.vehicle_id AS vehicleId,
           c.full_name AS customerName, c.phone AS customerPhone,
           v.registration_no AS registrationNo, v.make AS vehicleMake, v.model AS vehicleModel,
           m.id AS mechanicId, m.name AS mechanicName,
           COUNT(DISTINCT t.id) AS totalTasks,
           COUNT(DISTINCT CASE WHEN t.status = 'completed' THEN t.id END) AS completedTasks,
           COALESCE(SUM(t.service_charge), 0) AS serviceTotal,
           COALESCE((SELECT SUM(jp.qty * jp.selling_price_at_use) FROM job_parts jp WHERE jp.job_card_id = j.id), 0) AS partsSalesTotal,
           inv.id AS invoiceId, inv.invoice_no AS invoiceNo, inv.payment_status AS paymentStatus
    FROM job_cards j
    JOIN customers c ON c.id = j.customer_id
    JOIN vehicles v ON v.id = j.vehicle_id
    LEFT JOIN job_assignments ja ON ja.job_card_id = j.id AND ja.unassigned_at IS NULL
    LEFT JOIN mechanics m ON m.id = ja.mechanic_id
    LEFT JOIN job_tasks t ON t.job_card_id = j.id
    LEFT JOIN invoices inv ON inv.job_card_id = j.id
  `
  const conditions = []
  const params = []

  if (status) {
    conditions.push('j.status = ?')
    params.push(status)
  }

  if (mechanicId) {
    conditions.push('ja.mechanic_id = ?')
    params.push(mechanicId)
  }

  if (dateFrom && dateTo) {
    conditions.push('date(j.opened_at) BETWEEN ? AND ?')
    params.push(dateFrom, dateTo)
  } else if (dateFrom) {
    conditions.push('date(j.opened_at) >= ?')
    params.push(dateFrom)
  } else if (dateTo) {
    conditions.push('date(j.opened_at) <= ?')
    params.push(dateTo)
  }

  if (search && search.trim()) {
    conditions.push('(j.job_no LIKE ? OR c.full_name LIKE ? OR c.phone LIKE ? OR v.registration_no LIKE ? OR j.complaint LIKE ?)')
    const term = `%${search.trim()}%`
    params.push(term, term, term, term, term)
  }

  if (conditions.length > 0) {
    sql += ' WHERE ' + conditions.join(' AND ')
  }

  sql += ' GROUP BY j.id ORDER BY j.id DESC'

  return dbHelper.queryAll(sql, params)
}

const get = (id) => {
  const sql = `
    SELECT j.id, j.job_no AS jobNo, j.status, j.complaint, j.service_details AS serviceDetails,
           j.odometer, j.opened_at AS openedAt, j.completed_at AS completedAt,
           j.cancelled_at AS cancelledAt, j.cancellation_reason AS cancellationReason,
           j.customer_id AS customerId, j.vehicle_id AS vehicleId, j.appointment_id AS appointmentId,
           c.full_name AS customerName, c.phone AS customerPhone, c.alternate_phone AS customerAltPhone,
           c.email AS customerEmail, c.address AS customerAddress,
           v.registration_no AS registrationNo, v.make AS vehicleMake, v.model AS vehicleModel,
           v.year AS vehicleYear, v.mileage AS vehicleMileage,
           m.id AS mechanicId, m.name AS mechanicName, m.phone AS mechanicPhone, m.specialty AS mechanicSpecialty,
           inv.id AS invoiceId, inv.invoice_no AS invoiceNo, inv.total AS invoiceTotal,
           inv.payment_status AS paymentStatus
    FROM job_cards j
    JOIN customers c ON c.id = j.customer_id
    JOIN vehicles v ON v.id = j.vehicle_id
    LEFT JOIN job_assignments ja ON ja.job_card_id = j.id AND ja.unassigned_at IS NULL
    LEFT JOIN mechanics m ON m.id = ja.mechanic_id
    LEFT JOIN invoices inv ON inv.job_card_id = j.id
    WHERE j.id = ?
  `
  const job = dbHelper.queryOne(sql, [id])
  if (!job) return null

  // Fetch tasks
  const tasks = dbHelper.queryAll(
    `SELECT id, description, status, service_charge AS serviceCharge, note, completed_at AS completedAt
     FROM job_tasks WHERE job_card_id = ? ORDER BY id ASC`,
    [id]
  )

  // Fetch parts used
  const parts = dbHelper.queryAll(
    `SELECT jp.id, jp.inventory_item_id AS inventoryItemId, jp.inventory_batch_id AS inventoryBatchId,
            jp.qty, jp.unit_cost_at_use AS unitCostAtUse, jp.selling_price_at_use AS sellingPriceAtUse,
            (jp.qty * jp.selling_price_at_use) AS lineTotal,
            (jp.qty * jp.unit_cost_at_use) AS costTotal,
            jp.used_at AS usedAt,
            i.name AS itemName, i.sku AS itemSku,
            b.batch_no AS batchNo
     FROM job_parts jp
     JOIN inventory_items i ON i.id = jp.inventory_item_id
     JOIN inventory_batches b ON b.id = jp.inventory_batch_id
     WHERE jp.job_card_id = ? ORDER BY jp.id ASC`,
    [id]
  )

  // Calculations
  const serviceRevenue = tasks.reduce((sum, t) => sum + (t.serviceCharge || 0), 0)
  const partsSalesTotal = parts.reduce((sum, p) => sum + (p.lineTotal || 0), 0)
  const partsCostTotal = parts.reduce((sum, p) => sum + (p.costTotal || 0), 0)
  const totalBill = serviceRevenue + partsSalesTotal
  const grossProfit = totalBill - partsCostTotal

  const completedTasksCount = tasks.filter((t) => t.status === 'completed').length

  return {
    ...job,
    tasks,
    parts,
    completedTasksCount,
    totalTasksCount: tasks.length,
    serviceRevenue,
    partsSalesTotal,
    partsCostTotal,
    grossProfit,
    totalBill
  }
}

const create = ({
  customerId,
  vehicleId,
  appointmentId = null,
  complaint,
  serviceDetails = '',
  odometer = null,
  mechanicId = null,
  tasks = [],
  userId = null
}) => {
  if (!customerId || !vehicleId || !complaint) {
    throw new Error('Customer, Vehicle, and Complaint/Service request are required.')
  }

  return dbHelper.runTransaction(() => {
    const jobNo = generateJobNo()
    const res = dbHelper.runSql(
      `INSERT INTO job_cards (job_no, appointment_id, customer_id, vehicle_id, complaint, service_details, odometer, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        jobNo,
        appointmentId || null,
        customerId,
        vehicleId,
        complaint.trim(),
        serviceDetails.trim(),
        odometer ? parseInt(odometer, 10) : null,
        userId
      ]
    )
    const jobId = res.lastInsertRowid

    // If mechanic assigned
    if (mechanicId) {
      dbHelper.runSql(
        'INSERT INTO job_assignments (job_card_id, mechanic_id, assigned_by) VALUES (?, ?, ?)',
        [jobId, mechanicId, userId]
      )
    }

    // If initial tasks provided
    if (Array.isArray(tasks)) {
      for (const t of tasks) {
        if (t.description && t.description.trim()) {
          dbHelper.runSql(
            `INSERT INTO job_tasks (job_card_id, description, service_charge, note)
             VALUES (?, ?, ?, ?)`,
            [
              jobId,
              t.description.trim(),
              Math.max(0, parseFloat(t.serviceCharge) || 0),
              t.note ? t.note.trim() : ''
            ]
          )
        }
      }
    }

    // If opened from appointment, mark appointment completed/converted
    if (appointmentId) {
      dbHelper.runSql(
        "UPDATE appointments SET status = 'completed', updated_at = CURRENT_TIMESTAMP WHERE id = ?",
        [appointmentId]
      )
    }

    return get(jobId)
  })
}

const updateStatus = (id, status, cancellationReason = null) => {
  const valid = ['pending', 'in_progress', 'completed', 'cancelled']
  if (!valid.includes(status)) throw new Error('Invalid job status.')

  const existing = dbHelper.queryOne('SELECT status FROM job_cards WHERE id = ?', [id])
  if (!existing) throw new Error('Job Card not found.')

  let completedAt = null
  let cancelledAt = null

  if (status === 'completed') {
    completedAt = new Date().toISOString()
  } else if (status === 'cancelled') {
    cancelledAt = new Date().toISOString()
  }

  dbHelper.runSql(
    `UPDATE job_cards
     SET status = ?,
         completed_at = CASE WHEN ? = 'completed' THEN CURRENT_TIMESTAMP ELSE completed_at END,
         cancelled_at = CASE WHEN ? = 'cancelled' THEN CURRENT_TIMESTAMP ELSE cancelled_at END,
         cancellation_reason = CASE WHEN ? = 'cancelled' THEN ? ELSE cancellation_reason END,
         updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`,
    [status, status, status, status, cancellationReason ? cancellationReason.trim() : null, id]
  )

  return get(id)
}

const assignMechanic = (jobId, mechanicId, userId = null) => {
  return dbHelper.runTransaction(() => {
    // Unassign previous active assignment
    dbHelper.runSql(
      'UPDATE job_assignments SET unassigned_at = CURRENT_TIMESTAMP WHERE job_card_id = ? AND unassigned_at IS NULL',
      [jobId]
    )

    if (mechanicId) {
      dbHelper.runSql(
        'INSERT INTO job_assignments (job_card_id, mechanic_id, assigned_by) VALUES (?, ?, ?)',
        [jobId, mechanicId, userId]
      )
    }

    return get(jobId)
  })
}

const addTask = (jobId, { description, serviceCharge = 0, note = '' }) => {
  if (!description || !description.trim()) {
    throw new Error('Task description is required.')
  }
  dbHelper.runSql(
    'INSERT INTO job_tasks (job_card_id, description, service_charge, note) VALUES (?, ?, ?, ?)',
    [jobId, description.trim(), Math.max(0, parseFloat(serviceCharge) || 0), note.trim()]
  )
  return get(jobId)
}

const updateTask = (taskId, { description, status, serviceCharge, note }) => {
  const valid = ['pending', 'in_progress', 'completed', 'cancelled']
  if (status && !valid.includes(status)) throw new Error('Invalid task status.')

  dbHelper.runSql(
    `UPDATE job_tasks
     SET description = COALESCE(?, description),
         status = COALESCE(?, status),
         service_charge = COALESCE(?, service_charge),
         note = COALESCE(?, note),
         completed_at = CASE WHEN ? = 'completed' THEN CURRENT_TIMESTAMP ELSE completed_at END
     WHERE id = ?`,
    [
      description?.trim() || null,
      status || null,
      serviceCharge !== undefined ? Math.max(0, parseFloat(serviceCharge)) : null,
      note?.trim() ?? null,
      status || null,
      taskId
    ]
  )

  const task = dbHelper.queryOne('SELECT job_card_id FROM job_tasks WHERE id = ?', [taskId])
  return task ? get(task.job_card_id) : null
}

const deleteTask = (taskId) => {
  const task = dbHelper.queryOne('SELECT job_card_id FROM job_tasks WHERE id = ?', [taskId])
  if (task) {
    dbHelper.runSql('DELETE FROM job_tasks WHERE id = ?', [taskId])
    return get(task.job_card_id)
  }
  return null
}

const addPart = (jobId, { inventoryItemId, qty, sellingPriceOverride = null, userId = null }) => {
  inventoryService.consumeFifo(jobId, inventoryItemId, qty, sellingPriceOverride, userId)
  return get(jobId)
}

const removePart = (jobPartId) => {
  const part = dbHelper.queryOne('SELECT job_card_id FROM job_parts WHERE id = ?', [jobPartId])
  if (!part) throw new Error('Part record not found.')
  inventoryService.restorePartQty(jobPartId)
  return get(part.job_card_id)
}

module.exports = {
  list,
  get,
  create,
  updateStatus,
  assignMechanic,
  addTask,
  updateTask,
  deleteTask,
  addPart,
  removePart
}
