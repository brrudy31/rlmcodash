// Uses Web Crypto API — works in both Edge Runtime (middleware) and Node.js (API routes)

export const SESSION_COOKIE_NAME = 'rlm_session';
const SESSION_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

async function importKey(): Promise<CryptoKey> {
  const secret = process.env.SESSION_SECRET || 'default-secret-change-this';
  return crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify']
  );
}

function toHex(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function fromHex(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.slice(i, i + 2), 16);
  }
  return bytes;
}

function toBase64url(str: string): string {
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

function fromBase64url(b64: string): string {
  const padded = b64.replace(/-/g, '+').replace(/_/g, '/');
  const pad = padded.length % 4 === 0 ? 0 : 4 - (padded.length % 4);
  return atob(padded + '='.repeat(pad));
}

export async function createSessionToken(): Promise<string> {
  const timestamp = Date.now().toString();
  const key = await importKey();
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(timestamp));
  return toBase64url(`${timestamp}.${toHex(sig)}`);
}

export async function validateSessionToken(token: string): Promise<boolean> {
  try {
    const decoded = fromBase64url(token);
    const dotIndex = decoded.lastIndexOf('.');
    if (dotIndex === -1) return false;
    const timestamp = decoded.substring(0, dotIndex);
    const sigHex = decoded.substring(dotIndex + 1);
    const key = await importKey();
    const valid = await crypto.subtle.verify(
      'HMAC',
      key,
      fromHex(sigHex),
      new TextEncoder().encode(timestamp)
    );
    if (!valid) return false;
    const age = Date.now() - parseInt(timestamp, 10);
    return age < SESSION_MAX_AGE_MS && age > 0;
  } catch {
    return false;
  }
}
