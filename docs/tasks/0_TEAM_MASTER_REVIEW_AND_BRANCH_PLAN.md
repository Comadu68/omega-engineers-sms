# Omega Engineers SMS — Full Software Review, Test Audit & 4-Person Jira Sub-Branch Plan

## 1. Automated Test & Build Audit Results (Current `main` Branch)

| Suite / Command | Result on `main` | Root Cause / Details | Assigned To Fix |
| :--- | :--- | :--- | :--- |
| `node tests/integration.test.cjs` | ✅ **PASSED** (`11/11`) | Core SQLite schema, FIFO batch math, invoice & payment happy-path pass. | All |
| `node tests/customer-validation.test.cjs` | ✅ **PASSED** (`7/7`) | Sri Lankan phone normalization & duplicate phone prevention pass. | Prabodha (`HH Red-Orange`) |
| `node tests/inventory-validation.test.cjs` | ✅ **PASSED** (`9/9`) | Inventory SKU, category, and negative stock guards pass. | Bhagya (`BH`) |
| `node tests/role-permissions.test.cjs` | ✅ **PASSED** (`6/6`) | Module-level `canAccessModule` passes, **but** action-level permissions & IPC guards are missing. | Madara (`HH Yellow`) |
| `node tests/auth-admin-access.test.cjs` | ❌ **FAILED (CRASH)** | `SyntaxError: Unexpected token ')'` at `src/main/ipc/auth.ipc.cjs:211` (duplicate closing `});`). | Pathum (`WW`) |
| `npm.cmd run build` (`vite build`) | ❌ **FAILED (COMPILE)** | `src/renderer/pages/Settings.jsx`: duplicate `const isAdmin` at line 252 + missing closing `</div>` before line 629. | Madara (`HH Yellow`) |

---

## 2. Root-Cause Analysis: Why "Users Can Do Anything, Not Only Admin"

During our full code review of `src/main/ipc/*.cjs`, `src/shared/permissions.cjs`, and `src/renderer/pages/*.jsx`, we found **4 exact reasons** why non-admin users (Receptionists, Mechanics, Inventory/Billing) can perform unauthorized actions:

1. **Missing Action-Level Permissions in Shared Screens (`src/renderer/pages/*.jsx`)**:
   - `src/shared/permissions.cjs` only hides sidebar tabs (`canAccessModule`), and `src/renderer/App.jsx` **only passes `currentUser` to `<Settings />`**!
   - Child pages (`Dashboard.jsx`, `JobCards.jsx`, `JobCardDetail.jsx`, `Mechanics.jsx`, `Customers.jsx`, `Appointments.jsx`, `Inventory.jsx`, `Invoices.jsx`) do not check `currentUser.role`.
   - As a result:
     - **Inside Job Cards (`JobCards.jsx` & `JobCardDetail.jsx`)**: A **Mechanic** can create/cancel job cards, reassign jobs to other mechanics, delete tasks, consume FIFO inventory parts, override part selling prices, view confidential wholesale FIFO costs & profit margins, and generate customer invoices!
     - **Inside Mechanics (`Mechanics.jsx`)**: Any **Mechanic** or **Receptionist** can register new mechanics (`+ Register New Mechanic`), edit any mechanic's profile, and change any mechanic's availability status.
     - **Inside Customers (`Customers.jsx`)**: **Inventory/Billing** staff can create/edit customers and add vehicles, even though `SCRUM-12` specifies **View Only** access for `inventory_billing`.
     - **Inside Dashboard (`Dashboard.jsx`)**: Quick-action buttons (`+ Receive Batch`, `Open Job Card ->`, `Manage Stock ->`, `View Roster ->`) are rendered for all roles regardless of permissions.
