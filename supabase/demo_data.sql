-- ============================================================
-- DEMO DATA SEED: Rajput IT Hardware Solutions
-- Run in Supabase SQL Editor (service role context)
-- 6 months of realistic Indian IT hardware business data
-- ============================================================

DO $$
DECLARE
  v_org_id  UUID;
  v_uid     UUID;
  v_loc_id  UUID;

  -- Categories
  v_cat_laptop   UUID; v_cat_desktop  UUID; v_cat_monitor  UUID;
  v_cat_net      UUID; v_cat_storage  UUID; v_cat_acc      UUID;
  v_cat_printer  UUID; v_cat_power    UUID;

  -- Brands
  v_b_hp  UUID; v_b_dell UUID; v_b_lenovo UUID; v_b_asus UUID; v_b_acer UUID;
  v_b_cisco UUID; v_b_apc UUID; v_b_samsung UUID; v_b_lg UUID; v_b_seagate UUID;

  -- Working vars
  v_po_id   UUID; v_quot_id UUID; v_inv_id UUID; v_rec_id UUID;
  v_vid     UUID; v_cid     UUID;

BEGIN
  -- ── 0. Find org ────────────────────────────────────────────────────────────
  SELECT p.organization_id, p.id INTO v_org_id, v_uid
  FROM profiles p WHERE p.email = 'khushalrajput1978@gmail.com' LIMIT 1;
  IF v_org_id IS NULL THEN RAISE EXCEPTION 'Owner not found'; END IF;

  -- ── 1. Cleanup (idempotent re-run) ────────────────────────────────────────
  DELETE FROM audit_logs           WHERE organization_id = v_org_id;
  DELETE FROM vendor_payments      WHERE organization_id = v_org_id;
  DELETE FROM invoice_payments     WHERE organization_id = v_org_id;
  DELETE FROM invoice_items        WHERE invoice_id IN (SELECT id FROM invoices WHERE organization_id = v_org_id);
  DELETE FROM invoices             WHERE organization_id = v_org_id;
  DELETE FROM quotation_items      WHERE quotation_id IN (SELECT id FROM quotations WHERE organization_id = v_org_id);
  DELETE FROM quotations           WHERE organization_id = v_org_id;
  DELETE FROM po_receipt_items     WHERE receipt_id IN (SELECT id FROM po_receipts WHERE organization_id = v_org_id);
  DELETE FROM po_receipts          WHERE organization_id = v_org_id;
  DELETE FROM purchase_order_items WHERE purchase_order_id IN (SELECT id FROM purchase_orders WHERE organization_id = v_org_id);
  DELETE FROM purchase_orders      WHERE organization_id = v_org_id;
  DELETE FROM stock_movements      WHERE organization_id = v_org_id;
  DELETE FROM stock_levels         WHERE product_id IN (SELECT id FROM products WHERE organization_id = v_org_id);
  DELETE FROM customers            WHERE organization_id = v_org_id;
  DELETE FROM vendors              WHERE organization_id = v_org_id;
  DELETE FROM products             WHERE organization_id = v_org_id;
  DELETE FROM brands               WHERE organization_id = v_org_id;
  DELETE FROM categories           WHERE organization_id = v_org_id;
  DELETE FROM locations            WHERE organization_id = v_org_id;
  DELETE FROM po_counters          WHERE organization_id = v_org_id;
  DELETE FROM grn_counters         WHERE organization_id = v_org_id;
  DELETE FROM invoice_counters     WHERE organization_id = v_org_id;

  -- ── 2. Company Settings ───────────────────────────────────────────────────
  INSERT INTO company_settings (
    organization_id, company_name, legal_business_name, gst_number, pan_number,
    phone, email, website,
    address_line_1, address_line_2, city, state, pincode,
    bank_name, account_holder_name, account_number, ifsc_code, branch_name,
    upi_id, business_type, default_currency, default_tax_rate, financial_year_start,
    payment_terms, terms_and_conditions, default_notes,
    invoice_prefix, quotation_prefix, purchase_order_prefix, grn_prefix
  ) VALUES (
    v_org_id,
    'Rajput IT Hardware Solutions',
    'Rajput IT Hardware Solutions',
    '09ABCDE1234F1Z5',
    'ABCDE1234F',
    '+91-9876543210',
    'sales@rajputit.com',
    'www.rajputit.com',
    'Plot No. 45, Sector 62',
    'Near Noida Electronic City Metro',
    'Noida', 'Uttar Pradesh', '201309',
    'HDFC Bank', 'Rajput IT Hardware Solutions',
    '50100987654321', 'HDFC0002345', 'Sector 62, Noida',
    'rajputit@okhdfc',
    'Proprietorship', 'INR', 18, 4,
    'Net 30',
    'Goods once sold will not be taken back. Warranty as per manufacturer terms. All disputes subject to Noida jurisdiction.',
    'Thank you for your business with Rajput IT Hardware Solutions!',
    'INV', 'QT', 'PO', 'GRN'
  )
  ON CONFLICT (organization_id) DO UPDATE SET
    company_name         = EXCLUDED.company_name,
    legal_business_name  = EXCLUDED.legal_business_name,
    gst_number           = EXCLUDED.gst_number,
    pan_number           = EXCLUDED.pan_number,
    phone                = EXCLUDED.phone,
    email                = EXCLUDED.email,
    website              = EXCLUDED.website,
    address_line_1       = EXCLUDED.address_line_1,
    address_line_2       = EXCLUDED.address_line_2,
    city                 = EXCLUDED.city,
    state                = EXCLUDED.state,
    pincode              = EXCLUDED.pincode,
    bank_name            = EXCLUDED.bank_name,
    account_holder_name  = EXCLUDED.account_holder_name,
    account_number       = EXCLUDED.account_number,
    ifsc_code            = EXCLUDED.ifsc_code,
    branch_name          = EXCLUDED.branch_name,
    upi_id               = EXCLUDED.upi_id,
    business_type        = EXCLUDED.business_type,
    payment_terms        = EXCLUDED.payment_terms,
    terms_and_conditions = EXCLUDED.terms_and_conditions,
    default_notes        = EXCLUDED.default_notes;

  -- ── 3. Warehouse ──────────────────────────────────────────────────────────
  INSERT INTO locations (organization_id, name, type, is_active)
  VALUES (v_org_id, 'Main Warehouse - Sector 62 Noida', 'warehouse', true)
  RETURNING id INTO v_loc_id;

  -- ── 4. Categories ─────────────────────────────────────────────────────────
  INSERT INTO categories (organization_id, name) VALUES (v_org_id, 'Laptops')           RETURNING id INTO v_cat_laptop;
  INSERT INTO categories (organization_id, name) VALUES (v_org_id, 'Desktops')          RETURNING id INTO v_cat_desktop;
  INSERT INTO categories (organization_id, name) VALUES (v_org_id, 'Monitors')          RETURNING id INTO v_cat_monitor;
  INSERT INTO categories (organization_id, name) VALUES (v_org_id, 'Networking')        RETURNING id INTO v_cat_net;
  INSERT INTO categories (organization_id, name) VALUES (v_org_id, 'Storage')           RETURNING id INTO v_cat_storage;
  INSERT INTO categories (organization_id, name) VALUES (v_org_id, 'Accessories')       RETURNING id INTO v_cat_acc;
  INSERT INTO categories (organization_id, name) VALUES (v_org_id, 'Printers')          RETURNING id INTO v_cat_printer;
  INSERT INTO categories (organization_id, name) VALUES (v_org_id, 'Power Solutions')   RETURNING id INTO v_cat_power;

  -- ── 5. Brands ─────────────────────────────────────────────────────────────
  INSERT INTO brands (organization_id, name) VALUES (v_org_id, 'HP')       RETURNING id INTO v_b_hp;
  INSERT INTO brands (organization_id, name) VALUES (v_org_id, 'Dell')     RETURNING id INTO v_b_dell;
  INSERT INTO brands (organization_id, name) VALUES (v_org_id, 'Lenovo')   RETURNING id INTO v_b_lenovo;
  INSERT INTO brands (organization_id, name) VALUES (v_org_id, 'Asus')     RETURNING id INTO v_b_asus;
  INSERT INTO brands (organization_id, name) VALUES (v_org_id, 'Acer')     RETURNING id INTO v_b_acer;
  INSERT INTO brands (organization_id, name) VALUES (v_org_id, 'Cisco')    RETURNING id INTO v_b_cisco;
  INSERT INTO brands (organization_id, name) VALUES (v_org_id, 'APC')      RETURNING id INTO v_b_apc;
  INSERT INTO brands (organization_id, name) VALUES (v_org_id, 'Samsung')  RETURNING id INTO v_b_samsung;
  INSERT INTO brands (organization_id, name) VALUES (v_org_id, 'LG')       RETURNING id INTO v_b_lg;
  INSERT INTO brands (organization_id, name) VALUES (v_org_id, 'Seagate')  RETURNING id INTO v_b_seagate;

  -- ── 6. Products (50) ──────────────────────────────────────────────────────
  CREATE TEMP TABLE _prods (sku TEXT PRIMARY KEY, pid UUID, cp NUMERIC, sp NUMERIC);

  WITH ins AS (
    INSERT INTO products (organization_id, sku, name, brand_id, category_id, unit,
                          cost_price, selling_price, mrp, tax_rate, hsn_code,
                          reorder_point, reorder_qty, description)
    VALUES
      -- LAPTOPS (10)
      (v_org_id,'HP-PB450G10',  'HP ProBook 450 G10 Core i5-1335U 8GB 512GB SSD', v_b_hp,     v_cat_laptop, 'pcs', 42000, 50900, 53000, 18, '84713010', 3, 5, 'Business laptop, 15.6" FHD, Windows 11 Pro'),
      (v_org_id,'HP-EB840G10',  'HP EliteBook 840 G10 Core i7-1355U 16GB 512GB',  v_b_hp,     v_cat_laptop, 'pcs', 68000, 82500, 86000, 18, '84713010', 2, 3, 'Premium business laptop, 14" FHD, Windows 11 Pro'),
      (v_org_id,'DELL-LAT5440', 'Dell Latitude 5440 Core i5-1345U 16GB 512GB SSD',v_b_dell,   v_cat_laptop, 'pcs', 60000, 73500, 77000, 18, '84713010', 2, 3, 'Enterprise laptop, 14" FHD, Windows 11 Pro'),
      (v_org_id,'DELL-VOS3520', 'Dell Vostro 3520 Core i3-1215U 8GB 256GB SSD',   v_b_dell,   v_cat_laptop, 'pcs', 28500, 34900, 36500, 18, '84713010', 5, 8, 'Entry-level business laptop, 15.6" HD'),
      (v_org_id,'LEN-TPE14G5',  'Lenovo ThinkPad E14 Gen 5 Core i5-1335U 16GB',   v_b_lenovo, v_cat_laptop, 'pcs', 55000, 66900, 70000, 18, '84713010', 2, 3, 'Business laptop, 14" FHD, Windows 11 Pro'),
      (v_org_id,'LEN-IPS5-I5',  'Lenovo IdeaPad Slim 5 Core i5-12450H 8GB 512GB', v_b_lenovo, v_cat_laptop, 'pcs', 38000, 46500, 48500, 18, '84713010', 3, 5, 'Slim laptop, 15.6" FHD OLED, Windows 11'),
      (v_org_id,'ASUS-EXB1-I5', 'Asus ExpertBook B1 B1502C Core i5 8GB 512GB',    v_b_asus,   v_cat_laptop, 'pcs', 40000, 48900, 51000, 18, '84713010', 3, 5, 'Business laptop, 15.6" FHD, Windows 11 Pro'),
      (v_org_id,'ASUS-VB15-I5', 'Asus VivoBook 15 X1504VA Core i5 16GB 512GB',    v_b_asus,   v_cat_laptop, 'pcs', 36000, 44000, 46000, 18, '84713010', 3, 5, 'Everyday laptop, 15.6" FHD, Windows 11'),
      (v_org_id,'ACR-ASP5-I5',  'Acer Aspire 5 A515 Core i5-1235U 8GB 512GB SSD', v_b_acer,   v_cat_laptop, 'pcs', 34000, 41500, 43500, 18, '84713010', 5, 8, 'Versatile laptop, 15.6" FHD IPS, Windows 11'),
      (v_org_id,'ACR-TMP2-I5',  'Acer TravelMate P2 TMP214 Core i5 8GB 256GB',    v_b_acer,   v_cat_laptop, 'pcs', 41000, 50000, 52500, 18, '84713010', 3, 5, 'Business laptop, 14" FHD, Windows 11 Pro'),
      -- DESKTOPS (6)
      (v_org_id,'HP-PD400G9',   'HP ProDesk 400 G9 SFF Core i5-12500 8GB 256GB',  v_b_hp,     v_cat_desktop,'pcs', 32000, 39500, 41500, 18, '84714190', 3, 5, 'Small form factor business desktop, Windows 11 Pro'),
      (v_org_id,'DELL-OPT3000', 'Dell OptiPlex 3000 MT Core i5-12500 8GB 256GB',  v_b_dell,   v_cat_desktop,'pcs', 34000, 42000, 44000, 18, '84714190', 3, 5, 'Micro tower desktop, Windows 11 Pro'),
      (v_org_id,'LEN-TCM720Q',  'Lenovo ThinkCentre M720q Core i5-8400 8GB 256GB',v_b_lenovo, v_cat_desktop,'pcs', 29000, 35900, 37500, 18, '84714190', 3, 5, 'Tiny form factor desktop, Windows 10 Pro'),
      (v_org_id,'ASUS-ECD5-SFF','Asus ExpertCenter D5 SFF Core i5 8GB 512GB',     v_b_asus,   v_cat_desktop,'pcs', 31000, 38500, 40500, 18, '84714190', 3, 5, 'SFF business desktop, Windows 11 Pro'),
      (v_org_id,'ACR-VX2660G',  'Acer Veriton X2660G Core i5 8GB 1TB HDD',        v_b_acer,   v_cat_desktop,'pcs', 27000, 33500, 35000, 18, '84714190', 5, 8, 'MT desktop, Windows 10 Pro, optical drive'),
      (v_org_id,'HP-PAVDT-TP01','HP Pavilion Desktop TP01-2000 Core i5 8GB 1TB',   v_b_hp,     v_cat_desktop,'pcs', 30000, 37000, 38500, 18, '84714190', 3, 5, 'Home/office tower desktop, Windows 11'),
      -- MONITORS (6)
      (v_org_id,'DELL-SE2422H', 'Dell SE2422H 24" FHD VA Monitor HDMI VGA',       v_b_dell,   v_cat_monitor,'pcs',  6200,  7900,  8300, 18, '85285200', 5, 10, '1920x1080, 75Hz, 5ms, tilt adjustable'),
      (v_org_id,'HP-MON-24MH',  'HP 24mh 24" FHD IPS Monitor with Speakers',      v_b_hp,     v_cat_monitor,'pcs',  7000,  8900,  9300, 18, '85285200', 5, 8,  '1920x1080, 75Hz, built-in 2W speakers'),
      (v_org_id,'LG-24MK400H',  'LG 24MK400H 24" TN Monitor HDMI VGA',            v_b_lg,     v_cat_monitor,'pcs',  5800,  7400,  7800, 18, '85285200', 5, 10, '1920x1080, 75Hz, AMD FreeSync'),
      (v_org_id,'SAM-27LS',     'Samsung 27" LS27A400 FHD IPS Monitor',            v_b_samsung,v_cat_monitor,'pcs',  9500, 12000, 12500, 18, '85285200', 3, 5,  '1920x1080, 75Hz, HDMI, VGA, Eye Saver'),
      (v_org_id,'DELL-P2722H',  'Dell P2722H 27" FHD IPS Professional Monitor',   v_b_dell,   v_cat_monitor,'pcs', 16000, 20000, 21000, 18, '85285200', 3, 5,  '1920x1080, 60Hz, USB hub, height adjust'),
      (v_org_id,'LG-32MN500M',  'LG 32MN500M-B 32" FHD VA Monitor HDMI',          v_b_lg,     v_cat_monitor,'pcs', 14500, 18500, 19500, 18, '85285200', 2, 3,  '1920x1080, 75Hz, AMD FreeSync, wall mount'),
      -- NETWORKING (7)
      (v_org_id,'CISCO-SG350-28','Cisco SG350-28 28-Port Gigabit Managed Switch',  v_b_cisco,  v_cat_net,   'pcs', 33000, 41500, 43500, 18, '85176990', 2, 3, '24x GE + 4x SFP, WebUI + CLI management'),
      (v_org_id,'CISCO-SF350-24','Cisco SF350-24 24-Port 10/100 Managed Switch',   v_b_cisco,  v_cat_net,   'pcs', 22000, 27500, 29000, 18, '85176990', 2, 3, '24x FE + 2x GE + 2x SFP combo'),
      (v_org_id,'CISCO-RV340',  'Cisco RV340 Dual WAN Gigabit VPN Router',         v_b_cisco,  v_cat_net,   'pcs', 18000, 23000, 24000, 18, '85176990', 2, 3, 'Dual WAN, 4x LAN, SSL VPN, firewall'),
      (v_org_id,'TPL-AX55',     'TP-Link Archer AX55 WiFi 6 AX3000 Router',        NULL,       v_cat_net,   'pcs',  3600,  4700,  4900, 18, '85176990', 5, 10,'Dual band, OFDMA, MU-MIMO, 4 antennas'),
      (v_org_id,'TPL-SG108',    'TP-Link TL-SG108 8-Port Gigabit Unmanaged Switch',NULL,       v_cat_net,   'pcs',  1100,  1490,  1600, 18, '85176990',10, 20, 'Plug and play, steel case, auto-negotiation'),
      (v_org_id,'TPL-EAP225',   'TP-Link EAP225 AC1350 Wireless Ceiling AP',       NULL,       v_cat_net,   'pcs',  2600,  3400,  3600, 18, '85176990', 5, 8, 'Dual band, MU-MIMO, PoE, Omada controller'),
      (v_org_id,'TPL-DECO-M9',  'TP-Link Deco M9 Plus AC2200 Mesh WiFi (3-pack)',  NULL,       v_cat_net,   'pcs',  9500, 12500, 13000, 18, '85176990', 2, 3, 'Tri-band, covers up to 5000 sq ft'),
      -- STORAGE (7)
      (v_org_id,'SEA-BAR-1TB',  'Seagate BarraCuda 1TB 3.5" SATA HDD 7200RPM',    v_b_seagate,v_cat_storage,'pcs', 2600,  3400,  3600, 18, '84717010',10, 20, '7200 RPM, 64MB cache, SATA 6Gb/s'),
      (v_org_id,'SEA-BAR-2TB',  'Seagate BarraCuda 2TB 3.5" SATA HDD 7200RPM',    v_b_seagate,v_cat_storage,'pcs', 4000,  5200,  5500, 18, '84717010', 8, 15, '7200 RPM, 256MB cache, SATA 6Gb/s'),
      (v_org_id,'SEA-IRON-4TB', 'Seagate IronWolf 4TB NAS HDD 3.5" 5900RPM',      v_b_seagate,v_cat_storage,'pcs', 8000, 10500, 11000, 18, '84717010', 3, 5,  'NAS optimized, 64MB cache, AgileArray'),
      (v_org_id,'SAM-SSD-1TB',  'Samsung 870 EVO 1TB 2.5" SATA SSD',              v_b_samsung,v_cat_storage,'pcs', 6500,  8500,  9000, 18, '84717010', 8, 15, '560MB/s read, 530MB/s write, MLC V-NAND'),
      (v_org_id,'SAM-SSD-500G', 'Samsung 870 EVO 500GB 2.5" SATA SSD',            v_b_samsung,v_cat_storage,'pcs', 3800,  5000,  5300, 18, '84717010',10, 20, '560MB/s read, 530MB/s write, MLC V-NAND'),
      (v_org_id,'WD-BLUE-2TB',  'Western Digital Blue 2TB 3.5" SATA HDD 5400RPM', NULL,       v_cat_storage,'pcs', 4200,  5400,  5700, 18, '84717010', 8, 15, '5400 RPM, 256MB cache, 2-year warranty'),
      (v_org_id,'SAM-T7-1TB',   'Samsung T7 Portable SSD 1TB USB 3.2 Gen 2',      v_b_samsung,v_cat_storage,'pcs', 6000,  8000,  8500, 18, '84717090', 5, 8,  '1050MB/s read, 1000MB/s write, AES 256-bit'),
      -- ACCESSORIES (7)
      (v_org_id,'LOG-MK215',    'Logitech MK215 Wireless Keyboard and Mouse Combo',NULL,       v_cat_acc,   'pcs',   850,  1190,  1300, 18, '84716050',15, 25, '2.4GHz wireless, 2-year battery, plug & play'),
      (v_org_id,'LOG-MXKEYS',   'Logitech MX Keys S Advanced Wireless Keyboard',   NULL,       v_cat_acc,   'pcs',  6800,  8900,  9300, 18, '84716050', 5, 8,  'Backlit, multi-device, USB-C, 5-month battery'),
      (v_org_id,'HP-KBDSLIM',   'HP USB Business Slim Keyboard USB',               v_b_hp,     v_cat_acc,   'pcs',   400,   590,   650, 18, '84716050',20, 30, 'Full-size, spill-resistant, quiet keys'),
      (v_org_id,'LOG-M171',     'Logitech M171 Wireless Mouse 2.4GHz',             NULL,       v_cat_acc,   'pcs',   500,   690,   750, 18, '84716050',20, 30, 'Nano USB receiver, 12-month battery, 1000 DPI'),
      (v_org_id,'DELL-MS3320W', 'Dell MS3320W Wireless Mouse Multi-device',        v_b_dell,   v_cat_acc,   'pcs',  1800,  2400,  2600, 18, '84716050', 8, 15, 'Bluetooth + 2.4GHz, 3 device pairing'),
      (v_org_id,'LOG-C505-WEB', 'Logitech C505 HD 720p Webcam with Mic',           NULL,       v_cat_acc,   'pcs',  1600,  2200,  2400, 18, '85258090', 8, 15, 'H.264 video, built-in mic, 60° FoV, USB-A'),
      (v_org_id,'HP-WEBCAM-325','HP 325 FHD USB-A Webcam 1080p 30fps',             v_b_hp,     v_cat_acc,   'pcs',  2200,  2990,  3200, 18, '85258090', 5, 10, '1080p FHD, 78° FoV, built-in mic, USB-A'),
      -- PRINTERS (4)
      (v_org_id,'HP-LJP-M404DN','HP LaserJet Pro M404dn Mono Laser Printer',      v_b_hp,     v_cat_printer,'pcs',15500, 19500, 20500, 18, '84433100', 3, 5,  '40 ppm, auto duplex, LAN, USB, 250-sheet'),
      (v_org_id,'CAN-MF445DW',  'Canon imageCLASS MF445dw Mono Laser MFP',        NULL,       v_cat_printer,'pcs',19500, 24900, 26000, 18, '84433100', 2, 3,  'Print/Copy/Scan/Fax, 40 ppm, WiFi, auto duplex'),
      (v_org_id,'EPS-L3252',    'Epson EcoTank L3252 WiFi Color Ink Tank Printer', NULL,       v_cat_printer,'pcs', 8200, 10900, 11500, 18, '84433100', 5, 8,  'Print/Copy/Scan, WiFi, mobile printing, 5760 dpi'),
      (v_org_id,'HP-CLJ-M454DN','HP Color LaserJet Pro M454dn Color Laser Printer',v_b_hp,     v_cat_printer,'pcs',28000, 35500, 37500, 18, '84433100', 2, 3,  '28 ppm color, auto duplex, LAN, USB'),
      -- POWER (3)
      (v_org_id,'APC-BX1100C',  'APC Back-UPS 1100VA 230V BX1100C-IN',            v_b_apc,    v_cat_power,  'pcs', 5500,  7200,  7600, 18, '85044090', 5, 8,  '660W, 6 outlets, AVR, surge protection, USB'),
      (v_org_id,'APC-SMT1500I', 'APC Smart-UPS 1500VA LCD 230V SMT1500I',         v_b_apc,    v_cat_power,  'pcs',17500, 22000, 23000, 18, '85044090', 2, 3,  '1000W, pure sine, LCD, SNMP ready, 8 outlets'),
      (v_org_id,'APC-BX600C',   'APC Back-UPS 600VA 360W BX600C-IN',              v_b_apc,    v_cat_power,  'pcs', 2600,  3400,  3600, 18, '85044090', 8, 15, '360W, 4 outlets, surge protection, USB port')
    RETURNING sku, id, cost_price, selling_price
  )
  INSERT INTO _prods SELECT sku, id, cost_price, selling_price FROM ins;

  -- ── 7. Opening Stock via adjustments ──────────────────────────────────────
  INSERT INTO stock_movements (organization_id, product_id, location_id, movement_type, quantity, reference_no, notes)
  SELECT v_org_id, pid, v_loc_id, 'adjustment',
    CASE sku
      WHEN 'HP-PB450G10'   THEN 12 WHEN 'HP-EB840G10'   THEN 6
      WHEN 'DELL-LAT5440'  THEN 8  WHEN 'DELL-VOS3520'  THEN 15
      WHEN 'LEN-TPE14G5'   THEN 7  WHEN 'LEN-IPS5-I5'   THEN 10
      WHEN 'ASUS-EXB1-I5'  THEN 8  WHEN 'ASUS-VB15-I5'  THEN 10
      WHEN 'ACR-ASP5-I5'   THEN 12 WHEN 'ACR-TMP2-I5'   THEN 7
      WHEN 'HP-PD400G9'    THEN 8  WHEN 'DELL-OPT3000'  THEN 6
      WHEN 'LEN-TCM720Q'   THEN 5  WHEN 'ASUS-ECD5-SFF' THEN 6
      WHEN 'ACR-VX2660G'   THEN 8  WHEN 'HP-PAVDT-TP01' THEN 7
      WHEN 'DELL-SE2422H'  THEN 10 WHEN 'HP-MON-24MH'   THEN 8
      WHEN 'LG-24MK400H'   THEN 12 WHEN 'SAM-27LS'      THEN 6
      WHEN 'DELL-P2722H'   THEN 4  WHEN 'LG-32MN500M'   THEN 4
      WHEN 'CISCO-SG350-28' THEN 4 WHEN 'CISCO-SF350-24' THEN 5
      WHEN 'CISCO-RV340'   THEN 4  WHEN 'TPL-AX55'      THEN 15
      WHEN 'TPL-SG108'     THEN 30 WHEN 'TPL-EAP225'    THEN 12
      WHEN 'TPL-DECO-M9'   THEN 5  WHEN 'SEA-BAR-1TB'   THEN 25
      WHEN 'SEA-BAR-2TB'   THEN 20 WHEN 'SEA-IRON-4TB'  THEN 8
      WHEN 'SAM-SSD-1TB'   THEN 18 WHEN 'SAM-SSD-500G'  THEN 20
      WHEN 'WD-BLUE-2TB'   THEN 15 WHEN 'SAM-T7-1TB'    THEN 10
      WHEN 'LOG-MK215'     THEN 30 WHEN 'LOG-MXKEYS'    THEN 8
      WHEN 'HP-KBDSLIM'    THEN 25 WHEN 'LOG-M171'      THEN 35
      WHEN 'DELL-MS3320W'  THEN 12 WHEN 'LOG-C505-WEB'  THEN 15
      WHEN 'HP-WEBCAM-325' THEN 10 WHEN 'HP-LJP-M404DN' THEN 5
      WHEN 'CAN-MF445DW'   THEN 4  WHEN 'EPS-L3252'     THEN 8
      WHEN 'HP-CLJ-M454DN' THEN 3  WHEN 'APC-BX1100C'   THEN 10
      WHEN 'APC-SMT1500I'  THEN 4  WHEN 'APC-BX600C'    THEN 12
      ELSE 5
    END,
    'OPENING-STOCK-2026',
    'Opening stock - January 2026'
  FROM _prods;

  -- ── 8. Vendors (15) ───────────────────────────────────────────────────────
  CREATE TEMP TABLE _vends (vkey TEXT PRIMARY KEY, vid UUID);

  WITH ins AS (
    INSERT INTO vendors (organization_id, name, contact_name, phone, email, address, gstin, is_active)
    VALUES
      (v_org_id,'Tech Distribution India Pvt Ltd','Rakesh Agarwal',   '+91-9811001001','rakesh@techdisindia.com',  'A-45, Sector 10, Noida UP 201301',          '09AADCT1234B1Z2', true),
      (v_org_id,'Micro Solutions Pvt Ltd',        'Suresh Mehta',     '+91-9312002002','suresh@microsolutions.in',  'B-12, Okhla Phase 2, New Delhi 110020',      '07AABCM5678C1Z3', true),
      (v_org_id,'Nexgen Dell Authorized Partner', 'Amit Kapoor',      '+91-9818003003','amit@nexgendell.com',       'C-8, Patparganj Industrial, Delhi 110092',   '07AACCN2345D1Z4', true),
      (v_org_id,'HP Enterprise Supplies India',   'Priya Nair',       '+91-9971004004','priya@hpesupplies.in',     'Tower B, DLF Cyber City, Gurgaon 122002',    '06AABCH3456E1Z5', true),
      (v_org_id,'DataServe Lenovo Authorized',    'Vikram Sinha',     '+91-9560005005','vikram@dataserve.co.in',    'E-23, Sector 63, Noida UP 201307',           '09AABCD4567F1Z6', true),
      (v_org_id,'Network World India Pvt Ltd',    'Deepak Sharma',    '+91-9899006006','deepak@networkworld.in',    'F-16, Sector 58, Noida UP 201301',           '09AABCN5678G1Z7', true),
      (v_org_id,'Cisco Systems India (Dist)',     'Rohan Verma',      '+91-9810007007','rohan@ciscodist.in',        'G-22, HITEC City, Hyderabad TS 500081',      '36AABCC6789H1Z8', true),
      (v_org_id,'Redington India Ltd',            'Anita Krishnan',   '+91-9444008008','anita@redington.co.in',     'SPL-1 Perungalathur, Chennai TN 600063',     '33AAACR0001A1Z9', true),
      (v_org_id,'Ingram Micro India Pvt Ltd',     'Sanjay Patel',     '+91-9825009009','sanjay@ingrammicro.in',     'Tower 1, One Indiabulls, Gurgaon 122001',    '06AABCI7890I1Z0', true),
      (v_org_id,'Schneider APC Authorized',       'Kavita Joshi',     '+91-9871010010','kavita@schneiderups.in',    'J-4, Sec 44, Gurgaon HR 122003',             '06AABCS8901J1Z1', true),
      (v_org_id,'Samsung India Electronics',      'Mohit Arora',      '+91-9910011011','mohit@samsungdist.in',      'Tower C, Infinity Tower, DLF 5, Gurgaon',   '06AAACS9012K1Z2', true),
      (v_org_id,'Seagate Technology India',       'Ramesh Iyer',      '+91-9500012012','ramesh@seagateindia.in',    'L-18, TIDEL Park, Chennai TN 600113',        '33AABCS0123L1Z3', true),
      (v_org_id,'Storage World India Pvt Ltd',    'Sunita Gupta',     '+91-9312013013','sunita@storageworld.in',    'M-5, Sector 18, Noida UP 201301',            '09AABCS1234M1Z4', true),
      (v_org_id,'TriTech Asus Authorized',        'Harsh Malhotra',   '+91-9810014014','harsh@tritech.in',          'N-7, Nehru Place, New Delhi 110019',         '07AABCT2345N1Z5', true),
      (v_org_id,'Acer India Pvt Ltd',             'Meena Bhat',       '+91-9845015015','meena@acerindia.in',        'O-3, Prestige Meridian, Bangalore 560001',   '29AACCA3456O1Z6', true)
    RETURNING name, id
  )
  INSERT INTO _vends SELECT name, id FROM ins;

  -- ── 9. Customers (25) ─────────────────────────────────────────────────────
  CREATE TEMP TABLE _custs (ckey TEXT PRIMARY KEY, cid UUID);

  WITH ins AS (
    INSERT INTO customers (organization_id, name, company_name, gst_number, phone, email,
                           address, city, state, pincode, shipping_address, notes, is_active)
    VALUES
      (v_org_id,'ABC Technologies Pvt Ltd',  'ABC Technologies Pvt Ltd',  '09AABCA1234A1Z1','+91-9871111001','accounts@abctech.in',
        'A-12, Sector 63, Noida', 'Noida', 'Uttar Pradesh', '201307',
        '{"line1":"A-12, Sector 63, Noida","city":"Noida","state":"Uttar Pradesh","pincode":"201307"}'::jsonb,
        'Key account - IT hardware refresh every 2 years', true),
      (v_org_id,'XYZ Systems Pvt Ltd',       'XYZ Systems Pvt Ltd',       '07AABCX5678B1Z2','+91-9871111002','purchase@xyzsystems.com',
        'B-45, Nehru Place', 'New Delhi', 'Delhi', '110019',
        '{"line1":"B-45, Nehru Place","city":"New Delhi","state":"Delhi","pincode":"110019"}'::jsonb,
        'Preferred payment: NEFT. Net 15 terms.', true),
      (v_org_id,'Global Education Trust',    'Global Education Trust',    '09AABCG2345C1Z3','+91-9871111003','admin@globaledu.org',
        'C-3, Sector 44, Noida', 'Noida', 'Uttar Pradesh', '201303',
        '{"line1":"C-3, Sector 44, Noida","city":"Noida","state":"Uttar Pradesh","pincode":"201303"}'::jsonb,
        'Annual tender for IT equipment. CBSE affiliated.', true),
      (v_org_id,'Smart Manufacturing Ltd',   'Smart Manufacturing Ltd',   '06AABCS3456D1Z4','+91-9871111004','it@smartmfg.in',
        'D-Plot, IMT Manesar', 'Gurgaon', 'Haryana', '122051',
        '{"line1":"D-Plot, IMT Manesar","city":"Gurgaon","state":"Haryana","pincode":"122051"}'::jsonb,
        'Large orders for factory office setup.', true),
      (v_org_id,'Future Enterprises',        'Future Enterprises',        '09AABCF4567E1Z5','+91-9871111005','info@futureent.com',
        'E-8, Civil Lines', 'Agra', 'Uttar Pradesh', '282002',
        '{"line1":"E-8, Civil Lines","city":"Agra","state":"Uttar Pradesh","pincode":"282002"}'::jsonb,
        'Medium enterprise, quarterly procurement.', true),
      (v_org_id,'Sunrise InfoTech Pvt Ltd',  'Sunrise InfoTech Pvt Ltd',  '09AABCS5678F1Z6','+91-9871111006','purchase@sunriseit.in',
        'F-22, Sector 18, Noida', 'Noida', 'Uttar Pradesh', '201301',
        '{"line1":"F-22, Sector 18, Noida","city":"Noida","state":"Uttar Pradesh","pincode":"201301"}'::jsonb,
        'IT reseller - sometimes bulk purchase for resale.', true),
      (v_org_id,'Bharat BPO Solutions',      'Bharat BPO Solutions',      '06AABCB6789G1Z7','+91-9871111007','admin@bharatbpo.com',
        'G-7, Udyog Vihar Phase 2', 'Gurgaon', 'Haryana', '122016',
        '{"line1":"G-7, Udyog Vihar Phase 2","city":"Gurgaon","state":"Haryana","pincode":"122016"}'::jsonb,
        'BPO needs frequent keyboard/mouse/headset replacements.', true),
      (v_org_id,'Delhi Public School Saket', 'Delhi Public School',       '07AABCD7890H1Z8','+91-9871111008','principal@dpssaket.edu.in',
        'H-Block, Saket', 'New Delhi', 'Delhi', '110017',
        '{"line1":"H-Block, Saket","city":"New Delhi","state":"Delhi","pincode":"110017"}'::jsonb,
        'Education institution - exempt from some taxes. Verify each order.', true),
      (v_org_id,'MedPlus Healthcare',        'MedPlus Healthcare Pvt Ltd','09AABCM8901I1Z9','+91-9871111009','it@medplus.in',
        'I-45, Sector 135, Noida', 'Noida', 'Uttar Pradesh', '201304',
        '{"line1":"I-45, Sector 135, Noida","city":"Noida","state":"Uttar Pradesh","pincode":"201304"}'::jsonb,
        'Hospital chain, needs reliable uptime - prefers APC UPS.', true),
      (v_org_id,'Rajasthan Infra Corp',      'Rajasthan Infra Corp Ltd',  '08AABCR9012J1Z0','+91-9871111010','purchase@rajinfra.com',
        'J-12, Malviya Nagar', 'Jaipur', 'Rajasthan', '302017',
        '{"line1":"J-12, Malviya Nagar","city":"Jaipur","state":"Rajasthan","pincode":"302017"}'::jsonb,
        'Large tender customer. Shipping to Jaipur site office.', true),
      (v_org_id,'Punjab National Infra Ltd', 'Punjab National Infra Ltd', '03AABCP0123K1Z1','+91-9871111011','admin@pnipl.com',
        'K-5, Industrial Area Phase 1', 'Chandigarh', 'Chandigarh', '160002',
        '{"line1":"K-5, Industrial Area Phase 1","city":"Chandigarh","state":"Chandigarh","pincode":"160002"}'::jsonb,
        'Infrastructure company. Network and server requirements.', true),
      (v_org_id,'Eastern Logistics Ltd',     'Eastern Logistics Ltd',     '09AABCE1234L1Z2','+91-9871111012','it@eastlogistics.in',
        'L-Railway Road, Kanpur', 'Kanpur', 'Uttar Pradesh', '208001',
        '{"line1":"L-Railway Road, Kanpur","city":"Kanpur","state":"Uttar Pradesh","pincode":"208001"}'::jsonb,
        'Fleet management company, needs ruggedized hardware.', true),
      (v_org_id,'Himalaya Pharma Research',  'Himalaya Drug Company',     '27AABCH2345M1Z3','+91-9871111013','purchase@himalaya.in',
        'M-Research Centre, Andheri', 'Mumbai', 'Maharashtra', '400053',
        '{"line1":"M-Research Centre, Andheri East","city":"Mumbai","state":"Maharashtra","pincode":"400053"}'::jsonb,
        'R&D lab setup. High spec laptops and workstations.', true),
      (v_org_id,'TechCraft Software Pvt Ltd','TechCraft Software Pvt Ltd','36AABCT3456N1Z4','+91-9871111014','finance@techcraft.io',
        'N-303, Cyber Towers, HITEC City', 'Hyderabad', 'Telangana', '500081',
        '{"line1":"N-303, Cyber Towers, HITEC City","city":"Hyderabad","state":"Telangana","pincode":"500081"}'::jsonb,
        'Software company needing developer laptops quarterly.', true),
      (v_org_id,'Apex Financial Services',   'Apex Financial Services',   '07AABCA4567O1Z5','+91-9871111015','admin@apexfinserv.com',
        'O-8th Floor, Connaught Place', 'New Delhi', 'Delhi', '110001',
        '{"line1":"O-8th Floor, Connaught Place","city":"New Delhi","state":"Delhi","pincode":"110001"}'::jsonb,
        'BFSI client. Prefers HP and Dell. Strict compliance requirements.', true),
      (v_org_id,'GreenLeaf Renewable Energy','GreenLeaf Renewable Energy','27AABCG5678P1Z6','+91-9871111016','it@greenleaf.energy',
        'P-Baner Road', 'Pune', 'Maharashtra', '411045',
        '{"line1":"P-Baner Road, Baner","city":"Pune","state":"Maharashtra","pincode":"411045"}'::jsonb,
        'Solar energy company. Field laptops need durability.', true),
      (v_org_id,'National Academy of Sciences','National Academy',        '07AABCN6789Q1Z7','+91-9871111017','admin@nasindia.org',
        'Q-Bahadur Shah Zafar Marg', 'New Delhi', 'Delhi', '110002',
        '{"line1":"Q-Bahadur Shah Zafar Marg","city":"New Delhi","state":"Delhi","pincode":"110002"}'::jsonb,
        'Government body. Purchase orders via GeM portal.', true),
      (v_org_id,'Urban Development Authority','Lucknow Development Auth', '09AABCU7890R1Z8','+91-9871111018','uda@nic.in',
        'R-5 Vipin Khand', 'Lucknow', 'Uttar Pradesh', '226010',
        '{"line1":"R-5, Vipin Khand, Gomti Nagar","city":"Lucknow","state":"Uttar Pradesh","pincode":"226010"}'::jsonb,
        'Government department. L1 tender process. Delayed payments.', true),
      (v_org_id,'Silver Oak Hospitals Ltd',  'Silver Oak Hospitals Ltd',  '09AABCS8901S1Z9','+91-9871111019','purchase@silveroakhospital.com',
        'S-Sector 26, Noida', 'Noida', 'Uttar Pradesh', '201301',
        '{"line1":"S-Sector 26, Noida","city":"Noida","state":"Uttar Pradesh","pincode":"201301"}'::jsonb,
        'Hospital chain. Priority support needed. APC UPS critical.', true),
      (v_org_id,'IndusFirst Cooperative Bank','IndusFirst Coop Bank',     '09AABCI9012T1Z0','+91-9871111020','it@indusfirstbank.com',
        'T-Civil Lines', 'Prayagraj', 'Uttar Pradesh', '211001',
        '{"line1":"T-Civil Lines","city":"Prayagraj","state":"Uttar Pradesh","pincode":"211001"}'::jsonb,
        'Small bank - needs UPS and networking for branch expansion.', true),
      (v_org_id,'Neon Advertising Agency',   'Neon Advertising Pvt Ltd',  '07AABCN0123U1Z1','+91-9871111021','finance@neonadvertising.in',
        'U-Connaught Lane', 'New Delhi', 'Delhi', '110001',
        '{"line1":"U-Connaught Lane","city":"New Delhi","state":"Delhi","pincode":"110001"}'::jsonb,
        'Creative agency - prefers Mac but uses Windows for accounts.', true),
      (v_org_id,'Krishna AutoMobile Ltd',    'Krishna AutoMobile Ltd',    '09AABCK1234V1Z2','+91-9871111022','admin@krishnaauto.in',
        'V-NH-2 Mathura Road', 'Mathura', 'Uttar Pradesh', '281001',
        '{"line1":"V-NH-2, Mathura Road","city":"Mathura","state":"Uttar Pradesh","pincode":"281001"}'::jsonb,
        'Auto dealership chain. Multiple showroom setups.', true),
      (v_org_id,'Saraswati Educational Trust','Saraswati Educational Trust','09AABCS2345W1Z3','+91-9871111023','admin@saraswatiedu.org',
        'W-Lanka', 'Varanasi', 'Uttar Pradesh', '221005',
        '{"line1":"W-Lanka, BHU Road","city":"Varanasi","state":"Uttar Pradesh","pincode":"221005"}'::jsonb,
        'College trust. Annual budget procurement in March-April.', true),
      (v_org_id,'Horizon IT Infrastructure', 'Horizon IT Infra Pvt Ltd',  '27AABCH3456X1Z4','+91-9871111024','purchase@horizonit.co.in',
        'X-Andheri East', 'Mumbai', 'Maharashtra', '400069',
        '{"line1":"X-MIDC, Andheri East","city":"Mumbai","state":"Maharashtra","pincode":"400069"}'::jsonb,
        'IT infra company - reseller and end-customer both. Cisco preferred.', true),
      (v_org_id,'Pioneer Telecom Solutions',  'Pioneer Telecom Solutions', '07AABCP4567Y1Z5','+91-9871111025','admin@pioneertelecom.in',
        'Y-Lajpat Nagar III', 'New Delhi', 'Delhi', '110024',
        '{"line1":"Y-Lajpat Nagar III","city":"New Delhi","state":"Delhi","pincode":"110024"}'::jsonb,
        'Telecom equipment provider. WiFi and switching needs.', true)
    RETURNING name, id
  )
  INSERT INTO _custs SELECT name, id FROM ins;


  -- ── 10. Purchase Orders (20) + Items + GRN Receipts ─────────────────────

  -- PO-1 | Jan 5 2026 | HP Enterprise Supplies | received
  SELECT vid INTO v_vid FROM _vends WHERE vkey = 'HP Enterprise Supplies India';
  INSERT INTO purchase_orders (organization_id, vendor_id, po_date, expected_date, status, subtotal, tax_amount, total_amount, notes, created_by)
  VALUES (v_org_id, v_vid, '2026-01-05', '2026-01-12', 'received', 714000, 128520, 842520, 'Q1 HP laptop stock replenishment', v_uid)
  RETURNING id INTO v_po_id;
  INSERT INTO purchase_order_items (purchase_order_id, product_id, description, quantity, unit_cost, tax_rate, line_total, received_qty, sort_order)
  VALUES
    (v_po_id,(SELECT pid FROM _prods WHERE sku='HP-PB450G10'),'HP ProBook 450 G10',      10, 42000, 18, 495900, 10, 1),
    (v_po_id,(SELECT pid FROM _prods WHERE sku='HP-EB840G10'),'HP EliteBook 840 G10',     5, 68000, 18, 401200,  5, 2),
    (v_po_id,(SELECT pid FROM _prods WHERE sku='HP-PD400G9'), 'HP ProDesk 400 G9 SFF',    5, 32000, 18, 188800,  5, 3);
  -- GRN-1
  INSERT INTO po_receipts (organization_id, purchase_order_id, receipt_date, notes, created_by)
  VALUES (v_org_id, v_po_id, '2026-01-12', 'Full delivery received. All units inspected OK.', v_uid)
  RETURNING id INTO v_rec_id;
  INSERT INTO po_receipt_items (receipt_id, po_item_id, product_id, location_id, quantity)
  SELECT v_rec_id, poi.id, poi.product_id, v_loc_id, poi.quantity
  FROM purchase_order_items poi WHERE poi.purchase_order_id = v_po_id;
  INSERT INTO stock_movements (organization_id, product_id, location_id, movement_type, quantity, reference_no, vendor_id, notes)
  SELECT v_org_id, poi.product_id, v_loc_id, 'receipt', poi.quantity, 'PO-00001', v_vid, 'GRN against PO-00001'
  FROM purchase_order_items poi WHERE poi.purchase_order_id = v_po_id;

  -- PO-2 | Jan 8 2026 | Nexgen Dell Authorized | received
  SELECT vid INTO v_vid FROM _vends WHERE vkey = 'Nexgen Dell Authorized Partner';
  INSERT INTO purchase_orders (organization_id, vendor_id, po_date, expected_date, status, subtotal, tax_amount, total_amount, notes, created_by)
  VALUES (v_org_id, v_vid, '2026-01-08', '2026-01-15', 'received', 698500, 125730, 824230, 'Dell laptops and desktops Q1', v_uid)
  RETURNING id INTO v_po_id;
  INSERT INTO purchase_order_items (purchase_order_id, product_id, description, quantity, unit_cost, tax_rate, line_total, received_qty, sort_order)
  VALUES
    (v_po_id,(SELECT pid FROM _prods WHERE sku='DELL-LAT5440'), 'Dell Latitude 5440',    8, 60000, 18, 566400,  8, 1),
    (v_po_id,(SELECT pid FROM _prods WHERE sku='DELL-VOS3520'), 'Dell Vostro 3520',     10, 28500, 18, 336300, 10, 2),
    (v_po_id,(SELECT pid FROM _prods WHERE sku='DELL-OPT3000'), 'Dell OptiPlex 3000 MT', 5, 34000, 18, 200900,  5, 3);
  INSERT INTO po_receipts (organization_id, purchase_order_id, receipt_date, notes, created_by)
  VALUES (v_org_id, v_po_id, '2026-01-15', 'Full delivery. 1 Vostro had cosmetic scratch - accepted.', v_uid)
  RETURNING id INTO v_rec_id;
  INSERT INTO po_receipt_items (receipt_id, po_item_id, product_id, location_id, quantity)
  SELECT v_rec_id, poi.id, poi.product_id, v_loc_id, poi.quantity FROM purchase_order_items poi WHERE poi.purchase_order_id = v_po_id;
  INSERT INTO stock_movements (organization_id, product_id, location_id, movement_type, quantity, reference_no, vendor_id, notes)
  SELECT v_org_id, poi.product_id, v_loc_id, 'receipt', poi.quantity, 'PO-00002', v_vid, 'GRN against PO-00002'
  FROM purchase_order_items poi WHERE poi.purchase_order_id = v_po_id;

  -- PO-3 | Jan 12 2026 | DataServe Lenovo | received
  SELECT vid INTO v_vid FROM _vends WHERE vkey = 'DataServe Lenovo Authorized';
  INSERT INTO purchase_orders (organization_id, vendor_id, po_date, expected_date, status, subtotal, tax_amount, total_amount, notes, created_by)
  VALUES (v_org_id, v_vid, '2026-01-12', '2026-01-20', 'received', 652000, 117360, 769360, 'Lenovo ThinkPad and IdeaPad initial stock', v_uid)
  RETURNING id INTO v_po_id;
  INSERT INTO purchase_order_items (purchase_order_id, product_id, description, quantity, unit_cost, tax_rate, line_total, received_qty, sort_order)
  VALUES
    (v_po_id,(SELECT pid FROM _prods WHERE sku='LEN-TPE14G5'),'Lenovo ThinkPad E14 G5',  8, 55000, 18, 519200, 8, 1),
    (v_po_id,(SELECT pid FROM _prods WHERE sku='LEN-IPS5-I5'),'Lenovo IdeaPad Slim 5',   8, 38000, 18, 358880, 8, 2),
    (v_po_id,(SELECT pid FROM _prods WHERE sku='LEN-TCM720Q'),'Lenovo ThinkCentre M720q',5, 29000, 18, 171550, 5, 3);
  INSERT INTO po_receipts (organization_id, purchase_order_id, receipt_date, notes, created_by)
  VALUES (v_org_id, v_po_id, '2026-01-20', 'Complete delivery received. All units checked.', v_uid)
  RETURNING id INTO v_rec_id;
  INSERT INTO po_receipt_items (receipt_id, po_item_id, product_id, location_id, quantity)
  SELECT v_rec_id, poi.id, poi.product_id, v_loc_id, poi.quantity FROM purchase_order_items poi WHERE poi.purchase_order_id = v_po_id;
  INSERT INTO stock_movements (organization_id, product_id, location_id, movement_type, quantity, reference_no, vendor_id, notes)
  SELECT v_org_id, poi.product_id, v_loc_id, 'receipt', poi.quantity, 'PO-00003', v_vid, 'GRN against PO-00003'
  FROM purchase_order_items poi WHERE poi.purchase_order_id = v_po_id;

  -- PO-4 | Jan 18 2026 | Network World India | received
  SELECT vid INTO v_vid FROM _vends WHERE vkey = 'Network World India Pvt Ltd';
  INSERT INTO purchase_orders (organization_id, vendor_id, po_date, expected_date, status, subtotal, tax_amount, total_amount, notes, created_by)
  VALUES (v_org_id, v_vid, '2026-01-18', '2026-01-25', 'received', 298000, 53640, 351640, 'Networking equipment initial stock', v_uid)
  RETURNING id INTO v_po_id;
  INSERT INTO purchase_order_items (purchase_order_id, product_id, description, quantity, unit_cost, tax_rate, line_total, received_qty, sort_order)
  VALUES
    (v_po_id,(SELECT pid FROM _prods WHERE sku='TPL-AX55'),  'TP-Link AX55 Router',       15, 3600, 18, 63720, 15, 1),
    (v_po_id,(SELECT pid FROM _prods WHERE sku='TPL-SG108'), 'TP-Link SG108 Switch',       30, 1100, 18, 38940, 30, 2),
    (v_po_id,(SELECT pid FROM _prods WHERE sku='TPL-EAP225'),'TP-Link EAP225 Access Point',12, 2600, 18, 36907, 12, 3),
    (v_po_id,(SELECT pid FROM _prods WHERE sku='TPL-DECO-M9'),'TP-Link Deco M9 Plus',       5, 9500, 18, 56050,  5, 4);
  INSERT INTO po_receipts (organization_id, purchase_order_id, receipt_date, notes, created_by)
  VALUES (v_org_id, v_po_id, '2026-01-25', 'All networking equipment received and tested.', v_uid)
  RETURNING id INTO v_rec_id;
  INSERT INTO po_receipt_items (receipt_id, po_item_id, product_id, location_id, quantity)
  SELECT v_rec_id, poi.id, poi.product_id, v_loc_id, poi.quantity FROM purchase_order_items poi WHERE poi.purchase_order_id = v_po_id;
  INSERT INTO stock_movements (organization_id, product_id, location_id, movement_type, quantity, reference_no, vendor_id, notes)
  SELECT v_org_id, poi.product_id, v_loc_id, 'receipt', poi.quantity, 'PO-00004', v_vid, 'GRN against PO-00004'
  FROM purchase_order_items poi WHERE poi.purchase_order_id = v_po_id;

  -- PO-5 | Feb 3 2026 | Seagate India | received
  SELECT vid INTO v_vid FROM _vends WHERE vkey = 'Seagate Technology India';
  INSERT INTO purchase_orders (organization_id, vendor_id, po_date, expected_date, status, subtotal, tax_amount, total_amount, notes, created_by)
  VALUES (v_org_id, v_vid, '2026-02-03', '2026-02-10', 'received', 291000, 52380, 343380, 'Storage devices bulk purchase Feb 2026', v_uid)
  RETURNING id INTO v_po_id;
  INSERT INTO purchase_order_items (purchase_order_id, product_id, description, quantity, unit_cost, tax_rate, line_total, received_qty, sort_order)
  VALUES
    (v_po_id,(SELECT pid FROM _prods WHERE sku='SEA-BAR-1TB'), 'Seagate BarraCuda 1TB HDD',  25, 2600, 18, 76830, 25, 1),
    (v_po_id,(SELECT pid FROM _prods WHERE sku='SEA-BAR-2TB'), 'Seagate BarraCuda 2TB HDD',  20, 4000, 18, 94400, 20, 2),
    (v_po_id,(SELECT pid FROM _prods WHERE sku='SEA-IRON-4TB'),'Seagate IronWolf 4TB NAS',    8, 8000, 18, 75520,  8, 3),
    (v_po_id,(SELECT pid FROM _prods WHERE sku='WD-BLUE-2TB'), 'WD Blue 2TB HDD',            15, 4200, 18, 74340, 15, 4);
  INSERT INTO po_receipts (organization_id, purchase_order_id, receipt_date, notes, created_by)
  VALUES (v_org_id, v_po_id, '2026-02-10', 'Storage devices received. All drives verified.', v_uid)
  RETURNING id INTO v_rec_id;
  INSERT INTO po_receipt_items (receipt_id, po_item_id, product_id, location_id, quantity)
  SELECT v_rec_id, poi.id, poi.product_id, v_loc_id, poi.quantity FROM purchase_order_items poi WHERE poi.purchase_order_id = v_po_id;
  INSERT INTO stock_movements (organization_id, product_id, location_id, movement_type, quantity, reference_no, vendor_id, notes)
  SELECT v_org_id, poi.product_id, v_loc_id, 'receipt', poi.quantity, 'PO-00005', v_vid, 'GRN against PO-00005'
  FROM purchase_order_items poi WHERE poi.purchase_order_id = v_po_id;

  -- PO-6 | Feb 8 2026 | Samsung India Electronics | received
  SELECT vid INTO v_vid FROM _vends WHERE vkey = 'Samsung India Electronics';
  INSERT INTO purchase_orders (organization_id, vendor_id, po_date, expected_date, status, subtotal, tax_amount, total_amount, notes, created_by)
  VALUES (v_org_id, v_vid, '2026-02-08', '2026-02-15', 'received', 368500, 66330, 434830, 'Samsung SSD and monitors Feb 2026', v_uid)
  RETURNING id INTO v_po_id;
  INSERT INTO purchase_order_items (purchase_order_id, product_id, description, quantity, unit_cost, tax_rate, line_total, received_qty, sort_order)
  VALUES
    (v_po_id,(SELECT pid FROM _prods WHERE sku='SAM-SSD-1TB'), 'Samsung 870 EVO 1TB SSD',     20, 6500, 18, 153400, 20, 1),
    (v_po_id,(SELECT pid FROM _prods WHERE sku='SAM-SSD-500G'),'Samsung 870 EVO 500GB SSD',   20, 3800, 18,  89680, 20, 2),
    (v_po_id,(SELECT pid FROM _prods WHERE sku='SAM-27LS'),    'Samsung 27" Monitor',           8, 9500, 18,  89776,  8, 3),
    (v_po_id,(SELECT pid FROM _prods WHERE sku='SAM-T7-1TB'),  'Samsung T7 Portable SSD 1TB',  8, 6000, 18,  56736,  8, 4);
  INSERT INTO po_receipts (organization_id, purchase_order_id, receipt_date, notes, created_by)
  VALUES (v_org_id, v_po_id, '2026-02-15', 'Samsung products received. Monitors inspected for dead pixels.', v_uid)
  RETURNING id INTO v_rec_id;
  INSERT INTO po_receipt_items (receipt_id, po_item_id, product_id, location_id, quantity)
  SELECT v_rec_id, poi.id, poi.product_id, v_loc_id, poi.quantity FROM purchase_order_items poi WHERE poi.purchase_order_id = v_po_id;
  INSERT INTO stock_movements (organization_id, product_id, location_id, movement_type, quantity, reference_no, vendor_id, notes)
  SELECT v_org_id, poi.product_id, v_loc_id, 'receipt', poi.quantity, 'PO-00006', v_vid, 'GRN against PO-00006'
  FROM purchase_order_items poi WHERE poi.purchase_order_id = v_po_id;

  -- PO-7 | Feb 15 2026 | Tech Distribution India | received
  SELECT vid INTO v_vid FROM _vends WHERE vkey = 'Tech Distribution India Pvt Ltd';
  INSERT INTO purchase_orders (organization_id, vendor_id, po_date, expected_date, status, subtotal, tax_amount, total_amount, notes, created_by)
  VALUES (v_org_id, v_vid, '2026-02-15', '2026-02-22', 'received', 186500, 33570, 220070, 'Accessories and peripherals Feb 2026', v_uid)
  RETURNING id INTO v_po_id;
  INSERT INTO purchase_order_items (purchase_order_id, product_id, description, quantity, unit_cost, tax_rate, line_total, received_qty, sort_order)
  VALUES
    (v_po_id,(SELECT pid FROM _prods WHERE sku='LOG-MK215'),   'Logitech MK215 Combo',       30,  850, 18, 30090, 30, 1),
    (v_po_id,(SELECT pid FROM _prods WHERE sku='LOG-M171'),    'Logitech M171 Mouse',         35,  500, 18, 20650, 35, 2),
    (v_po_id,(SELECT pid FROM _prods WHERE sku='HP-KBDSLIM'),  'HP Business Slim Keyboard',   25,  400, 18, 11800, 25, 3),
    (v_po_id,(SELECT pid FROM _prods WHERE sku='LOG-C505-WEB'),'Logitech C505 Webcam',        15, 1600, 18, 28320, 15, 4),
    (v_po_id,(SELECT pid FROM _prods WHERE sku='LOG-MXKEYS'),  'Logitech MX Keys S',           8, 6800, 18, 64256,  8, 5);
  INSERT INTO po_receipts (organization_id, purchase_order_id, receipt_date, notes, created_by)
  VALUES (v_org_id, v_po_id, '2026-02-22', 'Accessories received. Counted and shelved.', v_uid)
  RETURNING id INTO v_rec_id;
  INSERT INTO po_receipt_items (receipt_id, po_item_id, product_id, location_id, quantity)
  SELECT v_rec_id, poi.id, poi.product_id, v_loc_id, poi.quantity FROM purchase_order_items poi WHERE poi.purchase_order_id = v_po_id;
  INSERT INTO stock_movements (organization_id, product_id, location_id, movement_type, quantity, reference_no, vendor_id, notes)
  SELECT v_org_id, poi.product_id, v_loc_id, 'receipt', poi.quantity, 'PO-00007', v_vid, 'GRN against PO-00007'
  FROM purchase_order_items poi WHERE poi.purchase_order_id = v_po_id;

  -- PO-8 | Feb 20 2026 | Schneider APC | received
  SELECT vid INTO v_vid FROM _vends WHERE vkey = 'Schneider APC Authorized';
  INSERT INTO purchase_orders (organization_id, vendor_id, po_date, expected_date, status, subtotal, tax_amount, total_amount, notes, created_by)
  VALUES (v_org_id, v_vid, '2026-02-20', '2026-02-27', 'received', 261000, 46980, 307980, 'APC UPS Q1 stock', v_uid)
  RETURNING id INTO v_po_id;
  INSERT INTO purchase_order_items (purchase_order_id, product_id, description, quantity, unit_cost, tax_rate, line_total, received_qty, sort_order)
  VALUES
    (v_po_id,(SELECT pid FROM _prods WHERE sku='APC-BX1100C'),  'APC Back-UPS 1100VA',   15, 5500, 18, 97350, 15, 1),
    (v_po_id,(SELECT pid FROM _prods WHERE sku='APC-SMT1500I'), 'APC Smart-UPS 1500VA',   5,17500, 18,103425,  5, 2),
    (v_po_id,(SELECT pid FROM _prods WHERE sku='APC-BX600C'),   'APC Back-UPS 600VA',    20, 2600, 18, 61360, 20, 3);
  INSERT INTO po_receipts (organization_id, purchase_order_id, receipt_date, notes, created_by)
  VALUES (v_org_id, v_po_id, '2026-02-27', 'UPS units received. Battery checked on Smart-UPS units.', v_uid)
  RETURNING id INTO v_rec_id;
  INSERT INTO po_receipt_items (receipt_id, po_item_id, product_id, location_id, quantity)
  SELECT v_rec_id, poi.id, poi.product_id, v_loc_id, poi.quantity FROM purchase_order_items poi WHERE poi.purchase_order_id = v_po_id;
  INSERT INTO stock_movements (organization_id, product_id, location_id, movement_type, quantity, reference_no, vendor_id, notes)
  SELECT v_org_id, poi.product_id, v_loc_id, 'receipt', poi.quantity, 'PO-00008', v_vid, 'GRN against PO-00008'
  FROM purchase_order_items poi WHERE poi.purchase_order_id = v_po_id;

  -- PO-9 | Mar 5 2026 | Cisco Systems India | received
  SELECT vid INTO v_vid FROM _vends WHERE vkey = 'Cisco Systems India (Dist)';
  INSERT INTO purchase_orders (organization_id, vendor_id, po_date, expected_date, status, subtotal, tax_amount, total_amount, notes, created_by)
  VALUES (v_org_id, v_vid, '2026-03-05', '2026-03-15', 'received', 334000, 60120, 394120, 'Cisco networking for enterprise projects', v_uid)
  RETURNING id INTO v_po_id;
  INSERT INTO purchase_order_items (purchase_order_id, product_id, description, quantity, unit_cost, tax_rate, line_total, received_qty, sort_order)
  VALUES
    (v_po_id,(SELECT pid FROM _prods WHERE sku='CISCO-SG350-28'),'Cisco SG350-28 Switch',   5, 33000, 18, 194700,  5, 1),
    (v_po_id,(SELECT pid FROM _prods WHERE sku='CISCO-SF350-24'),'Cisco SF350-24 Switch',   5, 22000, 18, 129800,  5, 2),
    (v_po_id,(SELECT pid FROM _prods WHERE sku='CISCO-RV340'),   'Cisco RV340 Router',      3, 18000, 18,  63594,  3, 3);
  INSERT INTO po_receipts (organization_id, purchase_order_id, receipt_date, notes, created_by)
  VALUES (v_org_id, v_po_id, '2026-03-15', 'Cisco equipment received. Verified serial numbers with warranty portal.', v_uid)
  RETURNING id INTO v_rec_id;
  INSERT INTO po_receipt_items (receipt_id, po_item_id, product_id, location_id, quantity)
  SELECT v_rec_id, poi.id, poi.product_id, v_loc_id, poi.quantity FROM purchase_order_items poi WHERE poi.purchase_order_id = v_po_id;
  INSERT INTO stock_movements (organization_id, product_id, location_id, movement_type, quantity, reference_no, vendor_id, notes)
  SELECT v_org_id, poi.product_id, v_loc_id, 'receipt', poi.quantity, 'PO-00009', v_vid, 'GRN against PO-00009'
  FROM purchase_order_items poi WHERE poi.purchase_order_id = v_po_id;

  -- PO-10 | Mar 12 2026 | Redington India | received
  SELECT vid INTO v_vid FROM _vends WHERE vkey = 'Redington India Ltd';
  INSERT INTO purchase_orders (organization_id, vendor_id, po_date, expected_date, status, subtotal, tax_amount, total_amount, notes, created_by)
  VALUES (v_org_id, v_vid, '2026-03-12', '2026-03-20', 'received', 412000, 74160, 486160, 'Mixed laptop and monitor order Mar 2026', v_uid)
  RETURNING id INTO v_po_id;
  INSERT INTO purchase_order_items (purchase_order_id, product_id, description, quantity, unit_cost, tax_rate, line_total, received_qty, sort_order)
  VALUES
    (v_po_id,(SELECT pid FROM _prods WHERE sku='ASUS-EXB1-I5'), 'Asus ExpertBook B1',      8, 40000, 18, 377920,  8, 1),
    (v_po_id,(SELECT pid FROM _prods WHERE sku='DELL-SE2422H'), 'Dell SE2422H Monitor',    10,  6200, 18,  73180, 10, 2),
    (v_po_id,(SELECT pid FROM _prods WHERE sku='DELL-P2722H'),  'Dell P2722H 27" Monitor',  5, 16000, 18,  94400,  5, 3);
  INSERT INTO po_receipts (organization_id, purchase_order_id, receipt_date, notes, created_by)
  VALUES (v_org_id, v_po_id, '2026-03-20', 'Asus laptops and Dell monitors received. All OK.', v_uid)
  RETURNING id INTO v_rec_id;
  INSERT INTO po_receipt_items (receipt_id, po_item_id, product_id, location_id, quantity)
  SELECT v_rec_id, poi.id, poi.product_id, v_loc_id, poi.quantity FROM purchase_order_items poi WHERE poi.purchase_order_id = v_po_id;
  INSERT INTO stock_movements (organization_id, product_id, location_id, movement_type, quantity, reference_no, vendor_id, notes)
  SELECT v_org_id, poi.product_id, v_loc_id, 'receipt', poi.quantity, 'PO-00010', v_vid, 'GRN against PO-00010'
  FROM purchase_order_items poi WHERE poi.purchase_order_id = v_po_id;

  -- PO-11 | Mar 22 2026 | Acer India | received
  SELECT vid INTO v_vid FROM _vends WHERE vkey = 'Acer India Pvt Ltd';
  INSERT INTO purchase_orders (organization_id, vendor_id, po_date, expected_date, status, subtotal, tax_amount, total_amount, notes, created_by)
  VALUES (v_org_id, v_vid, '2026-03-22', '2026-03-30', 'received', 473000, 85140, 558140, 'Acer laptops and desktops Mar 2026', v_uid)
  RETURNING id INTO v_po_id;
  INSERT INTO purchase_order_items (purchase_order_id, product_id, description, quantity, unit_cost, tax_rate, line_total, received_qty, sort_order)
  VALUES
    (v_po_id,(SELECT pid FROM _prods WHERE sku='ACR-ASP5-I5'), 'Acer Aspire 5 Laptop',   10, 34000, 18, 401200, 10, 1),
    (v_po_id,(SELECT pid FROM _prods WHERE sku='ACR-TMP2-I5'), 'Acer TravelMate P2',       5, 41000, 18, 241850,  5, 2),
    (v_po_id,(SELECT pid FROM _prods WHERE sku='ACR-VX2660G'), 'Acer Veriton X2660G',      5, 27000, 18, 159570,  5, 3);
  INSERT INTO po_receipts (organization_id, purchase_order_id, receipt_date, notes, created_by)
  VALUES (v_org_id, v_po_id, '2026-03-30', 'Acer units received. BIS compliance verified.', v_uid)
  RETURNING id INTO v_rec_id;
  INSERT INTO po_receipt_items (receipt_id, po_item_id, product_id, location_id, quantity)
  SELECT v_rec_id, poi.id, poi.product_id, v_loc_id, poi.quantity FROM purchase_order_items poi WHERE poi.purchase_order_id = v_po_id;
  INSERT INTO stock_movements (organization_id, product_id, location_id, movement_type, quantity, reference_no, vendor_id, notes)
  SELECT v_org_id, poi.product_id, v_loc_id, 'receipt', poi.quantity, 'PO-00011', v_vid, 'GRN against PO-00011'
  FROM purchase_order_items poi WHERE poi.purchase_order_id = v_po_id;

  -- PO-12 | Apr 2 2026 | HP Enterprise Supplies | received
  SELECT vid INTO v_vid FROM _vends WHERE vkey = 'HP Enterprise Supplies India';
  INSERT INTO purchase_orders (organization_id, vendor_id, po_date, expected_date, status, subtotal, tax_amount, total_amount, notes, created_by)
  VALUES (v_org_id, v_vid, '2026-04-02', '2026-04-10', 'received', 392000, 70560, 462560, 'HP printers and monitors Q2 restocking', v_uid)
  RETURNING id INTO v_po_id;
  INSERT INTO purchase_order_items (purchase_order_id, product_id, description, quantity, unit_cost, tax_rate, line_total, received_qty, sort_order)
  VALUES
    (v_po_id,(SELECT pid FROM _prods WHERE sku='HP-LJP-M404DN'),'HP LaserJet M404dn',       5, 15500, 18,  91525,  5, 1),
    (v_po_id,(SELECT pid FROM _prods WHERE sku='HP-CLJ-M454DN'),'HP Color LJ M454dn',       3, 28000, 18,  99288,  3, 2),
    (v_po_id,(SELECT pid FROM _prods WHERE sku='HP-MON-24MH'),  'HP 24mh Monitor',          10,  7000, 18,  82600, 10, 3),
    (v_po_id,(SELECT pid FROM _prods WHERE sku='HP-WEBCAM-325'),'HP 325 FHD Webcam',        10,  2200, 18,  25960, 10, 4);
  INSERT INTO po_receipts (organization_id, purchase_order_id, receipt_date, notes, created_by)
  VALUES (v_org_id, v_po_id, '2026-04-10', 'HP products received in good condition.', v_uid)
  RETURNING id INTO v_rec_id;
  INSERT INTO po_receipt_items (receipt_id, po_item_id, product_id, location_id, quantity)
  SELECT v_rec_id, poi.id, poi.product_id, v_loc_id, poi.quantity FROM purchase_order_items poi WHERE poi.purchase_order_id = v_po_id;
  INSERT INTO stock_movements (organization_id, product_id, location_id, movement_type, quantity, reference_no, vendor_id, notes)
  SELECT v_org_id, poi.product_id, v_loc_id, 'receipt', poi.quantity, 'PO-00012', v_vid, 'GRN against PO-00012'
  FROM purchase_order_items poi WHERE poi.purchase_order_id = v_po_id;

  -- PO-13 | Apr 10 2026 | Ingram Micro India | partial
  SELECT vid INTO v_vid FROM _vends WHERE vkey = 'Ingram Micro India Pvt Ltd';
  INSERT INTO purchase_orders (organization_id, vendor_id, po_date, expected_date, status, subtotal, tax_amount, total_amount, notes, created_by)
  VALUES (v_org_id, v_vid, '2026-04-10', '2026-04-20', 'partial', 589000, 106020, 695020, 'Ingram mixed laptop order Apr 2026', v_uid)
  RETURNING id INTO v_po_id;
  INSERT INTO purchase_order_items (purchase_order_id, product_id, description, quantity, unit_cost, tax_rate, line_total, received_qty, sort_order)
  VALUES
    (v_po_id,(SELECT pid FROM _prods WHERE sku='HP-PB450G10'),  'HP ProBook 450 G10',     10, 42000, 18, 495900, 10, 1),
    (v_po_id,(SELECT pid FROM _prods WHERE sku='DELL-LAT5440'), 'Dell Latitude 5440',      5, 60000, 18, 354000,  0, 2),
    (v_po_id,(SELECT pid FROM _prods WHERE sku='LEN-TPE14G5'),  'Lenovo ThinkPad E14',     5, 55000, 18, 324500,  5, 3);
  -- Partial GRN (HP ProBook + Lenovo only, Dell pending)
  INSERT INTO po_receipts (organization_id, purchase_order_id, receipt_date, notes, created_by)
  VALUES (v_org_id, v_po_id, '2026-04-20', 'Partial delivery: HP and Lenovo received. Dell units delayed 2 weeks.', v_uid)
  RETURNING id INTO v_rec_id;
  INSERT INTO po_receipt_items (receipt_id, po_item_id, product_id, location_id, quantity)
  SELECT v_rec_id, poi.id, poi.product_id, v_loc_id, poi.received_qty
  FROM purchase_order_items poi WHERE poi.purchase_order_id = v_po_id AND poi.received_qty > 0;
  INSERT INTO stock_movements (organization_id, product_id, location_id, movement_type, quantity, reference_no, vendor_id, notes)
  SELECT v_org_id, poi.product_id, v_loc_id, 'receipt', poi.received_qty, 'PO-00013', v_vid, 'Partial GRN against PO-00013'
  FROM purchase_order_items poi WHERE poi.purchase_order_id = v_po_id AND poi.received_qty > 0;

  -- PO-14 | Apr 18 2026 | TriTech Asus | received
  SELECT vid INTO v_vid FROM _vends WHERE vkey = 'TriTech Asus Authorized';
  INSERT INTO purchase_orders (organization_id, vendor_id, po_date, expected_date, status, subtotal, tax_amount, total_amount, notes, created_by)
  VALUES (v_org_id, v_vid, '2026-04-18', '2026-04-26', 'received', 312000, 56160, 368160, 'Asus laptops Apr 2026 restock', v_uid)
  RETURNING id INTO v_po_id;
  INSERT INTO purchase_order_items (purchase_order_id, product_id, description, quantity, unit_cost, tax_rate, line_total, received_qty, sort_order)
  VALUES
    (v_po_id,(SELECT pid FROM _prods WHERE sku='ASUS-EXB1-I5'), 'Asus ExpertBook B1',   8, 40000, 18, 377920, 8, 1),
    (v_po_id,(SELECT pid FROM _prods WHERE sku='ASUS-VB15-I5'), 'Asus VivoBook 15',     8, 36000, 18, 340128, 8, 2);
  INSERT INTO po_receipts (organization_id, purchase_order_id, receipt_date, notes, created_by)
  VALUES (v_org_id, v_po_id, '2026-04-26', 'Asus units received, all accessories included.', v_uid)
  RETURNING id INTO v_rec_id;
  INSERT INTO po_receipt_items (receipt_id, po_item_id, product_id, location_id, quantity)
  SELECT v_rec_id, poi.id, poi.product_id, v_loc_id, poi.quantity FROM purchase_order_items poi WHERE poi.purchase_order_id = v_po_id;
  INSERT INTO stock_movements (organization_id, product_id, location_id, movement_type, quantity, reference_no, vendor_id, notes)
  SELECT v_org_id, poi.product_id, v_loc_id, 'receipt', poi.quantity, 'PO-00014', v_vid, 'GRN against PO-00014'
  FROM purchase_order_items poi WHERE poi.purchase_order_id = v_po_id;

  -- PO-15 | May 5 2026 | Micro Solutions | received
  SELECT vid INTO v_vid FROM _vends WHERE vkey = 'Micro Solutions Pvt Ltd';
  INSERT INTO purchase_orders (organization_id, vendor_id, po_date, expected_date, status, subtotal, tax_amount, total_amount, notes, created_by)
  VALUES (v_org_id, v_vid, '2026-05-05', '2026-05-12', 'received', 498000, 89640, 587640, 'Mixed purchase May 2026', v_uid)
  RETURNING id INTO v_po_id;
  INSERT INTO purchase_order_items (purchase_order_id, product_id, description, quantity, unit_cost, tax_rate, line_total, received_qty, sort_order)
  VALUES
    (v_po_id,(SELECT pid FROM _prods WHERE sku='DELL-LAT5440'), 'Dell Latitude 5440',     5, 60000, 18, 354000, 5, 1),
    (v_po_id,(SELECT pid FROM _prods WHERE sku='LEN-IPS5-I5'),  'Lenovo IdeaPad Slim 5', 10, 38000, 18, 448400, 10, 2),
    (v_po_id,(SELECT pid FROM _prods WHERE sku='LG-24MK400H'),  'LG 24" Monitor',        10,  5800, 18,  68440, 10, 3);
  INSERT INTO po_receipts (organization_id, purchase_order_id, receipt_date, notes, created_by)
  VALUES (v_org_id, v_po_id, '2026-05-12', 'All items received. LG monitors tested for display quality.', v_uid)
  RETURNING id INTO v_rec_id;
  INSERT INTO po_receipt_items (receipt_id, po_item_id, product_id, location_id, quantity)
  SELECT v_rec_id, poi.id, poi.product_id, v_loc_id, poi.quantity FROM purchase_order_items poi WHERE poi.purchase_order_id = v_po_id;
  INSERT INTO stock_movements (organization_id, product_id, location_id, movement_type, quantity, reference_no, vendor_id, notes)
  SELECT v_org_id, poi.product_id, v_loc_id, 'receipt', poi.quantity, 'PO-00015', v_vid, 'GRN against PO-00015'
  FROM purchase_order_items poi WHERE poi.purchase_order_id = v_po_id;

  -- PO-16 | May 15 2026 | Storage World India | received
  SELECT vid INTO v_vid FROM _vends WHERE vkey = 'Storage World India Pvt Ltd';
  INSERT INTO purchase_orders (organization_id, vendor_id, po_date, expected_date, status, subtotal, tax_amount, total_amount, notes, created_by)
  VALUES (v_org_id, v_vid, '2026-05-15', '2026-05-22', 'received', 195000, 35100, 230100, 'Storage restock May 2026', v_uid)
  RETURNING id INTO v_po_id;
  INSERT INTO purchase_order_items (purchase_order_id, product_id, description, quantity, unit_cost, tax_rate, line_total, received_qty, sort_order)
  VALUES
    (v_po_id,(SELECT pid FROM _prods WHERE sku='SAM-SSD-1TB'), 'Samsung 870 EVO 1TB',  15, 6500, 18, 115050, 15, 1),
    (v_po_id,(SELECT pid FROM _prods WHERE sku='SAM-T7-1TB'),  'Samsung T7 SSD 1TB',   10, 6000, 18,  70800, 10, 2),
    (v_po_id,(SELECT pid FROM _prods WHERE sku='SEA-BAR-1TB'), 'Seagate BarraCuda 1TB',10, 2600, 18,  30680, 10, 3);
  INSERT INTO po_receipts (organization_id, purchase_order_id, receipt_date, notes, created_by)
  VALUES (v_org_id, v_po_id, '2026-05-22', 'Storage devices received. Random DOA check passed.', v_uid)
  RETURNING id INTO v_rec_id;
  INSERT INTO po_receipt_items (receipt_id, po_item_id, product_id, location_id, quantity)
  SELECT v_rec_id, poi.id, poi.product_id, v_loc_id, poi.quantity FROM purchase_order_items poi WHERE poi.purchase_order_id = v_po_id;
  INSERT INTO stock_movements (organization_id, product_id, location_id, movement_type, quantity, reference_no, vendor_id, notes)
  SELECT v_org_id, poi.product_id, v_loc_id, 'receipt', poi.quantity, 'PO-00016', v_vid, 'GRN against PO-00016'
  FROM purchase_order_items poi WHERE poi.purchase_order_id = v_po_id;

  -- PO-17 | May 25 2026 | Canon/Epson via Micro Solutions | received
  SELECT vid INTO v_vid FROM _vends WHERE vkey = 'Micro Solutions Pvt Ltd';
  INSERT INTO purchase_orders (organization_id, vendor_id, po_date, expected_date, status, subtotal, tax_amount, total_amount, notes, created_by)
  VALUES (v_org_id, v_vid, '2026-05-25', '2026-06-02', 'received', 208000, 37440, 245440, 'Printers restock May 2026', v_uid)
  RETURNING id INTO v_po_id;
  INSERT INTO purchase_order_items (purchase_order_id, product_id, description, quantity, unit_cost, tax_rate, line_total, received_qty, sort_order)
  VALUES
    (v_po_id,(SELECT pid FROM _prods WHERE sku='CAN-MF445DW'),'Canon imageCLASS MF445dw', 5, 19500, 18, 115050, 5, 1),
    (v_po_id,(SELECT pid FROM _prods WHERE sku='EPS-L3252'),  'Epson EcoTank L3252',        8,  8200, 18,  77504, 8, 2),
    (v_po_id,(SELECT pid FROM _prods WHERE sku='APC-BX600C'), 'APC Back-UPS 600VA',        10,  2600, 18,  30680,10, 3);
  INSERT INTO po_receipts (organization_id, purchase_order_id, receipt_date, notes, created_by)
  VALUES (v_org_id, v_po_id, '2026-06-02', 'Printers and UPS received. Print test OK.', v_uid)
  RETURNING id INTO v_rec_id;
  INSERT INTO po_receipt_items (receipt_id, po_item_id, product_id, location_id, quantity)
  SELECT v_rec_id, poi.id, poi.product_id, v_loc_id, poi.quantity FROM purchase_order_items poi WHERE poi.purchase_order_id = v_po_id;
  INSERT INTO stock_movements (organization_id, product_id, location_id, movement_type, quantity, reference_no, vendor_id, notes)
  SELECT v_org_id, poi.product_id, v_loc_id, 'receipt', poi.quantity, 'PO-00017', v_vid, 'GRN against PO-00017'
  FROM purchase_order_items poi WHERE poi.purchase_order_id = v_po_id;

  -- PO-18 | Jun 1 2026 | Ingram Micro | partial (in progress)
  SELECT vid INTO v_vid FROM _vends WHERE vkey = 'Ingram Micro India Pvt Ltd';
  INSERT INTO purchase_orders (organization_id, vendor_id, po_date, expected_date, status, subtotal, tax_amount, total_amount, notes, created_by)
  VALUES (v_org_id, v_vid, '2026-06-01', '2026-06-12', 'partial', 648000, 116640, 764640, 'Q2 laptop restocking June 2026', v_uid)
  RETURNING id INTO v_po_id;
  INSERT INTO purchase_order_items (purchase_order_id, product_id, description, quantity, unit_cost, tax_rate, line_total, received_qty, sort_order)
  VALUES
    (v_po_id,(SELECT pid FROM _prods WHERE sku='HP-PB450G10'),  'HP ProBook 450 G10',   10, 42000, 18, 495900, 5, 1),
    (v_po_id,(SELECT pid FROM _prods WHERE sku='HP-EB840G10'),  'HP EliteBook 840 G10',  5, 68000, 18, 401200, 5, 2),
    (v_po_id,(SELECT pid FROM _prods WHERE sku='DELL-VOS3520'), 'Dell Vostro 3520',      10, 28500, 18, 336300, 0, 3);
  -- Partial receipt so far
  INSERT INTO po_receipts (organization_id, purchase_order_id, receipt_date, notes, created_by)
  VALUES (v_org_id, v_po_id, '2026-06-08', 'Partial - HP units received. Dell and remaining HP pending.', v_uid)
  RETURNING id INTO v_rec_id;
  INSERT INTO po_receipt_items (receipt_id, po_item_id, product_id, location_id, quantity)
  SELECT v_rec_id, poi.id, poi.product_id, v_loc_id, poi.received_qty
  FROM purchase_order_items poi WHERE poi.purchase_order_id = v_po_id AND poi.received_qty > 0;
  INSERT INTO stock_movements (organization_id, product_id, location_id, movement_type, quantity, reference_no, vendor_id, notes)
  SELECT v_org_id, poi.product_id, v_loc_id, 'receipt', poi.received_qty, 'PO-00018', v_vid, 'Partial GRN against PO-00018'
  FROM purchase_order_items poi WHERE poi.purchase_order_id = v_po_id AND poi.received_qty > 0;

  -- PO-19 | Jun 5 2026 | Network World India | sent (pending delivery)
  SELECT vid INTO v_vid FROM _vends WHERE vkey = 'Network World India Pvt Ltd';
  INSERT INTO purchase_orders (organization_id, vendor_id, po_date, expected_date, status, subtotal, tax_amount, total_amount, notes, created_by)
  VALUES (v_org_id, v_vid, '2026-06-05', '2026-06-18', 'sent', 275000, 49500, 324500, 'Networking equipment June 2026 order', v_uid)
  RETURNING id INTO v_po_id;
  INSERT INTO purchase_order_items (purchase_order_id, product_id, description, quantity, unit_cost, tax_rate, line_total, received_qty, sort_order)
  VALUES
    (v_po_id,(SELECT pid FROM _prods WHERE sku='CISCO-SG350-28'),'Cisco SG350-28 Switch',  3, 33000, 18, 116874, 0, 1),
    (v_po_id,(SELECT pid FROM _prods WHERE sku='TPL-DECO-M9'),   'TP-Link Deco M9 Plus',   5,  9500, 18,  56050, 0, 2),
    (v_po_id,(SELECT pid FROM _prods WHERE sku='TPL-EAP225'),    'TP-Link EAP225 AP',      10,  2600, 18,  30680, 0, 3);

  -- PO-20 | Jun 10 2026 | Schneider APC | draft
  SELECT vid INTO v_vid FROM _vends WHERE vkey = 'Schneider APC Authorized';
  INSERT INTO purchase_orders (organization_id, vendor_id, po_date, expected_date, status, subtotal, tax_amount, total_amount, notes, created_by)
  VALUES (v_org_id, v_vid, '2026-06-10', '2026-06-25', 'draft', 182000, 32760, 214760, 'APC UPS Q2 replenishment order', v_uid)
  RETURNING id INTO v_po_id;
  INSERT INTO purchase_order_items (purchase_order_id, product_id, description, quantity, unit_cost, tax_rate, line_total, received_qty, sort_order)
  VALUES
    (v_po_id,(SELECT pid FROM _prods WHERE sku='APC-BX1100C'),  'APC Back-UPS 1100VA', 10, 5500, 18,  64900, 0, 1),
    (v_po_id,(SELECT pid FROM _prods WHERE sku='APC-SMT1500I'), 'APC Smart-UPS 1500VA', 5,17500, 18, 103425, 0, 2),
    (v_po_id,(SELECT pid FROM _prods WHERE sku='APC-BX600C'),   'APC Back-UPS 600VA',  15, 2600, 18,  46035, 0, 3);

