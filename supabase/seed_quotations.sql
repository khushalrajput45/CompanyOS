-- ================================================================
-- CompanyOS — Quotation Seed Data
-- 5 realistic quotations for IT/CCTV/Networking business
--
-- Requires: seed_customers.sql + seed_enterprise.sql already applied.
-- Run in Supabase SQL Editor after migration 005.
-- Safe to run multiple times — skips if quotations already exist.
-- ================================================================

DO $$
DECLARE
  v_org_id   uuid;
  v_user_id  uuid;

  -- Customer IDs
  c_abc      uuid;  -- ABC Technologies / Rajesh Kumar
  c_shree    uuid;  -- Shree Infotech / Priya Sharma
  c_techvis  uuid;  -- Tech Vision Systems / Suresh Patel
  c_global   uuid;  -- Global IT Solutions / Vikram Singh
  c_prime    uuid;  -- Prime Networks / Sravani Reddy

  -- Product IDs (by SKU from seed_enterprise)
  p_cam2mp   uuid;  p_cam4mp   uuid;  p_dvr8ch   uuid;
  p_nvr8ch   uuid;  p_laptop   uuid;  p_switch   uuid;
  p_router   uuid;  p_hdd2tb   uuid;  p_ups1kva  uuid;
  p_cat6box  uuid;

  -- Quotation IDs
  q1 uuid;  q2 uuid;  q3 uuid;  q4 uuid;  q5 uuid;

