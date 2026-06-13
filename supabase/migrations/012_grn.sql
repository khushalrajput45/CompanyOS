-- ================================================================
-- Migration 012: Goods Receipt Numbers (GRN)
--   1. grn_counters         – atomic GRN number generation
--   2. grn_number column    – added to po_receipts
--   3. set_grn_number()     – BEFORE INSERT trigger → GRN-00001
--   4. receive_po_goods()   – DROP + recreate to return JSONB {id, grn_number}
--
-- NOTE: receive_po_goods must be dropped first because PostgreSQL does not
-- allow changing a function's return type with CREATE OR REPLACE.
-- ================================================================


-- ── 1. GRN Counters ───────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS grn_counters (
  organization_id UUID PRIMARY KEY REFERENCES organizations(id) ON DELETE CASCADE,
  last_number     INT  NOT NULL DEFAULT 0
);

ALTER TABLE grn_counters ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org access: grn_counters" ON grn_counters
  FOR ALL USING (organization_id = auth_org_id());


-- ── 2. grn_number column ──────────────────────────────────────────────────────

ALTER TABLE po_receipts ADD COLUMN IF NOT EXISTS grn_number TEXT NOT NULL DEFAULT '';

-- Partial unique index: allows DEFAULT '' but enforces uniqueness for real GRNs
CREATE UNIQUE INDEX IF NOT EXISTS idx_po_receipts_grn_unique
  ON po_receipts (organization_id, grn_number)
  WHERE grn_number != '';

CREATE INDEX IF NOT EXISTS idx_po_receipts_grn_lookup
  ON po_receipts (grn_number)
  WHERE grn_number != '';


-- ── 3. set_grn_number() ───────────────────────────────────────────────────────
-- Named po_receipts_stamp_grn_number so it fires AFTER po_receipts_set_org_id
-- alphabetically ('stamp' > 'set_org'), ensuring organization_id is populated
-- before GRN generation runs. COALESCE from purchase_orders as extra fallback.

CREATE OR REPLACE FUNCTION set_grn_number()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_num    INT;
  v_org_id UUID;
BEGIN
  IF NEW.grn_number IS NOT NULL AND NEW.grn_number != '' THEN
    RETURN NEW;
  END IF;

  v_org_id := COALESCE(
    NEW.organization_id,
    (SELECT organization_id FROM purchase_orders WHERE id = NEW.purchase_order_id)
  );

  IF v_org_id IS NULL THEN
    RAISE EXCEPTION 'Cannot generate GRN number: organization_id unknown';
  END IF;

  INSERT INTO grn_counters (organization_id, last_number)
  VALUES (v_org_id, 1)
  ON CONFLICT (organization_id) DO UPDATE
    SET last_number = grn_counters.last_number + 1
  RETURNING last_number INTO v_num;

  NEW.grn_number := 'GRN-' || LPAD(v_num::TEXT, 5, '0');
  RETURN NEW;
END;
$$;

CREATE TRIGGER po_receipts_stamp_grn_number
  BEFORE INSERT ON po_receipts
  FOR EACH ROW EXECUTE FUNCTION set_grn_number();


-- ── 4. Drop + recreate receive_po_goods() ─────────────────────────────────────
-- Must DROP first: PostgreSQL forbids changing a function's return type via
-- CREATE OR REPLACE. The new version returns JSONB {id, grn_number} so the
-- caller can display the GRN number immediately after receipt.

DROP FUNCTION IF EXISTS receive_po_goods(uuid, uuid, date, text, jsonb);

