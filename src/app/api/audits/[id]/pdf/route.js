import fs from 'fs';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { canAccessClient, requireSession } from '@/lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// GET /api/audits/:id/pdf  ->  the generated report
export async function GET(_request, { params }) {
  const { session, error } = await requireSession();
  if (error) return error;

  const audit = await prisma.audit.findUnique({ where: { id: params.id }, select: { id: true, clientId: true, pdfPath: true } });
  if (!audit || !canAccessClient(session, audit.clientId)) return NextResponse.json({ error: 'Audit not found' }, { status: 404 });

  // pdfPath comes only from the database, never from the request.
  if (!audit.pdfPath || !fs.existsSync(audit.pdfPath)) {
    return NextResponse.json({ error: 'PDF not available yet' }, { status: 404 });
  }

  return new NextResponse(fs.readFileSync(audit.pdfPath), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="seo-audit-${audit.id}.pdf"`,
    },
  });
}
