const dbHelper = require('../../database/db.cjs')
const {
  normalizeSriLankanPhone,
  isValidCustomerName,
  isValidEmail,
  validateCustomerInputs
} = require('../utils/phoneUtils.cjs')

/**
 * Lists customers with aggregated counts and search filtering.
 * Supports quick search by:
 * - Customer full name (Sinhala or English)
 * - Raw phone or normalized phone formats (local 07X, +94, 0094, spaces, dashes)
 * - Email address
 * - Vehicle registration number
 */
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
    const rawSearch = search.trim()
    const term = `%${rawSearch}%`
    const normPhone = normalizeSriLankanPhone(rawSearch)

    if (normPhone) {
      // If search input matches a valid Sri Lankan phone number format,
      // search both normalized match (including legacy formatted records) and raw text
      sql += ` WHERE (
                 c.full_name LIKE ?
                 OR c.phone LIKE ?
                 OR normalize_phone(c.phone) = ?
                 OR (c.alternate_phone IS NOT NULL AND normalize_phone(c.alternate_phone) = ?)
                 OR c.email LIKE ?
                 OR v.registration_no LIKE ?
               ) `
      params.push(term, term, normPhone, normPhone, term, term)
    } else {
      sql += ` WHERE (
                 c.full_name LIKE ?
                 OR c.phone LIKE ?
                 OR c.email LIKE ?
                 OR v.registration_no LIKE ?
               ) `
      params.push(term, term, term, term)
    }
  }

  sql += ' GROUP BY c.id ORDER BY c.id DESC LIMIT ? OFFSET ?'
  params.push(limit, offset)

  return dbHelper.queryAll(sql, params)
}

/**
 * Retrieves a customer profile with all linked vehicles, recent jobs, and appointments.
 */
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

/**
 * Searches for existing customers matching a normalized phone number.
 * Uses parameterized SQL and dynamic normalization to detect legacy records saved
 * with spaces, hyphens, or international prefixes (+94, 0094).
 * Optionally excludes a customer ID (for updates).
 *
 * @param {string} phone - Target phone to match
 * @param {number|null} excludeCustomerId - Optional customer ID to exclude (e.g. self)
 * @returns {Array<object>} Matching customer records with vehicle and job counts
 */
const findDuplicates = (phone, excludeCustomerId = null) => {
  const normalized = normalizeSriLankanPhone(phone)
  if (!normalized) return []

  const sql = `
    SELECT c.id, c.full_name AS fullName, c.phone, c.alternate_phone AS alternatePhone,
           c.email, c.address, c.notes, c.created_at AS createdAt,
           COUNT(DISTINCT v.id) AS vehicleCount,
           COUNT(DISTINCT j.id) AS jobCount
    FROM customers c
    LEFT JOIN vehicles v ON v.customer_id = c.id
    LEFT JOIN job_cards j ON j.customer_id = c.id
    WHERE (
      normalize_phone(c.phone) = ?
      OR (c.alternate_phone IS NOT NULL AND c.alternate_phone != '' AND normalize_phone(c.alternate_phone) = ?)
    )
    AND (? IS NULL OR c.id != ?)
    GROUP BY c.id
    ORDER BY c.id DESC
  `
  return dbHelper.queryAll(sql, [normalized, normalized, excludeCustomerId, excludeCustomerId])
}

/**
 * Creates a new customer record with strict input validation and duplicate detection.
 *
 * Validation:
 * - Reject missing or whitespace-only names/primary phones.
 * - Accept English or Sinhala Unicode names.
 * - Normalize phone according to Sri Lankan standards.
 * - If duplicates are found and no explicit override is provided:
 *   Returns structured duplicate warning and makes NO change to the database.
 * - If allowDuplicatePhone is true (business confirmation for shared family/fleet phone):
 *   Allows creating the separate record with the shared phone number.
 */
