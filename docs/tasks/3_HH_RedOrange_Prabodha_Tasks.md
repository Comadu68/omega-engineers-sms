# 3. HH Red-Orange (Prabodha) — Full Code Review, Bug Fixes, Features & UI/UX Tasks

- **Developer**: Prabodha (`HH` — Red-Orange Avatar on Jira)
- **Git Author**: `Dilshh2000 <prabodhadilshan2000@gmail.com>`
- **Recommended Sub-Branch**: `fix/hh-prabodha-users-customers-jobs-payments`
- **Existing Branches by Prabodha**:
  - `fix/SCRUM-10-admin-user-management` (merged to `main`)
  - `feature/scrum-16-customer-validation` (merged to `main`)

---

## 1. Assigned Jira Stories (Sprint 0, Sprint 1 & Backlog)

| Jira Key | Story Code | Summary | Current Codebase Reality |
| :--- | :--- | :--- | :--- |
| **SCRUM-10** | `US-UM-01` | Admin creates user accounts & roles | Working (`authService.createUser` & `Settings.jsx` staff modal), **but** needs clean integration with account activation/deactivation (`SCRUM-14`) and role editing safeguards. |
| **SCRUM-13** | `US-UM-04` | Change own password | Backend `authService.changeOwnPassword` works, **but** needs strength feedback in UI and depends on fixing the Settings load error for non-admins. |
| **SCRUM-14** | `US-UM-05` | Deactivate user account | Backend `auth:deactivateUser` exists, **but** `Settings.jsx` has no dedicated Deactivate/Activate button or confirmation dialog in the Staff Accounts table (requires opening the Edit modal), and there is no guard preventing an Admin from changing their own role away from `admin_owner`. |
| **SCRUM-16** | `US-JC-01` | Customer intake & quick search | Customer search & phone validation work, **HOWEVER**: (1) `inventory_billing` can create/edit customers & vehicles even though `SCRUM-12` specifies **View Only** for `inventory_billing`, (2) `customers.ipc.cjs` and `vehicles.ipc.cjs` have zero RBAC checks, and (3) there is no UI in `Customers.jsx` to Edit or Delete a registered vehicle! |
| **SCRUM-18** | `US-JC-03` | Create Job Card linked to appointment | Works, **but** `jobs.ipc.cjs` and `JobCards.jsx` allow Mechanics and Billing staff to create/cancel Job Cards, and recording `odometer` on a Job Card never updates `vehicles.mileage`! |
| **SCRUM-19** | `US-JC-04` | Assign mechanic to job card | Works, **but** allows assigning `off_duty` mechanics without warning, does not automatically set an assigned mechanic's status to `'busy'`, and does not release mechanic status back to `'available'` when their last active job completes. |
| **SCRUM-32** | `US-BILL-02` | Record payments & installments | Basic payment insert works, **CRITICAL BUGS**: `paymentService.record()` allows recording payments on `'void'` invoices, allows **overpayment (`payAmount > invoice.balance`)**, uses weak `parseFloat` validation, and `payments.ipc.cjs` has zero RBAC checks! |
| **SCRUM-34** | `US-BILL-04` | Review outstanding due payments list | **Missing dedicated feature**: `Invoices.jsx` only filters single statuses (`unpaid` OR `partially_paid` separately). There is no combined **Outstanding Due Payments** view showing all customers with `balance > 0`, aging/days overdue, customer phone numbers, and installment payment history. |

---

## 2. Primary Files Owned by Your Sub-Branch

To avoid merge conflicts with Pathum, Madara, and Bhagya, focus your commits on these files:
1. `src/main/ipc/customers.ipc.cjs` & `src/main/services/customerService.cjs`
2. `src/main/ipc/vehicles.ipc.cjs` & `src/main/services/vehicleService.cjs`
3. `src/renderer/pages/Customers.jsx`
4. `src/main/ipc/jobs.ipc.cjs`
5. `src/renderer/pages/JobCards.jsx`
6. `src/main/ipc/payments.ipc.cjs` & `src/main/services/paymentService.cjs`
7. `src/main/ipc/invoices.ipc.cjs`
8. `src/renderer/pages/Invoices.jsx`
9. `tests/customer-validation.test.cjs` & `tests/payments-billing.test.cjs` *(new test suite for `SCRUM-32` & `SCRUM-34`)*

---

## 3. Critical Bugs & Fixes Assigned to HH Red-Orange (Prabodha)

