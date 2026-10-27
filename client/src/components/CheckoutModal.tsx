import React, { useState, useEffect } from 'react';
import { X, Banknote, QrCode, CreditCard, AlertCircle, CheckCircle, Loader2 } from 'lucide-react';
import { CartItem, StoreSettings } from '../types';
import { formatCurrency, apiRequest } from '../api/client';
import { generatePromptPayQRCode } from '../utils/promptpay';
import { broadcastCustomerDisplay } from '../utils/customerDisplaySync';

interface CheckoutModalProps {
  items: CartItem[];
  subtotal: number; // satang
  billDiscount: number; // satang
  netTotal: number; // satang
  settings: StoreSettings;
  onSuccess: (completedSale: any) => void;
  onClose: () => void;
}

export const CheckoutModal: React.FC<CheckoutModalProps> = ({
  items,
  billDiscount,
  netTotal,
  settings,
  onSuccess,
  onClose
}) => {
  const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'QR_PROMPT_PAY' | 'CREDIT_CARD'>('CASH');
  const [receivedAmount, setReceivedAmount] = useState<number>(netTotal);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Real PromptPay QR state
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [qrLoading, setQrLoading] = useState<boolean>(false);

  // Quick tender banknote suggestions for cash
  const quickCashOptions = [
    { label: 'พอดีบิล', value: netTotal },
    { label: '฿100', value: 10000 },
    { label: '฿500', value: 50000 },
    { label: '฿1,000', value: 100000 }
  ].filter((opt) => opt.value >= netTotal || opt.label === 'พอดีบิล');

  const changeAmount = paymentMethod === 'CASH' ? Math.max(0, receivedAmount - netTotal) : 0;
  const isInsufficient = paymentMethod === 'CASH' && receivedAmount < netTotal;

  // Generate Real PromptPay QR Code whenever switching to QR payment
  useEffect(() => {
    if (paymentMethod === 'QR_PROMPT_PAY') {
      const target = settings.promptpay_number || settings.store_phone || '0833146626';
      const amountInBaht = netTotal / 100;
      setQrLoading(true);
      generatePromptPayQRCode(target, amountInBaht)
        .then((url) => {
          setQrDataUrl(url);
          setQrLoading(false);
          // Broadcast to customer second screen
          broadcastCustomerDisplay({
            status: 'PAYMENT_QR',
            qrCodeUrl: url,
            promptpayNumber: target,
            netTotal
          });
        })
        .catch((err) => {
          console.error('Error generating PromptPay QR:', err);
          setQrLoading(false);
        });
    } else {
      // Revert to normal CART display
      broadcastCustomerDisplay({
        status: 'CART',
        qrCodeUrl: undefined
      });
    }
  }, [paymentMethod, netTotal, settings.promptpay_number, settings.store_phone]);

  const handleCheckout = async () => {
    if (isInsufficient) {
      setErrorMessage('จำนวนเงินที่รับไม่เพียงพอกับยอดชำระ');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    // Generate unique idempotency key for this checkout attempt
    const idempotencyKey = `chk-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

    const payload = {
      items: items.map((it) => ({
        productId: it.product.id,
        variantId: it.variant?.id || null,
        optionIds: it.selectedOptions.map((o) => o.id),
        quantity: it.quantity,
        note: it.note
      })),
      paymentMethod,
      receivedAmount: paymentMethod === 'CASH' ? receivedAmount : netTotal,
      billDiscount,
      idempotencyKey
    };

    const res = await apiRequest('/pos/checkout', {
      method: 'POST',
      body: JSON.stringify(payload)
    });

    setIsSubmitting(false);

    if (res.success && res.data) {
      onSuccess(res.data);
    } else {
      setErrorMessage(res.message || 'เกิดข้อผิดพลาดในการบันทึกการชำระเงิน');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl shadow-2xl max-w-lg w-full overflow-hidden border border-[#ecddc8] animate-in fade-in zoom-in-95 duration-150 flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-6 py-4 bg-[#fdfaf6] border-b border-[#ebdccd] flex items-center justify-between shrink-0">
          <div>
            <h2 className="font-bold text-lg text-[#321d14]">ชำระเงิน (Checkout)</h2>
            <p className="text-xs text-[#8b5537]">ยอดชำระสุทธิ {formatCurrency(netTotal, true)}</p>
          </div>
          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="p-1.5 rounded-full hover:bg-stone-200/50 text-stone-500 hover:text-stone-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-6 overflow-y-auto flex-1">
          {/* Error Banner if any */}
          {errorMessage && (
            <div className="p-3.5 bg-red-50 border border-red-200 rounded-2xl flex items-start gap-2.5 text-xs text-red-700 animate-in fade-in duration-100 whitespace-pre-line">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Payment Method Selector */}
          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-wider text-[#714631]">
              เลือกช่องทางการชำระเงิน
            </label>
            <div className="grid grid-cols-3 gap-2.5">
              <button
                type="button"
                onClick={() => setPaymentMethod('CASH')}
                className={`p-3.5 rounded-2xl border-2 flex flex-col items-center justify-center gap-1.5 transition cursor-pointer ${
                  paymentMethod === 'CASH'
                    ? 'border-[#8b5537] bg-[#f7f1e7] text-[#321d14] font-bold shadow-xs'
                    : 'border-stone-200 hover:border-[#ddc2a3] bg-white text-stone-700'
                }`}
              >
                <Banknote className="w-6 h-6 text-[#8b5537]" />
                <span className="text-xs">เงินสด (Cash)</span>
              </button>

              <button
                type="button"
                onClick={() => setPaymentMethod('QR_PROMPT_PAY')}
                className={`p-3.5 rounded-2xl border-2 flex flex-col items-center justify-center gap-1.5 transition cursor-pointer ${
                  paymentMethod === 'QR_PROMPT_PAY'
                    ? 'border-[#8b5537] bg-[#f7f1e7] text-[#321d14] font-bold shadow-xs'
                    : 'border-stone-200 hover:border-[#ddc2a3] bg-white text-stone-700'
                }`}
              >
                <QrCode className="w-6 h-6 text-[#8b5537]" />
                <span className="text-xs">พร้อมเพย์ QR</span>
              </button>

              <button
                type="button"
                onClick={() => setPaymentMethod('CREDIT_CARD')}
                className={`p-3.5 rounded-2xl border-2 flex flex-col items-center justify-center gap-1.5 transition cursor-pointer ${
                  paymentMethod === 'CREDIT_CARD'
                    ? 'border-[#8b5537] bg-[#f7f1e7] text-[#321d14] font-bold shadow-xs'
                    : 'border-stone-200 hover:border-[#ddc2a3] bg-white text-stone-700'
                }`}
              >
                <CreditCard className="w-6 h-6 text-[#8b5537]" />
                <span className="text-xs">บัตร / โอน</span>
              </button>
            </div>
          </div>

          {/* CASH MODE DETAILS */}
          {paymentMethod === 'CASH' && (
            <div className="space-y-4 bg-[#fdfaf6] p-4 rounded-2xl border border-[#ecddc8]">
              {/* Preset Banknotes */}
              <div className="space-y-1.5">
                <span className="text-xs font-semibold text-[#714631]">จำนวนเงินที่รับ:</span>
                <div className="grid grid-cols-4 gap-2">
                  {quickCashOptions.map((opt, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => setReceivedAmount(opt.value)}
                      className={`py-2 px-2 rounded-xl text-xs font-bold border transition cursor-pointer ${
                        receivedAmount === opt.value
                          ? 'bg-[#8b5537] text-white border-[#8b5537]'
                          : 'bg-white hover:bg-stone-50 text-stone-800 border-stone-200'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Manual Input */}
              <div className="space-y-1">
                <div className="relative">
                  <span className="absolute left-3.5 top-2.5 text-stone-400 font-bold text-sm">฿</span>
                  <input
                    type="number"
                    step="any"
                    min="0"
                    value={receivedAmount / 100}
                    onChange={(e) => setReceivedAmount(Math.round((Number(e.target.value) || 0) * 100))}
                    className="w-full pl-8 pr-4 py-2 rounded-xl border border-stone-300 font-bold text-lg text-stone-900 focus:outline-hidden focus:border-[#8b5537]"
                  />
                </div>
              </div>

              {/* Change Calculation Box */}
              <div className="pt-2 border-t border-[#ecddc8] flex items-center justify-between">
                <span className="text-sm font-semibold text-[#5c3b2b]">เงินทอน (Change):</span>
                <span className={`text-xl font-black ${isInsufficient ? 'text-red-500' : 'text-emerald-700'}`}>
                  {isInsufficient ? 'เงินไม่พอ' : formatCurrency(changeAmount, true)}
                </span>
              </div>
            </div>
          )}

          {/* REAL THAI QR PAYMENT (PROMPTPAY) */}
          {paymentMethod === 'QR_PROMPT_PAY' && (
            <div className="bg-[#fdfaf6] p-5 rounded-3xl border border-[#ecddc8] flex flex-col items-center text-center space-y-3">
              {/* Official Thai QR Payment Frame */}
              <div className="bg-white rounded-2xl shadow-md border-2 border-[#102a5c] overflow-hidden w-64 flex flex-col items-center">
                {/* Thai QR Payment Banner Header */}
                <div className="bg-[#102a5c] text-white w-full py-2 px-3 flex items-center justify-center gap-1.5">
                  <span className="text-[12px] font-black tracking-wider uppercase">Thai QR Payment</span>
                </div>
                <div className="bg-[#005a9e] text-white w-full py-0.5 text-[10px] font-semibold tracking-wide">
                  พร้อมเพย์ (PromptPay)
                </div>

                {/* Real Dynamic QR Code */}
                <div className="p-3 bg-white flex items-center justify-center min-h-[200px]">
                  {qrLoading ? (
                    <div className="flex flex-col items-center gap-2 text-stone-400 text-xs py-8">
                      <Loader2 className="w-8 h-8 animate-spin text-[#005a9e]" />
                      <span>กำลังสร้าง Thai QR Code...</span>
                    </div>
                  ) : qrDataUrl ? (
                    <img
                      src={qrDataUrl}
                      alt="PromptPay QR Code"
                      className="w-48 h-48 object-contain"
                    />
                  ) : (
                    <div className="text-xs text-red-500 py-6">
                      ไม่สามารถสร้าง QR Code ได้ โปรดตรวจสอบเบอร์พร้อมเพย์ในการตั้งค่าร้าน
                    </div>
                  )}
                </div>

                {/* Receiver & Amount Footer */}
                <div className="bg-stone-50 border-t border-stone-200 w-full py-2 px-3 space-y-0.5">
                  <div className="text-[11px] font-medium text-stone-600 truncate">
                    {settings.store_name || 'ร้านกาแฟหอมละมุน'}
                  </div>
                  <div className="text-xs font-mono font-bold text-stone-900">
                    {settings.promptpay_number || settings.store_phone || '0833146626'}
                  </div>
                  <div className="text-sm font-black text-[#102a5c] pt-0.5">
                    {formatCurrency(netTotal, true)}
                  </div>
                </div>
              </div>

              <div className="space-y-1">
                <div className="text-xs font-bold text-emerald-800 flex items-center justify-center gap-1">
                  <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
                  QR Code ใช้งานได้จริง รองรับทุกแอปธนาคารไทย
                </div>
                <p className="text-[11px] text-stone-500">
                  (เมื่อลูกค้าสแกนด้วยแอปธนาคาร ยอดเงิน <strong>{(netTotal / 100).toFixed(2)} บาท</strong> จะขึ้นอัตโนมัติ)
                </p>
              </div>
            </div>
          )}

          {/* CREDIT CARD / TRANSFER */}
          {paymentMethod === 'CREDIT_CARD' && (
            <div className="bg-[#fdfaf6] p-4 rounded-2xl border border-[#ecddc8] text-center space-y-2">
              <CreditCard className="w-10 h-10 text-[#ba8452] mx-auto" />
              <div className="font-semibold text-sm text-[#321d14]">เครื่องรูดบัตร EDC / เงินโอน</div>
              <p className="text-xs text-stone-600">
                โปรดดำเนินการทำรายการผ่านเครื่อง EDC ให้เรียบร้อย แล้วกดยืนยันการขาย
              </p>
            </div>
          )}
        </div>

        {/* Action Button */}
        <div className="p-5 bg-white border-t border-[#ebdccd] shrink-0">
          <button
            type="button"
            onClick={handleCheckout}
            disabled={isSubmitting || isInsufficient}
            className={`w-full py-3.5 px-6 rounded-2xl text-white font-bold text-base transition flex items-center justify-center gap-2 cursor-pointer ${
              isSubmitting || isInsufficient
                ? 'bg-stone-300 text-stone-500 cursor-not-allowed'
                : 'bg-emerald-600 hover:bg-emerald-700 shadow-md'
            }`}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                กำลังบันทึกบิลและตัดสต๊อก...
              </>
            ) : (
              <>
                <CheckCircle className="w-5 h-5" />
                ลูกค้ายืนยันชำระเงิน {formatCurrency(netTotal, true)}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
