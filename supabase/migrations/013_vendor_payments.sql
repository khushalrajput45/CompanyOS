-- ================================================================
-- Migration 013: Vendor Payments & Vendor Ledger
--   1. vendor_payments  – payments made to vendors
--   2. Indexes + RLS
--   3. Seed realistic test payments for existing received POs
-- ================================================================


-- ── 1. vendor_payments ───────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS vendor_payments (
  id                UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id   UUID          NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  vendor_id         UUID          NOT NULL REFERENCES vendors(id)       ON DELETE CASCADE,
  purchase_order_id UUID          REFERENCES purchase_orders(id) ON DELETE SET NULL,
  amount            NUMERIC(14,2) NOT NULL CHECK (amount > 0),
  payment_date      DATE          NOT NULL DEFAULT CURRENT_DATE,
  payment_method    TEXT          NOT NULL DEFAULT 'bank_transfer'
                    CHECK (payment_method IN ('cash','bank_transfer','cheque','upi','neft','rtgs','other')),
  reference_no      TEXT,
  notes             TEXT,
  created_by        UUID          REFERENCES auth.users(id),
  created_at        TIMESTAMPTZ   NOT NULL DEFAULT now()
);

ALTER TABLE vendor_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org access: vendor_payments" ON vendor_payments
  FOR ALL USING (organization_id = auth_org_id());

-- Auto-fill organization_id (reuses set_org_id() from migration 002)
CREATE TRIGGER vendor_payments_set_org_id
  BEFORE INSERT ON vendor_payments
  FOR EACH ROW EXECUTE FUNCTION set_org_id();

CREATE INDEX IF NOT EXISTS idx_vendor_payments_vendor ON vendor_payments (vendor_id);
CREATE INDEX IF NOT EXISTS idx_vendor_payments_org    ON vendor_payments (organization_id);
CREATE INDEX IF NOT EXISTS idx_vendor_payments_date   ON vendor_payments (payment_date DESC);
CREATE INDEX IF NOT EXISTS idx_vendor_payments_po     ON vendor_payments (purchase_order_id)
  WHERE purchase_order_id IS NOT NULL;


-- ── 2. Seed: realistic vendor payments for existing received POs ──────────────
-- Seeds two payments per vendor (first received/partial PO only):
--   payment 1 = 40 % of PO value, 20 days ago via bank_transfer
--   payment 2 = 30 % of PO value, 10 days ago via neft
-- This leaves 30 % outstanding so the ledger is never fully settled.
-- Guard: skipped if any vendor payment already exists for this org.

DO $$
DECLARE
  v_org_id    UUID;
  v_vendor_id UUID;
  v_po_id     UUID;
  v_po_total  NUMERIC;
  v_po_num    TEXT;
  v_seq       INT := 0;
BEGIN
  SELECT id INTO v_org_id FROM organizations LIMIT 1;
  IF v_org_id IS NULL THEN RETURN; END IF;

  IF EXISTS (
    SELECT 1 FROM vendor_payments WHERE organization_id = v_org_id LIMIT 1
  ) THEN
    RETURN;
  END IF;

  -- One row per vendor: their most-recently-received/partial PO
  FOR v_vendor_id, v_po_id, v_po_total, v_po_num IN
    SELECT DISTINCT ON (po.vendor_id)
      po.vendor_id, po.id, po.total_amount, po.po_number
    FROM   purchase_orders po
    WHERE  po.organization_id = v_org_id
    AND    po.status IN ('received', 'partial')
    ORDER  BY po.vendor_id, po.created_at DESC
  LOOP
    v_seq := v_seq + 1;

    -- First payment: 40 % advance
    INSERT INTO vendor_payments (
      organization_id, vendor_id, purchase_order_id,
      amount, payment_date, payment_method, reference_no, notes
    ) VALUES (
      v_org_id, v_vendor_id, v_po_id,
      ROUND(v_po_total * 0.40, 2),
      CURRENT_DATE - 20,
      'bank_transfer',
      'NEFT/' || TO_CHAR(CURRENT_DATE - 20, 'YYYYMMDD') || '/' || LPAD(v_seq::TEXT, 3, '0') || 'A',
      'Advance payment against ' || v_po_num
    );

    -- Second payment: 30 % partial
    INSERT INTO vendor_payments (
      organization_id, vendor_id, purchase_order_id,
      amount, payment_date, payment_method, reference_no, notes
    ) VALUES (
      v_org_id, v_vendor_id, v_po_id,
      ROUND(v_po_total * 0.30, 2),
      CURRENT_DATE - 10,
      'neft',
      'NEFT/' || TO_CHAR(CURRENT_DATE - 10, 'YYYYMMDD') || '/' || LPAD(v_seq::TEXT, 3, '0') || 'B',
      'Partial payment — ' || v_po_num
    );
  END LOOP;
END;
$$;
