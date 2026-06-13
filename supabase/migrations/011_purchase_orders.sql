-- ================================================================
-- Migration 011: Purchase Order Management
--   1. po_counters              – atomic PO number generation
--   2. purchase_orders          – PO header
--   3. purchase_order_items     – line items (tracks received_qty)
--   4. po_receipts              – goods receipt audit log
--   5. po_receipt_items         – what was received per receipt
--   6. set_po_number()          – BEFORE INSERT trigger → PO-00001
--   7. receive_po_goods()       – atomic RPC: receipt + stock + status
-- ================================================================


-- ── 1. PO Counters ───────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS po_counters (
  organization_id UUID PRIMARY KEY REFERENCES organizations(id) ON DELETE CASCADE,
  last_number     INT  NOT NULL DEFAULT 0
);

ALTER TABLE po_counters ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org access: po_counters" ON po_counters
  FOR ALL USING (organization_id = auth_org_id());


-- ── 2. Purchase Orders ───────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS purchase_orders (
  id              UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID          REFERENCES organizations(id) ON DELETE CASCADE,
  po_number       TEXT          NOT NULL DEFAULT '',
  vendor_id       UUID          REFERENCES vendors(id) ON DELETE SET NULL,
  po_date         DATE          NOT NULL DEFAULT CURRENT_DATE,
  expected_date   DATE,
  status          TEXT          NOT NULL DEFAULT 'draft'
                  CHECK (status IN ('draft','sent','partial','received','cancelled')),
  subtotal        NUMERIC(14,2) NOT NULL DEFAULT 0,
  tax_amount      NUMERIC(14,2) NOT NULL DEFAULT 0,
  total_amount    NUMERIC(14,2) NOT NULL DEFAULT 0,
  notes           TEXT,
  created_by      UUID          REFERENCES auth.users(id),
  created_at      TIMESTAMPTZ   NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ   NOT NULL DEFAULT now(),
  UNIQUE(organization_id, po_number)
);

ALTER TABLE purchase_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org access: purchase_orders" ON purchase_orders
  FOR ALL USING (organization_id = auth_org_id());

CREATE INDEX IF NOT EXISTS idx_po_org         ON purchase_orders (organization_id);
CREATE INDEX IF NOT EXISTS idx_po_org_date    ON purchase_orders (organization_id, po_date DESC);
CREATE INDEX IF NOT EXISTS idx_po_vendor      ON purchase_orders (vendor_id) WHERE vendor_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_po_status      ON purchase_orders (organization_id, status);

-- Auto-fill organization_id (reuses set_org_id() from migration 002)
CREATE TRIGGER purchase_orders_set_org_id
  BEFORE INSERT ON purchase_orders
  FOR EACH ROW EXECUTE FUNCTION set_org_id();

-- Auto-update updated_at (reuses update_updated_at() from migration 001)
CREATE TRIGGER purchase_orders_updated_at
  BEFORE UPDATE ON purchase_orders
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();


-- ── 3. Purchase Order Items ──────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS purchase_order_items (
  id                UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
  purchase_order_id UUID          NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
  product_id        UUID          REFERENCES products(id) ON DELETE SET NULL,
  description       TEXT          NOT NULL,
  quantity          NUMERIC(12,3) NOT NULL CHECK (quantity > 0),
  received_qty      NUMERIC(12,3) NOT NULL DEFAULT 0 CHECK (received_qty >= 0),
  unit_cost         NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (unit_cost >= 0),
  tax_rate          NUMERIC(5,2)  NOT NULL DEFAULT 0  CHECK (tax_rate >= 0 AND tax_rate <= 100),
  line_total        NUMERIC(14,2) NOT NULL DEFAULT 0,
  sort_order        INT           NOT NULL DEFAULT 0
);

ALTER TABLE purchase_order_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org access: purchase_order_items" ON purchase_order_items
  FOR ALL USING (
    purchase_order_id IN (
      SELECT id FROM purchase_orders WHERE organization_id = auth_org_id()
    )
  );

CREATE INDEX IF NOT EXISTS idx_po_items_po      ON purchase_order_items (purchase_order_id);
CREATE INDEX IF NOT EXISTS idx_po_items_product ON purchase_order_items (product_id) WHERE product_id IS NOT NULL;


-- ── 4. PO Receipts (goods receipt audit log) ─────────────────────────────────