END;
$$;

-- ============================================================
-- BLOCK 2: QUOTATIONS (30)
-- ============================================================
DO $$
DECLARE
  v_org_id UUID; v_uid UUID; v_quot_id UUID; v_cid UUID;
BEGIN
  SELECT p.organization_id, p.id INTO v_org_id, v_uid
  FROM profiles p WHERE p.email = 'khushalrajput1978@gmail.com' LIMIT 1;

  CREATE TEMP TABLE IF NOT EXISTS _qids (q INT PRIMARY KEY, qid UUID);

  -- QT-01 Jan 10 accepted → becomes INV-01
  SELECT cid INTO v_cid FROM _custs WHERE ckey='ABC Technologies Pvt Ltd';
  INSERT INTO quotations (organization_id,customer_id,quotation_date,valid_until,status,subtotal,tax_amount,total_amount,notes,created_by)
  VALUES (v_org_id,v_cid,'2026-01-10','2026-01-25','accepted',373200,67176,440376,'Q1 laptop procurement - IT refresh project',v_uid)
  RETURNING id INTO v_quot_id; INSERT INTO _qids VALUES(1,v_quot_id);
  INSERT INTO quotation_items(quotation_id,product_id,description,quantity,unit_price,tax_rate,line_total,sort_order) VALUES
    (v_quot_id,(SELECT pid FROM _prods WHERE sku='HP-PB450G10'),'HP ProBook 450 G10 Core i5',3,50900,18,152700,1),
    (v_quot_id,(SELECT pid FROM _prods WHERE sku='DELL-LAT5440'),'Dell Latitude 5440 Core i5',3,73500,18,220500,2);

  -- QT-02 Jan 12 accepted → INV-02
  SELECT cid INTO v_cid FROM _custs WHERE ckey='Global Education Trust';
  INSERT INTO quotations (organization_id,customer_id,quotation_date,valid_until,status,subtotal,tax_amount,total_amount,notes,created_by)
  VALUES (v_org_id,v_cid,'2026-01-12','2026-01-28','accepted',342400,61632,404032,'School computer lab setup - 8 PCs + monitors',v_uid)
  RETURNING id INTO v_quot_id; INSERT INTO _qids VALUES(2,v_quot_id);
  INSERT INTO quotation_items(quotation_id,product_id,description,quantity,unit_price,tax_rate,line_total,sort_order) VALUES
    (v_quot_id,(SELECT pid FROM _prods WHERE sku='DELL-VOS3520'),'Dell Vostro 3520 Core i3',8,34900,18,279200,1),
    (v_quot_id,(SELECT pid FROM _prods WHERE sku='DELL-SE2422H'),'Dell SE2422H 24" Monitor',8,7900,18,63200,2);

  -- QT-03 Jan 15 rejected
  SELECT cid INTO v_cid FROM _custs WHERE ckey='Smart Manufacturing Ltd';
  INSERT INTO quotations (organization_id,customer_id,quotation_date,valid_until,status,subtotal,tax_amount,total_amount,notes,created_by)
  VALUES (v_org_id,v_cid,'2026-01-15','2026-01-30','rejected',129000,23220,152220,'Factory network upgrade - Cisco switches',v_uid)
  RETURNING id INTO v_quot_id; INSERT INTO _qids VALUES(3,v_quot_id);
  INSERT INTO quotation_items(quotation_id,product_id,description,quantity,unit_price,tax_rate,line_total,sort_order) VALUES
    (v_quot_id,(SELECT pid FROM _prods WHERE sku='CISCO-SG350-28'),'Cisco SG350-28 Managed Switch',2,41500,18,83000,1),
    (v_quot_id,(SELECT pid FROM _prods WHERE sku='CISCO-RV340'),'Cisco RV340 Dual WAN Router',2,23000,18,46000,2);

  -- QT-04 Jan 20 sent
  SELECT cid INTO v_cid FROM _custs WHERE ckey='Silver Oak Hospitals Ltd';
  INSERT INTO quotations (organization_id,customer_id,quotation_date,valid_until,status,subtotal,tax_amount,total_amount,notes,created_by)
  VALUES (v_org_id,v_cid,'2026-01-20','2026-02-05','sent',123600,22248,145848,'UPS for hospital data centre and nursing stations',v_uid)
  RETURNING id INTO v_quot_id; INSERT INTO _qids VALUES(4,v_quot_id);
  INSERT INTO quotation_items(quotation_id,product_id,description,quantity,unit_price,tax_rate,line_total,sort_order) VALUES
    (v_quot_id,(SELECT pid FROM _prods WHERE sku='APC-SMT1500I'),'APC Smart-UPS 1500VA',3,22000,18,66000,1),
    (v_quot_id,(SELECT pid FROM _prods WHERE sku='APC-BX1100C'),'APC Back-UPS 1100VA',8,7200,18,57600,2);

  -- QT-05 Jan 25 sent
  SELECT cid INTO v_cid FROM _custs WHERE ckey='XYZ Systems Pvt Ltd';
  INSERT INTO quotations (organization_id,customer_id,quotation_date,valid_until,status,subtotal,tax_amount,total_amount,notes,created_by)
  VALUES (v_org_id,v_cid,'2026-01-25','2026-02-10','sent',293700,52866,346566,'Developer workstations - Lenovo ThinkPad + IdeaPad',v_uid)
  RETURNING id INTO v_quot_id; INSERT INTO _qids VALUES(5,v_quot_id);
  INSERT INTO quotation_items(quotation_id,product_id,description,quantity,unit_price,tax_rate,line_total,sort_order) VALUES
    (v_quot_id,(SELECT pid FROM _prods WHERE sku='LEN-TPE14G5'),'Lenovo ThinkPad E14 Gen 5',3,66900,18,200700,1),
    (v_quot_id,(SELECT pid FROM _prods WHERE sku='LEN-IPS5-I5'),'Lenovo IdeaPad Slim 5',2,46500,18,93000,2);

  -- QT-06 Feb 5 accepted → INV-07
  SELECT cid INTO v_cid FROM _custs WHERE ckey='ABC Technologies Pvt Ltd';
  INSERT INTO quotations (organization_id,customer_id,quotation_date,valid_until,status,subtotal,tax_amount,total_amount,notes,created_by)
  VALUES (v_org_id,v_cid,'2026-02-05','2026-02-20','accepted',394500,71010,465510,'Premium laptops for senior management refresh',v_uid)
  RETURNING id INTO v_quot_id; INSERT INTO _qids VALUES(6,v_quot_id);
  INSERT INTO quotation_items(quotation_id,product_id,description,quantity,unit_price,tax_rate,line_total,sort_order) VALUES
    (v_quot_id,(SELECT pid FROM _prods WHERE sku='HP-EB840G10'),'HP EliteBook 840 G10 Core i7',3,82500,18,247500,1),
    (v_quot_id,(SELECT pid FROM _prods WHERE sku='DELL-LAT5440'),'Dell Latitude 5440 Core i5',2,73500,18,147000,2);

  -- QT-07 Feb 8 accepted → INV-08
  SELECT cid INTO v_cid FROM _custs WHERE ckey='Bharat BPO Solutions';
  INSERT INTO quotations (organization_id,customer_id,quotation_date,valid_until,status,subtotal,tax_amount,total_amount,notes,created_by)
  VALUES (v_org_id,v_cid,'2026-02-08','2026-02-22','accepted',58800,10584,69384,'BPO workstation accessories bulk order',v_uid)
  RETURNING id INTO v_quot_id; INSERT INTO _qids VALUES(7,v_quot_id);
  INSERT INTO quotation_items(quotation_id,product_id,description,quantity,unit_price,tax_rate,line_total,sort_order) VALUES
    (v_quot_id,(SELECT pid FROM _prods WHERE sku='LOG-MK215'),'Logitech MK215 Wireless Combo',25,1190,18,29750,1),
    (v_quot_id,(SELECT pid FROM _prods WHERE sku='LOG-M171'),'Logitech M171 Wireless Mouse',25,690,18,17250,2),
    (v_quot_id,(SELECT pid FROM _prods WHERE sku='HP-KBDSLIM'),'HP USB Slim Keyboard',20,590,18,11800,3);

  -- QT-08 Feb 12 accepted → INV-09
  SELECT cid INTO v_cid FROM _custs WHERE ckey='MedPlus Healthcare';
  INSERT INTO quotations (organization_id,customer_id,quotation_date,valid_until,status,subtotal,tax_amount,total_amount,notes,created_by)
  VALUES (v_org_id,v_cid,'2026-02-12','2026-02-28','accepted',138000,24840,162840,'UPS for new hospital wing critical care area',v_uid)
  RETURNING id INTO v_quot_id; INSERT INTO _qids VALUES(8,v_quot_id);
  INSERT INTO quotation_items(quotation_id,product_id,description,quantity,unit_price,tax_rate,line_total,sort_order) VALUES
    (v_quot_id,(SELECT pid FROM _prods WHERE sku='APC-SMT1500I'),'APC Smart-UPS 1500VA LCD',3,22000,18,66000,1),
    (v_quot_id,(SELECT pid FROM _prods WHERE sku='APC-BX1100C'),'APC Back-UPS 1100VA',10,7200,18,72000,2);

  -- QT-09 Feb 15 rejected
  SELECT cid INTO v_cid FROM _custs WHERE ckey='Rajasthan Infra Corp';
  INSERT INTO quotations (organization_id,customer_id,quotation_date,valid_until,status,subtotal,tax_amount,total_amount,notes,created_by)
  VALUES (v_org_id,v_cid,'2026-02-15','2026-03-01','rejected',108000,19440,127440,'Networking for Jaipur site office',v_uid)
  RETURNING id INTO v_quot_id; INSERT INTO _qids VALUES(9,v_quot_id);
  INSERT INTO quotation_items(quotation_id,product_id,description,quantity,unit_price,tax_rate,line_total,sort_order) VALUES
    (v_quot_id,(SELECT pid FROM _prods WHERE sku='CISCO-SF350-24'),'Cisco SF350-24 Switch',2,27500,18,55000,1),
    (v_quot_id,(SELECT pid FROM _prods WHERE sku='TPL-DECO-M9'),'TP-Link Deco M9 Plus (3-pack)',2,12500,18,25000,2);

  -- QT-10 Feb 20 accepted → INV-12
  SELECT cid INTO v_cid FROM _custs WHERE ckey='Himalaya Pharma Research';
  INSERT INTO quotations (organization_id,customer_id,quotation_date,valid_until,status,subtotal,tax_amount,total_amount,notes,created_by)
  VALUES (v_org_id,v_cid,'2026-02-20','2026-03-07','accepted',472500,85050,557550,'R&D team high-performance laptops + monitors',v_uid)
  RETURNING id INTO v_quot_id; INSERT INTO _qids VALUES(10,v_quot_id);
  INSERT INTO quotation_items(quotation_id,product_id,description,quantity,unit_price,tax_rate,line_total,sort_order) VALUES
    (v_quot_id,(SELECT pid FROM _prods WHERE sku='HP-EB840G10'),'HP EliteBook 840 G10 Core i7',5,82500,18,412500,1),
    (v_quot_id,(SELECT pid FROM _prods WHERE sku='DELL-P2722H'),'Dell P2722H 27" Professional Monitor',3,20000,18,60000,2);

  -- QT-11 Feb 25 sent
  SELECT cid INTO v_cid FROM _custs WHERE ckey='TechCraft Software Pvt Ltd';
  INSERT INTO quotations (organization_id,customer_id,quotation_date,valid_until,status,subtotal,tax_amount,total_amount,notes,created_by)
  VALUES (v_org_id,v_cid,'2026-02-25','2026-03-12','sent',285700,51426,337126,'Developer laptops + SSD upgrades Q1',v_uid)
  RETURNING id INTO v_quot_id; INSERT INTO _qids VALUES(11,v_quot_id);
  INSERT INTO quotation_items(quotation_id,product_id,description,quantity,unit_price,tax_rate,line_total,sort_order) VALUES
    (v_quot_id,(SELECT pid FROM _prods WHERE sku='LEN-TPE14G5'),'Lenovo ThinkPad E14 Gen 5',3,66900,18,200700,1),
    (v_quot_id,(SELECT pid FROM _prods WHERE sku='SAM-SSD-1TB'),'Samsung 870 EVO 1TB SSD',10,8500,18,85000,2);

  -- QT-12 Mar 5 accepted → INV-14
  SELECT cid INTO v_cid FROM _custs WHERE ckey='Apex Financial Services';
  INSERT INTO quotations (organization_id,customer_id,quotation_date,valid_until,status,subtotal,tax_amount,total_amount,notes,created_by)
  VALUES (v_org_id,v_cid,'2026-03-05','2026-03-20','accepted',220500,39690,260190,'Business laptops for financial advisory team',v_uid)
  RETURNING id INTO v_quot_id; INSERT INTO _qids VALUES(12,v_quot_id);
  INSERT INTO quotation_items(quotation_id,product_id,description,quantity,unit_price,tax_rate,line_total,sort_order) VALUES
    (v_quot_id,(SELECT pid FROM _prods WHERE sku='DELL-LAT5440'),'Dell Latitude 5440 Core i5',3,73500,18,220500,1);

  -- QT-13 Mar 10 accepted → INV-15
  SELECT cid INTO v_cid FROM _custs WHERE ckey='Pioneer Telecom Solutions';
  INSERT INTO quotations (organization_id,customer_id,quotation_date,valid_until,status,subtotal,tax_amount,total_amount,notes,created_by)
  VALUES (v_org_id,v_cid,'2026-03-10','2026-03-25','accepted',100000,18000,118000,'Cisco switch + TP-Link APs for office expansion',v_uid)
  RETURNING id INTO v_quot_id; INSERT INTO _qids VALUES(13,v_quot_id);
  INSERT INTO quotation_items(quotation_id,product_id,description,quantity,unit_price,tax_rate,line_total,sort_order) VALUES
    (v_quot_id,(SELECT pid FROM _prods WHERE sku='CISCO-SG350-28'),'Cisco SG350-28 Managed Switch',2,41500,18,83000,1),
    (v_quot_id,(SELECT pid FROM _prods WHERE sku='TPL-EAP225'),'TP-Link EAP225 Ceiling AP',5,3400,18,17000,2);

  -- QT-14 Mar 15 sent (govt school large tender)
  SELECT cid INTO v_cid FROM _custs WHERE ckey='Delhi Public School Saket';
  INSERT INTO quotations (organization_id,customer_id,quotation_date,valid_until,status,subtotal,tax_amount,total_amount,notes,created_by)
  VALUES (v_org_id,v_cid,'2026-03-15','2026-04-15','sent',454500,81810,536310,'Annual computer lab tender - 10 laptops + 10 monitors',v_uid)
  RETURNING id INTO v_quot_id; INSERT INTO _qids VALUES(14,v_quot_id);
  INSERT INTO quotation_items(quotation_id,product_id,description,quantity,unit_price,tax_rate,line_total,sort_order) VALUES
    (v_quot_id,(SELECT pid FROM _prods WHERE sku='ACR-ASP5-I5'),'Acer Aspire 5 Core i5',10,41500,18,415000,1),
    (v_quot_id,(SELECT pid FROM _prods WHERE sku='DELL-SE2422H'),'Dell SE2422H 24" Monitor',5,7900,18,39500,2);

  -- QT-15 Mar 18 rejected
  SELECT cid INTO v_cid FROM _custs WHERE ckey='GreenLeaf Renewable Energy';
  INSERT INTO quotations (organization_id,customer_id,quotation_date,valid_until,status,subtotal,tax_amount,total_amount,notes,created_by)
  VALUES (v_org_id,v_cid,'2026-03-18','2026-04-02','rejected',329500,59310,388810,'Field engineer rugged laptops + SSD',v_uid)
  RETURNING id INTO v_quot_id; INSERT INTO _qids VALUES(15,v_quot_id);
  INSERT INTO quotation_items(quotation_id,product_id,description,quantity,unit_price,tax_rate,line_total,sort_order) VALUES
    (v_quot_id,(SELECT pid FROM _prods WHERE sku='ASUS-EXB1-I5'),'Asus ExpertBook B1 Core i5',5,48900,18,244500,1),
    (v_quot_id,(SELECT pid FROM _prods WHERE sku='SAM-SSD-1TB'),'Samsung 870 EVO 1TB SSD',10,8500,18,85000,2);

  -- QT-16 Mar 22 accepted → INV-17
  SELECT cid INTO v_cid FROM _custs WHERE ckey='IndusFirst Cooperative Bank';
  INSERT INTO quotations (organization_id,customer_id,quotation_date,valid_until,status,subtotal,tax_amount,total_amount,notes,created_by)
  VALUES (v_org_id,v_cid,'2026-03-22','2026-04-06','accepted',101600,18288,119888,'UPS for bank branch server room',v_uid)
  RETURNING id INTO v_quot_id; INSERT INTO _qids VALUES(16,v_quot_id);
  INSERT INTO quotation_items(quotation_id,product_id,description,quantity,unit_price,tax_rate,line_total,sort_order) VALUES
    (v_quot_id,(SELECT pid FROM _prods WHERE sku='APC-BX1100C'),'APC Back-UPS 1100VA',8,7200,18,57600,1),
    (v_quot_id,(SELECT pid FROM _prods WHERE sku='APC-SMT1500I'),'APC Smart-UPS 1500VA',2,22000,18,44000,2);

  -- QT-17 Mar 28 sent
  SELECT cid INTO v_cid FROM _custs WHERE ckey='Horizon IT Infrastructure';
  INSERT INTO quotations (organization_id,customer_id,quotation_date,valid_until,status,subtotal,tax_amount,total_amount,notes,created_by)
  VALUES (v_org_id,v_cid,'2026-03-28','2026-04-12','sent',207000,37260,244260,'Data centre switching upgrade - Cisco',v_uid)
  RETURNING id INTO v_quot_id; INSERT INTO _qids VALUES(17,v_quot_id);
  INSERT INTO quotation_items(quotation_id,product_id,description,quantity,unit_price,tax_rate,line_total,sort_order) VALUES
    (v_quot_id,(SELECT pid FROM _prods WHERE sku='CISCO-SG350-28'),'Cisco SG350-28 Managed Switch',2,41500,18,83000,1),
    (v_quot_id,(SELECT pid FROM _prods WHERE sku='CISCO-SF350-24'),'Cisco SF350-24 Switch',2,27500,18,55000,2),
    (v_quot_id,(SELECT pid FROM _prods WHERE sku='CISCO-RV340'),'Cisco RV340 Dual WAN Router',1,23000,18,23000,3);

  -- QT-18 Apr 3 accepted → INV-21
  SELECT cid INTO v_cid FROM _custs WHERE ckey='ABC Technologies Pvt Ltd';
  INSERT INTO quotations (organization_id,customer_id,quotation_date,valid_until,status,subtotal,tax_amount,total_amount,notes,created_by)
  VALUES (v_org_id,v_cid,'2026-04-03','2026-04-18','accepted',208500,37530,246030,'Q2 HP laptops + webcam kit for hybrid work',v_uid)
  RETURNING id INTO v_quot_id; INSERT INTO _qids VALUES(18,v_quot_id);
  INSERT INTO quotation_items(quotation_id,product_id,description,quantity,unit_price,tax_rate,line_total,sort_order) VALUES
    (v_quot_id,(SELECT pid FROM _prods WHERE sku='HP-PB450G10'),'HP ProBook 450 G10',3,50900,18,152700,1),
    (v_quot_id,(SELECT pid FROM _prods WHERE sku='HP-MON-24MH'),'HP 24mh FHD Monitor',3,8900,18,26700,2),
    (v_quot_id,(SELECT pid FROM _prods WHERE sku='HP-WEBCAM-325'),'HP 325 FHD Webcam',3,2990,18,8970,3);

  -- QT-19 Apr 8 accepted → INV-22 (large corporate order)
  SELECT cid INTO v_cid FROM _custs WHERE ckey='Smart Manufacturing Ltd';
  INSERT INTO quotations (organization_id,customer_id,quotation_date,valid_until,status,subtotal,tax_amount,total_amount,notes,created_by)
  VALUES (v_org_id,v_cid,'2026-04-08','2026-04-23','accepted',567000,102060,669060,'Factory office IT refresh - 5 ThinkPads + 5 IdeaPads',v_uid)
  RETURNING id INTO v_quot_id; INSERT INTO _qids VALUES(19,v_quot_id);
  INSERT INTO quotation_items(quotation_id,product_id,description,quantity,unit_price,tax_rate,line_total,sort_order) VALUES
    (v_quot_id,(SELECT pid FROM _prods WHERE sku='LEN-TPE14G5'),'Lenovo ThinkPad E14 Gen 5 Core i5',5,66900,18,334500,1),
    (v_quot_id,(SELECT pid FROM _prods WHERE sku='LEN-IPS5-I5'),'Lenovo IdeaPad Slim 5 Core i5',5,46500,18,232500,2);

  -- QT-20 Apr 12 accepted → INV-23
  SELECT cid INTO v_cid FROM _custs WHERE ckey='XYZ Systems Pvt Ltd';
  INSERT INTO quotations (organization_id,customer_id,quotation_date,valid_until,status,subtotal,tax_amount,total_amount,notes,created_by)
  VALUES (v_org_id,v_cid,'2026-04-12','2026-04-27','accepted',192700,34686,227386,'Laptops + monitors for new office branch',v_uid)
  RETURNING id INTO v_quot_id; INSERT INTO _qids VALUES(20,v_quot_id);
  INSERT INTO quotation_items(quotation_id,product_id,description,quantity,unit_price,tax_rate,line_total,sort_order) VALUES
    (v_quot_id,(SELECT pid FROM _prods WHERE sku='HP-PB450G10'),'HP ProBook 450 G10',2,50900,18,101800,1),
    (v_quot_id,(SELECT pid FROM _prods WHERE sku='DELL-SE2422H'),'Dell SE2422H 24" Monitor',3,7900,18,23700,2);

  -- QT-21 Apr 18 draft (Saraswati Educational Trust large pending)
  SELECT cid INTO v_cid FROM _custs WHERE ckey='Saraswati Educational Trust';
  INSERT INTO quotations (organization_id,customer_id,quotation_date,valid_until,status,subtotal,tax_amount,total_amount,notes,created_by)
  VALUES (v_org_id,v_cid,'2026-04-18','2026-05-18','draft',628000,113040,741040,'Annual budget procurement - 18 PCs + monitors',v_uid)
  RETURNING id INTO v_quot_id; INSERT INTO _qids VALUES(21,v_quot_id);
  INSERT INTO quotation_items(quotation_id,product_id,description,quantity,unit_price,tax_rate,line_total,sort_order) VALUES
    (v_quot_id,(SELECT pid FROM _prods WHERE sku='DELL-VOS3520'),'Dell Vostro 3520',10,34900,18,349000,1),
    (v_quot_id,(SELECT pid FROM _prods WHERE sku='DELL-SE2422H'),'Dell SE2422H 24" Monitor',10,7900,18,79000,2),
    (v_quot_id,(SELECT pid FROM _prods WHERE sku='LOG-MK215'),'Logitech MK215 Wireless Combo',10,1190,18,11900,3);

  -- QT-22 Apr 22 rejected
  SELECT cid INTO v_cid FROM _custs WHERE ckey='Eastern Logistics Ltd';
  INSERT INTO quotations (organization_id,customer_id,quotation_date,valid_until,status,subtotal,tax_amount,total_amount,notes,created_by)
  VALUES (v_org_id,v_cid,'2026-04-22','2026-05-07','rejected',391200,70416,461616,'Field ops rugged laptops - Asus ExpertBook x8',v_uid)
  RETURNING id INTO v_quot_id; INSERT INTO _qids VALUES(22,v_quot_id);
  INSERT INTO quotation_items(quotation_id,product_id,description,quantity,unit_price,tax_rate,line_total,sort_order) VALUES
    (v_quot_id,(SELECT pid FROM _prods WHERE sku='ASUS-EXB1-I5'),'Asus ExpertBook B1 Core i5',8,48900,18,391200,1);

  -- QT-23 Apr 28 sent (Urban Dev Authority - large govt tender)
  SELECT cid INTO v_cid FROM _custs WHERE ckey='Urban Development Authority';
  INSERT INTO quotations (organization_id,customer_id,quotation_date,valid_until,status,subtotal,tax_amount,total_amount,notes,created_by)
  VALUES (v_org_id,v_cid,'2026-04-28','2026-05-28','sent',667500,120150,787650,'GeM tender - 10 laptops + 5 desktops for municipal offices',v_uid)
  RETURNING id INTO v_quot_id; INSERT INTO _qids VALUES(23,v_quot_id);
  INSERT INTO quotation_items(quotation_id,product_id,description,quantity,unit_price,tax_rate,line_total,sort_order) VALUES
    (v_quot_id,(SELECT pid FROM _prods WHERE sku='ACR-TMP2-I5'),'Acer TravelMate P2 Core i5',10,50000,18,500000,1),
    (v_quot_id,(SELECT pid FROM _prods WHERE sku='ACR-VX2660G'),'Acer Veriton X2660G Desktop',5,33500,18,167500,2);

  -- QT-24 May 5 accepted → INV-29
  SELECT cid INTO v_cid FROM _custs WHERE ckey='MedPlus Healthcare';
  INSERT INTO quotations (organization_id,customer_id,quotation_date,valid_until,status,subtotal,tax_amount,total_amount,notes,created_by)
  VALUES (v_org_id,v_cid,'2026-05-05','2026-05-20','accepted',137800,24804,162604,'Laptops for pharmacy ops team + UPS',v_uid)
  RETURNING id INTO v_quot_id; INSERT INTO _qids VALUES(24,v_quot_id);
  INSERT INTO quotation_items(quotation_id,product_id,description,quantity,unit_price,tax_rate,line_total,sort_order) VALUES
    (v_quot_id,(SELECT pid FROM _prods WHERE sku='HP-PB450G10'),'HP ProBook 450 G10',2,50900,18,101800,1),
    (v_quot_id,(SELECT pid FROM _prods WHERE sku='APC-BX1100C'),'APC Back-UPS 1100VA',5,7200,18,36000,2);

  -- QT-25 May 10 accepted → INV-27 (Neon Advertising)
  SELECT cid INTO v_cid FROM _custs WHERE ckey='Neon Advertising Agency';
  INSERT INTO quotations (organization_id,customer_id,quotation_date,valid_until,status,subtotal,tax_amount,total_amount,notes,created_by)
  VALUES (v_org_id,v_cid,'2026-05-10','2026-05-25','accepted',258000,46440,304440,'Creative director laptops - premium range',v_uid)
  RETURNING id INTO v_quot_id; INSERT INTO _qids VALUES(25,v_quot_id);
  INSERT INTO quotation_items(quotation_id,product_id,description,quantity,unit_price,tax_rate,line_total,sort_order) VALUES
    (v_quot_id,(SELECT pid FROM _prods WHERE sku='HP-EB840G10'),'HP EliteBook 840 G10 Core i7',2,82500,18,165000,1),
    (v_quot_id,(SELECT pid FROM _prods WHERE sku='LEN-IPS5-I5'),'Lenovo IdeaPad Slim 5',2,46500,18,93000,2);

  -- QT-26 May 15 accepted → INV-31
  SELECT cid INTO v_cid FROM _custs WHERE ckey='Krishna AutoMobile Ltd';
  INSERT INTO quotations (organization_id,customer_id,quotation_date,valid_until,status,subtotal,tax_amount,total_amount,notes,created_by)
  VALUES (v_org_id,v_cid,'2026-05-15','2026-05-30','accepted',484000,87120,571120,'Showroom IT setup - desktops + monitors',v_uid)
  RETURNING id INTO v_quot_id; INSERT INTO _qids VALUES(26,v_quot_id);
  INSERT INTO quotation_items(quotation_id,product_id,description,quantity,unit_price,tax_rate,line_total,sort_order) VALUES
    (v_quot_id,(SELECT pid FROM _prods WHERE sku='HP-PD400G9'),'HP ProDesk 400 G9 SFF',10,39500,18,395000,1),
    (v_quot_id,(SELECT pid FROM _prods WHERE sku='HP-MON-24MH'),'HP 24mh FHD Monitor',10,8900,18,89000,2);

  -- QT-27 May 22 sent (Punjab National Infra)
  SELECT cid INTO v_cid FROM _custs WHERE ckey='Punjab National Infra Ltd';
  INSERT INTO quotations (organization_id,customer_id,quotation_date,valid_until,status,subtotal,tax_amount,total_amount,notes,created_by)
  VALUES (v_org_id,v_cid,'2026-05-22','2026-06-22','sent',345000,62100,407100,'Data centre switch upgrade - Cisco managed switches',v_uid)
  RETURNING id INTO v_quot_id; INSERT INTO _qids VALUES(27,v_quot_id);
  INSERT INTO quotation_items(quotation_id,product_id,description,quantity,unit_price,tax_rate,line_total,sort_order) VALUES
    (v_quot_id,(SELECT pid FROM _prods WHERE sku='CISCO-SG350-28'),'Cisco SG350-28 Managed Switch',5,41500,18,207500,1),
    (v_quot_id,(SELECT pid FROM _prods WHERE sku='CISCO-SF350-24'),'Cisco SF350-24 Switch',5,27500,18,137500,2);

  -- QT-28 May 28 draft (National Academy large)
  SELECT cid INTO v_cid FROM _custs WHERE ckey='National Academy of Sciences';
  INSERT INTO quotations (organization_id,customer_id,quotation_date,valid_until,status,subtotal,tax_amount,total_amount,notes,created_by)
  VALUES (v_org_id,v_cid,'2026-05-28','2026-06-28','draft',1003500,180630,1184130,'Research lab laptops + storage - GeM portal order',v_uid)
  RETURNING id INTO v_quot_id; INSERT INTO _qids VALUES(28,v_quot_id);
  INSERT INTO quotation_items(quotation_id,product_id,description,quantity,unit_price,tax_rate,line_total,sort_order) VALUES
    (v_quot_id,(SELECT pid FROM _prods WHERE sku='LEN-TPE14G5'),'Lenovo ThinkPad E14 Gen 5',15,66900,18,1003500,1);

  -- QT-29 Jun 3 draft (Horizon IT big Cisco order)
  SELECT cid INTO v_cid FROM _custs WHERE ckey='Horizon IT Infrastructure';
  INSERT INTO quotations (organization_id,customer_id,quotation_date,valid_until,status,subtotal,tax_amount,total_amount,notes,created_by)
  VALUES (v_org_id,v_cid,'2026-06-03','2026-07-03','draft',610000,109800,719800,'Enterprise network refresh - Cisco + HP laptops',v_uid)
  RETURNING id INTO v_quot_id; INSERT INTO _qids VALUES(29,v_quot_id);
  INSERT INTO quotation_items(quotation_id,product_id,description,quantity,unit_price,tax_rate,line_total,sort_order) VALUES
    (v_quot_id,(SELECT pid FROM _prods WHERE sku='CISCO-SG350-28'),'Cisco SG350-28 Switch',5,41500,18,207500,1),
    (v_quot_id,(SELECT pid FROM _prods WHERE sku='HP-EB840G10'),'HP EliteBook 840 G10',3,82500,18,247500,2),
    (v_quot_id,(SELECT pid FROM _prods WHERE sku='HP-PB450G10'),'HP ProBook 450 G10',3,50900,18,152700,3);

  -- QT-30 Jun 10 sent (TechCraft Software)
  SELECT cid INTO v_cid FROM _custs WHERE ckey='TechCraft Software Pvt Ltd';
  INSERT INTO quotations (organization_id,customer_id,quotation_date,valid_until,status,subtotal,tax_amount,total_amount,notes,created_by)
  VALUES (v_org_id,v_cid,'2026-06-10','2026-07-10','sent',370700,66726,437426,'Q2 developer laptops + SSD drives',v_uid)
  RETURNING id INTO v_quot_id; INSERT INTO _qids VALUES(30,v_quot_id);
  INSERT INTO quotation_items(quotation_id,product_id,description,quantity,unit_price,tax_rate,line_total,sort_order) VALUES
    (v_quot_id,(SELECT pid FROM _prods WHERE sku='LEN-TPE14G5'),'Lenovo ThinkPad E14 Gen 5',3,66900,18,200700,1),
    (v_quot_id,(SELECT pid FROM _prods WHERE sku='SAM-SSD-1TB'),'Samsung 870 EVO 1TB SSD',20,8500,18,170000,2);

