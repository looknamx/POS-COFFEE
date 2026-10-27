import React, { useState, useEffect } from 'react';
import { Wallet, Plus, Trash2, Calendar, X } from 'lucide-react';
import { Expense } from '../types';
import { apiRequest, formatCurrency, formatThaiDate } from '../api/client';
import { ThaiDatePicker } from '../components/ThaiDatePicker';

export const ExpensesView: React.FC = () => {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [categories, setCategories] = useState<{ id: number; name: string }[]>([]);
  const [totalAmount, setTotalAmount] = useState<number>(0);
  const [loading, setLoading] = useState(true);

  // Filters
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedCat, setSelectedCat] = useState('');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState<number>(0);
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [expenseDate, setExpenseDate] = useState(new Date().toISOString().slice(0, 10));
  const [paymentMethod, setPaymentMethod] = useState('CASH');
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchExpenses();
  }, [startDate, endDate, selectedCat]);

  const fetchExpenses = async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (startDate) params.append('start_date', startDate);
    if (endDate) params.append('end_date', endDate);
    if (selectedCat) params.append('category_id', selectedCat);

    const [eRes, cRes] = await Promise.all([
      apiRequest<Expense[]>(`/expenses?${params.toString()}`),
      apiRequest<{ id: number; name: string }[]>('/expenses/categories')
    ]);

    if (eRes.success && eRes.data) {
      setExpenses(eRes.data);
      setTotalAmount(eRes.totalAmount || 0);
    }
    if (cRes.success && cRes.data) {
      setCategories(cRes.data);
    }
    setLoading(false);
  };

  const handleOpenAdd = () => {
    setTitle('');
    setAmount(0);
    setCategoryId(categories[0]?.id || null);
    setExpenseDate(new Date().toISOString().slice(0, 10));
    setPaymentMethod('CASH');
    setNote('');
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || amount <= 0) return;

    setSubmitting(true);
    const res = await apiRequest('/expenses', {
      method: 'POST',
      body: JSON.stringify({
        title: title.trim(),
        amount: Math.round(amount * 100), // convert THB to satang
        category_id: categoryId,
        expense_date: expenseDate,
        payment_method: paymentMethod,
        note
      })
    });
    setSubmitting(false);

    if (res.success) {
      setIsModalOpen(false);
      fetchExpenses();
    } else {
      alert(res.message || 'เกิดข้อผิดพลาด');
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('คุณต้องการลบรายการค่าใช้จ่ายนี้ใช่หรือไม่?')) return;
    const res = await apiRequest(`/expenses/${id}`, { method: 'DELETE' });
    if (res.success) {
      fetchExpenses();
    }
  };

  return (
    <div className="flex-1 p-6 overflow-y-auto space-y-6 bg-[#fbf9f6]">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-[#321d14]">บันทึกค่าใช้จ่ายร้าน (Operating Expenses)</h2>
          <p className="text-xs text-[#8b5537]">ค่าเช่า ค่าไฟ ค่าน้ำ ค่าแรง และวัสดุสิ้นเปลือง (แยกจากต้นทุนวัตถุดิบ)</p>
        </div>
        <button
          onClick={handleOpenAdd}
          className="px-4 py-2.5 rounded-xl bg-[#8b5537] hover:bg-[#714631] text-white font-semibold text-xs transition shadow-xs flex items-center gap-1.5 cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          บันทึกค่าใช้จ่าย
        </button>
      </div>

      {/* Summary Banner */}
      <div className="bg-white p-5 rounded-3xl border border-[#ecddc8] flex items-center justify-between shadow-2xs">
        <div>
          <div className="text-xs text-stone-500 font-medium">ยอดรวมค่าใช้จ่ายในช่วงเวลาที่เลือก</div>
          <div className="text-2xl font-black text-[#714631] mt-1">{formatCurrency(totalAmount, true)}</div>
        </div>
        <div className="flex items-center gap-2">
          <ThaiDatePicker
            value={startDate}
            onChange={(val) => setStartDate(val)}
            placeholder="ตั้งแต่วันที่ (พ.ศ.)"
            className="w-40"
          />
          <span className="text-stone-400 text-xs">ถึง</span>
          <ThaiDatePicker
            value={endDate}
            onChange={(val) => setEndDate(val)}
            placeholder="ถึงวันที่ (พ.ศ.)"
            className="w-40"
          />
          <select
            value={selectedCat}
            onChange={(e) => setSelectedCat(e.target.value)}
            className="px-3 py-1.5 rounded-xl border border-stone-200 text-xs text-stone-700"
          >
            <option value="">ทุกหมวดหมู่</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Expenses Table */}
      <div className="bg-white rounded-3xl border border-[#ecddc8] shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-[#fdfaf6] border-b border-[#ebdccd] text-[#714631] font-bold">
                <th className="py-3 px-4">วันที่</th>
                <th className="py-3 px-4">หมวดหมู่</th>
                <th className="py-3 px-4">รายการ</th>
                <th className="py-3 px-4">วิธีชำระ</th>
                <th className="py-3 px-4 text-right">จำนวนเงิน</th>
                <th className="py-3 px-4">ผู้บันทึก</th>
                <th className="py-3 px-4 text-right">การกระทำ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-stone-400">กำลังโหลด...</td>
                </tr>
              ) : expenses.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-stone-400">ไม่พบรายการค่าใช้จ่าย</td>
                </tr>
              ) : (
                expenses.map((e) => (
                  <tr key={e.id} className="hover:bg-stone-50 transition">
                    <td className="py-3 px-4 text-stone-600 font-mono">{formatThaiDate(e.expense_date)}</td>
                    <td className="py-3 px-4">
                      <span className="bg-[#f7f1e7] text-[#8b5537] px-2 py-0.5 rounded-md text-[11px] font-semibold">
                        {e.category_name || 'ทั่วไป'}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-semibold text-stone-900">
                      {e.title}
                      {e.note && <span className="block text-[11px] text-stone-400 font-normal">{e.note}</span>}
                    </td>
                    <td className="py-3 px-4 text-stone-600">{e.payment_method}</td>
                    <td className="py-3 px-4 text-right font-black text-stone-900">
                      {formatCurrency(e.amount, true)}
                    </td>
                    <td className="py-3 px-4 text-stone-500">{e.created_by_name || '-'}</td>
                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={() => handleDelete(e.id)}
                        className="p-1 rounded-lg text-stone-400 hover:text-red-600 cursor-pointer"
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

      {/* Add Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full overflow-hidden border border-[#ecddc8]">
            <div className="px-6 py-4 bg-[#fdfaf6] border-b border-[#ebdccd] flex items-center justify-between">
              <h3 className="font-bold text-base text-[#321d14]">บันทึกค่าใช้จ่าย</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-stone-400 hover:text-stone-700">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSave} className="p-6 space-y-3.5">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-stone-700">ชื่อรายการค่าใช้จ่าย*</label>
                <input
                  type="text"
                  required
                  placeholder="เช่น ค่าเช่าพื้นที่ร้าน ประจำเดือน..., ค่าน้ำแข็งหลอด"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-stone-200 text-xs font-bold"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-stone-700">หมวดหมู่</label>
                  <select
                    value={categoryId || ''}
                    onChange={(e) => setCategoryId(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl border border-stone-200 text-xs"
                  >
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-stone-700">วันที่จ่าย (พ.ศ.)</label>
                  <ThaiDatePicker
                    value={expenseDate}
                    onChange={(val) => setExpenseDate(val)}
                    placeholder="เลือกวันที่จ่าย"
                    className="w-full"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-stone-700">จำนวนเงิน (บาท)*</label>
                  <input
                    type="number"
                    step="any"
                    required
                    min="0"
                    placeholder="0.00"
                    value={amount || ''}
                    onChange={(e) => setAmount(Number(e.target.value) || 0)}
                    className="w-full px-3 py-2 rounded-xl border border-stone-200 text-sm font-extrabold text-[#714631]"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-stone-700">วิธีชำระ</label>
                  <select
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-stone-200 text-xs font-medium"
                  >
                    <option value="CASH">เงินสด</option>
                    <option value="TRANSFER">โอนเงินธนาคาร</option>
                    <option value="CREDIT_CARD">บัตรเครดิต</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-stone-700">หมายเหตุ</label>
                <input
                  type="text"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
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
                  disabled={submitting}
                  className="px-5 py-2 rounded-xl bg-[#8b5537] hover:bg-[#714631] text-white text-xs font-bold transition shadow-xs cursor-pointer"
                >
                  {submitting ? 'กำลังบันทึก...' : 'บันทึกค่าใช้จ่าย'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
