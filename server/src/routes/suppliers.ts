import { Router } from 'express';
import { db } from '../db/index.js';
import { requireRole } from '../middleware/auth.js';
import { logAudit } from '../services/auditService.js';

export const suppliersRouter = Router();

// List suppliers with total purchase amount
suppliersRouter.get('/', (req, res) => {
  const suppliers = db.prepare(`
    SELECT s.*,
           COUNT(pr.id) as total_receipts,
           COALESCE(SUM(pr.total_amount), 0) as total_purchases
    FROM suppliers s
    LEFT JOIN purchase_receipts pr ON pr.supplier_id = s.id AND pr.status = 'COMPLETED'
    WHERE s.is_active = 1
    GROUP BY s.id
    ORDER BY s.name ASC
  `).all();
  res.json({ success: true, data: suppliers });
});

// Single supplier with purchase history
suppliersRouter.get('/:id', (req, res) => {
  const id = Number(req.params.id);
  const supplier = db.prepare('SELECT * FROM suppliers WHERE id = ?').get(id) as any;
  if (!supplier) return res.status(404).json({ success: false, message: 'ไม่พบซัพพลายเออร์' });

  const receipts = db.prepare(`
    SELECT * FROM purchase_receipts 
    WHERE supplier_id = ? 
    ORDER BY id DESC LIMIT 20
  `).all(id);

  res.json({ success: true, data: { ...supplier, receipts } });
});

// Create supplier
suppliersRouter.post('/', requireRole('OWNER', 'STOCK_MANAGER'), (req, res) => {
  const { code, name, contact_name, phone, email, address, tax_id, note } = req.body;
  if (!name || !name.trim()) {
    return res.status(400).json({ success: false, message: 'กรุณากรอกชื่อบริษัทหรือร้านค้าซัพพลายเออร์' });
  }

  try {
    const info = db.prepare(`
      INSERT INTO suppliers (code, name, contact_name, phone, email, address, tax_id, note)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      code?.trim() || `SUP-${Date.now().toString().slice(-4)}`,
      name.trim(),
      contact_name?.trim() || null,
      phone?.trim() || null,
      email?.trim() || null,
      address?.trim() || null,
      tax_id?.trim() || null,
      note?.trim() || null
    );

    const created = db.prepare('SELECT * FROM suppliers WHERE id = ?').get(Number(info.lastInsertRowid));
    res.status(201).json({ success: true, data: created });
  } catch (err: any) {
    res.status(500).json({ success: false, message: 'เกิดข้อผิดพลาดในการบันทึกซัพพลายเออร์' });
  }
});

// Update supplier
suppliersRouter.put('/:id', requireRole('OWNER', 'STOCK_MANAGER'), (req, res) => {
  const id = Number(req.params.id);
  const { code, name, contact_name, phone, email, address, tax_id, note } = req.body;

  try {
    db.prepare(`
      UPDATE suppliers
      SET code = coalesce(?, code),
          name = coalesce(?, name),
          contact_name = coalesce(?, contact_name),
          phone = coalesce(?, phone),
          email = coalesce(?, email),
          address = coalesce(?, address),
          tax_id = coalesce(?, tax_id),
          note = coalesce(?, note)
      WHERE id = ?
    `).run(code, name, contact_name, phone, email, address, tax_id, note, id);

    const updated = db.prepare('SELECT * FROM suppliers WHERE id = ?').get(id);
    res.json({ success: true, data: updated });
  } catch (err: any) {
    res.status(500).json({ success: false, message: 'เกิดข้อผิดพลาดในการแก้ไข' });
  }
});

// Delete supplier (soft delete)
suppliersRouter.delete('/:id', requireRole('OWNER'), (req, res) => {
  const id = Number(req.params.id);
  db.prepare('UPDATE suppliers SET is_active = 0 WHERE id = ?').run(id);
  res.json({ success: true, message: 'ปิดการใช้งานซัพพลายเออร์เรียบร้อยแล้ว' });
});
