# 1. WW (Pathum) — Full Code Review, Bug Fixes, Features & UI/UX Tasks

- **Developer**: Pathum (`WW` — Blue/Teal Avatar on Jira)
- **Git Author**: `Comadu68 <pathum15333@gmail.com>`
- **Recommended Sub-Branch**: `fix/ww-pathum-auth-appointments-fifo-billing`
- **Existing Unmerged Branches by Pathum**:
  - `origin/feature/scrum-17-appointments` (`bff4c69`)
  - `feature/browser-dev-mode` (`2c5c0b8`, `4ae6ad8`)

---

## 1. Assigned Jira Stories (Sprint 0, Sprint 1 & Backlog)

| Jira Key | Story Code | Summary | Current Codebase Reality |
| :--- | :--- | :--- | :--- |
| **SCRUM-11** | `US-UM-02` | Multi-user login & PBKDF2 hashing | Core PBKDF2 hashing works, **HOWEVER `src/main/ipc/auth.ipc.cjs` has a fatal syntax error on `main` line 211**, and session validation has a dual-session mismatch between `auth.ipc.cjs` and `authService.cjs`. |
| **SCRUM-17** | `US-JC-02` | Schedule service appointment & block double-booking | Basic slot-capacity check (`maxAppointmentsPerSlot`) works, **but** past dates are allowed, the same vehicle can be booked multiple times on the same day, `appointments.ipc.cjs` has zero role checks, `no_show` status is missing in the UI, and your calendar capacity bar commits (`bff4c69`) are not merged into `main`. |
| **SCRUM-26** | `US-INV-03` | Auto-stock deduction on Job Card issue | FIFO deduction works when adding a part, **but** cancelling a job card does **NOT** restore consumed parts back to `inventory_batches`, parts can still be added/removed after a job card is `completed`/invoiced, and FIFO cost/margin is exposed to all roles. |
| **SCRUM-31** | `US-BILL-01` | Auto-generate bill on job card closure | **Not wired automatically**: marking a job card `completed` does not auto-generate or prompt invoice creation, and invoices can currently be generated even when a job card is still `pending` or `in_progress`. |

---

## 2. Primary Files Owned by Your Sub-Branch

To avoid merge conflicts with Madara, Prabodha, and Bhagya, focus your commits on these files:
1. `src/main/ipc/auth.ipc.cjs`
2. `src/main/services/authService.cjs`
3. `src/main/ipc/appointments.ipc.cjs`
4. `src/main/services/appointmentService.cjs`
5. `src/renderer/pages/Appointments.jsx`
6. `src/main/services/jobService.cjs` *(FIFO stock deduction/restoration & status-to-billing lifecycle hooks)*
7. `src/main/services/invoiceService.cjs` *(Invoice auto-generation validation & discount guard)*
8. `tests/auth-admin-access.test.cjs` & `tests/appointments-fifo-billing.test.cjs` *(new/updated tests)*

---

## 3. Critical Bugs & Fixes Assigned to WW (Pathum)

### Bug WW-01 (CRITICAL — BLOCKER): Syntax Error in `src/main/ipc/auth.ipc.cjs:211` crashes Electron & Auth Tests
- **What happens**: Running `node tests/auth-admin-access.test.cjs` or starting the Electron backend on `main` crashes immediately:
  ```text
  src/main/ipc/auth.ipc.cjs:211
      });
       ^
  SyntaxError: Unexpected token ')'
  ```
- **Root Cause**: Line 210 closes `ipcMain.handle('auth:deactivateUser', ...)`, and line 211 has a stray duplicate `});`.
- **Exact Fix**:
  - In `src/main/ipc/auth.ipc.cjs`, remove the extra `});` at line 211 (you already fixed this on `feature/browser-dev-mode` — cherry-pick or apply it cleanly to your branch).
  - Verify by running `node tests/auth-admin-access.test.cjs`.

---

