import React, { useState, useEffect } from 'react';
import { Search, Coffee, Plus, Minus, Trash2, Tag, ShoppingCart, Sparkles, AlertCircle, Tv } from 'lucide-react';
import { Product, ProductCategory, CartItem, StoreSettings } from '../types';
import { apiRequest, formatCurrency } from '../api/client';
import { ProductCustomizeModal } from '../components/ProductCustomizeModal';
import { CheckoutModal } from '../components/CheckoutModal';
import { ReceiptModal } from '../components/ReceiptModal';
import { broadcastCustomerDisplay } from '../utils/customerDisplaySync';

interface PosViewProps {
  settings: StoreSettings;
}

export const PosView: React.FC<PosViewProps> = ({ settings }) => {
  const [categories, setCategories] = useState<ProductCategory[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);

  // Cart State
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [billDiscount, setBillDiscount] = useState<number>(0); // satang

  // Modals State
  const [customizingProduct, setCustomizingProduct] = useState<Product | null>(null);
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [completedSale, setCompletedSale] = useState<any | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    const [catRes, prodRes] = await Promise.all([
      apiRequest<ProductCategory[]>('/categories'),
      apiRequest<Product[]>('/products?active_only=1')
    ]);

    if (catRes.success && catRes.data) {
      setCategories(catRes.data);
    }
    if (prodRes.success && prodRes.data) {
      setProducts(prodRes.data);
    }
    setLoading(false);
  };

  // Filter products by selected category and search query
  const filteredProducts = products.filter((p) => {
    const matchCategory = selectedCategoryId ? p.category_id === selectedCategoryId : true;
    const matchSearch = searchQuery
      ? p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.sku.toLowerCase().includes(searchQuery.toLowerCase())
      : true;
    return matchCategory && matchSearch;
  });

  const isBakeryProduct = (product: Product): boolean => {
    if (product.is_bakery) return true;
    const cat = (product.category_name || '').toLowerCase();
    return (
      cat.includes('เบเกอรี่') ||
      cat.includes('bakery') ||
      cat.includes('ขนม') ||
      cat.includes('เค้ก') ||
      cat.includes('ของทานเล่น')
    );
  };

  const quickAddDirectProduct = (product: Product) => {
    const existingIdx = cartItems.findIndex((it) => it.product.id === product.id && !it.variant);
    if (existingIdx >= 0) {
      const updated = [...cartItems];
      updated[existingIdx].quantity += 1;
      updated[existingIdx].lineTotal = updated[existingIdx].unitPrice * updated[existingIdx].quantity;
      setCartItems(updated);
    } else {
      const newItem: CartItem = {
        cartItemId: `${product.id}-${Date.now()}`,
        product,
        variant: null,
        selectedOptions: [],
        quantity: 1,
        unitPrice: product.base_price,
        lineTotal: product.base_price
      };
      setCartItems([...cartItems, newItem]);
    }
  };

  // Handle clicking on product card
  const handleProductClick = (product: Product) => {
    // If it's a bakery or snack product without custom variants, quick-add directly to cart!
    if (isBakeryProduct(product) && (!product.variants || product.variants.length === 0)) {
      quickAddDirectProduct(product);
      return;
    }

    // If product has variants or option groups, open customizer modal
    if (product.variants.length > 0 || (product.option_groups && product.option_groups.length > 0)) {
      setCustomizingProduct(product);
    } else {
      quickAddDirectProduct(product);
    }
  };

  // Cart operations
  const handleAddToCart = (item: CartItem) => {
    setCartItems((prev) => [...prev, item]);
  };

  const updateQuantity = (index: number, newQty: number) => {
    if (newQty <= 0) {
      removeCartItem(index);
      return;
    }
    const updated = [...cartItems];
    updated[index].quantity = newQty;
    updated[index].lineTotal = updated[index].unitPrice * newQty;
    setCartItems(updated);
  };

  const removeCartItem = (index: number) => {
    setCartItems(cartItems.filter((_, i) => i !== index));
  };

  const clearCart = () => {
    setCartItems([]);
    setBillDiscount(0);
  };

  // Calculations
  const subtotal = cartItems.reduce((acc, it) => acc + it.lineTotal, 0);
  const netTotal = Math.max(0, subtotal - billDiscount);
  const totalItemCount = cartItems.reduce((acc, it) => acc + it.quantity, 0);

  // Sync cart with Customer Second Screen
  useEffect(() => {
    if (cartItems.length === 0) {
      broadcastCustomerDisplay({
        storeName: settings.store_name || 'ร้านกาแฟหอมละมุน',
        storePhone: settings.store_phone,
        status: 'WELCOME',
        items: [],
        subtotal: 0,
        discountAmount: 0,
        netTotal: 0
      });
    } else {
      broadcastCustomerDisplay({
        storeName: settings.store_name || 'ร้านกาแฟหอมละมุน',
        storePhone: settings.store_phone,
        status: 'CART',
        items: cartItems.map((it) => ({
          id: it.cartItemId,
          name: it.product.name,
          variantName: it.variant?.name,
          optionsText: it.selectedOptions
            .map((o) => o.name)
            .concat(it.note ? [`หมายเหตุ: ${it.note}`] : [])
            .join(', '),
          quantity: it.quantity,
          unitPrice: it.unitPrice,
          lineTotal: it.lineTotal
        })),
        subtotal,
        discountAmount: billDiscount,
        netTotal
      });
    }
  }, [cartItems, billDiscount, subtotal, netTotal, settings.store_name, settings.store_phone]);

  const handleOpenCustomerDisplay = () => {
    const url = `${window.location.origin}${window.location.pathname}?mode=customer-display`;
    window.open(url, 'PosCustomerDisplay', 'width=1024,height=768,menubar=no,toolbar=no,location=no,status=no');
  };

  const handleCheckoutSuccess = (saleData: any) => {
    setIsCheckoutOpen(false);

    // Auto print receipt directly if enabled in settings
    if (settings.printer_auto_print_checkout === '1') {
      apiRequest('/pos/print-receipt', {
        method: 'POST',
        body: JSON.stringify({
          saleId: saleData.saleId || saleData.id,
          printerType: settings.printer_type || 'WINDOWS',
          target: settings.printer_type === 'NETWORK' ? settings.printer_ip : settings.printer_name,
          paperWidth: settings.printer_paper_width || '80mm',
          cutPaper: settings.printer_auto_cut !== '0',
          openDrawer: settings.printer_open_drawer === '1'
        })
      }).catch((err) => console.error('Auto print receipt error:', err));
    }

    broadcastCustomerDisplay({
      status: 'COMPLETED',
      netTotal: saleData.net_total || netTotal,
      receivedAmount: saleData.received_amount,
      changeAmount: saleData.change_amount,
      billNo: saleData.bill_no
    });
    setTimeout(() => {
      broadcastCustomerDisplay({
        status: 'WELCOME',
        items: [],
        subtotal: 0,
        discountAmount: 0,
        netTotal: 0
      });
    }, 6000);
    clearCart();
    setCompletedSale(saleData);
  };

  return (
    <div className="flex-1 flex overflow-hidden">
      {/* LEFT: PRODUCTS CATALOG & SEARCH */}
      <div className="flex-1 flex flex-col min-w-0 bg-[#fbf9f6] border-r border-[#ebdccd]">
        {/* Search Bar & Category Filters */}
        <div className="p-4 bg-white border-b border-[#ebdccd] space-y-3 shrink-0 shadow-2xs">
          {/* Search Box */}
          <div className="relative">
            <Search className="absolute left-3.5 top-3 w-4 h-4 text-stone-400" />
            <input
              type="text"
              placeholder="ค้นหาชื่อเครื่องดื่ม หรือรหัสสินค้า (SKU)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-stone-200 bg-[#fdfaf6] text-sm text-stone-900 focus:outline-hidden focus:border-[#8b5537] focus:bg-white transition"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-2.5 text-xs text-stone-400 hover:text-stone-700 bg-stone-200 px-1.5 py-0.5 rounded-md cursor-pointer"
              >
                ล้าง
              </button>
            )}
          </div>

          {/* Category Filter Pills */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
            <button
              onClick={() => setSelectedCategoryId(null)}
              className={`px-4 py-2 rounded-xl text-xs font-bold shrink-0 transition cursor-pointer ${
                selectedCategoryId === null
                  ? 'bg-[#8b5537] text-white shadow-xs'
                  : 'bg-[#f7f1e7] text-[#714631] hover:bg-[#ecddc8]'
              }`}
            >
              ทั้งหมด ({products.length})
            </button>
            {categories.map((cat) => {
              const isSelected = selectedCategoryId === cat.id;
              return (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategoryId(cat.id)}
                  className={`px-4 py-2 rounded-xl text-xs font-bold shrink-0 transition cursor-pointer ${
                    isSelected
                      ? 'bg-[#8b5537] text-white shadow-xs'
                      : 'bg-[#f7f1e7] text-[#714631] hover:bg-[#ecddc8]'
                  }`}
                >
                  {cat.name}
                </button>
              );
            })}
          </div>
        </div>

        {/* Product Grid Area */}
        <div className="flex-1 p-4 overflow-y-auto">
          {loading ? (
            <div className="h-full flex items-center justify-center text-stone-400 text-sm">
              กำลังโหลดรายการสินค้า...
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-stone-400 space-y-2">
              <Coffee className="w-12 h-12 text-[#ddc2a3]" />
              <p className="text-sm">ไม่พบสินค้าที่ตรงกับเงื่อนไข</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3.5">
              {filteredProducts.map((p) => (
                <button
                  key={p.id}
                  onClick={() => handleProductClick(p)}
                  className="bg-white rounded-2xl p-4 border border-[#ecddc8] hover:border-[#ba8452] hover:shadow-md transition text-left flex flex-col justify-between group cursor-pointer relative overflow-hidden"
                >
                  <div>
                    {/* Header tag */}
                    <div className="flex items-center justify-between text-[11px] text-[#8b5537] mb-2 font-medium">
                      <span>{p.category_name || 'เครื่องดื่ม'}</span>
                      <span className="font-mono text-stone-400">{p.sku}</span>
                    </div>

                    {/* Drink Name */}
                    <h3 className="font-bold text-sm text-[#321d14] group-hover:text-[#8b5537] transition leading-snug line-clamp-2">
                      {p.name}
                    </h3>

                    {/* Has options indicator */}
                    {!isBakeryProduct(p) && (p.variants.length > 0 || (p.option_groups && p.option_groups.length > 0)) ? (
                      <div className="mt-1.5 flex items-center gap-1 text-[10px] text-[#ba8452] font-semibold">
                        <Sparkles className="w-3 h-3" />
                        <span>ปรับแต่งตัวเลือกได้</span>
                      </div>
                    ) : isBakeryProduct(p) ? (
                      <div className="mt-1.5 text-[10px] text-stone-400 font-medium">
                        คลิกเพื่อเพิ่มลงบิลทันที
                      </div>
                    ) : null}
                  </div>

                  {/* Price Tag & Add Icon */}
                  <div className="mt-4 pt-2.5 border-t border-stone-100 flex items-center justify-between">
                    <span className="font-extrabold text-base text-[#714631]">
                      {formatCurrency(p.base_price)}
                    </span>
                    <span className="w-8 h-8 rounded-xl bg-[#f7f1e7] group-hover:bg-[#8b5537] group-hover:text-white text-[#8b5537] flex items-center justify-center transition">
                      <Plus className="w-4 h-4" />
                    </span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* RIGHT: CART SIDEBAR */}
      <div className="w-96 bg-white flex flex-col shrink-0 border-l border-[#ebdccd] shadow-xs">
        {/* Cart Header */}
        <div className="px-5 py-4 border-b border-[#ebdccd] bg-[#fdfaf6] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-[#8b5537] text-white flex items-center justify-center">
              <ShoppingCart className="w-4 h-4" />
            </div>
            <div>
              <h2 className="font-bold text-sm text-[#321d14]">รายการสั่งซื้อ (Cart)</h2>
              <p className="text-xs text-[#8b5537]">{totalItemCount} รายการในบิล</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleOpenCustomerDisplay}
              title="เปิดจอแสดงผลสำหรับลูกค้า (Second Screen)"
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg border border-[#ecddc8] bg-white hover:bg-[#f7f1e7] text-[#714631] text-xs font-semibold transition cursor-pointer shadow-2xs"
            >
              <Tv className="w-3.5 h-3.5 text-[#ba8452]" />
              <span className="hidden sm:inline">จอแสดงผลลูกค้า</span>
            </button>
            {cartItems.length > 0 && (
              <button
                onClick={clearCart}
                className="text-xs text-red-600 hover:text-red-700 hover:underline cursor-pointer"
              >
                ล้างตะกร้า
              </button>
            )}
          </div>
        </div>

        {/* Cart Items List */}
        <div className="flex-1 p-4 overflow-y-auto space-y-3">
          {cartItems.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-stone-400 space-y-2">
              <ShoppingCart className="w-10 h-10 text-[#ecddc8]" />
              <p className="text-xs font-medium">ยังไม่มีสินค้าในตะกร้า</p>
              <p className="text-[11px] text-stone-400 text-center">คลิกที่เมนูด้านซ้ายเพื่อเพิ่มสินค้า</p>
            </div>
          ) : (
            cartItems.map((item, idx) => (
              <div
                key={item.cartItemId}
                className="bg-[#fdfaf6] rounded-2xl p-3 border border-[#ecddc8] space-y-2 relative"
              >
                <div className="flex justify-between items-start gap-2">
                  <div className="flex-1">
                    <div className="font-bold text-sm text-[#321d14] leading-tight">
                      {item.product.name}
                      {item.variant && (
                        <span className="text-[#8b5537] font-semibold text-xs ml-1">
                          ({item.variant.name})
                        </span>
                      )}
                    </div>
                    {item.selectedOptions.length > 0 && (
                      <div className="text-[11px] text-stone-500 mt-0.5 space-x-1">
                        {item.selectedOptions.map((o) => (
                          <span key={o.id} className="inline-block bg-white px-1.5 py-0.5 rounded border border-stone-200">
                            {o.name}
                          </span>
                        ))}
                      </div>
                    )}
                    {item.note && (
                      <div className="text-[11px] text-amber-700 mt-1 italic font-medium">
                        * {item.note}
                      </div>
                    )}
                  </div>
                  <button
                    onClick={() => removeCartItem(idx)}
                    className="text-stone-300 hover:text-red-500 p-1 cursor-pointer transition"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                <div className="flex items-center justify-between pt-1 border-t border-[#ebdccd]">
                  <div className="flex items-center gap-2 bg-white px-2 py-1 rounded-xl border border-stone-200 shadow-2xs">
                    <button
                      onClick={() => updateQuantity(idx, item.quantity - 1)}
                      className="w-6 h-6 rounded-lg bg-stone-100 hover:bg-stone-200 flex items-center justify-center text-stone-600 cursor-pointer"
                    >
                      <Minus className="w-3 h-3" />
                    </button>
                    <span className="font-bold text-xs w-4 text-center text-stone-800">{item.quantity}</span>
                    <button
                      onClick={() => updateQuantity(idx, item.quantity + 1)}
                      className="w-6 h-6 rounded-lg bg-stone-100 hover:bg-stone-200 flex items-center justify-center text-stone-600 cursor-pointer"
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                  </div>
                  <div className="text-right">
                    <span className="font-extrabold text-sm text-[#714631]">
                      {formatCurrency(item.lineTotal)}
                    </span>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Cart Bottom Summary & Checkout Button */}
        {cartItems.length > 0 && (
          <div className="p-4 bg-[#fdfaf6] border-t border-[#ebdccd] space-y-3 shrink-0">
            {/* Subtotal & Discount rows */}
            <div className="space-y-1.5 text-xs">
              <div className="flex justify-between text-stone-600">
                <span>ยอดรวมสินค้า ({totalItemCount} แก้ว):</span>
                <span>{formatCurrency(subtotal)}</span>
              </div>

              {/* Bill Discount Input */}
              <div className="flex items-center justify-between">
                <span className="text-stone-600">ส่วนลดทั้งบิล:</span>
                <div className="flex items-center gap-1">
                  <span className="text-stone-400">฿</span>
                  <input
                    type="number"
                    min="0"
                    value={billDiscount / 100 || ''}
                    placeholder="0"
                    onChange={(e) => setBillDiscount(Math.round((Number(e.target.value) || 0) * 100))}
                    className="w-20 px-2 py-0.5 rounded border border-stone-300 text-right font-medium text-xs bg-white"
                  />
                </div>
              </div>

              {/* Net Total Display */}
              <div className="pt-2 border-t border-[#ebdccd] flex items-center justify-between text-base font-black text-[#321d14]">
                <span>ยอดสุทธิ (Total):</span>
                <span className="text-xl text-[#714631]">{formatCurrency(netTotal, true)}</span>
              </div>
            </div>

            {/* Large Checkout Button */}
            <button
              onClick={() => setIsCheckoutOpen(true)}
              className="w-full py-3.5 px-4 rounded-2xl bg-[#8b5537] hover:bg-[#714631] text-white font-bold text-base transition shadow-md flex items-center justify-between cursor-pointer"
            >
              <span>รับชำระเงิน</span>
              <span className="text-amber-200">{formatCurrency(netTotal, true)}</span>
            </button>
          </div>
        )}
      </div>

      {/* CUSTOMIZE MODAL */}
      {customizingProduct && (
        <ProductCustomizeModal
          product={customizingProduct}
          onAddToCart={handleAddToCart}
          onClose={() => setCustomizingProduct(null)}
        />
      )}

      {/* CHECKOUT MODAL */}
      {isCheckoutOpen && (
        <CheckoutModal
          items={cartItems}
          subtotal={subtotal}
          billDiscount={billDiscount}
          netTotal={netTotal}
          settings={settings}
          onSuccess={handleCheckoutSuccess}
          onClose={() => setIsCheckoutOpen(false)}
        />
      )}

      {/* RECEIPT PREVIEW / PRINT MODAL */}
      {completedSale && (
        <ReceiptModal
          sale={completedSale}
          settings={settings}
          onClose={() => setCompletedSale(null)}
        />
      )}
    </div>
  );
};

