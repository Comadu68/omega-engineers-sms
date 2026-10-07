const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('omega', {
  app: {
    getVersion: () => ipcRenderer.invoke('app:getVersion'),
    getUserDataPath: () => ipcRenderer.invoke('app:getUserDataPath')
  },
  database: {
    health: () => ipcRenderer.invoke('db:health')
  },
  auth: {
    isFirstRun: () => ipcRenderer.invoke('auth:isFirstRun'),
    setupAdmin: (payload) => ipcRenderer.invoke('auth:setupAdmin', payload),
    login: (credentials) => ipcRenderer.invoke('auth:login', credentials),
    getUsers: () => ipcRenderer.invoke('auth:getUsers'),
    createUser: (payload) => ipcRenderer.invoke('auth:createUser', payload),
    updateUser: (id, data) => ipcRenderer.invoke('auth:updateUser', { id, data }),
    changePassword: (id, newPassword) => ipcRenderer.invoke('auth:changePassword', { id, newPassword })
  },
  customers: {
    list: (filters) => ipcRenderer.invoke('customers:list', filters),
    get: (id) => ipcRenderer.invoke('customers:get', id),
    create: (data) => ipcRenderer.invoke('customers:create', data),
    update: (id, data) => ipcRenderer.invoke('customers:update', { id, data }),
    remove: (id) => ipcRenderer.invoke('customers:remove', id)
  },
  vehicles: {
    list: (filters) => ipcRenderer.invoke('vehicles:list', filters),
    get: (id) => ipcRenderer.invoke('vehicles:get', id),
    create: (data) => ipcRenderer.invoke('vehicles:create', data),
    update: (id, data) => ipcRenderer.invoke('vehicles:update', { id, data }),
    remove: (id) => ipcRenderer.invoke('vehicles:remove', id)
  },
  appointments: {
    list: (filters) => ipcRenderer.invoke('appointments:list', filters),
    get: (id) => ipcRenderer.invoke('appointments:get', id),
    getMonthlyAvailability: (year, month) => ipcRenderer.invoke('appointments:getMonthlyAvailability', { year, month }),
    checkAvailability: (data) => ipcRenderer.invoke('appointments:checkAvailability', data),
    create: (data) => ipcRenderer.invoke('appointments:create', data),
    updateStatus: (id, status) => ipcRenderer.invoke('appointments:updateStatus', { id, status })
  },
  mechanics: {
    list: () => ipcRenderer.invoke('mechanics:list'),
    get: (id) => ipcRenderer.invoke('mechanics:get', id),
    create: (data) => ipcRenderer.invoke('mechanics:create', data),
    update: (id, data) => ipcRenderer.invoke('mechanics:update', { id, data }),
    updateStatus: (id, status) => ipcRenderer.invoke('mechanics:updateStatus', { id, status })
  },
  jobs: {
    list: (filters) => ipcRenderer.invoke('jobs:list', filters),
    get: (id) => ipcRenderer.invoke('jobs:get', id),
    create: (data) => ipcRenderer.invoke('jobs:create', data),
    updateStatus: (id, status, cancellationReason) => ipcRenderer.invoke('jobs:updateStatus', { id, status, cancellationReason }),
    assignMechanic: (jobId, mechanicId, userId) => ipcRenderer.invoke('jobs:assignMechanic', { jobId, mechanicId, userId }),
    addTask: (jobId, taskData) => ipcRenderer.invoke('jobs:addTask', { jobId, taskData }),
    updateTask: (taskId, taskData) => ipcRenderer.invoke('jobs:updateTask', { taskId, taskData }),
    deleteTask: (taskId) => ipcRenderer.invoke('jobs:deleteTask', taskId),
    addPart: (jobId, partData) => ipcRenderer.invoke('jobs:addPart', { jobId, partData }),
    removePart: (jobPartId) => ipcRenderer.invoke('jobs:removePart', jobPartId)
  },
  inventory: {
    list: (filters) => ipcRenderer.invoke('inventory:list', filters),
    get: (id) => ipcRenderer.invoke('inventory:get', id),
    createItem: (data) => ipcRenderer.invoke('inventory:createItem', data),
    updateItem: (id, data) => ipcRenderer.invoke('inventory:updateItem', { id, data }),
    receiveBatch: (data) => ipcRenderer.invoke('inventory:receiveBatch', data),
    getSummary: () => ipcRenderer.invoke('inventory:getSummary'),
    getSuppliers: () => ipcRenderer.invoke('inventory:getSuppliers'),
    createSupplier: (data) => ipcRenderer.invoke('inventory:createSupplier', data)
  },
  invoices: {
    list: (filters) => ipcRenderer.invoke('invoices:list', filters),
    get: (id) => ipcRenderer.invoke('invoices:get', id),
    getByJob: (jobId) => ipcRenderer.invoke('invoices:getByJob', jobId),
    generateFromJob: (jobId, options) => ipcRenderer.invoke('invoices:generateFromJob', { jobId, options }),
    cancel: (id) => ipcRenderer.invoke('invoices:cancel', id)
  },
  payments: {
    record: (payload) => ipcRenderer.invoke('payments:record', payload),
    listByInvoice: (invoiceId) => ipcRenderer.invoke('payments:listByInvoice', invoiceId)
  },
  expenses: {
    list: (filters) => ipcRenderer.invoke('expenses:list', filters),
    create: (data) => ipcRenderer.invoke('expenses:create', data),
    remove: (id) => ipcRenderer.invoke('expenses:remove', id),
    getCategories: () => ipcRenderer.invoke('expenses:getCategories')
  },
  reports: {
    dailySummary: (date) => ipcRenderer.invoke('reports:dailySummary', date),
    jobCards: (filters) => ipcRenderer.invoke('reports:jobCards', filters),
    sales: (filters) => ipcRenderer.invoke('reports:sales', filters),
    inventory: () => ipcRenderer.invoke('reports:inventory'),
    mechanicPerformance: (filters) => ipcRenderer.invoke('reports:mechanicPerformance', filters)
  },
  backup: {
    create: () => ipcRenderer.invoke('backup:create'),
    list: () => ipcRenderer.invoke('backup:list'),
    restore: (filePath) => ipcRenderer.invoke('backup:restore', filePath),
    openFolder: () => ipcRenderer.invoke('backup:openFolder'),
    selectFile: () => ipcRenderer.invoke('backup:selectFile')
  },
  settings: {
    getAll: () => ipcRenderer.invoke('settings:getAll'),
    get: (key) => ipcRenderer.invoke('settings:get', key),
    update: (key, value) => ipcRenderer.invoke('settings:update', { key, value }),
    updateMultiple: (settingsMap) => ipcRenderer.invoke('settings:updateMultiple', settingsMap),
    getAuditLogs: (options) => ipcRenderer.invoke('settings:getAuditLogs', options)
  }
})
