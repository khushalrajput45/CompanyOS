-- ============================================================
-- Migration 018: Enforce integer quantities
--
-- IT hardware is sold in whole units only. This migration
-- converts all item-quantity columns from NUMERIC(12,3) to
-- INTEGER, rounding any existing fractional values.
--
-- Columns that stay NUMERIC (monetary / rates):
--   unit_price, unit_cost, cost_price, selling_price, mrp,
--   tax_rate, line_total, subtotal, tax_amount, total_amount
-- ============================================================

-- ── 1. Round any existing fractional values ───────────────────────────────────

UPDATE quotation_items
SET quantity = ROUND(quantity)
WHERE quantity <> ROUND(quantity);

UPDATE invoice_items
SET quantity = ROUND(quantity)
WHERE quantity <> ROUND(quantity);

UPDATE purchase_order_items
SET quantity     = ROUND(quantity),
    received_qty = ROUND(received_qty)
WHERE quantity <> ROUND(quantity) OR received_qty <> ROUND(received_qty);

UPDATE po_receipt_items
SET quantity = ROUND(quantity)
WHERE quantity <> ROUND(quantity);

-- ── 2. Alter column types ─────────────────────────────────────────────────────

ALTER TABLE quotation_items
  ALTER COLUMN quantity TYPE integer USING ROUND(quantity)::integer;

ALTER TABLE invoice_items
  ALTER COLUMN quantity TYPE integer USING ROUND(quantity)::integer;

ALTER TABLE purchase_order_items
  ALTER COLUMN quantity     TYPE integer USING ROUND(quantity)::integer,
  ALTER COLUMN received_qty TYPE integer USING ROUND(received_qty)::integer;

ALTER TABLE po_receipt_items
  ALTER COLUMN quantity TYPE integer USING ROUND(quantity)::integer;

-- ── 3. Refresh receive_po_goods() with integer-typed local variables ──────────
-- The function logic is unchanged; only the DECLARE types are narrowed
-- from NUMERIC to INTEGER for v_qty / v_pending / v_total_ordered / v_total_received.
-- The return type (JSONB) is unchanged so DROP + CREATE is not required here.

CREATE OR REPLACE FUNCTION receive_po_goods(
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
  v_qty             INTEGER;   -- was NUMERIC
  v_pending         INTEGER;   -- was NUMERIC
  v_total_ordered   INTEGER;   -- was NUMERIC
  v_total_received  INTEGER;   -- was NUMERIC
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
    -- Round to nearest integer; discard any fractional qty sent from client
    v_qty       := COALESCE(ROUND((v_item_data->>'qty')::numeric)::integer, 0);

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
  SET status = v_new_status
  WHERE id = p_po_id AND status NOT IN ('cancelled');

  RETURN jsonb_build_object('id', v_receipt_id, 'grn_number', v_grn_number);
END;
$$;
