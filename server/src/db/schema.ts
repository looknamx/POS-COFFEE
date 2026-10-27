import { db } from './index.js';

export function initializeSchema() {
  db.exec(`
    -- Store Settings
    CREATE TABLE IF NOT EXISTS store_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      description TEXT,
      updated_at TEXT DEFAULT (datetime('now', 'localtime'))
    );

    -- Users & Staff
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      full_name TEXT NOT NULL,
      role TEXT CHECK(role IN ('OWNER', 'CASHIER', 'STOCK_MANAGER')) NOT NULL,
      is_active INTEGER DEFAULT 1,
      last_login_at TEXT,
      created_at TEXT DEFAULT (datetime('now', 'localtime')),
      updated_at TEXT DEFAULT (datetime('now', 'localtime'))
    );

    -- Product Categories
    CREATE TABLE IF NOT EXISTS product_categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      icon TEXT,
      sort_order INTEGER DEFAULT 0,
      is_active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now', 'localtime'))
    );

    -- Products
    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sku TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      category_id INTEGER REFERENCES product_categories(id) ON DELETE SET NULL,
      image_url TEXT,
      base_price INTEGER NOT NULL, -- Stored in satang (e.g. 5000 = 50.00 THB)
      cost_price INTEGER DEFAULT 0, -- Stored in satang
      has_recipe INTEGER DEFAULT 1,
      is_active INTEGER DEFAULT 1,
      sort_order INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now', 'localtime')),
      updated_at TEXT DEFAULT (datetime('now', 'localtime'))
    );

    -- Product Variants (e.g. ร้อน, เย็น, ปั่น หรือ S, M, L)
    CREATE TABLE IF NOT EXISTS product_variants (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      price_adjustment INTEGER DEFAULT 0, -- Satang (+1000 = +10.00 THB)
      sku_suffix TEXT,
      is_active INTEGER DEFAULT 1
    );

    -- Option Groups (e.g. ระดับความหวาน, เพิ่มช็อต, ท็อปปิ้ง)
    CREATE TABLE IF NOT EXISTS product_option_groups (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id INTEGER REFERENCES products(id) ON DELETE CASCADE, -- NULL means global group
      name TEXT NOT NULL,
      min_select INTEGER DEFAULT 0,
      max_select INTEGER DEFAULT 1,
      is_required INTEGER DEFAULT 0
    );

    -- Product Options (e.g. หวาน 0%, หวาน 50%, เพิ่มวิปครีม +15)
    CREATE TABLE IF NOT EXISTS product_options (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      group_id INTEGER NOT NULL REFERENCES product_option_groups(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      price_adjustment INTEGER DEFAULT 0, -- Satang
      is_default INTEGER DEFAULT 0
    );

    -- Ingredient Categories (e.g. เมล็ดกาแฟ, นมและของเหลว, ผงเครื่องดื่ม, บรรจุภัณฑ์)
    CREATE TABLE IF NOT EXISTS ingredient_categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      sort_order INTEGER DEFAULT 0
    );

    -- Suppliers
    CREATE TABLE IF NOT EXISTS suppliers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT UNIQUE,
      name TEXT NOT NULL,
      contact_name TEXT,
      phone TEXT,
      email TEXT,
      address TEXT,
      tax_id TEXT,
      note TEXT,
      is_active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now', 'localtime'))
    );

    -- Ingredients (Raw materials / Inventory items)
    CREATE TABLE IF NOT EXISTS ingredients (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      category_id INTEGER REFERENCES ingredient_categories(id) ON DELETE SET NULL,
      unit TEXT NOT NULL, -- g, ml, pcs, bag, etc.
      current_stock REAL DEFAULT 0,
      min_reorder_stock REAL DEFAULT 0,
      cost_per_unit INTEGER DEFAULT 0, -- Satang per base unit
      supplier_id INTEGER REFERENCES suppliers(id) ON DELETE SET NULL,
      storage_location TEXT,
      expiry_date TEXT,
      is_active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now', 'localtime')),
      updated_at TEXT DEFAULT (datetime('now', 'localtime'))
    );

    -- Recipes (BOM Header)
    CREATE TABLE IF NOT EXISTS recipes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id INTEGER REFERENCES products(id) ON DELETE CASCADE,
      variant_id INTEGER REFERENCES product_variants(id) ON DELETE SET NULL,
      option_id INTEGER REFERENCES product_options(id) ON DELETE SET NULL,
      name TEXT,
      yield_quantity REAL DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now', 'localtime')),
      updated_at TEXT DEFAULT (datetime('now', 'localtime'))
    );

    -- Recipe Items (BOM details)
    CREATE TABLE IF NOT EXISTS recipe_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      recipe_id INTEGER NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
      ingredient_id INTEGER NOT NULL REFERENCES ingredients(id) ON DELETE RESTRICT,
      quantity REAL NOT NULL,
      unit TEXT NOT NULL,
      cost_share INTEGER DEFAULT 0
    );

    -- Purchase Receipts (รับสินค้าเข้าสต๊อก)
    CREATE TABLE IF NOT EXISTS purchase_receipts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      receipt_no TEXT UNIQUE NOT NULL,
      supplier_id INTEGER REFERENCES suppliers(id) ON DELETE SET NULL,
      receipt_date TEXT NOT NULL,
      total_amount INTEGER DEFAULT 0, -- Satang
      note TEXT,
      created_by INTEGER REFERENCES users(id),
      status TEXT CHECK(status IN ('DRAFT', 'COMPLETED', 'CANCELLED')) DEFAULT 'COMPLETED',
      created_at TEXT DEFAULT (datetime('now', 'localtime'))
    );

    -- Purchase Receipt Items
    CREATE TABLE IF NOT EXISTS purchase_receipt_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      purchase_receipt_id INTEGER NOT NULL REFERENCES purchase_receipts(id) ON DELETE CASCADE,
      ingredient_id INTEGER NOT NULL REFERENCES ingredients(id),
      quantity REAL NOT NULL,
      unit TEXT NOT NULL,
      unit_cost INTEGER NOT NULL, -- Satang
      total_cost INTEGER NOT NULL -- Satang
    );

    -- Inventory Movements (ประวัติการเคลื่อนไหวสต๊อกทั้งหมด)
    CREATE TABLE IF NOT EXISTS inventory_movements (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ingredient_id INTEGER NOT NULL REFERENCES ingredients(id) ON DELETE RESTRICT,
      movement_type TEXT CHECK(movement_type IN ('PURCHASE', 'SALE', 'USAGE', 'WASTE', 'ADJUSTMENT', 'COUNT_VARIANCE', 'REFUND_RESTOCK')) NOT NULL,
      reference_type TEXT, -- 'SALE', 'PURCHASE_RECEIPT', 'STOCK_COUNT', 'MANUAL'
      reference_id INTEGER,
      quantity_change REAL NOT NULL, -- positive or negative
      quantity_before REAL NOT NULL,
      quantity_after REAL NOT NULL,
      unit_cost INTEGER DEFAULT 0,
      reason TEXT,
      note TEXT,
      created_by INTEGER REFERENCES users(id),
      created_at TEXT DEFAULT (datetime('now', 'localtime'))
    );

    -- Stock Counts (ตรวจนับสต๊อก)
    CREATE TABLE IF NOT EXISTS stock_counts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      count_no TEXT UNIQUE NOT NULL,
      count_date TEXT NOT NULL,
      status TEXT CHECK(status IN ('IN_PROGRESS', 'CONFIRMED', 'CANCELLED')) DEFAULT 'IN_PROGRESS',
      total_variance_value INTEGER DEFAULT 0,
      note TEXT,
      counted_by INTEGER REFERENCES users(id),
      confirmed_at TEXT,
      created_at TEXT DEFAULT (datetime('now', 'localtime'))
    );

    -- Stock Count Items
    CREATE TABLE IF NOT EXISTS stock_count_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      stock_count_id INTEGER NOT NULL REFERENCES stock_counts(id) ON DELETE CASCADE,
      ingredient_id INTEGER NOT NULL REFERENCES ingredients(id),
      system_quantity REAL NOT NULL,
      counted_quantity REAL NOT NULL,
      variance_quantity REAL NOT NULL,
      unit_cost INTEGER DEFAULT 0,
      variance_value INTEGER DEFAULT 0
    );

    -- Sales (ยอดขายและบิล)
    CREATE TABLE IF NOT EXISTS sales (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      bill_no TEXT UNIQUE NOT NULL,
      sale_date TEXT NOT NULL,
      subtotal INTEGER NOT NULL, -- Satang
      discount_amount INTEGER DEFAULT 0, -- Satang
      discount_type TEXT, -- 'FIXED' or 'PERCENT'
      net_total INTEGER NOT NULL, -- Satang
      payment_method TEXT CHECK(payment_method IN ('CASH', 'QR_PROMPT_PAY', 'CREDIT_CARD', 'TRANSFER')) NOT NULL,
      received_amount INTEGER NOT NULL, -- Satang
      change_amount INTEGER DEFAULT 0, -- Satang
      status TEXT CHECK(status IN ('COMPLETED', 'CANCELLED', 'REFUNDED')) DEFAULT 'COMPLETED',
      cashier_id INTEGER REFERENCES users(id),
      customer_note TEXT,
      cancel_reason TEXT,
      cancelled_at TEXT,
      cancelled_by INTEGER REFERENCES users(id),
      idempotency_key TEXT UNIQUE,
      created_at TEXT DEFAULT (datetime('now', 'localtime'))
    );

    -- Sale Items (Snapshot at time of sale)
    CREATE TABLE IF NOT EXISTS sale_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sale_id INTEGER NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
      product_id INTEGER REFERENCES products(id),
      product_sku TEXT NOT NULL,
      product_name TEXT NOT NULL,
      variant_id INTEGER REFERENCES product_variants(id),
      variant_name TEXT,
      quantity INTEGER NOT NULL,
      unit_price INTEGER NOT NULL,
      cost_price INTEGER DEFAULT 0,
      subtotal INTEGER NOT NULL,
      discount_amount INTEGER DEFAULT 0,
      net_total INTEGER NOT NULL,
      note TEXT
    );

    -- Sale Item Options (Snapshot of options chosen)
    CREATE TABLE IF NOT EXISTS sale_item_options (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sale_item_id INTEGER NOT NULL REFERENCES sale_items(id) ON DELETE CASCADE,
      option_id INTEGER REFERENCES product_options(id),
      option_name TEXT NOT NULL,
      price_adjustment INTEGER DEFAULT 0
    );

    -- Payments
    CREATE TABLE IF NOT EXISTS payments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sale_id INTEGER NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
      payment_method TEXT NOT NULL,
      amount INTEGER NOT NULL,
      received_amount INTEGER NOT NULL,
      change_amount INTEGER DEFAULT 0,
      transaction_ref TEXT,
      status TEXT DEFAULT 'SUCCESS',
      created_at TEXT DEFAULT (datetime('now', 'localtime'))
    );

    -- Refunds
    CREATE TABLE IF NOT EXISTS refunds (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sale_id INTEGER NOT NULL REFERENCES sales(id),
      refund_no TEXT UNIQUE NOT NULL,
      refund_amount INTEGER NOT NULL,
      reason TEXT NOT NULL,
      restock_inventory INTEGER DEFAULT 1,
      refunded_by INTEGER REFERENCES users(id),
      created_at TEXT DEFAULT (datetime('now', 'localtime'))
    );

    -- Expense Categories
    CREATE TABLE IF NOT EXISTS expense_categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      is_system INTEGER DEFAULT 0
    );

    -- Store Expenses
    CREATE TABLE IF NOT EXISTS expenses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      expense_date TEXT NOT NULL,
      category_id INTEGER REFERENCES expense_categories(id) ON DELETE SET NULL,
      title TEXT NOT NULL,
      amount INTEGER NOT NULL, -- Satang
      payment_method TEXT DEFAULT 'CASH',
      note TEXT,
      receipt_image TEXT,
      created_by INTEGER REFERENCES users(id),
      created_at TEXT DEFAULT (datetime('now', 'localtime'))
    );

    -- Audit Logs
    CREATE TABLE IF NOT EXISTS audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER REFERENCES users(id),
      action TEXT NOT NULL,
      entity_type TEXT NOT NULL,
      entity_id TEXT,
      old_values TEXT,
      new_values TEXT,
      ip_address TEXT,
      created_at TEXT DEFAULT (datetime('now', 'localtime'))
    );

    -- Backup Records
    CREATE TABLE IF NOT EXISTS backup_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      filename TEXT NOT NULL,
      filepath TEXT NOT NULL,
      size_bytes INTEGER DEFAULT 0,
      backup_type TEXT DEFAULT 'MANUAL',
      note TEXT,
      created_at TEXT DEFAULT (datetime('now', 'localtime'))
    );

    -- Performance Indexes
    CREATE INDEX IF NOT EXISTS idx_sales_bill_no ON sales(bill_no);
    CREATE INDEX IF NOT EXISTS idx_sales_date ON sales(sale_date);
    CREATE INDEX IF NOT EXISTS idx_sales_status ON sales(status);
    CREATE INDEX IF NOT EXISTS idx_sale_items_sale_id ON sale_items(sale_id);
    CREATE INDEX IF NOT EXISTS idx_sale_item_options_sale_item_id ON sale_item_options(sale_item_id);
    CREATE INDEX IF NOT EXISTS idx_inventory_movements_ingredient ON inventory_movements(ingredient_id);
    CREATE INDEX IF NOT EXISTS idx_inventory_movements_type ON inventory_movements(movement_type);
    CREATE INDEX IF NOT EXISTS idx_inventory_movements_created ON inventory_movements(created_at);
    CREATE INDEX IF NOT EXISTS idx_recipes_product ON recipes(product_id);
    CREATE INDEX IF NOT EXISTS idx_recipes_variant ON recipes(variant_id);
    CREATE INDEX IF NOT EXISTS idx_recipes_option ON recipes(option_id);
    CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON audit_logs(entity_type, entity_id);
    CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id);
    CREATE INDEX IF NOT EXISTS idx_ingredients_category ON ingredients(category_id);
  `);
}

