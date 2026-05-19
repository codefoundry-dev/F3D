-- ============================================================================
-- Migration: rename_enums_and_add_procurement_models
-- 1) Rename existing enum values from PascalCase → SCREAMING_SNAKE_CASE
-- 2) Create new procurement enums & tables (RFQ, PO, BulkOrder, Invoice, etc.)
-- ============================================================================

-- CreateEnum
CREATE TYPE "BulkOrderStatus" AS ENUM ('ACTIVE', 'EXPIRED', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "InvoiceStatus" AS ENUM ('PENDING', 'APPROVED', 'DISPUTED', 'PAID', 'REJECTED');

-- CreateEnum
CREATE TYPE "PoStatus" AS ENUM ('DRAFT', 'SENT', 'ACKNOWLEDGED', 'PENDING_DELIVERY', 'DELIVERED', 'CLOSED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PoType" AS ENUM ('STANDARD', 'BULK_DRAWDOWN', 'HOLD_FOR_RELEASE');

-- CreateEnum
CREATE TYPE "RfqStatus" AS ENUM ('DRAFT', 'OPEN', 'AWAITING_RESPONSE', 'QUOTED', 'AWARDED', 'CLOSED', 'CANCELLED');

-- AlterEnum: CompanyStatus  Active→ACTIVE, Inactive→INACTIVE
BEGIN;
CREATE TYPE "CompanyStatus_new" AS ENUM ('ACTIVE', 'INACTIVE');
ALTER TABLE "companies" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "companies" ALTER COLUMN "status" TYPE "CompanyStatus_new"
  USING (CASE "status"::text
    WHEN 'Active' THEN 'ACTIVE'
    WHEN 'Inactive' THEN 'INACTIVE'
  END::"CompanyStatus_new");
ALTER TYPE "CompanyStatus" RENAME TO "CompanyStatus_old";
ALTER TYPE "CompanyStatus_new" RENAME TO "CompanyStatus";
DROP TYPE "CompanyStatus_old";
ALTER TABLE "companies" ALTER COLUMN "status" SET DEFAULT 'ACTIVE';
COMMIT;

-- AlterEnum: CompanyType  Contractor→CONTRACTOR, Vendor→VENDOR
BEGIN;
CREATE TYPE "CompanyType_new" AS ENUM ('CONTRACTOR', 'VENDOR');
ALTER TABLE "companies" ALTER COLUMN "type" TYPE "CompanyType_new"
  USING (CASE "type"::text
    WHEN 'Contractor' THEN 'CONTRACTOR'
    WHEN 'Vendor' THEN 'VENDOR'
  END::"CompanyType_new");
ALTER TYPE "CompanyType" RENAME TO "CompanyType_old";
ALTER TYPE "CompanyType_new" RENAME TO "CompanyType";
DROP TYPE "CompanyType_old";
COMMIT;

-- AlterEnum: DocumentType  Insurance→INSURANCE, License→LICENSE, Certification→CERTIFICATION, Other→OTHER
BEGIN;
CREATE TYPE "DocumentType_new" AS ENUM ('INSURANCE', 'LICENSE', 'CERTIFICATION', 'OTHER');
ALTER TABLE "company_documents" ALTER COLUMN "type" TYPE "DocumentType_new"
  USING (CASE "type"::text
    WHEN 'Insurance' THEN 'INSURANCE'
    WHEN 'License' THEN 'LICENSE'
    WHEN 'Certification' THEN 'CERTIFICATION'
    WHEN 'Other' THEN 'OTHER'
  END::"DocumentType_new");
ALTER TYPE "DocumentType" RENAME TO "DocumentType_old";
ALTER TYPE "DocumentType_new" RENAME TO "DocumentType";
DROP TYPE "DocumentType_old";
COMMIT;

-- AlterEnum: LocationType  Delivery→DELIVERY, Storage→STORAGE
BEGIN;
CREATE TYPE "LocationType_new" AS ENUM ('DELIVERY', 'STORAGE');
ALTER TABLE "project_locations" ALTER COLUMN "type" TYPE "LocationType_new"
  USING (CASE "type"::text
    WHEN 'Delivery' THEN 'DELIVERY'
    WHEN 'Storage' THEN 'STORAGE'
  END::"LocationType_new");
ALTER TYPE "LocationType" RENAME TO "LocationType_old";
ALTER TYPE "LocationType_new" RENAME TO "LocationType";
DROP TYPE "LocationType_old";
COMMIT;

-- AlterEnum: ProjectStatus  Planned→PLANNED, Ongoing→ONGOING, Completed→COMPLETED, Archived→ARCHIVED
BEGIN;
CREATE TYPE "ProjectStatus_new" AS ENUM ('PLANNED', 'ONGOING', 'COMPLETED', 'ARCHIVED');
ALTER TABLE "projects" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "projects" ALTER COLUMN "status" TYPE "ProjectStatus_new"
  USING (CASE "status"::text
    WHEN 'Planned' THEN 'PLANNED'
    WHEN 'Ongoing' THEN 'ONGOING'
    WHEN 'Completed' THEN 'COMPLETED'
    WHEN 'Archived' THEN 'ARCHIVED'
  END::"ProjectStatus_new");
ALTER TYPE "ProjectStatus" RENAME TO "ProjectStatus_old";
ALTER TYPE "ProjectStatus_new" RENAME TO "ProjectStatus";
DROP TYPE "ProjectStatus_old";
ALTER TABLE "projects" ALTER COLUMN "status" SET DEFAULT 'PLANNED';
COMMIT;

-- AlterEnum: UserRole  SuperAdmin→SUPER_ADMIN, CompanyAdmin→COMPANY_ADMIN, etc.
BEGIN;
CREATE TYPE "UserRole_new" AS ENUM ('SUPER_ADMIN', 'COMPANY_ADMIN', 'PROCUREMENT_OFFICER', 'FINANCIAL_OFFICER', 'WAREHOUSE_OFFICER', 'FOREMAN', 'VENDOR');
ALTER TABLE "users" ALTER COLUMN "role" TYPE "UserRole_new"
  USING (CASE "role"::text
    WHEN 'SuperAdmin' THEN 'SUPER_ADMIN'
    WHEN 'CompanyAdmin' THEN 'COMPANY_ADMIN'
    WHEN 'ProcurementOfficer' THEN 'PROCUREMENT_OFFICER'
    WHEN 'FinancialOfficer' THEN 'FINANCIAL_OFFICER'
    WHEN 'WarehouseOfficer' THEN 'WAREHOUSE_OFFICER'
    WHEN 'Foreman' THEN 'FOREMAN'
    WHEN 'Vendor' THEN 'VENDOR'
  END::"UserRole_new");
ALTER TYPE "UserRole" RENAME TO "UserRole_old";
ALTER TYPE "UserRole_new" RENAME TO "UserRole";
DROP TYPE "UserRole_old";
COMMIT;

-- AlterEnum: UserStatus  Invited→INVITED, Active→ACTIVE, Inactive→INACTIVE
BEGIN;
CREATE TYPE "UserStatus_new" AS ENUM ('INVITED', 'ACTIVE', 'INACTIVE');
ALTER TABLE "users" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "users" ALTER COLUMN "status" TYPE "UserStatus_new"
  USING (CASE "status"::text
    WHEN 'Invited' THEN 'INVITED'
    WHEN 'Active' THEN 'ACTIVE'
    WHEN 'Inactive' THEN 'INACTIVE'
  END::"UserStatus_new");
ALTER TYPE "UserStatus" RENAME TO "UserStatus_old";
ALTER TYPE "UserStatus_new" RENAME TO "UserStatus";
DROP TYPE "UserStatus_old";
ALTER TABLE "users" ALTER COLUMN "status" SET DEFAULT 'INVITED';
COMMIT;

-- CreateTable: rfqs
CREATE TABLE "rfqs" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "status" "RfqStatus" NOT NULL DEFAULT 'DRAFT',
    "pick_up_date" TIMESTAMP(3),
    "delivery_location" TEXT,
    "pick_up_location" TEXT,
    "deadline_start" TIMESTAMP(3),
    "deadline_end" TIMESTAMP(3),
    "total_requested_qty" INTEGER NOT NULL DEFAULT 0,
    "approval_status" TEXT,
    "approved_by_id" TEXT,
    "created_by_user_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "rfqs_pkey" PRIMARY KEY ("id")
);

-- CreateTable: rfq_line_items
CREATE TABLE "rfq_line_items" (
    "id" TEXT NOT NULL,
    "rfq_id" TEXT NOT NULL,
    "material_name" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unit" VARCHAR(50) NOT NULL,
    "description" TEXT,
    CONSTRAINT "rfq_line_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable: quote_responses
CREATE TABLE "quote_responses" (
    "id" TEXT NOT NULL,
    "rfq_id" TEXT NOT NULL,
    "vendor_id" TEXT NOT NULL,
    "total_cost" DECIMAL(18,4) NOT NULL,
    "discount_percent" DECIMAL(5,2),
    "discount_amount" DECIMAL(18,4),
    "items_covered" INTEGER NOT NULL DEFAULT 0,
    "total_items" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'Pending',
    "submitted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "quote_responses_pkey" PRIMARY KEY ("id")
);

-- CreateTable: purchase_orders
CREATE TABLE "purchase_orders" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "vendor_id" TEXT NOT NULL,
    "status" "PoStatus" NOT NULL DEFAULT 'DRAFT',
    "po_type" "PoType" NOT NULL DEFAULT 'STANDARD',
    "revision" INTEGER NOT NULL DEFAULT 1,
    "pick_up" BOOLEAN NOT NULL DEFAULT false,
    "delivery_location" TEXT,
    "pick_up_location" TEXT,
    "total_amount" DECIMAL(18,4),
    "line_item_count" INTEGER NOT NULL DEFAULT 0,
    "deadline_start" TIMESTAMP(3),
    "deadline_end" TIMESTAMP(3),
    "approval_status" TEXT,
    "approved_by_id" TEXT,
    "created_by_user_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "purchase_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable: bulk_orders
CREATE TABLE "bulk_orders" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "vendor_id" TEXT NOT NULL,
    "rfq_id" TEXT,
    "status" "BulkOrderStatus" NOT NULL DEFAULT 'ACTIVE',
    "brands" TEXT,
    "total_amount" DECIMAL(18,4),
    "end_date" TIMESTAMP(3),
    "created_by_user_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "bulk_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable: bulk_order_line_items
CREATE TABLE "bulk_order_line_items" (
    "id" TEXT NOT NULL,
    "bulk_order_id" TEXT NOT NULL,
    "item_reference" VARCHAR(100) NOT NULL,
    "description" TEXT NOT NULL,
    "qty" INTEGER NOT NULL,
    "unit" VARCHAR(50) NOT NULL,
    "ordered" INTEGER NOT NULL DEFAULT 0,
    "qty_remaining" INTEGER NOT NULL,
    "deliveries_percent" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "price_per_unit" DECIMAL(18,4) NOT NULL,
    "total_line_inc" DECIMAL(18,4) NOT NULL,
    CONSTRAINT "bulk_order_line_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable: drawdowns
CREATE TABLE "drawdowns" (
    "id" TEXT NOT NULL,
    "bulk_order_id" TEXT NOT NULL,
    "purchase_order_id" TEXT,
    "quantity" INTEGER NOT NULL,
    "created_by_user_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "drawdowns_pkey" PRIMARY KEY ("id")
);

-- CreateTable: invoices
CREATE TABLE "invoices" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "vendor_id" TEXT NOT NULL,
    "related_po_id" TEXT,
    "status" "InvoiceStatus" NOT NULL DEFAULT 'PENDING',
    "total_amount" DECIMAL(18,4) NOT NULL,
    "due_date" TIMESTAMP(3),
    "created_by_user_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "invoices_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_rfqs_company" ON "rfqs"("company_id");
CREATE INDEX "idx_rfqs_project" ON "rfqs"("project_id");
CREATE INDEX "idx_rfqs_status" ON "rfqs"("status");

CREATE INDEX "idx_pos_company" ON "purchase_orders"("company_id");
CREATE INDEX "idx_pos_project" ON "purchase_orders"("project_id");
CREATE INDEX "idx_pos_vendor" ON "purchase_orders"("vendor_id");
CREATE INDEX "idx_pos_status" ON "purchase_orders"("status");

CREATE INDEX "idx_invoices_company" ON "invoices"("company_id");
CREATE INDEX "idx_invoices_project" ON "invoices"("project_id");
CREATE INDEX "idx_invoices_vendor" ON "invoices"("vendor_id");
CREATE INDEX "idx_invoices_status" ON "invoices"("status");

-- AddForeignKey: rfqs
ALTER TABLE "rfqs" ADD CONSTRAINT "rfqs_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "rfqs" ADD CONSTRAINT "rfqs_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "rfqs" ADD CONSTRAINT "rfqs_approved_by_id_fkey" FOREIGN KEY ("approved_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "rfqs" ADD CONSTRAINT "rfqs_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey: rfq_line_items
ALTER TABLE "rfq_line_items" ADD CONSTRAINT "rfq_line_items_rfq_id_fkey" FOREIGN KEY ("rfq_id") REFERENCES "rfqs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: quote_responses
ALTER TABLE "quote_responses" ADD CONSTRAINT "quote_responses_rfq_id_fkey" FOREIGN KEY ("rfq_id") REFERENCES "rfqs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "quote_responses" ADD CONSTRAINT "quote_responses_vendor_id_fkey" FOREIGN KEY ("vendor_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey: purchase_orders
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_vendor_id_fkey" FOREIGN KEY ("vendor_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_approved_by_id_fkey" FOREIGN KEY ("approved_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey: bulk_orders
ALTER TABLE "bulk_orders" ADD CONSTRAINT "bulk_orders_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "bulk_orders" ADD CONSTRAINT "bulk_orders_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "bulk_orders" ADD CONSTRAINT "bulk_orders_vendor_id_fkey" FOREIGN KEY ("vendor_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "bulk_orders" ADD CONSTRAINT "bulk_orders_rfq_id_fkey" FOREIGN KEY ("rfq_id") REFERENCES "rfqs"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "bulk_orders" ADD CONSTRAINT "bulk_orders_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey: bulk_order_line_items
ALTER TABLE "bulk_order_line_items" ADD CONSTRAINT "bulk_order_line_items_bulk_order_id_fkey" FOREIGN KEY ("bulk_order_id") REFERENCES "bulk_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: drawdowns
ALTER TABLE "drawdowns" ADD CONSTRAINT "drawdowns_bulk_order_id_fkey" FOREIGN KEY ("bulk_order_id") REFERENCES "bulk_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "drawdowns" ADD CONSTRAINT "drawdowns_purchase_order_id_fkey" FOREIGN KEY ("purchase_order_id") REFERENCES "purchase_orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "drawdowns" ADD CONSTRAINT "drawdowns_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey: invoices
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_vendor_id_fkey" FOREIGN KEY ("vendor_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_related_po_id_fkey" FOREIGN KEY ("related_po_id") REFERENCES "purchase_orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
