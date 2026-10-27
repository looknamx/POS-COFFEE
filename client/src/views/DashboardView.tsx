import React, { useState, useEffect } from 'react';
import {
  TrendingUp,
  Receipt,
  Coffee,
  DollarSign,
  AlertTriangle,
  Clock,
  ChevronRight,
  ArrowUpRight
} from 'lucide-react';
import { apiRequest, formatCurrency, formatThaiDateTime } from '../api/client';
import { StoreSettings } from '../types';
import { ReceiptModal } from '../components/ReceiptModal';

interface DashboardViewProps {
  settings: StoreSettings;
  onNavigateTab: (tab: any) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({ settings, onNavigateTab }) => {
  const [data, setData] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedSaleForReceipt, setSelectedSaleForReceipt] = useState<any | null>(null);

  useEffect(() => {
    fetchDashboard();
  }, []);

  const fetchDashboard = async () => {
    setLoading(true);
    const res = await apiRequest('/reports/dashboard');
    if (res.success && res.data) {
      setData(res.data);
    }
    setLoading(false);
  };

  const handleOpenReceipt = async (saleId: number) => {
    const res = await apiRequest(`/sales/${saleId}`);
    if (res.success && res.data) {
      setSelectedSaleForReceipt(res.data);
    }
  };

  if (loading) {
    return (
      <div className="flex-1 p-8 flex items-center justify-center text-stone-400">
        กำลังโหลดข้อมูลแดชบอร์ด...
      </div>
    );
  }

  const today = data?.today || {};
  const topProducts = data?.topProducts || [];
  const hourlySales = data?.hourlySales || [];
  const lowStockAlerts = data?.lowStockAlerts || [];
  const recentSales = data?.recentSales || [];

