import React, { useState, useEffect, useRef } from 'react';
import {
  Coffee,
  CheckCircle,
  QrCode,
  Clock,
  Sparkles,
  Maximize2,
  Minimize2,
  Receipt,
  Heart,
  ChevronLeft,
  ChevronRight,
  Tag
} from 'lucide-react';
import {
  CustomerDisplayState,
  subscribeCustomerDisplay,
  getCustomerDisplayState
} from '../utils/customerDisplaySync';
import { formatCurrency, apiRequest } from '../api/client';
import { PromotionSlide, StoreSettings } from '../types';
import { DEFAULT_PROMOTION_SLIDES, getActiveSlides } from '../utils/slides';

export const CustomerDisplayView: React.FC = () => {
  const [state, setState] = useState<CustomerDisplayState>(getCustomerDisplayState());
  const [currentTime, setCurrentTime] = useState('');
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Settings & Slideshow
  const [settings, setSettings] = useState<StoreSettings>({});
  const [slides, setSlides] = useState<PromotionSlide[]>(DEFAULT_PROMOTION_SLIDES);
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);
  const [slideIntervalSec, setSlideIntervalSec] = useState(5);
  const [isPaused, setIsPaused] = useState(false);

  // Subscribe to cashier state changes
  useEffect(() => {
    const unsubscribe = subscribeCustomerDisplay((nextState) => {
      setState(nextState);
    });

    // Fetch store settings for promotion slides
    fetchSettings();

    // Clock ticker in Thai Buddhist Era (พ.ศ.)
    const updateTime = () => {
      const now = new Date();
      setCurrentTime(
        now.toLocaleDateString('th-TH-u-ca-buddhist', {
          weekday: 'long',
          day: 'numeric',
          month: 'short',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit'
        })
      );
    };
    updateTime();
    const clockTimer = setInterval(updateTime, 1000);

    return () => {
      unsubscribe();
      clearInterval(clockTimer);
    };
  }, []);

  const fetchSettings = async () => {
    const res = await apiRequest<StoreSettings>('/settings');
    if (res.success && res.data) {
      setSettings(res.data);
      const activeList = getActiveSlides(res.data.promotion_slides);
      setSlides(activeList);
      if (res.data.slide_interval) {
        setSlideIntervalSec(parseInt(res.data.slide_interval, 10) || 5);
      }
    }
  };

  // Slideshow auto-advance timer
  useEffect(() => {
    if (slides.length <= 1 || isPaused) return;

    const timer = setInterval(() => {
      setCurrentSlideIndex((prev) => (prev + 1) % slides.length);
    }, slideIntervalSec * 1000);

    return () => clearInterval(timer);
  }, [slides, slideIntervalSec, isPaused]);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
        setIsFullscreen(false);
      }
    }
  };

  const handleNextSlide = () => {
    setCurrentSlideIndex((prev) => (prev + 1) % slides.length);
  };

  const handlePrevSlide = () => {
    setCurrentSlideIndex((prev) => (prev - 1 + slides.length) % slides.length);
  };

  const hasItems = state.items && state.items.length > 0;
  const isQrMode = state.status === 'PAYMENT_QR' && !!state.qrCodeUrl;
  const isCompleted = state.status === 'COMPLETED';

  // Active current promotional slide
  const currentSlide = slides[currentSlideIndex] || slides[0] || DEFAULT_PROMOTION_SLIDES[0];

  return (
    <div className="h-screen w-screen bg-[#1e1e1e] text-[#2c1e18] flex flex-col font-sans select-none overflow-hidden">
      {/* Top Header Bar */}
      <header className="bg-white/95 backdrop-blur-md border-b border-[#ebdccd] px-6 py-2.5 flex items-center justify-between shrink-0 shadow-2xs">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#8b5537] to-[#5c3b2b] flex items-center justify-center text-white shadow-xs">
            <Coffee className="w-5 h-5" />
          </div>
          <div>
            <h1 className="font-black text-lg text-[#321d14] tracking-tight leading-none">
              {state.storeName || settings.store_name || 'ร้านกาแฟหอมละมุน'}
            </h1>
            <p className="text-[11px] text-[#8b5537] font-semibold flex items-center gap-1.5 mt-0.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
              ยินดีให้บริการ (Customer Second Screen)
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-2 bg-[#fdfaf6] px-3.5 py-1.5 rounded-full border border-[#ecddc8] text-[#714631] text-xs font-semibold">
            <Clock className="w-3.5 h-3.5 text-[#ba8452]" />
            <span>{currentTime}</span>
          </div>

          <button
            onClick={toggleFullscreen}
            className="p-2 rounded-xl border border-[#ecddc8] bg-white hover:bg-[#f7f1e7] text-stone-600 transition cursor-pointer"
            title="เปิด/ปิดเต็มจอ"
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
        </div>
      </header>

      {/* Main Split Screen Area (Styled exactly like customer display POS hardware) */}
      <main className="flex-1 p-4 md:p-6 flex flex-col md:flex-row gap-5 overflow-hidden bg-stone-900">
        {/* ======================================================== */}
        {/* LEFT PANEL: RECEIPT & ORDER SUMMARY (Approx 40-42% Width) */}
        {/* ======================================================== */}
        <div className="w-full md:w-[42%] lg:w-[40%] bg-white rounded-3xl shadow-2xl flex flex-col overflow-hidden border border-stone-200">
          {/* Receipt Top Header */}
          <div className="px-5 py-3.5 border-b border-stone-200 bg-[#fdfaf6] flex items-center justify-between shrink-0">
            <div>
              <h2 className="font-black text-base text-stone-900 tracking-tight">Your Order</h2>
              <span className="text-[11px] text-stone-500">รายการสั่งซื้อของคุณ</span>
            </div>
            <div className="text-right">
              <span className="font-mono text-xs font-bold text-[#8b5537]">
                {state.billNo ? state.billNo : `No. ${new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }).replace(':', '')}`}
              </span>
              <div className="text-[10px] text-stone-400">
                {state.items ? state.items.reduce((acc, i) => acc + i.quantity, 0) : 0} รายการ
              </div>
            </div>
          </div>

          {/* Receipt Items Scroll Area */}
          <div className="flex-1 p-4 overflow-y-auto space-y-3 font-mono text-xs text-stone-800">
            {!hasItems ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-6 text-stone-400 space-y-3">
                <div className="w-16 h-16 rounded-full bg-[#fdfaf6] flex items-center justify-center text-[#ba8452]">
                  <Receipt className="w-8 h-8 opacity-60" />
                </div>
                <div className="space-y-1">
                  <p className="font-bold text-sm text-stone-600">กำลังรอรับออเดอร์...</p>
                  <p className="text-xs text-stone-400">รายการสั่งซื้อจะปรากฏที่นี่เมื่อพนักงานคีย์สินค้า</p>
                </div>
                <div className="text-[11px] text-[#8b5537] bg-[#fdfaf6] px-3 py-1.5 rounded-full border border-[#ecddc8]">
                  สั่งเครื่องดื่มหรือขนมที่คุณชื่นชอบได้เลยค่ะ
                </div>
              </div>
            ) : (
              <div className="space-y-2.5 divide-y divide-stone-100">
                {state.items.map((item) => (
                  <div key={item.id} className="pt-2 first:pt-0">
                    {/* Top Row: Qty + Name + Line Total */}
                    <div className="flex items-start justify-between font-bold text-sm text-stone-900 leading-tight">
                      <div className="flex items-start gap-2 flex-1 pr-2">
                        <span className="text-[#8b5537] font-black">{item.quantity}×</span>
                        <span>{item.name}</span>
                      </div>
                      <div className="text-right font-black shrink-0">
                        {formatCurrency(item.lineTotal, true)}
                      </div>
                    </div>

                    {/* Indented Customizations & Notes (Just like POS receipt) */}
                    {(item.variantName || item.optionsText) && (
                      <div className="pl-6 pt-0.5 space-y-0.5 text-xs text-stone-500 font-sans">
                        {item.variantName && (
                          <div className="text-[#8b5537] font-medium">• {item.variantName}</div>
                        )}
                        {item.optionsText && (
                          <div className="text-stone-500">• {item.optionsText}</div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Receipt Bottom Summary Box (Styled after reference image) */}
          <div className="p-4 bg-[#f8f6f3] border-t border-stone-200 shrink-0 space-y-2">
            <div className="flex justify-between items-center text-xs text-stone-600">
              <span>Total Sales (ยอดรวมสินค้า)</span>
              <span className="font-semibold text-stone-800">{formatCurrency(state.subtotal, true)}</span>
            </div>

            {state.discountAmount > 0 && (
              <div className="flex justify-between items-center text-xs text-emerald-600 font-semibold">
                <span>Total Discount (ส่วนลด)</span>
                <span>-{formatCurrency(state.discountAmount, true)}</span>
              </div>
            )}

            <div className="pt-2 border-t border-stone-300/80 flex justify-between items-baseline">
              <span className="font-black text-sm text-stone-900 uppercase tracking-tight">
                Total Net (ยอดชำระสุทธิ)
              </span>
              <span className="font-black text-3xl text-[#5c3b2b] tracking-tight">
                {formatCurrency(state.netTotal, true)}
              </span>
            </div>
          </div>
        </div>

        {/* ======================================================== */}
        {/* RIGHT PANEL: PROMOTION SLIDESHOW OR QR PAYMENT (Approx 58-60% Width) */}
        {/* ======================================================== */}
        <div className="flex-1 bg-black rounded-3xl shadow-2xl relative overflow-hidden flex flex-col border border-stone-800">
          {/* PAYMENT QR OVERLAY: Appears when QR payment is triggered */}
          {isQrMode ? (
            <div className="absolute inset-0 bg-[#fdfaf6] z-20 flex flex-col items-center justify-center p-6 text-center animate-in zoom-in-95 duration-200">
              <div className="max-w-md w-full bg-white rounded-3xl border-2 border-[#8b5537] p-6 shadow-2xl space-y-4">
                <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#8b5537] text-white text-xs font-bold tracking-wide">
                  <QrCode className="w-4 h-4" />
                  <span>THAI QR PAYMENT (PROMPTPAY)</span>
                </div>

                <div className="space-y-0.5">
                  <div className="text-xs font-semibold text-stone-500 uppercase tracking-wider">
                    ยอดชำระที่ต้องสแกน
                  </div>
                  <div className="text-4xl font-black text-[#5c3b2b] tracking-tight">
                    {formatCurrency(state.netTotal, true)}
                  </div>
                </div>

                {/* QR Code Container */}
                <div className="w-60 h-60 mx-auto p-3 bg-white rounded-2xl border-2 border-stone-800 shadow-md flex items-center justify-center">
                  <img
                    src={state.qrCodeUrl}
                    alt="PromptPay QR Code"
                    className="w-full h-full object-contain rounded-lg"
                  />
                </div>

                <div className="space-y-1">
                  <div className="text-xs font-bold text-stone-800">
                    พร้อมเพย์: {state.promptpayNumber || settings.promptpay_number || 'ร้านกาแฟหอมละมุน'}
                  </div>
                  <p className="text-[11px] text-stone-500">
                    เปิดแอป Mobile Banking ของทุกธนาคาร แล้วสแกนเพื่อชำระเงิน
                  </p>
                </div>
              </div>
            </div>
          ) : isCompleted ? (
            /* COMPLETED CELEBRATION OVERLAY */
            <div className="absolute inset-0 bg-[#fdfaf6] z-20 flex flex-col items-center justify-center p-8 text-center animate-in zoom-in-95 duration-200 space-y-4">
              <div className="w-20 h-20 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center shadow-inner mx-auto">
                <CheckCircle className="w-12 h-12" />
              </div>

              <div className="space-y-1">
                <h3 className="text-3xl font-black text-stone-900">ชำระเงินเรียบร้อยแล้ว</h3>
                <p className="text-sm text-stone-600">ขอบพระคุณที่มาอุดหนุน ขอให้มีความสุขกับเครื่องดื่มของคุณค่ะ</p>
                {state.billNo && (
                  <div className="inline-block mt-1 px-3 py-1 rounded-full bg-stone-100 text-stone-700 font-mono text-xs font-bold">
                    เลขที่บิล: {state.billNo}
                  </div>
                )}
              </div>

              <div className="w-full max-w-sm bg-white border border-[#ebdccd] rounded-2xl p-4 space-y-2 text-xs">
                <div className="flex justify-between text-stone-600">
                  <span>ยอดสุทธิ</span>
                  <span className="font-bold text-stone-900">{formatCurrency(state.netTotal, true)}</span>
                </div>
                {state.receivedAmount !== undefined && (
                  <div className="flex justify-between text-stone-600">
                    <span>รับเงินมา</span>
                    <span className="font-semibold text-stone-900">{formatCurrency(state.receivedAmount, true)}</span>
                  </div>
                )}
                {state.changeAmount !== undefined && state.changeAmount > 0 && (
                  <div className="flex justify-between text-emerald-700 font-bold border-t border-stone-100 pt-2 text-sm">
                    <span>เงินทอน</span>
                    <span className="text-lg">{formatCurrency(state.changeAmount, true)}</span>
                  </div>
                )}
              </div>

              <div className="flex items-center gap-1.5 text-stone-400 text-xs pt-2">
                <Heart className="w-4 h-4 text-red-400 fill-current" />
                <span>Thank you! Have a wonderful day</span>
              </div>
            </div>
          ) : (
            /* ======================================================== */
            /* PROMOTIONAL SLIDESHOW (Matches uploaded reference photo) */
            /* ======================================================== */
            <div
              className="relative w-full h-full flex flex-col justify-between overflow-hidden group"
              onMouseEnter={() => setIsPaused(true)}
              onMouseLeave={() => setIsPaused(false)}
            >
              {/* Background Slide Image */}
              <div className="absolute inset-0 z-0">
                <img
                  key={currentSlide.id || currentSlideIndex}
                  src={currentSlide.image_url}
                  alt={currentSlide.title || 'Promotion'}
                  className="w-full h-full object-cover transition-all duration-700 ease-out transform scale-100 group-hover:scale-105"
                />
                {/* Subtle vignette gradient overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-black/50" />
              </div>

              {/* TOP BANNER RIBBON (e.g. "Today's Menu" brush/ribbon banner) */}
              <div className="relative z-10 p-6 flex items-start justify-between">
                <div className="bg-white/95 backdrop-blur-md px-6 py-2.5 rounded-2xl shadow-xl border border-white/40 transform -rotate-1 transition">
                  <h3 className="font-black text-2xl md:text-3xl text-stone-900 tracking-tight italic font-serif">
                    {currentSlide.title || "Today's Menu"}
                  </h3>
                </div>

                {/* CIRCULAR / PROMINENT BADGE (e.g. 40% OFF badge like in reference) */}
                {currentSlide.badge && (
                  <div className="w-20 h-20 md:w-24 md:h-24 rounded-full bg-gradient-to-tr from-amber-500 to-yellow-400 text-stone-950 font-black flex flex-col items-center justify-center text-center shadow-2xl border-4 border-white/80 animate-pulse transform rotate-6">
                    <span className="text-sm md:text-base leading-none font-black">
                      {currentSlide.badge}
                    </span>
                  </div>
                )}
              </div>

              {/* BOTTOM PROMO SUBTITLE BANNER (e.g. "LIMITED TIME ONLY!") */}
              <div className="relative z-10 p-6 space-y-3">
                <div className="bg-white/95 backdrop-blur-md px-5 py-3 rounded-2xl shadow-xl border border-white/40 max-w-lg">
                  <div className="text-xs md:text-sm font-black tracking-widest uppercase text-stone-900">
                    {currentSlide.subtitle || 'LIMITED TIME ONLY!'}
                  </div>
                </div>

                {/* Slideshow Indicator Dots / Navigation */}
                {slides.length > 1 && (
                  <div className="flex items-center justify-between pt-1">
                    <div className="flex items-center gap-2">
                      {slides.map((_, idx) => (
                        <button
                          key={idx}
                          onClick={() => setCurrentSlideIndex(idx)}
                          className={`h-2 rounded-full transition-all cursor-pointer ${
                            idx === currentSlideIndex
                              ? 'w-8 bg-amber-400 shadow-md'
                              : 'w-2 bg-white/50 hover:bg-white'
                          }`}
                          title={`สไลด์ #${idx + 1}`}
                        />
                      ))}
                    </div>

                    {/* Manual Next / Prev arrows on hover */}
                    <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition">
                      <button
                        onClick={handlePrevSlide}
                        className="p-1.5 rounded-xl bg-black/50 hover:bg-black/80 text-white text-xs transition cursor-pointer"
                        title="ก่อนหน้า"
                      >
                        <ChevronLeft className="w-4 h-4" />
                      </button>
                      <button
                        onClick={handleNextSlide}
                        className="p-1.5 rounded-xl bg-black/50 hover:bg-black/80 text-white text-xs transition cursor-pointer"
                        title="ถัดไป"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Ultra Thin Bottom Brand Bar */}
      <footer className="bg-stone-950 text-stone-500 px-6 py-1.5 text-[10px] flex items-center justify-between shrink-0 border-t border-stone-800">
        <div>{state.storeName || settings.store_name || 'Coffee POS'} • Dual Display Customer Screen</div>
        <div className="flex items-center gap-1">
          <Sparkles className="w-3 h-3 text-amber-500" />
          <span>Fresh Coffee & Bakery</span>
        </div>
      </footer>
    </div>
  );
};
