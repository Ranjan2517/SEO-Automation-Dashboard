import { getSession } from '@/lib/auth';
import { LogoutButton } from '@/components/logout-button';

export const metadata = { title: 'Your SEO Report' };

export default async function DashboardLayout({ children }) {
  const session = await getSession();

  return (
    <div className="min-h-screen bg-muted/30">
      <header className="border-b bg-background">
        <div className="mx-auto flex max-w-6xl items-center px-4 py-3">
          <span className="font-semibold">SEO Automation · Client Dashboard</span>
          <div className="ml-auto flex items-center gap-3">
            <span className="text-xs text-muted-foreground">{session?.email}</span>
            <LogoutButton />
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl space-y-6 px-4 py-6">{children}</main>
    </div>
  );
}
