# Architecture

```text
Electron Desktop Application
│
├── Main Process (Node.js)
│   ├── window lifecycle
│   ├── IPC handlers
│   ├── business services
│   ├── backup/restore
│   └── SQLite access
│
├── Preload
│   └── contextBridge: whitelisted API only
│
├── Renderer (React)
│   ├── Dashboard
│   ├── Job Cards
│   ├── Appointments
│   ├── Inventory
│   ├── Mechanics
│   ├── Customers
│   ├── Invoices
│   ├── Reports
│   └── Settings
│
└── Local SQLite Database
```

## Boundary rules
- Renderer never imports `fs`, `path`, SQLite, or Node-only modules.
- Renderer calls `window.omega.*` APIs exposed by preload.
- Preload maps explicit methods to explicit IPC channels.
- Main validates IPC input again before service/database calls.
- Services own business rules; IPC handlers should stay thin.
- Database helpers own transactions and queries.

## Data directory
Use `app.getPath('userData')`.

Recommended layout:
```text
Omega Engineers Service Station/
├── data/omega_service_station.db
├── logs/app.log
└── settings.json
```

User-visible backups:
```text
Documents/Omega Engineers Backups/
```
