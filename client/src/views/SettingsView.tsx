import React, { useState, useEffect, useRef } from 'react';
import {
  Settings,
  Save,
  Check,
  AlertCircle,
  Tv,
  Image as ImageIcon,
  Upload,
  Plus,
  Trash2,
  Eye,
  RefreshCw,
  Sparkles,
  Tag,
  Printer,
  Wifi,
  Scissors,
  CheckCircle,
  Play
} from 'lucide-react';
import { StoreSettings, PromotionSlide } from '../types';
import { apiRequest } from '../api/client';
import { DEFAULT_PROMOTION_SLIDES, getActiveSlides } from '../utils/slides';

interface SettingsViewProps {
  settings: StoreSettings;
  onSettingsUpdated: () => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({ settings, onSettingsUpdated }) => {
  const [activeTab, setActiveTab] = useState<'store' | 'printer' | 'slideshow'>('store');
  const [formData, setFormData] = useState<StoreSettings>(settings);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Printer settings & hardware detection
  const [detectedPrinters, setDetectedPrinters] = useState<string[]>([]);
  const [isTestingPrint, setIsTestingPrint] = useState(false);
  const [testPrintResult, setTestPrintResult] = useState<{ success: boolean; text: string } | null>(null);

  // Slides state
  const [slides, setSlides] = useState<PromotionSlide[]>([]);
  const [slideInterval, setSlideInterval] = useState<string>('5');
  const [uploadingImage, setUploadingImage] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // New Slide Form State
  const [newTitle, setNewTitle] = useState("Today's Special");
  const [newSubtitle, setNewSubtitle] = useState('เมนูเครื่องดื่มและเบเกอรี่แนะนำประจำวัน');
  const [newBadge, setNewBadge] = useState('40% OFF');
  const [newImageUrl, setNewImageUrl] = useState('');
  const [newImagePreview, setNewImagePreview] = useState('');

  useEffect(() => {
    setFormData(settings);
    // Parse slides
    if (settings.promotion_slides) {
      try {
        const parsed = JSON.parse(settings.promotion_slides);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setSlides(parsed);
        } else {
          setSlides(DEFAULT_PROMOTION_SLIDES);
        }
      } catch (e) {
        setSlides(DEFAULT_PROMOTION_SLIDES);
      }
    } else {
      setSlides(DEFAULT_PROMOTION_SLIDES);
    }

    if (settings.slide_interval) {
      setSlideInterval(settings.slide_interval);
    }

    // Fetch installed Windows printers
    fetchPrinters();
  }, [settings]);

  const fetchPrinters = async () => {
    const res = await apiRequest<string[]>('/pos/printers');
    if (res.success && res.data) {
      setDetectedPrinters(res.data);
      // If no printer selected yet, pick first reasonable one or default
      if (!formData.printer_name && res.data.length > 0) {
        const thermalCandidate = res.data.find(
          (p) =>
            p.toLowerCase().includes('pos') ||
            p.toLowerCase().includes('thermal') ||
            p.toLowerCase().includes('receipt') ||
            p.toLowerCase().includes('xprinter') ||
            p.toLowerCase().includes('epson')
        ) || res.data[0];
        setFormData((prev) => ({ ...prev, printer_name: thermalCandidate }));
      }
    }
  };

  const handleSaveSettings = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setIsSaving(true);
    setSaveSuccess(false);

    const payload: StoreSettings = {
      ...formData,
      promotion_slides: JSON.stringify(slides),
      slide_interval: slideInterval
    };

    const res = await apiRequest('/settings', {
      method: 'PUT',
      body: JSON.stringify(payload)
    });

