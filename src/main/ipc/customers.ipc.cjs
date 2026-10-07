const { ipcMain } = require('electron')
const customerService = require('../services/customerService.cjs')

const register = () => {
  ipcMain.handle('customers:list', async (_, filters) => {
    return customerService.list(filters)
  })

  ipcMain.handle('customers:get', async (_, id) => {
    return customerService.get(id)
  })

  ipcMain.handle('customers:create', async (_, data) => {
    return customerService.create(data)
  })

  ipcMain.handle('customers:update', async (_, { id, data }) => {
    return customerService.update(id, data)
  })

  ipcMain.handle('customers:remove', async (_, id) => {
    return customerService.remove(id)
  })
}

module.exports = { register }
