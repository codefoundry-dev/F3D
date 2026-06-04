import { createHmac } from 'crypto';

import { verifyResendSignature } from './resend-signature';

const SECRET = `whsec_${Buffer.from('forethread-test-signing-key').toString('base64')}`;
const TIMESTAMP = '1700000000';
const NOW_MS = 1_700_000_000_000;
const SVIX_ID = 'msg_2abc';
const PAYLOAD = '{"type":"email.bounced","data":{"email_id":"abc"}}';

/** Re-implements the Svix signing the verifier expects, for building fixtures. */
function sign(secret: string, id: string, timestamp: string, payload: string): string {
  const key = Buffer.from(secret.slice('whsec_'.length), 'base64');
  const sig = createHmac('sha256', key).update(`${id}.${timestamp}.${payload}`).digest('base64');
  return `v1,${sig}`;
}

describe('verifyResendSignature', () => {
  it('accepts a correctly signed payload within the tolerance window', () => {
    const signature = sign(SECRET, SVIX_ID, TIMESTAMP, PAYLOAD);

    expect(
      verifyResendSignature({
        secret: SECRET,
        payload: PAYLOAD,
        headers: { id: SVIX_ID, timestamp: TIMESTAMP, signature },
        nowMs: NOW_MS,
      }),
    ).toBe(true);
  });

  it('accepts when one of several space-separated signatures matches', () => {
    const good = sign(SECRET, SVIX_ID, TIMESTAMP, PAYLOAD);
    const signature = `v1,AAAAinvalid ${good}`;

    expect(
      verifyResendSignature({
        secret: SECRET,
        payload: PAYLOAD,
        headers: { id: SVIX_ID, timestamp: TIMESTAMP, signature },
        nowMs: NOW_MS,
      }),
    ).toBe(true);
  });

  it('rejects a tampered payload', () => {
    const signature = sign(SECRET, SVIX_ID, TIMESTAMP, PAYLOAD);

    expect(
      verifyResendSignature({
        secret: SECRET,
        payload: `${PAYLOAD} `,
        headers: { id: SVIX_ID, timestamp: TIMESTAMP, signature },
        nowMs: NOW_MS,
      }),
    ).toBe(false);
  });

  it('rejects a signature produced with a different secret', () => {
    const otherSecret = `whsec_${Buffer.from('a-different-key').toString('base64')}`;
    const signature = sign(otherSecret, SVIX_ID, TIMESTAMP, PAYLOAD);

    expect(
      verifyResendSignature({
        secret: SECRET,
        payload: PAYLOAD,
        headers: { id: SVIX_ID, timestamp: TIMESTAMP, signature },
        nowMs: NOW_MS,
      }),
    ).toBe(false);
  });

  it('rejects a stale timestamp beyond the replay tolerance', () => {
    const signature = sign(SECRET, SVIX_ID, TIMESTAMP, PAYLOAD);

    expect(
      verifyResendSignature({
        secret: SECRET,
        payload: PAYLOAD,
        headers: { id: SVIX_ID, timestamp: TIMESTAMP, signature },
        // 10 minutes after the signed timestamp, default tolerance is 5 minutes.
        nowMs: NOW_MS + 10 * 60 * 1000,
      }),
    ).toBe(false);
  });

  it('rejects a non-numeric timestamp', () => {
    const signature = sign(SECRET, SVIX_ID, 'not-a-number', PAYLOAD);

    expect(
      verifyResendSignature({
        secret: SECRET,
        payload: PAYLOAD,
        headers: { id: SVIX_ID, timestamp: 'not-a-number', signature },
        nowMs: NOW_MS,
      }),
    ).toBe(false);
  });

  it('rejects when signature/headers are missing', () => {
    expect(
      verifyResendSignature({
        secret: SECRET,
        payload: PAYLOAD,
        headers: { id: '', timestamp: TIMESTAMP, signature: '' },
        nowMs: NOW_MS,
      }),
    ).toBe(false);
  });

  it('rejects when no secret is configured', () => {
    const signature = sign(SECRET, SVIX_ID, TIMESTAMP, PAYLOAD);

    expect(
      verifyResendSignature({
        secret: '',
        payload: PAYLOAD,
        headers: { id: SVIX_ID, timestamp: TIMESTAMP, signature },
        nowMs: NOW_MS,
      }),
    ).toBe(false);
  });

  it('uses the current clock when nowMs is omitted', () => {
    // Sign for "now" so the default Date.now() path falls inside the tolerance window.
    const nowTimestamp = String(Math.floor(Date.now() / 1000));
    const signature = sign(SECRET, SVIX_ID, nowTimestamp, PAYLOAD);

    expect(
      verifyResendSignature({
        secret: SECRET,
        payload: PAYLOAD,
        headers: { id: SVIX_ID, timestamp: nowTimestamp, signature },
        // nowMs intentionally omitted — exercises the Date.now() fallback.
      }),
    ).toBe(true);
  });

  it('treats a secret without the whsec_ prefix as the raw base64 key', () => {
    const rawSecret = Buffer.from('prefixless-signing-key').toString('base64');
    const key = Buffer.from(rawSecret, 'base64');
    const sig = createHmac('sha256', key)
      .update(`${SVIX_ID}.${TIMESTAMP}.${PAYLOAD}`)
      .digest('base64');

    expect(
      verifyResendSignature({
        secret: rawSecret,
        payload: PAYLOAD,
        headers: { id: SVIX_ID, timestamp: TIMESTAMP, signature: `v1,${sig}` },
        nowMs: NOW_MS,
      }),
    ).toBe(true);
  });

  it('ignores non-v1 signature versions', () => {
    const key = Buffer.from(SECRET.slice('whsec_'.length), 'base64');
    const raw = createHmac('sha256', key)
      .update(`${SVIX_ID}.${TIMESTAMP}.${PAYLOAD}`)
      .digest('base64');

    expect(
      verifyResendSignature({
        secret: SECRET,
        payload: PAYLOAD,
        headers: { id: SVIX_ID, timestamp: TIMESTAMP, signature: `v0,${raw}` },
        nowMs: NOW_MS,
      }),
    ).toBe(false);
  });
});
