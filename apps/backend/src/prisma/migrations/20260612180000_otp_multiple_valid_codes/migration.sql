-- Allow a user to hold several concurrently-valid OTPs.
--
-- Previously `email_verifications` stored a single `otp_hash`/`expires_at` per
-- user, and every new login overwrote it (upsert on the unique user_id). A user
-- who acted on an earlier email (common when delivery is slow and they
-- re-request) then had their correct code rejected as "invalid".
--
-- We now keep the most-recent OTPs in a `codes` JSONB array of
-- `{ "hash": string, "expiresAt": ISO-8601 string }` (newest first, capped in
-- OtpService). OTP rows are short-lived, so dropping in-flight codes here is
-- harmless — affected users simply request a new code.

DELETE FROM "email_verifications";

ALTER TABLE "email_verifications" DROP COLUMN "otp_hash";
ALTER TABLE "email_verifications" DROP COLUMN "expires_at";
ALTER TABLE "email_verifications" ADD COLUMN "codes" JSONB NOT NULL DEFAULT '[]';
