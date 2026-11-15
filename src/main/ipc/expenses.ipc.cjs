const { ipcMain } = require('electron')
const expenseService = require('../services/expenseService.cjs')
const authService = require('../services/authService.cjs')

const register = () => {
  ipcMain.handle('expenses:list', async (_, filters) => {
    authService.requireRole(['admin_owner', 'inventory_billing'])
    return expenseService.list(filters)
  })

  ipcMain.handle('expenses:create', async (_, data) => {
    authService.requireRole(['admin_owner', 'inventory_billing'])
    return expenseService.create(data)
  })

  ipcMain.handle('expenses:remove', async (_, id) => {
    authService.requireRole(['admin_owner', 'inventory_billing'])
    return expenseService.remove(id)
  })

  ipcMain.handle('expenses:getCategories', async () => {
    authService.requireRole(['admin_owner', 'inventory_billing'])
    return expenseService.getCategories()
  })
}

module.exports = { register }
