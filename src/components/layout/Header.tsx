// ==============================================================================
// src/components/layout/Header.tsx
// Dynamic Header Component (Zero Hardcoded Values Mandate)
// Dynamic theming via database tokens & In-App Notification Center Drawer.
// ==============================================================================

'use client';

import * as React from 'react';
import {
  Building2,
  ChevronDown,
  Palette,
  ShieldAlert,
  Activity,
  User,
  Check,
  Bell,
  CheckCheck,
  ExternalLink,
  HelpCircle,
  BookOpen,
} from 'lucide-react';
import Link from 'next/link';
import { useTenantStore } from '@/lib/stores/tenant-store';
import { useDynamicTheme } from '@/lib/theme/dynamic-theme-provider';
import { useTenantMetadata } from '@/lib/context/tenant-metadata-context';
import { Badge } from '@/components/ui/badge';
import { db } from '@/lib/supabase/mock-db';
import { UserNotification } from '@/types/database';

export function Header() {
  const { activeTenant, activeRole, currentUser, setActiveTenant } = useTenantStore();
  const { activeThemeId, systemThemes, setTheme } = useDynamicTheme();
  const { rolePermissions } = useTenantMetadata();

  const [tenantMenuOpen, setTenantMenuOpen] = React.useState(false);
  const [themeMenuOpen, setThemeMenuOpen] = React.useState(false);
  const [roleMenuOpen, setRoleMenuOpen] = React.useState(false);
  const [notifMenuOpen, setNotifMenuOpen] = React.useState(false);
  const [helpMenuOpen, setHelpMenuOpen] = React.useState(false);

  const availableTenants = db.tenants;
  const tenantId = activeTenant?.id || 'a0000000-0000-0000-0000-000000000001';
  const userId = currentUser?.id || 'b0000000-0000-0000-0000-000000000002';

  // Notifications State
  const [notifications, setNotifications] = React.useState<UserNotification[]>([]);

  const refreshNotifications = React.useCallback(() => {
    setNotifications([...db.getUserNotifications(userId, tenantId)]);
  }, [userId, tenantId]);

  React.useEffect(() => {
    refreshNotifications();
  }, [refreshNotifications]);

  const unreadCount = React.useMemo(() => {
    return notifications.filter((n) => !n.is_read).length;
  }, [notifications]);

  const handleMarkAsRead = (notifId: string) => {
    db.markNotificationRead(notifId);
    refreshNotifications();
  };

  const handleMarkAllRead = () => {
    db.markAllNotificationsRead(userId, tenantId);
    refreshNotifications();
  };

  // Dynamic roles available for current user
  const roles = [
    { id: 'tenant_admin', label: 'Tenant Admin', desc: 'Full workspace administration' },
    { id: 'project_manager', label: 'Project Manager', desc: 'Project schedule & CPM management' },
    { id: 'member', label: 'Team Member', desc: 'Task execution & progress updates' },
    { id: 'guest', label: 'Scoped Guest', desc: 'Confined to explicitly shared projects' },
  ];

  const handleRoleSwitch = (newRole: string) => {
    if (activeTenant) {
      document.cookie = `pms_user_role=${newRole}; path=/; max-age=31536000; SameSite=Lax`;
      setActiveTenant(activeTenant, newRole);
    }
    setRoleMenuOpen(false);
  };

  const handleTenantSwitch = (tenant: typeof availableTenants[0]) => {
    setActiveTenant(tenant, activeRole);
    setTenantMenuOpen(false);
  };

  return (
    <header className="sticky top-0 z-40 flex h-14 w-full items-center justify-between border-b border-[var(--border)] bg-[var(--card)] px-4 sm:px-6 transition-colors shadow-xs">
      {/* Left: Active Tenant Identifier & Switcher */}
      <div className="flex items-center gap-3">
        <div className="relative">
          <button
            onClick={() => {
              setTenantMenuOpen(!tenantMenuOpen);
              setThemeMenuOpen(false);
              setRoleMenuOpen(false);
              setNotifMenuOpen(false);
            }}
            className="flex items-center gap-2.5 rounded-lg border border-[var(--border)] bg-[var(--secondary)] px-3 py-1.5 text-xs sm:text-sm font-semibold text-[var(--foreground)] hover:border-[var(--primary)] transition-all cursor-pointer shadow-xs"
          >
            <Building2 className="h-4 w-4 text-[var(--primary)]" />
            <div className="flex flex-col text-left">
              <span className="leading-tight">{activeTenant?.name || 'Select Workspace'}</span>
              <span className="text-[10px] text-[var(--muted-foreground)] font-mono">
                {activeTenant?.tenant_code || activeTenant?.code}
              </span>
            </div>
            <ChevronDown className="h-3.5 w-3.5 text-[var(--muted-foreground)] ml-1" />
          </button>

          {/* Tenant Switcher Dropdown */}
          {tenantMenuOpen && (
            <div className="absolute left-0 mt-2 w-64 rounded-lg border border-[var(--border)] bg-[var(--card)] p-1.5 shadow-xl z-50 animate-in fade-in zoom-in-95 duration-100">
              <div className="px-2 py-1.5 text-[11px] font-semibold text-[var(--muted-foreground)] uppercase tracking-wider">
                Available Workspaces
              </div>
              {availableTenants.map((tenant) => {
                const isCurrent = tenant.id === activeTenant?.id;
                return (
                  <button
                    key={tenant.id}
                    onClick={() => handleTenantSwitch(tenant)}
                    className="flex w-full items-center justify-between p-2 text-left rounded-md hover:bg-[var(--secondary)] transition-colors cursor-pointer"
                  >
                    <div className="flex items-center gap-2.5">
                      <div
                        className="h-7 w-7 rounded-md flex items-center justify-center text-xs font-bold text-white shadow-xs"
                        style={{ backgroundColor: tenant.branding_json?.primary_color || '#3b82f6' }}
                      >
                        {tenant.name.substring(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <div className="text-xs font-semibold text-[var(--foreground)]">{tenant.name}</div>
                        <div className="text-[10px] text-[var(--muted-foreground)] font-mono">
                          {tenant.tenant_code || tenant.code}
                        </div>
                      </div>
                    </div>
                    {isCurrent && <Check className="h-4 w-4 text-[var(--primary)]" />}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Right Side: Role Simulator, Dynamic Theming, Notification Drawer, and Observability */}
      <div className="flex items-center gap-2.5 sm:gap-3">
        {/* Role Simulator Pill */}
        <div className="relative">
          <button
            onClick={() => {
              setRoleMenuOpen(!roleMenuOpen);
              setTenantMenuOpen(false);
              setThemeMenuOpen(false);
              setNotifMenuOpen(false);
            }}
            className="flex items-center gap-1.5 rounded-md border border-[var(--border)] bg-[var(--secondary)] px-2.5 py-1 text-xs font-medium text-[var(--foreground)] hover:border-[var(--primary)] transition-colors cursor-pointer"
          >
            <ShieldAlert className="h-3.5 w-3.5 text-amber-500" />
            <span className="capitalize">{activeRole.replace('_', ' ')}</span>
            <ChevronDown className="h-3 w-3 text-[var(--muted-foreground)]" />
          </button>

          {roleMenuOpen && (
            <div className="absolute right-0 mt-2 w-64 rounded-lg border border-[var(--border)] bg-[var(--card)] p-1.5 shadow-xl z-50 animate-in fade-in zoom-in-95 duration-100">
              <div className="px-2 py-1.5 text-[11px] font-semibold text-[var(--muted-foreground)] uppercase tracking-wider">
                Simulate Role Context
              </div>
              {roles.map((r) => (
                <button
                  key={r.id}
                  onClick={() => handleRoleSwitch(r.id)}
                  className="flex w-full items-center justify-between p-2 text-left rounded-md hover:bg-[var(--secondary)] transition-colors cursor-pointer"
                >
                  <div>
                    <div className="text-xs font-semibold text-[var(--foreground)]">{r.label}</div>
                    <div className="text-[10px] text-[var(--muted-foreground)]">{r.desc}</div>
                  </div>
                  {activeRole === r.id && <Check className="h-4 w-4 text-[var(--primary)]" />}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Dynamic Database Theme Switcher */}
        <div className="relative">
          <button
            onClick={() => {
              setThemeMenuOpen(!themeMenuOpen);
              setTenantMenuOpen(false);
              setRoleMenuOpen(false);
              setNotifMenuOpen(false);
            }}
            className="flex items-center gap-1.5 rounded-md border border-[var(--border)] bg-[var(--secondary)] p-1.5 text-xs text-[var(--foreground)] hover:border-[var(--primary)] transition-colors cursor-pointer"
            title="Switch Dynamic Theme"
          >
            <Palette className="h-4 w-4 text-[var(--primary)]" />
          </button>

          {themeMenuOpen && (
            <div className="absolute right-0 mt-2 w-60 rounded-lg border border-[var(--border)] bg-[var(--card)] p-1.5 shadow-xl z-50 animate-in fade-in zoom-in-95 duration-100">
              <div className="px-2 py-1.5 text-[11px] font-semibold text-[var(--muted-foreground)] uppercase tracking-wider">
                Database Theme Presets
              </div>
              {systemThemes.map((th) => (
                <button
                  key={th.id}
                  onClick={() => {
                    setTheme(th.id);
                    setThemeMenuOpen(false);
                  }}
                  className="flex w-full items-center justify-between p-2 text-left rounded-md hover:bg-[var(--secondary)] transition-colors cursor-pointer"
                >
                  <div className="flex items-center gap-2">
                    <div
                      className="h-3.5 w-3.5 rounded-full border border-white/20 shadow-xs"
                      style={{ backgroundColor: th.tokens_json.background }}
                    />
                    <span className="text-xs font-medium text-[var(--foreground)]">{th.name}</span>
                  </div>
                  {activeThemeId === th.id && <Check className="h-3.5 w-3.5 text-[var(--primary)]" />}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* In-App Notification Center Drawer */}
        <div className="relative">
          <button
            onClick={() => {
              setNotifMenuOpen(!notifMenuOpen);
              setTenantMenuOpen(false);
              setThemeMenuOpen(false);
              setRoleMenuOpen(false);
            }}
            className="relative flex items-center gap-1.5 rounded-md border border-[var(--border)] bg-[var(--secondary)] p-1.5 text-xs text-[var(--foreground)] hover:border-[var(--primary)] transition-colors cursor-pointer"
            title="In-App Notifications"
          >
            <Bell className="h-4 w-4 text-[var(--foreground)]" />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-rose-500 text-[9px] font-bold text-white ring-2 ring-[var(--card)]">
                {unreadCount}
              </span>
            )}
          </button>

          {notifMenuOpen && (
            <div className="absolute right-0 mt-2 w-80 sm:w-96 rounded-xl border border-[var(--border)] bg-[var(--card)] shadow-2xl z-50 animate-in fade-in zoom-in-95 duration-100 overflow-hidden">
              <div className="flex items-center justify-between p-3 border-b border-[var(--border)] bg-[var(--secondary)]/40">
                <div className="flex items-center gap-2">
                  <Bell className="h-4 w-4 text-[var(--primary)]" />
                  <span className="text-xs font-bold text-[var(--foreground)]">Notifications</span>
                  {unreadCount > 0 && (
                    <span className="text-[10px] font-mono px-1.5 py-0.2 bg-rose-500/20 text-rose-400 rounded-full font-bold">
                      {unreadCount} new
                    </span>
                  )}
                </div>

                {unreadCount > 0 && (
                  <button
                    onClick={handleMarkAllRead}
                    className="flex items-center gap-1 text-[11px] text-[var(--primary)] hover:underline cursor-pointer"
                  >
                    <CheckCheck className="h-3.5 w-3.5" />
                    Mark all read
                  </button>
                )}
              </div>

              <div className="max-h-80 overflow-y-auto divide-y divide-[var(--border)]">
                {notifications.length === 0 ? (
                  <div className="p-6 text-center text-xs text-[var(--muted-foreground)]">
                    No notifications yet.
                  </div>
                ) : (
                  notifications.map((n) => (
                    <div
                      key={n.id}
                      onClick={() => handleMarkAsRead(n.id)}
                      className={`p-3 text-xs hover:bg-[var(--secondary)]/30 transition-colors cursor-pointer ${
                        !n.is_read ? 'bg-[var(--primary)]/5 font-semibold' : 'text-[var(--muted-foreground)]'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-bold text-[var(--foreground)] text-[11px]">{n.title}</span>
                        <span className="text-[9px] font-mono opacity-70">
                          {new Date(n.created_at).toLocaleDateString()}
                        </span>
                      </div>
                      <div className="text-[11px] leading-snug">{n.message}</div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* Documentation & Manuals Dropdown */}
        <div className="relative">
          <button
            onClick={() => {
              setHelpMenuOpen(!helpMenuOpen);
              setNotifMenuOpen(false);
              setTenantMenuOpen(false);
              setThemeMenuOpen(false);
              setRoleMenuOpen(false);
            }}
            className="flex items-center gap-1.5 rounded-md border border-[var(--border)] bg-[var(--secondary)] p-1.5 text-xs text-[var(--foreground)] hover:border-[var(--primary)] transition-colors cursor-pointer"
            title="Help & Documentation"
          >
            <HelpCircle className="h-4 w-4 text-[var(--foreground)]" />
          </button>

          {helpMenuOpen && (
            <div className="absolute right-0 mt-2 w-64 rounded-xl border border-[var(--border)] bg-[var(--card)] shadow-2xl z-50 animate-in fade-in zoom-in-95 duration-100 overflow-hidden py-1">
              <div className="px-3 py-2 border-b border-[var(--border)] bg-[var(--secondary)]/40">
                <span className="text-xs font-bold text-[var(--foreground)]">Documentation</span>
                <p className="text-[10px] text-[var(--muted-foreground)]">Enterprise PMS User & Admin Guides</p>
              </div>

              <Link
                href="/help"
                onClick={() => setHelpMenuOpen(false)}
                className="flex items-center gap-2 px-3 py-2 text-xs text-[var(--foreground)] hover:bg-[var(--secondary)] transition-colors"
              >
                <BookOpen className="h-4 w-4 text-[var(--primary)]" />
                <div>
                  <div className="font-semibold">User Manual</div>
                  <div className="text-[10px] text-[var(--muted-foreground)]">Gantt, CPM, & shortcuts</div>
                </div>
              </Link>

              <Link
                href="/admin/tenant/help"
                onClick={() => setHelpMenuOpen(false)}
                className="flex items-center gap-2 px-3 py-2 text-xs text-[var(--foreground)] hover:bg-[var(--secondary)] transition-colors"
              >
                <ShieldAlert className="h-4 w-4 text-purple-400" />
                <div>
                  <div className="font-semibold">Tenant Admin Guide</div>
                  <div className="text-[10px] text-[var(--muted-foreground)]">Calendars, roles & statuses</div>
                </div>
              </Link>

              <Link
                href="/admin/superadmin/help"
                onClick={() => setHelpMenuOpen(false)}
                className="flex items-center gap-2 px-3 py-2 text-xs text-[var(--foreground)] hover:bg-[var(--secondary)] transition-colors"
              >
                <Activity className="h-4 w-4 text-red-400" />
                <div>
                  <div className="font-semibold">SuperAdmin Manual</div>
                  <div className="text-[10px] text-[var(--muted-foreground)]">Multi-site & root admin</div>
                </div>
              </Link>
            </div>
          )}
        </div>

        {/* Observability Correlation ID Badge (Rule 4.2) */}
        <div
          className="hidden md:flex items-center gap-1.5 rounded-md bg-[var(--secondary)] px-2 py-1 text-[10px] font-mono text-[var(--muted-foreground)] border border-[var(--border)] cursor-default"
          title="Distributed Tracing Correlation ID (Rule 4.2)"
        >
          <Activity className="h-3 w-3 text-emerald-500 animate-pulse" />
          <span>trace:live</span>
        </div>

        {/* Current User Profile Pill */}
        <div className="flex items-center gap-2 pl-1">
          <div className="h-7 w-7 rounded-full bg-[var(--primary)] text-white text-xs font-bold flex items-center justify-center ring-2 ring-[var(--border)]">
            {currentUser?.full_name?.substring(0, 2).toUpperCase() || 'SA'}
          </div>
        </div>
      </div>
    </header>
  );
}
