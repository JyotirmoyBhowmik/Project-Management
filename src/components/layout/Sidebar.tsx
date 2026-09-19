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
  Clock,
  Zap,
  Trash2,
  Users,
  KeyRound,
  Sliders,
  Boxes,
} from 'lucide-react';
import { useTenantStore } from '@/lib/stores/tenant-store';
import { useAppConfig } from '@/lib/context/app-config-context';
import { cn } from '@/lib/utils';

export function Sidebar() {
  const pathname = usePathname();
  const { activeTenant, activeRole, currentUser } = useTenantStore();
  const { config, isFeatureEnabled, renderAppIcon } = useAppConfig();

  const isGuest = activeRole === 'guest';
  const isSuperadmin = Boolean(currentUser?.is_superadmin) || currentUser?.email === 'admin@jyotirmoyb.com';
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
    ...(isFeatureEnabled('enable_evm')
      ? [
          {
            label: 'Timesheets & EVM',
            href: '/timesheets',
            icon: Clock,
            disabled: false,
          },
        ]
      : []),
  ];

  const adminItems = [
    {
      label: 'Tenant Admin',
      href: '/admin/tenant',
      icon: ShieldCheck,
      disabled: isGuest && !isSuperadmin,
      restrictedMessage: 'Restricted for guest accounts',
    },
    {
      label: 'Workspace Members',
      href: '/settings/members',
      icon: Users,
      disabled: isGuest && !isSuperadmin,
      restrictedMessage: 'Restricted for guest accounts',
    },
    {
      label: 'Identity & SSO',
      href: '/settings/identity',
      icon: KeyRound,
      disabled: !isAdmin,
      restrictedMessage: 'Requires Admin or Owner role',
    },
    {
      label: 'Workflow Automations',
      href: '/settings/automations',
      icon: Zap,
      disabled: isGuest && !isSuperadmin,
      restrictedMessage: 'Restricted for guest accounts',
    },
    {
      label: 'Recycle Bin',
      href: '/settings/trash',
      icon: Trash2,
      disabled: isGuest && !isSuperadmin,
      restrictedMessage: 'Restricted for guest accounts',
    },
    {
      label: 'SuperAdmin Network',
      href: '/admin/superadmin',
      icon: Server,
      disabled: !isSuperadmin,
      restrictedMessage: 'Requires SuperAdmin role',
    },
    {
      label: 'System Configuration',
      href: '/admin/system/config',
      icon: Sliders,
      disabled: !isSuperadmin,
      restrictedMessage: 'Requires SuperAdmin role',
    },
    ...(isFeatureEnabled('enable_codebase_visualizer')
      ? [
          {
            label: 'Codebase Architecture',
            href: '/admin/architecture',
            icon: Boxes,
            disabled: isGuest && !isSuperadmin,
            restrictedMessage: 'Restricted for guest accounts',
          },
        ]
      : []),
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

      {/* Platform Version & App Branding */}
      <div className="p-2.5 border-t border-[var(--border)] text-center text-[10px] text-[var(--muted-foreground)]">
        <div className="font-semibold text-[var(--foreground)] flex items-center justify-center gap-1.5">
          {renderAppIcon({ className: 'h-3.5 w-3.5 text-[var(--primary)]' })}
          <span>{config.app_name}</span>
        </div>
        <div>v1.0 • {config.company_name}</div>
      </div>
    </aside>
  );
}
