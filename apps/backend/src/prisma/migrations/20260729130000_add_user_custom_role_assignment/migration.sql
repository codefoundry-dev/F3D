-- FOR-253: assign custom roles (FOR-252) to users. When set, the custom role's
-- permission grants replace the built-in role's for that user.

-- New audit actions for the assignment lifecycle
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'CUSTOM_ROLE_ASSIGNED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'CUSTOM_ROLE_UNASSIGNED';

-- AlterTable
ALTER TABLE "users" ADD COLUMN "custom_role_id" TEXT;

-- CreateIndex
CREATE INDEX "idx_users_custom_role" ON "users"("custom_role_id");

-- AddForeignKey: SET NULL so cascade-deleting a company (which cascades its
-- custom_roles) never fails on assigned users; the API layer separately blocks
-- deleting a custom role that is still assigned.
ALTER TABLE "users" ADD CONSTRAINT "users_custom_role_id_fkey" FOREIGN KEY ("custom_role_id") REFERENCES "custom_roles"("id") ON DELETE SET NULL ON UPDATE CASCADE;
