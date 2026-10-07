const { ipcMain } = require('electron')
const inventoryService = require('../services/inventoryService.cjs')

const register = () => {
  ipcMain.handle('inventory:list', async (_, filters) => {
    return inventoryService.list(filters)
  })

  ipcMain.handle('inventory:get', async (_, id) => {
    return inventoryService.get(id)
  })

  ipcMain.handle('inventory:createItem', async (_, data) => {
    return inventoryService.createItem(data)
  })

  ipcMain.handle('inventory:updateItem', async (_, { id, data }) => {
    return inventoryService.updateItem(id, data)
  })

  ipcMain.handle('inventory:receiveBatch', async (_, data) => {
    return inventoryService.receiveBatch(data)
  })

  ipcMain.handle('inventory:getSummary', async () => {
    return inventoryService.getSummary()
  })

  ipcMain.handle('inventory:getSuppliers', async () => {
    return inventoryService.getSuppliers()
  })

  ipcMain.handle('inventory:createSupplier', async (_, data) => {
    return inventoryService.createSupplier(data)
  })
}

module.exports = { register }
