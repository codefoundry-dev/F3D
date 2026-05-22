# Access Tokens — Tokenized Vendor Link Infrastructure (FOR-201)

The `access-tokens` module is the shared token plumbing behind every tokenized
vendor link in Forethread: viewing an RFQ, submitting a quote against an RFQ,
and uploading a vendor invoice. It is the Release-1 implementation of
[ADR-0002 — Action Tokens](adr/0002-action-token-policy.md): long-lived,
revocable, scoped tokens that authorise read/draft/commit without a vendor
session.

This document covers the **lifecycle and security guarantees** of the token.
For the *policy* (why we tokenise vendor actions instead of forcing a real
login), read ADR-0002.

## At a glance

```
┌────────────────┐      ┌──────────────────┐      ┌────────────────┐
│ issueToken()   │──►───│ Validate (guard) │──►───│ consumeToken() │
└──────┬─────────┘      └────────┬─────────┘      └────────┬───────┘
       │                         │                         │
       ▼                         ▼                         ▼
   sent to vendor       called per request          single-use closed
```

| Stage | What changes on `access_tokens` row |
| --- | --- |
| Issue | row created with `expires_at`, `tokenHash`, `attempts = 0`, `usedAt = NULL`. |
| Validate (any) | `attempts++`, `lastAttemptAt`, `lastAttemptIp` set. |
| Validate (success) | row returned; nothing else changes. |
| Consume | `usedAt = now()`. Subsequent validations return 403. |
| Revoke | `revokedAt = now()`. Subsequent validations return 403. |

## Wire format

The opaque token presented to a vendor is `<lookupId>.<secret>`:

- `lookupId` — 16 base62 characters (~95 bits of entropy). Used directly as a
  unique index for **O(1) DB lookup**. It is the public half of the token.
- `secret` — 32 random bytes encoded as base64url (~256 bits of entropy). Only
  its SHA-256 digest is stored (`token_hash`). The plaintext secret cannot be
  recovered from the database.

Total entropy of the visible token ≈ 351 bits, well above the 128-bit
acceptance bar.

SHA-256 (not Argon2/PBKDF) is used because the secret is already
crypto-strong random data — slow hashing would only slow down legitimate
validation without raising the brute-force bar. This matches the GitHub /
AWS API-key convention.

## Schema

`apps/backend/src/prisma/schema/access-token.prisma` —

```prisma
model AccessToken {
  id              String              @id @default(uuid())
  lookupId        String              @unique @map("lookup_id") @db.VarChar(32)
  tokenHash       String              @map("token_hash") @db.VarChar(128)
  subjectType     AccessTokenSubject  @map("subject_type")
  subjectId       String              @map("subject_id")
  purpose         AccessTokenPurpose
  expiresAt       DateTime            @map("expires_at")
  usedAt          DateTime?           @map("used_at")
  attempts        Int                 @default(0)
  maxAttempts     Int                 @default(10) @map("max_attempts")
  lastAttemptIp   String?             @map("last_attempt_ip") @db.VarChar(64)
  lastAttemptAt   DateTime?           @map("last_attempt_at")
  revokedAt       DateTime?           @map("revoked_at")
  createdByUserId String?             @map("created_by_user_id")
  metadata        Json?
  createdAt       DateTime            @default(now()) @map("created_at")
  updatedAt       DateTime            @updatedAt @map("updated_at")
}
```

`AccessTokenSubject` — `RFQ`, `QUOTE_RESPONSE`, `INVOICE`.
`AccessTokenPurpose` — `RFQ_VIEW`, `QUOTE_SUBMIT`, `INVOICE_UPLOAD`.

`(subjectType, subjectId)` is indexed so an issuer can find or revoke all
outstanding tokens for a given RFQ / quote / invoice.

## Producer API — `AccessTokensService`

```ts
const { token } = await accessTokens.issueToken({
  subjectType: AccessTokenSubject.QUOTE_RESPONSE,
  subjectId: quoteResponse.id,
  purpose: AccessTokenPurpose.QUOTE_SUBMIT,
  ttlMs: 14 * 24 * 60 * 60 * 1000, // 14 days
  createdByUserId: requestingUser.id,
});

// `token` is the only place the plaintext appears. Send it to the vendor and
// drop the variable — it cannot be reconstructed later.
await email.sendQuoteRequestEmail(vendor.email,
  `${vendorPortalUrl}/quote/${quoteResponse.id}?token=${token}`);
```

The service exposes:

- `issueToken(input)` — returns `{ token, record }`. Persists the SHA-256 of
  the secret. Default `maxAttempts` = 10; default `metadata` = `null`.
- `validateToken(rawToken, opts)` — see *Consumer API* below.
- `consumeToken(tokenId)` — atomic `updateMany` with `usedAt: null` guard so
  consuming a token twice throws 403.
