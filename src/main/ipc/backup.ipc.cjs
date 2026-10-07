const { ipcMain, dialog } = require('electron')
const backupService = require('../services/backupService.cjs')

const register = () => {
  ipcMain.handle('backup:create', async () => {
    return backupService.createBackup()
  })

  ipcMain.handle('backup:list', async () => {
    return backupService.listBackups()
  })

  ipcMain.handle('backup:restore', async (_, filePath) => {
    return backupService.restoreBackup(filePath)
  })

  ipcMain.handle('backup:openFolder', async () => {
    return backupService.openBackupFolder()
  })

  ipcMain.handle('backup:selectFile', async () => {
    const result = await dialog.showOpenDialog({
      title: 'Select Omega Engineers Database Backup',
      filters: [{ name: 'SQLite Database', extensions: ['db'] }],
      properties: ['openFile']
    })
    if (result.canceled || !result.filePaths.length) return null
    return result.filePaths[0]
  })
}

module.exports = { register }
