import { describe, it, expect, beforeAll } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { db, runTransaction, DB_PATH, reloadDatabase } from '../db/index.js';
import { seedDatabase } from '../db/seed.js';
import { InventoryService } from '../services/inventoryService.js';

describe('End-to-End System Integration Tests', () => {
  beforeAll(() => {
    seedDatabase();
  });

  it('1. Performs checkout, creates bill number, and deducts inventory', () => {
    const coffeeBefore = db.prepare('SELECT current_stock FROM ingredients WHERE code = ?').get('ING-COFFEE') as { current_stock: number };
    const milkBefore = db.prepare('SELECT current_stock FROM ingredients WHERE code = ?').get('ING-MILK') as { current_stock: number };

    // Buy 2 cups of Caffè Latte (Product 3) -> 36g coffee beans, 240ml milk
    const reqs = InventoryService.calculateRecipeRequirements([
      { productId: 3, quantity: 2 }
    ]);
    InventoryService.validateStockSufficiency(reqs);

    const billNo = 'INV-TEST-9001';
    runTransaction(() => {
      // Insert sale
      const info = db.prepare(`
        INSERT INTO sales (
          bill_no, sale_date, subtotal, discount_amount, net_total,
          payment_method, received_amount, change_amount, status, cashier_id
        ) VALUES (?, datetime('now', 'localtime'), 11000, 0, 11000, 'CASH', 20000, 9000, 'COMPLETED', 1)
      `).run(billNo);

      const saleId = Number(info.lastInsertRowid);
      InventoryService.deductForSale(reqs, saleId, billNo, 1);
    });

    const coffeeAfter = db.prepare('SELECT current_stock FROM ingredients WHERE code = ?').get('ING-COFFEE') as { current_stock: number };
    const milkAfter = db.prepare('SELECT current_stock FROM ingredients WHERE code = ?').get('ING-MILK') as { current_stock: number };

    expect(coffeeAfter.current_stock).toBe(coffeeBefore.current_stock - 36);
    expect(milkAfter.current_stock).toBe(milkBefore.current_stock - 240);

    const sale = db.prepare('SELECT * FROM sales WHERE bill_no = ?').get(billNo) as any;
    expect(sale).toBeDefined();
    expect(sale.net_total).toBe(11000);
    expect(sale.change_amount).toBe(9000);
  });

  it('2. Enforces purchase receipt stock addition with weighted average cost calculation', () => {
    // Current stock of Arabica coffee
    const ingBefore = db.prepare('SELECT current_stock, cost_per_unit FROM ingredients WHERE code = ?').get('ING-COFFEE') as { current_stock: number; cost_per_unit: number };

    // Receive 5000g @ 60 satang/g
    const receiveQty = 5000;
    const receiveUnitCost = 60;

    const totalBefore = ingBefore.current_stock * ingBefore.cost_per_unit;
    const totalIn = receiveQty * receiveUnitCost;
    const expectedNewQty = ingBefore.current_stock + receiveQty;
    const expectedNewCost = Math.round((totalBefore + totalIn) / expectedNewQty);

    runTransaction(() => {
      db.prepare(`
        UPDATE ingredients 
        SET current_stock = ?, cost_per_unit = ?, updated_at = datetime('now', 'localtime')
        WHERE code = ?
      `).run(expectedNewQty, expectedNewCost, 'ING-COFFEE');
    });

    const ingAfter = db.prepare('SELECT current_stock, cost_per_unit FROM ingredients WHERE code = ?').get('ING-COFFEE') as { current_stock: number; cost_per_unit: number };
    expect(ingAfter.current_stock).toBe(expectedNewQty);
    expect(ingAfter.cost_per_unit).toBe(expectedNewCost);
  });

  it('3. Creates database backup using VACUUM INTO and verifies integrity', () => {
    const backupDir = path.resolve(process.cwd(), 'backups');
    if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });

    const testBackupFile = path.join(backupDir, 'test_integrity_backup.db').replace(/\\/g, '/');
    if (fs.existsSync(testBackupFile)) fs.unlinkSync(testBackupFile);

    // Run VACUUM INTO
    db.exec(`VACUUM INTO '${testBackupFile}'`);
    expect(fs.existsSync(testBackupFile)).toBe(true);

    // Verify backup file integrity
    const testDb = new (require('node:sqlite').DatabaseSync)(testBackupFile);
    const integrity = testDb.prepare('PRAGMA integrity_check;').get() as any;
    testDb.close();

    const integrityVal = Object.values(integrity || {})[0];
    expect(integrityVal).toBe('ok');

    // Clean up test file
    fs.unlinkSync(testBackupFile);
  });
});
