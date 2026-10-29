import crypto from 'crypto';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { createAndEnqueueAudit } from '@/lib/audits';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function authorised(request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const header = request.headers.get('x-cron-secret') || request.headers.get('authorization')?.replace(/^Bearer /i, '') || '';
  const a = Buffer.from(header);
  const b = Buffer.from(secret);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

// GET /api/cron/monthly  (header x-cron-secret)  ->  enqueues one audit per active client.
// Only enqueues; the separate worker process does the work, so this returns well inside Vercel's 10s limit.
export async function GET(request) {
  if (!authorised(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const clients = await prisma.client.findMany({ where: { active: true }, select: { id: true } });
  const queued = [];
  const skipped = [];
  const failed = [];

  for (const { id } of clients) {
    try {
      const { audit, existingId } = await createAndEnqueueAudit(id);
      audit ? queued.push(audit.id) : skipped.push(existingId);
    } catch (err) {
      failed.push({ clientId: id, error: err.message });
    }
  }

  return NextResponse.json({ clients: clients.length, queued: queued.length, skipped: skipped.length, failed }, { status: failed.length ? 207 : 200 });
}
