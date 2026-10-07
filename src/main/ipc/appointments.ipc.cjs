const { ipcMain } = require('electron')
const appointmentService = require('../services/appointmentService.cjs')

const register = () => {
  ipcMain.handle('appointments:list', async (_, filters) => {
    return appointmentService.list(filters)
  })

  ipcMain.handle('appointments:get', async (_, id) => {
    return appointmentService.get(id)
  })

  ipcMain.handle('appointments:getMonthlyAvailability', async (_, { year, month }) => {
    return appointmentService.getMonthlyAvailability(year, month)
  })

  ipcMain.handle('appointments:checkAvailability', async (_, data) => {
    return appointmentService.checkAvailability(data)
  })

  ipcMain.handle('appointments:create', async (_, data) => {
    return appointmentService.create(data)
  })

  ipcMain.handle('appointments:updateStatus', async (_, { id, status }) => {
    return appointmentService.updateStatus(id, status)
  })
}

module.exports = { register }
