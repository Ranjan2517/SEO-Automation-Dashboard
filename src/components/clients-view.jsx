'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { CircleCheck, ExternalLink, Inbox, MapPin, Plus, Search, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AddClientForm } from '@/components/add-client-form';
import { RunAuditButton } from '@/components/run-audit-button';
import { StatusBadge } from '@/components/status-badge';
import { formatDate } from '@/components/audits-table';

const TONES = ['bg-teal-100 text-teal-800', 'bg-indigo-100 text-indigo-800', 'bg-amber-100 text-amber-800', 'bg-rose-100 text-rose-800', 'bg-sky-100 text-sky-800', 'bg-violet-100 text-violet-800'];
const initials = (name) => name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join('');
const toneFor = (name) => TONES[[...name].reduce((a, c) => a + c.charCodeAt(0), 0) % TONES.length];
const host = (url) => url.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '');

function Avatar({ name }) {
  return (
    <span aria-hidden="true" className={`flex size-10 shrink-0 items-center justify-center rounded-xl text-sm font-semibold ${toneFor(name)}`}>
      {initials(name)}
    </span>
  );
}

function ScoreChip({ score }) {
  const tone = score >= 80 ? 'bg-green-50 text-green-700 ring-green-200' : score >= 60 ? 'bg-amber-50 text-amber-700 ring-amber-200' : 'bg-red-50 text-red-700 ring-red-200';
  return <span className={`rounded-md px-2 py-0.5 text-xs font-semibold tabular-nums ring-1 ${tone}`}>{score}/100</span>;
}

function LatestAudit({ latest }) {
  if (!latest) return <span className="text-sm text-muted-foreground">Never audited</span>;
  return (
    <Link href={`/admin/audits/${latest.id}`} className="group inline-flex flex-col gap-1">
      <span className="inline-flex items-center gap-2">
        <StatusBadge status={latest.status} />
        {latest.status === 'COMPLETED' && latest.overallScore != null && <ScoreChip score={latest.overallScore} />}
      </span>
      <span className="text-xs text-muted-foreground group-hover:underline">{formatDate(latest.createdAt)}</span>
    </Link>
  );
}

function ClientIdentity({ c }) {
  return (
    <div className="flex items-center gap-3">
      <Avatar name={c.name} />
      <div className="min-w-0">
        <div className="truncate font-medium">{c.name}</div>
        <a href={c.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-teal-700 hover:underline">
          {host(c.url)}
          <ExternalLink className="size-3" aria-hidden="true" />
          <span className="sr-only">(opens in a new tab)</span>
        </a>
      </div>
    </div>
  );
}

export function ClientsView({ clients }) {
  const [query, setQuery] = useState('');
  const [formOpen, setFormOpen] = useState(clients.length === 0);
  const [notice, setNotice] = useState('');

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return clients;
    return clients.filter((c) => [c.name, c.url, c.businessType, c.city, c.state].join(' ').toLowerCase().includes(q));
  }, [clients, query]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-[220px] flex-1 sm:max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <Input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name, website or city"
            aria-label="Search clients"
            className="h-10 bg-background pl-9"
          />
        </div>
        <Button onClick={() => setFormOpen((v) => !v)} className="ml-auto bg-teal-700 text-white hover:bg-teal-800" aria-expanded={formOpen}>
          {formOpen ? <X className="size-4" aria-hidden="true" /> : <Plus className="size-4" aria-hidden="true" />}
          {formOpen ? 'Close' : 'Add client'}
        </Button>
      </div>

      {notice && (
        <p role="status" className="flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 px-4 py-2.5 text-sm text-green-800">
          <CircleCheck className="size-4 shrink-0" aria-hidden="true" />
          {notice}
        </p>
      )}

      {formOpen && (
        <Card className="border-teal-100 shadow-sm">
          <CardHeader>
            <CardTitle>New client</CardTitle>
            <p className="text-sm text-muted-foreground">Add the business, then run an audit on its website.</p>
          </CardHeader>
          <CardContent>
            <AddClientForm
              onAdded={(name) => {
                setNotice(`${name} was added. You can run its first audit below.`);
                setFormOpen(false);
                setTimeout(() => setNotice(''), 6000);
              }}
              onCancel={clients.length ? () => setFormOpen(false) : undefined}
            />
          </CardContent>
        </Card>
      )}

      <Card className="shadow-sm">
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle>
            {query ? `${shown.length} of ${clients.length} clients` : `All clients (${clients.length})`}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {clients.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-12 text-center">
              <Inbox className="size-10 text-muted-foreground/60" aria-hidden="true" />
              <p className="font-medium">No clients yet</p>
              <p className="text-sm text-muted-foreground">Add your first client above to start running SEO audits.</p>
            </div>
          ) : shown.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-12 text-center">
              <Search className="size-8 text-muted-foreground/60" aria-hidden="true" />
              <p className="font-medium">No clients match “{query}”</p>
              <Button variant="ghost" size="sm" onClick={() => setQuery('')}>
                Clear search
              </Button>
            </div>
          ) : (
            <>
              {/* Phones: one card per client */}
              <ul className="space-y-3 md:hidden">
                {shown.map((c) => (
                  <li key={c.id} className="space-y-3 rounded-xl border p-4">
                    <ClientIdentity c={c} />
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
                      <span>{c.businessType}</span>
                      <span className="inline-flex items-center gap-1">
                        <MapPin className="size-3.5" aria-hidden="true" />
                        {c.city}, {c.state}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <LatestAudit latest={c.latest} />
                      <RunAuditButton clientId={c.id} />
                    </div>
                  </li>
                ))}
              </ul>

              {/* Larger screens: table */}
              <div className="hidden md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Business</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Location</TableHead>
                      <TableHead>Latest audit</TableHead>
                      <TableHead />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {shown.map((c) => (
                      <TableRow key={c.id}>
                        <TableCell>
                          <ClientIdentity c={c} />
                        </TableCell>
                        <TableCell>
                          <span className="rounded-md bg-muted px-2 py-0.5 text-xs font-medium">{c.businessType}</span>
                        </TableCell>
                        <TableCell>
                          <span className="inline-flex items-center gap-1 text-sm">
                            <MapPin className="size-3.5 text-muted-foreground" aria-hidden="true" />
                            {c.city}, {c.state}
                          </span>
                        </TableCell>
                        <TableCell>
                          <LatestAudit latest={c.latest} />
                        </TableCell>
                        <TableCell className="text-right">
                          <RunAuditButton clientId={c.id} />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
