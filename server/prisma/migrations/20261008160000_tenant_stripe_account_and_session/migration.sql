-- Brings migration history in line with databases that already have these
-- (local dev via db push, prod/staging where connect-pg-simple created
-- "session"). Every statement is safe to run when the object already exists.

-- Stripe Connect: tenant's connected account (acct_...).
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "stripeAccountId" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "Tenant_stripeAccountId_key" ON "Tenant"("stripeAccountId");

-- Express sessions (connect-pg-simple). Same shape the library creates.
CREATE TABLE IF NOT EXISTS "session" (
    "sid" VARCHAR NOT NULL,
    "sess" JSON NOT NULL,
    "expire" TIMESTAMP(6) NOT NULL,
    CONSTRAINT "session_pkey" PRIMARY KEY ("sid")
);
CREATE INDEX IF NOT EXISTS "IDX_session_expire" ON "session"("expire");