CREATE FUNCTION receive_po_goods(
  p_po_id        UUID,
  p_location_id  UUID,
  p_receipt_date DATE    DEFAULT CURRENT_DATE,
  p_notes        TEXT    DEFAULT NULL,
  p_items        JSONB   DEFAULT '[]'
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_org_id          UUID;
  v_vendor_id       UUID;
  v_po_number       TEXT;
  v_po_status       TEXT;
  v_receipt_id      UUID;
  v_grn_number      TEXT;
  i                 INT;
  v_item_data       JSONB;
  v_item_id         UUID;
  v_product_id      UUID;
  v_unit_cost       NUMERIC;
  v_qty             NUMERIC;
  v_pending         NUMERIC;
  v_total_ordered   NUMERIC;
  v_total_received  NUMERIC;
  v_new_status      TEXT;
BEGIN
  -- Fetch PO header
  SELECT organization_id, vendor_id, po_number, status
  INTO v_org_id, v_vendor_id, v_po_number, v_po_status
  FROM purchase_orders WHERE id = p_po_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Purchase order not found';
  END IF;

  -- Authorization: PO must belong to caller's org
  IF v_org_id != auth_org_id() THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  IF v_po_status = 'cancelled' THEN
    RAISE EXCEPTION 'Cannot receive goods for a cancelled purchase order';
  END IF;

  IF v_po_status = 'received' THEN
    RAISE EXCEPTION 'Purchase order is already fully received';
  END IF;

  -- Create receipt audit record; set_grn_number trigger auto-generates grn_number
  INSERT INTO po_receipts (organization_id, purchase_order_id, receipt_date, notes, created_by)
  VALUES (v_org_id, p_po_id, p_receipt_date, p_notes, auth.uid())
  RETURNING id, grn_number INTO v_receipt_id, v_grn_number;

  -- Process each item in the JSONB array
  FOR i IN 0 .. jsonb_array_length(p_items) - 1
  LOOP
    v_item_data := p_items->i;
    v_item_id   := (v_item_data->>'po_item_id')::uuid;
    v_qty       := COALESCE((v_item_data->>'qty')::numeric, 0);

    IF v_qty <= 0 THEN CONTINUE; END IF;

    -- Fetch item details, verify it belongs to this PO
    SELECT product_id, unit_cost
    INTO v_product_id, v_unit_cost
    FROM purchase_order_items
    WHERE id = v_item_id AND purchase_order_id = p_po_id;

    IF NOT FOUND THEN CONTINUE; END IF;

    -- Cap at remaining pending quantity to prevent over-receiving
    SELECT quantity - received_qty INTO v_pending
    FROM purchase_order_items WHERE id = v_item_id;

    v_qty := LEAST(v_qty, v_pending);
    IF v_qty <= 0 THEN CONTINUE; END IF;

    -- Receipt item (audit log)
    INSERT INTO po_receipt_items (receipt_id, po_item_id, product_id, location_id, quantity)
    VALUES (v_receipt_id, v_item_id, v_product_id, p_location_id, v_qty);

    -- Stock movement: triggers apply_stock_movement → updates stock_levels
    IF v_product_id IS NOT NULL THEN
      INSERT INTO stock_movements (
        organization_id, product_id, location_id,
        movement_type, quantity, unit_price,
        reference_no, vendor_id, document_id, document_type,
        notes, created_by
      ) VALUES (
        v_org_id, v_product_id, p_location_id,
        'receipt', v_qty, v_unit_cost,
        v_grn_number, v_vendor_id, p_po_id, 'purchase_order',
        'Received via ' || v_grn_number || ' (' || v_po_number || ')', auth.uid()
      );
    END IF;

    -- Update received quantity on PO item
    UPDATE purchase_order_items
    SET received_qty = received_qty + v_qty
    WHERE id = v_item_id;
  END LOOP;

  -- Recalculate PO status from current totals
  SELECT SUM(quantity), SUM(received_qty)
  INTO v_total_ordered, v_total_received
  FROM purchase_order_items
  WHERE purchase_order_id = p_po_id;

  IF v_total_received >= v_total_ordered THEN
    v_new_status := 'received';
  ELSIF v_total_received > 0 THEN
    v_new_status := 'partial';
  ELSE
    v_new_status := v_po_status;
  END IF;

  UPDATE purchase_orders
  SET status = v_new_status, updated_at = now()
  WHERE id = p_po_id;

  RETURN jsonb_build_object('id', v_receipt_id, 'grn_number', v_grn_number);
END;
$$;
