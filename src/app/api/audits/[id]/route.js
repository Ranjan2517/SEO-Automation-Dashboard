import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { canAccessClient, requireSession } from '@/lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// GET /api/audits/:id  ->  full audit incl. progress, resultJson and client (polled every 2s by the portal)
export async function GET(_request, { params }) {
  const { session, error } = await requireSession();
  if (error) return error;

  const audit = await prisma.audit.findUnique({
    where: { id: params.id },
    include: { client: true },
  });
  // A client asking for someone else's audit gets the same 404 as a missing one.
  if (!audit || !canAccessClient(session, audit.clientId)) return NextResponse.json({ error: 'Audit not found' }, { status: 404 });

  const { pdfPath, ...rest } = audit;
  return NextResponse.json({ ...rest, hasPdf: Boolean(pdfPath) });
}
