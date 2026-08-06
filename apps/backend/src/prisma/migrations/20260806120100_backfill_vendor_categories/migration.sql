-- ADR-0018: Vendor Category moves from the vendor-owned free-text field
-- (companies.specialisations) to the contractor-owned typed field
-- (company_vendor_assignments.categories), which until now no code path wrote.
--
-- Seed each contractor's assignment from the vendor's existing self-declared
-- specialisations, but ONLY where the string is already a VendorCategory label
-- (case-insensitively). The create-vendor modal has always fed this field from
-- the enum, so values like 'ELECTRICAL' / 'Electrical' carry over cleanly.
-- Genuine free text ('Civil', 'Timber', 'Materials') is deliberately left
-- behind rather than guessed at — a wrong category silently misroutes RFQs,
-- which is worse than an empty one the buyer can see and fix.
--
-- Only ever fills an EMPTY categories array, so this is idempotent and cannot
-- clobber a categorisation made after the column went live.

WITH valid AS (
    SELECT unnest(enum_range(NULL::"VendorCategory"))::text AS label
),
mapped AS (
    SELECT c.id AS company_id,
           array_agg(DISTINCT v.label::"VendorCategory") AS cats
    FROM companies c
    CROSS JOIN LATERAL unnest(c.specialisations) AS s(val)
    JOIN valid v ON v.label = upper(trim(s.val))
    WHERE c.type = 'VENDOR'
    GROUP BY c.id
)
UPDATE company_vendor_assignments a
SET categories = mapped.cats
FROM mapped
WHERE a.vendor_id = mapped.company_id
  AND coalesce(cardinality(a.categories), 0) = 0;
