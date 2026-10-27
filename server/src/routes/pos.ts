import { Router } from 'express';
import { db, runTransaction } from '../db/index.js';
import { InventoryService } from '../services/inventoryService.js';
import { logAudit } from '../services/auditService.js';
import {
  getInstalledPrinters,
  executeDirectPrint,
  generatePlainTextReceipt
} from '../services/printerService.js';

export const posRouter = Router();

// List installed Windows printers for direct print configuration
posRouter.get('/printers', async (req, res) => {
  try {
    const printers = await getInstalledPrinters();
    res.json({ success: true, data: printers });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message || 'ไม่สามารถค้นหาเครื่องพิมพ์ได้' });
  }
});

// Direct print receipt without browser dialog
posRouter.post('/print-receipt', async (req, res) => {
  try {
    const result = await executeDirectPrint(req.body);
    res.json(result);
  } catch (err: any) {
    console.error('Direct print error:', err);
    res.status(500).json({ success: false, message: err.message || 'เกิดข้อผิดพลาดในการพิมพ์ใบเสร็จ' });
  }
});

// Test print endpoint
posRouter.post('/test-print', async (req, res) => {
  try {
    const result = await executeDirectPrint({
      ...req.body,
      saleId: undefined
    });
    res.json(result);
  } catch (err: any) {
    console.error('Test print error:', err);
    res.status(500).json({ success: false, message: err.message || 'เกิดข้อผิดพลาดในการทดสอบพิมพ์' });
  }
});

interface CartItemInput {
  productId: number;
  variantId?: number | null;
  optionIds?: number[];
  quantity: number;
  note?: string;
  itemDiscount?: number; // In satang
}

// Generate unique sequential bill number for today
function generateBillNo(): string {
  const prefix = InventoryService.getSetting('bill_prefix', 'INV');
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  const dateStr = `${year}${month}${day}`;

  const row = db.prepare(`
    SELECT COUNT(*) as count 
    FROM sales 
    WHERE bill_no LIKE ?
  `).get(`${prefix}-${dateStr}-%`) as { count: number };

  const nextSeq = (row?.count || 0) + 1;
  return `${prefix}-${dateStr}-${String(nextSeq).padStart(4, '0')}`;
}

