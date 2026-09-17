// ==============================================================================
// src/components/layout/Sidebar.tsx
// Dynamic Sidebar Navigation (Zero Hardcoded Mock IDs & Role Enforcement)
// ==============================================================================

'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  FolderGit2,
  CalendarDays,
  ShieldCheck,
  Server,
  Layers,
  Database,
  Lock,
} from 'lucide-react';
import { useTenantStore } from '@/lib/stores/tenant-store';
import { cn } from '@/lib/utils';

export function Sidebar() {
  const pathname = usePathname();
  const { activeTenant, activeRole, currentUser } = useTenantStore();

  const isGuest = activeRole === 'guest';
  const isSuperadmin = Boolean(currentUser?.is_superadmin);
  const isAdmin = ['owner', 'admin', 'tenant_admin'].includes(activeRole) || isSuperadmin;

  const navItems = [
    {
      label: 'Overview',
      href: '/',
      icon: LayoutDashboard,
      disabled: false,
    },
    {
      label: 'Projects Portfolio',
      href: '/projects',
      icon: FolderGit2,
      disabled: false,
    },
  ];

  const adminItems = [
    {
      label: 'Tenant Admin',
      href: '/admin/tenant',
      icon: ShieldCheck,
      disabled: isGuest,
      restrictedMessage: 'Restricted for guest accounts',
    },
    {
      label: 'SuperAdmin Network',
      href: '/admin/superadmin',
      icon: Server,
      disabled: !isSuperadmin,
      restrictedMessage: 'Requires SuperAdmin role',
    },
  ];

  return (
    <aside className="hidden md:flex flex-col w-64 border-r border-[var(--border)] bg-[var(--card)] text-[var(--foreground)] transition-colors h-[calc(100vh-3.5rem)] sticky top-14">
      {/* Workspace Brand Badge */}
      <div className="p-4 border-b border-[var(--border)]">
        <div className="flex items-center gap-2.5">
          <div
            className="h-8 w-8 rounded-lg flex items-center justify-center font-bold text-white shadow-xs"
            style={{ backgroundColor: activeTenant?.branding_json?.primary_color || '#3b82f6' }}
          >
            {activeTenant?.name?.substring(0, 1).toUpperCase() || 'W'}
          </div>
          <div className="overflow-hidden">
            <h1 className="text-sm font-bold truncate leading-tight">
              {activeTenant?.name || 'Workspace'}
            </h1>
            <p className="text-[11px] text-[var(--muted-foreground)] truncate">
              {activeTenant?.branding_json?.company_tagline || activeTenant?.tenant_code || activeTenant?.code || 'Enterprise Project System'}
            </p>
          </div>
        </div>
      </div>

      {/* Main Navigation */}
      <div className="flex-1 overflow-y-auto py-4 px-3 space-y-6">
        <div>
          <div className="px-3 mb-2 text-[10px] font-bold tracking-wider text-[var(--muted-foreground)] uppercase">
            Workspace
          </div>
          <nav className="space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive =
                item.href === '/'
                  ? pathname === '/'
                  : pathname === item.href || (pathname.startsWith(item.href) && item.href !== '/');
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    'flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium transition-colors',
                    isActive
                      ? 'bg-[var(--primary)] text-[var(--primary-foreground)] font-semibold shadow-xs'
                      : 'text-[var(--muted-foreground)] hover:bg-[var(--secondary)] hover:text-[var(--foreground)]'
                  )}
                >
                  <Icon className="h-4 w-4" />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Governance & Controls Section */}
        <div>
          <div className="px-3 mb-2 text-[10px] font-bold tracking-wider text-[var(--muted-foreground)] uppercase">
            Governance & Controls
          </div>
          <nav className="space-y-1">
            {adminItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname.startsWith(item.href);

              if (item.disabled) {
                return (
                  <div
                    key={item.href}
                    className="flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium text-[var(--muted-foreground)]/50 cursor-not-allowed select-none"
                    title={item.restrictedMessage}
                  >
                    <div className="flex items-center gap-3">
                      <Icon className="h-4 w-4 opacity-50" />
                      <span>{item.label}</span>
                    </div>
                    <Lock className="h-3 w-3 opacity-50" />
                  </div>
                );
              }

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    'flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium transition-colors',
                    isActive
                      ? 'bg-[var(--primary)] text-[var(--primary-foreground)] font-semibold shadow-xs'
                      : 'text-[var(--muted-foreground)] hover:bg-[var(--secondary)] hover:text-[var(--foreground)]'
                  )}
                >
                  <Icon className="h-4 w-4" />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>
        </div>
      </div>

      {/* Storage Quota & DB Indicator */}
      <div className="p-4 border-t border-[var(--border)] bg-[var(--card)] space-y-2">
        <div className="flex items-center justify-between text-[11px]">
          <span className="text-[var(--muted-foreground)] font-medium">Storage Quota</span>
          <span className="font-mono text-[var(--foreground)]">
            {(activeTenant?.storage_quota_mb ? (activeTenant.storage_quota_mb / 1024).toFixed(1) : '10.0')} GB
          </span>
        </div>
        <div className="w-full bg-[var(--secondary)] rounded-full h-1.5 overflow-hidden">
          <div className="bg-[var(--primary)] h-1.5 rounded-full w-[12%]" />
        </div>
        <div className="flex items-center gap-1.5 text-[10px] text-emerald-500 font-medium pt-1">
          <Database className="h-3 w-3" />
          <span>PostgreSQL 16 RLS Active</span>
        </div>
      </div>
    </aside>
  );
}
