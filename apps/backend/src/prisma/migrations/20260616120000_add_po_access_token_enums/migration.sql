-- FOR-246: tokenised vendor PO portal. Extend the access-token model to the
-- Purchase Order so an Unactivated Vendor can view (and later acknowledge /
-- accept / decline) a PO from an emailed link. See ADR-0002 "Release 1 PO token
-- policy" amendment (2026-06-16).

-- AlterEnum
ALTER TYPE "AccessTokenSubject" ADD VALUE 'PURCHASE_ORDER';

-- AlterEnum
ALTER TYPE "AccessTokenPurpose" ADD VALUE 'PO_VIEW';