### Bug WW-02 (CRITICAL — SECURITY / RBAC): Dual Session Tracking Mismatch & Stale Role Checks in `authService.cjs`
- **Why Non-Admins Can Bypass or Lose Session Context**:
  1. `src/main/ipc/auth.ipc.cjs` maintains a `Map` (`sessionsBySenderId`) keyed by `event.sender.id`, whereas `src/main/services/authService.cjs` maintains a separate singleton `currentSessionUser`.
  2. In `authService.cjs:71-86`, `requireRole(allowedRoles)` only checks the in-memory `currentSessionUser` without re-verifying against the SQLite `users` table (`is_active = 1` and current `role`), unlike `requireAdminCaller()` which calls `getAuthenticatedCaller()`.
  3. If an Admin deactivates a user (`auth:deactivateUser`) or changes their role (`auth:updateUser`), `currentSessionUser` stays active if that user is logged in, and `requireRole()` still trusts the old in-memory role.
- **Exact Fix in `src/main/services/authService.cjs`**:
  1. Update `requireRole(allowedRoles, callerContext = null)` so it calls `getAuthenticatedCaller(callerContext)` first (just like `requireAdminCaller`), ensuring the user still exists in the DB, has `is_active === 1`, and uses the **live database role** (`user.role`) before calling `hasAnyRole(user.role, allowedRoles)`.
  2. In `deactivateUser(id)` and `updateUser(id, data)`: if `currentSessionUser && currentSessionUser.id === Number(id)` and the user was deactivated (`isActive === false`), clear `currentSessionUser = null`.

---

### Bug WW-03 (HIGH — SECURITY / RBAC): `src/main/ipc/appointments.ipc.cjs` Has Zero Permission Checks
- **What happens**: Any user role (including `mechanic` or `inventory_billing`) can invoke `window.omega.appointments.create()`, `update()`, or `updateStatus()` via IPC because `appointments.ipc.cjs` never calls `authService.requireRole(...)`.
- **Exact Fix in `src/main/ipc/appointments.ipc.cjs`**:
  - Import `authService = require('../services/authService.cjs')`.
  - Allow read operations (`appointments:list`, `appointments:getById`, `appointments:checkSlot`, `appointments:todayCount`) for authenticated roles `['admin_owner', 'receptionist_service_advisor', 'mechanic']`.
  - Restrict write operations (`appointments:create`, `appointments:update`, `appointments:updateStatus`) using:
    ```js
    authService.requireRole(['admin_owner', 'receptionist_service_advisor']);
    ```

---

### Bug WW-04 (HIGH — BUSINESS LOGIC, `SCRUM-17`): Past-Date Booking & Same-Vehicle Duplicate Appointment in `appointmentService.cjs`
- **What happens**:
  1. `appointmentService.create()` (`src/main/services/appointmentService.cjs:66`) allows scheduling an appointment for a past date (e.g., `2020-01-01`).
  2. `appointmentService.create()` and `update()` only check if total bookings in the time slot exceed `max_appointments_per_slot` (default `3`). They do **not** check if the **same vehicle (`vehicleId`)** already has an active (`scheduled`) appointment in the same slot or on the same date!
- **Exact Fix in `src/main/services/appointmentService.cjs`**:
  1. Validate that `appointmentDate` is today or in the future (`appointmentDate >= new Date().toISOString().split('T')[0]`) when creating a new appointment.
  2. Before inserting/updating, query `appointments` to ensure the same `vehicle_id` does not already have an active (`status = 'scheduled'`) appointment at the same `appointment_date` and `appointment_time`:
     ```sql
     SELECT id FROM appointments
     WHERE vehicle_id = ? AND appointment_date = ? AND appointment_time = ?
       AND status != 'cancelled' AND id != ?
     ```
     If found, throw `new Error('This vehicle already has an active appointment scheduled for this date and time slot.')`.

---

### Bug WW-05 (CRITICAL — INVENTORY INTEGRITY, `SCRUM-26`): Cancelling a Job Card Does Not Restore Consumed FIFO Stock
- **What happens**:
  - When a part is added to a Job Card via `jobService.addPart()` (`src/main/services/jobService.cjs:265`), stock is immediately deducted from `inventory_batches.quantity_remaining` using FIFO.
  - However, in `jobService.updateStatus(id, status)` (`src/main/services/jobService.cjs:212`), if a Job Card is changed to `'cancelled'`, the status is simply updated to `'cancelled'` **without returning the consumed `job_parts` back to `inventory_batches`**! Those parts vanish from stock forever.
