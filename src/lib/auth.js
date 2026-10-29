import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { COOKIE_NAME, verifySessionToken } from '@/lib/session';

// Server-side (pages and route handlers). Middleware is the first gate; this is the second.
export async function getSession() {
  return verifySessionToken(cookies().get(COOKIE_NAME)?.value);
}

// For route handlers: returns { session } or { error: Response }.
export async function requireSession(roles) {
  const session = await getSession();
  if (!session) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  if (roles && !roles.includes(session.role)) return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
  return { session };
}

// A CLIENT may only touch audits of their own client; admins may touch any.
export const canAccessClient = (session, clientId) => session.role === 'ADMIN' || session.clientId === clientId;
