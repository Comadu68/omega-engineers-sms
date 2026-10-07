# MASTER IMPLEMENTATION GUIDE
## Omega Engineers Service Station Management System

## 1. Product Goal

Build a reliable, easy-to-use, fully offline desktop management system for Omega Engineers Service Station. The system replaces paper-based job cards, appointment books, stock records, billing records, and manually prepared reports with one local Windows application.

The business workflow to preserve is:

Customer → Vehicle → Appointment (optional) → Job Card → Mechanic Assignment → Repair/Service Work → Parts Usage → Job Completion → Invoice → Payment → Reports

## 2. Final Technology Stack

### Application shell
- Electron
- One main BrowserWindow
- Windows 10/11 64-bit target

### Frontend / renderer
- React
- HTML5
- CSS3
- JavaScript
- Vite for development/build
- System font stack: `Segoe UI, Arial, sans-serif`

### Backend / application logic
- Node.js inside Electron main process
- Service layer for business rules
- Secure IPC between renderer and main process
- No Express server in final desktop runtime

### Database
- SQLite
- Recommended driver: `better-sqlite3`
- Database stored under Electron `app.getPath('userData')`

### Packaging
- electron-builder
- NSIS Windows installer
- Final artifact: `Omega Engineers Service Station Setup.exe`

## 3. Offline Requirement

The installed application must operate normally with Wi-Fi/Ethernet disconnected.

Forbidden runtime dependencies:
- CDNs
- Google Fonts CDN
- cloud database
- online authentication
- hosted APIs
- external analytics/telemetry
- remote image/font assets
- online payment gateway
- email/SMS APIs

All icons, logos, styles, JavaScript bundles, fonts (if any), and data must be local.

## 4. Low-Spec PC Target

Practical minimum target:
- Windows 10/11 64-bit
- dual-core CPU
- 4 GB RAM
- 1366×768 display
- at least 500 MB free disk space plus data/backups

Performance rules:
- single BrowserWindow
- do not create a new window per page
- lazy-load heavier report screens when useful
- keep animation minimal
- avoid large background images
- paginate large tables
- index SQLite search/filter columns
- avoid polling loops
- no unnecessary background workers
- no Docker/Redis/database server
- simple SVG/CSS charts are preferred when they satisfy the design

## 5. Users and Roles

### Administrator / Owner
Full management access:
- staff accounts
- customers and vehicles
- appointments
- job cards
- mechanic assignment
- inventory
- invoices/payments
- expenses
- reports
- settings/backups

### Receptionist / Service Advisor
- customers
- vehicles
- appointments
- create job cards
- view job status
- limited invoice viewing if required by workflow

### Mechanic
- only assigned jobs
- vehicle/repair details relevant to assigned jobs
- update repair status
- add repair notes/tasks
- record parts request/usage only if permission is enabled

### Inventory / Billing Staff
- inventory
- stock receipt/batches
- invoice generation
- payment recording
- related job/part details

No customer login in v1.

## 6. Navigation and Screens

Sidebar order must remain:
1. Dashboard
2. Job Cards
3. Appointments
4. Inventory
5. Mechanics
6. Customers
7. Invoices
8. Reports
9. Settings
10. Logout

Only the active item changes visual state. Font size must stay consistent across all navigation items; active state is shown using background, text color, and moderate font weight—not a larger font size.

## 7. UI Design System

Use the supplied reference files in `designs/`.

Core palette:
- Sidebar: `#000A31`
- Sidebar selected: `#1C3150`
- Main background: `#F6F8FC`
- Primary blue: `#4361EE`
- Main text: `#152033`
- Muted text: `#6B778C`
- Border: `#E4E9F2`
- Success / completed / available: `#2FB171`
- Warning / pending / limited: `#F0A33A` or `#F59E0B`
- Error / cancelled / full: `#E35757`

Status colors must be semantically meaningful and immediately scannable.

Do not flood full cards with saturated colors. Prefer subtle backgrounds, status badges, icons, or top/side accent lines.

## 8. Dashboard

Dashboard should provide a fast operational overview.

Required KPI cards:
- Today's Jobs
- Pending Jobs
- In Progress
- Completed Today
- Upcoming Appointments
- Cancelled Jobs may be shown as a smaller secondary metric if space allows

Required sections:
- recent job cards
- low-stock inventory
- quick actions
- today's/upcoming appointments or compact availability view
- optionally available mechanics if space allows

Dashboard should not become visually crowded.

## 9. Customers and Vehicles

Customer functions:
- add customer
- search customer
- update customer
- avoid obvious duplicates
- store contact information

Vehicle functions:
- add vehicle linked to customer
- search/update vehicle
- keep service/job history relationship

Suggested customer fields:
- id
- full name
- phone
- alternate phone
- address
- email optional
- notes
- created/updated timestamps

