const path = require('path')
const fs = require('fs')
const crypto = require('crypto')

const hashPassword = (password) => {
  const salt = crypto.randomBytes(16).toString('hex')
  const derivedKey = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex')
  return `${salt}:${derivedKey}`
}

function seedDatabase(targetDbPath) {
  console.log(`\n========================================`)
  console.log(`Targeting Database: ${targetDbPath}`)
  console.log(`========================================`)

  const dbDir = path.dirname(targetDbPath)
  fs.mkdirSync(dbDir, { recursive: true })

  // Clean or initialize dbHelper with target path
  const dbHelper = require('../src/database/db.cjs')
  dbHelper.closeDb()
  dbHelper.initDb(targetDbPath)

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

  const today = new Date().toISOString().slice(0, 10)
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10)
  const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10)

  // 1. Clear existing operational records cleanly to allow fresh idempotent seeding
  console.log('1. Preparing tables...')
  dbHelper.runSql('PRAGMA foreign_keys = OFF;')
  const tablesToClear = [
    'payments', 'invoice_items', 'invoices',
    'job_parts', 'job_tasks', 'job_assignments', 'job_cards',
    'appointments', 'inventory_batches', 'inventory_items', 'suppliers',
    'mechanics', 'vehicles', 'customers', 'expenses', 'audit_log', 'users'
  ]
  for (const t of tablesToClear) {
    dbHelper.runSql(`DELETE FROM ${t}`)
    try {
      dbHelper.runSql(`DELETE FROM sqlite_sequence WHERE name = '${t}'`)
    } catch (_) {}
  }
  dbHelper.runSql('PRAGMA foreign_keys = ON;')

  // 2. Seed Users
  console.log('2. Seeding Users...')
  const adminHash = hashPassword('admin123')
  const adminRes = dbHelper.runSql(
    `INSERT INTO users (username, password_hash, display_name, role, is_active)
     VALUES (?, ?, ?, 'admin_owner', 1)`,
    ['admin', adminHash, 'Gamini Senanayake (Owner)']
  )
  const adminId = Number(adminRes.lastInsertRowid)

  const adminCaller = { id: adminId, callerUserId: adminId, role: 'admin_owner', isActive: 1 }

  const receptionUser = authService.createUser({
    username: 'reception',
    password: 'reception123',
    displayName: 'Nimali Perera (Reception)',
    role: 'receptionist_service_advisor'
  }, adminCaller)

  const mechanicUser = authService.createUser({
    username: 'mechanic_kasun',
    password: 'mechanic123',
    displayName: 'Kasun Silva (Lead Mechanic)',
    role: 'mechanic'
  }, adminCaller)

  const billingUser = authService.createUser({
    username: 'billing_staff',
    password: 'billing123',
    displayName: 'Dinuka Fernando (Inventory & Billing)',
    role: 'inventory_billing'
  }, adminCaller)

  // 3. Seed Mechanics
  console.log('3. Seeding Mechanics...')
  const mech1 = mechanicService.create({
    name: 'Kasun Silva',
    phone: '071 223 3445',
    specialty: 'Engine & Transmission Specialist',
    availabilityStatus: 'busy',
    userId: mechanicUser.id
  })

  const mech2 = mechanicService.create({
    name: 'Nuwan Bandara',
    phone: '077 334 4556',
    specialty: 'Auto Electrical & EFI Diagnostics',
    availabilityStatus: 'available'
  })

  const mech3 = mechanicService.create({
    name: 'Chaminda Jayasuriya',
    phone: '075 445 5667',
    specialty: 'Suspension, Brakes & Wheel Alignment',
    availabilityStatus: 'available'
  })

  const mech4 = mechanicService.create({
    name: 'Ruwan Kumara',
    phone: '078 556 6778',
    specialty: 'Lubrication & Express Periodic Service',
    availabilityStatus: 'off_duty'
  })

  // 4. Seed Suppliers
  console.log('4. Seeding Suppliers...')
  const sup1 = inventoryService.createSupplier({
    name: 'Toyota Lanka Spares (Pvt) Ltd',
    phone: '011 245 6789',
    address: 'Wattala, Colombo',
    notes: 'Official Toyota genuine spare parts supplier'
  })

  const sup2 = inventoryService.createSupplier({
    name: 'Castrol Lubricants Sri Lanka',
    phone: '011 456 7890',
    address: 'Orabipasha Mawatha, Colombo 10',
    notes: 'Engine oils, coolants, ATF fluids'
  })

  const sup3 = inventoryService.createSupplier({
    name: 'DSI Tyres & Auto Accessories',
    phone: '011 567 8901',
    address: 'Pannipitiya Road, Maharagama',
    notes: 'Batteries, tires, spark plugs and wipers'
  })

  // 5. Seed Inventory Items & Multi-Batch Stocks
  console.log('5. Seeding Inventory Catalog & FIFO Batches...')
  const itemOil0w20 = inventoryService.createItem({
    sku: 'OIL-SYN-0W20',
    name: 'Mobil 1 Advanced Fully Synthetic 0W-20 (4L)',
    category: 'Lubricants & Oils',
    defaultSupplierId: sup2.id,
    minimumStockLevel: 5,
    currentSellingPrice: 14500,
    notes: 'For modern Japanese hybrid engines'
  })
  inventoryService.receiveBatch({
    inventoryItemId: itemOil0w20.id,
    batchNo: 'BATCH-MOB-01',
    supplierId: sup2.id,
    supplierDocumentNo: 'INV-MOB-8801',
    receivedAt: yesterday,
    receivedQty: 15,
    unitCost: 11000
  })
  inventoryService.receiveBatch({
    inventoryItemId: itemOil0w20.id,
    batchNo: 'BATCH-MOB-02',
    supplierId: sup2.id,
    supplierDocumentNo: 'INV-MOB-8842',
    receivedAt: today,
    receivedQty: 10,
    unitCost: 11500
  })

  const itemOil10w40 = inventoryService.createItem({
    sku: 'OIL-SEMI-10W40',
    name: 'Castrol GTX Semi-Synthetic 10W-40 (4L)',
    category: 'Lubricants & Oils',
    defaultSupplierId: sup2.id,
    minimumStockLevel: 5,
    currentSellingPrice: 8800,
    notes: 'For general petrol and light commercial vehicles'
  })
  inventoryService.receiveBatch({
    inventoryItemId: itemOil10w40.id,
    batchNo: 'BATCH-CAS-01',
    supplierId: sup2.id,
    supplierDocumentNo: 'INV-CAS-4421',
    receivedAt: yesterday,
    receivedQty: 20,
    unitCost: 6200
  })

  const itemToyFilter = inventoryService.createItem({
    sku: 'FIL-TOY-10004',
    name: 'Toyota Genuine Oil Filter (90915-YZZE1)',
    category: 'Filters',
    defaultSupplierId: sup1.id,
    minimumStockLevel: 8,
    currentSellingPrice: 2200,
    notes: 'OEM Toyota Spin-on filter'
  })
  inventoryService.receiveBatch({
    inventoryItemId: itemToyFilter.id,
    batchNo: 'BATCH-TOY-01',
    supplierId: sup1.id,
    supplierDocumentNo: 'INV-TL-1092',
    receivedAt: yesterday,
    receivedQty: 25,
    unitCost: 1400
  })

  // Low Stock item 1 for testing alerts!
  const itemAirFilter = inventoryService.createItem({
    sku: 'FIL-AIR-AXIO',
    name: 'Engine Air Filter - Axio / Premio 1.5L',
    category: 'Filters',
    defaultSupplierId: sup1.id,
    minimumStockLevel: 6,
    currentSellingPrice: 3500,
    notes: 'High demand, stock is currently running low!'
  })
  inventoryService.receiveBatch({
    inventoryItemId: itemAirFilter.id,
    batchNo: 'BATCH-AF-01',
    supplierId: sup1.id,
    supplierDocumentNo: 'INV-TL-1099',
    receivedAt: yesterday,
    receivedQty: 2,
    unitCost: 2100
  })

  const itemBrakePadFr = inventoryService.createItem({
    sku: 'BRK-PAD-FR-PREM',
    name: 'Ceramic Front Brake Pads Set - Toyota / Axio',
    category: 'Braking System',
    defaultSupplierId: sup1.id,
    minimumStockLevel: 4,
    currentSellingPrice: 12500,
    notes: 'Low-dust premium ceramic formulation'
  })
  inventoryService.receiveBatch({
    inventoryItemId: itemBrakePadFr.id,
    batchNo: 'BATCH-BP-01',
    supplierId: sup1.id,
    supplierDocumentNo: 'INV-TL-2041',
    receivedAt: yesterday,
    receivedQty: 10,
    unitCost: 8500
  })

  const itemSparkPlugs = inventoryService.createItem({
    sku: 'SPK-IRID-DENSO',
    name: 'Denso Iridium Long-Life Spark Plug (SC20HR11)',
    category: 'Ignition & Electrical',
    defaultSupplierId: sup3.id,
    minimumStockLevel: 10,
    currentSellingPrice: 3800,
    notes: 'Priced per spark plug'
  })
  inventoryService.receiveBatch({
    inventoryItemId: itemSparkPlugs.id,
    batchNo: 'BATCH-SPK-01',
    supplierId: sup3.id,
    supplierDocumentNo: 'INV-DSI-7731',
    receivedAt: yesterday,
    receivedQty: 30,
    unitCost: 2400
  })

  // Low stock item 2 for testing alerts!
  const itemBattery = inventoryService.createItem({
    sku: 'BAT-EXIDE-NS40',
    name: 'Exide Matrix Maintenance Free Battery 12V 35Ah',
    category: 'Batteries',
    defaultSupplierId: sup3.id,
    minimumStockLevel: 3,
    currentSellingPrice: 28500,
    notes: '36-month local warranty'
  })
  inventoryService.receiveBatch({
    inventoryItemId: itemBattery.id,
    batchNo: 'BATCH-BAT-01',
    supplierId: sup3.id,
    supplierDocumentNo: 'INV-DSI-8012',
    receivedAt: yesterday,
    receivedQty: 1,
    unitCost: 22000
  })

  const itemCoolant = inventoryService.createItem({
    sku: 'CLT-RED-1L',
    name: 'Toyota Super Long Life Pink/Red Coolant (1L)',
    category: 'Lubricants & Oils',
    defaultSupplierId: sup1.id,
    minimumStockLevel: 5,
    currentSellingPrice: 2600,
    notes: 'Premixed 50/50 anti-rust formula'
  })
  inventoryService.receiveBatch({
    inventoryItemId: itemCoolant.id,
    batchNo: 'BATCH-CLT-01',
    supplierId: sup1.id,
    supplierDocumentNo: 'INV-TL-3100',
    receivedAt: yesterday,
    receivedQty: 16,
    unitCost: 1750
  })

  const itemWipers = inventoryService.createItem({
    sku: 'WPR-BOSCH-24',
    name: 'Bosch Clear Advantage Frameless Wiper Blade 24"',
    category: 'Body & Accessories',
    defaultSupplierId: sup3.id,
    minimumStockLevel: 4,
    currentSellingPrice: 2400,
    notes: 'All-weather graphite coated'
  })
  inventoryService.receiveBatch({
    inventoryItemId: itemWipers.id,
    batchNo: 'BATCH-WPR-01',
    supplierId: sup3.id,
    supplierDocumentNo: 'INV-DSI-8099',
    receivedAt: yesterday,
    receivedQty: 12,
    unitCost: 1500
  })

  // 6. Seed Customers & Registered Vehicles
  console.log('6. Seeding Customers & Vehicles...')
  // Customer 1
  const cust1 = customerService.create({
    fullName: 'Dr. Kamal Dissanayake',
    phone: '078 456 7890',
    alternatePhone: '081 223 3445',
    email: 'dr.kamal@kandyhospital.lk',
    address: 'Doctors Quarters, General Hospital, Kandy',
    notes: 'VIP customer, prefers morning service slots'
  })
  const veh1 = vehicleService.create({
    customerId: cust1.id,
    registrationNo: 'SP KDH-3456',
    make: 'Toyota',
    model: 'HiAce KDH201',
    year: 2015,
    vehicleType: 'Van / MPV',
    engineNo: '1KD-8765432',
    chassis_no: 'KDH201-1049283',
    mileage: 135000,
    notes: 'Family touring van, diesel D-4D'
  })

  // Customer 2
  const cust2 = customerService.create({
    fullName: 'Anura Perera',
    phone: '077 123 4567',
    alternatePhone: '011 234 5678',
    email: 'anura.perera@gmail.com',
    address: '142 Lake Road, Kothmale',
    notes: 'Regular local customer'
  })
  const veh2 = vehicleService.create({
    customerId: cust2.id,
    registrationNo: 'WP CAB-1234',
    make: 'Toyota',
    model: 'Corolla Axio WxB',
    year: 2018,
    vehicleType: 'Sedan',
    engineNo: '1NZ-4910283',
    chassis_no: 'NKE165-7019284',
    mileage: 46200,
    notes: 'Hybrid sedan, metallic pearl white'
  })

  // Customer 3
  const cust3 = customerService.create({
    fullName: 'Malini Jayawardena',
    phone: '071 234 5678',
    alternatePhone: '081 445 5667',
    email: 'malini.j@sltnet.lk',
    address: '28 Nuwara Eliya Road, Gampola',
    notes: 'Requested dual clutch and hybrid health checks'
  })
  const veh3 = vehicleService.create({
    customerId: cust3.id,
    registrationNo: 'CP CAR-5678',
    make: 'Honda',
    model: 'Vezel Z Orange Edition',
    year: 2017,
    vehicleType: 'SUV',
    engineNo: 'LEB-2940192',
    chassis_no: 'RU3-1209384',
    mileage: 68500,
    notes: 'Sport Hybrid i-DCD'
  })

  // Customer 4
  const cust4 = customerService.create({
    fullName: 'Sahan Wickramasinghe',
    phone: '076 345 6789',
    email: 'sahan.wick@outlook.com',
    address: '55 Hill Street, Nawalapitiya',
    notes: 'EV owner, needs suspension check'
  })
  const veh4 = vehicleService.create({
    customerId: cust4.id,
    registrationNo: 'WP WP-9012',
    make: 'Nissan',
    model: 'Leaf Acenta 30kWh',
    year: 2016,
    vehicleType: 'Electric',
    mileage: 52100,
    notes: 'Full electric vehicle'
  })

  // Customer 5
  const cust5 = customerService.create({
    fullName: 'Priyantha Bandara',
    phone: '070 567 8901',
    address: 'Niyamgamdora Farm, Kothmale',
    notes: 'Agricultural produce delivery vehicle'
  })
  const veh5 = vehicleService.create({
    customerId: cust5.id,
    registrationNo: 'CP D-7890',
    make: 'Mitsubishi',
    model: 'L200 Triton 4x4 Double Cab',
    year: 2019,
    vehicleType: 'Truck',
    mileage: 84200,
    notes: 'Heavy duty 4WD pickup'
  })

  // 7. Seed Appointments
  console.log('7. Seeding Appointments...')
  const appt1 = appointmentService.create({
    customerId: cust1.id,
    vehicleId: veh1.id,
    serviceReason: '135k Periodic Full Lubrication & Transmission Oil Flush',
    appointmentDate: today,
    startTime: '08:30 AM',
    notes: 'Customer arrived on time, vehicle admitted to Bay 1',
    userId: receptionUser.id
  })

  const appt2 = appointmentService.create({
    customerId: cust4.id,
    vehicleId: veh4.id,
    serviceReason: 'Suspension creaking noise inspection & wheel alignment',
    appointmentDate: today,
    startTime: '11:30 AM',
    notes: 'Customer scheduled for midday slot',
    userId: receptionUser.id
  })

  const appt3 = appointmentService.create({
    customerId: cust3.id,
    vehicleId: veh3.id,
    serviceReason: 'Brake shudder diagnosis & Dual Clutch Transmission check',
    appointmentDate: today,
    startTime: '02:00 PM',
    notes: 'Afternoon booking',
    userId: receptionUser.id
  })

  const appt4 = appointmentService.create({
    customerId: cust5.id,
    vehicleId: veh5.id,
    serviceReason: '4x4 Differential oil change & AC cabin filter check',
    appointmentDate: tomorrow,
    startTime: '10:00 AM',
    notes: 'Advance booking for tomorrow morning',
    userId: receptionUser.id
  })

  // 8. Seed Job Cards, Tasks, Parts Consumption & Invoices
  console.log('8. Seeding Job Cards, FIFO Parts & Invoices...')

  // --- JOB CARD 1: Fully Completed, Invoiced & Paid in Full ---
  const job1 = jobService.create({
    customerId: cust1.id,
    vehicleId: veh1.id,
    appointmentId: appt1.id,
    complaint: '135k Routine Service, Engine Oil & Transmission Fluid Replacement',
    serviceDetails: 'Replaced engine oil and filter. Flushed transmission fluid. Performed 25-point safety inspection.',
    odometer: 135000,
    mechanicId: mech1.id,
    tasks: [
      { description: 'Engine Oil Drain & Filter Replacement Labour', serviceCharge: 2500, note: 'Completed' },
      { description: 'Automatic Transmission Fluid Flush & Labor', serviceCharge: 3500, note: 'Completed' },
      { description: 'Complete 25-Point Safety & Undercarriage Inspection', serviceCharge: 1500, note: 'Completed' }
    ],
    userId: adminId
  })

  // Consume parts for Job 1
  jobService.addPart(job1.id, {
    inventoryItemId: itemOil0w20.id,
    qty: 2,
    sellingPriceOverride: 14500,
    userId: billingUser.id
  })
  jobService.addPart(job1.id, {
    inventoryItemId: itemToyFilter.id,
    qty: 1,
    sellingPriceOverride: 2200,
    userId: billingUser.id
  })

  // Mark tasks completed and complete job
  dbHelper.runSql("UPDATE job_tasks SET status = 'completed', completed_at = CURRENT_TIMESTAMP WHERE job_card_id = ?", [job1.id])
  jobService.updateStatus(job1.id, 'completed')

  // Generate Invoice for Job 1
  const inv1 = invoiceService.generateFromJob(job1.id, {
    discount: 1200,
    userId: billingUser.id
  })

  // Record Full Payment via Card
  paymentService.record({
    invoiceId: inv1.id,
    amount: inv1.total,
    paymentMethod: 'Credit / Debit Card',
    referenceNo: 'POS-TXN-9021',
    notes: 'Settled in full via Commercial Bank Visa',
    userId: billingUser.id
  })

  // --- JOB CARD 2: Completed, Invoiced & Partially Paid (Installment Testing) ---
  const job2 = jobService.create({
    customerId: cust2.id,
    vehicleId: veh2.id,
    complaint: 'Front brake grinding noise & pedal vibration when stopping from high speed',
    serviceDetails: 'Inspected brake system. Front brake pads worn to 2mm metal indicator. Replaced with ceramic pads and skimmed both front rotors.',
    odometer: 46200,
    mechanicId: mech3.id,
    tasks: [
      { description: 'Front Ceramic Brake Pads Installation & Caliper Service', serviceCharge: 3000, note: 'Completed' },
      { description: 'Front Brake Disc Rotor Skimming on Lathe (Pair)', serviceCharge: 2500, note: 'Completed' }
    ],
    userId: adminId
  })

  // Consume parts for Job 2
  jobService.addPart(job2.id, {
    inventoryItemId: itemBrakePadFr.id,
    qty: 1,
    sellingPriceOverride: 12500,
    userId: billingUser.id
  })

  dbHelper.runSql("UPDATE job_tasks SET status = 'completed', completed_at = CURRENT_TIMESTAMP WHERE job_card_id = ?", [job2.id])
  jobService.updateStatus(job2.id, 'completed')

  // Generate Invoice for Job 2
  const inv2 = invoiceService.generateFromJob(job2.id, {
    discount: 0,
    userId: billingUser.id
  })

  // Record Partial Payment of LKR 10,000 in Cash (leaves balance LKR 8,000)
  paymentService.record({
    invoiceId: inv2.id,
    amount: 10000,
    paymentMethod: 'Cash',
    notes: 'First installment paid in cash. Remaining balance to be paid on Friday.',
    userId: billingUser.id
  })

  // --- JOB CARD 3: Active "In Progress" Job (Currently on Bay) ---
  const job3 = jobService.create({
    customerId: cust3.id,
    vehicleId: veh3.id,
    appointmentId: appt3.id,
    complaint: 'Engine stuttering at low RPM, check hybrid battery condition and clean throttle body',
    serviceDetails: 'Diagnostic scanner connected. Trouble code P0300 detected (cylinder misfire). Replacing spark plugs and cleaning intake.',
    odometer: 68500,
    mechanicId: mech1.id,
    tasks: [
      { description: 'Computerized Hybrid Diagnostics & Live Parameter Readout', serviceCharge: 2500, note: 'Scanned OK' },
      { description: 'Throttle Body & MAF Sensor Precision Cleaning', serviceCharge: 2000, note: 'In progress' },
      { description: 'Denso Iridium Spark Plugs Replacement (Set of 4)', serviceCharge: 1500, note: 'Pending' }
    ],
    userId: receptionUser.id
  })

  // Mark task 1 completed
  const tRows = dbHelper.queryAll('SELECT id FROM job_tasks WHERE job_card_id = ? ORDER BY id ASC', [job3.id])
  if (tRows.length > 0) {
    dbHelper.runSql("UPDATE job_tasks SET status = 'completed', completed_at = CURRENT_TIMESTAMP WHERE id = ?", [tRows[0].id])
    if (tRows.length > 1) {
      dbHelper.runSql("UPDATE job_tasks SET status = 'in_progress' WHERE id = ?", [tRows[1].id])
    }
  }

  // Issue 4 spark plugs to this job
  jobService.addPart(job3.id, {
    inventoryItemId: itemSparkPlugs.id,
    qty: 4,
    sellingPriceOverride: 3800,
    userId: billingUser.id
  })

  jobService.updateStatus(job3.id, 'in_progress')

  // --- JOB CARD 4: "Pending" Job (Awaiting Bay Allocation) ---
  const job4 = jobService.create({
    customerId: cust5.id,
    vehicleId: veh5.id,
    complaint: 'Hard cold start and high fuel consumption under farm trailer load',
    serviceDetails: 'Check common rail diesel injector leak-back rates and fuel filter.',
    odometer: 84200,
    mechanicId: mech2.id,
    tasks: [
      { description: 'Diesel Injection System & Fuel Pressure Testing', serviceCharge: 3500, note: 'Awaiting bay' }
    ],
    userId: receptionUser.id
  })
  // Keep job4 as pending

  // 9. Seed Operating Expenses
  console.log('9. Seeding Daily Operating Expenses...')
  expenseService.create({
    expenseDate: today,
    category: 'Workshop Consumables',
    description: 'Brake cleaners, degreaser spray, workshop rags, latex gloves',
    amount: 3500,
    referenceNo: 'REC-EXP-0112',
    userId: adminId
  })

  expenseService.create({
    expenseDate: today,
    category: 'Utilities (Electricity, Water)',
    description: 'CEB Electricity Bill Payment - Service Station Bay Compressors',
    amount: 8250,
    referenceNo: 'CEB-BILL-99042',
    userId: adminId
  })

  expenseService.create({
    expenseDate: yesterday,
    category: 'Equipment Maintenance',
    description: 'Hydraulic lift oil top-up and air line pneumatic fitting replacements',
    amount: 4600,
    referenceNo: 'LIFT-MNT-44',
    userId: adminId
  })

  console.log(`✓ Database seeding completed successfully for ${targetDbPath}!`)
}

// Target both the Electron AppData db and local project db
const appDataDb = path.join(process.env.APPDATA, 'omega-engineers-service-station', 'data', 'omega_service_station.db')
const localDb = path.join(__dirname, '..', '.local_data', 'data', 'omega_service_station.db')

try {
  seedDatabase(appDataDb)
} catch (err) {
  console.error(`Error seeding appData db:`, err)
}

try {
  seedDatabase(localDb)
} catch (err) {
  console.error(`Error seeding local db:`, err)
}

console.log('\n========================================')
console.log('ALL DATABASES SEEDED WITH COMPLETE DATA!')
console.log('========================================')
