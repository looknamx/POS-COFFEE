import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { db } from '../db/index.js';
import { requireRole } from '../middleware/auth.js';
import { logAudit } from '../services/auditService.js';

export const usersRouter = Router();

// List users
usersRouter.get('/', requireRole('OWNER'), (req, res) => {
  const users = db.prepare(`
    SELECT id, username, full_name, role, is_active, last_login_at, created_at
    FROM users
    ORDER BY id ASC
  `).all();
  res.json({ success: true, data: users });
});

// Create user
usersRouter.post('/', requireRole('OWNER'), (req, res) => {
  const { username, password, full_name, role = 'CASHIER' } = req.body;

  if (!username || !password || !full_name) {
    return res.status(400).json({ success: false, message: 'กรุณากรอกชื่อผู้ใช้ รหัสผ่าน และชื่อ-นามสกุล' });
  }

  if (password.length < 4) {
    return res.status(400).json({ success: false, message: 'รหัสผ่านต้องมีความยาวอย่างน้อย 4 ตัวอักษร' });
  }

  try {
    const passwordHash = bcrypt.hashSync(password, 10);
    const info = db.prepare(`
      INSERT INTO users (username, password_hash, full_name, role)
      VALUES (?, ?, ?, ?)
    `).run(username.trim().toLowerCase(), passwordHash, full_name.trim(), role);

    logAudit({
      userId: req.user?.id,
      action: 'CREATE_USER',
      entityType: 'USER',
      entityId: Number(info.lastInsertRowid),
      newValues: { username, role }
    });

    res.status(201).json({ success: true, message: 'สร้างผู้ใช้งานสำเร็จ' });
  } catch (err: any) {
    if (err.message?.includes('UNIQUE')) {
      return res.status(400).json({ success: false, message: 'ชื่อผู้ใช้นี้มีอยู่ในระบบแล้ว' });
    }
    res.status(500).json({ success: false, message: 'เกิดข้อผิดพลาดในการสร้างผู้ใช้งาน' });
  }
});

// Update user
usersRouter.put('/:id', requireRole('OWNER'), (req, res) => {
  const id = Number(req.params.id);
  const { full_name, role, is_active, password } = req.body;

  try {
    let query = `
      UPDATE users 
      SET full_name = coalesce(?, full_name),
          role = coalesce(?, role),
          is_active = coalesce(?, is_active),
          updated_at = datetime('now', 'localtime')
    `;
    const params: any[] = [
      full_name?.trim() || null,
      role || null,
      is_active !== undefined ? (is_active ? 1 : 0) : null
    ];

    if (password && password.trim().length >= 4) {
      query += `, password_hash = ?`;
      params.push(bcrypt.hashSync(password.trim(), 10));
    }

    query += ` WHERE id = ?`;
    params.push(id);

    db.prepare(query).run(...params);

    logAudit({
      userId: req.user?.id,
      action: 'UPDATE_USER',
      entityType: 'USER',
      entityId: id,
      newValues: { full_name, role, is_active }
    });

    res.json({ success: true, message: 'แก้ไขข้อมูลผู้ใช้สำเร็จ' });
  } catch (err: any) {
    res.status(500).json({ success: false, message: 'เกิดข้อผิดพลาดในการแก้ไขผู้ใช้' });
  }
});

// Delete user
usersRouter.delete('/:id', requireRole('OWNER'), (req, res) => {
  const id = Number(req.params.id);

  // Check user
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(id) as any;
  if (!user) {
    return res.status(404).json({ success: false, message: 'ไม่พบผู้ใช้งาน' });
  }

  // Prevent deleting currently logged-in user
  if (req.user?.id === id) {
    return res.status(400).json({ success: false, message: 'ไม่สามารถลบบัญชีที่คุณกำลังใช้งานอยู่ได้' });
  }

  // Prevent deleting the only OWNER
  if (user.role === 'OWNER') {
    const ownerCount = db.prepare("SELECT COUNT(*) as c FROM users WHERE role = 'OWNER' AND is_active = 1").get() as { c: number };
    if (ownerCount.c <= 1) {
      return res.status(400).json({ success: false, message: 'ไม่สามารถลบเจ้าของร้านคนสุดท้ายได้ ต้องมีเจ้าของร้านอย่างน้อย 1 บัญชี' });
    }
  }

  try {
    // If user has sales history, soft delete by setting is_active = 0
    const salesCount = db.prepare('SELECT COUNT(*) as c FROM sales WHERE cashier_id = ?').get(id) as { c: number };
    if (salesCount.c > 0) {
      db.prepare(`UPDATE users SET is_active = 0, updated_at = datetime('now', 'localtime') WHERE id = ?`).run(id);
      return res.json({ success: true, message: 'ปิดการใช้งานบัญชีพนักงานเรียบร้อยแล้ว (มีประวัติการขายในระบบ)' });
    }

    db.prepare('DELETE FROM users WHERE id = ?').run(id);

    logAudit({
      userId: req.user?.id,
      action: 'DELETE_USER',
      entityType: 'USER',
      entityId: id,
      newValues: { username: user.username }
    });

    res.json({ success: true, message: 'ลบบัญชีพนักงานเรียบร้อยแล้ว' });
  } catch (err: any) {
    res.status(500).json({ success: false, message: 'เกิดข้อผิดพลาดในการลบผู้ใช้งาน' });
  }
});
