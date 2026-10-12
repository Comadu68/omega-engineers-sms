const path = require('path')
const fs = require('fs')
const os = require('os')
const assert = require('assert')
const { EventEmitter } = require('events')
const Module = require('module')

// Ensure native better-sqlite3 can be resolved in environments where it lives in unpacked Electron resources
const localAppData = process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local')
const fallbackNodeModules = path.join(
  localAppData,
  'Programs',
  'Omega Engineers Service Station',
  'resources',
  'app.asar.unpacked',
  'node_modules'
)
if (fs.existsSync(fallbackNodeModules)) {
  process.env.NODE_PATH = process.env.NODE_PATH
    ? `${process.env.NODE_PATH}${path.delimiter}${fallbackNodeModules}`
    : fallbackNodeModules
  Module._initPaths()
}

// Create isolated temporary test home and database directory so real user data/backups are never touched
const testRootDir = path.join(os.tmpdir(), `omega_scrum10_test_${Date.now()}_${process.pid}`)
const testHomeDir = path.join(testRootDir, 'home')
const testDocsDir = path.join(testHomeDir, 'Documents')
const testDataDir = path.join(testRootDir, 'data')
fs.mkdirSync(testDocsDir, { recursive: true })
fs.mkdirSync(testDataDir, { recursive: true })

process.env.USERPROFILE = testHomeDir
process.env.HOME = testHomeDir

const testDbPath = path.join(testDataDir, 'test_auth_admin.db')

const dbHelper = require('../src/database/db.cjs')
dbHelper.initDb(testDbPath)

const authService = require('../src/main/services/authService.cjs')
const authIpc = require('../src/main/ipc/auth.ipc.cjs')

// Build a mock IPC bus that wires preload contextBridge/ipcRenderer to main-process ipcMain.handle
function createMockIpcEnvironment() {
  const handlers = new Map()

  const mockIpcMain = {
    handle(channel, listener) {
      handlers.set(channel, listener)
    }
  }

  let nextWebContentsId = 100
  function createMockWebContents() {
    const emitter = new EventEmitter()
    let destroyed = false
    const wc = Object.assign(emitter, {
      id: ++nextWebContentsId,
      isDestroyed: () => destroyed,
      destroy: () => {
        destroyed = true
        emitter.emit('destroyed')
      }
    })
    return wc
  }

  function createPreloadClient(webContents) {
    let exposedApi = null
    const mockElectronForPreload = {
      contextBridge: {
        exposeInMainWorld(apiKey, apiObj) {
          if (apiKey === 'omega') {
            exposedApi = apiObj
          }
        }
      },
      ipcRenderer: {
        async invoke(channel, ...args) {
          const handler = handlers.get(channel)
          if (!handler) {
            throw new Error(`No IPC handler registered for channel: ${channel}`)
          }
          return await handler({ sender: webContents }, ...args)
        }
      },
      ipcMain: mockIpcMain,
      dialog: {
        showOpenDialog: async () => ({ canceled: true, filePaths: [] })
      }
    }

    const preloadPath = path.join(__dirname, '..', 'src', 'preload', 'preload.cjs')
    const preloadSource = fs.readFileSync(preloadPath, 'utf8')
    const preloadFn = new Function('require', preloadSource)
    preloadFn((modName) => {
      if (modName === 'electron') return mockElectronForPreload
      return require(modName)
    })

    return {
      webContents,
      omega: exposedApi,
      invokeRaw: async (channel, payload) => {
        const handler = handlers.get(channel)
        if (!handler) {
          throw new Error(`No IPC handler registered for channel: ${channel}`)
        }
        return await handler({ sender: webContents }, payload)
      }
    }
  }

  // Intercept require('electron') for IPC registration in Node test runtime
  const originalLoad = Module._load
  Module._load = function (request, parent, isMain) {
    if (request === 'electron') {
      return {
        ipcMain: mockIpcMain,
        dialog: {
          showOpenDialog: async () => ({ canceled: true, filePaths: [] })
        },
        app: {
          getPath: (name) => (name === 'documents' ? testDocsDir : testDataDir)
        }
      }
    }
    return originalLoad.apply(this, arguments)
  }

  try {
    const settingsIpc = require('../src/main/ipc/settings.ipc.cjs')
    const backupIpc = require('../src/main/ipc/backup.ipc.cjs')
    authIpc.register(mockIpcMain)
    settingsIpc.register()
    backupIpc.register()
  } finally {
    Module._load = originalLoad
  }

  return {
    handlers,
    createMockWebContents,
    createPreloadClient
  }
}

