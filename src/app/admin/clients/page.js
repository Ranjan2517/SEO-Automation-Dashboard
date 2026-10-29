import { Activity, CircleCheck, TrendingUp, Users } from 'lucide-react';
import { prisma } from '@/lib/prisma';
import { ClientsView } from '@/components/clients-view';

export const dynamic = 'force-dynamic';

function StatTile({ icon: Icon, label, value, tone }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border bg-background p-3 shadow-sm sm:gap-4 sm:p-4">
      <span className={`flex size-10 shrink-0 sm:size-11 items-center justify-center rounded-xl ${tone}`}>
        <Icon className="size-5" aria-hidden="true" />
      </span>
      <div>
        <div className="text-2xl font-semibold tabular-nums leading-tight">{value}</div>
        <div className="text-xs text-muted-foreground">{label}</div>
      </div>
    </div>
  );
}

export default async function ClientsPage() {
  const [rows, running, completed] = await Promise.all([
    prisma.client.findMany({
      orderBy: { createdAt: 'desc' },
      include: { audits: { orderBy: { createdAt: 'desc' }, take: 1, select: { id: true, status: true, overallScore: true, createdAt: true } } },
    }),
    prisma.audit.count({ where: { status: { in: ['QUEUED', 'RUNNING'] } } }),
    prisma.audit.count({ where: { status: 'COMPLETED' } }),
  ]);

  const clients = JSON.parse(JSON.stringify(rows.map(({ audits, ...c }) => ({ ...c, latest: audits[0] ?? null }))));
  const scores = clients.map((c) => (c.latest?.status === 'COMPLETED' ? c.latest.overallScore : null)).filter((s) => s != null);
  const avg = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null;

  return (
    <>
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Clients</h1>
        <p className="text-sm text-muted-foreground">Manage the businesses you audit and run SEO audits on demand.</p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatTile icon={Users} label="Clients" value={clients.length} tone="bg-teal-50 text-teal-700" />
        <StatTile icon={Activity} label="Audits queued or running" value={running} tone="bg-blue-50 text-blue-700" />
        <StatTile icon={CircleCheck} label="Audits completed" value={completed} tone="bg-green-50 text-green-700" />
        <StatTile icon={TrendingUp} label="Average latest score" value={avg ?? '—'} tone="bg-amber-50 text-amber-700" />
      </div>

      <ClientsView clients={clients} />
    </>
  );
}
