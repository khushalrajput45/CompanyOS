-- ================================================================
-- Migration 007: Fix NULL organization_id in set_quotation_number()
--
-- Root cause: PostgreSQL fires BEFORE triggers in alphabetical order.
--   quotations_set_number  fires FIRST  ('n' < 'o')
--   quotations_set_org_id  fires SECOND
-- So when set_quotation_number() runs, NEW.organization_id is still
-- NULL (the client never sends it). The INSERT into quotation_counters
-- fails with a NOT NULL violation on the primary key.
--
-- Fix: resolve organization_id directly from auth.uid() when
-- NEW.organization_id is NULL, the same way set_org_id() does it.
-- ================================================================

CREATE OR REPLACE FUNCTION set_quotation_number()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_seq  bigint;
  v_org  uuid;
BEGIN
  IF NEW.quotation_number IS NULL OR NEW.quotation_number = '' THEN

    -- quotations_set_org_id may not have run yet (fires after this trigger
    -- alphabetically), so we resolve organization_id ourselves if needed.
    v_org := COALESCE(
      NEW.organization_id,
      (SELECT organization_id FROM profiles WHERE id = auth.uid())
    );

    INSERT INTO quotation_counters (organization_id, last_number)
    VALUES (v_org, 1)
    ON CONFLICT (organization_id) DO UPDATE
      SET last_number = quotation_counters.last_number + 1
    RETURNING last_number INTO v_seq;

    NEW.quotation_number := 'Q-' || LPAD(v_seq::text, 6, '0');

  END IF;
  RETURN NEW;
END;
$$;
