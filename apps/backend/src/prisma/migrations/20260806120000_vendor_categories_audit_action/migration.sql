-- ADR-0018: a contractor changing how it categorises one of its vendors is an
-- auditable act on the CompanyVendorAssignment, not on the vendor company.
ALTER TYPE "AuditAction" ADD VALUE 'VENDOR_CATEGORIES_UPDATED';
