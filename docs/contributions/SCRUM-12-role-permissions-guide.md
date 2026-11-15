# SCRUM-12 / US-UM-03: Implementation Guide — Configure Role Permissions by Module

> **Target Audience:** HH / Antigravity Agent  
> **Course / Project:** EER4189 Software Design in Group — Omega Engineers Service Station (SSMS)  
> **Jira Issue:** `SCRUM-12` (`US-UM-03: Configure role permissions by module`)  
> **Objective:** Enforce Granular Role-Based Access Control (RBAC) across UI navigation, screen routing, and main-process IPC services based on authenticated user roles.

---

## 1. Executive Context & Current State

### Current System Architecture
The application defines 4 user roles in SQLite (`src/database/schema.sql`):
1. `admin_owner` (Owner / Station Manager)
2. `receptionist_service_advisor` (Receptionist / Service Advisor)
3. `mechanic` (Workshop Technician)
4. `inventory_billing` (Inventory & Cashier / Billing Staff)

### Current Limitation (What Needs Fixing)
- `SCRUM-10` implemented admin authentication, PBKDF2 hashing, and user creation security in `authService.cjs`.
- However, in `src/renderer/components/Sidebar.jsx` and `src/renderer/App.jsx`, **all 9 navigation tabs are rendered unconditionally** for any logged-in user.
- Any logged-in mechanic or receptionist can currently open financial reports, billing, or system settings.
- In `src/main/ipc/`, handlers like `reports.ipc.cjs`, `backup.ipc.cjs`, and `expenses.ipc.cjs` do not check the caller's role.

---

## 2. Role-Based Module Permission Matrix

Use this matrix as the single source of truth:

| Module / Tab ID | Display Name | `admin_owner` | `receptionist_service_advisor` | `mechanic` | `inventory_billing` |
| :--- | :--- | :---: | :---: | :---: | :---: |
| `dashboard` | Dashboard Overview | ✅ Full | ✅ Reception View | ✅ Technician View | ✅ Billing View |
| `jobcards` | Job Cards & Tasks | ✅ Full | ✅ Create & View | ✅ View & Update Tasks | ✅ Issue Parts |
| `appointments` | Appointments & Calendar | ✅ Full | ✅ Full Booking | ❌ Denied | ❌ Denied |
| `customers` | Customers & Vehicles | ✅ Full | ✅ Full Intake | ❌ Denied | ✅ View Only |
| `inventory` | Spare Parts Inventory | ✅ Full | ❌ Denied | ❌ Denied | ✅ Full Control |
| `mechanics` | Workshop Mechanics | ✅ Full | ✅ View Availability | ✅ View Roster | ❌ Denied |
| `invoices` | Billing & Payments | ✅ Full | ❌ Denied | ❌ Denied | ✅ Full Control |
| `reports` | Financial & Sales Reports | ✅ Full | ❌ Denied | ❌ Denied | ❌ Denied (Admin Only) |
| `settings` | System Settings & Backup | ✅ Full | ⚠️ Self Password Only | ⚠️ Self Password Only | ⚠️ Self Password Only |

---

## 3. Step-by-Step Implementation Instructions for Antigravity

### Step 1: Create Centralized Permission Definitions

Create a shared configuration file at `src/renderer/utils/permissions.js`:

```javascript
export const MODULE_PERMISSIONS = {
  dashboard: ['admin_owner', 'receptionist_service_advisor', 'mechanic', 'inventory_billing'],
  jobcards: ['admin_owner', 'receptionist_service_advisor', 'mechanic', 'inventory_billing'],
  appointments: ['admin_owner', 'receptionist_service_advisor'],
  customers: ['admin_owner', 'receptionist_service_advisor', 'inventory_billing'],
  inventory: ['admin_owner', 'inventory_billing'],
  mechanics: ['admin_owner', 'receptionist_service_advisor', 'mechanic'],
  invoices: ['admin_owner', 'inventory_billing'],
  reports: ['admin_owner'],
  settings: ['admin_owner', 'receptionist_service_advisor', 'mechanic', 'inventory_billing'] // Non-admins only see "Change Password"
}

export const canAccessModule = (role, moduleId) => {
  if (!role) return false
  if (role === 'admin_owner') return true
  const allowed = MODULE_PERMISSIONS[moduleId] || []
  return allowed.includes(role)
}

export const getDefaultTabForRole = (role) => {
  switch (role) {
    case 'mechanic':
      return 'jobcards'
    case 'inventory_billing':
      return 'inventory'
    case 'receptionist_service_advisor':
      return 'appointments'
    default:
      return 'dashboard'
  }
}
```

