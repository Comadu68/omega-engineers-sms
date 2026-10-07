const path = require('path')
const fs = require('fs')
const os = require('os')
const assert = require('assert')

// Setup isolated temporary test database
const testDataDir = path.join(os.tmpdir(), `omega_test_${Date.now()}`)
fs.mkdirSync(testDataDir, { recursive: true })
const testDbPath = path.join(testDataDir, 'test_omega.db')

const dbHelper = require('../src/database/db.cjs')
dbHelper.initDb(testDbPath)

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
const backupService = require('../src/main/services/backupService.cjs')
const settingsService = require('../src/main/services/settingsService.cjs')

async function runTests() {
  console.log('--- Starting Integration & Calculation Tests ---')

  // 1. First Run & Admin Setup
  console.log('Test 1: First Run Setup & Admin Authentication')
  assert.strictEqual(authService.isFirstRun(), true, 'isFirstRun should be true on empty database')

  const admin = authService.setupAdmin({
    username: 'admin',
    password: 'securePassword123',
    displayName: 'Station Manager'
  })
  assert.strictEqual(admin.username, 'admin')
  assert.strictEqual(admin.role, 'admin_owner')
  assert.strictEqual(authService.isFirstRun(), false, 'isFirstRun should be false after admin setup')

  const loginUser = authService.login({ username: 'admin', password: 'securePassword123' })
  assert.strictEqual(loginUser.displayName, 'Station Manager')
  console.log('✓ First Run & Auth Passed')

  // 2. Customer & Vehicle Creation
  console.log('Test 2: Customers & Vehicles')
  const customer = customerService.create({
    fullName: 'Anura Perera',
    phone: '077 123 4567',
    alternatePhone: '011 234 5678',
    email: 'anura@example.com',
    address: '123 Galle Road, Colombo'
  })
  assert.strictEqual(customer.fullName, 'Anura Perera')

  const vehicle = vehicleService.create({
    customerId: customer.id,
    registrationNo: 'WP CAB-1234',
    make: 'Toyota',
    model: 'Axio',
    year: 2018,
    vehicleType: 'Sedan',
    mileage: 45000
  })
  assert.strictEqual(vehicle.registrationNo, 'WP CAB-1234')
  console.log('✓ Customer & Vehicle Creation Passed')

  // 3. Mechanic Management
  console.log('Test 3: Mechanic Creation & Workload')
  const mechanic = mechanicService.create({
    name: 'S. Kumara',
    phone: '071 987 6543',
    specialty: 'Engine & Transmission',
    availabilityStatus: 'available'
  })
  assert.strictEqual(mechanic.name, 'S. Kumara')
  console.log('✓ Mechanic Creation Passed')

  // 4. Appointments & Slot Collision Prevention
  console.log('Test 4: Appointments & Capacity Collision Checks')
  const testDate = '2026-08-30'
  const testSlot = '09:30 AM'

  const appt1 = appointmentService.create({
    customerId: customer.id,
    vehicleId: vehicle.id,
    serviceReason: 'Full Lubrication & Oil Change',
    appointmentDate: testDate,
    startTime: testSlot,
    userId: admin.id
  })
  assert.strictEqual(appt1.status, 'scheduled')

  // Attempt duplicate booking for same date + time slot -> MUST FAIL
  let duplicateRejected = false
  try {
    appointmentService.create({
      customerId: customer.id,
      vehicleId: vehicle.id,
      serviceReason: 'Brake Inspection',
      appointmentDate: testDate,
      startTime: testSlot,
      userId: admin.id
    })
  } catch (err) {
    duplicateRejected = true
  }
  assert.strictEqual(duplicateRejected, true, 'Duplicate slot booking should be blocked')

  // Cancel appointment -> slot freed
  appointmentService.updateStatus(appt1.id, 'cancelled')
  const checkAfterCancel = appointmentService.checkAvailability({ appointmentDate: testDate, startTime: testSlot })
  assert.strictEqual(checkAfterCancel.available, true, 'Slot should be available after cancellation')

  // Re-book slot
  const appt2 = appointmentService.create({
    customerId: customer.id,
    vehicleId: vehicle.id,
    serviceReason: 'Full Maintenance',
    appointmentDate: testDate,
    startTime: testSlot,
    userId: admin.id
  })
  assert.strictEqual(appt2.status, 'scheduled')
  console.log('✓ Appointment Collision Prevention Passed')

  // 5. Multi-Batch Inventory & FIFO Deduction
  console.log('Test 5: Multi-Batch Receiving & FIFO Stock Consumption')
  const oilItem = inventoryService.createItem({
    sku: 'OIL-SYN-4L',
    name: 'Synthetic Engine Oil 4L',
    category: 'Lubricants & Oils',
    minimumStockLevel: 5,
    currentSellingPrice: 6500
  })

  // Receive Batch 1: 10 units @ 4,000 LKR (Received yesterday)
  const batch1 = inventoryService.receiveBatch({
    inventoryItemId: oilItem.id,
    batchNo: 'BATCH-OIL-01',
    receivedAt: '2026-08-25',
    receivedQty: 10,
    unitCost: 4000
  })

  // Receive Batch 2: 10 units @ 4,500 LKR (Received today with price increase)
  const batch2 = inventoryService.receiveBatch({
    inventoryItemId: oilItem.id,
    batchNo: 'BATCH-OIL-02',
    receivedAt: '2026-08-28',
    receivedQty: 10,
    unitCost: 4500
  })

  const itemAfterBatches = inventoryService.get(oilItem.id)
  assert.strictEqual(itemAfterBatches.totalStock, 20, 'Total stock should be 20')
  assert.strictEqual(itemAfterBatches.batches.length, 2, 'Should have 2 active batches')

  // 6. Job Card Creation, Tasks & FIFO Consumption
  console.log('Test 6: Job Card, Tasks, and FIFO Parts Consumption')
  const job = jobService.create({
    customerId: customer.id,
    vehicleId: vehicle.id,
    appointmentId: appt2.id,
    complaint: 'Engine oil service and brake inspection',
    mechanicId: mechanic.id,
    odometer: 45000,
    tasks: [
      { description: 'Engine Oil Drain & Filter Replacement Labour', serviceCharge: 2000 },
      { description: 'Brake Inspection & Cleaning Labour', serviceCharge: 1500 }
    ],
    userId: admin.id
  })

  assert.strictEqual(job.serviceRevenue, 3500, 'Service revenue should be 3500')

  // Consume 15 units of oil for this job (Exceeds Batch 1 remaining 10, takes 5 from Batch 2)
  jobService.addPart(job.id, {
    inventoryItemId: oilItem.id,
    qty: 15,
    sellingPriceOverride: 6500,
    userId: admin.id
  })

  const itemAfterDeduction = inventoryService.get(oilItem.id)
  assert.strictEqual(itemAfterDeduction.totalStock, 5, 'Remaining stock should be 5')

  // Verify batch details: Batch 1 should be 0, Batch 2 should be 5
  const b1 = itemAfterDeduction.batches.find((b) => b.batchNo === 'BATCH-OIL-01')
  const b2 = itemAfterDeduction.batches.find((b) => b.batchNo === 'BATCH-OIL-02')
  assert.strictEqual(b1.remainingQty, 0, 'Batch 1 remaining should be 0')
  assert.strictEqual(b2.remainingQty, 5, 'Batch 2 remaining should be 5')

  // Check job parts cost: 10 units @ 4000 + 5 units @ 4500 = 40,000 + 22,500 = 62,500 LKR
  const updatedJob = jobService.get(job.id)
  assert.strictEqual(updatedJob.partsCostTotal, 62500, 'FIFO parts cost should be 62,500')
  // Parts sales total: 15 * 6500 = 97,500 LKR
  assert.strictEqual(updatedJob.partsSalesTotal, 97500, 'Parts sales total should be 97,500')
  // Total bill: 3500 + 97500 = 101,000 LKR
  assert.strictEqual(updatedJob.totalBill, 101000, 'Total bill should be 101,000')
  console.log('✓ FIFO Multi-Batch Deduction & Job Costing Passed')

  // 7. Complete Job & Generate Invoice
  console.log('Test 7: Job Completion & Invoice Generation')
  jobService.updateStatus(job.id, 'completed')

  const invoice = invoiceService.generateFromJob(job.id, { discount: 1000, userId: admin.id })
  assert.strictEqual(invoice.subtotal, 101000)
  assert.strictEqual(invoice.discount, 1000)
  assert.strictEqual(invoice.total, 100000, 'Total invoice should be 100,000 after 1,000 discount')
  assert.strictEqual(invoice.paymentStatus, 'unpaid')
  assert.strictEqual(invoice.balance, 100000)
  assert.ok(invoice.sticker, 'Windshield reminder sticker data should be present')
  console.log('✓ Invoice Generation Passed')

  // 8. Partial & Full Payment Recording
  console.log('Test 8: Partial & Full Payments')
  // Record partial payment of 40,000 LKR
  const pay1 = paymentService.record({
    invoiceId: invoice.id,
    amount: 40000,
    paymentMethod: 'Cash',
    userId: admin.id
  })
  assert.strictEqual(pay1.paymentStatus, 'partially_paid')
  assert.strictEqual(pay1.balance, 60000)

  // Record final payment of 60,000 LKR
  const pay2 = paymentService.record({
    invoiceId: invoice.id,
    amount: 60000,
    paymentMethod: 'Credit / Debit Card',
    referenceNo: 'SLIP-9901',
    userId: admin.id
  })
  assert.strictEqual(pay2.paymentStatus, 'paid')
  assert.strictEqual(pay2.balance, 0)
  console.log('✓ Payment Tracking Passed')

  // 9. Operating Expenses Register
  console.log('Test 9: Operating Expense Register')
  const expenseDate = new Date().toISOString().slice(0, 10)
  const exp = expenseService.create({
    expenseDate,
    category: 'Workshop Consumables',
    description: 'Brake cleaners and shop rags',
    amount: 3500,
    referenceNo: 'RCP-001',
    userId: admin.id
  })
  assert.strictEqual(exp.amount, 3500)
  console.log('✓ Expense Register Passed')

  // 10. Daily Summary Financial Formulas
  console.log('Test 10: Daily Summary Financial Metrics Verification')
  const summary = reportService.dailySummary(expenseDate)

  // Expected values:
  // Service Revenue = 3,500 LKR
  // Parts Revenue = 97,500 LKR
  // Total Revenue = 101,000 LKR (or 100,000 after discount depending on line aggregation)
  // Parts COGS = 62,500 LKR
  // Gross Profit = Total Revenue - Parts COGS = 101,000 - 62,500 = 38,500 LKR
  // Operating Expenses = 3,500 LKR
  // Net Profit = Gross Profit - Operating Expenses = 38,500 - 3,500 = 35,000 LKR
  // Cash Collected = 40,000 + 60,000 = 100,000 LKR
  assert.strictEqual(summary.serviceRevenue, 3500, 'Service revenue should match')
  assert.strictEqual(summary.partsRevenue, 97500, 'Parts revenue should match')
  assert.strictEqual(summary.totalRevenue, 101000, 'Total revenue should match')
  assert.strictEqual(summary.partsCogs, 62500, 'Parts COGS should match')
  assert.strictEqual(summary.grossProfit, 38500, 'Gross profit should match')
  assert.strictEqual(summary.operatingExpenses, 3500, 'Operating expenses should match')
  assert.strictEqual(summary.netProfit, 35000, 'Net profit should match')
  assert.strictEqual(summary.cashCollected, 100000, 'Cash collected should match')
  console.log('✓ Daily Financial Summary Calculation Passed')

  // 11. Database Backup & Restore Integrity Check
  console.log('Test 11: Database Backup, Restore, and Integrity Check')
  const backupRes = backupService.createBackup()
  assert.strictEqual(backupRes.success, true)
  assert.ok(fs.existsSync(backupRes.backupPath), 'Backup file should exist on disk')

  const restoreRes = backupService.restoreBackup(backupRes.backupPath)
  assert.strictEqual(restoreRes.success, true)
  assert.strictEqual(restoreRes.integrityOk, true, 'SQLite integrity check must pass')
  console.log('✓ Backup & Restore Integrity Check Passed')

  console.log('====================================================')
  console.log('ALL INTEGRATION & BUSINESS CALCULATION TESTS PASSED!')
  console.log('====================================================')

  // Cleanup temporary test files
  try {
    dbHelper.closeDb()
    fs.rmSync(testDataDir, { recursive: true, force: true })
  } catch (_) {}
}

runTests().catch((err) => {
  console.error('TEST FAILED:', err)
  process.exit(1)
})
