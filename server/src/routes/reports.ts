import { Router } from 'express';
import { db } from '../db/index.js';

export const reportsRouter = Router();

// Dashboard overview
reportsRouter.get('/dashboard', (req, res) => {
  // Today's range (local date)
  const today = new Date().toISOString().slice(0, 10);

  // Today Sales
  const todaySales = db.prepare(`
    SELECT 
      COUNT(*) as total_bills,
      COALESCE(SUM(net_total), 0) as total_revenue,
      COALESCE(SUM(discount_amount), 0) as total_discounts
    FROM sales 
    WHERE date(sale_date) = date(?) AND status = 'COMPLETED'
  `).get(today) as any;

  // Items sold today and estimated COGS
  const todayItems = db.prepare(`
    SELECT 
      COALESCE(SUM(si.quantity), 0) as total_items_sold,
      COALESCE(SUM(si.quantity * si.cost_price), 0) as total_cogs
    FROM sale_items si
    JOIN sales s ON s.id = si.sale_id
    WHERE date(s.sale_date) = date(?) AND s.status = 'COMPLETED'
  `).get(today) as any;

  const totalBills = todaySales.total_bills || 0;
  const totalRevenue = todaySales.total_revenue || 0;
  const totalItemsSold = todayItems.total_items_sold || 0;
  const totalCogs = todayItems.total_cogs || 0;
  const avgBill = totalBills > 0 ? Math.round(totalRevenue / totalBills) : 0;
  const estimatedGrossProfit = totalRevenue - totalCogs;
  const marginPercent = totalRevenue > 0 ? ((estimatedGrossProfit / totalRevenue) * 100).toFixed(1) : 0;

  // Top 5 selling products of all time or last 30 days
  const topProducts = db.prepare(`
    SELECT 
      si.product_name,
      SUM(si.quantity) as total_qty,
      SUM(si.net_total) as total_revenue
    FROM sale_items si
    JOIN sales s ON s.id = si.sale_id
    WHERE s.status = 'COMPLETED'
    GROUP BY si.product_id, si.product_name
    ORDER BY total_qty DESC
    LIMIT 5
  `).all();

  // Hourly sales distribution today
  const hourlySales = db.prepare(`
    SELECT 
      strftime('%H:00', sale_date) as hour,
      COUNT(*) as bill_count,
      SUM(net_total) as revenue
    FROM sales
    WHERE date(sale_date) = date(?) AND status = 'COMPLETED'
    GROUP BY hour
    ORDER BY hour ASC
  `).all(today);

  // Critical Low Stock Alerts
  const lowStockAlerts = db.prepare(`
    SELECT id, code, name, unit, current_stock, min_reorder_stock
    FROM ingredients
    WHERE is_active = 1 AND current_stock <= min_reorder_stock
    ORDER BY current_stock ASC
    LIMIT 6
  `).all();

  // Recent 6 Sales
  const recentSales = db.prepare(`
    SELECT id, bill_no, sale_date, net_total, payment_method, status
    FROM sales
    ORDER BY id DESC
    LIMIT 6
  `).all();

  res.json({
    success: true,
    data: {
      today: {
        totalBills,
        totalRevenue,
        totalItemsSold,
        totalCogs,
        avgBill,
        estimatedGrossProfit,
        marginPercent: Number(marginPercent)
      },
      topProducts,
      hourlySales,
      lowStockAlerts,
      recentSales
    }
  });
});

