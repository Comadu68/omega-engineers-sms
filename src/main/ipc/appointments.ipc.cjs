const { ipcMain } = require('electron')
const appointmentService = require('../services/appointmentService.cjs')
const authService = require('../services/authService.cjs')

const READ_ROLES = ['admin_owner', 'receptionist_service_advisor', 'mechanic']
const WRITE_ROLES = ['admin_owner', 'receptionist_service_advisor']

const register = () => {
  ipcMain.handle('appointments:list', async (_, filters) => {
    authService.requireRole(READ_ROLES)
    return appointmentService.list(filters)
  })

  ipcMain.handle('appointments:get', async (_, id) => {
    authService.requireRole(READ_ROLES)
    return appointmentService.get(id)
  })

  ipcMain.handle('appointments:getById', async (_, id) => {
    authService.requireRole(READ_ROLES)
    return appointmentService.get(id)
  })

  ipcMain.handle('appointments:getMonthlyAvailability', async (_, { year, month }) => {
    authService.requireRole(READ_ROLES)
    return appointmentService.getMonthlyAvailability(year, month)
  })

  ipcMain.handle('appointments:checkAvailability', async (_, data) => {
    authService.requireRole(READ_ROLES)
    return appointmentService.checkAvailability(data)
  })

  ipcMain.handle('appointments:checkSlot', async (_, data) => {
    authService.requireRole(READ_ROLES)
    return appointmentService.checkAvailability(data)
  })

  ipcMain.handle('appointments:todayCount', async () => {
    authService.requireRole(READ_ROLES)
    const today = new Date().toISOString().slice(0, 10)
    const list = appointmentService.list({ date: today })
    return list.filter((a) => a.status !== 'cancelled' && a.status !== 'no_show').length
  })

  ipcMain.handle('appointments:create', async (_, data) => {
    authService.requireRole(WRITE_ROLES)
    return appointmentService.create(data)
  })

  ipcMain.handle('appointments:update', async (_, data) => {
    authService.requireRole(WRITE_ROLES)
    if (data && data.id && data.status) {
      return appointmentService.updateStatus(data.id, data.status)
    }
    return appointmentService.updateStatus(data.id, data.status)
  })

  ipcMain.handle('appointments:updateStatus', async (_, { id, status }) => {
    authService.requireRole(WRITE_ROLES)
    return appointmentService.updateStatus(id, status)
  })
}

module.exports = { register }
