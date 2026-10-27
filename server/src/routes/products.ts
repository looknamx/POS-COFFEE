import { Router } from 'express';
import { db, runTransaction } from '../db/index.js';
import { requireRole } from '../middleware/auth.js';
import { logAudit } from '../services/auditService.js';

export const productsRouter = Router();

function isBakeryOrFood(categoryName?: string | null): boolean {
  if (!categoryName) return false;
  const lower = categoryName.toLowerCase();
  return (
    lower.includes('เบเกอรี่') ||
    lower.includes('bakery') ||
    lower.includes('ขนม') ||
    lower.includes('เค้ก') ||
    lower.includes('cake') ||
    lower.includes('ของทานเล่น') ||
    lower.includes('อาหาร') ||
    lower.includes('food')
  );
}

// List all products with category, variants and options
productsRouter.get('/', (req, res) => {
  const { category_id, search, active_only } = req.query;

  let query = `
    SELECT p.*, c.name as category_name
    FROM products p
    LEFT JOIN product_categories c ON c.id = p.category_id
    WHERE 1=1
  `;
  const params: any[] = [];

  if (active_only === 'true' || active_only === '1') {
    query += ` AND p.is_active = 1`;
  }
  if (category_id) {
    query += ` AND p.category_id = ?`;
    params.push(category_id);
  }
  if (search) {
    query += ` AND (p.name LIKE ? OR p.sku LIKE ?)`;
    params.push(`%${search}%`, `%${search}%`);
  }

  query += ` ORDER BY p.sort_order ASC, p.id DESC`;

  const products = db.prepare(query).all(...params) as any[];

  // Attach variants and options to each product
  const getVariantsStmt = db.prepare('SELECT * FROM product_variants WHERE product_id = ? AND is_active = 1');
  const getProdSpecificOptionGroupsStmt = db.prepare('SELECT * FROM product_option_groups WHERE product_id = ?');
  const getBeverageOptionGroupsStmt = db.prepare('SELECT * FROM product_option_groups WHERE product_id = ? OR product_id IS NULL');
  const getOptionsStmt = db.prepare('SELECT * FROM product_options WHERE group_id = ?');

  // Check if each product has an active recipe
  const recipeCheckStmt = db.prepare('SELECT COUNT(*) as count FROM recipes WHERE product_id = ?');

  const fullProducts = products.map((prod) => {
    const isBakery = isBakeryOrFood(prod.category_name);
    const variants = getVariantsStmt.all(prod.id);
    
    // Bakery and food products do NOT inherit global drink options (Sweetness, Extra Espresso Shots, etc.)
    const optionGroups = isBakery
      ? (getProdSpecificOptionGroupsStmt.all(prod.id) as any[])
      : (getBeverageOptionGroupsStmt.all(prod.id) as any[]);

    const groupsWithOptions = optionGroups.map((grp) => ({
      ...grp,
      options: getOptionsStmt.all(grp.id)
    }));

    const recipeCheck = recipeCheckStmt.get(prod.id) as { count: number };

    return {
      ...prod,
      is_bakery: isBakery,
      has_configured_recipe: (recipeCheck?.count || 0) > 0,
      variants,
      option_groups: groupsWithOptions
    };
  });

  res.json({ success: true, data: fullProducts });
});

// Get single product
productsRouter.get('/:id', (req, res) => {
  const id = Number(req.params.id);
  const prod = db.prepare(`
    SELECT p.*, c.name as category_name
    FROM products p
    LEFT JOIN product_categories c ON c.id = p.category_id
    WHERE p.id = ?
  `).get(id) as any;

  if (!prod) {
    return res.status(404).json({ success: false, message: 'ไม่พบสินค้า' });
  }

  const isBakery = isBakeryOrFood(prod.category_name);
  const variants = db.prepare('SELECT * FROM product_variants WHERE product_id = ?').all(prod.id);
  const optionGroups = (isBakery
    ? db.prepare('SELECT * FROM product_option_groups WHERE product_id = ?').all(prod.id)
    : db.prepare('SELECT * FROM product_option_groups WHERE product_id = ? OR product_id IS NULL').all(prod.id)
  ) as any[];
  const getOptionsStmt = db.prepare('SELECT * FROM product_options WHERE group_id = ?');

  const groupsWithOptions = optionGroups.map((grp) => ({
    ...grp,
    options: getOptionsStmt.all(grp.id)
  }));

  res.json({
    success: true,
    data: {
      ...prod,
      is_bakery: isBakery,
      variants,
      option_groups: groupsWithOptions
    }
  });
});

