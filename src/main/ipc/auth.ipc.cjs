const { ipcMain } = require('electron')
const authService = require('../services/authService.cjs')

const register = () => {
  ipcMain.handle('auth:isFirstRun', async () => {
    return authService.isFirstRun()
  })

  ipcMain.handle('auth:setupAdmin', async (_, payload) => {
    return authService.setupAdmin(payload)
  })

  ipcMain.handle('auth:login', async (_, credentials) => {
    return authService.login(credentials)
  })

  ipcMain.handle('auth:getUsers', async () => {
    return authService.getUsers()
  })

  ipcMain.handle('auth:createUser', async (_, payload) => {
    return authService.createUser(payload)
  })

  ipcMain.handle('auth:updateUser', async (_, { id, data }) => {
    return authService.updateUser(id, data)
  })

  ipcMain.handle('auth:changePassword', async (_, { id, newPassword }) => {
    return authService.changePassword(id, newPassword)
  })
}

module.exports = { register }
