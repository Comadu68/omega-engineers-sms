const crypto = require('crypto')
const dbHelper = require('../../database/db.cjs')

const ALLOWED_ROLES = Object.freeze([
  'admin_owner',
  'receptionist_service_advisor',
  'mechanic',
  'inventory_billing'
])

const hashPassword = (password, salt = null) => {
  const passwordSalt = salt || crypto.randomBytes(16).toString('hex')
  const derivedKey = crypto.pbkdf2Sync(password, passwordSalt, 100000, 64, 'sha512').toString('hex')
  return `${passwordSalt}:${derivedKey}`
}

const verifyPassword = (password, storedHash) => {
  if (typeof password !== 'string' || !password || !storedHash || !storedHash.includes(':')) return false
  const [salt, key] = storedHash.split(':')
  if (!salt || !key) return false
  const checkKey = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex')
  const keyBuf = Buffer.from(key, 'hex')
  const checkBuf = Buffer.from(checkKey, 'hex')
  if (keyBuf.length !== checkBuf.length) return false
  return crypto.timingSafeEqual(keyBuf, checkBuf)
}

const extractTrustedCallerId = (callerContext) => {
  if (typeof callerContext === 'number' || typeof callerContext === 'string') {
    return Number(callerContext)
  }
  if (callerContext && typeof callerContext === 'object') {
    if (callerContext.callerUserId !== undefined && callerContext.callerUserId !== null) {
      return Number(callerContext.callerUserId)
    }
    if (callerContext.userId !== undefined && callerContext.userId !== null) {
      return Number(callerContext.userId)
    }
    if (callerContext.id !== undefined && callerContext.id !== null) {
      return Number(callerContext.id)
    }
  }
  return null
}

const getAuthenticatedCaller = (callerContext) => {
  const callerId = extractTrustedCallerId(callerContext)
  if (!Number.isInteger(callerId) || callerId <= 0) {
    throw new Error('Authentication required. Please sign in.')
  }

  const user = dbHelper.queryOne(
    `SELECT id, username, display_name AS displayName, role, is_active AS isActive
     FROM users WHERE id = ?`,
    [callerId]
  )

  if (!user) {
    throw new Error('Authentication required: user account no longer exists.')
  }

  if (Number(user.isActive) !== 1) {
    throw new Error('Account is inactive. Please contact your administrator.')
  }

  return {
    id: user.id,
    username: user.username,
    displayName: user.displayName,
    role: user.role,
    isActive: Number(user.isActive)
  }
}

const requireAdminCaller = (callerContext) => {
  const caller = getAuthenticatedCaller(callerContext)
  if (caller.role !== 'admin_owner') {
    throw new Error('Access denied: Administrator privileges are required.')
  }
  return caller
}

const isFirstRun = () => {
  const countRow = dbHelper.queryOne('SELECT COUNT(*) AS count FROM users')
  return !countRow || countRow.count === 0
}

const setupAdmin = (payload = {}) => {
  const userCount = dbHelper.queryOne('SELECT COUNT(*) AS count FROM users')
  if (userCount && userCount.count > 0) {
    throw new Error('Owner account is already configured.')
  }

  const { username, password, displayName } = payload || {}
  if (
    typeof username !== 'string' || !username.trim() ||
    typeof password !== 'string' || !password ||
    typeof displayName !== 'string' || !displayName.trim()
  ) {
    throw new Error('Username, password, and display name are required.')
  }

  if (password.length < 4) {
    throw new Error('Password must be at least 4 characters long.')
  }

  return dbHelper.runTransaction(() => {
    const currentCount = dbHelper.queryOne('SELECT COUNT(*) AS count FROM users')
    if (currentCount && currentCount.count > 0) {
      throw new Error('Owner account is already configured.')
    }

    const cleanUsername = username.trim()
    const cleanDisplayName = displayName.trim()
    const passwordHash = hashPassword(password)
    const result = dbHelper.runSql(
      `INSERT INTO users (username, password_hash, display_name, role, is_active)
       VALUES (?, ?, ?, 'admin_owner', 1)`,
      [cleanUsername, passwordHash, cleanDisplayName]
    )

    const newUserId = Number(result.lastInsertRowid)
    dbHelper.runSql(
      `INSERT INTO audit_log (user_id, action, entity_type, entity_id, details_json)
       VALUES (?, 'setup_owner', 'users', ?, ?)`,
      [newUserId, String(newUserId), JSON.stringify({ username: cleanUsername, role: 'admin_owner' })]
    )

    return {
      id: newUserId,
      username: cleanUsername,
      displayName: cleanDisplayName,
      role: 'admin_owner',
      isActive: 1
    }
  })
}

