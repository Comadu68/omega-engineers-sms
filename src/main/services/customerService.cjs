const dbHelper = require('../../database/db.cjs')

const list = ({ search = '', limit = 100, offset = 0 } = {}) => {
  let sql = `
    SELECT c.id, c.full_name AS fullName, c.phone, c.alternate_phone AS alternatePhone,
           c.email, c.address, c.notes, c.created_at AS createdAt,
           COUNT(DISTINCT v.id) AS vehicleCount,
           COUNT(DISTINCT j.id) AS jobCount,
           MAX(j.opened_at) AS lastServiceDate
    FROM customers c
    LEFT JOIN vehicles v ON v.customer_id = c.id
    LEFT JOIN job_cards j ON j.customer_id = c.id
  `
  const params = []
  if (search && search.trim()) {
    const term = `%${search.trim()}%`
    sql += ` WHERE c.full_name LIKE ? OR c.phone LIKE ? OR c.email LIKE ?
             OR v.registration_no LIKE ? `
    params.push(term, term, term, term)
  }

  sql += ' GROUP BY c.id ORDER BY c.id DESC LIMIT ? OFFSET ?'
  params.push(limit, offset)

  return dbHelper.queryAll(sql, params)
}

const get = (id) => {
  const customer = dbHelper.queryOne(
    `SELECT id, full_name AS fullName, phone, alternate_phone AS alternatePhone,
            email, address, notes, created_at AS createdAt, updated_at AS updatedAt
     FROM customers WHERE id = ?`,
    [id]
  )
  if (!customer) return null

  const vehicles = dbHelper.queryAll(
    `SELECT id, registration_no AS registrationNo, make, model, year, vehicle_type AS vehicleType,
            engine_no AS engineNo, chassis_no AS chassisNo, mileage, notes, created_at AS createdAt
     FROM vehicles WHERE customer_id = ? ORDER BY id DESC`,
    [id]
  )

  const jobHistory = dbHelper.queryAll(
    `SELECT j.id, j.job_no AS jobNo, j.status, j.complaint, j.opened_at AS openedAt,
            j.completed_at AS completedAt, v.registration_no AS registrationNo, v.model AS vehicleModel,
            COALESCE(inv.total, 0) AS invoiceTotal,
            COALESCE(inv.payment_status, 'none') AS paymentStatus
     FROM job_cards j
     JOIN vehicles v ON v.id = j.vehicle_id
     LEFT JOIN invoices inv ON inv.job_card_id = j.id
     WHERE j.customer_id = ?
     ORDER BY j.opened_at DESC LIMIT 20`,
    [id]
  )

  const appointments = dbHelper.queryAll(
    `SELECT a.id, a.service_reason AS serviceReason, a.appointment_date AS appointmentDate,
            a.start_time AS startTime, a.status, v.registration_no AS registrationNo
     FROM appointments a
     JOIN vehicles v ON v.id = a.vehicle_id
     WHERE a.customer_id = ?
     ORDER BY a.appointment_date DESC, a.start_time DESC LIMIT 10`,
    [id]
  )

  return {
    ...customer,
    vehicles,
    jobHistory,
    appointments
  }
}

const create = ({ fullName, phone, alternatePhone = '', email = '', address = '', notes = '' }) => {
  if (!fullName || !phone) {
    throw new Error('Customer full name and primary phone number are required.')
  }

  const result = dbHelper.runSql(
    `INSERT INTO customers (full_name, phone, alternate_phone, email, address, notes)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [fullName.trim(), phone.trim(), alternatePhone.trim(), email.trim(), address.trim(), notes.trim()]
  )

  return get(result.lastInsertRowid)
}

const update = (id, { fullName, phone, alternatePhone, email, address, notes }) => {
  const existing = dbHelper.queryOne('SELECT id FROM customers WHERE id = ?', [id])
  if (!existing) throw new Error('Customer not found.')

  dbHelper.runSql(
    `UPDATE customers
     SET full_name = COALESCE(?, full_name),
         phone = COALESCE(?, phone),
         alternate_phone = COALESCE(?, alternate_phone),
         email = COALESCE(?, email),
         address = COALESCE(?, address),
         notes = COALESCE(?, notes),
         updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`,
    [fullName?.trim() || null, phone?.trim() || null, alternatePhone?.trim() ?? null,
     email?.trim() ?? null, address?.trim() ?? null, notes?.trim() ?? null, id]
  )

  return get(id)
}

const remove = (id) => {
  const vehicleCount = dbHelper.queryOne('SELECT COUNT(*) AS count FROM vehicles WHERE customer_id = ?', [id])
  if (vehicleCount && vehicleCount.count > 0) {
    throw new Error('Cannot delete customer with linked vehicles. Please remove vehicles first.')
  }

  const jobCount = dbHelper.queryOne('SELECT COUNT(*) AS count FROM job_cards WHERE customer_id = ?', [id])
  if (jobCount && jobCount.count > 0) {
    throw new Error('Cannot delete customer with existing job history.')
  }

  dbHelper.runSql('DELETE FROM customers WHERE id = ?', [id])
  return { success: true }
}

module.exports = {
  list,
  get,
  create,
  update,
  remove
}