### Bug HP-01 (CRITICAL — FINANCIAL BUG, `SCRUM-32`): `paymentService.record()` Allows Overpayments and Payments on Voided Invoices
- **What happens**:
  - Look at `src/main/services/paymentService.cjs:17-57`:
    1. It checks `if (!invoice) throw new Error('Invoice not found')`, but **never checks `if (invoice.status === 'void')`** or `if (invoice.status === 'paid')`!
    2. It checks `const payAmount = parseFloat(amount); if (isNaN(payAmount) || payAmount <= 0)`, which allows partial garbage strings like `"500abc"` (`parseFloat("500abc") === 500`) and allows **`payAmount > invoice.balance`**!
    3. If an invoice has a balance of `LKR 5,000` and someone enters `LKR 50,000`, `paymentService.record()` accepts the `50,000` payment into `payments` and clamps `balance = 0`, corrupting daily cash/card revenue reports (`reportService.dailySummary` sums `payments.amount`!).
- **Exact Fix in `src/main/services/paymentService.cjs`**:
  1. Block void or already-paid invoices:
     ```js
     if (invoice.status === 'void') {
         throw new Error('Cannot record payment against a voided invoice.');
     }
     if (invoice.status === 'paid' || Number(invoice.balance) <= 0) {
         throw new Error('This invoice is already fully paid.');
     }
     ```
  2. Strict numeric validation and overpayment guard (using cent-level rounding `Math.round(val * 100)` to avoid floating-point drift):
     ```js
     const rawStr = String(amount ?? '').trim();
     const payAmount = Number(rawStr);
     if (!rawStr || !Number.isFinite(payAmount) || payAmount <= 0) {
         throw new Error('Payment amount must be a valid positive number.');
     }
     const currentBalance = Math.round(Number(invoice.balance) * 100) / 100;
     if (Math.round(payAmount * 100) > Math.round(currentBalance * 100)) {
         throw new Error(`Payment amount (LKR ${payAmount.toLocaleString()}) cannot exceed the remaining invoice balance (LKR ${currentBalance.toLocaleString()}).`);
     }
     ```
  3. Validate `paymentMethod` against `['cash', 'card', 'bank_transfer', 'cheque']`.

---

### Bug HP-02 (CRITICAL — SECURITY / RBAC): Missing Backend IPC Role Guards in `customers.ipc.cjs`, `vehicles.ipc.cjs`, `jobs.ipc.cjs`, `invoices.ipc.cjs`, and `payments.ipc.cjs`
- **Why Users Can Do Anything**:
  - Currently, none of these 5 IPC files call `authService.requireRole(...)`!
- **Exact Fix**:
  1. **`src/main/ipc/customers.ipc.cjs` & `src/main/ipc/vehicles.ipc.cjs`**:
     - Read operations (`list`, `getById`, `search`, `getVehicles`, `getJobHistory`, `getByCustomer`, `getServiceHistory`):
       `authService.requireRole(['admin_owner', 'receptionist_service_advisor', 'inventory_billing', 'mechanic'])`
     - Write operations (`create`, `update`, `remove`):
       `authService.requireRole(['admin_owner', 'receptionist_service_advisor'])` *(blocks `inventory_billing` and `mechanic` from mutating customer/vehicle records per `SCRUM-12`!)*.
  2. **`src/main/ipc/jobs.ipc.cjs`**:
     - `jobs:create`, `jobs:update`, `jobs:assignMechanic`, `jobs:unassignMechanic`:
       `authService.requireRole(['admin_owner', 'receptionist_service_advisor'])`
     - `jobs:updateStatus`, `jobs:addTask`, `jobs:updateTask`, `jobs:deleteTask`:
       `authService.requireRole(['admin_owner', 'receptionist_service_advisor', 'mechanic'])`
     - `jobs:addPart`, `jobs:removePart`:
       `authService.requireRole(['admin_owner', 'inventory_billing', 'mechanic'])`
  3. **`src/main/ipc/invoices.ipc.cjs` & `src/main/ipc/payments.ipc.cjs`**:
     - `invoices:generate`: `authService.requireRole(['admin_owner', 'inventory_billing', 'receptionist_service_advisor'])`
     - `invoices:cancel` (void): `authService.requireRole(['admin_owner'])` *(only Admin should void an issued tax/service invoice!)*
     - `payments:record`: `authService.requireRole(['admin_owner', 'inventory_billing'])`

