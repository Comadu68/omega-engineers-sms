const authService = require('../services/authService.cjs')

const sessionsBySenderId = new Map()
const sessionsBySenderObject = new WeakMap()
const observedSenders = new WeakSet()

const getElectronIpcMain = () => {
  try {
    const electron = require('electron')
    if (electron && typeof electron === 'object' && electron.ipcMain) {
      return electron.ipcMain
    }
  } catch (_) {}
  return null
}

const getSenderFromEvent = (event) => {
  if (!event || typeof event !== 'object') return null
  const sender = event.sender
  if (!sender || typeof sender !== 'object') return null
  return sender
}

const isSenderDestroyed = (sender) => {
  if (!sender || typeof sender !== 'object') return true
  if (typeof sender.isDestroyed === 'function') {
    try {
      return Boolean(sender.isDestroyed())
    } catch (_) {
      return true
    }
  }
  return false
}

const getSenderIdKey = (senderOrId) => {
  if (typeof senderOrId === 'number' || typeof senderOrId === 'string') {
    return `wc:${String(senderOrId)}`
  }
  if (senderOrId && typeof senderOrId === 'object') {
    if (senderOrId.id !== undefined && senderOrId.id !== null) {
      return `wc:${String(senderOrId.id)}`
    }
  }
  return null
}

const clearSessionForWebContents = (senderOrId) => {
  const idKey = getSenderIdKey(senderOrId)
  if (idKey) {
    sessionsBySenderId.delete(idKey)
  }
  if (senderOrId && typeof senderOrId === 'object') {
    sessionsBySenderObject.delete(senderOrId)
  }
}

const clearSessionForEvent = (event) => {
  const sender = getSenderFromEvent(event)
  if (!sender) return
  clearSessionForWebContents(sender)
}

const clearAllSessions = () => {
  sessionsBySenderId.clear()
}

const attachDestroyHook = (sender) => {
  if (!sender || typeof sender !== 'object' || observedSenders.has(sender)) {
    return
  }
  const onDestroyed = () => {
    clearSessionForWebContents(sender)
  }
  if (typeof sender.once === 'function') {
    observedSenders.add(sender)
    sender.once('destroyed', onDestroyed)
  } else if (typeof sender.on === 'function') {
    observedSenders.add(sender)
    sender.on('destroyed', onDestroyed)
  }
}

const setSessionForEvent = (event, user) => {
  const sender = getSenderFromEvent(event)
  if (!sender || isSenderDestroyed(sender)) {
    throw new Error('Cannot establish authenticated session without an active renderer window.')
  }
  if (!user || !Number.isInteger(Number(user.id)) || Number(user.id) <= 0) {
    throw new Error('Invalid user record for session.')
  }

  const sessionRecord = Object.freeze({
    userId: Number(user.id),
    authenticatedAt: new Date().toISOString()
  })

  const idKey = getSenderIdKey(sender)
  if (idKey) {
    sessionsBySenderId.set(idKey, sessionRecord)
  }
  sessionsBySenderObject.set(sender, sessionRecord)
  attachDestroyHook(sender)
}

const getRawSessionForEvent = (event) => {
  const sender = getSenderFromEvent(event)
  if (!sender) return null
  if (isSenderDestroyed(sender)) {
    clearSessionForWebContents(sender)
    return null
  }
  const idKey = getSenderIdKey(sender)
  if (idKey && sessionsBySenderId.has(idKey)) {
    return sessionsBySenderId.get(idKey)
  }
  if (sessionsBySenderObject.has(sender)) {
    return sessionsBySenderObject.get(sender)
  }
  return null
}

const requireAuthenticatedSession = (event) => {
  const session = getRawSessionForEvent(event)
  if (!session || !session.userId) {
    throw new Error('Authentication required. Please sign in.')
  }

  try {
    return authService.getAuthenticatedCaller({ callerUserId: session.userId })
  } catch (err) {
    clearSessionForEvent(event)
    throw err
  }
}

const requireAdminSession = (event) => {
  const caller = requireAuthenticatedSession(event)
  if (caller.role !== 'admin_owner') {
    throw new Error('Access denied: Administrator privileges are required.')
  }
  return caller
}

const register = (customIpcMain = null) => {
  const ipcMain = customIpcMain || getElectronIpcMain()
  if (!ipcMain || typeof ipcMain.handle !== 'function') {
    throw new Error('ipcMain.handle is required to register auth IPC handlers.')
  }

  ipcMain.handle('auth:isFirstRun', async () => {
    return authService.isFirstRun()
  })

  ipcMain.handle('auth:setupAdmin', async (event, payload) => {
    const user = authService.setupAdmin(payload)
    setSessionForEvent(event, user)
    return user
  })

  ipcMain.handle('auth:login', async (event, credentials) => {
    clearSessionForEvent(event)
    const user = authService.login(credentials)
    setSessionForEvent(event, user)
    return user
  })

  ipcMain.handle('auth:logout', async (event) => {
    const existingSession = getRawSessionForEvent(event)
    clearSessionForEvent(event)
    if (existingSession && existingSession.userId) {
      authService.recordLogoutAudit(existingSession.userId)
    }
    return { success: true }
  })

  ipcMain.handle('auth:getUsers', async (event) => {
    const caller = requireAdminSession(event)
    return authService.getUsers({ callerUserId: caller.id })
  })

  ipcMain.handle('auth:createUser', async (event, payload) => {
    const caller = requireAdminSession(event)
    return authService.createUser(payload, { callerUserId: caller.id })
  })

  ipcMain.handle('auth:updateUser', async (event, payload) => {
    const caller = requireAdminSession(event)
    const { id, data, ...rest } = payload || {}
    const updateData = data && typeof data === 'object' ? data : rest
    return authService.updateUser(id, updateData, { callerUserId: caller.id })
  })

  ipcMain.handle('auth:changePassword', async (event, payload) => {
    const caller = requireAuthenticatedSession(event)
    const { id, newPassword, currentPassword } = payload || {}
    return authService.changePassword(id, newPassword, {
      callerUserId: caller.id,
      currentPassword
    })
  })
}

module.exports = {
  register,
  requireAuthenticatedSession,
  requireAdminSession,
  clearSessionForWebContents,
  clearSessionForEvent,
  clearAllSessions
}

