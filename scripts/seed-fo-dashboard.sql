-- Financial Officer Dashboard — seed data for all invoice variants
-- Run after the base seed. Uses existing contractor/vendor companies and projects.
--
-- NOTE: This script creates additional vendor companies and invoices.
-- Run: psql -d forethread -f scripts/seed-fo-dashboard.sql
-- Or copy-paste the relevant INSERT statements into your DB client.

-- ═══════════════════════════════════════════════════════════════════════
-- 1. Additional Vendor Companies
-- ═══════════════════════════════════════════════════════════════════════

INSERT INTO companies (id, type, legal_name, trade_name, abn, contact_email, status, created_at, updated_at)
VALUES
  (gen_random_uuid(), 'VENDOR', 'Acme Building Supplies',    'AcmeBS',      'TEST-VENDOR-002', 'info@acmebs.local',      'ACTIVE', NOW(), NOW()),
  (gen_random_uuid(), 'VENDOR', 'Delta Electrical Services',  'DeltaElec',   'TEST-VENDOR-003', 'info@deltaelec.local',   'ACTIVE', NOW(), NOW()),
  (gen_random_uuid(), 'VENDOR', 'Summit Plumbing Solutions',  'SummitPlumb', 'TEST-VENDOR-004', 'info@summitplumb.local', 'ACTIVE', NOW(), NOW())
ON CONFLICT (abn) DO NOTHING;

-- Link new vendors to the contractor
INSERT INTO company_vendor_assignments (id, vendor_id, contractor_id, created_at, updated_at)
SELECT gen_random_uuid(), v.id, c.id, NOW(), NOW()
FROM companies v
CROSS JOIN (SELECT id FROM companies WHERE abn = 'TEST-CONTRACTOR-001') c
WHERE v.abn IN ('TEST-VENDOR-002', 'TEST-VENDOR-003', 'TEST-VENDOR-004')
ON CONFLICT (vendor_id, contractor_id) DO NOTHING;

-- ═══════════════════════════════════════════════════════════════════════
-- 2. Invoices — 5 PENDING + 5 DISPUTED + 3 other statuses
-- ═══════════════════════════════════════════════════════════════════════

-- First clean up existing seed invoices (optional — skip if you want to keep them)
-- DELETE FROM invoices WHERE company_id = (SELECT id FROM companies WHERE abn = 'TEST-CONTRACTOR-001');

-- Helper: get IDs for referencing
-- contractor = companies WHERE abn = 'TEST-CONTRACTOR-001'
-- vendors by ABN
-- projects by name + company

-- PENDING invoices (5) — will appear in "Invoices pending approval"
INSERT INTO invoices (id, project_id, company_id, vendor_id, related_po_id, status, total_amount, due_date, created_by_user_id, created_at, updated_at)
SELECT
  gen_random_uuid(),
  p.id,
  co.id,
  v.id,
  po.id,
  'PENDING',
  amount,
  NOW() + (due_offset || ' days')::interval,
  u.id,
  NOW() - (age_days || ' days')::interval,
  NOW()
FROM (VALUES
  ('Alpha Construction', 'TEST-VENDOR-001', 45200.00,   3,  2),
  ('Beta Fitout',        'TEST-VENDOR-002', 18750.50,   5,  5),
  ('Alpha Construction', 'TEST-VENDOR-003', 92100.00,  -2,  8),
  ('Beta Fitout',        'TEST-VENDOR-004', 12350.25,   1,  3),
  ('Alpha Construction', 'TEST-VENDOR-001',  7400.00,   6,  1)
) AS data(proj_name, vendor_abn, amount, due_offset, age_days)
JOIN companies co ON co.abn = 'TEST-CONTRACTOR-001'
JOIN companies v ON v.abn = data.vendor_abn
JOIN projects p ON p.name = data.proj_name AND p.company_id = co.id
JOIN users u ON u.email = 'vendor@testvendor.local'
LEFT JOIN LATERAL (
  SELECT id FROM purchase_orders WHERE company_id = co.id ORDER BY created_at LIMIT 1
) po ON true;

-- DISPUTED invoices (5) — will appear in "Disputed Invoices"
INSERT INTO invoices (id, project_id, company_id, vendor_id, related_po_id, status, total_amount, due_date, created_by_user_id, created_at, updated_at)
SELECT
  gen_random_uuid(),
  p.id,
  co.id,
  v.id,
  po.id,
  'DISPUTED',
  amount,
  NOW() + (due_offset || ' days')::interval,
  u.id,
  NOW() - (age_days || ' days')::interval,
  NOW()
FROM (VALUES
  ('Alpha Construction', 'TEST-VENDOR-002', 33500.00,  -5,  12),
  ('Beta Fitout',        'TEST-VENDOR-003', 67800.75, -10,  20),
  ('Alpha Construction', 'TEST-VENDOR-001', 15200.00,  -3,   6),
  ('Beta Fitout',        'TEST-VENDOR-004', 41900.50,  -7,  15),
  ('Alpha Construction', 'TEST-VENDOR-002', 28600.00,  -1,   3)
) AS data(proj_name, vendor_abn, amount, due_offset, age_days)
JOIN companies co ON co.abn = 'TEST-CONTRACTOR-001'
JOIN companies v ON v.abn = data.vendor_abn
JOIN projects p ON p.name = data.proj_name AND p.company_id = co.id
JOIN users u ON u.email = 'vendor@testvendor.local'
LEFT JOIN LATERAL (
  SELECT id FROM purchase_orders WHERE company_id = co.id ORDER BY created_at LIMIT 1
) po ON true;

-- Other statuses (APPROVED, PAID, REJECTED) for completeness
INSERT INTO invoices (id, project_id, company_id, vendor_id, status, total_amount, due_date, created_by_user_id, created_at, updated_at)
SELECT
  gen_random_uuid(),
  p.id,
  co.id,
  v.id,
  status,
  amount,
  NOW() - (30 || ' days')::interval,
  u.id,
  NOW() - (age_days || ' days')::interval,
  NOW()
FROM (VALUES
  ('Beta Fitout',        'TEST-VENDOR-001', 'APPROVED', 25001.50, 45),
  ('Alpha Construction', 'TEST-VENDOR-003', 'PAID',     50003.00, 60),
  ('Beta Fitout',        'TEST-VENDOR-004', 'REJECTED',  8750.25, 30)
) AS data(proj_name, vendor_abn, status, amount, age_days)
JOIN companies co ON co.abn = 'TEST-CONTRACTOR-001'
JOIN companies v ON v.abn = data.vendor_abn
JOIN projects p ON p.name = data.proj_name AND p.company_id = co.id
JOIN users u ON u.email = 'vendor@testvendor.local';
