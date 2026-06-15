-- ── Migration 026: Billing & Shipping Addresses ───────────────────────────────
-- Adds structured JSONB address fields to customers, quotations, and invoices.
-- Backward compatible — existing flat address fields on customers are untouched.

-- customers: shipping address (billing = existing flat fields address/city/state/pincode)
ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS shipping_address jsonb;

-- quotations: store billing + shipping at document creation time
-- (snapshot of customer address so later edits don't affect sent documents)
ALTER TABLE quotations
  ADD COLUMN IF NOT EXISTS billing_address jsonb,
  ADD COLUMN IF NOT EXISTS shipping_address jsonb;

-- invoices: same snapshot approach
ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS billing_address jsonb,
  ADD COLUMN IF NOT EXISTS shipping_address jsonb;
