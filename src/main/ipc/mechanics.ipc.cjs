const { ipcMain } = require('electron')
const mechanicService = require('../services/mechanicService.cjs')

const register = () => {
  ipcMain.handle('mechanics:list', async () => {
    return mechanicService.list()
  })

  ipcMain.handle('mechanics:get', async (_, id) => {
    return mechanicService.get(id)
  })

  ipcMain.handle('mechanics:create', async (_, data) => {
    return mechanicService.create(data)
  })

  ipcMain.handle('mechanics:update', async (_, { id, data }) => {
    return mechanicService.update(id, data)
  })

  ipcMain.handle('mechanics:updateStatus', async (_, { id, status }) => {
    return mechanicService.updateStatus(id, status)
  })
}

module.exports = { register }
