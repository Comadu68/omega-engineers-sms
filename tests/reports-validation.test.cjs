const path = require('path')
const fs = require('fs')
const os = require('os')
const assert = require('assert')

const testDataDir = path.join(os.tmpdir(), `omega_rep_test_${Date.now()}_${Math.floor(Math.random() * 10000)}`)
fs.mkdirSync(testDataDir, { recursive: true })
const testDbPath = path.join(testDataDir, 'test_reports.db')

const dbHelper = require('../src/database/db.cjs')
dbHelper.initDb(testDbPath)

const authService = require('../src/main/services/authService.cjs')
const customerService = require('../src/main/services/customerService.cjs')
const vehicleService = require('../src/main/services/vehicleService.cjs')
const mechanicService = require('../src/main/services/mechanicService.cjs')
const inventoryService = require('../src/main/services/inventoryService.cjs')
const jobService = require('../src/main/services/jobService.cjs')
const invoiceService = require('../src/main/services/invoiceService.cjs')
const reportService = require('../src/main/services/reportService.cjs')

async function runReportsTests() {
  console.log('======================================================================')
  console.log('--- STARTING BUSINESS REPORTS & DATE FILTER VALIDATION TESTS (SCRUM-23, 30) ---')
  console.log('======================================================================')

  try {
    const admin = authService.setupAdmin({
      username: 'rep_admin',
      password: 'Password123',
      displayName: 'Report Admin'
    })

    const customer = customerService.create({
      fullName: 'Nimal Perera',
      phone: '071 234 5678'
    })

    const vehicle = vehicleService.create({
      customerId: customer.id,
      registrationNo: 'WP CAA-1111',
      make: 'Toyota',
      model: 'Axio',
      year: 2019
    })

    const mech1 = mechanicService.create({ name: 'Sunil Mechanic', specialty: 'Engine' })
    const mech2 = mechanicService.create({ name: 'Kasun Mechanic', specialty: 'Brakes' })

    const part = inventoryService.createItem({
      sku: 'REP-PART-01',
      name: 'Oil Filter',
      category: 'Filters (Oil, Air, Fuel)',
      currentSellingPrice: 3000,
      initialBatch: { qty: 10, unitCost: 2000 }
    })

    const job = jobService.create({
      customerId: customer.id,
      vehicleId: vehicle.id,
      complaint: 'Full Service',
      userId: admin.id
    })

    // Assign mech1, then reassign to mech2 (unassigning mech1)
    jobService.assignMechanic(job.id, mech1.id, admin.id)
    jobService.assignMechanic(job.id, mech2.id, admin.id)

    jobService.addTask(job.id, { description: 'Labour Service', serviceCharge: 5000 })
    jobService.addPart(job.id, { inventoryItemId: part.id, qty: 1, userId: admin.id })
    jobService.updateStatus(job.id, 'completed')

    // Subtotal = 5000 + 3000 = 8000, Discount = 1000 -> Total = 7000
    const invoice = invoiceService.generateFromJob(job.id, { discount: 1000, userId: admin.id })
    assert.strictEqual(invoice.total, 7000)

    const todayStr = new Date().toISOString().slice(0, 10)

    // 1. Daily Summary Discount & Net Revenue Verification (Bug BH-04)
    const daily = reportService.dailySummary(todayStr)
    assert.strictEqual(daily.serviceRevenue, 5000)
    assert.strictEqual(daily.partsRevenue, 3000)
    assert.strictEqual(daily.totalRevenue, 8000, 'Daily totalRevenue is gross service + parts revenue')
    assert.strictEqual(daily.totalDiscount, 1000, 'Daily totalDiscount tracks invoice discounts')
    assert.strictEqual(daily.netBilledRevenue, 7000, 'Daily netBilledRevenue subtracts invoice discount')
    assert.strictEqual(daily.partsCogs, 2000)
    assert.strictEqual(daily.grossProfit, 6000, 'Gross profit must be 8000 - 2000 = 6000')

    // 2. Single-bounded Date Filters in salesReport & mechanicPerformanceReport (Bug BH-02)
    const futureSales = reportService.salesReport({ dateFrom: '2099-01-01' })
    assert.strictEqual(futureSales.invoiceCount, 0, 'Single-bounded dateFrom in the future must filter out today invoices')

    const pastSales = reportService.salesReport({ dateTo: '2000-01-01' })
    assert.strictEqual(pastSales.invoiceCount, 0, 'Single-bounded dateTo in the past must filter out today invoices')

    const validSingleFrom = reportService.salesReport({ dateFrom: todayStr })
    assert.strictEqual(validSingleFrom.invoiceCount, 1, 'Single-bounded dateFrom = today must return today invoice')

    // Reject inverted date range (dateFrom > dateTo)
    assert.throws(
      () => reportService.salesReport({ dateFrom: '2026-12-31', dateTo: '2026-01-01' }),
      /Start date \(From\) cannot be later than End date \(To\)/i
    )

    // 3. Mechanic Performance Unassigned Exclusion Verification (Bug BH-03)
    const mechPerf = reportService.mechanicPerformanceReport({ dateFrom: todayStr })
    const m1Row = mechPerf.find((m) => m.id === mech1.id)
    const m2Row = mechPerf.find((m) => m.id === mech2.id)

    assert.strictEqual(m1Row.completedJobs, 0, 'Unassigned mechanic (mech1) must NOT be credited with completed job')
    assert.strictEqual(m1Row.totalRevenueHandled, 0, 'Unassigned mechanic (mech1) must have 0 revenue')
    assert.strictEqual(m2Row.completedJobs, 1, 'Active assigned mechanic (mech2) must be credited with 1 completed job')
    assert.strictEqual(m2Row.totalRevenueHandled, 7000, 'Active assigned mechanic (mech2) must be credited with 7000 revenue')

    console.log('✓ All Business Reports & Date Range Filter tests passed!')
  } finally {
    dbHelper.closeDb()
    fs.rmSync(testDataDir, { recursive: true, force: true })
  }
}

runReportsTests().catch((err) => {
  console.error('\n❌ REPORTS TEST SUITE FAILED:', err)
  process.exit(1)
})
