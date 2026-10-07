const { ipcMain } = require('electron')
const settingsService = require('../services/settingsService.cjs')

const register = () => {
  ipcMain.handle('settings:getAll', async () => {
    return settingsService.getAll()
  })

  ipcMain.handle('settings:get', async (_, key) => {
    return settingsService.get(key)
  })

  ipcMain.handle('settings:update', async (_, { key, value }) => {
    return settingsService.update(key, value)
  })

  ipcMain.handle('settings:updateMultiple', async (_, settingsMap) => {
    return settingsService.updateMultiple(settingsMap)
  })

  ipcMain.handle('settings:getAuditLogs', async (_, options) => {
    return settingsService.getAuditLogs(options)
  })
}

module.exports = { register }
