import React, { useState, useEffect } from 'react';
import { X, Plus, Minus, Coffee, Sparkles } from 'lucide-react';
import { Product, ProductVariant, ProductOption, CartItem } from '../types';
import { formatCurrency } from '../api/client';

interface ProductCustomizeModalProps {
  product: Product;
  onAddToCart: (cartItem: CartItem) => void;
  onClose: () => void;
}

export const ProductCustomizeModal: React.FC<ProductCustomizeModalProps> = ({
  product,
  onAddToCart,
  onClose
}) => {
  // Select first variant if available (e.g. Iced or Hot)
  const defaultVariant = product.variants.length > 0
    ? (product.variants.find((v) => v.name.includes('เย็น') || v.name.includes('Iced')) || product.variants[0])
    : null;

  const [selectedVariant, setSelectedVariant] = useState<ProductVariant | null>(defaultVariant);
  const [selectedOptions, setSelectedOptions] = useState<ProductOption[]>([]);
  const [quantity, setQuantity] = useState(1);
  const [note, setNote] = useState('');

  // Pre-select default options from option groups
  useEffect(() => {
    const initialOpts: ProductOption[] = [];
    for (const grp of product.option_groups) {
      const def = grp.options.find((o) => o.is_default === 1);
      if (def) initialOpts.push(def);
    }
    setSelectedOptions(initialOpts);
  }, [product]);

  // Handle single-select vs multi-select options
  const handleToggleOption = (group: any, opt: ProductOption) => {
    const isSingleSelect = group.max_select === 1;

    if (isSingleSelect) {
      // Remove other options from same group, add this one
      const filtered = selectedOptions.filter((o) => o.group_id !== group.id);
      setSelectedOptions([...filtered, opt]);
    } else {
      // Toggle
      const exists = selectedOptions.some((o) => o.id === opt.id);
      if (exists) {
        setSelectedOptions(selectedOptions.filter((o) => o.id !== opt.id));
      } else {
        setSelectedOptions([...selectedOptions, opt]);
      }
    }
  };

  // Compute unit price: base + variant + selected options
  let unitPrice = product.base_price;
  if (selectedVariant) {
    unitPrice += selectedVariant.price_adjustment;
  }
  for (const opt of selectedOptions) {
    unitPrice += opt.price_adjustment;
  }
  const lineTotal = unitPrice * quantity;

  const handleAdd = () => {
    const item: CartItem = {
      cartItemId: `${product.id}-${selectedVariant?.id || 0}-${selectedOptions.map(o => o.id).sort().join('_')}-${Date.now()}`,
      product,
      variant: selectedVariant,
      selectedOptions,
      quantity,
      unitPrice,
      lineTotal,
      note: note.trim() || undefined
    };
    onAddToCart(item);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl shadow-2xl max-w-lg w-full overflow-hidden border border-[#ecddc8] animate-in fade-in zoom-in-95 duration-150 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-[#fdfaf6] to-[#f7f1e7] border-b border-[#ebdccd] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#ba8452]/20 text-[#8b5537] flex items-center justify-center">
              <Coffee className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-bold text-lg text-[#321d14] leading-tight">{product.name}</h2>
              <div className="text-xs text-[#8b5537] font-medium">
                รหัส: {product.sku} • ราคาเริ่มต้น {formatCurrency(product.base_price)}
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-stone-200/50 text-stone-500 hover:text-stone-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-5 overflow-y-auto flex-1">
          {/* Variant Selector (Hot, Iced, Frappe) */}
          {product.variants.length > 0 && (
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-[#714631] flex items-center justify-between">
                <span>เลือกรูปแบบเครื่องดื่ม</span>
                <span className="text-[11px] font-normal text-[#ba8452]">จำเป็นต้องเลือก 1 รายการ</span>
              </label>
              <div className="grid grid-cols-3 gap-2.5">
                {product.variants.map((v) => {
                  const isSelected = selectedVariant?.id === v.id;
                  return (
                    <button
                      key={v.id}
                      type="button"
                      onClick={() => setSelectedVariant(v)}
                      className={`p-3 rounded-2xl border-2 text-center transition flex flex-col items-center justify-center gap-1 cursor-pointer ${
                        isSelected
                          ? 'border-[#8b5537] bg-[#f7f1e7] text-[#321d14] shadow-xs'
                          : 'border-stone-200 hover:border-[#ddc2a3] bg-white text-stone-700'
                      }`}
                    >
                      <span className="font-semibold text-sm">{v.name}</span>
                      <span className="text-xs text-[#8b5537] font-medium">
                        {v.price_adjustment > 0 ? `+${formatCurrency(v.price_adjustment)}` : 'ราคาปกติ'}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Option Groups (Sweetness, Add-ons) */}
          {product.option_groups.map((group) => (
            <div key={group.id} className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-[#714631] flex items-center justify-between">
                <span>{group.name}</span>
                {group.is_required ? (
                  <span className="text-[11px] font-normal text-amber-700">จำเป็นต้องเลือก</span>
                ) : (
                  <span className="text-[11px] font-normal text-stone-400">เลือกเพิ่มเติมได้</span>
                )}
              </label>
              <div className="grid grid-cols-2 gap-2">
                {group.options.map((opt) => {
                  const isSelected = selectedOptions.some((o) => o.id === opt.id);
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => handleToggleOption(group, opt)}
                      className={`px-3 py-2.5 rounded-xl border text-left transition flex items-center justify-between cursor-pointer ${
                        isSelected
                          ? 'border-[#8b5537] bg-[#fdfaf6] text-[#321d14] font-medium'
                          : 'border-stone-200 hover:border-stone-300 bg-white text-stone-700'
                      }`}
                    >
                      <span className="text-sm">{opt.name}</span>
                      {opt.price_adjustment > 0 && (
                        <span className="text-xs font-semibold text-[#8b5537] shrink-0 ml-1">
                          +{formatCurrency(opt.price_adjustment)}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}

          {/* Customer Note */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold uppercase tracking-wider text-[#714631]">
              หมายเหตุเพิ่มเติม (ถ้ามี)
            </label>
            <input
              type="text"
              placeholder="เช่น แยกน้ำแข็ง, ไม่รับหลอด, นมข้นน้อย"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-stone-200 text-sm focus:outline-hidden focus:border-[#8b5537] focus:ring-1 focus:ring-[#8b5537]"
            />
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-5 bg-[#fdfaf6] border-t border-[#ebdccd] flex items-center justify-between gap-4 shrink-0">
          {/* Quantity Counter */}
          <div className="flex items-center gap-3 bg-white px-3 py-1.5 rounded-2xl border border-stone-200 shadow-xs">
            <button
              type="button"
              onClick={() => setQuantity(Math.max(1, quantity - 1))}
              className="w-8 h-8 rounded-xl bg-stone-100 hover:bg-stone-200 flex items-center justify-center text-stone-700 transition cursor-pointer"
            >
              <Minus className="w-4 h-4" />
            </button>
            <span className="font-bold text-base w-6 text-center text-stone-900">{quantity}</span>
            <button
              type="button"
              onClick={() => setQuantity(quantity + 1)}
              className="w-8 h-8 rounded-xl bg-stone-100 hover:bg-stone-200 flex items-center justify-center text-stone-700 transition cursor-pointer"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>

          {/* Add to Cart Button with Computed Total */}
          <button
            type="button"
            onClick={handleAdd}
            className="flex-1 py-3 px-5 rounded-2xl bg-[#8b5537] hover:bg-[#714631] text-white font-bold text-base transition shadow-sm flex items-center justify-between cursor-pointer"
          >
            <span>เพิ่มเข้าตะกร้า</span>
            <span className="text-amber-200">{formatCurrency(lineTotal)}</span>
          </button>
        </div>
      </div>
    </div>
  );
};

