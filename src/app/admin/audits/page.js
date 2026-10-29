import { prisma } from '@/lib/prisma';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AuditsTable } from '@/components/audits-table';

export const dynamic = 'force-dynamic';

export default async function AuditsPage() {
  const audits = await prisma.audit.findMany({
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

  return (
    <Card>
      <CardHeader>
        <CardTitle>Audits</CardTitle>
      </CardHeader>
      <CardContent>
        {/* JSON round-trip turns Dates into strings, which client components can receive. */}
        <AuditsTable initialAudits={JSON.parse(JSON.stringify(audits))} />
      </CardContent>
    </Card>
  );
}
