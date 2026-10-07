const { ipcMain } = require('electron')
const jobService = require('../services/jobService.cjs')

const register = () => {
  ipcMain.handle('jobs:list', async (_, filters) => {
    return jobService.list(filters)
  })

  ipcMain.handle('jobs:get', async (_, id) => {
    return jobService.get(id)
  })

  ipcMain.handle('jobs:create', async (_, data) => {
    return jobService.create(data)
  })

  ipcMain.handle('jobs:updateStatus', async (_, { id, status, cancellationReason }) => {
    return jobService.updateStatus(id, status, cancellationReason)
  })

  ipcMain.handle('jobs:assignMechanic', async (_, { jobId, mechanicId, userId }) => {
    return jobService.assignMechanic(jobId, mechanicId, userId)
  })

  ipcMain.handle('jobs:addTask', async (_, { jobId, taskData }) => {
    return jobService.addTask(jobId, taskData)
  })

  ipcMain.handle('jobs:updateTask', async (_, { taskId, taskData }) => {
    return jobService.updateTask(taskId, taskData)
  })

  ipcMain.handle('jobs:deleteTask', async (_, taskId) => {
    return jobService.deleteTask(taskId)
  })

  ipcMain.handle('jobs:addPart', async (_, { jobId, partData }) => {
    return jobService.addPart(jobId, partData)
  })

  ipcMain.handle('jobs:removePart', async (_, jobPartId) => {
    return jobService.removePart(jobPartId)
  })
}

module.exports = { register }
