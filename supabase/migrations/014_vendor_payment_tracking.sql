-- ================================================================
-- Migration 014: Vendor Payment Tracking
--   1. vp_counters              – payment number generation
--   2. payment_number           – on vendor_payments (PAY-00001)
--   3. set_vp_number()          – BEFORE INSERT trigger
--   4. amount_paid, payment_status – on purchase_orders
--   5. sync_po_payment_status() – AFTER INSERT/DELETE on vendor_payments
--   6. get_vendor_grn_entries() – RPC: per-GRN debit values for ledger
--   7. Backfill existing data
--
-- Trigger firing order on vendor_payments (alphabetical BEFORE INSERT):
--   vendor_payments_set_org_id   ('set_org' < 'set_vp')  → sets organization_id
--   vendor_payments_set_vp_number                         → generates PAY-00001
-- ================================================================


-- ── 1. VP Counters ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS vp_counters (
  organization_id UUID PRIMARY KEY REFERENCES organizations(id) ON DELETE CASCADE,
  last_number     INT  NOT NULL DEFAULT 0
);

ALTER TABLE vp_counters ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org access: vp_counters" ON vp_counters
  FOR ALL USING (organization_id = auth_org_id());


-- ── 2. payment_number column ───────────────────────────────────────────────────

ALTER TABLE vendor_payments ADD COLUMN IF NOT EXISTS payment_number TEXT NOT NULL DEFAULT '';

-- Partial unique index: allows DEFAULT '' but enforces uniqueness for real numbers
CREATE UNIQUE INDEX IF NOT EXISTS idx_vendor_payments_pnum_unique
  ON vendor_payments (organization_id, payment_number)
  WHERE payment_number != '';

CREATE INDEX IF NOT EXISTS idx_vendor_payments_pnum_lookup
  ON vendor_payments (payment_number)
  WHERE payment_number != '';


-- ── 3. set_vp_number() ─────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION set_vp_number()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_num    INT;
  v_org_id UUID;
BEGIN
  IF NEW.payment_number IS NOT NULL AND NEW.payment_number != '' THEN
    RETURN NEW;
  END IF;

  v_org_id := COALESCE(
    NEW.organization_id,
    (SELECT organization_id FROM vendors WHERE id = NEW.vendor_id)
  );

  IF v_org_id IS NULL THEN
    RAISE EXCEPTION 'Cannot generate payment number: organization_id unknown';
  END IF;

  INSERT INTO vp_counters (organization_id, last_number)
  VALUES (v_org_id, 1)
  ON CONFLICT (organization_id) DO UPDATE
    SET last_number = vp_counters.last_number + 1
  RETURNING last_number INTO v_num;

  NEW.payment_number := 'PAY-' || LPAD(v_num::TEXT, 5, '0');
  RETURN NEW;
END;
$$;

CREATE TRIGGER vendor_payments_set_vp_number
  BEFORE INSERT ON vendor_payments
  FOR EACH ROW EXECUTE FUNCTION set_vp_number();


-- ── 4. amount_paid + payment_status on purchase_orders ─────────────────────────

