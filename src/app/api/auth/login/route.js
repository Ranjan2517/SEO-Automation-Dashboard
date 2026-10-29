import { NextResponse } from 'next/server';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import { COOKIE_NAME, SESSION_MAX_AGE, createSessionToken, homeFor } from '@/lib/session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const body = z.object({ email: z.string().trim().toLowerCase().email(), password: z.string().min(1) });

// Compared against when the email is unknown, so response time does not reveal which emails exist.
const DUMMY_HASH = bcrypt.hashSync('not-a-real-password', 10);

export async function POST(request) {
  const parsed = body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Enter your email and password' }, { status: 400 });

  const user = await prisma.user.findUnique({ where: { email: parsed.data.email } });
  const ok = await bcrypt.compare(parsed.data.password, user?.passwordHash ?? DUMMY_HASH);
  if (!user || !ok) return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 });

  const token = await createSessionToken(user);
  const res = NextResponse.json({ role: user.role, home: homeFor(user.role) });
  res.cookies.set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: SESSION_MAX_AGE,
  });
  return res;
}