const create = ({
  fullName,
  phone,
  alternatePhone = '',
  email = '',
  address = '',
  notes = '',
  allowDuplicatePhone = false,
  confirmDuplicate = false,
  overrideDuplicate = false,
  throwOnDuplicate = false
} = {}) => {
  // 1. Validate inputs
  const validated = validateCustomerInputs({
    fullName,
    phone,
    alternatePhone,
    email,
    address,
    notes
  })

  // 2. Duplicate check (unless explicitly confirmed / overridden)
  const hasOverride = Boolean(allowDuplicatePhone || confirmDuplicate || overrideDuplicate)
  if (!hasOverride) {
    const duplicates = findDuplicates(validated.normalizedPhone)
    if (duplicates && duplicates.length > 0) {
      if (throwOnDuplicate) {
        const err = new Error(`A customer with phone number ${validated.normalizedPhone} already exists (${duplicates[0].fullName}).`)
        err.code = 'DUPLICATE_PHONE'
        err.duplicateWarning = true
        err.duplicates = duplicates
        throw err
      }
      return {
        duplicateWarning: true,
        isDuplicate: true,
        duplicates,
        message: `A customer with phone number ${validated.normalizedPhone} already exists (${duplicates[0].fullName}). Please confirm if this is a shared number or select the existing customer.`
      }
    }
  }

  // 3. Insert customer record using normalized phone
  const result = dbHelper.runSql(
    `INSERT INTO customers (full_name, phone, alternate_phone, email, address, notes)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      validated.fullName,
      validated.phone,
      validated.alternatePhone,
      validated.email,
      validated.address,
      validated.notes
    ]
  )

  return get(result.lastInsertRowid)
}

/**
 * Updates an existing customer record with input validation and duplicate detection.
 *
 * Validation:
 * - Validates provided fields (fullName, phone, alternatePhone, email).
 * - Leaves original record unchanged if validation fails.
 * - Self-update (retaining existing phone or same normalized value) is permitted without warning.
 * - Changing phone to another customer's number triggers duplicate warning unless confirmed.
 */
const update = (
  id,
  {
    fullName,
    phone,
    alternatePhone,
    email,
    address,
    notes,
    allowDuplicatePhone = false,
    confirmDuplicate = false,
    overrideDuplicate = false,
    throwOnDuplicate = false
  } = {}
) => {
  const existing = dbHelper.queryOne('SELECT * FROM customers WHERE id = ?', [id])
  if (!existing) {
    throw new Error('Customer not found.')
  }

  // 1. Validate fullName if supplied
  let validatedFullName = existing.full_name
  if (fullName !== undefined) {
    if (!fullName || typeof fullName !== 'string' || !fullName.trim()) {
      throw new Error('Customer full name is required.')
    }
    if (!isValidCustomerName(fullName)) {
      throw new Error('Invalid customer name. Names may be written in English or Sinhala (letters, initials, spaces, hyphens only). Digits and special symbols are not allowed.')
    }
    validatedFullName = fullName.trim()
  }

  // 2. Validate phone if supplied and check for changes
  let validatedPhone = existing.phone
  let phoneChanged = false
  if (phone !== undefined) {
    if (!phone || typeof phone !== 'string' || !phone.trim()) {
      throw new Error('Customer primary phone number is required.')
    }
    const normalizedNew = normalizeSriLankanPhone(phone)
    if (!normalizedNew) {
      throw new Error('Invalid primary phone number. Please enter a valid 10-digit Sri Lankan phone number (e.g., 077 123 4567, 011 234 5678, or +94 77 123 4567).')
    }
    validatedPhone = normalizedNew

    const existingNorm = normalizeSriLankanPhone(existing.phone)
    if (existingNorm !== normalizedNew) {
      phoneChanged = true
    }
  }

  // 3. Duplicate check if phone changed (excluding the customer's own record)
  const hasOverride = Boolean(allowDuplicatePhone || confirmDuplicate || overrideDuplicate)
  if (phoneChanged && !hasOverride) {
    const duplicates = findDuplicates(validatedPhone, id)
    if (duplicates && duplicates.length > 0) {
      if (throwOnDuplicate) {
        const err = new Error(`A customer with phone number ${validatedPhone} already exists (${duplicates[0].fullName}).`)
        err.code = 'DUPLICATE_PHONE'
        err.duplicateWarning = true
        err.duplicates = duplicates
        throw err
      }
      return {
        duplicateWarning: true,
        isDuplicate: true,
        duplicates,
        message: `A customer with phone number ${validatedPhone} already exists (${duplicates[0].fullName}). Please confirm if this is a shared number or select the existing customer.`
      }
    }
  }

  // 4. Validate alternatePhone if supplied
  let validatedAltPhone = existing.alternate_phone
  if (alternatePhone !== undefined) {
    if (alternatePhone && typeof alternatePhone === 'string' && alternatePhone.trim()) {
      const normAlt = normalizeSriLankanPhone(alternatePhone)
      if (!normAlt) {
        throw new Error('Invalid alternate phone number. Must be a valid Sri Lankan phone number format.')
      }
      validatedAltPhone = normAlt
    } else {
      validatedAltPhone = null
    }
  }

  // 5. Validate email if supplied
  let validatedEmail = existing.email
  if (email !== undefined) {
    if (email && typeof email === 'string' && email.trim()) {
      if (!isValidEmail(email)) {
        throw new Error('Invalid email address format (e.g. customer@example.com).')
      }
      validatedEmail = email.trim()
    } else {
      validatedEmail = null
    }
  }

  let validatedAddress = address !== undefined ? (typeof address === 'string' ? address.trim() || null : null) : existing.address
  let validatedNotes = notes !== undefined ? (typeof notes === 'string' ? notes.trim() || null : null) : existing.notes

  // 6. Execute atomic update
  dbHelper.runSql(
    `UPDATE customers
     SET full_name = ?,
         phone = ?,
         alternate_phone = ?,
         email = ?,
         address = ?,
         notes = ?,
         updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`,
    [
      validatedFullName,
      validatedPhone,
      validatedAltPhone,
      validatedEmail,
      validatedAddress,
      validatedNotes,
      id
    ]
  )

  return get(id)
}

/**
 * Removes a customer if there are no linked vehicles or active job cards.
 */
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
  remove,
  findDuplicates,
  normalizePhone: normalizeSriLankanPhone,
  isValidCustomerName,
  isValidEmail
}
