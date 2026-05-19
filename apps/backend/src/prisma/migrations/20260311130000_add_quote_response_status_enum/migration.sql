-- CreateEnum
CREATE TYPE "QuoteResponseStatus" AS ENUM ('PENDING', 'SUBMITTED', 'APPROVED', 'DECLINED');

-- Normalize existing data to SCREAMING_SNAKE_CASE
UPDATE "quote_responses" SET "status" = 'PENDING' WHERE "status" IN ('Pending', 'pending');
UPDATE "quote_responses" SET "status" = 'APPROVED' WHERE "status" IN ('Approved', 'approved', 'Accepted', 'accepted');
UPDATE "quote_responses" SET "status" = 'DECLINED' WHERE "status" IN ('Declined', 'declined');
UPDATE "quote_responses" SET "status" = 'SUBMITTED' WHERE "status" IN ('Submitted', 'submitted');

-- AlterColumn: change from String to QuoteResponseStatus enum
ALTER TABLE "quote_responses" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "quote_responses" ALTER COLUMN "status" TYPE "QuoteResponseStatus" USING "status"::"QuoteResponseStatus";
ALTER TABLE "quote_responses" ALTER COLUMN "status" SET DEFAULT 'PENDING';
