import { createDecipheriv, createHash, createHmac, timingSafeEqual } from 'node:crypto';

/** Deliveries older (or newer) than this are refused, so a captured request cannot be replayed. */
const SIGNATURE_TOLERANCE_SECONDS = 300;

/**
 * Checks the `X-Fyatu-Signature` header (`t=<unix seconds>,v1=<hex>`): HMAC-SHA256 of
 * `<t>.<raw body>`, keyed with the hex SHA-256 of the webhook secret
 * (https://docs.fyatu.com/v3.20/webhooks/signature-verification).
 */
export function verifyFyatuSignature(rawBody: Buffer, header: string | undefined, secret: string, nowMs = Date.now()): boolean {
  if (!header || !secret) return false;
  const parts = new Map(
    header.split(',').map((part) => {
      const at = part.indexOf('=');
      return [part.slice(0, at).trim(), part.slice(at + 1).trim()] as const;
    }),
  );
  const timestamp = parts.get('t');
  const signature = parts.get('v1');
  if (!timestamp || !signature || !/^\d+$/.test(timestamp) || !/^[0-9a-f]+$/i.test(signature)) return false;
  if (Math.abs(nowMs / 1000 - Number(timestamp)) > SIGNATURE_TOLERANCE_SECONDS) return false;

  const signingKey = createHash('sha256').update(secret, 'utf8').digest('hex');
  const expected = createHmac('sha256', signingKey).update(`${timestamp}.`).update(rawBody).digest();
  const given = Buffer.from(signature, 'hex');
  return given.length === expected.length && timingSafeEqual(given, expected);
}

/**
 * Decrypts a field of `GET /cards/{id}/secure-details`: base64 of nonce (12 bytes) + ciphertext +
 * GCM tag (16 bytes), AES-256-GCM keyed with SHA-256("fyatu/card-secrets/v1:" + API key).
 */
export function decryptFyatuSecret(value: string, apiKey: string): string {
  const raw = Buffer.from(value, 'base64');
  if (raw.length < 12 + 16) throw new Error('Malformed Fyatu secret');
  const key = createHash('sha256').update(`fyatu/card-secrets/v1:${apiKey}`, 'utf8').digest();
  const decipher = createDecipheriv('aes-256-gcm', key, raw.subarray(0, 12));
  decipher.setAuthTag(raw.subarray(raw.length - 16));
  return Buffer.concat([decipher.update(raw.subarray(12, raw.length - 16)), decipher.final()]).toString('utf8');
}
