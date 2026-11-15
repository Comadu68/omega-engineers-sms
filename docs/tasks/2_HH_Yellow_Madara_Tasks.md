# 2. HH Yellow (Madara) — Full Code Review, Bug Fixes, Features & UI/UX Tasks

- **Developer**: Madara (`HH` — Yellow/Amber Avatar on Jira)
- **Git Author**: `MPawan230 <madarapawan230@gmail.com>`
- **Recommended Sub-Branch**: `fix/hh-madara-rbac-mechanics-workflow`
- **Existing Branch by Madara**:
  - `feature/scrum-12-role-permissions` (merged to `main` via PR #2)

---

## 1. Assigned Jira Stories (Sprint 0, Sprint 1 & Backlog)

| Jira Key | Story Code | Summary | Current Codebase Reality |
| :--- | :--- | :--- | :--- |
| **SCRUM-12** | `US-UM-03` | Configure role permissions by module | Sidebar tab visibility works (`canAccessModule`), **HOWEVER users can still do anything inside shared pages and via IPC** because action-level RBAC (`canPerformAction`) is missing, `currentUser` is not passed to child pages, and `Settings.jsx` crashes the Vite build AND throws `Access Denied` for non-admin users! |
| **SCRUM-20** | `US-JC-05` | Update repair status progress | Mechanics can only toggle a binary checkbox (`pending` ↔ `completed`) on tasks; there is no `in_progress` task state, and starting a task does not auto-advance the Job Card from `pending` to `in_progress`. |
| **SCRUM-21** | `US-JC-06` | Close job card & trigger billing | Any role (even a Mechanic!) can change job status to `completed` or `cancelled`, and closing a job card does not validate unfinished tasks or smoothly hand off to billing. |
| **SCRUM-22** | `US-JC-07` | Maintain mechanic list (CRUD) | Create, Read, Update, and Status toggle exist, **but** there is no Deactivate/Delete mechanic option, no phone validation, no link to `users.id`, and **Mechanics/Receptionists can currently register and edit mechanics** because RBAC is missing in `Mechanics.jsx` and `mechanics.ipc.cjs`. |
| **SCRUM-15** | `US-UM-06` | View user activity audit logs | Only login/user actions write to `audit_log`; critical job/billing/inventory/settings mutations are not logged, `settings:getAuditLogs` has no admin IPC guard, and the UI has no filter/search on audit logs. |

---

## 2. Primary Files Owned by Your Sub-Branch

To avoid merge conflicts with Pathum, Prabodha, and Bhagya, focus your commits on these files:
1. `src/shared/permissions.cjs` & `src/renderer/utils/permissions.js`
2. `src/renderer/App.jsx` *(pass `currentUser` to all pages)*
3. `src/renderer/pages/Settings.jsx` *(fix build syntax errors + fix non-admin `Access Denied` crash + audit log filters)*
4. `src/renderer/pages/Dashboard.jsx` *(role-gate quick actions & cards)*
5. `src/renderer/pages/Mechanics.jsx`
6. `src/main/services/mechanicService.cjs` & `src/main/ipc/mechanics.ipc.cjs`
7. `src/main/services/settingsService.cjs` & `src/main/ipc/settings.ipc.cjs`
8. `src/renderer/pages/JobCardDetail.jsx` *(repair task progress `SCRUM-20`, close job card workflow `SCRUM-21`, and action-level RBAC gating)*
9. `tests/role-permissions.test.cjs`

---

## 3. Critical Bugs & Fixes Assigned to HH Yellow (Madara)

### Bug HM-01 (CRITICAL — BUILD BLOCKER): `src/renderer/pages/Settings.jsx` Fails Production Build (`npm run build`)
- **What happens**: Running `npm.cmd run build` fails with two compile errors in `src/renderer/pages/Settings.jsx`:
  1. **Line 252**: `const isAdmin = currentUser?.role === 'admin_owner';` is declared a **second time** in the same component scope (already declared at line 33).
  2. **Line 629**: Missing closing `</div>` for `<div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '20px' }}>` (opened at line 336) right before `)}` at line 629.
- **Exact Fix in `src/renderer/pages/Settings.jsx`**:
  - Remove the duplicate `const isAdmin = ...` at line 252.
  - Add the missing `</div>` before `)}` at line 629.
  - Verify `npm.cmd run build` succeeds with zero errors.

---

### Bug HM-02 (CRITICAL — RBAC BUG): Non-Admin Users Get "Access Denied" Error Banner When Opening `Settings.jsx`
- **What happens**:
  - In `src/shared/permissions.cjs`, `settings` is accessible to all 4 roles so any staff member can change their own password (`SCRUM-13`).
  - However, in `src/renderer/pages/Settings.jsx:7-18`, `fetchSettingsScreenData` unconditionally executes:
    ```js
    const [allSettings, backupList, logs] = await Promise.all([
        omegaApi.settings.getAll(),
        omegaApi.backup.list(),
        omegaApi.settings.getAuditLogs({ limit: 30 }),
    ]);
    ```
  - Because `backup:list` calls `authService.requireAdminCaller()`, `Promise.all` **always rejects with `Access denied: Admin privileges required.`** whenever a Receptionist, Mechanic, or Inventory/Billing user opens the Settings tab!
- **Exact Fix in `src/renderer/pages/Settings.jsx`**:
  - Pass `isAdmin` into `fetchSettingsScreenData(omegaApi, isAdmin)`.
  - If `!isAdmin`, do **not** call `omegaApi.backup.list()` or `omegaApi.settings.getAuditLogs()`; return `{ allSettings: {}, backupList: [], logs: [] }` immediately so non-admin users only see their **Account Security (Change Own Password)** card without any error toast!

---

### Bug HM-03 (CRITICAL — ROOT CAUSE OF "USERS CAN DO ANYTHING, NOT ONLY ADMIN"): Missing Action-Level Permissions (`canPerformAction`) Across Shared Modules
- **Root Cause Analysis**:
  - Right now, `src/shared/permissions.cjs` only defines **page-level** visibility (`ROLE_PERMISSIONS` -> `canAccessModule(role, moduleKey)`).
  - Once a user opens a shared tab (`dashboard`, `jobs`, `mechanics`, `customers`, `appointments`), **the UI shows every single Create / Edit / Delete / Billing / Status button to everyone**, and `App.jsx` only passes `currentUser` to `Settings.jsx`!
  - Specifically:
    - A **Mechanic** can create/cancel Job Cards, reassign mechanics, delete tasks, consume FIFO inventory parts, override part prices, generate invoices, and register/edit other Mechanics!
    - A **Receptionist** can consume FIFO parts, override part prices, generate invoices, and register/edit Mechanics!
    - An **Inventory/Billing** user can create/cancel Job Cards, assign mechanics, mark repair tasks done, and create/edit Customers & Vehicles!
- **Exact Fix**:
  1. **Define Action-Level Permissions in `src/shared/permissions.cjs` (and re-export in `src/renderer/utils/permissions.js`)**:
     Add an explicit `ACTION_PERMISSIONS` map and `canPerformAction(role, actionKey)` helper:
     ```js
     const ACTION_PERMISSIONS = Object.freeze({
         // Job Cards (SCRUM-18, 19, 20, 21, 26, 31)
         'jobs:create': ['admin_owner', 'receptionist_service_advisor'],
         'jobs:cancel': ['admin_owner', 'receptionist_service_advisor'],
         'jobs:assign_mechanic': ['admin_owner', 'receptionist_service_advisor'],
         'jobs:manage_tasks': ['admin_owner', 'receptionist_service_advisor', 'mechanic'],
         'jobs:update_task_progress': ['admin_owner', 'mechanic', 'receptionist_service_advisor'],
         'jobs:consume_parts': ['admin_owner', 'inventory_billing', 'mechanic'],
         'jobs:override_part_price': ['admin_owner', 'inventory_billing'],
         'jobs:view_part_cost': ['admin_owner', 'inventory_billing'],
         'jobs:complete': ['admin_owner', 'receptionist_service_advisor', 'mechanic'],
         'jobs:generate_invoice': ['admin_owner', 'inventory_billing', 'receptionist_service_advisor'],

         // Customers & Vehicles (SCRUM-16: inventory_billing is VIEW ONLY!)
         'customers:write': ['admin_owner', 'receptionist_service_advisor'],
         'vehicles:write': ['admin_owner', 'receptionist_service_advisor'],

         // Appointments (SCRUM-17: mechanic is VIEW ONLY!)
         'appointments:write': ['admin_owner', 'receptionist_service_advisor'],

         // Mechanics Roster (SCRUM-22: only Admin can create/edit/deactivate mechanics!)
         'mechanics:manage': ['admin_owner'],
         'mechanics:update_status': ['admin_owner', 'mechanic'],

         // Inventory & Suppliers (SCRUM-24, 25, 28, 29)
         'inventory:write': ['admin_owner', 'inventory_billing'],

         // Invoices & Payments (SCRUM-31, 32, 33, 34)
         'invoices:write': ['admin_owner', 'inventory_billing'],
         'payments:record': ['admin_owner', 'inventory_billing'],

         // Settings & Audit Logs (SCRUM-10, 14, 15)
         'settings:manage': ['admin_owner'],
     });
     ```
  2. **Pass `currentUser` to All Pages in `src/renderer/App.jsx`**:
     In `App.jsx:117-129`, pass `currentUser={currentUser}` to `<Dashboard />`, `<Customers />`, `<Appointments />`, `<JobCards />`, `<Mechanics />`, `<Inventory />`, `<Invoices />`, `<Expenses />`, `<Reports />`, and `<Settings />`.
  3. **Gate `Dashboard.jsx` Quick Actions (`src/renderer/pages/Dashboard.jsx`)**:
     - Hide `+ Receive Batch` on Low-Stock alerts unless `canAccessModule(currentUser.role, 'inventory')`.
     - Hide `Open Job Card ->` on Today's Appointments unless `canPerformAction(currentUser.role, 'jobs:create')`.
     - Hide section header navigation buttons (`Manage Stock ->`, `Calendar ->`, `View Roster ->`) if `!canAccessModule(currentUser.role, targetModule)`.

---

### Bug HM-04 (HIGH — SECURITY / RBAC): `Mechanics.jsx`, `mechanics.ipc.cjs`, and `settings.ipc.cjs` Lack Role Checks
- **What happens**:
  - In `src/renderer/pages/Mechanics.jsx`: `+ Register New Mechanic`, `✏️` Edit Mechanic, and the status selector (`available`, `busy`, `off_duty`) are open to all roles who can view the page (`admin_owner`, `receptionist_service_advisor`, `mechanic`).
  - In `src/main/ipc/mechanics.ipc.cjs`: No `authService.requireRole` calls exist at all.
  - In `src/main/ipc/settings.ipc.cjs`: `settings:update`, `settings:updateMultiple`, and `settings:getAuditLogs` have **zero** admin checks! Any logged-in user can overwrite station settings or read the admin audit log via IPC.
- **Exact Fix**:
  1. In `src/main/ipc/settings.ipc.cjs`:
     - Allow `settings:get` and `settings:getAll` for any authenticated user (needed for invoice header / appointment settings).
     - Add `authService.requireAdminCaller()` at the top of `settings:update`, `settings:updateMultiple`, and `settings:getAuditLogs`.
  2. In `src/main/ipc/mechanics.ipc.cjs`:
     - Require `authService.requireRole(['admin_owner'])` on `mechanics:create`, `mechanics:update`, and `mechanics:deactivate` (new).
     - Require `authService.requireRole(['admin_owner', 'mechanic'])` on `mechanics:updateStatus`.
  3. In `src/renderer/pages/Mechanics.jsx`:
     - Only show `+ Register New Mechanic`, `✏️` Edit button, and `Deactivate` button when `canPerformAction(currentUser?.role, 'mechanics:manage')` (`admin_owner`).
     - Only enable the availability `<select>` (`available` / `busy` / `off_duty`) for `admin_owner` or `mechanic` (make it a read-only status badge for `receptionist_service_advisor`).

---

### Bug HM-05 (MEDIUM — SQL BUG, `SCRUM-22`): `mechanicService.getAll()` Overcounts `active_jobs_count`
- **What happens**:
  - In `src/main/services/mechanicService.cjs:8`, the query uses:
    ```sql
    COUNT(CASE WHEN j.status IN ('pending', 'in_progress') THEN 1 END) AS active_jobs_count
    ```
  - If a mechanic was assigned, unassigned, and reassigned to the same job card, `job_assignments` has multiple rows for the same `j.id`, inflating `active_jobs_count`.
- **Exact Fix in `src/main/services/mechanicService.cjs`**:
  - Use `COUNT(DISTINCT CASE WHEN j.status IN ('pending', 'in_progress') AND ja.unassigned_at IS NULL THEN j.id END) AS active_jobs_count`.

---

## 4. Features to Add (Assigned to HH Yellow — Madara)

### Feature HM-F1 (`SCRUM-20` / `US-JC-05`): Multi-Stage Repair Task Progress & Auto-Status Progression
- **Requirement**: Mechanics need to update repair status progress on assigned Job Cards (`pending` -> `in_progress` -> `completed`), not just a binary checkbox.
- **Implementation**:
  1. In `src/renderer/pages/JobCardDetail.jsx`:
     - Replace or enhance the task status control so each task in `job_tasks` can be cycled or selected across `'pending'` (`⏳ Pending`), `'in_progress'` (`🔧 In Progress`), and `'completed'` (`✅ Completed`).
     - Display a visual **Repair Progress Bar** above the tasks table showing `completedTasks / totalTasks` percentage and count of `in_progress` tasks.
  2. In `src/main/services/jobService.cjs` (`updateTask`):
     - When a task is marked `'in_progress'` or `'completed'` and the parent Job Card is still in `'pending'` status, automatically update `job_cards.status = 'in_progress'` so the workshop board immediately reflects that repair work has started!

### Feature HM-F2 (`SCRUM-21` / `US-JC-06`): Close Job Card & Trigger Billing Button
- **Requirement**: Provide a dedicated **"Complete & Close Job Card"** workflow action that validates repair readiness and triggers billing.
- **Implementation in `src/renderer/pages/JobCardDetail.jsx`**:
  - Add a prominent **`✅ Complete Job & Trigger Bill`** button when `job.status === 'in_progress'` (or `'pending'`).
  - If any tasks in `job.tasks` are still `'pending'` or `'in_progress'`, show a confirmation prompt (or warning) asking whether to mark remaining tasks completed before closing the job card.
  - Once confirmed, transition status to `'completed'` and automatically open the Invoice Generation modal (for Admin/Billing/Receptionist) or notify that the job is ready for billing.
  - Enforce RBAC in `JobCardDetail.jsx` using `canPerformAction(currentUser?.role, ...)`:
    - Hide `Cancel` job card and `Assign Mechanic` from `mechanic` and `inventory_billing`.
    - Hide `Override Price` input in the Consume Part modal from `mechanic` and `receptionist_service_advisor`.

### Feature HM-F3 (`SCRUM-22` / `US-JC-07`): Complete Mechanic CRUD (Deactivate/Reactivate, Phone Validation & User Account Link)
- **Requirement**: Full CRUD for the Mechanic Roster.
- **Implementation**:
  1. In `src/main/services/mechanicService.cjs`:
     - Validate `phone` using `normalizeSriLankanPhone(data.phone)` (from `src/main/utils/phoneUtils.cjs`) when creating or updating a mechanic.
     - Add `setActiveStatus(id, isActive)` (or `deactivate(id)`) to soft-delete/deactivate mechanics (`UPDATE mechanics SET is_active = ?, status = CASE WHEN ? = 0 THEN 'off_duty' ELSE status END WHERE id = ?`), blocking deactivation if the mechanic currently has active (`pending`/`in_progress`) assigned jobs.
     - Support optional `list({ includeInactive: true })` so Admin can view and reactivate inactive mechanics.
  2. In `src/renderer/pages/Mechanics.jsx`:
     - Add a **Show Inactive Mechanics** toggle for `admin_owner` and a **Deactivate / Reactivate** button on each mechanic card.

### Feature HM-F4 (`SCRUM-15` / `US-UM-06`): Comprehensive Audit Logging & Filterable Audit Log Viewer
- **Requirement**: Record and filter user activity audit logs across modules.
- **Implementation**:
  1. In `src/main/services/settingsService.cjs`:
     - Add a reusable `logAudit(action, entityType, entityId, details, userId)` helper (or call `authService.getCurrentSession()?.id`) and log key mutations in `settingsService.update`, `mechanicService.create/update/deactivate`, etc.
     - Enhance `getAuditLogs({ limit, action, userId, search })` to support filtering by action type or search text.
  2. In `src/renderer/pages/Settings.jsx`:
     - Add a search input and action filter dropdown to the **Audit Log** card so Admins can filter activity logs by staff member or action (`login`, `create_user`, `update_settings`, etc.).

---

## 5. UI & UX Improvements (Assigned to HH Yellow — Madara)

1. **Role Badge & Permission Feedback in `JobCardDetail.jsx` & `Mechanics.jsx`**:
   - Show clear read-only badges when a role is viewing a section they cannot mutate (e.g., show mechanic status as a styled badge for Receptionists instead of a clickable `<select>`).
2. **Interactive Repair Progress Bar (`JobCardDetail.jsx`)**:
   - Add a color-coded progress bar (`0% -> 100%`) at the top of the Service Tasks card with status pills (`Pending`, `In Progress`, `Completed`) so mechanics and advisors can see repair completion at a glance.

---

## 6. Git Sub-Branch & Verification Checklist for Madara

```powershell
# 1. Create your dedicated sub-branch from main
git checkout main
git pull origin main
git checkout -b fix/hh-madara-rbac-mechanics-workflow

# 2. After implementing the fixes above, run the test suites and build:
node tests/role-permissions.test.cjs
node tests/integration.test.cjs
npm.cmd run build

# 3. Stage, commit, and push your sub-branch
git add src/shared/permissions.cjs src/renderer/utils/permissions.js src/renderer/App.jsx src/renderer/pages/Settings.jsx src/renderer/pages/Dashboard.jsx src/renderer/pages/Mechanics.jsx src/renderer/pages/JobCardDetail.jsx src/main/services/mechanicService.cjs src/main/ipc/mechanics.ipc.cjs src/main/services/settingsService.cjs src/main/ipc/settings.ipc.cjs tests/role-permissions.test.cjs
git commit -m "fix(SCRUM-12,15,20,21,22): enforce action-level RBAC, fix Settings build & crash, complete mechanic CRUD and task progress"
git push -u origin fix/hh-madara-rbac-mechanics-workflow
```
