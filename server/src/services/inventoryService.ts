import { db } from '../db/index.js';

export interface RequiredIngredient {
  ingredientId: number;
  ingredientName: string;
  unit: string;
  requiredQuantity: number;
  currentStock: number;
  costPerUnit: number;
}

export class InventoryService {
  /**
   * Get store setting value
   */
  static getSetting(key: string, defaultValue: string = ''): string {
    const row = db.prepare('SELECT value FROM store_settings WHERE key = ?').get(key) as { value: string } | undefined;
    return row ? row.value : defaultValue;
  }

  /**
   * Calculate required ingredients for a list of sale items (including variant & option add-ons)
   */
  static calculateRecipeRequirements(items: {
    productId: number;
    variantId?: number | null;
    optionIds?: number[];
    quantity: number;
  }[]): RequiredIngredient[] {
    const ingredientMap: Record<number, RequiredIngredient> = {};

    for (const item of items) {
      // 1. Check Product Recipe
      // Look for variant-specific recipe first, then fallback to product default recipe
      let recipeId: number | null = null;
      if (item.variantId) {
        const variantRecipe = db.prepare(`
          SELECT id FROM recipes 
          WHERE product_id = ? AND variant_id = ?
        `).get(item.productId, item.variantId) as { id: number } | undefined;
        if (variantRecipe) recipeId = variantRecipe.id;
      }

      if (!recipeId) {
        const prodRecipe = db.prepare(`
          SELECT id FROM recipes 
          WHERE product_id = ? AND (variant_id IS NULL OR variant_id = 0)
        `).get(item.productId) as { id: number } | undefined;
        if (prodRecipe) recipeId = prodRecipe.id;
      }

      if (recipeId) {
        const recipeItems = db.prepare(`
          SELECT ri.ingredient_id, ri.quantity, ri.unit, i.name, i.current_stock, i.cost_per_unit
          FROM recipe_items ri
          JOIN ingredients i ON i.id = ri.ingredient_id
          WHERE ri.recipe_id = ?
        `).all(recipeId) as any[];

        for (const ri of recipeItems) {
          const totalQty = ri.quantity * item.quantity;
          if (!ingredientMap[ri.ingredient_id]) {
            ingredientMap[ri.ingredient_id] = {
              ingredientId: ri.ingredient_id,
              ingredientName: ri.name,
              unit: ri.unit,
              requiredQuantity: totalQty,
              currentStock: ri.current_stock,
              costPerUnit: ri.cost_per_unit
            };
          } else {
            ingredientMap[ri.ingredient_id].requiredQuantity += totalQty;
          }
        }
      }

      // 2. Check Option Recipes (e.g. Extra Shot adding 18g coffee beans)
      if (item.optionIds && item.optionIds.length > 0) {
        for (const optId of item.optionIds) {
          const optRecipe = db.prepare(`
            SELECT id FROM recipes WHERE option_id = ?
          `).get(optId) as { id: number } | undefined;

          if (optRecipe) {
            const optItems = db.prepare(`
              SELECT ri.ingredient_id, ri.quantity, ri.unit, i.name, i.current_stock, i.cost_per_unit
              FROM recipe_items ri
              JOIN ingredients i ON i.id = ri.ingredient_id
              WHERE ri.recipe_id = ?
            `).all(optRecipe.id) as any[];

            for (const oi of optItems) {
              const totalQty = oi.quantity * item.quantity;
              if (!ingredientMap[oi.ingredient_id]) {
                ingredientMap[oi.ingredient_id] = {
                  ingredientId: oi.ingredient_id,
                  ingredientName: oi.name,
                  unit: oi.unit,
                  requiredQuantity: totalQty,
                  currentStock: oi.current_stock,
                  costPerUnit: oi.cost_per_unit
                };
              } else {
                ingredientMap[oi.ingredient_id].requiredQuantity += totalQty;
              }
            }
          }
        }
      }
    }

    return Object.values(ingredientMap);
  }

  /**
   * Validate stock sufficiency before sale
   */
  static validateStockSufficiency(requirements: RequiredIngredient[]) {
    const allowNegative = this.getSetting('allow_negative_stock', '0') === '1';
    if (allowNegative) return;

    const shortages: string[] = [];
    for (const req of requirements) {
      if (req.currentStock < req.requiredQuantity) {
        const diff = (req.requiredQuantity - req.currentStock).toFixed(1);
        shortages.push(`${req.ingredientName} (คงเหลือ ${req.currentStock} ${req.unit}, ขาดอีก ${diff} ${req.unit})`);
      }
    }

    if (shortages.length > 0) {
      throw new Error(`วัตถุดิบไม่เพียงพอสำหรับการขาย:\n- ${shortages.join('\n- ')}`);
    }
  }

