const dbHelper = require('../../database/db.cjs')

const getDailyCapacity = () => {
  const row = dbHelper.queryOne("SELECT value FROM app_settings WHERE key = 'appointment_daily_capacity'")
  return row ? parseInt(row.value, 10) : 8
}

const list = ({ date = null, startDate = null, endDate = null, status = null, search = '' } = {}) => {
  let sql = `
    SELECT a.id, a.customer_id AS customerId, a.vehicle_id AS vehicleId,
           a.service_reason AS serviceReason, a.appointment_date AS appointmentDate,
           a.start_time AS startTime, a.end_time AS endTime, a.status, a.notes,
           a.created_at AS createdAt,
           c.full_name AS customerName, c.phone AS customerPhone,
           v.registration_no AS registrationNo, v.make AS vehicleMake, v.model AS vehicleModel,
           j.id AS linkedJobCardId, j.job_no AS linkedJobNo
    FROM appointments a
    JOIN customers c ON c.id = a.customer_id
    JOIN vehicles v ON v.id = a.vehicle_id
    LEFT JOIN job_cards j ON j.appointment_id = a.id
  `
  const conditions = []
  const params = []

  if (date) {
    conditions.push('a.appointment_date = ?')
    params.push(date)
  }

  if (startDate && endDate) {
    conditions.push('a.appointment_date BETWEEN ? AND ?')
    params.push(startDate, endDate)
  } else if (startDate) {
    conditions.push('a.appointment_date >= ?')
    params.push(startDate)
  } else if (endDate) {
    conditions.push('a.appointment_date <= ?')
    params.push(endDate)
  }

  if (status) {
    conditions.push('a.status = ?')
    params.push(status)
  }

  if (search && search.trim()) {
    conditions.push('(c.full_name LIKE ? OR c.phone LIKE ? OR v.registration_no LIKE ? OR a.service_reason LIKE ?)')
    const term = `%${search.trim()}%`
    params.push(term, term, term, term)
  }

  if (conditions.length > 0) {
    sql += ' WHERE ' + conditions.join(' AND ')
  }

  sql += ' ORDER BY a.appointment_date ASC, a.start_time ASC'
  return dbHelper.queryAll(sql, params)
}

const get = (id) => {
  const sql = `
    SELECT a.id, a.customer_id AS customerId, a.vehicle_id AS vehicleId,
           a.service_reason AS serviceReason, a.appointment_date AS appointmentDate,
           a.start_time AS startTime, a.end_time AS endTime, a.status, a.notes,
           a.created_at AS createdAt,
           c.full_name AS customerName, c.phone AS customerPhone, c.email AS customerEmail,
           v.registration_no AS registrationNo, v.make AS vehicleMake, v.model AS vehicleModel,
           j.id AS linkedJobCardId, j.job_no AS linkedJobNo
    FROM appointments a
    JOIN customers c ON c.id = a.customer_id
    JOIN vehicles v ON v.id = a.vehicle_id
    LEFT JOIN job_cards j ON j.appointment_id = a.id
    WHERE a.id = ?
  `
  return dbHelper.queryOne(sql, [id])
}

const getMonthlyAvailability = (year, month) => {
  const monthStr = String(month).padStart(2, '0')
  const startDate = `${year}-${monthStr}-01`
  const lastDay = new Date(year, month, 0).getDate()
  const endDate = `${year}-${monthStr}-${String(lastDay).padStart(2, '0')}`
  const capacity = getDailyCapacity()

  const rows = dbHelper.queryAll(
    `SELECT appointment_date AS date, COUNT(*) AS bookedCount
     FROM appointments
     WHERE appointment_date BETWEEN ? AND ?
       AND status != 'cancelled'
     GROUP BY appointment_date`,
    [startDate, endDate]
  )

  const dateMap = {}
  rows.forEach((r) => {
    const booked = r.bookedCount
    let status = 'available'
    if (booked >= capacity) {
      status = 'full'
    } else if (booked >= Math.ceil(capacity / 2)) {
      status = 'limited'
    }
    dateMap[r.date] = {
      bookedCount: booked,
      maxCapacity: capacity,
      availableSlots: Math.max(0, capacity - booked),
      status
    }
  })

  return {
    year,
    month,
    maxCapacity: capacity,
    dates: dateMap
  }
}

const checkAvailability = ({ appointmentDate, startTime, excludeId = null }) => {
  const capacity = getDailyCapacity()

  // 1. Check daily total capacity (excluding cancelled)
  let countSql = `
    SELECT COUNT(*) AS bookedCount
    FROM appointments
    WHERE appointment_date = ? AND status != 'cancelled'
  `
  const countParams = [appointmentDate]
  if (excludeId) {
    countSql += ' AND id != ?'
    countParams.push(excludeId)
  }
  const dayRow = dbHelper.queryOne(countSql, countParams)
  const bookedCount = dayRow ? dayRow.bookedCount : 0

  if (bookedCount >= capacity) {
    return {
      available: false,
      reason: `Daily appointment capacity of ${capacity} bookings has been reached for ${appointmentDate}.`,
      bookedCount,
      maxCapacity: capacity
    }
  }

  // 2. Check exact slot collision
  let slotSql = `
    SELECT id FROM appointments
    WHERE appointment_date = ? AND start_time = ? AND status != 'cancelled'
  `
  const slotParams = [appointmentDate, startTime]
  if (excludeId) {
    slotSql += ' AND id != ?'
    slotParams.push(excludeId)
  }
  const slotConflict = dbHelper.queryOne(slotSql, slotParams)

  if (slotConflict) {
    return {
      available: false,
      reason: `Time slot ${startTime} on ${appointmentDate} is already booked. Please choose another time slot.`,
      bookedCount,
      maxCapacity: capacity
    }
  }

  return {
    available: true,
    bookedCount,
    maxCapacity: capacity,
    availableSlots: capacity - bookedCount
  }
}

const create = ({
  customerId,
  vehicleId,
  serviceReason,
  appointmentDate,
  startTime,
  endTime = null,
  notes = '',
  userId = null
}) => {
  if (!customerId || !vehicleId || !serviceReason || !appointmentDate || !startTime) {
    throw new Error('Customer, Vehicle, Service Reason, Date, and Time Slot are required.')
  }

  const check = checkAvailability({ appointmentDate, startTime })
  if (!check.available) {
    throw new Error(check.reason)
  }

  const result = dbHelper.runSql(
    `INSERT INTO appointments (customer_id, vehicle_id, service_reason, appointment_date, start_time, end_time, status, notes, created_by)
     VALUES (?, ?, ?, ?, ?, ?, 'scheduled', ?, ?)`,
    [
      customerId,
      vehicleId,
      serviceReason.trim(),
      appointmentDate,
      startTime,
      endTime,
      notes.trim(),
      userId
    ]
  )

  return get(result.lastInsertRowid)
}

const updateStatus = (id, status) => {
  const valid = ['scheduled', 'completed', 'cancelled', 'no_show']
  if (!valid.includes(status)) {
    throw new Error('Invalid appointment status.')
  }
  dbHelper.runSql(
    'UPDATE appointments SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
    [status, id]
  )
  return get(id)
}

module.exports = {
  list,
  get,
  getMonthlyAvailability,
  checkAvailability,
  create,
  updateStatus,
  getDailyCapacity
}
