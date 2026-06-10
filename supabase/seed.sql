-- ============================================================
-- CompanyOS Sample Seed Data
-- Run AFTER 001_init.sql and 002_auto_org_id.sql
-- Replace YOUR_ORG_ID and YOUR_USER_ID with actual values
-- from your organizations and auth.users tables.
--
-- Quick way to get them:
--   select id from organizations limit 1;
--   select id from auth.users limit 1;
-- ============================================================

do $$
declare
  v_org_id   uuid := (select id from organizations limit 1);
  v_user_id  uuid := (select id from auth.users limit 1);

  -- brand ids
  b_dell     uuid;
  b_hp       uuid;
  b_lenovo   uuid;
  b_logitech uuid;
  b_samsung  uuid;

  -- category ids
  c_laptops  uuid;
  c_desktops uuid;
  c_monitors uuid;
  c_periph   uuid;
  c_storage  uuid;

  -- vendor ids
  v_techsup  uuid;
  v_digimart uuid;

  -- location ids
  l_main     uuid;
  l_showroom uuid;

  -- product ids
  p1 uuid; p2 uuid; p3 uuid; p4 uuid; p5 uuid;
  p6 uuid; p7 uuid; p8 uuid; p9 uuid; p10 uuid;

begin
  -- ---- Brands ----
  insert into brands (organization_id, name) values (v_org_id, 'Dell')    returning id into b_dell;
  insert into brands (organization_id, name) values (v_org_id, 'HP')      returning id into b_hp;
  insert into brands (organization_id, name) values (v_org_id, 'Lenovo')  returning id into b_lenovo;
  insert into brands (organization_id, name) values (v_org_id, 'Logitech')returning id into b_logitech;
  insert into brands (organization_id, name) values (v_org_id, 'Samsung') returning id into b_samsung;

  -- ---- Categories ----
  insert into categories (organization_id, name) values (v_org_id, 'Laptops')    returning id into c_laptops;
  insert into categories (organization_id, name) values (v_org_id, 'Desktops')   returning id into c_desktops;
  insert into categories (organization_id, name) values (v_org_id, 'Monitors')   returning id into c_monitors;
  insert into categories (organization_id, name) values (v_org_id, 'Peripherals')returning id into c_periph;
  insert into categories (organization_id, name) values (v_org_id, 'Storage')    returning id into c_storage;

  -- ---- Vendors ----
  insert into vendors (organization_id, name, contact_name, phone, email, gstin, is_active)
  values (v_org_id, 'TechSupply India', 'Rajesh Kumar', '9876543210', 'rajesh@techsupply.in', '27AABCT1332L1ZS', true)
  returning id into v_techsup;

  insert into vendors (organization_id, name, contact_name, phone, email, gstin, is_active)
  values (v_org_id, 'DigiMart Wholesale', 'Priya Sharma', '9123456780', 'priya@digimart.in', '07AAACG2115R1ZN', true)
  returning id into v_digimart;

  -- ---- Locations ----
  insert into locations (organization_id, name, type, is_active)
  values (v_org_id, 'Main Warehouse', 'warehouse', true)
  returning id into l_main;

  insert into locations (organization_id, name, type, is_active)
  values (v_org_id, 'Showroom', 'store', true)
  returning id into l_showroom;

  -- ---- Products ----
  insert into products (organization_id, sku, name, brand_id, category_id, unit, selling_price, cost_price, mrp, reorder_point, reorder_qty, warranty_months, hsn_code, is_active)
  values (v_org_id, 'LAP-DELL-001', 'Dell Inspiron 15 3511 (i5/8GB/512GB)', b_dell, c_laptops, 'pcs', 52000, 44000, 55000, 5, 10, 12, '84713010', true)
  returning id into p1;

  insert into products (organization_id, sku, name, brand_id, category_id, unit, selling_price, cost_price, mrp, reorder_point, reorder_qty, warranty_months, hsn_code, is_active)
  values (v_org_id, 'LAP-HP-001', 'HP Pavilion 15 (Ryzen 5/16GB/512GB)', b_hp, c_laptops, 'pcs', 58000, 50000, 62000, 3, 5, 12, '84713010', true)
  returning id into p2;

  insert into products (organization_id, sku, name, brand_id, category_id, unit, selling_price, cost_price, mrp, reorder_point, reorder_qty, warranty_months, hsn_code, is_active)
  values (v_org_id, 'LAP-LEN-001', 'Lenovo IdeaPad Slim 3 (i3/8GB/256GB)', b_lenovo, c_laptops, 'pcs', 38000, 32000, 41000, 5, 10, 12, '84713010', true)
  returning id into p3;

  insert into products (organization_id, sku, name, brand_id, category_id, unit, selling_price, cost_price, mrp, reorder_point, reorder_qty, warranty_months, hsn_code, is_active)
  values (v_org_id, 'MON-DELL-001', 'Dell 24" FHD Monitor (P2422H)', b_dell, c_monitors, 'pcs', 18500, 15500, 20000, 3, 5, 36, '85285200', true)
  returning id into p4;

  insert into products (organization_id, sku, name, brand_id, category_id, unit, selling_price, cost_price, mrp, reorder_point, reorder_qty, warranty_months, hsn_code, is_active)
  values (v_org_id, 'MON-SAM-001', 'Samsung 27" QHD Monitor (S27A600)', b_samsung, c_monitors, 'pcs', 28000, 23500, 30000, 2, 4, 36, '85285200', true)
  returning id into p5;

  insert into products (organization_id, sku, name, brand_id, category_id, unit, selling_price, cost_price, mrp, reorder_point, reorder_qty, warranty_months, hsn_code, is_active)
  values (v_org_id, 'KEY-LOG-001', 'Logitech MK275 Wireless Keyboard+Mouse Combo', b_logitech, c_periph, 'pcs', 1800, 1350, 2000, 10, 20, 12, '84716060', true)
  returning id into p6;

  insert into products (organization_id, sku, name, brand_id, category_id, unit, selling_price, cost_price, mrp, reorder_point, reorder_qty, warranty_months, hsn_code, is_active)
  values (v_org_id, 'MOU-LOG-001', 'Logitech M330 Silent Plus Mouse', b_logitech, c_periph, 'pcs', 1500, 1100, 1800, 10, 20, 12, '84716060', true)
  returning id into p7;

  insert into products (organization_id, sku, name, brand_id, category_id, unit, selling_price, cost_price, mrp, reorder_point, reorder_qty, warranty_months, hsn_code, is_active)
  values (v_org_id, 'SSD-SAM-001', 'Samsung 860 EVO 500GB SATA SSD', b_samsung, c_storage, 'pcs', 5500, 4400, 6000, 8, 15, 60, '84717020', true)
  returning id into p8;

  insert into products (organization_id, sku, name, brand_id, category_id, unit, selling_price, cost_price, mrp, reorder_point, reorder_qty, warranty_months, hsn_code, is_active)
  values (v_org_id, 'SSD-SAM-002', 'Samsung 870 EVO 1TB SATA SSD', b_samsung, c_storage, 'pcs', 9500, 7800, 10500, 5, 10, 60, '84717020', true)
  returning id into p9;

  insert into products (organization_id, sku, name, brand_id, category_id, unit, selling_price, cost_price, mrp, reorder_point, reorder_qty, warranty_months, hsn_code, is_active)
  values (v_org_id, 'DES-HP-001', 'HP ProDesk 400 G7 Mini (i5/8GB/256GB)', b_hp, c_desktops, 'pcs', 42000, 36000, 45000, 2, 4, 12, '84714190', true)
  returning id into p10;

  -- ---- Stock Movements (receipts — trigger auto-updates stock_levels) ----
  insert into stock_movements (organization_id, product_id, location_id, movement_type, quantity, reference_no, vendor_id, created_by)
  values
    (v_org_id, p1, l_main, 'receipt', 15, 'PO-2024-001', v_techsup, v_user_id),
    (v_org_id, p2, l_main, 'receipt', 8,  'PO-2024-001', v_techsup, v_user_id),
    (v_org_id, p3, l_main, 'receipt', 20, 'PO-2024-001', v_techsup, v_user_id),
    (v_org_id, p4, l_main, 'receipt', 12, 'PO-2024-002', v_digimart, v_user_id),
    (v_org_id, p5, l_main, 'receipt', 6,  'PO-2024-002', v_digimart, v_user_id),
    (v_org_id, p6, l_main, 'receipt', 50, 'PO-2024-003', v_digimart, v_user_id),
    (v_org_id, p7, l_main, 'receipt', 40, 'PO-2024-003', v_digimart, v_user_id),
    (v_org_id, p8, l_main, 'receipt', 30, 'PO-2024-004', v_techsup, v_user_id),
    (v_org_id, p9, l_main, 'receipt', 20, 'PO-2024-004', v_techsup, v_user_id),
    (v_org_id, p10, l_main,'receipt', 5,  'PO-2024-005', v_techsup, v_user_id);

  -- Some showroom transfers
  insert into stock_movements (organization_id, product_id, location_id, movement_type, quantity, reference_no, created_by)
  values
    (v_org_id, p1, l_showroom, 'transfer_in', 3, 'TRF-001', v_user_id),
    (v_org_id, p2, l_showroom, 'transfer_in', 2, 'TRF-001', v_user_id),
    (v_org_id, p4, l_showroom, 'transfer_in', 2, 'TRF-001', v_user_id),
    (v_org_id, p6, l_showroom, 'transfer_in', 10,'TRF-001', v_user_id),
    (v_org_id, p7, l_showroom, 'transfer_in', 10,'TRF-001', v_user_id);

  -- Some sales
  insert into stock_movements (organization_id, product_id, location_id, movement_type, quantity, reference_no, notes, created_by)
  values
    (v_org_id, p1, l_showroom, 'sale', 1, 'INV-2024-001', 'Walk-in customer', v_user_id),
    (v_org_id, p3, l_main,    'sale', 3, 'INV-2024-002', 'Bulk order - Jain Enterprises', v_user_id),
    (v_org_id, p6, l_showroom,'sale', 4, 'INV-2024-003', 'Retail sale', v_user_id),
    (v_org_id, p8, l_main,    'sale', 5, 'INV-2024-004', 'Online order', v_user_id);

  -- One low-stock product: sell down p5 to below reorder point (2)
  insert into stock_movements (organization_id, product_id, location_id, movement_type, quantity, reference_no, created_by)
  values (v_org_id, p5, l_main, 'sale', 5, 'INV-2024-005', v_user_id);

  -- ---- Price History ----
  insert into price_history (product_id, old_selling_price, new_selling_price, old_cost_price, new_cost_price, reason, changed_by)
  values
    (p1, 50000, 52000, 42000, 44000, 'Supplier price increase Q1 2024', v_user_id),
    (p3, 36000, 38000, 30000, 32000, 'Market rate adjustment', v_user_id),
    (p8, 5200,  5500,  4200,  4400,  'Currency adjustment', v_user_id),
    (p6, 1650,  1800,  1200,  1350,  'Logistics cost increase', v_user_id);

end $$;