2. **9 out of 13 Backend IPC Files Have ZERO Role/Session Checks (`src/main/ipc/*.cjs`)**:
   - `appointments.ipc.cjs`, `customers.ipc.cjs`, `vehicles.ipc.cjs`, `jobs.ipc.cjs`, `mechanics.ipc.cjs`, `inventory.ipc.cjs`, `invoices.ipc.cjs`, and `payments.ipc.cjs` have **no `authService.requireRole(...)` guards at all**.
   - `settings.ipc.cjs` has **no `authService.requireAdminCaller()` guard** on `settings:update`, `settings:updateMultiple`, or `settings:getAuditLogs`.
3. **Non-Admin Crash on `Settings.jsx`**:
   - When any non-admin opens `Settings` to change their own password (`SCRUM-13`), `fetchSettingsScreenData` in `Settings.jsx:7-11` unconditionally calls `omegaApi.backup.list()`, which throws `Access denied: Admin privileges required.`!
4. **Dual Session State Mismatch (`auth.ipc.cjs` vs `authService.cjs`)**:
   - `auth.ipc.cjs` tracks `sessionsBySenderId` while `authService.cjs` checks in-memory `currentSessionUser` without re-verifying live DB `is_active` and `role` inside `requireRole()`.

---

## 3. Individual Task Files & Sub-Branch Ownership (Zero Merge Collisions)

Each team member has a dedicated, self-contained Markdown specification file with their exact bugs, features to add, UI/UX tasks, and git commands:

