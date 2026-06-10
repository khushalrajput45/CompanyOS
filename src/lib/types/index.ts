export type UserRole = "admin" | "manager" | "employee";

export interface Profile {
  id: string;
  organization_id: string;
  full_name: string;
  role: UserRole;
  email: string;
  created_at: string;
}

export interface Organization {
  id: string;
  name: string;
  slug: string;
  created_at: string;
}

export interface Brand {
  id: string;
  organization_id: string;
  name: string;
  created_at: string;
}

export interface Category {
  id: string;
  organization_id: string;
  name: string;
  parent_id: string | null;
  created_at: string;
}

export interface Vendor {
  id: string;
  organization_id: string;
  name: string;
  contact_name: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  gstin: string | null;
  is_active: boolean;
  created_at: string;
}

export interface Location {
  id: string;
  organization_id: string;
  name: string;
  type: "warehouse" | "store" | "transit";
  is_active: boolean;
  created_at: string;
}

export interface Product {
  id: string;
  organization_id: string;
  sku: string;
  name: string;
  description: string | null;
  brand_id: string | null;
  category_id: string | null;
  unit: string;
  cost_price: number | null;
  selling_price: number;
  mrp: number | null;
  reorder_point: number;
  reorder_qty: number;
  warranty_months: number | null;
  hsn_code: string | null;
  is_active: boolean;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
  brand?: Brand;
  category?: Category;
}

export interface StockLevel {
  id: string;
  product_id: string;
  location_id: string;
  quantity: number;
  updated_at: string;
  product?: Product;
  location?: Location;
}

export interface StockMovement {
  id: string;
  organization_id: string;
  product_id: string;
  location_id: string;
  movement_type:
    | "receipt"
    | "sale"
    | "transfer_in"
    | "transfer_out"
    | "adjustment"
    | "return"
    | "damage";
  quantity: number;
  reference_no: string | null;
  vendor_id: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  product?: Product;
  location?: Location;
  vendor?: Vendor;
}

export interface PriceHistory {
  id: string;
  product_id: string;
  old_selling_price: number | null;
  new_selling_price: number;
  old_cost_price: number | null;
  new_cost_price: number | null;
  reason: string | null;
  changed_by: string | null;
  created_at: string;
  product?: Product;
}

export interface ImportLog {
  id: string;
  organization_id: string;
  file_name: string;
  import_type: string;
  total_rows: number;
  success_rows: number;
  error_rows: number;
  errors: unknown;
  created_by: string | null;
  created_at: string;
}

export interface DashboardKPIs {
  inventoryValue: number;
  lowStockCount: number;
  outOfStockCount: number;
  deadStockCount: number;
  totalProducts: number;
  totalLocations: number;
}
