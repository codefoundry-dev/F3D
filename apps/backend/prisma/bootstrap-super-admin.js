/* eslint-disable */
/**
 * Bootstrap a SUPER_ADMIN account (+ its platform company) on any environment.
 *
 * This is the minimal subset of `prisma/seed.ts` needed to get a working
 * super-admin login — no test contractors, vendors, projects or dashboard data.
 * Safe to run repeatedly: it upserts the company and the user, and on every run
 * it (re)sets the password, forces status=ACTIVE and clears any pending
 * invitation/reset tokens, so it doubles as a "repair / rotate credentials"
 * tool.
 *
 * Written in plain CommonJS (not TS) on purpose: it then runs unchanged both
 * locally (`node --env-file=.env`) and inside the deployed backend container
 * (`docker compose run -T backend node prisma/bootstrap-super-admin.js`), which
 * has @prisma/client + argon2 but NOT ts-node.
 *
 * ── Configuration (all via env) ────────────────────────────────────────────
 *   DATABASE_URL            required — connection string for the target DB
 *   SUPERADMIN_EMAIL        default: superadmin@forethread.local
 *   SUPERADMIN_PASSWORD     default: Dev@123456 (LOCAL ONLY — see safety below)
 *   SUPERADMIN_NAME         default: Super Admin
 *   SUPERADMIN_COMPANY_ABN  default: FORETHREAD-PLATFORM   (upsert key)
 *   SUPERADMIN_COMPANY_NAME default: Forethread Platform
 *   BOOTSTRAP_CONFIRM       set to "yes" to allow running against a non-local DB
 *
 * ── Safety rails ──────────────────────────────────────────────────────────
 *   • The weak default password is refused unless the DB host is local — for
 *     staging/prod you MUST pass an explicit SUPERADMIN_PASSWORD.
 *   • Running against a non-local DB host requires BOOTSTRAP_CONFIRM=yes, so a
 *     stray DATABASE_URL can't silently mint an admin on the wrong environment.
 *
 * ── Usage ─────────────────────────────────────────────────────────────────
 *   Local:
 *     npm run db:bootstrap-admin                  # uses .env + defaults
 *
 *   Staging (from a shell with the staging DATABASE_URL, e.g. inside the box):
 *     SUPERADMIN_EMAIL="ops@forethread.com" \
 *     SUPERADMIN_PASSWORD='<strong-password>' \
 *     BOOTSTRAP_CONFIRM=yes \
 *     node prisma/bootstrap-super-admin.js
 */

const { PrismaClient } = require('@prisma/client');
const argon2 = require('argon2');

const prisma = new PrismaClient();

const DEFAULTS = {
  email: 'superadmin@forethread.local',
  password: 'Dev@123456',
  name: 'Super Admin',
  companyAbn: 'FORETHREAD-PLATFORM',
  companyName: 'Forethread Platform',
};

/** Parse the DB host from DATABASE_URL and decide whether it's a local target. */
function describeTarget() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error('DATABASE_URL is not set — point it at the target database first.');
  }
  let host = 'unknown';
  try {
    host = new URL(url).hostname || 'unknown';
  } catch {
    // Non-standard connection string; treat host as unknown (non-local).
  }
  const isLocal = ['localhost', '127.0.0.1', '::1', 'postgres', 'db'].includes(host);
  return { host, isLocal };
}

async function main() {
  const { host, isLocal } = describeTarget();

  const email = (process.env.SUPERADMIN_EMAIL || DEFAULTS.email).trim().toLowerCase();
  const name = process.env.SUPERADMIN_NAME || DEFAULTS.name;
  const companyAbn = process.env.SUPERADMIN_COMPANY_ABN || DEFAULTS.companyAbn;
  const companyName = process.env.SUPERADMIN_COMPANY_NAME || DEFAULTS.companyName;

  const passwordProvided = typeof process.env.SUPERADMIN_PASSWORD === 'string';
  const password = passwordProvided ? process.env.SUPERADMIN_PASSWORD : DEFAULTS.password;

  // ── Safety rail 1: don't run against a remote DB without explicit confirm ──
  if (!isLocal && process.env.BOOTSTRAP_CONFIRM !== 'yes') {
    throw new Error(
      `Refusing to bootstrap against non-local database host "${host}".\n` +
        `If this is intentional (e.g. staging), re-run with BOOTSTRAP_CONFIRM=yes.`,
    );
  }

  // ── Safety rail 2: never plant the weak default password on a remote DB ────
  if (!isLocal && !passwordProvided) {
    throw new Error(
      `Refusing to use the default development password on non-local host "${host}".\n` +
        `Set SUPERADMIN_PASSWORD to a strong value.`,
    );
  }

  if (!password || password.length < 8) {
    throw new Error('SUPERADMIN_PASSWORD must be at least 8 characters.');
  }

  console.log('🔧 Bootstrapping super admin');
  console.log(`   target db host : ${host}${isLocal ? ' (local)' : ' (REMOTE)'}`);
  console.log(`   email          : ${email}`);
  console.log(`   name           : ${name}`);
  console.log(`   password       : ${passwordProvided ? '(provided)' : '(default dev password)'}`);
  console.log(`   company        : ${companyName} [${companyAbn}]`);

  // ── Platform company (idempotent on ABN) ──────────────────────────────────
  const company = await prisma.company.upsert({
    where: { abn: companyAbn },
    update: { legalName: companyName, status: 'ACTIVE' },
    create: {
      type: 'CONTRACTOR',
      legalName: companyName,
      tradeName: 'Forethread',
      abn: companyAbn,
      contactEmail: `platform@${email.split('@')[1] || 'forethread.local'}`,
      status: 'ACTIVE',
    },
  });
  console.log(`✅ Platform company ready: ${company.legalName} (${company.id})`);

  // ── Super admin user ──────────────────────────────────────────────────────
  // Hash with default argon2 params — auth.service verifies via argon2.verify,
  // which reads the params back from the hash, so defaults are correct here.
  const passwordHash = await argon2.hash(password);

  const adminData = {
    name,
    role: 'SUPER_ADMIN',
    status: 'ACTIVE',
    passwordHash,
    companyId: company.id,
    // Clear anything that could block a clean password login.
    invitationToken: null,
    invitationTokenExpiresAt: null,
    passwordResetToken: null,
    passwordResetExpiresAt: null,
  };

  const admin = await prisma.user.upsert({
    where: { email },
    update: adminData,
    create: { email, ...adminData },
  });

  console.log(`✅ Super admin ready: ${admin.email} (${admin.status})`);
  console.log('\n🎉 Done. Login with:');
  console.log(`   email    : ${admin.email}`);
  console.log(
    `   password : ${passwordProvided ? '(the SUPERADMIN_PASSWORD you supplied)' : DEFAULTS.password}`,
  );
  console.log(
    '\nℹ️  Login is email+password, then an OTP step. Locally the OTP lands in ' +
      'Mailhog (http://localhost:8025) when RESEND_API_KEY is blank; on staging it ' +
      'is emailed to the address above.',
  );
}

main()
  .catch((e) => {
    console.error('❌ Bootstrap failed:', e.message || e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
