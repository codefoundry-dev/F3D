import { createHmac, timingSafeEqual } from 'crypto';

/**
 * Svix signature headers that accompany every Resend webhook (FOR-213). Resend
 * signs payloads with the Svix scheme, so we verify them the same way.
 */
export interface SvixHeaders {
  id: string;
  timestamp: string;
  signature: string;
}

export interface VerifyResendSignatureOptions {
  /** The endpoint signing secret (`whsec_…`). */
  secret: string;
  /** The exact raw request body bytes/string, before JSON parsing. */
  payload: string;
  headers: SvixHeaders;
  /** Replay window in seconds (default 5 minutes). */
  toleranceSeconds?: number;
  /** Current time in ms — injectable for tests. */
  nowMs?: number;
}

const DEFAULT_TOLERANCE_SECONDS = 5 * 60;

function constantTimeEquals(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) {
    return false;
  }
  return timingSafeEqual(ab, bb);
}

/**
 * Verify a Resend (Svix) webhook signature. Returns true only when one of the
 * `v1` signatures in the `svix-signature` header matches an HMAC-SHA256 of
 * `{id}.{timestamp}.{payload}` keyed by the base64-decoded secret, and the
 * timestamp is within the replay tolerance.
 *
 * Pure and side-effect free so it can be unit-tested with known vectors.
 */
export function verifyResendSignature(options: VerifyResendSignatureOptions): boolean {
  const { secret, payload, headers } = options;
  if (!secret || !headers.id || !headers.timestamp || !headers.signature) {
    return false;
  }

  // Reject stale/forward-dated timestamps to blunt replay attacks.
  const timestampSeconds = Number(headers.timestamp);
  if (!Number.isFinite(timestampSeconds)) {
    return false;
  }
  const nowSeconds = Math.floor((options.nowMs ?? Date.now()) / 1000);
  const tolerance = options.toleranceSeconds ?? DEFAULT_TOLERANCE_SECONDS;
  if (Math.abs(nowSeconds - timestampSeconds) > tolerance) {
    return false;
  }

  // Secrets are `whsec_<base64>`; the HMAC key is the decoded base64 portion.
  const rawSecret = secret.startsWith('whsec_') ? secret.slice('whsec_'.length) : secret;
  const key = Buffer.from(rawSecret, 'base64');

  const signedContent = `${headers.id}.${headers.timestamp}.${payload}`;
  const expected = createHmac('sha256', key).update(signedContent).digest('base64');

  // The header is a space-separated list of `version,signature` pairs.
  const candidates = headers.signature
    .split(' ')
    .map((part) => part.split(','))
    .filter(([version]) => version === 'v1')
    .map(([, sig]) => sig);

  return candidates.some((candidate) => constantTimeEquals(expected, candidate));
}
