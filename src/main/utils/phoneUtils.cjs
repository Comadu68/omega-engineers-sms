/**
 * Sri Lankan Customer Data Validation & Phone Normalization Utilities
 * Issue: SCRUM-16 / US-JC-01: Customer intake and quick search
 *
 * Assumptions & Engineering Policy (Sprint 0):
 * - Sri Lankan telephone numbering plan (E.164 / TRCSL):
 *   - Local mobile and fixed-line numbers consist of a 2-3 digit operator/area code
 *     followed by customer number, totaling 9 digits after national trunk prefix '0' (10 digits total).
 *   - Valid mobile codes: 070, 071, 072, 074, 075, 076, 077, 078.
 *   - Valid fixed-line codes: 011, 021-027, 031-038, 041, 045, 047, 051-057, 063-067, 081, 091.
 *   - In general: Starts with '0' followed by non-zero digit [1-9] and 8 digits (10 digits total).
 *   - International representation prefix: '+94', '0094', or '94' followed by the 9 national digits.
 *   - Common formatting artifacts like spaces, hyphens, periods, and parentheses are permitted during input.
 * - Deduplication Comparison Format:
 *   - All valid representations normalize to the canonical 10-digit format: `0XXXXXXXXX`.
 *   - Legacy records saved with international prefix or spaces are normalized dynamically for duplicate lookup.
 * - Customer Name Policy:
 *   - Supports English names (Latin alphabet) and Sinhala names (Unicode range \u0D80-\u0DFF).
 *   - Must contain at least one letter and cannot consist solely of numbers, spaces, or symbols.
 *   - Names containing digits or inappropriate punctuation are rejected.
 *
 * Note: These rules represent engineering assumptions for Sprint 0 deduplication and intake validation,
 * pending formal client review/sign-off.
 */

/**
 * Normalizes Sri Lankan phone numbers to canonical 10-digit format `0XXXXXXXXX`.
 * Returns null if the input cannot be parsed as a valid Sri Lankan phone number.
 *
 * @param {string} raw - The raw input phone string
 * @returns {string|null} - Canonical 10-digit phone string (e.g. '0771234567') or null
 */
function normalizeSriLankanPhone(raw) {
  if (typeof raw !== 'string') return null
  const trimmed = raw.trim()
  if (!trimmed) return null

  // Allow only digits, plus (+), spaces, hyphens (-), periods (.), parentheses ()
  if (!/^[\d\s+\-.()]+$/.test(trimmed)) {
    return null
  }

  // Strip all non-digit and non-plus characters
  let cleaned = trimmed.replace(/[\s\-.()]/g, '')

  // Handle international prefixes
  if (cleaned.startsWith('+940')) {
    // e.g. +94(0)771234567
    cleaned = cleaned.slice(3)
  } else if (cleaned.startsWith('+94')) {
    cleaned = '0' + cleaned.slice(3)
  } else if (cleaned.startsWith('00940')) {
    cleaned = cleaned.slice(4)
  } else if (cleaned.startsWith('0094')) {
    cleaned = '0' + cleaned.slice(4)
  } else if (cleaned.startsWith('940') && cleaned.length === 12) {
    cleaned = cleaned.slice(2)
  } else if (cleaned.startsWith('94') && cleaned.length === 11) {
    cleaned = '0' + cleaned.slice(2)
  }

  // Canonical Sri Lankan 10-digit local format:
  // Starts with '0', followed by a non-zero digit [1-9], followed by 8 digits (10 digits total)
  if (/^0[1-9]\d{8}$/.test(cleaned)) {
    return cleaned
  }

  return null
}

/**
 * Validates customer full name.
 * Accepts English (Latin) and Sinhala (Unicode) names, along with standard name punctuation
 * (spaces, dots for initials, hyphens for compound names, apostrophes).
 * Rejects empty/whitespace strings, numbers, or symbols.
 *
 * @param {string} name - Customer name
 * @returns {boolean}
 */
function isValidCustomerName(name) {
  if (typeof name !== 'string') return false
  const trimmed = name.trim()
  if (trimmed.length < 2 || trimmed.length > 100) return false

  // Must contain at least one letter (\p{L} matches Latin, Sinhala, Tamil, etc.)
  if (!/\p{L}/u.test(trimmed)) return false

  // Must contain ONLY letters, combining marks (vital for Sinhala vowels/hal lakunu \p{M}),
  // spaces, dots, hyphens, and apostrophes.
  return /^[\p{L}\p{M}\s.'-]+$/u.test(trimmed)
}

/**
 * Validates email address format (if supplied).
 *
 * @param {string} email
 * @returns {boolean}
 */
function isValidEmail(email) {
  if (typeof email !== 'string') return false
  const trimmed = email.trim()
  if (!trimmed) return true // Email is optional; empty is allowed
  if (trimmed.length > 120) return false
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)
}

/**
 * Validates all customer intake inputs and returns structured cleaned values or throws Error.
 *
 * @param {object} inputs
 * @returns {object} Cleaned and validated payload
 */
function validateCustomerInputs({ fullName, phone, alternatePhone = '', email = '', address = '', notes = '' }) {
  // 1. Full name validation
  if (!fullName || typeof fullName !== 'string' || !fullName.trim()) {
    throw new Error('Customer full name is required.')
  }
  if (!isValidCustomerName(fullName)) {
    throw new Error('Invalid customer name. Names may be written in English or Sinhala (letters, initials, spaces, hyphens only). Digits and special symbols are not allowed.')
  }

  // 2. Primary phone validation
  if (!phone || typeof phone !== 'string' || !phone.trim()) {
    throw new Error('Customer primary phone number is required.')
  }
  const normalizedPhone = normalizeSriLankanPhone(phone)
  if (!normalizedPhone) {
    throw new Error('Invalid primary phone number. Please enter a valid 10-digit Sri Lankan phone number (e.g., 077 123 4567, 011 234 5678, or +94 77 123 4567).')
  }

  // 3. Alternate phone validation (optional)
  let normalizedAltPhone = null
  if (alternatePhone && typeof alternatePhone === 'string' && alternatePhone.trim()) {
    normalizedAltPhone = normalizeSriLankanPhone(alternatePhone)
    if (!normalizedAltPhone) {
      throw new Error('Invalid alternate phone number. Must be a valid Sri Lankan phone number format.')
    }
  }

  // 4. Email validation (optional)
  let cleanedEmail = ''
  if (email && typeof email === 'string' && email.trim()) {
    if (!isValidEmail(email)) {
      throw new Error('Invalid email address format (e.g. customer@example.com).')
    }
    cleanedEmail = email.trim()
  }

  return {
    fullName: fullName.trim(),
    phone: normalizedPhone,
    normalizedPhone,
    alternatePhone: normalizedAltPhone,
    email: cleanedEmail || null,
    address: typeof address === 'string' ? address.trim() || null : null,
    notes: typeof notes === 'string' ? notes.trim() || null : null
  }
}

module.exports = {
  normalizeSriLankanPhone,
  isValidCustomerName,
  isValidEmail,
  validateCustomerInputs
}
