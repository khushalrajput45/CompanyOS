-- ── Fix user deletion: set created_by / changed_by to NULL on auth.users delete ──
-- All created_by / changed_by columns reference auth.users(id) with the default
-- ON DELETE NO ACTION, which blocks deleting a user that has any activity.
-- This migration drops and re-adds every such FK with ON DELETE SET NULL.

ALTER TABLE stock_movements
  DROP CONSTRAINT IF EXISTS stock_movements_created_by_fkey,
  ADD  CONSTRAINT stock_movements_created_by_fkey
    FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE price_history
  DROP CONSTRAINT IF EXISTS price_history_changed_by_fkey,
  ADD  CONSTRAINT price_history_changed_by_fkey
    FOREIGN KEY (changed_by) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE import_logs
  DROP CONSTRAINT IF EXISTS import_logs_created_by_fkey,
  ADD  CONSTRAINT import_logs_created_by_fkey
    FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;

-- audit_logs may have been recreated by 025_audit_logs with user_id; fix both variants
ALTER TABLE audit_logs
  DROP CONSTRAINT IF EXISTS audit_logs_created_by_fkey,
  DROP CONSTRAINT IF EXISTS audit_logs_user_id_fkey;
ALTER TABLE audit_logs
  ADD CONSTRAINT audit_logs_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE stock_take_sessions
  DROP CONSTRAINT IF EXISTS stock_take_sessions_created_by_fkey,
  ADD  CONSTRAINT stock_take_sessions_created_by_fkey
    FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE quotations
  DROP CONSTRAINT IF EXISTS quotations_created_by_fkey,
  ADD  CONSTRAINT quotations_created_by_fkey
    FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE invoices
  DROP CONSTRAINT IF EXISTS invoices_created_by_fkey,
  ADD  CONSTRAINT invoices_created_by_fkey
    FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE invoice_payments
  DROP CONSTRAINT IF EXISTS invoice_payments_created_by_fkey,
  ADD  CONSTRAINT invoice_payments_created_by_fkey
    FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE purchase_orders
  DROP CONSTRAINT IF EXISTS purchase_orders_created_by_fkey,
  ADD  CONSTRAINT purchase_orders_created_by_fkey
    FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE po_receipts
  DROP CONSTRAINT IF EXISTS po_receipts_created_by_fkey,
  ADD  CONSTRAINT po_receipts_created_by_fkey
    FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE vendor_payments
  DROP CONSTRAINT IF EXISTS vendor_payments_created_by_fkey,
  ADD  CONSTRAINT vendor_payments_created_by_fkey
    FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;
