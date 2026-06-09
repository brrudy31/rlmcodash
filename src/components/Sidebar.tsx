'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutDashboard,
  Users,
  ListChecks,
  Send,
  BarChart2,
  Home,
  TrendingUp,
  LogOut,
  Menu,
  X,
  DoorOpen,
} from 'lucide-react';
import { useState } from 'react';
import clsx from 'clsx';

const nav = [
  { label: 'Overview', href: '/dashboard', icon: LayoutDashboard },
  { label: 'Clients', href: '/dashboard/clients', icon: Users },
  { label: 'Vendor Lists', href: '/dashboard/vendors', icon: ListChecks },
  { label: 'Send Emails', href: '/dashboard/email', icon: Send },
  { label: 'Email Tracking', href: '/dashboard/tracking', icon: BarChart2 },
  { label: 'Open Houses', href: '/dashboard/open-houses', icon: Home },
  { label: 'Door Knocking', href: '/dashboard/door-knocking', icon: DoorOpen },
  { label: 'Market Stats', href: '/dashboard/market', icon: TrendingUp },
  { label: 'Analytics', href: '/dashboard/analytics', icon: BarChart2 },

];

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/');
  }

  const sidebarContent = (
    <div className="flex flex-col h-full">
      <div className="px-6 py-7 border-b border-navy-700">
        <h1 className="text-2xl font-bold text-gold-500 tracking-widest">RLM&CO</h1>
        <p className="text-navy-400 text-xs mt-1 tracking-wide">Management Dashboard</p>
      </div>
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {nav.map(({ label, href, icon: Icon }) => {
          const active = pathname === href || (href !== '/dashboard' && pathname.startsWith(href));
          return (
            <Link
              key={href}
              href={href}
              onClick={() => setMobileOpen(false)}
              className={clsx(
                'flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-all',
                active
                  ? 'bg-gold-500/15 text-gold-400 border border-gold-500/30'
                  : 'text-navy-300 hover:bg-navy-700 hover:text-white'
              )}
            >
              <Icon className="w-4 h-4 flex-shrink-0" />
              {label}
            </Link>
          );
        })}
      </nav>
      <div className="px-3 py-4 border-t border-navy-700">
        <button
          onClick={logout}
          className="flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium text-navy-400 hover:text-red-400 hover:bg-red-400/10 transition-all w-full"
        >
          <LogOut className="w-4 h-4 flex-shrink-0" />
          Sign Out
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex flex-col w-60 bg-navy-850 border-r border-navy-700 fixed inset-y-0 left-0 z-30">
        {sidebarContent}
      </aside>

      {/* Mobile top bar */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-40 bg-navy-850 border-b border-navy-700 px-4 py-3 flex items-center justify-between">
        <h1 className="text-xl font-bold text-gold-500 tracking-widest">RLM&CO</h1>
        <button
          onClick={() => setMobileOpen(!mobileOpen)}
          className="text-navy-300 hover:text-white p-1"
        >
          {mobileOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </div>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-40 flex">
          <div
            className="fixed inset-0 bg-black/60"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="relative w-64 bg-navy-850 h-full shadow-2xl">
            {sidebarContent}
          </aside>
        </div>
      )}
    </>
  );
}
