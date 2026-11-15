const path = require('path')
const dbHelper = require('../src/database/db.cjs')

// Target the AppData DB if it exists, otherwise local db
const appDataDb = path.join(process.env.APPDATA || '', 'omega-engineers-service-station', 'data', 'omega_service_station.db')
const localDb = path.join(__dirname, '..', '.local_data', 'data', 'omega_service_station.db')
const targetDb = require('fs').existsSync(appDataDb) ? appDataDb : localDb

dbHelper.initDb(targetDb)

const authService = require('../src/main/services/authService.cjs')
const customerService = require('../src/main/services/customerService.cjs')
const vehicleService = require('../src/main/services/vehicleService.cjs')
const mechanicService = require('../src/main/services/mechanicService.cjs')
const appointmentService = require('../src/main/services/appointmentService.cjs')
const inventoryService = require('../src/main/services/inventoryService.cjs')
const jobService = require('../src/main/services/jobService.cjs')
const invoiceService = require('../src/main/services/invoiceService.cjs')
const paymentService = require('../src/main/services/paymentService.cjs')
const expenseService = require('../src/main/services/expenseService.cjs')
const reportService = require('../src/main/services/reportService.cjs')
const settingsService = require('../src/main/services/settingsService.cjs')
const backupService = require('../src/main/services/backupService.cjs')

let activeSessionUser = null

