-- Trusted browsers: a browser that has completed the emailed sign-in code is
-- remembered, so later sign-ins from it skip the code. Only the SHA-256 of the
-- browser's token is stored; the token itself lives in an httpOnly cookie.
CREATE TABLE "trusted_devices" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "token_hash" VARCHAR(64) NOT NULL,
    "user_agent" VARCHAR(500),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_used_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "trusted_devices_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "trusted_devices_token_hash_key" ON "trusted_devices"("token_hash");
CREATE INDEX "idx_trusted_devices_user" ON "trusted_devices"("user_id");

ALTER TABLE "trusted_devices" ADD CONSTRAINT "trusted_devices_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
