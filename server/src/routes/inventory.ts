import { Router } from 'express';
import { db, runTransaction } from '../db/index.js';
import { requireRole } from '../middleware/auth.js';
import { InventoryService } from '../services/inventoryService.js';
import { logAudit } from '../services/auditService.js';

export const inventoryRouter = Router();

// ==========================================
// 1. PURCHASE RECEIPTS (รับสินค้าเข้า)
// ==========================================

// List purchase receipts
inventoryRouter.get('/purchases', (req, res) => {
  const { start_date, end_date, supplier_id } = req.query;

  let query = `
    SELECT pr.*, s.name as supplier_name, u.full_name as created_by_name
    FROM purchase_receipts pr
    LEFT JOIN suppliers s ON s.id = pr.supplier_id
    LEFT JOIN users u ON u.id = pr.created_by
    WHERE 1=1
  `;
  const params: any[] = [];

  if (start_date) {
    query += ` AND date(pr.receipt_date) >= date(?)`;
    params.push(start_date);
  }
  if (end_date) {
    query += ` AND date(pr.receipt_date) <= date(?)`;
    params.push(end_date);
  }
  if (supplier_id) {
    query += ` AND pr.supplier_id = ?`;
    params.push(supplier_id);
  }

  query += ` ORDER BY pr.id DESC`;
  const receipts = db.prepare(query).all(...params);
  res.json({ success: true, data: receipts });
});

// Create purchase receipt & increase stock atomically
inventoryRouter.post('/purchases', requireRole('OWNER', 'STOCK_MANAGER'), (req, res) => {
  const {
    receipt_no,
    supplier_id,
    receipt_date = new Date().toISOString(),
    note,
    items = [] // Array of { ingredient_id, quantity, unit, unit_cost }
  } = req.body;

  if (!receipt_no || !receipt_no.trim() || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ success: false, message: 'กรุณากรอกเลขที่เอกสารรับสินค้า และรายการวัตถุดิบอย่างน้อย 1 รายการ' });
  }

  // Check unique receipt_no
  const existing = db.prepare('SELECT id FROM purchase_receipts WHERE receipt_no = ?').get(receipt_no.trim());
  if (existing) {
    return res.status(400).json({ success: false, message: 'เลขที่เอกสารรับสินค้านี้มีอยู่ในระบบแล้ว' });
  }

  try {
    const createdReceipt = runTransaction(() => {
      let totalAmount = 0;
      const parsedItems: any[] = [];

      for (const it of items) {
        const qty = Number(it.quantity);
        const unitCost = Math.round(Number(it.unit_cost));
        const lineTotal = qty * unitCost;
        totalAmount += lineTotal;

        parsedItems.push({
          ingredient_id: it.ingredient_id,
          quantity: qty,
          unit: it.unit,
          unit_cost: unitCost,
          total_cost: lineTotal
        });
      }

      // 1. Insert receipt header
      const info = db.prepare(`
        INSERT INTO purchase_receipts (receipt_no, supplier_id, receipt_date, total_amount, note, created_by, status)
        VALUES (?, ?, ?, ?, ?, ?, 'COMPLETED')
      `).run(
        receipt_no.trim(),
        supplier_id || null,
        receipt_date,
        totalAmount,
        note || null,
        req.user?.id || 1
      );

      const receiptId = Number(info.lastInsertRowid);

      // 2. Insert items, update ingredient stock, update weighted average cost, and log movement
      const insertItemStmt = db.prepare(`
        INSERT INTO purchase_receipt_items (purchase_receipt_id, ingredient_id, quantity, unit, unit_cost, total_cost)
        VALUES (?, ?, ?, ?, ?, ?)
      `);

      const getIngStmt = db.prepare('SELECT current_stock, cost_per_unit FROM ingredients WHERE id = ?');
      const updateStockStmt = db.prepare(`
        UPDATE ingredients 
        SET current_stock = ?, cost_per_unit = ?, updated_at = datetime('now', 'localtime')
        WHERE id = ?
      `);

      const insertMovementStmt = db.prepare(`
        INSERT INTO inventory_movements (
          ingredient_id, movement_type, reference_type, reference_id,
          quantity_change, quantity_before, quantity_after, unit_cost, reason, note, created_by
        ) VALUES (?, 'PURCHASE', 'PURCHASE_RECEIPT', ?, ?, ?, ?, ?, 'รับสินค้าเข้าสต๊อก', ?, ?)
      `);

      for (const pi of parsedItems) {
        insertItemStmt.run(receiptId, pi.ingredient_id, pi.quantity, pi.unit, pi.unit_cost, pi.total_cost);

        const current = getIngStmt.get(pi.ingredient_id) as { current_stock: number; cost_per_unit: number };
        const beforeQty = current ? current.current_stock : 0;
        const afterQty = beforeQty + pi.quantity;

        // Calculate weighted average cost if stock > 0
        let newUnitCost = pi.unit_cost;
        if (beforeQty > 0 && afterQty > 0) {
          const totalValBefore = beforeQty * current.cost_per_unit;
          const totalValIn = pi.quantity * pi.unit_cost;
          newUnitCost = Math.round((totalValBefore + totalValIn) / afterQty);
        }

        updateStockStmt.run(afterQty, newUnitCost, pi.ingredient_id);
        insertMovementStmt.run(
          pi.ingredient_id,
          receiptId,
          pi.quantity,
          beforeQty,
          afterQty,
          pi.unit_cost,
          `เอกสารรับเลขที่ ${receipt_no.trim()}`,
          req.user?.id || 1
        );
      }

      return { receiptId, receipt_no: receipt_no.trim(), totalAmount };
    });

    logAudit({
      userId: req.user?.id,
      action: 'CREATE_PURCHASE_RECEIPT',
      entityType: 'PURCHASE_RECEIPT',
      entityId: createdReceipt.receiptId,
      newValues: { receipt_no: createdReceipt.receipt_no, totalAmount: createdReceipt.totalAmount }
    });

    res.status(201).json({
      success: true,
      message: 'บันทึกรับสินค้าเข้าสต๊อกสำเร็จ',
      data: createdReceipt
    });
  } catch (err: any) {
    console.error('Purchase receipt error:', err);
    res.status(500).json({ success: false, message: 'เกิดข้อผิดพลาดในการบันทึกรับสินค้า' });
  }
});