---

### Bug HP-03 (HIGH — UI RBAC, `SCRUM-16` & `SCRUM-18`): `Customers.jsx` and `JobCards.jsx` Show Create/Edit Buttons to Unauthorized Roles
- **What happens**:
  - In `src/renderer/pages/Customers.jsx`: `inventory_billing` can click `+ Add Customer`, `Edit`, and `+ Add Vehicle`, violating the `SCRUM-12` requirement that `inventory_billing` has **View Only** access to Customers.
  - In `src/renderer/pages/JobCards.jsx`: `mechanic` and `inventory_billing` can click `+ New Job Card` to open new job cards.
- **Exact Fix**:
  - In `Customers.jsx`: Accept `currentUser` prop. Define `const canEditCustomers = currentUser?.role === 'admin_owner' || currentUser?.role === 'receptionist_service_advisor';`. Hide `+ Add Customer`, `Edit`, and `+ Add Vehicle` when `!canEditCustomers`.
  - In `JobCards.jsx`: Accept `currentUser` prop. Hide `+ New Job Card` unless `currentUser?.role === 'admin_owner' || currentUser?.role === 'receptionist_service_advisor'`.

---

### Bug HP-04 (MEDIUM — WORKFLOW SYNC, `SCRUM-18` & `SCRUM-19`): Vehicle Odometer & Mechanic Availability Status Out of Sync
- **What happens**:
  1. When a Job Card is created (`jobService.create`) with an `odometer` reading (e.g., `65,000 km`), `vehicles.mileage` is never updated (`vehicleService.updateMileage` is never called).
  2. When a mechanic is assigned to a job card (`jobService.assignMechanic`), `mechanics.status` is set to `'busy'`, **but** if the mechanic is currently `'off_duty'` or inactive (`is_active = 0`), `assignMechanic` still assigns them without validation! Also, when a mechanic is unassigned (`unassignMechanic`) or the job card is marked `'completed'`/`'cancelled'`, the mechanic stays stuck on `'busy'` forever even if they have `0` remaining active jobs.
- **Exact Fix**:
  1. In `jobService.create` (or `vehicleService`): If `data.odometer` is provided and greater than the vehicle's current `mileage`, automatically update `vehicles.mileage = Number(data.odometer)`.
  2. In `jobService.assignMechanic`: Block assigning an inactive mechanic (`is_active = 0`) or `'off_duty'` mechanic (`throw new Error('Cannot assign an off-duty or inactive mechanic to a job card.')`).
  3. When a job card is completed/cancelled or a mechanic is unassigned, check if the mechanic has any other active (`pending`/`in_progress`) jobs; if `0`, automatically set `mechanics.status = 'available'` (unless `'off_duty'`).

---

### Bug HP-05 (MEDIUM — ADMIN SAFETY, `SCRUM-10` & `SCRUM-14`): Admin Can Demote Their Own Account Role in `authService.updateUser`
- **What happens**:
  - `authService.deactivateUser()` blocks self-deactivation (`Number(id) === Number(adminCaller.id)`), **but** `authService.updateUser(id, data)` allows the currently logged-in Admin to change their own `role` to `'mechanic'` or set `isActive = false`, locking themselves out of Admin access immediately!
- **Exact Fix in `src/main/services/authService.cjs`**:
  - In `updateUser(id, data, callerContext)`: if `Number(id) === Number(adminCaller.id)`:
    - Block setting `isActive === false` (`throw new Error('You cannot deactivate your own account.')`).
    - Block changing `data.role` away from `'admin_owner'` (`throw new Error('You cannot demote your own admin role.')`).

---

## 4. Features to Add (Assigned to HH Red-Orange — Prabodha)

