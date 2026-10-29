import Link from 'next/link';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { AuditDetail } from '@/components/audit-detail';

export const dynamic = 'force-dynamic';

export default async function AuditPage({ params }) {
  const audit = await prisma.audit.findUnique({ where: { id: params.id }, include: { client: true } });
  if (!audit) notFound();

  // Same shape as GET /api/audits/:id so the client component can swap in polled data.
  const { pdfPath, ...rest } = audit;
  const initial = JSON.parse(JSON.stringify({ ...rest, hasPdf: Boolean(pdfPath) }));

  return (
    <>
      <Link href="/admin/audits" className="text-sm text-muted-foreground hover:underline">
        ← All audits
      </Link>
      <AuditDetail initialAudit={initial} />
    </>
  );
}