- **Exact Fix in `src/main/services/jobService.cjs`**:
  1. Wrap `updateStatus(id, status)` in `db.transaction(...)`.
  2. When transitioning a job card to `status === 'cancelled'` (from a non-cancelled status):
     - Check if a non-void invoice exists for this job card (`SELECT id, invoice_number FROM invoices WHERE job_card_id = ? AND status != 'void'`). If so, throw an error instructing the user to void the invoice first (or auto-block cancellation).
     - Query all `job_parts` for `job_card_id = id`, call `inventoryService.restorePartQty(part.batch_id, part.quantity)` for each row, and delete the `job_parts` rows (or mark them returned) so stock is 100% restored to the exact FIFO batches.

---

### Bug WW-06 (HIGH — DATA INTEGRITY, `SCRUM-26` & `SCRUM-31`): Parts & Tasks Can Be Modified After Job Card Is Completed or Invoiced
- **What happens**:
  - In `jobService.cjs`, `addTask()`, `updateTask()`, `deleteTask()`, `addPart()`, and `removePart()` do not check whether the Job Card is already `'completed'`, `'cancelled'`, or already has an active invoice in `invoices`.
  - If someone adds or removes a FIFO part after the invoice was generated, the Job Card total changes while the Invoice total stays frozen at the old amount!
- **Exact Fix in `src/main/services/jobService.cjs`**:
  - Create a helper `assertJobEditable(jobCardId)` and call it at the start of `addTask`, `updateTask`, `deleteTask`, `addPart`, and `removePart`:
    - Fetch the job card's `status` and check if an active (`status != 'void'`) invoice exists.
    - If `status === 'completed'` or `status === 'cancelled'` or an active invoice exists, throw `new Error('Cannot modify tasks or spare parts on a completed, cancelled, or invoiced Job Card.')`.

---

### Bug WW-07 (MEDIUM — BILLING MATH, `SCRUM-31`): Invoice Generation Allows Discount > Subtotal & Allows Invoicing Unfinished Jobs
- **What happens**:
  - In `src/main/services/invoiceService.cjs:66` (`generate(jobCardId, discount = 0, notes = '')`):
    1. `discount` is not validated (`discount < 0` or `discount > subtotal` can produce a negative invoice total or corrupt balances).
    2. `generate()` does not verify that `job.status` is `'completed'` (or automatically transition the job card to `'completed'` inside the transaction when generating the bill).
- **Exact Fix in `src/main/services/invoiceService.cjs`**:
  1. Validate `const discountAmount = Number(discount || 0); if (!Number.isFinite(discountAmount) || discountAmount < 0 || discountAmount > subtotal) throw new Error('Discount must be between 0 and the invoice subtotal.');`
  2. Reject invoice generation if `job.status === 'cancelled'`, and if `job.status !== 'completed'`, automatically mark `job_cards.status = 'completed'` and `completed_at = datetime('now','localtime')` within the same `generate()` transaction.

---

## 4. Features to Add (Assigned to WW — Pathum)

