import { NextResponse } from 'next/server';
import { COOKIE_NAME, verifySessionToken, homeFor } from '@/lib/session';

// /admin/* -> ADMIN only, /dashboard/* -> CLIENT only, /api/* -> any signed-in user
// (route handlers then enforce role and ownership). Login/logout and the cron route
// (which has its own secret header) stay public.
export async function middleware(request) {
  const { pathname } = request.nextUrl;
  const session = await verifySessionToken(request.cookies.get(COOKIE_NAME)?.value);

  if (pathname.startsWith('/api/')) {
    if (pathname.startsWith('/api/auth/') || pathname === '/api/cron/monthly') return NextResponse.next();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    return NextResponse.next();
  }

  if (!session) {
    const url = new URL('/login', request.url);
    url.searchParams.set('next', pathname);
    return NextResponse.redirect(url);
  }
  if (pathname.startsWith('/admin') && session.role !== 'ADMIN') return NextResponse.redirect(new URL(homeFor(session.role), request.url));
  if (pathname.startsWith('/dashboard') && session.role !== 'CLIENT') return NextResponse.redirect(new URL(homeFor(session.role), request.url));
  return NextResponse.next();
}

export const config = { matcher: ['/admin/:path*', '/dashboard/:path*', '/api/:path*'] };
