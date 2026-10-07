const path = require('path')
const fs = require('fs')
const os = require('os')
const Database = require('better-sqlite3')
const dbHelper = require('../../database/db.cjs')

const getBackupDir = () => {
  let docDir
  if (process.versions && process.versions.electron) {
    try {
      const { app } = require('electron')
      docDir = app.getPath('documents')
    } catch (_) {
      docDir = path.join(os.homedir(), 'Documents')
    }
  } else {
    docDir = path.join(os.homedir(), 'Documents')
  }
  const backupDir = path.join(docDir, 'Omega Engineers Backups')
  fs.mkdirSync(backupDir, { recursive: true })
  return backupDir
}

const createBackup = () => {
  const backupDir = getBackupDir()
  const now = new Date()
  const timestamp = now.toISOString().replace(/T/, '_').replace(/:/g, '').slice(0, 15)
  const fileName = `omega_backup_${timestamp}.db`
  const destPath = path.join(backupDir, fileName)

  const currentDbPath = dbHelper.getDbPath()
  if (!fs.existsSync(currentDbPath)) {
    throw new Error('Current database file does not exist.')
  }

  // Force checkpoint to flush WAL
  const db = dbHelper.getDb()
  try {
    db.pragma('wal_checkpoint(TRUNCATE)')
  } catch (_) {}

  fs.copyFileSync(currentDbPath, destPath)
  const stat = fs.statSync(destPath)

  return {
    success: true,
    backupPath: destPath,
    fileName,
    sizeBytes: stat.size,
    createdAt: now.toISOString()
  }
}

const listBackups = () => {
  const backupDir = getBackupDir()
  if (!fs.existsSync(backupDir)) return []

  const files = fs.readdirSync(backupDir)
  const backups = []

  for (const f of files) {
    if (f.endsWith('.db')) {
      const fullPath = path.join(backupDir, f)
      try {
        const stat = fs.statSync(fullPath)
        backups.push({
          fileName: f,
          filePath: fullPath,
          sizeBytes: stat.size,
          createdAt: stat.mtime.toISOString()
        })
      } catch (_) {}
    }
  }

  return backups.sort((a, b) => (b.createdAt > a.createdAt ? 1 : -1))
}

const restoreBackup = (backupFilePath) => {
  if (!backupFilePath || !fs.existsSync(backupFilePath)) {
    throw new Error('Selected backup file does not exist.')
  }

  // 1. Validate the backup file is a readable SQLite DB with our schema
  let testDb
  try {
    testDb = new Database(backupFilePath, { readonly: true })
    const meta = testDb.prepare("SELECT value FROM app_meta WHERE key = 'schema_version'").get()
    if (!meta) {
      testDb.close()
      throw new Error('Invalid backup file: missing Omega schema metadata.')
    }
    testDb.close()
  } catch (err) {
    if (testDb) try { testDb.close() } catch (_) {}
    throw new Error(`Failed to validate backup file: ${err.message}`)
  }

  // 2. Create safety backup of current live DB before replacing
  const backupDir = getBackupDir()
  const safetyName = `omega_prerestore_safety_${Date.now()}.db`
  const safetyPath = path.join(backupDir, safetyName)
  const currentDbPath = dbHelper.getDbPath()

  if (fs.existsSync(currentDbPath)) {
    try {
      const liveDb = dbHelper.getDb()
      liveDb.pragma('wal_checkpoint(TRUNCATE)')
    } catch (_) {}
    fs.copyFileSync(currentDbPath, safetyPath)
  }

  // 3. Close live database connection
  dbHelper.closeDb()

  // 4. Overwrite live DB with backup file
  fs.copyFileSync(backupFilePath, currentDbPath)

  // Remove stale WAL and SHM if they exist
  const walPath = `${currentDbPath}-wal`
  const shmPath = `${currentDbPath}-shm`
  if (fs.existsSync(walPath)) try { fs.unlinkSync(walPath) } catch (_) {}
  if (fs.existsSync(shmPath)) try { fs.unlinkSync(shmPath) } catch (_) {}

  // 5. Reinitialize and run integrity check
  const newDb = dbHelper.initDb()
  const check = newDb.prepare('PRAGMA integrity_check').get()
  const integrityOk = check && (check.integrity_check === 'ok' || check.integrity_check === 'OK')

  return {
    success: true,
    integrityOk,
    restoredFrom: backupFilePath,
    safetyBackupPath: safetyPath
  }
}

const openBackupFolder = () => {
  const backupDir = getBackupDir()
  try {
    const { shell } = require('electron')
    shell.openPath(backupDir)
  } catch (_) {
    const { exec } = require('child_process')
    if (process.platform === 'win32') {
      exec(`explorer.exe "${backupDir}"`)
    }
  }
  return { path: backupDir }
}

module.exports = {
  createBackup,
  listBackups,
  restoreBackup,
  openBackupFolder,
  getBackupDir
}
