# CompanyOS — Product Requirements Document (PRD)

**Version:** 1.0  
**Date:** 27 August 2026

## 1. Executive Summary

CompanyOS is a web-based, multi-organization business operations platform that centralizes core workflows including customer and vendor management, products, inventory, quotations, invoices, purchase orders, goods receipt, payments, reporting, permissions, and auditability.

The implemented architecture uses **Next.js 16, React 19, TypeScript, Supabase Auth, and PostgreSQL**.

## 2. Problem Statement

Businesses often manage sales, purchasing, inventory, customers, vendors, and payments using disconnected spreadsheets or tools. This can cause duplicated data, inconsistent inventory, weak traceability, and limited operational visibility.

CompanyOS provides a centralized system where these workflows share a common organization-scoped data model.

## 3. Product Goals

- Centralize core business operations.
- Support multiple organizations with isolated data.
- Manage customers, vendors, products, and inventory.
- Support sales workflows from quotation to invoice and payment.
- Support purchasing workflows from purchase order to goods receipt and vendor payment.
- Maintain traceability through stock movements, activity, and audit logs.
- Enforce critical business rules at the database level.

## 4. Users

| User | Primary Needs |
|---|---|
| Owner | Organization control, settings, users, oversight |
| Admin | Administrative and operational management |
| Manager / Operational User | Daily sales, purchasing, and inventory workflows |
| Authorized Member | Access based on organization and permissions |

## 5. Functional Requirements

### Authentication and Onboarding
- Registration
- Login
- Password reset
- Authentication callback
- Protected application access
- Organization setup

### Organization Administration
- Company profile and settings
- User management
- Invitations
- Module permissions
- Activity and audit logs

### Master Data
- Customers
- Vendors
- Products
- Brands
- Categories
- Product images
- Product-vendor associations
- Product serials where applicable

### Inventory
- Stock levels
- Stock movements
- Quantity history
- Price history
- Stock take sessions and items
- Controlled stock updates

### Sales
- Quotations
- Quotation items
- Invoices
- Invoice items
- Sales payments
- Invoice payment-status synchronization

### Purchasing
- Purchase orders
- Purchase order items
- GRN / PO receipts
- Receipt items
- Vendor payments
- Received quantity tracking

### Reporting and Utilities
- Dashboard
- Reports
- Import workflows
- Import logs

## 6. Core Business Flows

### Sales Flow

`Customer → Quotation → Invoice → Payment(s) → Payment Status`

Quotation is optional. Invoices contain line items and are linked with recorded payments.

### Purchasing Flow

`Vendor → Purchase Order → Goods Receipt / GRN → Inventory Update → Vendor Payment`

Received goods are tracked through receipt records and inventory update logic.

### Inventory Flow

`Product → Stock Level → Stock Movement → Controlled Database Update → Quantity History`

## 7. Non-Functional Requirements

### Security
- Supabase authentication
- Protected routes
- Organization-based data isolation
- Row Level Security
- Permission controls

### Data Consistency
- Database-generated document numbers
- Payment validation
- Payment status synchronization
- Controlled stock updates
- Protection against invalid inventory states

### Maintainability
- TypeScript
- Next.js App Router
- Modular components
- SQL migration-based database evolution

### Validation
- React Hook Form
- Zod validation

### Auditability
- Audit logs
- Activity tracking
- Stock movement history

## 8. Acceptance Criteria

- Users cannot access protected data from another organization.
- Quotations, invoices, POs, GRNs, and vendor payments receive controlled numbers.
- Invoice status remains synchronized with payments.
- PO goods receipt updates receipt and inventory state consistently.
- Inventory changes are traceable.
- Administrative and operational actions can be audited where implemented.

## 9. Scope

The current scope is based on the analyzed CompanyOS source code and database migrations. External accounting integrations, native mobile clients, and unimplemented third-party integrations are outside this documented implementation scope.
