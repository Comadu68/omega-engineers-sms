# 4. BH (Bhagya) — Full Code Review, Bug Fixes, Features & UI/UX Tasks

- **Developer**: Bhagya (`BH` — Brown/Orange Avatar on Jira)
- **Git Author**: `HKBHAGYA <bhagyaheenatigala@hotmail.com>`
- **Recommended Sub-Branch**: `fix/bh-bhagya-inventory-suppliers-print-reports`
- **Existing Branches by Bhagya**:
  - `feature/scrum-24-26-inventory-qa` (merged to `main`)
  - `feature/scrum-24-supplier-quick-add` (`b0eff75` — unmerged commit adding quick-add supplier modal in `Inventory.jsx`)

---

## 1. Assigned Jira Stories (Sprint 0, Sprint 1 & Backlog)

| Jira Key | Story Code | Summary | Current Codebase Reality |
| :--- | :--- | :--- | :--- |
| **SCRUM-24** | `US-INV-01` | Add stock items & categories | Working (`Inventory.jsx` & `inventoryService.cjs`), **but** your quick-add supplier commit (`b0eff75` on `feature/scrum-24-supplier-quick-add`) is not yet merged to `main`, and `inventory.ipc.cjs` has zero RBAC checks! |
| **SCRUM-25** | `US-INV-02` | Record supplier purchase invoice | Receiving a single FIFO batch works (`receiveBatch`), **but** there is no Supplier Purchase Invoice / Goods Received Note (`GRN` reference number) tracking or purchase history log to view supplier invoices! |
| **SCRUM-28** | `US-INV-04` | View stock danger list (Low stock) | Currently `Inventory.jsx` only has a basic `⚠️ Low Stock Only` filter on the generic items table. It lacks a dedicated **Stock Danger / Reorder List** showing **shortfall quantity (`min_stock - current_stock`)**, **recommended reorder quantity**, **supplier contact phone**, and **estimated restock cost**. |
| **SCRUM-29** | `US-INV-05` | Maintain supplier records | Only `getSuppliers` and `createSupplier` exist in `inventoryService.cjs` (and without phone validation!). There is **no Supplier Directory UI**, **no Edit Supplier**, and **no Deactivate/Delete Supplier** in the software. |
| **SCRUM-33** | `US-BILL-03` | Print A4 invoice & POS thermal receipt | **Half-implemented**: `InvoicePrintView.jsx` only renders an A4 Invoice + Service Sticker (`max-width: 840px`) and **hardcodes** `"Solotrade Company • 123 Galle Road, Colombo"`. There is **NO 80mm POS Thermal Receipt mode/layout**! |
| **SCRUM-23** | `US-REP-01` | View summarized business reports | Basic tabs exist in `Reports.jsx`, **HOWEVER `reportService.cjs` has 3 math/SQL bugs** (discount discrepancy in Daily Summary, double-counted mechanic revenue on historical assignments, and broken single-date filters). |
| **SCRUM-27** | `US-REP-02` | Export report as PDF or Excel | **Completely missing (`0%` implemented)**: `Reports.jsx` has no Export to Excel/CSV button and no Export to PDF / Print Report button! |
| **SCRUM-30** | `US-REP-03` | Date range filters on reports | Partially broken: in `reportService.cjs`, selecting only `From Date` or only `To Date` is **silently ignored** (`if (dateFrom && dateTo)`), and `Reports.jsx` lacks quick date-range presets (`Today`, `This Week`, `This Month`, `Last 30 Days`). |

---

## 2. Primary Files Owned by Your Sub-Branch

To avoid merge conflicts with Pathum, Madara, and Prabodha, focus your commits on these files:
1. `src/main/ipc/inventory.ipc.cjs` & `src/main/services/inventoryService.cjs`
2. `src/renderer/pages/Inventory.jsx`
3. `src/renderer/components/InvoicePrintView.jsx`
4. `src/main/services/reportService.cjs` & `src/main/ipc/reports.ipc.cjs`
5. `src/renderer/pages/Reports.jsx`
6. `src/renderer/styles/global.css` *(`@media print` rules for 80mm POS receipt & PDF report printing)*
7. `tests/inventory-validation.test.cjs` & `tests/reports-validation.test.cjs` *(new test suite for `SCRUM-23`, `SCRUM-27`, `SCRUM-30`)*

---

## 3. Critical Bugs & Fixes Assigned to BH (Bhagya)

