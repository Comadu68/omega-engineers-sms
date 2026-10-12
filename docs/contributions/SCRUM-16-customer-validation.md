# SCRUM-16 / US-JC-01: Customer Intake Validation & Duplicate Warning

## 1. Executive Summary & Problem Statement

In the original Omega Engineers offline desktop application, customer registration allowed saving records with:
1. Missing or whitespace-only names and telephone numbers.
2. Arbitrary text in name fields, lacking proper Unicode support for Sri Lankan customer names written in Sinhala script.
3. Unrestricted phone number formats without standardization, leading to duplicate customer entries when telephone numbers were entered with spaces, dashes, or international prefixes (`+94`, `0094`).
4. Absence of a phone duplicate warning mechanism during intake or contact updates, leading to duplicate records, fragmented vehicle registrations, and scattered service history.
5. Inability to distinguish between accidental duplicate creation and legitimate shared telephone numbers (e.g., family members or corporate vehicle fleets).

## 2. Implemented Solution & Final Behavior

### 2.1 Service-Level Input Validation
- **Customer Full Name (`fullName`):**
  - Enforced in both `customerService.cjs` and the UI renderer.
  - Rejects missing, empty, or whitespace-only names.
  - Full Unicode support: Accepts English (Latin) and Sinhala script characters (`\p{L}` and combining vowel/hal marks `\p{M}` in Unicode range `\u0D80-\u0DFF`), along with standard name punctuation (spaces, initials with periods, hyphens, and apostrophes).
  - Explicitly rejects names containing digits or symbols (e.g. `123`, `$$$`).
- **Primary Telephone (`phone`):**
  - Rejects empty, whitespace, and malformed inputs.
  - Normalized according to Sri Lankan numbering specifications (see Section 3).
- **Optional Alternate Telephone & Email:**
  - When provided, alternate phone numbers are validated using the Sri Lankan normalization standard.
  - When provided, email addresses are validated against standard RFC-compliant regex patterns.

### 2.2 Sri Lankan Phone Normalization & Storage
- Supported input formats:
  - Local 10-digit formats beginning with `0` (e.g. `077 123 4567`, `011-234-5678`).
  - International formats with `+94` (e.g. `+94 77 123 4567`, `+94 (0) 77 123 4567`).
  - International formats with `0094` (e.g. `0094 77 123 4567`).
  - International formats with `94` without plus (e.g. `94771234567`).
  - Punctuation stripping: Automatically strips spaces, hyphens, periods, and parentheses.
- Canonical Storage & Comparison:
  - Normalizes valid inputs to the canonical 10-digit Sri Lankan format: `0XXXXXXXXX` (e.g. `0771234567`).

### 2.3 Non-Destructive Duplicate Detection via Parameterized SQL
- Registers a deterministic custom SQLite function `normalize_phone` on all SQLite instances.
- Detects pre-existing records dynamically, even if legacy records were saved with spaces or international prefixes, without destructively rewriting historical records.
- Uses parameterized SQL and excludes the edited customer's own record ID during profile updates (`id != ?`).
- Retains database schema integrity: No blanket `UNIQUE` database constraint was added, allowing legitimate business exceptions for shared numbers.

### 2.4 Duplicate Warning & Explicit Business Override Flow
- **Ordinary Write Encountering a Duplicate:**
  - The service returns a structured response `{ duplicateWarning: true, isDuplicate: true, duplicates: [...] }` without making any database insert or update.
- **User Interface Decision Modal:**
  - Displays all matching existing customer records with their registered vehicle count, job history, phone numbers, and addresses.
  - **Option A: "👉 Use Existing Customer":** Closes the creation modal and immediately opens the matched customer profile without creating duplicates or overwriting data.
  - **Option B: "Create / Save Anyway (Shared Phone)":** Submits with `allowDuplicatePhone: true`. The service recognizes the explicit confirmation and creates the separate record for legitimate shared-phone use cases (e.g., spouse or corporate fleet).
  - **Option C: "Cancel & Edit Phone":** Returns to the form to correct any mistyped digits.
- **Safe Profile Updates:**
  - Updating a customer's record without altering their normalized phone number succeeds without false self-warnings.
  - Updating to another customer's existing phone number triggers the duplicate warning unless explicitly confirmed.
  - Invalid edits abort with descriptive errors, leaving database records untouched.

