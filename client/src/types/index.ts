export interface ProductCategory {
  id: number;
  name: string;
  icon?: string;
  sort_order: number;
  is_active: number;
  product_count?: number;
}

export interface ProductVariant {
  id: number;
  product_id: number;
  name: string;
  price_adjustment: number; // satang
  sku_suffix?: string;
  is_active: number;
}

export interface ProductOption {
  id: number;
  group_id: number;
  name: string;
  price_adjustment: number; // satang
  is_default: number;
}

export interface ProductOptionGroup {
  id: number;
  product_id?: number | null;
  name: string;
  min_select: number;
  max_select: number;
  is_required: number;
  options: ProductOption[];
}

export interface Product {
  id: number;
  sku: string;
  name: string;
  category_id?: number;
  category_name?: string;
  image_url?: string;
  base_price: number; // satang
  cost_price: number; // satang
  has_recipe: number;
  has_configured_recipe?: boolean;
  is_bakery?: boolean;
  is_active: number;
  sort_order: number;
  variants: ProductVariant[];
  option_groups: ProductOptionGroup[];
}

export interface CartItem {
  cartItemId: string; // unique uuid for cart line
  product: Product;
  variant?: ProductVariant | null;
  selectedOptions: ProductOption[];
  quantity: number;
  unitPrice: number; // satang (base + variant + options)
  lineTotal: number; // satang (unitPrice * qty)
  note?: string;
}

export interface Ingredient {
  id: number;
  code: string;
  name: string;
  category_id?: number;
  category_name?: string;
  unit: string;
  current_stock: number;
  min_reorder_stock: number;
  cost_per_unit: number; // satang
  supplier_id?: number;
  supplier_name?: string;
  storage_location?: string;
  expiry_date?: string;
  is_active: number;
  stock_status: 'NORMAL' | 'LOW_STOCK' | 'OUT_OF_STOCK';
  total_valuation?: number;
}

export interface RecipeItem {
  id: number;
  recipe_id: number;
  ingredient_id: number;
  ingredient_name: string;
  ingredient_code: string;
  ingredient_unit: string;
  cost_per_unit: number;
  quantity: number;
  unit: string;
  line_cost: number; // satang
}

export interface Recipe {
  id: number;
  product_id?: number;
  product_name?: string;
  product_sku?: string;
  base_price?: number;
  variant_id?: number;
  variant_name?: string;
  option_id?: number;
  option_name?: string;
  name: string;
  yield_quantity: number;
  items: RecipeItem[];
  total_cost: number; // satang
  selling_price: number; // satang
  gross_profit: number; // satang
  margin_percent: number;
}

export interface SaleItemOption {
  id: number;
  option_name: string;
  price_adjustment: number;
}

export interface SaleItem {
  id: number;
  product_id: number;
  product_sku: string;
  product_name: string;
  variant_id?: number;
  variant_name?: string;
  quantity: number;
  unit_price: number;
  cost_price: number;
  subtotal: number;
  discount_amount: number;
  net_total: number;
  note?: string;
  options?: SaleItemOption[];
}

export interface Sale {
  id: number;
  bill_no: string;
  sale_date: string;
  subtotal: number;
  discount_amount: number;
  discount_type?: string;
  net_total: number;
  payment_method: 'CASH' | 'QR_PROMPT_PAY' | 'CREDIT_CARD' | 'TRANSFER';
  received_amount: number;
  change_amount: number;
  status: 'COMPLETED' | 'CANCELLED' | 'REFUNDED';
  cashier_id?: number;
  cashier_name?: string;
  customer_note?: string;
  cancel_reason?: string;
  cancelled_at?: string;
  cancelled_by_name?: string;
  items?: SaleItem[];
}

export interface Supplier {
  id: number;
  code: string;
  name: string;
  contact_name?: string;
  phone?: string;
  email?: string;
  address?: string;
  tax_id?: string;
  note?: string;
  total_receipts?: number;
  total_purchases?: number;
}

export interface PurchaseReceiptItem {
  id: number;
  purchase_receipt_id: number;
  ingredient_id: number;
  ingredient_name?: string;
  ingredient_code?: string;
  quantity: number;
  unit: string;
  unit_cost: number;
  total_cost: number;
}

export interface PurchaseReceipt {
  id: number;
  receipt_no: string;
  supplier_id?: number;
  supplier_name?: string;
  receipt_date: string;
  total_amount: number;
  note?: string;
  created_by_name?: string;
  status: 'DRAFT' | 'COMPLETED' | 'CANCELLED';
  items?: PurchaseReceiptItem[];
}

export interface Expense {
  id: number;
  expense_date: string;
  category_id?: number;
  category_name?: string;
  title: string;
  amount: number;
  payment_method: string;
  note?: string;
  created_by_name?: string;
}

export interface PromotionSlide {
  id: string;
  image_url: string;
  title?: string;
  subtitle?: string;
  badge?: string;
  is_active?: boolean;
}

export interface StoreSettings {
  store_name?: string;
  store_address?: string;
  store_phone?: string;
  tax_id?: string;
  receipt_footer?: string;
  promptpay_number?: string;
  bill_prefix?: string;
  allow_negative_stock?: string;
  currency?: string;
  low_stock_threshold?: string;
  promotion_slides?: string; // JSON string array of PromotionSlide
  slide_interval?: string; // in seconds, default '5'
  printer_type?: 'WINDOWS' | 'NETWORK';
  printer_name?: string;
  printer_ip?: string;
  printer_paper_width?: '58mm' | '80mm';
  printer_auto_cut?: string;
  printer_open_drawer?: string;
  printer_auto_print_checkout?: string;
  [key: string]: string | undefined;
}

export interface StaffUser {
  id: number;
  username: string;
  fullName: string;
  role: 'OWNER' | 'CASHIER' | 'STOCK_MANAGER';
}

