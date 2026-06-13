-- ================================================================
-- Migration 004: Full Customers table
-- Replaces the minimal stub from migration 003 with the
-- production schema (adds company_name, city, state, pincode,
-- notes, gst_number, updated_at).
-- Safe to run multiple times (idempotent).
-- ================================================================


-- ── 1. Drop stub from 003 (CASCADE removes the FK on stock_movements) ────────
DROP TABLE IF EXISTS customers CASCADE;


-- ── 2. Full customers table ───────────────────────────────────────────────────
CREATE TABLE customers (
  id              uuid        PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id uuid        REFERENCES organizations(id) ON DELETE CASCADE,
  name            text        NOT NULL,
  company_name    text,
  gst_number      text,
  phone           text,
  email           text,
  address         text,
  city            text,
  state           text,
  pincode         text,
  notes           text,
  is_active       boolean     NOT NULL DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);


-- ── 3. Indexes ────────────────────────────────────────────────────────────────
CREATE INDEX idx_customers_org        ON customers (organization_id);
CREATE INDEX idx_customers_org_name   ON customers (organization_id, name);
CREATE INDEX idx_customers_org_active ON customers (organization_id, is_active);
CREATE INDEX idx_customers_email      ON customers (email) WHERE email IS NOT NULL;


-- ── 4. Row Level Security ─────────────────────────────────────────────────────
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org access: customers" ON customers
  FOR ALL USING (organization_id = auth_org_id());


-- ── 5. Triggers ───────────────────────────────────────────────────────────────
-- Auto-fill organization_id on insert (reuses function from migration 002)
CREATE TRIGGER customers_set_org_id
  BEFORE INSERT ON customers
  FOR EACH ROW EXECUTE FUNCTION set_org_id();

-- Auto-update updated_at on modification (reuses function from migration 001)
CREATE TRIGGER customers_updated_at
  BEFORE UPDATE ON customers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();


-- ── 6. Restore customer_id on stock_movements ────────────────────────────────
-- The CASCADE above removed the FK constraint (not the column).
-- Add the column if it doesn't exist, then restore the FK.
ALTER TABLE stock_movements
  ADD COLUMN IF NOT EXISTS customer_id uuid;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'stock_movements_customer_id_fkey'
      AND table_name      = 'stock_movements'
  ) THEN
    ALTER TABLE stock_movements
      ADD CONSTRAINT stock_movements_customer_id_fkey
        FOREIGN KEY (customer_id) REFERENCES customers(id);
  END IF;
END;
$$;

CREATE INDEX IF NOT EXISTS idx_stock_movements_customer_id
  ON stock_movements (customer_id) WHERE customer_id IS NOT NULL;


-- ── 7. Restore other columns added in migration 003 (if not run) ──────────────
-- These are no-ops if migration 003 was applied; safe if it was skipped.
ALTER TABLE stock_movements
  ADD COLUMN IF NOT EXISTS unit_price      numeric(12,2),
  ADD COLUMN IF NOT EXISTS discount_amount numeric(12,2),
  ADD COLUMN IF NOT EXISTS document_id     uuid,
  ADD COLUMN IF NOT EXISTS document_type   text
    CHECK (document_type IN ('invoice', 'purchase_order', 'quotation'));

CREATE INDEX IF NOT EXISTS idx_stock_movements_document
  ON stock_movements (document_id, document_type) WHERE document_id IS NOT NULL;

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS tax_rate numeric(5,2)
    CHECK (tax_rate >= 0 AND tax_rate <= 100);

ALTER TABLE stock_levels
  ALTER COLUMN quantity TYPE numeric(12,3) USING quantity::numeric(12,3);

ALTER TABLE stock_movements
  ALTER COLUMN quantity TYPE numeric(12,3) USING quantity::numeric(12,3);
