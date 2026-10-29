// Edge-safe (used by middleware): signs and verifies the session cookie as an HS256 JWT.
import { SignJWT, jwtVerify } from 'jose';

export const COOKIE_NAME = 'seo_session';
export const SESSION_MAX_AGE = 60 * 60 * 24 * 7; // 7 days

function secretKey() {
  const s = process.env.AUTH_SECRET;
  // Fail loudly: a missing secret must never silently log everyone out or in.
  if (!s || s.length < 16) throw new Error('AUTH_SECRET is missing or too short (min 16 chars)');
  return new TextEncoder().encode(s);
}

export async function createSessionToken({ id, email, role, clientId }) {
  return new SignJWT({ email, role, clientId: clientId ?? null })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(id)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_MAX_AGE}s`)
    .sign(secretKey());
}

// Returns { id, email, role, clientId } or null for a missing, forged or expired token.
export async function verifySessionToken(token) {
  if (!token) return null;
  const key = secretKey();
  try {
    const { payload } = await jwtVerify(token, key, { algorithms: ['HS256'] });
    return { id: payload.sub, email: payload.email, role: payload.role, clientId: payload.clientId ?? null };
  } catch {
    return null;
  }
}

export const homeFor = (role) => (role === 'ADMIN' ? '/admin/clients' : '/dashboard');