async function handleIpc(channel, args) {
  const caller = activeSessionUser ? { id: activeSessionUser.id, callerUserId: activeSessionUser.id, role: activeSessionUser.role } : null

  switch (channel) {
    // App & Health
    case 'app:getVersion':
      return '1.0.0'
    case 'app:getUserDataPath':
      return path.dirname(targetDb)
    case 'db:health':
      return { ok: true, dbPath: targetDb }

    // Auth
    case 'auth:isFirstRun':
      return authService.isFirstRun()
    case 'auth:setupAdmin': {
      const user = authService.setupAdmin(args)
      activeSessionUser = user
      return user
    }
    case 'auth:login': {
      const user = authService.login(args)
      activeSessionUser = user
      return user
    }
    case 'auth:logout':
      activeSessionUser = null
      return { success: true }
    case 'auth:getUsers':
      return authService.getUsers(caller)
    case 'auth:createUser':
      return authService.createUser(args, caller)
    case 'auth:updateUser':
      return authService.updateUser(args.id, args.data, caller)
    case 'auth:changePassword':
      return authService.changePassword(args.id, args.newPassword, { ...args, ...caller })

    // Customers
    case 'customers:list':
      return customerService.list(args || {})
    case 'customers:get':
      return customerService.get(args)
    case 'customers:create':
      return customerService.create(args)
    case 'customers:update':
      return customerService.update(args.id, args.data)
    case 'customers:remove':
      return customerService.remove(args)
    case 'customers:findDuplicates':
      return customerService.findDuplicates(args.phone, args.excludeId)

    // Vehicles
    case 'vehicles:list':
      return vehicleService.list(args || {})
    case 'vehicles:get':
      return vehicleService.get(args)
    case 'vehicles:create':
      return vehicleService.create(args)
    case 'vehicles:update':
      return vehicleService.update(args.id, args.data)
    case 'vehicles:remove':
      return vehicleService.remove(args)

    // Appointments
    case 'appointments:list':
      return appointmentService.list(args || {})
    case 'appointments:get':
      return appointmentService.get(args)
    case 'appointments:getMonthlyAvailability':
      return appointmentService.getMonthlyAvailability(args.year, args.month)
    case 'appointments:checkAvailability':
      return appointmentService.checkAvailability(args)
    case 'appointments:create':
      return appointmentService.create({ ...args, userId: caller?.id })
    case 'appointments:updateStatus':
      return appointmentService.updateStatus(args.id, args.status)

    // Mechanics
    case 'mechanics:list':
      return mechanicService.list()
    case 'mechanics:get':
      return mechanicService.get(args)
    case 'mechanics:create':
      return mechanicService.create(args)
    case 'mechanics:update':
      return mechanicService.update(args.id, args.data)
    case 'mechanics:updateStatus':
      return mechanicService.updateStatus(args.id, args.status)

    // Jobs
    case 'jobs:list':
      return jobService.list(args || {})
    case 'jobs:get':
      return jobService.get(args)
    case 'jobs:create':
      return jobService.create({ ...args, userId: caller?.id })
    case 'jobs:updateStatus':
      return jobService.updateStatus(args.id, args.status, args.cancellationReason)
    case 'jobs:assignMechanic':
      return jobService.assignMechanic(args.jobId, args.mechanicId, caller?.id)
    case 'jobs:addTask':
      return jobService.addTask(args.jobId, args.taskData)
    case 'jobs:updateTask':
      return jobService.updateTask(args.taskId, args.taskData)
    case 'jobs:deleteTask':
      return jobService.deleteTask(args)
    case 'jobs:addPart':
      return jobService.addPart(args.jobId, { ...args.partData, userId: caller?.id })
    case 'jobs:removePart':
      return jobService.removePart(args)

    // Inventory
    case 'inventory:list':
      return inventoryService.list(args || {})
    case 'inventory:get':
      return inventoryService.get(args)
    case 'inventory:createItem':
      return inventoryService.createItem(args)
    case 'inventory:updateItem':
      return inventoryService.updateItem(args.id, args.data)
    case 'inventory:receiveBatch':
      return inventoryService.receiveBatch(args)
    case 'inventory:getSummary':
      return inventoryService.getSummary()
    case 'inventory:getSuppliers':
      return inventoryService.getSuppliers()
    case 'inventory:createSupplier':
      return inventoryService.createSupplier(args)

    // Invoices
    case 'invoices:list':
      return invoiceService.list(args || {})
    case 'invoices:get':
      return invoiceService.get(args)
    case 'invoices:getByJob':
      return invoiceService.getByJob(args)
    case 'invoices:generateFromJob':
      return invoiceService.generateFromJob(args.jobId, { ...args.options, userId: caller?.id })
    case 'invoices:cancel':
      return invoiceService.cancel(args)

    // Payments
    case 'payments:record':
      return paymentService.record({ ...args, userId: caller?.id })
    case 'payments:listByInvoice':
      return paymentService.listByInvoice(args)

    // Expenses
    case 'expenses:list':
      return expenseService.list(args || {})
    case 'expenses:create':
      return expenseService.create({ ...args, userId: caller?.id })
    case 'expenses:remove':
      return expenseService.remove(args)
    case 'expenses:getCategories':
      return expenseService.getCategories()

    // Reports
    case 'reports:dailySummary':
      return reportService.getDailySummary(args)
    case 'reports:jobCards':
      return reportService.getJobCardsReport(args || {})
    case 'reports:sales':
      return reportService.getSalesReport(args || {})
    case 'reports:inventory':
      return reportService.getInventoryValuationReport()
    case 'reports:mechanicPerformance':
      return reportService.getMechanicPerformanceReport(args || {})

    // Backup
    case 'backup:create':
      return backupService.createBackup()
    case 'backup:list':
      return backupService.listBackups()
    case 'backup:restore':
      return backupService.restoreBackup(args)
    case 'backup:openFolder':
      return { success: true }
    case 'backup:selectFile':
      return null

    // Settings
    case 'settings:getAll':
      return settingsService.getAll()
    case 'settings:get':
      return settingsService.get(args)
    case 'settings:update':
      return settingsService.set(args.key, args.value)
    case 'settings:updateMultiple':
      return settingsService.setMultiple(args)
    case 'settings:getAuditLogs':
      return settingsService.getAuditLogs(args || {})

    default:
      throw new Error(`Unknown IPC channel: ${channel}`)
  }
}

module.exports = { handleIpc }