// Create product
productsRouter.post('/', requireRole('OWNER', 'STOCK_MANAGER'), (req, res) => {
  const {
    sku,
    name,
    category_id,
    image_url,
    base_price, // In satang
    cost_price,
    has_recipe = 1,
    sort_order = 0,
    variants = []
  } = req.body;

  if (!sku || !name || base_price === undefined) {
    return res.status(400).json({ success: false, message: 'กรุณากรอกรหัสสินค้า ชื่อสินค้า และราคาขาย' });
  }

  try {
    const createdId = runTransaction(() => {
      const info = db.prepare(`
        INSERT INTO products (sku, name, category_id, image_url, base_price, cost_price, has_recipe, sort_order)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(sku.trim(), name.trim(), category_id || null, image_url || null, Math.round(base_price), Math.round(cost_price || 0), has_recipe ? 1 : 0, sort_order);

      const productId = Number(info.lastInsertRowid);

      // Insert variants if provided
      if (Array.isArray(variants) && variants.length > 0) {
        const varStmt = db.prepare(`
          INSERT INTO product_variants (product_id, name, price_adjustment, sku_suffix)
          VALUES (?, ?, ?, ?)
        `);
        for (const v of variants) {
          if (v.name) {
            varStmt.run(productId, v.name.trim(), Math.round(v.price_adjustment || 0), v.sku_suffix || null);
          }
        }
      }

      return productId;
    });

    logAudit({
      userId: req.user?.id,
      action: 'CREATE_PRODUCT',
      entityType: 'PRODUCT',
      entityId: createdId,
      newValues: { sku, name, base_price }
    });

    const fullProduct = db.prepare('SELECT * FROM products WHERE id = ?').get(createdId);
    res.status(201).json({ success: true, data: fullProduct });
  } catch (err: any) {
    if (err.message?.includes('UNIQUE')) {
      return res.status(400).json({ success: false, message: 'รหัสสินค้า (SKU) นี้มีอยู่ในระบบแล้ว' });
    }
    res.status(500).json({ success: false, message: 'เกิดข้อผิดพลาดในการสร้างสินค้า' });
  }
});

// Update product
productsRouter.put('/:id', requireRole('OWNER', 'STOCK_MANAGER'), (req, res) => {
  const id = Number(req.params.id);
  const {
    sku,
    name,
    category_id,
    image_url,
    base_price,
    cost_price,
    has_recipe,
    is_active,
    sort_order,
    variants
  } = req.body;

  const existing = db.prepare('SELECT * FROM products WHERE id = ?').get(id) as any;
  if (!existing) {
    return res.status(404).json({ success: false, message: 'ไม่พบสินค้า' });
  }

  try {
    runTransaction(() => {
      db.prepare(`
        UPDATE products
        SET sku = coalesce(?, sku),
            name = coalesce(?, name),
            category_id = coalesce(?, category_id),
            image_url = coalesce(?, image_url),
            base_price = coalesce(?, base_price),
            cost_price = coalesce(?, cost_price),
            has_recipe = coalesce(?, has_recipe),
            is_active = coalesce(?, is_active),
            sort_order = coalesce(?, sort_order),
            updated_at = datetime('now', 'localtime')
        WHERE id = ?
      `).run(
        sku?.trim(),
        name?.trim(),
        category_id,
        image_url,
        base_price !== undefined ? Math.round(base_price) : null,
        cost_price !== undefined ? Math.round(cost_price) : null,
        has_recipe !== undefined ? (has_recipe ? 1 : 0) : null,
        is_active !== undefined ? (is_active ? 1 : 0) : null,
        sort_order,
        id
      );

      // If variants are supplied, synchronize them
      if (Array.isArray(variants)) {
        // Keep existing active or insert new ones
        const varStmt = db.prepare(`
          INSERT INTO product_variants (product_id, name, price_adjustment, sku_suffix)
          VALUES (?, ?, ?, ?)
        `);
        const updateVarStmt = db.prepare(`
          UPDATE product_variants SET name = ?, price_adjustment = ?, sku_suffix = ?, is_active = ? WHERE id = ? AND product_id = ?
        `);

        for (const v of variants) {
          if (v.id) {
            updateVarStmt.run(v.name, Math.round(v.price_adjustment || 0), v.sku_suffix || null, v.is_active !== undefined ? (v.is_active ? 1 : 0) : 1, v.id, id);
          } else if (v.name) {
            varStmt.run(id, v.name.trim(), Math.round(v.price_adjustment || 0), v.sku_suffix || null);
          }
        }
      }
    });

    logAudit({
      userId: req.user?.id,
      action: 'UPDATE_PRODUCT',
      entityType: 'PRODUCT',
      entityId: id,
      oldValues: existing,
      newValues: req.body
    });

    const updated = db.prepare('SELECT * FROM products WHERE id = ?').get(id);
    res.json({ success: true, data: updated });
  } catch (err: any) {
    if (err.message?.includes('UNIQUE')) {
      return res.status(400).json({ success: false, message: 'รหัสสินค้า (SKU) ซ้ำกับสินค้าอื่น' });
    }
    res.status(500).json({ success: false, message: 'เกิดข้อผิดพลาดในการแก้ไขสินค้า' });
  }
});

// Toggle status (Active / Inactive)
productsRouter.patch('/:id/status', requireRole('OWNER', 'STOCK_MANAGER'), (req, res) => {
  const id = Number(req.params.id);
  const { is_active } = req.body;

  db.prepare(`
    UPDATE products SET is_active = ?, updated_at = datetime('now', 'localtime') WHERE id = ?
  `).run(is_active ? 1 : 0, id);

  res.json({ success: true, message: is_active ? 'เปิดขายสินค้าแล้ว' : 'ปิดการขายสินค้าแล้ว' });
});

// Delete or Soft Delete
productsRouter.delete('/:id', requireRole('OWNER'), (req, res) => {
  const id = Number(req.params.id);

  // Check if sold before
  const saleItem = db.prepare('SELECT id FROM sale_items WHERE product_id = ? LIMIT 1').get(id);
  if (saleItem) {
    // Has sale history, soft delete as required by section 6!
    db.prepare(`UPDATE products SET is_active = 0, updated_at = datetime('now', 'localtime') WHERE id = ?`).run(id);
    return res.json({
      success: true,
      message: 'สินค้านี้มีประวัติการขายในระบบแล้ว ระบบได้ทำการปิดการใช้งานแทนการลบ เพื่อรักษาความถูกต้องของประวัติย้อนหลัง'
    });
  }

  // No sales history, safe to fully delete
  runTransaction(() => {
    db.prepare('DELETE FROM recipes WHERE product_id = ?').run(id);
    db.prepare('DELETE FROM product_variants WHERE product_id = ?').run(id);
    db.prepare('DELETE FROM products WHERE id = ?').run(id);
  });

  res.json({ success: true, message: 'ลบสินค้าเรียบร้อยแล้ว' });
});