### Bug BH-01 (CRITICAL — SECURITY / RBAC): `src/main/ipc/inventory.ipc.cjs` Has Zero Role Checks
- **What happens**: Any logged-in role (including `receptionist_service_advisor` or `mechanic`) can invoke `inventory:create`, `inventory:update`, `inventory:receiveBatch`, or `inventory:createSupplier` via IPC because `inventory.ipc.cjs` never calls `authService.requireRole(...)`.
- **Exact Fix in `src/main/ipc/inventory.ipc.cjs`**:
  - Import `const authService = require('../services/authService.cjs');`.
  - Allow read-only queries (`inventory:list`, `inventory:getById`, `inventory:getBatches`, `inventory:lowStock`, `inventory:lowStockCount`, `inventory:categories`, `inventory:suppliers`) for `['admin_owner', 'inventory_billing', 'mechanic', 'receptionist_service_advisor']` (since Dashboard & JobCardDetail read stock).
  - Restrict all write operations (`inventory:create`, `inventory:update`, `inventory:receiveBatch`, `inventory:createSupplier`, `inventory:updateSupplier`, `inventory:deactivateSupplier`) with:
    ```js
    authService.requireRole(['admin_owner', 'inventory_billing']);
    ```

---

### Bug BH-02 (HIGH — SQL / MATH BUG, `SCRUM-23` & `SCRUM-30`): `reportService.cjs` Ignores Single-Bounded Date Filters (`dateFrom` Only or `dateTo` Only)
- **What happens**:
  - In `src/main/services/reportService.cjs:190` (`salesReport`) and `line 240` (`mechanicPerformanceReport`), the code checks:
    ```js
    if (dateFrom && dateTo) {
        dateFilter = 'AND date(inv.created_at) BETWEEN date(?) AND date(?)';
        params.push(dateFrom, dateTo);
    }
    ```
  - If a user enters **only `From` date** (e.g., all sales since `2026-03-01`) or **only `To` date** (e.g., all sales up to `2026-03-15`), `if (dateFrom && dateTo)` evaluates to `false` and **returns all historical data unfiltered**!
- **Exact Fix in `src/main/services/reportService.cjs`**:
  - Handle both bounded and single-sided date filters in `salesReport()` and `mechanicPerformanceReport()` (and verify `dateFrom <= dateTo` when both are provided):
    ```js
    if (dateFrom && dateTo && dateFrom > dateTo) {
        throw new Error('Start date (From) cannot be later than End date (To).');
    }
    if (dateFrom && dateTo) {
        dateFilter = 'AND date(inv.created_at) BETWEEN date(?) AND date(?)';
        params.push(dateFrom, dateTo);
    } else if (dateFrom) {
        dateFilter = 'AND date(inv.created_at) >= date(?)';
        params.push(dateFrom);
    } else if (dateTo) {
        dateFilter = 'AND date(inv.created_at) <= date(?)';
        params.push(dateTo);
    }
    ```

---

### Bug BH-03 (HIGH — SQL / MATH BUG, `SCRUM-23`): `mechanicPerformanceReport()` Counts Unassigned Historical Jobs & Double-Counts Revenue
- **What happens**:
  - In `src/main/services/reportService.cjs:251-253`:
    ```sql
    FROM mechanics m
    LEFT JOIN job_assignments ja ON ja.mechanic_id = m.id
    LEFT JOIN job_cards jc ON jc.id = ja.job_card_id AND jc.status != 'cancelled'
    LEFT JOIN invoices inv ON inv.job_card_id = jc.id AND inv.status != 'void'
    ```
  - Because `ja.unassigned_at IS NULL` is missing in the `LEFT JOIN job_assignments ja`, a mechanic who was unassigned from a job is still credited with that job's completion and revenue! Worse, if a mechanic was assigned, unassigned, and reassigned to the same job card, `SUM(COALESCE(inv.total, 0))` sums the invoice total **twice**!
- **Exact Fix in `src/main/services/reportService.cjs`**:
  - Add `AND ja.unassigned_at IS NULL` to `LEFT JOIN job_assignments ja ON ja.mechanic_id = m.id AND ja.unassigned_at IS NULL`, or aggregate Over distinct `(mechanic_id, job_card_id)` pairs first so `inv.total` is never multiplied by duplicate assignment rows.

---

### Bug BH-04 (MEDIUM — ACCOUNTING MATH, `SCRUM-23`): `dailySummary()` Ignores Invoice Discounts When Computing `totalRevenue`
- **What happens**:
  - In `src/main/services/reportService.cjs:29`, `dailySummary()` calculates:
    `const totalRevenue = serviceRevenue.total + partsRevenue.total;`
    using raw task labour + raw part selling prices on `completed` jobs, completely ignoring `invoices.discount`!
  - Meanwhile, `trendDays` (`line 89`) calculates daily revenue as `SUM(inv.total)` (which subtracts `inv.discount`). As a result, Today's Revenue KPI and Today's bar on the 7-Day Revenue Trend chart do not match whenever an invoice has a discount!
