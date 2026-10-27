import path from 'node:path';
import fs from 'node:fs';
import { db } from '../db/index.js';
import { logAudit } from './auditService.js';

export const backupsDir = path.resolve(process.cwd(), 'backups');
if (!fs.existsSync(backupsDir)) {
  fs.mkdirSync(backupsDir, { recursive: true });
}

export interface AutoBackupConfig {
  enabled: boolean;
  intervalDays: 7 | 15 | 30 | number;
  retentionDays: 30 | 60 | 90 | number; // 0 = keep forever
  lastRun: string | null;
  nextRun: string | null;
  totalBackups: number;
}

// Create backup using SQLite VACUUM INTO
export function createBackupSnapshot(
  backupType: 'MANUAL' | 'AUTO_SCHEDULED' | 'AUTO_BEFORE_RESTORE' = 'MANUAL',
  note?: string,
  userId?: number
) {
  const now = new Date();
  const timestamp = now.toISOString().replace(/[-:T]/g, '').slice(0, 14);
  const prefix = backupType === 'AUTO_SCHEDULED' ? 'auto' : backupType === 'AUTO_BEFORE_RESTORE' ? 'safety' : 'manual';
  const filename = `backup_${prefix}_${timestamp}.db`;
  const targetPath = path.join(backupsDir, filename);

  // SQLite VACUUM INTO creates a consistent online snapshot
  const escapedPath = targetPath.replace(/\\/g, '/');
  db.exec(`VACUUM INTO '${escapedPath}'`);

  const stat = fs.statSync(targetPath);

  const defaultNote =
    backupType === 'AUTO_SCHEDULED'
      ? 'สำรองข้อมูลอัตโนมัติตามรอบเวลา'
      : backupType === 'AUTO_BEFORE_RESTORE'
      ? 'สำรองข้อมูลอัตโนมัติก่อนกู้คืน'
      : 'สำรองข้อมูลด้วยตนเอง';

  const info = db.prepare(`
    INSERT INTO backup_records (filename, filepath, size_bytes, backup_type, note, created_at)
    VALUES (?, ?, ?, ?, ?, datetime('now', 'localtime'))
  `).run(filename, targetPath, stat.size, backupType, note || defaultNote);

  logAudit({
    userId,
    action: 'CREATE_BACKUP',
    entityType: 'BACKUP',
    entityId: Number(info.lastInsertRowid),
    newValues: { filename, size: stat.size, backupType }
  });

  return {
    id: Number(info.lastInsertRowid),
    filename,
    filepath: targetPath,
    size_bytes: stat.size,
    backup_type: backupType,
    note: note || defaultNote,
    created_at: now.toISOString()
  };
}

// Prune old backup files exceeding retention period (keeps at least 3 recent files)
export function pruneOldBackups(retentionDays: number) {
  if (retentionDays <= 0) return 0; // 0 = keep forever

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - retentionDays);
  const cutoffStr = cutoff.toISOString().slice(0, 19).replace('T', ' ');

  // Find all auto backups older than cutoff
  const candidates = db.prepare(`
    SELECT id, filename, filepath, created_at
    FROM backup_records
    WHERE backup_type = 'AUTO_SCHEDULED' AND created_at < ?
    ORDER BY id ASC
  `).all(cutoffStr) as any[];

  // Total auto backups currently
  const totalAuto = db.prepare(`
    SELECT COUNT(*) as c FROM backup_records WHERE backup_type = 'AUTO_SCHEDULED'
  `).get() as { c: number };

  let deletedCount = 0;
  // Safeguard: always keep at least 3 most recent auto backups
  const maxToDelete = Math.max(0, totalAuto.c - 3);

  for (let i = 0; i < Math.min(candidates.length, maxToDelete); i++) {
    const rec = candidates[i];
    try {
      if (fs.existsSync(rec.filepath)) {
        fs.unlinkSync(rec.filepath);
      }
      db.prepare('DELETE FROM backup_records WHERE id = ?').run(rec.id);
      deletedCount++;
    } catch (e) {
      console.error(`Failed to prune backup file: ${rec.filepath}`, e);
    }
  }

  return deletedCount;
}

