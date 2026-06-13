-- ================================================================
-- CompanyOS — Enterprise IT Hardware + CCTV + Networking Seed
-- Target: Inventory Cost ₹1.2Cr–₹1.4Cr | Sale ₹1.5Cr–₹1.7Cr
--
-- Run this in the Supabase SQL Editor (Dashboard → SQL Editor → Run)
-- Safe to run multiple times — skips if Hikvision brand already exists.
-- ================================================================

DO $$
DECLARE
  v_org_id  uuid;
  v_user_id uuid;

  -- Brand IDs
  b_dell      uuid;  b_hp        uuid;  b_lenovo    uuid;
  b_hikvision uuid;  b_dahua     uuid;  b_cpplus    uuid;
  b_tplink    uuid;  b_cisco     uuid;  b_wd        uuid;
  b_seagate   uuid;  b_samsung   uuid;  b_logitech  uuid;
  b_apc       uuid;  b_dlink     uuid;  b_canon     uuid;
  b_epson     uuid;

  -- Category IDs
  c_laptops  uuid;  c_desktops uuid;  c_cctv    uuid;
  c_dvrnvr   uuid;  c_net      uuid;  c_storage uuid;
  c_printers uuid;  c_acc      uuid;

  -- Vendor IDs
  v_techsup  uuid;
  v_digimart uuid;
  v_cctvsup  uuid;

  -- Location
  l_main uuid;

  -- Product IDs (48 products)
  p01 uuid; p02 uuid; p03 uuid; p04 uuid; p05 uuid; p06 uuid;
  p07 uuid; p08 uuid; p09 uuid; p10 uuid; p11 uuid; p12 uuid;
  p13 uuid; p14 uuid; p15 uuid; p16 uuid; p17 uuid; p18 uuid;
  p19 uuid; p20 uuid; p21 uuid; p22 uuid; p23 uuid; p24 uuid;
  p25 uuid; p26 uuid; p27 uuid; p28 uuid; p29 uuid; p30 uuid;
  p31 uuid; p32 uuid; p33 uuid; p34 uuid; p35 uuid; p36 uuid;
  p37 uuid; p38 uuid; p39 uuid; p40 uuid; p41 uuid; p42 uuid;
  p43 uuid; p44 uuid; p45 uuid; p46 uuid; p47 uuid; p48 uuid;

