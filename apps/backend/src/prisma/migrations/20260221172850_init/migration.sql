-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('SuperAdmin', 'CompanyAdmin', 'ProcurementOfficer', 'FinancialOfficer', 'WarehouseOfficer', 'Foreman', 'Vendor');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('Invited', 'Active', 'Inactive');

-- CreateEnum
CREATE TYPE "CompanyType" AS ENUM ('Contractor', 'Vendor');

-- CreateEnum
CREATE TYPE "CompanyStatus" AS ENUM ('Active', 'Inactive');

-- CreateTable
CREATE TABLE "companies" (
    "id" TEXT NOT NULL,
    "type" "CompanyType" NOT NULL,
    "legal_name" VARCHAR(255) NOT NULL,
    "trade_name" VARCHAR(255),
    "abn" VARCHAR(14) NOT NULL,
    "tax_code" VARCHAR(11),
    "legal_address" TEXT NOT NULL,
    "contact_email" VARCHAR(255),
    "contact_phone" VARCHAR(50),
    "website" VARCHAR(255),
    "logo_url" VARCHAR(500),
    "status" "CompanyStatus" NOT NULL DEFAULT 'Active',
    "specialisations" TEXT[],
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "companies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "position" VARCHAR(255) NOT NULL DEFAULT '',
    "phone" VARCHAR(50),
    "password_hash" VARCHAR(255),
    "role" "UserRole" NOT NULL,
    "status" "UserStatus" NOT NULL DEFAULT 'Invited',
    "company_id" TEXT,
    "invited_by_user_id" TEXT,
    "invitation_token" VARCHAR(255),
    "invitation_token_expires_at" TIMESTAMP(3),
    "password_reset_token" VARCHAR(255),
    "password_reset_expires_at" TIMESTAMP(3),
    "refresh_token_hash" VARCHAR(255),
    "last_login_at" TIMESTAMP(3),
    "deactivated_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "email_verifications" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "otp_hash" VARCHAR(255) NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "email_verifications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "companies_abn_key" ON "companies"("abn");

-- CreateIndex
CREATE INDEX "idx_companies_type" ON "companies"("type");

-- CreateIndex
CREATE INDEX "idx_companies_legal_name" ON "companies"("legal_name");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_invitation_token_key" ON "users"("invitation_token");

-- CreateIndex
CREATE UNIQUE INDEX "users_password_reset_token_key" ON "users"("password_reset_token");

-- CreateIndex
CREATE INDEX "idx_users_company_status" ON "users"("company_id", "status");

-- CreateIndex
CREATE INDEX "idx_users_company_role" ON "users"("company_id", "role");

-- CreateIndex
CREATE INDEX "idx_users_invitation_token" ON "users"("invitation_token");

-- CreateIndex
CREATE INDEX "idx_users_reset_token" ON "users"("password_reset_token");

-- CreateIndex
CREATE INDEX "idx_email_verifications_user" ON "email_verifications"("user_id");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_invited_by_user_id_fkey" FOREIGN KEY ("invited_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_verifications" ADD CONSTRAINT "email_verifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
