const { ipcMain } = require('electron')
const paymentService = require('../services/paymentService.cjs')

const register = () => {
  ipcMain.handle('payments:record', async (_, payload) => {
    return paymentService.record(payload)
  })

  ipcMain.handle('payments:listByInvoice', async (_, invoiceId) => {
    return paymentService.listByInvoice(invoiceId)
  })
}

module.exports = { register }
