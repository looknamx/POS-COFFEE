import { Router } from 'express';
import { db } from '../db/index.js';
import { requireRole } from '../middleware/auth.js';
import { logAudit } from '../services/auditService.js';

export const ingredientsRouter = Router();

// List all ingredients
ingredientsRouter.get('/', (req, res) => {
  const { category_id, search, alert_only } = req.query;

  let query = `
    SELECT i.*, 
           c.name as category_name, 
           s.name as supplier_name,
           (i.current_stock * i.cost_per_unit) as total_valuation,
           CASE 
             WHEN i.current_stock <= 0 THEN 'OUT_OF_STOCK'
             WHEN i.current_stock <= i.min_reorder_stock THEN 'LOW_STOCK'
             ELSE 'NORMAL'
           END as stock_status
    FROM ingredients i
    LEFT JOIN ingredient_categories c ON c.id = i.category_id
    LEFT JOIN suppliers s ON s.id = i.supplier_id
    WHERE i.is_active = 1
  `;
  const params: any[] = [];

  if (category_id) {
    query += ` AND i.category_id = ?`;
    params.push(category_id);
  }
  if (search) {
    query += ` AND (i.name LIKE ? OR i.code LIKE ?)`;
    params.push(`%${search}%`, `%${search}%`);
  }
  if (alert_only === 'true' || alert_only === '1') {
    query += ` AND (i.current_stock <= i.min_reorder_stock OR i.current_stock <= 0)`;
  }

  query += ` ORDER BY i.current_stock <= i.min_reorder_stock DESC, i.id ASC`;

  const ingredients = db.prepare(query).all(...params);

  // Overall summary stats
  const summary = db.prepare(`
    SELECT 
      COUNT(*) as total_items,
      SUM(CASE WHEN current_stock <= 0 THEN 1 ELSE 0 END) as out_of_stock_count,
      SUM(CASE WHEN current_stock > 0 AND current_stock <= min_reorder_stock THEN 1 ELSE 0 END) as low_stock_count,
      SUM(current_stock * cost_per_unit) as total_inventory_value
    FROM ingredients
    WHERE is_active = 1
  `).get();

  res.json({ success: true, data: ingredients, summary });
});

// Ingredient categories
ingredientsRouter.get('/categories', (req, res) => {
  const categories = db.prepare('SELECT * FROM ingredient_categories ORDER BY sort_order ASC, id ASC').all();
  res.json({ success: true, data: categories });
});

// Single ingredient
ingredientsRouter.get('/:id', (req, res) => {
  const id = Number(req.params.id);
  const item = db.prepare(`
    SELECT i.*, c.name as category_name, s.name as supplier_name
    FROM ingredients i
    LEFT JOIN ingredient_categories c ON c.id = i.category_id
    LEFT JOIN suppliers s ON s.id = i.supplier_id
    WHERE i.id = ?
  `).get(id) as any;

  if (!item) {
    return res.status(404).json({ success: false, message: 'ไม่พบวัตถุดิบ' });
  }

  // Get recent 15 movements
  const movements = db.prepare(`
    SELECT m.*, u.full_name as created_by_name
    FROM inventory_movements m
    LEFT JOIN users u ON u.id = m.created_by
    WHERE m.ingredient_id = ?
    ORDER BY m.id DESC
    LIMIT 15
  `).all(id);

  res.json({ success: true, data: { ...item, recent_movements: movements } });
});