END;
$$;

-- ============================================================
-- BLOCK 3: INVOICES (40) + PAYMENTS
-- ============================================================
DO $$
DECLARE
  v_org_id UUID; v_uid UUID; v_inv_id UUID; v_cid UUID;
BEGIN
  SELECT p.organization_id, p.id INTO v_org_id, v_uid
  FROM profiles p WHERE p.email = 'khushalrajput1978@gmail.com' LIMIT 1;

  CREATE TEMP TABLE IF NOT EXISTS _iids (i INT PRIMARY KEY, iid UUID, itotal NUMERIC);

  -- ── JAN 2026 (6 invoices, all paid) ────────────────────────────────────

  -- INV-01 Jan 18 | ABC Technologies | linked to QT-01
  SELECT cid INTO v_cid FROM _custs WHERE ckey='ABC Technologies Pvt Ltd';
  INSERT INTO invoices (organization_id,customer_id,quotation_id,invoice_date,due_date,status,subtotal,tax_amount,total_amount,amount_paid,notes,created_by)
  VALUES (v_org_id,v_cid,(SELECT qid FROM _qids WHERE q=1),'2026-01-18','2026-02-17','sent',373200,67176,440376,0,'HP ProBook + Dell Latitude for IT refresh',v_uid)
  RETURNING id INTO v_inv_id; INSERT INTO _iids VALUES(1,v_inv_id,440376);
  INSERT INTO invoice_items(invoice_id,product_id,description,quantity,unit_price,tax_rate,line_total,sort_order) VALUES
    (v_inv_id,(SELECT pid FROM _prods WHERE sku='HP-PB450G10'),'HP ProBook 450 G10 Core i5-1335U 8GB 512GB',3,50900,18,152700,1),
    (v_inv_id,(SELECT pid FROM _prods WHERE sku='DELL-LAT5440'),'Dell Latitude 5440 Core i5 16GB 512GB SSD',3,73500,18,220500,2);

  -- INV-02 Jan 20 | Global Education Trust | linked to QT-02
  SELECT cid INTO v_cid FROM _custs WHERE ckey='Global Education Trust';
  INSERT INTO invoices (organization_id,customer_id,quotation_id,invoice_date,due_date,status,subtotal,tax_amount,total_amount,amount_paid,notes,created_by)
  VALUES (v_org_id,v_cid,(SELECT qid FROM _qids WHERE q=2),'2026-01-20','2026-02-19','sent',342400,61632,404032,0,'Computer lab setup - 8 Dell PCs + monitors',v_uid)
  RETURNING id INTO v_inv_id; INSERT INTO _iids VALUES(2,v_inv_id,404032);
  INSERT INTO invoice_items(invoice_id,product_id,description,quantity,unit_price,tax_rate,line_total,sort_order) VALUES
    (v_inv_id,(SELECT pid FROM _prods WHERE sku='DELL-VOS3520'),'Dell Vostro 3520 Core i3-1215U 8GB 256GB',8,34900,18,279200,1),
    (v_inv_id,(SELECT pid FROM _prods WHERE sku='DELL-SE2422H'),'Dell SE2422H 24" FHD Monitor',8,7900,18,63200,2);

  -- INV-03 Jan 22 | Bharat BPO Solutions
  SELECT cid INTO v_cid FROM _custs WHERE ckey='Bharat BPO Solutions';
  INSERT INTO invoices (organization_id,customer_id,invoice_date,due_date,status,subtotal,tax_amount,total_amount,amount_paid,notes,created_by)
  VALUES (v_org_id,v_cid,'2026-01-22','2026-02-21','sent',58800,10584,69384,0,'BPO accessories - keyboards, mice, keyboards',v_uid)
  RETURNING id INTO v_inv_id; INSERT INTO _iids VALUES(3,v_inv_id,69384);
  INSERT INTO invoice_items(invoice_id,product_id,description,quantity,unit_price,tax_rate,line_total,sort_order) VALUES
    (v_inv_id,(SELECT pid FROM _prods WHERE sku='LOG-MK215'),'Logitech MK215 Wireless Keyboard Mouse',25,1190,18,29750,1),
    (v_inv_id,(SELECT pid FROM _prods WHERE sku='LOG-M171'),'Logitech M171 Wireless Mouse',25,690,18,17250,2),
    (v_inv_id,(SELECT pid FROM _prods WHERE sku='HP-KBDSLIM'),'HP USB Business Slim Keyboard',20,590,18,11800,3);

  -- INV-04 Jan 25 | Silver Oak Hospitals
  SELECT cid INTO v_cid FROM _custs WHERE ckey='Silver Oak Hospitals Ltd';
  INSERT INTO invoices (organization_id,customer_id,invoice_date,due_date,status,subtotal,tax_amount,total_amount,amount_paid,notes,created_by)
  VALUES (v_org_id,v_cid,'2026-01-25','2026-02-24','sent',123600,22248,145848,0,'UPS for hospital nursing stations - critical infrastructure',v_uid)
  RETURNING id INTO v_inv_id; INSERT INTO _iids VALUES(4,v_inv_id,145848);
  INSERT INTO invoice_items(invoice_id,product_id,description,quantity,unit_price,tax_rate,line_total,sort_order) VALUES
    (v_inv_id,(SELECT pid FROM _prods WHERE sku='APC-SMT1500I'),'APC Smart-UPS 1500VA LCD 230V',3,22000,18,66000,1),
    (v_inv_id,(SELECT pid FROM _prods WHERE sku='APC-BX1100C'),'APC Back-UPS 1100VA BX1100C-IN',8,7200,18,57600,2);

  -- INV-05 Jan 28 | MedPlus Healthcare
  SELECT cid INTO v_cid FROM _custs WHERE ckey='MedPlus Healthcare';
  INSERT INTO invoices (organization_id,customer_id,invoice_date,due_date,status,subtotal,tax_amount,total_amount,amount_paid,notes,created_by)
  VALUES (v_org_id,v_cid,'2026-01-28','2026-02-27','sent',89000,16020,105020,0,'UPS units for pharmacy billing counters',v_uid)
  RETURNING id INTO v_inv_id; INSERT INTO _iids VALUES(5,v_inv_id,105020);
  INSERT INTO invoice_items(invoice_id,product_id,description,quantity,unit_price,tax_rate,line_total,sort_order) VALUES
    (v_inv_id,(SELECT pid FROM _prods WHERE sku='APC-BX1100C'),'APC Back-UPS 1100VA',10,7200,18,72000,1),
    (v_inv_id,(SELECT pid FROM _prods WHERE sku='APC-BX600C'),'APC Back-UPS 600VA BX600C-IN',5,3400,18,17000,2);

  -- INV-06 Jan 31 | XYZ Systems
  SELECT cid INTO v_cid FROM _custs WHERE ckey='XYZ Systems Pvt Ltd';
  INSERT INTO invoices (organization_id,customer_id,invoice_date,due_date,status,subtotal,tax_amount,total_amount,amount_paid,notes,created_by)
  VALUES (v_org_id,v_cid,'2026-01-31','2026-03-02','sent',293700,52866,346566,0,'Developer laptops Lenovo ThinkPad + IdeaPad',v_uid)
  RETURNING id INTO v_inv_id; INSERT INTO _iids VALUES(6,v_inv_id,346566);
  INSERT INTO invoice_items(invoice_id,product_id,description,quantity,unit_price,tax_rate,line_total,sort_order) VALUES
    (v_inv_id,(SELECT pid FROM _prods WHERE sku='LEN-TPE14G5'),'Lenovo ThinkPad E14 Gen 5 Core i5 16GB',3,66900,18,200700,1),
    (v_inv_id,(SELECT pid FROM _prods WHERE sku='LEN-IPS5-I5'),'Lenovo IdeaPad Slim 5 Core i5 8GB',2,46500,18,93000,2);

  -- ── FEB 2026 (7 invoices, all paid) ────────────────────────────────────

  -- INV-07 Feb 10 | ABC Technologies | QT-06
  SELECT cid INTO v_cid FROM _custs WHERE ckey='ABC Technologies Pvt Ltd';
  INSERT INTO invoices (organization_id,customer_id,quotation_id,invoice_date,due_date,status,subtotal,tax_amount,total_amount,amount_paid,notes,created_by)
  VALUES (v_org_id,v_cid,(SELECT qid FROM _qids WHERE q=6),'2026-02-10','2026-03-12','sent',394500,71010,465510,0,'Senior management laptop refresh - HP EliteBook + Dell',v_uid)
  RETURNING id INTO v_inv_id; INSERT INTO _iids VALUES(7,v_inv_id,465510);
  INSERT INTO invoice_items(invoice_id,product_id,description,quantity,unit_price,tax_rate,line_total,sort_order) VALUES
    (v_inv_id,(SELECT pid FROM _prods WHERE sku='HP-EB840G10'),'HP EliteBook 840 G10 Core i7-1355U 16GB',3,82500,18,247500,1),
    (v_inv_id,(SELECT pid FROM _prods WHERE sku='DELL-LAT5440'),'Dell Latitude 5440 Core i5 16GB 512GB',2,73500,18,147000,2);

  -- INV-08 Feb 14 | Bharat BPO | QT-07
  SELECT cid INTO v_cid FROM _custs WHERE ckey='Bharat BPO Solutions';
  INSERT INTO invoices (organization_id,customer_id,quotation_id,invoice_date,due_date,status,subtotal,tax_amount,total_amount,amount_paid,notes,created_by)
  VALUES (v_org_id,v_cid,(SELECT qid FROM _qids WHERE q=7),'2026-02-14','2026-03-16','sent',58800,10584,69384,0,'BPO workstation accessories bulk order',v_uid)
  RETURNING id INTO v_inv_id; INSERT INTO _iids VALUES(8,v_inv_id,69384);
  INSERT INTO invoice_items(invoice_id,product_id,description,quantity,unit_price,tax_rate,line_total,sort_order) VALUES
    (v_inv_id,(SELECT pid FROM _prods WHERE sku='LOG-MK215'),'Logitech MK215 Wireless Combo',25,1190,18,29750,1),
    (v_inv_id,(SELECT pid FROM _prods WHERE sku='LOG-M171'),'Logitech M171 Wireless Mouse',25,690,18,17250,2),
    (v_inv_id,(SELECT pid FROM _prods WHERE sku='HP-KBDSLIM'),'HP USB Business Slim Keyboard',20,590,18,11800,3);

  -- INV-09 Feb 18 | MedPlus Healthcare | QT-08
  SELECT cid INTO v_cid FROM _custs WHERE ckey='MedPlus Healthcare';
  INSERT INTO invoices (organization_id,customer_id,quotation_id,invoice_date,due_date,status,subtotal,tax_amount,total_amount,amount_paid,notes,created_by)
  VALUES (v_org_id,v_cid,(SELECT qid FROM _qids WHERE q=8),'2026-02-18','2026-03-20','sent',138000,24840,162840,0,'Critical care UPS installation - hospital wing B',v_uid)
  RETURNING id INTO v_inv_id; INSERT INTO _iids VALUES(9,v_inv_id,162840);
  INSERT INTO invoice_items(invoice_id,product_id,description,quantity,unit_price,tax_rate,line_total,sort_order) VALUES
    (v_inv_id,(SELECT pid FROM _prods WHERE sku='APC-SMT1500I'),'APC Smart-UPS 1500VA LCD',3,22000,18,66000,1),
    (v_inv_id,(SELECT pid FROM _prods WHERE sku='APC-BX1100C'),'APC Back-UPS 1100VA',10,7200,18,72000,2);

  -- INV-10 Feb 20 | Smart Manufacturing
  SELECT cid INTO v_cid FROM _custs WHERE ckey='Smart Manufacturing Ltd';
  INSERT INTO invoices (organization_id,customer_id,invoice_date,due_date,status,subtotal,tax_amount,total_amount,amount_paid,notes,created_by)
  VALUES (v_org_id,v_cid,'2026-02-20','2026-03-22','sent',106000,19080,125080,0,'Factory network - Cisco switch + router',v_uid)
  RETURNING id INTO v_inv_id; INSERT INTO _iids VALUES(10,v_inv_id,125080);
  INSERT INTO invoice_items(invoice_id,product_id,description,quantity,unit_price,tax_rate,line_total,sort_order) VALUES
    (v_inv_id,(SELECT pid FROM _prods WHERE sku='CISCO-SG350-28'),'Cisco SG350-28 28-Port Managed Switch',2,41500,18,83000,1),
    (v_inv_id,(SELECT pid FROM _prods WHERE sku='CISCO-RV340'),'Cisco RV340 Dual WAN VPN Router',1,23000,18,23000,2);

  -- INV-11 Feb 24 | TechCraft Software
  SELECT cid INTO v_cid FROM _custs WHERE ckey='TechCraft Software Pvt Ltd';
  INSERT INTO invoices (organization_id,customer_id,invoice_date,due_date,status,subtotal,tax_amount,total_amount,amount_paid,notes,created_by)
  VALUES (v_org_id,v_cid,'2026-02-24','2026-03-26','sent',285700,51426,337126,0,'Developer laptops + SSD upgrade Q1',v_uid)
  RETURNING id INTO v_inv_id; INSERT INTO _iids VALUES(11,v_inv_id,337126);
  INSERT INTO invoice_items(invoice_id,product_id,description,quantity,unit_price,tax_rate,line_total,sort_order) VALUES
    (v_inv_id,(SELECT pid FROM _prods WHERE sku='LEN-TPE14G5'),'Lenovo ThinkPad E14 Gen 5 Core i5',3,66900,18,200700,1),
    (v_inv_id,(SELECT pid FROM _prods WHERE sku='SAM-SSD-1TB'),'Samsung 870 EVO 1TB 2.5" SATA SSD',10,8500,18,85000,2);

  -- INV-12 Feb 27 | Himalaya Pharma | QT-10
  SELECT cid INTO v_cid FROM _custs WHERE ckey='Himalaya Pharma Research';
  INSERT INTO invoices (organization_id,customer_id,quotation_id,invoice_date,due_date,status,subtotal,tax_amount,total_amount,amount_paid,notes,created_by)
  VALUES (v_org_id,v_cid,(SELECT qid FROM _qids WHERE q=10),'2026-02-27','2026-03-29','sent',472500,85050,557550,0,'R&D team HP EliteBook + Dell 27" monitors',v_uid)
  RETURNING id INTO v_inv_id; INSERT INTO _iids VALUES(12,v_inv_id,557550);
  INSERT INTO invoice_items(invoice_id,product_id,description,quantity,unit_price,tax_rate,line_total,sort_order) VALUES
    (v_inv_id,(SELECT pid FROM _prods WHERE sku='HP-EB840G10'),'HP EliteBook 840 G10 Core i7 16GB 512GB',5,82500,18,412500,1),
    (v_inv_id,(SELECT pid FROM _prods WHERE sku='DELL-P2722H'),'Dell P2722H 27" FHD Professional Monitor',3,20000,18,60000,2);

  -- INV-13 Feb 28 | Pioneer Telecom
  SELECT cid INTO v_cid FROM _custs WHERE ckey='Pioneer Telecom Solutions';
  INSERT INTO invoices (organization_id,customer_id,invoice_date,due_date,status,subtotal,tax_amount,total_amount,amount_paid,notes,created_by)
  VALUES (v_org_id,v_cid,'2026-02-28','2026-03-30','sent',76800,13824,90624,0,'TP-Link routers + switches for office WiFi',v_uid)
  RETURNING id INTO v_inv_id; INSERT INTO _iids VALUES(13,v_inv_id,90624);
  INSERT INTO invoice_items(invoice_id,product_id,description,quantity,unit_price,tax_rate,line_total,sort_order) VALUES
    (v_inv_id,(SELECT pid FROM _prods WHERE sku='TPL-AX55'),'TP-Link Archer AX55 WiFi 6 Router',10,4700,18,47000,1),
    (v_inv_id,(SELECT pid FROM _prods WHERE sku='TPL-SG108'),'TP-Link TL-SG108 8-Port Gigabit Switch',20,1490,18,29800,2);

  -- ── MAR 2026 (7 invoices: 3 paid, 2 partial, 2 paid) ──────────────────

  -- INV-14 Mar 8 | Apex Financial | QT-12
  SELECT cid INTO v_cid FROM _custs WHERE ckey='Apex Financial Services';
  INSERT INTO invoices (organization_id,customer_id,quotation_id,invoice_date,due_date,status,subtotal,tax_amount,total_amount,amount_paid,notes,created_by)
  VALUES (v_org_id,v_cid,(SELECT qid FROM _qids WHERE q=12),'2026-03-08','2026-04-07','sent',220500,39690,260190,0,'Financial advisory team Dell Latitude laptops',v_uid)
  RETURNING id INTO v_inv_id; INSERT INTO _iids VALUES(14,v_inv_id,260190);
  INSERT INTO invoice_items(invoice_id,product_id,description,quantity,unit_price,tax_rate,line_total,sort_order) VALUES
    (v_inv_id,(SELECT pid FROM _prods WHERE sku='DELL-LAT5440'),'Dell Latitude 5440 Core i5-1345U 16GB 512GB',3,73500,18,220500,1);

  -- INV-15 Mar 12 | Pioneer Telecom | QT-13
  SELECT cid INTO v_cid FROM _custs WHERE ckey='Pioneer Telecom Solutions';
  INSERT INTO invoices (organization_id,customer_id,quotation_id,invoice_date,due_date,status,subtotal,tax_amount,total_amount,amount_paid,notes,created_by)
  VALUES (v_org_id,v_cid,(SELECT qid FROM _qids WHERE q=13),'2026-03-12','2026-04-11','sent',100000,18000,118000,0,'Cisco switch + TP-Link APs office expansion',v_uid)
  RETURNING id INTO v_inv_id; INSERT INTO _iids VALUES(15,v_inv_id,118000);
  INSERT INTO invoice_items(invoice_id,product_id,description,quantity,unit_price,tax_rate,line_total,sort_order) VALUES
    (v_inv_id,(SELECT pid FROM _prods WHERE sku='CISCO-SG350-28'),'Cisco SG350-28 28-Port Managed Switch',2,41500,18,83000,1),
    (v_inv_id,(SELECT pid FROM _prods WHERE sku='TPL-EAP225'),'TP-Link EAP225 AC1350 Ceiling AP',5,3400,18,17000,2);

  -- INV-16 Mar 16 | ABC Technologies (partial - balance pending)
  SELECT cid INTO v_cid FROM _custs WHERE ckey='ABC Technologies Pvt Ltd';
  INSERT INTO invoices (organization_id,customer_id,invoice_date,due_date,status,subtotal,tax_amount,total_amount,amount_paid,notes,created_by)
  VALUES (v_org_id,v_cid,'2026-03-16','2026-04-15','sent',307500,55350,362850,0,'HP EliteBook + Dell P2722H monitors Q1 top-up',v_uid)
  RETURNING id INTO v_inv_id; INSERT INTO _iids VALUES(16,v_inv_id,362850);
  INSERT INTO invoice_items(invoice_id,product_id,description,quantity,unit_price,tax_rate,line_total,sort_order) VALUES
    (v_inv_id,(SELECT pid FROM _prods WHERE sku='HP-EB840G10'),'HP EliteBook 840 G10 Core i7',3,82500,18,247500,1),
    (v_inv_id,(SELECT pid FROM _prods WHERE sku='DELL-P2722H'),'Dell P2722H 27" Professional Monitor',3,20000,18,60000,2);

  -- INV-17 Mar 18 | IndusFirst Cooperative Bank | QT-16
  SELECT cid INTO v_cid FROM _custs WHERE ckey='IndusFirst Cooperative Bank';
  INSERT INTO invoices (organization_id,customer_id,quotation_id,invoice_date,due_date,status,subtotal,tax_amount,total_amount,amount_paid,notes,created_by)
  VALUES (v_org_id,v_cid,(SELECT qid FROM _qids WHERE q=16),'2026-03-18','2026-04-17','sent',101600,18288,119888,0,'APC UPS for bank branch server room',v_uid)
  RETURNING id INTO v_inv_id; INSERT INTO _iids VALUES(17,v_inv_id,119888);
  INSERT INTO invoice_items(invoice_id,product_id,description,quantity,unit_price,tax_rate,line_total,sort_order) VALUES
    (v_inv_id,(SELECT pid FROM _prods WHERE sku='APC-BX1100C'),'APC Back-UPS 1100VA BX1100C-IN',8,7200,18,57600,1),
    (v_inv_id,(SELECT pid FROM _prods WHERE sku='APC-SMT1500I'),'APC Smart-UPS 1500VA LCD',2,22000,18,44000,2);

  -- INV-18 Mar 22 | Delhi Public School (partial)
  SELECT cid INTO v_cid FROM _custs WHERE ckey='Delhi Public School Saket';
  INSERT INTO invoices (organization_id,customer_id,invoice_date,due_date,status,subtotal,tax_amount,total_amount,amount_paid,notes,created_by)
  VALUES (v_org_id,v_cid,'2026-03-22','2026-04-21','sent',454500,81810,536310,0,'Annual computer lab - Acer Aspire 5 + Dell monitors',v_uid)
  RETURNING id INTO v_inv_id; INSERT INTO _iids VALUES(18,v_inv_id,536310);
  INSERT INTO invoice_items(invoice_id,product_id,description,quantity,unit_price,tax_rate,line_total,sort_order) VALUES
    (v_inv_id,(SELECT pid FROM _prods WHERE sku='ACR-ASP5-I5'),'Acer Aspire 5 A515 Core i5-1235U 8GB',10,41500,18,415000,1),
    (v_inv_id,(SELECT pid FROM _prods WHERE sku='DELL-SE2422H'),'Dell SE2422H 24" FHD Monitor',5,7900,18,39500,2);

  -- INV-19 Mar 26 | XYZ Systems
  SELECT cid INTO v_cid FROM _custs WHERE ckey='XYZ Systems Pvt Ltd';
  INSERT INTO invoices (organization_id,customer_id,invoice_date,due_date,status,subtotal,tax_amount,total_amount,amount_paid,notes,created_by)
  VALUES (v_org_id,v_cid,'2026-03-26','2026-04-25','sent',299000,53820,352820,0,'HP ProBook + HP monitors for new branch office',v_uid)
  RETURNING id INTO v_inv_id; INSERT INTO _iids VALUES(19,v_inv_id,352820);
  INSERT INTO invoice_items(invoice_id,product_id,description,quantity,unit_price,tax_rate,line_total,sort_order) VALUES
    (v_inv_id,(SELECT pid FROM _prods WHERE sku='HP-PB450G10'),'HP ProBook 450 G10 Core i5 8GB 512GB',5,50900,18,254500,1),
    (v_inv_id,(SELECT pid FROM _prods WHERE sku='HP-MON-24MH'),'HP 24mh FHD IPS Monitor with Speakers',5,8900,18,44500,2);

  -- INV-20 Mar 30 | Rajasthan Infra Corp (partial)
  SELECT cid INTO v_cid FROM _custs WHERE ckey='Rajasthan Infra Corp';
  INSERT INTO invoices (organization_id,customer_id,invoice_date,due_date,status,subtotal,tax_amount,total_amount,amount_paid,notes,created_by)
  VALUES (v_org_id,v_cid,'2026-03-30','2026-04-29','sent',120000,21600,141600,0,'Cisco SF350 switch + TP-Link mesh for site office',v_uid)
  RETURNING id INTO v_inv_id; INSERT INTO _iids VALUES(20,v_inv_id,141600);
  INSERT INTO invoice_items(invoice_id,product_id,description,quantity,unit_price,tax_rate,line_total,sort_order) VALUES
    (v_inv_id,(SELECT pid FROM _prods WHERE sku='CISCO-SF350-24'),'Cisco SF350-24 24-Port Managed Switch',2,27500,18,55000,1),
    (v_inv_id,(SELECT pid FROM _prods WHERE sku='TPL-DECO-M9'),'TP-Link Deco M9 Plus AC2200 Mesh (3-pack)',2,12500,18,25000,2),
    (v_inv_id,(SELECT pid FROM _prods WHERE sku='TPL-EAP225'),'TP-Link EAP225 Ceiling AP',5,3400,18,17000,3),
    (v_inv_id,(SELECT pid FROM _prods WHERE sku='TPL-SG108'),'TP-Link TL-SG108 8-Port Switch',5,1490,18,7450,4);

  -- ── APR 2026 (8 invoices: mix paid/partial/overdue) ─────────────────────

  -- INV-21 Apr 8 | ABC Technologies | QT-18
  SELECT cid INTO v_cid FROM _custs WHERE ckey='ABC Technologies Pvt Ltd';
  INSERT INTO invoices (organization_id,customer_id,quotation_id,invoice_date,due_date,status,subtotal,tax_amount,total_amount,amount_paid,notes,created_by)
  VALUES (v_org_id,v_cid,(SELECT qid FROM _qids WHERE q=18),'2026-04-08','2026-05-08','sent',208500,37530,246030,0,'Q2 HP laptops + monitors + webcams',v_uid)
  RETURNING id INTO v_inv_id; INSERT INTO _iids VALUES(21,v_inv_id,246030);
  INSERT INTO invoice_items(invoice_id,product_id,description,quantity,unit_price,tax_rate,line_total,sort_order) VALUES
    (v_inv_id,(SELECT pid FROM _prods WHERE sku='HP-PB450G10'),'HP ProBook 450 G10 Core i5',3,50900,18,152700,1),
    (v_inv_id,(SELECT pid FROM _prods WHERE sku='HP-MON-24MH'),'HP 24mh FHD Monitor with Speakers',3,8900,18,26700,2),
    (v_inv_id,(SELECT pid FROM _prods WHERE sku='HP-WEBCAM-325'),'HP 325 FHD USB-A Webcam',3,2990,18,8970,3);

  -- INV-22 Apr 12 | Smart Manufacturing | QT-19 (large - partial)
  SELECT cid INTO v_cid FROM _custs WHERE ckey='Smart Manufacturing Ltd';
  INSERT INTO invoices (organization_id,customer_id,quotation_id,invoice_date,due_date,status,subtotal,tax_amount,total_amount,amount_paid,notes,created_by)
  VALUES (v_org_id,v_cid,(SELECT qid FROM _qids WHERE q=19),'2026-04-12','2026-05-12','sent',567000,102060,669060,0,'Factory office IT refresh - ThinkPad + IdeaPad batch',v_uid)
  RETURNING id INTO v_inv_id; INSERT INTO _iids VALUES(22,v_inv_id,669060);
  INSERT INTO invoice_items(invoice_id,product_id,description,quantity,unit_price,tax_rate,line_total,sort_order) VALUES
    (v_inv_id,(SELECT pid FROM _prods WHERE sku='LEN-TPE14G5'),'Lenovo ThinkPad E14 Gen 5 Core i5 16GB',5,66900,18,334500,1),
    (v_inv_id,(SELECT pid FROM _prods WHERE sku='LEN-IPS5-I5'),'Lenovo IdeaPad Slim 5 Core i5 8GB 512GB',5,46500,18,232500,2);

  -- INV-23 Apr 16 | XYZ Systems | QT-20
  SELECT cid INTO v_cid FROM _custs WHERE ckey='XYZ Systems Pvt Ltd';
  INSERT INTO invoices (organization_id,customer_id,quotation_id,invoice_date,due_date,status,subtotal,tax_amount,total_amount,amount_paid,notes,created_by)
  VALUES (v_org_id,v_cid,(SELECT qid FROM _qids WHERE q=20),'2026-04-16','2026-05-16','sent',192700,34686,227386,0,'New branch laptops + monitors - HP ProBook + Dell',v_uid)
  RETURNING id INTO v_inv_id; INSERT INTO _iids VALUES(23,v_inv_id,227386);
  INSERT INTO invoice_items(invoice_id,product_id,description,quantity,unit_price,tax_rate,line_total,sort_order) VALUES
    (v_inv_id,(SELECT pid FROM _prods WHERE sku='HP-PB450G10'),'HP ProBook 450 G10 Core i5 8GB 512GB',2,50900,18,101800,1),
    (v_inv_id,(SELECT pid FROM _prods WHERE sku='DELL-SE2422H'),'Dell SE2422H 24" FHD Monitor',3,7900,18,23700,2);

  -- INV-24 Apr 18 | National Academy of Sciences (OVERDUE - govt slow payment)
  SELECT cid INTO v_cid FROM _custs WHERE ckey='National Academy of Sciences';
  INSERT INTO invoices (organization_id,customer_id,invoice_date,due_date,status,subtotal,tax_amount,total_amount,amount_paid,notes,created_by)
  VALUES (v_org_id,v_cid,'2026-04-18','2026-05-18','sent',243200,43776,286976,0,'Research lab Lenovo ThinkPad + Samsung SSDs',v_uid)
  RETURNING id INTO v_inv_id; INSERT INTO _iids VALUES(24,v_inv_id,286976);
  INSERT INTO invoice_items(invoice_id,product_id,description,quantity,unit_price,tax_rate,line_total,sort_order) VALUES
    (v_inv_id,(SELECT pid FROM _prods WHERE sku='LEN-TPE14G5'),'Lenovo ThinkPad E14 Gen 5 Core i5 16GB',3,66900,18,200700,1),
    (v_inv_id,(SELECT pid FROM _prods WHERE sku='SAM-SSD-1TB'),'Samsung 870 EVO 1TB 2.5" SATA SSD',5,8500,18,42500,2);

  -- INV-25 Apr 22 | Horizon IT Infrastructure (partial)
  SELECT cid INTO v_cid FROM _custs WHERE ckey='Horizon IT Infrastructure';
  INSERT INTO invoices (organization_id,customer_id,invoice_date,due_date,status,subtotal,tax_amount,total_amount,amount_paid,notes,created_by)
  VALUES (v_org_id,v_cid,'2026-04-22','2026-05-22','sent',161000,28980,189980,0,'Cisco managed switches for client data centre',v_uid)
  RETURNING id INTO v_inv_id; INSERT INTO _iids VALUES(25,v_inv_id,189980);
  INSERT INTO invoice_items(invoice_id,product_id,description,quantity,unit_price,tax_rate,line_total,sort_order) VALUES
    (v_inv_id,(SELECT pid FROM _prods WHERE sku='CISCO-SG350-28'),'Cisco SG350-28 28-Port Managed Switch',2,41500,18,83000,1),
    (v_inv_id,(SELECT pid FROM _prods WHERE sku='CISCO-SF350-24'),'Cisco SF350-24 24-Port Switch',2,27500,18,55000,2),
    (v_inv_id,(SELECT pid FROM _prods WHERE sku='TPL-EAP225'),'TP-Link EAP225 Ceiling AP',5,3400,18,17000,3),
    (v_inv_id,(SELECT pid FROM _prods WHERE sku='TPL-SG108'),'TP-Link TL-SG108 Switch',4,1490,18,5960,4);

  -- INV-26 Apr 25 | Urban Development Authority (OVERDUE - govt)
  SELECT cid INTO v_cid FROM _custs WHERE ckey='Urban Development Authority';
  INSERT INTO invoices (organization_id,customer_id,invoice_date,due_date,status,subtotal,tax_amount,total_amount,amount_paid,notes,created_by)
  VALUES (v_org_id,v_cid,'2026-04-25','2026-05-25','sent',417500,75150,492650,0,'GeM order - Acer TravelMate + Veriton for municipal offices',v_uid)
  RETURNING id INTO v_inv_id; INSERT INTO _iids VALUES(26,v_inv_id,492650);
  INSERT INTO invoice_items(invoice_id,product_id,description,quantity,unit_price,tax_rate,line_total,sort_order) VALUES
    (v_inv_id,(SELECT pid FROM _prods WHERE sku='ACR-TMP2-I5'),'Acer TravelMate P2 TMP214 Core i5 8GB',5,50000,18,250000,1),
    (v_inv_id,(SELECT pid FROM _prods WHERE sku='ACR-VX2660G'),'Acer Veriton X2660G Core i5 Desktop',5,33500,18,167500,2);

  -- INV-27 Apr 28 | Neon Advertising | QT-25
  SELECT cid INTO v_cid FROM _custs WHERE ckey='Neon Advertising Agency';
  INSERT INTO invoices (organization_id,customer_id,quotation_id,invoice_date,due_date,status,subtotal,tax_amount,total_amount,amount_paid,notes,created_by)
  VALUES (v_org_id,v_cid,(SELECT qid FROM _qids WHERE q=25),'2026-04-28','2026-05-28','sent',258000,46440,304440,0,'Creative director premium laptops - HP EliteBook + Lenovo',v_uid)
  RETURNING id INTO v_inv_id; INSERT INTO _iids VALUES(27,v_inv_id,304440);
  INSERT INTO invoice_items(invoice_id,product_id,description,quantity,unit_price,tax_rate,line_total,sort_order) VALUES
    (v_inv_id,(SELECT pid FROM _prods WHERE sku='HP-EB840G10'),'HP EliteBook 840 G10 Core i7 16GB 512GB',2,82500,18,165000,1),
    (v_inv_id,(SELECT pid FROM _prods WHERE sku='LEN-IPS5-I5'),'Lenovo IdeaPad Slim 5 Core i5 8GB 512GB',2,46500,18,93000,2);

  -- INV-28 Apr 30 | Saraswati Educational Trust (OVERDUE)
  SELECT cid INTO v_cid FROM _custs WHERE ckey='Saraswati Educational Trust';
  INSERT INTO invoices (organization_id,customer_id,invoice_date,due_date,status,subtotal,tax_amount,total_amount,amount_paid,notes,created_by)
  VALUES (v_org_id,v_cid,'2026-04-30','2026-05-30','sent',214000,38520,252520,0,'Educational trust - Dell PCs + monitors for classrooms',v_uid)
  RETURNING id INTO v_inv_id; INSERT INTO _iids VALUES(28,v_inv_id,252520);
  INSERT INTO invoice_items(invoice_id,product_id,description,quantity,unit_price,tax_rate,line_total,sort_order) VALUES
    (v_inv_id,(SELECT pid FROM _prods WHERE sku='DELL-VOS3520'),'Dell Vostro 3520 Core i3 8GB 256GB SSD',5,34900,18,174500,1),
    (v_inv_id,(SELECT pid FROM _prods WHERE sku='DELL-SE2422H'),'Dell SE2422H 24" FHD VA Monitor',5,7900,18,39500,2);

  -- ── MAY 2026 (7 invoices: mix paid/partial/overdue) ─────────────────────

  -- INV-29 May 8 | MedPlus Healthcare | QT-24 (partial)
  SELECT cid INTO v_cid FROM _custs WHERE ckey='MedPlus Healthcare';
  INSERT INTO invoices (organization_id,customer_id,quotation_id,invoice_date,due_date,status,subtotal,tax_amount,total_amount,amount_paid,notes,created_by)
  VALUES (v_org_id,v_cid,(SELECT qid FROM _qids WHERE q=24),'2026-05-08','2026-06-07','sent',137800,24804,162604,0,'Pharmacy ops laptops + UPS for counter billing',v_uid)
  RETURNING id INTO v_inv_id; INSERT INTO _iids VALUES(29,v_inv_id,162604);
  INSERT INTO invoice_items(invoice_id,product_id,description,quantity,unit_price,tax_rate,line_total,sort_order) VALUES
    (v_inv_id,(SELECT pid FROM _prods WHERE sku='HP-PB450G10'),'HP ProBook 450 G10 Core i5 8GB 512GB',2,50900,18,101800,1),
    (v_inv_id,(SELECT pid FROM _prods WHERE sku='APC-BX1100C'),'APC Back-UPS 1100VA BX1100C-IN',5,7200,18,36000,2);

  -- INV-30 May 10 | Eastern Logistics (OVERDUE)
  SELECT cid INTO v_cid FROM _custs WHERE ckey='Eastern Logistics Ltd';
  INSERT INTO invoices (organization_id,customer_id,invoice_date,due_date,status,subtotal,tax_amount,total_amount,amount_paid,notes,created_by)
  VALUES (v_org_id,v_cid,'2026-05-10','2026-06-09','sent',244500,44010,288510,0,'Field ops Asus ExpertBook ruggedized laptops',v_uid)
  RETURNING id INTO v_inv_id; INSERT INTO _iids VALUES(30,v_inv_id,288510);
  INSERT INTO invoice_items(invoice_id,product_id,description,quantity,unit_price,tax_rate,line_total,sort_order) VALUES
    (v_inv_id,(SELECT pid FROM _prods WHERE sku='ASUS-EXB1-I5'),'Asus ExpertBook B1 B1502C Core i5 8GB',5,48900,18,244500,1);

  -- INV-31 May 14 | Krishna AutoMobile | QT-26 (paid)
  SELECT cid INTO v_cid FROM _custs WHERE ckey='Krishna AutoMobile Ltd';
  INSERT INTO invoices (organization_id,customer_id,quotation_id,invoice_date,due_date,status,subtotal,tax_amount,total_amount,amount_paid,notes,created_by)
  VALUES (v_org_id,v_cid,(SELECT qid FROM _qids WHERE q=26),'2026-05-14','2026-06-13','sent',484000,87120,571120,0,'Showroom IT setup - HP ProDesk + HP monitors',v_uid)
  RETURNING id INTO v_inv_id; INSERT INTO _iids VALUES(31,v_inv_id,571120);
  INSERT INTO invoice_items(invoice_id,product_id,description,quantity,unit_price,tax_rate,line_total,sort_order) VALUES
    (v_inv_id,(SELECT pid FROM _prods WHERE sku='HP-PD400G9'),'HP ProDesk 400 G9 SFF Core i5 8GB 256GB',10,39500,18,395000,1),
    (v_inv_id,(SELECT pid FROM _prods WHERE sku='HP-MON-24MH'),'HP 24mh FHD IPS Monitor with Speakers',10,8900,18,89000,2);

  -- INV-32 May 18 | Punjab National Infra (OVERDUE)
  SELECT cid INTO v_cid FROM _custs WHERE ckey='Punjab National Infra Ltd';
  INSERT INTO invoices (organization_id,customer_id,invoice_date,due_date,status,subtotal,tax_amount,total_amount,amount_paid,notes,created_by)
  VALUES (v_org_id,v_cid,'2026-05-18','2026-06-17','sent',207000,37260,244260,0,'Data centre Cisco managed switches upgrade',v_uid)
  RETURNING id INTO v_inv_id; INSERT INTO _iids VALUES(32,v_inv_id,244260);
  INSERT INTO invoice_items(invoice_id,product_id,description,quantity,unit_price,tax_rate,line_total,sort_order) VALUES
    (v_inv_id,(SELECT pid FROM _prods WHERE sku='CISCO-SG350-28'),'Cisco SG350-28 28-Port Managed Switch',2,41500,18,83000,1),
    (v_inv_id,(SELECT pid FROM _prods WHERE sku='CISCO-SF350-24'),'Cisco SF350-24 24-Port Switch',2,27500,18,55000,2),
    (v_inv_id,(SELECT pid FROM _prods WHERE sku='TPL-DECO-M9'),'TP-Link Deco M9 Plus Mesh System',2,12500,18,25000,3),
    (v_inv_id,(SELECT pid FROM _prods WHERE sku='TPL-EAP225'),'TP-Link EAP225 Ceiling AP',5,3400,18,17000,4);

  -- INV-33 May 22 | ABC Technologies (partial - large order)
  SELECT cid INTO v_cid FROM _custs WHERE ckey='ABC Technologies Pvt Ltd';
  INSERT INTO invoices (organization_id,customer_id,invoice_date,due_date,status,subtotal,tax_amount,total_amount,amount_paid,notes,created_by)
  VALUES (v_org_id,v_cid,'2026-05-22','2026-06-21','sent',503500,90630,594130,0,'Q2 HP EliteBook batch + monitors for executive fleet',v_uid)
  RETURNING id INTO v_inv_id; INSERT INTO _iids VALUES(33,v_inv_id,594130);
  INSERT INTO invoice_items(invoice_id,product_id,description,quantity,unit_price,tax_rate,line_total,sort_order) VALUES
    (v_inv_id,(SELECT pid FROM _prods WHERE sku='HP-EB840G10'),'HP EliteBook 840 G10 Core i7 16GB 512GB',5,82500,18,412500,1),
    (v_inv_id,(SELECT pid FROM _prods WHERE sku='HP-MON-24MH'),'HP 24mh FHD Monitor with Speakers',5,8900,18,44500,2),
    (v_inv_id,(SELECT pid FROM _prods WHERE sku='LOG-MXKEYS'),'Logitech MX Keys S Advanced Keyboard',5,8900,18,44500,3);

  -- INV-34 May 26 | Delhi Public School (OVERDUE - partial payment)
  SELECT cid INTO v_cid FROM _custs WHERE ckey='Delhi Public School Saket';
  INSERT INTO invoices (organization_id,customer_id,invoice_date,due_date,status,subtotal,tax_amount,total_amount,amount_paid,notes,created_by)
  VALUES (v_org_id,v_cid,'2026-05-26','2026-06-25','sent',332000,59760,391760,0,'Computer lab expansion - Acer Aspire 5 batch 2',v_uid)
  RETURNING id INTO v_inv_id; INSERT INTO _iids VALUES(34,v_inv_id,391760);
  INSERT INTO invoice_items(invoice_id,product_id,description,quantity,unit_price,tax_rate,line_total,sort_order) VALUES
    (v_inv_id,(SELECT pid FROM _prods WHERE sku='ACR-ASP5-I5'),'Acer Aspire 5 A515 Core i5-1235U 8GB 512GB',8,41500,18,332000,1);

  -- INV-35 May 30 | TechCraft Software (paid)
  SELECT cid INTO v_cid FROM _custs WHERE ckey='TechCraft Software Pvt Ltd';
  INSERT INTO invoices (organization_id,customer_id,invoice_date,due_date,status,subtotal,tax_amount,total_amount,amount_paid,notes,created_by)
  VALUES (v_org_id,v_cid,'2026-05-30','2026-06-29','sent',176300,31734,208034,0,'Q2 developer ThinkPad + SSD refresh TechCraft',v_uid)
  RETURNING id INTO v_inv_id; INSERT INTO _iids VALUES(35,v_inv_id,208034);
  INSERT INTO invoice_items(invoice_id,product_id,description,quantity,unit_price,tax_rate,line_total,sort_order) VALUES
    (v_inv_id,(SELECT pid FROM _prods WHERE sku='LEN-TPE14G5'),'Lenovo ThinkPad E14 Gen 5 Core i5 16GB',2,66900,18,133800,1),
    (v_inv_id,(SELECT pid FROM _prods WHERE sku='SAM-SSD-1TB'),'Samsung 870 EVO 1TB 2.5" SATA SSD',5,8500,18,42500,2);

  -- ── JUN 2026 (5 invoices: 1 partial, 4 sent/unpaid) ────────────────────

  -- INV-36 Jun 3 | XYZ Systems (sent)
  SELECT cid INTO v_cid FROM _custs WHERE ckey='XYZ Systems Pvt Ltd';
  INSERT INTO invoices (organization_id,customer_id,invoice_date,due_date,status,subtotal,tax_amount,total_amount,amount_paid,notes,created_by)
  VALUES (v_org_id,v_cid,'2026-06-03','2026-07-03','sent',175300,31554,206854,0,'Mid-year refresh HP ProBook + Dell Latitude',v_uid)
  RETURNING id INTO v_inv_id; INSERT INTO _iids VALUES(36,v_inv_id,206854);
  INSERT INTO invoice_items(invoice_id,product_id,description,quantity,unit_price,tax_rate,line_total,sort_order) VALUES
    (v_inv_id,(SELECT pid FROM _prods WHERE sku='HP-PB450G10'),'HP ProBook 450 G10 Core i5 8GB 512GB',2,50900,18,101800,1),
    (v_inv_id,(SELECT pid FROM _prods WHERE sku='DELL-LAT5440'),'Dell Latitude 5440 Core i5-1345U 16GB',1,73500,18,73500,2);

  -- INV-37 Jun 5 | Silver Oak Hospitals (sent)
  SELECT cid INTO v_cid FROM _custs WHERE ckey='Silver Oak Hospitals Ltd';
  INSERT INTO invoices (organization_id,customer_id,invoice_date,due_date,status,subtotal,tax_amount,total_amount,amount_paid,notes,created_by)
  VALUES (v_org_id,v_cid,'2026-06-05','2026-07-05','sent',80000,14400,94400,0,'UPS for hospital ICU expansion - emergency order',v_uid)
  RETURNING id INTO v_inv_id; INSERT INTO _iids VALUES(37,v_inv_id,94400);
  INSERT INTO invoice_items(invoice_id,product_id,description,quantity,unit_price,tax_rate,line_total,sort_order) VALUES
    (v_inv_id,(SELECT pid FROM _prods WHERE sku='APC-SMT1500I'),'APC Smart-UPS 1500VA LCD 230V',2,22000,18,44000,1),
    (v_inv_id,(SELECT pid FROM _prods WHERE sku='APC-BX1100C'),'APC Back-UPS 1100VA BX1100C-IN',5,7200,18,36000,2);

  -- INV-38 Jun 8 | Smart Manufacturing (sent - large)
  SELECT cid INTO v_cid FROM _custs WHERE ckey='Smart Manufacturing Ltd';
  INSERT INTO invoices (organization_id,customer_id,invoice_date,due_date,status,subtotal,tax_amount,total_amount,amount_paid,notes,created_by)
  VALUES (v_org_id,v_cid,'2026-06-08','2026-07-08','sent',358500,64530,423030,0,'Q2 additional factory office IT - Lenovo + Dell OptiPlex',v_uid)
  RETURNING id INTO v_inv_id; INSERT INTO _iids VALUES(38,v_inv_id,423030);
  INSERT INTO invoice_items(invoice_id,product_id,description,quantity,unit_price,tax_rate,line_total,sort_order) VALUES
    (v_inv_id,(SELECT pid FROM _prods WHERE sku='LEN-IPS5-I5'),'Lenovo IdeaPad Slim 5 Core i5 8GB 512GB',5,46500,18,232500,1),
    (v_inv_id,(SELECT pid FROM _prods WHERE sku='DELL-OPT3000'),'Dell OptiPlex 3000 MT Core i5 8GB 256GB',3,42000,18,126000,2);

  -- INV-39 Jun 10 | Apex Financial (partial payment received)
  SELECT cid INTO v_cid FROM _custs WHERE ckey='Apex Financial Services';
  INSERT INTO invoices (organization_id,customer_id,invoice_date,due_date,status,subtotal,tax_amount,total_amount,amount_paid,notes,created_by)
  VALUES (v_org_id,v_cid,'2026-06-10','2026-07-10','sent',260500,46890,307390,0,'Financial team Dell Latitude + monitors top-up',v_uid)
  RETURNING id INTO v_inv_id; INSERT INTO _iids VALUES(39,v_inv_id,307390);
  INSERT INTO invoice_items(invoice_id,product_id,description,quantity,unit_price,tax_rate,line_total,sort_order) VALUES
    (v_inv_id,(SELECT pid FROM _prods WHERE sku='DELL-LAT5440'),'Dell Latitude 5440 Core i5-1345U 16GB',3,73500,18,220500,1),
    (v_inv_id,(SELECT pid FROM _prods WHERE sku='DELL-P2722H'),'Dell P2722H 27" FHD Professional Monitor',2,20000,18,40000,2);

  -- INV-40 Jun 12 | ABC Technologies (sent - new order)
  SELECT cid INTO v_cid FROM _custs WHERE ckey='ABC Technologies Pvt Ltd';
  INSERT INTO invoices (organization_id,customer_id,invoice_date,due_date,status,subtotal,tax_amount,total_amount,amount_paid,notes,created_by)
  VALUES (v_org_id,v_cid,'2026-06-12','2026-07-12','sent',238500,42930,281430,0,'Q2 premium laptops HP EliteBook + Dell Latitude',v_uid)
  RETURNING id INTO v_inv_id; INSERT INTO _iids VALUES(40,v_inv_id,281430);
  INSERT INTO invoice_items(invoice_id,product_id,description,quantity,unit_price,tax_rate,line_total,sort_order) VALUES
    (v_inv_id,(SELECT pid FROM _prods WHERE sku='HP-EB840G10'),'HP EliteBook 840 G10 Core i7 16GB 512GB',2,82500,18,165000,1),
    (v_inv_id,(SELECT pid FROM _prods WHERE sku='DELL-LAT5440'),'Dell Latitude 5440 Core i5 16GB 512GB',1,73500,18,73500,2);

  -- ── INVOICE PAYMENTS (trigger auto-updates status + amount_paid) ──────────
  -- Jan invoices - all fully paid
  INSERT INTO invoice_payments(organization_id,invoice_id,amount,payment_date,payment_method,notes,created_by) VALUES
    (v_org_id,(SELECT iid FROM _iids WHERE i=1),440376,'2026-01-28','bank_transfer','NEFT payment cleared - INV-01 ABC Technologies',v_uid),
    (v_org_id,(SELECT iid FROM _iids WHERE i=2),404032,'2026-02-01','cheque','Cheque No. 123456 - Global Education Trust',v_uid),
    (v_org_id,(SELECT iid FROM _iids WHERE i=3),69384,'2026-02-05','upi','UPI payment Bharat BPO Solutions',v_uid),
    (v_org_id,(SELECT iid FROM _iids WHERE i=4),145848,'2026-02-10','bank_transfer','NEFT - Silver Oak Hospitals full payment',v_uid),
    (v_org_id,(SELECT iid FROM _iids WHERE i=5),105020,'2026-02-12','bank_transfer','Bank transfer MedPlus Healthcare',v_uid),
    (v_org_id,(SELECT iid FROM _iids WHERE i=6),346566,'2026-02-15','bank_transfer','RTGS XYZ Systems Pvt Ltd',v_uid);

  -- Feb invoices - all paid
  INSERT INTO invoice_payments(organization_id,invoice_id,amount,payment_date,payment_method,notes,created_by) VALUES
    (v_org_id,(SELECT iid FROM _iids WHERE i=7),465510,'2026-02-25','bank_transfer','RTGS ABC Technologies Feb invoice',v_uid),
    (v_org_id,(SELECT iid FROM _iids WHERE i=8),69384,'2026-02-28','upi','UPI Bharat BPO Feb accessories order',v_uid),
    (v_org_id,(SELECT iid FROM _iids WHERE i=9),162840,'2026-03-05','bank_transfer','NEFT MedPlus UPS payment',v_uid),
    (v_org_id,(SELECT iid FROM _iids WHERE i=10),125080,'2026-03-08','cheque','Cheque Smart Manufacturing Cisco',v_uid),
    (v_org_id,(SELECT iid FROM _iids WHERE i=11),337126,'2026-03-12','bank_transfer','NEFT TechCraft Software Feb',v_uid),
    (v_org_id,(SELECT iid FROM _iids WHERE i=12),557550,'2026-03-15','bank_transfer','RTGS Himalaya Pharma - full payment',v_uid),
    (v_org_id,(SELECT iid FROM _iids WHERE i=13),90624,'2026-03-18','upi','UPI Pioneer Telecom networking',v_uid);

  -- Mar invoices - paid ones (14,15,17,19) + partial (16,18,20)
  INSERT INTO invoice_payments(organization_id,invoice_id,amount,payment_date,payment_method,notes,created_by) VALUES
    (v_org_id,(SELECT iid FROM _iids WHERE i=14),260190,'2026-03-25','bank_transfer','RTGS Apex Financial Dell laptops',v_uid),
    (v_org_id,(SELECT iid FROM _iids WHERE i=15),118000,'2026-03-28','bank_transfer','NEFT Pioneer Telecom Cisco+TP-Link',v_uid),
    (v_org_id,(SELECT iid FROM _iids WHERE i=16),200000,'2026-04-05','bank_transfer','Part payment ABC Technologies - balance ₹1,62,850 due',v_uid),
    (v_org_id,(SELECT iid FROM _iids WHERE i=17),119888,'2026-04-02','cheque','Cheque IndusFirst Bank - UPS payment',v_uid),
    (v_org_id,(SELECT iid FROM _iids WHERE i=18),280000,'2026-04-10','bank_transfer','Part payment Delhi Public School - annual budget',v_uid),
    (v_org_id,(SELECT iid FROM _iids WHERE i=19),352820,'2026-04-08','bank_transfer','RTGS XYZ Systems Mar invoice',v_uid),
    (v_org_id,(SELECT iid FROM _iids WHERE i=20),70000,'2026-04-15','upi','Advance UPI Rajasthan Infra - balance pending',v_uid);

  -- Apr invoices - paid (21,23,27) + partial (22,25) + overdue (24,26,28)
  INSERT INTO invoice_payments(organization_id,invoice_id,amount,payment_date,payment_method,notes,created_by) VALUES
    (v_org_id,(SELECT iid FROM _iids WHERE i=21),246030,'2026-04-22','bank_transfer','NEFT ABC Technologies Apr HP order',v_uid),
    (v_org_id,(SELECT iid FROM _iids WHERE i=22),350000,'2026-05-02','bank_transfer','Advance payment Smart Manufacturing - balance ₹3,19,060',v_uid),
    (v_org_id,(SELECT iid FROM _iids WHERE i=23),227386,'2026-05-05','bank_transfer','RTGS XYZ Systems Apr invoice',v_uid),
    (v_org_id,(SELECT iid FROM _iids WHERE i=25),95000,'2026-05-10','bank_transfer','Part Horizon IT Cisco switches - balance ₹94,980',v_uid),
    (v_org_id,(SELECT iid FROM _iids WHERE i=27),304440,'2026-05-15','bank_transfer','NEFT Neon Advertising - EliteBook',v_uid);

  -- May invoices - paid (31,35) + partial (29,33) + overdue (30,32,34)
  INSERT INTO invoice_payments(organization_id,invoice_id,amount,payment_date,payment_method,notes,created_by) VALUES
    (v_org_id,(SELECT iid FROM _iids WHERE i=29),85000,'2026-05-20','upi','Part payment MedPlus - balance ₹77,604',v_uid),
    (v_org_id,(SELECT iid FROM _iids WHERE i=31),571120,'2026-05-28','bank_transfer','RTGS Krishna AutoMobile showroom IT',v_uid),
    (v_org_id,(SELECT iid FROM _iids WHERE i=33),300000,'2026-06-05','bank_transfer','Part ABC Technologies May EliteBook - balance ₹2,94,130',v_uid),
    (v_org_id,(SELECT iid FROM _iids WHERE i=35),208034,'2026-06-10','bank_transfer','NEFT TechCraft Software May invoice',v_uid);

  -- Jun invoices - partial (39 only)
  INSERT INTO invoice_payments(organization_id,invoice_id,amount,payment_date,payment_method,notes,created_by) VALUES
    (v_org_id,(SELECT iid FROM _iids WHERE i=39),150000,'2026-06-14','bank_transfer','Advance Apex Financial Jun - balance ₹1,57,390',v_uid);

  -- ── Mark overdue invoices ──────────────────────────────────────────────
  -- These have no payment and their due date has passed
  UPDATE invoices SET status = 'overdue'
  WHERE id IN (
    SELECT iid FROM _iids WHERE i IN (24, 26, 28, 30, 32, 34)
  );

