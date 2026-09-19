// ==============================================================================
// src/app/(dashboard)/settings/identity/page.tsx
// Enterprise Identity & Access Management (IAM) Interface
// SAML 2.0 / SSO Configuration & Active Directory / LDAP Directory Sync Engine
// ==============================================================================

'use client';

import * as React from 'react';
import {
  ShieldCheck,
  KeyRound,
  RefreshCw,
  Server,
  CheckCircle2,
  AlertCircle,
  Clock,
  Save,
  Loader2,
  ExternalLink,
  ChevronRight,
  Database,
  Lock,
} from 'lucide-react';
import { useTenantStore } from '@/lib/stores/tenant-store';
import { TenantSSOConfig, TenantDirectorySyncConfig, DirectorySyncLog } from '@/types/database';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  getTenantSSOConfigAction,
  upsertTenantSSOConfigAction,
  getTenantDirectorySyncConfigAction,
  upsertTenantDirectorySyncConfigAction,
  triggerDirectorySyncAction,
  getDirectorySyncLogsAction,
} from '@/actions/identity';
import { toast } from 'sonner';

export default function IdentitySettingsPage() {
  const { activeTenant, activeRole, currentUser } = useTenantStore();
  const tenantId = activeTenant?.id;
  const isSuperadmin = Boolean(currentUser?.is_superadmin) || currentUser?.email === 'admin@jyotirmoyb.com';
  const isAdmin = ['owner', 'admin'].includes(activeRole) || isSuperadmin;

  // SSO State
  const [ssoConfig, setSsoConfig] = React.useState<Partial<TenantSSOConfig>>({
    idp_entity_id: '',
    idp_sso_url: '',
    idp_certificate: '',
    metadata_xml_url: '',
    allowed_domains: [],
    enforce_sso: false,
    is_active: true,
  });
  const [domainInput, setDomainInput] = React.useState('');
  const [isSavingSSO, setIsSavingSSO] = React.useState(false);

  // Directory Sync State
  const [dirConfig, setDirConfig] = React.useState<Partial<TenantDirectorySyncConfig>>({
    protocol: 'ldap',
    host_url: '',
    port: 636,
    bind_dn: '',
    bind_credentials: '',
    search_base: '',
    user_search_filter: '(objectClass=user)',
    sync_interval_hours: 24,
    auto_deactivate_missing_users: true,
    is_enabled: false,
  });
  const [isSavingDir, setIsSavingDir] = React.useState(false);
  const [isSyncingNow, setIsSyncingNow] = React.useState(false);
  const [syncLogs, setSyncLogs] = React.useState<DirectorySyncLog[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);

  // Load Configurations
  const loadData = React.useCallback(async () => {
    if (!tenantId) return;
    setIsLoading(true);
    try {
      const [ssoRes, dirRes, logsRes] = await Promise.all([
        getTenantSSOConfigAction(tenantId),
        getTenantDirectorySyncConfigAction(tenantId),
        getDirectorySyncLogsAction(tenantId),
      ]);

      if (ssoRes.success && ssoRes.data) {
        setSsoConfig(ssoRes.data);
      }
      if (dirRes.success && dirRes.data) {
        setDirConfig(dirRes.data);
      }
      if (logsRes.success && logsRes.data) {
        setSyncLogs(logsRes.data);
      }
    } catch (err) {
      console.error('Failed to load identity configurations', err);
    } finally {
      setIsLoading(false);
    }
  }, [tenantId]);

  React.useEffect(() => {
    loadData();
  }, [loadData]);

  // Handle Domain Tag addition
  const handleAddDomain = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && domainInput.trim()) {
      e.preventDefault();
      let cleaned = domainInput.trim().toLowerCase();
      if (!cleaned.startsWith('@')) cleaned = `@${cleaned}`;
      const current = ssoConfig.allowed_domains || [];
      if (!current.includes(cleaned)) {
        setSsoConfig({ ...ssoConfig, allowed_domains: [...current, cleaned] });
      }
      setDomainInput('');
    }
  };

  const handleRemoveDomain = (domainToRemove: string) => {
    const current = ssoConfig.allowed_domains || [];
    setSsoConfig({
      ...ssoConfig,
      allowed_domains: current.filter((d) => d !== domainToRemove),
    });
  };

  // Save SSO Configuration
  const handleSaveSSO = async () => {
    if (!tenantId || !isAdmin) return;
    setIsSavingSSO(true);
    try {
      const res = await upsertTenantSSOConfigAction({
        tenant_id: tenantId,
        idp_entity_id: ssoConfig.idp_entity_id || '',
        idp_sso_url: ssoConfig.idp_sso_url || '',
        idp_certificate: ssoConfig.idp_certificate || '',
        metadata_xml_url: ssoConfig.metadata_xml_url || null,
        allowed_domains: ssoConfig.allowed_domains || [],
        enforce_sso: Boolean(ssoConfig.enforce_sso),
        is_active: Boolean(ssoConfig.is_active),
      });

      if (res.success) {
        toast.success('Enterprise SAML 2.0 configuration saved.');
        if (res.data) setSsoConfig(res.data);
      } else {
        toast.error(res.error || 'Failed to save SSO configuration');
      }
    } catch (err: any) {
      toast.error(err?.message || 'Error saving SSO configuration');
    } finally {
      setIsSavingSSO(false);
    }
  };

  // Save Directory Sync Configuration
  const handleSaveDirConfig = async () => {
    if (!tenantId || !isAdmin) return;
    setIsSavingDir(true);
    try {
      const res = await upsertTenantDirectorySyncConfigAction({
        tenant_id: tenantId,
        protocol: (dirConfig.protocol as any) || 'ldap',
        host_url: dirConfig.host_url || null,
        port: dirConfig.port || 636,
        bind_dn: dirConfig.bind_dn || null,
        bind_credentials: dirConfig.bind_credentials || null,
        search_base: dirConfig.search_base || null,
        user_search_filter: dirConfig.user_search_filter || '(objectClass=user)',
        sync_interval_hours: dirConfig.sync_interval_hours || 24,
        auto_deactivate_missing_users: Boolean(dirConfig.auto_deactivate_missing_users),
        is_enabled: Boolean(dirConfig.is_enabled),
      });

      if (res.success) {
        toast.success('Directory Sync configuration updated.');
        if (res.data) setDirConfig(res.data);
      } else {
        toast.error(res.error || 'Failed to save Directory Sync configuration');
      }
    } catch (err: any) {
      toast.error(err?.message || 'Error saving Directory Sync configuration');
    } finally {
      setIsSavingDir(false);
    }
  };

  // Test Connection & Trigger Sync Now
  const handleTriggerSyncNow = async () => {
    if (!tenantId) return;
    setIsSyncingNow(true);
    try {
      const res = await triggerDirectorySyncAction(tenantId);
      if (res.success) {
        toast.success(
          `Directory sync complete. Verified ${res.data?.users_updated || 0} active workspace members.`
        );
        loadData();
      } else {
        toast.error(res.error || 'Directory sync failed');
      }
    } catch (err: any) {
      toast.error(err?.message || 'Directory sync trigger error');
    } finally {
      setIsSyncingNow(false);
    }
  };

  if (!isAdmin) {
    return (
      <div className="p-8 text-center max-w-lg mx-auto space-y-4">
        <ShieldCheck className="w-12 h-12 text-amber-500 mx-auto" />
        <h2 className="text-xl font-bold">Administrative Privilege Required</h2>
        <p className="text-sm text-[var(--muted-foreground)]">
          Identity Federation and SAML 2.0 configuration requires Tenant Admin or SuperAdmin permissions.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-12 max-w-6xl mx-auto p-4 md:p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-[var(--border)] pb-5">
        <div>
          <h1 className="text-2xl font-black tracking-tight flex items-center gap-2.5">
            <KeyRound className="w-6 h-6 text-blue-500" />
            <span>Identity & Access Management (IAM)</span>
          </h1>
          <p className="text-xs text-[var(--muted-foreground)] mt-1">
            Configure SAML 2.0 Single Sign-On (Microsoft Entra ID, Okta) and Active Directory / LDAP Directory Sync.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-xs px-2.5 py-1 gap-1.5 border-blue-500/30 text-blue-400 bg-blue-50/10">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>PostgreSQL RLS Protected</span>
          </Badge>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* ========================================================================= */}
        {/* CARD 1: Enterprise SAML 2.0 / SSO                                         */}
        {/* ========================================================================= */}
        <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-[var(--border)] pb-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-500">
                <KeyRound className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-sm font-bold">SAML 2.0 / Enterprise SSO</h2>
                <p className="text-[11px] text-[var(--muted-foreground)]">Azure AD, Okta, Google Workspace</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-[var(--muted-foreground)]">Enforce SSO</span>
              <button
                type="button"
                onClick={() => setSsoConfig({ ...ssoConfig, enforce_sso: !ssoConfig.enforce_sso })}
                className={`w-9 h-5 rounded-full transition-colors relative ${
                  ssoConfig.enforce_sso ? 'bg-blue-600' : 'bg-[var(--muted)]'
                }`}
              >
                <div
                  className={`w-3.5 h-3.5 rounded-full bg-white transition-transform transform absolute top-0.5 ${
                    ssoConfig.enforce_sso ? 'left-4.5' : 'left-1'
                  }`}
                />
              </button>
            </div>
          </div>

          <div className="space-y-3">
            <div>
              <label className="text-xs font-semibold text-[var(--foreground)]">IdP Entity ID (Issuer)</label>
              <Input
                value={ssoConfig.idp_entity_id || ''}
                onChange={(e) => setSsoConfig({ ...ssoConfig, idp_entity_id: e.target.value })}
                placeholder="https://sts.windows.net/tenant-id/ or http://www.okta.com/exk..."
                className="mt-1 text-xs font-mono"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-[var(--foreground)]">IdP SSO Target URL</label>
              <Input
                value={ssoConfig.idp_sso_url || ''}
                onChange={(e) => setSsoConfig({ ...ssoConfig, idp_sso_url: e.target.value })}
                placeholder="https://login.microsoftonline.com/tenant-id/saml2"
                className="mt-1 text-xs font-mono"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-[var(--foreground)]">X.509 Public Certificate</label>
              <textarea
                value={ssoConfig.idp_certificate || ''}
                onChange={(e) => setSsoConfig({ ...ssoConfig, idp_certificate: e.target.value })}
                placeholder="-----BEGIN CERTIFICATE-----&#10;MIIC...&#10;-----END CERTIFICATE-----"
                rows={4}
                className="mt-1 w-full bg-[var(--background)] border border-[var(--border)] rounded-md p-2 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-[var(--foreground)]">Allowed Email Domains (Auto-SSO Routing)</label>
              <p className="text-[11px] text-[var(--muted-foreground)] mb-1.5">
                Users logging in with these domains are routed directly to this IdP.
              </p>
              <div className="flex flex-wrap gap-1.5 mb-2">
                {(ssoConfig.allowed_domains || []).map((d) => (
                  <Badge key={d} variant="secondary" className="text-xs font-mono gap-1 py-0.5">
                    <span>{d}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveDomain(d)}
                      className="hover:text-red-400 text-xs"
                    >
                      ×
                    </button>
                  </Badge>
                ))}
              </div>
              <Input
                value={domainInput}
                onChange={(e) => setDomainInput(e.target.value)}
                onKeyDown={handleAddDomain}
                placeholder="Type domain (e.g., @company.com) and press Enter"
                className="text-xs font-mono"
              />
            </div>

            <div className="pt-2 flex items-center justify-between border-t border-[var(--border)]">
              <div className="text-xs text-[var(--muted-foreground)]">
                {ssoConfig.enforce_sso ? (
                  <span className="text-blue-400 font-medium">Bypasses password for allowed domains</span>
                ) : (
                  <span>Password fallback allowed</span>
                )}
              </div>
              <Button onClick={handleSaveSSO} disabled={isSavingSSO} className="text-xs">
                {isSavingSSO ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="w-3.5 h-3.5 mr-1.5" />
                    Save SSO Config
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* CARD 2: Active Directory & LDAP Directory Sync                            */}
        {/* ========================================================================= */}
        <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-[var(--border)] pb-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-500">
                <Server className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-sm font-bold">Active Directory & LDAP Sync</h2>
                <p className="text-[11px] text-[var(--muted-foreground)]">Automated User Provisioning & Deprovisioning</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-[var(--muted-foreground)]">Sync Enabled</span>
              <button
                type="button"
                onClick={() => setDirConfig({ ...dirConfig, is_enabled: !dirConfig.is_enabled })}
                className={`w-9 h-5 rounded-full transition-colors relative ${
                  dirConfig.is_enabled ? 'bg-emerald-600' : 'bg-[var(--muted)]'
                }`}
              >
                <div
                  className={`w-3.5 h-3.5 rounded-full bg-white transition-transform transform absolute top-0.5 ${
                    dirConfig.is_enabled ? 'left-4.5' : 'left-1'
                  }`}
                />
              </button>
            </div>
          </div>

          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-[var(--foreground)]">Protocol</label>
                <select
                  value={dirConfig.protocol || 'ldap'}
                  onChange={(e) => setDirConfig({ ...dirConfig, protocol: e.target.value as any })}
                  className="mt-1 w-full bg-[var(--background)] border border-[var(--border)] rounded-md px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  <option value="ldaps">LDAPS (Secure LDAP)</option>
                  <option value="ldap">LDAP (Standard)</option>
                  <option value="azure_ad_graph">Azure AD / Entra Graph</option>
                  <option value="scim">SCIM 2.0 Inbound</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-[var(--foreground)]">Port</label>
                <Input
                  type="number"
                  value={dirConfig.port || 636}
                  onChange={(e) => setDirConfig({ ...dirConfig, port: parseInt(e.target.value, 10) })}
                  className="mt-1 text-xs font-mono"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-[var(--foreground)]">Host URL / Endpoint</label>
              <Input
                value={dirConfig.host_url || ''}
                onChange={(e) => setDirConfig({ ...dirConfig, host_url: e.target.value })}
                placeholder="ldaps://ad.company.internal or https://graph.microsoft.com"
                className="mt-1 text-xs font-mono"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-[var(--foreground)]">Bind DN / Client ID</label>
                <Input
                  value={dirConfig.bind_dn || ''}
                  onChange={(e) => setDirConfig({ ...dirConfig, bind_dn: e.target.value })}
                  placeholder="CN=ServiceAccount,OU=Admins,DC=corp"
                  className="mt-1 text-xs font-mono"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-[var(--foreground)]">Bind Credentials</label>
                <Input
                  type="password"
                  value={dirConfig.bind_credentials || ''}
                  onChange={(e) => setDirConfig({ ...dirConfig, bind_credentials: e.target.value })}
                  placeholder="••••••••••••"
                  className="mt-1 text-xs font-mono"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-[var(--foreground)]">Search Base (Base DN)</label>
              <Input
                value={dirConfig.search_base || ''}
                onChange={(e) => setDirConfig({ ...dirConfig, search_base: e.target.value })}
                placeholder="DC=company,DC=com"
                className="mt-1 text-xs font-mono"
              />
            </div>

            <div className="flex items-center justify-between pt-1">
              <label className="text-xs text-[var(--muted-foreground)] flex items-center gap-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={Boolean(dirConfig.auto_deactivate_missing_users)}
                  onChange={(e) =>
                    setDirConfig({ ...dirConfig, auto_deactivate_missing_users: e.target.checked })
                  }
                  className="rounded border-[var(--border)]"
                />
                <span>Auto-suspend employees disabled in Active Directory</span>
              </label>
            </div>

            <div className="pt-2 flex items-center justify-between border-t border-[var(--border)]">
              <Button
                variant="outline"
                size="sm"
                onClick={handleTriggerSyncNow}
                disabled={isSyncingNow}
                className="text-xs"
              >
                {isSyncingNow ? (
                  <>
                    <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                    Syncing...
                  </>
                ) : (
                  <>
                    <RefreshCw className="w-3 h-3 mr-1" />
                    Test & Sync Now
                  </>
                )}
              </Button>

              <Button onClick={handleSaveDirConfig} disabled={isSavingDir} className="text-xs">
                {isSavingDir ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="w-3.5 h-3.5 mr-1.5" />
                    Save Directory Config
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* SECTION 3: Directory Sync Audit Stream & SCIM 2.0 Inbound                 */}
      {/* ========================================================================= */}
      <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-5 shadow-xs space-y-4">
        <div className="flex items-center justify-between border-b border-[var(--border)] pb-3">
          <div className="flex items-center gap-2.5">
            <Clock className="w-4 h-4 text-blue-500" />
            <h2 className="text-sm font-bold">Directory Sync Execution Logs</h2>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-xs font-mono">
              SCIM Endpoint: /api/scim/v2/Users
            </Badge>
          </div>
        </div>

        {syncLogs.length === 0 ? (
          <div className="text-center py-6 text-xs text-[var(--muted-foreground)]">
            No synchronization runs recorded yet. Click "Test & Sync Now" to trigger reconciliation.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-[var(--border)] text-[var(--muted-foreground)]">
                  <th className="py-2 px-3 font-semibold">Started</th>
                  <th className="py-2 px-3 font-semibold">Status</th>
                  <th className="py-2 px-3 font-semibold text-center">Created</th>
                  <th className="py-2 px-3 font-semibold text-center">Updated</th>
                  <th className="py-2 px-3 font-semibold text-center">Suspended</th>
                  <th className="py-2 px-3 font-semibold">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {syncLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-[var(--accent)]/30">
                    <td className="py-2.5 px-3 font-mono text-[11px]">
                      {new Date(log.sync_started_at).toLocaleString()}
                    </td>
                    <td className="py-2.5 px-3">
                      <Badge
                        variant="outline"
                        className={`text-[10px] uppercase font-bold ${
                          log.status === 'success'
                            ? 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10'
                            : 'text-amber-400 border-amber-500/30 bg-amber-500/10'
                        }`}
                      >
                        {log.status}
                      </Badge>
                    </td>
                    <td className="py-2.5 px-3 text-center font-mono">{log.users_created}</td>
                    <td className="py-2.5 px-3 text-center font-mono">{log.users_updated}</td>
                    <td className="py-2.5 px-3 text-center font-mono">{log.users_suspended}</td>
                    <td className="py-2.5 px-3 text-[11px] text-[var(--muted-foreground)] truncate max-w-xs font-mono">
                      {log.error_payload ? JSON.stringify(log.error_payload) : 'Reconciled'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
