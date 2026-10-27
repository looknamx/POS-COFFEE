import React, { useState, useEffect } from 'react';
import { Truck, Plus, Trash2, Eye, X, Check, AlertCircle } from 'lucide-react';
import { PurchaseReceipt, Supplier, Ingredient } from '../types';
import { apiRequest, formatCurrency, formatThaiDateTime } from '../api/client';
import { ThaiDatePicker } from '../components/ThaiDatePicker';

export const PurchasesView: React.FC = () => {
  const [purchases, setPurchases] = useState<PurchaseReceipt[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal State
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [receiptNo, setReceiptNo] = useState('');
  const [selectedSupplierId, setSelectedSupplierId] = useState<number | null>(null);
  const [receiptDate, setReceiptDate] = useState(new Date().toISOString().slice(0, 10));
  const [note, setNote] = useState('');
  const [items, setItems] = useState<{ ingredient_id: number; quantity: number; unit: string; unit_cost: number }[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Detail Modal
  const [selectedReceiptDetail, setSelectedReceiptDetail] = useState<PurchaseReceipt | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    const [pRes, sRes, iRes] = await Promise.all([
      apiRequest<PurchaseReceipt[]>('/inventory/purchases'),
      apiRequest<Supplier[]>('/suppliers'),
      apiRequest<Ingredient[]>('/ingredients')
    ]);
    if (pRes.success && pRes.data) setPurchases(pRes.data);
    if (sRes.success && sRes.data) setSuppliers(sRes.data);
    if (iRes.success && iRes.data) setIngredients(iRes.data);
    setLoading(false);
  };

  const handleOpenCreate = () => {
    const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    setReceiptNo(`PO-${today}-${Date.now().toString().slice(-4)}`);
    setSelectedSupplierId(suppliers[0]?.id || null);
    setReceiptDate(new Date().toISOString().slice(0, 10));
    setNote('');
    setItems([
      {
        ingredient_id: ingredients[0]?.id || 1,
        quantity: 1000,
        unit: ingredients[0]?.unit || 'g',
        unit_cost: ingredients[0]?.cost_per_unit || 50
      }
    ]);
    setErrorMsg(null);
    setIsCreateOpen(true);
  };

  const handleAddItemRow = () => {
    if (ingredients.length === 0) return;
    setItems([
      ...items,
      {
        ingredient_id: ingredients[0].id,
        quantity: 500,
        unit: ingredients[0].unit,
        unit_cost: ingredients[0].cost_per_unit
      }
    ]);
  };

  const handleRemoveItemRow = (idx: number) => {
    setItems(items.filter((_, i) => i !== idx));
  };

  const calculateTotal = () => {
    return items.reduce((acc, it) => acc + (it.quantity * it.unit_cost), 0);
  };

  const handleSavePurchase = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!receiptNo.trim() || items.length === 0) {
      setErrorMsg('กรุณากรอกเลขที่เอกสารและรายการวัตถุดิบ');
      return;
    }

    setSubmitting(true);
    setErrorMsg(null);

    const payload = {
      receipt_no: receiptNo.trim(),
      supplier_id: selectedSupplierId,
      receipt_date: receiptDate,
      note,
      items
    };

    const res = await apiRequest('/inventory/purchases', {
      method: 'POST',
      body: JSON.stringify(payload)
    });

    setSubmitting(false);

    if (res.success) {
      setIsCreateOpen(false);
      fetchData();
    } else {
      setErrorMsg(res.message || 'เกิดข้อผิดพลาดในการบันทึกรับสินค้า');
    }
  };

  const handleViewDetail = async (id: number) => {
    const res = await apiRequest<PurchaseReceipt>(`/inventory/purchases/${id}`);
    if (res.success && res.data) {
      setSelectedReceiptDetail(res.data);
    }
  };

  const handleCancelReceipt = async (id: number) => {
    if (!confirm('คุณต้องการยกเลิกเอกสารรับสินค้านี้ และปรับลดยอดสต๊อกคืนใช่หรือไม่?')) return;
    const res = await apiRequest(`/inventory/purchases/${id}/cancel`, { method: 'POST' });
    if (res.success) {
      alert(res.message);
      setSelectedReceiptDetail(null);
      fetchData();
    } else {
      alert(res.message || 'เกิดข้อผิดพลาด');
    }
  };

  return (
    <div className="flex-1 p-6 overflow-y-auto space-y-6 bg-[#fbf9f6]">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-[#321d14]">รับสินค้าและวัตถุดิบเข้าสต๊อก (Purchase Receipts)</h2>
          <p className="text-xs text-[#8b5537]">บันทึกใบรับสินค้าจากซัพพลายเออร์เพื่อเพิ่มยอดสต๊อกจริง</p>
        </div>
        <button
          onClick={handleOpenCreate}
          className="px-4 py-2.5 rounded-xl bg-[#8b5537] hover:bg-[#714631] text-white font-semibold text-xs transition shadow-xs flex items-center gap-1.5 cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          สร้างเอกสารรับสินค้า
        </button>
      </div>

      {/* Receipts Table */}
      <div className="bg-white rounded-3xl border border-[#ecddc8] shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-[#fdfaf6] border-b border-[#ebdccd] text-[#714631] font-bold">
                <th className="py-3 px-4">เลขที่เอกสาร</th>
                <th className="py-3 px-4">วันที่รับ</th>
                <th className="py-3 px-4">ซัพพลายเออร์</th>
                <th className="py-3 px-4 text-right">ยอดซื้อรวม</th>
                <th className="py-3 px-4">ผู้บันทึก</th>
                <th className="py-3 px-4 text-center">สถานะ</th>
                <th className="py-3 px-4 text-right">การกระทำ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-stone-400">กำลังโหลดเอกสาร...</td>
                </tr>
              ) : purchases.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-stone-400">ยังไม่มีเอกสารรับสินค้าเข้า</td>
                </tr>
              ) : (
                purchases.map((pr) => (
                  <tr key={pr.id} className="hover:bg-stone-50 transition">
                    <td className="py-3 px-4 font-mono font-bold text-stone-900">{pr.receipt_no}</td>
                    <td className="py-3 px-4 text-stone-600">{formatThaiDateTime(pr.receipt_date)}</td>
                    <td className="py-3 px-4 font-semibold text-stone-900">{pr.supplier_name || '-'}</td>
                    <td className="py-3 px-4 text-right font-extrabold text-[#714631]">
                      {formatCurrency(pr.total_amount, true)}
                    </td>
                    <td className="py-3 px-4 text-stone-500">{pr.created_by_name || '-'}</td>
                    <td className="py-3 px-4 text-center">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          pr.status === 'COMPLETED'
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-red-100 text-red-800'
                        }`}
                      >
                        {pr.status === 'COMPLETED' ? 'รับเข้าสำเร็จ' : 'ยกเลิกแล้ว'}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={() => handleViewDetail(pr.id)}
                        className="p-1.5 rounded-lg text-stone-500 hover:text-stone-900 hover:bg-stone-100 cursor-pointer"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* CREATE PURCHASE RECEIPT MODAL */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl shadow-2xl max-w-2xl w-full overflow-hidden border border-[#ecddc8] flex flex-col max-h-[90vh]">
            <div className="px-6 py-4 bg-[#fdfaf6] border-b border-[#ebdccd] flex items-center justify-between">
              <h3 className="font-bold text-base text-[#321d14]">สร้างเอกสารรับสินค้าเข้าสต๊อก</h3>
              <button onClick={() => setIsCreateOpen(false)} className="text-stone-400 hover:text-stone-700">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSavePurchase} className="p-6 space-y-4 overflow-y-auto flex-1">
              {errorMsg && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700">
                  {errorMsg}
                </div>
              )}

              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-stone-700">เลขที่เอกสาร*</label>
                  <input
                    type="text"
                    required
                    value={receiptNo}
                    onChange={(e) => setReceiptNo(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-stone-200 text-xs font-mono font-bold"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-stone-700">วันที่รับสินค้า (พ.ศ.)*</label>
                  <ThaiDatePicker
                    value={receiptDate}
                    onChange={(val) => setReceiptDate(val)}
                    placeholder="เลือกวันที่รับสินค้า"
                    className="w-full"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-stone-700">ซัพพลายเออร์</label>
                  <select
                    value={selectedSupplierId || ''}
                    onChange={(e) => setSelectedSupplierId(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl border border-stone-200 text-xs font-semibold"
                  >
                    {suppliers.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Items Table */}
              <div className="space-y-2 pt-2 border-t border-stone-100">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-[#714631]">รายการวัตถุดิบที่รับเข้า</span>
                  <button
                    type="button"
                    onClick={handleAddItemRow}
                    className="text-[11px] text-[#8b5537] font-semibold hover:underline"
                  >
                    + เพิ่มรายการ
                  </button>
                </div>

                <div className="space-y-2 max-h-52 overflow-y-auto">
                  {items.map((it, i) => (
                    <div key={i} className="flex items-center gap-2 bg-[#fdfaf6] p-2 rounded-xl border border-stone-200">
                      <select
                        value={it.ingredient_id}
                        onChange={(e) => {
                          const id = Number(e.target.value);
                          const found = ingredients.find((ing) => ing.id === id);
                          const updated = [...items];
                          updated[i].ingredient_id = id;
                          if (found) {
                            updated[i].unit = found.unit;
                            updated[i].unit_cost = found.cost_per_unit;
                          }
                          setItems(updated);
                        }}
                        className="flex-1 px-2 py-1.5 rounded-lg border border-stone-200 text-xs bg-white font-medium"
                      >
                        {ingredients.map((ing) => (
                          <option key={ing.id} value={ing.id}>
                            {ing.name} ({ing.unit})
                          </option>
                        ))}
                      </select>

                      <div className="w-24">
                        <input
                          type="number"
                          step="any"
                          min="0"
                          placeholder="จำนวน"
                          value={it.quantity}
                          onChange={(e) => {
                            const updated = [...items];
                            updated[i].quantity = Number(e.target.value) || 0;
                            setItems(updated);
                          }}
                          className="w-full px-2 py-1.5 rounded-lg border border-stone-200 text-xs text-right font-bold bg-white"
                        />
                      </div>

                      <span className="text-xs text-stone-500 font-medium w-8 text-center">{it.unit}</span>

                      <div className="w-28 flex items-center gap-1">
                        <span className="text-[11px] text-stone-400">@฿</span>
                        <input
                          type="number"
                          step="any"
                          placeholder="ทุน/หน่วย"
                          value={it.unit_cost / 100}
                          onChange={(e) => {
                            const updated = [...items];
                            updated[i].unit_cost = Math.round((Number(e.target.value) || 0) * 100);
                            setItems(updated);
                          }}
                          className="w-full px-2 py-1.5 rounded-lg border border-stone-200 text-xs text-right font-bold bg-white"
                        />
                      </div>

                      <div className="w-24 text-right font-extrabold text-xs text-[#714631]">
                        {formatCurrency(it.quantity * it.unit_cost, true)}
                      </div>

                      <button
                        type="button"
                        onClick={() => handleRemoveItemRow(i)}
                        className="text-stone-400 hover:text-red-500 p-1"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Total Calculation Row */}
              <div className="p-3 bg-stone-50 rounded-2xl flex items-center justify-between">
                <span className="text-xs font-semibold text-stone-700">ยอดรวมทั้งสิ้น:</span>
                <span className="text-lg font-black text-[#714631]">{formatCurrency(calculateTotal(), true)}</span>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-stone-700">หมายเหตุ</label>
                <input
                  type="text"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="เช่น ใบส่งของเล่มที่... หรือชื่อผู้ส่งสินค้า"
                  className="w-full px-3 py-2 rounded-xl border border-stone-200 text-xs"
                />
              </div>

              <div className="pt-3 flex justify-end gap-2 border-t border-stone-100">
                <button
                  type="button"
                  onClick={() => setIsCreateOpen(false)}
                  className="px-4 py-2 rounded-xl border border-stone-200 text-xs font-semibold text-stone-600 hover:bg-stone-50"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 rounded-xl bg-[#8b5537] hover:bg-[#714631] text-white text-xs font-bold transition shadow-xs cursor-pointer"
                >
                  {submitting ? 'กำลังบันทึก...' : 'ยืนยันรับเข้าสต๊อก'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DETAIL MODAL */}
      {selectedReceiptDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl shadow-2xl max-w-lg w-full overflow-hidden border border-[#ecddc8]">
            <div className="px-6 py-4 bg-[#fdfaf6] border-b border-[#ebdccd] flex items-center justify-between">
              <div>
                <h3 className="font-bold text-base text-[#321d14]">
                  เอกสารรับเลขที่ {selectedReceiptDetail.receipt_no}
                </h3>
                <p className="text-xs text-[#8b5537]">{formatThaiDateTime(selectedReceiptDetail.receipt_date)}</p>
              </div>
              <button onClick={() => setSelectedReceiptDetail(null)} className="text-stone-400 hover:text-stone-700">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="text-xs space-y-1 bg-stone-50 p-3 rounded-2xl">
                <div>ซัพพลายเออร์: <span className="font-semibold text-stone-900">{selectedReceiptDetail.supplier_name}</span></div>
                <div>ผู้บันทึก: <span className="font-semibold text-stone-900">{selectedReceiptDetail.created_by_name}</span></div>
                {selectedReceiptDetail.note && <div>หมายเหตุ: <span className="italic">{selectedReceiptDetail.note}</span></div>}
              </div>

              <div className="space-y-1.5 text-xs">
                <div className="font-bold text-[#714631]">รายการวัตถุดิบ</div>
                {selectedReceiptDetail.items?.map((it, i) => (
                  <div key={i} className="flex justify-between items-center py-1 border-b border-stone-100">
                    <span>{it.ingredient_name}</span>
                    <span className="font-bold">{it.quantity} {it.unit} x {(it.unit_cost / 100).toFixed(2)} ฿ = {formatCurrency(it.total_cost, true)}</span>
                  </div>
                ))}
              </div>

              <div className="flex justify-between items-center pt-2 font-black text-sm">
                <span>ยอดรวมทั้งสิ้น:</span>
                <span className="text-[#714631] text-base">{formatCurrency(selectedReceiptDetail.total_amount, true)}</span>
              </div>

              <div className="pt-4 flex justify-between gap-2 border-t border-stone-100">
                {selectedReceiptDetail.status === 'COMPLETED' ? (
                  <button
                    onClick={() => handleCancelReceipt(selectedReceiptDetail.id)}
                    className="px-4 py-2 rounded-xl bg-red-50 hover:bg-red-100 text-red-700 text-xs font-bold transition"
                  >
                    ยกเลิกเอกสารและดึงสต๊อกกลับ
                  </button>
                ) : (
                  <span className="text-xs font-bold text-red-600">เอกสารนี้ถูกยกเลิกแล้ว</span>
                )}
                <button
                  onClick={() => setSelectedReceiptDetail(null)}
                  className="px-4 py-2 rounded-xl border border-stone-200 text-xs font-semibold text-stone-600 hover:bg-stone-50"
                >
                  ปิด
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

