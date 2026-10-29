import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { requireSession } from '@/lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const text = (label) => z.string({ required_error: `${label} is required` }).trim().min(1, `${label} is required`).max(120);

const body = z.object({
  name: text('Name'),
  // Accept "clinic.com" as well as "https://clinic.com".
  url: z
    .string()
    .trim()
    .min(1, 'URL is required')
    .transform((v) => (/^https?:\/\//i.test(v) ? v : `https://${v}`))
    .refine((v) => {
      try {
        const u = new URL(v);
        return ['http:', 'https:'].includes(u.protocol) && u.hostname.includes('.');
      } catch {
        return false;
      }
    }, 'Enter a valid website URL'),
  businessType: text('Business type'),
  city: text('City'),
  state: text('State'),
});

export async function GET() {
  const { error } = await requireSession(['ADMIN']);
  if (error) return error;

  const clients = await prisma.client.findMany({
    orderBy: { createdAt: 'desc' },
    include: {
      audits: { orderBy: { createdAt: 'desc' }, take: 1, select: { id: true, status: true, overallScore: true, createdAt: true } },
    },
  });
  return NextResponse.json({ clients });
}

export async function POST(request) {
  const { error } = await requireSession(['ADMIN']);
  if (error) return error;

  const parsed = body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }
  const client = await prisma.client.create({ data: parsed.data });
  return NextResponse.json({ client }, { status: 201 });
}
