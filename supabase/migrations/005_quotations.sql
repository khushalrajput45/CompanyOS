-- ================================================================
-- Migration 005: Quotation Management
-- Creates quotations + quotation_items tables with full RLS,
-- auto-numbering, and triggers.
-- ================================================================


-- ── 1. Quotations ─────────────────────────────────────────────────────────────
CREATE TABLE quotations (
  id               uuid        PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id  uuid        REFERENCES organizations(id) ON DELETE CASCADE,
  quotation_number text        NOT NULL,
  customer_id      uuid        NOT NULL REFERENCES customers(id),
  quotation_date   date        NOT NULL DEFAULT CURRENT_DATE,
  valid_until      date,
  subtotal         numeric(14,2) NOT NULL DEFAULT 0,
  tax_amount       numeric(14,2) NOT NULL DEFAULT 0,
  total_amount     numeric(14,2) NOT NULL DEFAULT 0,
  status           text        NOT NULL DEFAULT 'draft'
                               CHECK (status IN ('draft','sent','accepted','rejected','expired')),
  notes            text,
  created_by       uuid        REFERENCES auth.users(id),
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, quotation_number)
);


-- ── 2. Quotation Items ────────────────────────────────────────────────────────
CREATE TABLE quotation_items (
  id           uuid        PRIMARY KEY DEFAULT uuid_generate_v4(),
  quotation_id uuid        NOT NULL REFERENCES quotations(id) ON DELETE CASCADE,
  product_id   uuid        REFERENCES products(id),
  description  text        NOT NULL,
  quantity     numeric(12,3) NOT NULL DEFAULT 1 CHECK (quantity > 0),
  unit_price   numeric(12,2) NOT NULL DEFAULT 0 CHECK (unit_price >= 0),
  tax_rate     numeric(5,2)  NOT NULL DEFAULT 0 CHECK (tax_rate >= 0 AND tax_rate <= 100),
  line_total   numeric(14,2) NOT NULL DEFAULT 0,
  sort_order   integer       NOT NULL DEFAULT 0
);


-- ── 3. Indexes ────────────────────────────────────────────────────────────────
CREATE INDEX idx_quotations_org         ON quotations (organization_id);
CREATE INDEX idx_quotations_org_status  ON quotations (organization_id, status);
CREATE INDEX idx_quotations_customer    ON quotations (customer_id);
CREATE INDEX idx_quotations_date        ON quotations (quotation_date DESC);
CREATE INDEX idx_quotation_items_quot   ON quotation_items (quotation_id);
CREATE INDEX idx_quotation_items_prod   ON quotation_items (product_id);


-- ── 4. Auto-number function ───────────────────────────────────────────────────
-- Generates QT-YYYY-NNNN  (e.g. QT-2026-0001)
-- Uses MAX+1 within the org — acceptable for a single-tenant ERP at this scale.
CREATE OR REPLACE FUNCTION set_quotation_number()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_seq integer;
BEGIN
  IF NEW.quotation_number IS NULL OR NEW.quotation_number = '' THEN
    SELECT COALESCE(
      MAX(
        CASE WHEN quotation_number ~ '^QT-[0-9]{4}-[0-9]+$'
             THEN CAST(SPLIT_PART(quotation_number, '-', 3) AS integer)
             ELSE 0
        END
      ), 0
    ) + 1
    INTO v_seq
    FROM quotations
    WHERE organization_id = NEW.organization_id;

    NEW.quotation_number := 'QT-' || to_char(now(), 'YYYY') || '-' || LPAD(v_seq::text, 4, '0');
  END IF;
  RETURN NEW;
END;
$$;


-- ── 5. Triggers ───────────────────────────────────────────────────────────────
CREATE TRIGGER quotations_set_org_id
  BEFORE INSERT ON quotations
  FOR EACH ROW EXECUTE FUNCTION set_org_id();

CREATE TRIGGER quotations_set_number
  BEFORE INSERT ON quotations
  FOR EACH ROW EXECUTE FUNCTION set_quotation_number();

CREATE TRIGGER quotations_updated_at
  BEFORE UPDATE ON quotations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();


-- ── 6. Row Level Security ─────────────────────────────────────────────────────
ALTER TABLE quotations       ENABLE ROW LEVEL SECURITY;
ALTER TABLE quotation_items  ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org access: quotations" ON quotations
  FOR ALL USING (organization_id = auth_org_id());

-- Items are accessed through their parent quotation's org
CREATE POLICY "org access: quotation_items" ON quotation_items
  FOR ALL USING (
    quotation_id IN (
      SELECT id FROM quotations WHERE organization_id = auth_org_id()
    )
  );