### 2.5 Quick Search Improvements
- Searching by Sinhala name, English name, email, or vehicle registration number continues to work seamlessly.
- Quick search detects phone queries entered in local, formatted, or international representations (e.g., typing `+94 71 234 5678` matches a customer whose record has `0712345678` or legacy formats).

---

## 3. Assumptions & Engineering Decisions

1. **Sri Lankan Numbering Plan Assumption:**
   - Standard Sri Lankan mobile codes (070, 071, 072, 074, 075, 076, 077, 078) and fixed-line area codes (011, 021-027, 031-038, 041, 045, 047, 051-057, 063-067, 081, 091) consist of 9 digits after trunk code `0` (10 digits total).
   - This rule was implemented as a documented engineering assumption for Sprint 0 and is flagged for final client confirmation.
2. **Provisional Shared-Phone Policy:**
   - Rather than enforcing an inflexible database-level unique constraint that blocks legitimate family or corporate fleet customers, the system employs a "Warning + Explicit Override" business flow.

---

## 4. Test Commands and Terminal Results

### 4.1 Focused SCRUM-16 Acceptance Tests
Command:
```powershell
node tests/customer-validation.test.cjs
```

Terminal Output:
```text
========================================================
Starting SCRUM-16 Customer Validation & Duplicate Tests
Isolated Database Path: C:\Users\...\test_customer_validation.db
========================================================

Test 1: Valid Sinhala/English names and supported local/+94/0094 phones work
✓ Test 1 Passed: Valid Sinhala/English names and local/+94/0094 phones created successfully.

Test 2: Empty/whitespace inputs and malformed phones are rejected with no write
✓ Test 2 Passed: Malformed and whitespace inputs strictly rejected without database writes.

Test 3: Local and international equivalents detect the same existing phone, including legacy formatting
✓ Test 3 Passed: Multi-format Sri Lankan phone matching detects existing legacy records.

Test 4: Duplicate ordinary write blocked pending confirmation; explicit override allows shared phone
✓ Test 4 Passed: Duplicate blocked by default; deliberate confirmation allows separate shared-phone record.

Test 5: Self-update allowed; changing to another customer's number triggers warning
✓ Test 5 Passed: Self-updates permitted; foreign phone updates trigger warning unless confirmed.

Test 6: Invalid edits leave original record unchanged
✓ Test 6 Passed: Invalid updates leave database records untouched.

Test 7: Customer/vehicle relationships and name/registration-number search still work
✓ Test 7 Passed: Vehicle links and multi-criteria quick search functioning perfectly.

========================================================
ALL SCRUM-16 ACCEPTANCE TESTS PASSED SUCCESSFULLY!
========================================================
```

### 4.2 Full System Integration Test Suite
Command:
```powershell
node tests/integration.test.cjs
```

Terminal Output:
```text
--- Starting Integration & Calculation Tests ---
Test 1: First Run Setup & Admin Authentication
✓ First Run & Auth Passed
Test 2: Customers & Vehicles
✓ Customer & Vehicle Creation Passed
Test 3: Mechanic Creation & Workload
✓ Mechanic Creation Passed
Test 4: Appointments & Capacity Collision Checks
✓ Appointment Collision Prevention Passed
Test 5: Multi-Batch Receiving & FIFO Stock Consumption
Test 6: Job Card, Tasks, and FIFO Parts Consumption
✓ FIFO Multi-Batch Deduction & Job Costing Passed
Test 7: Job Completion & Invoice Generation
✓ Invoice Generation Passed
Test 8: Partial & Full Payments
✓ Payment Tracking Passed
Test 9: Operating Expense Register
✓ Expense Register Passed
Test 10: Daily Summary Financial Metrics Verification
✓ Daily Financial Summary Calculation Passed
Test 11: Database Backup, Restore, and Integrity Check
✓ Backup & Restore Integrity Check Passed
====================================================
ALL INTEGRATION & BUSINESS CALCULATION TESTS PASSED!
====================================================
```

### 4.3 Production Frontend Build Check
Command:
```powershell
npm run build
```

