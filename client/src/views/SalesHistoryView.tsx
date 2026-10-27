import React, { useState, useEffect } from 'react';
import { Search, Receipt, Calendar, Printer, RotateCcw, X, AlertCircle } from 'lucide-react';
import { Sale, StoreSettings } from '../types';
import { apiRequest, formatCurrency, formatThaiDateTime } from '../api/client';
import { ReceiptModal } from '../components/ReceiptModal';
import { ThaiDatePicker } from '../components/ThaiDatePicker';

interface SalesHistoryViewProps {
  settings: StoreSettings;
}

export const SalesHistoryView: React.FC<SalesHistoryViewProps> = ({ settings }) => {
  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [billNoQuery, setBillNoQuery] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  // Modals
  const [selectedReceiptSale, setSelectedReceiptSale] = useState<any | null>(null);
  const [cancellingSale, setCancellingSale] = useState<Sale | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [restockInventory, setRestockInventory] = useState(true);
  const [submittingCancel, setSubmittingCancel] = useState(false);

  useEffect(() => {
    fetchSales();
  }, [startDate, endDate, paymentMethod, statusFilter]);

  const fetchSales = async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (billNoQuery) params.append('bill_no', billNoQuery);
    if (startDate) params.append('start_date', startDate);
    if (endDate) params.append('end_date', endDate);
    if (paymentMethod) params.append('payment_method', paymentMethod);
    if (statusFilter) params.append('status', statusFilter);

    const res = await apiRequest<Sale[]>(`/sales?${params.toString()}`);
    if (res.success && res.data) {
      setSales(res.data);
    }
    setLoading(false);
  };

  const handleOpenReceipt = async (saleId: number) => {
    const res = await apiRequest(`/sales/${saleId}`);
    if (res.success && res.data) {
      setSelectedReceiptSale(res.data);
    }
  };

  const handleOpenCancelDialog = (s: Sale) => {
    setCancellingSale(s);
    setCancelReason('ลูกค้าเปลี่ยนใจ / ชงผิดสูตร');
    setRestockInventory(true);
  };

  const handleConfirmCancel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cancellingSale || !cancelReason.trim()) return;

    setSubmittingCancel(true);
    const res = await apiRequest(`/sales/${cancellingSale.id}/cancel`, {
      method: 'POST',
      body: JSON.stringify({
        reason: cancelReason.trim(),
        restock_inventory: restockInventory
      })
    });
    setSubmittingCancel(false);

    if (res.success) {
      alert(res.message);
      setCancellingSale(null);
      fetchSales();
    } else {
      alert(res.message || 'เกิดข้อผิดพลาดในการยกเลิกบิล');
    }
  };

  return (
    <div className="flex-1 p-6 overflow-y-auto space-y-6 bg-[#fbf9f6]">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-[#321d14]">ประวัติรายการขายและใบเสร็จ (Sales History)</h2>
          <p className="text-xs text-[#8b5537]">ค้นหาบิลย้อนหลัง พิมพ์ใบเสร็จซ้ำ และยกเลิกบิลพร้อมคืนสต๊อก</p>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="bg-white p-4 rounded-3xl border border-[#ecddc8] shadow-2xs space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
          <div className="relative md:col-span-2">
            <Search className="absolute left-3.5 top-2.5 w-4 h-4 text-stone-400" />
            <input
              type="text"
              placeholder="ค้นหาเลขที่บิล เช่น INV-20261026-0001..."
              value={billNoQuery}
              onChange={(e) => setBillNoQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && fetchSales()}
              className="w-full pl-9 pr-4 py-2 rounded-xl border border-stone-200 text-xs text-stone-900 focus:outline-hidden focus:border-[#8b5537]"
            />
          </div>

          <div>
            <ThaiDatePicker
              value={startDate}
              onChange={(val) => setStartDate(val)}
              placeholder="วันที่ขาย (พ.ศ.)"
            />
          </div>

          <div>
            <select
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-stone-200 text-xs text-stone-700"
            >
              <option value="">ทุกวิธีชำระเงิน</option>
              <option value="CASH">เงินสด (Cash)</option>
              <option value="QR_PROMPT_PAY">พร้อมเพย์ QR</option>
              <option value="CREDIT_CARD">บัตรเครดิต</option>
            </select>
          </div>

          <div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-stone-200 text-xs text-stone-700"
            >
              <option value="">ทุกสถานะ</option>
              <option value="COMPLETED">สำเร็จ (COMPLETED)</option>
              <option value="CANCELLED">ยกเลิก/คืนเงิน (CANCELLED)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Sales Table */}
      <div className="bg-white rounded-3xl border border-[#ecddc8] shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-[#fdfaf6] border-b border-[#ebdccd] text-[#714631] font-bold">
                <th className="py-3 px-4">เลขที่บิล</th>
                <th className="py-3 px-4">วันที่ / เวลา</th>
                <th className="py-3 px-4">พนักงานขาย</th>
                <th className="py-3 px-4">วิธีชำระเงิน</th>
                <th className="py-3 px-4 text-right">ยอดรวม</th>
                <th className="py-3 px-4 text-right">ส่วนลด</th>
                <th className="py-3 px-4 text-right">ยอดสุทธิ</th>
                <th className="py-3 px-4 text-center">สถานะ</th>
                <th className="py-3 px-4 text-right">การกระทำ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {loading ? (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-stone-400">กำลังโหลดรายการขาย...</td>
                </tr>
              ) : sales.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-stone-400">ไม่พบบิลการขายตามเงื่อนไข</td>
                </tr>
              ) : (
                sales.map((s) => (
                  <tr key={s.id} className="hover:bg-stone-50 transition">
                    <td className="py-3 px-4 font-mono font-bold text-stone-900">{s.bill_no}</td>
                    <td className="py-3 px-4 text-stone-600">{formatThaiDateTime(s.sale_date)}</td>
                    <td className="py-3 px-4 text-stone-700">{s.cashier_name || 'แคชเชียร์'}</td>
                    <td className="py-3 px-4 font-medium text-stone-700">{s.payment_method}</td>
                    <td className="py-3 px-4 text-right font-medium text-stone-600">
                      {formatCurrency(s.subtotal, true)}
                    </td>
                    <td className="py-3 px-4 text-right text-red-600 font-medium">
                      {s.discount_amount > 0 ? `-${formatCurrency(s.discount_amount, true)}` : '-'}
                    </td>
                    <td className="py-3 px-4 text-right font-extrabold text-[#714631]">
                      {formatCurrency(s.net_total, true)}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          s.status === 'COMPLETED'
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-red-100 text-red-800'
                        }`}
                      >
                        {s.status === 'COMPLETED' ? 'สำเร็จ' : 'ยกเลิก/คืนเงิน'}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right space-x-1.5">
                      <button
                        onClick={() => handleOpenReceipt(s.id)}
                        className="px-2.5 py-1 rounded-lg bg-[#f7f1e7] hover:bg-[#ecddc8] text-[#8b5537] font-semibold text-[11px] transition cursor-pointer"
                      >
                        ดู/พิมพ์บิล
                      </button>
                      {s.status === 'COMPLETED' && (
                        <button
                          onClick={() => handleOpenCancelDialog(s)}
                          className="px-2 py-1 rounded-lg hover:bg-red-50 text-stone-400 hover:text-red-600 text-[11px] font-semibold transition cursor-pointer"
                        >
                          ยกเลิกบิล
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* RECEIPT MODAL */}
      {selectedReceiptSale && (
        <ReceiptModal
          sale={selectedReceiptSale}
          settings={settings}
          onClose={() => setSelectedReceiptSale(null)}
        />
      )}

      {/* CANCEL / REFUND DIALOG */}
      {cancellingSale && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full overflow-hidden border border-[#ecddc8]">
            <div className="px-6 py-4 bg-[#fdfaf6] border-b border-[#ebdccd] flex items-center justify-between">
              <div>
                <h3 className="font-bold text-base text-[#321d14]">
                  ยกเลิกบิลเลขที่ {cancellingSale.bill_no}
                </h3>
                <p className="text-xs text-red-600 font-semibold">ยอดคืนเงิน: {formatCurrency(cancellingSale.net_total, true)}</p>
              </div>
              <button onClick={() => setCancellingSale(null)} className="text-stone-400 hover:text-stone-700">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleConfirmCancel} className="p-6 space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-stone-700">เหตุผลในการยกเลิกหรือคืนเงิน*</label>
                <input
                  type="text"
                  required
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  placeholder="เช่น ลูกค้าขอยกเลิก, ชงผิดสูตร, ลูกค้าไม่รอ"
                  className="w-full px-3 py-2 rounded-xl border border-stone-200 text-xs font-medium"
                />
              </div>

              {/* Restock Checkbox */}
              <label className="flex items-center gap-2.5 p-3 rounded-xl bg-[#fdfaf6] border border-[#ecddc8] cursor-pointer">
                <input
                  type="checkbox"
                  checked={restockInventory}
                  onChange={(e) => setRestockInventory(e.target.checked)}
                  className="w-4 h-4 text-[#8b5537] rounded border-stone-300"
                />
                <span className="text-xs text-stone-800 font-medium">
                  คืนสต๊อกวัตถุดิบกลับเข้าคลัง (Restock Inventory)
                </span>
              </label>

              <div className="pt-3 flex justify-end gap-2 border-t border-stone-100">
                <button
                  type="button"
                  onClick={() => setCancellingSale(null)}
                  className="px-4 py-2 rounded-xl border border-stone-200 text-xs font-semibold text-stone-600 hover:bg-stone-50"
                >
                  ไม่ยกเลิก
                </button>
                <button
                  type="submit"
                  disabled={submittingCancel}
                  className="px-5 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-bold transition shadow-xs cursor-pointer"
                >
                  {submittingCancel ? 'กำลังประมวลผล...' : 'ยืนยันการยกเลิกบิล'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
