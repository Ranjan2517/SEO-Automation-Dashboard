'use client';

import { useEffect, useState } from 'react';
import { Check, Circle, Loader2, XCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { buttonVariants } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { StatusBadge } from '@/components/status-badge';
import { ScoreCards, IssueList } from '@/components/score-cards';
import { STEP_NAMES, progressAfter } from '@/lib/steps';

const PRIORITY_CLASS = {
  CRITICAL: 'bg-red-600 text-white',
  HIGH: 'bg-orange-600 text-white',
  MEDIUM: 'bg-amber-500 text-white',
  LOW: 'bg-green-600 text-white',
};

function StepList({ audit }) {
  const failed = audit.status === 'FAILED';
  const firstPending = STEP_NAMES.findIndex((_, i) => audit.progress < progressAfter(i));

  return (
    <ol className="space-y-2">
      {STEP_NAMES.map((name, i) => {
        const done = audit.progress >= progressAfter(i);
        const current = !done && i === firstPending;
        let icon = <Circle className="size-4 text-muted-foreground" />;
        if (done) icon = <Check className="size-4 text-green-600" />;
        else if (current && failed) icon = <XCircle className="size-4 text-destructive" />;
        else if (current && audit.status === 'RUNNING') icon = <Loader2 className="size-4 animate-spin text-blue-600" />;
        return (
          <li key={name} className={`flex items-center gap-2 text-sm ${done || current ? '' : 'text-muted-foreground'}`}>
            {icon}
            <span>
              {i + 1}. {name}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

export function AuditDetail({ initialAudit }) {
  const [audit, setAudit] = useState(initialAudit);
  const [pollError, setPollError] = useState(false);
  const active = ['QUEUED', 'RUNNING'].includes(audit.status);

  // Poll GET /api/audits/:id every 2 seconds until the audit finishes.
  useEffect(() => {
    if (!active) return;
    const timer = setInterval(async () => {
      try {
        const res = await fetch(`/api/audits/${audit.id}`, { cache: 'no-store' });
        if (!res.ok) throw new Error();
        setAudit(await res.json());
        setPollError(false);
      } catch {
        setPollError(true);
      }
    }, 2000);
    return () => clearInterval(timer);
  }, [active, audit.id]);

  const analysis = audit.resultJson?.analysis;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">{audit.client.name}</h1>
          <p className="text-sm text-muted-foreground">
            {audit.client.url} · {audit.client.businessType}, {audit.client.city}, {audit.client.state}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <StatusBadge status={audit.status} />
          {audit.hasPdf && (
            <a href={`/api/audits/${audit.id}/pdf`} target="_blank" rel="noreferrer" className={buttonVariants()}>
              Download PDF
            </a>
          )}
        </div>
      </div>

      {audit.status !== 'COMPLETED' && (
        <Card>
          <CardHeader>
            <CardTitle>{audit.status === 'FAILED' ? 'Audit failed' : 'Audit in progress'}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Progress value={audit.progress} aria-label="Audit progress" />
            <p className="text-sm text-muted-foreground tabular-nums">
              {audit.progress}%{audit.currentStep ? ` · last finished: ${audit.currentStep}` : ' · waiting for the worker to pick it up'}
            </p>
            {audit.status === 'FAILED' && <p className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{audit.error || 'Unknown error'}</p>}
            {pollError && <p className="text-xs text-amber-600">Connection problem, retrying…</p>}
            <StepList audit={audit} />
          </CardContent>
        </Card>
      )}

      {analysis && (
        <>
          <ScoreCards analysis={analysis} />

          <Card>
            <CardHeader>
              <CardTitle>Executive summary</CardTitle>
            </CardHeader>
            <CardContent className="text-sm">{analysis.executive_summary}</CardContent>
          </Card>

          <div className="grid gap-4 lg:grid-cols-3">
            <IssueList title="Critical issues" items={analysis.critical_issues} />
            <IssueList title="Important issues" items={analysis.important_issues} />
            <IssueList title="Quick wins" items={analysis.quick_wins} />
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Recommendations</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Priority</TableHead>
                    <TableHead>Finding</TableHead>
                    <TableHead>Fix</TableHead>
                    <TableHead>Impact / Effort</TableHead>
                    <TableHead>How we verify</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {analysis.recommendations.map((r, i) => (
                    <TableRow key={i} className="align-top">
                      <TableCell>
                        <Badge className={PRIORITY_CLASS[r.priority]}>{r.priority}</Badge>
                        <div className="mt-1 text-xs text-muted-foreground">{r.category}</div>
                      </TableCell>
                      <TableCell className="whitespace-normal">{r.finding}</TableCell>
                      <TableCell className="whitespace-normal">{r.fix}</TableCell>
                      <TableCell>
                        {r.estimated_impact}
                        <div className="text-xs text-muted-foreground">{r.effort}</div>
                      </TableCell>
                      <TableCell className="whitespace-normal">{r.falsifiability_check}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