// Single purchase receipt detail
inventoryRouter.get('/purchases/:id', (req, res) => {
  const id = Number(req.params.id);
  const receipt = db.prepare(`
    SELECT pr.*, s.name as supplier_name, s.code as supplier_code, u.full_name as created_by_name
    FROM purchase_receipts pr
    LEFT JOIN suppliers s ON s.id = pr.supplier_id
    LEFT JOIN users u ON u.id = pr.created_by
    WHERE pr.id = ?
  `).get(id) as any;

  if (!receipt) {
    return res.status(404).json({ success: false, message: 'ไม่พบเอกสารรับสินค้า' });
  }

  const items = db.prepare(`
    SELECT pri.*, i.name as ingredient_name, i.code as ingredient_code
    FROM purchase_receipt_items pri
    JOIN ingredients i ON i.id = pri.ingredient_id
    WHERE pri.purchase_receipt_id = ?
  `).all(id);

  res.json({ success: true, data: { ...receipt, items } });
});

// Cancel purchase receipt (reverses stock)
inventoryRouter.post('/purchases/:id/cancel', requireRole('OWNER', 'STOCK_MANAGER'), (req, res) => {
  const id = Number(req.params.id);
  const { reason = 'ยกเลิกเอกสารรับเข้า' } = req.body;

  const receipt = db.prepare('SELECT * FROM purchase_receipts WHERE id = ?').get(id) as any;
  if (!receipt) return res.status(404).json({ success: false, message: 'ไม่พบเอกสารรับสินค้า' });
  if (receipt.status === 'CANCELLED') return res.status(400).json({ success: false, message: 'เอกสารนี้ถูกยกเลิกแล้ว' });

  try {
    runTransaction(() => {
      // Mark cancelled
      db.prepare(`UPDATE purchase_receipts SET status = 'CANCELLED' WHERE id = ?`).run(id);

      // Revert items
      const items = db.prepare('SELECT * FROM purchase_receipt_items WHERE purchase_receipt_id = ?').all(id) as any[];
      const getIng = db.prepare('SELECT current_stock, cost_per_unit FROM ingredients WHERE id = ?');
      const updateStock = db.prepare(`UPDATE ingredients SET current_stock = ?, updated_at = datetime('now', 'localtime') WHERE id = ?`);
      const insertMovement = db.prepare(`
        INSERT INTO inventory_movements (
          ingredient_id, movement_type, reference_type, reference_id,
          quantity_change, quantity_before, quantity_after, unit_cost, reason, note, created_by
        ) VALUES (?, 'ADJUSTMENT', 'PURCHASE_RECEIPT', ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      for (const it of items) {
        const cur = getIng.get(it.ingredient_id) as { current_stock: number; cost_per_unit: number };
        const beforeQty = cur ? cur.current_stock : 0;
        const afterQty = beforeQty - it.quantity;

        updateStock.run(afterQty, it.ingredient_id);
        insertMovement.run(
          it.ingredient_id,
          id,
          -it.quantity,
          beforeQty,
          afterQty,
          it.unit_cost,
          reason,
          `ปรับยอดยกเลิกเอกสารรับ ${receipt.receipt_no}`,
          req.user?.id || 1
        );
      }
    });

    logAudit({
      userId: req.user?.id,
      action: 'CANCEL_PURCHASE_RECEIPT',
      entityType: 'PURCHASE_RECEIPT',
      entityId: id,
      newValues: { receipt_no: receipt.receipt_no, reason }
    });

    res.json({ success: true, message: `ยกเลิกเอกสารรับสินค้าเลขที่ ${receipt.receipt_no} และปรับลดยอดสต๊อกเรียบร้อยแล้ว` });
  } catch (err: any) {
    res.status(500).json({ success: false, message: 'เกิดข้อผิดพลาดในการยกเลิกเอกสารรับสินค้า' });
  }
});

// ==========================================
// 2. STOCK ADJUSTMENT & WASTE (เบิกใช้ / ของเสีย)
// ==========================================

inventoryRouter.post('/adjust', requireRole('OWNER', 'STOCK_MANAGER'), (req, res) => {
  const {
    ingredient_id,
    movement_type, // 'USAGE' | 'WASTE' | 'ADJUSTMENT'
    quantity_change, // e.g. -500 for waste/use, or +/- for adjustment
    reason,
    note
  } = req.body;

  if (!ingredient_id || !movement_type || quantity_change === undefined || !reason) {
    return res.status(400).json({ success: false, message: 'กรุณากรอกข้อมูลการปรับปรุงสต๊อกให้ครบถ้วน' });
  }

  try {
    const result = runTransaction(() => {
      return InventoryService.adjustStock({
        ingredientId: Number(ingredient_id),
        movementType: movement_type,
        quantityChange: Number(quantity_change),
        reason: reason.trim(),
        note: note || undefined,
        userId: req.user?.id
      });
    });

    logAudit({
      userId: req.user?.id,
      action: `STOCK_${movement_type}`,
      entityType: 'INGREDIENT',
      entityId: ingredient_id,
      newValues: { movement_type, quantity_change, reason }
    });

    res.json({
      success: true,
      message: 'บันทึกการปรับปรุงสต๊อกเรียบร้อยแล้ว',
      data: result
    });
  } catch (err: any) {
    res.status(400).json({ success: false, message: err.message || 'เกิดข้อผิดพลาด' });
  }
});

// ==========================================
// 3. STOCK MOVEMENTS LOG (ประวัติการเคลื่อนไหว)
// ==========================================

inventoryRouter.get('/movements', (req, res) => {
  const { ingredient_id, movement_type, start_date, end_date, limit = 50 } = req.query;

  let query = `
    SELECT m.*, i.name as ingredient_name, i.code as ingredient_code, i.unit, u.full_name as created_by_name
    FROM inventory_movements m
    JOIN ingredients i ON i.id = m.ingredient_id
    LEFT JOIN users u ON u.id = m.created_by
    WHERE 1=1
  `;
  const params: any[] = [];

  if (ingredient_id) {
    query += ` AND m.ingredient_id = ?`;
    params.push(ingredient_id);
  }
  if (movement_type) {
    query += ` AND m.movement_type = ?`;
    params.push(movement_type);
  }
  if (start_date) {
    query += ` AND date(m.created_at) >= date(?)`;
    params.push(start_date);
  }
  if (end_date) {
    query += ` AND date(m.created_at) <= date(?)`;
    params.push(end_date);
  }

  query += ` ORDER BY m.id DESC LIMIT ?`;
  params.push(Number(limit));

  const movements = db.prepare(query).all(...params);
  res.json({ success: true, data: movements });
});

// ==========================================
// 4. STOCK COUNT AUDIT (ตรวจนับสต๊อก)
// ==========================================

// List count sessions
inventoryRouter.get('/counts', (req, res) => {
  const counts = db.prepare(`
    SELECT sc.*, u.full_name as counted_by_name
    FROM stock_counts sc
    LEFT JOIN users u ON u.id = sc.counted_by
    ORDER BY sc.id DESC
  `).all();
  res.json({ success: true, data: counts });
});

// Get count session details
inventoryRouter.get('/counts/:id', (req, res) => {
  const id = Number(req.params.id);
  const count = db.prepare(`
    SELECT sc.*, u.full_name as counted_by_name
    FROM stock_counts sc
    LEFT JOIN users u ON u.id = sc.counted_by
    WHERE sc.id = ?
  `).get(id) as any;

  if (!count) return res.status(404).json({ success: false, message: 'ไม่พบรายการตรวจนับ' });

  const items = db.prepare(`
    SELECT sci.*, i.name as ingredient_name, i.code as ingredient_code, i.unit
    FROM stock_count_items sci
    JOIN ingredients i ON i.id = sci.ingredient_id
    WHERE sci.stock_count_id = ?
  `).all(id);

  res.json({ success: true, data: { ...count, items } });
});

// Create and confirm stock count
inventoryRouter.post('/counts', requireRole('OWNER', 'STOCK_MANAGER'), (req, res) => {
  const {
    count_date = new Date().toISOString(),
    note,
    items = [] // Array of { ingredient_id, counted_quantity }
  } = req.body;

  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ success: false, message: 'กรุณาระบุผลการตรวจนับอย่างน้อย 1 รายการ' });
  }

  try {
    const result = runTransaction(() => {
      const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      const countNo = `CNT-${today}-${Date.now().toString().slice(-4)}`;
      const userId = req.user?.id || 1;

      let totalVarianceValue = 0;

      // 1. Create Stock Count header
      const info = db.prepare(`
        INSERT INTO stock_counts (count_no, count_date, status, note, counted_by, confirmed_at)
        VALUES (?, ?, 'CONFIRMED', ?, ?, datetime('now', 'localtime'))
      `).run(countNo, count_date, note || null, userId);

      const countId = Number(info.lastInsertRowid);

      const insertItemStmt = db.prepare(`
        INSERT INTO stock_count_items (
          stock_count_id, ingredient_id, system_quantity, counted_quantity,
          variance_quantity, unit_cost, variance_value
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `);

      const getIngStmt = db.prepare('SELECT current_stock, cost_per_unit FROM ingredients WHERE id = ?');
      const updateStockStmt = db.prepare(`UPDATE ingredients SET current_stock = ?, updated_at = datetime('now', 'localtime') WHERE id = ?`);
      const insertMovementStmt = db.prepare(`
        INSERT INTO inventory_movements (
          ingredient_id, movement_type, reference_type, reference_id,
          quantity_change, quantity_before, quantity_after, unit_cost, reason, note, created_by
        ) VALUES (?, 'COUNT_VARIANCE', 'STOCK_COUNT', ?, ?, ?, ?, ?, 'ปรับยอดจากการตรวจนับสต๊อก', ?, ?)
      `);

      for (const it of items) {
        const cur = getIngStmt.get(it.ingredient_id) as { current_stock: number; cost_per_unit: number };
        if (!cur) continue;

        const systemQty = cur.current_stock;
        const countedQty = Number(it.counted_quantity);
        const varianceQty = countedQty - systemQty;
        const varianceVal = Math.round(varianceQty * cur.cost_per_unit);
        totalVarianceValue += varianceVal;

        insertItemStmt.run(countId, it.ingredient_id, systemQty, countedQty, varianceQty, cur.cost_per_unit, varianceVal);

        // Update actual stock
        updateStockStmt.run(countedQty, it.ingredient_id);

        // Record movement if there's any discrepancy
        if (varianceQty !== 0) {
          insertMovementStmt.run(
            it.ingredient_id,
            countId,
            varianceQty,
            systemQty,
            countedQty,
            cur.cost_per_unit,
            `เอกสารตรวจนับเลขที่ ${countNo}`,
            userId
          );
        }
      }

      // Update total variance on header
      db.prepare('UPDATE stock_counts SET total_variance_value = ? WHERE id = ?').run(totalVarianceValue, countId);

      return { countId, countNo, totalVarianceValue };
    });

    logAudit({
      userId: req.user?.id,
      action: 'CONFIRM_STOCK_COUNT',
      entityType: 'STOCK_COUNT',
      entityId: result.countId,
      newValues: { countNo: result.countNo, totalVarianceValue: result.totalVarianceValue }
    });

    res.status(201).json({
      success: true,
      message: 'บันทึกและปรับปรุงยอดตามผลการตรวจนับเรียบร้อยแล้ว',
      data: result
    });
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ success: false, message: 'เกิดข้อผิดพลาดในการบันทึกการตรวจนับ' });
  }
});
