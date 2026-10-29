import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { createAndEnqueueAudit } from '@/lib/audits';
import { requireSession } from '@/lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const body = z.object({ clientId: z.string().min(1) });

// POST /api/audits  { clientId }  ->  202 { id, status: "QUEUED" }
export async function POST(request) {
  const { error } = await requireSession(['ADMIN']);
  if (error) return error;

  const parsed = body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'clientId is required' }, { status: 400 });
  }

  const client = await prisma.client.findUnique({ where: { id: parsed.data.clientId } });
  if (!client) return NextResponse.json({ error: 'Client not found' }, { status: 404 });

  try {
    const { audit, existingId } = await createAndEnqueueAudit(client.id);
    if (!audit) {
      return NextResponse.json({ error: 'An audit is already queued or running', id: existingId }, { status: 409 });
    }
    return NextResponse.json({ id: audit.id, status: audit.status }, { status: 202 });
  } catch (err) {
    return NextResponse.json({ error: `Queue unavailable: ${err.message}` }, { status: 503 });
  }
}

// GET /api/audits?clientId=&status=  ->  list without the heavy resultJson
export async function GET(request) {
  const { error } = await requireSession(['ADMIN']);
  if (error) return error;

  const { searchParams } = new URL(request.url);
  const clientId = searchParams.get('clientId') || undefined;
  const status = searchParams.get('status') || undefined;

  const audits = await prisma.audit.findMany({
    where: { clientId, status },
    orderBy: { createdAt: 'desc' },
    take: 100,
    select: {
      id: true,
      status: true,
      progress: true,
      currentStep: true,
      overallScore: true,
      pdfPath: true,
      error: true,
      createdAt: true,
      client: { select: { id: true, name: true, url: true } },
    },
  });
  return NextResponse.json({ audits });
}
