-- ── RFQ Vendor Contacts (selected sales reps, US 5.05) ───────────────────────
-- The specific vendor reps chosen to receive an RFQ. When the RFQ is sent only
-- these reps are emailed; a vendor with no contacts falls back to the company's
-- user accounts / contact email.

-- CreateTable
CREATE TABLE IF NOT EXISTS "rfq_vendor_contacts" (
    "id" TEXT NOT NULL,
    "rfq_vendor_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,

    CONSTRAINT "rfq_vendor_contacts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "idx_rfq_vendor_contact_unique" ON "rfq_vendor_contacts"("rfq_vendor_id", "user_id");
CREATE INDEX IF NOT EXISTS "idx_rfq_vendor_contacts_vendor" ON "rfq_vendor_contacts"("rfq_vendor_id");
CREATE INDEX IF NOT EXISTS "idx_rfq_vendor_contacts_user" ON "rfq_vendor_contacts"("user_id");

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "rfq_vendor_contacts"
    ADD CONSTRAINT "rfq_vendor_contacts_rfq_vendor_id_fkey"
    FOREIGN KEY ("rfq_vendor_id") REFERENCES "rfq_vendors"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "rfq_vendor_contacts"
    ADD CONSTRAINT "rfq_vendor_contacts_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