- `revokeToken(tokenId)` — idempotent.
- `pruneExpired(graceMs?)` — deletes tokens whose `expiresAt` is older than
  `graceMs` (default 7 days). Intended for a future maintenance job.

## Consumer API — `AccessTokenGuard` + decorator

Tokenized endpoints opt in declaratively:

```ts
import {
  RequireAccessToken,
  CurrentAccessToken,
  AccessTokensService,
} from '../access-tokens';
import { Public } from '../../common/decorators/public.decorator';

@Controller('vendor-portal/quotes')
export class VendorQuotePortalController {
  constructor(private readonly accessTokens: AccessTokensService) {}

  @Public()                                 // bypass JWT auth
  @RequireAccessToken({                     // require a valid access token
    expectedPurpose: AccessTokenPurpose.QUOTE_SUBMIT,
    expectedSubjectType: AccessTokenSubject.QUOTE_RESPONSE,
  })
  @Post(':id/submit')
  async submit(
    @Param('id') id: string,
    @CurrentAccessToken() token: AccessToken,
    @Body() dto: SubmitQuoteDto,
  ) {
    // … do the work, scoped to token.subjectId === id …
    await this.accessTokens.consumeToken(token.id);  // close single-use
    return { ok: true };
  }
}
```

The guard reads the token from either `?token=…` query param or the
`X-Access-Token` header. It is registered globally as an `APP_GUARD` but
short-circuits to `true` on routes that do not opt in via
`@RequireAccessToken`.

## Rate limiting

Two layers stack:

1. **Per-token attempts (always on).** Every call to `validateToken` increments
   `attempts` *before* the secret is checked, so brute-forcing a known
   `lookupId` is bounded by `maxAttempts` (default 10). The (`maxAttempts +
   1`)th attempt returns **HTTP 429 Too Many Requests** with
   `error: "Too many attempts. Access token has been locked."`. Once locked,
   the token stays locked until manual `revokeToken` + reissue.
2. **Per-IP throttling (opt-in).** Consumer controllers may layer the project's
   standard `@Throttle({ default: { limit: N, ttl: 60000 } })` decorator on top
   for additional IP-level rate limiting. The token attempts counter alone is
   already sufficient for the FOR-201 acceptance criteria.

`lastAttemptIp` is stored on every validation for incident response and audit.

## Lifecycle invariants — what each failure mode looks like

| Condition | HTTP | `error` body |
| --- | --- | --- |
| Missing token (no query / no header) | 403 | `Access token is required` |
| Malformed token (no separator, empty halves) | 403 | `Access token is malformed` |
| Unknown `lookupId` | 403 | `Access token is invalid or has expired` |
| Wrong secret for known `lookupId` | 403 | `Access token is invalid or has expired` |
| `expiresAt` in the past | 403 | `Access token has expired` |
| `usedAt` set (consumed) | 403 | `Access token has already been used` |
| `revokedAt` set | 403 | `Access token has been revoked` |
| Purpose / subjectType mismatch | 403 | `Access token is not valid for this action` |
| `attempts > maxAttempts` | 429 | `Too many attempts. Access token has been locked.` |

Unknown-`lookupId` and bad-secret deliberately return the **same error
message** to avoid leaking whether a guessed `lookupId` exists.

## Security boundary checklist

- ✅ Entropy ≥ 128 bits (lookupId + secret ≈ 351 bits).
- ✅ Plaintext secret never persisted (SHA-256 of secret stored).
- ✅ Constant-time comparison (`crypto.timingSafeEqual`) on secret verify.
- ✅ Single-use enforced atomically via `updateMany { where: { usedAt: null } }`.
- ✅ Expiry enforced at validation.
- ✅ Per-token rate limit independent of any in-memory store.
- ✅ Tokens are revocable per-subject for the contractor.
- ✅ Validation pipeline is purpose- and subject-scoped — a token issued for
  `RFQ_VIEW` cannot be used to submit a quote, even if both target the same
  RFQ.

A formal security pass (FOR-221) will re-audit these guarantees in Week 3.

## Future work

- **Periodic `pruneExpired` job.** The service exposes `pruneExpired()` but no
  scheduler binds it yet; a daily cron will arrive with the operational
  scheduling story.
- **Commit-action OTP.** ADR-0002 names a second tier of authority for
  high-stakes vendor actions (quote submit, PO acknowledge/decline). Release 1
  collapses both tiers into a single token; the schema is ready to grow an
  OTP-gate flag if/when v2 reintroduces it.
- **Per-IP global throttling.** The `@Throttle` hook is documented but not yet
  applied to a tokenized route — that lands with the first consumer (FOR-203 /
  FOR-205).
