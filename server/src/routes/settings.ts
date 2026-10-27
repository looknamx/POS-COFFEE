import { Router } from 'express';
import multer from 'multer';
import path from 'node:path';
import fs from 'node:fs';
import { db } from '../db/index.js';
import { requireRole } from '../middleware/auth.js';
import { logAudit } from '../services/auditService.js';

export const settingsRouter = Router();

const bannersDir = path.resolve(process.cwd(), 'uploads/banners');
if (!fs.existsSync(bannersDir)) {
  fs.mkdirSync(bannersDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, bannersDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname) || '.jpg';
    cb(null, `promo-${uniqueSuffix}${ext}`);
  }
});
const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB
});

// Upload promotion banner image
settingsRouter.post('/upload-banner', requireRole('OWNER'), upload.single('banner'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ success: false, message: 'กรุณาเลือกไฟล์รูปภาพ' });
  }
  const fileUrl = `/uploads/banners/${req.file.filename}`;
  res.json({ success: true, url: fileUrl });
});

// Get all settings
settingsRouter.get('/', (req, res) => {
  const rows = db.prepare('SELECT key, value, description, updated_at FROM store_settings').all() as any[];
  const settings: Record<string, string> = {};
  for (const r of rows) {
    settings[r.key] = r.value;
  }
  res.json({ success: true, data: settings, raw: rows });
});

// Update settings
settingsRouter.put('/', requireRole('OWNER'), (req, res) => {
  const updates = req.body as Record<string, any>;
  if (!updates || typeof updates !== 'object') {
    return res.status(400).json({ success: false, message: 'ข้อมูลไม่ถูกต้อง' });
  }

  const upsertStmt = db.prepare(`
    INSERT INTO store_settings (key, value, updated_at)
    VALUES (?, ?, datetime('now', 'localtime'))
    ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now', 'localtime')
  `);

  for (const [key, val] of Object.entries(updates)) {
    upsertStmt.run(key, String(val));
  }

  logAudit({
    userId: req.user?.id,
    action: 'UPDATE_SETTINGS',
    entityType: 'STORE_SETTINGS',
    newValues: updates
  });

  res.json({ success: true, message: 'บันทึกการตั้งค่าร้านค้าเรียบร้อยแล้ว' });
});

