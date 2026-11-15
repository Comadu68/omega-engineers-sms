const path = require('path')
const fs = require('fs')
const os = require('os')
const assert = require('assert')

// Create an isolated temporary directory for test DB
const testDataDir = path.join(os.tmpdir(), `omega_rbac_test_${Date.now()}_${Math.floor(Math.random() * 10000)}`)
fs.mkdirSync(testDataDir, { recursive: true })
const testDbPath = path.join(testDataDir, 'test_rbac.db')

const dbHelper = require('../src/database/db.cjs')
dbHelper.initDb(testDbPath)

const authService = require('../src/main/services/authService.cjs')
const permissions = require('../src/shared/permissions.cjs')
const { MODULE_PERMISSIONS, canAccessModule, getDefaultTabForRole } = permissions

async function runRolePermissionsTests() {
  console.log('======================================================================')
  console.log('--- STARTING ROLE PERMISSIONS & RBAC ACCESS CONTROL TESTS (SCRUM-12) ---')
  console.log('======================================================================')

  try {
    // -------------------------------------------------------------------------
    // TEST 1: Role-Based Module Permission Matrix (Single Source of Truth)
    // -------------------------------------------------------------------------
    console.log('\n[Test 1] Verifying Role-Based Module Permission Matrix...')

    const allModules = [
      'dashboard',
      'jobcards',
      'appointments',
      'customers',
      'inventory',
      'mechanics',
      'invoices',
      'reports',
      'settings'
    ]

    // 1. admin_owner must have access to all 9 modules
    for (const mod of allModules) {
      assert.strictEqual(
        canAccessModule('admin_owner', mod),
        true,
        `admin_owner must have full access to module: ${mod}`
      )
    }
    console.log('  ✓ admin_owner has full access to all 9 modules')

    // 2. mechanic can access ONLY ['dashboard', 'jobcards', 'mechanics', 'settings']
    const expectedMechanicAllowed = ['dashboard', 'jobcards', 'mechanics', 'settings']
    const expectedMechanicDenied = ['appointments', 'customers', 'inventory', 'invoices', 'reports']

    for (const mod of expectedMechanicAllowed) {
      assert.strictEqual(
        canAccessModule('mechanic', mod),
        true,
        `mechanic should be allowed access to: ${mod}`
      )
    }
    for (const mod of expectedMechanicDenied) {
      assert.strictEqual(
        canAccessModule('mechanic', mod),
        false,
        `mechanic must be DENIED access to: ${mod}`
      )
    }
    console.log('  ✓ mechanic access strictly constrained to [dashboard, jobcards, mechanics, settings]')

    // 3. receptionist_service_advisor can access appointments, customers, jobcards, mechanics, dashboard, settings;
    //    BLOCKED from inventory, reports, invoices
    const expectedReceptionistAllowed = ['dashboard', 'jobcards', 'appointments', 'customers', 'mechanics', 'settings']
    const expectedReceptionistDenied = ['inventory', 'invoices', 'reports']

    for (const mod of expectedReceptionistAllowed) {
      assert.strictEqual(
        canAccessModule('receptionist_service_advisor', mod),
        true,
        `receptionist should be allowed access to: ${mod}`
      )
    }
    for (const mod of expectedReceptionistDenied) {
      assert.strictEqual(
        canAccessModule('receptionist_service_advisor', mod),
        false,
        `receptionist must be DENIED access to: ${mod}`
      )
    }
    console.log('  ✓ receptionist access allowed for front-desk; blocked from inventory, invoices, reports')

    // 4. inventory_billing can access inventory, invoices, jobcards, customers, dashboard, settings;
    //    BLOCKED from appointments, mechanics, reports
    const expectedBillingAllowed = ['dashboard', 'jobcards', 'customers', 'inventory', 'invoices', 'settings']
    const expectedBillingDenied = ['appointments', 'mechanics', 'reports']

    for (const mod of expectedBillingAllowed) {
      assert.strictEqual(
        canAccessModule('inventory_billing', mod),
        true,
        `inventory_billing should be allowed access to: ${mod}`
      )
    }
    for (const mod of expectedBillingDenied) {
      assert.strictEqual(
        canAccessModule('inventory_billing', mod),
        false,
        `inventory_billing must be DENIED access to: ${mod}`
      )
    }
    console.log('  ✓ inventory_billing access allowed for stock & bills; blocked from appointments, mechanics, reports')

    // 5. Invalid / Null / Unknown role checks
    assert.strictEqual(canAccessModule(null, 'dashboard'), false, 'Null role must be denied')
    assert.strictEqual(canAccessModule(undefined, 'dashboard'), false, 'Undefined role must be denied')
    assert.strictEqual(canAccessModule('', 'dashboard'), false, 'Empty role must be denied')
    assert.strictEqual(canAccessModule('guest', 'dashboard'), false, 'Unknown role must be denied')
    assert.strictEqual(canAccessModule('hacker', 'reports'), false, 'Unknown role must be denied from reports')
    console.log('  ✓ Unauthenticated / invalid roles safely rejected')

    // -------------------------------------------------------------------------
    // TEST 2: Default Landing Screen by Role
    // -------------------------------------------------------------------------
    console.log('\n[Test 2] Verifying default landing screen routing for each role...')

    assert.strictEqual(getDefaultTabForRole('admin_owner'), 'dashboard')
    assert.strictEqual(getDefaultTabForRole('mechanic'), 'jobcards')
    assert.strictEqual(getDefaultTabForRole('receptionist_service_advisor'), 'appointments')
    assert.strictEqual(getDefaultTabForRole('inventory_billing'), 'inventory')
    assert.strictEqual(getDefaultTabForRole(null), 'dashboard')
    assert.strictEqual(getDefaultTabForRole('unknown_role'), 'dashboard')
    console.log('  ✓ Default landing tabs correctly route to role-relevant modules')

    // -------------------------------------------------------------------------
    // TEST 3: Synthetic Users Setup & Session State Management
    // -------------------------------------------------------------------------
    console.log('\n[Test 3] Creating synthetic accounts and testing session lifecycle...')

    authService.logout()
    assert.strictEqual(authService.getCurrentUser(), null, 'Session must be null after explicit logout')

    const admin = authService.setupAdmin({
      username: 'owner_admin',
      password: 'AdminPassword123!',
      displayName: 'Workshop Owner'
    })
    assert.strictEqual(admin.role, 'admin_owner')
    assert.strictEqual(authService.getCurrentUser().username, 'owner_admin', 'setupAdmin must initialize active session')

    const receptionist = authService.createUser({
      username: 'reception_sarah',
      password: 'SarahPassword123!',
      displayName: 'Sarah Perera',
      role: 'receptionist_service_advisor'
    })

    const tech = authService.createUser({
      username: 'tech_kamal',
      password: 'KamalPassword123!',
      displayName: 'Kamal Silva',
      role: 'mechanic'
    })

    const billing = authService.createUser({
      username: 'bill_nimal',
      password: 'NimalPassword123!',
      displayName: 'Nimal Fernando',
      role: 'inventory_billing'
    })

    // Test login transitions and session tracking
    authService.login({ username: 'tech_kamal', password: 'KamalPassword123!' })
    assert.strictEqual(authService.getCurrentUser().role, 'mechanic')

    authService.login({ username: 'bill_nimal', password: 'NimalPassword123!' })
    assert.strictEqual(authService.getCurrentUser().role, 'inventory_billing')

    authService.login({ username: 'reception_sarah', password: 'SarahPassword123!' })
    assert.strictEqual(authService.getCurrentUser().role, 'receptionist_service_advisor')

    authService.logout()
    assert.strictEqual(authService.getCurrentUser(), null, 'Logout must clear session user')
    console.log('  ✓ User accounts created and session login/logout verified')

    // -------------------------------------------------------------------------
    // TEST 4: Backend Authorization Guards (requireAdminCaller & requireRole)
    // -------------------------------------------------------------------------
    console.log('\n[Test 4] Testing backend authorization guards (requireAdminCaller & requireRole)...')

    // When unauthenticated (no session):
    authService.logout()
    assert.throws(
      () => authService.requireAdminCaller(),
      /Authentication required/i,
      'Unauthenticated caller must be rejected by requireAdminCaller'
    )
    assert.throws(
      () => authService.requireRole(['admin_owner', 'inventory_billing']),
      /Authentication required/i,
      'Unauthenticated caller must be rejected by requireRole'
    )

    // When logged in as mechanic:
    authService.setCurrentUser(tech)
    assert.throws(
      () => authService.requireAdminCaller(),
      /Administrator role required/i,
      'mechanic must be rejected by requireAdminCaller'
    )
    assert.throws(
      () => authService.requireRole(['admin_owner', 'inventory_billing']),
      /Unauthorized role \(mechanic\)/i,
      'mechanic must be rejected from billing-only operations'
    )
    // Mechanic authorized for technician actions:
    const techGuard = authService.requireRole(['mechanic', 'admin_owner'])
    assert.strictEqual(techGuard.role, 'mechanic')

    // When logged in as receptionist:
    authService.setCurrentUser(receptionist)
    assert.throws(
      () => authService.requireAdminCaller(),
      /Administrator role required/i,
      'receptionist must be rejected by requireAdminCaller'
    )
    assert.throws(
      () => authService.requireRole(['admin_owner', 'inventory_billing']),
      /Unauthorized role \(receptionist_service_advisor\)/i,
      'receptionist must be rejected from billing/expense operations'
    )

    // When logged in as inventory_billing:
    authService.setCurrentUser(billing)
    assert.throws(
      () => authService.requireAdminCaller(),
      /Administrator role required/i,
      'inventory_billing must be rejected by requireAdminCaller'
    )
    const billingGuard = authService.requireRole(['admin_owner', 'inventory_billing'])
    assert.strictEqual(billingGuard.role, 'inventory_billing', 'inventory_billing authorized for billing operations')

    // When logged in as admin_owner:
    authService.setCurrentUser(admin)
    const adminGuard = authService.requireAdminCaller()
    assert.strictEqual(adminGuard.role, 'admin_owner')
    const adminSuperGuard = authService.requireRole(['mechanic'])
    assert.strictEqual(adminSuperGuard.role, 'admin_owner', 'admin_owner is superuser and passes requireRole')

    console.log('  ✓ Backend authorization guards reject unauthorized roles and unauthenticated callers')

    // -------------------------------------------------------------------------
    // TEST 5: IPC Protected Services Simulation (Reports, Backup, Expenses)
    // -------------------------------------------------------------------------
    console.log('\n[Test 5] Simulating IPC dispatch protection for sensitive modules...')

    // Simulated handler wrappers matching IPC registrations:
    const simulateReportsDailySummary = (callerContext = null) => {
      authService.requireAdminCaller(callerContext)
      return { status: 'success', data: 'Report Data' }
    }

    const simulateBackupCreate = (callerContext = null) => {
      authService.requireAdminCaller(callerContext)
      return { status: 'success', data: 'Backup Created' }
    }

    const simulateExpensesCreate = (callerContext = null) => {
      authService.requireRole(['admin_owner', 'inventory_billing'], callerContext)
      return { status: 'success', data: 'Expense Recorded' }
    }

    // A) Unauthenticated caller -> ALL must fail
    authService.logout()
    assert.throws(() => simulateReportsDailySummary(), /Authentication required/i)
    assert.throws(() => simulateBackupCreate(), /Authentication required/i)
    assert.throws(() => simulateExpensesCreate(), /Authentication required/i)
    console.log('  ✓ Unauthenticated IPC requests rejected across all protected endpoints')

    // B) Mechanic caller -> Reports, Backup, Expenses must fail
    authService.setCurrentUser(tech)
    assert.throws(() => simulateReportsDailySummary(), /Administrator role required/i)
    assert.throws(() => simulateBackupCreate(), /Administrator role required/i)
    assert.throws(() => simulateExpensesCreate(), /Unauthorized role \(mechanic\)/i)
    console.log('  ✓ Mechanic IPC tampering blocked from Reports, Backup, and Expenses')

    // C) Receptionist caller -> Reports, Backup, Expenses must fail
    authService.setCurrentUser(receptionist)
    assert.throws(() => simulateReportsDailySummary(), /Administrator role required/i)
    assert.throws(() => simulateBackupCreate(), /Administrator role required/i)
    assert.throws(() => simulateExpensesCreate(), /Unauthorized role \(receptionist_service_advisor\)/i)
    console.log('  ✓ Receptionist IPC tampering blocked from Reports, Backup, and Expenses')

    // D) Inventory/Billing caller -> Reports & Backup must fail, Expenses must SUCCEED
    authService.setCurrentUser(billing)
    assert.throws(() => simulateReportsDailySummary(), /Administrator role required/i)
    assert.throws(() => simulateBackupCreate(), /Administrator role required/i)
    const billingExpRes = simulateExpensesCreate()
    assert.strictEqual(billingExpRes.status, 'success')
    console.log('  ✓ Inventory/Billing permitted on Expenses; strictly blocked from Reports and Backup')

    // E) Admin Owner -> Reports, Backup, Expenses all SUCCEED
    authService.setCurrentUser(admin)
    assert.strictEqual(simulateReportsDailySummary().status, 'success')
    assert.strictEqual(simulateBackupCreate().status, 'success')
    assert.strictEqual(simulateExpensesCreate().status, 'success')
    console.log('  ✓ Admin Owner has verified execution access on all endpoints')

    // -------------------------------------------------------------------------
    // TEST 6: Navigation Items Filtering for Sidebar
    // -------------------------------------------------------------------------
    console.log('\n[Test 6] Verifying Sidebar navigation filtering for all roles...')

    const NAV_ITEMS = [
      { id: 'dashboard', label: 'Dashboard' },
      { id: 'jobcards', label: 'Job Cards' },
      { id: 'appointments', label: 'Appointments' },
      { id: 'inventory', label: 'Inventory' },
      { id: 'mechanics', label: 'Mechanics' },
      { id: 'customers', label: 'Customers' },
      { id: 'invoices', label: 'Invoices' },
      { id: 'reports', label: 'Reports' },
      { id: 'settings', label: 'Settings' }
    ]

    const getVisibleNav = (role) => NAV_ITEMS.filter((item) => canAccessModule(role, item.id)).map((i) => i.id)

    const adminNav = getVisibleNav('admin_owner')
    assert.strictEqual(adminNav.length, 9, 'Admin must see all 9 tabs')

    const mechanicNav = getVisibleNav('mechanic')
    assert.deepStrictEqual(mechanicNav, ['dashboard', 'jobcards', 'mechanics', 'settings'])

    const receptionistNav = getVisibleNav('receptionist_service_advisor')
    assert.deepStrictEqual(receptionistNav, ['dashboard', 'jobcards', 'appointments', 'mechanics', 'customers', 'settings'])

    const billingNav = getVisibleNav('inventory_billing')
    assert.deepStrictEqual(billingNav, ['dashboard', 'jobcards', 'inventory', 'customers', 'invoices', 'settings'])

    console.log('  ✓ Sidebar navigation items accurately filtered per role')

    console.log('\n======================================================================')
    console.log('ALL ROLE PERMISSION & RBAC ACCEPTANCE TESTS PASSED (100% SUCCESS)!')
    console.log('======================================================================')
  } finally {
    // Teardown: ensure DB is always closed and temporary directory is deleted
    try {
      dbHelper.closeDb()
      fs.rmSync(testDataDir, { recursive: true, force: true })
      console.log('[Cleanup] Test database and temporary directory cleaned successfully.')
    } catch (cleanupErr) {
      console.error('[Cleanup Warning] Failed to delete test dir:', cleanupErr)
    }
  }
}

runRolePermissionsTests().catch((err) => {
  console.error('\n❌ ROLE PERMISSIONS TEST SUITE FAILED:', err)
  process.exit(1)
})
