import { describe, it, expect, beforeAll } from 'vitest';
import { db, runTransaction } from '../db/index.js';
import { seedDatabase } from '../db/seed.js';
import { InventoryService } from '../services/inventoryService.js';

describe('Coffee Shop POS & Inventory System Tests', () => {
  beforeAll(() => {
    seedDatabase();
  });

  it('1. Verifies products, variants, and recipes seeded properly', () => {
    const products = db.prepare('SELECT COUNT(*) as c FROM products').get() as { c: number };
    expect(products.c).toBeGreaterThanOrEqual(10);

    const ingredients = db.prepare('SELECT COUNT(*) as c FROM ingredients').get() as { c: number };
    expect(ingredients.c).toBeGreaterThanOrEqual(14);

    const recipes = db.prepare('SELECT COUNT(*) as c FROM recipes').get() as { c: number };
    expect(recipes.c).toBeGreaterThanOrEqual(5);
  });

  it('2. Calculates recipe requirements and cost accurately', () => {
    // Product ID 3 is Caffè Latte (requires 18g coffee, 120ml milk, 15ml syrup, 180g ice, 1 cup, 1 lid, 1 straw)
    const reqs = InventoryService.calculateRecipeRequirements([
      { productId: 3, quantity: 2 } // 2 glasses of Latte
    ]);

    // Check coffee beans requirement (18g * 2 = 36g)
    const coffeeReq = reqs.find((r) => r.ingredientName.includes('เมล็ดกาแฟ'));
    expect(coffeeReq).toBeDefined();
    expect(coffeeReq?.requiredQuantity).toBe(36);

    // Check milk requirement (120ml * 2 = 240ml)
    const milkReq = reqs.find((r) => r.ingredientName.includes('นมสด'));
    expect(milkReq).toBeDefined();
    expect(milkReq?.requiredQuantity).toBe(240);
  });

  it('3. Deducts inventory atomically when sale occurs', () => {
    const coffeeBefore = db.prepare('SELECT current_stock FROM ingredients WHERE code = ?').get('ING-COFFEE') as { current_stock: number };
    const initialCoffee = coffeeBefore.current_stock;

    // Americano (Product ID 2) requires 18g coffee
    // 3 x 18g = 54g
    const reqs = InventoryService.calculateRecipeRequirements([
      { productId: 2, quantity: 3 }
    ]);

    runTransaction(() => {
      InventoryService.deductForSale(reqs, 9999, 'TEST-BILL-001', 1);
    });

    const coffeeAfter = db.prepare('SELECT current_stock FROM ingredients WHERE code = ?').get('ING-COFFEE') as { current_stock: number };
    expect(coffeeAfter.current_stock).toBe(initialCoffee - 54);

    const movement = db.prepare(`
      SELECT * FROM inventory_movements 
      WHERE reference_id = 9999 AND movement_type = 'SALE'
      ORDER BY id DESC LIMIT 1
    `).get() as any;
    expect(movement).toBeDefined();
    expect(movement.reason).toContain('ตัดสต๊อกตามสูตรการขาย');
  });

  it('4. Blocks sale when inventory is insufficient (and allow_negative_stock=0)', () => {
    db.prepare('UPDATE store_settings SET value = ? WHERE key = ?').run('0', 'allow_negative_stock');

    const excessiveReqs = [{
      ingredientId: 1,
      ingredientName: 'เมล็ดกาแฟคั่วกลาง (Arabica)',
      unit: 'g',
      requiredQuantity: 999999,
      currentStock: 1000,
      costPerUnit: 50
    }];

    expect(() => {
      InventoryService.validateStockSufficiency(excessiveReqs);
    }).toThrow(/วัตถุดิบไม่เพียงพอ/);
  });

  it('5. Reverts inventory correctly upon bill cancellation / refund', () => {
    const coffeeBefore = db.prepare('SELECT current_stock FROM ingredients WHERE code = ?').get('ING-COFFEE') as { current_stock: number };
    const stockBeforeRefund = coffeeBefore.current_stock;

    // Revert sale 9999 (which deducted 54g coffee beans)
    runTransaction(() => {
      InventoryService.revertSaleStock(9999, 'TEST-BILL-001', 1, 'ทดสอบยกเลิกบิล');
    });

    const coffeeAfter = db.prepare('SELECT current_stock FROM ingredients WHERE code = ?').get('ING-COFFEE') as { current_stock: number };
    expect(coffeeAfter.current_stock).toBe(stockBeforeRefund + 54);

    const refundMovement = db.prepare(`
      SELECT * FROM inventory_movements 
      WHERE reference_id = 9999 AND movement_type = 'REFUND_RESTOCK'
    `).get() as any;
    expect(refundMovement).toBeDefined();
    expect(refundMovement.quantity_change).toBe(54);
  });

  it('6. Records manual stock adjustment / waste accurately', () => {
    const iceBefore = db.prepare('SELECT current_stock FROM ingredients WHERE code = ?').get('ING-ICE') as { current_stock: number };

    InventoryService.adjustStock({
      ingredientId: 9, // ING-ICE
      movementType: 'WASTE',
      quantityChange: -500,
      reason: 'น้ำแข็งละลายช่วงปิดร้าน',
      userId: 1
    });

    const iceAfter = db.prepare('SELECT current_stock FROM ingredients WHERE code = ?').get('ING-ICE') as { current_stock: number };
    expect(iceAfter.current_stock).toBe(iceBefore.current_stock - 500);
  });
});

