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
} from 'lucide-react';
import { useTenantStore } from '@/lib/stores/tenant-store';
import { useEnterpriseTheme, EnterpriseTheme } from '@/lib/stores/theme-store';
import { Badge } from '@/components/ui/badge';
import { db } from '@/lib/supabase/mock-db';

export function Header() {
  const { activeTenant, activeRole, currentUser, setActiveTenant } = useTenantStore();
  const { currentTheme, setTheme } = useEnterpriseTheme();

  const [tenantMenuOpen, setTenantMenuOpen] = React.useState(false);
  const [themeMenuOpen, setThemeMenuOpen] = React.useState(false);
  const [roleMenuOpen, setRoleMenuOpen] = React.useState(false);

  const availableTenants = db.tenants;

  const themes: { id: EnterpriseTheme; label: string; previewColor: string }[] = [
    { id: 'navy', label: 'Enterprise Navy', previewColor: '#0a1128' },
    { id: 'dark', label: 'Dark Charcoal', previewColor: '#090d16' },
    { id: 'monokai', label: 'Monokai OLED', previewColor: '#0d0e0f' },
    { id: 'high-contrast', label: 'High Contrast (AAA)', previewColor: '#000000' },
    { id: 'light', label: 'Clean Enterprise Light', previewColor: '#f8fafc' },
  ];

  const roles = [
    { id: 'tenant_admin', label: 'Tenant Admin', desc: 'Full workspace authority' },
    { id: 'project_manager', label: 'Project Manager', desc: 'Project schedule & CPM editing' },
    { id: 'contributor', label: 'Contributor', desc: 'Task execution & status updates' },
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
    <header className="sticky top-0 z-40 flex h-14 w-full items-center justify-between border-b border-[var(--border)] bg-[var(--card)] px-4 sm:px-6 transition-colors">
      {/* Left: Active Tenant Identifier & Switcher */}
      <div className="flex items-center gap-3">
        <div className="relative">
          <button
            onClick={() => {
              setTenantMenuOpen(!tenantMenuOpen);
              setThemeMenuOpen(false);
              setRoleMenuOpen(false);
            }}
            className="flex items-center gap-2.5 rounded-lg border border-[var(--border)] bg-[var(--secondary)] px-3 py-1.5 text-xs sm:text-sm font-semibold text-[var(--foreground)] hover:border-[var(--primary)] transition-all cursor-pointer shadow-xs"
          >
            <Building2 className="h-4 w-4 text-[var(--primary)]" />
            <div className="flex flex-col text-left">
              <span className="leading-tight">{activeTenant?.name || 'Select Workspace'}</span>
              <span className="text-[10px] text-[var(--muted-foreground)] font-mono">{activeTenant?.code}</span>
            </div>
            <ChevronDown className="h-3.5 w-3.5 text-[var(--muted-foreground)] ml-1" />
          </button>

          {tenantMenuOpen && (
            <div className="absolute left-0 mt-2 w-72 rounded-lg border border-[var(--border)] bg-[var(--card)] p-1.5 shadow-xl z-50 animate-in fade-in zoom-in-95 duration-100">
              <div className="px-2 py-1.5 text-[11px] font-semibold text-[var(--muted-foreground)] uppercase tracking-wider">
                Switch Tenant Workspace
              </div>
              <div className="divide-y divide-[var(--border)]">
                {availableTenants.map((tenant) => {
                  const isCurrent = activeTenant?.id === tenant.id;
                  return (
                    <button
                      key={tenant.id}
                      onClick={() => handleTenantSwitch(tenant)}
                      className="flex w-full items-center justify-between p-2 text-left rounded-md hover:bg-[var(--secondary)] transition-colors cursor-pointer"
                    >
                      <div className="flex items-center gap-2.5">
                        <div
                          className="h-7 w-7 rounded-md flex items-center justify-center text-xs font-bold text-white shadow-xs"
                          style={{ backgroundColor: tenant.branding_json.primary_color || '#3b82f6' }}
                        >
                          {tenant.name.substring(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <div className="text-xs font-semibold text-[var(--foreground)]">{tenant.name}</div>
                          <div className="text-[10px] text-[var(--muted-foreground)] font-mono">{tenant.code}</div>
                        </div>
                      </div>
                      {isCurrent && <Check className="h-4 w-4 text-[var(--primary)]" />}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Guest Scoped Indicator Pill */}
        {activeRole === 'guest' ? (
          <Badge variant="warning" className="gap-1 text-[11px] py-0.5 px-2">
            <ShieldAlert className="h-3 w-3" />
            Scoped Guest Access
          </Badge>
        ) : (
          <Badge variant="outline" className="text-[11px] py-0.5 px-2 font-mono text-[var(--muted-foreground)]">
            Production Mode
          </Badge>
        )}
      </div>

      {/* Right Controls: Role Switcher, Theme Switcher, Correlation Pill, User Profile */}
      <div className="flex items-center gap-2.5">
        {/* Role Simulator Dropdown */}
        <div className="relative">
          <button
            onClick={() => {
              setRoleMenuOpen(!roleMenuOpen);
              setTenantMenuOpen(false);
              setThemeMenuOpen(false);
            }}
            className="flex items-center gap-1.5 rounded-md border border-[var(--border)] bg-[var(--secondary)] px-2.5 py-1 text-xs font-medium text-[var(--foreground)] hover:border-[var(--primary)] transition-colors cursor-pointer"
            title="Switch User Role for RLS Scoping Verification"
          >
            <User className="h-3.5 w-3.5 text-[var(--primary)]" />
            <span className="capitalize">{activeRole.replace('_', ' ')}</span>
            <ChevronDown className="h-3 w-3 text-[var(--muted-foreground)]" />
          </button>

          {roleMenuOpen && (
            <div className="absolute right-0 mt-2 w-64 rounded-lg border border-[var(--border)] bg-[var(--card)] p-1.5 shadow-xl z-50 animate-in fade-in zoom-in-95 duration-100">
              <div className="px-2 py-1.5 text-[11px] font-semibold text-[var(--muted-foreground)] uppercase tracking-wider">
                Simulate Role (RLS Scoping)
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

        {/* Theme Switcher Dropdown */}
        <div className="relative">
          <button
            onClick={() => {
              setThemeMenuOpen(!themeMenuOpen);
              setTenantMenuOpen(false);
              setRoleMenuOpen(false);
            }}
            className="flex items-center gap-1.5 rounded-md border border-[var(--border)] bg-[var(--secondary)] p-1.5 text-xs text-[var(--foreground)] hover:border-[var(--primary)] transition-colors cursor-pointer"
            title="Switch Enterprise Theme"
          >
            <Palette className="h-4 w-4 text-[var(--primary)]" />
          </button>

          {themeMenuOpen && (
            <div className="absolute right-0 mt-2 w-56 rounded-lg border border-[var(--border)] bg-[var(--card)] p-1.5 shadow-xl z-50 animate-in fade-in zoom-in-95 duration-100">
              <div className="px-2 py-1.5 text-[11px] font-semibold text-[var(--muted-foreground)] uppercase tracking-wider">
                Theme Presets
              </div>
              {themes.map((th) => (
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
                      style={{ backgroundColor: th.previewColor }}
                    />
                    <span className="text-xs font-medium text-[var(--foreground)]">{th.label}</span>
                  </div>
                  {currentTheme === th.id && <Check className="h-3.5 w-3.5 text-[var(--primary)]" />}
                </button>
              ))}
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
