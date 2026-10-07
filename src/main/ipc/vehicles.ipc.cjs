const { ipcMain } = require('electron')
const vehicleService = require('../services/vehicleService.cjs')

const register = () => {
  ipcMain.handle('vehicles:list', async (_, filters) => {
    return vehicleService.list(filters)
  })

  ipcMain.handle('vehicles:get', async (_, id) => {
    return vehicleService.get(id)
  })

  ipcMain.handle('vehicles:create', async (_, data) => {
    return vehicleService.create(data)
  })

  ipcMain.handle('vehicles:update', async (_, { id, data }) => {
    return vehicleService.update(id, data)
  })

  ipcMain.handle('vehicles:remove', async (_, id) => {
    return vehicleService.remove(id)
  })
}

module.exports = { register }
