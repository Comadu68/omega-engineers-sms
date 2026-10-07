const path = require('path')
const fs = require('fs')
const Database = require('better-sqlite3')

let dbInstance = null
let currentDbPath = null

const getDbPath = () => {
  if (currentDbPath) return currentDbPath
  let userDataDir
  if (process.versions && process.versions.electron) {
    try {
      const { app } = require('electron')
      userDataDir = app.getPath('userData')
    } catch (_) {
      userDataDir = path.join(process.cwd(), '.local_data')
    }
  } else {
    userDataDir = path.join(process.cwd(), '.local_data')
  }
  const dataDir = path.join(userDataDir, 'data')
  fs.mkdirSync(dataDir, { recursive: true })
  currentDbPath = path.join(dataDir, 'omega_service_station.db')
  return currentDbPath
}

const setCustomDbPath = (customPath) => {
  if (dbInstance) {
    try {
      dbInstance.close()
    } catch (_) {}
    dbInstance = null
  }
  currentDbPath = customPath
}

const getDb = () => {
  if (dbInstance && dbInstance.open) return dbInstance
  return initDb()
}

const initDb = (overridePath = null) => {
  if (overridePath) {
    currentDbPath = overridePath
  }
  const dbPath = overridePath || getDbPath()
  const dbDir = path.dirname(dbPath)
  fs.mkdirSync(dbDir, { recursive: true })

  dbInstance = new Database(dbPath)
  dbInstance.pragma('foreign_keys = ON')
  dbInstance.pragma('journal_mode = WAL')

  const schemaPath = path.join(__dirname, 'schema.sql')
  const seedPath = path.join(__dirname, 'seed.sql')

  if (fs.existsSync(schemaPath)) {
    const schemaSql = fs.readFileSync(schemaPath, 'utf8')
    dbInstance.exec(schemaSql)
  }

  if (fs.existsSync(seedPath)) {
    const seedSql = fs.readFileSync(seedPath, 'utf8')
    dbInstance.exec(seedSql)
  }

  return dbInstance
}

const closeDb = () => {
  if (dbInstance && dbInstance.open) {
    try {
      dbInstance.close()
    } catch (_) {}
    dbInstance = null
  }
}

const queryAll = (sql, params = []) => {
  const db = getDb()
  const stmt = db.prepare(sql)
  return stmt.all(params)
}

const queryOne = (sql, params = []) => {
  const db = getDb()
  const stmt = db.prepare(sql)
  return stmt.get(params)
}

const runSql = (sql, params = []) => {
  const db = getDb()
  const stmt = db.prepare(sql)
  return stmt.run(params)
}

const runTransaction = (fn) => {
  const db = getDb()
  const trx = db.transaction(fn)
  return trx()
}

module.exports = {
  getDb,
  initDb,
  closeDb,
  getDbPath,
  setCustomDbPath,
  queryAll,
  queryOne,
  runSql,
  runTransaction
}
