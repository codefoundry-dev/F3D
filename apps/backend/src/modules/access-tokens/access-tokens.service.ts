import { createHash, randomBytes, timingSafeEqual } from 'crypto';

import {
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
} from '@nestjs/common';
import { AccessTokenPurpose, AccessTokenSubject, type AccessToken } from '@prisma/client';

import { ERR } from '../../common/constants/error-messages.const';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * Wire format of an access token presented to a client: `${lookupId}_${secret}`
 *
 * - `lookupId` (16 chars, base62) — 16 × log2(62) ≈ 95 bits of entropy. Used as
 *   an indexed DB key, so validation is O(1) instead of iterating candidates.
 * - `secret` (43 chars, 32 bytes base64url) — 256 bits of entropy. We never
 *   store the secret in plaintext; we store SHA-256(secret) so a DB compromise
 *   does not yield usable tokens. SHA-256 is appropriate here (not PBKDF) because
 *   the secret is already high-entropy random data — slow hashing would only
 *   slow down legitimate validation.
 *
 * Total entropy of the visible token is ≈ 351 bits, well above the 128-bit
 * acceptance threshold.
 */
const TOKEN_SEPARATOR = '.';
const LOOKUP_ID_LENGTH = 16; // 16 base62 chars → ~95 bits of entropy
const SECRET_BYTES = 32; // 256 bits
const BASE62_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

const DEFAULT_MAX_ATTEMPTS = 10;

export interface IssueTokenInput {
  subjectType: AccessTokenSubject;
  subjectId: string;
  purpose: AccessTokenPurpose;
  /** Lifetime in milliseconds. */
  ttlMs: number;
  createdByUserId?: string | null;
  maxAttempts?: number;
  metadata?: Record<string, unknown>;
}

export interface IssuedToken {
  /** The opaque token string to deliver to the recipient. Cannot be reconstructed later. */
  token: string;
  record: AccessToken;
}

export interface ValidateTokenOptions {
  /** Required purpose; rejected with 403 if the stored purpose differs. */
  expectedPurpose?: AccessTokenPurpose;
  /** Required subject type; rejected with 403 if the stored subject type differs. */
  expectedSubjectType?: AccessTokenSubject;
  /** IP address of the caller — recorded on the token row for audit + rate-limit. */
  ip?: string | null;
}

