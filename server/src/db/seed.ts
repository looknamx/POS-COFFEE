import bcrypt from 'bcryptjs';
import { db, runTransaction } from './index.js';
import { initializeSchema } from './schema.js';

export function seedDatabase() {
  initializeSchema();

  runTransaction(() => {
    // Clean up transient seed state for a fresh clean state in correct FK order
    db.exec(`
      DELETE FROM refunds;
      DELETE FROM payments;
      DELETE FROM sale_item_options;
      DELETE FROM sale_items;
      DELETE FROM sales;
      DELETE FROM inventory_movements;
      DELETE FROM stock_count_items;
      DELETE FROM stock_counts;
      DELETE FROM purchase_receipt_items;
      DELETE FROM purchase_receipts;
      DELETE FROM recipe_items;
      DELETE FROM recipes;
      DELETE FROM product_options;
      DELETE FROM product_option_groups;
      DELETE FROM product_variants;
      DELETE FROM expenses;
    `);

    // 1. Store Settings
    const defaultSettings = [
      { key: 'store_name', value: 'ร้านกาแฟหอมละมุน (Aroma Cafe)', description: 'ชื่อร้านค้า' },
      { key: 'store_address', value: '123/45 ถนนสุขุมวิท แขวงคลองเตย เขตคลองเตย กรุงเทพฯ 10110', description: 'ที่อยู่ร้าน' },
      { key: 'store_phone', value: '081-234-5678', description: 'เบอร์โทรศัพท์' },
      { key: 'tax_id', value: '0105558091234', description: 'เลขประจำตัวผู้เสียภาษี' },
      { key: 'receipt_footer', value: 'ขอบคุณที่ใช้บริการ โอกาสหน้าเชิญใหม่ค่ะ\nThank you for visiting!', description: 'ข้อความท้ายใบเสร็จ' },
      { key: 'promptpay_number', value: '0812345678', description: 'เบอร์พร้อมเพย์ / Tax ID สำหรับ QR Payment' },
      { key: 'bill_prefix', value: 'INV', description: 'คำนำหน้าเลขที่บิล' },
      { key: 'allow_negative_stock', value: '0', description: 'อนุญาตให้ตัดสต๊อกติดลบหรือไม่ (1=ใช่, 0=ไม่ใช่)' },
      { key: 'currency', value: 'THB', description: 'สกุลเงิน' },
      { key: 'low_stock_threshold', value: '500', description: 'จุดแจ้งเตือนสต๊อกต่ำเริ่มต้น' }
    ];

    const settingStmt = db.prepare('INSERT OR REPLACE INTO store_settings (key, value, description) VALUES (?, ?, ?)');
    for (const s of defaultSettings) {
      settingStmt.run(s.key, s.value, s.description);
    }

    // 2. Default Users
    const passwordHash = bcrypt.hashSync('password123', 10);
    const userStmt = db.prepare('INSERT OR REPLACE INTO users (id, username, password_hash, full_name, role) VALUES (?, ?, ?, ?, ?)');
    userStmt.run(1, 'owner', passwordHash, 'สมชาย เจ้าของร้าน (Owner)', 'OWNER');
    userStmt.run(2, 'cashier', passwordHash, 'สมหญิง พนักงานขาย (Cashier)', 'CASHIER');
    userStmt.run(3, 'stock', passwordHash, 'มานะ ผู้จัดการสต๊อก (Stock Manager)', 'STOCK_MANAGER');

    // 3. Product Categories
    const categories = [
      { id: 1, name: 'กาแฟ (Coffee)', icon: 'Coffee', sort: 1 },
      { id: 2, name: 'ชา (Tea)', icon: 'CupSoda', sort: 2 },
      { id: 3, name: 'นมและโกโก้ (Milk & Cocoa)', icon: 'Milk', sort: 3 },
      { id: 4, name: 'อิตาเลียนโซดา (Italian Soda)', icon: 'Sparkles', sort: 4 },
      { id: 5, name: 'เบเกอรี่และของทานเล่น (Bakery)', icon: 'Cookie', sort: 5 }
    ];
    const catStmt = db.prepare('INSERT OR REPLACE INTO product_categories (id, name, icon, sort_order) VALUES (?, ?, ?, ?)');
    for (const c of categories) {
      catStmt.run(c.id, c.name, c.icon, c.sort);
    }

    // 4. Ingredient Categories
    const ingCats = [
      { id: 1, name: 'เมล็ดกาแฟ', sort: 1 },
      { id: 2, name: 'นมและของเหลว', sort: 2 },
      { id: 3, name: 'ผงเครื่องดื่ม', sort: 3 },
      { id: 4, name: 'น้ำเชื่อมและสารให้ความหวาน', sort: 4 },
      { id: 5, name: 'บรรจุภัณฑ์และของใช้', sort: 5 }
    ];
    const ingCatStmt = db.prepare('INSERT OR REPLACE INTO ingredient_categories (id, name, sort_order) VALUES (?, ?, ?)');
    for (const ic of ingCats) {
      ingCatStmt.run(ic.id, ic.name, ic.sort);
    }

    // 5. Suppliers
    const suppliers = [
      { id: 1, code: 'SUP-001', name: 'ดอยช้าง คอฟฟี่ ซัพพลาย', contact: 'คุณวิชัย', phone: '089-111-2222', email: 'sales@doichangsupply.com', address: 'เชียงราย', note: 'เมล็ดกาแฟอาราบิก้าแท้' },
      { id: 2, code: 'SUP-002', name: 'ซีพี-เมจิ แดรี่ ซัพพลาย', contact: 'คุณศิริพร', phone: '02-123-4567', email: 'order@meiji-supply.co.th', address: 'สระบุรี', note: 'นมสดพาสเจอร์ไรส์ นมข้น' },
      { id: 3, code: 'SUP-003', name: 'สยามแพ็คเกจจิ้ง & วัตถุดิบเบเกอรี่', contact: 'คุณเอกชัย', phone: '081-999-8888', email: 'contact@siampack.com', address: 'กรุงเทพฯ', note: 'แก้ว ฝา หลอด ไซรัป' }
    ];
    const supStmt = db.prepare('INSERT OR REPLACE INTO suppliers (id, code, name, contact_name, phone, email, address, note) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
    for (const sup of suppliers) {
      supStmt.run(sup.id, sup.code, sup.name, sup.contact, sup.phone, sup.email, sup.address, sup.note);
    }

    // 6. Ingredients
    const ingredients = [
      { id: 1, code: 'ING-COFFEE', name: 'เมล็ดกาแฟคั่วกลาง (Arabica)', cat_id: 1, unit: 'g', stock: 5000, min: 1000, cost: 50, sup_id: 1, loc: 'ตู้เก็บเมล็ดกาแฟ' },
      { id: 2, code: 'ING-MILK', name: 'นมสดพาสเจอร์ไรส์ (Fresh Milk)', cat_id: 2, unit: 'ml', stock: 12000, min: 2500, cost: 6, sup_id: 2, loc: 'ตู้เย็นบาร์ 1' },
      { id: 3, code: 'ING-COND-MILK', name: 'นมข้นหวาน (Condensed Milk)', cat_id: 2, unit: 'ml', stock: 4000, min: 800, cost: 8, sup_id: 2, loc: 'ชั้นวางบาร์' },
      { id: 4, code: 'ING-EVAP-MILK', name: 'นมข้นจืด (Evaporated Milk)', cat_id: 2, unit: 'ml', stock: 3500, min: 800, cost: 7, sup_id: 2, loc: 'ชั้นวางบาร์' },
      { id: 5, code: 'ING-SYRUP', name: 'น้ำเชื่อมเข้มข้น (Simple Syrup)', cat_id: 4, unit: 'ml', stock: 5000, min: 1000, cost: 5, sup_id: 3, loc: 'บาร์ชง' },
      { id: 6, code: 'ING-TEA-THAI', name: 'ผงชาไทยคัดพิเศษ (Thai Tea)', cat_id: 3, unit: 'g', stock: 2500, min: 500, cost: 35, sup_id: 3, loc: 'ชั้นวางผงชา' },
      { id: 7, code: 'ING-TEA-GREEN', name: 'ผงมัทฉะกรีนทีแท้ 100%', cat_id: 3, unit: 'g', stock: 1500, min: 300, cost: 120, sup_id: 3, loc: 'ตู้เก็บมัทฉะ' },
      { id: 8, code: 'ING-COCOA', name: 'ผงโกโก้พรีเมียม (Dutch Cocoa)', cat_id: 3, unit: 'g', stock: 2000, min: 400, cost: 45, sup_id: 3, loc: 'ชั้นวางผง' },
      { id: 9, code: 'ING-ICE', name: 'น้ำแข็งหลอดบริสุทธิ์', cat_id: 2, unit: 'g', stock: 25000, min: 5000, cost: 1, sup_id: 2, loc: 'ถังน้ำแข็ง' },
      { id: 10, code: 'ING-CUP-HOT', name: 'แก้วกระดาษร้อน 8oz + ฝา', cat_id: 5, unit: 'pcs', stock: 200, min: 50, cost: 200, sup_id: 3, loc: 'ชั้นเก็บแก้ว' },
      { id: 11, code: 'ING-CUP-ICED', name: 'แก้วพลาสติกใส 16oz', cat_id: 5, unit: 'pcs', stock: 450, min: 100, cost: 150, sup_id: 3, loc: 'ชั้นเก็บแก้ว' },
      { id: 12, code: 'ING-LID-ICED', name: 'ฝายกดื่ม 16oz', cat_id: 5, unit: 'pcs', stock: 450, min: 100, cost: 80, sup_id: 3, loc: 'ชั้นเก็บแก้ว' },
      { id: 13, code: 'ING-STRAW', name: 'หลอดไบโอรักษ์โลก', cat_id: 5, unit: 'pcs', stock: 500, min: 100, cost: 25, sup_id: 3, loc: 'บาร์จ่ายของ' },
      { id: 14, code: 'ING-CROISSANT', name: 'ครัวซองต์เนยสดสำเร็จรูป', cat_id: 5, unit: 'pcs', stock: 24, min: 8, cost: 2800, sup_id: 3, loc: 'ตู้เบเกอรี่' }
    ];

    const ingStmt = db.prepare(`
      INSERT OR REPLACE INTO ingredients (id, code, name, category_id, unit, current_stock, min_reorder_stock, cost_per_unit, supplier_id, storage_location)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    for (const ing of ingredients) {
      ingStmt.run(ing.id, ing.code, ing.name, ing.cat_id, ing.unit, ing.stock, ing.min, ing.cost, ing.sup_id, ing.loc);
    }

    // 7. Products
    const products = [
      { id: 1, sku: 'COF-ESP', name: 'เอสเปรสโซ่ (Espresso)', cat_id: 1, price: 4500, cost: 900, has_recipe: 1 },
      { id: 2, sku: 'COF-AME', name: 'อเมริกาโน่ (Americano)', cat_id: 1, price: 5000, cost: 1100, has_recipe: 1 },
      { id: 3, sku: 'COF-LAT', name: 'ลาเต้ (Caffè Latte)', cat_id: 1, price: 5500, cost: 1800, has_recipe: 1 },
      { id: 4, sku: 'COF-CAP', name: 'คาปูชิโน่ (Cappuccino)', cat_id: 1, price: 5500, cost: 1800, has_recipe: 1 },
      { id: 5, sku: 'COF-MOC', name: 'มอคค่า (Caffè Mocha)', cat_id: 1, price: 6000, cost: 2300, has_recipe: 1 },
      { id: 6, sku: 'TEA-THAI', name: 'ชาไทยเย็นต้นตำรับ (Original Thai Tea)', cat_id: 2, price: 5000, cost: 1600, has_recipe: 1 },
      { id: 7, sku: 'TEA-MATCHA', name: 'มัทฉะกรีนทีลาเต้ (Matcha Latte)', cat_id: 2, price: 6500, cost: 2600, has_recipe: 1 },
      { id: 8, sku: 'MILK-COCOA', name: 'โกโก้เข้มข้น (Signature Cocoa)', cat_id: 3, price: 5500, cost: 1900, has_recipe: 1 },
      { id: 9, sku: 'MILK-FRESH', name: 'นมสดคาราเมล (Fresh Milk Caramel)', cat_id: 3, price: 5000, cost: 1500, has_recipe: 1 },
      { id: 10, sku: 'BAK-CROISSANT', name: 'ครัวซองต์เนยสดพรีเมียม (Butter Croissant)', cat_id: 5, price: 6500, cost: 2800, has_recipe: 1 }
    ];

    const prodStmt = db.prepare(`
      INSERT OR REPLACE INTO products (id, sku, name, category_id, base_price, cost_price, has_recipe)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    for (const p of products) {
      prodStmt.run(p.id, p.sku, p.name, p.cat_id, p.price, p.cost, p.has_recipe);
    }

    // 8. Variants
    const drinkProductIds = [1, 2, 3, 4, 5, 6, 7, 8, 9];
    const varStmt = db.prepare('INSERT INTO product_variants (product_id, name, price_adjustment, sku_suffix) VALUES (?, ?, ?, ?)');
    for (const pId of drinkProductIds) {
      varStmt.run(pId, 'ร้อน (Hot)', 0, '-HOT');
      varStmt.run(pId, 'เย็น (Iced)', 500, '-ICED');
      varStmt.run(pId, 'ปั่น (Frappe)', 1500, '-FRAP');
    }

    // 9. Option Groups & Options
    const grpStmt = db.prepare('INSERT INTO product_option_groups (id, product_id, name, min_select, max_select, is_required) VALUES (?, ?, ?, ?, ?, ?)');
    grpStmt.run(1, null, 'ระดับความหวาน (Sweetness)', 1, 1, 1);
    grpStmt.run(2, null, 'ท็อปปิ้งและส่วนเสริม (Add-ons)', 0, 5, 0);

    const optStmt = db.prepare('INSERT INTO product_options (id, group_id, name, price_adjustment, is_default) VALUES (?, ?, ?, ?, ?)');
    optStmt.run(1, 1, 'หวาน 100% (ปกติ)', 0, 1);
    optStmt.run(2, 1, 'หวาน 50% (หวานน้อย)', 0, 0);
    optStmt.run(3, 1, 'หวาน 25% (หวานน้อยมาก)', 0, 0);
    optStmt.run(4, 1, 'ไม่หวาน 0%', 0, 0);

    optStmt.run(5, 2, 'เพิ่มช็อตเอสเปรสโซ่ (+1 Shot)', 1500, 0);
    optStmt.run(6, 2, 'เพิ่มวิปครีมเนื้อนุ่ม', 1500, 0);
    optStmt.run(7, 2, 'เพิ่มคาราเมลไซรัป', 1000, 0);
    optStmt.run(8, 2, 'เปลี่ยนเป็นนมโอ๊ต (Oat Milk)', 1500, 0);

    // 10. Drink Recipes
    const recipeStmt = db.prepare('INSERT INTO recipes (id, product_id, option_id, name, yield_quantity) VALUES (?, ?, ?, ?, 1)');
    const itemStmt = db.prepare('INSERT INTO recipe_items (recipe_id, ingredient_id, quantity, unit) VALUES (?, ?, ?, ?)');

    // Recipe for Caffè Latte (Product ID 3)
    recipeStmt.run(1, 3, null, 'สูตรมาตรฐาน ลาเต้เย็น 16oz');
    itemStmt.run(1, 1, 18, 'g');   // Coffee 18g
    itemStmt.run(1, 2, 120, 'ml'); // Milk 120ml
    itemStmt.run(1, 3, 15, 'ml');  // Cond milk 15ml
    itemStmt.run(1, 9, 180, 'g');  // Ice 180g
    itemStmt.run(1, 11, 1, 'pcs'); // Cup 16oz
    itemStmt.run(1, 12, 1, 'pcs'); // Lid 16oz
    itemStmt.run(1, 13, 1, 'pcs'); // Straw

    // Recipe for Americano (Product ID 2)
    recipeStmt.run(2, 2, null, 'สูตรมาตรฐาน อเมริกาโน่เย็น');
    itemStmt.run(2, 1, 18, 'g');   // Coffee 18g
    itemStmt.run(2, 9, 200, 'g');  // Ice 200g
    itemStmt.run(2, 11, 1, 'pcs');
    itemStmt.run(2, 12, 1, 'pcs');
    itemStmt.run(2, 13, 1, 'pcs');

    // Recipe for Thai Tea (Product ID 6)
    recipeStmt.run(3, 6, null, 'สูตรมาตรฐาน ชาไทยเย็น');
    itemStmt.run(3, 6, 16, 'g');
    itemStmt.run(3, 2, 80, 'ml');
    itemStmt.run(3, 3, 25, 'ml');
    itemStmt.run(3, 4, 20, 'ml');
    itemStmt.run(3, 9, 180, 'g');
    itemStmt.run(3, 11, 1, 'pcs');
    itemStmt.run(3, 12, 1, 'pcs');
    itemStmt.run(3, 13, 1, 'pcs');

    // Recipe for Croissant (Product ID 10)
    recipeStmt.run(4, 10, null, 'สูตรครัวซองต์เนยสด');
    itemStmt.run(4, 14, 1, 'pcs');

    // Add-on Recipe: Extra Shot (Option ID 5)
    recipeStmt.run(5, null, 5, 'ส่วนผสมเพิ่มช็อตกาแฟ (+1 Shot)');
    itemStmt.run(5, 1, 18, 'g'); // 18g coffee beans

    // 11. Initial Expense Categories
    const expCats = [
      'ค่าเช่าร้าน',
      'ค่าไฟฟ้าและน้ำประปา',
      'เงินเดือนและค่าแรงพนักงาน',
      'ค่าวัสดุสิ้นเปลืองและทำความสะอาด',
      'ค่าซ่อมบำรุงอุปกรณ์',
      'ค่าการตลาดและสื่อโฆษณา',
      'ค่าใช้จ่ายเบ็ดเตล็ด'
    ];
    const expCatStmt = db.prepare('INSERT OR IGNORE INTO expense_categories (name, is_system) VALUES (?, 1)');
    for (const ec of expCats) {
      expCatStmt.run(ec);
    }
  });
}

