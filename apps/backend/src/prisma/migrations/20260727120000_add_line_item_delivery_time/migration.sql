-- Per-line wanted delivery time-of-day ("HH:MM", 24h), carried across the
-- MR → RFQ → PO chain. Previously the Material Request wizard collected a
-- Delivery Time but had nowhere to put it, so it was encoded into the line's
-- free-text notes and never reached the RFQ or PO as a field.
--
-- Additive and nullable on every table, so existing rows stay valid and the
-- migration is safe to deploy ahead of the application code.

ALTER TABLE "material_request_line_items" ADD COLUMN "delivery_time" VARCHAR(5);
ALTER TABLE "rfq_line_items" ADD COLUMN "delivery_time" VARCHAR(5);
ALTER TABLE "po_line_items" ADD COLUMN "delivery_time" VARCHAR(5);