BEGIN
  SELECT id INTO v_org_id  FROM organizations LIMIT 1;
  SELECT id INTO v_user_id FROM auth.users    LIMIT 1;

  IF v_org_id IS NULL THEN
    RAISE EXCEPTION 'No organization found.';
  END IF;

  IF EXISTS (SELECT 1 FROM quotations WHERE organization_id = v_org_id LIMIT 1) THEN
    RAISE NOTICE 'Quotation seed already applied. Skipping.';
    RETURN;
  END IF;

  -- ── Fetch Customer IDs ─────────────────────────────────────────
  SELECT id INTO c_abc     FROM customers WHERE organization_id = v_org_id AND name = 'Rajesh Kumar'   LIMIT 1;
  SELECT id INTO c_shree   FROM customers WHERE organization_id = v_org_id AND name = 'Priya Sharma'   LIMIT 1;
  SELECT id INTO c_techvis FROM customers WHERE organization_id = v_org_id AND name = 'Suresh Patel'   LIMIT 1;
  SELECT id INTO c_global  FROM customers WHERE organization_id = v_org_id AND name = 'Vikram Singh'   LIMIT 1;
  SELECT id INTO c_prime   FROM customers WHERE organization_id = v_org_id AND name = 'Sravani Reddy'  LIMIT 1;

  -- ── Fetch Product IDs ──────────────────────────────────────────
  SELECT id INTO p_cam2mp  FROM products WHERE organization_id = v_org_id AND sku LIKE '%CAM%HIK%2MP%' LIMIT 1;
  SELECT id INTO p_cam4mp  FROM products WHERE organization_id = v_org_id AND sku LIKE '%CAM%DAH%4MP%' LIMIT 1;
  SELECT id INTO p_dvr8ch  FROM products WHERE organization_id = v_org_id AND sku LIKE '%DVR%8%'       LIMIT 1;
  SELECT id INTO p_nvr8ch  FROM products WHERE organization_id = v_org_id AND sku LIKE '%NVR%8%'       LIMIT 1;
  SELECT id INTO p_laptop  FROM products WHERE organization_id = v_org_id AND name ILIKE '%Latitude%'  LIMIT 1;
  SELECT id INTO p_switch  FROM products WHERE organization_id = v_org_id AND name ILIKE '%SG350%'     LIMIT 1;
  SELECT id INTO p_router  FROM products WHERE organization_id = v_org_id AND name ILIKE '%router%'    LIMIT 1;
  SELECT id INTO p_hdd2tb  FROM products WHERE organization_id = v_org_id AND name ILIKE '%2TB%'       LIMIT 1;
  SELECT id INTO p_ups1kva FROM products WHERE organization_id = v_org_id AND name ILIKE '%UPS%'       LIMIT 1;
  SELECT id INTO p_cat6box FROM products WHERE organization_id = v_org_id AND name ILIKE '%Cat6%'      LIMIT 1;

  -- Fallback: use any products if specific ones not found
  IF p_cam2mp  IS NULL THEN SELECT id INTO p_cam2mp  FROM products WHERE organization_id = v_org_id ORDER BY name LIMIT 1 OFFSET 0; END IF;
  IF p_cam4mp  IS NULL THEN SELECT id INTO p_cam4mp  FROM products WHERE organization_id = v_org_id ORDER BY name LIMIT 1 OFFSET 1; END IF;
  IF p_dvr8ch  IS NULL THEN SELECT id INTO p_dvr8ch  FROM products WHERE organization_id = v_org_id ORDER BY name LIMIT 1 OFFSET 2; END IF;
  IF p_nvr8ch  IS NULL THEN SELECT id INTO p_nvr8ch  FROM products WHERE organization_id = v_org_id ORDER BY name LIMIT 1 OFFSET 3; END IF;
  IF p_laptop  IS NULL THEN SELECT id INTO p_laptop  FROM products WHERE organization_id = v_org_id ORDER BY name LIMIT 1 OFFSET 4; END IF;
  IF p_switch  IS NULL THEN SELECT id INTO p_switch  FROM products WHERE organization_id = v_org_id ORDER BY name LIMIT 1 OFFSET 5; END IF;
  IF p_router  IS NULL THEN SELECT id INTO p_router  FROM products WHERE organization_id = v_org_id ORDER BY name LIMIT 1 OFFSET 6; END IF;
  IF p_hdd2tb  IS NULL THEN SELECT id INTO p_hdd2tb  FROM products WHERE organization_id = v_org_id ORDER BY name LIMIT 1 OFFSET 7; END IF;
  IF p_ups1kva IS NULL THEN SELECT id INTO p_ups1kva FROM products WHERE organization_id = v_org_id ORDER BY name LIMIT 1 OFFSET 8; END IF;
  IF p_cat6box IS NULL THEN SELECT id INTO p_cat6box FROM products WHERE organization_id = v_org_id ORDER BY name LIMIT 1 OFFSET 9; END IF;

  IF c_abc IS NULL THEN
    RAISE EXCEPTION 'Customer seed not found. Run seed_customers.sql first.';
  END IF;

  -- ══════════════════════════════════════════════════════════════
  -- Q1: CCTV System for ABC Technologies — Accepted
  -- ══════════════════════════════════════════════════════════════
  INSERT INTO quotations (organization_id, customer_id, quotation_date, valid_until,
    subtotal, tax_amount, total_amount, status, notes, created_by, quotation_number)
  VALUES (
    v_org_id, c_abc,
    CURRENT_DATE - interval '25 days', CURRENT_DATE + interval '5 days',
    0, 0, 0, 'accepted',
    'CCTV installation for main office and 2 branches. Installation charges extra.',
    v_user_id, ''
  ) RETURNING id INTO q1;

  INSERT INTO quotation_items (quotation_id, product_id, description, quantity, unit_price, tax_rate, line_total, sort_order)
  VALUES
    (q1, p_cam2mp,  'Hikvision 2MP IR Dome Camera',      8,  3500,  18, 8  * 3500,  1),
    (q1, p_dvr8ch,  'Hikvision 8-Channel DVR',            2, 12500,  18, 2  * 12500, 2),
    (q1, p_hdd2tb,  '2TB Surveillance Hard Disk',         2,  4200,  18, 2  * 4200,  3),
    (q1, p_cat6box, 'Cat6 Cable (305m box)',               1,  3800,  18, 1  * 3800,  4);

  UPDATE quotations
  SET subtotal     = (8*3500 + 2*12500 + 2*4200 + 1*3800),
      tax_amount   = (8*3500 + 2*12500 + 2*4200 + 1*3800) * 0.18,
      total_amount = (8*3500 + 2*12500 + 2*4200 + 1*3800) * 1.18
  WHERE id = q1;

  -- ══════════════════════════════════════════════════════════════
  -- Q2: IP Camera System for Shree Infotech — Sent
  -- ══════════════════════════════════════════════════════════════
  INSERT INTO quotations (organization_id, customer_id, quotation_date, valid_until,
    subtotal, tax_amount, total_amount, status, notes, created_by, quotation_number)
  VALUES (
    v_org_id, c_shree,
    CURRENT_DATE - interval '10 days', CURRENT_DATE + interval '20 days',
    0, 0, 0, 'sent',
    'IP camera system for warehouse. POE switch included. Delivery within 7 days.',
    v_user_id, ''
  ) RETURNING id INTO q2;

  INSERT INTO quotation_items (quotation_id, product_id, description, quantity, unit_price, tax_rate, line_total, sort_order)
  VALUES
    (q2, p_cam4mp,  'Dahua 4MP IP Camera (POE)',          6,  5200,  18, 6 * 5200,  1),
    (q2, p_nvr8ch,  'Dahua 8-Channel NVR',                1, 15000,  18, 1 * 15000, 2),
    (q2, p_hdd2tb,  '2TB NAS Hard Disk',                  1,  4200,  18, 1 * 4200,  3),
    (q2, p_switch,  'PoE Network Switch 8-Port',          1, 22000,  18, 1 * 22000, 4);

  UPDATE quotations
  SET subtotal     = (6*5200 + 1*15000 + 1*4200 + 1*22000),
      tax_amount   = (6*5200 + 1*15000 + 1*4200 + 1*22000) * 0.18,
      total_amount = (6*5200 + 1*15000 + 1*4200 + 1*22000) * 1.18
  WHERE id = q2;

  -- ══════════════════════════════════════════════════════════════
  -- Q3: Networking Infrastructure for Tech Vision — Draft
  -- ══════════════════════════════════════════════════════════════
  INSERT INTO quotations (organization_id, customer_id, quotation_date, valid_until,
    subtotal, tax_amount, total_amount, status, notes, created_by, quotation_number)
  VALUES (
    v_org_id, c_techvis,
    CURRENT_DATE - interval '2 days', CURRENT_DATE + interval '28 days',
    0, 0, 0, 'draft',
    'Structured cabling + networking for new office. 3-year warranty on all equipment.',
    v_user_id, ''
  ) RETURNING id INTO q3;

  INSERT INTO quotation_items (quotation_id, product_id, description, quantity, unit_price, tax_rate, line_total, sort_order)
  VALUES
    (q3, p_switch,  'Cisco SG350 Managed Switch 24-Port',  2, 22000, 18, 2 * 22000, 1),
    (q3, p_router,  'Wireless Router AC1200',               3,  3200, 18, 3 * 3200,  2),
    (q3, p_cat6box, 'Cat6 UTP Cable Box (305m)',            4,  3800, 18, 4 * 3800,  3),
    (q3, p_ups1kva, 'APC 1KVA Line Interactive UPS',        2, 11500, 18, 2 * 11500, 4);

  UPDATE quotations
  SET subtotal     = (2*22000 + 3*3200 + 4*3800 + 2*11500),
      tax_amount   = (2*22000 + 3*3200 + 4*3800 + 2*11500) * 0.18,
      total_amount = (2*22000 + 3*3200 + 4*3800 + 2*11500) * 1.18
  WHERE id = q3;

  -- ══════════════════════════════════════════════════════════════
  -- Q4: Laptops for Global IT Solutions — Rejected
  -- ══════════════════════════════════════════════════════════════
  INSERT INTO quotations (organization_id, customer_id, quotation_date, valid_until,
    subtotal, tax_amount, total_amount, status, notes, created_by, quotation_number)
  VALUES (
    v_org_id, c_global,
    CURRENT_DATE - interval '45 days', CURRENT_DATE - interval '15 days',
    0, 0, 0, 'rejected',
    'Government tender requirement. Customer went with a different vendor.',
    v_user_id, ''
  ) RETURNING id INTO q4;

  INSERT INTO quotation_items (quotation_id, product_id, description, quantity, unit_price, tax_rate, line_total, sort_order)
  VALUES
    (q4, p_laptop, 'Dell Latitude 5430 Core i5 16GB 512GB SSD', 10, 68000, 18, 10 * 68000, 1),
    (q4, p_hdd2tb, 'External 2TB Hard Drive',                     5,  4200, 18,  5 * 4200,  2);

  UPDATE quotations
  SET subtotal     = (10*68000 + 5*4200),
      tax_amount   = (10*68000 + 5*4200) * 0.18,
      total_amount = (10*68000 + 5*4200) * 1.18
  WHERE id = q4;

  -- ══════════════════════════════════════════════════════════════
  -- Q5: Mixed IT + CCTV for Prime Networks — Expired
  -- ══════════════════════════════════════════════════════════════
  INSERT INTO quotations (organization_id, customer_id, quotation_date, valid_until,
    subtotal, tax_amount, total_amount, status, notes, created_by, quotation_number)
  VALUES (
    v_org_id, c_prime,
    CURRENT_DATE - interval '60 days', CURRENT_DATE - interval '30 days',
    0, 0, 0, 'expired',
    'IT infrastructure for pharma client. Quotation expired — follow up to re-quote.',
    v_user_id, ''
  ) RETURNING id INTO q5;

  INSERT INTO quotation_items (quotation_id, product_id, description, quantity, unit_price, tax_rate, line_total, sort_order)
  VALUES
    (q5, p_cam2mp,  'Hikvision 2MP Bullet Camera (Outdoor)',  4, 3500, 18, 4 * 3500,  1),
    (q5, p_dvr8ch,  'Hikvision 8-Ch DVR with Remote Access',  1, 12500, 18, 1 * 12500, 2),
    (q5, p_switch,  '24-Port Gigabit Switch',                  1, 22000, 18, 1 * 22000, 3),
    (q5, p_ups1kva, 'APC 1KVA Smart UPS',                      1, 11500, 18, 1 * 11500, 4),
    (q5, p_cat6box, 'Cat6 Cable Box',                           2, 3800, 18, 2 * 3800,  5);

  UPDATE quotations
  SET subtotal     = (4*3500 + 1*12500 + 1*22000 + 1*11500 + 2*3800),
      tax_amount   = (4*3500 + 1*12500 + 1*22000 + 1*11500 + 2*3800) * 0.18,
      total_amount = (4*3500 + 1*12500 + 1*22000 + 1*11500 + 2*3800) * 1.18
  WHERE id = q5;

  RAISE NOTICE 'Quotation seed applied: 5 quotations inserted.';
END;
$$;
