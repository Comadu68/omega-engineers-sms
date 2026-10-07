# Database Migration Policy

1. Never drop/recreate the production database to apply an update.
2. Read current schema version.
3. Create a timestamped backup.
4. Run only migrations newer than the current version.
5. Wrap each migration in a transaction where SQLite permits it.
6. Update schema version only after success.
7. Run `PRAGMA integrity_check`.
8. If migration fails, preserve the pre-migration database and report the error.
9. Test every migration against a copy of real-like data before release.
