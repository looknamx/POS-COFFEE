import { Router } from 'express';
import { db } from '../db/index.js';
import { requireRole } from '../middleware/auth.js';
import { logAudit } from '../services/auditService.js';

export const expensesRouter = Router();

// List expenses with date filtering
expensesRouter.get('/', (req, res) => {
  const { start_date, end_date, category_id } = req.query;

  let query = `
    SELECT e.*, ec.name as category_name, u.full_name as created_by_name
    FROM expenses e
    LEFT JOIN expense_categories ec ON ec.id = e.category_id
    LEFT JOIN users u ON u.id = e.created_by
    WHERE 1=1
  `;
  const params: any[] = [];

  if (start_date) {
    query += ` AND date(e.expense_date) >= date(?)`;
    params.push(start_date);
  }
  if (end_date) {
    query += ` AND date(e.expense_date) <= date(?)`;
    params.push(end_date);
  }
  if (category_id) {
    query += ` AND e.category_id = ?`;
    params.push(category_id);
  }

  query += ` ORDER BY e.expense_date DESC, e.id DESC`;
  const expenses = db.prepare(query).all(...params);

  // Total amount in query
  const totalRow = db.prepare(`SELECT COALESCE(SUM(amount), 0) as total FROM (${query})`).get(...params) as { total: number };

  res.json({ success: true, data: expenses, totalAmount: totalRow?.total || 0 });
});

// Categories list
expensesRouter.get('/categories', (req, res) => {
  const categories = db.prepare('SELECT * FROM expense_categories ORDER BY id ASC').all();
  res.json({ success: true, data: categories });
});

// Create category
expensesRouter.post('/categories', requireRole('OWNER'), (req, res) => {
  const { name } = req.body;
  if (!name || !name.trim()) return res.status(400).json({ success: false, message: 'กรุณากรอกชื่อหมวดหมู่' });

  try {
    const info = db.prepare('INSERT INTO expense_categories (name, is_system) VALUES (?, 0)').run(name.trim());
    const created = db.prepare('SELECT * FROM expense_categories WHERE id = ?').get(info.lastInsertRowid);
    res.status(201).json({ success: true, data: created });
  } catch (err: any) {
    res.status(400).json({ success: false, message: 'หมวดหมู่นี้มีอยู่ในระบบแล้ว' });
  }
});

// Create expense
expensesRouter.post('/', requireRole('OWNER', 'STOCK_MANAGER'), (req, res) => {
  const {
    expense_date = new Date().toISOString(),
    category_id,
    title,
    amount, // In satang
    payment_method = 'CASH',
    note
  } = req.body;

  if (!title || !title.trim() || !amount || amount <= 0) {
    return res.status(400).json({ success: false, message: 'กรุณากรอกชื่อรายการและจำนวนเงินที่ถูกต้อง' });
  }

  try {
    const info = db.prepare(`
      INSERT INTO expenses (expense_date, category_id, title, amount, payment_method, note, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      expense_date,
      category_id || null,
      title.trim(),
      Math.round(amount),
      payment_method,
      note || null,
      req.user?.id || 1
    );

    const created = db.prepare(`
      SELECT e.*, ec.name as category_name 
      FROM expenses e 
      LEFT JOIN expense_categories ec ON ec.id = e.category_id 
      WHERE e.id = ?
    `).get(info.lastInsertRowid);

    logAudit({
      userId: req.user?.id,
      action: 'CREATE_EXPENSE',
      entityType: 'EXPENSE',
      entityId: info.lastInsertRowid,
      newValues: { title, amount }
    });

    res.status(201).json({ success: true, data: created });
  } catch (err: any) {
    res.status(500).json({ success: false, message: 'เกิดข้อผิดพลาดในการบันทึกค่าใช้จ่าย' });
  }
});

// Delete expense
expensesRouter.delete('/:id', requireRole('OWNER'), (req, res) => {
  const id = Number(req.params.id);
  db.prepare('DELETE FROM expenses WHERE id = ?').run(id);
  res.json({ success: true, message: 'ลบรายการค่าใช้จ่ายเรียบร้อยแล้ว' });
});
