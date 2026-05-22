-- FOR-201: Tokenized link infrastructure for vendor portal (RFQ view, quote
-- submission, invoice upload). High-entropy random tokens with O(1) lookup,
-- sha256-hashed secret, single-use enforcement, and per-token attempt limit.

-- CreateEnum
CREATE TYPE "AccessTokenSubject" AS ENUM ('RFQ', 'QUOTE_RESPONSE', 'INVOICE');

-- CreateEnum
CREATE TYPE "AccessTokenPurpose" AS ENUM ('RFQ_VIEW', 'QUOTE_SUBMIT', 'INVOICE_UPLOAD');

-- CreateTable
CREATE TABLE "access_tokens" (
    "id" TEXT NOT NULL,
    "lookup_id" VARCHAR(32) NOT NULL,
    "token_hash" VARCHAR(128) NOT NULL,
    "subject_type" "AccessTokenSubject" NOT NULL,
    "subject_id" TEXT NOT NULL,
    "purpose" "AccessTokenPurpose" NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "used_at" TIMESTAMP(3),
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "max_attempts" INTEGER NOT NULL DEFAULT 10,
    "last_attempt_ip" VARCHAR(64),
    "last_attempt_at" TIMESTAMP(3),
    "revoked_at" TIMESTAMP(3),
    "created_by_user_id" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "access_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "access_tokens_lookup_id_key" ON "access_tokens"("lookup_id");

-- CreateIndex
CREATE INDEX "idx_access_tokens_subject" ON "access_tokens"("subject_type", "subject_id");

-- CreateIndex
CREATE INDEX "idx_access_tokens_expires_at" ON "access_tokens"("expires_at");

-- AddForeignKey
ALTER TABLE "access_tokens" ADD CONSTRAINT "access_tokens_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