const login = (credentials = {}) => {
  const { username, password } = credentials || {}
  if (typeof username !== 'string' || !username.trim() || typeof password !== 'string' || !password) {
    throw new Error('Username and password are required.')
  }

  const user = dbHelper.queryOne(
    'SELECT * FROM users WHERE username = ?',
    [username.trim()]
  )

  if (!user) {
    throw new Error('Invalid username or password.')
  }

  if (Number(user.is_active) !== 1) {
    throw new Error('Account is inactive. Please contact your administrator.')
  }

  const isValid = verifyPassword(password, user.password_hash)
  if (!isValid) {
    throw new Error('Invalid username or password.')
  }

  // Update audit log
  dbHelper.runSql(
    `INSERT INTO audit_log (user_id, action, entity_type, entity_id, details_json)
     VALUES (?, 'login', 'users', ?, ?)`,
    [user.id, String(user.id), JSON.stringify({ username: user.username, role: user.role })]
  )

  return {
    id: user.id,
    username: user.username,
    displayName: user.display_name,
    role: user.role,
    isActive: user.is_active
  }
}

const recordLogoutAudit = (userId) => {
  const numericId = Number(userId)
  if (!Number.isInteger(numericId) || numericId <= 0) return
  try {
    const existing = dbHelper.queryOne('SELECT id, username, role FROM users WHERE id = ?', [numericId])
    if (existing) {
      dbHelper.runSql(
        `INSERT INTO audit_log (user_id, action, entity_type, entity_id, details_json)
         VALUES (?, 'logout', 'users', ?, ?)`,
        [existing.id, String(existing.id), JSON.stringify({ username: existing.username, role: existing.role })]
      )
    }
  } catch (_) {}
}

const getUsers = (callerContext) => {
  requireAdminCaller(callerContext)

  const rows = dbHelper.queryAll(
    `SELECT id, username, display_name AS displayName, role, is_active AS isActive,
            created_at AS createdAt, updated_at AS updatedAt
     FROM users ORDER BY id ASC`
  )
  return rows
}

const createUser = (payload = {}, callerContext) => {
  const caller = requireAdminCaller(callerContext)

  const { username, password, displayName, role } = payload || {}
  if (
    typeof username !== 'string' || !username.trim() ||
    typeof password !== 'string' || !password ||
    typeof displayName !== 'string' || !displayName.trim() ||
    typeof role !== 'string' || !role
  ) {
    throw new Error('All fields are required.')
  }

  if (!ALLOWED_ROLES.includes(role)) {
    throw new Error('Invalid role specified.')
  }

  if (password.length < 4) {
    throw new Error('Password must be at least 4 characters long.')
  }

  const cleanUsername = username.trim()
  const cleanDisplayName = displayName.trim()

  const existing = dbHelper.queryOne('SELECT id FROM users WHERE username = ?', [cleanUsername])
  if (existing) {
    throw new Error('Username is already taken.')
  }

  const passwordHash = hashPassword(password)
  const result = dbHelper.runSql(
    `INSERT INTO users (username, password_hash, display_name, role, is_active)
     VALUES (?, ?, ?, ?, 1)`,
    [cleanUsername, passwordHash, cleanDisplayName, role]
  )

  const createdId = Number(result.lastInsertRowid)
  dbHelper.runSql(
    `INSERT INTO audit_log (user_id, action, entity_type, entity_id, details_json)
     VALUES (?, 'create_user', 'users', ?, ?)`,
    [caller.id, String(createdId), JSON.stringify({ username: cleanUsername, role })]
  )

  return {
    id: createdId,
    username: cleanUsername,
    displayName: cleanDisplayName,
    role,
    isActive: 1
  }
}

