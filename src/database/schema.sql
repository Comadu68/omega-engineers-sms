PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS app_meta (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

INSERT OR IGNORE INTO app_meta(key, value) VALUES ('schema_version', '1');

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  display_name TEXT NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('admin_owner','receptionist_service_advisor','mechanic','inventory_billing')),
  is_active INTEGER NOT NULL DEFAULT 1 CHECK(is_active IN (0,1)),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS customers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  full_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  alternate_phone TEXT,
  email TEXT,
  address TEXT,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_customers_name ON customers(full_name);
CREATE INDEX IF NOT EXISTS idx_customers_phone ON customers(phone);

CREATE TABLE IF NOT EXISTS vehicles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  customer_id INTEGER NOT NULL,
  registration_no TEXT NOT NULL UNIQUE,
  make TEXT,
  model TEXT,
  year INTEGER,
  vehicle_type TEXT,
  engine_no TEXT,
  chassis_no TEXT,
  mileage INTEGER,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(customer_id) REFERENCES customers(id) ON DELETE RESTRICT
);
CREATE INDEX IF NOT EXISTS idx_vehicles_customer ON vehicles(customer_id);

CREATE TABLE IF NOT EXISTS mechanics (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER UNIQUE,
  name TEXT NOT NULL,
  phone TEXT,
  specialty TEXT,
  availability_status TEXT NOT NULL DEFAULT 'available' CHECK(availability_status IN ('available','busy','off_duty')),
  is_active INTEGER NOT NULL DEFAULT 1 CHECK(is_active IN (0,1)),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS appointments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  customer_id INTEGER NOT NULL,
  vehicle_id INTEGER NOT NULL,
  service_reason TEXT NOT NULL,
  appointment_date TEXT NOT NULL,
  start_time TEXT NOT NULL,
  end_time TEXT,
  status TEXT NOT NULL DEFAULT 'scheduled' CHECK(status IN ('scheduled','completed','cancelled','no_show')),
  notes TEXT,
  created_by INTEGER,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(customer_id) REFERENCES customers(id) ON DELETE RESTRICT,
  FOREIGN KEY(vehicle_id) REFERENCES vehicles(id) ON DELETE RESTRICT,
  FOREIGN KEY(created_by) REFERENCES users(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_appointments_date ON appointments(appointment_date, start_time);
CREATE INDEX IF NOT EXISTS idx_appointments_status ON appointments(status);

CREATE TABLE IF NOT EXISTS job_cards (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  job_no TEXT NOT NULL UNIQUE,
  appointment_id INTEGER,
  customer_id INTEGER NOT NULL,
  vehicle_id INTEGER NOT NULL,
  complaint TEXT NOT NULL,
  service_details TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','in_progress','completed','cancelled')),
  odometer INTEGER,
  opened_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  completed_at TEXT,
  cancelled_at TEXT,
  cancellation_reason TEXT,
  created_by INTEGER,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(appointment_id) REFERENCES appointments(id) ON DELETE SET NULL,
  FOREIGN KEY(customer_id) REFERENCES customers(id) ON DELETE RESTRICT,
  FOREIGN KEY(vehicle_id) REFERENCES vehicles(id) ON DELETE RESTRICT,
  FOREIGN KEY(created_by) REFERENCES users(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_jobs_status ON job_cards(status);
CREATE INDEX IF NOT EXISTS idx_jobs_customer ON job_cards(customer_id);
CREATE INDEX IF NOT EXISTS idx_jobs_vehicle ON job_cards(vehicle_id);

CREATE TABLE IF NOT EXISTS job_assignments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  job_card_id INTEGER NOT NULL,
  mechanic_id INTEGER NOT NULL,
  assigned_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  unassigned_at TEXT,
  assigned_by INTEGER,
  FOREIGN KEY(job_card_id) REFERENCES job_cards(id) ON DELETE CASCADE,
  FOREIGN KEY(mechanic_id) REFERENCES mechanics(id) ON DELETE RESTRICT,
  FOREIGN KEY(assigned_by) REFERENCES users(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_assignments_job ON job_assignments(job_card_id);
CREATE INDEX IF NOT EXISTS idx_assignments_mechanic ON job_assignments(mechanic_id);

CREATE TABLE IF NOT EXISTS job_tasks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  job_card_id INTEGER NOT NULL,
  description TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','in_progress','completed','cancelled')),
  service_charge REAL NOT NULL DEFAULT 0 CHECK(service_charge >= 0),
  note TEXT,
  completed_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(job_card_id) REFERENCES job_cards(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS suppliers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  phone TEXT,
  address TEXT,
  notes TEXT,
  is_active INTEGER NOT NULL DEFAULT 1 CHECK(is_active IN (0,1))
);

CREATE TABLE IF NOT EXISTS inventory_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sku TEXT UNIQUE,
  name TEXT NOT NULL,
  category TEXT,
  default_supplier_id INTEGER,
  minimum_stock_level REAL NOT NULL DEFAULT 0 CHECK(minimum_stock_level >= 0),
  current_selling_price REAL NOT NULL DEFAULT 0 CHECK(current_selling_price >= 0),
  notes TEXT,
  is_active INTEGER NOT NULL DEFAULT 1 CHECK(is_active IN (0,1)),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(default_supplier_id) REFERENCES suppliers(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_inventory_name ON inventory_items(name);
CREATE INDEX IF NOT EXISTS idx_inventory_sku ON inventory_items(sku);

CREATE TABLE IF NOT EXISTS inventory_batches (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  batch_no TEXT NOT NULL UNIQUE,
  inventory_item_id INTEGER NOT NULL,
  supplier_id INTEGER,
  supplier_document_no TEXT,
  received_at TEXT NOT NULL,
  received_qty REAL NOT NULL CHECK(received_qty > 0),
  remaining_qty REAL NOT NULL CHECK(remaining_qty >= 0),
  unit_cost REAL NOT NULL CHECK(unit_cost >= 0),
  expiry_date TEXT,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(inventory_item_id) REFERENCES inventory_items(id) ON DELETE RESTRICT,
  FOREIGN KEY(supplier_id) REFERENCES suppliers(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_batches_fifo ON inventory_batches(inventory_item_id, received_at, id);

CREATE TABLE IF NOT EXISTS job_parts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  job_card_id INTEGER NOT NULL,
  inventory_item_id INTEGER NOT NULL,
  inventory_batch_id INTEGER NOT NULL,
  qty REAL NOT NULL CHECK(qty > 0),
  unit_cost_at_use REAL NOT NULL CHECK(unit_cost_at_use >= 0),
  selling_price_at_use REAL NOT NULL CHECK(selling_price_at_use >= 0),
  used_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  added_by INTEGER,
  FOREIGN KEY(job_card_id) REFERENCES job_cards(id) ON DELETE CASCADE,
  FOREIGN KEY(inventory_item_id) REFERENCES inventory_items(id) ON DELETE RESTRICT,
  FOREIGN KEY(inventory_batch_id) REFERENCES inventory_batches(id) ON DELETE RESTRICT,
  FOREIGN KEY(added_by) REFERENCES users(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_job_parts_job ON job_parts(job_card_id);

CREATE TABLE IF NOT EXISTS invoices (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  invoice_no TEXT NOT NULL UNIQUE,
  job_card_id INTEGER NOT NULL UNIQUE,
  customer_id INTEGER NOT NULL,
  vehicle_id INTEGER NOT NULL,
  subtotal REAL NOT NULL DEFAULT 0 CHECK(subtotal >= 0),
  discount REAL NOT NULL DEFAULT 0 CHECK(discount >= 0),
  total REAL NOT NULL DEFAULT 0 CHECK(total >= 0),
  payment_status TEXT NOT NULL DEFAULT 'unpaid' CHECK(payment_status IN ('unpaid','partially_paid','paid','void')),
  issued_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by INTEGER,
  FOREIGN KEY(job_card_id) REFERENCES job_cards(id) ON DELETE RESTRICT,
  FOREIGN KEY(customer_id) REFERENCES customers(id) ON DELETE RESTRICT,
  FOREIGN KEY(vehicle_id) REFERENCES vehicles(id) ON DELETE RESTRICT,
  FOREIGN KEY(created_by) REFERENCES users(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_invoices_date ON invoices(issued_at);

CREATE TABLE IF NOT EXISTS invoice_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  invoice_id INTEGER NOT NULL,
  line_type TEXT NOT NULL CHECK(line_type IN ('service','part','other')),
  description TEXT NOT NULL,
  qty REAL NOT NULL DEFAULT 1 CHECK(qty > 0),
  unit_price REAL NOT NULL CHECK(unit_price >= 0),
  unit_cost_snapshot REAL NOT NULL DEFAULT 0 CHECK(unit_cost_snapshot >= 0),
  line_total REAL NOT NULL CHECK(line_total >= 0),
  source_job_task_id INTEGER,
  source_job_part_id INTEGER,
  FOREIGN KEY(invoice_id) REFERENCES invoices(id) ON DELETE CASCADE,
  FOREIGN KEY(source_job_task_id) REFERENCES job_tasks(id) ON DELETE SET NULL,
  FOREIGN KEY(source_job_part_id) REFERENCES job_parts(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS payments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  invoice_id INTEGER NOT NULL,
  amount REAL NOT NULL CHECK(amount > 0),
  payment_method TEXT NOT NULL,
  payment_date TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  reference_no TEXT,
  notes TEXT,
  recorded_by INTEGER,
  FOREIGN KEY(invoice_id) REFERENCES invoices(id) ON DELETE RESTRICT,
  FOREIGN KEY(recorded_by) REFERENCES users(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_payments_date ON payments(payment_date);

CREATE TABLE IF NOT EXISTS expenses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  expense_date TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  category TEXT NOT NULL,
  description TEXT NOT NULL,
  amount REAL NOT NULL CHECK(amount >= 0),
  reference_no TEXT,
  recorded_by INTEGER,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(recorded_by) REFERENCES users(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(expense_date);

CREATE TABLE IF NOT EXISTS app_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER,
  action TEXT NOT NULL,
  entity_type TEXT,
  entity_id TEXT,
  details_json TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE SET NULL
);
