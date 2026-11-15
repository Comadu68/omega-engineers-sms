const { ipcMain } = require('electron')
const reportService = require('../services/reportService.cjs')
const authService = require('../services/authService.cjs')

const register = () => {
  ipcMain.handle('reports:dailySummary', async (_, date) => {
    authService.requireAdminCaller()
    return reportService.dailySummary(date)
  })

  ipcMain.handle('reports:jobCards', async (_, filters) => {
    authService.requireAdminCaller()
    return reportService.jobCardsReport(filters)
  })

  ipcMain.handle('reports:sales', async (_, filters) => {
    authService.requireAdminCaller()
    return reportService.salesReport(filters)
  })

  ipcMain.handle('reports:inventory', async () => {
    authService.requireAdminCaller()
    return reportService.inventoryReport()
  })

  ipcMain.handle('reports:mechanicPerformance', async (_, filters) => {
    authService.requireAdminCaller()
    return reportService.mechanicPerformanceReport(filters)
  })
}

module.exports = { register }
