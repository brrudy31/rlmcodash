// Uses Web Crypto API — works in both Edge Runtime (middleware) and Node.js (API routes)

import { NextRequest } from 'next/server';

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

// Payload: "userId:timestamp"
export async function createSessionToken(userId: number): Promise<string> {
  const payload = `${userId}:${Date.now()}`;
  const key = await importKey();
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload));
  return toBase64url(`${payload}.${toHex(sig)}`);
}

export async function validateSessionToken(token: string): Promise<boolean> {
  return (await parseSessionToken(token)) !== null;
}

export async function parseSessionToken(token: string): Promise<{ userId: number } | null> {
  try {
    const decoded = fromBase64url(token);
    const dotIndex = decoded.lastIndexOf('.');
    if (dotIndex === -1) return null;
    const payload = decoded.substring(0, dotIndex);
    const sigHex = decoded.substring(dotIndex + 1);
    const key = await importKey();
    const valid = await crypto.subtle.verify(
      'HMAC',
      key,
      fromHex(sigHex).buffer as ArrayBuffer,
      new TextEncoder().encode(payload)
    );
    if (!valid) return null;
    const [userIdStr, timestampStr] = payload.split(':');
    const age = Date.now() - parseInt(timestampStr, 10);
    if (age >= SESSION_MAX_AGE_MS || age < 0) return null;
    const userId = parseInt(userIdStr, 10);
    if (isNaN(userId)) return null;
    return { userId };
  } catch {
    return null;
  }
}

export async function getUserIdFromRequest(request: NextRequest): Promise<number | null> {
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  if (!token) return null;
  const result = await parseSessionToken(token);
  return result?.userId ?? null;
}
