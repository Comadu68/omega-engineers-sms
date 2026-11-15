const { ipcMain } = require('electron')
const inventoryService = require('../services/inventoryService.cjs')
const authService = require('../services/authService.cjs')

const READ_ROLES = ['admin_owner', 'inventory_billing', 'mechanic', 'receptionist_service_advisor']
const WRITE_ROLES = ['admin_owner', 'inventory_billing']

const register = () => {
  ipcMain.handle('inventory:list', async (_, filters) => {
    authService.requireRole(READ_ROLES)
    return inventoryService.list(filters)
  })

  ipcMain.handle('inventory:get', async (_, id) => {
    authService.requireRole(READ_ROLES)
    return inventoryService.get(id)
  })

  ipcMain.handle('inventory:createItem', async (_, data) => {
    authService.requireRole(WRITE_ROLES)
    return inventoryService.createItem(data)
  })

  ipcMain.handle('inventory:updateItem', async (_, { id, data }) => {
    authService.requireRole(WRITE_ROLES)
    return inventoryService.updateItem(id, data)
  })

  ipcMain.handle('inventory:receiveBatch', async (_, data) => {
    authService.requireRole(WRITE_ROLES)
    return inventoryService.receiveBatch(data)
  })

  ipcMain.handle('inventory:getSummary', async () => {
    authService.requireRole(READ_ROLES)
    return inventoryService.getSummary()
  })

  ipcMain.handle('inventory:getSuppliers', async (_, options) => {
    authService.requireRole(READ_ROLES)
    return inventoryService.getSuppliers(options)
  })

  ipcMain.handle('inventory:createSupplier', async (_, data) => {
    authService.requireRole(WRITE_ROLES)
    return inventoryService.createSupplier(data)
  })

  ipcMain.handle('inventory:updateSupplier', async (_, { id, data }) => {
    authService.requireRole(WRITE_ROLES)
    return inventoryService.updateSupplier(id, data)
  })

  ipcMain.handle('inventory:deactivateSupplier', async (_, { id, isActive }) => {
    authService.requireRole(WRITE_ROLES)
    return inventoryService.deactivateSupplier(id, isActive)
  })

  ipcMain.handle('inventory:getPurchaseBatches', async (_, filters) => {
    authService.requireRole(READ_ROLES)
    return inventoryService.getPurchaseBatches(filters)
  })
}

module.exports = { register }
