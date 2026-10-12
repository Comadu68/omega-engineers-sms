# SCRUM-10 / US-UM-01: Enforce Admin-Only User Management

## 1. Issue & Scope Summary

- **Jira Key:** `SCRUM-10` (`US-UM-01: Admin creates user accounts & roles`)
- **Recommended Jira Status:** `In Review` (code and automated acceptance tests are complete; marking `Done` requires team code review and acceptance).
- **Problem Addressed:** The pre-existing baseline application already contained the SQLite `users` schema (`admin_owner`, `receptionist_service_advisor`, `mechanic`, `inventory_billing`), PBKDF2 hashing, and user-management IPC handlers (`auth:getUsers`, `auth:createUser`, `auth:updateUser`, `auth:changePassword`), but those IPC handlers and service methods did not track main-process session state per `webContents` or enforce `admin_owner` authorization. In addition, the Settings page unconditionally called `window.omega.auth.getUsers()` for all roles, and logout only cleared client-side React state without invalidating a main-process session.
- **Scope Boundary:** This contribution strictly covers account administration (`auth:*`), main-process session binding per `webContents`, explicit password reset/change policy enforcement, last-active-owner protection, logout IPC wiring, and Settings UI gating for staff management. It does **not** claim full application-wide RBAC across non-auth modules, account lockout, encrypted backups, or forced first-login password resets.

---

## 2. Actual Changes Implemented

1. **Main-Process Session State Bound to `webContents` ([`src/main/ipc/auth.ipc.cjs`](../../src/main/ipc/auth.ipc.cjs), [`src/main/main.cjs`](../../src/main/main.cjs)):**
   - Maintained an in-memory session store in the Electron main process keyed by the requesting `event.sender` (`webContents`).
   - Established a session **only** after a successful `auth:login` or first-run `auth:setupAdmin`.
   - Cleared any prior session on `event.sender` before attempting `auth:login` so a failed login attempt never leaves an unintended authenticated session.
   - Added `auth:logout` IPC handler and hooked `webContents` `'destroyed'` / `BrowserWindow` `'closed'` events to clear sessions automatically.

2. **Database-Backed Caller Identity & Active Role Verification ([`src/main/services/authService.cjs`](../../src/main/services/authService.cjs), [`src/main/ipc/auth.ipc.cjs`](../../src/main/ipc/auth.ipc.cjs)):**
   - Added `getAuthenticatedCaller` and `requireAdminCaller` in `authService.cjs`, which always look up the caller in the SQLite `users` table (`SELECT id, username, display_name, role, is_active FROM users WHERE id = ?`) using the main-process session's `userId`.
   - Ignored any renderer-supplied `userId`, `callerUserId`, `role`, or `currentUser` fields in IPC payloads for authorization.
   - Re-checked `is_active === 1` and `role === 'admin_owner'` on every protected request so demoted or deactivated accounts immediately lose privileges and stale sessions are evicted.

3. **Admin-Only Staff Management & Role Validation ([`src/main/services/authService.cjs`](../../src/main/services/authService.cjs)):**
   - Restricted `getUsers`, `createUser`, and `updateUser` to active `admin_owner` callers.
   - Validated role assignments in both `createUser` and `updateUser` against the existing schema roles (`admin_owner`, `receptionist_service_advisor`, `mechanic`, `inventory_billing`). Invalid roles (such as `'supervisor'`, `'superadmin'`, or `''`) are rejected before any database write.

4. **Explicit Password Reset & Self-Service Password Policy ([`src/main/services/authService.cjs`](../../src/main/services/authService.cjs), [`src/preload/preload.cjs`](../../src/preload/preload.cjs)):**
   - Removed the unrestricted `{ id, newPassword }` endpoint.
   - **Admin reset:** Active `admin_owner` callers can reset any staff account's password (or their own) with a new password of at least 4 characters.
   - **Self-service change:** Non-admin authenticated active users may only change their **own** password (`targetId === caller.id`) and **must** supply their valid `currentPassword` (verified via timing-safe PBKDF2 comparison). Attempts to reset another user's password or omit `currentPassword` are rejected before any database mutation.

5. **First-Run Setup & Last-Active-Owner Protection ([`src/main/services/authService.cjs`](../../src/main/services/authService.cjs)):**
   - `setupAdmin` remains usable without a logged-in user only while `COUNT(*) FROM users` is `0`; any subsequent attempt is rejected with `Owner account is already configured.`
   - `updateUser` blocks demoting or deactivating an active `admin_owner` when no other active `admin_owner` exists (`Cannot demote or deactivate the last active administrator/owner account.`).

6. **Preload Logout API & Renderer Settings Gating ([`src/preload/preload.cjs`](../../src/preload/preload.cjs), [`src/renderer/App.jsx`](../../src/renderer/App.jsx), [`src/renderer/pages/Settings.jsx`](../../src/renderer/pages/Settings.jsx)):**
   - Exposed `window.omega.auth.logout()` via `contextBridge` (preserving `contextIsolation: true` and `nodeIntegration: false` with no generic `ipcRenderer.invoke` exposure) and wired `App.jsx` `handleLogout` to call it.
   - Updated `Settings.jsx` (`fetchSettingsScreenData`) so non-admin users do not call `window.omega.auth.getUsers()` on load, preserving station settings, backup controls, and audit log display without error. Hidden `+ Add User`, the staff table, and edit controls for non-admin users while offering a self-service `Change My Password` modal requiring `currentPassword`.

