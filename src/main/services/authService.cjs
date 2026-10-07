const crypto = require('crypto')
const dbHelper = require('../../database/db.cjs')

const hashPassword = (password, salt = null) => {
  const passwordSalt = salt || crypto.randomBytes(16).toString('hex')
  const derivedKey = crypto.pbkdf2Sync(password, passwordSalt, 100000, 64, 'sha512').toString('hex')
  return `${passwordSalt}:${derivedKey}`
}

const verifyPassword = (password, storedHash) => {
  if (!storedHash || !storedHash.includes(':')) return false
  const [salt, key] = storedHash.split(':')
  const checkKey = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex')
  return key === checkKey
}

const isFirstRun = () => {
  const countRow = dbHelper.queryOne('SELECT COUNT(*) AS count FROM users')
  return !countRow || countRow.count === 0
}

const setupAdmin = ({ username, password, displayName }) => {
  if (!username || !password || !displayName) {
    throw new Error('Username, password, and display name are required.')
  }
  const userCount = dbHelper.queryOne('SELECT COUNT(*) AS count FROM users')
  if (userCount && userCount.count > 0) {
    throw new Error('Owner account is already configured.')
  }

  const passwordHash = hashPassword(password)
  const result = dbHelper.runSql(
    `INSERT INTO users (username, password_hash, display_name, role, is_active)
     VALUES (?, ?, ?, 'admin_owner', 1)`,
    [username.trim(), passwordHash, displayName.trim()]
  )

  return {
    id: result.lastInsertRowid,
    username: username.trim(),
    displayName: displayName.trim(),
    role: 'admin_owner',
    isActive: 1
  }
}

const login = ({ username, password }) => {
  if (!username || !password) {
    throw new Error('Username and password are required.')
  }

  const user = dbHelper.queryOne(
    'SELECT * FROM users WHERE username = ?',
    [username.trim()]
  )

  if (!user) {
    throw new Error('Invalid username or password.')
  }

  if (user.is_active !== 1) {
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

const getUsers = () => {
  const rows = dbHelper.queryAll(
    `SELECT id, username, display_name AS displayName, role, is_active AS isActive,
            created_at AS createdAt, updated_at AS updatedAt
     FROM users ORDER BY id ASC`
  )
  return rows
}

const createUser = ({ username, password, displayName, role }) => {
  if (!username || !password || !displayName || !role) {
    throw new Error('All fields are required.')
  }
  const allowedRoles = ['admin_owner', 'receptionist_service_advisor', 'mechanic', 'inventory_billing']
  if (!allowedRoles.includes(role)) {
    throw new Error('Invalid role specified.')
  }

  const existing = dbHelper.queryOne('SELECT id FROM users WHERE username = ?', [username.trim()])
  if (existing) {
    throw new Error('Username is already taken.')
  }

  const passwordHash = hashPassword(password)
  const result = dbHelper.runSql(
    `INSERT INTO users (username, password_hash, display_name, role, is_active)
     VALUES (?, ?, ?, ?, 1)`,
    [username.trim(), passwordHash, displayName.trim(), role]
  )

  return {
    id: result.lastInsertRowid,
    username: username.trim(),
    displayName: displayName.trim(),
    role,
    isActive: 1
  }
}

const updateUser = (id, { displayName, role, isActive }) => {
  const existing = dbHelper.queryOne('SELECT id FROM users WHERE id = ?', [id])
  if (!existing) {
    throw new Error('User not found.')
  }

  dbHelper.runSql(
    `UPDATE users
     SET display_name = COALESCE(?, display_name),
         role = COALESCE(?, role),
         is_active = COALESCE(?, is_active),
         updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`,
    [displayName || null, role || null, isActive !== undefined ? isActive : null, id]
  )

  return dbHelper.queryOne(
    `SELECT id, username, display_name AS displayName, role, is_active AS isActive
     FROM users WHERE id = ?`,
    [id]
  )
}

const changePassword = (id, newPassword) => {
  if (!newPassword || newPassword.length < 4) {
    throw new Error('Password must be at least 4 characters long.')
  }
  const passwordHash = hashPassword(newPassword)
  dbHelper.runSql(
    'UPDATE users SET password_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
    [passwordHash, id]
  )
  return { success: true }
}

module.exports = {
  isFirstRun,
  setupAdmin,
  login,
  getUsers,
  createUser,
  updateUser,
  changePassword,
  hashPassword,
  verifyPassword
}
