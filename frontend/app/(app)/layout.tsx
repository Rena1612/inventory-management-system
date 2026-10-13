'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState, type ReactNode } from 'react';

import { api, clearToken, getToken } from '@/lib/api';
import type { User } from '@/lib/types';
import { ToastProvider } from '@/components/Toast';

const NAV = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/products', label: 'Products' },
  { href: '/movements', label: 'Movements' },
  { href: '/locations', label: 'Locations' },
  { href: '/categories', label: 'Categories' },
  { href: '/suppliers', label: 'Suppliers' },
  { href: '/purchase-orders', label: 'Purchase orders' },
  { href: '/reports', label: 'Reports' },
  { href: '/settings', label: 'Settings' },
] as const;

export default function AppLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    if (getToken() === null) {
      router.replace('/login');
      return;
    }
    setReady(true);
    // Identity is only used to label the rail; a failure must not block the app.
    void api<{ user: User }>('/api/auth/me')
      .then((result) => setUser(result.user))
      .catch(() => setUser(null));
  }, [router]);

  if (!ready) {
    return <main className="p-6 text-[13px] text-ink-3">Loading…</main>;
  }

  function signOut() {
    clearToken();
    router.push('/login');
  }

  return (
    <ToastProvider>
      <div className="flex min-h-screen flex-col md:flex-row">
        <aside className="flex shrink-0 flex-col border-b border-line bg-surface md:sticky md:top-0 md:h-screen md:w-52 md:shrink-0 md:border-b-0 md:border-r print:hidden">
          <div className="flex items-center justify-between gap-3 border-b border-line px-3 py-2.5 md:block md:py-3">
            <div className="min-w-0">
              <p className="text-[13px] font-semibold text-ink">Stockroom</p>
              <p className="ref mt-0.5 truncate">{user?.full_name ?? user?.email ?? '—'}</p>
            </div>
            <button type="button" onClick={signOut} className="btn-ghost btn-sm md:hidden">
              Sign out
            </button>
          </div>

          <nav className="flex gap-1 overflow-x-auto px-2 py-2 md:flex-1 md:flex-col md:gap-0 md:overflow-x-visible md:overflow-y-auto md:pr-2">
            {NAV.map((item) => {
              const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? 'page' : undefined}
                  className={`rail-link whitespace-nowrap ${active ? 'rail-link-on' : ''}`}
                >
                  {active && (
                    <span aria-hidden className="absolute inset-y-0 left-0 w-0.5 bg-accent" />
                  )}
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="hidden border-t border-line p-2 md:block">
            {user !== null && <p className="ref mb-2 px-1">{user.role}</p>}
            <button type="button" onClick={signOut} className="btn-ghost w-full">
              Sign out
            </button>
          </div>
        </aside>

        <main className="min-w-0 flex-1 p-4 md:p-6 print:p-0">{children}</main>
      </div>
    </ToastProvider>
  );
}