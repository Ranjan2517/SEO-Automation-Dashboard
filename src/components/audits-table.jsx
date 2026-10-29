'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { StatusBadge } from '@/components/status-badge';

const ACTIVE = ['QUEUED', 'RUNNING'];

// Fixed locale + zone so server and browser render the same text.
export const formatDate = (d) =>
  new Date(d).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'medium', timeStyle: 'short' });

export function AuditsTable({ initialAudits }) {
  const [audits, setAudits] = useState(initialAudits);
  const anyActive = audits.some((a) => ACTIVE.includes(a.status));

  // Refresh every 2s only while something is queued or running.
  useEffect(() => {
    if (!anyActive) return;
    const timer = setInterval(async () => {
      try {
        const res = await fetch('/api/audits', { cache: 'no-store' });
        if (res.ok) setAudits((await res.json()).audits);
      } catch {
        /* keep the last known list */
      }
    }, 2000);
    return () => clearInterval(timer);
  }, [anyActive]);

  if (!audits.length) return <p className="text-sm text-muted-foreground">No audits yet. Run one from the Clients page.</p>;

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Client</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Progress</TableHead>
          <TableHead>Score</TableHead>
          <TableHead>Started</TableHead>
          <TableHead />
        </TableRow>
      </TableHeader>
      <TableBody>
        {audits.map((a) => (
          <TableRow key={a.id}>
            <TableCell>
              <div className="font-medium">{a.client.name}</div>
              <div className="text-xs text-muted-foreground">{a.client.url}</div>
            </TableCell>
            <TableCell>
              <StatusBadge status={a.status} />
            </TableCell>
            <TableCell className="tabular-nums">
              {a.progress}%{ACTIVE.includes(a.status) && a.currentStep ? <span className="ml-2 text-xs text-muted-foreground">{a.currentStep}</span> : null}
            </TableCell>
            <TableCell className="tabular-nums">{a.overallScore ?? '—'}</TableCell>
            <TableCell className="text-sm">{formatDate(a.createdAt)}</TableCell>
            <TableCell className="text-right">
              <Link href={`/admin/audits/${a.id}`} className="text-sm font-medium text-primary hover:underline">
                View
              </Link>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
