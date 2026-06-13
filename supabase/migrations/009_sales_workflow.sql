-- ================================================================
-- Migration 009: Complete Sales Workflow
--   1. Rename status partially_paid → partial
--   2. Add amount_paid to invoices
--   3. invoice_payments table (payment tracking)
--   4. Trigger: auto-sync invoice amount_paid + status on payment change
--   5. Helper RPC: increment_stock_level (for safe stock restoration)
-- ================================================================


-- ── 1. Rename partially_paid → partial ───────────────────────────────────────

-- Drop old check constraint (PostgreSQL names it <table>_<col>_check by default)
ALTER TABLE invoices DROP CONSTRAINT IF EXISTS invoices_status_check;

-- Add updated constraint with 'partial' replacing 'partially_paid'
ALTER TABLE invoices ADD CONSTRAINT invoices_status_check
  CHECK (status IN ('draft','sent','paid','partial','overdue'));

-- Migrate any existing rows
UPDATE invoices SET status = 'partial' WHERE status = 'partially_paid';


-- ── 2. Add amount_paid ────────────────────────────────────────────────────────

ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS amount_paid NUMERIC(14,2) NOT NULL DEFAULT 0
    CHECK (amount_paid >= 0);


-- ── 3. Invoice Payments ───────────────────────────────────────────────────────

CREATE TABLE invoice_payments (
  id              UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID          NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  invoice_id      UUID          NOT NULL REFERENCES invoices(id)      ON DELETE CASCADE,
  amount          NUMERIC(14,2) NOT NULL CHECK (amount > 0),
  payment_date    DATE          NOT NULL DEFAULT CURRENT_DATE,
  payment_method  TEXT          NOT NULL DEFAULT 'cash'
                  CHECK (payment_method IN ('cash','bank_transfer','cheque','upi','other')),
  notes           TEXT,
  created_by      UUID          REFERENCES auth.users(id),
  created_at      TIMESTAMPTZ   NOT NULL DEFAULT now()
);

ALTER TABLE invoice_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org access: invoice_payments" ON invoice_payments
  FOR ALL USING (organization_id = auth_org_id());

-- Auto-fill organization_id
CREATE TRIGGER invoice_payments_set_org_id
  BEFORE INSERT ON invoice_payments
  FOR EACH ROW EXECUTE FUNCTION set_org_id();

-- Indexes
CREATE INDEX idx_invoice_payments_invoice ON invoice_payments (invoice_id);
CREATE INDEX idx_invoice_payments_org     ON invoice_payments (organization_id);
CREATE INDEX idx_invoice_payments_date    ON invoice_payments (payment_date DESC);


-- ── 4. Trigger: sync invoice.amount_paid and status ───────────────────────────
-- Fires AFTER INSERT or DELETE on invoice_payments.
-- AFTER INSERT: new row is already in the table → SUM includes it.
-- AFTER DELETE: deleted row is gone from the table → SUM excludes it.

CREATE OR REPLACE FUNCTION sync_invoice_payment_status()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_invoice_id    UUID;
  v_total         NUMERIC;
  v_paid          NUMERIC;
  v_current_st    TEXT;
  v_new_st        TEXT;
BEGIN
  -- Use TG_OP to safely access the correct row variable.
  -- For DELETE, NEW is an uninitialized record — never access its fields.
  IF TG_OP = 'DELETE' THEN
    v_invoice_id := OLD.invoice_id;
  ELSE
    v_invoice_id := NEW.invoice_id;
  END IF;

  SELECT total_amount, status
    INTO v_total, v_current_st
    FROM invoices WHERE id = v_invoice_id;

  -- After INSERT: SUM already includes the new row.
  -- After DELETE: SUM already excludes the removed row.
  SELECT COALESCE(SUM(amount), 0)
    INTO v_paid
    FROM invoice_payments WHERE invoice_id = v_invoice_id;

  -- Determine new status
  IF v_paid >= v_total AND v_total > 0 THEN
    v_new_st := 'paid';
  ELSIF v_paid > 0 THEN
    v_new_st := 'partial';
  ELSE
    -- No payments remaining: revert paid/partial → sent; keep draft/overdue
    IF v_current_st IN ('paid', 'partial') THEN
      v_new_st := 'sent';
    ELSE
      v_new_st := v_current_st;
    END IF;
  END IF;

  UPDATE invoices
     SET amount_paid = v_paid,
         status      = v_new_st,
         updated_at  = now()
   WHERE id = v_invoice_id;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$;

CREATE TRIGGER invoice_payments_sync
  AFTER INSERT OR DELETE ON invoice_payments
  FOR EACH ROW EXECUTE FUNCTION sync_invoice_payment_status();


-- ── 5. Helper: increment_stock_level ─────────────────────────────────────────
-- Safe atomic stock adjustment. p_delta > 0 adds stock (restore), < 0 removes
-- stock (deduct), always floored at 0 to prevent negative quantities.

CREATE OR REPLACE FUNCTION increment_stock_level(
  p_product_id  UUID,
  p_location_id UUID,
  p_delta       NUMERIC
) RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO stock_levels (product_id, location_id, quantity)
  VALUES (p_product_id, p_location_id, GREATEST(0, p_delta))
  ON CONFLICT (product_id, location_id) DO UPDATE
    SET quantity   = GREATEST(0, stock_levels.quantity + p_delta),
        updated_at = now();
END;
$$;


-- ── 6. Fix apply_stock_movement: floor stock at 0 on first-ever sale ──────────
-- The original trigger uses VALUES (..., -new.quantity) for outbound movements.
-- When no prior stock_level row exists (product never received at that location),
-- this inserts a NEGATIVE quantity. The ON CONFLICT path correctly uses GREATEST
-- but the INSERT path does not. Fix: use GREATEST(0, -new.quantity) = 0 so the
-- first outbound movement at a location never creates negative stock.

CREATE OR REPLACE FUNCTION apply_stock_movement()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF new.movement_type IN ('receipt', 'transfer_in', 'return', 'adjustment') THEN
    INSERT INTO stock_levels (product_id, location_id, quantity)
    VALUES (new.product_id, new.location_id, new.quantity)
    ON CONFLICT (product_id, location_id) DO UPDATE
      SET quantity   = stock_levels.quantity + new.quantity,
          updated_at = now();
  ELSIF new.movement_type IN ('sale', 'transfer_out', 'damage') THEN
    INSERT INTO stock_levels (product_id, location_id, quantity)
    VALUES (new.product_id, new.location_id, GREATEST(0, -new.quantity))
    ON CONFLICT (product_id, location_id) DO UPDATE
      SET quantity   = GREATEST(0, stock_levels.quantity - new.quantity),
          updated_at = now();
  END IF;
  RETURN new;
END;
$$;


-- ── 7. RLS policies for counter tables ───────────────────────────────────────
-- Both quotation_counters (migration 006) and invoice_counters (migration 008)
-- had RLS enabled but no policy added. The trigger functions are SECURITY
-- DEFINER so they bypass RLS, but adding explicit policies removes the risk.

CREATE POLICY "org access: invoice_counters" ON invoice_counters
  FOR ALL USING (organization_id = auth_org_id());

CREATE POLICY "org access: quotation_counters" ON quotation_counters
  FOR ALL USING (organization_id = auth_org_id());