// Comprehensive Sales Report
reportsRouter.get('/sales', (req, res) => {
  const { start_date, end_date } = req.query;

  let whereClause = ` WHERE s.status = 'COMPLETED'`;
  const params: any[] = [];

  if (start_date) {
    whereClause += ` AND date(s.sale_date) >= date(?)`;
    params.push(start_date);
  }
  if (end_date) {
    whereClause += ` AND date(s.sale_date) <= date(?)`;
    params.push(end_date);
  }

  // Summary by date
  const dailySummary = db.prepare(`
    SELECT 
      date(s.sale_date) as sale_day,
      COUNT(*) as bill_count,
      SUM(s.subtotal) as subtotal,
      SUM(s.discount_amount) as discount,
      SUM(s.net_total) as net_total,
      COALESCE(SUM(si_cogs.cogs), 0) as cogs
    FROM sales s
    LEFT JOIN (
      SELECT sale_id, SUM(quantity * cost_price) as cogs
      FROM sale_items
      GROUP BY sale_id
    ) si_cogs ON si_cogs.sale_id = s.id
    ${whereClause}
    GROUP BY sale_day
    ORDER BY sale_day DESC
  `).all(...params);

  // Summary by Payment Method
  const paymentBreakdown = db.prepare(`
    SELECT 
      s.payment_method,
      COUNT(*) as count,
      SUM(s.net_total) as total_amount
    FROM sales s
    ${whereClause}
    GROUP BY s.payment_method
  `).all(...params);

  // Summary by Product
  const productSummary = db.prepare(`
    SELECT 
      si.product_name,
      p.category_id,
      c.name as category_name,
      SUM(si.quantity) as quantity_sold,
      SUM(si.net_total) as total_sales,
      SUM(si.quantity * si.cost_price) as total_cogs
    FROM sale_items si
    JOIN sales s ON s.id = si.sale_id
    LEFT JOIN products p ON p.id = si.product_id
    LEFT JOIN product_categories c ON c.id = p.category_id
    ${whereClause}
    GROUP BY si.product_id, si.product_name
    ORDER BY total_sales DESC
  `).all(...params);

  // Summary Totals
  const overall = db.prepare(`
    SELECT 
      COUNT(*) as total_bills,
      COALESCE(SUM(net_total), 0) as total_revenue,
      COALESCE(SUM(discount_amount), 0) as total_discounts
    FROM sales s
    ${whereClause}
  `).get(...params) as any;

  res.json({
    success: true,
    data: {
      overall,
      dailySummary,
      paymentBreakdown,
      productSummary
    }
  });
});

// Ingredient Usage Report
reportsRouter.get('/ingredient-usage', (req, res) => {
  const { start_date, end_date } = req.query;

  let query = `
    SELECT 
      i.id,
      i.code,
      i.name,
      i.unit,
      i.cost_per_unit,
      ABS(SUM(CASE WHEN m.movement_type = 'SALE' THEN m.quantity_change ELSE 0 END)) as sold_quantity,
      ABS(SUM(CASE WHEN m.movement_type = 'WASTE' THEN m.quantity_change ELSE 0 END)) as waste_quantity,
      ABS(SUM(CASE WHEN m.movement_type = 'USAGE' THEN m.quantity_change ELSE 0 END)) as internal_use_quantity,
      SUM(CASE WHEN m.movement_type = 'PURCHASE' THEN m.quantity_change ELSE 0 END) as purchased_quantity
    FROM ingredients i
    LEFT JOIN inventory_movements m ON m.ingredient_id = i.id
    WHERE 1=1
  `;
  const params: any[] = [];

  if (start_date) {
    query += ` AND date(m.created_at) >= date(?)`;
    params.push(start_date);
  }
  if (end_date) {
    query += ` AND date(m.created_at) <= date(?)`;
    params.push(end_date);
  }

  query += ` GROUP BY i.id, i.name ORDER BY sold_quantity DESC`;

  const rows = db.prepare(query).all(...params) as any[];

  const usageWithCost = rows.map((r) => ({
    ...r,
    sold_cost: Math.round(r.sold_quantity * r.cost_per_unit),
    waste_cost: Math.round(r.waste_quantity * r.cost_per_unit),
    internal_use_cost: Math.round(r.internal_use_quantity * r.cost_per_unit)
  }));

  res.json({ success: true, data: usageWithCost });
});