ALTER TABLE purchase_orders
  ADD COLUMN IF NOT EXISTS amount_paid    NUMERIC(14,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS payment_status TEXT          NOT NULL DEFAULT 'pending'
    CHECK (payment_status IN ('pending', 'partial', 'paid'));


-- ── 5. sync_po_payment_status() ────────────────────────────────────────────────
-- Fires AFTER INSERT OR DELETE on vendor_payments.
-- Only acts when purchase_order_id is non-null (payment linked to a specific PO).

CREATE OR REPLACE FUNCTION sync_po_payment_status()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_po_id    UUID;
  v_po_total NUMERIC;
  v_paid     NUMERIC;
  v_status   TEXT;
BEGIN
  v_po_id := CASE TG_OP WHEN 'DELETE' THEN OLD.purchase_order_id ELSE NEW.purchase_order_id END;

  IF v_po_id IS NULL THEN
    RETURN CASE TG_OP WHEN 'DELETE' THEN OLD ELSE NEW END;
  END IF;

  SELECT total_amount INTO v_po_total FROM purchase_orders WHERE id = v_po_id;
  IF NOT FOUND THEN
    RETURN CASE TG_OP WHEN 'DELETE' THEN OLD ELSE NEW END;
  END IF;

  SELECT COALESCE(SUM(amount), 0) INTO v_paid
  FROM vendor_payments WHERE purchase_order_id = v_po_id;

  v_status := CASE
    WHEN v_paid >= v_po_total AND v_po_total > 0 THEN 'paid'
    WHEN v_paid > 0                               THEN 'partial'
    ELSE                                               'pending'
  END;

  UPDATE purchase_orders
  SET amount_paid = v_paid, payment_status = v_status, updated_at = now()
  WHERE id = v_po_id;

  RETURN CASE TG_OP WHEN 'DELETE' THEN OLD ELSE NEW END;
END;
$$;

CREATE TRIGGER vendor_payments_sync_po_payment
  AFTER INSERT OR DELETE ON vendor_payments
  FOR EACH ROW EXECUTE FUNCTION sync_po_payment_status();


-- ── 6. get_vendor_grn_entries() ────────────────────────────────────────────────
-- Returns one row per GRN for a vendor, with the calculated receipt value.
-- Used by the vendor ledger to show GRN-level debit entries (more accurate than PO-level).
-- COALESCE on grn_number handles receipts created before migration 012.

CREATE OR REPLACE FUNCTION get_vendor_grn_entries(p_vendor_id UUID)
RETURNS TABLE (
  receipt_id        UUID,
  grn_number        TEXT,
  receipt_date      DATE,
  purchase_order_id UUID,
  po_number         TEXT,
  receipt_value     NUMERIC
) LANGUAGE plpgsql SECURITY DEFINER STABLE AS $$
BEGIN
  RETURN QUERY
  SELECT
    pr.id,
    COALESCE(NULLIF(pr.grn_number, ''), 'REC-' || SUBSTRING(pr.id::TEXT, 1, 8)),
    pr.receipt_date,
    pr.purchase_order_id,
    po.po_number,
    COALESCE(SUM(pri.quantity * poi.unit_cost * (1 + poi.tax_rate / 100.0)), 0)
  FROM po_receipts pr
  JOIN purchase_orders po
    ON  po.id = pr.purchase_order_id
    AND po.vendor_id = p_vendor_id
    AND po.organization_id = auth_org_id()
  LEFT JOIN po_receipt_items pri  ON pri.receipt_id = pr.id
  LEFT JOIN purchase_order_items poi ON poi.id = pri.po_item_id
  GROUP BY pr.id, pr.grn_number, pr.receipt_date, pr.purchase_order_id, po.po_number, pr.created_at
  ORDER BY pr.receipt_date ASC, pr.created_at ASC;
END;
$$;


-- ── 7a. Backfill amount_paid + payment_status on purchase_orders ───────────────

UPDATE purchase_orders po
SET
  amount_paid = COALESCE((
    SELECT SUM(vp.amount) FROM vendor_payments vp WHERE vp.purchase_order_id = po.id
  ), 0),
  payment_status = CASE
    WHEN COALESCE((
      SELECT SUM(vp.amount) FROM vendor_payments vp WHERE vp.purchase_order_id = po.id
    ), 0) >= po.total_amount AND po.total_amount > 0 THEN 'paid'
    WHEN COALESCE((
      SELECT SUM(vp.amount) FROM vendor_payments vp WHERE vp.purchase_order_id = po.id
    ), 0) > 0                                        THEN 'partial'
    ELSE                                                   'pending'
  END;


-- ── 7b. Backfill payment_number for existing vendor_payments ───────────────────
-- Assigns PAY-00001, PAY-00002, … to existing rows ordered by created_at,
-- per organisation. Also seeds the vp_counters for future inserts.

DO $$
DECLARE
  v_org_id UUID;
  v_row    RECORD;
  v_seq    INT;
BEGIN
  FOR v_org_id IN SELECT DISTINCT organization_id FROM vendor_payments LOOP
    v_seq := 0;

    FOR v_row IN
      SELECT id FROM vendor_payments
      WHERE organization_id = v_org_id
        AND (payment_number IS NULL OR payment_number = '')
      ORDER BY created_at
    LOOP
      v_seq := v_seq + 1;

      UPDATE vendor_payments
      SET payment_number = 'PAY-' || LPAD(v_seq::TEXT, 5, '0')
      WHERE id = v_row.id;
    END LOOP;

    -- Seed counter so next INSERT continues from the right number
    IF v_seq > 0 THEN
      INSERT INTO vp_counters (organization_id, last_number)
      VALUES (v_org_id, v_seq)
      ON CONFLICT (organization_id) DO UPDATE
        SET last_number = GREATEST(vp_counters.last_number, v_seq);
    END IF;
  END LOOP;
END;
$$;
