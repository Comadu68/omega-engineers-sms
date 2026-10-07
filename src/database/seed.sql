-- Do not ship a hard-coded admin password.
-- On first launch, if `users` is empty, the app must show a Create Owner/Admin Account wizard.

INSERT OR IGNORE INTO app_settings(key, value) VALUES ('inventory_cost_method', 'FIFO');
INSERT OR IGNORE INTO app_settings(key, value) VALUES ('appointment_daily_capacity', '8');
INSERT OR IGNORE INTO app_settings(key, value) VALUES ('auto_backup_on_exit', 'false');