Suggested vehicle fields:
- registration number
- make
- model
- year optional
- vehicle type
- engine/chassis number optional
- mileage optional
- notes

## 10. Appointments

Appointment form:
- customer
- vehicle
- service/reason
- date
- time
- notes
- status

Availability rules:
- prevent duplicate/conflicting bookings for the same limited slot
- calendar must visually distinguish available, limited, full, selected, and cancelled/no-longer-counted bookings
- dates themselves should carry clear rounded color states rather than relying only on tiny dots
- selecting a date should show booking count/free slots

Appointment statuses:
- Scheduled
- Completed
- Cancelled
- No-show (optional but useful)

Cancelled appointments do not consume capacity.

## 11. Mechanics

Mechanic data:
- linked user account when applicable
- name
- phone
- specialty
- active/inactive
- current availability: Available / Busy / Off Duty

Mechanic page should show workload and current assigned jobs.

Job Cards page should use remaining lower-page space to show an **Available Mechanics** section so an administrator can quickly assign pending work.

When assigning a mechanic:
- show only active mechanics
- indicate available/busy status
- show current workload
- warn before assigning excessive simultaneous work

## 12. Job Cards

Job statuses:
- Pending
- In Progress
- Completed
- Cancelled

Cancelled must be a first-class status and filter.

Job-card list should include enough realistic rows to fill the main table area without looking empty.

Suggested columns:
- Job Card ID
- Customer
- Vehicle
- Service/Issue
- Mechanic
- Created date/time
- Status
- Action

Job-card detail must include:
- customer/vehicle information
- complaint/service request
- mechanic assignment
- job tasks
- progress
- repair notes
- parts used
- cost/inventory breakdown
- status history or timestamps

### Job task progress
Show a compact progress indicator, e.g. `2 of 3 tasks completed`.

## 13. Job Card Cost & Inventory Breakdown

Use a combined cost/inventory table, not a vague `Parts Used` section.

Suggested columns:
- Type
- Item / Description
- Qty
- Cost Price
- Selling Price
- Line Total
- Stock

For service rows, cost price may be blank/zero unless internal labour-cost tracking is implemented.

For part rows, cost price must come from the inventory batch actually consumed.

Summary examples:
- Service revenue
- Parts cost total
- Parts sales total
- Gross profit / part margin
- Total bill

## 14. Inventory

### Item master
Store:
- item name
- category
- SKU / part number
- supplier default/optional
- minimum stock level
- current selling price
- notes
- active state

### Batch-based costing
Do not store only one global cost price for all stock.

Each stock receipt creates a new batch:
- batch ID
- item ID
- received date
- supplier
- supplier invoice / GRN optional
- received quantity
- remaining quantity
- unit cost
- optional expiry

Example:
- old batch: cost LKR 1,650
- new batch: cost LKR 1,780

Both must coexist until consumed.

### FIFO
Default stock deduction method: FIFO.

When a job consumes parts:
1. find oldest batch with remaining stock
2. deduct from that batch
3. if quantity exceeds batch remainder, continue to next batch
4. create usage rows that snapshot batch cost and selling price
5. never recalculate historical job cost from a later item cost

### Selling price
Keep current/default selling price on the item master.
Snapshot selling price into job/invoice lines at time of use/sale.

### Replenishment workflow
Do not force users to create a new item every time stock arrives.

Use:
- `Add Inventory Item` only for first creation
- `Receive Stock / Add Batch` for later replenishment

### Inventory summary
Show:
- current total stock
- weighted-average informational cost
- stock valuation
- potential sales value
- low-stock threshold/status
- number of active batches

Weighted average is an analytic value only; if FIFO is enabled, actual COGS must come from consumed batches.

## 15. Invoices and Payments

Generate invoice from a valid job card.

Invoice includes:
- invoice number
- customer
- vehicle
- job card
- service lines
- part lines
- subtotal
- discount optional
- total
- amount paid
- balance
- payment status

Payment statuses:
- Unpaid
- Partially Paid
- Paid
- Cancelled/Void if required

Payment record:
- amount
- method
- date/time
- reference optional
- notes optional

Partial payment must keep remaining balance pending.

## 16. Expenses and Financial Reporting

Add a simple internal expense register because Daily Summary must show business costs.

Expense categories may include:
- wages/labour expense
- utilities
- consumables
- transport
- rent
- miscellaneous

Do not double-count inventory purchases as both stock COGS and daily operating expense unless the business explicitly wants purchase-cash-flow reporting.

### Recommended report definitions

For a selected day/period:
- **Service Revenue** = invoice service lines
- **Parts Revenue** = invoice part selling-value lines
- **Total Revenue** = Service Revenue + Parts Revenue
- **Parts COGS** = sum of actual FIFO batch cost used on sold/consumed parts
- **Operating Expenses** = expense-register entries
- **Gross Profit** = Total Revenue - Parts COGS
- **Net Profit** = Gross Profit - Operating Expenses
- **Cash Collected** = payments actually recorded in the period