1. **WW (Pathum)** -> [1_WW_Pathum_Tasks.md](file:///e:/BSE/omega-engineers-sms/docs/tasks/1_WW_Pathum_Tasks.md)
   - **Sub-Branch**: `fix/ww-pathum-auth-appointments-fifo-billing`
   - **Jira Items**: `SCRUM-11`, `SCRUM-17`, `SCRUM-26`, `SCRUM-31`
   - **Scope**: Fix `auth.ipc.cjs:211` crash, unify `authService.requireRole` DB validation, appointment RBAC & past-date/duplicate-vehicle validation, `no_show` status, calendar capacity bars (`bff4c69`), FIFO stock restoration on job cancellation, lock completed/invoiced job cards, hide FIFO cost/margin from non-authorized roles, and auto-trigger billing on job closure.

2. **HH Yellow (Madara)** -> [2_HH_Yellow_Madara_Tasks.md](file:///e:/BSE/omega-engineers-sms/docs/tasks/2_HH_Yellow_Madara_Tasks.md)
   - **Sub-Branch**: `fix/hh-madara-rbac-mechanics-workflow`
   - **Jira Items**: `SCRUM-12`, `SCRUM-20`, `SCRUM-21`, `SCRUM-22`, `SCRUM-15`
   - **Scope**: Fix `Settings.jsx` build failure & non-admin `backup.list()` crash, add `ACTION_PERMISSIONS` / `canPerformAction` in `permissions.cjs`, pass `currentUser` in `App.jsx`, role-gate `Dashboard.jsx`, `Mechanics.jsx`, `JobCardDetail.jsx`, `mechanics.ipc.cjs`, and `settings.ipc.cjs`, add multi-stage task progress (`pending` -> `in_progress` -> `completed`), "Complete & Close Job Card" billing trigger, complete Mechanic CRUD (deactivate/reactivate + phone validation), and filterable Audit Logs.

3. **HH Red-Orange (Prabodha)** -> [3_HH_RedOrange_Prabodha_Tasks.md](file:///e:/BSE/omega-engineers-sms/docs/tasks/3_HH_RedOrange_Prabodha_Tasks.md)
   - **Sub-Branch**: `fix/hh-prabodha-users-customers-jobs-payments`
   - **Jira Items**: `SCRUM-10`, `SCRUM-13`, `SCRUM-14`, `SCRUM-16`, `SCRUM-18`, `SCRUM-19`, `SCRUM-32`, `SCRUM-34`
   - **Scope**: Enforce IPC & UI RBAC across `customers`, `vehicles`, `jobs`, `invoices`, and `payments` (making `inventory_billing` View-Only on Customers), prevent self-demotion in `authService.updateUser`, add quick Activate/Deactivate toggle in Staff table, add Vehicle Edit/Delete UI & clickable Job History in `Customers.jsx`, sync `vehicles.mileage` & mechanic `busy`/`available` status, block overpayments & void-invoice payments in `paymentService.cjs`, and build the **Outstanding Due Payments** tab & Installment History view in `Invoices.jsx`.

4. **BH (Bhagya)** -> [4_BH_Bhagya_Tasks.md](file:///e:/BSE/omega-engineers-sms/docs/tasks/4_BH_Bhagya_Tasks.md)
   - **Sub-Branch**: `fix/bh-bhagya-inventory-suppliers-print-reports`
   - **Jira Items**: `SCRUM-24`, `SCRUM-25`, `SCRUM-28`, `SCRUM-29`, `SCRUM-33`, `SCRUM-23`, `SCRUM-27`, `SCRUM-30`
   - **Scope**: Enforce RBAC in `inventory.ipc.cjs`, merge quick-add supplier commit (`b0eff75`), build full Supplier CRUD + Supplier Purchase Invoice / GRN batch history (`SCRUM-25`/`SCRUM-29`), build dedicated **Stock Danger List** with shortfall & reorder recommendations (`SCRUM-28`), add **80mm POS Thermal Receipt** print mode & dynamic station settings in `InvoicePrintView.jsx` (`SCRUM-33`), fix `reportService.cjs` single-date filter, mechanic revenue join, and discount math bugs (`SCRUM-23`/`SCRUM-30`), and add **Export to Excel (CSV)** and **Export to PDF / Print** in `Reports.jsx` (`SCRUM-27`).

---

## 4. Complete 25-Item Jira Board Mapping

| Sprint / Section | Jira Key | Story Code | Title | Owner | Task File |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Sprint 0** | `SCRUM-10` | `US-UM-01` | Admin creates user accounts & roles | **HH Red-Orange (Prabodha)** | `3_HH_RedOrange_Prabodha_Tasks.md` |
| **Sprint 0** | `SCRUM-11` | `US-UM-02` | Multi-user login & PBKDF2 hashing | **WW (Pathum)** | `1_WW_Pathum_Tasks.md` |
| **Sprint 0** | `SCRUM-12` | `US-UM-03` | Configure role permissions by module | **HH Yellow (Madara)** | `2_HH_Yellow_Madara_Tasks.md` |
| **Sprint 0** | `SCRUM-16` | `US-JC-01` | Customer intake & quick search | **HH Red-Orange (Prabodha)** | `3_HH_RedOrange_Prabodha_Tasks.md` |
| **Sprint 0** | `SCRUM-17` | `US-JC-02` | Schedule service appointment & block double-booking | **WW (Pathum)** | `1_WW_Pathum_Tasks.md` |
| **Sprint 0** | `SCRUM-18` | `US-JC-03` | Create Job Card linked to appointment | **HH Red-Orange (Prabodha)** | `3_HH_RedOrange_Prabodha_Tasks.md` |
| **Sprint 0** | `SCRUM-19` | `US-JC-04` | Assign mechanic to job card | **HH Red-Orange (Prabodha)** | `3_HH_RedOrange_Prabodha_Tasks.md` |
| **Sprint 0** | `SCRUM-24` | `US-INV-01` | Add stock items & categories | **BH (Bhagya)** | `4_BH_Bhagya_Tasks.md` |
| **Sprint 0** | `SCRUM-26` | `US-INV-03` | Auto-stock deduction on Job Card issue | **WW (Pathum)** | `1_WW_Pathum_Tasks.md` |
| **Sprint 0** | `SCRUM-31` | `US-BILL-01` | Auto-generate bill on job card closure | **WW (Pathum)** | `1_WW_Pathum_Tasks.md` |
| **Sprint 1** | `SCRUM-20` | `US-JC-05` | Update repair status progress | **HH Yellow (Madara)** | `2_HH_Yellow_Madara_Tasks.md` |
| **Sprint 1** | `SCRUM-21` | `US-JC-06` | Close job card & trigger billing | **HH Yellow (Madara)** | `2_HH_Yellow_Madara_Tasks.md` |
| **Sprint 1** | `SCRUM-22` | `US-JC-07` | Maintain mechanic list (CRUD) | **HH Yellow (Madara)** | `2_HH_Yellow_Madara_Tasks.md` |
| **Sprint 1** | `SCRUM-25` | `US-INV-02` | Record supplier purchase invoice | **BH (Bhagya)** | `4_BH_Bhagya_Tasks.md` |
| **Sprint 1** | `SCRUM-28` | `US-INV-04` | View stock danger list (Low stock) | **BH (Bhagya)** | `4_BH_Bhagya_Tasks.md` |
| **Sprint 1** | `SCRUM-32` | `US-BILL-02` | Record payments & installments | **HH Red-Orange (Prabodha)** | `3_HH_RedOrange_Prabodha_Tasks.md` |
| **Sprint 1** | `SCRUM-33` | `US-BILL-03` | Print A4 invoice & POS thermal receipt | **BH (Bhagya)** | `4_BH_Bhagya_Tasks.md` |
| **Sprint 1** | `SCRUM-34` | `US-BILL-04` | Review outstanding due payments list | **HH Red-Orange (Prabodha)** | `3_HH_RedOrange_Prabodha_Tasks.md` |
| **Backlog** | `SCRUM-13` | `US-UM-04` | Change own password | **HH Red-Orange (Prabodha)** | `3_HH_RedOrange_Prabodha_Tasks.md` |
| **Backlog** | `SCRUM-14` | `US-UM-05` | Deactivate user account | **HH Red-Orange (Prabodha)** | `3_HH_RedOrange_Prabodha_Tasks.md` |
| **Backlog** | `SCRUM-15` | `US-UM-06` | View user activity audit logs | **HH Yellow (Madara)** | `2_HH_Yellow_Madara_Tasks.md` |
| **Backlog** | `SCRUM-23` | `US-REP-01` | View summarized business reports | **BH (Bhagya)** | `4_BH_Bhagya_Tasks.md` |
| **Backlog** | `SCRUM-27` | `US-REP-02` | Export report as PDF or Excel | **BH (Bhagya)** | `4_BH_Bhagya_Tasks.md` |
| **Backlog** | `SCRUM-29` | `US-INV-05` | Maintain supplier records | **BH (Bhagya)** | `4_BH_Bhagya_Tasks.md` |
| **Backlog** | `SCRUM-30` | `US-REP-03` | Date range filters on reports | **BH (Bhagya)** | `4_BH_Bhagya_Tasks.md` |

---

## 5. Recommended Merge Order for the 4 Sub-Branches

1. **First**: Merge **WW (Pathum)** (`fix/ww-pathum-auth-appointments-fifo-billing`) & **HH Yellow (Madara)** (`fix/hh-madara-rbac-mechanics-workflow`) — this restores `auth.ipc.cjs` and `Settings.jsx` build stability and establishes `canPerformAction` in `src/shared/permissions.cjs` and `currentUser` props in `App.jsx`.
2. **Second**: Merge **HH Red-Orange (Prabodha)** (`fix/hh-prabodha-users-customers-jobs-payments`) — adds customer/vehicle/job/payment IPC guards, overpayment protection, and Outstanding Dues UI.
3. **Third**: Merge **BH (Bhagya)** (`fix/bh-bhagya-inventory-suppliers-print-reports`) — adds Inventory/Supplier CRUD, Stock Danger List, 80mm POS receipt printing, and Report Excel/PDF exports.
