import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { buttonVariants } from '@/components/ui/button';
import { ScoreCards, IssueList } from '@/components/score-cards';
import { ScoreHistory } from '@/components/score-history';

export const dynamic = 'force-dynamic';

const when = (d) => d.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'long', timeStyle: 'short' });

export default async function DashboardPage() {
  // A client only ever sees their own data: the id comes from the signed session, never the URL.
  const session = await getSession();
  const client = session?.clientId ? await prisma.client.findUnique({ where: { id: session.clientId } }) : null;
  if (!client) return <p className="text-sm text-muted-foreground">No client account is linked to this login.</p>;

  const [latest, history, inFlight] = await Promise.all([
    prisma.audit.findFirst({ where: { clientId: client.id, status: 'COMPLETED' }, orderBy: { createdAt: 'desc' } }),
    prisma.audit.findMany({
      where: { clientId: client.id, status: 'COMPLETED', overallScore: { not: null } },
      orderBy: { createdAt: 'asc' },
      take: 12,
      select: { id: true, createdAt: true, overallScore: true },
    }),
    prisma.audit.findFirst({ where: { clientId: client.id, status: { in: ['QUEUED', 'RUNNING'] } }, select: { progress: true } }),
  ]);

  const analysis = latest?.resultJson?.analysis;

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">{client.name}</h1>
          <p className="text-sm text-muted-foreground">
            {client.url} · {client.businessType}, {client.city}, {client.state}
          </p>
          {latest && <p className="mt-1 text-xs text-muted-foreground">Latest audit: {when(latest.createdAt)}</p>}
        </div>
        {latest?.pdfPath && (
          <a href={`/api/audits/${latest.id}/pdf`} target="_blank" rel="noreferrer" className={buttonVariants()}>
            Download PDF report
          </a>
        )}
      </div>

      {inFlight && (
        <p className="rounded-md border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800">
          A new audit is in progress ({inFlight.progress}%). Refresh this page in a minute to see it.
        </p>
      )}

      {!analysis ? (
        <Card>
          <CardContent className="pt-4 text-sm text-muted-foreground">
            Your first SEO audit has not finished yet. It will appear here as soon as it is ready.
          </CardContent>
        </Card>
      ) : (
        <>
          <ScoreCards analysis={analysis} />

          <Card>
            <CardHeader>
              <CardTitle>Summary</CardTitle>
            </CardHeader>
            <CardContent className="text-sm">{analysis.executive_summary}</CardContent>
          </Card>

          <div className="grid gap-4 lg:grid-cols-2">
            <IssueList title="Top issues to fix" items={analysis.critical_issues} />
            <IssueList title="Quick wins" items={analysis.quick_wins} />
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Score history</CardTitle>
            </CardHeader>
            <CardContent>
              <ScoreHistory audits={JSON.parse(JSON.stringify(history))} />
            </CardContent>
          </Card>
        </>
      )}
    </>
  );
}