CREATE TABLE IF NOT EXISTS po_receipts (
  id                UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id   UUID        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  purchase_order_id UUID        NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
  receipt_date      DATE        NOT NULL DEFAULT CURRENT_DATE,
  notes             TEXT,
  created_by        UUID        REFERENCES auth.users(id),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE po_receipts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org access: po_receipts" ON po_receipts
  FOR ALL USING (organization_id = auth_org_id());

-- Auto-fill organization_id
CREATE TRIGGER po_receipts_set_org_id
  BEFORE INSERT ON po_receipts
  FOR EACH ROW EXECUTE FUNCTION set_org_id();

CREATE INDEX IF NOT EXISTS idx_po_receipts_po  ON po_receipts (purchase_order_id);
CREATE INDEX IF NOT EXISTS idx_po_receipts_org ON po_receipts (organization_id);


-- ── 5. PO Receipt Items ──────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS po_receipt_items (
  id          UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
  receipt_id  UUID          NOT NULL REFERENCES po_receipts(id)             ON DELETE CASCADE,
  po_item_id  UUID          NOT NULL REFERENCES purchase_order_items(id)    ON DELETE CASCADE,
  product_id  UUID          REFERENCES products(id) ON DELETE SET NULL,
  location_id UUID          REFERENCES locations(id) ON DELETE SET NULL,
  quantity    NUMERIC(12,3) NOT NULL CHECK (quantity > 0)
);

ALTER TABLE po_receipt_items ENABLE ROW LEVEL SECURITY;

-- RLS: accessible if its parent receipt belongs to the user's org
CREATE POLICY "org access: po_receipt_items" ON po_receipt_items
  FOR ALL USING (
    receipt_id IN (
      SELECT id FROM po_receipts WHERE organization_id = auth_org_id()
    )
  );

CREATE INDEX IF NOT EXISTS idx_po_receipt_items_receipt  ON po_receipt_items (receipt_id);
CREATE INDEX IF NOT EXISTS idx_po_receipt_items_po_item  ON po_receipt_items (po_item_id);


-- ── 6. Auto PO Number ─────────────────────────────────────────────────────────
-- Fires AFTER purchase_orders_set_org_id (alphabetically: 'p' > 'o').
-- Uses COALESCE so it works even if org_id arrives before set_org_id fires.

CREATE OR REPLACE FUNCTION set_po_number()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_num    INT;
  v_org_id UUID;
BEGIN
  -- Skip if caller supplied a number (re-run safety)
  IF NEW.po_number IS NOT NULL AND NEW.po_number != '' THEN
    RETURN NEW;
  END IF;

  v_org_id := COALESCE(
    NEW.organization_id,
    (SELECT organization_id FROM profiles WHERE id = auth.uid())
  );

  IF v_org_id IS NULL THEN
    RAISE EXCEPTION 'Cannot generate PO number: organization_id unknown';
  END IF;

  INSERT INTO po_counters (organization_id, last_number)
  VALUES (v_org_id, 1)
  ON CONFLICT (organization_id) DO UPDATE
    SET last_number = po_counters.last_number + 1
  RETURNING last_number INTO v_num;

  NEW.po_number := 'PO-' || LPAD(v_num::TEXT, 5, '0');
  RETURN NEW;
END;
$$;

CREATE TRIGGER purchase_orders_set_po_number
  BEFORE INSERT ON purchase_orders
  FOR EACH ROW EXECUTE FUNCTION set_po_number();


-- ── 7. receive_po_goods() RPC ─────────────────────────────────────────────────
-- Atomic goods receipt: inserts audit records, creates stock_movements (type
-- 'receipt'), updates received_qty on po_items, and recalculates PO status.
--
-- p_items JSON: [{po_item_id: uuid, qty: number}]

CREATE OR REPLACE FUNCTION receive_po_goods(
  p_po_id        UUID,
  p_location_id  UUID,
  p_receipt_date DATE    DEFAULT CURRENT_DATE,
  p_notes        TEXT    DEFAULT NULL,
  p_items        JSONB   DEFAULT '[]'
) RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_org_id          UUID;
  v_vendor_id       UUID;
  v_po_number       TEXT;
  v_po_status       TEXT;
  v_receipt_id      UUID;
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
  -- Fetch PO
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

  -- Create receipt audit record
  INSERT INTO po_receipts (organization_id, purchase_order_id, receipt_date, notes, created_by)
  VALUES (v_org_id, p_po_id, p_receipt_date, p_notes, auth.uid())
  RETURNING id INTO v_receipt_id;

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

    -- Stock movement — triggers apply_stock_movement → updates stock_levels
    IF v_product_id IS NOT NULL THEN
      INSERT INTO stock_movements (
        organization_id, product_id, location_id,
        movement_type, quantity, unit_price,
        reference_no, vendor_id, document_id, document_type,
        notes, created_by
      ) VALUES (
        v_org_id, v_product_id, p_location_id,
        'receipt', v_qty, v_unit_cost,
        v_po_number, v_vendor_id, p_po_id, 'purchase_order',
        'Received via ' || v_po_number, auth.uid()
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
END;
$$;
