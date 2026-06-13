-- ================================================================
-- Migration 008: Invoice Management
-- ================================================================


-- ── 1. Invoices ───────────────────────────────────────────────────────────────

CREATE TABLE invoices (
  id               uuid          PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id  uuid          REFERENCES organizations(id) ON DELETE CASCADE,
  invoice_number   text          NOT NULL,
  quotation_id     uuid          REFERENCES quotations(id) ON DELETE SET NULL,
  customer_id      uuid          NOT NULL REFERENCES customers(id),
  invoice_date     date          NOT NULL DEFAULT CURRENT_DATE,
  due_date         date,
  subtotal         numeric(14,2) NOT NULL DEFAULT 0,
  tax_amount       numeric(14,2) NOT NULL DEFAULT 0,
  total_amount     numeric(14,2) NOT NULL DEFAULT 0,
  status           text          NOT NULL DEFAULT 'draft'
                   CHECK (status IN ('draft','sent','paid','partially_paid','overdue')),
  notes            text,
  created_by       uuid          REFERENCES auth.users(id),
  created_at       timestamptz   NOT NULL DEFAULT now(),
  updated_at       timestamptz   NOT NULL DEFAULT now(),
  UNIQUE (organization_id, invoice_number)
);


-- ── 2. Invoice Items ──────────────────────────────────────────────────────────

CREATE TABLE invoice_items (
  id           uuid          PRIMARY KEY DEFAULT uuid_generate_v4(),
  invoice_id   uuid          NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  product_id   uuid          REFERENCES products(id),
  description  text          NOT NULL,
  quantity     numeric(12,3) NOT NULL DEFAULT 1 CHECK (quantity > 0),
  unit_price   numeric(12,2) NOT NULL DEFAULT 0 CHECK (unit_price >= 0),
  tax_rate     numeric(5,2)  NOT NULL DEFAULT 0 CHECK (tax_rate >= 0 AND tax_rate <= 100),
  line_total   numeric(14,2) NOT NULL DEFAULT 0,
  sort_order   integer       NOT NULL DEFAULT 0
);


-- ── 3. Counter table (same atomic pattern as quotation_counters) ──────────────

CREATE TABLE invoice_counters (
  organization_id  uuid    PRIMARY KEY REFERENCES organizations(id) ON DELETE CASCADE,
  last_number      bigint  NOT NULL DEFAULT 0
);

ALTER TABLE invoice_counters ENABLE ROW LEVEL SECURITY;


-- ── 4. Indexes ────────────────────────────────────────────────────────────────

CREATE INDEX idx_invoices_org         ON invoices (organization_id);
CREATE INDEX idx_invoices_org_status  ON invoices (organization_id, status);
CREATE INDEX idx_invoices_customer    ON invoices (customer_id);
CREATE INDEX idx_invoices_date        ON invoices (invoice_date DESC);
CREATE INDEX idx_invoices_quotation   ON invoices (quotation_id);
CREATE INDEX idx_invoice_items_inv    ON invoice_items (invoice_id);
CREATE INDEX idx_invoice_items_prod   ON invoice_items (product_id);


-- ── 5. Auto-number function ───────────────────────────────────────────────────
-- Uses COALESCE so it works even when invoices_set_org_id fires after this
-- trigger (PostgreSQL fires BEFORE triggers alphabetically: 'set_number' < 'set_org_id').

CREATE OR REPLACE FUNCTION set_invoice_number()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_seq bigint;
  v_org uuid;
BEGIN
  IF NEW.invoice_number IS NULL OR NEW.invoice_number = '' THEN
    v_org := COALESCE(
      NEW.organization_id,
      (SELECT organization_id FROM profiles WHERE id = auth.uid())
    );

    INSERT INTO invoice_counters (organization_id, last_number)
    VALUES (v_org, 1)
    ON CONFLICT (organization_id) DO UPDATE
      SET last_number = invoice_counters.last_number + 1
    RETURNING last_number INTO v_seq;

    NEW.invoice_number := 'INV-' || LPAD(v_seq::text, 6, '0');
  END IF;
  RETURN NEW;
END;
$$;


-- ── 6. Triggers ───────────────────────────────────────────────────────────────

CREATE TRIGGER invoices_set_org_id
  BEFORE INSERT ON invoices
  FOR EACH ROW EXECUTE FUNCTION set_org_id();

CREATE TRIGGER invoices_set_number
  BEFORE INSERT ON invoices
  FOR EACH ROW EXECUTE FUNCTION set_invoice_number();

CREATE TRIGGER invoices_updated_at
  BEFORE UPDATE ON invoices
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();


-- ── 7. Row Level Security ─────────────────────────────────────────────────────

ALTER TABLE invoices       ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_items  ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org access: invoices" ON invoices
  FOR ALL USING (organization_id = auth_org_id());

CREATE POLICY "org access: invoice_items" ON invoice_items
  FOR ALL USING (
    invoice_id IN (
      SELECT id FROM invoices WHERE organization_id = auth_org_id()
    )
  );