- **Exact Fix in `src/main/services/reportService.cjs`**:
  - Query total discounts given on non-void invoices for `targetDate` (`SELECT COALESCE(SUM(discount), 0) AS total FROM invoices WHERE date(created_at) = date(?) AND status != 'void'`) and subtract `totalDiscount` from `totalRevenue` (and expose `totalDiscount` in the returned summary object).

---

### Bug BH-05 (MEDIUM — HARDCODED DATA, `SCRUM-33`): `InvoicePrintView.jsx` Uses Hardcoded Station Address & Company Name
- **What happens**:
  - In `src/renderer/components/InvoicePrintView.jsx:39-46` and `172-177`:
    `Solotrade Company • 123 Galle Road, Colombo` and `Tel: 011-2345678` are hardcoded instead of reading `station_name`, `company_name`, `station_address`, `station_phone`, `station_email`, and `invoice_footer_note` from `window.omega.settings.getAll()`.
- **Exact Fix in `src/renderer/components/InvoicePrintView.jsx`**:
  - In `useEffect`, fetch `window.omega.settings.getAll()` alongside the invoice/payment details and render the dynamic station settings in both the A4 Invoice header/footer, POS Thermal Receipt, and Service Sticker (with sensible fallback defaults).

---

## 4. Features to Add (Assigned to BH — Bhagya)

