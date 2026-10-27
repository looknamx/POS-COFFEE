import React, { useState, useEffect } from 'react';
import {
  Database,
  Download,
  Upload,
  AlertTriangle,
  CheckCircle,
  Clock,
  ShieldCheck,
  FileText,
  Trash2,
  Calendar,
  Sparkles,
  RefreshCw,
  Save,
  Play
} from 'lucide-react';
import { apiRequest, formatThaiDateTime } from '../api/client';

export interface AutoBackupConfigState {
  enabled: boolean;
  intervalDays: number;
  retentionDays: number;
  lastRun: string | null;
  nextRun: string | null;
  totalBackups: number;
}

export const BackupView: React.FC = () => {
  const [backups, setBackups] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [creatingBackup, setCreatingBackup] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [restoreMessage, setRestoreMessage] = useState<string | null>(null);
  const [backupNote, setBackupNote] = useState('');

  // Auto Backup Configuration State
  const [autoConfig, setAutoConfig] = useState<AutoBackupConfigState>({
    enabled: true,
    intervalDays: 7,
    retentionDays: 60,
    lastRun: null,
    nextRun: null,
    totalBackups: 0
  });
  const [savingConfig, setSavingConfig] = useState(false);
  const [runningAutoCheck, setRunningAutoCheck] = useState(false);
  const [configSuccessMsg, setConfigSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    fetchBackups();
    fetchAutoConfig();
  }, []);

  const fetchBackups = async () => {
    setLoading(true);
    const res = await apiRequest('/backup/records');
    if (res.success && res.data) {
      setBackups(res.data);
    }
    setLoading(false);
  };

  const fetchAutoConfig = async () => {
    const res = await apiRequest<AutoBackupConfigState>('/backup/config');
    if (res.success && res.data) {
      setAutoConfig(res.data);
    }
  };

  // Save Auto Backup Settings
  const handleSaveAutoConfig = async () => {
    setSavingConfig(true);
    setConfigSuccessMsg(null);

    const res = await apiRequest('/backup/config', {
      method: 'PUT',
      body: JSON.stringify({
        enabled: autoConfig.enabled,
        intervalDays: autoConfig.intervalDays,
        retentionDays: autoConfig.retentionDays
      })
    });

    setSavingConfig(false);
    if (res.success && res.data) {
      setAutoConfig(res.data);
      setConfigSuccessMsg('บันทึกการตั้งค่าสำรองข้อมูลอัตโนมัติสำเร็จ');
      setTimeout(() => setConfigSuccessMsg(null), 4000);
    } else {
      alert(res.message || 'เกิดข้อผิดพลาดในการบันทึกการตั้งค่า');
    }
  };

  // Run Auto Backup Check On-Demand
  const handleRunAutoBackupNow = async () => {
    setRunningAutoCheck(true);
    setConfigSuccessMsg(null);

    const res = await apiRequest('/backup/auto-run', {
      method: 'POST'
    });

    setRunningAutoCheck(false);
    if (res.success) {
      setConfigSuccessMsg(res.message || 'ดำเนินการสำรองข้อมูลเรียบร้อยแล้ว');
      fetchAutoConfig();
      fetchBackups();
      setTimeout(() => setConfigSuccessMsg(null), 5000);
    } else {
      alert(res.message || 'เกิดข้อผิดพลาด');
    }
  };

  // Manual Backup
  const handleCreateBackup = async () => {
    setCreatingBackup(true);
    const res = await apiRequest('/backup/create', {
      method: 'POST',
      body: JSON.stringify({ note: backupNote || 'สำรองข้อมูลด้วยตนเอง' })
    });
    setCreatingBackup(false);

    if (res.success) {
      alert('สร้างไฟล์สำรองข้อมูลสำเร็จ!');
      setBackupNote('');
      fetchBackups();
      fetchAutoConfig();
    } else {
      alert(res.message || 'เกิดข้อผิดพลาดในการสำรองข้อมูล');
    }
  };

  // Delete Backup File
  const handleDeleteBackup = async (id: number, filename: string) => {
    if (!confirm(`คุณต้องการลบไฟล์สำรองข้อมูล "${filename}" ใช่หรือไม่?`)) {
      return;
    }

    const res = await apiRequest(`/backup/records/${id}`, {
      method: 'DELETE'
    });

    if (res.success) {
      fetchBackups();
      fetchAutoConfig();
    } else {
      alert(res.message || 'ไม่สามารถลบไฟล์สำรองได้');
    }
  };

  const handleDownloadBackup = (id: number) => {
    window.location.href = `/api/backup/download/${id}`;
  };

  const handleRestoreFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (
      !confirm(
        `คำเตือน: คุณต้องการกู้คืนข้อมูลจากไฟล์ "${file.name}" ใช่หรือไม่?\n\n(ระบบจะทำการสำรองข้อมูลปัจจุบันไว้ให้อัตโนมัติก่อนเริ่มกู้คืนเพื่อความปลอดภัย)`
      )
    ) {
      e.target.value = '';
      return;
    }

    setRestoring(true);
    setRestoreMessage(null);

    const formData = new FormData();
    formData.append('backup_file', file);

    try {
      const res = await fetch('/api/backup/restore', {
        method: 'POST',
        headers: {
          'x-cashier-id': localStorage.getItem('pos_active_staff_id') || '1'
        },
        body: formData
      });

      const json = await res.json();
      setRestoring(false);
      e.target.value = '';

      if (json.success) {
        setRestoreMessage('กู้คืนฐานข้อมูลสำเร็จเรียบร้อยแล้ว!');
        fetchBackups();
        setTimeout(() => {
          window.location.reload();
        }, 1500);
      } else {
        alert(json.message || 'ไฟล์สำรองไม่ถูกต้องหรือไม่สามารถกู้คืนได้');
      }
    } catch (err: any) {
      setRestoring(false);
      e.target.value = '';
      alert('เกิดข้อผิดพลาดในการเชื่อมต่อเซิร์ฟเวอร์');
    }
  };

  return (
    <div className="flex-1 p-6 overflow-y-auto space-y-6 bg-[#fbf9f6]">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-black text-[#321d14] flex items-center gap-2.5">
          <Database className="w-7 h-7 text-[#8b5537]" />
          สำรองและกู้คืนฐานข้อมูล (Database Backup & Restore)
        </h2>
        <p className="text-xs text-[#8b5537] mt-1">
          ระบบสำรองข้อมูลอัตโนมัติ (Auto Backup) ตามรอบเวลา 7 วัน / 15 วัน / 30 วัน ป้องกันข้อมูลสูญหาย และใช้สำหรับย้ายเครื่อง
        </p>
      </div>

      {restoreMessage && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center gap-3 text-xs text-emerald-800 font-bold animate-in fade-in">
          <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0" />
          <span>{restoreMessage} กำลังรีโหลดหน้าจอ...</span>
        </div>
      )}

      {configSuccessMsg && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center gap-2 text-xs text-emerald-800 font-bold shadow-2xs animate-in fade-in">
          <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{configSuccessMsg}</span>
        </div>
      )}

      {/* ========================================================= */}
      {/* 1. AUTO BACKUP CONFIGURATION CARD (FEATURE HIGHLIGHT)     */}
      {/* ========================================================= */}
      <div className="bg-white rounded-3xl p-6 border-2 border-[#8b5537]/20 shadow-xs space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#f3ece2]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-[#8b5537] to-[#5c3b2b] text-white flex items-center justify-center shadow-xs">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-base text-[#321d14]">
                  ระบบสำรองข้อมูลอัตโนมัติ (Auto Backup Schedule)
                </h3>
                {autoConfig.enabled ? (
                  <span className="bg-emerald-100 text-emerald-800 text-[11px] font-bold px-2.5 py-0.5 rounded-full flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    เปิดทำงานอยู่
                  </span>
                ) : (
                  <span className="bg-stone-200 text-stone-600 text-[11px] font-bold px-2.5 py-0.5 rounded-full">
                    ปิดการทำงาน
                  </span>
                )}
              </div>
              <p className="text-xs text-[#8b5537]">
                ระบบจะสร้างไฟล์สำรองข้อมูล Snapshot แบบออนไลน์อัตโนมัติ โดยไม่รบกวนหรือขัดจังหวะการขายหน้าร้าน
              </p>
            </div>
          </div>

          {/* Toggle Switch */}
          <label className="inline-flex items-center gap-2 cursor-pointer self-start sm:self-auto">
            <input
              type="checkbox"
              checked={autoConfig.enabled}
              onChange={(e) => setAutoConfig({ ...autoConfig, enabled: e.target.checked })}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-stone-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-stone-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#8b5537]"></div>
            <span className="text-xs font-bold text-stone-700">
              {autoConfig.enabled ? 'เปิดใช้งาน Auto Backup' : 'ปิดใช้งาน'}
            </span>
          </label>
        </div>

        {/* Configuration Controls */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {/* Interval Selector (7, 15, 30 days) */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-stone-700 flex items-center gap-1.5">
              <Calendar className="w-4 h-4 text-[#ba8452]" />
              <span>ความถี่ในการสำรองข้อมูลอัตโนมัติ (Interval)*</span>
            </label>
            <select
              value={autoConfig.intervalDays}
              onChange={(e) => setAutoConfig({ ...autoConfig, intervalDays: Number(e.target.value) })}
              className="w-full px-3.5 py-2.5 rounded-xl border border-stone-200 bg-[#fdfaf6] text-xs font-bold text-[#8b5537] focus:outline-none focus:border-[#8b5537]"
            >
              <option value="7">ทุก 7 วัน (ทุกสัปดาห์ - แนะนำสำหรับร้านทั่วไป)</option>
              <option value="15">ทุก 15 วัน (ทุกครึ่งเดือน)</option>
              <option value="30">ทุก 30 วัน (ทุก 1 เดือน)</option>
              <option value="1">ทุก 1 วัน (ทุกวัน - สำหรับร้านที่มียอดขายสูงมาก)</option>
            </select>
            <p className="text-[11px] text-stone-400">
              * รอบระยะเวลาที่จะสร้างไฟล์สำรองข้อมูล .db ใหม่อัตโนมัติ
            </p>
          </div>

          {/* Retention Policy Selector */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-stone-700 flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-[#ba8452]" />
              <span>นโยบายลบไฟล์เก่า (Retention Policy)*</span>
            </label>
            <select
              value={autoConfig.retentionDays}
              onChange={(e) => setAutoConfig({ ...autoConfig, retentionDays: Number(e.target.value) })}
              className="w-full px-3.5 py-2.5 rounded-xl border border-stone-200 bg-[#fdfaf6] text-xs font-semibold text-stone-800 focus:outline-none focus:border-[#8b5537]"
            >
              <option value="30">เก็บย้อนหลัง 30 วัน (ลบไฟล์เก่ากว่า 1 เดือน)</option>
              <option value="60">เก็บย้อนหลัง 60 วัน (2 เดือน - ค่าเริ่มต้นแนะนำ)</option>
              <option value="90">เก็บย้อนหลัง 90 วัน (3 เดือน)</option>
              <option value="0">เก็บไฟล์ทั้งหมดตลอดไป (ไม่ลบไฟล์เก่า)</option>
            </select>
            <p className="text-[11px] text-stone-400">
              * ช่วยประหยัดพื้นที่ฮาร์ดดิสก์ (ระบบจะเก็บไฟล์ล่าสุดอย่างน้อย 3 ไฟล์เสมอ)
            </p>
          </div>

          {/* Schedule Status & Next Run Box */}
          <div className="bg-[#fdfaf6] border border-[#ebdccd] rounded-2xl p-4 flex flex-col justify-between space-y-2">
            <div>
              <div className="text-[11px] font-semibold text-stone-500">สำรองข้อมูลอัตโนมัติล่าสุด:</div>
              <div className="text-xs font-bold text-stone-800">
                {autoConfig.lastRun ? formatThaiDateTime(autoConfig.lastRun) : 'ยังไม่มีประวัติการรัน'}
              </div>
            </div>

            <div className="pt-2 border-t border-[#f3ece2]">
              <div className="text-[11px] font-semibold text-stone-500">กำหนดรอบครั้งถัดไป:</div>
              <div className="text-xs font-black text-[#8b5537]">
                {autoConfig.enabled && autoConfig.nextRun
                  ? formatThaiDateTime(autoConfig.nextRun)
                  : 'ปิดการสำรองข้อมูลอัตโนมัติ'}
              </div>
            </div>
          </div>
        </div>

        {/* Action Buttons for Auto Backup */}
        <div className="pt-3 border-t border-stone-100 flex flex-col sm:flex-row items-center justify-between gap-3">
          <button
            type="button"
            onClick={handleRunAutoBackupNow}
            disabled={runningAutoCheck}
            className="w-full sm:w-auto px-4 py-2.5 rounded-xl border border-[#8b5537] text-[#8b5537] hover:bg-[#f7f1e7] text-xs font-bold transition cursor-pointer flex items-center justify-center gap-1.5"
          >
            <Play className="w-3.5 h-3.5" />
            <span>{runningAutoCheck ? 'กำลังรันสำรองข้อมูล...' : 'สั่งรัน Auto Backup เดี๋ยวนี้ (Run Now)'}</span>
          </button>

          <button
            type="button"
            onClick={handleSaveAutoConfig}
            disabled={savingConfig}
            className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-[#8b5537] hover:bg-[#714631] text-white text-xs font-bold transition shadow-xs flex items-center justify-center gap-2 cursor-pointer"
          >
            <Save className="w-4 h-4" />
            <span>{savingConfig ? 'กำลังบันทึก...' : 'บันทึกการตั้งค่า Auto Backup'}</span>
          </button>
        </div>
      </div>

      {/* ========================================================= */}
      {/* 2. MANUAL BACKUP & RESTORE CARDS                          */}
      {/* ========================================================= */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Card 1: Create Manual Backup */}
        <div className="bg-white rounded-3xl p-6 border border-[#ecddc8] shadow-2xs space-y-4">
          <div className="flex items-center gap-2 font-bold text-sm text-[#714631]">
            <Database className="w-5 h-5 text-[#ba8452]" />
            <span>สร้างไฟล์สำรองข้อมูลทันทีด้วยตนเอง (Manual Backup)</span>
          </div>

          <p className="text-xs text-stone-600 leading-relaxed">
            สร้างไฟล์สำรองข้อมูลฉุกเฉินได้ทันที เหมาะสำหรับทำก่อนอัปเดตระบบ หรือก่อนปรับปรุงรายการสินค้าครั้งใหญ่
          </p>

          <div className="space-y-1">
            <label className="text-[11px] font-semibold text-stone-500">บันทึกข้อความช่วยจำ (ถ้ามี)</label>
            <input
              type="text"
              placeholder="เช่น ก่อนปิดร้านประจำวัน, ปิดยอดสิ้นเดือน"
              value={backupNote}
              onChange={(e) => setBackupNote(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-stone-200 text-xs focus:outline-none focus:border-[#8b5537]"
            />
          </div>

          <button
            onClick={handleCreateBackup}
            disabled={creatingBackup}
            className="w-full py-3 px-4 rounded-2xl bg-[#8b5537] hover:bg-[#714631] text-white font-bold text-xs transition shadow-xs flex items-center justify-center gap-2 cursor-pointer"
          >
            <Download className="w-4 h-4" />
            {creatingBackup ? 'กำลังสำรองข้อมูล...' : 'สำรองข้อมูลเดี๋ยวนี้ (Create Manual Backup)'}
          </button>
        </div>

        {/* Card 2: Restore from file */}
        <div className="bg-white rounded-3xl p-6 border border-amber-200 shadow-2xs space-y-4">
          <div className="flex items-center gap-2 font-bold text-sm text-amber-900">
            <Upload className="w-5 h-5 text-amber-600" />
            <span>กู้คืนข้อมูลจากไฟล์ (Restore Database)</span>
          </div>

          <p className="text-xs text-stone-600 leading-relaxed">
            เลือกไฟล์ฐานข้อมูล (.db) ที่เคยสำรองไว้เพื่อกู้คืนข้อมูลเดิม
          </p>

          <div className="bg-amber-50 p-3 rounded-2xl border border-amber-200 flex items-start gap-2 text-xs text-amber-900">
            <ShieldCheck className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <span>
              ระบบมีความปลอดภัยสูง: ตรวจเช็คความถูกต้องของไฟล์ (Integrity Check) และสำรองฐานข้อมูลปัจจุบันให้อัตโนมัติก่อนเริ่มกู้คืน
            </span>
          </div>

          <label
            className={`w-full py-3 px-4 rounded-2xl font-bold text-xs transition shadow-xs flex items-center justify-center gap-2 cursor-pointer text-center ${
              restoring ? 'bg-stone-300 text-stone-500 cursor-not-allowed' : 'bg-stone-800 hover:bg-stone-900 text-white'
            }`}
          >
            <Upload className="w-4 h-4" />
            <span>{restoring ? 'กำลังตรวจสอบและกู้คืน...' : 'เลือกไฟล์ .db เพื่อกู้คืนข้อมูล'}</span>
            <input
              type="file"
              accept=".db"
              disabled={restoring}
              onChange={handleRestoreFile}
              className="hidden"
            />
          </label>
        </div>
      </div>

      {/* ========================================================= */}
      {/* 3. BACKUP HISTORY TABLE                                   */}
      {/* ========================================================= */}
      <div className="bg-white rounded-3xl border border-[#ecddc8] shadow-2xs overflow-hidden">
        <div className="p-4 bg-[#fdfaf6] border-b border-[#ebdccd] font-bold text-xs text-[#714631] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-[#ba8452]" />
            <span>ประวัติไฟล์สำรองข้อมูลทั้งหมดในเครื่อง ({backups.length} ไฟล์)</span>
          </div>
          <span className="text-[11px] text-stone-400 font-normal">ตำแหน่งจัดเก็บ: server/backups/</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-stone-200 text-stone-500 font-semibold bg-[#fcfaf7]">
                <th className="py-3 px-4">ชื่อไฟล์สำรอง (.db)</th>
                <th className="py-3 px-4">วันที่สำรอง (พ.ศ.)</th>
                <th className="py-3 px-4">ประเภท</th>
                <th className="py-3 px-4 text-right">ขนาดไฟล์</th>
                <th className="py-3 px-4">หมายเหตุ</th>
                <th className="py-3 px-4 text-center">จัดการ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-stone-400">
                    กำลังโหลดรายการสำรองข้อมูล...
                  </td>
                </tr>
              ) : backups.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-stone-400">
                    ยังไม่มีไฟล์สำรองในระบบ
                  </td>
                </tr>
              ) : (
                backups.map((b) => (
                  <tr key={b.id} className="hover:bg-stone-50 transition">
                    <td className="py-3 px-4 font-mono font-bold text-stone-900">
                      <div className="flex items-center gap-2">
                        <FileText className="w-3.5 h-3.5 text-stone-400 shrink-0" />
                        <span className="truncate max-w-xs">{b.filename}</span>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-stone-600 whitespace-nowrap">
                      {formatThaiDateTime(b.created_at)}
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                          b.backup_type === 'AUTO_SCHEDULED'
                            ? 'bg-blue-100 text-blue-800 border border-blue-200'
                            : b.backup_type === 'AUTO_BEFORE_RESTORE'
                            ? 'bg-amber-100 text-amber-800 border border-amber-200'
                            : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                        }`}
                      >
                        {b.backup_type === 'AUTO_SCHEDULED'
                          ? 'อัตโนมัติ (Auto)'
                          : b.backup_type === 'AUTO_BEFORE_RESTORE'
                          ? 'อัตโนมัติก่อนกู้คืน'
                          : 'สร้างเอง (Manual)'}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-stone-700 whitespace-nowrap">
                      {(b.size_bytes / 1024).toFixed(1)} KB
                    </td>
                    <td className="py-3 px-4 text-stone-500 italic max-w-xs truncate">
                      {b.note || '-'}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => handleDownloadBackup(b.id)}
                          className="px-2.5 py-1 rounded-lg bg-[#f7f1e7] hover:bg-[#ecddc8] text-[#8b5537] font-semibold text-[11px] transition cursor-pointer flex items-center gap-1"
                          title="ดาวน์โหลดไฟล์สำรองข้อมูล"
                        >
                          <Download className="w-3 h-3" />
                          <span>ดาวน์โหลด</span>
                        </button>

                        <button
                          onClick={() => handleDeleteBackup(b.id, b.filename)}
                          className="p-1 rounded-lg text-stone-400 hover:text-red-600 hover:bg-red-50 transition cursor-pointer"
                          title="ลบไฟล์สำรองนี้"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Migration / Computer Transfer Guide */}
      <div className="bg-white rounded-3xl p-6 border border-[#ecddc8] shadow-2xs space-y-3">
        <h3 className="font-bold text-sm text-[#321d14]">คำแนะนำ: การย้ายข้อมูลไปใช้งานบนคอมพิวเตอร์เครื่องใหม่</h3>
        <ol className="list-decimal list-inside text-xs text-stone-600 space-y-1.5 leading-relaxed">
          <li>กดปุ่ม <strong>"สำรองข้อมูลเดี๋ยวนี้"</strong> เพื่อสร้างไฟล์สำรองข้อมูลล่าสุด</li>
          <li>
            กดปุ่ม <strong>"ดาวน์โหลด"</strong> เพื่อบันทึกไฟล์{' '}
            <code className="bg-stone-100 px-1 py-0.5 rounded text-stone-800">.db</code> ลงใน Flash Drive หรือ Google Drive
          </li>
          <li>
            เปิดโปรแกรมบนคอมพิวเตอร์เครื่องใหม่ เข้าเมนู <strong>"สำรองและกู้คืน"</strong>
          </li>
          <li>
            กด <strong>"เลือกไฟล์ .db เพื่อกู้คืนข้อมูล"</strong> แล้วเลือกไฟล์ที่ดาวน์โหลดมา ระบบจะกู้ข้อมูลเมนู ยอดขาย และสต๊อกกลับมาอย่างสมบูรณ์
          </li>
        </ol>
      </div>
    </div>
  );
};
