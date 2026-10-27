import { Router } from 'express';
import path from 'node:path';
import fs from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import multer from 'multer';
import { db, DB_PATH, reloadDatabase } from '../db/index.js';
import { requireRole } from '../middleware/auth.js';
import { logAudit } from '../services/auditService.js';
import {
  backupsDir,
  createBackupSnapshot,
  getAutoBackupConfig,
  updateAutoBackupConfig,
  checkAndRunAutoBackup,
  deleteBackupRecord
} from '../services/backupService.js';

export const backupRouter = Router();

// Multer upload config
const upload = multer({
  dest: path.join(backupsDir, 'temp_uploads'),
  limits: { fileSize: 50 * 1024 * 1024 } // 50 MB max
});

// 1. Get Auto-Backup Configuration & Schedule
backupRouter.get('/config', requireRole('OWNER'), (req, res) => {
  try {
    const config = getAutoBackupConfig();
    res.json({ success: true, data: config });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// 2. Update Auto-Backup Configuration (Interval: 7, 15, 30 days)
backupRouter.put('/config', requireRole('OWNER'), (req, res) => {
  const { enabled, intervalDays, retentionDays } = req.body;

  try {
    updateAutoBackupConfig({
      enabled: enabled !== undefined ? Boolean(enabled) : undefined,
      intervalDays: intervalDays !== undefined ? Number(intervalDays) : undefined,
      retentionDays: retentionDays !== undefined ? Number(retentionDays) : undefined
    });

    const updated = getAutoBackupConfig();

    logAudit({
      userId: req.user?.id,
      action: 'UPDATE_AUTO_BACKUP_CONFIG',
      entityType: 'STORE_SETTINGS',
      newValues: { enabled, intervalDays, retentionDays }
    });

    res.json({
      success: true,
      message: 'บันทึกการตั้งค่าสำรองข้อมูลอัตโนมัติเรียบร้อยแล้ว',
      data: updated
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// 3. Trigger Auto-Backup Check & Run on Demand
backupRouter.post('/auto-run', requireRole('OWNER'), async (req, res) => {
  try {
    const result = await checkAndRunAutoBackup();
    res.json({
      success: true,
      message: result.triggered
        ? 'ดำเนินการสำรองข้อมูลอัตโนมัติสำเร็จ'
        : `ระบบยังไม่ถึงรอบเวลาสำรองข้อมูล (${result.reason})`,
      data: result
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// 4. List backup records
backupRouter.get('/records', requireRole('OWNER'), (req, res) => {
  const records = db.prepare('SELECT * FROM backup_records ORDER BY id DESC').all();
  res.json({ success: true, data: records });
});

// 5. Create Manual Backup
backupRouter.post('/create', requireRole('OWNER'), (req, res) => {
  const { note } = req.body;

  try {
    const backup = createBackupSnapshot('MANUAL', note || 'สำรองข้อมูลด้วยตนเอง', req.user?.id);
    res.status(201).json({
      success: true,
      message: 'สร้างไฟล์สำรองข้อมูลสำเร็จ',
      data: backup
    });
  } catch (err: any) {
    console.error('Backup error:', err);
    res.status(500).json({ success: false, message: 'เกิดข้อผิดพลาดในการสำรองข้อมูล: ' + err.message });
  }
});

// 6. Delete backup record & file
backupRouter.delete('/records/:id', requireRole('OWNER'), (req, res) => {
  const id = Number(req.params.id);

  try {
    const deleted = deleteBackupRecord(id);

    logAudit({
      userId: req.user?.id,
      action: 'DELETE_BACKUP',
      entityType: 'BACKUP',
      entityId: id,
      newValues: { filename: deleted.filename }
    });

    res.json({ success: true, message: `ลบไฟล์สำรอง ${deleted.filename} เรียบร้อยแล้ว` });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// 7. Download backup file
backupRouter.get('/download/:id', requireRole('OWNER'), (req, res) => {
  const id = Number(req.params.id);
  const record = db.prepare('SELECT * FROM backup_records WHERE id = ?').get(id) as any;
  if (!record) {
    return res.status(404).json({ success: false, message: 'ไม่พบประวัติการสำรองข้อมูล' });
  }

  const safePath = path.resolve(record.filepath);
  if (!safePath.startsWith(backupsDir) || !fs.existsSync(safePath)) {
    return res.status(404).json({ success: false, message: 'ไม่พบไฟล์สำรองบนเครื่อง' });
  }

  res.download(safePath, record.filename);
});

// 8. Restore backup from uploaded file
backupRouter.post('/restore', requireRole('OWNER'), upload.single('backup_file'), (req, res) => {
  const file = req.file;
  if (!file) {
    return res.status(400).json({ success: false, message: 'กรุณาเลือกไฟล์สำรองข้อมูล (.db)' });
  }

  const uploadedPath = file.path;

  try {
    // 1. Validate SQLite file integrity
    let testDb: DatabaseSync;
    try {
      testDb = new DatabaseSync(uploadedPath);
      const integrityCheck = testDb.prepare('PRAGMA integrity_check;').get() as any;
      testDb.close();

      const integrityVal = Object.values(integrityCheck || {})[0];
      if (integrityVal !== 'ok') {
        fs.unlinkSync(uploadedPath);
        return res.status(400).json({ success: false, message: 'ไฟล์ฐานข้อมูลชำรุดหรือไม่ถูกต้อง (Integrity check failed)' });
      }
    } catch (testErr: any) {
      if (fs.existsSync(uploadedPath)) fs.unlinkSync(uploadedPath);
      return res.status(400).json({ success: false, message: 'ไฟล์ที่อัปโหลดไม่ใช่ไฟล์ฐานข้อมูล SQLite ที่ถูกต้อง' });
    }

    // 2. Automatically create a safety backup of current state BEFORE restoring
    const safetyBackup = createBackupSnapshot('AUTO_BEFORE_RESTORE', 'สำรองข้อมูลอัตโนมัติก่อนกู้คืน', req.user?.id);

    // 3. Replace active DB file with uploaded file
    reloadDatabase(); // Closes connection
    fs.copyFileSync(uploadedPath, DB_PATH);
    fs.unlinkSync(uploadedPath); // Clean temp upload
    reloadDatabase(); // Re-opens new DB

    logAudit({
      userId: req.user?.id,
      action: 'RESTORE_DATABASE',
      entityType: 'BACKUP',
      newValues: { originalName: file.originalname, safetyBackup: safetyBackup.filename }
    });

    res.json({
      success: true,
      message: 'กู้คืนฐานข้อมูลสำเร็จ พร้อมสร้างจุดปลอดภัยย้อนกลับเรียบร้อยแล้ว'
    });
  } catch (err: any) {
    console.error('Restore error:', err);
    if (fs.existsSync(uploadedPath)) fs.unlinkSync(uploadedPath);
    res.status(500).json({ success: false, message: 'เกิดข้อผิดพลาดในการกู้คืนฐานข้อมูล: ' + err.message });
  }
});
