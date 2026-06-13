-- ================================================================
-- Migration 010: Full Vendors Schema
-- Extends the minimal vendors table (migration 001) with:
--   1. Renamed columns (gstin → gst_number, contact_name → contact_person)
--   2. New columns (company_name, city, state, pincode, notes, updated_at)
--   3. Indexes
--   4. updated_at trigger (reuses update_updated_at() from migration 001)
--   5. Seed data — 8 realistic IT hardware distributors
-- ================================================================


-- ── 1. Rename columns ─────────────────────────────────────────────────────────

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'vendors' AND column_name = 'gstin'
  ) THEN
    ALTER TABLE vendors RENAME COLUMN gstin TO gst_number;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'vendors' AND column_name = 'contact_name'
  ) THEN
    ALTER TABLE vendors RENAME COLUMN contact_name TO contact_person;
  END IF;
END;
$$;


-- ── 2. Add new columns ────────────────────────────────────────────────────────

ALTER TABLE vendors
  ADD COLUMN IF NOT EXISTS company_name TEXT,
  ADD COLUMN IF NOT EXISTS city         TEXT,
  ADD COLUMN IF NOT EXISTS state        TEXT,
  ADD COLUMN IF NOT EXISTS pincode      TEXT,
  ADD COLUMN IF NOT EXISTS notes        TEXT,
  ADD COLUMN IF NOT EXISTS updated_at   TIMESTAMPTZ NOT NULL DEFAULT now();


-- ── 3. Indexes ────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_vendors_org        ON vendors (organization_id);
CREATE INDEX IF NOT EXISTS idx_vendors_org_name   ON vendors (organization_id, name);
CREATE INDEX IF NOT EXISTS idx_vendors_org_active ON vendors (organization_id, is_active);


-- ── 4. updated_at trigger ─────────────────────────────────────────────────────
-- Reuses update_updated_at() defined in migration 001.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.triggers
    WHERE trigger_name = 'vendors_updated_at' AND event_object_table = 'vendors'
  ) THEN
    EXECUTE '
      CREATE TRIGGER vendors_updated_at
        BEFORE UPDATE ON vendors
        FOR EACH ROW EXECUTE FUNCTION update_updated_at()
    ';
  END IF;
END;
$$;


-- ── 5. Seed vendors ───────────────────────────────────────────────────────────
-- Only seeds when an organization exists and no vendors have been added yet.

DO $$
DECLARE
  v_org_id UUID;
BEGIN
  SELECT id INTO v_org_id FROM organizations LIMIT 1;

  IF v_org_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM vendors WHERE organization_id = v_org_id
  ) THEN
    INSERT INTO vendors (
      organization_id, name, company_name, gst_number, phone, email,
      address, city, state, pincode, contact_person, notes, is_active
    ) VALUES
      (v_org_id,
       'Dell India Distributor', 'Dell Technologies India Pvt Ltd',
       '27AALCD1234B1Z5', '+91 20 6128 0000', 'procurement@dell-ind.com',
       'IT Park Phase II, Hinjewadi', 'Pune', 'Maharashtra', '411057',
       'Rajesh Menon', 'Authorized distributor — laptops, desktops, servers, workstations', true),

      (v_org_id,
       'HP Enterprise Solutions', 'Hewlett-Packard India Sales Pvt Ltd',
       '07AABCH1234A1Z5', '+91 11 4150 8888', 'orders@hp-enterprise.in',
       'DLF Cyber City, Phase III', 'Gurugram', 'Haryana', '122002',
       'Suresh Pillai', 'HP printers, laptops, enterprise hardware', true),

      (v_org_id,
       'Lenovo Distribution Hub', 'Lenovo (India) Pvt Ltd',
       '19AABCL5678C1Z5', '+91 33 6612 5000', 'supply@lenovo-dist.in',
       'Plot 12, Salt Lake Sector V', 'Kolkata', 'West Bengal', '700091',
       'Priya Sharma', 'Lenovo ThinkPad, IdeaPad, Legion series laptops and tablets', true),

      (v_org_id,
       'Hikvision Security Systems', 'Hikvision India Pvt Ltd',
       '27AABCH9876D1Z5', '+91 22 4055 3000', 'sales@hikvision-india.com',
       'MIDC, Andheri East', 'Mumbai', 'Maharashtra', '400093',
       'Vikram Nair', 'CCTV cameras, NVR/DVR systems, video surveillance solutions', true),

      (v_org_id,
       'Dahua Technology India', 'Dahua Technology India Pvt Ltd',
       '27AABCD5432E1Z5', '+91 22 6630 7000', 'orders@dahua-india.in',
       'Saki Naka, Powai', 'Mumbai', 'Maharashtra', '400072',
       'Anita Joshi', 'IP cameras, access control, video intercom systems', true),

      (v_org_id,
       'TP-Link Networking', 'TP-Link Technologies India Pvt Ltd',
       '29AABCT1111F1Z5', '+91 80 4646 9000', 'b2b@tplink-india.com',
       'ITPL Road, Whitefield', 'Bengaluru', 'Karnataka', '560066',
       'Deepak Verma', 'Routers, switches, WiFi 6 access points, SMB networking gear', true),

      (v_org_id,
       'APC Power Solutions', 'APC by Schneider Electric India Pvt Ltd',
       '07AABCA2222G1Z5', '+91 124 495 0000', 'ups@apc-india.com',
       'Udyog Vihar, Sector 44', 'Gurugram', 'Haryana', '122001',
       'Neha Kapoor', 'UPS systems, power strips, rack enclosures, power management', true),

      (v_org_id,
       'Logitech Peripherals Hub', 'Logitech Technology India Pvt Ltd',
       '27AABCL3333H1Z5', '+91 20 6730 2000', 'orders@logitech-b2b.in',
       'Baner Road, Technology Zone', 'Pune', 'Maharashtra', '411045',
       'Ravi Kumar', 'Keyboards, mice, webcams, headsets, gaming peripherals', true);
  END IF;
END;
$$;