---

### Step 2: Filter Navigation in `src/renderer/components/Sidebar.jsx`

1. Import `canAccessModule` from `../utils/permissions`.
2. Filter `NAV_ITEMS` before rendering:

```javascript
const userRole = currentUser?.role || ''
const visibleNavItems = NAV_ITEMS.filter((item) => canAccessModule(userRole, item.id))
```

3. Render `visibleNavItems.map(...)` instead of `NAV_ITEMS.map(...)`.
4. Ensure the user badge at the bottom clearly indicates the user's formatted role.

---

### Step 3: Enforce Route Guards in `src/renderer/App.jsx`

1. If a user tries to access a tab they are not permitted to see (e.g., via direct navigation or quick actions), guard it:

```javascript
import { canAccessModule, getDefaultTabForRole } from './utils/permissions'

// Inside App component:
const userRole = currentUser?.role || ''

// Fallback if current activeTab is unauthorized
useEffect(() => {
  if (currentUser && !canAccessModule(currentUser.role, activeTab)) {
    setActiveTab(getDefaultTabForRole(currentUser.role))
  }
}, [currentUser, activeTab])
```

2. In `handleQuickAction`:
   - Block `new_appointment` if `!canAccessModule(userRole, 'appointments')`.
   - Block `new_job` if `!canAccessModule(userRole, 'jobcards')`.

3. Display an **"Access Restricted"** fallback if an unauthorized tab is somehow loaded:

```javascript
{!canAccessModule(userRole, activeTab) ? (
  <div style={{ textAlign: 'center', padding: '80px', color: 'var(--text-muted)' }}>
    <h2>Access Restricted</h2>
    <p>Your user role ({userRole}) does not have permission to view this module.</p>
  </div>
) : (
  /* Existing activeTab rendering */
)}
```

---

### Step 4: Backend IPC Authorization Checks

In the main process, prevent renderer IPC tampering for sensitive modules:

1. **`src/main/ipc/reports.ipc.cjs`**:
   - Check `authService.requireAdminCaller(callerContext)` or verify session role before returning `dailySummary`, `salesReport`, or `financials`.
2. **`src/main/ipc/backup.ipc.cjs`**:
   - Ensure database backups and restore operations require `admin_owner`.
3. **`src/main/ipc/expenses.ipc.cjs`**:
   - Limit expense recording and modification to `admin_owner` or `inventory_billing`.

---

### Step 5: Author Automated Unit & Acceptance Tests

Create `tests/role-permissions.test.cjs`:

```javascript
// Test Matrix to verify:
// 1. admin_owner can access all 9 modules.
// 2. mechanic can access only ['dashboard', 'jobcards', 'mechanics', 'settings'].
// 3. receptionist can access appointments, customers, jobcards, mechanics; blocked from inventory, reports, invoices.
// 4. inventory_billing can access inventory, invoices, jobcards, customers; blocked from reports, appointments.
// 5. Unauthenticated callers are rejected from all protected IPC handlers.
```

Run test suite:
```powershell
node tests/role-permissions.test.cjs
```

---

## 4. Acceptance Criteria for Closing SCRUM-12

To mark `SCRUM-12` as **Done** in Jira:
- [ ] Sidebar navigation only displays modules authorized for the logged-in role.
- [ ] Direct navigation to restricted screens displays the "Access Restricted" message or redirects to the role's default view.
- [ ] Reports and Backup/Restore are strictly blocked for non-admin staff.
- [ ] All tests in `tests/role-permissions.test.cjs` pass with 0 errors.
- [ ] Pull request is created, reviewed by the team, and merged to `main`.
