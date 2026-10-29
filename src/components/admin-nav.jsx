'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const LINKS = [
  { href: '/admin/clients', label: 'Clients' },
  { href: '/admin/audits', label: 'Audits' },
];

export function AdminNav() {
  const pathname = usePathname();
  return (
    <nav className="flex gap-1" aria-label="Admin">
      {LINKS.map(({ href, label }) => {
        const active = pathname === href || pathname.startsWith(href + '/');
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? 'page' : undefined}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              active ? 'bg-teal-50 text-teal-800' : 'text-muted-foreground hover:bg-muted hover:text-foreground'
            }`}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
