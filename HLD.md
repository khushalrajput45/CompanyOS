# CompanyOS — High-Level Design (HLD)

**Version:** 1.0  
**Date:** 27 August 2026

## 1. Architecture Overview

CompanyOS follows a web application architecture:

`User → Next.js Application → Supabase Auth / Data Access → PostgreSQL Database`

Cross-cutting controls include:

- Organization scoping
- Row Level Security
- Module permissions
- Database functions
- Triggers
- Document counters
- Audit and activity logging

## 2. Technology Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 16 |
| UI | React 19 |
| Language | TypeScript |
| Styling | Tailwind CSS |
| UI primitives | shadcn / Radix patterns |
| Forms | React Hook Form |
| Validation | Zod |
| Server-state | TanStack React Query |
| Tables | TanStack Table |
| Charts | Recharts |
| Backend/Auth | Supabase |
| Database | PostgreSQL |
| Database versioning | Supabase SQL migrations |
| Import/Export | XLSX |
| Email capability | Resend |

## 3. Logical Architecture

### Presentation Layer
- Next.js pages
- Forms
- Reusable components
- Dashboards
- Tables and reports

### Application/Data Access Layer
- Next.js App Router
- Server/client Supabase access
- Route handlers
- React Query server-state flows

### Identity Layer
- Supabase Auth
- User profiles
- Organization membership

### Data and Business Rule Layer
- PostgreSQL
- Row Level Security
- SQL functions
- Triggers
- Counters
- Organization-aware records

## 4. Major Modules

### Authentication
- Login
- Registration
- Password reset
- Auth callback
- Setup

### Master Data
- Customers
- Vendors
- Products

### Inventory
- Inventory
- Stock movements
- Quantity history
- Price history

### Sales
- Quotations
- Invoices
- Sales payments

### Purchasing
- Purchase orders
- GRN / receipts
- Vendor payments

### Administration
- Company profile
- User management
- Permissions
- Activity logs
- Audit logs

### Utilities
- Dashboard
- Reports
- Import

## 5. Multi-Tenant Architecture

The main tenant boundary is `organization_id`.

Organization-scoped data is designed so business records belong to an organization. Database-level controls such as Row Level Security are used to enforce access boundaries.

This is stronger than relying only on frontend filtering because database access itself is policy-controlled.

## 6. Data Architecture

### Identity and Tenant
- organizations
- profiles
- invitations
- module_permissions

### Catalog
- products
- brands
- categories
- product_images
- product_vendors
- product_serials

### CRM
- customers
- vendors
- locations

### Inventory
- stock_levels
- stock_movements
- stock_take_sessions
- stock_take_items
- price_history

### Sales
- quotations
- quotation_items
- invoices
- invoice_items
- invoice_payments

### Purchasing
- purchase_orders
- purchase_order_items
- po_receipts
- po_receipt_items
- vendor_payments

### Governance
- company_settings
- audit_logs
- admin_events
- import_logs

## 7. Critical Database Logic

| Function / Mechanism | Responsibility |
|---|---|
| `set_quotation_number` | Generate quotation numbers |
| `set_invoice_number` | Generate invoice numbers |
| `set_po_number` | Generate PO numbers |
| `set_grn_number` | Generate GRN numbers |
| `set_vp_number` | Generate vendor payment numbers |
| `apply_stock_movement` | Apply controlled stock changes |
| `increment_stock_level` | Update stock quantities |
| `receive_po_goods` | Coordinate goods receipt processing |
| `check_invoice_payment_amount` | Validate payment amounts |
| `sync_invoice_payment_status` | Synchronize invoice status |
| `sync_po_payment_status` | Synchronize PO payment status |
| `auth_org_id` | Resolve authenticated organization context |
| `set_org_id` | Support organization assignment |

## 8. Typical Request Flow

1. User authenticates with Supabase.
2. Protected application routing checks access.
3. The page or component requests organization-scoped data.
4. Supabase/PostgreSQL evaluates RLS policies.
5. Database functions/triggers enforce critical business rules.
6. Updated data is returned to the application.
7. Client state is refreshed through application data flows.

## 9. Architectural Decisions

- Critical business invariants are handled centrally in the database where appropriate.
- Document numbering is database controlled rather than generated only by the client.
- Multi-tenancy uses organization ownership and RLS.
- SQL migrations version database evolution.
- Next.js App Router provides the application structure.
- TypeScript improves maintainability and type safety.

## 10. Deployment View

The system requires:

- A Next.js runtime
- Supabase project configuration
- Environment variables for service configuration
- PostgreSQL/Supabase database
- Applied SQL migrations

Sensitive environment values should not be committed or shared in source archives.
