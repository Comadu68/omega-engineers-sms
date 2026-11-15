/**
 * Browser Development Bridge
 * Enables full end-to-end testing in standard web browsers (Chrome/Edge)
 * by proxying window.omega calls through Vite's local dev server to SQLite.
 */
export function initBrowserBridge() {
  if (typeof window === 'undefined' || window.omega) return

  const invoke = async (channel, ...args) => {
    const payload = args.length === 1 ? args[0] : (args.length > 1 ? args : undefined)
    const res = await fetch('/api/ipc', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ channel, args: payload })
    })
    const data = await res.json()
    if (data.error) {
      throw new Error(data.error)
    }
    return data.result
  }

  window.omega = {
    isBrowserDevMode: true,
    app: {
      getVersion: () => invoke('app:getVersion'),
      getUserDataPath: () => invoke('app:getUserDataPath')
    },
    database: {
      health: () => invoke('db:health')
    },
    auth: {
      isFirstRun: () => invoke('auth:isFirstRun'),
      setupAdmin: (p) => invoke('auth:setupAdmin', p),
      login: (c) => invoke('auth:login', c),
      logout: () => invoke('auth:logout'),
      getUsers: () => invoke('auth:getUsers'),
      createUser: (p) => invoke('auth:createUser', p),
      updateUser: (id, d) => invoke('auth:updateUser', { id, data: d }),
      changePassword: (id, newP, currP) =>
        invoke('auth:changePassword', typeof id === 'object' && id !== null ? id : { id, newPassword: newP, currentPassword: currP })
    },
    customers: {
      list: (f) => invoke('customers:list', f),
      get: (id) => invoke('customers:get', id),
      create: (d) => invoke('customers:create', d),
      update: (id, d) => invoke('customers:update', { id, data: d }),
      remove: (id) => invoke('customers:remove', id),
      findDuplicates: (phone, excludeId) => invoke('customers:findDuplicates', { phone, excludeId })
    },
    vehicles: {
      list: (f) => invoke('vehicles:list', f),
      get: (id) => invoke('vehicles:get', id),
      create: (d) => invoke('vehicles:create', d),
      update: (id, d) => invoke('vehicles:update', { id, data: d }),
      remove: (id) => invoke('vehicles:remove', id)
    },
    appointments: {
      list: (f) => invoke('appointments:list', f),
      get: (id) => invoke('appointments:get', id),
      getMonthlyAvailability: (y, m) => invoke('appointments:getMonthlyAvailability', { year: y, month: m }),
      checkAvailability: (d) => invoke('appointments:checkAvailability', d),
      create: (d) => invoke('appointments:create', d),
      updateStatus: (id, s) => invoke('appointments:updateStatus', { id, status: s })
    },
    mechanics: {
      list: () => invoke('mechanics:list'),
      get: (id) => invoke('mechanics:get', id),
      create: (d) => invoke('mechanics:create', d),
      update: (id, d) => invoke('mechanics:update', { id, data: d }),
      updateStatus: (id, s) => invoke('mechanics:updateStatus', { id, status: s })
    },
    jobs: {
      list: (f) => invoke('jobs:list', f),
      get: (id) => invoke('jobs:get', id),
      create: (d) => invoke('jobs:create', d),
      updateStatus: (id, s, r) => invoke('jobs:updateStatus', { id, status: s, cancellationReason: r }),
      assignMechanic: (jId, mId, uId) => invoke('jobs:assignMechanic', { jobId: jId, mechanicId: mId, userId: uId }),
      addTask: (jId, td) => invoke('jobs:addTask', { jobId: jId, taskData: td }),
      updateTask: (tId, td) => invoke('jobs:updateTask', { taskId: tId, taskData: td }),
      deleteTask: (tId) => invoke('jobs:deleteTask', tId),
      addPart: (jId, pd) => invoke('jobs:addPart', { jobId: jId, partData: pd }),
      removePart: (jpId) => invoke('jobs:removePart', jpId)
    },
    inventory: {
      list: (f) => invoke('inventory:list', f),
      get: (id) => invoke('inventory:get', id),
      createItem: (d) => invoke('inventory:createItem', d),
      updateItem: (id, d) => invoke('inventory:updateItem', { id, data: d }),
      receiveBatch: (d) => invoke('inventory:receiveBatch', d),
      getSummary: () => invoke('inventory:getSummary'),
      getSuppliers: () => invoke('inventory:getSuppliers'),
      createSupplier: (d) => invoke('inventory:createSupplier', d)
    },
    invoices: {
      list: (f) => invoke('invoices:list', f),
      get: (id) => invoke('invoices:get', id),
      getByJob: (jId) => invoke('invoices:getByJob', jId),
      generateFromJob: (jId, opts) => invoke('invoices:generateFromJob', { jobId: jId, options: opts }),
      cancel: (id) => invoke('invoices:cancel', id)
    },
    payments: {
      record: (p) => invoke('payments:record', p),
      listByInvoice: (invId) => invoke('payments:listByInvoice', invId)
    },
    expenses: {
      list: (f) => invoke('expenses:list', f),
      create: (d) => invoke('expenses:create', d),
      remove: (id) => invoke('expenses:remove', id),
      getCategories: () => invoke('expenses:getCategories')
    },
    reports: {
      dailySummary: (d) => invoke('reports:dailySummary', d),
      jobCards: (f) => invoke('reports:jobCards', f),
      sales: (f) => invoke('reports:sales', f),
      inventory: () => invoke('reports:inventory'),
      mechanicPerformance: (f) => invoke('reports:mechanicPerformance', f)
    },
    backup: {
      create: () => invoke('backup:create'),
      list: () => invoke('backup:list'),
      restore: (fp) => invoke('backup:restore', fp),
      openFolder: () => invoke('backup:openFolder'),
      selectFile: () => invoke('backup:selectFile')
    },
    settings: {
      getAll: () => invoke('settings:getAll'),
      get: (k) => invoke('settings:get', k),
      update: (k, v) => invoke('settings:update', { key: k, value: v }),
      updateMultiple: (m) => invoke('settings:updateMultiple', m),
      getAuditLogs: (o) => invoke('settings:getAuditLogs', o)
    }
  }

  console.log('[Omega] Browser Dev Bridge active. Forwarding calls to local SQLite.')
}
