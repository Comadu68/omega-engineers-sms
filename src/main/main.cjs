const { app, BrowserWindow, ipcMain } = require('electron')
const path = require('path')
const dbHelper = require('../database/db.cjs')
const { registerAllIpc } = require('./ipc/index.cjs')
const authIpc = require('./ipc/auth.ipc.cjs')
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

  const webContents = mainWindow.webContents
  const webContentsId = webContents ? webContents.id : null
  if (webContents && typeof webContents.once === 'function') {
    webContents.once('destroyed', () => {
      authIpc.clearSessionForWebContents(webContentsId ?? webContents)
    })
  }
  mainWindow.on('closed', () => {
    authIpc.clearSessionForWebContents(webContentsId ?? webContents)
    mainWindow = null
  })

  mainWindow.removeMenu()

  const devUrl = process.env.VITE_DEV_SERVER_URL
  if (devUrl) {
    const loadDevUrl = () => {
      if (!mainWindow || mainWindow.isDestroyed()) return
      mainWindow.loadURL(devUrl).catch(() => {
        setTimeout(loadDevUrl, 800)
      })
    }
    loadDevUrl()
    mainWindow.webContents.on('did-fail-load', () => {
      setTimeout(() => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.loadURL(devUrl).catch(() => {})
        }
      }, 1000)
    })
  } else {
    mainWindow.loadFile(path.join(__dirname, '..', '..', 'dist', 'index.html'))
  }

  mainWindow.once('ready-to-show', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.show()
      mainWindow.focus()
    }
  })

  // Fallback to guarantee window is visible on desktop even if ready-to-show event is delayed
  setTimeout(() => {
    if (mainWindow && !mainWindow.isDestroyed() && !mainWindow.isVisible()) {
      mainWindow.show()
      mainWindow.focus()
    }
  }, 1500)
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
  authIpc.clearAllSessions()
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

