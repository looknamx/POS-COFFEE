import React, { useState, useEffect } from 'react';
import { BarChart3, Download, Calendar, DollarSign, TrendingUp, PieChart, Activity } from 'lucide-react';
import { apiRequest, formatCurrency, formatThaiDate } from '../api/client';
import { ThaiDatePicker } from '../components/ThaiDatePicker';

export const ReportsView: React.FC = () => {
  const [activeSubTab, setActiveSubTab] = useState<'sales' | 'products' | 'usage' | 'pnl'>('sales');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [salesData, setSalesData] = useState<any | null>(null);
  const [usageData, setUsageData] = useState<any[]>([]);
  const [pnlData, setPnlData] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchReportData();
  }, [startDate, endDate, activeSubTab]);

  const fetchReportData = async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (startDate) params.append('start_date', startDate);
    if (endDate) params.append('end_date', endDate);

    if (activeSubTab === 'sales' || activeSubTab === 'products') {
      const res = await apiRequest(`/reports/sales?${params.toString()}`);
      if (res.success && res.data) setSalesData(res.data);
    } else if (activeSubTab === 'usage') {
      const res = await apiRequest(`/reports/ingredient-usage?${params.toString()}`);
      if (res.success && res.data) setUsageData(res.data);
    } else if (activeSubTab === 'pnl') {
      const res = await apiRequest(`/reports/pnl?${params.toString()}`);
      if (res.success && res.data) setPnlData(res.data);
    }
    setLoading(false);
  };

  const handleExportCSV = (type: 'sales' | 'inventory') => {
    const params = new URLSearchParams({ type });
    if (startDate) params.append('start_date', startDate);
    if (endDate) params.append('end_date', endDate);

    // Trigger direct download of UTF-8 BOM CSV
    window.location.href = `/api/reports/export-csv?${params.toString()}`;
  };

  return (
    <div className="flex-1 p-6 overflow-y-auto space-y-6 bg-[#fbf9f6]">
      {/* Top Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-[#321d14]">รายงานและวิเคราะห์ข้อมูล (Reports & Analytics)</h2>
          <p className="text-xs text-[#8b5537]">ยอดขาย กำไรขั้นต้น การใช้วัตถุดิบ และส่งออกรายงาน Excel</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => handleExportCSV('sales')}
            className="px-3.5 py-2 rounded-xl bg-white border border-[#ecddc8] hover:bg-[#f7f1e7] text-xs font-semibold text-[#8b5537] flex items-center gap-1.5 shadow-2xs transition cursor-pointer"
          >
            <Download className="w-4 h-4" />
            ส่งออก CSV (Excel)
          </button>
        </div>
      </div>

      {/* Sub Tabs & Date Controls */}
      <div className="bg-white p-4 rounded-3xl border border-[#ecddc8] flex flex-wrap items-center justify-between gap-3 shadow-2xs">
        {/* Navigation Pills */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setActiveSubTab('sales')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
              activeSubTab === 'sales' ? 'bg-[#8b5537] text-white shadow-xs' : 'bg-stone-100 text-stone-700 hover:bg-stone-200'
            }`}
          >
            รายงานยอดขายรายวัน
          </button>
          <button
            onClick={() => setActiveSubTab('products')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
              activeSubTab === 'products' ? 'bg-[#8b5537] text-white shadow-xs' : 'bg-stone-100 text-stone-700 hover:bg-stone-200'
            }`}
          >
            ยอดขายแยกตามเมนู
          </button>
          <button
            onClick={() => setActiveSubTab('usage')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
              activeSubTab === 'usage' ? 'bg-[#8b5537] text-white shadow-xs' : 'bg-stone-100 text-stone-700 hover:bg-stone-200'
            }`}
          >
            การใช้วัตถุดิบ (Stock Usage)
          </button>
          <button
            onClick={() => setActiveSubTab('pnl')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
              activeSubTab === 'pnl' ? 'bg-[#8b5537] text-white shadow-xs' : 'bg-stone-100 text-stone-700 hover:bg-stone-200'
            }`}
          >
            งบกำไรขาดทุนเบื้องต้น (P&L)
          </button>
        </div>

        {/* Date Filter */}
        <div className="flex items-center gap-2">
          <ThaiDatePicker
            value={startDate}
            onChange={(val) => setStartDate(val)}
            placeholder="ตั้งแต่วันที่ (พ.ศ.)"
            className="w-44"
          />
          <span className="text-stone-400 text-xs">ถึง</span>
          <ThaiDatePicker
            value={endDate}
            onChange={(val) => setEndDate(val)}
            placeholder="ถึงวันที่ (พ.ศ.)"
            className="w-44"
          />
        </div>
      </div>

      {/* CONTENT AREA BY SUB-TAB */}
      {loading ? (
        <div className="p-12 text-center text-xs text-stone-400">กำลังประมวลผลรายงาน...</div>
      ) : activeSubTab === 'sales' ? (
        <div className="space-y-6">
          {/* Summary Banner */}
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-white p-5 rounded-3xl border border-[#ecddc8] shadow-2xs">
              <div className="text-xs text-stone-500 font-medium">ยอดขายรวมสุทธิ</div>
              <div className="text-2xl font-black text-[#714631] mt-1">
                {formatCurrency(salesData?.overall?.total_revenue || 0, true)}
              </div>
            </div>
            <div className="bg-white p-5 rounded-3xl border border-[#ecddc8] shadow-2xs">
              <div className="text-xs text-stone-500 font-medium">จำนวนบิลขายทั้งหมด</div>
              <div className="text-2xl font-black text-stone-800 mt-1">
                {salesData?.overall?.total_bills || 0} บิล
              </div>
            </div>
            <div className="bg-white p-5 rounded-3xl border border-[#ecddc8] shadow-2xs">
              <div className="text-xs text-stone-500 font-medium">ส่วนลดที่ให้ลูกค้า</div>
              <div className="text-2xl font-black text-red-600 mt-1">
                {formatCurrency(salesData?.overall?.total_discounts || 0, true)}
              </div>
            </div>
          </div>

          {/* Daily Table */}
          <div className="bg-white rounded-3xl border border-[#ecddc8] shadow-2xs overflow-hidden">
            <div className="p-4 bg-[#fdfaf6] border-b border-[#ebdccd] font-bold text-xs text-[#714631]">
              สรุปยอดขายแยกตามวัน
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-stone-200 text-stone-500 font-semibold">
                    <th className="py-3 px-4">วันที่</th>
                    <th className="py-3 px-4 text-center">จำนวนบิล</th>
                    <th className="py-3 px-4 text-right">ยอดก่อนลด</th>
                    <th className="py-3 px-4 text-right">ส่วนลด</th>
                    <th className="py-3 px-4 text-right">ยอดสุทธิ</th>
                    <th className="py-3 px-4 text-right">ต้นทุน COGS</th>
                    <th className="py-3 px-4 text-right">กำไรขั้นต้น</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {salesData?.dailySummary?.map((d: any, idx: number) => {
                    const gross = d.net_total - d.cogs;
                    return (
                      <tr key={idx} className="hover:bg-stone-50 transition">
                        <td className="py-3 px-4 font-mono font-bold text-stone-900">{formatThaiDate(d.sale_day)}</td>
                        <td className="py-3 px-4 text-center font-medium">{d.bill_count}</td>
                        <td className="py-3 px-4 text-right text-stone-600">{formatCurrency(d.subtotal, true)}</td>
                        <td className="py-3 px-4 text-right text-red-600 font-medium">{formatCurrency(d.discount, true)}</td>
                        <td className="py-3 px-4 text-right font-extrabold text-[#714631]">{formatCurrency(d.net_total, true)}</td>
                        <td className="py-3 px-4 text-right text-stone-500">{formatCurrency(d.cogs, true)}</td>
                        <td className="py-3 px-4 text-right font-bold text-emerald-700">{formatCurrency(gross, true)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : activeSubTab === 'products' ? (
        <div className="bg-white rounded-3xl border border-[#ecddc8] shadow-2xs overflow-hidden">
          <div className="p-4 bg-[#fdfaf6] border-b border-[#ebdccd] font-bold text-xs text-[#714631]">
            สรุปยอดขายแยกตามเมนูสินค้า
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-stone-200 text-stone-500 font-semibold">
                  <th className="py-3 px-4">ชื่อสินค้า</th>
                  <th className="py-3 px-4">หมวดหมู่</th>
                  <th className="py-3 px-4 text-right">จำนวนแก้วที่ขาย</th>
                  <th className="py-3 px-4 text-right">ยอดขายรวม</th>
                  <th className="py-3 px-4 text-right">ต้นทุนรวม</th>
                  <th className="py-3 px-4 text-right">กำไรขั้นต้น</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {salesData?.productSummary?.map((p: any, idx: number) => (
                  <tr key={idx} className="hover:bg-stone-50 transition">
                    <td className="py-3 px-4 font-bold text-stone-900">{p.product_name}</td>
                    <td className="py-3 px-4 text-stone-600">{p.category_name || '-'}</td>
                    <td className="py-3 px-4 text-right font-bold text-stone-800">{p.quantity_sold} แก้ว</td>
                    <td className="py-3 px-4 text-right font-black text-[#714631]">{formatCurrency(p.total_sales, true)}</td>
                    <td className="py-3 px-4 text-right text-stone-500">{formatCurrency(p.total_cogs, true)}</td>
                    <td className="py-3 px-4 text-right font-bold text-emerald-700">{formatCurrency(p.total_sales - p.total_cogs, true)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : activeSubTab === 'usage' ? (
        <div className="bg-white rounded-3xl border border-[#ecddc8] shadow-2xs overflow-hidden">
          <div className="p-4 bg-[#fdfaf6] border-b border-[#ebdccd] font-bold text-xs text-[#714631]">
            รายงานการใช้วัตถุดิบจริงตามสูตรและของเสีย
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-stone-200 text-stone-500 font-semibold">
                  <th className="py-3 px-4">รหัส</th>
                  <th className="py-3 px-4">ชื่อวัตถุดิบ</th>
                  <th className="py-3 px-4 text-right">ใช้ในการขาย</th>
                  <th className="py-3 px-4 text-right">ต้นทุนขาย</th>
                  <th className="py-3 px-4 text-right">ของเสีย/ชำรุด</th>
                  <th className="py-3 px-4 text-right">มูลค่าของเสีย</th>
                  <th className="py-3 px-4 text-right">รับเข้าสต๊อก</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {usageData.map((u, idx) => (
                  <tr key={idx} className="hover:bg-stone-50 transition">
                    <td className="py-3 px-4 font-mono font-bold text-stone-900">{u.code}</td>
                    <td className="py-3 px-4 font-semibold text-stone-900">{u.name}</td>
                    <td className="py-3 px-4 text-right font-bold text-stone-800">{u.sold_quantity} {u.unit}</td>
                    <td className="py-3 px-4 text-right text-stone-600">{formatCurrency(u.sold_cost, true)}</td>
                    <td className="py-3 px-4 text-right text-red-600 font-medium">{u.waste_quantity} {u.unit}</td>
                    <td className="py-3 px-4 text-right text-red-600 font-bold">{formatCurrency(u.waste_cost, true)}</td>
                    <td className="py-3 px-4 text-right font-bold text-emerald-700">{u.purchased_quantity} {u.unit}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : activeSubTab === 'pnl' ? (
        <div className="max-w-2xl mx-auto bg-white rounded-3xl border border-[#ecddc8] shadow-2xs p-6 space-y-6">
          <div className="text-center pb-4 border-b border-stone-100">
            <h3 className="font-bold text-base text-[#321d14]">สรุปงบกำไรขาดทุนเบื้องต้น (Estimated P&L)</h3>
            <p className="text-xs text-stone-500">คำนวณตามยอดขายจริง ต้นทุนตามสูตร และค่าใช้จ่ายร้านค้า</p>
          </div>

          <div className="space-y-3 text-xs">
            {/* 1. Revenue */}
            <div className="flex justify-between items-center py-2 border-b border-stone-100">
              <span className="font-bold text-sm text-stone-900">1. รายรับสุทธิจากการขาย (Revenue)</span>
              <span className="font-extrabold text-sm text-[#714631]">{formatCurrency(pnlData?.revenue || 0, true)}</span>
            </div>

            {/* 2. COGS */}
            <div className="flex justify-between items-center py-2 border-b border-stone-100 text-stone-700">
              <span>2. ต้นทุนขายตามสูตรวัตถุดิบ (COGS)</span>
              <span className="text-red-600">-{formatCurrency(pnlData?.cogs || 0, true)}</span>
            </div>

            {/* 3. Gross Profit */}
            <div className="flex justify-between items-center py-2.5 bg-emerald-50 px-3 rounded-xl font-bold text-emerald-900">
              <span>3. กำไรขั้นต้น (Gross Profit) [Margin {pnlData?.grossMarginPercent || 0}%]</span>
              <span className="text-base text-emerald-800">{formatCurrency(pnlData?.grossProfit || 0, true)}</span>
            </div>

            {/* 4. Operating Expenses breakdown */}
            <div className="pt-2 space-y-2">
              <div className="font-bold text-stone-700">4. ค่าใช้จ่ายดำเนินงาน (Operating Expenses)</div>
              {pnlData?.expenses?.map((exp: any, i: number) => (
                <div key={i} className="flex justify-between pl-4 text-stone-500">
                  <span>- {exp.category_name}</span>
                  <span>{formatCurrency(exp.total_amount, true)}</span>
                </div>
              ))}
              <div className="flex justify-between pl-4 font-bold text-stone-800 pt-1">
                <span>รวมค่าใช้จ่ายดำเนินงาน:</span>
                <span className="text-red-600">-{formatCurrency(pnlData?.totalOperatingExpenses || 0, true)}</span>
              </div>
            </div>

            {/* 5. Net Operating Profit */}
            <div className="flex justify-between items-center py-3 bg-[#f7f1e7] px-4 rounded-2xl font-black text-sm text-[#321d14] border border-[#ecddc8]">
              <span>5. กำไรจากการดำเนินงานสุทธิ (Net Operating Profit)</span>
              <span className="text-xl text-[#714631]">{formatCurrency(pnlData?.netOperatingProfit || 0, true)}</span>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};