BEGIN
  -- ── Get org + user ─────────────────────────────────────────
  SELECT id INTO v_org_id  FROM organizations LIMIT 1;
  SELECT id INTO v_user_id FROM auth.users     LIMIT 1;

  IF v_org_id IS NULL THEN
    RAISE EXCEPTION 'No organization found. Please complete onboarding first.';
  END IF;

  -- ── Idempotency guard ───────────────────────────────────────
  IF EXISTS (SELECT 1 FROM brands WHERE organization_id = v_org_id AND name = 'Hikvision') THEN
    RAISE NOTICE 'Enterprise seed already applied. Skipping.';
    RETURN;
  END IF;

  -- ── Soft-delete old demo products (from sample seed) ───────
  UPDATE products SET deleted_at = now()
  WHERE organization_id = v_org_id
    AND sku IN (
      'LAP-DELL-001','LAP-HP-001','LAP-LEN-001',
      'MON-DELL-001','MON-SAM-001','KEY-LOG-001',
      'MOU-LOG-001','SSD-SAM-001','SSD-SAM-002','DES-HP-001'
    );

  -- ════════════════════════════════════════════════════════════
  -- BRANDS
  -- ════════════════════════════════════════════════════════════
  -- Reuse existing brands if present (old seed may have created them)
  SELECT id INTO b_dell FROM brands WHERE organization_id = v_org_id AND name = 'Dell' LIMIT 1;
  IF b_dell IS NULL THEN
    INSERT INTO brands (organization_id, name) VALUES (v_org_id, 'Dell') RETURNING id INTO b_dell;
  END IF;

  SELECT id INTO b_hp FROM brands WHERE organization_id = v_org_id AND name = 'HP' LIMIT 1;
  IF b_hp IS NULL THEN
    INSERT INTO brands (organization_id, name) VALUES (v_org_id, 'HP') RETURNING id INTO b_hp;
  END IF;

  SELECT id INTO b_lenovo FROM brands WHERE organization_id = v_org_id AND name = 'Lenovo' LIMIT 1;
  IF b_lenovo IS NULL THEN
    INSERT INTO brands (organization_id, name) VALUES (v_org_id, 'Lenovo') RETURNING id INTO b_lenovo;
  END IF;

  SELECT id INTO b_samsung FROM brands WHERE organization_id = v_org_id AND name = 'Samsung' LIMIT 1;
  IF b_samsung IS NULL THEN
    INSERT INTO brands (organization_id, name) VALUES (v_org_id, 'Samsung') RETURNING id INTO b_samsung;
  END IF;

  SELECT id INTO b_logitech FROM brands WHERE organization_id = v_org_id AND name = 'Logitech' LIMIT 1;
  IF b_logitech IS NULL THEN
    INSERT INTO brands (organization_id, name) VALUES (v_org_id, 'Logitech') RETURNING id INTO b_logitech;
  END IF;

  INSERT INTO brands (organization_id, name) VALUES (v_org_id, 'Hikvision')  RETURNING id INTO b_hikvision;
  INSERT INTO brands (organization_id, name) VALUES (v_org_id, 'Dahua')      RETURNING id INTO b_dahua;
  INSERT INTO brands (organization_id, name) VALUES (v_org_id, 'CP Plus')    RETURNING id INTO b_cpplus;
  INSERT INTO brands (organization_id, name) VALUES (v_org_id, 'TP-Link')    RETURNING id INTO b_tplink;
  INSERT INTO brands (organization_id, name) VALUES (v_org_id, 'Cisco')      RETURNING id INTO b_cisco;
  INSERT INTO brands (organization_id, name) VALUES (v_org_id, 'WD')         RETURNING id INTO b_wd;
  INSERT INTO brands (organization_id, name) VALUES (v_org_id, 'Seagate')    RETURNING id INTO b_seagate;
  INSERT INTO brands (organization_id, name) VALUES (v_org_id, 'APC')        RETURNING id INTO b_apc;
  INSERT INTO brands (organization_id, name) VALUES (v_org_id, 'D-Link')     RETURNING id INTO b_dlink;
  INSERT INTO brands (organization_id, name) VALUES (v_org_id, 'Canon')      RETURNING id INTO b_canon;
  INSERT INTO brands (organization_id, name) VALUES (v_org_id, 'Epson')      RETURNING id INTO b_epson;

  -- ════════════════════════════════════════════════════════════
  -- CATEGORIES
  -- ════════════════════════════════════════════════════════════
  INSERT INTO categories (organization_id, name) VALUES (v_org_id, 'Laptops')      RETURNING id INTO c_laptops;
  INSERT INTO categories (organization_id, name) VALUES (v_org_id, 'Desktops')     RETURNING id INTO c_desktops;
  INSERT INTO categories (organization_id, name) VALUES (v_org_id, 'CCTV Cameras') RETURNING id INTO c_cctv;
  INSERT INTO categories (organization_id, name) VALUES (v_org_id, 'DVR/NVR')      RETURNING id INTO c_dvrnvr;
  INSERT INTO categories (organization_id, name) VALUES (v_org_id, 'Networking')   RETURNING id INTO c_net;
  INSERT INTO categories (organization_id, name) VALUES (v_org_id, 'Storage')      RETURNING id INTO c_storage;
  INSERT INTO categories (organization_id, name) VALUES (v_org_id, 'Printers')     RETURNING id INTO c_printers;
  INSERT INTO categories (organization_id, name) VALUES (v_org_id, 'Accessories')  RETURNING id INTO c_acc;

  -- ════════════════════════════════════════════════════════════
  -- VENDORS
  -- ════════════════════════════════════════════════════════════
  SELECT id INTO v_techsup FROM vendors WHERE organization_id = v_org_id AND name = 'TechSupply India' LIMIT 1;
  IF v_techsup IS NULL THEN
    INSERT INTO vendors (organization_id, name, contact_name, phone, email, gstin, is_active)
    VALUES (v_org_id, 'TechSupply India', 'Rajesh Kumar', '9876543210', 'rajesh@techsupply.in', '27AABCT1332L1ZS', true)
    RETURNING id INTO v_techsup;
  END IF;

  SELECT id INTO v_digimart FROM vendors WHERE organization_id = v_org_id AND name = 'DigiMart Wholesale' LIMIT 1;
  IF v_digimart IS NULL THEN
    INSERT INTO vendors (organization_id, name, contact_name, phone, email, gstin, is_active)
    VALUES (v_org_id, 'DigiMart Wholesale', 'Priya Sharma', '9123456780', 'priya@digimart.in', '07AAACG2115R1ZN', true)
    RETURNING id INTO v_digimart;
  END IF;

  INSERT INTO vendors (organization_id, name, contact_name, phone, email, gstin, is_active)
  VALUES (v_org_id, 'CCTV Systems Hub', 'Manish Patel', '9988776655', 'manish@cctvhub.in', '24AABCT9988M1ZV', true)
  RETURNING id INTO v_cctvsup;

  -- ════════════════════════════════════════════════════════════
  -- LOCATIONS
  -- ════════════════════════════════════════════════════════════
  SELECT id INTO l_main FROM locations WHERE organization_id = v_org_id AND name = 'Main Warehouse' LIMIT 1;
  IF l_main IS NULL THEN
    INSERT INTO locations (organization_id, name, type, is_active)
    VALUES (v_org_id, 'Main Warehouse', 'warehouse', true)
    RETURNING id INTO l_main;
  END IF;

  -- ════════════════════════════════════════════════════════════
  -- PRODUCTS
  -- Cost value targets by category:
  --   Laptops    ≈ ₹34 L   Desktops   ≈ ₹7.7 L
  --   CCTV Cam   ≈ ₹28 L   DVR/NVR    ≈ ₹15 L
  --   Networking ≈ ₹10 L   Storage    ≈ ₹18 L
  --   Accessories≈ ₹5 L    Printers   ≈ ₹5 L
  --   TOTAL      ≈ ₹1.22 Cr
  -- ════════════════════════════════════════════════════════════

  -- ── LAPTOPS ─────────────────────────────────────────────────
  INSERT INTO products (organization_id,sku,name,brand_id,category_id,unit,cost_price,selling_price,mrp,reorder_point,reorder_qty,warranty_months,hsn_code,is_active)
  VALUES (v_org_id,'LAP-DELL-LAT3420','Dell Latitude 3420 (i5-1135G7/8GB/512GB SSD)',b_dell,c_laptops,'pcs',52000,62500,65000,3,5,12,'84713010',true) RETURNING id INTO p01;

  INSERT INTO products (organization_id,sku,name,brand_id,category_id,unit,cost_price,selling_price,mrp,reorder_point,reorder_qty,warranty_months,hsn_code,is_active)
  VALUES (v_org_id,'LAP-DELL-LAT5430','Dell Latitude 5430 (i5-1245U/16GB/512GB SSD)',b_dell,c_laptops,'pcs',72000,86500,90000,2,4,12,'84713010',true) RETURNING id INTO p02;

  INSERT INTO products (organization_id,sku,name,brand_id,category_id,unit,cost_price,selling_price,mrp,reorder_point,reorder_qty,warranty_months,hsn_code,is_active)
  VALUES (v_org_id,'LAP-DELL-INS3520','Dell Inspiron 15 3520 (i5-1235U/8GB/512GB SSD)',b_dell,c_laptops,'pcs',48000,57500,60000,3,5,12,'84713010',true) RETURNING id INTO p03;

  INSERT INTO products (organization_id,sku,name,brand_id,category_id,unit,cost_price,selling_price,mrp,reorder_point,reorder_qty,warranty_months,hsn_code,is_active)
  VALUES (v_org_id,'LAP-HP-PB450G9','HP ProBook 450 G9 (i5-1235U/8GB/512GB SSD)',b_hp,c_laptops,'pcs',57000,68000,71000,3,5,12,'84713010',true) RETURNING id INTO p04;

  INSERT INTO products (organization_id,sku,name,brand_id,category_id,unit,cost_price,selling_price,mrp,reorder_point,reorder_qty,warranty_months,hsn_code,is_active)
  VALUES (v_org_id,'LAP-HP-EB840G9','HP EliteBook 840 G9 (i7-1255U/16GB/512GB SSD)',b_hp,c_laptops,'pcs',88000,105000,110000,2,3,12,'84713010',true) RETURNING id INTO p05;

  INSERT INTO products (organization_id,sku,name,brand_id,category_id,unit,cost_price,selling_price,mrp,reorder_point,reorder_qty,warranty_months,hsn_code,is_active)
  VALUES (v_org_id,'LAP-LEN-TPE14','Lenovo ThinkPad E14 Gen3 (Ryzen 5/8GB/512GB SSD)',b_lenovo,c_laptops,'pcs',58000,69500,72000,3,5,12,'84713010',true) RETURNING id INTO p06;

  INSERT INTO products (organization_id,sku,name,brand_id,category_id,unit,cost_price,selling_price,mrp,reorder_point,reorder_qty,warranty_months,hsn_code,is_active)
  VALUES (v_org_id,'LAP-LEN-IDS3','Lenovo IdeaPad Slim 3 (i3-1215U/8GB/256GB SSD)',b_lenovo,c_laptops,'pcs',35000,41500,43000,5,8,12,'84713010',true) RETURNING id INTO p07;

  -- ── DESKTOPS ────────────────────────────────────────────────
  INSERT INTO products (organization_id,sku,name,brand_id,category_id,unit,cost_price,selling_price,mrp,reorder_point,reorder_qty,warranty_months,hsn_code,is_active)
  VALUES (v_org_id,'DES-DELL-OPT3000','Dell OptiPlex 3000 MT (i5-12500/8GB/256GB SSD)',b_dell,c_desktops,'pcs',42000,50000,52000,2,4,12,'84714190',true) RETURNING id INTO p08;

  INSERT INTO products (organization_id,sku,name,brand_id,category_id,unit,cost_price,selling_price,mrp,reorder_point,reorder_qty,warranty_months,hsn_code,is_active)
  VALUES (v_org_id,'DES-HP-PD400G9','HP ProDesk 400 G9 SFF (i5-12500T/8GB/256GB SSD)',b_hp,c_desktops,'pcs',40000,48000,50000,2,4,12,'84714190',true) RETURNING id INTO p09;

  INSERT INTO products (organization_id,sku,name,brand_id,category_id,unit,cost_price,selling_price,mrp,reorder_point,reorder_qty,warranty_months,hsn_code,is_active)
  VALUES (v_org_id,'DES-LEN-TCM70Q','Lenovo ThinkCentre M70q Tiny (i5-12400T/8GB/256GB)',b_lenovo,c_desktops,'pcs',38000,45500,47000,2,3,12,'84714190',true) RETURNING id INTO p10;

  -- ── CCTV CAMERAS ────────────────────────────────────────────
  INSERT INTO products (organization_id,sku,name,brand_id,category_id,unit,cost_price,selling_price,mrp,reorder_point,reorder_qty,warranty_months,hsn_code,is_active)
  VALUES (v_org_id,'CAM-HIK-2MPIP','Hikvision DS-2CD2143G2-I 4MP AcuSense IP Dome',b_hikvision,c_cctv,'pcs',3200,3850,4200,30,50,24,'85258090',true) RETURNING id INTO p11;

  INSERT INTO products (organization_id,sku,name,brand_id,category_id,unit,cost_price,selling_price,mrp,reorder_point,reorder_qty,warranty_months,hsn_code,is_active)
  VALUES (v_org_id,'CAM-HIK-4MPCLR','Hikvision DS-2CD2347G2-LU 4MP ColorVu IP Turret',b_hikvision,c_cctv,'pcs',5800,6950,7500,20,40,24,'85258090',true) RETURNING id INTO p12;

  INSERT INTO products (organization_id,sku,name,brand_id,category_id,unit,cost_price,selling_price,mrp,reorder_point,reorder_qty,warranty_months,hsn_code,is_active)
  VALUES (v_org_id,'CAM-HIK-2MPAHD','Hikvision DS-2CE16D0T-EXIPF 2MP AHD Analog Bullet',b_hikvision,c_cctv,'pcs',1800,2200,2500,50,100,12,'85258090',true) RETURNING id INTO p13;

  INSERT INTO products (organization_id,sku,name,brand_id,category_id,unit,cost_price,selling_price,mrp,reorder_point,reorder_qty,warranty_months,hsn_code,is_active)
  VALUES (v_org_id,'CAM-HIK-8MPIP','Hikvision DS-2CD2086G2-IU 8MP AcuSense IP Dome',b_hikvision,c_cctv,'pcs',7500,9000,9800,15,25,24,'85258090',true) RETURNING id INTO p14;

  INSERT INTO products (organization_id,sku,name,brand_id,category_id,unit,cost_price,selling_price,mrp,reorder_point,reorder_qty,warranty_months,hsn_code,is_active)
  VALUES (v_org_id,'CAM-DAH-2MPIP','Dahua IPC-HDW2831T-AS 8MP IP Lite WDR Fixed Dome',b_dahua,c_cctv,'pcs',2900,3500,3800,25,50,24,'85258090',true) RETURNING id INTO p15;

  INSERT INTO products (organization_id,sku,name,brand_id,category_id,unit,cost_price,selling_price,mrp,reorder_point,reorder_qty,warranty_months,hsn_code,is_active)
  VALUES (v_org_id,'CAM-DAH-4MPIP','Dahua IPC-HFW2849S-S-IL 4MP Smart Dual Light IP',b_dahua,c_cctv,'pcs',4800,5800,6200,15,30,24,'85258090',true) RETURNING id INTO p16;

  INSERT INTO products (organization_id,sku,name,brand_id,category_id,unit,cost_price,selling_price,mrp,reorder_point,reorder_qty,warranty_months,hsn_code,is_active)
  VALUES (v_org_id,'CAM-DAH-2MPAIO','Dahua HAC-HDW1200M 2MP HDCVI IR Mini Dome Camera',b_dahua,c_cctv,'pcs',1600,2000,2200,40,80,12,'85258090',true) RETURNING id INTO p17;

  INSERT INTO products (organization_id,sku,name,brand_id,category_id,unit,cost_price,selling_price,mrp,reorder_point,reorder_qty,warranty_months,hsn_code,is_active)
  VALUES (v_org_id,'CAM-CPP-2MPIP','CP Plus CP-UNC-DC21PL3-MD 2MP Full HD IP Dome',b_cpplus,c_cctv,'pcs',2400,2900,3200,20,40,12,'85258090',true) RETURNING id INTO p18;

  INSERT INTO products (organization_id,sku,name,brand_id,category_id,unit,cost_price,selling_price,mrp,reorder_point,reorder_qty,warranty_months,hsn_code,is_active)
  VALUES (v_org_id,'CAM-CPP-4MPIP','CP Plus CP-VNC-TC41PL3 4MP IP Turret Camera',b_cpplus,c_cctv,'pcs',4200,5100,5500,15,30,12,'85258090',true) RETURNING id INTO p19;

  -- ── DVR / NVR ────────────────────────────────────────────────
  INSERT INTO products (organization_id,sku,name,brand_id,category_id,unit,cost_price,selling_price,mrp,reorder_point,reorder_qty,warranty_months,hsn_code,is_active)
  VALUES (v_org_id,'DVR-HIK-4CH','Hikvision DS-7204HGHI-K1/E 4CH 1080p Lite DVR',b_hikvision,c_dvrnvr,'pcs',4500,5400,5800,10,15,24,'85219090',true) RETURNING id INTO p20;

  INSERT INTO products (organization_id,sku,name,brand_id,category_id,unit,cost_price,selling_price,mrp,reorder_point,reorder_qty,warranty_months,hsn_code,is_active)
  VALUES (v_org_id,'DVR-HIK-8CH','Hikvision DS-7208HGHI-K1 8CH 1080p Lite DVR',b_hikvision,c_dvrnvr,'pcs',7500,9000,9600,8,12,24,'85219090',true) RETURNING id INTO p21;

  INSERT INTO products (organization_id,sku,name,brand_id,category_id,unit,cost_price,selling_price,mrp,reorder_point,reorder_qty,warranty_months,hsn_code,is_active)
  VALUES (v_org_id,'DVR-HIK-16CH','Hikvision DS-7216HGHI-K2 16CH 1080p Lite DVR',b_hikvision,c_dvrnvr,'pcs',14000,16800,17500,5,8,24,'85219090',true) RETURNING id INTO p22;

  INSERT INTO products (organization_id,sku,name,brand_id,category_id,unit,cost_price,selling_price,mrp,reorder_point,reorder_qty,warranty_months,hsn_code,is_active)
  VALUES (v_org_id,'NVR-HIK-4CH','Hikvision DS-7604NI-K1/4P 4CH 4K NVR (Built-in POE)',b_hikvision,c_dvrnvr,'pcs',5500,6600,7200,8,12,24,'85219090',true) RETURNING id INTO p23;

  INSERT INTO products (organization_id,sku,name,brand_id,category_id,unit,cost_price,selling_price,mrp,reorder_point,reorder_qty,warranty_months,hsn_code,is_active)
  VALUES (v_org_id,'NVR-HIK-8CH','Hikvision DS-7608NI-K2/8P 8CH 4K NVR (Built-in POE)',b_hikvision,c_dvrnvr,'pcs',9500,11400,12000,5,8,24,'85219090',true) RETURNING id INTO p24;

  INSERT INTO products (organization_id,sku,name,brand_id,category_id,unit,cost_price,selling_price,mrp,reorder_point,reorder_qty,warranty_months,hsn_code,is_active)
  VALUES (v_org_id,'NVR-HIK-16CH','Hikvision DS-7616NI-K2/16P 16CH 4K NVR with POE',b_hikvision,c_dvrnvr,'pcs',18000,21500,22500,3,5,24,'85219090',true) RETURNING id INTO p25;

  INSERT INTO products (organization_id,sku,name,brand_id,category_id,unit,cost_price,selling_price,mrp,reorder_point,reorder_qty,warranty_months,hsn_code,is_active)
  VALUES (v_org_id,'DVR-DAH-4CH','Dahua XVR5104H-4KL-I2 4CH 5M-N DVR AI Series',b_dahua,c_dvrnvr,'pcs',4200,5050,5500,8,12,24,'85219090',true) RETURNING id INTO p26;

  INSERT INTO products (organization_id,sku,name,brand_id,category_id,unit,cost_price,selling_price,mrp,reorder_point,reorder_qty,warranty_months,hsn_code,is_active)
  VALUES (v_org_id,'NVR-DAH-8CH','Dahua NVR2108HS-8P-I 8CH Smart NVR with 8 POE',b_dahua,c_dvrnvr,'pcs',8500,10200,10800,5,8,24,'85219090',true) RETURNING id INTO p27;

  -- ── NETWORKING ──────────────────────────────────────────────
  INSERT INTO products (organization_id,sku,name,brand_id,category_id,unit,cost_price,selling_price,mrp,reorder_point,reorder_qty,warranty_months,hsn_code,is_active)
  VALUES (v_org_id,'NET-TPL-SG1024D','TP-Link TL-SG1024D 24-Port Gigabit Unmanaged Switch',b_tplink,c_net,'pcs',5500,6600,7000,8,12,36,'85176990',true) RETURNING id INTO p28;

  INSERT INTO products (organization_id,sku,name,brand_id,category_id,unit,cost_price,selling_price,mrp,reorder_point,reorder_qty,warranty_months,hsn_code,is_active)
  VALUES (v_org_id,'NET-TPL-SF1008P','TP-Link TL-SF1008P 8-Port 10/100 Desktop Switch w/ POE+',b_tplink,c_net,'pcs',3800,4600,5000,10,15,36,'85176990',true) RETURNING id INTO p29;

  INSERT INTO products (organization_id,sku,name,brand_id,category_id,unit,cost_price,selling_price,mrp,reorder_point,reorder_qty,warranty_months,hsn_code,is_active)
  VALUES (v_org_id,'NET-TPL-TL1024PE','TP-Link TL-SL1024PE 24-Port 10/100 POE+ Switch',b_tplink,c_net,'pcs',8500,10200,10800,5,8,36,'85176990',true) RETURNING id INTO p30;

  INSERT INTO products (organization_id,sku,name,brand_id,category_id,unit,cost_price,selling_price,mrp,reorder_point,reorder_qty,warranty_months,hsn_code,is_active)
  VALUES (v_org_id,'NET-CIS-SF11024','Cisco SF110-24 24-Port 10/100 Unmanaged Switch',b_cisco,c_net,'pcs',12500,15000,16000,3,5,60,'85176990',true) RETURNING id INTO p31;

  INSERT INTO products (organization_id,sku,name,brand_id,category_id,unit,cost_price,selling_price,mrp,reorder_point,reorder_qty,warranty_months,hsn_code,is_active)
  VALUES (v_org_id,'NET-CIS-SG35028P','Cisco SG350-28P 28-Port Gigabit POE Managed Switch',b_cisco,c_net,'pcs',38000,45500,48000,2,3,60,'85176990',true) RETURNING id INTO p32;

  INSERT INTO products (organization_id,sku,name,brand_id,category_id,unit,cost_price,selling_price,mrp,reorder_point,reorder_qty,warranty_months,hsn_code,is_active)
  VALUES (v_org_id,'NET-TPL-C6','TP-Link Archer C6 AC1200 Wireless MU-MIMO Gigabit Router',b_tplink,c_net,'pcs',2400,2900,3200,10,20,12,'85176990',true) RETURNING id INTO p33;

  INSERT INTO products (organization_id,sku,name,brand_id,category_id,unit,cost_price,selling_price,mrp,reorder_point,reorder_qty,warranty_months,hsn_code,is_active)
  VALUES (v_org_id,'NET-TPL-EAP225','TP-Link EAP225 Omada AC1350 Wireless Ceiling AP',b_tplink,c_net,'pcs',3200,3850,4200,8,15,24,'85176990',true) RETURNING id INTO p34;

  -- ── STORAGE ─────────────────────────────────────────────────
  INSERT INTO products (organization_id,sku,name,brand_id,category_id,unit,cost_price,selling_price,mrp,reorder_point,reorder_qty,warranty_months,hsn_code,is_active)
  VALUES (v_org_id,'HDD-WD-PUR1TB','WD Purple 1TB Surveillance HDD (WD10PURZ)',b_wd,c_storage,'pcs',2800,3400,3700,25,40,36,'84717020',true) RETURNING id INTO p35;

  INSERT INTO products (organization_id,sku,name,brand_id,category_id,unit,cost_price,selling_price,mrp,reorder_point,reorder_qty,warranty_months,hsn_code,is_active)
  VALUES (v_org_id,'HDD-WD-PUR2TB','WD Purple 2TB Surveillance HDD (WD23PURZ)',b_wd,c_storage,'pcs',4500,5400,5800,20,30,36,'84717020',true) RETURNING id INTO p36;

  INSERT INTO products (organization_id,sku,name,brand_id,category_id,unit,cost_price,selling_price,mrp,reorder_point,reorder_qty,warranty_months,hsn_code,is_active)
  VALUES (v_org_id,'HDD-WD-PUR4TB','WD Purple Pro 4TB Surveillance HDD (WD43PURPL)',b_wd,c_storage,'pcs',8500,10200,10800,10,20,36,'84717020',true) RETURNING id INTO p37;

  INSERT INTO products (organization_id,sku,name,brand_id,category_id,unit,cost_price,selling_price,mrp,reorder_point,reorder_qty,warranty_months,hsn_code,is_active)
  VALUES (v_org_id,'HDD-SEA-SKY1TB','Seagate SkyHawk 1TB Surveillance HDD (ST1000VX005)',b_seagate,c_storage,'pcs',2600,3150,3400,20,35,36,'84717020',true) RETURNING id INTO p38;

  INSERT INTO products (organization_id,sku,name,brand_id,category_id,unit,cost_price,selling_price,mrp,reorder_point,reorder_qty,warranty_months,hsn_code,is_active)
  VALUES (v_org_id,'HDD-SEA-SKY4TB','Seagate SkyHawk 4TB Surveillance HDD (ST4000VX013)',b_seagate,c_storage,'pcs',7800,9400,9800,10,20,36,'84717020',true) RETURNING id INTO p39;

  INSERT INTO products (organization_id,sku,name,brand_id,category_id,unit,cost_price,selling_price,mrp,reorder_point,reorder_qty,warranty_months,hsn_code,is_active)
  VALUES (v_org_id,'SSD-SAM-EVO500','Samsung 860 EVO 500GB SATA SSD (MZ-76E500)',b_samsung,c_storage,'pcs',4200,5000,5500,12,20,60,'84717020',true) RETURNING id INTO p40;

  -- ── ACCESSORIES ─────────────────────────────────────────────
  INSERT INTO products (organization_id,sku,name,brand_id,category_id,unit,cost_price,selling_price,mrp,reorder_point,reorder_qty,warranty_months,hsn_code,is_active)
  VALUES (v_org_id,'ACC-LOG-M330','Logitech M330 Silent Plus Wireless Mouse',b_logitech,c_acc,'pcs',1100,1400,1600,15,30,12,'84716060',true) RETURNING id INTO p41;

  INSERT INTO products (organization_id,sku,name,brand_id,category_id,unit,cost_price,selling_price,mrp,reorder_point,reorder_qty,warranty_months,hsn_code,is_active)
  VALUES (v_org_id,'ACC-LOG-MK275','Logitech MK275 Wireless Keyboard and Mouse Combo',b_logitech,c_acc,'pcs',1350,1750,1999,12,25,12,'84716060',true) RETURNING id INTO p42;

  INSERT INTO products (organization_id,sku,name,brand_id,category_id,unit,cost_price,selling_price,mrp,reorder_point,reorder_qty,warranty_months,hsn_code,is_active)
  VALUES (v_org_id,'ACC-APC-650VA','APC 650VA Line Interactive UPS BX650LI-IN',b_apc,c_acc,'pcs',4200,5100,5500,8,15,12,'85044090',true) RETURNING id INTO p43;

  INSERT INTO products (organization_id,sku,name,brand_id,category_id,unit,cost_price,selling_price,mrp,reorder_point,reorder_qty,warranty_months,hsn_code,is_active)
  VALUES (v_org_id,'ACC-APC-1KVA','APC 1000VA Line Interactive UPS BX1000MI-IN',b_apc,c_acc,'pcs',9500,11500,12000,5,10,12,'85044090',true) RETURNING id INTO p44;

  INSERT INTO products (organization_id,sku,name,brand_id,category_id,unit,cost_price,selling_price,mrp,reorder_point,reorder_qty,warranty_months,hsn_code,is_active)
  VALUES (v_org_id,'ACC-DLK-CAT6','D-Link NCB-C6UGRYR-305 Cat6 UTP Cable Box 305m',b_dlink,c_acc,'pcs',6500,7800,8200,5,10,0,'85444290',true) RETURNING id INTO p45;

  INSERT INTO products (organization_id,sku,name,brand_id,category_id,unit,cost_price,selling_price,mrp,reorder_point,reorder_qty,warranty_months,hsn_code,is_active)
  VALUES (v_org_id,'ACC-HDM-5M','Premium HDMI Cable 5m 4K Ultra HD v2.0',b_dlink,c_acc,'pcs',180,280,350,30,60,0,'85444290',true) RETURNING id INTO p46;

  -- ── PRINTERS ────────────────────────────────────────────────
  INSERT INTO products (organization_id,sku,name,brand_id,category_id,unit,cost_price,selling_price,mrp,reorder_point,reorder_qty,warranty_months,hsn_code,is_active)
  VALUES (v_org_id,'PRN-HP-M111W','HP LaserJet MFP M111w Wireless Laser Printer',b_hp,c_printers,'pcs',12500,15000,15999,3,5,12,'84433190',true) RETURNING id INTO p47;

  INSERT INTO products (organization_id,sku,name,brand_id,category_id,unit,cost_price,selling_price,mrp,reorder_point,reorder_qty,warranty_months,hsn_code,is_active)
  VALUES (v_org_id,'PRN-HP-M404N','HP LaserJet Pro M404n Network B&W Laser Printer',b_hp,c_printers,'pcs',24000,28500,29999,2,4,12,'84433190',true) RETURNING id INTO p48;

  -- (Extra 2 printers use temp variables — re-declare in nested block not needed, reuse p41/p42 vars)
  -- Canon and Epson inserted without stock var capture (stock added below via INSERT)

  -- ════════════════════════════════════════════════════════════
  -- STOCK MOVEMENTS  (trigger auto-updates stock_levels)
  -- Quantities set to hit ≈₹1.22 Cr cost value
  -- ════════════════════════════════════════════════════════════

  -- ── Laptops ─────────────────────────────────────────────────
  INSERT INTO stock_movements (organization_id,product_id,location_id,movement_type,quantity,reference_no,vendor_id,created_by) VALUES
    (v_org_id,p01,l_main,'receipt',8, 'PO-LAP-001',v_techsup,v_user_id),   -- Dell Lat 3420 ×8  =₹4.16L
    (v_org_id,p02,l_main,'receipt',6, 'PO-LAP-001',v_techsup,v_user_id),   -- Dell Lat 5430 ×6  =₹4.32L
    (v_org_id,p03,l_main,'receipt',12,'PO-LAP-001',v_techsup,v_user_id),   -- Dell Ins 3520 ×12 =₹5.76L
    (v_org_id,p04,l_main,'receipt',8, 'PO-LAP-002',v_digimart,v_user_id),  -- HP ProBook  ×8  =₹4.56L
    (v_org_id,p05,l_main,'receipt',5, 'PO-LAP-002',v_digimart,v_user_id),  -- HP EliteBook×5  =₹4.40L
    (v_org_id,p06,l_main,'receipt',10,'PO-LAP-003',v_techsup,v_user_id),   -- Len ThinkPad×10 =₹5.80L
    (v_org_id,p07,l_main,'receipt',14,'PO-LAP-003',v_techsup,v_user_id);   -- Len IdeaPad ×14 =₹4.90L

  -- ── Desktops ─────────────────────────────────────────────────
  INSERT INTO stock_movements (organization_id,product_id,location_id,movement_type,quantity,reference_no,vendor_id,created_by) VALUES
    (v_org_id,p08,l_main,'receipt',8,'PO-DES-001',v_techsup,v_user_id),    -- Dell Opt   ×8  =₹3.36L
    (v_org_id,p09,l_main,'receipt',6,'PO-DES-001',v_techsup,v_user_id),    -- HP ProDesk ×6  =₹2.40L
    (v_org_id,p10,l_main,'receipt',5,'PO-DES-001',v_digimart,v_user_id);   -- Len Think  ×5  =₹1.90L

  -- ── CCTV Cameras ─────────────────────────────────────────────
  INSERT INTO stock_movements (organization_id,product_id,location_id,movement_type,quantity,reference_no,vendor_id,created_by) VALUES
    (v_org_id,p11,l_main,'receipt',180,'PO-CAM-001',v_cctvsup,v_user_id),  -- Hik 2MP IP   ×180=₹5.76L
    (v_org_id,p12,l_main,'receipt',100,'PO-CAM-001',v_cctvsup,v_user_id),  -- Hik 4MP Clr  ×100=₹5.80L
    (v_org_id,p13,l_main,'receipt',250,'PO-CAM-001',v_cctvsup,v_user_id),  -- Hik 2MP AHD  ×250=₹4.50L
    (v_org_id,p14,l_main,'receipt',40, 'PO-CAM-002',v_cctvsup,v_user_id),  -- Hik 8MP IP   ×40 =₹3.00L
    (v_org_id,p15,l_main,'receipt',150,'PO-CAM-002',v_cctvsup,v_user_id),  -- Dah 2MP IP   ×150=₹4.35L
    (v_org_id,p16,l_main,'receipt',100,'PO-CAM-002',v_cctvsup,v_user_id),  -- Dah 4MP IP   ×100=₹4.80L
    (v_org_id,p17,l_main,'receipt',200,'PO-CAM-003',v_cctvsup,v_user_id),  -- Dah 2MP AIO  ×200=₹3.20L
    (v_org_id,p18,l_main,'receipt',120,'PO-CAM-003',v_cctvsup,v_user_id),  -- CPP 2MP IP   ×120=₹2.88L
    (v_org_id,p19,l_main,'receipt',60, 'PO-CAM-003',v_cctvsup,v_user_id);  -- CPP 4MP IP   ×60 =₹2.52L

  -- ── DVR / NVR ─────────────────────────────────────────────────
  INSERT INTO stock_movements (organization_id,product_id,location_id,movement_type,quantity,reference_no,vendor_id,created_by) VALUES
    (v_org_id,p20,l_main,'receipt',60,'PO-DVR-001',v_cctvsup,v_user_id),   -- Hik 4CH DVR ×60=₹2.70L
    (v_org_id,p21,l_main,'receipt',40,'PO-DVR-001',v_cctvsup,v_user_id),   -- Hik 8CH DVR ×40=₹3.00L
    (v_org_id,p22,l_main,'receipt',15,'PO-DVR-001',v_cctvsup,v_user_id),   -- Hik 16CH DVR×15=₹2.10L
    (v_org_id,p23,l_main,'receipt',45,'PO-NVR-001',v_cctvsup,v_user_id),   -- Hik 4CH NVR ×45=₹2.48L
    (v_org_id,p24,l_main,'receipt',28,'PO-NVR-001',v_cctvsup,v_user_id),   -- Hik 8CH NVR ×28=₹2.66L
    (v_org_id,p25,l_main,'receipt',12,'PO-NVR-001',v_cctvsup,v_user_id),   -- Hik 16CH NVR×12=₹2.16L
    (v_org_id,p26,l_main,'receipt',45,'PO-DVR-002',v_cctvsup,v_user_id),   -- Dah 4CH DVR ×45=₹1.89L
    (v_org_id,p27,l_main,'receipt',25,'PO-NVR-002',v_cctvsup,v_user_id);   -- Dah 8CH NVR ×25=₹2.13L

  -- ── Networking ───────────────────────────────────────────────
  INSERT INTO stock_movements (organization_id,product_id,location_id,movement_type,quantity,reference_no,vendor_id,created_by) VALUES
    (v_org_id,p28,l_main,'receipt',28,'PO-NET-001',v_digimart,v_user_id),   -- TPL 24P GbE  ×28=₹1.54L
    (v_org_id,p29,l_main,'receipt',40,'PO-NET-001',v_digimart,v_user_id),   -- TPL 8P POE+  ×40=₹1.52L
    (v_org_id,p30,l_main,'receipt',20,'PO-NET-001',v_digimart,v_user_id),   -- TPL 24P POE+ ×20=₹1.70L
    (v_org_id,p31,l_main,'receipt',15,'PO-NET-002',v_techsup,v_user_id),    -- Cisco SF110  ×15=₹1.88L
    (v_org_id,p32,l_main,'receipt',5, 'PO-NET-002',v_techsup,v_user_id),    -- Cisco SG350P ×5 =₹1.90L
    (v_org_id,p33,l_main,'receipt',45,'PO-NET-001',v_digimart,v_user_id),   -- TPL Router   ×45=₹1.08L
    (v_org_id,p34,l_main,'receipt',30,'PO-NET-001',v_digimart,v_user_id);   -- TPL EAP225   ×30=₹0.96L

  -- ── Storage ──────────────────────────────────────────────────
  INSERT INTO stock_movements (organization_id,product_id,location_id,movement_type,quantity,reference_no,vendor_id,created_by) VALUES
    (v_org_id,p35,l_main,'receipt',85,'PO-STR-001',v_digimart,v_user_id),   -- WD 1TB  ×85=₹2.38L
    (v_org_id,p36,l_main,'receipt',65,'PO-STR-001',v_digimart,v_user_id),   -- WD 2TB  ×65=₹2.93L
    (v_org_id,p37,l_main,'receipt',45,'PO-STR-001',v_digimart,v_user_id),   -- WD 4TB  ×45=₹3.83L
    (v_org_id,p38,l_main,'receipt',75,'PO-STR-002',v_digimart,v_user_id),   -- Sea 1TB ×75=₹1.95L
    (v_org_id,p39,l_main,'receipt',40,'PO-STR-002',v_digimart,v_user_id),   -- Sea 4TB ×40=₹3.12L
    (v_org_id,p40,l_main,'receipt',40,'PO-STR-003',v_techsup,v_user_id);    -- Sam SSD ×40=₹1.68L

  -- ── Accessories ──────────────────────────────────────────────
  INSERT INTO stock_movements (organization_id,product_id,location_id,movement_type,quantity,reference_no,vendor_id,created_by) VALUES
    (v_org_id,p41,l_main,'receipt',80,'PO-ACC-001',v_digimart,v_user_id),   -- Log Mouse  ×80=₹0.88L
    (v_org_id,p42,l_main,'receipt',60,'PO-ACC-001',v_digimart,v_user_id),   -- Log KB+M   ×60=₹0.81L
    (v_org_id,p43,l_main,'receipt',30,'PO-ACC-002',v_techsup,v_user_id),    -- APC 650VA  ×30=₹1.26L
    (v_org_id,p44,l_main,'receipt',15,'PO-ACC-002',v_techsup,v_user_id),    -- APC 1KVA   ×15=₹1.43L
    (v_org_id,p45,l_main,'receipt',22,'PO-ACC-003',v_digimart,v_user_id),   -- Cat6 Box   ×22=₹1.43L
    (v_org_id,p46,l_main,'receipt',200,'PO-ACC-003',v_digimart,v_user_id);  -- HDMI 5m    ×200=₹0.36L

  -- ── Printers ─────────────────────────────────────────────────
  INSERT INTO stock_movements (organization_id,product_id,location_id,movement_type,quantity,reference_no,vendor_id,created_by) VALUES
    (v_org_id,p47,l_main,'receipt',10,'PO-PRN-001',v_techsup,v_user_id),    -- HP M111w   ×10=₹1.25L
    (v_org_id,p48,l_main,'receipt',6, 'PO-PRN-001',v_techsup,v_user_id);   -- HP M404n   ×6 =₹1.44L

  -- Canon LBP6030 and Epson L3250 (inserted without ID capture)
  WITH cp1 AS (
    INSERT INTO products (organization_id,sku,name,brand_id,category_id,unit,cost_price,selling_price,mrp,reorder_point,reorder_qty,warranty_months,hsn_code,is_active)
    VALUES (v_org_id,'PRN-CAN-LBP6030','Canon LBP6030 Laser Printer (Single Function)',b_canon,c_printers,'pcs',9500,11500,11999,3,5,12,'84433190',true)
    RETURNING id
  )
  INSERT INTO stock_movements (organization_id,product_id,location_id,movement_type,quantity,reference_no,vendor_id,created_by)
  SELECT v_org_id,id,l_main,'receipt',8,'PO-PRN-002',v_digimart,v_user_id FROM cp1;

  WITH ep1 AS (
    INSERT INTO products (organization_id,sku,name,brand_id,category_id,unit,cost_price,selling_price,mrp,reorder_point,reorder_qty,warranty_months,hsn_code,is_active)
    VALUES (v_org_id,'PRN-EPS-L3250','Epson L3250 EcoTank WiFi MFP Ink Tank Printer',b_epson,c_printers,'pcs',11500,14000,14499,3,5,12,'84433190',true)
    RETURNING id
  )
  INSERT INTO stock_movements (organization_id,product_id,location_id,movement_type,quantity,reference_no,vendor_id,created_by)
  SELECT v_org_id,id,l_main,'receipt',12,'PO-PRN-002',v_digimart,v_user_id FROM ep1;

  -- ════════════════════════════════════════════════════════════
  -- RECENT SALES (creates today's stock-out KPI values)
  -- ════════════════════════════════════════════════════════════
  INSERT INTO stock_movements (organization_id,product_id,location_id,movement_type,quantity,reference_no,notes,created_by) VALUES
    (v_org_id,p01,l_main,'sale',2,'INV-2025-001','Dell Latitude 3420 — Rajesh Enterprises',v_user_id),
    (v_org_id,p03,l_main,'sale',3,'INV-2025-002','Dell Inspiron — ABC School Bulk Order',v_user_id),
    (v_org_id,p11,l_main,'sale',20,'INV-2025-003','Hikvision 2MP IP Cams — Site Install Bandra',v_user_id),
    (v_org_id,p13,l_main,'sale',30,'INV-2025-004','Analog Cameras — Colaba Project',v_user_id),
    (v_org_id,p20,l_main,'sale',5,'INV-2025-005','Hikvision 4CH DVR — Residential Complex',v_user_id),
    (v_org_id,p35,l_main,'sale',15,'INV-2025-006','WD Purple 1TB — CCTV Installation',v_user_id),
    (v_org_id,p28,l_main,'sale',8,'INV-2025-007','TP-Link 24P Switch — Office Network Upgrade',v_user_id),
    (v_org_id,p41,l_main,'sale',25,'INV-2025-008','Logitech Mice — Bulk Corporate Order',v_user_id);

  -- TODAY'S RECEIPTS (creates today's stock-in KPI values)
  INSERT INTO stock_movements (organization_id,product_id,location_id,movement_type,quantity,reference_no,vendor_id,notes,created_by) VALUES
    (v_org_id,p12,l_main,'receipt',25,'PO-TODAY-001',v_cctvsup,'Restocking Hikvision ColorVu',v_user_id),
    (v_org_id,p15,l_main,'receipt',30,'PO-TODAY-002',v_cctvsup,'Dahua IP Dome Restock',v_user_id),
    (v_org_id,p36,l_main,'receipt',20,'PO-TODAY-003',v_digimart,'WD Purple 2TB Restock',v_user_id),
    (v_org_id,p04,l_main,'receipt',3, 'PO-TODAY-004',v_digimart,'HP ProBook Restock',v_user_id);

  -- ════════════════════════════════════════════════════════════
  -- PRICE HISTORY
  -- ════════════════════════════════════════════════════════════
  INSERT INTO price_history (product_id,old_selling_price,new_selling_price,old_cost_price,new_cost_price,reason,changed_by) VALUES
    (p01,60000,62500,50000,52000,'Supplier rate revision Q1 2025',v_user_id),
    (p05,98000,105000,84000,88000,'Market price adjustment — i7 units',v_user_id),
    (p11,3500,3850,2900,3200,'Hikvision distributor price increase',v_user_id),
    (p12,6500,6950,5500,5800,'Import cost increase',v_user_id),
    (p24,10800,11400,9000,9500,'NVR POE series relaunch pricing',v_user_id),
    (p35,3200,3400,2600,2800,'WD surveillance HDD revision',v_user_id),
    (p31,14000,15000,11500,12500,'Cisco distributor pricing update',v_user_id);

  RAISE NOTICE 'Enterprise seed completed successfully for org: %', v_org_id;

END $$;