// Create ingredient
ingredientsRouter.post('/', requireRole('OWNER', 'STOCK_MANAGER'), (req, res) => {
  const {
    code,
    name,
    category_id,
    unit,
    current_stock = 0,
    min_reorder_stock = 0,
    cost_per_unit = 0, // Satang per base unit
    supplier_id,
    storage_location,
    expiry_date
  } = req.body;

  if (!code || !name || !unit) {
    return res.status(400).json({ success: false, message: 'กรุณากรอกรหัส ชื่อ และหน่วยนับของวัตถุดิบ' });
  }

  try {
    const info = db.prepare(`
      INSERT INTO ingredients (
        code, name, category_id, unit, current_stock, min_reorder_stock,
        cost_per_unit, supplier_id, storage_location, expiry_date
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      code.trim(),
      name.trim(),
      category_id || null,
      unit.trim(),
      Number(current_stock) || 0,
      Number(min_reorder_stock) || 0,
      Math.round(cost_per_unit || 0),
      supplier_id || null,
      storage_location || null,
      expiry_date || null
    );

    const createdId = info.lastInsertRowid;

    // Log opening balance movement if initial stock > 0
    if (Number(current_stock) > 0) {
      db.prepare(`
        INSERT INTO inventory_movements (
          ingredient_id, movement_type, reference_type, quantity_change,
          quantity_before, quantity_after, unit_cost, reason, note, created_by
        ) VALUES (?, 'ADJUSTMENT', 'MANUAL', ?, 0, ?, ?, 'ยอดยกมาเริ่มต้น', 'สร้างรายการวัตถุดิบใหม่', ?)
      `).run(
        createdId,
        Number(current_stock),
        Number(current_stock),
        Math.round(cost_per_unit || 0),
        req.user?.id || null
      );
    }

    logAudit({
      userId: req.user?.id,
      action: 'CREATE_INGREDIENT',
      entityType: 'INGREDIENT',
      entityId: createdId,
      newValues: { code, name, unit, current_stock }
    });

    const item = db.prepare('SELECT * FROM ingredients WHERE id = ?').get(createdId);
    res.status(201).json({ success: true, data: item });
  } catch (err: any) {
    if (err.message?.includes('UNIQUE')) {
      return res.status(400).json({ success: false, message: 'รหัสวัตถุดิบนี้มีอยู่ในระบบแล้ว' });
    }
    res.status(500).json({ success: false, message: 'เกิดข้อผิดพลาดในการสร้างวัตถุดิบ' });
  }
});

// Update ingredient
ingredientsRouter.put('/:id', requireRole('OWNER', 'STOCK_MANAGER'), (req, res) => {
  const id = Number(req.params.id);
  const {
    code,
    name,
    category_id,
    unit,
    min_reorder_stock,
    cost_per_unit,
    supplier_id,
    storage_location,
    expiry_date
  } = req.body;

  try {
    db.prepare(`
      UPDATE ingredients
      SET code = coalesce(?, code),
          name = coalesce(?, name),
          category_id = coalesce(?, category_id),
          unit = coalesce(?, unit),
          min_reorder_stock = coalesce(?, min_reorder_stock),
          cost_per_unit = coalesce(?, cost_per_unit),
          supplier_id = coalesce(?, supplier_id),
          storage_location = coalesce(?, storage_location),
          expiry_date = coalesce(?, expiry_date),
          updated_at = datetime('now', 'localtime')
      WHERE id = ?
    `).run(
      code?.trim(),
      name?.trim(),
      category_id,
      unit?.trim(),
      min_reorder_stock !== undefined ? Number(min_reorder_stock) : null,
      cost_per_unit !== undefined ? Math.round(cost_per_unit) : null,
      supplier_id,
      storage_location,
      expiry_date,
      id
    );

    const updated = db.prepare('SELECT * FROM ingredients WHERE id = ?').get(id);
    res.json({ success: true, data: updated });
  } catch (err: any) {
    res.status(500).json({ success: false, message: 'เกิดข้อผิดพลาดในการแก้ไขวัตถุดิบ' });
  }
});

// Soft delete
ingredientsRouter.delete('/:id', requireRole('OWNER'), (req, res) => {
  const id = Number(req.params.id);
  // Check if in use in recipes
  const inRecipe = db.prepare('SELECT id FROM recipe_items WHERE ingredient_id = ? LIMIT 1').get(id);
  if (inRecipe) {
    return res.status(400).json({ success: false, message: 'ไม่สามารถลบได้เนื่องจากวัตถุดิบนี้ถูกใช้อยู่ในสูตรเครื่องดื่ม' });
  }

  db.prepare(`UPDATE ingredients SET is_active = 0, updated_at = datetime('now', 'localtime') WHERE id = ?`).run(id);
  res.json({ success: true, message: 'ปิดการใช้งานวัตถุดิบเรียบร้อยแล้ว' });
});