---

## 3. Verification Commands, Results & Environment Notes

### Commands Executed

1. **Focused SCRUM-10 Acceptance Suite (`tests/auth-admin-access.test.cjs`):**
   ```powershell
   & "C:\Users\Prabo\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe" tests/auth-admin-access.test.cjs
   ```
   - **Result:** **PASSED** (All 10 acceptance test groups passed against a disposable temporary SQLite database and temporary `USERPROFILE`/`HOME`):
     - Test 1: First-run owner setup works once and binds session; later setup is rejected.
     - Test 2: Failed login clears/prevents session; window destruction clears session.
     - Test 3: Active admin can create, update role/details, and deactivate staff accounts.
     - Test 4: Unauthenticated caller and all non-admin roles (`receptionist_service_advisor`, `mechanic`, `inventory_billing`) are denied protected operations even with forged `admin_owner` role/userId/currentUser payloads.
     - Test 5: Invalid roles (`supervisor`, `superadmin`, `owner`, `''`) are rejected without changing data.
     - Test 6: Logout invalidates the session; re-login restores access.
     - Test 7: Demoted or deactivated admin session immediately loses privileges.
     - Test 8: Last active `admin_owner` cannot be demoted or deactivated.
     - Test 9: Password reset and self-service password change policy enforcement.
     - Test 10: Non-admin Settings loads station settings and backups without requesting protected staff data.

2. **Existing Integration Suite (`tests/integration.test.cjs`) with Disposable Test Home:**
   ```powershell
   $tmpHome = Join-Path $env:TEMP ("omega_int_home_" + [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds())
   New-Item -ItemType Directory -Path (Join-Path $tmpHome "Documents") -Force | Out-Null
   $env:USERPROFILE = $tmpHome
   $env:HOME = $tmpHome
   $env:NODE_PATH = "C:\Users\Prabo\AppData\Local\Programs\Omega Engineers Service Station\resources\app.asar.unpacked\node_modules"
   & "C:\Users\Prabo\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe" tests/integration.test.cjs
   Remove-Item -Path $tmpHome -Recurse -Force
   ```
   - **Result:** **PASSED** (All 11 integration and financial calculation tests passed; temporary backup directory was isolated from the user's real `Documents\Omega Engineers Backups`).

3. **Frontend Production Build (`npm run build` / `vite build`):**
   - **Result:** **BLOCKED by local environment limitation** (not marked passed).
   - **Exact Limitation:** In this local Windows checkout (`c:\Users\Prabo\Documents\GitHub\omega-engineers-sms`), `npm` is not on the system `PATH` and local `node_modules/` (including `vite` and `@vitejs/plugin-react`) has not been installed in the repository directory. Node syntax checks (`node --check`) were verified on all CommonJS modules, and `npm install && npm run build` should be run on a development machine with `npm` / `node_modules` installed.

---

## 4. Short Demo Walkthrough

1. **Admin Creates a User:**
   - Sign in as the Owner/Admin (`admin_owner`).
   - Navigate to **Settings → Staff User Management** and click **+ Add User**.
   - Enter Display Name (`Kasun Mechanic`), Username (`mech_kasun`), Role (`Mechanic`), and Password, then submit.
   - `window.omega.auth.createUser(...)` invokes `auth:createUser`. The main process verifies `event.sender`'s session in the database (`role === 'admin_owner'`, `is_active === 1`), hashes the password with PBKDF2, inserts the new user, and records an audit log entry.
2. **Non-Admin Is Denied:**
   - Sign in as `mech_kasun` (`mechanic`).
   - Open **Settings**: the Staff User Management table and `+ Add User` controls are hidden, and `Settings.jsx` does not request `auth:getUsers`.
   - Even if a non-admin renderer attempts to invoke `auth:getUsers`, `auth:createUser`, `auth:updateUser`, or `auth:changePassword` (for another user) with a forged `{ role: 'admin_owner', userId: 1 }` payload, `requireAdminSession` in `src/main/ipc/auth.ipc.cjs` checks the main-process `webContents` session against the SQLite `users` table and rejects the call with `Access denied: Administrator privileges are required.` before any database change occurs.
3. **Logout Invalidates Access:**
   - Click **Logout** in the sidebar.
   - `App.jsx` calls `await window.omega.auth.logout()`, which invokes `auth:logout` in `src/main/ipc/auth.ipc.cjs`, removing the `webContents` session from the main process and logging the logout action.
   - Any subsequent call to protected `auth:*` handlers from that window fails immediately with `Authentication required. Please sign in.` until a valid user signs in again.

---

## 5. Authorship & AI Assistance Disclosure

- The foundational repository structure, SQLite schema, PBKDF2 helpers, and React screens were pre-existing in the team repository prior to this task.
- This Sprint 0 improvement (`SCRUM-10`)—specifically main-process `webContents` session tracking, database-verified `admin_owner` authorization on user-management IPC/service methods, explicit password reset/self-service policy, last-active-owner protection, logout IPC integration, non-admin Settings gating, and `tests/auth-admin-access.test.cjs`—was implemented with AI pair-programming assistance (Google Antigravity) and reviewed for academic submission.