// Helper to extract and execute fetchSettingsScreenData from src/renderer/pages/Settings.jsx
function loadFetchSettingsScreenDataFromSource() {
  const settingsPath = path.join(__dirname, '..', 'src', 'renderer', 'pages', 'Settings.jsx')
  const source = fs.readFileSync(settingsPath, 'utf8').replace(/\r\n/g, '\n')
  const match = source.match(
    /export const fetchSettingsScreenData = async[\s\S]*?\n\}\n\nexport const Settings/
  )
  assert.ok(match, 'Settings.jsx must export fetchSettingsScreenData helper')
  const fnBody = match[0]
    .replace(/^export const fetchSettingsScreenData = /, 'return ')
    .replace(/\n\nexport const Settings$/, '')
  const factory = new Function(fnBody)
  return factory()
}

async function expectReject(promiseOrFn, expectedSubstring, message) {
  let ThrownError = null
  try {
    if (typeof promiseOrFn === 'function') {
      await promiseOrFn()
    } else {
      await promiseOrFn
    }
  } catch (err) {
    ThrownError = err
  }
  assert.ok(ThrownError, `${message} (expected rejection, but resolved)`)
  if (expectedSubstring) {
    assert.ok(
      ThrownError.message.toLowerCase().includes(expectedSubstring.toLowerCase()),
      `${message} (expected "${expectedSubstring}", got "${ThrownError.message}")`
    )
  }
}

function getPasswordHash(userId) {
  const row = dbHelper.queryOne('SELECT password_hash FROM users WHERE id = ?', [userId])
  return row ? row.password_hash : null
}

