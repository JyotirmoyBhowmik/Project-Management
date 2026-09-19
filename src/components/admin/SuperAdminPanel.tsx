'use client';

import * as React from 'react';
import {
  Server,
  Plus,
  Building2,
  Database,
  Sliders,
  CheckCircle2,
  HardDrive,
  Globe,
  Lock,
  Palette,
  Eye,
  Save,
  Copy,
  Power,
  Activity,
  Sparkles,
  Users,
  ShieldCheck,
  Skull,
} from 'lucide-react';
import Link from 'next/link';
import { dbService, DEFAULT_THEME_TOKENS, DEFAULT_SYSTEM_THEMES } from '@/lib/supabase/db-service';
import { createClient } from '@/lib/supabase/client';
import { SystemTheme, ThemeTokens, Tenant, AuditLog } from '@/types/database';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Modal } from '@/components/ui/dialog';
import { Tabs } from '@/components/ui/tabs';

export function SuperAdminPanel() {
  const [activeTab, setActiveTab] = React.useState<'tenants' | 'users' | 'themes' | 'features' | 'audit'>('tenants');
  const [tenants, setTenants] = React.useState<Tenant[]>([]);
  const [users, setUsers] = React.useState<any[]>([]);
  const [systemThemes, setSystemThemes] = React.useState<SystemTheme[]>(DEFAULT_SYSTEM_THEMES);
  const [auditLogs, setAuditLogs] = React.useState<AuditLog[]>([]);
  const [isProvisionModalOpen, setIsProvisionModalOpen] = React.useState(false);
  const [notificationMsg, setNotificationMsg] = React.useState<string | null>(null);

  // Quota Adjustment State
  const [selectedTenantForQuota, setSelectedTenantForQuota] = React.useState<Tenant | null>(null);
  const [quotaInputGB, setQuotaInputGB] = React.useState<number>(10);
  const [isQuotaModalOpen, setIsQuotaModalOpen] = React.useState(false);

  // Audit Filter State
  const [auditTenantFilter, setAuditTenantFilter] = React.useState<string>('all');
  const [auditActionFilter, setAuditActionFilter] = React.useState<string>('all');
  const [auditSearch, setAuditSearch] = React.useState<string>('');

  // New Tenant Form State
  const [name, setName] = React.useState('');
  const [code, setCode] = React.useState('');
  const [slug, setSlug] = React.useState('');
  const [domain, setDomain] = React.useState('');
  const [storageQuota, setStorageQuota] = React.useState(5120);

  // Theme Customizer State
  const [selectedThemeId, setSelectedThemeId] = React.useState<string>('navy');
  const [editingTokens, setEditingTokens] = React.useState<ThemeTokens>(DEFAULT_THEME_TOKENS);

  // Live Supabase Loading
  React.useEffect(() => {
    let isMounted = true;
    async function loadSuperAdminData() {
      try {
        const [fetchedTenants, fetchedThemes, fetchedAudit, fetchedUsers] = await Promise.all([
          dbService.getAllTenants(),
          dbService.getSystemThemes(),
          dbService.getAuditLogs(),
          dbService.getAllUsers(),
        ]);
        if (!isMounted) return;
        setTenants(fetchedTenants);
        setUsers(fetchedUsers);
        setSystemThemes(fetchedThemes);
        setAuditLogs(fetchedAudit.logs);
        if (fetchedThemes.length > 0) {
          const navy = fetchedThemes.find(t => t.id === 'navy') || fetchedThemes[0];
          setEditingTokens({ ...navy.tokens_json });
        }
      } catch (err) {
        // Graceful handling
      }
    }
    loadSuperAdminData();
    return () => {
      isMounted = false;
    };
  }, []);

  const showNotification = (msg: string) => {
    setNotificationMsg(msg);
    setTimeout(() => setNotificationMsg(null), 3500);
  };

  const handleSelectThemeToEdit = (themeId: string) => {
    setSelectedThemeId(themeId);
    const th = systemThemes.find(t => t.id === themeId);
    if (th) {
      setEditingTokens({ ...th.tokens_json });
    }
  };

  const handleUpdateToken = (tokenKey: keyof ThemeTokens, value: string) => {
    setEditingTokens(prev => ({
      ...prev,
      [tokenKey]: value,
    }));
  };

  const handleSaveTheme = async () => {
    const updated = await dbService.updateSystemTheme(selectedThemeId, {
      tokens_json: editingTokens,
    });
    const refreshed = await dbService.getSystemThemes();
    setSystemThemes(refreshed);
    showNotification(`System Theme "${updated?.name || selectedThemeId}" updated successfully across all tenants.`);
  };

  const handleProvisionTenant = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !code || !slug) return;

    const newTenant = await dbService.createTenant({
      name,
      code: code.toUpperCase(),
      tenant_code: code.toUpperCase(),
      slug: slug.toLowerCase(),
      domain: domain || null,
      logo_url: null,
      is_active: true,
      week_starts_on: 1,
      weekend_days: [0, 6],
      status: 'active',
      branding_json: {
        primary_color: editingTokens.primary || '#3b82f6',
        theme_preset: selectedThemeId as any,
        company_tagline: 'Enterprise Provisioned Tenant',
      },
      feature_flags: {
        cpm_enabled: true,
        export_enabled: true,
        audit_enabled: true,
        custom_fields_enabled: true,
        resource_heatmap_enabled: true,
      },
      storage_quota_mb: storageQuota,
    });

    const refreshed = await dbService.getAllTenants();
    setTenants(refreshed);
    setIsProvisionModalOpen(false);

    setName('');
    setCode('');
    setSlug('');
    setDomain('');
    showNotification(`Tenant "${newTenant?.name || name}" provisioned with isolated database boundary.`);
  };

  const toggleTenantStatus = async (tenantId: string) => {
    const target = tenants.find(t => t.id === tenantId);
    if (target) {
      const newStatus = target.status === 'active' ? 'suspended' : 'active';
      const supabase = createClient();
      await supabase.from('tenants').update({ status: newStatus, is_active: newStatus === 'active' }).eq('id', tenantId);
      const refreshed = await dbService.getAllTenants();
      setTenants(refreshed);
      showNotification(`Tenant ${target.code} status changed to ${newStatus.toUpperCase()}.`);
    }
  };

  const handleUpdateQuota = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTenantForQuota) return;
    const mb = Math.max(1, quotaInputGB) * 1024;
    const supabase = createClient();
    await supabase.from('tenants').update({ storage_quota_mb: mb }).eq('id', selectedTenantForQuota.id);
    const refreshed = await dbService.getAllTenants();
    setTenants(refreshed);
    setIsQuotaModalOpen(false);
    showNotification(`Storage quota for ${selectedTenantForQuota.code} updated to ${quotaInputGB} GB.`);
  };

  const filteredAuditLogs = React.useMemo(() => {
    return auditLogs.filter((log) => {
      if (auditTenantFilter !== 'all' && log.tenant_id !== auditTenantFilter) return false;
      if (auditActionFilter !== 'all' && log.action !== auditActionFilter) return false;
      if (auditSearch.trim()) {
        const q = auditSearch.toLowerCase();
        const matchEntity = log.entity_type?.toLowerCase().includes(q);
        const matchId = log.entity_id?.toLowerCase().includes(q);
        const matchActor = (log as any).actor_id?.toLowerCase().includes(q);
        if (!matchEntity && !matchId && !matchActor) return false;
      }
      return true;
    });
  }, [auditLogs, auditTenantFilter, auditActionFilter, auditSearch]);

  const toggleFeatureFlag = async (tenantId: string, flag: string) => {
    const target = tenants.find(t => t.id === tenantId);
    if (target) {
      const flags = {
        ...(target.feature_flags || {
          cpm_enabled: true,
          export_enabled: true,
          audit_enabled: true,
          custom_fields_enabled: true,
          resource_heatmap_enabled: true,
        }),
        [flag]: !target.feature_flags?.[flag],
      };
      const supabase = createClient();
      await supabase.from('tenants').update({ feature_flags: flags }).eq('id', tenantId);
      const refreshed = await dbService.getAllTenants();
      setTenants(refreshed);
      showNotification(`Updated feature flag [${flag}] for ${target.code}.`);
    }
  };

  const handleCloneTenant = async (sourceTenant: Tenant) => {
    const clonedCode = `${sourceTenant.code}-COPY`;
    const clonedSlug = `${sourceTenant.slug}-copy`;

    const cloned = await dbService.createTenant({
      name: `${sourceTenant.name} (Clone)`,
      code: clonedCode,
      tenant_code: clonedCode,
      slug: clonedSlug,
      domain: null,
      is_active: true,
      week_starts_on: sourceTenant.week_starts_on,
      weekend_days: sourceTenant.weekend_days,
      status: 'active',
      branding_json: sourceTenant.branding_json,
      feature_flags: sourceTenant.feature_flags,
      storage_quota_mb: sourceTenant.storage_quota_mb,
    });

    const refreshed = await dbService.getAllTenants();
    setTenants(refreshed);
    showNotification(`Cloned tenant ${sourceTenant.name} -> ${cloned?.name || clonedCode}.`);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-[var(--foreground)] flex items-center gap-2">
            <Server className="h-5 w-5 text-[var(--primary)]" />
            Global Multi-Site Platform Administration
          </h1>
          <p className="text-xs text-[var(--muted-foreground)] mt-0.5">
            SuperAdmin governance: tenant provisioning, master theme customizer, tier feature flags, and immutable audit logs.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {notificationMsg && (
            <div className="text-xs text-emerald-500 font-semibold flex items-center gap-1.5 animate-in fade-in">
              <CheckCircle2 className="h-4 w-4" />
              {notificationMsg}
            </div>
          )}
          <Link href="/admin/multisite/diagnostics">
            <Button variant="outline" className="gap-1.5 text-xs border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10">
              <ShieldCheck className="h-4 w-4 text-emerald-400" />
              System Diagnostics
            </Button>
          </Link>
          <Button onClick={() => setIsProvisionModalOpen(true)} className="gap-1.5 text-xs">
            <Plus className="h-4 w-4" />
            Provision New Tenant
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <Tabs
        activeTab={activeTab}
        onChange={(tab) => setActiveTab(tab as any)}
        items={[
          { id: 'tenants', label: 'Tenants & Lifecycle', icon: <Building2 className="h-4 w-4" />, count: tenants.length },
          { id: 'users', label: 'User Directory', icon: <Users className="h-4 w-4" />, count: users.length },
          { id: 'themes', label: 'Master Theme Engine', icon: <Palette className="h-4 w-4" />, count: systemThemes.length },
          { id: 'features', label: 'Feature Tiers & Flags', icon: <Sliders className="h-4 w-4" /> },
          { id: 'audit', label: 'Global Audit Trail', icon: <Activity className="h-4 w-4" />, count: auditLogs.length },
        ]}
      />

      {/* Tab: Tenants */}
      {activeTab === 'tenants' && (
        <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] overflow-hidden shadow-xs">
          <div className="p-4 border-b border-[var(--border)] bg-[var(--secondary)]/30 flex items-center justify-between">
            <h2 className="text-sm font-bold text-[var(--foreground)]">Provisioned Organizations ({tenants.length})</h2>
            <Badge variant="outline" className="font-mono text-[10px]">Global Isolation Root</Badge>
          </div>

          <div className="divide-y divide-[var(--border)]">
            {tenants.map((tenant) => (
              <div key={tenant.id} className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div
                    className="h-10 w-10 rounded-xl flex items-center justify-center font-bold text-white shadow-xs"
                    style={{ backgroundColor: tenant.branding_json?.primary_color || '#3b82f6' }}
                  >
                    {tenant.name.substring(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-[var(--foreground)]">{tenant.name}</span>
                      <Badge variant="outline" className="font-mono text-[10px]">
                        {tenant.code}
                      </Badge>
                      <Badge
                        variant={tenant.status === 'active' ? 'success' : 'secondary'}
                        className="text-[10px] py-0 uppercase"
                      >
                        {tenant.status}
                      </Badge>
                    </div>
                    <div className="text-[11px] text-[var(--muted-foreground)] flex items-center gap-3 mt-1 font-mono">
                      <span className="flex items-center gap-1">
                        <Globe className="h-3 w-3" />
                        {tenant.domain || `${tenant.slug}.pms.internal`}
                      </span>
                      <span className="flex items-center gap-1">
                        <HardDrive className="h-3 w-3" />
                        {(tenant.storage_quota_mb || 10240) / 1024} GB Quota
                      </span>
                    </div>
                  </div>
                </div>

                {/* Tenant Controls */}
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setSelectedTenantForQuota(tenant);
                      setQuotaInputGB(Math.round((tenant.storage_quota_mb || 10240) / 1024));
                      setIsQuotaModalOpen(true);
                    }}
                    className="gap-1 text-xs"
                  >
                    <HardDrive className="h-3.5 w-3.5" />
                    Adjust Quota
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleCloneTenant(tenant)}
                    className="gap-1 text-xs"
                  >
                    <Copy className="h-3.5 w-3.5" />
                    Clone
                  </Button>
                  <Button
                    size="sm"
                    variant={tenant.status === 'active' ? 'destructive' : 'outline'}
                    onClick={() => toggleTenantStatus(tenant.id)}
                    className="gap-1 text-xs"
                  >
                    <Power className="h-3.5 w-3.5" />
                    {tenant.status === 'active' ? 'Suspend' : 'Activate'}
                  </Button>
                  <Link href={`/admin/multisite/tenants/${tenant.id}/danger`}>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="gap-1 text-xs text-red-500 hover:text-red-400 hover:bg-red-500/10 border border-red-500/20"
                    >
                      <Skull className="h-3.5 w-3.5 text-red-500" />
                      Danger
                    </Button>
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab: User Directory */}
      {activeTab === 'users' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-[var(--foreground)]">Global User Directory</h2>
            <Badge variant="outline" className="text-[10px] font-mono">{users.length} registered users</Badge>
          </div>
          <div className="rounded-xl border border-[var(--border)] overflow-hidden">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-[var(--secondary)] border-b border-[var(--border)]">
                  <th className="text-left px-4 py-2.5 font-semibold text-[var(--muted-foreground)]">User</th>
                  <th className="text-left px-4 py-2.5 font-semibold text-[var(--muted-foreground)]">Email</th>
                  <th className="text-left px-4 py-2.5 font-semibold text-[var(--muted-foreground)]">Role</th>
                  <th className="text-left px-4 py-2.5 font-semibold text-[var(--muted-foreground)]">Tenant Affiliations</th>
                  <th className="text-left px-4 py-2.5 font-semibold text-[var(--muted-foreground)]">Joined</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {users.map((u: any) => (
                  <tr key={u.id} className="hover:bg-[var(--secondary)]/30 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="h-7 w-7 rounded-full bg-[var(--primary)] text-white text-[10px] font-bold flex items-center justify-center">
                          {u.full_name?.substring(0, 2).toUpperCase() || 'U'}
                        </div>
                        <div>
                          <div className="font-semibold text-[var(--foreground)]">{u.full_name}</div>
                          {u.is_superadmin && <Badge variant="destructive" className="text-[8px] mt-0.5">SuperAdmin</Badge>}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 font-mono text-[var(--muted-foreground)]">{u.email}</td>
                    <td className="px-4 py-3">
                      <Badge variant={u.is_superadmin ? 'destructive' : 'outline'} className="text-[10px]">
                        {u.is_superadmin ? 'SuperAdmin' : 'Standard'}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {(u.memberships || []).map((m: any, idx: number) => (
                          <Badge key={m.id || `${u.id}-${idx}`} variant="secondary" className="text-[9px] font-mono">
                            {m.tenant?.name || m.tenant?.slug || 'Unknown'} ({m.role})
                          </Badge>
                        ))}
                        {(!u.memberships || u.memberships.length === 0) && (
                          <span className="text-[var(--muted-foreground)] italic">No affiliations</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 font-mono text-[var(--muted-foreground)]">
                      {u.created_at ? new Date(u.created_at).toLocaleDateString() : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab: Master Theme Customizer */}
      {activeTab === 'themes' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* System Themes List */}
            <div className="lg:col-span-1 rounded-xl border border-[var(--border)] bg-[var(--card)] p-4 space-y-3 shadow-xs">
              <h3 className="text-sm font-bold text-[var(--foreground)] flex items-center gap-2">
                <Palette className="h-4 w-4 text-[var(--primary)]" />
                System Themes ({systemThemes.length})
              </h3>
              <p className="text-[11px] text-[var(--muted-foreground)]">
                Database-driven CSS variable definitions with zero hardcoded stylesheet values.
              </p>

              <div className="space-y-2 pt-2">
                {systemThemes.map((th) => (
                  <button
                    key={th.id}
                    onClick={() => handleSelectThemeToEdit(th.id)}
                    className={`w-full flex items-center justify-between p-3 rounded-lg border text-xs text-left transition-all cursor-pointer ${
                      selectedThemeId === th.id
                        ? 'border-[var(--primary)] bg-[var(--secondary)]/60 font-semibold'
                        : 'border-[var(--border)] hover:bg-[var(--secondary)]/30'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <div
                        className="w-5 h-5 rounded-full border border-black/20 shadow-xs"
                        style={{ backgroundColor: th.tokens_json.primary || '#3b82f6' }}
                      />
                      <div>
                        <div className="text-[var(--foreground)]">{th.name}</div>
                        <div className="text-[10px] text-[var(--muted-foreground)] font-mono">{th.id}</div>
                      </div>
                    </div>
                    {th.is_system_default && (
                      <Badge variant="outline" className="text-[9px]">DEFAULT</Badge>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Live Token Editor & Live Canvas */}
            <div className="lg:col-span-2 space-y-4">
              <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-5 space-y-4 shadow-xs">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-[var(--foreground)]">
                    Theme Token Customizer: <span className="text-[var(--primary)] capitalize">{selectedThemeId}</span>
                  </h3>
                  <Button size="sm" onClick={handleSaveTheme} className="gap-1 text-xs">
                    <Save className="h-3.5 w-3.5" />
                    Save Tokens to Database
                  </Button>
                </div>

                {/* Token Form */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="text-[11px] font-semibold text-[var(--muted-foreground)] block mb-1">
                      Primary Brand Color
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={editingTokens.primary || '#3b82f6'}
                        onChange={(e) => handleUpdateToken('primary', e.target.value)}
                        className="w-8 h-8 rounded-md cursor-pointer border border-[var(--border)]"
                      />
                      <Input
                        value={editingTokens.primary || ''}
                        onChange={(e) => handleUpdateToken('primary', e.target.value)}
                        className="font-mono text-xs"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-[11px] font-semibold text-[var(--muted-foreground)] block mb-1">
                      Background Color
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={editingTokens.background?.startsWith('#') ? editingTokens.background : '#0b0f19'}
                        onChange={(e) => handleUpdateToken('background', e.target.value)}
                        className="w-8 h-8 rounded-md cursor-pointer border border-[var(--border)]"
                      />
                      <Input
                        value={editingTokens.background || ''}
                        onChange={(e) => handleUpdateToken('background', e.target.value)}
                        className="font-mono text-xs"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-[11px] font-semibold text-[var(--muted-foreground)] block mb-1">
                      Surface / Card
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={editingTokens.card?.startsWith('#') ? editingTokens.card : '#111827'}
                        onChange={(e) => handleUpdateToken('card', e.target.value)}
                        className="w-8 h-8 rounded-md cursor-pointer border border-[var(--border)]"
                      />
                      <Input
                        value={editingTokens.card || ''}
                        onChange={(e) => handleUpdateToken('card', e.target.value)}
                        className="font-mono text-xs"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-[11px] font-semibold text-[var(--muted-foreground)] block mb-1">
                      Border Color
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={editingTokens.border?.startsWith('#') ? editingTokens.border : '#1f2937'}
                        onChange={(e) => handleUpdateToken('border', e.target.value)}
                        className="w-8 h-8 rounded-md cursor-pointer border border-[var(--border)]"
                      />
                      <Input
                        value={editingTokens.border || ''}
                        onChange={(e) => handleUpdateToken('border', e.target.value)}
                        className="font-mono text-xs"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-[11px] font-semibold text-[var(--muted-foreground)] block mb-1">
                      Foreground Text
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={editingTokens.foreground?.startsWith('#') ? editingTokens.foreground : '#f9fafb'}
                        onChange={(e) => handleUpdateToken('foreground', e.target.value)}
                        className="w-8 h-8 rounded-md cursor-pointer border border-[var(--border)]"
                      />
                      <Input
                        value={editingTokens.foreground || ''}
                        onChange={(e) => handleUpdateToken('foreground', e.target.value)}
                        className="font-mono text-xs"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-[11px] font-semibold text-[var(--muted-foreground)] block mb-1">
                      Accent Color
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={editingTokens.accent?.startsWith('#') ? editingTokens.accent : '#3b82f6'}
                        onChange={(e) => handleUpdateToken('accent', e.target.value)}
                        className="w-8 h-8 rounded-md cursor-pointer border border-[var(--border)]"
                      />
                      <Input
                        value={editingTokens.accent || ''}
                        onChange={(e) => handleUpdateToken('accent', e.target.value)}
                        className="font-mono text-xs"
                      />
                    </div>
                  </div>
                </div>

                {/* Live Real-Time Preview Sandbox */}
                <div className="mt-4 pt-4 border-t border-[var(--border)]">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-[var(--foreground)] flex items-center gap-1.5">
                      <Eye className="h-3.5 w-3.5" />
                      Live Theme Canvas Preview
                    </span>
                    <span className="text-[10px] text-[var(--muted-foreground)]">Rendered with active editor tokens</span>
                  </div>

                  <div
                    className="p-4 rounded-lg border transition-all space-y-3"
                    style={{
                      backgroundColor: editingTokens.background,
                      color: editingTokens.foreground,
                      borderColor: editingTokens.border,
                    }}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-sm">Interactive Sandbox Component</span>
                      <button
                        className="px-2 py-1 rounded text-xs font-bold shadow-xs cursor-pointer"
                        style={{
                          backgroundColor: editingTokens.primary,
                          color: editingTokens.primary_foreground || '#ffffff',
                        }}
                      >
                        Action Button
                      </button>
                    </div>

                    <div
                      className="p-3 rounded-md border text-xs"
                      style={{
                        backgroundColor: editingTokens.card,
                        borderColor: editingTokens.border,
                      }}
                    >
                      <div className="font-semibold mb-1">Task Card Item #418</div>
                      <div className="text-[11px]" style={{ color: editingTokens.muted_foreground }}>
                        Database architecture design & CPM schedule propagation.
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab: Feature Tiers & Flags */}
      {activeTab === 'features' && (
        <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-5 space-y-4 shadow-xs">
          <h2 className="text-sm font-bold text-[var(--foreground)]">Enterprise Feature Tiers & Module Activation</h2>
          <p className="text-xs text-[var(--muted-foreground)]">
            Granular feature toggles per tenant organization with zero hardcoded feature flags.
          </p>

          <div className="divide-y divide-[var(--border)] border border-[var(--border)] rounded-lg overflow-hidden">
            {tenants.map((t) => (
              <div key={t.id} className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <div className="font-bold text-sm text-[var(--foreground)]">{t.name}</div>
                  <div className="text-[11px] text-[var(--muted-foreground)] font-mono">{t.code}</div>
                </div>

                <div className="flex flex-wrap items-center gap-3 text-xs">
                  {['cpm_enabled', 'export_enabled', 'audit_enabled', 'custom_fields_enabled', 'resource_heatmap_enabled'].map((flag) => (
                    <div key={flag} className="flex items-center gap-1.5 bg-[var(--secondary)]/40 px-2 py-1 rounded border border-[var(--border)]">
                      <span className="text-[10px] uppercase font-mono text-[var(--muted-foreground)]">
                        {flag.replace('_enabled', '')}:
                      </span>
                      <button
                        onClick={() => toggleFeatureFlag(t.id, flag)}
                        className={`text-[10px] font-bold px-1.5 py-0.5 rounded cursor-pointer transition-colors ${
                          t.feature_flags?.[flag]
                            ? 'bg-emerald-500 text-white'
                            : 'bg-zinc-700 text-zinc-300'
                        }`}
                      >
                        {t.feature_flags?.[flag] ? 'ON' : 'OFF'}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab: Global Audit */}
      {activeTab === 'audit' && (
        <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-5 space-y-4 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-bold text-[var(--foreground)]">Cross-Tenant Global Compliance Audit Stream</h2>
              <p className="text-xs text-[var(--muted-foreground)]">
                Unified audit event ledger across all tenant boundaries.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="font-mono">{filteredAuditLogs.length} Events</Badge>
            </div>
          </div>

          {/* Audit Filters */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
            <select
              value={auditTenantFilter}
              onChange={(e) => setAuditTenantFilter(e.target.value)}
              className="rounded-md border border-[var(--border)] bg-[var(--secondary)] px-2.5 py-1.5 text-xs text-[var(--foreground)] focus:outline-none"
            >
              <option value="all">All Workspaces</option>
              {tenants.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} ({t.code})
                </option>
              ))}
            </select>

            <select
              value={auditActionFilter}
              onChange={(e) => setAuditActionFilter(e.target.value)}
              className="rounded-md border border-[var(--border)] bg-[var(--secondary)] px-2.5 py-1.5 text-xs text-[var(--foreground)] focus:outline-none"
            >
              <option value="all">All Actions</option>
              <option value="INSERT">INSERT</option>
              <option value="UPDATE">UPDATE</option>
              <option value="DELETE">DELETE</option>
            </select>

            <Input
              value={auditSearch}
              onChange={(e) => setAuditSearch(e.target.value)}
              placeholder="Search by entity or ID..."
              className="text-xs py-1"
            />
          </div>

          <div className="divide-y divide-[var(--border)] border border-[var(--border)] rounded-lg overflow-hidden text-xs max-h-[500px] overflow-y-auto">
            {filteredAuditLogs.length === 0 ? (
              <div className="p-8 text-center text-[var(--muted-foreground)] text-xs">
                No audit events match the current filter criteria.
              </div>
            ) : (
              filteredAuditLogs.slice(0, 50).map((log) => (
                <div key={log.id} className="p-3 bg-[var(--card)] space-y-1 hover:bg-[var(--secondary)]/20 transition-colors">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Badge variant={log.action === 'DELETE' ? 'destructive' : log.action === 'INSERT' ? 'success' : 'secondary'}>
                        {log.action}
                      </Badge>
                      <span className="font-semibold text-[var(--foreground)] capitalize">{log.entity_type}</span>
                      <span className="text-[10px] font-mono text-[var(--muted-foreground)]">{log.entity_id}</span>
                    </div>
                    <span className="text-[10px] font-mono text-[var(--muted-foreground)]">
                      {log.created_at ? new Date(log.created_at).toLocaleString() : '-'}
                    </span>
                  </div>
                  <div className="text-[11px] text-[var(--muted-foreground)] font-mono flex items-center justify-between">
                    <span>Tenant ID: {log.tenant_id || 'System'}</span>
                    <span>Actor: {log.actor_id || 'System'}</span>
                  </div>
                  {log.details && (
                    <details className="text-[10px] font-mono text-[var(--muted-foreground)] cursor-pointer mt-1">
                      <summary className="hover:text-[var(--foreground)]">View Mutation Payload Diff</summary>
                      <pre className="p-2 mt-1 rounded bg-[var(--secondary)] text-[10px] overflow-x-auto whitespace-pre-wrap">
                        {JSON.stringify(log.details, null, 2)}
                      </pre>
                    </details>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Provisioning Modal */}
      <Modal
        isOpen={isProvisionModalOpen}
        onClose={() => setIsProvisionModalOpen(false)}
        title="Provision New Tenant Organization"
        description="Creates isolated database boundary, schema partitions, and dynamic metadata seeds."
      >
        <form onSubmit={handleProvisionTenant} className="space-y-4 text-xs">
          <div>
            <label className="font-semibold block mb-1">Company / Organization Name</label>
            <Input
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9]/g, '-'));
              }}
              placeholder="e.g. Wayne Enterprises"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="font-semibold block mb-1">Tenant Code (2-32 Chars)</label>
              <Input
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="WAYNE-ENT"
                required
              />
            </div>
            <div>
              <label className="font-semibold block mb-1">Slug (Subdomain)</label>
              <Input
                value={slug}
                onChange={(e) => setSlug(e.target.value.toLowerCase())}
                placeholder="wayne-ent"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="font-semibold block mb-1">Custom Domain (Optional)</label>
              <Input
                value={domain}
                onChange={(e) => setDomain(e.target.value)}
                placeholder="pms.wayne.com"
              />
            </div>
            <div>
              <label className="font-semibold block mb-1">Storage Quota (MB)</label>
              <Input
                type="number"
                value={storageQuota}
                onChange={(e) => setStorageQuota(parseInt(e.target.value, 10) || 5120)}
                required
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-[var(--border)]">
            <Button type="button" variant="outline" onClick={() => setIsProvisionModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit">Provision Tenant</Button>
          </div>
        </form>
      </Modal>

      {/* Storage Quota Modal */}
      <Modal
        isOpen={isQuotaModalOpen}
        onClose={() => setIsQuotaModalOpen(false)}
        title={`Adjust Storage Quota - ${selectedTenantForQuota?.name || ''}`}
        description="Update maximum database and file storage allocation for this workspace partition."
      >
        <form onSubmit={handleUpdateQuota} className="space-y-4 text-xs">
          <div>
            <label className="font-semibold block mb-1">Storage Allocation (Gigabytes)</label>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                min="1"
                max="1000"
                value={quotaInputGB}
                onChange={(e) => setQuotaInputGB(parseInt(e.target.value, 10) || 1)}
                required
                className="font-mono"
              />
              <span className="text-xs font-semibold text-[var(--muted-foreground)]">GB</span>
            </div>
            <p className="text-[11px] text-[var(--muted-foreground)] mt-1">
              Equivalent to {(quotaInputGB * 1024).toLocaleString()} MB isolated partition.
            </p>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-[var(--border)]">
            <Button type="button" variant="outline" onClick={() => setIsQuotaModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit">Update Allocation</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
