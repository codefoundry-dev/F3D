-- FOR-200: Track who reviewed/confirmed a document extraction so confirmed
-- BOMs have a full audit trail (uploadedBy = created_by_user_id, reviewedBy =
-- confirmed_by_user_id, edits = last_edited_by_user_id + last_edited_at).

ALTER TABLE "doc_extractions"
  ADD COLUMN "last_edited_by_user_id" TEXT,
  ADD COLUMN "last_edited_at" TIMESTAMP(3),
  ADD COLUMN "confirmed_by_user_id" TEXT;

ALTER TABLE "doc_extractions"
  ADD CONSTRAINT "doc_extractions_last_edited_by_user_id_fkey"
  FOREIGN KEY ("last_edited_by_user_id") REFERENCES "users"("id")
  ON DELETE NO ACTION ON UPDATE CASCADE;

ALTER TABLE "doc_extractions"
  ADD CONSTRAINT "doc_extractions_confirmed_by_user_id_fkey"
  FOREIGN KEY ("confirmed_by_user_id") REFERENCES "users"("id")
  ON DELETE NO ACTION ON UPDATE CASCADE;