// Checkout endpoint
posRouter.post('/checkout', (req, res) => {
  const {
    items,
    paymentMethod, // 'CASH' | 'QR_PROMPT_PAY' | 'CREDIT_CARD' | 'TRANSFER'
    receivedAmount, // In satang
    billDiscount = 0, // In satang
    discountType = 'FIXED',
    customerNote,
    idempotencyKey
  } = req.body as {
    items: CartItemInput[];
    paymentMethod: string;
    receivedAmount: number;
    billDiscount?: number;
    discountType?: string;
    customerNote?: string;
    idempotencyKey?: string;
  };

  // 1. Basic validation
  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ success: false, message: 'ตะกร้าสินค้าว่างเปล่า' });
  }

  // 2. Check Idempotency (prevent duplicate checkout requests)
  if (idempotencyKey) {
    const existingSale = db.prepare('SELECT * FROM sales WHERE idempotency_key = ?').get(idempotencyKey) as any;
    if (existingSale) {
      const saleItems = db.prepare('SELECT * FROM sale_items WHERE sale_id = ?').all(existingSale.id);
      return res.json({
        success: true,
        message: 'รายการนี้ได้รับการชำระเงินแล้ว (คำขอซ้ำ)',
        data: {
          ...existingSale,
          items: saleItems
        }
      });
    }
  }

  try {
    // 3. Re-verify each item against DB (Security: Client cannot manipulate price)
    let subtotal = 0;
    const validatedItems: any[] = [];

    const getProdStmt = db.prepare('SELECT * FROM products WHERE id = ? AND is_active = 1');
    const getVarStmt = db.prepare('SELECT * FROM product_variants WHERE id = ? AND product_id = ? AND is_active = 1');
    const getOptStmt = db.prepare('SELECT * FROM product_options WHERE id = ?');

    for (const item of items) {
      if (!item.quantity || item.quantity <= 0) {
        return res.status(400).json({ success: false, message: 'จำนวนสินค้าต้องมากกว่า 0' });
      }

      const product = getProdStmt.get(item.productId) as any;
      if (!product) {
        return res.status(400).json({ success: false, message: `ไม่พบสินค้า ID ${item.productId} หรือสินค้านี้ถูกปิดการขายแล้ว` });
      }

      let unitPrice = product.base_price;
      let variantName: string | null = null;

      if (item.variantId) {
        const variant = getVarStmt.get(item.variantId, item.productId) as any;
        if (variant) {
          unitPrice += variant.price_adjustment;
          variantName = variant.name;
        }
      }

      const selectedOptions: any[] = [];
      if (Array.isArray(item.optionIds) && item.optionIds.length > 0) {
        for (const optId of item.optionIds) {
          const opt = getOptStmt.get(optId) as any;
          if (opt) {
            unitPrice += opt.price_adjustment;
            selectedOptions.push({
              id: opt.id,
              name: opt.name,
              price_adjustment: opt.price_adjustment
            });
          }
        }
      }

      const itemDiscount = Math.max(0, Math.round(item.itemDiscount || 0));
      const lineSubtotal = unitPrice * item.quantity;
      const lineNetTotal = Math.max(0, lineSubtotal - itemDiscount);

      subtotal += lineNetTotal;

      validatedItems.push({
        productId: product.id,
        productSku: product.sku,
        productName: product.name,
        costPrice: product.cost_price || 0,
        variantId: item.variantId || null,
        variantName,
        quantity: item.quantity,
        unitPrice,
        subtotal: lineSubtotal,
        discountAmount: itemDiscount,
        netTotal: lineNetTotal,
        note: item.note || null,
        options: selectedOptions
      });
    }

    // 4. Calculate Net Total
    const finalDiscount = Math.max(0, Math.round(billDiscount || 0));
    const netTotal = Math.max(0, subtotal - finalDiscount);

    // 5. Check Received Amount for Cash Payment
    const received = Math.round(receivedAmount || netTotal);
    if (paymentMethod === 'CASH' && received < netTotal) {
      return res.status(400).json({
        success: false,
        message: `จำนวนเงินที่รับ (${(received / 100).toFixed(2)} บาท) ไม่เพียงพอกับยอดชำระ (${(netTotal / 100).toFixed(2)} บาท)`
      });
    }
    const changeAmount = paymentMethod === 'CASH' ? Math.max(0, received - netTotal) : 0;

    // 6. Recipe Stock Requirements & Availability Verification
    const recipeRequirements = InventoryService.calculateRecipeRequirements(
      items.map((it) => ({
        productId: it.productId,
        variantId: it.variantId,
        optionIds: it.optionIds,
        quantity: it.quantity
      }))
    );

    // Throws error if shortage and negative stock not allowed
    InventoryService.validateStockSufficiency(recipeRequirements);

    // 7. Atomic Database Transaction: Save Sale, Items, Options, Payment, and Deduct Stock
    const saleResult = runTransaction(() => {
      const billNo = generateBillNo();
      const saleDate = new Date().toISOString();
      const cashierId = req.user?.id || 1;

      // 7.1 Insert Sale Header
      const saleInfo = db.prepare(`
        INSERT INTO sales (
          bill_no, sale_date, subtotal, discount_amount, discount_type,
          net_total, payment_method, received_amount, change_amount,
          status, cashier_id, customer_note, idempotency_key
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'COMPLETED', ?, ?, ?)
      `).run(
        billNo,
        saleDate,
        subtotal,
        finalDiscount,
        discountType,
        netTotal,
        paymentMethod,
        received,
        changeAmount,
        cashierId,
        customerNote || null,
        idempotencyKey || null
      );

      const saleId = Number(saleInfo.lastInsertRowid);

      // 7.2 Insert Sale Items & Item Options
      const insertItemStmt = db.prepare(`
        INSERT INTO sale_items (
          sale_id, product_id, product_sku, product_name,
          variant_id, variant_name, quantity, unit_price, cost_price,
          subtotal, discount_amount, net_total, note
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      const insertOptStmt = db.prepare(`
        INSERT INTO sale_item_options (
          sale_item_id, option_id, option_name, price_adjustment
        ) VALUES (?, ?, ?, ?)
      `);

      for (const vi of validatedItems) {
        const itemInfo = insertItemStmt.run(
          saleId,
          vi.productId,
          vi.productSku,
          vi.productName,
          vi.variantId,
          vi.variantName,
          vi.quantity,
          vi.unitPrice,
          vi.costPrice,
          vi.subtotal,
          vi.discountAmount,
          vi.netTotal,
          vi.note
        );

        const saleItemId = Number(itemInfo.lastInsertRowid);
        for (const opt of vi.options) {
          insertOptStmt.run(saleItemId, opt.id, opt.name, opt.price_adjustment);
        }
      }

      // 7.3 Insert Payment Record
      db.prepare(`
        INSERT INTO payments (
          sale_id, payment_method, amount, received_amount, change_amount, status
        ) VALUES (?, ?, ?, ?, ?, 'SUCCESS')
      `).run(saleId, paymentMethod, netTotal, received, changeAmount);

      // 7.4 Deduct Inventory & Record Movements
      InventoryService.deductForSale(recipeRequirements, saleId, billNo, cashierId);

      return {
        saleId,
        billNo,
        saleDate,
        subtotal,
        discountAmount: finalDiscount,
        netTotal,
        paymentMethod,
        receivedAmount: received,
        changeAmount,
        items: validatedItems,
        cashierName: req.user?.fullName || 'พนักงานขาย'
      };
    });

    logAudit({
      userId: req.user?.id,
      action: 'SALE_COMPLETED',
      entityType: 'SALE',
      entityId: saleResult.saleId,
      newValues: { billNo: saleResult.billNo, netTotal: saleResult.netTotal, paymentMethod }
    });

    res.status(201).json({
      success: true,
      message: 'บันทึกการขายสำเร็จ',
      data: saleResult
    });
  } catch (err: any) {
    console.error('Checkout error:', err);
    res.status(400).json({
      success: false,
      message: err.message || 'เกิดข้อผิดพลาดในการประมวลผลการขาย'
    });
  }
});

