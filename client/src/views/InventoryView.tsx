import React, { useState, useEffect } from 'react';
import { Boxes, Plus, Search, AlertTriangle, ArrowUpDown, Trash2, Edit2, SlidersHorizontal, X } from 'lucide-react';
import { Ingredient, Supplier } from '../types';
import { apiRequest, formatCurrency } from '../api/client';

export const InventoryView: React.FC = () => {
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [summary, setSummary] = useState<any | null>(null);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [search, setSearch] = useState('');
  const [filterAlertOnly, setFilterAlertOnly] = useState(false);
  const [loading, setLoading] = useState(true);

  // Quick Adjust Modal
  const [adjustModalOpen, setAdjustModalOpen] = useState(false);
  const [adjustTarget, setAdjustTarget] = useState<Ingredient | null>(null);
  const [adjustType, setAdjustType] = useState<'USAGE' | 'WASTE' | 'ADJUSTMENT'>('WASTE');
  const [adjustQty, setAdjustQty] = useState<number>(0);
  const [adjustReason, setAdjustReason] = useState('');
  const [adjustNote, setAdjustNote] = useState('');
  const [submittingAdjust, setSubmittingAdjust] = useState(false);

  // Add/Edit Ingredient Modal
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Partial<Ingredient> | null>(null);

  useEffect(() => {
    fetchData();
  }, [filterAlertOnly]);

  const fetchData = async () => {
    setLoading(true);
    const url = `/ingredients${filterAlertOnly ? '?alert_only=1' : ''}`;
    const [iRes, sRes] = await Promise.all([
      apiRequest<Ingredient[]>(url),
      apiRequest<Supplier[]>('/suppliers')
    ]);

    if (iRes.success && iRes.data) {
      setIngredients(iRes.data);
      if (iRes.summary) setSummary(iRes.summary);
    }
    if (sRes.success && sRes.data) {
      setSuppliers(sRes.data);
    }
    setLoading(false);
  };

  const handleOpenAdjust = (ing: Ingredient) => {
    setAdjustTarget(ing);
    setAdjustType('WASTE');
    setAdjustQty(0);
    setAdjustReason('สินค้าหมดอายุหรือเสียหาย');
    setAdjustNote('');
    setAdjustModalOpen(true);
  };

  const handleSaveAdjust = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adjustTarget || adjustQty === 0 || !adjustReason) {
      alert('กรุณากรอกจำนวนและเหตุผลในการปรับสต๊อก');
      return;
    }

    setSubmittingAdjust(true);
    // Negative change for waste or usage
    const change = (adjustType === 'WASTE' || adjustType === 'USAGE') ? -Math.abs(adjustQty) : adjustQty;

    const res = await apiRequest('/inventory/adjust', {
      method: 'POST',
      body: JSON.stringify({
        ingredient_id: adjustTarget.id,
        movement_type: adjustType,
        quantity_change: change,
        reason: adjustReason,
        note: adjustNote
      })
    });

    setSubmittingAdjust(false);

    if (res.success) {
      setAdjustModalOpen(false);
      fetchData();
    } else {
      alert(res.message || 'เกิดข้อผิดพลาดในการปรับสต๊อก');
    }
  };

  const handleOpenAdd = () => {
    setEditingItem({
      code: `ING-${Date.now().toString().slice(-4)}`,
      name: '',
      unit: 'g',
      current_stock: 1000,
      min_reorder_stock: 200,
      cost_per_unit: 50,
      supplier_id: suppliers[0]?.id || undefined
    });
    setEditModalOpen(true);
  };

  const handleSaveItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingItem?.name || !editingItem?.code || !editingItem?.unit) return;

    const isUpdate = Boolean(editingItem.id);
    const url = isUpdate ? `/ingredients/${editingItem.id}` : '/ingredients';
    const method = isUpdate ? 'PUT' : 'POST';

    const res = await apiRequest(url, {
      method,
      body: JSON.stringify(editingItem)
    });

    if (res.success) {
      setEditModalOpen(false);
      fetchData();
    } else {
      alert(res.message || 'เกิดข้อผิดพลาดในการบันทึกวัตถุดิบ');
    }
  };

  const filtered = ingredients.filter((ing) => {
    return search
      ? ing.name.toLowerCase().includes(search.toLowerCase()) || ing.code.toLowerCase().includes(search.toLowerCase())
      : true;
  });

  return (
    <div className="flex-1 p-6 overflow-y-auto space-y-6 bg-[#fbf9f6]">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-[#321d14]">คลังวัตถุดิบและสต๊อก (Inventory & Stock)</h2>
          <p className="text-xs text-[#8b5537]">ตรวจสอบยอดคงเหลือ บันทึกของเสีย เบิกใช้ และตรวจนับสต๊อก</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleOpenAdd}
            className="px-4 py-2.5 rounded-xl bg-[#8b5537] hover:bg-[#714631] text-white font-semibold text-xs transition shadow-xs flex items-center gap-1.5 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            เพิ่มวัตถุดิบใหม่
          </button>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-2xl border border-[#ecddc8] shadow-2xs">
          <div className="text-xs text-[#8b5537] font-medium">รายการวัตถุดิบทั้งหมด</div>
          <div className="text-xl font-black text-[#321d14] mt-1">{summary?.total_items || ingredients.length} รายการ</div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-red-200 shadow-2xs">
          <div className="text-xs text-red-600 font-medium">วัตถุดิบหมดสต๊อก</div>
          <div className="text-xl font-black text-red-700 mt-1">{summary?.out_of_stock_count || 0} รายการ</div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-amber-200 shadow-2xs">
          <div className="text-xs text-amber-700 font-medium">วัตถุดิบต่ำกว่าจุดสั่งซื้อ</div>
          <div className="text-xl font-black text-amber-800 mt-1">{summary?.low_stock_count || 0} รายการ</div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-[#ecddc8] shadow-2xs">
          <div className="text-xs text-[#8b5537] font-medium">มูลค่าสินค้าคงคลังรวม</div>
          <div className="text-xl font-black text-emerald-800 mt-1">
            {formatCurrency(summary?.total_inventory_value || 0, true)}
          </div>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-white p-4 rounded-2xl border border-[#ecddc8] flex items-center justify-between gap-4 shadow-2xs">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3.5 top-2.5 w-4 h-4 text-stone-400" />
          <input
            type="text"
            placeholder="ค้นหาชื่อวัตถุดิบ หรือรหัส..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 rounded-xl border border-stone-200 text-xs text-stone-900 focus:outline-hidden focus:border-[#8b5537]"
          />
        </div>

        <button
          onClick={() => setFilterAlertOnly(!filterAlertOnly)}
          className={`px-3 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer ${
            filterAlertOnly
              ? 'bg-amber-500 text-white shadow-xs'
              : 'bg-stone-100 text-stone-700 hover:bg-stone-200'
          }`}
        >
          <AlertTriangle className="w-3.5 h-3.5" />
          เฉพาะที่ต้องสั่งซื้อ ({summary?.low_stock_count || 0})
        </button>
      </div>

      {/* Table */}
      <div className="bg-white rounded-3xl border border-[#ecddc8] shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-[#fdfaf6] border-b border-[#ebdccd] text-[#714631] font-bold">
                <th className="py-3 px-4">รหัส</th>
                <th className="py-3 px-4">ชื่อวัตถุดิบ</th>
                <th className="py-3 px-4">หมวดหมู่</th>
                <th className="py-3 px-4 text-right">คงเหลือจริง</th>
                <th className="py-3 px-4 text-right">จุดสั่งซื้อขั้นต่ำ</th>
                <th className="py-3 px-4 text-right">ต้นทุน/หน่วย</th>
                <th className="py-3 px-4 text-right">มูลค่ารวม</th>
                <th className="py-3 px-4 text-center">สถานะสต๊อก</th>
                <th className="py-3 px-4 text-right">การกระทำ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {loading ? (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-stone-400">กำลังโหลดข้อมูลสต๊อก...</td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-stone-400">ไม่พบวัตถุดิบ</td>
                </tr>
              ) : (
                filtered.map((ing) => (
                  <tr key={ing.id} className="hover:bg-stone-50 transition">
                    <td className="py-3 px-4 font-mono font-bold text-stone-900">{ing.code}</td>
                    <td className="py-3 px-4 font-semibold text-stone-900">{ing.name}</td>
                    <td className="py-3 px-4 text-stone-600">{ing.category_name || '-'}</td>
                    <td className="py-3 px-4 text-right font-extrabold text-stone-900">
                      {ing.current_stock.toLocaleString()} <span className="text-stone-500 font-normal">{ing.unit}</span>
                    </td>
                    <td className="py-3 px-4 text-right text-stone-500">
                      {ing.min_reorder_stock.toLocaleString()} {ing.unit}
                    </td>
                    <td className="py-3 px-4 text-right text-stone-700">
                      {(ing.cost_per_unit / 100).toFixed(2)} ฿
                    </td>
                    <td className="py-3 px-4 text-right font-bold text-[#714631]">
                      {formatCurrency(ing.current_stock * ing.cost_per_unit, true)}
                    </td>
                    <td className="py-3 px-4 text-center">
                      {ing.current_stock <= 0 ? (
                        <span className="bg-red-100 text-red-800 px-2 py-0.5 rounded-full text-[10px] font-bold">
                          หมดสต๊อก
                        </span>
                      ) : ing.current_stock <= ing.min_reorder_stock ? (
                        <span className="bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full text-[10px] font-bold">
                          สต๊อกต่ำ
                        </span>
                      ) : (
                        <span className="bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full text-[10px] font-bold">
                          ปกติ
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right space-x-1">
                      <button
                        onClick={() => handleOpenAdjust(ing)}
                        className="px-2 py-1 rounded-lg bg-[#f7f1e7] hover:bg-[#ecddc8] text-[#8b5537] font-semibold text-[11px] transition cursor-pointer"
                      >
                        ปรับยอด/ของเสีย
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* QUICK ADJUST MODAL */}
      {adjustModalOpen && adjustTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full overflow-hidden border border-[#ecddc8]">
            <div className="px-6 py-4 bg-[#fdfaf6] border-b border-[#ebdccd] flex items-center justify-between">
              <div>
                <h3 className="font-bold text-base text-[#321d14]">บันทึกปรับยอดสต๊อก / ของเสีย</h3>
                <p className="text-xs text-[#8b5537]">{adjustTarget.name} (คงเหลือ {adjustTarget.current_stock} {adjustTarget.unit})</p>
              </div>
              <button onClick={() => setAdjustModalOpen(false)} className="text-stone-400 hover:text-stone-700">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveAdjust} className="p-6 space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-stone-700">ประเภทการเคลื่อนไหว*</label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setAdjustType('WASTE')}
                    className={`py-2 text-xs font-bold rounded-xl border transition cursor-pointer ${
                      adjustType === 'WASTE' ? 'bg-red-500 text-white border-red-500' : 'bg-white border-stone-200 text-stone-700'
                    }`}
                  >
                    ของเสีย/ชำรุด
                  </button>
                  <button
                    type="button"
                    onClick={() => setAdjustType('USAGE')}
                    className={`py-2 text-xs font-bold rounded-xl border transition cursor-pointer ${
                      adjustType === 'USAGE' ? 'bg-amber-600 text-white border-amber-600' : 'bg-white border-stone-200 text-stone-700'
                    }`}
                  >
                    เบิกใช้ในร้าน
                  </button>
                  <button
                    type="button"
                    onClick={() => setAdjustType('ADJUSTMENT')}
                    className={`py-2 text-xs font-bold rounded-xl border transition cursor-pointer ${
                      adjustType === 'ADJUSTMENT' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white border-stone-200 text-stone-700'
                    }`}
                  >
                    ปรับปรุงยอด
                  </button>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-stone-700">จำนวนที่ต้องการปรับ ({adjustTarget.unit})*</label>
                <input
                  type="number"
                  step="any"
                  required
                  min="0"
                  value={adjustQty || ''}
                  onChange={(e) => setAdjustQty(Number(e.target.value) || 0)}
                  placeholder="เช่น 100"
                  className="w-full px-3 py-2 rounded-xl border border-stone-200 text-sm font-bold text-stone-900"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-stone-700">สาเหตุ / เหตุผล*</label>
                <input
                  type="text"
                  required
                  value={adjustReason}
                  onChange={(e) => setAdjustReason(e.target.value)}
                  placeholder="เช่น นมหมดอายุ, แก้วบุบแตก, ชงหก"
                  className="w-full px-3 py-2 rounded-xl border border-stone-200 text-xs"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-stone-700">หมายเหตุเพิ่มเติม</label>
                <input
                  type="text"
                  value={adjustNote}
                  onChange={(e) => setAdjustNote(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-stone-200 text-xs"
                />
              </div>

              <div className="pt-3 flex justify-end gap-2 border-t border-stone-100">
                <button
                  type="button"
                  onClick={() => setAdjustModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-stone-200 text-xs font-semibold text-stone-600 hover:bg-stone-50"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  disabled={submittingAdjust}
                  className="px-5 py-2 rounded-xl bg-[#8b5537] hover:bg-[#714631] text-white text-xs font-bold transition shadow-xs cursor-pointer"
                >
                  {submittingAdjust ? 'กำลังบันทึก...' : 'ยืนยันการปรับยอด'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ADD/EDIT INGREDIENT MODAL */}
      {editModalOpen && editingItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full overflow-hidden border border-[#ecddc8]">
            <div className="px-6 py-4 bg-[#fdfaf6] border-b border-[#ebdccd] flex items-center justify-between">
              <h3 className="font-bold text-base text-[#321d14]">
                {editingItem.id ? 'แก้ไขวัตถุดิบ' : 'เพิ่มวัตถุดิบใหม่'}
              </h3>
              <button onClick={() => setEditModalOpen(false)} className="text-stone-400 hover:text-stone-700">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveItem} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-stone-700">รหัสวัตถุดิบ*</label>
                  <input
                    type="text"
                    required
                    value={editingItem.code || ''}
                    onChange={(e) => setEditingItem({ ...editingItem, code: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-stone-200 text-xs font-mono font-bold"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-stone-700">หน่วยนับ (เช่น g, ml, pcs)*</label>
                  <input
                    type="text"
                    required
                    value={editingItem.unit || ''}
                    onChange={(e) => setEditingItem({ ...editingItem, unit: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-stone-200 text-xs font-bold"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-stone-700">ชื่อวัตถุดิบ*</label>
                <input
                  type="text"
                  required
                  value={editingItem.name || ''}
                  onChange={(e) => setEditingItem({ ...editingItem, name: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-stone-200 text-xs font-bold"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-stone-700">จำนวนเริ่มต้น</label>
                  <input
                    type="number"
                    step="any"
                    value={editingItem.current_stock || 0}
                    onChange={(e) => setEditingItem({ ...editingItem, current_stock: Number(e.target.value) || 0 })}
                    className="w-full px-3 py-2 rounded-xl border border-stone-200 text-xs font-bold"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-stone-700">จุดสั่งซื้อขั้นต่ำ</label>
                  <input
                    type="number"
                    step="any"
                    value={editingItem.min_reorder_stock || 0}
                    onChange={(e) => setEditingItem({ ...editingItem, min_reorder_stock: Number(e.target.value) || 0 })}
                    className="w-full px-3 py-2 rounded-xl border border-stone-200 text-xs"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-stone-700">ต้นทุนต่อหน่วย (บาท)</label>
                <input
                  type="number"
                  step="any"
                  value={(editingItem.cost_per_unit || 0) / 100}
                  onChange={(e) =>
                    setEditingItem({
                      ...editingItem,
                      cost_per_unit: Math.round((Number(e.target.value) || 0) * 100)
                    })
                  }
                  className="w-full px-3 py-2 rounded-xl border border-stone-200 text-xs font-bold text-[#714631]"
                />
              </div>

              <div className="pt-3 flex justify-end gap-2 border-t border-stone-100">
                <button
                  type="button"
                  onClick={() => setEditModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-stone-200 text-xs font-semibold text-stone-600 hover:bg-stone-50"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-[#8b5537] hover:bg-[#714631] text-white text-xs font-bold transition shadow-xs cursor-pointer"
                >
                  บันทึก
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

