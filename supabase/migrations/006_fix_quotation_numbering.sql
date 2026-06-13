-- ================================================================
-- Migration 006: Fix quotation auto-numbering
--
-- Problems with the old trigger:
--   1. MAX()+1 is not safe under concurrent inserts — two transactions
--      can read the same MAX and generate a duplicate.
--   2. Format was QT-YYYY-NNNN; required format is Q-000001.
--
-- Solution: a dedicated counter table.
--   INSERT … ON CONFLICT DO UPDATE … RETURNING is a single atomic
--   statement in PostgreSQL, so concurrent inserts are safe.
-- ================================================================


-- ── 1. Counter table ──────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS quotation_counters (
  organization_id  uuid    PRIMARY KEY REFERENCES organizations(id) ON DELETE CASCADE,
  last_number      bigint  NOT NULL DEFAULT 0
);

-- Only the trigger (SECURITY DEFINER) needs to touch this table.
ALTER TABLE quotation_counters ENABLE ROW LEVEL SECURITY;


-- ── 2. Seed counters from existing quotation data ─────────────────────────────
-- Sets each org's counter to the number of quotations already created so the
-- next generated number doesn't collide with any existing row.

INSERT INTO quotation_counters (organization_id, last_number)
SELECT organization_id, COUNT(*)
FROM   quotations
GROUP  BY organization_id
ON CONFLICT (organization_id) DO UPDATE
  SET last_number = EXCLUDED.last_number;


-- ── 3. Replacement trigger function ──────────────────────────────────────────

CREATE OR REPLACE FUNCTION set_quotation_number()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_seq bigint;
BEGIN
  IF NEW.quotation_number IS NULL OR NEW.quotation_number = '' THEN

    -- Atomic increment: safe for concurrent inserts.
    INSERT INTO quotation_counters (organization_id, last_number)
    VALUES (NEW.organization_id, 1)
    ON CONFLICT (organization_id) DO UPDATE
      SET last_number = quotation_counters.last_number + 1
    RETURNING last_number INTO v_seq;

    NEW.quotation_number := 'Q-' || LPAD(v_seq::text, 6, '0');

  END IF;
  RETURN NEW;
END;
$$;
