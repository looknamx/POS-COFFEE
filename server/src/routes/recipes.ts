import { Router } from 'express';
import { db, runTransaction } from '../db/index.js';
import { requireRole } from '../middleware/auth.js';
import { logAudit } from '../services/auditService.js';

export const recipesRouter = Router();

// List all recipes with cost & profit calculations
recipesRouter.get('/', (req, res) => {
  const recipes = db.prepare(`
    SELECT r.*, 
           p.name as product_name, p.sku as product_sku, p.base_price,
           pv.name as variant_name, pv.price_adjustment as variant_price_adjustment,
           po.name as option_name, po.price_adjustment as option_price_adjustment
    FROM recipes r
    LEFT JOIN products p ON p.id = r.product_id
    LEFT JOIN product_variants pv ON pv.id = r.variant_id
    LEFT JOIN product_options po ON po.id = r.option_id
    ORDER BY p.name ASC, r.id ASC
  `).all() as any[];

  const getItemsStmt = db.prepare(`
    SELECT ri.*, i.name as ingredient_name, i.code as ingredient_code, 
           i.unit as ingredient_unit, i.cost_per_unit, i.current_stock
    FROM recipe_items ri
    JOIN ingredients i ON i.id = ri.ingredient_id
    WHERE ri.recipe_id = ?
  `);

  const fullRecipes = recipes.map((rec) => {
    const items = getItemsStmt.all(rec.id) as any[];

    // Calculate total cost of recipe
    let totalCostSatang = 0;
    const enrichedItems = items.map((it) => {
      const itemCost = Math.round(it.quantity * it.cost_per_unit);
      totalCostSatang += itemCost;
      return {
        ...it,
        line_cost: itemCost
      };
    });

    // Selling price
    let sellingPrice = rec.base_price || 0;
    if (rec.variant_price_adjustment) sellingPrice += rec.variant_price_adjustment;
    if (rec.option_price_adjustment) sellingPrice += rec.option_price_adjustment;

    const grossProfitSatang = sellingPrice - totalCostSatang;
    const marginPercent = sellingPrice > 0 ? ((grossProfitSatang / sellingPrice) * 100).toFixed(1) : 0;

    return {
      ...rec,
      items: enrichedItems,
      total_cost: totalCostSatang,
      selling_price: sellingPrice,
      gross_profit: grossProfitSatang,
      margin_percent: Number(marginPercent)
    };
  });

  res.json({ success: true, data: fullRecipes });
});

// Get recipe by product ID
recipesRouter.get('/product/:productId', (req, res) => {
  const productId = Number(req.params.productId);
  const recipes = db.prepare(`
    SELECT r.*, pv.name as variant_name
    FROM recipes r
    LEFT JOIN product_variants pv ON pv.id = r.variant_id
    WHERE r.product_id = ?
  `).all(productId) as any[];

  const getItemsStmt = db.prepare(`
    SELECT ri.*, i.name as ingredient_name, i.unit as ingredient_unit, i.cost_per_unit, i.current_stock
    FROM recipe_items ri
    JOIN ingredients i ON i.id = ri.ingredient_id
    WHERE ri.recipe_id = ?
  `);

  const detailed = recipes.map((r) => ({
    ...r,
    items: getItemsStmt.all(r.id)
  }));

  res.json({ success: true, data: detailed });
});

// Create or update recipe
recipesRouter.post('/', requireRole('OWNER', 'STOCK_MANAGER'), (req, res) => {
  const {
    id, // Optional, if updating
    product_id,
    variant_id,
    option_id,
    name,
    yield_quantity = 1,
    items = [] // Array of { ingredient_id, quantity, unit }
  } = req.body;

  if (!product_id && !option_id) {
    return res.status(400).json({ success: false, message: 'กรุณาระบุสินค้าหรือตัวเลือกสำหรับสูตรนี้' });
  }

  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ success: false, message: 'กรุณาระบุวัตถุดิบในสูตรอย่างน้อย 1 รายการ' });
  }

  try {
    const recipeId = runTransaction(() => {
      let rId = id;
      if (rId) {
        db.prepare(`
          UPDATE recipes
          SET product_id = ?, variant_id = ?, option_id = ?, name = ?, yield_quantity = ?, updated_at = datetime('now', 'localtime')
          WHERE id = ?
        `).run(product_id || null, variant_id || null, option_id || null, name, yield_quantity, rId);

        // Remove old items
        db.prepare('DELETE FROM recipe_items WHERE recipe_id = ?').run(rId);
      } else {
        const info = db.prepare(`
          INSERT INTO recipes (product_id, variant_id, option_id, name, yield_quantity)
          VALUES (?, ?, ?, ?, ?)
        `).run(product_id || null, variant_id || null, option_id || null, name, yield_quantity);
        rId = info.lastInsertRowid;
      }

      // Insert items
      const insertItemStmt = db.prepare(`
        INSERT INTO recipe_items (recipe_id, ingredient_id, quantity, unit)
        VALUES (?, ?, ?, ?)
      `);

      for (const it of items) {
        if (it.ingredient_id && it.quantity > 0) {
          insertItemStmt.run(rId, it.ingredient_id, Number(it.quantity), it.unit || 'g');
        }
      }

      // Automatically recalculate product estimated cost_price
      if (product_id) {
        const costCalc = db.prepare(`
          SELECT SUM(ri.quantity * i.cost_per_unit) as calculated_cost
          FROM recipe_items ri
          JOIN ingredients i ON i.id = ri.ingredient_id
          WHERE ri.recipe_id = ?
        `).get(rId) as { calculated_cost: number } | undefined;

        if (costCalc && costCalc.calculated_cost) {
          db.prepare(`UPDATE products SET cost_price = ?, updated_at = datetime('now', 'localtime') WHERE id = ?`)
            .run(Math.round(costCalc.calculated_cost), product_id);
        }
      }

      return rId;
    });

    logAudit({
      userId: req.user?.id,
      action: id ? 'UPDATE_RECIPE' : 'CREATE_RECIPE',
      entityType: 'RECIPE',
      entityId: recipeId,
      newValues: { product_id, name, itemCount: items.length }
    });

    res.status(201).json({ success: true, message: 'บันทึกสูตรเครื่องดื่มเรียบร้อยแล้ว', recipeId });
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ success: false, message: 'เกิดข้อผิดพลาดในการบันทึกสูตร' });
  }
});

// Delete recipe
recipesRouter.delete('/:id', requireRole('OWNER', 'STOCK_MANAGER'), (req, res) => {
  const id = Number(req.params.id);
  db.prepare('DELETE FROM recipes WHERE id = ?').run(id);
  res.json({ success: true, message: 'ลบสูตรเครื่องดื่มเรียบร้อยแล้ว' });
});
