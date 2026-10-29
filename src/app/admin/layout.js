import { Gauge } from 'lucide-react';
import { getSession } from '@/lib/auth';
import { AdminNav } from '@/components/admin-nav';
import { LogoutButton } from '@/components/logout-button';

export const metadata = { title: 'Admin · SEO Automation' };

export default async function AdminLayout({ children }) {
  const session = await getSession();

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="sticky top-0 z-10 border-b bg-background/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
          <div className="flex items-center gap-2.5">
            <span className="flex size-8 items-center justify-center rounded-lg bg-teal-700 text-white">
              <Gauge className="size-4" aria-hidden="true" />
            </span>
            <span className="font-semibold tracking-tight">SEO Automation</span>
            <span className="rounded-full bg-teal-50 px-2 py-0.5 text-xs font-medium text-teal-800">Admin</span>
          </div>
          <AdminNav />
          <div className="ml-auto flex items-center gap-3">
            <span className="hidden text-xs text-muted-foreground sm:inline">{session?.email}</span>
            <LogoutButton />
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl space-y-6 px-4 py-8">{children}</main>
    </div>
  );
}
