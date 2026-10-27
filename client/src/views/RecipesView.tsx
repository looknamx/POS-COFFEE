import React, { useState, useEffect } from 'react';
import { BookOpen, Plus, Trash2, Edit2, AlertCircle, Coffee, Check, X, Sparkles } from 'lucide-react';
import { Recipe, Ingredient, Product } from '../types';
import { apiRequest, formatCurrency } from '../api/client';

export const RecipesView: React.FC = () => {
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedProductId, setSelectedProductId] = useState<number | null>(null);
  const [recipeName, setRecipeName] = useState('');
  const [recipeItems, setRecipeItems] = useState<{ ingredient_id: number; quantity: number; unit: string }[]>([]);
  const [editingRecipeId, setEditingRecipeId] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    const [rRes, iRes, pRes] = await Promise.all([
      apiRequest<Recipe[]>('/recipes'),
      apiRequest<Ingredient[]>('/ingredients'),
      apiRequest<Product[]>('/products')
    ]);
    if (rRes.success && rRes.data) setRecipes(rRes.data);
    if (iRes.success && iRes.data) setIngredients(iRes.data);
    if (pRes.success && pRes.data) setProducts(pRes.data);
    setLoading(false);
  };

  const handleOpenAdd = () => {
    setEditingRecipeId(null);
    setSelectedProductId(products[0]?.id || null);
    setRecipeName('สูตรเครื่องดื่มมาตรฐาน');
    setRecipeItems([
      { ingredient_id: ingredients[0]?.id || 1, quantity: 18, unit: 'g' }
    ]);
    setErrorMsg(null);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (rec: Recipe) => {
    setEditingRecipeId(rec.id);
    setSelectedProductId(rec.product_id || null);
    setRecipeName(rec.name || '');
    setRecipeItems(
      rec.items.map((it) => ({
        ingredient_id: it.ingredient_id,
        quantity: it.quantity,
        unit: it.unit
      }))
    );
    setErrorMsg(null);
    setIsModalOpen(true);
  };

  const handleAddItemRow = () => {
    if (ingredients.length === 0) return;
    setRecipeItems([...recipeItems, { ingredient_id: ingredients[0].id, quantity: 10, unit: ingredients[0].unit }]);
  };

  const handleRemoveItemRow = (idx: number) => {
    setRecipeItems(recipeItems.filter((_, i) => i !== idx));
  };

  const handleSaveRecipe = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProductId) {
      setErrorMsg('กรุณาเลือกสินค้าสำหรับสูตรนี้');
      return;
    }
    if (recipeItems.length === 0) {
      setErrorMsg('กรุณาระบุวัตถุดิบอย่างน้อย 1 รายการ');
      return;
    }

    setSubmitting(true);
    setErrorMsg(null);

    const payload = {
      id: editingRecipeId,
      product_id: selectedProductId,
      name: recipeName,
      yield_quantity: 1,
      items: recipeItems
    };

    const res = await apiRequest('/recipes', {
      method: 'POST',
      body: JSON.stringify(payload)
    });

    setSubmitting(false);

    if (res.success) {
      setIsModalOpen(false);
      fetchData();
    } else {
      setErrorMsg(res.message || 'เกิดข้อผิดพลาดในการบันทึกสูตร');
    }
  };

  const handleDeleteRecipe = async (rec: Recipe) => {
    if (!confirm(`คุณต้องการลบสูตร "${rec.name}" ใช่หรือไม่?`)) return;
    const res = await apiRequest(`/recipes/${rec.id}`, { method: 'DELETE' });
    if (res.success) {
      fetchData();
    }
  };

  return (
    <div className="flex-1 p-6 overflow-y-auto space-y-6 bg-[#fbf9f6]">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-[#321d14]">สูตรเครื่องดื่มและการตัดสต๊อก (Recipe / BOM)</h2>
          <p className="text-xs text-[#8b5537]">
            กำหนดวัตถุดิบและปริมาณต่อ 1 แก้ว เพื่อตัดสต๊อกอัตโนมัติเมื่อมีการขาย พร้อมคำนวณต้นทุนและกำไร
          </p>
        </div>
        <button
          onClick={handleOpenAdd}
          className="px-4 py-2.5 rounded-xl bg-[#8b5537] hover:bg-[#714631] text-white font-semibold text-xs transition shadow-xs flex items-center gap-1.5 cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          สร้างสูตรใหม่
        </button>
      </div>

      {/* Recipes Cards Grid */}
      {loading ? (
        <div className="p-8 text-center text-xs text-stone-400">กำลังโหลดสูตรเครื่องดื่ม...</div>
      ) : recipes.length === 0 ? (
        <div className="bg-white rounded-3xl p-8 border border-[#ecddc8] text-center text-stone-400">
          ยังไม่มีการตั้งค่าสูตรเครื่องดื่ม
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {recipes.map((rec) => (
            <div
              key={rec.id}
              className="bg-white rounded-3xl p-5 border border-[#ecddc8] shadow-2xs hover:shadow-xs transition space-y-4"
            >
              {/* Card Header */}
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-base text-[#321d14]">{rec.product_name || rec.name}</span>
                    {rec.variant_name && (
                      <span className="bg-[#f7f1e7] text-[#8b5537] px-2 py-0.5 rounded-md text-[11px] font-semibold">
                        {rec.variant_name}
                      </span>
                    )}
                    {rec.option_name && (
                      <span className="bg-amber-100 text-amber-800 px-2 py-0.5 rounded-md text-[11px] font-semibold">
                        {rec.option_name}
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-stone-400 mt-0.5 font-mono">
                    {rec.product_sku ? `SKU: ${rec.product_sku}` : rec.name}
                  </div>
                </div>

                <div className="flex items-center gap-1">
                  <button
                    onClick={() => handleOpenEdit(rec)}
                    className="p-1.5 rounded-lg text-stone-400 hover:text-stone-700 hover:bg-stone-100 transition cursor-pointer"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDeleteRecipe(rec)}
                    className="p-1.5 rounded-lg text-stone-400 hover:text-red-600 hover:bg-red-50 transition cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Ingredients BOM list */}
              <div className="bg-[#fdfaf6] p-3 rounded-2xl border border-[#ebdccd] space-y-1.5 text-xs">
                <div className="text-[11px] font-bold uppercase tracking-wider text-[#714631] pb-1 border-b border-[#ebdccd]">
                  ส่วนผสมต่อ 1 แก้ว ({rec.items?.length || 0} รายการ)
                </div>
                <div className="space-y-1 max-h-36 overflow-y-auto">
                  {rec.items?.map((it, idx) => (
                    <div key={idx} className="flex justify-between items-center text-stone-700">
                      <span>• {it.ingredient_name}</span>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-stone-900">
                          {it.quantity} {it.unit}
                        </span>
                        <span className="text-[11px] text-stone-400 font-mono">
                          ({formatCurrency(it.line_cost, true)})
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Financial Metrics: Cost, Selling Price, Gross Profit, Margin */}
              <div className="grid grid-cols-4 gap-2 pt-2 border-t border-stone-100 text-center">
                <div className="bg-stone-50 p-2 rounded-xl">
                  <div className="text-[10px] text-stone-400">ต้นทุนวัตถุดิบ</div>
                  <div className="font-extrabold text-xs text-stone-700">
                    {formatCurrency(rec.total_cost, true)}
                  </div>
                </div>

                <div className="bg-stone-50 p-2 rounded-xl">
                  <div className="text-[10px] text-stone-400">ราคาขาย</div>
                  <div className="font-extrabold text-xs text-[#714631]">
                    {formatCurrency(rec.selling_price)}
                  </div>
                </div>

                <div className="bg-emerald-50 p-2 rounded-xl">
                  <div className="text-[10px] text-emerald-700">กำไรขั้นต้น</div>
                  <div className="font-extrabold text-xs text-emerald-800">
                    {formatCurrency(rec.gross_profit, true)}
                  </div>
                </div>

                <div className="bg-emerald-50 p-2 rounded-xl">
                  <div className="text-[10px] text-emerald-700">Margin %</div>
                  <div className="font-extrabold text-xs text-emerald-800">
                    {rec.margin_percent}%
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Recipe Add/Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl shadow-2xl max-w-lg w-full overflow-hidden border border-[#ecddc8] flex flex-col max-h-[90vh]">
            <div className="px-6 py-4 bg-[#fdfaf6] border-b border-[#ebdccd] flex items-center justify-between">
              <h3 className="font-bold text-base text-[#321d14]">
                {editingRecipeId ? 'แก้ไขสูตรเครื่องดื่ม' : 'สร้างสูตรเครื่องดื่มใหม่'}
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1 rounded-lg text-stone-400 hover:text-stone-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveRecipe} className="p-6 space-y-4 overflow-y-auto flex-1">
              {errorMsg && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700">
                  {errorMsg}
                </div>
              )}

              <div className="space-y-1">
                <label className="text-xs font-semibold text-stone-700">เลือกสินค้า / เครื่องดื่ม*</label>
                <select
                  required
                  value={selectedProductId || ''}
                  onChange={(e) => setSelectedProductId(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-xl border border-stone-200 text-xs font-semibold"
                >
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.sku})
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-stone-700">ชื่อสูตร</label>
                <input
                  type="text"
                  value={recipeName}
                  onChange={(e) => setRecipeName(e.target.value)}
                  placeholder="เช่น สูตรมาตรฐานเย็น 16oz"
                  className="w-full px-3 py-2 rounded-xl border border-stone-200 text-xs"
                />
              </div>

              {/* Items List */}
              <div className="space-y-2 pt-2 border-t border-stone-100">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-[#714631]">ส่วนผสมและปริมาณ (BOM Items)</span>
                  <button
                    type="button"
                    onClick={handleAddItemRow}
                    className="text-[11px] text-[#8b5537] font-semibold hover:underline"
                  >
                    + เพิ่มวัตถุดิบ
                  </button>
                </div>

                <div className="space-y-2">
                  {recipeItems.map((it, i) => (
                    <div key={i} className="flex items-center gap-2 bg-[#fdfaf6] p-2 rounded-xl border border-stone-200">
                      <select
                        value={it.ingredient_id}
                        onChange={(e) => {
                          const ingId = Number(e.target.value);
                          const found = ingredients.find((ing) => ing.id === ingId);
                          const updated = [...recipeItems];
                          updated[i].ingredient_id = ingId;
                          if (found) updated[i].unit = found.unit;
                          setRecipeItems(updated);
                        }}
                        className="flex-1 px-2 py-1.5 rounded-lg border border-stone-200 text-xs bg-white font-medium"
                      >
                        {ingredients.map((ing) => (
                          <option key={ing.id} value={ing.id}>
                            {ing.name} ({ing.unit})
                          </option>
                        ))}
                      </select>

                      <input
                        type="number"
                        step="any"
                        min="0"
                        value={it.quantity}
                        onChange={(e) => {
                          const updated = [...recipeItems];
                          updated[i].quantity = Number(e.target.value) || 0;
                          setRecipeItems(updated);
                        }}
                        placeholder="ปริมาณ"
                        className="w-20 px-2 py-1.5 rounded-lg border border-stone-200 text-xs text-right font-bold bg-white"
                      />

                      <span className="text-xs text-stone-500 font-medium w-8 text-center">{it.unit}</span>

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

              <div className="pt-4 flex justify-end gap-2 border-t border-stone-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-stone-200 text-xs font-semibold text-stone-600 hover:bg-stone-50"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 rounded-xl bg-[#8b5537] hover:bg-[#714631] text-white text-xs font-bold transition shadow-xs"
                >
                  {submitting ? 'กำลังบันทึก...' : 'บันทึกสูตร'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