### Feature HP-F1 (`SCRUM-34` / `US-BILL-04` & `SCRUM-32` / `US-BILL-02`): Outstanding Due Payments Dashboard & Installment History in `Invoices.jsx`
- **Requirement**: Billing staff and Admin need to review an **Outstanding Due Payments List** (`unpaid` + `partially_paid` invoices with `balance > 0`) and track multi-installment payments clearly.
- **Implementation**:
  1. **KPI Summary Cards at top of `src/renderer/pages/Invoices.jsx`**:
     - **Total Outstanding Receivables (`LKR`)**: Sum of `balance` across all `unpaid` and `partially_paid` invoices.
     - **Outstanding Invoices Count**: Number of invoices with `balance > 0` (`X Unpaid`, `Y Partially Paid`).
     - **Total Collected (`LKR`)**: Sum of `paid_amount` across non-void invoices.
  2. **Dedicated `"⚠️ Outstanding Dues"` Filter Tab in `Invoices.jsx`**:
     - Add an `"⚠️ Outstanding Dues"` filter chip alongside `All`, `Paid`, `Partially Paid`, and `Unpaid` that filters all invoices where `status === 'unpaid' || status === 'partially_paid'` (sorted by oldest due / highest balance).
     - Show **Customer Phone** and **Days Since Issued** (`Math.floor((Date.now() - new Date(inv.created_at)) / 86400000) days ago`) so billing clerks can follow up with customers who owe balances.
  3. **Installment History Drawer / Modal in `Invoices.jsx`**:
     - When clicking **Pay** or a new **`📋 Installments`** button on an invoice, fetch `window.omega.payments.getByInvoice(inv.id)` and display the table of previous installments (Date, Amount, Method, Reference, Recorded By) right inside the Payment Modal, plus quick buttons for **`Full Balance`** and **`50% Installment`**.

### Feature HP-F2 (`SCRUM-16` / `US-JC-01`): Vehicle Edit & Delete Controls + Clickable Job History in `Customers.jsx`
- **Requirement**: `vehicleService.cjs` already implements `vehicles:update` and `vehicles:remove`, and `Customers.jsx` accepts `onNavigateToJob`, **but neither is wired in the UI**!
- **Implementation in `src/renderer/pages/Customers.jsx`**:
  1. Inside the Customer Detail modal's **Registered Vehicles** list (`Customers.jsx:200`), add **`✏️ Edit`** and **`🗑️ Delete`** buttons on each vehicle row (visible when `canEditCustomers` is true) so typos in license plates, make/model, year, or mileage can be fixed.
  2. Inside the **Service History** list (`Customers.jsx:209`), make each Job Card row clickable (`onClick={() => { setShowDetail(null); onNavigateToJob?.(j.id); }}`) so clicking a historical job jumps straight to that Job Card!

### Feature HP-F3 (`SCRUM-14` / `US-UM-05`): One-Click Activate / Deactivate User Toggle in Staff Accounts Table (`Settings.jsx`)
- **Requirement**: Allow Admin to quickly deactivate or reactivate a staff account from the Staff Accounts table (`SCRUM-14`) with a confirmation dialog, using `window.omega.auth.deactivateUser(u.id)` or `updateUser`.

---

## 5. UI & UX Improvements (Assigned to HH Red-Orange — Prabodha)

1. **Searchable Customer Picker in `JobCards.jsx` (`+ New Job Card` Modal)**:
   - Currently `JobCards.jsx:204` uses a plain `<select>` for customers, which becomes hard to use with many customers. Add a quick search filter input (by customer name, phone, or plate number) above or inside the customer selector in the New Job Card modal.
2. **Void Invoice Action for Admin (`Invoices.jsx`)**:
   - `window.omega.invoices.cancel(id)` exists in preload and backend, but there is no `Void` button in `Invoices.jsx`. Add a `🚫 Void` button (visible only to `admin_owner` on `unpaid` invoices) with confirmation.

---

## 6. Git Sub-Branch & Verification Checklist for Prabodha

```powershell
# 1. Create your dedicated sub-branch from main
git checkout main
git pull origin main
git checkout -b fix/hh-prabodha-users-customers-jobs-payments

# 2. After implementing the fixes above, run the test suites and build:
node tests/customer-validation.test.cjs
node tests/integration.test.cjs
npm.cmd run build

# 3. Stage, commit, and push your sub-branch
git add src/main/ipc/customers.ipc.cjs src/main/ipc/vehicles.ipc.cjs src/main/ipc/jobs.ipc.cjs src/main/ipc/invoices.ipc.cjs src/main/ipc/payments.ipc.cjs src/main/services/paymentService.cjs src/renderer/pages/Customers.jsx src/renderer/pages/JobCards.jsx src/renderer/pages/Invoices.jsx tests/
git commit -m "fix(SCRUM-14,16,18,19,32,34): enforce IPC RBAC, prevent overpayment, add outstanding dues view and vehicle edit UI"
git push -u origin fix/hh-prabodha-users-customers-jobs-payments
```