    setIsSaving(false);
    if (res.success) {
      setSaveSuccess(true);
      onSettingsUpdated();
      setTimeout(() => setSaveSuccess(false), 3000);
    } else {
      alert(res.message || 'เกิดข้อผิดพลาดในการบันทึก');
    }
  };

  // Test Print directly to the configured printer
  const handleTestPrint = async () => {
    setIsTestingPrint(true);
    setTestPrintResult(null);

    const target =
      formData.printer_type === 'NETWORK'
        ? formData.printer_ip
        : formData.printer_name || 'Microsoft Print to PDF';

    try {
      const res = await apiRequest('/pos/test-print', {
        method: 'POST',
        body: JSON.stringify({
          printerType: formData.printer_type || 'WINDOWS',
          target,
          paperWidth: formData.printer_paper_width || '80mm',
          cutPaper: formData.printer_auto_cut !== '0',
          openDrawer: formData.printer_open_drawer === '1'
        })
      });

      if (res.success) {
        setTestPrintResult({ success: true, text: res.message || 'ส่งคำสั่งพิมพ์ทดสอบสำเร็จแล้ว' });
      } else {
        setTestPrintResult({ success: false, text: res.message || 'เกิดข้อผิดพลาดในการทดสอบพิมพ์' });
      }
    } catch (err: any) {
      setTestPrintResult({ success: false, text: err.message || 'เกิดข้อผิดพลาดในการเชื่อมต่อเครื่องพิมพ์' });
    } finally {
      setIsTestingPrint(false);
    }
  };

  // Handle uploading banner file
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Show local preview immediately
    const reader = new FileReader();
    reader.onload = (event) => {
      setNewImagePreview(event.target?.result as string);
    };
    reader.readAsDataURL(file);

    // Upload to server
    setUploadingImage(true);
    const bodyFormData = new FormData();
    bodyFormData.append('banner', file);

    try {
      const token = localStorage.getItem('pos_token');
      const activeStaffId = localStorage.getItem('pos_active_staff_id');
      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;
      if (activeStaffId) headers['x-cashier-id'] = activeStaffId;

      const response = await fetch('/api/settings/upload-banner', {
        method: 'POST',
        headers,
        body: bodyFormData
      });
      const json = await response.json();
      if (json.success && json.url) {
        setNewImageUrl(json.url);
      } else {
        alert(json.message || 'ไม่สามารถอัปโหลดไฟล์รูปภาพได้');
      }
    } catch (err: any) {
      console.error('Upload error', err);
      setNewImageUrl(newImagePreview);
    } finally {
      setUploadingImage(false);
    }
  };

  const handleAddSlide = () => {
    const img = newImageUrl || newImagePreview;
    if (!img) {
      alert('กรุณาอัปโหลดรูปภาพ หรือระบุ URL รูปภาพโปรโมชั่น');
      return;
    }

    const newSlide: PromotionSlide = {
      id: `slide-${Date.now()}`,
      image_url: img,
      title: newTitle.trim(),
      subtitle: newSubtitle.trim(),
      badge: newBadge.trim(),
      is_active: true
    };

    const updated = [...slides, newSlide];
    setSlides(updated);
    setNewImageUrl('');
    setNewImagePreview('');
    if (fileInputRef.current) fileInputRef.current.value = '';
    alert('เพิ่มสไลด์โปรโมชั่นเรียบร้อยแล้ว อย่าลืมกดปุ่ม "บันทึกการตั้งค่า"');
  };

  const handleRemoveSlide = (id: string) => {
    setSlides(slides.filter((s) => s.id !== id));
  };

  const handleToggleSlide = (id: string) => {
    setSlides(
      slides.map((s) => (s.id === id ? { ...s, is_active: s.is_active === false ? true : false } : s))
    );
  };

  const handleResetToDefaultSlides = () => {
    if (confirm('คุณต้องการรีเซ็ตเป็นภาพโปรโมชั่นตัวอย่างเริ่มต้นหรือไม่?')) {
      setSlides(DEFAULT_PROMOTION_SLIDES);
    }
  };

  return (
    <div className="flex-1 p-6 overflow-y-auto space-y-6 bg-[#fbf9f6]">
      {/* Header & Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-[#321d14] flex items-center gap-2">
            <Settings className="w-6 h-6 text-[#8b5537]" />
            ตั้งค่าระบบร้านและเครื่องพิมพ์
          </h2>
          <p className="text-xs text-[#8b5537] mt-0.5">
            กำหนดข้อมูลร้านค้า ระบบพิมพ์ใบเสร็จโดยตรง (ไม่ผ่าน Browser) และสไลด์โชว์จอลูกค้า
          </p>
        </div>

        {/* Tab Buttons */}
        <div className="flex items-center gap-1.5 bg-stone-200/60 p-1 rounded-2xl self-start sm:self-auto">
          <button
            type="button"
            onClick={() => setActiveTab('store')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'store'
                ? 'bg-white text-[#714631] shadow-xs'
                : 'text-stone-600 hover:text-stone-900'
            }`}
          >
            <Settings className="w-4 h-4" />
            <span>ข้อมูลร้านค้า</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('printer')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'printer'
                ? 'bg-[#8b5537] text-white shadow-xs'
                : 'text-stone-600 hover:text-stone-900'
            }`}
          >
            <Printer className="w-4 h-4" />
            <span>เครื่องพิมพ์สลิป (Direct Print)</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('slideshow')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'slideshow'
                ? 'bg-[#8b5537] text-white shadow-xs'
                : 'text-stone-600 hover:text-stone-900'
            }`}
          >
            <Tv className="w-4 h-4" />
            <span>สไลด์โชว์จอลูกค้า</span>
          </button>
        </div>
      </div>

      {/* Alert Banner if save success */}
      {saveSuccess && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-2xl flex items-center gap-2 shadow-2xs animate-in fade-in">
          <Check className="w-4 h-4 text-emerald-600 shrink-0" />
          <span className="font-bold">บันทึกการตั้งค่าเรียบร้อยแล้ว! ข้อมูลจะมีผลบนระบบ POS ทันที</span>
        </div>
      )}

      {/* TAB 1: STORE & RECEIPT SETTINGS */}
      {activeTab === 'store' && (
        <form onSubmit={handleSaveSettings} className="bg-white rounded-3xl p-6 border border-[#ecddc8] shadow-2xs space-y-5 max-w-4xl">
          <div className="font-bold text-sm text-[#714631] pb-2 border-b border-stone-100 flex items-center justify-between">
            <span>ข้อมูลร้านค้าและหัวใบเสร็จ</span>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-stone-700">ชื่อร้าน (แสดงบนหัวบิลและแถบด้านบน)*</label>
            <input
              type="text"
              required
              value={formData.store_name || ''}
              onChange={(e) => setFormData({ ...formData, store_name: e.target.value })}
              className="w-full px-3.5 py-2.5 rounded-xl border border-stone-200 text-sm font-bold text-stone-900 focus:outline-none focus:border-[#8b5537]"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-stone-700">เบอร์โทรศัพท์ร้าน</label>
              <input
                type="text"
                value={formData.store_phone || ''}
                onChange={(e) => setFormData({ ...formData, store_phone: e.target.value })}
                className="w-full px-3.5 py-2 rounded-xl border border-stone-200 text-xs focus:outline-none focus:border-[#8b5537]"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-stone-700">เลขประจำตัวผู้เสียภาษี (Tax ID)</label>
              <input
                type="text"
                value={formData.tax_id || ''}
                onChange={(e) => setFormData({ ...formData, tax_id: e.target.value })}
                className="w-full px-3.5 py-2 rounded-xl border border-stone-200 text-xs font-mono focus:outline-none focus:border-[#8b5537]"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-stone-700">ที่อยู่ร้าน (พิมพ์ลงในใบเสร็จ)</label>
            <textarea
              rows={2}
              value={formData.store_address || ''}
              onChange={(e) => setFormData({ ...formData, store_address: e.target.value })}
              className="w-full px-3.5 py-2 rounded-xl border border-stone-200 text-xs focus:outline-none focus:border-[#8b5537]"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-stone-700">เบอร์พร้อมเพย์ (QR PromptPay)</label>
              <input
                type="text"
                value={formData.promptpay_number || ''}
                onChange={(e) => setFormData({ ...formData, promptpay_number: e.target.value })}
                placeholder="เช่น 0833146626 หรือเลขบัตรประชาชน"
                className="w-full px-3.5 py-2 rounded-xl border border-stone-200 text-xs font-mono font-bold focus:outline-none focus:border-[#8b5537]"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-stone-700">คำนำหน้าเลขที่บิล</label>
              <input
                type="text"
                value={formData.bill_prefix || 'INV'}
                onChange={(e) => setFormData({ ...formData, bill_prefix: e.target.value })}
                className="w-full px-3.5 py-2 rounded-xl border border-stone-200 text-xs font-mono font-bold focus:outline-none focus:border-[#8b5537]"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-stone-700">ข้อความท้ายใบเสร็จ</label>
            <textarea
              rows={2}
              value={formData.receipt_footer || ''}
              onChange={(e) => setFormData({ ...formData, receipt_footer: e.target.value })}
              placeholder="เช่น ขอบคุณที่ใช้บริการ / โทรสอบถามเพิ่มเติม 08X-XXX-XXXX"
              className="w-full px-3.5 py-2 rounded-xl border border-stone-200 text-xs focus:outline-none focus:border-[#8b5537]"
            />
          </div>

          {/* Inventory Policy Toggle */}
          <div className="pt-2 border-t border-stone-100">
            <label className="flex items-center gap-3 p-3.5 rounded-2xl bg-[#fdfaf6] border border-[#ecddc8] cursor-pointer hover:bg-[#f7f1e7] transition">
              <input
                type="checkbox"
                checked={formData.allow_negative_stock === '1'}
                onChange={(e) => setFormData({ ...formData, allow_negative_stock: e.target.checked ? '1' : '0' })}
                className="w-5 h-5 text-[#8b5537] rounded border-stone-300 focus:ring-[#8b5537]"
              />
              <div>
                <div className="text-xs font-bold text-stone-900">อนุญาตให้ตัดสต๊อกติดลบได้ (Allow Negative Stock)</div>
                <div className="text-[11px] text-stone-500">
                  * ค่าเริ่มต้นคือปิดไว้ (ระบบจะเตือนและป้องกันการขายเมื่อวัตถุดิบไม่เพียงพอ)
                </div>
              </div>
            </label>
          </div>

          <div className="pt-3 flex justify-end">
            <button
              type="submit"
              disabled={isSaving}
              className="px-6 py-2.5 rounded-xl bg-[#8b5537] hover:bg-[#714631] text-white text-xs font-bold transition shadow-xs flex items-center gap-2 cursor-pointer"
            >
              <Save className="w-4 h-4" />
              {isSaving ? 'กำลังบันทึก...' : 'บันทึกการตั้งค่าร้าน'}
            </button>
          </div>
        </form>
      )}

      {/* TAB 2: DIRECT THERMAL PRINTER SETTINGS (NOT FROM BROWSER) */}
      {activeTab === 'printer' && (
        <div className="space-y-6 max-w-4xl">
          <div className="bg-white rounded-3xl p-6 border border-[#ecddc8] shadow-2xs space-y-6">
            <div>
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-[#ddc2a3]/40 text-[#5c3b2b] flex items-center justify-center font-bold">
                  <Printer className="w-5 h-5 text-[#8b5537]" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-[#321d14]">
                    ระบบพิมพ์ใบเสร็จความร้อนโดยตรง (Direct Thermal Print)
                  </h3>
                  <p className="text-xs text-[#8b5537]">
                    สั่งพิมพ์ไปยังเครื่องพิมพ์ใบเสร็จสลิป (58mm / 80mm) โดยตรงทันที ไม่ต้องผ่านหน้าต่าง Pop-up ของบราวเซอร์
                  </p>
                </div>
              </div>
            </div>

            {/* Test Print Result Message */}
            {testPrintResult && (
              <div
                className={`p-4 rounded-2xl text-xs flex items-center gap-2.5 animate-in fade-in ${
                  testPrintResult.success
                    ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                    : 'bg-red-50 text-red-800 border border-red-200'
                }`}
              >
                {testPrintResult.success ? (
                  <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
                )}
                <span className="font-semibold">{testPrintResult.text}</span>
              </div>
            )}

            {/* Printer Connection Type */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-stone-800">ประเภทการเชื่อมต่อเครื่องพิมพ์</label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label
                  className={`flex items-start gap-3 p-4 rounded-2xl border cursor-pointer transition ${
                    (formData.printer_type || 'WINDOWS') === 'WINDOWS'
                      ? 'border-[#8b5537] bg-[#fdfaf6] ring-1 ring-[#8b5537]'
                      : 'border-stone-200 hover:bg-stone-50'
                  }`}
                >
                  <input
                    type="radio"
                    name="printer_type"
                    value="WINDOWS"
                    checked={(formData.printer_type || 'WINDOWS') === 'WINDOWS'}
                    onChange={() => setFormData({ ...formData, printer_type: 'WINDOWS' })}
                    className="mt-0.5 text-[#8b5537]"
                  />
                  <div>
                    <div className="font-bold text-xs text-stone-900 flex items-center gap-1.5">
                      <Printer className="w-3.5 h-3.5 text-[#8b5537]" />
                      เครื่องพิมพ์ในระบบ Windows (USB / ไดรเวอร์)
                    </div>
                    <div className="text-[11px] text-stone-500 mt-0.5">
                      เหมาะสำหรับเครื่องพิมพ์ที่เสียบสาย USB หรือติดตั้ง Driver ในคอมพิวเตอร์นี้
                    </div>
                  </div>
                </label>

                <label
                  className={`flex items-start gap-3 p-4 rounded-2xl border cursor-pointer transition ${
                    formData.printer_type === 'NETWORK'
                      ? 'border-[#8b5537] bg-[#fdfaf6] ring-1 ring-[#8b5537]'
                      : 'border-stone-200 hover:bg-stone-50'
                  }`}
                >
                  <input
                    type="radio"
                    name="printer_type"
                    value="NETWORK"
                    checked={formData.printer_type === 'NETWORK'}
                    onChange={() => setFormData({ ...formData, printer_type: 'NETWORK' })}
                    className="mt-0.5 text-[#8b5537]"
                  />
                  <div>
                    <div className="font-bold text-xs text-stone-900 flex items-center gap-1.5">
                      <Wifi className="w-3.5 h-3.5 text-[#8b5537]" />
                      เครื่องพิมพ์ Network (LAN / WiFi - IP:9100)
                    </div>
                    <div className="text-[11px] text-stone-500 mt-0.5">
                      สั่งพิมพ์ผ่านสายแลนหรือ WiFi ไปยังเครื่องพิมพ์สลิปตามหมายเลข IP โดยตรง
                    </div>
                  </div>
                </label>
              </div>
            </div>

            {/* Target Printer Configuration */}
            {(formData.printer_type || 'WINDOWS') === 'WINDOWS' ? (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-stone-800">
                    เลือกเครื่องพิมพ์สลิปที่ติดตั้งในเครื่อง (Windows Printers)*
                  </label>
                  <button
                    type="button"
                    onClick={fetchPrinters}
                    className="text-[11px] text-[#8b5537] hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <RefreshCw className="w-3 h-3" />
                    <span>ค้นหาเครื่องพิมพ์ใหม่</span>
                  </button>
                </div>

                <select
                  value={formData.printer_name || ''}
                  onChange={(e) => setFormData({ ...formData, printer_name: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-stone-200 text-sm font-semibold text-stone-900 focus:outline-none focus:border-[#8b5537]"
                >
                  <option value="">-- กรุณาเลือกเครื่องพิมพ์ --</option>
                  {detectedPrinters.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-stone-400">
                  * ตรวจพบเครื่องพิมพ์ทั้งหมด {detectedPrinters.length} เครื่องในระบบ Windows
                </p>
              </div>
            ) : (
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-stone-800">
                  หมายเลข IP Address เครื่องพิมพ์สลิป (พอร์ตมาตรฐาน 9100)*
                </label>
                <div className="relative">
                  <Wifi className="absolute left-3.5 top-2.5 w-4 h-4 text-stone-400" />
                  <input
                    type="text"
                    placeholder="เช่น 192.168.1.200 หรือ 192.168.1.200:9100"
                    value={formData.printer_ip || ''}
                    onChange={(e) => setFormData({ ...formData, printer_ip: e.target.value })}
                    className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-stone-200 text-sm font-mono font-bold focus:outline-none focus:border-[#8b5537]"
                  />
                </div>
                <p className="text-[11px] text-stone-400">
                  * ตรวจสอบ IP ได้โดยการกดปุ่ม Feed บนเครื่องพิมพ์ค้างไว้ขณะเปิดสวิตช์เครื่องพิมพ์
                </p>
              </div>
            )}

            {/* Paper Width & Thermal Options */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-stone-100">
              <div className="space-y-1">
                <label className="text-xs font-bold text-stone-800">ขนาดหน้ากว้างกระดาษความร้อน</label>
                <select
                  value={formData.printer_paper_width || '80mm'}
                  onChange={(e) => setFormData({ ...formData, printer_paper_width: e.target.value as any })}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-stone-200 text-xs font-bold focus:outline-none focus:border-[#8b5537]"
                >
                  <option value="80mm">80 มม. (มาตรฐานสลิปสากล - 44 คอลัมน์)</option>
                  <option value="58mm">58 มม. (ขนาดกะทัดรัด - 32 คอลัมน์)</option>
                </select>
              </div>

              <div className="space-y-3 pt-4 sm:pt-6">
                <label className="flex items-center gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.printer_auto_cut !== '0'}
                    onChange={(e) => setFormData({ ...formData, printer_auto_cut: e.target.checked ? '1' : '0' })}
                    className="w-4 h-4 text-[#8b5537] rounded border-stone-300"
                  />
                  <span className="text-xs font-medium text-stone-700 flex items-center gap-1.5">
                    <Scissors className="w-3.5 h-3.5 text-[#ba8452]" />
                    สั่งตัดกระดาษอัตโนมัติเมื่อพิมพ์จบ (Auto-Cut)
                  </span>
                </label>

                <label className="flex items-center gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.printer_open_drawer === '1'}
                    onChange={(e) => setFormData({ ...formData, printer_open_drawer: e.target.checked ? '1' : '0' })}
                    className="w-4 h-4 text-[#8b5537] rounded border-stone-300"
                  />
                  <span className="text-xs font-medium text-stone-700">
                    สั่งเปิดลิ้นชักเก็บเงินอัตโนมัติเมื่อพิมพ์ (Cash Drawer Kick)
                  </span>
                </label>
              </div>
            </div>

            {/* Auto Print Upon Checkout Toggle */}
            <div className="p-4 rounded-2xl bg-[#fdfaf6] border border-[#ecddc8] space-y-1">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.printer_auto_print_checkout === '1'}
                  onChange={(e) =>
                    setFormData({ ...formData, printer_auto_print_checkout: e.target.checked ? '1' : '0' })
                  }
                  className="w-5 h-5 text-[#8b5537] rounded border-stone-300 focus:ring-[#8b5537]"
                />
                <div>
                  <div className="text-xs font-bold text-stone-900 flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-amber-600" />
                    พิมพ์ใบเสร็จอัตโนมัติทันทีเมื่อชำระเงินสำเร็จ (Auto-Print on Checkout)
                  </div>
                  <div className="text-[11px] text-stone-500">
                    เมื่อคิดเงินเสร็จ ระบบจะสั่งพิมพ์สลิปออกจากเครื่องพิมพ์โดยตรงทันที ไม่ต้องกดปุ่มพิมพ์ซ้ำ
                  </div>
                </div>
              </label>
            </div>

            {/* Action Buttons: Test Print & Save */}
            <div className="pt-4 border-t border-stone-100 flex flex-col sm:flex-row items-center justify-between gap-3">
              <button
                type="button"
                onClick={handleTestPrint}
                disabled={isTestingPrint}
                className="w-full sm:w-auto px-5 py-2.5 rounded-xl border border-[#8b5537] text-[#8b5537] hover:bg-[#f7f1e7] text-xs font-bold transition cursor-pointer flex items-center justify-center gap-2"
              >
                <Play className="w-3.5 h-3.5" />
                <span>{isTestingPrint ? 'กำลังส่งคำสั่งพิมพ์...' : 'ทดสอบพิมพ์ใบเสร็จ (Test Print)'}</span>
              </button>

              <button
                type="button"
                onClick={() => handleSaveSettings()}
                disabled={isSaving}
                className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-[#8b5537] hover:bg-[#714631] text-white text-xs font-bold transition shadow-xs flex items-center justify-center gap-2 cursor-pointer"
              >
                <Save className="w-4 h-4" />
                <span>{isSaving ? 'กำลังบันทึก...' : 'บันทึกการตั้งค่าเครื่องพิมพ์'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: PROMOTION SLIDESHOW SETTINGS */}
      {activeTab === 'slideshow' && (
        <div className="space-y-6 max-w-5xl">
          {/* Top Options Bar */}
          <div className="bg-white p-5 rounded-3xl border border-[#ecddc8] shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#ddc2a3]/40 text-[#5c3b2b] flex items-center justify-center font-bold">
                <Tv className="w-5 h-5 text-[#8b5537]" />
              </div>
              <div>
                <h3 className="font-bold text-sm text-[#321d14]">สไลด์โชว์โปรโมชั่นสำหรับจอฝั่งลูกค้า</h3>
                <p className="text-xs text-[#8b5537]">
                  ภาพจะแสดงด้านขวาของรายการสั่งซื้อบนจอที่ 2 และเปลี่ยนสไลด์อัตโนมัติ
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 text-xs font-semibold text-stone-700">
                <span>ความเร็วสไลด์:</span>
                <select
                  value={slideInterval}
                  onChange={(e) => setSlideInterval(e.target.value)}
                  className="bg-[#fdfaf6] border border-[#ecddc8] rounded-xl px-2.5 py-1.5 text-xs font-bold text-[#8b5537] focus:outline-none"
                >
                  <option value="3">ทุก 3 วินาที (เร็ว)</option>
                  <option value="5">ทุก 5 วินาที (มาตรฐาน)</option>
                  <option value="8">ทุก 8 วินาที (ช้า)</option>
                  <option value="10">ทุก 10 วินาที</option>
                </select>
              </div>

              <button
                type="button"
                onClick={handleResetToDefaultSlides}
                className="px-3 py-1.5 rounded-xl border border-stone-200 bg-stone-50 hover:bg-stone-100 text-stone-600 text-xs font-medium transition cursor-pointer flex items-center gap-1.5"
                title="โหลดชุดภาพโปรโมชั่นตัวอย่างเริ่มต้น"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">โหลดตัวอย่าง</span>
              </button>
            </div>
          </div>

          {/* Upload New Slide Card */}
          <div className="bg-white rounded-3xl p-6 border border-[#ecddc8] shadow-2xs space-y-4">
            <div className="font-bold text-sm text-[#714631] pb-2 border-b border-stone-100 flex items-center gap-2">
              <Upload className="w-4 h-4 text-[#8b5537]" />
              <span>เพิ่มรูปภาพโปรโมชั่นใหม่ (Upload New Slide)</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
              {/* Image Preview & Upload Button */}
              <div className="md:col-span-5 space-y-2">
                <div className="w-full h-48 rounded-2xl border-2 border-dashed border-[#ecddc8] bg-[#fdfaf6] flex flex-col items-center justify-center p-3 overflow-hidden relative group">
                  {newImagePreview || newImageUrl ? (
                    <>
                      <img
                        src={newImagePreview || newImageUrl}
                        alt="Preview"
                        className="w-full h-full object-cover rounded-xl"
                      />
                      <div
                        className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition flex items-center justify-center text-white text-xs font-bold rounded-xl cursor-pointer"
                        onClick={() => fileInputRef.current?.click()}
                      >
                        คลิกเพื่อเปลี่ยนรูป
                      </div>
                    </>
                  ) : (
                    <div
                      onClick={() => fileInputRef.current?.click()}
                      className="flex flex-col items-center justify-center text-center cursor-pointer p-4 w-full h-full"
                    >
                      <div className="w-12 h-12 rounded-full bg-[#f3ece2] text-[#8b5537] flex items-center justify-center mb-2">
                        <ImageIcon className="w-6 h-6" />
                      </div>
                      <span className="text-xs font-bold text-stone-700">คลิกเพื่อเลือกไฟล์รูปภาพ</span>
                      <span className="text-[11px] text-stone-400 mt-0.5">รองรับ JPG, PNG, WEBP (สูงสุด 10MB)</span>
                    </div>
                  )}
                </div>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFileChange}
                  className="hidden"
                />

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploadingImage}
                    className="flex-1 py-2 px-3 rounded-xl border border-[#ecddc8] bg-[#fdfaf6] hover:bg-[#f7f1e7] text-[#714631] text-xs font-bold transition cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span>{uploadingImage ? 'กำลังอัปโหลด...' : 'เลือกไฟล์รูปจากคอมพิวเตอร์'}</span>
                  </button>
                </div>

                <div className="text-[11px] text-stone-400 text-center">หรือวาง URL รูปภาพ:</div>
                <input
                  type="url"
                  placeholder="https://example.com/image.jpg"
                  value={newImageUrl}
                  onChange={(e) => {
                    setNewImageUrl(e.target.value);
                    setNewImagePreview(e.target.value);
                  }}
                  className="w-full px-3 py-1.5 rounded-xl border border-stone-200 text-xs font-mono"
                />
              </div>

              {/* Slide Text Inputs */}
              <div className="md:col-span-7 space-y-3">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-stone-700 flex items-center gap-1">
                    <Sparkles className="w-3.5 h-3.5 text-[#ba8452]" />
                    <span>หัวข้อโปรโมชั่น (Title)</span>
                  </label>
                  <input
                    type="text"
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    placeholder="เช่น Today's Menu, Signature Coffee, เบเกอรี่อบสด"
                    className="w-full px-3 py-2 rounded-xl border border-stone-200 text-xs font-bold text-stone-900 focus:outline-none focus:border-[#8b5537]"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-stone-700">
                    คำอธิบาย / รายละเอียดเมนู (Subtitle)
                  </label>
                  <textarea
                    rows={2}
                    value={newSubtitle}
                    onChange={(e) => setNewSubtitle(e.target.value)}
                    placeholder="เช่น กาแฟนมคั่วหอมละมุน เสิร์ฟคู่กับครัวซองต์เนยแท้ฝรั่งเศส"
                    className="w-full px-3 py-2 rounded-xl border border-stone-200 text-xs focus:outline-none focus:border-[#8b5537]"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-stone-700 flex items-center gap-1">
                    <Tag className="w-3.5 h-3.5 text-[#ba8452]" />
                    <span>ป้ายข้อความพิเศษ (Badge Tag เช่น 40% OFF, เมนูแนะนำ, 1 แถม 1)</span>
                  </label>
                  <input
                    type="text"
                    value={newBadge}
                    onChange={(e) => setNewBadge(e.target.value)}
                    placeholder="เช่น 40% OFF, 1 แถม 1, เมนูขายดี"
                    className="w-full px-3 py-2 rounded-xl border border-stone-200 text-xs font-bold text-[#8b5537] focus:outline-none focus:border-[#8b5537]"
                  />
                </div>

                <div className="pt-2">
                  <button
                    type="button"
                    onClick={handleAddSlide}
                    className="w-full py-2.5 rounded-xl bg-[#8b5537] hover:bg-[#714631] text-white text-xs font-bold transition shadow-xs flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                    <span>เพิ่มสไลด์โปรโมชั่นลงในรายการ</span>
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Current Slides List */}
          <div className="bg-white rounded-3xl p-6 border border-[#ecddc8] shadow-2xs space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-stone-100">
              <div className="font-bold text-sm text-[#714631] flex items-center gap-2">
                <ImageIcon className="w-4 h-4 text-[#8b5537]" />
                <span>รายการสไลด์ที่กำลังแสดงบนจอลูกค้า ({slides.length} สไลด์)</span>
              </div>
              <span className="text-xs text-stone-400">สลับแสดงผลตามลำดับอัตโนมัติ</span>
            </div>

            {slides.length === 0 ? (
              <div className="text-center py-10 text-stone-400 text-xs space-y-2">
                <ImageIcon className="w-8 h-8 mx-auto text-stone-300" />
                <p>ยังไม่มีสไลด์โปรโมชั่นในระบบ</p>
                <button
                  type="button"
                  onClick={handleResetToDefaultSlides}
                  className="text-xs text-[#8b5537] underline font-bold"
                >
                  คลิกที่นี่เพื่อโหลดภาพโปรโมชั่นตัวอย่าง
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {slides.map((s, idx) => (
                  <div
                    key={s.id || idx}
                    className={`rounded-2xl border overflow-hidden transition relative flex flex-col ${
                      s.is_active !== false
                        ? 'border-[#ecddc8] bg-white shadow-2xs'
                        : 'border-stone-200 bg-stone-50 opacity-60'
                    }`}
                  >
                    {/* Image Banner Box */}
                    <div className="relative h-44 w-full overflow-hidden bg-stone-100">
                      <img src={s.image_url} alt={s.title} className="w-full h-full object-cover" />
                      {/* Badge if set */}
                      {s.badge && (
                        <div className="absolute top-2.5 right-2.5 bg-amber-400 text-stone-900 text-xs font-black px-2.5 py-1 rounded-full shadow-md">
                          {s.badge}
                        </div>
                      )}
                      <div className="absolute bottom-2 left-2.5 bg-black/60 backdrop-blur-xs text-white text-[10px] font-bold px-2 py-0.5 rounded-md">
                        สไลด์ #{idx + 1}
                      </div>
                    </div>

                    {/* Content Details */}
                    <div className="p-3.5 flex-1 flex flex-col justify-between space-y-2">
                      <div>
                        <h4 className="font-bold text-sm text-[#321d14] line-clamp-1">
                          {s.title || 'ไม่มีหัวข้อ'}
                        </h4>
                        <p className="text-xs text-stone-500 line-clamp-2 mt-0.5">{s.subtitle || '-'}</p>
                      </div>

                      <div className="pt-2 border-t border-stone-100 flex items-center justify-between text-xs">
                        <button
                          type="button"
                          onClick={() => handleToggleSlide(s.id)}
                          className={`px-2.5 py-1 rounded-lg text-[11px] font-bold cursor-pointer transition ${
                            s.is_active !== false
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : 'bg-stone-200 text-stone-500'
                          }`}
                        >
                          {s.is_active !== false ? 'เปิดแสดงผล' : 'ปิดแสดงผล'}
                        </button>

                        <button
                          type="button"
                          onClick={() => handleRemoveSlide(s.id)}
                          className="p-1.5 text-stone-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition cursor-pointer"
                          title="ลบสไลด์นี้"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Bottom Save Button */}
            <div className="pt-4 border-t border-stone-100 flex items-center justify-between">
              <span className="text-xs text-stone-500">
                * อย่าลืมกดปุ่มบันทึกเพื่อให้การเปลี่ยนแปลงส่งผลไปยังจอลูกค้าทันที
              </span>
              <button
                type="button"
                onClick={() => handleSaveSettings()}
                disabled={isSaving}
                className="px-6 py-2.5 rounded-xl bg-[#8b5537] hover:bg-[#714631] text-white text-xs font-bold transition shadow-xs flex items-center gap-2 cursor-pointer"
              >
                <Save className="w-4 h-4" />
                {isSaving ? 'กำลังบันทึก...' : 'บันทึกการตั้งค่าสไลด์'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
