const { ipcMain } = require('electron')
const reportService = require('../services/reportService.cjs')

const register = () => {
  ipcMain.handle('reports:dailySummary', async (_, date) => {
    return reportService.dailySummary(date)
  })

  ipcMain.handle('reports:jobCards', async (_, filters) => {
    return reportService.jobCardsReport(filters)
  })

  ipcMain.handle('reports:sales', async (_, filters) => {
    return reportService.salesReport(filters)
  })

  ipcMain.handle('reports:inventory', async () => {
    return reportService.inventoryReport()
  })

  ipcMain.handle('reports:mechanicPerformance', async (_, filters) => {
    return reportService.mechanicPerformanceReport(filters)
  })
}

module.exports = { register }
