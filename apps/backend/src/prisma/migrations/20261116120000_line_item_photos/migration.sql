-- FOR-404: a requester's photo of an item, uploaded in the material request
-- "Add material" modal. Stored once in "files" and referenced from the request
-- line; the same file is referenced from the RFQ / PO line created from it.
ALTER TABLE "material_request_line_items"
  ADD COLUMN IF NOT EXISTS "photo_file_id" TEXT;

ALTER TABLE "rfq_line_items"
  ADD COLUMN IF NOT EXISTS "photo_file_id" TEXT;

ALTER TABLE "po_line_items"
  ADD COLUMN IF NOT EXISTS "photo_file_id" TEXT;

ALTER TABLE "material_request_line_items"
  ADD CONSTRAINT "material_request_line_items_photo_file_id_fkey"
  FOREIGN KEY ("photo_file_id") REFERENCES "files"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "rfq_line_items"
  ADD CONSTRAINT "rfq_line_items_photo_file_id_fkey"
  FOREIGN KEY ("photo_file_id") REFERENCES "files"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "po_line_items"
  ADD CONSTRAINT "po_line_items_photo_file_id_fkey"
  FOREIGN KEY ("photo_file_id") REFERENCES "files"("id") ON DELETE SET NULL ON UPDATE CASCADE;
