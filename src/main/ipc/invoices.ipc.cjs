const { ipcMain } = require('electron')
const invoiceService = require('../services/invoiceService.cjs')

const register = () => {
  ipcMain.handle('invoices:list', async (_, filters) => {
    return invoiceService.list(filters)
  })

  ipcMain.handle('invoices:get', async (_, id) => {
    return invoiceService.get(id)
  })

  ipcMain.handle('invoices:getByJob', async (_, jobId) => {
    return invoiceService.getByJob(jobId)
  })

  ipcMain.handle('invoices:generateFromJob', async (_, { jobId, options }) => {
    return invoiceService.generateFromJob(jobId, options)
  })

  ipcMain.handle('invoices:cancel', async (_, id) => {
    return invoiceService.cancel(id)
  })
}

module.exports = { register }
