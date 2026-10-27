import { Router } from 'express';
import { db, runTransaction } from '../db/index.js';
import { requireRole } from '../middleware/auth.js';
import { InventoryService } from '../services/inventoryService.js';
import { logAudit } from '../services/auditService.js';

export const salesRouter = Router();

// List sales with filtering and pagination
salesRouter.get('/', (req, res) => {
  const {
    start_date,
    end_date,
    bill_no,
    payment_method,
    status,
    cashier_id,
    page = 1,
    limit = 25
  } = req.query;

  let query = `
    SELECT s.*, u.full_name as cashier_name
    FROM sales s
    LEFT JOIN users u ON u.id = s.cashier_id
    WHERE 1=1
  `;
  const params: any[] = [];

  if (start_date) {
    query += ` AND date(s.sale_date) >= date(?)`;
    params.push(start_date);
  }
  if (end_date) {
    query += ` AND date(s.sale_date) <= date(?)`;
    params.push(end_date);
  }
  if (bill_no) {
    query += ` AND s.bill_no LIKE ?`;
    params.push(`%${bill_no}%`);
  }
  if (payment_method) {
    query += ` AND s.payment_method = ?`;
    params.push(payment_method);
  }
  if (status) {
    query += ` AND s.status = ?`;
    params.push(status);
  }
  if (cashier_id) {
    query += ` AND s.cashier_id = ?`;
    params.push(cashier_id);
  }

  // Count total matching
  const countRow = db.prepare(`SELECT COUNT(*) as total FROM (${query})`).get(...params) as { total: number };
  const total = countRow?.total || 0;

  // Pagination
  const offset = (Number(page) - 1) * Number(limit);
  query += ` ORDER BY s.id DESC LIMIT ? OFFSET ?`;
  params.push(Number(limit), offset);

  const sales = db.prepare(query).all(...params);

  res.json({
    success: true,
    data: sales,
    pagination: {
      total,
      page: Number(page),
      limit: Number(limit),
      totalPages: Math.ceil(total / Number(limit))
    }
  });
});

// Get single sale details
salesRouter.get('/:id', (req, res) => {
  const id = Number(req.params.id);
  const sale = db.prepare(`
    SELECT s.*, u.full_name as cashier_name, c_by.full_name as cancelled_by_name
    FROM sales s
    LEFT JOIN users u ON u.id = s.cashier_id
    LEFT JOIN users c_by ON c_by.id = s.cancelled_by
    WHERE s.id = ?
  `).get(id) as any;

  if (!sale) {
    return res.status(404).json({ success: false, message: 'ไม่พบบิลการขาย' });
  }

  const items = db.prepare(`
    SELECT * FROM sale_items WHERE sale_id = ? ORDER BY id ASC
  `).all(sale.id) as any[];

  const getOptionsStmt = db.prepare('SELECT * FROM sale_item_options WHERE sale_item_id = ?');
  const enrichedItems = items.map((item) => ({
    ...item,
    options: getOptionsStmt.all(item.id)
  }));

  const payment = db.prepare('SELECT * FROM payments WHERE sale_id = ? ORDER BY id DESC LIMIT 1').get(sale.id);
  const refund = db.prepare('SELECT * FROM refunds WHERE sale_id = ? ORDER BY id DESC LIMIT 1').get(sale.id);

  // Store settings for receipt printing
  const storeSettingsRows = db.prepare('SELECT key, value FROM store_settings').all() as { key: string; value: string }[];
  const settings: Record<string, string> = {};
  for (const row of storeSettingsRows) {
    settings[row.key] = row.value;
  }

  res.json({
    success: true,
    data: {
      ...sale,
      items: enrichedItems,
      payment,
      refund,
      store: settings
    }
  });
});

// Cancel or Refund sale
salesRouter.post('/:id/cancel', requireRole('OWNER', 'CASHIER'), (req, res) => {
  const id = Number(req.params.id);
  const { reason, restock_inventory = true } = req.body;

  if (!reason || !reason.trim()) {
    return res.status(400).json({ success: false, message: 'กรุณาระบุเหตุผลในการยกเลิกหรือคืนเงิน' });
  }

  const sale = db.prepare('SELECT * FROM sales WHERE id = ?').get(id) as any;
  if (!sale) {
    return res.status(404).json({ success: false, message: 'ไม่พบบิลการขาย' });
  }

  if (sale.status === 'CANCELLED' || sale.status === 'REFUNDED') {
    return res.status(400).json({ success: false, message: 'บิลนี้ถูกยกเลิกหรือคืนเงินไปแล้ว ไม่สามารถดำเนินการซ้ำได้' });
  }

  try {
    runTransaction(() => {
      const refundNo = `REF-${sale.bill_no}`;
      const cancelledBy = req.user?.id || 1;
      const cancelledAt = new Date().toISOString();

      // 1. Update sale status
      db.prepare(`
        UPDATE sales
        SET status = 'CANCELLED',
            cancel_reason = ?,
            cancelled_at = ?,
            cancelled_by = ?
        WHERE id = ?
      `).run(reason.trim(), cancelledAt, cancelledBy, id);

      // 2. Insert refund record
      db.prepare(`
        INSERT INTO refunds (
          sale_id, refund_no, refund_amount, reason, restock_inventory, refunded_by
        ) VALUES (?, ?, ?, ?, ?, ?)
      `).run(id, refundNo, sale.net_total, reason.trim(), restock_inventory ? 1 : 0, cancelledBy);

      // 3. Revert stock movement if requested
      if (restock_inventory) {
        InventoryService.revertSaleStock(sale.id, sale.bill_no, cancelledBy, reason.trim());
      }
    });

    logAudit({
      userId: req.user?.id,
      action: 'CANCEL_SALE',
      entityType: 'SALE',
      entityId: id,
      newValues: { bill_no: sale.bill_no, reason, restock_inventory }
    });

    res.json({
      success: true,
      message: `ยกเลิกบิลเลขที่ ${sale.bill_no} สำเร็จ${restock_inventory ? ' และคืนสต๊อกวัตถุดิบเรียบร้อยแล้ว' : ''}`
    });
  } catch (err: any) {
    console.error('Cancel sale error:', err);
    res.status(500).json({ success: false, message: 'เกิดข้อผิดพลาดในการยกเลิกบิล' });
  }
});
