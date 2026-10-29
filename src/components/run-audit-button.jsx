'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Play } from 'lucide-react';
import { Button } from '@/components/ui/button';

// Calls POST /api/audits, then opens the audit page where progress is shown live.
export function RunAuditButton({ clientId, size = 'sm' }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function run() {
    setBusy(true);
    setError('');
    try {
      const res = await fetch('/api/audits', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ clientId }),
      });
      const data = await res.json();
      // 409 means one is already queued or running: just open it.
      if (res.ok || res.status === 409) return router.push(`/admin/audits/${data.id}`);
      setError(data.error || 'Could not start audit');
    } catch {
      setError('Network error');
    }
    setBusy(false);
  }

  return (
    <span className="inline-flex flex-col items-start gap-1">
      <Button size={size} onClick={run} disabled={busy} className="bg-teal-700 text-white hover:bg-teal-800">
        {busy ? <Loader2 className="size-3.5 animate-spin" aria-hidden="true" /> : <Play className="size-3.5" aria-hidden="true" />}
        {busy ? 'Queuing…' : 'Run Audit'}
      </Button>
      {error && <span className="text-xs text-destructive">{error}</span>}
    </span>
  );
}
