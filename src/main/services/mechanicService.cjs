const dbHelper = require('../../database/db.cjs')

const list = () => {
  const sql = `
    SELECT m.id, m.user_id AS userId, m.name, m.phone, m.specialty,
           m.availability_status AS availabilityStatus,
           m.is_active AS isActive, m.created_at AS createdAt,
           COUNT(CASE WHEN j.status IN ('pending', 'in_progress') THEN 1 END) AS activeWorkload,
           u.username AS linkedUsername
    FROM mechanics m
    LEFT JOIN users u ON u.id = m.user_id
    LEFT JOIN job_assignments ja ON ja.mechanic_id = m.id AND ja.unassigned_at IS NULL
    LEFT JOIN job_cards j ON j.id = ja.job_card_id AND j.status IN ('pending', 'in_progress')
    GROUP BY m.id
    ORDER BY m.is_active DESC, m.name ASC
  `
  return dbHelper.queryAll(sql)
}

const get = (id) => {
  const mechanic = dbHelper.queryOne(
    `SELECT m.id, m.user_id AS userId, m.name, m.phone, m.specialty,
            m.availability_status AS availabilityStatus,
            m.is_active AS isActive, m.created_at AS createdAt,
            u.username AS linkedUsername
     FROM mechanics m
     LEFT JOIN users u ON u.id = m.user_id
     WHERE m.id = ?`,
    [id]
  )
  if (!mechanic) return null

  const assignedJobs = dbHelper.queryAll(
    `SELECT j.id, j.job_no AS jobNo, j.status, j.complaint, j.opened_at AS openedAt,
            v.registration_no AS registrationNo, v.model AS vehicleModel,
            c.full_name AS customerName
     FROM job_cards j
     JOIN job_assignments ja ON ja.job_card_id = j.id AND ja.unassigned_at IS NULL
     JOIN vehicles v ON v.id = j.vehicle_id
     JOIN customers c ON c.id = j.customer_id
     WHERE ja.mechanic_id = ? AND j.status IN ('pending', 'in_progress')
     ORDER BY j.opened_at DESC`,
    [id]
  )

  return {
    ...mechanic,
    assignedJobs
  }
}

const create = ({ name, phone = '', specialty = 'General Repair', availabilityStatus = 'available', userId = null }) => {
  if (!name) throw new Error('Mechanic name is required.')

  const result = dbHelper.runSql(
    `INSERT INTO mechanics (name, phone, specialty, availability_status, user_id, is_active)
     VALUES (?, ?, ?, ?, ?, 1)`,
    [name.trim(), phone.trim(), specialty.trim(), availabilityStatus, userId || null]
  )

  return get(result.lastInsertRowid)
}

const update = (id, { name, phone, specialty, availabilityStatus, isActive, userId }) => {
  const existing = dbHelper.queryOne('SELECT id FROM mechanics WHERE id = ?', [id])
  if (!existing) throw new Error('Mechanic not found.')

  dbHelper.runSql(
    `UPDATE mechanics
     SET name = COALESCE(?, name),
         phone = COALESCE(?, phone),
         specialty = COALESCE(?, specialty),
         availability_status = COALESCE(?, availability_status),
         is_active = COALESCE(?, is_active),
         user_id = COALESCE(?, user_id),
         updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`,
    [
      name?.trim() || null,
      phone?.trim() ?? null,
      specialty?.trim() ?? null,
      availabilityStatus || null,
      isActive !== undefined ? isActive : null,
      userId !== undefined ? userId : null,
      id
    ]
  )

  return get(id)
}

const updateStatus = (id, availabilityStatus) => {
  const valid = ['available', 'busy', 'off_duty']
  if (!valid.includes(availabilityStatus)) {
    throw new Error('Invalid availability status.')
  }
  dbHelper.runSql(
    'UPDATE mechanics SET availability_status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
    [availabilityStatus, id]
  )
  return get(id)
}

module.exports = {
  list,
  get,
  create,
  update,
  updateStatus
}
