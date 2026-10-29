import { redirect } from 'next/navigation';
import { FileText, Gauge, Sparkles } from 'lucide-react';
import { getSession } from '@/lib/auth';
import { homeFor } from '@/lib/session';
import { ADMIN, CLIENT } from '@/lib/demo-accounts';
import { LoginForm } from '@/components/login-form';

export const metadata = { title: 'Sign in · SEO Automation' };
export const dynamic = 'force-dynamic';

const FEATURES = [
  { icon: Gauge, title: 'Automated audits', text: 'A 7-step crawl on demand or every month.' },
  { icon: Sparkles, title: 'AI recommendations', text: 'Prioritised fixes with a way to check each one worked.' },
  { icon: FileText, title: 'Ready-to-share reports', text: 'A clear PDF report for every audit.' },
];

export default async function LoginPage({ searchParams }) {
  const session = await getSession();
  if (session) redirect(homeFor(session.role));

  // Quick-fill demo logins only when DEMO_LOGINS=true, so passwords never reach the browser otherwise.
  const demoAccounts = process.env.DEMO_LOGINS === 'true' ? { admin: ADMIN, client: CLIENT } : null;

  return (
    // Small screens: the illustration is the whole page background behind the card.
    <div className="min-h-screen bg-[url('/images/login-hero.svg')] bg-cover bg-[position:85%_center] lg:grid lg:grid-cols-[1.1fr_1fr] lg:bg-none">
      {/* Large screens: illustration panel with the pitch */}
      <aside className="relative hidden overflow-hidden bg-[url('/images/login-hero.svg')] bg-cover bg-center text-white lg:flex lg:flex-col lg:gap-14 lg:p-14">
        <div className="absolute inset-0 bg-gradient-to-b from-black/35 via-transparent to-black/10" aria-hidden="true" />
        <div className="relative flex items-center gap-3">
          <span className="flex size-10 items-center justify-center rounded-xl bg-white/15 ring-1 ring-white/30 backdrop-blur">
            <Gauge className="size-5" aria-hidden="true" />
          </span>
          <span className="text-lg font-semibold tracking-tight">SEO Automation</span>
        </div>

        <div className="relative max-w-md space-y-8 lg:mt-6">
          <div className="space-y-3">
            <h1 className="text-4xl font-semibold leading-tight tracking-tight">Know exactly what is holding your website back.</h1>
            <p className="text-base text-teal-50/80">Automated SEO audits, plain-English findings and a clear list of what to fix first.</p>
          </div>
          <ul className="space-y-4">
            {FEATURES.map(({ icon: Icon, title, text }) => (
              <li key={title} className="flex items-start gap-3">
                <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg bg-white/12 ring-1 ring-white/25 backdrop-blur">
                  <Icon className="size-4" aria-hidden="true" />
                </span>
                <div>
                  <div className="font-medium">{title}</div>
                  <div className="text-sm text-teal-50/75">{text}</div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </aside>

      {/* Form side */}
      <main className="flex min-h-screen items-center justify-center px-4 py-10 lg:bg-white lg:bg-[url('/images/login-dots.svg')]">
        <div className="w-full max-w-md rounded-2xl border border-white/40 bg-white p-8 shadow-2xl shadow-black/20 sm:p-10 lg:border-border lg:shadow-xl lg:shadow-teal-900/5">
          <div className="mb-7 space-y-1.5">
            <div className="mb-4 flex items-center gap-2 lg:hidden">
              <span className="flex size-8 items-center justify-center rounded-lg bg-teal-700 text-white">
                <Gauge className="size-4" aria-hidden="true" />
              </span>
              <span className="font-semibold">SEO Automation</span>
            </div>
            <h2 className="text-2xl font-semibold tracking-tight">Welcome back</h2>
            <p className="text-sm text-muted-foreground">Sign in to view your SEO audits and reports.</p>
          </div>
          <LoginForm next={searchParams.next} demoAccounts={demoAccounts} />
        </div>
      </main>
    </div>
  );
}
