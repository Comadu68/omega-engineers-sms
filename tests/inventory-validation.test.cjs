const path = require('path')
const fs = require('fs')
const os = require('os')
const assert = require('assert')

// Create an isolated temporary directory for test DB
const testDataDir = path.join(os.tmpdir(), `omega_inv_test_${Date.now()}_${Math.floor(Math.random() * 10000)}`)
fs.mkdirSync(testDataDir, { recursive: true })
const testDbPath = path.join(testDataDir, 'test_inventory.db')

const dbHelper = require('../src/database/db.cjs')
dbHelper.initDb(testDbPath)

const inventoryService = require('../src/main/services/inventoryService.cjs')
const jobService = require('../src/main/services/jobService.cjs')
const authService = require('../src/main/services/authService.cjs')
const customerService = require('../src/main/services/customerService.cjs')
const vehicleService = require('../src/main/services/vehicleService.cjs')

async function runInventoryValidationTests() {
  console.log('======================================================================')
  console.log('--- STARTING INVENTORY VALIDATION & FIFO NEGATIVE/TRANSACTION TESTS ---')
  console.log('======================================================================')

  try {
    // -------------------------------------------------------------------------
    // Setup synthetic base fixtures: Admin User, Customer, Vehicle, Job Card
    // -------------------------------------------------------------------------
    console.log('\n[Setup] Creating synthetic base entities...')
    const admin = authService.setupAdmin({
      username: 'inv_tester',
      password: 'testPassword123',
      displayName: 'QA Inventory Tester'
    })

    const customer = customerService.create({
      fullName: 'Kamal Gunaratne',
      phone: '077 999 1122',
      email: 'kamal@test.com',
      address: '45 Temple Road, Nugegoda'
    })

    const vehicle = vehicleService.create({
      customerId: customer.id,
      registrationNo: 'WP CAD-5678',
      make: 'Honda',
      model: 'Civic',
      year: 2020,
      vehicleType: 'Sedan',
      mileage: 32000
    })

    const validJob = jobService.create({
      customerId: customer.id,
      vehicleId: vehicle.id,
      complaint: 'Regular lubrication service and brake inspection',
      userId: admin.id
    })

    assert.ok(validJob.id, 'Synthetic job card must be created')
    console.log(`✓ Synthetic setup ready (Job ID: ${validJob.id}, User ID: ${admin.id})`)

    // -------------------------------------------------------------------------
    // TEST 1: String Input Validation (Names, SKU, Categories & Omitted Defaults)
    // -------------------------------------------------------------------------
    console.log('\n[Test 1] String input validation: Whitespace-only values & sensible defaults')

    // Whitespace-only name must be rejected
    assert.throws(
      () => inventoryService.createItem({ name: '   ', sku: 'SKU-001' }),
      /Item name is required and cannot be empty or whitespace/i,
      'Whitespace-only item name should be rejected'
    )
    assert.throws(
      () => inventoryService.createItem({ name: '', sku: 'SKU-001' }),
      /Item name is required and cannot be empty or whitespace/i,
      'Empty item name should be rejected'
    )
    assert.throws(
      () => inventoryService.createItem({ sku: 'SKU-001' }),
      /Item name is required and cannot be empty or whitespace/i,
      'Omitted item name should be rejected'
    )

    // Whitespace-only SKU must be rejected when supplied
    assert.throws(
      () => inventoryService.createItem({ name: 'Valid Part', sku: '   ' }),
      /SKU \/ Part number cannot be whitespace-only/i,
      'Whitespace-only SKU must be rejected'
    )

    // Whitespace-only Category must be rejected when supplied
    assert.throws(
      () => inventoryService.createItem({ name: 'Valid Part', category: '   ' }),
      /Category cannot be empty or whitespace/i,
      'Whitespace-only category must be rejected'
    )

    // Sensible defaults preserved when omitted
    const defaultItem = inventoryService.createItem({ name: 'Standard Spark Plug' })
    assert.strictEqual(defaultItem.category, 'General Parts', 'Default category should be General Parts')
    assert.strictEqual(defaultItem.minimumStockLevel, 5, 'Default minimum stock level should be 5')
    assert.strictEqual(defaultItem.currentSellingPrice, 0, 'Default selling price should be 0')
    assert.ok(defaultItem.sku.startsWith('INV-'), 'Default SKU should be auto-generated')
    console.log('✓ String validation and omitted-field defaults passed')

    // -------------------------------------------------------------------------
    // TEST 2: Numeric Input Validation (NaN, Infinity, '12abc', Negatives, Decimals)
    // -------------------------------------------------------------------------
    console.log('\n[Test 2] Numeric input validation in createItem & updateItem')

    // Partial strings like '12abc', '10.5xyz'
    assert.throws(
      () => inventoryService.createItem({ name: 'Oil Filter', minimumStockLevel: '12abc' }),
      /Minimum stock level must be a valid finite number/i,
      'Partial string "12abc" in minimumStockLevel must be rejected'
    )
    assert.throws(
      () => inventoryService.createItem({ name: 'Oil Filter', currentSellingPrice: '999xyz' }),
      /Current selling price must be a valid finite number/i,
      'Partial string "999xyz" in currentSellingPrice must be rejected'
    )

    // NaN and Infinity
    assert.throws(
      () => inventoryService.createItem({ name: 'Oil Filter', minimumStockLevel: NaN }),
      /Minimum stock level must be a valid finite number/i,
      'NaN in minimumStockLevel must be rejected'
    )
    assert.throws(
      () => inventoryService.createItem({ name: 'Oil Filter', minimumStockLevel: Infinity }),
      /Minimum stock level must be a valid finite number/i,
      'Infinity in minimumStockLevel must be rejected'
    )
    assert.throws(
      () => inventoryService.createItem({ name: 'Oil Filter', currentSellingPrice: Infinity }),
      /Current selling price must be a valid finite number/i,
      'Infinity in currentSellingPrice must be rejected'
    )

    // Negative numbers
    assert.throws(
      () => inventoryService.createItem({ name: 'Oil Filter', minimumStockLevel: -5 }),
      /Minimum stock level cannot be negative/i,
      'Negative minimumStockLevel must be rejected'
    )
    assert.throws(
      () => inventoryService.createItem({ name: 'Oil Filter', currentSellingPrice: -150 }),
      /Current selling price cannot be negative/i,
      'Negative currentSellingPrice must be rejected'
    )

    // Non-numeric strings
    assert.throws(
      () => inventoryService.createItem({ name: 'Oil Filter', minimumStockLevel: 'free' }),
      /Minimum stock level must be a valid finite number/i,
      'Non-numeric string "free" must be rejected'
    )

    // Fractional values permitted (e.g. 2.5 units minimum stock, 1250.75 LKR price)
    const fractionalItem = inventoryService.createItem({
      sku: 'LUB-OIL-01',
      name: 'Engine Oil 5W-30 Bulk',
      category: 'Lubricants & Oils',
      minimumStockLevel: 10.5,
      currentSellingPrice: 4250.75
    })
    assert.strictEqual(fractionalItem.minimumStockLevel, 10.5, 'Fractional minimum stock should be permitted')
    assert.strictEqual(fractionalItem.currentSellingPrice, 4250.75, 'Fractional selling price should be permitted')

    // Initial batch validation on create
    assert.throws(
      () => inventoryService.createItem({
        name: 'Gear Oil',
        initialBatch: { qty: '12abc', unitCost: 1000 }
      }),
      /Initial batch quantity must be a valid finite number/i,
      'Initial batch with partial numeric string qty must be rejected'
    )
    assert.throws(
      () => inventoryService.createItem({
        name: 'Gear Oil',
        initialBatch: { qty: -10, unitCost: 1000 }
      }),
      /Initial batch quantity must be greater than 0/i,
      'Initial batch with negative qty must be rejected'
    )
    assert.throws(
      () => inventoryService.createItem({
        name: 'Gear Oil',
        initialBatch: { qty: 10, unitCost: -500 }
      }),
      /Initial batch unit cost cannot be negative/i,
      'Initial batch with negative unit cost must be rejected'
    )

    // updateItem numeric validation
    assert.throws(
      () => inventoryService.updateItem(fractionalItem.id, { minimumStockLevel: '15bad' }),
      /Minimum stock level must be a valid finite number/i,
      'updateItem with "15bad" in minimumStockLevel must be rejected'
    )
    assert.throws(
      () => inventoryService.updateItem(fractionalItem.id, { currentSellingPrice: -50 }),
      /Current selling price cannot be negative/i,
      'updateItem with negative price must be rejected'
    )
    assert.throws(
      () => inventoryService.updateItem(fractionalItem.id, { name: '   ' }),
      /Item name is required and cannot be empty or whitespace/i,
      'updateItem with whitespace name must be rejected'
    )

    // Valid updateItem with fractional numbers
    const updatedFractional = inventoryService.updateItem(fractionalItem.id, {
      minimumStockLevel: 12.25,
      currentSellingPrice: 4500.50
    })
    assert.strictEqual(updatedFractional.minimumStockLevel, 12.25)
    assert.strictEqual(updatedFractional.currentSellingPrice, 4500.50)

    console.log('✓ Numeric input validation in createItem & updateItem passed')

    // -------------------------------------------------------------------------
    // TEST 3: receiveBatch Input Validation & Fractional Quantities
    // -------------------------------------------------------------------------
    console.log('\n[Test 3] receiveBatch input validation')

    // Missing or invalid item
    assert.throws(
      () => inventoryService.receiveBatch({ inventoryItemId: 999999, receivedQty: 10, unitCost: 1000 }),
      /Inventory item not found/i,
      'receiveBatch on non-existent item must be rejected'
    )
    assert.throws(
      () => inventoryService.receiveBatch({ inventoryItemId: null, receivedQty: 10, unitCost: 1000 }),
      /Inventory item is required/i,
      'receiveBatch with null item must be rejected'
    )

    // Invalid quantities: '12abc', NaN, Infinity, <= 0
    assert.throws(
      () => inventoryService.receiveBatch({ inventoryItemId: fractionalItem.id, receivedQty: '12abc', unitCost: 500 }),
      /Received quantity must be a valid finite number/i,
      'Partial string "12abc" in receivedQty must be rejected'
    )
    assert.throws(
      () => inventoryService.receiveBatch({ inventoryItemId: fractionalItem.id, receivedQty: NaN, unitCost: 500 }),
      /Received quantity must be a valid finite number/i,
      'NaN in receivedQty must be rejected'
    )
    assert.throws(
      () => inventoryService.receiveBatch({ inventoryItemId: fractionalItem.id, receivedQty: Infinity, unitCost: 500 }),
      /Received quantity must be a valid finite number/i,
      'Infinity in receivedQty must be rejected'
    )
    assert.throws(
      () => inventoryService.receiveBatch({ inventoryItemId: fractionalItem.id, receivedQty: 0, unitCost: 500 }),
      /Received quantity must be greater than 0/i,
      '0 quantity must be rejected'
    )
    assert.throws(
      () => inventoryService.receiveBatch({ inventoryItemId: fractionalItem.id, receivedQty: -5, unitCost: 500 }),
      /Received quantity must be greater than 0/i,
      'Negative quantity must be rejected'
    )

    // Invalid cost: '500xyz', NaN, negative
    assert.throws(
      () => inventoryService.receiveBatch({ inventoryItemId: fractionalItem.id, receivedQty: 10, unitCost: '500xyz' }),
      /Unit cost must be a valid finite number/i,
      'Partial string "500xyz" in unitCost must be rejected'
    )
    assert.throws(
      () => inventoryService.receiveBatch({ inventoryItemId: fractionalItem.id, receivedQty: 10, unitCost: -200 }),
      /Unit cost cannot be negative/i,
      'Negative unit cost must be rejected'
    )

    // Valid fractional quantity (e.g. 15.5 Litres of oil @ 3,250.50 LKR)
    const validBatch1 = inventoryService.receiveBatch({
      inventoryItemId: fractionalItem.id,
      batchNo: 'BATCH-OIL-A1',
      receivedAt: '2026-08-01',
      receivedQty: 15.5,
      unitCost: 3250.50
    })
    assert.strictEqual(validBatch1.received_qty, 15.5, 'Fractional quantity 15.5 must be recorded')
    assert.strictEqual(validBatch1.remaining_qty, 15.5)
    assert.strictEqual(validBatch1.unit_cost, 3250.50)

    // Duplicate batchNo must be rejected
    assert.throws(
      () => inventoryService.receiveBatch({
        inventoryItemId: fractionalItem.id,
        batchNo: 'BATCH-OIL-A1',
        receivedQty: 5,
        unitCost: 3200
      }),
      /Batch number "BATCH-OIL-A1" is already in use/i,
      'Duplicate batch number must be rejected'
    )

    console.log('✓ receiveBatch input validation and duplicate prevention passed')

    // -------------------------------------------------------------------------
    // TEST 4: FIFO Consumption Input Validation (consumeFifo)
    // -------------------------------------------------------------------------
    console.log('\n[Test 4] consumeFifo input validation')

    assert.throws(
      () => inventoryService.consumeFifo(validJob.id, fractionalItem.id, '10abc'),
      /Quantity must be a valid finite number/i,
      'consumeFifo with "10abc" must be rejected'
    )
    assert.throws(
      () => inventoryService.consumeFifo(validJob.id, fractionalItem.id, NaN),
      /Quantity must be a valid finite number/i,
      'consumeFifo with NaN must be rejected'
    )
    assert.throws(
      () => inventoryService.consumeFifo(validJob.id, fractionalItem.id, Infinity),
      /Quantity must be a valid finite number/i,
      'consumeFifo with Infinity must be rejected'
    )
    assert.throws(
      () => inventoryService.consumeFifo(validJob.id, fractionalItem.id, 0),
      /Quantity must be greater than 0/i,
      'consumeFifo with 0 must be rejected'
    )
    assert.throws(
      () => inventoryService.consumeFifo(validJob.id, fractionalItem.id, -2),
      /Quantity must be greater than 0/i,
      'consumeFifo with negative quantity must be rejected'
    )
    assert.throws(
      () => inventoryService.consumeFifo(validJob.id, fractionalItem.id, 2, -100),
      /Selling price cannot be negative/i,
      'consumeFifo with negative sellingPriceOverride must be rejected'
    )
    assert.throws(
      () => inventoryService.consumeFifo(validJob.id, fractionalItem.id, 2, '500bad'),
      /Selling price must be a valid finite number/i,
      'consumeFifo with "500bad" sellingPriceOverride must be rejected'
    )

    console.log('✓ consumeFifo input validation passed')

    // -------------------------------------------------------------------------
    // TEST 5: Insufficient Stock Guarantee (No batch mutation, no partial rows)
    // -------------------------------------------------------------------------
    console.log('\n[Test 5] Insufficient stock: State immutability assertion')

    // Item has only 15.5 units available
    const itemPreInsufficient = inventoryService.get(fractionalItem.id)
    assert.strictEqual(itemPreInsufficient.totalStock, 15.5)

    const initialPartsCount = dbHelper.queryOne(
      'SELECT COUNT(*) AS cnt FROM job_parts WHERE job_card_id = ?',
      [validJob.id]
    ).cnt

    // Attempt to consume 20 units (greater than available 15.5)
    let insufficientCaught = false
    try {
      inventoryService.consumeFifo(validJob.id, fractionalItem.id, 20)
    } catch (err) {
      insufficientCaught = true
      assert.ok(err.message.includes('Insufficient stock'), 'Error message should indicate insufficient stock')
    }
    assert.strictEqual(insufficientCaught, true, 'Operation must throw on insufficient stock')

    // Verify database state: every batch balance remains untouched
    const itemPostInsufficient = inventoryService.get(fractionalItem.id)
    assert.strictEqual(
      itemPostInsufficient.totalStock,
      15.5,
      'Total stock must remain untouched when insufficient stock error occurs'
    )
    assert.strictEqual(
      itemPostInsufficient.batches[0].remainingQty,
      15.5,
      'Batch remaining quantity must remain untouched'
    )

    // Verify job_parts count remains unchanged
    const finalPartsCount = dbHelper.queryOne(
      'SELECT COUNT(*) AS cnt FROM job_parts WHERE job_card_id = ?',
      [validJob.id]
    ).cnt
    assert.strictEqual(finalPartsCount, initialPartsCount, 'No job_parts rows should be added')

    console.log('✓ Insufficient stock immutability guarantee passed')

    // -------------------------------------------------------------------------
    // TEST 6: FIFO Transaction Rollback After Mutation (Deterministic failure)
    // -------------------------------------------------------------------------
    console.log('\n[Test 6] FIFO transaction rollback after mutation')

    // Setup an isolated item for rollback testing
    const rollbackItem = inventoryService.createItem({
      sku: 'ROLLBACK-ITEM',
      name: 'Brake Disc Rotor',
      category: 'Braking System',
      minimumStockLevel: 2,
      currentSellingPrice: 8500
    })

    const rollbackBatch = inventoryService.receiveBatch({
      inventoryItemId: rollbackItem.id,
      batchNo: 'BATCH-ROLLBACK-01',
      receivedAt: '2026-08-01',
      receivedQty: 10,
      unitCost: 5000
    })

    // Assert initial state: remainingQty is 10
    const batchBefore = dbHelper.queryOne('SELECT remaining_qty FROM inventory_batches WHERE id = ?', [rollbackBatch.id])
    assert.strictEqual(batchBefore.remaining_qty, 10, 'Initial batch qty must be 10')

    const invalidJobId = 999999 // Deterministically does not exist in job_cards table
    let rollbackErrorCaught = false

    try {
      // In consumeFifo, batch.remaining_qty is updated FIRST inside the loop,
      // and then INSERT INTO job_parts fails due to FOREIGN KEY(job_card_id) REFERENCES job_cards(id).
      // This forces the transaction to roll back AFTER batch mutation!
      inventoryService.consumeFifo(invalidJobId, rollbackItem.id, 4)
    } catch (err) {
      rollbackErrorCaught = true
      assert.ok(
        err.message.includes('FOREIGN KEY') || err.message.includes('constraint'),
        `Error must be foreign key constraint failure, got: ${err.message}`
      )
    }

    assert.strictEqual(rollbackErrorCaught, true, 'Transaction failure must throw')

    // Assert ACID Rollback: batch quantity in DB must be restored to 10
    const batchAfterRollback = dbHelper.queryOne(
      'SELECT remaining_qty FROM inventory_batches WHERE id = ?',
      [rollbackBatch.id]
    )
    assert.strictEqual(
      batchAfterRollback.remaining_qty,
      10,
      'Batch quantity MUST be restored to 10 by transaction rollback'
    )

    // Assert no partial job_parts records remain
    const partialParts = dbHelper.queryAll(
      'SELECT * FROM job_parts WHERE inventory_item_id = ?',
      [rollbackItem.id]
    )
    assert.strictEqual(partialParts.length, 0, 'No partial job_parts records should remain')

    console.log('✓ FIFO transaction rollback after mutation verified (ACID atomicity intact)')

    // -------------------------------------------------------------------------
    // TEST 7: FIFO Multi-Batch Ordering, Tie-Breakers, Snapshots, Depletion & Restore
    // -------------------------------------------------------------------------
    console.log('\n[Test 7] Multi-batch FIFO: Date ordering, ID tie-breaker, snapshots & restore')

    const fifoItem = inventoryService.createItem({
      sku: 'FILTER-AIR-01',
      name: 'Engine Air Filter Element',
      category: 'Filters (Oil, Air, Fuel)',
      minimumStockLevel: 5,
      currentSellingPrice: 2500
    })

    // Batch 1: received_at '2026-08-01', 10 units @ 1,200 LKR
    const b1 = inventoryService.receiveBatch({
      inventoryItemId: fifoItem.id,
      batchNo: 'BATCH-FIFO-01',
      receivedAt: '2026-08-01',
      receivedQty: 10,
      unitCost: 1200
    })

    // Batch 2: received_at '2026-08-05', 10 units @ 1,400 LKR (Received later date)
    const b2 = inventoryService.receiveBatch({
      inventoryItemId: fifoItem.id,
      batchNo: 'BATCH-FIFO-02',
      receivedAt: '2026-08-05',
      receivedQty: 10,
      unitCost: 1400
    })

    // Batch 3: received_at '2026-08-05', 5 units @ 1,500 LKR (Same date as Batch 2, but created later -> higher ID)
    const b3 = inventoryService.receiveBatch({
      inventoryItemId: fifoItem.id,
      batchNo: 'BATCH-FIFO-03',
      receivedAt: '2026-08-05',
      receivedQty: 5,
      unitCost: 1500
    })

    assert.ok(b2.id < b3.id, 'Batch 2 ID must be lower than Batch 3 ID for tie-breaker check')
    assert.strictEqual(inventoryService.get(fifoItem.id).totalStock, 25, 'Total stock should be 25')

    // Consume 14 units:
    // Should take:
    // - 10 units from Batch 1 (Oldest received_at: 2026-08-01) -> Batch 1 fully depleted to 0
    // - 4 units from Batch 2 (Tied date: 2026-08-05, lower ID) -> Batch 2 remaining: 6
    // - 0 units from Batch 3 (Tied date: 2026-08-05, higher ID) -> Batch 3 remaining: 5
    const consumedParts = inventoryService.consumeFifo(validJob.id, fifoItem.id, 14, 2500, admin.id)
    assert.strictEqual(consumedParts.length, 2, 'Should create 2 job_parts rows spanning 2 batches')

    // Verify Cost & Selling Price Snapshots
    const p1 = consumedParts[0]
    assert.strictEqual(p1.batchId, b1.id)
    assert.strictEqual(p1.qty, 10)
    assert.strictEqual(p1.unitCost, 1200, 'Snapshot unitCost must match Batch 1 cost (1200)')
    assert.strictEqual(p1.sellingPrice, 2500, 'Snapshot sellingPrice must match 2500')
    assert.strictEqual(p1.lineTotal, 25000)

    const p2 = consumedParts[1]
    assert.strictEqual(p2.batchId, b2.id)
    assert.strictEqual(p2.qty, 4)
    assert.strictEqual(p2.unitCost, 1400, 'Snapshot unitCost must match Batch 2 cost (1400)')
    assert.strictEqual(p2.sellingPrice, 2500)
    assert.strictEqual(p2.lineTotal, 10000)

    // Verify Batch Balances after FIFO consumption
    const b1After = dbHelper.queryOne('SELECT remaining_qty FROM inventory_batches WHERE id = ?', [b1.id])
    const b2After = dbHelper.queryOne('SELECT remaining_qty FROM inventory_batches WHERE id = ?', [b2.id])
    const b3After = dbHelper.queryOne('SELECT remaining_qty FROM inventory_batches WHERE id = ?', [b3.id])

    assert.strictEqual(b1After.remaining_qty, 0, 'Batch 1 must be exactly depleted to 0')
    assert.strictEqual(b2After.remaining_qty, 6, 'Batch 2 must have 6 units remaining')
    assert.strictEqual(b3After.remaining_qty, 5, 'Batch 3 must remain untouched at 5 units')

    const itemAfterFifo = inventoryService.get(fifoItem.id)
    assert.strictEqual(itemAfterFifo.totalStock, 11, 'Total stock should be 11 (6 + 5)')

    // Test Restoring Part Qty: Restore Part 2 (4 units back to Batch 2)
    const restoreRes = inventoryService.restorePartQty(p2.id)
    assert.strictEqual(restoreRes.success, true)

    const b2AfterRestore = dbHelper.queryOne('SELECT remaining_qty FROM inventory_batches WHERE id = ?', [b2.id])
    assert.strictEqual(b2AfterRestore.remaining_qty, 10, 'Batch 2 remainingQty must be restored to 10')
    assert.strictEqual(inventoryService.get(fifoItem.id).totalStock, 15, 'Total stock should be 15 after restore')

    // Confirm job_parts record was removed
    const deletedPartCheck = dbHelper.queryOne('SELECT * FROM job_parts WHERE id = ?', [p2.id])
    assert.strictEqual(deletedPartCheck, undefined, 'Restored job_parts row must be deleted')

    // Test Repeated Removal Prevention: Attempting to restore already deleted part must fail
    assert.throws(
      () => inventoryService.restorePartQty(p2.id),
      /Job part record not found/i,
      'Second call to restorePartQty must throw error'
    )
    const b2AfterDuplicateRestore = dbHelper.queryOne('SELECT remaining_qty FROM inventory_batches WHERE id = ?', [b2.id])
    assert.strictEqual(
      b2AfterDuplicateRestore.remaining_qty,
      10,
      'Stock must not be increased a second time on repeated removal attempt'
    )

    // Deplete remaining stock completely (10 from Batch 2, 5 from Batch 3)
    inventoryService.consumeFifo(validJob.id, fifoItem.id, 15)
    assert.strictEqual(inventoryService.get(fifoItem.id).totalStock, 0, 'Total stock must be exactly 0 after full depletion')

    console.log('✓ Multi-batch FIFO ordering, tie-breakers, snapshots, restore & exact depletion passed')

    // -------------------------------------------------------------------------
    // TEST 8: Low-Stock Boundary Rule (totalStock <= minimumStockLevel)
    // -------------------------------------------------------------------------
    console.log('\n[Test 8] Low-stock boundary rule verification (Below, Equal, Above boundaries)')

    const alertItem = inventoryService.createItem({
      sku: 'COOLANT-5L',
      name: 'Premix Engine Coolant 5L',
      category: 'Fluids & Coolants',
      minimumStockLevel: 10,
      currentSellingPrice: 3800
    })

    // Initial state: totalStock = 0 <= minimumStockLevel (10) -> isLowStock = true
    const itemInit = inventoryService.get(alertItem.id)
    assert.strictEqual(itemInit.totalStock, 0)
    assert.strictEqual(itemInit.isLowStock, true, 'Zero stock <= 10 min stock must trigger low stock')

    // Receive 15 units: totalStock = 15 > 10 -> isLowStock = false (Above boundary)
    const coolantBatch = inventoryService.receiveBatch({
      inventoryItemId: alertItem.id,
      receivedQty: 15,
      unitCost: 2200
    })
    const itemAbove = inventoryService.get(alertItem.id)
    assert.strictEqual(itemAbove.totalStock, 15)
    assert.strictEqual(itemAbove.isLowStock, false, '15 units > 10 min stock must NOT be low stock')

    // Consume 5 units: totalStock = 10 == 10 -> isLowStock = true (EQUAL boundary)
    const issuedPart = inventoryService.consumeFifo(validJob.id, alertItem.id, 5)
    const itemEqual = inventoryService.get(alertItem.id)
    assert.strictEqual(itemEqual.totalStock, 10)
    assert.strictEqual(
      itemEqual.isLowStock,
      true,
      'CRITICAL BOUNDARY: totalStock == minimumStockLevel (10 == 10) MUST evaluate to isLowStock = true'
    )

    // Consume 2 units: totalStock = 8 < 10 -> isLowStock = true (Below boundary)
    inventoryService.consumeFifo(validJob.id, alertItem.id, 2)
    const itemBelow = inventoryService.get(alertItem.id)
    assert.strictEqual(itemBelow.totalStock, 8)
    assert.strictEqual(itemBelow.isLowStock, true, '8 units < 10 min stock must be low stock')

    // Restore the first 5 units: totalStock = 8 + 5 = 13 > 10 -> isLowStock = false
    inventoryService.restorePartQty(issuedPart[0].id)
    const itemRestored = inventoryService.get(alertItem.id)
    assert.strictEqual(itemRestored.totalStock, 13)
    assert.strictEqual(itemRestored.isLowStock, false, 'Stock restored to 13 > 10 must clear low stock alert')

    // Low stock filter check in list()
    const lowStockList = inventoryService.list({ lowStockOnly: true })
    assert.ok(
      lowStockList.every((i) => i.totalStock <= i.minimumStockLevel),
      'All items returned with lowStockOnly must satisfy totalStock <= minimumStockLevel'
    )

    console.log('✓ Low-stock boundary rule (Below, Equal, Above) verified accurately')

    // -------------------------------------------------------------------------
    // TEST 9: Duplicate SKU, Missing References & SCRUM-24 Category Filtering
    // -------------------------------------------------------------------------
    console.log('\n[Test 9] Duplicate SKU, missing references, and category filters (SCRUM-24)')

    // Duplicate SKU on createItem
    assert.throws(
      () => inventoryService.createItem({ sku: 'COOLANT-5L', name: 'Duplicate Coolant' }),
      /SKU \/ Part number "COOLANT-5L" is already in use/i,
      'Duplicate SKU on createItem must be rejected'
    )

    // Duplicate SKU on updateItem
    const otherItem = inventoryService.createItem({
      sku: 'BRAKE-FLUID-DOT4',
      name: 'DOT4 Brake Fluid 500ml',
      category: 'Fluids & Coolants',
      minimumStockLevel: 4
    })

    assert.throws(
      () => inventoryService.updateItem(otherItem.id, { sku: 'COOLANT-5L' }),
      /SKU \/ Part number "COOLANT-5L" is already in use/i,
      'Duplicate SKU on updateItem must be rejected'
    )

    // Missing references
    assert.throws(
      () => inventoryService.updateItem(888888, { name: 'Non-existent item' }),
      /Item not found/i,
      'Updating non-existent item id must throw error'
    )
    assert.throws(
      () => jobService.addPart(999999, { inventoryItemId: otherItem.id, qty: 1 }),
      /Job Card not found/i,
      'Adding part to non-existent job card must throw error'
    )
    assert.throws(
      () => jobService.removePart(999999),
      /Part record not found/i,
      'Removing non-existent job part must throw error'
    )

    // Category Filtering Coverage (SCRUM-24)
    const allFluids = inventoryService.list({ category: 'Fluids & Coolants' })
    assert.ok(allFluids.length >= 2, 'Should find fluids items')
    assert.ok(allFluids.every((i) => i.category === 'Fluids & Coolants'), 'Every item in filter must be Fluids & Coolants')

    const emptyCategoryList = inventoryService.list({ category: 'Non-Existent Category 12345' })
    assert.strictEqual(emptyCategoryList.length, 0, 'Non-existent category should return empty array')

    const searchAndCategoryList = inventoryService.list({
      category: 'Fluids & Coolants',
      search: 'Premix'
    })
    assert.strictEqual(searchAndCategoryList.length, 1, 'Should find exactly 1 item for Premix in Fluids & Coolants')
    assert.strictEqual(searchAndCategoryList[0].sku, 'COOLANT-5L')

    console.log('✓ Duplicate SKU, missing references, and category filters passed')

    console.log('\n======================================================================')
    console.log('ALL INVENTORY VALIDATION & FIFO TESTS PASSED WITH 100% SUCCESS!')
    console.log('======================================================================')
  } finally {
    // Teardown: ensure DB is always closed and temporary directory is cleaned
    try {
      dbHelper.closeDb()
      fs.rmSync(testDataDir, { recursive: true, force: true })
      console.log('[Cleanup] Test database and temporary directory cleaned successfully.')
    } catch (cleanupErr) {
      console.error('[Cleanup Warning] Failed to delete test dir:', cleanupErr)
    }
  }
}

runInventoryValidationTests().catch((err) => {
  console.error('\n❌ INVENTORY VALIDATION TEST SUITE FAILED:', err)
  process.exit(1)
})