// Profit & Loss Statement (สรุปกำไรขาดทุนเบื้องต้น)
reportsRouter.get('/pnl', (req, res) => {
  const { start_date, end_date } = req.query;

  let saleWhere = ` WHERE s.status = 'COMPLETED'`;
  let expWhere = ` WHERE 1=1`;
  const saleParams: any[] = [];
  const expParams: any[] = [];

  if (start_date) {
    saleWhere += ` AND date(s.sale_date) >= date(?)`;
    expWhere += ` AND date(e.expense_date) >= date(?)`;
    saleParams.push(start_date);
    expParams.push(start_date);
  }
  if (end_date) {
    saleWhere += ` AND date(s.sale_date) <= date(?)`;
    expWhere += ` AND date(e.expense_date) <= date(?)`;
    saleParams.push(end_date);
    expParams.push(end_date);
  }

  // 1. Total Revenue
  const salesRow = db.prepare(`
    SELECT COALESCE(SUM(s.net_total), 0) as revenue, COUNT(*) as bill_count
    FROM sales s
    ${saleWhere}
  `).get(...saleParams) as any;

  // 2. COGS (Cost of Goods Sold based on items sold)
  const cogsRow = db.prepare(`
    SELECT COALESCE(SUM(si.quantity * si.cost_price), 0) as cogs
    FROM sale_items si
    JOIN sales s ON s.id = si.sale_id
    ${saleWhere}
  `).get(...saleParams) as any;

  // 3. Operating Expenses by category
  const expenses = db.prepare(`
    SELECT 
      COALESCE(ec.name, 'ค่าใช้จ่ายทั่วไป') as category_name,
      SUM(e.amount) as total_amount
    FROM expenses e
    LEFT JOIN expense_categories ec ON ec.id = e.category_id
    ${expWhere}
    GROUP BY ec.name
    ORDER BY total_amount DESC
  `).all(...expParams) as any[];

  const totalRevenue = salesRow?.revenue || 0;
  const totalCogs = cogsRow?.cogs || 0;
  const grossProfit = totalRevenue - totalCogs;
  const totalOperatingExpenses = expenses.reduce((acc, curr) => acc + curr.total_amount, 0);
  const netOperatingProfit = grossProfit - totalOperatingExpenses;

  res.json({
    success: true,
    data: {
      revenue: totalRevenue,
      billCount: salesRow?.bill_count || 0,
      cogs: totalCogs,
      grossProfit,
      grossMarginPercent: totalRevenue > 0 ? Number(((grossProfit / totalRevenue) * 100).toFixed(1)) : 0,
      expenses,
      totalOperatingExpenses,
      netOperatingProfit,
      netMarginPercent: totalRevenue > 0 ? Number(((netOperatingProfit / totalRevenue) * 100).toFixed(1)) : 0
    }
  });
});

// CSV Export (with UTF-8 BOM so Thai opens perfectly in Microsoft Excel)
reportsRouter.get('/export-csv', (req, res) => {
  const { type = 'sales', start_date, end_date } = req.query;

  let csvContent = '';
  let filename = `report_${type}_${new Date().toISOString().slice(0, 10)}.csv`;

  if (type === 'sales') {
    csvContent = 'เลขที่บิล,วันที่,ยอดรวมก่อนลด (บาท),ส่วนลด (บาท),ยอดสุทธิ (บาท),วิธีชำระเงิน,สถานะ,พนักงาน\n';
    const sales = db.prepare(`
      SELECT s.*, u.full_name as cashier_name
      FROM sales s
      LEFT JOIN users u ON u.id = s.cashier_id
      ORDER BY s.id DESC
    `).all() as any[];

    for (const s of sales) {
      const sub = (s.subtotal / 100).toFixed(2);
      const dis = (s.discount_amount / 100).toFixed(2);
      const net = (s.net_total / 100).toFixed(2);
      const row = `"${s.bill_no}","${s.sale_date}","${sub}","${dis}","${net}","${s.payment_method}","${s.status}","${s.cashier_name || ''}"\n`;
      csvContent += row;
    }
  } else if (type === 'inventory') {
    csvContent = 'รหัสวัตถุดิบ,ชื่อวัตถุดิบ,หมวดหมู่,คงเหลือ,หน่วย,จุดสั่งซื้อขั้นต่ำ,ต้นทุนต่อหน่วย (บาท),มูลค่ารวม (บาท),สถานะ\n';
    const items = db.prepare(`
      SELECT i.*, c.name as category_name
      FROM ingredients i
      LEFT JOIN ingredient_categories c ON c.id = i.category_id
      WHERE i.is_active = 1
      ORDER BY i.name ASC
    `).all() as any[];

    for (const it of items) {
      const unitCost = (it.cost_per_unit / 100).toFixed(2);
      const val = ((it.current_stock * it.cost_per_unit) / 100).toFixed(2);
      const status = it.current_stock <= 0 ? 'หมดสต๊อก' : it.current_stock <= it.min_reorder_stock ? 'สต๊อกต่ำ' : 'ปกติ';
      const row = `"${it.code}","${it.name}","${it.category_name || ''}","${it.current_stock}","${it.unit}","${it.min_reorder_stock}","${unitCost}","${val}","${status}"\n`;
      csvContent += row;
    }
  }

  // Prepend UTF-8 BOM (\uFEFF) for Microsoft Excel compatibility with Thai characters!
  const bom = Buffer.from('\uFEFF', 'utf-8');
  const buffer = Buffer.concat([bom, Buffer.from(csvContent, 'utf-8')]);

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(buffer);
});