### Feature WW-F1 (`SCRUM-31` / `US-BILL-01`): Auto-Generate Bill on Job Card Closure
- **Requirement**: When a Job Card is closed (`status` changed to `'completed'`), the system should automatically generate the draft/unpaid Invoice (if one doesn't already exist) or seamlessly trigger the invoice generation modal so no completed job goes unbilled.
- **Implementation**:
  1. In `src/main/services/jobService.cjs` (`updateStatus`): When `status === 'completed'`, verify that the job card has at least one task or part, and return metadata indicating whether an active invoice already exists (`hasInvoice`).
  2. Coordinate with `JobCardDetail.jsx`: When status transitions to `'completed'` and no invoice exists yet, automatically open the **Generate Invoice** modal (`showInvoiceModal = true`) pre-filled with the calculated labour + FIFO parts subtotal, or auto-generate the invoice with `discount = 0` if configured.
  3. Lock the `+ Add Task`, `Remove Task`, `+ Consume Part (FIFO)`, and `Return Part` buttons whenever `job.status === 'completed' || job.status === 'cancelled' || job.invoice`.

### Feature WW-F2 (`SCRUM-17` / `US-JC-02`): Merge & Complete Appointment Calendar Capacity Visualization + `No-Show` Status
- **Requirement**:
  1. Cherry-pick/merge your commit `bff4c69` (`origin/feature/scrum-17-appointments`) into your branch so the Monthly Calendar displays visual capacity progress bars (`totalBookings / dailyCapacity`) and hover tooltips per day.
  2. Add support for the `'no_show'` status in `src/renderer/pages/Appointments.jsx` (the database `CHECK (status IN ('scheduled', 'completed', 'cancelled', 'no_show'))` already supports `'no_show'`, and `STATUS_BADGE` in `Appointments.jsx:6` already defines `no_show`, but there is no button to mark a missed appointment as **No-Show**!).
  3. When an appointment is marked `no_show` or `cancelled`, it should free up the slot capacity so another customer can book that time slot ( update `appointmentService.checkSlotAvailability` to check `status NOT IN ('cancelled', 'no_show')`).

### Feature WW-F3 (`SCRUM-26` / `US-INV-03`): Batch Breakdown Preview Before FIFO Deduction
- **Requirement**: When selecting a part to consume on a Job Card, show the user which FIFO batch(es) will be used (e.g. `Oldest Batch #12 @ LKR 4,500 — 6 in stock`) before they submit the modal so they can see if a multi-batch split will occur.

---

## 5. UI & UX Improvements (Assigned to WW — Pathum)

1. **`Appointments.jsx` — Prevent Past Dates in Date Picker & Role-Gate Action Buttons**:
   - Add `min={new Date().toISOString().split('T')[0]}` on the Appointment Date `<input type="date" />` inside the Book / Edit Appointment modal so receptionists cannot accidentally pick past dates.
   - Accept `currentUser` as a prop in `Appointments.jsx` (or read role helper) and hide `+ Book Appointment`, `Edit`, `Cancel`, `No-Show`, and `🔧 Job Card` buttons if `currentUser.role === 'mechanic'` (Mechanics should have a clean read-only view of incoming appointments).
   - Add a `No-Show` button next to `Cancel` for `scheduled` appointments whose date/time has passed.
2. **`JobCardDetail.jsx` — Hide Confidential FIFO Cost & Profit Margin from Non-Authorized Roles**:
   - In `src/renderer/pages/JobCardDetail.jsx` lines 533–548, the **"Parts FIFO Batch Cost (COGS)"** and **"Gross Parts Margin"** banner is currently displayed to everyone (including Mechanics and Receptionists, and even if `Customer View` is off).
   - Restrict the COGS & Gross Margin box so it is **only rendered when `!customerView && (currentUser?.role === 'admin_owner' || currentUser?.role === 'inventory_billing')`**.
   - In the Parts table (`JobCardDetail.jsx:474`), hide the `FIFO Cost (Batch)` column (`p.unit_cost_at_use`) from `mechanic` and `receptionist_service_advisor` roles.

---

## 6. Git Sub-Branch & Verification Checklist for Pathum

```powershell
# 1. Create your dedicated sub-branch from main
git checkout main
git pull origin main
git checkout -b fix/ww-pathum-auth-appointments-fifo-billing

# 2. Cherry-pick your calendar enhancement commit from your remote branch
git cherry-pick bff4c69

# 3. After implementing the fixes above, run the test suites and build:
node tests/auth-admin-access.test.cjs
node tests/integration.test.cjs
npm.cmd run build

# 4. Stage, commit, and push your sub-branch
git add src/main/ipc/auth.ipc.cjs src/main/services/authService.cjs src/main/ipc/appointments.ipc.cjs src/main/services/appointmentService.cjs src/main/services/jobService.cjs src/main/services/invoiceService.cjs src/renderer/pages/Appointments.jsx tests/
git commit -m "fix(SCRUM-11,17,26,31): fix auth.ipc syntax, appointment validation, FIFO cancellation restore, and auto-billing"
git push -u origin fix/ww-pathum-auth-appointments-fifo-billing
```
