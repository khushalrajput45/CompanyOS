# CompanyOS — Low-Level Design (LLD)

**Version:** 1.0  
**Date:** 27 August 2026

## 1. Source Structure

```text
src/
├── app/
│   ├── login/
│   ├── register/
│   ├── setup/
│   ├── reset-password/
│   ├── auth/callback/
│   ├── (app)/
│   │   ├── dashboard/
│   │   ├── customers/
│   │   ├── vendors/
│   │   ├── products/
│   │   ├── inventory/
│   │   ├── quotations/
│   │   ├── invoices/
│   │   ├── sales-payments/
│   │   ├── purchase-orders/
│   │   ├── grn/
│   │   ├── vendor-payments/
│   │   ├── reports/
│   │   ├── import/
│   │   └── settings/
│   └── api/
│       ├── auth/register/
│       ├── auth/invite/
│       ├── admin/users/
│       └── audit/
├── components/
├── lib/
└── proxy.ts

supabase/
└── migrations/
```

## 2. Route-Level Design

| Route | Responsibility |
|---|---|
| `/login` | User authentication |
| `/register` | User registration |
| `/setup` | Initial organization/user setup |
| `/dashboard` | Business overview |
| `/customers` | Customer management |
| `/vendors` | Vendor management |
| `/products` | Product management |
| `/inventory` | Inventory and stock movement |
| `/quotations` | Quotation management |
| `/invoices` | Invoice management |
| `/sales-payments` | Customer invoice payments |
| `/purchase-orders` | Purchase order management |
| `/grn` | Goods receipt management |
| `/vendor-payments` | Vendor payment management |
| `/reports` | Reporting |
| `/import` | Data import |
| `/settings/*` | Company, users, permissions, activity and audit management |

## 3. Core Entity Relationships

```text
Organization
 ├── Profiles / Users
 ├── Customers
 ├── Vendors
 ├── Products
 │    ├── Stock Levels
 │    └── Stock Movements
 ├── Quotations
 │    └── Quotation Items
 ├── Invoices
 │    ├── Invoice Items
 │    └── Invoice Payments
 ├── Purchase Orders
 │    ├── Purchase Order Items
 │    └── PO Receipts
 │         └── PO Receipt Items
 ├── Vendor Payments
 └── Settings / Permissions / Audit Logs
```

## 4. Invoice Workflow

1. User opens the invoice form.
2. Customer and line items are selected.
3. Form input is validated.
4. Invoice header and `invoice_items` are persisted.
5. `set_invoice_number` assigns a controlled invoice number.
6. Payments are stored in `invoice_payments`.
7. Payment validation checks valid amounts.
8. `sync_invoice_payment_status` updates invoice payment state.

Flow:

`Invoice Form → Validation → Invoice → Invoice Items → Payment → Status Synchronization`

## 5. Purchase Order and GRN Workflow

1. User selects a vendor.
2. PO header and `purchase_order_items` are created.
3. `set_po_number` assigns the PO number.
4. Goods are received through the receipt/GRN workflow.
5. `po_receipts` and `po_receipt_items` record received goods.
6. `receive_po_goods` coordinates the receipt operation.
7. Stock is updated through inventory functions.
8. Received quantities and related status remain synchronized.

Flow:

`Vendor → PO → PO Items → GRN / Receipt → Receipt Items → Stock Update`

## 6. Inventory Workflow

The main inventory entities are:

- `stock_levels`
- `stock_movements`
- `stock_take_sessions`
- `stock_take_items`

Controlled operations use functions including:

- `apply_stock_movement`
- `increment_stock_level`

Conceptually:

`Inventory Operation → Stock Movement Record → Validation → Stock Level Update`

This design supports traceability because stock changes can be examined through movement/history data rather than only looking at the current quantity.

## 7. Document Numbering

| Document | Counter |
|---|---|
| Quotation | `quotation_counters` |
| Invoice | `invoice_counters` |
| Purchase Order | `po_counters` |
| GRN | `grn_counters` |
| Vendor Payment | `vp_counters` |

Number assignment is centralized through:

- `set_quotation_number`
- `set_invoice_number`
- `set_po_number`
- `set_grn_number`
- `set_vp_number`

## 8. Authorization Flow

```text
User
  ↓
Supabase Authentication
  ↓
Protected Route / Application Access
  ↓
Profile + Organization Context
  ↓
Module Permission Check
  ↓
Supabase/PostgreSQL Query
  ↓
Row Level Security
  ↓
Organization-Scoped Data
```

Important distinction:

- **UI permission:** determines what the user can see or invoke.
- **Database authorization/RLS:** determines what data the user can actually access.

## 9. Database Migration Design

The project contains 27 analyzed migrations.

### Evolution

- `001–003`: Initial schema and organization assignment.
- `004–009`: Customers, quotations, invoices and sales workflow.
- `010–015`: Vendors, POs, GRN, vendor payments and company settings.
- `016–020`: Production hardening, signup, integer quantities, security and grants.
- `021–027`: Signature, user-management redesign, company profile, permissions/activity, audit logs, billing/shipping addresses and delete-cascade fixes.

## 10. Data Consistency Considerations

Critical consistency concerns include:

- Avoiding duplicate or conflicting document numbers.
- Preventing invalid stock states.
- Keeping invoice payment status synchronized.
- Keeping PO receipt quantities consistent.
- Ensuring users access only authorized organization data.
- Centralizing multi-step business transitions where partial updates would be risky.

## 11. Error Handling and Validation Strategy

The implementation uses:

- Form-level validation through React Hook Form and Zod patterns.
- TypeScript for type safety.
- Database functions for critical business operations.
- Row Level Security for data access.
- Migration-based schema evolution.
- Controlled counters for business documents.

## 12. Key Viva Explanation

CompanyOS should be explained as a business operations platform with two important layers of responsibility:

1. **Application layer:** pages, forms, UI, routing and user workflows.
2. **Database/business-rule layer:** tenant isolation, document numbering, stock updates, payment validation and status synchronization.

This separation prevents the system from relying entirely on frontend logic for critical business rules.