// Read Auto Backup configuration from store_settings
export function getAutoBackupConfig(): AutoBackupConfig {
  const getSetting = (key: string, defaultVal: string) => {
    const row = db.prepare('SELECT value FROM store_settings WHERE key = ?').get(key) as any;
    return row?.value ?? defaultVal;
  };

  const enabled = getSetting('auto_backup_enabled', '1') === '1';
  const intervalDays = parseInt(getSetting('auto_backup_interval_days', '7'), 10) || 7;
  const retentionDays = parseInt(getSetting('auto_backup_retention_days', '60'), 10) || 60;
  const lastRun = getSetting('auto_backup_last_run', '');

  let nextRun: string | null = null;
  if (enabled) {
    if (lastRun) {
      const d = new Date(lastRun);
      if (!isNaN(d.getTime())) {
        d.setDate(d.getDate() + intervalDays);
        nextRun = d.toISOString();
      }
    } else {
      // If never run yet, next run is immediate or today
      nextRun = new Date().toISOString();
    }
  }

  const countRow = db.prepare('SELECT COUNT(*) as c FROM backup_records').get() as { c: number };

  return {
    enabled,
    intervalDays,
    retentionDays,
    lastRun: lastRun || null,
    nextRun,
    totalBackups: countRow.c
  };
}

// Update Auto Backup Configuration
export function updateAutoBackupConfig(updates: {
  enabled?: boolean;
  intervalDays?: number;
  retentionDays?: number;
}) {
  const upsert = db.prepare(`
    INSERT INTO store_settings (key, value, updated_at)
    VALUES (?, ?, datetime('now', 'localtime'))
    ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now', 'localtime')
  `);

  if (updates.enabled !== undefined) {
    upsert.run('auto_backup_enabled', updates.enabled ? '1' : '0');
  }
  if (updates.intervalDays !== undefined) {
    upsert.run('auto_backup_interval_days', String(updates.intervalDays));
  }
  if (updates.retentionDays !== undefined) {
    upsert.run('auto_backup_retention_days', String(updates.retentionDays));
  }
}

// Check and execute auto-backup if overdue
export async function checkAndRunAutoBackup(): Promise<{
  triggered: boolean;
  reason?: string;
  backup?: any;
  prunedCount?: number;
}> {
  const config = getAutoBackupConfig();

  if (!config.enabled) {
    return { triggered: false, reason: 'Auto backup is disabled' };
  }

  const now = new Date();
  let shouldRun = false;

  if (!config.lastRun) {
    shouldRun = true;
  } else {
    const lastDate = new Date(config.lastRun);
    if (isNaN(lastDate.getTime())) {
      shouldRun = true;
    } else {
      const diffMs = now.getTime() - lastDate.getTime();
      const intervalMs = config.intervalDays * 24 * 60 * 60 * 1000;
      if (diffMs >= intervalMs) {
        shouldRun = true;
      }
    }
  }

  if (!shouldRun) {
    return { triggered: false, reason: `Not due yet. Next run: ${config.nextRun}` };
  }

  try {
    const note = `สำรองข้อมูลอัตโนมัติตามรอบทุก ${config.intervalDays} วัน`;
    const backup = createBackupSnapshot('AUTO_SCHEDULED', note);

    // Prune old backups
    const prunedCount = pruneOldBackups(config.retentionDays);

    // Update last run timestamp
    db.prepare(`
      INSERT INTO store_settings (key, value, updated_at)
      VALUES ('auto_backup_last_run', ?, datetime('now', 'localtime'))
      ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now', 'localtime')
    `).run(now.toISOString());

    console.log(`[AutoBackup] Completed auto backup: ${backup.filename} (Pruned ${prunedCount} old files)`);

    return {
      triggered: true,
      backup,
      prunedCount
    };
  } catch (err: any) {
    console.error('[AutoBackup] Error running auto backup:', err);
    return { triggered: false, reason: err.message };
  }
}

// Delete a backup record and its physical file
export function deleteBackupRecord(id: number) {
  const record = db.prepare('SELECT * FROM backup_records WHERE id = ?').get(id) as any;
  if (!record) {
    throw new Error('ไม่พบข้อมูลไฟล์สำรอง');
  }

  if (fs.existsSync(record.filepath)) {
    try {
      fs.unlinkSync(record.filepath);
    } catch (e) {
      console.warn(`Could not unlink file ${record.filepath}`, e);
    }
  }

  db.prepare('DELETE FROM backup_records WHERE id = ?').run(id);
  return record;
}

// Start Background Auto Backup Scheduler
export function startAutoBackupScheduler() {
  // Run first check 10 seconds after server startup
  setTimeout(() => {
    checkAndRunAutoBackup().catch((e) => console.error('[AutoBackup] Initial check failed', e));
  }, 10000);

  // Periodically check every 1 hour (3600000 ms)
  setInterval(() => {
    checkAndRunAutoBackup().catch((e) => console.error('[AutoBackup] Scheduled check failed', e));
  }, 60 * 60 * 1000);

  console.log('⏰ Auto Backup Scheduler initialized (Hourly check active)');
}