  /**
   * Deduct inventory for completed sale (must be called inside transaction)
   */
  static deductForSale(requirements: RequiredIngredient[], saleId: number, billNo: string, userId?: number) {
    const updateStockStmt = db.prepare(`
      UPDATE ingredients 
      SET current_stock = current_stock - ?, updated_at = datetime('now', 'localtime')
      WHERE id = ?
    `);

    const insertMovementStmt = db.prepare(`
      INSERT INTO inventory_movements (
        ingredient_id, movement_type, reference_type, reference_id,
        quantity_change, quantity_before, quantity_after, unit_cost, reason, note, created_by
      ) VALUES (?, 'SALE', 'SALE', ?, ?, ?, ?, ?, 'ตัดสต๊อกตามสูตรการขาย', ?, ?)
    `);

    for (const req of requirements) {
      const current = db.prepare('SELECT current_stock FROM ingredients WHERE id = ?').get(req.ingredientId) as { current_stock: number };
      const beforeQty = current ? current.current_stock : 0;
      const afterQty = beforeQty - req.requiredQuantity;

      updateStockStmt.run(req.requiredQuantity, req.ingredientId);
      insertMovementStmt.run(
        req.ingredientId,
        saleId,
        -req.requiredQuantity,
        beforeQty,
        afterQty,
        req.costPerUnit,
        `บิลเลขที่ ${billNo}`,
        userId ?? null
      );
    }
  }

  /**
   * Revert inventory for refunded or cancelled sale
   */
  static revertSaleStock(saleId: number, billNo: string, userId?: number, reason: string = 'ยกเลิกบิลขาย') {
    // Find all inventory movements created for this sale
    const movements = db.prepare(`
      SELECT ingredient_id, quantity_change, unit_cost 
      FROM inventory_movements 
      WHERE reference_type = 'SALE' AND reference_id = ? AND movement_type = 'SALE'
    `).all(saleId) as { ingredient_id: number; quantity_change: number; unit_cost: number }[];

    if (movements.length === 0) return;

    const updateStockStmt = db.prepare(`
      UPDATE ingredients 
      SET current_stock = current_stock + ?, updated_at = datetime('now', 'localtime')
      WHERE id = ?
    `);

    const insertMovementStmt = db.prepare(`
      INSERT INTO inventory_movements (
        ingredient_id, movement_type, reference_type, reference_id,
        quantity_change, quantity_before, quantity_after, unit_cost, reason, note, created_by
      ) VALUES (?, 'REFUND_RESTOCK', 'SALE', ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (const m of movements) {
      const restoreQty = Math.abs(m.quantity_change);
      const current = db.prepare('SELECT current_stock FROM ingredients WHERE id = ?').get(m.ingredient_id) as { current_stock: number };
      const beforeQty = current ? current.current_stock : 0;
      const afterQty = beforeQty + restoreQty;

      updateStockStmt.run(restoreQty, m.ingredient_id);
      insertMovementStmt.run(
        m.ingredient_id,
        saleId,
        restoreQty,
        beforeQty,
        afterQty,
        m.unit_cost,
        reason,
        `คืนสต๊อกบิลเลขที่ ${billNo}`,
        userId ?? null
      );
    }
  }

  /**
   * Record manual stock adjustment / waste
   */
  static adjustStock(params: {
    ingredientId: number;
    movementType: 'USAGE' | 'WASTE' | 'ADJUSTMENT';
    quantityChange: number; // negative for usage/waste, positive/negative for adjustment
    reason: string;
    note?: string;
    userId?: number;
  }) {
    const current = db.prepare('SELECT current_stock, cost_per_unit FROM ingredients WHERE id = ?').get(params.ingredientId) as { current_stock: number; cost_per_unit: number } | undefined;
    if (!current) throw new Error('ไม่พบวัตถุดิบที่ระบุ');

    const beforeQty = current.current_stock;
    const afterQty = beforeQty + params.quantityChange;

    db.prepare(`
      UPDATE ingredients 
      SET current_stock = ?, updated_at = datetime('now', 'localtime')
      WHERE id = ?
    `).run(afterQty, params.ingredientId);

    db.prepare(`
      INSERT INTO inventory_movements (
        ingredient_id, movement_type, reference_type, reference_id,
        quantity_change, quantity_before, quantity_after, unit_cost, reason, note, created_by
      ) VALUES (?, ?, 'MANUAL', NULL, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      params.ingredientId,
      params.movementType,
      params.quantityChange,
      beforeQty,
      afterQty,
      current.cost_per_unit,
      params.reason,
      params.note ?? null,
      params.userId ?? null
    );

    return { beforeQty, afterQty };
  }
}

