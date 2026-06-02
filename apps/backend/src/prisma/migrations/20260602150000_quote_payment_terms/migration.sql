-- AlterTable: add quote-level payment terms (FOR-205 vendor portal quote submission)
ALTER TABLE "quote_responses" ADD COLUMN "payment_terms" TEXT;
