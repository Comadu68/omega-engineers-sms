const { ipcMain } = require('electron')
const expenseService = require('../services/expenseService.cjs')

const register = () => {
  ipcMain.handle('expenses:list', async (_, filters) => {
    return expenseService.list(filters)
  })

  ipcMain.handle('expenses:create', async (_, data) => {
    return expenseService.create(data)
  })

  ipcMain.handle('expenses:remove', async (_, id) => {
    return expenseService.remove(id)
  })

  ipcMain.handle('expenses:getCategories', async () => {
    return expenseService.getCategories()
  })
}

module.exports = { register }
