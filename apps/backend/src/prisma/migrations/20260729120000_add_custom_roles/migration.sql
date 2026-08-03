-- FOR-252: admin-defined custom roles with per-role permission grants.

-- New audit actions for the custom-role lifecycle
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'CUSTOM_ROLE_CREATED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'CUSTOM_ROLE_UPDATED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'CUSTOM_ROLE_DELETED';

-- CreateTable
CREATE TABLE "custom_roles" (
    "id" TEXT NOT NULL,
    "company_id" TEXT,
    "name" VARCHAR(100) NOT NULL,
    "description" VARCHAR(255),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "custom_roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "custom_role_permissions" (
    "id" TEXT NOT NULL,
    "custom_role_id" TEXT NOT NULL,
    "permission_id" TEXT NOT NULL,
    "threshold_amount" DECIMAL(18,4),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "custom_role_permissions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "uq_custom_roles_company_name" ON "custom_roles"("company_id", "name");

-- CreateIndex
CREATE INDEX "idx_custom_roles_company" ON "custom_roles"("company_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_custom_role_permissions_role_permission" ON "custom_role_permissions"("custom_role_id", "permission_id");

-- CreateIndex
CREATE INDEX "idx_custom_role_permissions_role" ON "custom_role_permissions"("custom_role_id");

-- AddForeignKey
ALTER TABLE "custom_roles" ADD CONSTRAINT "custom_roles_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "custom_role_permissions" ADD CONSTRAINT "custom_role_permissions_custom_role_id_fkey" FOREIGN KEY ("custom_role_id") REFERENCES "custom_roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "custom_role_permissions" ADD CONSTRAINT "custom_role_permissions_permission_id_fkey" FOREIGN KEY ("permission_id") REFERENCES "permissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
