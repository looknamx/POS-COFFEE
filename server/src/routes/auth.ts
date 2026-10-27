import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { db } from '../db/index.js';
import { JWT_SECRET } from '../middleware/auth.js';
import { logAudit } from '../services/auditService.js';

export const authRouter = Router();

// Login
authRouter.post('/login', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ success: false, message: 'กรุณากรอกชื่อผู้ใช้และรหัสผ่าน' });
  }

  const user = db.prepare('SELECT * FROM users WHERE username = ? AND is_active = 1').get(username) as any;
  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    return res.status(401).json({ success: false, message: 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง' });
  }

  // Update last login
  db.prepare(`UPDATE users SET last_login_at = datetime('now', 'localtime') WHERE id = ?`).run(user.id);

  const payload = {
    id: user.id,
    username: user.username,
    fullName: user.full_name,
    role: user.role
  };

  const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' });

  logAudit({
    userId: user.id,
    action: 'LOGIN',
    entityType: 'USER',
    entityId: user.id,
    newValues: { username: user.username }
  });

  res.json({
    success: true,
    message: 'เข้าสู่ระบบสำเร็จ',
    token,
    user: payload
  });
});

// Current User Profile
authRouter.get('/me', (req, res) => {
  if (!req.user) {
    return res.status(401).json({ success: false, message: 'ไม่ได้เข้าสู่ระบบ' });
  }
  res.json({ success: true, user: req.user });
});

// Active Staff List (for fast cashier switching at POS counter)
authRouter.get('/staff', (req, res) => {
  const staff = db.prepare('SELECT id, username, full_name as fullName, role FROM users WHERE is_active = 1 ORDER BY id ASC').all();
  res.json({ success: true, data: staff });
});

