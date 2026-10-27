import React, { useState } from 'react';
import { X, Printer, Check, AlertCircle, Loader2, Play, Settings as SettingsIcon } from 'lucide-react';
import { formatCurrency, formatThaiDateTime, apiRequest } from '../api/client';
import { StoreSettings } from '../types';

interface ReceiptModalProps {
  sale: any;
  settings: StoreSettings;
  onClose: () => void;
}

export const ReceiptModal: React.FC<ReceiptModalProps> = ({ sale, settings, onClose }) => {
  const [paperWidth, setPaperWidth] = useState<'58mm' | '80mm'>((settings.printer_paper_width as any) || '80mm');
  const [isDirectPrinting, setIsDirectPrinting] = useState(false);
  const [printFeedback, setPrintFeedback] = useState<{ success: boolean; message: string } | null>(null);

  // Direct print (without browser popup)
  const handleDirectPrint = async () => {
    setIsDirectPrinting(true);
    setPrintFeedback(null);

    const saleId = sale.id || sale.saleId;
    const target =
      settings.printer_type === 'NETWORK'
        ? settings.printer_ip
        : settings.printer_name || 'Microsoft Print to PDF';

    try {
      const res = await apiRequest('/pos/print-receipt', {
        method: 'POST',
        body: JSON.stringify({
          saleId,
          printerType: settings.printer_type || 'WINDOWS',
          target,
          paperWidth,
          cutPaper: settings.printer_auto_cut !== '0',
          openDrawer: settings.printer_open_drawer === '1'
        })
      });

      if (res.success) {
        setPrintFeedback({
          success: true,
          message: res.message || 'ส่งคำสั่งพิมพ์ตรงไปยังเครื่องพิมพ์สลิปเรียบร้อยแล้ว'
        });
      } else {
        setPrintFeedback({
          success: false,
          message: res.message || 'ไม่สามารถพิมพ์ตรงได้ กรุณาตรวจสอบการเชื่อมต่อเครื่องพิมพ์'
        });
      }
    } catch (err: any) {
      setPrintFeedback({
        success: false,
        message: err.message || 'เกิดข้อผิดพลาดในการส่งคำสั่งพิมพ์'
      });
    } finally {
      setIsDirectPrinting(false);
    }
  };

  // Fallback to browser print dialog
  const handleBrowserPrint = () => {
    window.print();
  };

  const paymentMethodLabel = (method?: string) => {
    switch (method) {
      case 'CASH':
        return 'เงินสด (Cash)';
      case 'QR_PROMPT_PAY':
        return 'พร้อมเพย์ QR Code';
      case 'CREDIT_CARD':
        return 'บัตรเครดิต/เดบิต';
      case 'TRANSFER':
        return 'โอนเงินผ่านธนาคาร';
      default:
        return method || 'เงินสด';
    }
  };

  const configuredPrinterName =
    settings.printer_type === 'NETWORK'
      ? `Network IP: ${settings.printer_ip || '9100'}`
      : settings.printer_name || 'เครื่องพิมพ์ Windows เริ่มต้น';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl shadow-2xl max-w-lg w-full overflow-hidden border border-[#ecddc8] animate-in fade-in zoom-in-95 duration-150 flex flex-col max-h-[92vh]">
        {/* Header Action Bar */}
        <div className="flex items-center justify-between px-6 py-4 bg-[#fdfaf6] border-b border-[#ebdccd] shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#8b5537] text-white flex items-center justify-center">
              <Printer className="w-4 h-4" />
            </div>
            <div>
              <span className="font-bold text-sm text-[#321d14]">ใบเสร็จรับเงิน (Receipt)</span>
              <div className="text-[11px] text-[#8b5537] flex items-center gap-1">
                <span>พิมพ์ตรง: {configuredPrinterName}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 bg-[#f7f1e7] p-1 rounded-xl text-xs font-semibold">
              <button
                type="button"
                onClick={() => setPaperWidth('58mm')}
                className={`px-2.5 py-1 rounded-lg transition cursor-pointer ${
                  paperWidth === '58mm' ? 'bg-[#8b5537] text-white shadow-xs' : 'text-[#714631]'
                }`}
              >
                58 มม.
              </button>
              <button
                type="button"
                onClick={() => setPaperWidth('80mm')}
                className={`px-2.5 py-1 rounded-lg transition cursor-pointer ${
                  paperWidth === '80mm' ? 'bg-[#8b5537] text-white shadow-xs' : 'text-[#714631]'
                }`}
              >
                80 มม.
              </button>
            </div>

            <button
              onClick={onClose}
              className="p-1.5 rounded-full text-stone-400 hover:text-stone-700 hover:bg-stone-100 transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Feedback Alert Banner */}
        {printFeedback && (
          <div
            className={`px-6 py-3 text-xs flex items-center gap-2 border-b animate-in fade-in ${
              printFeedback.success
                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                : 'bg-red-50 text-red-800 border-red-200'
            }`}
          >
            {printFeedback.success ? (
              <Check className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
            )}
            <span className="font-semibold">{printFeedback.message}</span>
          </div>
        )}

        {/* Printable Area */}
        <div className="p-6 bg-stone-100 flex-1 overflow-y-auto flex justify-center items-start">
          <div
            id="printable-receipt"
            className={`bg-white p-5 shadow-md border border-dashed border-stone-300 font-mono text-[13px] leading-relaxed text-stone-900 transition-all ${
              paperWidth === '58mm' ? 'w-[280px]' : 'w-[360px]'
            }`}
          >
            {/* Store Header */}
            <div className="text-center pb-3 border-b border-dashed border-stone-300 space-y-0.5">
              <div className="font-bold text-base tracking-tight font-sans text-stone-950">
                {settings.store_name || 'ร้านกาแฟหอมละมุน'}
              </div>
              {settings.store_address && (
                <div className="text-[11px] text-stone-600 leading-snug px-2 font-sans">
                  {settings.store_address}
                </div>
              )}
              {settings.store_phone && (
                <div className="text-[11px] text-stone-600">โทร: {settings.store_phone}</div>
              )}
              {settings.tax_id && (
                <div className="text-[11px] text-stone-500">เลขประจำตัวผู้เสียภาษี: {settings.tax_id}</div>
              )}
              <div className="text-[12px] font-semibold pt-1 uppercase tracking-wider text-stone-800 font-sans">
                ใบเสร็จรับเงิน / ใบกำกับภาษีอย่างย่อ
              </div>
            </div>

            {/* Bill Details */}
            <div className="py-2.5 border-b border-dashed border-stone-300 text-xs space-y-1">
              <div className="flex justify-between">
                <span className="text-stone-500">เลขที่บิล:</span>
                <span className="font-bold text-stone-900">{sale.bill_no}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-stone-500">วันที่:</span>
                <span>{formatThaiDateTime(sale.sale_date)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-stone-500">พนักงานขาย:</span>
                <span>{sale.cashierName || sale.cashier_name || 'พนักงานขาย'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-stone-500">ช่องทางชำระ:</span>
                <span className="font-medium">{paymentMethodLabel(sale.payment_method)}</span>
              </div>
            </div>

            {/* Itemized List */}
            <div className="py-3 border-b border-dashed border-stone-300 space-y-2">
              <div className="flex justify-between text-xs font-bold text-stone-700 pb-1 border-b border-stone-200">
                <span>รายการ</span>
                <span>จำนวน x ราคา</span>
                <span>รวม</span>
              </div>
              {sale.items?.map((it: any, idx: number) => {
                const name = it.product_name || it.productName;
                const variant = it.variant_name || it.variantName;
                const qty = it.quantity;
                const unitPrice = it.unit_price || it.unitPrice;
                const total = it.net_total || it.netTotal;

                return (
                  <div key={idx} className="space-y-0.5">
                    <div className="flex justify-between items-start">
                      <div className="font-medium text-stone-900 flex-1 pr-2">
                        {name} {variant && <span className="text-stone-600 font-normal">({variant})</span>}
                      </div>
                      <div className="text-stone-600 text-right shrink-0">
                        {qty} x {(unitPrice / 100).toFixed(2)}
                      </div>
                      <div className="font-semibold text-stone-900 text-right w-16 shrink-0">
                        {(total / 100).toFixed(2)}
                      </div>
                    </div>

                    {/* Options list if any */}
                    {it.options && it.options.length > 0 && (
                      <div className="pl-2 space-y-0.5 text-[11px] text-stone-500">
                        {it.options.map((opt: any, optIdx: number) => (
                          <div key={optIdx} className="flex justify-between">
                            <span>+ {opt.option_name || opt.name}</span>
                            {opt.price_adjustment > 0 && (
                              <span>+{(opt.price_adjustment / 100).toFixed(2)}</span>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Calculations & Totals */}
            <div className="py-2.5 border-b border-dashed border-stone-300 space-y-1 text-xs">
              <div className="flex justify-between">
                <span className="text-stone-600">ยอดรวมสินค้า:</span>
                <span>{formatCurrency(sale.subtotal, true)}</span>
              </div>
              {sale.discountAmount > 0 || sale.discount_amount > 0 ? (
                <div className="flex justify-between text-red-600">
                  <span>ส่วนลด:</span>
                  <span>-{formatCurrency(sale.discountAmount || sale.discount_amount, true)}</span>
                </div>
              ) : null}
              <div className="flex justify-between text-base font-bold text-stone-950 pt-1 border-t border-stone-200">
                <span>ยอดสุทธิ (Net Total):</span>
                <span>{formatCurrency(sale.net_total || sale.netTotal, true)}</span>
              </div>
            </div>

            {/* Payment & Change */}
            <div className="py-2.5 border-b border-dashed border-stone-300 space-y-1 text-xs">
              <div className="flex justify-between">
                <span className="text-stone-600">รับเงินมา:</span>
                <span>{formatCurrency(sale.received_amount || sale.receivedAmount, true)}</span>
              </div>
              <div className="flex justify-between font-semibold">
                <span className="text-stone-600">เงินทอน:</span>
                <span className="text-emerald-700">{formatCurrency(sale.change_amount || sale.changeAmount, true)}</span>
              </div>
            </div>

            {/* Footer Note */}
            <div className="pt-4 text-center text-xs text-stone-600 whitespace-pre-line leading-relaxed font-sans">
              {settings.receipt_footer || 'ขอบคุณที่ใช้บริการ โอกาสหน้าเชิญใหม่ค่ะ\nThank you for visiting!'}
            </div>
          </div>
        </div>

        {/* Action Buttons Bar */}
        <div className="p-4 bg-white border-t border-[#ebdccd] flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
          <button
            type="button"
            onClick={handleBrowserPrint}
            className="text-stone-500 hover:text-stone-800 text-xs font-semibold underline cursor-pointer"
          >
            พิมพ์ผ่านหน้าต่างเบราว์เซอร์ (Browser Print)
          </button>

          <div className="flex items-center gap-2.5 w-full sm:w-auto">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-stone-200 text-stone-700 hover:bg-stone-50 font-medium text-xs transition cursor-pointer"
            >
              ปิด
            </button>

            {/* Main Primary Action: DIRECT PRINT */}
            <button
              onClick={handleDirectPrint}
              disabled={isDirectPrinting}
              className="flex-1 sm:flex-initial px-5 py-2.5 rounded-xl bg-[#8b5537] hover:bg-[#714631] text-white font-bold text-xs transition shadow-md flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
            >
              {isDirectPrinting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>กำลังสั่งพิมพ์ตรง...</span>
                </>
              ) : (
                <>
                  <Printer className="w-4 h-4" />
                  <span>พิมพ์ตรงไปยังเครื่องพิมพ์สลิป (Direct Print)</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
