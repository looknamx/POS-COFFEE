import React, { useState, useEffect } from 'react';
import { Users, Plus, Edit2, Trash2, Phone, Mail, MapPin, X } from 'lucide-react';
import { Supplier } from '../types';
import { apiRequest, formatCurrency } from '../api/client';

export const SuppliersView: React.FC = () => {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Partial<Supplier> | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    const res = await apiRequest<Supplier[]>('/suppliers');
    if (res.success && res.data) {
      setSuppliers(res.data);
    }
    setLoading(false);
  };

  const handleOpenAdd = () => {
    setEditingSupplier({
      code: `SUP-${Date.now().toString().slice(-4)}`,
      name: '',
      contact_name: '',
      phone: '',
      email: '',
      address: '',
      note: ''
    });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (s: Supplier) => {
    setEditingSupplier(s);
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSupplier?.name) return;

    const isUpdate = Boolean(editingSupplier.id);
    const url = isUpdate ? `/suppliers/${editingSupplier.id}` : '/suppliers';
    const method = isUpdate ? 'PUT' : 'POST';

    const res = await apiRequest(url, {
      method,
      body: JSON.stringify(editingSupplier)
    });

    if (res.success) {
      setIsModalOpen(false);
      fetchData();
    } else {
      alert(res.message || 'เกิดข้อผิดพลาดในการบันทึก');
    }
  };

  const handleDelete = async (s: Supplier) => {
    if (!confirm(`คุณต้องการปิดการใช้งานซัพพลายเออร์ "${s.name}" ใช่หรือไม่?`)) return;
    const res = await apiRequest(`/suppliers/${s.id}`, { method: 'DELETE' });
    if (res.success) {
      fetchData();
    }
  };

  return (
    <div className="flex-1 p-6 overflow-y-auto space-y-6 bg-[#fbf9f6]">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-[#321d14]">คู่ค้าและซัพพลายเออร์ (Suppliers)</h2>
          <p className="text-xs text-[#8b5537]">จัดการข้อมูลผู้จัดจำหน่ายเมล็ดกาแฟ นม วัตถุดิบ และบรรจุภัณฑ์</p>
        </div>
        <button
          onClick={handleOpenAdd}
          className="px-4 py-2.5 rounded-xl bg-[#8b5537] hover:bg-[#714631] text-white font-semibold text-xs transition shadow-xs flex items-center gap-1.5 cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          เพิ่มซัพพลายเออร์
        </button>
      </div>

      {/* Grid Cards */}
      {loading ? (
        <div className="p-8 text-center text-xs text-stone-400">กำลังโหลดข้อมูลคู่ค้า...</div>
      ) : suppliers.length === 0 ? (
        <div className="p-8 text-center text-xs text-stone-400">ยังไม่มีข้อมูลคู่ค้า</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {suppliers.map((s) => (
            <div
              key={s.id}
              className="bg-white rounded-3xl p-5 border border-[#ecddc8] shadow-2xs hover:shadow-xs transition space-y-3 flex flex-col justify-between"
            >
              <div className="space-y-2">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-bold text-sm text-[#321d14]">{s.name}</h3>
                    <div className="text-[11px] font-mono text-stone-400">{s.code}</div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleOpenEdit(s)}
                      className="p-1 rounded-lg text-stone-400 hover:text-stone-700 hover:bg-stone-100 cursor-pointer"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDelete(s)}
                      className="p-1 rounded-lg text-stone-400 hover:text-red-600 hover:bg-red-50 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <div className="space-y-1 text-xs text-stone-600 pt-1">
                  {s.contact_name && <div>ผู้ติดต่อ: <span className="font-semibold">{s.contact_name}</span></div>}
                  {s.phone && (
                    <div className="flex items-center gap-1.5">
                      <Phone className="w-3.5 h-3.5 text-[#ba8452]" />
                      <span>{s.phone}</span>
                    </div>
                  )}
                  {s.email && (
                    <div className="flex items-center gap-1.5">
                      <Mail className="w-3.5 h-3.5 text-[#ba8452]" />
                      <span>{s.email}</span>
                    </div>
                  )}
                  {s.address && (
                    <div className="flex items-start gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-[#ba8452] shrink-0 mt-0.5" />
                      <span className="line-clamp-2">{s.address}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Purchase statistics */}
              <div className="pt-3 border-t border-stone-100 flex items-center justify-between text-xs">
                <span className="text-stone-500">ยอดสั่งซื้อสะสม ({s.total_receipts || 0} ครั้ง):</span>
                <span className="font-black text-[#714631]">{formatCurrency(s.total_purchases || 0, true)}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add / Edit Modal */}
      {isModalOpen && editingSupplier && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full overflow-hidden border border-[#ecddc8]">
            <div className="px-6 py-4 bg-[#fdfaf6] border-b border-[#ebdccd] flex items-center justify-between">
              <h3 className="font-bold text-base text-[#321d14]">
                {editingSupplier.id ? 'แก้ไขคู่ค้า' : 'เพิ่มคู่ค้าใหม่'}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="text-stone-400 hover:text-stone-700">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSave} className="p-6 space-y-3.5">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-stone-700">ชื่อร้าน / บริษัท*</label>
                <input
                  type="text"
                  required
                  value={editingSupplier.name || ''}
                  onChange={(e) => setEditingSupplier({ ...editingSupplier, name: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-stone-200 text-xs font-bold"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-stone-700">ผู้ติดต่อ</label>
                  <input
                    type="text"
                    value={editingSupplier.contact_name || ''}
                    onChange={(e) => setEditingSupplier({ ...editingSupplier, contact_name: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-stone-200 text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-stone-700">เบอร์โทรศัพท์</label>
                  <input
                    type="text"
                    value={editingSupplier.phone || ''}
                    onChange={(e) => setEditingSupplier({ ...editingSupplier, phone: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-stone-200 text-xs"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-stone-700">ที่อยู่</label>
                <textarea
                  rows={2}
                  value={editingSupplier.address || ''}
                  onChange={(e) => setEditingSupplier({ ...editingSupplier, address: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-stone-200 text-xs"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-stone-700">หมายเหตุ</label>
                <input
                  type="text"
                  value={editingSupplier.note || ''}
                  onChange={(e) => setEditingSupplier({ ...editingSupplier, note: e.target.value })}
                  placeholder="เช่น เมล็ดกาแฟ, นมสด, แก้ว"
                  className="w-full px-3 py-2 rounded-xl border border-stone-200 text-xs"
                />
              </div>

              <div className="pt-3 flex justify-end gap-2 border-t border-stone-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
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

