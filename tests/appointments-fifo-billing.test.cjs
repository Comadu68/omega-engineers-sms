const path = require('path')
const fs = require('fs')
const os = require('os')
const assert = require('assert')

// Create isolated temporary test directory
const testRootDir = path.join(os.tmpdir(), `omega_ww_test_${Date.now()}_${process.pid}`)
const testDataDir = path.join(testRootDir, 'data')
fs.mkdirSync(testDataDir, { recursive: true })

const testDbPath = path.join(testDataDir, 'test_ww.db')
const dbHelper = require('../src/database/db.cjs')
dbHelper.initDb(testDbPath)

const authService = require('../src/main/services/authService.cjs')
const appointmentService = require('../src/main/services/appointmentService.cjs')
const customerService = require('../src/main/services/customerService.cjs')
const vehicleService = require('../src/main/services/vehicleService.cjs')
const jobService = require('../src/main/services/jobService.cjs')
const inventoryService = require('../src/main/services/inventoryService.cjs')
const invoiceService = require('../src/main/services/invoiceService.cjs')

async function runTests() {
  console.log('======================================================================')
  console.log('--- STARTING WW (PATHUM) VERIFICATION TEST SUITE ---')
  console.log('======================================================================\n')

  // Setup admin and staff users
  const admin = authService.setupAdmin({
    username: 'admin_pathum',
    password: 'AdminPassword123!',
    displayName: 'Pathum Owner'
  })

  authService.login({ username: 'admin_pathum', password: 'AdminPassword123!' })

  const receptionist = authService.createUser({
    username: 'rec_saman',
    password: 'RecPassword123!',
    displayName: 'Saman Receptionist',
    role: 'receptionist_service_advisor'
  }, { callerUserId: admin.id })

  const mechanic = authService.createUser({
    username: 'mech_kamal',
    password: 'MechPassword123!',
    displayName: 'Kamal Mechanic',
    role: 'mechanic'
  }, { callerUserId: admin.id })

  const billingUser = authService.createUser({
    username: 'bill_nimal',
    password: 'BillPassword123!',
    displayName: 'Nimal Billing',
    role: 'inventory_billing'
  }, { callerUserId: admin.id })

  // 1. Customer & Vehicle setup
  console.log('[Test 1] Setting up base Customer, Vehicle, and Inventory items...')
  const customer = customerService.create({
    fullName: 'Perera Motors',
    phone: '077 123 4567',
    email: 'perera@test.lk',
    address: '123 Galle Road, Colombo'
  })

  const vehicle = vehicleService.create({
    customerId: customer.id,
    registrationNo: 'CAB-9999',
    make: 'Toyota',
    model: 'Corolla 141',
    year: 2010,
    mileage: 125000
  })

  const item = inventoryService.createItem({
    sku: 'ENG-OIL-5W30',
    name: 'Castrol 5W-30 Full Synthetic 4L',
    category: 'lubricants',
    minimumStockLevel: 5,
    currentSellingPrice: 12500
  })

  const supplier = inventoryService.createSupplier({
    name: 'Castrol Lanka Pvt Ltd',
    phone: '011 234 5678'
  })

  const batch1 = inventoryService.receiveBatch({
    inventoryItemId: item.id,
    batchNo: 'B-101',
    supplierId: supplier.id,
    receivedQty: 10,
    unitCost: 8000
  })

  assert.strictEqual(batch1.remaining_qty, 10)
  console.log('✓ Base setup completed.\n')

  // 2. SCRUM-17 / Bug WW-04: Appointment past-date & same-vehicle duplicate checks
  console.log('[Test 2] SCRUM-17: Testing Appointment date and duplicate booking validations...')
  const todayStr = new Date().toISOString().split('T')[0]
  const tomorrow = new Date()
  tomorrow.setDate(tomorrow.getDate() + 1)
  const tomorrowStr = tomorrow.toISOString().split('T')[0]

  // A) Reject past dates
  let pastRejected = false
  try {
    appointmentService.create({
      customerId: customer.id,
      vehicleId: vehicle.id,
      serviceReason: 'Engine Oil Change',
      appointmentDate: '2020-01-01',
      startTime: '09:30 AM'
    })
  } catch (err) {
    pastRejected = err.message.includes('past')
  }
  assert.strictEqual(pastRejected, true, 'Past appointment date must be rejected.')

  // B) Create valid future appointment
  const appt1 = appointmentService.create({
    customerId: customer.id,
    vehicleId: vehicle.id,
    serviceReason: 'Full Lubrication',
    appointmentDate: tomorrowStr,
    startTime: '09:30 AM'
  })
  assert.strictEqual(appt1.status, 'scheduled')

  // C) Prevent duplicate booking for same vehicle in same slot
  let vehicleDuplicateBlocked = false
  try {
    appointmentService.create({
      customerId: customer.id,
      vehicleId: vehicle.id,
      serviceReason: 'Another reason',
      appointmentDate: tomorrowStr,
      startTime: '09:30 AM'
    })
  } catch (err) {
    vehicleDuplicateBlocked = err.message.includes('already has an active appointment')
  }
  assert.strictEqual(vehicleDuplicateBlocked, true, 'Same vehicle duplicate booking in same slot must be blocked.')

  // D) Feature WW-F2: no_show frees slot capacity
  appointmentService.updateStatus(appt1.id, 'no_show')
  const availAfterNoShow = appointmentService.checkAvailability({
    appointmentDate: tomorrowStr,
    startTime: '09:30 AM'
  })
  assert.strictEqual(availAfterNoShow.available, true, 'Marking no_show must free up slot capacity.')
  console.log('✓ SCRUM-17 appointment validation & no-show capacity freeing passed.\n')

  // 3. SCRUM-26 / Bug WW-05: Cancelling Job Card restores FIFO consumed parts
  console.log('[Test 3] SCRUM-26: Testing FIFO parts deduction and cancellation restoration...')
  const job = jobService.create({
    customerId: customer.id,
    vehicleId: vehicle.id,
    complaint: 'Periodic Full Service',
    odometer: 125100
  })

  // Add tasks and FIFO parts
  jobService.addTask(job.id, { description: 'Full Oil Filter & Lube Service', serviceCharge: 3500 })
  jobService.addPart(job.id, { inventoryItemId: item.id, qty: 3, userId: admin.id })

  // Verify stock was deducted
  const itemAfterDeduct = inventoryService.get(item.id)
  assert.strictEqual(itemAfterDeduct.totalStock, 7, 'Total stock should be reduced from 10 to 7')

  // Cancel the job card -> FIFO parts must be restored!
  jobService.updateStatus(job.id, 'cancelled', 'Customer requested reschedule')

  const itemAfterCancel = inventoryService.get(item.id)
  assert.strictEqual(itemAfterCancel.totalStock, 10, 'Cancelling job card must restore stock to 10')
  console.log('✓ SCRUM-26 stock restoration on cancellation passed.\n')

  // 4. SCRUM-26 & SCRUM-31 / Bug WW-06: Modifying completed/cancelled/invoiced job cards is blocked
  console.log('[Test 4] SCRUM-26 & SCRUM-31: Testing immutability guards on closed/invoiced job cards...')
  let addPartOnCancelledBlocked = false
  try {
    jobService.addPart(job.id, { inventoryItemId: item.id, qty: 1 })
  } catch (err) {
    addPartOnCancelledBlocked = err.message.includes('Cannot modify')
  }
  assert.strictEqual(addPartOnCancelledBlocked, true, 'Adding parts to cancelled job card must be blocked.')

  // Create new active job
  const job2 = jobService.create({
    customerId: customer.id,
    vehicleId: vehicle.id,
    complaint: 'Brake pad replacement and flush',
    odometer: 125200
  })
  jobService.addTask(job2.id, { description: 'Replace front brake pads', serviceCharge: 2500 })
  jobService.addPart(job2.id, { inventoryItemId: item.id, qty: 2 })

  // 5. SCRUM-31 / Bug WW-07 & Feature WW-F1: Invoicing validations and auto-completion
  console.log('[Test 5] SCRUM-31: Testing discount guards and auto-completion upon billing...')
  // Negative discount rejected
  let negDiscountBlocked = false
  try {
    invoiceService.generateFromJob(job2.id, { discount: -500 })
  } catch (err) {
    negDiscountBlocked = err.message.includes('Discount must be between')
  }
  assert.strictEqual(negDiscountBlocked, true, 'Negative discount must be rejected.')

  // Discount exceeding subtotal rejected
  let excessDiscountBlocked = false
  try {
    invoiceService.generateFromJob(job2.id, { discount: 999999 })
  } catch (err) {
    excessDiscountBlocked = err.message.includes('Discount must be between')
  }
  assert.strictEqual(excessDiscountBlocked, true, 'Discount greater than subtotal must be rejected.')

  // Generate valid invoice with reasonable discount
  const invoice = invoiceService.generateFromJob(job2.id, { discount: 500, userId: admin.id })
  assert.ok(invoice.id > 0)
  assert.strictEqual(invoice.paymentStatus, 'unpaid')

  // Verify job2 was auto-completed by invoice generation!
  const refreshedJob2 = jobService.get(job2.id)
  assert.strictEqual(refreshedJob2.status, 'completed', 'Generating invoice must automatically transition job to completed.')

  // Attempt to cancel job2 when active invoice exists -> MUST BE BLOCKED
  let cancelInvoicedJobBlocked = false
  try {
    jobService.updateStatus(job2.id, 'cancelled', 'Should fail')
  } catch (err) {
    cancelInvoicedJobBlocked = err.message.includes('active invoice')
  }
  assert.strictEqual(cancelInvoicedJobBlocked, true, 'Cancelling a job card with an active invoice must be blocked.')

  // Attempt to modify tasks on invoiced job card -> MUST BE BLOCKED
  let addTaskInvoicedBlocked = false
  try {
    jobService.addTask(job2.id, { description: 'Extra task', serviceCharge: 1000 })
  } catch (err) {
    addTaskInvoicedBlocked = err.message.includes('Cannot modify')
  }
  assert.strictEqual(addTaskInvoicedBlocked, true, 'Adding tasks to invoiced job card must be blocked.')
  console.log('✓ SCRUM-31 billing guards, auto-completion, and invoice immutability passed.\n')

  console.log('======================================================================')
  console.log('ALL WW (PATHUM) ACCEPTANCE TESTS PASSED WITH 100% SUCCESS!')
  console.log('======================================================================')
}

runTests().catch((err) => {
  console.error('\n❌ WW VERIFICATION TEST FAILED:', err)
  process.exit(1)
})