END;
$$;

-- ============================================================
-- BLOCK 4: VENDOR PAYMENTS + AUDIT LOGS
-- ============================================================
DO $$
DECLARE
  v_org_id UUID; v_uid UUID; v_vid UUID;
BEGIN
  SELECT p.organization_id, p.id INTO v_org_id, v_uid
  FROM profiles p WHERE p.email = 'khushalrajput1978@gmail.com' LIMIT 1;

  -- ── VENDOR PAYMENTS (12 payments across 10 vendors) ───────────────────

  -- HP Enterprise Supplies (PO-01 & PO-12 received)
  SELECT vid INTO v_vid FROM _vends WHERE vkey='HP Enterprise Supplies India';
  INSERT INTO vendor_payments(organization_id,vendor_id,purchase_order_id,amount,payment_date,payment_method,reference_no,notes,created_by) VALUES
    (v_org_id,v_vid,(SELECT id FROM purchase_orders WHERE organization_id=v_org_id AND vendor_id=v_vid ORDER BY po_date ASC LIMIT 1),
     500000,'2026-01-20','bank_transfer','NEFT/HP/2601-001','Advance 60% against PO-00001 HP laptops',v_uid),
    (v_org_id,v_vid,(SELECT id FROM purchase_orders WHERE organization_id=v_org_id AND vendor_id=v_vid ORDER BY po_date ASC LIMIT 1),
     342520,'2026-02-05','neft','NEFT/HP/2602-001','Balance payment PO-00001 after GRN',v_uid);

  -- Nexgen Dell Authorized (PO-02)
  SELECT vid INTO v_vid FROM _vends WHERE vkey='Nexgen Dell Authorized Partner';
  INSERT INTO vendor_payments(organization_id,vendor_id,purchase_order_id,amount,payment_date,payment_method,reference_no,notes,created_by) VALUES
    (v_org_id,v_vid,(SELECT id FROM purchase_orders WHERE organization_id=v_org_id AND vendor_id=v_vid ORDER BY po_date ASC LIMIT 1),
     400000,'2026-01-22','rtgs','RTGS/DELL/2601-001','Advance 50% Dell laptops + desktops PO-00002',v_uid),
    (v_org_id,v_vid,(SELECT id FROM purchase_orders WHERE organization_id=v_org_id AND vendor_id=v_vid ORDER BY po_date ASC LIMIT 1),
     424230,'2026-02-08','neft','NEFT/DELL/2602-001','Balance payment after full delivery PO-00002',v_uid);

  -- DataServe Lenovo (PO-03)
  SELECT vid INTO v_vid FROM _vends WHERE vkey='DataServe Lenovo Authorized';
  INSERT INTO vendor_payments(organization_id,vendor_id,purchase_order_id,amount,payment_date,payment_method,reference_no,notes,created_by) VALUES
    (v_org_id,v_vid,(SELECT id FROM purchase_orders WHERE organization_id=v_org_id AND vendor_id=v_vid ORDER BY po_date ASC LIMIT 1),
     769360,'2026-02-01','rtgs','RTGS/LEN/2602-001','Full payment Lenovo ThinkPad + IdeaPad PO-00003',v_uid);

  -- Network World India (PO-04)
  SELECT vid INTO v_vid FROM _vends WHERE vkey='Network World India Pvt Ltd';
  INSERT INTO vendor_payments(organization_id,vendor_id,purchase_order_id,amount,payment_date,payment_method,reference_no,notes,created_by) VALUES
    (v_org_id,v_vid,(SELECT id FROM purchase_orders WHERE organization_id=v_org_id AND vendor_id=v_vid ORDER BY po_date ASC LIMIT 1),
     351640,'2026-02-10','bank_transfer','NEFT/NW/2602-001','Full payment TP-Link networking PO-00004',v_uid);

  -- Seagate Technology India (PO-05)
  SELECT vid INTO v_vid FROM _vends WHERE vkey='Seagate Technology India';
  INSERT INTO vendor_payments(organization_id,vendor_id,purchase_order_id,amount,payment_date,payment_method,reference_no,notes,created_by) VALUES
    (v_org_id,v_vid,(SELECT id FROM purchase_orders WHERE organization_id=v_org_id AND vendor_id=v_vid ORDER BY po_date ASC LIMIT 1),
     343380,'2026-02-22','neft','NEFT/SEA/2602-001','Full payment Seagate HDD + WD drives PO-00005',v_uid);

  -- Samsung India Electronics (PO-06)
  SELECT vid INTO v_vid FROM _vends WHERE vkey='Samsung India Electronics';
  INSERT INTO vendor_payments(organization_id,vendor_id,purchase_order_id,amount,payment_date,payment_method,reference_no,notes,created_by) VALUES
    (v_org_id,v_vid,(SELECT id FROM purchase_orders WHERE organization_id=v_org_id AND vendor_id=v_vid ORDER BY po_date ASC LIMIT 1),
     250000,'2026-02-25','rtgs','RTGS/SAM/2602-001','Advance Samsung SSD + monitors PO-00006',v_uid),
    (v_org_id,v_vid,(SELECT id FROM purchase_orders WHERE organization_id=v_org_id AND vendor_id=v_vid ORDER BY po_date ASC LIMIT 1),
     184830,'2026-03-10','neft','NEFT/SAM/2603-001','Balance payment Samsung PO-00006 post GRN',v_uid);

  -- Cisco Systems India (PO-09)
  SELECT vid INTO v_vid FROM _vends WHERE vkey='Cisco Systems India (Dist)';
  INSERT INTO vendor_payments(organization_id,vendor_id,purchase_order_id,amount,payment_date,payment_method,reference_no,notes,created_by) VALUES
    (v_org_id,v_vid,(SELECT id FROM purchase_orders WHERE organization_id=v_org_id AND vendor_id=v_vid ORDER BY po_date ASC LIMIT 1),
     200000,'2026-03-10','rtgs','RTGS/CISCO/2603-001','Advance 50% Cisco switches PO-00009',v_uid),
    (v_org_id,v_vid,(SELECT id FROM purchase_orders WHERE organization_id=v_org_id AND vendor_id=v_vid ORDER BY po_date ASC LIMIT 1),
     194120,'2026-03-28','neft','NEFT/CISCO/2603-002','Balance Cisco PO-00009 after delivery',v_uid);

  -- Schneider APC (PO-08) - outstanding balance remaining
  SELECT vid INTO v_vid FROM _vends WHERE vkey='Schneider APC Authorized';
  INSERT INTO vendor_payments(organization_id,vendor_id,purchase_order_id,amount,payment_date,payment_method,reference_no,notes,created_by) VALUES
    (v_org_id,v_vid,(SELECT id FROM purchase_orders WHERE organization_id=v_org_id AND vendor_id=v_vid ORDER BY po_date ASC LIMIT 1),
     180000,'2026-03-05','bank_transfer','NEFT/APC/2603-001','Part payment APC UPS PO-00008 - balance ₹1,27,980',v_uid);

  -- Redington India (PO-10) - full payment
  SELECT vid INTO v_vid FROM _vends WHERE vkey='Redington India Ltd';
  INSERT INTO vendor_payments(organization_id,vendor_id,purchase_order_id,amount,payment_date,payment_method,reference_no,notes,created_by) VALUES
    (v_org_id,v_vid,(SELECT id FROM purchase_orders WHERE organization_id=v_org_id AND vendor_id=v_vid ORDER BY po_date ASC LIMIT 1),
     486160,'2026-04-02','rtgs','RTGS/REDI/2604-001','Full payment Redington Asus + Dell monitors PO-00010',v_uid);

  -- Micro Solutions (PO-15) - partial payment
  SELECT vid INTO v_vid FROM _vends WHERE vkey='Micro Solutions Pvt Ltd';
  INSERT INTO vendor_payments(organization_id,vendor_id,purchase_order_id,amount,payment_date,payment_method,reference_no,notes,created_by) VALUES
    (v_org_id,v_vid,(SELECT id FROM purchase_orders WHERE organization_id=v_org_id AND vendor_id=v_vid ORDER BY po_date ASC LIMIT 1),
     300000,'2026-05-20','neft','NEFT/MICRO/2605-001','Advance Micro Solutions PO-00015 - balance ₹2,87,640',v_uid);

  -- ── AUDIT LOGS (50 realistic entries) ─────────────────────────────────
  INSERT INTO audit_logs (organization_id,user_name,user_email,user_ip,action,module,record_id,record_name,metadata,created_at) VALUES

  -- Jan 2026 - System comes alive
  (v_org_id,'Khushal Rajput','khushalrajput1978@gmail.com','103.42.168.10','login','authentication',NULL,NULL,'{"browser":"Chrome 120","os":"Windows 11"}','2026-01-05 09:02:00+05:30'),
  (v_org_id,'Khushal Rajput','khushalrajput1978@gmail.com','103.42.168.10','created','products',NULL,'HP ProBook 450 G10','{"sku":"HP-PB450G10","selling_price":50900}','2026-01-05 09:45:00+05:30'),
  (v_org_id,'Khushal Rajput','khushalrajput1978@gmail.com','103.42.168.10','created','products',NULL,'Dell Latitude 5440','{"sku":"DELL-LAT5440","selling_price":73500}','2026-01-05 10:12:00+05:30'),
  (v_org_id,'Khushal Rajput','khushalrajput1978@gmail.com','103.42.168.10','created','purchase_orders',NULL,'PO-00001','{"vendor":"HP Enterprise Supplies India","total":842520}','2026-01-05 11:30:00+05:30'),
  (v_org_id,'Khushal Rajput','khushalrajput1978@gmail.com','103.42.168.10','created','vendors',NULL,'Tech Distribution India Pvt Ltd','{"city":"Noida","gstin":"09AADCT1234B1Z2"}','2026-01-05 14:22:00+05:30'),
  (v_org_id,'Khushal Rajput','khushalrajput1978@gmail.com','103.42.168.10','created','customers',NULL,'ABC Technologies Pvt Ltd','{"city":"Noida","gst":"09AABCA1234A1Z1"}','2026-01-06 10:05:00+05:30'),
  (v_org_id,'Khushal Rajput','khushalrajput1978@gmail.com','103.42.168.10','created','quotations',NULL,'QT-2026-0001','{"customer":"ABC Technologies Pvt Ltd","total":440376}','2026-01-10 11:20:00+05:30'),
  (v_org_id,'Khushal Rajput','khushalrajput1978@gmail.com','103.42.168.10','updated','quotations',NULL,'QT-2026-0001','{"status_from":"draft","status_to":"sent"}','2026-01-10 11:35:00+05:30'),
  (v_org_id,'Khushal Rajput','khushalrajput1978@gmail.com','103.42.168.10','created','invoices',NULL,'INV-000001','{"customer":"ABC Technologies Pvt Ltd","total":440376}','2026-01-18 10:00:00+05:30'),
  (v_org_id,'Khushal Rajput','khushalrajput1978@gmail.com','103.42.168.10','created','invoices',NULL,'INV-000002','{"customer":"Global Education Trust","total":404032}','2026-01-20 11:15:00+05:30'),

  -- Vikas Kumar - inventory management Jan
  (v_org_id,'Vikas Kumar','vikas.kumar@rajputit.com','103.42.168.11','login','authentication',NULL,NULL,'{"browser":"Edge 121","os":"Windows 10"}','2026-01-12 09:00:00+05:30'),
  (v_org_id,'Vikas Kumar','vikas.kumar@rajputit.com','103.42.168.11','created','goods_receipts',NULL,'GRN-00001','{"po":"PO-00001","items_received":3}','2026-01-12 10:30:00+05:30'),
  (v_org_id,'Vikas Kumar','vikas.kumar@rajputit.com','103.42.168.11','created','goods_receipts',NULL,'GRN-00002','{"po":"PO-00002","items_received":3}','2026-01-15 11:00:00+05:30'),
  (v_org_id,'Vikas Kumar','vikas.kumar@rajputit.com','103.42.168.11','updated','products',NULL,'HP ProBook 450 G10','{"field":"reorder_point","old":3,"new":5}','2026-01-16 14:20:00+05:30'),
  (v_org_id,'Vikas Kumar','vikas.kumar@rajputit.com','103.42.168.11','created','goods_receipts',NULL,'GRN-00003','{"po":"PO-00003","items_received":3}','2026-01-20 09:45:00+05:30'),

  -- Priya Singh - sales activity Jan/Feb
  (v_org_id,'Priya Singh','priya.singh@rajputit.com','103.42.168.12','login','authentication',NULL,NULL,'{"browser":"Chrome 121","os":"macOS Sonoma"}','2026-01-15 08:55:00+05:30'),
  (v_org_id,'Priya Singh','priya.singh@rajputit.com','103.42.168.12','created','quotations',NULL,'QT-2026-0004','{"customer":"Silver Oak Hospitals Ltd","total":145848}','2026-01-20 10:10:00+05:30'),
  (v_org_id,'Priya Singh','priya.singh@rajputit.com','103.42.168.12','updated','quotations',NULL,'QT-2026-0001','{"status_from":"sent","status_to":"accepted"}','2026-01-17 16:30:00+05:30'),
  (v_org_id,'Priya Singh','priya.singh@rajputit.com','103.42.168.12','created','invoices',NULL,'INV-000003','{"customer":"Bharat BPO Solutions","total":69384}','2026-01-22 11:00:00+05:30'),
  (v_org_id,'Priya Singh','priya.singh@rajputit.com','103.42.168.12','created','invoices',NULL,'INV-000006','{"customer":"XYZ Systems Pvt Ltd","total":346566}','2026-01-31 16:45:00+05:30'),

  -- Feb 2026 activities
  (v_org_id,'Khushal Rajput','khushalrajput1978@gmail.com','103.42.168.10','login','authentication',NULL,NULL,'{"browser":"Chrome 121","os":"Windows 11"}','2026-02-03 08:50:00+05:30'),
  (v_org_id,'Khushal Rajput','khushalrajput1978@gmail.com','103.42.168.10','created','purchase_orders',NULL,'PO-00005','{"vendor":"Seagate Technology India","total":343380}','2026-02-03 10:15:00+05:30'),
  (v_org_id,'Khushal Rajput','khushalrajput1978@gmail.com','103.42.168.10','created','purchase_orders',NULL,'PO-00008','{"vendor":"Schneider APC Authorized","total":307980}','2026-02-20 11:30:00+05:30'),
  (v_org_id,'Vikas Kumar','vikas.kumar@rajputit.com','103.42.168.11','created','goods_receipts',NULL,'GRN-00005','{"po":"PO-00005","items_received":4}','2026-02-10 10:00:00+05:30'),
  (v_org_id,'Vikas Kumar','vikas.kumar@rajputit.com','103.42.168.11','created','goods_receipts',NULL,'GRN-00006','{"po":"PO-00006","items_received":4}','2026-02-15 11:30:00+05:30'),
  (v_org_id,'Priya Singh','priya.singh@rajputit.com','103.42.168.12','created','invoices',NULL,'INV-000007','{"customer":"ABC Technologies Pvt Ltd","total":465510}','2026-02-10 09:30:00+05:30'),
  (v_org_id,'Priya Singh','priya.singh@rajputit.com','103.42.168.12','created','invoices',NULL,'INV-000012','{"customer":"Himalaya Pharma Research","total":557550}','2026-02-27 14:00:00+05:30'),
  (v_org_id,'Priya Singh','priya.singh@rajputit.com','103.42.168.12','updated','invoices',NULL,'INV-000001','{"action":"payment_recorded","amount":440376,"status":"paid"}','2026-01-28 16:00:00+05:30'),

  -- Rahul Sharma - admin activities
  (v_org_id,'Rahul Sharma','rahul.sharma@rajputit.com','103.42.168.13','login','authentication',NULL,NULL,'{"browser":"Firefox 122","os":"Windows 11"}','2026-02-01 09:10:00+05:30'),
  (v_org_id,'Rahul Sharma','rahul.sharma@rajputit.com','103.42.168.13','created','customers',NULL,'Himalaya Pharma Research','{"city":"Mumbai","gst":"27AABCH2345M1Z3"}','2026-02-01 10:30:00+05:30'),
  (v_org_id,'Rahul Sharma','rahul.sharma@rajputit.com','103.42.168.13','updated','company_settings',NULL,'Company Profile','{"field":"bank_account","action":"updated"}','2026-02-10 11:00:00+05:30'),
  (v_org_id,'Rahul Sharma','rahul.sharma@rajputit.com','103.42.168.13','created','customers',NULL,'TechCraft Software Pvt Ltd','{"city":"Hyderabad","gst":"36AABCT3456N1Z4"}','2026-02-15 14:20:00+05:30'),

  -- Mar 2026 - growing business
  (v_org_id,'Khushal Rajput','khushalrajput1978@gmail.com','103.42.168.10','created','purchase_orders',NULL,'PO-00009','{"vendor":"Cisco Systems India (Dist)","total":394120}','2026-03-05 10:00:00+05:30'),
  (v_org_id,'Ankit Gupta','ankit.gupta@rajputit.com','103.42.168.14','login','authentication',NULL,NULL,'{"browser":"Chrome 122","os":"Windows 11"}','2026-03-10 09:00:00+05:30'),
  (v_org_id,'Ankit Gupta','ankit.gupta@rajputit.com','103.42.168.14','created','quotations',NULL,'QT-2026-0013','{"customer":"Pioneer Telecom Solutions","total":118000}','2026-03-10 10:30:00+05:30'),
  (v_org_id,'Ankit Gupta','ankit.gupta@rajputit.com','103.42.168.14','updated','quotations',NULL,'QT-2026-0012','{"status_from":"sent","status_to":"accepted"}','2026-03-12 11:00:00+05:30'),
  (v_org_id,'Priya Singh','priya.singh@rajputit.com','103.42.168.12','created','invoices',NULL,'INV-000018','{"customer":"Delhi Public School Saket","total":536310}','2026-03-22 09:45:00+05:30'),
  (v_org_id,'Vikas Kumar','vikas.kumar@rajputit.com','103.42.168.11','created','goods_receipts',NULL,'GRN-00009','{"po":"PO-00009","items_received":3}','2026-03-15 14:00:00+05:30'),

  -- Apr 2026 - peak month
  (v_org_id,'Khushal Rajput','khushalrajput1978@gmail.com','103.42.168.10','created','purchase_orders',NULL,'PO-00012','{"vendor":"HP Enterprise Supplies India","total":462560}','2026-04-02 10:00:00+05:30'),
  (v_org_id,'Priya Singh','priya.singh@rajputit.com','103.42.168.12','created','invoices',NULL,'INV-000022','{"customer":"Smart Manufacturing Ltd","total":669060}','2026-04-12 11:00:00+05:30'),
  (v_org_id,'Priya Singh','priya.singh@rajputit.com','103.42.168.12','updated','invoices',NULL,'INV-000022','{"action":"payment_recorded","amount":350000,"status":"partial"}','2026-05-02 15:30:00+05:30'),
  (v_org_id,'Ankit Gupta','ankit.gupta@rajputit.com','103.42.168.14','created','quotations',NULL,'QT-2026-0021','{"customer":"Saraswati Educational Trust","total":741040}','2026-04-18 10:15:00+05:30'),
  (v_org_id,'Rahul Sharma','rahul.sharma@rajputit.com','103.42.168.13','updated','customers',NULL,'Urban Development Authority','{"notes":"Govt body - L1 tender. Expect 60-90 day payment cycle."}','2026-04-25 16:00:00+05:30'),

  -- May 2026
  (v_org_id,'Vikas Kumar','vikas.kumar@rajputit.com','103.42.168.11','created','goods_receipts',NULL,'GRN-00015','{"po":"PO-00015","items_received":3}','2026-05-12 10:30:00+05:30'),
  (v_org_id,'Priya Singh','priya.singh@rajputit.com','103.42.168.12','created','invoices',NULL,'INV-000031','{"customer":"Krishna AutoMobile Ltd","total":571120}','2026-05-14 11:00:00+05:30'),
  (v_org_id,'Priya Singh','priya.singh@rajputit.com','103.42.168.12','updated','invoices',NULL,'INV-000031','{"action":"payment_recorded","amount":571120,"status":"paid"}','2026-05-28 14:30:00+05:30'),
  (v_org_id,'Khushal Rajput','khushalrajput1978@gmail.com','103.42.168.10','created','purchase_orders',NULL,'PO-00017','{"vendor":"Micro Solutions Pvt Ltd","total":245440}','2026-05-25 09:30:00+05:30'),

  -- Jun 2026 - current month
  (v_org_id,'Khushal Rajput','khushalrajput1978@gmail.com','103.42.168.10','login','authentication',NULL,NULL,'{"browser":"Chrome 124","os":"Windows 11"}','2026-06-12 09:00:00+05:30'),
  (v_org_id,'Priya Singh','priya.singh@rajputit.com','103.42.168.12','created','invoices',NULL,'INV-000040','{"customer":"ABC Technologies Pvt Ltd","total":281430}','2026-06-12 10:30:00+05:30'),
  (v_org_id,'Ankit Gupta','ankit.gupta@rajputit.com','103.42.168.14','created','quotations',NULL,'QT-2026-0029','{"customer":"Horizon IT Infrastructure","total":719800}','2026-06-03 11:00:00+05:30'),
  (v_org_id,'Khushal Rajput','khushalrajput1978@gmail.com','103.42.168.10','created','purchase_orders',NULL,'PO-00019','{"vendor":"Network World India Pvt Ltd","total":324500}','2026-06-05 14:00:00+05:30'),
  (v_org_id,'Rahul Sharma','rahul.sharma@rajputit.com','103.42.168.13','updated','invoices',NULL,'INV-000024','{"note":"Reminder sent to National Academy. GeM payment under process."}','2026-06-10 10:00:00+05:30'),
  (v_org_id,'Vikas Kumar','vikas.kumar@rajputit.com','103.42.168.11','created','goods_receipts',NULL,'GRN-00018','{"po":"PO-00018","items_received":2,"status":"partial"}','2026-06-08 11:30:00+05:30');