### Feature BH-F1 (`SCRUM-33` / `US-BILL-03`): Dual Print Layout — A4 Official Invoice + 80mm POS Thermal Receipt + Service Sticker
- **Requirement**: Support printing both a standard **A4 Invoice** and an **80mm POS Thermal Receipt** (plus the Service Reminder Sticker).
- **Implementation in `src/renderer/components/InvoicePrintView.jsx` & `src/renderer/styles/global.css`**:
  1. Add a **Print Mode Selector Bar** (hidden during print via `.no-print`) at the top of `InvoicePrintView.jsx` with 3 mode buttons:
     - `📄 A4 Official Invoice + Sticker` (default `840px` layout)
     - `🧾 80mm POS Thermal Receipt` (compact `300px` / `80mm` monospace thermal roll layout)
     - `🏷️ Service Sticker Only`
  2. When **`🧾 80mm POS Thermal Receipt`** is selected:
     - Render a classic `80mm` thermal receipt container (`width: 302px`, `font-family: 'JetBrains Mono', monospace`, dashed separators `--------------------------------`, compact centered station header, Invoice #, Date/Time, Vehicle Plate, Customer Name, compact line items `Qty x Rate = Amt`, Subtotal, Discount, **GRAND TOTAL**, Paid Amount, Balance Due, Payment Method, and dynamic footer note `"Thank you for choosing Omega Engineers!"`).
     - Add `@media print` rules so thermal receipt mode prints cleanly on `80mm` roll printers without extra page margins.

### Feature BH-F2 (`SCRUM-29` / `US-INV-05` & `SCRUM-25` / `US-INV-02`): Full Supplier Management (CRUD) & Supplier Purchase Invoice / GRN History in `Inventory.jsx`
- **Requirement**:
  1. Cherry-pick your commit `b0eff75` (`feature/scrum-24-supplier-quick-add`) into your sub-branch so the quick-add supplier button works inside Item & Receive Batch modals.
  2. Expand `inventoryService.cjs` & `inventory.ipc.cjs`:
     - Validate supplier phone numbers using `normalizeSriLankanPhone(data.phone)` (optional if blank, validated if provided).
     - Add `updateSupplier(id, data)` and `deactivateSupplier(id)` (soft-delete `is_active = 0` after checking active references).
     - In `receiveBatch(data)`: accept an optional `supplierInvoiceNumber` / `grnNumber` and `notes` (or store in batch/purchase log) and add `getSupplierPurchases(supplierId)` (querying `inventory_batches` joined with `inventory_items` and `suppliers` ordered by `received_date DESC`) so users can view all purchase invoices / batches received from each supplier (`SCRUM-25`)!
  3. In `src/renderer/pages/Inventory.jsx`:
     - Add a **view switcher** at the top of `Inventory.jsx`:
       1. `📦 All Stock Items`
       2. `🚨 Stock Danger List (Low Stock)` (`SCRUM-28`)
       3. `🏢 Suppliers & Purchase Invoices (GRN)` (`SCRUM-29` & `SCRUM-25`)
     - In the **Suppliers & Purchase Invoices** tab, allow creating/editing/deactivating suppliers and viewing recent received stock batches (Purchase Invoices / GRNs) with Date, Supplier, Part, Qty Received, Unit Cost, and Total Batch Cost (`quantity_received * unit_cost`).

### Feature BH-F3 (`SCRUM-28` / `US-INV-04`): Dedicated Stock Danger List View in `Inventory.jsx`
- **Requirement**: Provide an actionable Stock Danger List for items where `total_stock <= minimum_stock_level`.
- **Implementation in `src/renderer/pages/Inventory.jsx`**:
  - When the **`🚨 Stock Danger List`** tab is active, display:
    - Summary KPIs: **Out of Stock (`0` qty) Count**, **Critical Low Stock Count**, and **Estimated Reorder Cost (`LKR`)**.
    - Table columns: `SKU`, `Part Name`, `Category`, `Current Stock`, `Min Stock Level`, **`Shortfall Qty` (`min - current`)**, **`Recommended Reorder Qty` (`Math.max(min * 2 - current, min)`)**, `Supplier Name & Phone`, and a one-click **`📥 Replenish Now`** button that opens the Receive Batch modal pre-populated with the recommended reorder quantity!

### Feature BH-F4 (`SCRUM-27` / `US-REP-02` & `SCRUM-30` / `US-REP-03`): Export Reports to Excel (CSV) & PDF + Quick Date Range Presets in `Reports.jsx`
- **Requirement**: Users must be able to export any business report as **Excel (`.csv` with UTF-8 BOM so Microsoft Excel opens it with proper columns)** or **PDF (`window.print()` with a clean print header)**, and quickly filter date ranges (`SCRUM-30`).
- **Implementation in `src/renderer/pages/Reports.jsx`**:
  1. **Quick Date Range Preset Buttons** on `Sales & Revenue` and `Mechanic Performance` tabs:
     - `Today`, `Last 7 Days`, `This Month`, `Last 30 Days`, `All Time` (which auto-fill `dateFrom` and `dateTo` and trigger `loadReport()`).
  2. **`📊 Export Excel (.CSV)` Button** on all 4 Report Tabs (`Daily Summary`, `Sales & Revenue`, `Inventory Valuation`, `Mechanic Performance`):
     - Generate a clean RFC-4180 CSV with UTF-8 BOM (`\uFEFF`) containing the active report's summary metrics and table rows, and trigger a browser download (`omega-report-${tab}-${date}.csv`) that opens directly in Microsoft Excel.
  3. **`🖨️ Export PDF / Print Report` Button**:
     - Trigger `window.print()` with a dedicated `@media print` report header showing `"OMEGA ENGINEERS — OFFICIAL BUSINESS REPORT"`, report type, date range, and generation timestamp while hiding navigation sidebars and filter controls.

---

## 5. UI & UX Improvements (Assigned to BH — Bhagya)

1. **`InvoicePrintView.jsx`**:
   - Add a visual preview frame around the `80mm` thermal receipt mode so billing staff can see exactly how the thermal slip will look before clicking `🖨️ Print Now`.
2. **`Reports.jsx`**:
   - Add a `Total Discounts` metric card or subtitle under Today's Revenue so management can see gross vs net revenue clearly.

---

## 6. Git Sub-Branch & Verification Checklist for Bhagya

```powershell
# 1. Create your dedicated sub-branch from main
git checkout main
git pull origin main
git checkout -b fix/bh-bhagya-inventory-suppliers-print-reports

# 2. Cherry-pick your supplier quick-add commit from feature/scrum-24-supplier-quick-add
git cherry-pick b0eff75

# 3. After implementing the fixes above, run the test suites and build:
node tests/inventory-validation.test.cjs
node tests/integration.test.cjs
npm.cmd run build

# 4. Stage, commit, and push your sub-branch
git add src/main/ipc/inventory.ipc.cjs src/main/services/inventoryService.cjs src/renderer/pages/Inventory.jsx src/renderer/components/InvoicePrintView.jsx src/main/services/reportService.cjs src/renderer/pages/Reports.jsx src/renderer/styles/global.css tests/
git commit -m "fix(SCRUM-23,24,25,27,28,29,30,33): add supplier CRUD, stock danger list, 80mm thermal receipt, report exports and date filter fixes"
git push -u origin fix/bh-bhagya-inventory-suppliers-print-reports
```
