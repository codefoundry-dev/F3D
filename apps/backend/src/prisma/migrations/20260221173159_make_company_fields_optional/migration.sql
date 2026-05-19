/*
  Warnings:

  - Made the column `contact_email` on table `companies` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "companies" ALTER COLUMN "abn" DROP NOT NULL,
ALTER COLUMN "abn" SET DATA TYPE VARCHAR(50),
ALTER COLUMN "legal_address" DROP NOT NULL,
ALTER COLUMN "contact_email" SET NOT NULL;