This keeps accounting concepts understandable and avoids treating every stock receipt as an immediate expense in profit calculation.

## 17. Reports

Report menu:
- Daily Summary
- Job Card Report
- Sales Report
- Inventory Report
- Mechanic Performance

### Daily Summary visual hierarchy
Avoid tightly packed/sandwiched cards and oversized numbers.
Use compact KPI typography with good breathing room.

Recommended summary cards:
- Total Revenue
- Parts COGS / Cost
- Operating Expenses
- Net Profit
- Cash Collected (optional secondary card)

Use meaningful colors:
- income/revenue blue
- cost/expenses red/orange
- profit green

Chart should make comparison understandable immediately; use separate series for revenue, expenses/cost, and profit when appropriate.

Right-side/secondary breakdown may show:
- service revenue
- parts revenue
- parts COGS
- operating expenses
- net profit

## 18. Backup and Restore

This is mandatory for a fully offline business app.

Settings must include:
- Backup Database
- Restore Database
- Open Backup Folder
- optional automatic backup on clean app exit

Recommended locations:
- live DB: Electron user-data folder
- user-visible backups: `Documents/Omega Engineers Backups/`

Before restore:
1. validate selected file
2. backup current DB
3. close active DB connection
4. restore
5. integrity-check
6. reopen/restart app

## 19. Local Data Paths

Never store the writable DB inside `Program Files` or the installed application folder.

Use:
- `app.getPath('userData')/data/omega_service_station.db`
- `app.getPath('userData')/logs/`
- user-visible backups under Documents

Application updates must not delete user data.

## 20. Security

Even offline apps need basic security.

Required:
- hashed passwords, never plain-text passwords
- role-based access
- input validation
- prepared SQLite statements
- renderer isolation
- `nodeIntegration: false`
- `contextIsolation: true`
- expose only whitelisted APIs through preload
- no arbitrary IPC channel pass-through
- no `eval`
- no remote content

First launch:
- if no user exists, show a Create Owner/Admin Account setup screen
- do not ship a hard-coded default password

## 21. Database Migrations

Never destroy user data to apply a new schema.

Rules:
- maintain schema version
- create timestamped backup before migration
- apply incremental migrations
- run `PRAGMA integrity_check` after migration
- log migration result
- if migration fails, keep previous DB intact and show a recoverable error

## 22. Installer and Release

Use electron-builder + NSIS.

Expected flow:
`Setup.exe → Install → Start-menu/Desktop shortcut → First-run setup → Login → Dashboard`

Final release folder may contain:
- `Omega Engineers Service Station Setup 1.0.0.exe`
- checksums/release notes if desired

Node.js, React, Electron, and SQLite do not need to be separately installed on the client PC.

Unsigned academic builds may trigger Windows SmartScreen; code signing is optional for the university demo unless a certificate is available.

## 23. Development vs Release

Development:
- dev server + Electron
- DevTools allowed
- verbose logging allowed

Release:
- production Vite bundle
- no dev server
- no DevTools menu by default
- local packaged assets only
- user-friendly errors
- persistent logs

## 24. Testing Rules

For every change:
1. reproduce the issue/requirement
2. identify affected modules
3. implement locally
4. test target function
5. test related functions
6. test persistence after restart where data is involved
7. verify UI at 1366×768
8. verify no accidental network dependency
9. only then mark complete

Critical end-to-end tests:
- first-run admin setup
- login/role restrictions
- customer + vehicle creation
- appointment conflict prevention
- create job card from appointment
- mechanic assignment
- pending → in progress → completed
- cancellation flow
- receive inventory in multiple cost batches
- FIFO consumption across two batches
- invoice generation
- partial/full payment
- expense entry
- daily summary calculations
- backup/restore
- restart persistence
- packaged installer on clean PC
- app launch with internet disabled

## 25. UI Regression Rules

Do not allow:
- overlapping controls
- clipped text
- oversized KPI numbers
- selected navigation items using different font size
- tables running outside cards
- buttons covering rows
- summary cards visually touching/sandwiching each other
- inconsistent status colors
- empty-looking pages when useful business information can fill the space

## 26. Out of Scope for v1

Do not build unless explicitly requested:
- customer portal/login
- mobile app
- SMS notifications
- email notifications
- online payment gateway
- cloud sync
- multi-branch real-time synchronization
- GPS/vehicle tracking
- external accounting-system integration

## 27. Source-of-Truth Priority

When two instructions conflict, use this priority:
1. explicit latest user instruction
2. this master implementation guide
3. supplied high-fidelity designs
4. approved business/system requirements
5. original proposal/wireframe
6. reasonable implementation choice

Do not silently invent new business rules when the source material is unclear. Document assumptions.
