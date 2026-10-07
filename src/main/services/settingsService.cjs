const dbHelper = require('../../database/db.cjs')

const DEFAULT_SETTINGS = {
  station_name: 'Omega Engineers Service Station',
  company_name: 'Solotrade Company',
  station_address: '123 Galle Road, Colombo',
  station_phone: '011 234 5678',
  currency_symbol: 'Rs.',
  appointment_daily_capacity: '8',
  inventory_cost_method: 'FIFO',
  auto_backup_on_exit: 'false',
  tax_rate_percent: '0'
}

const getAll = () => {
  const rows = dbHelper.queryAll('SELECT key, value FROM app_settings')
  const settings = { ...DEFAULT_SETTINGS }
  rows.forEach((r) => {
    settings[r.key] = r.value
  })
  return settings
}

const get = (key) => {
  const row = dbHelper.queryOne('SELECT value FROM app_settings WHERE key = ?', [key])
  return row ? row.value : DEFAULT_SETTINGS[key] || null
}

const update = (key, value) => {
  dbHelper.runSql(
    `INSERT INTO app_settings (key, value) VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    [key, String(value)]
  )
  return { key, value: String(value) }
}

const updateMultiple = (settingsMap) => {
  return dbHelper.runTransaction(() => {
    for (const [key, value] of Object.entries(settingsMap)) {
      if (value !== undefined && value !== null) {
        update(key, value)
      }
    }
    return getAll()
  })
}

const getAuditLogs = ({ limit = 50 } = {}) => {
  return dbHelper.queryAll(
    `SELECT a.id, a.user_id AS userId, a.action, a.entity_type AS entityType,
            a.entity_id AS entityId, a.details_json AS detailsJson, a.created_at AS createdAt,
            u.username, u.display_name AS displayName, u.role
     FROM audit_log a
     LEFT JOIN users u ON u.id = a.user_id
     ORDER BY a.id DESC LIMIT ?`,
    [limit]
  )
}

module.exports = {
  getAll,
  get,
  update,
  updateMultiple,
  getAuditLogs
}