END;
$$;

-- ============================================================
-- BLOCK 5: SALE STOCK MOVEMENTS (so inventory reflects sales)
-- ============================================================
DO $$
DECLARE
  v_org_id UUID; v_uid UUID; v_loc_id UUID;
BEGIN
  SELECT p.organization_id, p.id INTO v_org_id, v_uid
  FROM profiles p WHERE p.email = 'khushalrajput1978@gmail.com' LIMIT 1;
  SELECT id INTO v_loc_id FROM locations WHERE organization_id = v_org_id LIMIT 1;

  -- Record sale movements for shipped invoices (paid/partial/overdue = goods delivered)
  -- One movement per invoice-item group (aggregated by product for simplicity)
  INSERT INTO stock_movements (organization_id, product_id, location_id, movement_type, quantity, reference_no, notes)
  SELECT v_org_id, ii.product_id, v_loc_id, 'sale',
         SUM(ii.quantity)::integer,
         inv.invoice_number,
         'Sale - ' || inv.invoice_number
  FROM invoice_items ii
  JOIN invoices inv ON inv.id = ii.invoice_id
  WHERE inv.organization_id = v_org_id
    AND inv.status IN ('paid','partial','overdue')
    AND ii.product_id IS NOT NULL
  GROUP BY ii.product_id, inv.id, inv.invoice_number;

END;
$$;