async function runAcceptanceTests() {
  console.log('--- Starting SCRUM-10 Admin-Only User Management Acceptance Tests ---')

  const ipcEnv = createMockIpcEnvironment()

  // =========================================================================
  // 1. Owner setup works once; later setup is rejected
  // =========================================================================
  console.log('Test 1: First-run owner setup works once and binds session; later setup is rejected')
  const setupClient = ipcEnv.createPreloadClient(ipcEnv.createMockWebContents())
  const secondClient = ipcEnv.createPreloadClient(ipcEnv.createMockWebContents())

  assert.strictEqual(await setupClient.omega.auth.isFirstRun(), true, 'Database should start in first-run state')

  const owner = await setupClient.omega.auth.setupAdmin({
    username: 'owner_admin',
    password: 'ownerPassword123',
    displayName: 'Primary Station Owner'
  })

  assert.strictEqual(owner.username, 'owner_admin')
  assert.strictEqual(owner.role, 'admin_owner')
  assert.strictEqual(owner.isActive, 1)
  assert.strictEqual(await setupClient.omega.auth.isFirstRun(), false, 'isFirstRun must be false after setup')

  // Session was set on setupClient during first-run setup
  const initialUsers = await setupClient.omega.auth.getUsers()
  assert.strictEqual(initialUsers.length, 1)
  assert.strictEqual(initialUsers[0].username, 'owner_admin')

  // Later setup attempts must be rejected (both from another client and from authenticated client)
  await expectReject(
    () =>
      secondClient.omega.auth.setupAdmin({
        username: 'attacker_owner',
        password: 'password123',
        displayName: 'Attacker Owner'
      }),
    'already configured',
    'Second setupAdmin from unauthenticated client must be rejected'
  )

  await expectReject(
    () =>
      setupClient.omega.auth.setupAdmin({
        username: 'another_owner',
        password: 'password123',
        displayName: 'Another Owner'
      }),
    'already configured',
    'Second setupAdmin from authenticated client must be rejected'
  )

  const usersAfterFailedSetup = await setupClient.omega.auth.getUsers()
  assert.strictEqual(usersAfterFailedSetup.length, 1, 'No extra user should be created after rejected setupAdmin')
  console.log('✓ Test 1 Passed')

  // =========================================================================
  // 2. Failed login does not leave an unintended session; window destroy clears session
  // =========================================================================
  console.log('Test 2: Failed login clears/prevents session; window destruction clears session')
  await expectReject(
    () => setupClient.omega.auth.login({ username: 'owner_admin', password: 'wrongPassword!' }),
    'invalid username or password',
    'Login with wrong password must fail'
  )

  // Because login failed on setupClient, its previous session must NOT remain active
  await expectReject(
    () => setupClient.omega.auth.getUsers(),
    'authentication required',
    'Failed login must not leave an unintended authenticated session'
  )

  // Log in on a temporary window and then destroy its webContents
  const tempWindowClient = ipcEnv.createPreloadClient(ipcEnv.createMockWebContents())
  await tempWindowClient.omega.auth.login({ username: 'owner_admin', password: 'ownerPassword123' })
  assert.strictEqual((await tempWindowClient.omega.auth.getUsers()).length, 1)

  tempWindowClient.webContents.destroy()
  await expectReject(
    () => tempWindowClient.omega.auth.getUsers(),
    'authentication required',
    'Destroyed webContents must lose its authenticated session'
  )
  console.log('✓ Test 2 Passed')

  // =========================================================================
  // 3. Active admin can create, change, and deactivate staff accounts
  // =========================================================================
  console.log('Test 3: Active admin can create, update role/details, and deactivate staff accounts')
  const adminClient = ipcEnv.createPreloadClient(ipcEnv.createMockWebContents())
  const loggedInOwner = await adminClient.omega.auth.login({
    username: 'owner_admin',
    password: 'ownerPassword123'
  })
  assert.strictEqual(loggedInOwner.role, 'admin_owner')

  const receptionistUser = await adminClient.omega.auth.createUser({
    username: 'rec_amal',
    password: 'recPassword123',
    displayName: 'Amal Receptionist',
    role: 'receptionist_service_advisor'
  })
  assert.strictEqual(receptionistUser.role, 'receptionist_service_advisor')

  const mechanicUser = await adminClient.omega.auth.createUser({
    username: 'mech_kasun',
    password: 'mechPassword123',
    displayName: 'Kasun Mechanic',
    role: 'mechanic'
  })
  assert.strictEqual(mechanicUser.role, 'mechanic')

  const billingUser = await adminClient.omega.auth.createUser({
    username: 'bill_nimal',
    password: 'billPassword123',
    displayName: 'Nimal Billing',
    role: 'inventory_billing'
  })
  assert.strictEqual(billingUser.role, 'inventory_billing')

  const tempStaff = await adminClient.omega.auth.createUser({
    username: 'temp_staff',
    password: 'tempPassword123',
    displayName: 'Temp Staff',
    role: 'mechanic'
  })

  // Admin changes tempStaff role and display name
  const updatedStaff = await adminClient.omega.auth.updateUser(tempStaff.id, {
    displayName: 'Temp Staff Updated',
    role: 'inventory_billing',
    isActive: 1
  })
  assert.strictEqual(updatedStaff.displayName, 'Temp Staff Updated')
  assert.strictEqual(updatedStaff.role, 'inventory_billing')
  assert.strictEqual(updatedStaff.isActive, 1)

  // Admin deactivates tempStaff
  const deactivatedStaff = await adminClient.omega.auth.updateUser(tempStaff.id, {
    isActive: 0
  })
  assert.strictEqual(deactivatedStaff.isActive, 0)

  // Deactivated staff cannot log in
  const deactivatedClient = ipcEnv.createPreloadClient(ipcEnv.createMockWebContents())
  await expectReject(
    () => deactivatedClient.omega.auth.login({ username: 'temp_staff', password: 'tempPassword123' }),
    'inactive',
    'Deactivated staff account must not be allowed to log in'
  )
  console.log('✓ Test 3 Passed')

  // =========================================================================
  // 4. Unauthenticated caller and each non-admin role cannot perform protected
  //    operations, even with forged admin role/userId/currentUser in payload
  // =========================================================================
  console.log('Test 4: Unauthenticated caller and all non-admin roles are denied (including forged payloads)')
  const unauthClient = ipcEnv.createPreloadClient(ipcEnv.createMockWebContents())
  const recClient = ipcEnv.createPreloadClient(ipcEnv.createMockWebContents())
  const mechClient = ipcEnv.createPreloadClient(ipcEnv.createMockWebContents())
  const billClient = ipcEnv.createPreloadClient(ipcEnv.createMockWebContents())

  await recClient.omega.auth.login({ username: 'rec_amal', password: 'recPassword123' })
  await mechClient.omega.auth.login({ username: 'mech_kasun', password: 'mechPassword123' })
  await billClient.omega.auth.login({ username: 'bill_nimal', password: 'billPassword123' })

  const unauthorizedClients = [
    { label: 'unauthenticated', client: unauthClient, expectedErr: 'authentication required' },
    { label: 'receptionist_service_advisor', client: recClient, expectedErr: 'access denied' },
    { label: 'mechanic', client: mechClient, expectedErr: 'access denied' },
    { label: 'inventory_billing', client: billClient, expectedErr: 'access denied' }
  ]

  const userCountBeforeAttacks = dbHelper.queryOne('SELECT COUNT(*) AS count FROM users').count
  const ownerHashBeforeAttacks = getPasswordHash(owner.id)

  for (const { label, client, expectedErr } of unauthorizedClients) {
    // 4a. Listing users
    await expectReject(
      () =>
        client.invokeRaw('auth:getUsers', {
          userId: owner.id,
          callerUserId: owner.id,
          role: 'admin_owner',
          currentUser: { id: owner.id, role: 'admin_owner', isActive: 1 }
        }),
      expectedErr,
      `${label} must be denied auth:getUsers even with forged admin payload`
    )

    // 4b. Creating user
    await expectReject(
      () =>
        client.invokeRaw('auth:createUser', {
          username: `forged_${label}`,
          password: 'password123',
          displayName: 'Forged User',
          role: 'admin_owner',
          userId: owner.id,
          callerUserId: owner.id,
          currentUser: { id: owner.id, role: 'admin_owner', isActive: 1 }
        }),
      expectedErr,
      `${label} must be denied auth:createUser even with forged admin payload`
    )

    // 4c. Updating user role / active status
    await expectReject(
      () =>
        client.invokeRaw('auth:updateUser', {
          id: mechanicUser.id,
          data: { role: 'admin_owner', isActive: 0 },
          userId: owner.id,
          callerUserId: owner.id,
          role: 'admin_owner',
          currentUser: { id: owner.id, role: 'admin_owner', isActive: 1 }
        }),
      expectedErr,
      `${label} must be denied auth:updateUser even with forged admin payload`
    )

    // 4d. Resetting another user's password
    await expectReject(
      () =>
        client.invokeRaw('auth:changePassword', {
          id: owner.id,
          newPassword: 'hackedPassword999',
          userId: owner.id,
          callerUserId: owner.id,
          role: 'admin_owner',
          currentUser: { id: owner.id, role: 'admin_owner', isActive: 1 }
        }),
      expectedErr,
      `${label} must be denied resetting another user's password even with forged admin payload`
    )
  }

  // Confirm zero database mutations occurred during all unauthorized attempts
  const userCountAfterAttacks = dbHelper.queryOne('SELECT COUNT(*) AS count FROM users').count
  assert.strictEqual(userCountAfterAttacks, userCountBeforeAttacks, 'User count must remain unchanged')
  const mechRowAfterAttacks = dbHelper.queryOne('SELECT role, is_active FROM users WHERE id = ?', [mechanicUser.id])
  assert.strictEqual(mechRowAfterAttacks.role, 'mechanic', 'Mechanic role must remain unchanged')
  assert.strictEqual(mechRowAfterAttacks.is_active, 1, 'Mechanic active flag must remain unchanged')
  assert.strictEqual(getPasswordHash(owner.id), ownerHashBeforeAttacks, 'Owner password hash must remain unchanged')
  console.log('✓ Test 4 Passed')

  // =========================================================================
  // 5. Invalid role updates/creations are rejected without changing data
  // =========================================================================
  console.log('Test 5: Invalid roles (e.g., supervisor, superadmin, empty) are rejected without changing data')
  for (const invalidRole of ['supervisor', 'superadmin', 'owner', '']) {
    await expectReject(
      () =>
        adminClient.omega.auth.createUser({
          username: `bad_role_${invalidRole || 'empty'}`,
          password: 'password123',
          displayName: 'Invalid Role User',
          role: invalidRole
        }),
      invalidRole ? 'invalid role' : 'required',
      `createUser with invalid role "${invalidRole}" must be rejected`
    )

    await expectReject(
      () =>
        adminClient.omega.auth.updateUser(mechanicUser.id, {
          displayName: 'Should Not Persist',
          role: invalidRole
        }),
      'invalid role',
      `updateUser with invalid role "${invalidRole}" must be rejected`
    )
  }

  const mechAfterInvalidRole = dbHelper.queryOne(
    'SELECT display_name, role, is_active FROM users WHERE id = ?',
    [mechanicUser.id]
  )
  assert.strictEqual(mechAfterInvalidRole.display_name, 'Kasun Mechanic', 'Display name must not change on failed role update')
  assert.strictEqual(mechAfterInvalidRole.role, 'mechanic', 'Role must not change on failed role update')
  console.log('✓ Test 5 Passed')

  // =========================================================================
  // 6. Logout invalidates the session; re-login works
  // =========================================================================
  console.log('Test 6: Logout invalidates the session; re-login restores access')
  const logoutRes = await adminClient.omega.auth.logout()
  assert.strictEqual(logoutRes.success, true)

  await expectReject(
    () => adminClient.omega.auth.getUsers(),
    'authentication required',
    'getUsers must fail after logout'
  )
  await expectReject(
    () =>
      adminClient.omega.auth.createUser({
        username: 'after_logout',
        password: 'password123',
        displayName: 'After Logout',
        role: 'mechanic'
      }),
    'authentication required',
    'createUser must fail after logout'
  )

  const reloginOwner = await adminClient.omega.auth.login({
    username: 'owner_admin',
    password: 'ownerPassword123'
  })
  assert.strictEqual(reloginOwner.id, owner.id)
  const usersAfterRelogin = await adminClient.omega.auth.getUsers()
  assert.strictEqual(usersAfterRelogin.length, 5)
  console.log('✓ Test 6 Passed')

  // =========================================================================
  // 7. A deactivated or demoted session loses admin privileges immediately
  // =========================================================================
  console.log('Test 7: Demoted or deactivated admin session immediately loses privileges')
  const secondAdmin = await adminClient.omega.auth.createUser({
    username: 'co_owner',
    password: 'coOwnerPassword123',
    displayName: 'Co-Owner Admin',
    role: 'admin_owner'
  })

  const coOwnerClient = ipcEnv.createPreloadClient(ipcEnv.createMockWebContents())
  await coOwnerClient.omega.auth.login({
    username: 'co_owner',
    password: 'coOwnerPassword123'
  })
  assert.strictEqual((await coOwnerClient.omega.auth.getUsers()).length, 6)

  // Demote co_owner to receptionist_service_advisor while coOwnerClient session is still open
  await adminClient.omega.auth.updateUser(secondAdmin.id, {
    role: 'receptionist_service_advisor'
  })

  await expectReject(
    () => coOwnerClient.omega.auth.getUsers(),
    'access denied',
    'Demoted session must immediately lose admin access to getUsers'
  )
  await expectReject(
    () =>
      coOwnerClient.omega.auth.createUser({
        username: 'ghost_user',
        password: 'password123',
        displayName: 'Ghost User',
        role: 'mechanic'
      }),
    'access denied',
    'Demoted session must immediately lose admin access to createUser'
  )

  // Promote co_owner back to admin_owner, verify access returns, then deactivate co_owner
  await adminClient.omega.auth.updateUser(secondAdmin.id, {
    role: 'admin_owner',
    isActive: 1
  })
  assert.strictEqual((await coOwnerClient.omega.auth.getUsers()).length, 6)

  await adminClient.omega.auth.updateUser(secondAdmin.id, {
    isActive: 0
  })

  await expectReject(
    () => coOwnerClient.omega.auth.getUsers(),
    'inactive',
    'Deactivated session must immediately lose access to getUsers'
  )
  await expectReject(
    () => coOwnerClient.omega.auth.changePassword(secondAdmin.id, 'newPass1234', 'coOwnerPassword123'),
    'authentication required',
    'Evicted deactivated session must remain unauthenticated on subsequent calls'
  )
  console.log('✓ Test 7 Passed')

  // =========================================================================
  // 8. The last active owner cannot be removed from the admin role or deactivated
  // =========================================================================
  console.log('Test 8: Last active admin_owner cannot be demoted or deactivated')
  // Note: secondAdmin is currently inactive (isActive = 0), so owner is the sole active admin_owner
  await expectReject(
    () =>
      adminClient.omega.auth.updateUser(owner.id, {
        role: 'receptionist_service_advisor'
      }),
    'last active',
    'Demoting the last active owner must be rejected'
  )

  await expectReject(
    () =>
      adminClient.omega.auth.updateUser(owner.id, {
        isActive: 0
      }),
    'last active',
    'Deactivating the last active owner must be rejected'
  )

  const ownerRowAfterSelfChangeAttempts = dbHelper.queryOne(
    'SELECT role, is_active FROM users WHERE id = ?',
    [owner.id]
  )
  assert.strictEqual(ownerRowAfterSelfChangeAttempts.role, 'admin_owner')
  assert.strictEqual(ownerRowAfterSelfChangeAttempts.is_active, 1)

  // Updating displayName of the last active owner while keeping role=admin_owner & isActive=1 still works
  const renamedOwner = await adminClient.omega.auth.updateUser(owner.id, {
    displayName: 'Primary Station Owner (Verified)'
  })
  assert.strictEqual(renamedOwner.displayName, 'Primary Station Owner (Verified)')
  assert.strictEqual(renamedOwner.role, 'admin_owner')
  assert.strictEqual(renamedOwner.isActive, 1)
  console.log('✓ Test 8 Passed')

  // =========================================================================
  // 9. Password resets obey the chosen policy; unauthorized attempts leave password unchanged
  // =========================================================================
  console.log('Test 9: Password reset & self-service change policy enforcement')
  const mechHashInitial = getPasswordHash(mechanicUser.id)
  const recHashInitial = getPasswordHash(receptionistUser.id)

  // 9a. Non-admin cannot use unrestricted { id, newPassword } on their own account without currentPassword
  await expectReject(
    () => mechClient.omega.auth.changePassword(mechanicUser.id, 'newMechPass999'),
    'current password is required',
    'Non-admin self password change without currentPassword must be rejected'
  )
  assert.strictEqual(getPasswordHash(mechanicUser.id), mechHashInitial, 'Mechanic password hash must remain unchanged')

  // 9b. Non-admin cannot change their own password with wrong currentPassword
  await expectReject(
    () => mechClient.omega.auth.changePassword(mechanicUser.id, 'newMechPass999', 'wrongCurrentPassword'),
    'current password is incorrect',
    'Non-admin self password change with wrong currentPassword must be rejected'
  )
  assert.strictEqual(getPasswordHash(mechanicUser.id), mechHashInitial, 'Mechanic password hash must remain unchanged')

  // 9c. Non-admin cannot change another user's password even when providing their own valid currentPassword
  await expectReject(
    () => mechClient.omega.auth.changePassword(receptionistUser.id, 'hackedRecPass', 'mechPassword123'),
    'only an administrator',
    'Non-admin must not reset another user password even with valid own currentPassword'
  )
  assert.strictEqual(getPasswordHash(receptionistUser.id), recHashInitial, 'Receptionist password hash must remain unchanged')

  // 9d. Non-admin CAN change their own password when providing valid currentPassword
  const selfChangeRes = await mechClient.omega.auth.changePassword(
    mechanicUser.id,
    'mechUpdatedPass456',
    'mechPassword123'
  )
  assert.strictEqual(selfChangeRes.success, true)
  assert.notStrictEqual(getPasswordHash(mechanicUser.id), mechHashInitial, 'Mechanic password hash should be updated')

  // Verify mechanic can log in with the new password and old password fails
  const mechReloginClient = ipcEnv.createPreloadClient(ipcEnv.createMockWebContents())
  await expectReject(
    () => mechReloginClient.omega.auth.login({ username: 'mech_kasun', password: 'mechPassword123' }),
    'invalid username or password',
    'Old mechanic password must no longer work'
  )
  const mechRelogin = await mechReloginClient.omega.auth.login({
    username: 'mech_kasun',
    password: 'mechUpdatedPass456'
  })
  assert.strictEqual(mechRelogin.id, mechanicUser.id)

  // 9e. Active admin_owner CAN reset another user's password without currentPassword
  const adminResetRes = await adminClient.omega.auth.changePassword(
    receptionistUser.id,
    'adminResetRecPass789'
  )
  assert.strictEqual(adminResetRes.success, true)
  assert.notStrictEqual(getPasswordHash(receptionistUser.id), recHashInitial)

  const recReloginClient = ipcEnv.createPreloadClient(ipcEnv.createMockWebContents())
  const recRelogin = await recReloginClient.omega.auth.login({
    username: 'rec_amal',
    password: 'adminResetRecPass789'
  })
  assert.strictEqual(recRelogin.id, receptionistUser.id)
  console.log('✓ Test 9 Passed')

  // =========================================================================
  // 10. Non-admin Settings does not break because it requests protected staff data
  // =========================================================================
  console.log('Test 10: Non-admin Settings loads station settings and backups without requesting protected staff data')
  const fetchSettingsScreenData = loadFetchSettingsScreenDataFromSource()

  let getUsersCalledForNonAdmin = false
  const spiedMechOmega = {
    ...mechClient.omega,
    auth: {
      ...mechClient.omega.auth,
      getUsers: async (...args) => {
        getUsersCalledForNonAdmin = true
        return mechClient.omega.auth.getUsers(...args)
      }
    }
  }

  const nonAdminSettingsData = await fetchSettingsScreenData(spiedMechOmega, {
    id: mechanicUser.id,
    username: mechanicUser.username,
    displayName: mechanicUser.displayName,
    role: 'mechanic'
  })

  assert.strictEqual(getUsersCalledForNonAdmin, false, 'Non-admin Settings must not call window.omega.auth.getUsers()')
  assert.strictEqual(nonAdminSettingsData.isAdmin, false)
  assert.deepStrictEqual(nonAdminSettingsData.users, [])
  assert.strictEqual(
    nonAdminSettingsData.settings.station_name,
    'Omega Engineers Service Station',
    'General settings must still load for non-admin'
  )
  assert.ok(Array.isArray(nonAdminSettingsData.backups), 'Backups list must still load for non-admin')
  assert.ok(Array.isArray(nonAdminSettingsData.auditLogs), 'Audit logs must still load for non-admin')

  // Even if client UI state had a stale/forged admin_owner role on a non-admin session,
  // main-process IPC rejects auth:getUsers and Settings catches it gracefully without breaking settings/backups
  const staleRoleSettingsData = await fetchSettingsScreenData(mechClient.omega, {
    id: mechanicUser.id,
    username: mechanicUser.username,
    displayName: mechanicUser.displayName,
    role: 'admin_owner'
  })
  assert.deepStrictEqual(staleRoleSettingsData.users, [], 'Main process must deny staff list to non-admin session')
  assert.strictEqual(
    staleRoleSettingsData.settings.station_name,
    'Omega Engineers Service Station',
    'Settings screen data must not break even if getUsers is rejected by main process'
  )

  // Admin Settings loads full staff list properly
  const adminSettingsData = await fetchSettingsScreenData(adminClient.omega, loggedInOwner)
  assert.strictEqual(adminSettingsData.isAdmin, true)
  assert.strictEqual(adminSettingsData.users.length, 6)
  console.log('✓ Test 10 Passed')

  console.log('======================================================================')
  console.log('ALL SCRUM-10 ADMIN USER MANAGEMENT ACCEPTANCE TESTS PASSED!')
  console.log('======================================================================')
}

runAcceptanceTests()
  .catch((err) => {
    console.error('SCRUM-10 ACCEPTANCE TEST FAILED:', err)
    process.exitCode = 1
  })
  .finally(() => {
    try {
      dbHelper.closeDb()
      fs.rmSync(testRootDir, { recursive: true, force: true })
    } catch (_) {}
  })
