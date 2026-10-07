# Database Layer

- Initialize DB under Electron `userData`.
- Run `schema.sql` on first launch.
- Use `PRAGMA foreign_keys = ON` for every connection.
- Prefer WAL mode if validated for this single-PC deployment.
- Do not expose the raw DB object to renderer code.
- Implement transactions for FIFO stock consumption, invoice generation, payment updates, and restore/migration operations.