const updateUser = (id, data = {}, callerContext) => {
  const caller = requireAdminCaller(callerContext)

  const targetId = Number(id)
  if (!Number.isInteger(targetId) || targetId <= 0) {
    throw new Error('Valid user ID is required.')
  }

  const existing = dbHelper.queryOne(
    'SELECT id, username, display_name, role, is_active FROM users WHERE id = ?',
    [targetId]
  )
  if (!existing) {
    throw new Error('User not found.')
  }

  const { displayName, role, isActive } = data || {}

  let nextDisplayName = existing.display_name
  if (displayName !== undefined && displayName !== null) {
    if (typeof displayName !== 'string' || !displayName.trim()) {
      throw new Error('Display name cannot be empty.')
    }
    nextDisplayName = displayName.trim()
  }

  let nextRole = existing.role
  if (role !== undefined && role !== null) {
    if (typeof role !== 'string' || !ALLOWED_ROLES.includes(role)) {
      throw new Error('Invalid role specified.')
    }
    nextRole = role
  }

  let nextIsActive = Number(existing.is_active)
  if (isActive !== undefined && isActive !== null) {
    if (isActive === true || isActive === 1 || isActive === '1') {
      nextIsActive = 1
    } else if (isActive === false || isActive === 0 || isActive === '0') {
      nextIsActive = 0
    } else {
      throw new Error('Invalid account status specified.')
    }
  }

  return dbHelper.runTransaction(() => {
    const currentTarget = dbHelper.queryOne(
      'SELECT id, username, display_name, role, is_active FROM users WHERE id = ?',
      [targetId]
    )
    if (!currentTarget) {
      throw new Error('User not found.')
    }

    const isCurrentlyActiveOwner =
      currentTarget.role === 'admin_owner' && Number(currentTarget.is_active) === 1
    const willRemainActiveOwner =
      nextRole === 'admin_owner' && nextIsActive === 1

    if (isCurrentlyActiveOwner && !willRemainActiveOwner) {
      const otherActiveOwners = dbHelper.queryOne(
        "SELECT COUNT(*) AS count FROM users WHERE role = 'admin_owner' AND is_active = 1 AND id != ?",
        [targetId]
      )
      if (!otherActiveOwners || otherActiveOwners.count === 0) {
        throw new Error('Cannot demote or deactivate the last active administrator/owner account.')
      }
    }

    dbHelper.runSql(
      `UPDATE users
       SET display_name = ?,
           role = ?,
           is_active = ?,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [nextDisplayName, nextRole, nextIsActive, targetId]
    )

    dbHelper.runSql(
      `INSERT INTO audit_log (user_id, action, entity_type, entity_id, details_json)
       VALUES (?, 'update_user', 'users', ?, ?)`,
      [
        caller.id,
        String(targetId),
        JSON.stringify({
          displayName: nextDisplayName,
          role: nextRole,
          isActive: nextIsActive
        })
      ]
    )

    return dbHelper.queryOne(
      `SELECT id, username, display_name AS displayName, role, is_active AS isActive
       FROM users WHERE id = ?`,
      [targetId]
    )
  })
}

const changePassword = (id, newPassword, options = {}) => {
  const caller = getAuthenticatedCaller(options)
  const currentPassword =
    options && typeof options === 'object' ? options.currentPassword : undefined

  const targetId = id !== undefined && id !== null ? Number(id) : caller.id
  if (!Number.isInteger(targetId) || targetId <= 0) {
    throw new Error('Valid user ID is required.')
  }

  const isSelfTarget = targetId === caller.id
  const isAdminCaller = caller.role === 'admin_owner'

  if (!isAdminCaller) {
    if (!isSelfTarget) {
      throw new Error("Access denied: Only an administrator can reset another user's password.")
    }
    if (typeof currentPassword !== 'string' || !currentPassword) {
      throw new Error('Current password is required to change your own password.')
    }
  }

  if (typeof newPassword !== 'string' || newPassword.length < 4) {
    throw new Error('Password must be at least 4 characters long.')
  }

  const targetUser = dbHelper.queryOne(
    'SELECT id, username, password_hash, is_active FROM users WHERE id = ?',
    [targetId]
  )
  if (!targetUser) {
    throw new Error('User not found.')
  }

  if (
    !isAdminCaller ||
    (isSelfTarget && currentPassword !== undefined && currentPassword !== null && currentPassword !== '')
  ) {
    const callerRow = dbHelper.queryOne('SELECT password_hash FROM users WHERE id = ?', [caller.id])
    if (!callerRow || !verifyPassword(String(currentPassword || ''), callerRow.password_hash)) {
      throw new Error('Current password is incorrect.')
    }
  }

  const passwordHash = hashPassword(newPassword)
  dbHelper.runSql(
    'UPDATE users SET password_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
    [passwordHash, targetId]
  )

  dbHelper.runSql(
    `INSERT INTO audit_log (user_id, action, entity_type, entity_id, details_json)
     VALUES (?, 'change_password', 'users', ?, ?)`,
    [
      caller.id,
      String(targetId),
      JSON.stringify({ targetUserId: targetId, selfService: isSelfTarget && !isAdminCaller })
    ]
  )

  return { success: true }
}

module.exports = {
  ALLOWED_ROLES,
  isFirstRun,
  setupAdmin,
  login,
  recordLogoutAudit,
  getAuthenticatedCaller,
  requireAdminCaller,
  getUsers,
  createUser,
  updateUser,
  changePassword,
  hashPassword,
  verifyPassword
}

