const path = require('path')
const fs = require('fs')
const os = require('os')
const assert = require('assert')

// Setup isolated temporary test database
const testDataDir = path.join(os.tmpdir(), `omega_cust_val_${Date.now()}`)
fs.mkdirSync(testDataDir, { recursive: true })
const testDbPath = path.join(testDataDir, 'test_customer_validation.db')

const dbHelper = require('../src/database/db.cjs')
dbHelper.initDb(testDbPath)

const customerService = require('../src/main/services/customerService.cjs')
const vehicleService = require('../src/main/services/vehicleService.cjs')

async function runTests() {
  console.log('========================================================')
  console.log('Starting SCRUM-16 Customer Validation & Duplicate Tests')
  console.log('Isolated Database Path:', testDbPath)
  console.log('========================================================\n')

  // --------------------------------------------------------------------------
  // 1. Valid Sinhala/English names and supported local/+94/0094 phones work
  // --------------------------------------------------------------------------
  console.log('Test 1: Valid Sinhala/English names and supported local/+94/0094 phones work')

  const cust1 = customerService.create({
    fullName: 'Anura Perera',
    phone: '077 123 4567',
    alternatePhone: '011 234 5678',
    email: 'anura@example.com',
    address: '123 Galle Road, Colombo'
  })
  assert.strictEqual(cust1.fullName, 'Anura Perera')
  assert.strictEqual(cust1.phone, '0771234567', 'Local 10-digit phone should normalize to 0771234567')
  assert.strictEqual(cust1.alternatePhone, '0112345678', 'Alternate phone should normalize to 0112345678')

  // Sinhala name with +94 international mobile format
  const cust2 = customerService.create({
    fullName: 'කමල් පෙරේරා',
    phone: '+94 71 234 5678',
    address: 'නියම්ගම්දොර, කොත්මලේ'
  })
  assert.strictEqual(cust2.fullName, 'කමල් පෙරේරා')
  assert.strictEqual(cust2.phone, '0712345678', '+94 format should normalize to 0712345678')

  // Sinhala name with 0094 format
  const cust3 = customerService.create({
    fullName: 'ඩී. එම්. සුනිල් ශාන්ත',
    phone: '0094 76 345 6789'
  })
  assert.strictEqual(cust3.fullName, 'ඩී. එම්. සුනිල් ශාන්ත')
  assert.strictEqual(cust3.phone, '0763456789', '0094 format should normalize to 0763456789')

  // English compound name with 94 without plus
  const cust4 = customerService.create({
    fullName: "O'Connor Mary-Jane",
    phone: '94781234567'
  })
  assert.strictEqual(cust4.fullName, "O'Connor Mary-Jane")
  assert.strictEqual(cust4.phone, '0781234567')

  // Fixed line local Sri Lankan number (Kothmale/Nuwara Eliya 052)
  const cust5 = customerService.create({
    fullName: 'Kothmale Tea Estate Office',
    phone: '052-222-3456'
  })
  assert.strictEqual(cust5.phone, '0522223456')

  console.log('✓ Test 1 Passed: Valid Sinhala/English names and local/+94/0094 phones created successfully.\n')

  // --------------------------------------------------------------------------
  // 2. Empty/whitespace inputs and malformed phones are rejected with no write
  // --------------------------------------------------------------------------
  console.log('Test 2: Empty/whitespace inputs and malformed phones are rejected with no write')

  const initialCount = customerService.list().length

  // Missing or whitespace name
  assert.throws(() => {
    customerService.create({ fullName: '', phone: '077 999 0001' })
  }, /name is required/i)

  assert.throws(() => {
    customerService.create({ fullName: '     ', phone: '077 999 0001' })
  }, /name is required/i)

  // Name with digits or invalid symbols
  assert.throws(() => {
    customerService.create({ fullName: 'Perera 123', phone: '077 999 0001' })
  }, /Invalid customer name/i)

  assert.throws(() => {
    customerService.create({ fullName: '$$$John$$$', phone: '077 999 0001' })
  }, /Invalid customer name/i)

  // Missing or whitespace phone
  assert.throws(() => {
    customerService.create({ fullName: 'Kasun Bandara', phone: '' })
  }, /phone number is required/i)

  assert.throws(() => {
    customerService.create({ fullName: 'Kasun Bandara', phone: '   ' })
  }, /phone number is required/i)

  // Malformed phones (too short, too long, letters)
  assert.throws(() => {
    customerService.create({ fullName: 'Kasun Bandara', phone: '077123' })
  }, /Invalid primary phone number/i)

  assert.throws(() => {
    customerService.create({ fullName: 'Kasun Bandara', phone: '077123456789' })
  }, /Invalid primary phone number/i)

  assert.throws(() => {
    customerService.create({ fullName: 'Kasun Bandara', phone: '07712345A6' })
  }, /Invalid primary phone number/i)

  // Invalid email format
  assert.throws(() => {
    customerService.create({ fullName: 'Kasun Bandara', phone: '077 999 0001', email: 'not-an-email' })
  }, /Invalid email address/i)

  // Invalid alternate phone
  assert.throws(() => {
    customerService.create({ fullName: 'Kasun Bandara', phone: '077 999 0001', alternatePhone: 'invalid-alt' })
  }, /Invalid alternate phone/i)

  const countAfterRejections = customerService.list().length
  assert.strictEqual(countAfterRejections, initialCount, 'No records should have been written for rejected inputs')

  console.log('✓ Test 2 Passed: Malformed and whitespace inputs strictly rejected without database writes.\n')

  // --------------------------------------------------------------------------
  // 3. Local and international equivalents detect the same existing phone, including legacy formatting
  // --------------------------------------------------------------------------
  console.log('Test 3: Local and international equivalents detect the same existing phone, including legacy formatting')

  // Seed a legacy record with raw international formatting and spaces directly into DB
  dbHelper.runSql(
    `INSERT INTO customers (full_name, phone, address) VALUES (?, ?, ?)`,
    ['Legacy Garage Client', '+94 77 555 4433', 'Nawalapitiya Road']
  )

  // Check duplicate lookup using local 10-digit representation
  const matchLocal = customerService.findDuplicates('077 555 4433')
  assert.strictEqual(matchLocal.length, 1, 'Local 077 format should match legacy +94 record')
  assert.strictEqual(matchLocal[0].fullName, 'Legacy Garage Client')

  // Check duplicate lookup using 0094 international representation
  const match0094 = customerService.findDuplicates('0094775554433')
  assert.strictEqual(match0094.length, 1, '0094 format should match legacy +94 record')

  // Check duplicate lookup using hyphenated representation
  const matchHyphens = customerService.findDuplicates('077-555-4433')
  assert.strictEqual(matchHyphens.length, 1, 'Hyphenated format should match legacy +94 record')

  // Check duplicate lookup using plain digits
  const matchDigits = customerService.findDuplicates('0775554433')
  assert.strictEqual(matchDigits.length, 1, 'Plain digits should match legacy +94 record')

  console.log('✓ Test 3 Passed: Multi-format Sri Lankan phone matching detects existing legacy records.\n')

  // --------------------------------------------------------------------------
  // 4. A duplicate ordinary write is blocked pending confirmation; explicit confirmation permits separate record
  // --------------------------------------------------------------------------
  console.log('Test 4: Duplicate ordinary write blocked pending confirmation; explicit override allows shared phone')

  const beforeDupCount = customerService.list().length

  // Ordinary write attempt with same phone as cust1 ('0771234567')
  const ordinaryResult = customerService.create({
    fullName: 'Chaminda Perera',
    phone: '+94 77 123 4567'
  })

  // Must return structured duplicate warning and NOT insert
  assert.strictEqual(ordinaryResult.duplicateWarning, true, 'Ordinary write must return duplicateWarning: true')
  assert.strictEqual(ordinaryResult.isDuplicate, true)
  assert.ok(Array.isArray(ordinaryResult.duplicates), 'Must include matching duplicates array')
  assert.strictEqual(ordinaryResult.duplicates[0].fullName, 'Anura Perera')

  const afterBlockedCount = customerService.list().length
  assert.strictEqual(afterBlockedCount, beforeDupCount, 'Ordinary duplicate write must make NO change to DB')

  // Deliberate confirmation override for legitimate shared family / company phone
  const confirmedResult = customerService.create({
    fullName: 'Chaminda Perera',
    phone: '+94 77 123 4567',
    allowDuplicatePhone: true // Explicit override confirmation
  })

  assert.ok(confirmedResult.id, 'Should create new record with explicit override')
  assert.strictEqual(confirmedResult.fullName, 'Chaminda Perera')
  assert.strictEqual(confirmedResult.phone, '0771234567')

  const afterConfirmedCount = customerService.list().length
  assert.strictEqual(afterConfirmedCount, beforeDupCount + 1, 'Separate record created after confirmation')

  console.log('✓ Test 4 Passed: Duplicate blocked by default; deliberate confirmation allows separate shared-phone record.\n')

  // --------------------------------------------------------------------------
  // 5. Updating a record with its own number is allowed; changing to another customer's number triggers warning
  // --------------------------------------------------------------------------
  console.log("Test 5: Self-update allowed; changing to another customer's number triggers warning")

  // Update cust1 with the exact same number (different format +94) -> Allowed without warning
  const selfUpdate = customerService.update(cust1.id, {
    fullName: 'Anura Perera Senior',
    phone: '+94 77 123 4567'
  })
  assert.strictEqual(selfUpdate.fullName, 'Anura Perera Senior')
  assert.strictEqual(selfUpdate.phone, '0771234567', 'Self-update must succeed without false warning')

  // Update cust1 with phone only, keeping same number -> Allowed without warning
  const selfPhoneUpdate = customerService.update(cust1.id, {
    phone: '077 123 4567'
  })
  assert.strictEqual(selfPhoneUpdate.id, cust1.id)

  // Attempt to change cust1's phone to cust2's phone ('0712345678') without override
  const dupUpdateResult = customerService.update(cust1.id, {
    phone: '071 234 5678'
  })
  assert.strictEqual(dupUpdateResult.duplicateWarning, true, 'Updating to another customer phone must return duplicateWarning')
  assert.strictEqual(dupUpdateResult.duplicates[0].id, cust2.id)

  // Verify cust1 in DB still has original phone
  const cust1Db = customerService.get(cust1.id)
  assert.strictEqual(cust1Db.phone, '0771234567', "Cust1's phone must remain unchanged after blocked update")

  // Now update cust1 with explicit override confirmation
  const confirmedUpdate = customerService.update(cust1.id, {
    phone: '071 234 5678',
    allowDuplicatePhone: true
  })
  assert.strictEqual(confirmedUpdate.phone, '0712345678', 'Confirmed update with allowDuplicatePhone should succeed')

  console.log('✓ Test 5 Passed: Self-updates permitted; foreign phone updates trigger warning unless confirmed.\n')

  // --------------------------------------------------------------------------
  // 6. Invalid edits leave original record unchanged
  // --------------------------------------------------------------------------
  console.log('Test 6: Invalid edits leave original record unchanged')

  const beforeEditState = customerService.get(cust2.id)

  // Try invalid name edit
  assert.throws(() => {
    customerService.update(cust2.id, { fullName: '   ' })
  }, /name is required/i)

  // Try invalid phone edit
  assert.throws(() => {
    customerService.update(cust2.id, { phone: '123' })
  }, /Invalid primary phone number/i)

  // Try invalid email edit
  assert.throws(() => {
    customerService.update(cust2.id, { email: 'invalid-email-address' })
  }, /Invalid email address/i)

  // Verify cust2 record is 100% intact
  const afterEditState = customerService.get(cust2.id)
  assert.strictEqual(afterEditState.fullName, beforeEditState.fullName)
  assert.strictEqual(afterEditState.phone, beforeEditState.phone)
  assert.strictEqual(afterEditState.email, beforeEditState.email)

  console.log('✓ Test 6 Passed: Invalid updates leave database records untouched.\n')

  // --------------------------------------------------------------------------
  // 7. Existing customer/vehicle relationships and name/registration-number search still work
  // --------------------------------------------------------------------------
  console.log('Test 7: Customer/vehicle relationships and name/registration-number search still work')

  // Register vehicles to customers
  const veh1 = vehicleService.create({
    customerId: cust2.id,
    registrationNo: 'WP CAA-4567',
    make: 'Toyota',
    model: 'Hilux',
    year: 2018,
    vehicleType: 'Pickup / 4x4'
  })
  assert.strictEqual(veh1.registrationNo, 'WP CAA-4567')

  // Customer profile get includes linked vehicles
  const cust2WithVeh = customerService.get(cust2.id)
  assert.strictEqual(cust2WithVeh.vehicles.length, 1)
  assert.strictEqual(cust2WithVeh.vehicles[0].registrationNo, 'WP CAA-4567')

  // Search by Sinhala name
  const searchSinhala = customerService.list({ search: 'කමල්' })
  assert.ok(searchSinhala.some((c) => c.fullName === 'කමල් පෙරේරා'), 'Search by Sinhala name must find matching customer')

  // Search by vehicle registration number
  const searchReg = customerService.list({ search: 'CAA-4567' })
  assert.ok(searchReg.some((c) => c.id === cust2.id), 'Search by vehicle reg number must find customer')

  // Search by phone using international prefix
  const searchPhone = customerService.list({ search: '+94 76 345 6789' })
  assert.ok(searchPhone.some((c) => c.phone === '0763456789'), 'Search by +94 formatted phone must find 0763456789 customer')

  // Search by partial phone
  const searchPartial = customerService.list({ search: '076' })
  assert.ok(searchPartial.some((c) => c.phone === '0763456789'), 'Partial search must still work')

  console.log('✓ Test 7 Passed: Vehicle links and multi-criteria quick search functioning perfectly.\n')

  console.log('========================================================')
  console.log('ALL SCRUM-16 ACCEPTANCE TESTS PASSED SUCCESSFULLY!')
  console.log('========================================================')
}

runTests().catch((err) => {
  console.error('\n❌ Test Suite Failed:', err)
  process.exit(1)
})
