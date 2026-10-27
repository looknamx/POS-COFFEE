import { Router } from 'express';
import { db } from '../db/index.js';
import { requireRole } from '../middleware/auth.js';

export const categoriesRouter = Router();

// List categories
categoriesRouter.get('/', (req, res) => {
  const categories = db.prepare(`
    SELECT c.*, COUNT(p.id) as product_count
    FROM product_categories c
    LEFT JOIN products p ON p.category_id = c.id AND p.is_active = 1
    WHERE c.is_active = 1
    GROUP BY c.id
    ORDER BY c.sort_order ASC, c.id ASC
  `).all();
  res.json({ success: true, data: categories });
});

// Create category
categoriesRouter.post('/', requireRole('OWNER', 'STOCK_MANAGER'), (req, res) => {
  const { name, icon, sort_order } = req.body;
  if (!name || !name.trim()) {
    return res.status(400).json({ success: false, message: 'กรุณากรอกชื่อหมวดหมู่' });
  }

  try {
    const info = db.prepare(`
      INSERT INTO product_categories (name, icon, sort_order)
      VALUES (?, ?, ?)
    `).run(name.trim(), icon || 'Tag', sort_order || 0);

    const created = db.prepare('SELECT * FROM product_categories WHERE id = ?').get(info.lastInsertRowid);
    res.status(201).json({ success: true, data: created });
  } catch (err: any) {
    if (err.message?.includes('UNIQUE')) {
      return res.status(400).json({ success: false, message: 'ชื่อหมวดหมู่นี้มีอยู่ในระบบแล้ว' });
    }
    res.status(500).json({ success: false, message: 'เกิดข้อผิดพลาดในการสร้างหมวดหมู่' });
  }
});

// Update category
categoriesRouter.put('/:id', requireRole('OWNER', 'STOCK_MANAGER'), (req, res) => {
  const id = Number(req.params.id);
  const { name, icon, sort_order } = req.body;

  try {
    db.prepare(`
      UPDATE product_categories
      SET name = coalesce(?, name),
          icon = coalesce(?, icon),
          sort_order = coalesce(?, sort_order)
      WHERE id = ?
    `).run(name?.trim(), icon, sort_order, id);

    const updated = db.prepare('SELECT * FROM product_categories WHERE id = ?').get(id);
    res.json({ success: true, data: updated });
  } catch (err: any) {
    res.status(500).json({ success: false, message: 'เกิดข้อผิดพลาดในการแก้ไขหมวดหมู่' });
  }
});

// Delete (soft delete) category
categoriesRouter.delete('/:id', requireRole('OWNER'), (req, res) => {
  const id = Number(req.params.id);
  db.prepare('UPDATE product_categories SET is_active = 0 WHERE id = ?').run(id);
  res.json({ success: true, message: 'ลบหมวดหมู่เรียบร้อยแล้ว' });
});
