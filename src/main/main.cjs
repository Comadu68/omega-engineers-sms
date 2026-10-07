const { app, BrowserWindow, ipcMain } = require('electron')
const path = require('path')
const dbHelper = require('../database/db.cjs')
const { registerAllIpc } = require('./ipc/index.cjs')
const settingsService = require('./services/settingsService.cjs')
const backupService = require('./services/backupService.cjs')

let mainWindow

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1180,
    minHeight: 700,
    backgroundColor: '#F6F8FC',
    show: false,
    webPreferences: {
      preload: path.join(__dirname, '..', 'preload', 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  })

  mainWindow.removeMenu()

  const devUrl = process.env.VITE_DEV_SERVER_URL
  if (devUrl) {
    mainWindow.loadURL(devUrl)
  } else {
    mainWindow.loadFile(path.join(__dirname, '..', '..', 'dist', 'index.html'))
  }

  mainWindow.once('ready-to-show', () => mainWindow.show())
}

function registerBootstrapIpc() {
  ipcMain.handle('app:getVersion', () => app.getVersion())
  ipcMain.handle('app:getUserDataPath', () => app.getPath('userData'))
  ipcMain.handle('db:health', () => {
    try {
      const db = dbHelper.getDb()
      const result = db.prepare('SELECT 1 AS ok').get()
      return { ok: result && result.ok === 1, dbPath: dbHelper.getDbPath() }
    } catch (err) {
      return { ok: false, error: err.message, dbPath: dbHelper.getDbPath() }
    }
  })
}

app.whenReady().then(() => {
  dbHelper.initDb()
  registerBootstrapIpc()
  registerAllIpc()
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  try {
    const autoBackup = settingsService.get('auto_backup_on_exit')
    if (autoBackup === 'true' || autoBackup === true) {
      backupService.createBackup()
    }
  } catch (_) {}

  dbHelper.closeDb()

  if (process.platform !== 'darwin') {
    app.quit()
  }
})