Terminal Output:
```text
> vite build
✓ 33 modules transformed.
dist/index.html                   0.64 kB │ gzip:  0.39 kB
dist/assets/index-DYwjVLQC.css   12.89 kB │ gzip:  3.19 kB
dist/assets/index-92lB0tR4.js   371.04 kB │ gzip: 90.64 kB
✓ built in 407ms
```

---

## 5. Manual UI Verification Checklist

| Step | Action | Expected Result | Verified Disposable Data |
|---|---|---|---|
| 1 | Navigate to **Customers** page and click **+ Add New Customer** | Modal opens with clean inputs. | N/A |
| 2 | Enter empty/whitespace name or invalid phone (`12345`) and click **Save Customer** | Submission is blocked. Inline red error messages appear below each invalid field. | Name: `   `, Phone: `07712` |
| 3 | Enter valid Sinhala name and local phone | Customer record is created, profile opens showing canonical phone `0771234567`. | Name: `කමල් පෙරේරා`, Phone: `077 123 4567` |
| 4 | Click **+ Add New Customer** again, enter different name with international phone `+94 77 123 4567` | Warning modal appears: "⚠️ Phone Number Already Registered", displaying existing record for `කමල් පෙරේරා`. | Name: `සුනිල් පෙරේරා`, Phone: `+94 77 123 4567` |
| 5 | Click **"👉 Use Existing Customer"** | Modal closes; existing profile for `කමල් පෙරේරා` opens. No duplicate is created in the table. | `කමල් පෙරේරා` (ID 1) |
| 6 | Attempt to create again with `+94 77 123 4567`, but click **"Create / Save Anyway (Shared Phone)"** | New customer `සුනිල් පෙරේරා` is saved as a distinct record with shared phone. | Name: `සුනිල් පෙරේරා`, Phone: `0771234567` |
| 7 | Edit `කමල් පෙරේරා` without changing phone (e.g. edit address) | Saves successfully without duplicate warning. | Address: `නියම්ගම්දොර` |
| 8 | Search by Sinhala name (`කමල්`) or international phone (`+94771234567`) in Quick Search | Instantly filters and displays matching records. | `කමල්` / `+94 77 123 4567` |

---

## 6. Demo Script (Sprint Review / Presentation)

1. **Step 1 — Sinhala & Sri Lankan Intake:**
   - Open Customer intake modal.
   - Enter Sinhala customer name: `කමල් පෙරේරා`.
   - Enter phone in local format with spaces: `077 123 4567`.
   - Click Save: Customer profile opens immediately showing normalized contact information.
2. **Step 2 — Duplicate Detection in Action:**
   - Open intake modal again for a customer booking a vehicle: enter name `චමින්ද පෙරේරා` and phone `+94 77 123 4567`.
   - Click Save: The system halts the write and surfaces the Duplicate Warning Dialog showing that `කමල් පෙරේරා` already has this number.
3. **Step 3 — "Use Existing Customer" Flow:**
   - Receptionist notices this customer was already registered previously.
   - Clicks "👉 Use Existing Customer": Profile for `කමල් පෙරේරා` opens, ready to add the vehicle or start a job card.
4. **Step 4 — Shared Family/Fleet Confirmation Flow:**
   - If the customer confirms they are a family member sharing the phone:
   - Click "Create / Save Anyway (Shared Phone)": Separate customer record is created cleanly.
5. **Step 5 — Search Verification:**
   - In the quick search bar, type `+94 77 123 4567`.
   - Verify that both registered customers sharing the number appear immediately.

---

## 7. AI Disclosure & Contribution Boundaries

- **Original Project Codebase:** Pre-existing architecture, database schema, SQLite wrapper, and UI skeleton were created by the project team.
- **Added Contribution (SCRUM-16):**
  - Designed and implemented Sri Lankan phone normalization logic and Sinhala Unicode validation (`src/main/utils/phoneUtils.cjs`).
  - Integrated deterministic custom SQLite function `normalize_phone` in `src/database/db.cjs`.
  - Upgraded `customerService.cjs` create, update, and search methods with duplicate detection and business confirmation overrides.
  - Implemented client-side inline validation and the Duplicate Customer Resolution dialog in `Customers.jsx`.
  - Created automated test suite `tests/customer-validation.test.cjs` covering all 7 acceptance criteria with an isolated temporary SQLite database.
