import React, { useState, useEffect } from 'react';
import { Plus, Search, Edit2, Trash2, Coffee, Check, X, Tag } from 'lucide-react';
import { Product, ProductCategory } from '../types';
import { apiRequest, formatCurrency } from '../api/client';

export const ProductsView: React.FC = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<ProductCategory[]>([]);
  const [search, setSearch] = useState('');
  const [selectedCat, setSelectedCat] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  // Modal State
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Partial<Product> | null>(null);
  const [variantsList, setVariantsList] = useState<{ id?: number; name: string; price_adjustment: number; sku_suffix?: string }[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    const [pRes, cRes] = await Promise.all([
      apiRequest<Product[]>('/products'),
      apiRequest<ProductCategory[]>('/categories')
    ]);
    if (pRes.success && pRes.data) setProducts(pRes.data);
    if (cRes.success && cRes.data) setCategories(cRes.data);
    setLoading(false);
  };

  const handleCategoryChange = (catId: number) => {
    const cat = categories.find((c) => c.id === catId);
    const isBakery = cat && (
      cat.name.toLowerCase().includes('เบเกอรี่') ||
      cat.name.toLowerCase().includes('bakery') ||
      cat.name.toLowerCase().includes('ขนม') ||
      cat.name.toLowerCase().includes('เค้ก')
    );

    setEditingProduct((prev) => ({
      ...prev,
      category_id: catId,
      sku: (!prev?.id && isBakery && prev?.sku?.startsWith('DRK-'))
        ? `BAK-${Date.now().toString().slice(-4)}`
        : prev?.sku
    }));

    if (!editingProduct?.id) {
      if (isBakery) {
        setVariantsList([]);
      } else if (variantsList.length === 0) {
        setVariantsList([
          { name: 'ร้อน (Hot)', price_adjustment: 0, sku_suffix: '-HOT' },
          { name: 'เย็น (Iced)', price_adjustment: 500, sku_suffix: '-ICED' },
          { name: 'ปั่น (Frappe)', price_adjustment: 1500, sku_suffix: '-FRAP' }
        ]);
      }
    }
  };

  const handleOpenAdd = () => {
    const firstCat = categories[0];
    const isBakery = firstCat && (
      firstCat.name.toLowerCase().includes('เบเกอรี่') ||
      firstCat.name.toLowerCase().includes('bakery') ||
      firstCat.name.toLowerCase().includes('ขนม')
    );

    setEditingProduct({
      sku: isBakery ? `BAK-${Date.now().toString().slice(-4)}` : `DRK-${Date.now().toString().slice(-4)}`,
      name: '',
      category_id: firstCat?.id || 1,
      base_price: 5000,
      cost_price: 1500,
      has_recipe: 1,
      is_active: 1
    });
    setVariantsList(isBakery ? [] : [
      { name: 'ร้อน (Hot)', price_adjustment: 0, sku_suffix: '-HOT' },
      { name: 'เย็น (Iced)', price_adjustment: 500, sku_suffix: '-ICED' },
      { name: 'ปั่น (Frappe)', price_adjustment: 1500, sku_suffix: '-FRAP' }
    ]);
    setFormError(null);
    setIsEditModalOpen(true);
  };

  const handleOpenEdit = (p: Product) => {
    setEditingProduct(p);
    setVariantsList(p.variants || []);
    setFormError(null);
    setIsEditModalOpen(true);
  };

  const handleToggleStatus = async (p: Product) => {
    const newStatus = p.is_active === 1 ? 0 : 1;
    const res = await apiRequest(`/products/${p.id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ is_active: newStatus })
    });
    if (res.success) {
      setProducts(products.map((item) => (item.id === p.id ? { ...item, is_active: newStatus } : item)));
    }
  };

  const handleDelete = async (p: Product) => {
    if (!confirm(`คุณต้องการลบหรือปิดการใช้งานสินค้า "${p.name}" ใช่หรือไม่?`)) return;

    const res = await apiRequest(`/products/${p.id}`, { method: 'DELETE' });
    if (res.success) {
      alert(res.message);
      fetchData();
    } else {
      alert(res.message || 'เกิดข้อผิดพลาดในการลบสินค้า');
    }
  };

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProduct?.name || !editingProduct?.sku) {
      setFormError('กรุณากรอกรหัสและชื่อสินค้า');
      return;
    }

    setSubmitting(true);
    setFormError(null);

    const payload = {
      ...editingProduct,
      variants: variantsList
    };

    const isUpdating = Boolean(editingProduct.id);
    const url = isUpdating ? `/products/${editingProduct.id}` : '/products';
    const method = isUpdating ? 'PUT' : 'POST';

    const res = await apiRequest(url, {
      method,
      body: JSON.stringify(payload)
    });

    setSubmitting(false);

    if (res.success) {
      setIsEditModalOpen(false);
      fetchData();
    } else {
      setFormError(res.message || 'เกิดข้อผิดพลาดในการบันทึกสินค้า');
    }
  };

  const filtered = products.filter((p) => {
    const matchCat = selectedCat ? p.category_id === selectedCat : true;
    const matchSearch = search
      ? p.name.toLowerCase().includes(search.toLowerCase()) || p.sku.toLowerCase().includes(search.toLowerCase())
      : true;
    return matchCat && matchSearch;
  });

  return (
    <div className="flex-1 p-6 overflow-y-auto space-y-6 bg-[#fbf9f6]">
      {/* Top Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-[#321d14]">จัดการเมนูสินค้าและราคา</h2>
          <p className="text-xs text-[#8b5537]">เพิ่ม แก้ไข กำหนดราคา และตัวเลือกสินค้าสำหรับขายหน้าร้าน</p>
        </div>
        <button
          onClick={handleOpenAdd}
          className="px-4 py-2.5 rounded-xl bg-[#8b5537] hover:bg-[#714631] text-white font-semibold text-xs transition shadow-xs flex items-center gap-1.5 cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          เพิ่มสินค้าใหม่
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-[#ecddc8] flex flex-wrap items-center justify-between gap-3 shadow-2xs">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="absolute left-3.5 top-2.5 w-4 h-4 text-stone-400" />
          <input
            type="text"
            placeholder="ค้นหาชื่อสินค้า หรือรหัส SKU..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 rounded-xl border border-stone-200 text-xs text-stone-900 focus:outline-hidden focus:border-[#8b5537]"
          />
        </div>

        {/* Category Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto">
          <button
            onClick={() => setSelectedCat(null)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
              selectedCat === null ? 'bg-[#8b5537] text-white' : 'bg-stone-100 text-stone-700 hover:bg-stone-200'
            }`}
          >
            ทั้งหมด
          </button>
          {categories.map((c) => (
            <button
              key={c.id}
              onClick={() => setSelectedCat(c.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                selectedCat === c.id ? 'bg-[#8b5537] text-white' : 'bg-stone-100 text-stone-700 hover:bg-stone-200'
              }`}
            >
              {c.name}
            </button>
          ))}
        </div>
      </div>

      {/* Products Table */}
      <div className="bg-white rounded-3xl border border-[#ecddc8] shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-[#fdfaf6] border-b border-[#ebdccd] text-[#714631] font-bold">
                <th className="py-3 px-4">รหัส SKU</th>
                <th className="py-3 px-4">ชื่อสินค้า</th>
                <th className="py-3 px-4">หมวดหมู่</th>
                <th className="py-3 px-4 text-right">ราคาขายเริ่มต้น</th>
                <th className="py-3 px-4 text-right">ต้นทุนโดยประมาณ</th>
                <th className="py-3 px-4 text-center">ตัวเลือก/สูตร</th>
                <th className="py-3 px-4 text-center">สถานะ</th>
                <th className="py-3 px-4 text-right">การกระทำ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-stone-400">
                    กำลังโหลดสินค้า...
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-stone-400">
                    ไม่พบสินค้า
                  </td>
                </tr>
              ) : (
                filtered.map((p) => (
                  <tr key={p.id} className="hover:bg-stone-50 transition">
                    <td className="py-3 px-4 font-mono font-bold text-stone-900">{p.sku}</td>
                    <td className="py-3 px-4 font-semibold text-stone-900">{p.name}</td>
                    <td className="py-3 px-4 text-stone-600">{p.category_name || '-'}</td>
                    <td className="py-3 px-4 text-right font-extrabold text-[#714631]">
                      {formatCurrency(p.base_price)}
                    </td>
                    <td className="py-3 px-4 text-right text-stone-500">
                      {formatCurrency(p.cost_price)}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span className="inline-flex items-center gap-1 bg-[#f7f1e7] text-[#8b5537] px-2 py-0.5 rounded-full text-[10px] font-semibold">
                        {p.variants.length > 0 ? `${p.variants.length} รูปแบบ` : 'ขายตรง'}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <button
                        onClick={() => handleToggleStatus(p)}
                        className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold cursor-pointer transition ${
                          p.is_active === 1
                            ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
                            : 'bg-stone-200 text-stone-600 hover:bg-stone-300'
                        }`}
                      >
                        {p.is_active === 1 ? 'เปิดขาย' : 'ปิดการขาย'}
                      </button>
                    </td>
                    <td className="py-3 px-4 text-right space-x-2">
                      <button
                        onClick={() => handleOpenEdit(p)}
                        className="p-1.5 rounded-lg text-stone-500 hover:text-stone-900 hover:bg-stone-100 cursor-pointer transition"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDelete(p)}
                        className="p-1.5 rounded-lg text-stone-400 hover:text-red-600 hover:bg-red-50 cursor-pointer transition"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Edit / Add Modal */}
      {isEditModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl shadow-2xl max-w-lg w-full overflow-hidden border border-[#ecddc8] flex flex-col max-h-[90vh]">
            <div className="px-6 py-4 bg-[#fdfaf6] border-b border-[#ebdccd] flex items-center justify-between">
              <h3 className="font-bold text-base text-[#321d14]">
                {editingProduct?.id ? 'แก้ไขสินค้า' : 'เพิ่มสินค้าใหม่'}
              </h3>
              <button
                onClick={() => setIsEditModalOpen(false)}
                className="p-1 rounded-lg text-stone-400 hover:text-stone-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveProduct} className="p-6 space-y-4 overflow-y-auto flex-1">
              {formError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700">
                  {formError}
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-stone-700">รหัสสินค้า (SKU)*</label>
                  <input
                    type="text"
                    required
                    value={editingProduct?.sku || ''}
                    onChange={(e) => setEditingProduct({ ...editingProduct, sku: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-stone-200 text-xs font-mono font-bold"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-stone-700">หมวดหมู่</label>
                  <select
                    value={editingProduct?.category_id || ''}
                    onChange={(e) => handleCategoryChange(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl border border-stone-200 text-xs"
                  >
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-stone-700">ชื่อสินค้า (ไทย)*</label>
                <input
                  type="text"
                  required
                  value={editingProduct?.name || ''}
                  onChange={(e) => setEditingProduct({ ...editingProduct, name: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-stone-200 text-xs font-bold"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-stone-700">ราคาขายเริ่มต้น (บาท)*</label>
                  <input
                    type="number"
                    step="any"
                    required
                    value={(editingProduct?.base_price || 0) / 100}
                    onChange={(e) =>
                      setEditingProduct({
                        ...editingProduct,
                        base_price: Math.round((Number(e.target.value) || 0) * 100)
                      })
                    }
                    className="w-full px-3 py-2 rounded-xl border border-stone-200 text-xs font-bold text-[#714631]"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-stone-700">ต้นทุนโดยประมาณ (บาท)</label>
                  <input
                    type="number"
                    step="any"
                    value={(editingProduct?.cost_price || 0) / 100}
                    onChange={(e) =>
                      setEditingProduct({
                        ...editingProduct,
                        cost_price: Math.round((Number(e.target.value) || 0) * 100)
                      })
                    }
                    className="w-full px-3 py-2 rounded-xl border border-stone-200 text-xs text-stone-600"
                  />
                </div>
              </div>

              {/* Variants Setup (Hot, Iced, Frappe) */}
              <div className="space-y-2 pt-2 border-t border-stone-100">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-[#714631]">รูปแบบสินค้า (Variants)</span>
                  <button
                    type="button"
                    onClick={() => setVariantsList([...variantsList, { name: 'พิเศษ', price_adjustment: 1000 }])}
                    className="text-[11px] text-[#8b5537] font-semibold hover:underline"
                  >
                    + เพิ่มรูปแบบ
                  </button>
                </div>
                {variantsList.length === 0 && (
                  <div className="text-[11px] text-stone-500 bg-stone-50 p-2.5 rounded-xl border border-stone-200 leading-relaxed">
                    💡 <strong>สินค้าขายตรง (เบเกอรี่ / ของทานเล่น)</strong>: คลิกจากหน้าขายแล้วจะเพิ่มลงบิลทันที 1 ชิ้น โดยไม่มีตัวเลือกระดับความหวานหรือท็อปปิ้งเครื่องดื่ม
                  </div>
                )}
                <div className="space-y-1.5">
                  {variantsList.map((v, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <input
                        type="text"
                        placeholder="ชื่อรูปแบบ เช่น ร้อน, เย็น, แก้วใหญ่"
                        value={v.name}
                        onChange={(e) => {
                          const updated = [...variantsList];
                          updated[i].name = e.target.value;
                          setVariantsList(updated);
                        }}
                        className="flex-1 px-2.5 py-1.5 rounded-lg border border-stone-200 text-xs"
                      />
                      <div className="flex items-center gap-1 w-28">
                        <span className="text-[11px] text-stone-400">+฿</span>
                        <input
                          type="number"
                          step="any"
                          value={v.price_adjustment / 100}
                          onChange={(e) => {
                            const updated = [...variantsList];
                            updated[i].price_adjustment = Math.round((Number(e.target.value) || 0) * 100);
                            setVariantsList(updated);
                          }}
                          className="w-full px-2 py-1.5 rounded-lg border border-stone-200 text-xs text-right font-medium"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => setVariantsList(variantsList.filter((_, idx) => idx !== i))}
                        className="text-stone-400 hover:text-red-500 p-1"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="pt-4 flex justify-end gap-2 border-t border-stone-100">
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-stone-200 text-xs font-semibold text-stone-600 hover:bg-stone-50 cursor-pointer"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 rounded-xl bg-[#8b5537] hover:bg-[#714631] text-white text-xs font-bold transition shadow-xs cursor-pointer"
                >
                  {submitting ? 'กำลังบันทึก...' : 'บันทึกข้อมูล'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

