const dbHelper = require('../../database/db.cjs')

const list = ({ customerId = null, search = '' } = {}) => {
  let sql = `
    SELECT v.id, v.customer_id AS customerId, v.registration_no AS registrationNo,
           v.make, v.model, v.year, v.vehicle_type AS vehicleType,
           v.engine_no AS engineNo, v.chassis_no AS chassisNo,
           v.mileage, v.notes, v.created_at AS createdAt,
           c.full_name AS customerName, c.phone AS customerPhone
    FROM vehicles v
    JOIN customers c ON c.id = v.customer_id
  `
  const params = []
  const conditions = []

  if (customerId) {
    conditions.push('v.customer_id = ?')
    params.push(customerId)
  }

  if (search && search.trim()) {
    conditions.push('(v.registration_no LIKE ? OR v.make LIKE ? OR v.model LIKE ? OR c.full_name LIKE ?)')
    const term = `%${search.trim()}%`
    params.push(term, term, term, term)
  }

  if (conditions.length > 0) {
    sql += ' WHERE ' + conditions.join(' AND ')
  }

  sql += ' ORDER BY v.id DESC'
  return dbHelper.queryAll(sql, params)
}

const get = (id) => {
  const vehicle = dbHelper.queryOne(
    `SELECT v.id, v.customer_id AS customerId, v.registration_no AS registrationNo,
            v.make, v.model, v.year, v.vehicle_type AS vehicleType,
            v.engine_no AS engineNo, v.chassis_no AS chassisNo,
            v.mileage, v.notes, v.created_at AS createdAt,
            c.full_name AS customerName, c.phone AS customerPhone
     FROM vehicles v
     JOIN customers c ON c.id = v.customer_id
     WHERE v.id = ?`,
    [id]
  )
  if (!vehicle) return null

  const serviceHistory = dbHelper.queryAll(
    `SELECT j.id, j.job_no AS jobNo, j.status, j.complaint, j.opened_at AS openedAt,
            j.completed_at AS completedAt, m.name AS mechanicName,
            COALESCE(inv.total, 0) AS invoiceTotal,
            COALESCE(inv.payment_status, 'none') AS paymentStatus
     FROM job_cards j
     LEFT JOIN job_assignments ja ON ja.job_card_id = j.id AND ja.unassigned_at IS NULL
     LEFT JOIN mechanics m ON m.id = ja.mechanic_id
     LEFT JOIN invoices inv ON inv.job_card_id = j.id
     WHERE j.vehicle_id = ?
     ORDER BY j.opened_at DESC LIMIT 20`,
    [id]
  )

  return {
    ...vehicle,
    serviceHistory
  }
}

const create = ({
  customerId,
  registrationNo,
  make = '',
  model = '',
  year = null,
  vehicleType = 'Car',
  engineNo = '',
  chassisNo = '',
  mileage = null,
  notes = ''
}) => {
  if (!customerId || !registrationNo) {
    throw new Error('Customer ID and Vehicle Registration Number are required.')
  }

  const existingReg = dbHelper.queryOne(
    'SELECT id FROM vehicles WHERE UPPER(registration_no) = UPPER(?)',
    [registrationNo.trim()]
  )
  if (existingReg) {
    throw new Error(`Vehicle with registration number ${registrationNo} already exists.`)
  }

  const result = dbHelper.runSql(
    `INSERT INTO vehicles (customer_id, registration_no, make, model, year, vehicle_type, engine_no, chassis_no, mileage, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      customerId,
      registrationNo.trim().toUpperCase(),
      make.trim(),
      model.trim(),
      year ? parseInt(year, 10) : null,
      vehicleType.trim(),
      engineNo.trim(),
      chassisNo.trim(),
      mileage ? parseInt(mileage, 10) : null,
      notes.trim()
    ]
  )

  return get(result.lastInsertRowid)
}

const update = (id, data) => {
  const existing = dbHelper.queryOne('SELECT id FROM vehicles WHERE id = ?', [id])
  if (!existing) throw new Error('Vehicle not found.')

  if (data.registrationNo) {
    const dup = dbHelper.queryOne(
      'SELECT id FROM vehicles WHERE UPPER(registration_no) = UPPER(?) AND id != ?',
      [data.registrationNo.trim(), id]
    )
    if (dup) throw new Error(`Registration number ${data.registrationNo} already in use.`)
  }

  dbHelper.runSql(
    `UPDATE vehicles
     SET customer_id = COALESCE(?, customer_id),
         registration_no = COALESCE(?, registration_no),
         make = COALESCE(?, make),
         model = COALESCE(?, model),
         year = COALESCE(?, year),
         vehicle_type = COALESCE(?, vehicle_type),
         engine_no = COALESCE(?, engine_no),
         chassis_no = COALESCE(?, chassis_no),
         mileage = COALESCE(?, mileage),
         notes = COALESCE(?, notes),
         updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`,
    [
      data.customerId || null,
      data.registrationNo?.trim().toUpperCase() || null,
      data.make?.trim() ?? null,
      data.model?.trim() ?? null,
      data.year !== undefined ? (data.year ? parseInt(data.year, 10) : null) : null,
      data.vehicleType?.trim() ?? null,
      data.engineNo?.trim() ?? null,
      data.chassisNo?.trim() ?? null,
      data.mileage !== undefined ? (data.mileage ? parseInt(data.mileage, 10) : null) : null,
      data.notes?.trim() ?? null,
      id
    ]
  )

  return get(id)
}

const remove = (id) => {
  const jobCount = dbHelper.queryOne('SELECT COUNT(*) AS count FROM job_cards WHERE vehicle_id = ?', [id])
  if (jobCount && jobCount.count > 0) {
    throw new Error('Cannot delete vehicle with linked job cards.')
  }

  dbHelper.runSql('DELETE FROM vehicles WHERE id = ?', [id])
  return { success: true }
}

module.exports = {
  list,
  get,
  create,
  update,
  remove
}