  return (
    <div className="flex-1 p-6 overflow-y-auto space-y-6 bg-[#fbf9f6]">
      {/* Page Title */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-[#321d14]">ภาพรวมร้านวันนี้ (Today's Dashboard)</h2>
          <p className="text-xs text-[#8b5537]">ข้อมูลยอดขาย สต๊อก และผลการดำเนินงานแบบเรียลไทม์</p>
        </div>
        <button
          onClick={fetchDashboard}
          className="px-3.5 py-1.5 rounded-xl border border-stone-200 bg-white hover:bg-stone-50 text-xs font-semibold text-stone-700 shadow-2xs transition cursor-pointer"
        >
          รีเฟรชข้อมูล
        </button>
      </div>

      {/* Critical Low Stock Warning Banner */}
      {lowStockAlerts.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-start justify-between gap-3 shadow-2xs">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-amber-500 text-white flex items-center justify-center shrink-0 mt-0.5">
              <AlertTriangle className="w-4 h-4" />
            </div>
            <div>
              <div className="font-bold text-sm text-amber-900">
                แจ้งเตือน: วัตถุดิบ {lowStockAlerts.length} รายการ ต่ำกว่าจุดสั่งซื้อขั้นต่ำ
              </div>
              <div className="text-xs text-amber-800 mt-1 flex flex-wrap gap-2">
                {lowStockAlerts.map((ing: any) => (
                  <span key={ing.id} className="bg-white/80 px-2 py-0.5 rounded border border-amber-200">
                    {ing.name}: คงเหลือ {ing.current_stock} {ing.unit} (จุดสั่ง {ing.min_reorder_stock} {ing.unit})
                  </span>
                ))}
              </div>
            </div>
          </div>
          <button
            onClick={() => onNavigateTab('inventory')}
            className="text-xs font-bold text-amber-900 hover:underline flex items-center gap-1 shrink-0 cursor-pointer"
          >
            จัดการสต๊อก <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* 6 Key Performance Metric Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3.5">
        {/* Card 1: Today Revenue */}
        <div className="bg-white p-4 rounded-2xl border border-[#ecddc8] shadow-2xs space-y-1">
          <div className="flex items-center justify-between text-xs text-[#8b5537] font-medium">
            <span>ยอดขายวันนี้</span>
            <DollarSign className="w-4 h-4 text-[#ba8452]" />
          </div>
          <div className="text-xl font-black text-[#321d14]">
            {formatCurrency(today.totalRevenue || 0, true)}
          </div>
          <div className="text-[11px] text-emerald-600 font-medium">
            รายรับสุทธิ (รวม {today.totalBills || 0} บิล)
          </div>
        </div>

        {/* Card 2: Total Bills */}
        <div className="bg-white p-4 rounded-2xl border border-[#ecddc8] shadow-2xs space-y-1">
          <div className="flex items-center justify-between text-xs text-[#8b5537] font-medium">
            <span>จำนวนบิลขาย</span>
            <Receipt className="w-4 h-4 text-[#ba8452]" />
          </div>
          <div className="text-xl font-black text-[#321d14]">
            {today.totalBills || 0} <span className="text-xs font-normal text-stone-500">บิล</span>
          </div>
          <div className="text-[11px] text-stone-500">
            เฉลี่ย {formatCurrency(today.avgBill || 0)} / บิล
          </div>
        </div>

        {/* Card 3: Items Sold */}
        <div className="bg-white p-4 rounded-2xl border border-[#ecddc8] shadow-2xs space-y-1">
          <div className="flex items-center justify-between text-xs text-[#8b5537] font-medium">
            <span>แก้วที่ขายได้</span>
            <Coffee className="w-4 h-4 text-[#ba8452]" />
          </div>
          <div className="text-xl font-black text-[#321d14]">
            {today.totalItemsSold || 0} <span className="text-xs font-normal text-stone-500">แก้ว</span>
          </div>
          <div className="text-[11px] text-stone-500">
            ยอดตัดสต๊อกตามสูตร
          </div>
        </div>

        {/* Card 4: Estimated COGS */}
        <div className="bg-white p-4 rounded-2xl border border-[#ecddc8] shadow-2xs space-y-1">
          <div className="flex items-center justify-between text-xs text-[#8b5537] font-medium">
            <span>ต้นทุนวัตถุดิบ (COGS)</span>
            <TrendingUp className="w-4 h-4 text-stone-400" />
          </div>
          <div className="text-xl font-black text-stone-700">
            {formatCurrency(today.totalCogs || 0, true)}
          </div>
          <div className="text-[11px] text-stone-500">
            คำนวณจากสูตร BOM
          </div>
        </div>

        {/* Card 5: Estimated Gross Profit */}
        <div className="bg-white p-4 rounded-2xl border border-[#ecddc8] shadow-2xs space-y-1">
          <div className="flex items-center justify-between text-xs text-[#8b5537] font-medium">
            <span>กำไรขั้นต้นประมาณการ</span>
            <ArrowUpRight className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-xl font-black text-emerald-700">
            {formatCurrency(today.estimatedGrossProfit || 0, true)}
          </div>
          <div className="text-[11px] text-emerald-600 font-semibold">
            Margin: {today.marginPercent || 0}%
          </div>
        </div>

        {/* Card 6: Average Bill */}
        <div className="bg-white p-4 rounded-2xl border border-[#ecddc8] shadow-2xs space-y-1">
          <div className="flex items-center justify-between text-xs text-[#8b5537] font-medium">
            <span>ยอดเฉลี่ยต่อบิล</span>
            <TrendingUp className="w-4 h-4 text-[#ba8452]" />
          </div>
          <div className="text-xl font-black text-[#714631]">
            {formatCurrency(today.avgBill || 0, true)}
          </div>
          <div className="text-[11px] text-stone-500">
            ยอดซื้อเฉลี่ยลูกค้า
          </div>
        </div>
      </div>

      {/* Charts & Top Selling Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Hourly Sales Distribution */}
        <div className="lg:col-span-2 bg-white rounded-3xl p-5 border border-[#ecddc8] shadow-2xs space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-sm text-[#321d14] flex items-center gap-2">
              <Clock className="w-4 h-4 text-[#ba8452]" />
              ยอดขายรายชั่วโมงวันนี้
            </h3>
            <span className="text-xs text-stone-400">ช่วงเวลาการเปิดร้าน</span>
          </div>

          {hourlySales.length === 0 ? (
            <div className="h-44 flex items-center justify-center text-xs text-stone-400">
              ยังไม่มียอดขายในวันนี้
            </div>
          ) : (
            <div className="space-y-2">
              {hourlySales.map((h: any, i: number) => {
                const maxRev = Math.max(...hourlySales.map((item: any) => item.revenue || 1));
                const pct = Math.min(100, Math.round((h.revenue / maxRev) * 100));
                return (
                  <div key={i} className="flex items-center gap-3 text-xs">
                    <span className="w-14 font-mono font-medium text-stone-500">{h.hour}</span>
                    <div className="flex-1 bg-stone-100 rounded-full h-4 overflow-hidden">
                      <div
                        className="bg-gradient-to-r from-[#ba8452] to-[#8b5537] h-full rounded-full transition-all duration-300"
                        style={{ width: `${pct}%` }}
                      ></div>
                    </div>
                    <span className="w-24 text-right font-bold text-stone-800">
                      {formatCurrency(h.revenue)}
                    </span>
                    <span className="w-12 text-right text-stone-400 text-[11px]">
                      {h.bill_count} บิล
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Top 5 Best Selling Drinks */}
        <div className="bg-white rounded-3xl p-5 border border-[#ecddc8] shadow-2xs space-y-4">
          <h3 className="font-bold text-sm text-[#321d14] flex items-center gap-2">
            <Coffee className="w-4 h-4 text-[#ba8452]" />
            เมนูขายดี (Best Sellers)
          </h3>

          {topProducts.length === 0 ? (
            <div className="h-44 flex items-center justify-center text-xs text-stone-400">
              ยังไม่มีข้อมูลการขาย
            </div>
          ) : (
            <div className="space-y-3">
              {topProducts.map((p: any, idx: number) => (
                <div key={idx} className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2.5">
                    <span
                      className={`w-6 h-6 rounded-lg flex items-center justify-center font-bold text-[11px] ${
                        idx === 0
                          ? 'bg-amber-100 text-amber-900 border border-amber-300'
                          : 'bg-stone-100 text-stone-600'
                      }`}
                    >
                      {idx + 1}
                    </span>
                    <span className="font-medium text-stone-900 line-clamp-1">{p.product_name}</span>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="font-bold text-stone-800">{p.total_qty} แก้ว</div>
                    <div className="text-[10px] text-stone-400">{formatCurrency(p.total_revenue)}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Recent Sales Table */}
      <div className="bg-white rounded-3xl p-5 border border-[#ecddc8] shadow-2xs space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-sm text-[#321d14] flex items-center gap-2">
            <Receipt className="w-4 h-4 text-[#ba8452]" />
            รายการขายล่าสุด
          </h3>
          <button
            onClick={() => onNavigateTab('sales')}
            className="text-xs font-semibold text-[#8b5537] hover:underline flex items-center gap-1 cursor-pointer"
          >
            ดูประวัติทั้งหมด <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {recentSales.length === 0 ? (
          <div className="p-8 text-center text-xs text-stone-400">ยังไม่มีรายการขายในระบบ</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-stone-200 text-stone-500 font-semibold">
                  <th className="pb-2.5">เลขที่บิล</th>
                  <th className="pb-2.5">วันที่ / เวลา</th>
                  <th className="pb-2.5">ช่องทางชำระ</th>
                  <th className="pb-2.5 text-right">ยอดสุทธิ</th>
                  <th className="pb-2.5 text-center">สถานะ</th>
                  <th className="pb-2.5 text-right">การกระทำ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {recentSales.map((s: any) => (
                  <tr key={s.id} className="hover:bg-stone-50 transition">
                    <td className="py-2.5 font-bold font-mono text-stone-900">{s.bill_no}</td>
                    <td className="py-2.5 text-stone-600">{formatThaiDateTime(s.sale_date)}</td>
                    <td className="py-2.5 text-stone-700 font-medium">{s.payment_method}</td>
                    <td className="py-2.5 text-right font-bold text-stone-900">
                      {formatCurrency(s.net_total, true)}
                    </td>
                    <td className="py-2.5 text-center">
                      <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full text-[10px] font-semibold">
                        {s.status === 'COMPLETED' ? 'สำเร็จ' : s.status}
                      </span>
                    </td>
                    <td className="py-2.5 text-right">
                      <button
                        onClick={() => handleOpenReceipt(s.id)}
                        className="text-[#8b5537] hover:underline font-semibold text-xs cursor-pointer"
                      >
                        ดูใบเสร็จ
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Receipt Modal */}
      {selectedSaleForReceipt && (
        <ReceiptModal
          sale={selectedSaleForReceipt}
          settings={settings}
          onClose={() => setSelectedSaleForReceipt(null)}
        />
      )}
    </div>
  );
};

