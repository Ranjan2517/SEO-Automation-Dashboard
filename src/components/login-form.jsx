'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { CircleAlert, Eye, EyeOff, Loader2, Lock, Mail } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

// Only follow ?next= when it stays on this site and matches the role's area.
function safeNext(next, role) {
  if (!next || !next.startsWith('/') || next.startsWith('//')) return null;
  if (next.startsWith('/admin') && role === 'ADMIN') return next;
  if (next.startsWith('/dashboard') && role === 'CLIENT') return next;
  return null;
}

// demoAccounts is only passed by the server when DEMO_LOGINS=true.
export function LoginForm({ next, demoAccounts }) {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setBusy(false);
      return setError(data.error || 'Could not sign in');
    }
    router.push(safeNext(next, data.role) || data.home);
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="space-y-5" noValidate={false}>
      <div className="space-y-1.5">
        <Label htmlFor="email">Email</Label>
        <div className="relative">
          <Mail className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="username"
            placeholder="you@company.com"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="h-11 pl-10"
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="password">Password</Label>
        <div className="relative">
          <Lock className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <Input
            id="password"
            name="password"
            type={showPassword ? 'text' : 'password'}
            autoComplete="current-password"
            placeholder="Enter your password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="h-11 pl-10 pr-11"
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            aria-label={showPassword ? 'Hide password' : 'Show password'}
            className="absolute right-1.5 top-1/2 flex size-8 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          </button>
        </div>
      </div>

      {error && (
        <p role="alert" className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700">
          <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <span>{error}</span>
        </p>
      )}

      <Button type="submit" disabled={busy} className="h-11 w-full bg-teal-700 text-base text-white hover:bg-teal-800">
        {busy ? (
          <>
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            Signing in…
          </>
        ) : (
          'Sign in'
        )}
      </Button>

      {demoAccounts && (
        <div className="border-t pt-4">
          <p className="mb-2 text-center text-xs text-muted-foreground">Demo accounts: click to fill the form</p>
          <div className="grid grid-cols-2 gap-2">
            {[
              ['Admin demo', demoAccounts.admin],
              ['Client demo', demoAccounts.client],
            ].map(([label, acc]) => (
              <button
                key={label}
                type="button"
                onClick={() => {
                  setEmail(acc.email);
                  setPassword(acc.password);
                  setError('');
                }}
                className="rounded-lg border bg-background px-3 py-2 text-sm font-medium hover:bg-muted"
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      )}
    </form>
  );
}