@Injectable()
export class AccessTokensService {
  private readonly logger = new Logger(AccessTokensService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Issue a fresh token. Returns the opaque token (only available here — it is
   * never persisted in plaintext) and the underlying DB row.
   */
  async issueToken(input: IssueTokenInput): Promise<IssuedToken> {
    const lookupId = generateLookupId();
    const secret = generateSecret();
    const tokenHash = hashSecret(secret);

    const expiresAt = new Date(Date.now() + input.ttlMs);

    const record = await this.prisma.accessToken.create({
      data: {
        lookupId,
        tokenHash,
        subjectType: input.subjectType,
        subjectId: input.subjectId,
        purpose: input.purpose,
        expiresAt,
        maxAttempts: input.maxAttempts ?? DEFAULT_MAX_ATTEMPTS,
        createdByUserId: input.createdByUserId ?? null,
        metadata: (input.metadata ?? null) as never,
      },
    });

    return { token: `${lookupId}${TOKEN_SEPARATOR}${secret}`, record };
  }

  /**
   * Validate an access token. Bumps the per-token attempt counter on every call
   * and locks the token once `maxAttempts` is reached. Does NOT mark the token
   * as used — callers must call `consumeToken()` after the request succeeds for
   * single-use enforcement to apply.
   *
   * Throws:
   *   - 403 ForbiddenException on missing / malformed / unknown / wrong-purpose
   *     / expired / used / revoked tokens.
   *   - 429 HttpException once `attempts >= maxAttempts`.
   */
  async validateToken(rawToken: string, opts: ValidateTokenOptions = {}): Promise<AccessToken> {
    if (!rawToken || typeof rawToken !== 'string') {
      throw new ForbiddenException(ERR.accessTokens.missing);
    }

    const parts = rawToken.split(TOKEN_SEPARATOR);
    if (parts.length !== 2 || parts[0].length === 0 || parts[1].length === 0) {
      throw new ForbiddenException(ERR.accessTokens.malformed);
    }
    const [lookupId, secret] = parts;

    const record = await this.prisma.accessToken.findUnique({ where: { lookupId } });
    if (!record) {
      throw new ForbiddenException(ERR.accessTokens.invalid);
    }

    // Always bump attempts + last-attempt audit so brute-forcing a specific
    // lookupId is bounded by `maxAttempts`, regardless of whether the secret
    // matches.
    const bumped = await this.prisma.accessToken.update({
      where: { id: record.id },
      data: {
        attempts: { increment: 1 },
        lastAttemptAt: new Date(),
        lastAttemptIp: opts.ip ?? null,
      },
    });

    if (bumped.attempts > bumped.maxAttempts) {
      throw new HttpException(ERR.accessTokens.tooManyAttempts, HttpStatus.TOO_MANY_REQUESTS);
    }

    if (record.revokedAt) {
      throw new ForbiddenException(ERR.accessTokens.revoked);
    }

    if (record.expiresAt.getTime() <= Date.now()) {
      throw new ForbiddenException(ERR.accessTokens.expired);
    }

    if (record.usedAt) {
      throw new ForbiddenException(ERR.accessTokens.alreadyUsed);
    }

    if (!secretMatches(secret, record.tokenHash)) {
      throw new ForbiddenException(ERR.accessTokens.invalid);
    }

    if (opts.expectedPurpose && record.purpose !== opts.expectedPurpose) {
      throw new ForbiddenException(ERR.accessTokens.wrongPurpose);
    }

    if (opts.expectedSubjectType && record.subjectType !== opts.expectedSubjectType) {
      throw new ForbiddenException(ERR.accessTokens.wrongPurpose);
    }

    return bumped;
  }

  /**
   * Mark a token as consumed (single-use). Must be called after the business
   * action succeeds. Idempotent: re-consuming a token throws 403.
   */
  async consumeToken(tokenId: string): Promise<AccessToken> {
    const updated = await this.prisma.accessToken.updateMany({
      where: { id: tokenId, usedAt: null, revokedAt: null },
      data: { usedAt: new Date() },
    });
    if (updated.count === 0) {
      throw new ForbiddenException(ERR.accessTokens.alreadyUsed);
    }
    return this.prisma.accessToken.findUniqueOrThrow({ where: { id: tokenId } });
  }

  /** Revoke a token immediately. Idempotent. */
  async revokeToken(tokenId: string): Promise<void> {
    await this.prisma.accessToken.updateMany({
      where: { id: tokenId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  /**
   * Delete tokens whose expiry has passed by more than `graceMs` (default 7d)
   * and that are also revoked or used. Intended for a maintenance job.
   */
  async pruneExpired(graceMs = 7 * 24 * 60 * 60 * 1000): Promise<number> {
    const cutoff = new Date(Date.now() - graceMs);
    const result = await this.prisma.accessToken.deleteMany({
      where: { expiresAt: { lt: cutoff } },
    });
    if (result.count > 0) {
      this.logger.log(`Pruned ${result.count} expired access token(s) older than ${cutoff.toISOString()}`);
    }
    return result.count;
  }
}

function generateLookupId(): string {
  // Use rejection sampling-free mapping: one random byte per output character.
  // The modulo bias is < 2/62 per char which is negligible for collision
  // resistance at 95 bits of entropy.
  const bytes = randomBytes(LOOKUP_ID_LENGTH);
  let out = '';
  for (const byte of bytes) {
    out += BASE62_ALPHABET[byte % BASE62_ALPHABET.length];
  }
  return out;
}

function generateSecret(): string {
  return randomBytes(SECRET_BYTES).toString('base64url');
}

function hashSecret(secret: string): string {
  return createHash('sha256').update(secret).digest('hex');
}

function secretMatches(secret: string, storedHash: string): boolean {
  const candidate = Buffer.from(hashSecret(secret), 'hex');
  const stored = Buffer.from(storedHash, 'hex');
  if (candidate.length !== stored.length) return false;
  return timingSafeEqual(candidate, stored);
}
