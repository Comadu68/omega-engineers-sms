# START HERE — ANTIGRAVITY IMPLEMENTATION INSTRUCTIONS

You are implementing the **Omega Engineers Service Station Management System** as a fully offline Windows desktop application.

## Non-negotiable rules

1. **Read `MASTER_IMPLEMENTATION_GUIDE.md` fully before coding.**
2. The supplied UI files under `designs/` are the visual source of truth.
3. Do **not** redesign, simplify, remove fields, change navigation, alter colors, or change workflow unless a requirement is technically impossible or explicitly approved.
4. The final application must work **without internet access**.
5. Do not use CDNs, Google Fonts, cloud databases, online APIs, telemetry, hosted authentication, or any network dependency.
6. Use **Electron + React + Node.js + SQLite**.
7. Do **not** add Express, Docker, Redis, Nginx, PostgreSQL server, or MySQL server to the final desktop runtime unless explicitly requested later.
8. Use a single Electron `BrowserWindow` for the main UI.
9. Renderer must not access Node.js directly. Use preload + `contextBridge` + IPC.
10. Store business data in Electron's user-data directory, never inside the installed application folder.
11. Never delete or reset the user's database during updates.
12. Before every schema migration, create a database backup.
13. Before modifying an existing function, check which pages, services, IPC handlers, reports, and database records depend on it.
14. After every feature change, run the relevant feature test **and** a regression test of related functions.
15. Never blindly replace working code just to fix a small issue.
16. Keep dependencies minimal for low-spec office PCs.
17. Target 1366×768 as the minimum comfortable desktop resolution.
18. No customer login, SMS, email, mobile app, online payment gateway, or cloud sync in v1.

## Required development order

1. Bootstrap Electron + React + SQLite.
2. Database initialization and first-run owner account setup.
3. Login + role-based access.
4. Shared navigation/layout matching designs.
5. Customers + vehicles.
6. Appointments + availability calendar.
7. Mechanics + availability/workload.
8. Job cards + statuses + mechanic assignment.
9. Inventory + batch-cost tracking + FIFO stock deduction.
10. Invoice generation + payments.
11. Expenses + financial calculations.
12. Reports + daily summary.
13. Backup/restore.
14. Settings.
15. Full regression testing.
16. Windows installer build using electron-builder/NSIS.

## Definition of done

The project is not complete until:
- it installs on a clean Windows 10/11 PC using one `.exe` installer,
- opens from a desktop/start-menu shortcut,
- works with the network disabled,
- creates/persists a local database,
- survives app restart and app update without data loss,
- can backup and restore data,
- all core workflows in the proposal work,
- the UI closely matches the supplied designs,
- there are no overlapping/clipped controls at 1366×768,
- reports calculate revenue/cost/expenses/profit consistently,
- cancelled jobs and appointment conflicts are handled.
