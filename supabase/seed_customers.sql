-- ================================================================
-- CompanyOS — Customer Seed Data
-- 10 realistic IT / CCTV / Networking businesses (India)
--
-- Run in Supabase SQL Editor after migration 004.
-- Safe to run multiple times — skips if customers already exist.
-- ================================================================

DO $$
DECLARE
  v_org_id uuid;
BEGIN
  SELECT id INTO v_org_id FROM organizations LIMIT 1;

  IF v_org_id IS NULL THEN
    RAISE EXCEPTION 'No organization found. Complete onboarding first.';
  END IF;

  IF EXISTS (SELECT 1 FROM customers WHERE organization_id = v_org_id LIMIT 1) THEN
    RAISE NOTICE 'Customer seed already applied. Skipping.';
    RETURN;
  END IF;

  INSERT INTO customers
    (organization_id, name, company_name, gst_number, phone, email,
     address, city, state, pincode, notes, is_active)
  VALUES
    (v_org_id,
     'Rajesh Kumar', 'ABC Technologies',
     '27AABCA1234B1Z5', '+91 98201 11234',
     'rajesh@abctechnologies.in',
     'Shop No. 12, Lamington Road, Grant Road',
     'Mumbai', 'Maharashtra', '400007',
     'Long-term client. Prefers bulk orders with NET-30 payment.',
     true),

    (v_org_id,
     'Priya Sharma', 'Shree Infotech',
     '27AACSI5678C1Z3', '+91 97302 22345',
     'priya.sharma@shreeinfotech.com',
     '245, Deccan Gymkhana, FC Road',
     'Pune', 'Maharashtra', '411004',
     'Focuses on CCTV and surveillance. Growing account.',
     true),

    (v_org_id,
     'Suresh Patel', 'Tech Vision Systems',
     '24AACTV2345D1Z8', '+91 99099 33456',
     'suresh@techvisionsystems.com',
     'B-14, GIDC Electronics Estate, Makarpura',
     'Vadodara', 'Gujarat', '390010',
     'Specialises in IP camera installations across Gujarat.',
     true),

    (v_org_id,
     'Anita Joshi', 'Om Sai Computers',
     '24AACOS7890E1Z2', '+91 98253 44567',
     'anita@omsaicomputers.com',
     '17, Ring Road, Near Surat Railway Station',
     'Surat', 'Gujarat', '395003',
     'Retail + service centre. Orders laptops and peripherals regularly.',
     true),

    (v_org_id,
     'Vikram Singh', 'Global IT Solutions',
     '07AACGI4567F1Z6', '+91 98110 55678',
     'vikram.singh@globalitsolutions.co.in',
     '303, Antriksh Bhavan, K.G. Marg, Connaught Place',
     'New Delhi', 'Delhi', '110001',
     'Government tender vendor. Payment sometimes delayed — follow up at 45 days.',
     true),

    (v_org_id,
     'Deepa Nair', 'Secure CCTV Solutions',
     '29AACSC8901G1Z4', '+91 98451 66789',
     'deepa@securecctv.in',
     '56, 2nd Cross, Koramangala 4th Block',
     'Bengaluru', 'Karnataka', '560034',
     'Exclusive CCTV installer. Large residential projects.',
     true),

    (v_org_id,
     'Arun Murugan', 'Raj Enterprises',
     '33AACRE3456H1Z9', '+91 98401 77890',
     'arun@rajenterprises.in',
     '78, Greams Road, Near Apollo Hospital',
     'Chennai', 'Tamil Nadu', '600006',
     'Networking and structured cabling specialist.',
     true),

    (v_org_id,
     'Sravani Reddy', 'Prime Networks',
     '36AACPN6789J1Z7', '+91 94401 88901',
     'sravani@primenetworks.in',
     'Plot 42, Kavuri Hills, Madhapur',
     'Hyderabad', 'Telangana', '500033',
     'IT infrastructure for pharma companies. High-value orders.',
     true),

    (v_org_id,
     'Ramesh Gupta', 'Smart Office Systems',
     '08AACSO1234K1Z1', '+91 98290 99012',
     'ramesh@smartofficesystems.in',
     '22, MI Road, Near GPO',
     'Jaipur', 'Rajasthan', '302001',
     'Corporate office automation. Frequent repeat orders.',
     true),

    (v_org_id,
     'Neha Deshmukh', 'Vertex Technologies',
     '27AACVT5678L1Z3', '+91 98231 10123',
     'neha@vertextech.in',
     '15, Sitabuldi, Near Lokmat Square',
     'Nagpur', 'Maharashtra', '440012',
     'Tier-2 city reseller. Good volume growth in last 2 quarters.',
     true);

  RAISE NOTICE 'Customer seed applied: 10 customers inserted.';
END;
$$;
