export type UserRole = "owner" | "admin" | "manager" | "employee" | "viewer";

export interface Profile {
  id: string;
  organization_id: string;
  full_name: string;
  role: UserRole;
  email: string;
  is_disabled: boolean;
  is_owner: boolean;
  last_login_at: string | null;
  created_at: string;
}

export interface Invitation {
  id: string;
  organization_id: string;
  email: string;
  full_name: string;
  role: UserRole;
  token: string;
  invited_by: string | null;
  user_id: string | null;
  expires_at: string;
  accepted_at: string | null;
  cancelled_at: string | null;
  resent_at: string | null;
  resent_count: number;
  created_at: string;
  inviter?: { full_name: string } | null;
}

export interface Organization {
  id: string;
  name: string;
  slug: string;
  onboarding_completed: boolean;
  created_at: string;
}

export interface Brand {
  id: string;
  organization_id: string;
  name: string;
  deleted_at: string | null;
  created_at: string;
}

export interface Category {
  id: string;
  organization_id: string;
  name: string;
  parent_id: string | null;
  deleted_at: string | null;
  created_at: string;
}

export interface Vendor {
  id: string;
  organization_id: string;
  name: string;
  company_name: string | null;
  contact_person: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  pincode: string | null;
  gst_number: string | null;
  notes: string | null;
  is_active: boolean;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Customer {
  id: string;
  organization_id: string;
  name: string;
  company_name: string | null;
  gst_number: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  pincode: string | null;
  notes: string | null;
  is_active: boolean;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
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
  tax_rate: number | null;
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
  unit_price: number | null;
  discount_amount: number | null;
  reference_no: string | null;
  vendor_id: string | null;
  customer_id: string | null;
  document_id: string | null;
  document_type: "invoice" | "purchase_order" | "quotation" | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  product?: Product;
  location?: Location;
  vendor?: Vendor;
  customer?: Customer;
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

export type QuotationStatus = "draft" | "sent" | "accepted" | "rejected" | "expired";

export interface QuotationItem {
  id: string;
  quotation_id: string;
  product_id: string | null;
  description: string;
  quantity: number;
  unit_price: number;
  tax_rate: number;
  line_total: number;
  sort_order: number;
  product?: Product;
}

export interface Quotation {
  id: string;
  organization_id: string;
  quotation_number: string;
  customer_id: string;
  quotation_date: string;
  valid_until: string | null;
  subtotal: number;
  tax_amount: number;
  total_amount: number;
  status: QuotationStatus;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  customer?: Customer;
  items?: QuotationItem[];
}

export type InvoiceStatus = "draft" | "sent" | "paid" | "partial" | "overdue";

export interface InvoiceItem {
  id: string;
  invoice_id: string;
  product_id: string | null;
  description: string;
  quantity: number;
  unit_price: number;
  tax_rate: number;
  line_total: number;
  sort_order: number;
  product?: Product;
}

export interface InvoicePayment {
  id: string;
  organization_id: string;
  invoice_id: string;
  amount: number;
  payment_date: string;
  payment_method: "cash" | "bank_transfer" | "cheque" | "upi" | "other";
  notes: string | null;
  created_by: string | null;
  created_at: string;
}

export interface Invoice {
  id: string;
  organization_id: string;
  invoice_number: string;
  quotation_id: string | null;
  customer_id: string;
  invoice_date: string;
  due_date: string | null;
  subtotal: number;
  tax_amount: number;
  total_amount: number;
  amount_paid: number;
  status: InvoiceStatus;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  customer?: Customer;
  items?: InvoiceItem[];
}

export type POStatus = "draft" | "sent" | "partial" | "received" | "cancelled";

export interface PurchaseOrderItem {
  id: string;
  purchase_order_id: string;
  product_id: string | null;
  description: string;
  quantity: number;
  received_qty: number;
  unit_cost: number;
  tax_rate: number;
  line_total: number;
  sort_order: number;
  product?: Product;
}

export type POPaymentStatus = "pending" | "partial" | "paid";

export interface PurchaseOrder {
  id: string;
  organization_id: string;
  po_number: string;
  vendor_id: string | null;
  po_date: string;
  expected_date: string | null;
  status: POStatus;
  subtotal: number;
  tax_amount: number;
  total_amount: number;
  amount_paid: number;
  payment_status: POPaymentStatus;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  vendor?: Vendor;
  items?: PurchaseOrderItem[];
}

export interface POReceipt {
  id: string;
  organization_id: string;
  purchase_order_id: string;
  grn_number: string;
  receipt_date: string;
  notes: string | null;
  created_by: string | null;
  created_at: string;
}

export interface POReceiptItem {
  id: string;
  receipt_id: string;
  po_item_id: string;
  product_id: string | null;
  location_id: string | null;
  quantity: number;
  product?: { id: string; sku: string; name: string };
  location?: { id: string; name: string };
}

export interface VendorPayment {
  id: string;
  organization_id: string;
  vendor_id: string;
  purchase_order_id: string | null;
  payment_number: string;
  amount: number;
  payment_date: string;
  payment_method: "cash" | "bank_transfer" | "cheque" | "upi" | "neft" | "rtgs" | "other";
  reference_no: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  purchase_order?: { id: string; po_number: string };
}

export interface CompanySettings {
  id: string;
  organization_id: string;

  // Business identity
  company_name: string | null;
  legal_business_name: string | null;
  business_type: string | null;
  gst_number: string | null;
  pan_number: string | null;
  cin_number: string | null;
  msme_registration: string | null;

  // Contact
  phone: string | null;
  alternate_phone: string | null;
  email: string | null;
  support_email: string | null;
  website: string | null;

  // Address
  address_line_1: string | null;
  address_line_2: string | null;
  city: string | null;
  state: string | null;
  country: string;
  pincode: string | null;

  // Banking
  bank_name: string | null;
  account_holder_name: string | null;
  account_number: string | null;
  ifsc_code: string | null;
  branch_name: string | null;
  upi_id: string | null;

  // Financial defaults
  default_currency: string;
  default_tax_rate: number;
  financial_year_start: number;

  // Branding
  logo_url: string | null;
  signature_url: string | null;

  // Document numbering
  invoice_prefix: string;
  quotation_prefix: string;
  purchase_order_prefix: string;
  grn_prefix: string;
  vendor_payment_prefix: string;

  // Tax compliance
  tan_number: string | null;

  // Document defaults
  terms_and_conditions: string | null;
  payment_terms: string | null;
  default_notes: string | null;

  created_at: string;
  updated_at: string;
}

export interface ModulePermission {
  id: string;
  organization_id: string;
  role: string;
  module: string;
  can_view: boolean;
  can_create: boolean;
  can_edit: boolean;
  can_delete: boolean;
  can_approve: boolean;
}

export interface AdminEvent {
  id: string;
  organization_id: string;
  actor_id: string | null;
  actor_name: string;
  event_type: string;
  target_id: string | null;
  target_name: string | null;
  target_email: string | null;
  metadata: Record<string, unknown> | null;
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
