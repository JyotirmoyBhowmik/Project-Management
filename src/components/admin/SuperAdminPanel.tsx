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
} from 'lucide-react';
import { db } from '@/lib/supabase/mock-db';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Modal } from '@/components/ui/dialog';

export function SuperAdminPanel() {
  const [tenants, setTenants] = React.useState([...db.tenants]);
  const [isProvisionModalOpen, setIsProvisionModalOpen] = React.useState(false);

  // New Tenant Form State
  const [name, setName] = React.useState('');
  const [code, setCode] = React.useState('');
  const [slug, setSlug] = React.useState('');
  const [domain, setDomain] = React.useState('');
  const [storageQuota, setStorageQuota] = React.useState(5120);

  const handleProvisionTenant = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !code || !slug) return;

    const newTenant = {
      id: `tenant-${Date.now()}`,
      name,
      code: code.toUpperCase(),
      tenant_code: code.toUpperCase(),
      slug: slug.toLowerCase(),
      domain: domain || null,
      logo_url: null,
      is_active: true,
      week_starts_on: 1,
      weekend_days: [0, 6],
      status: 'active' as const,
      branding_json: {
        primary_color: '#3b82f6',
        theme_preset: 'navy' as const,
        company_tagline: 'Enterprise Provisioned Tenant',
      },
      feature_flags: { cpm_enabled: true, export_enabled: true, audit_enabled: true },
      storage_quota_mb: storageQuota,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    db.tenants.push(newTenant);
    setTenants([...db.tenants]);
    setIsProvisionModalOpen(false);

    setName('');
    setCode('');
    setSlug('');
    setDomain('');
  };

  const toggleFeatureFlag = (tenantId: string, flag: string) => {
    const target = db.tenants.find(t => t.id === tenantId);
    if (target) {
      if (!target.feature_flags) {
        target.feature_flags = { cpm_enabled: true, export_enabled: true, audit_enabled: true };
      }
      target.feature_flags[flag] = !target.feature_flags[flag];
      setTenants([...db.tenants]);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-[var(--foreground)] flex items-center gap-2">
            <Server className="h-5 w-5 text-[var(--primary)]" />
            Global Multisite Network Administration
          </h1>
          <p className="text-xs text-[var(--muted-foreground)] mt-0.5">
            System SuperAdmin governance: tenant provisioning, cross-tenant isolation, storage quotas, and feature flags.
          </p>
        </div>

        <Button onClick={() => setIsProvisionModalOpen(true)} className="gap-1.5 text-xs">
          <Plus className="h-4 w-4" />
          Provision New Tenant
        </Button>
      </div>

      {/* Tenants Table */}
      <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] overflow-hidden shadow-xs">
        <div className="p-4 border-b border-[var(--border)] bg-[var(--secondary)]/30 flex items-center justify-between">
          <h2 className="text-sm font-bold text-[var(--foreground)]">Active Tenant Organizations ({tenants.length})</h2>
          <Badge variant="outline" className="font-mono">Global Multisite Root</Badge>
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
                    <Badge variant="success" className="text-[10px] py-0">
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

              {/* Global Feature Flags Toggle */}
              <div className="flex items-center gap-4 text-xs">
                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-[var(--muted-foreground)]">CPM Engine:</span>
                  <button
                    onClick={() => toggleFeatureFlag(tenant.id, 'cpm_enabled')}
                    className={`px-2 py-0.5 rounded text-[10px] font-bold cursor-pointer border ${
                      tenant.feature_flags?.cpm_enabled
                        ? 'bg-emerald-500/20 text-emerald-500 border-emerald-500/40'
                        : 'bg-zinc-500/20 text-zinc-400 border-zinc-500/40'
                    }`}
                  >
                    {tenant.feature_flags?.cpm_enabled ? 'ENABLED' : 'DISABLED'}
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-[var(--muted-foreground)]">Auditing:</span>
                  <button
                    onClick={() => toggleFeatureFlag(tenant.id, 'audit_enabled')}
                    className={`px-2 py-0.5 rounded text-[10px] font-bold cursor-pointer border ${
                      tenant.feature_flags?.audit_enabled
                        ? 'bg-emerald-500/20 text-emerald-500 border-emerald-500/40'
                        : 'bg-zinc-500/20 text-zinc-400 border-zinc-500/40'
                    }`}
                  >
                    {tenant.feature_flags?.audit_enabled ? 'ENABLED' : 'DISABLED'}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Provisioning Modal */}
      <Modal
        isOpen={isProvisionModalOpen}
        onClose={() => setIsProvisionModalOpen(false)}
        title="Provision New Tenant Organization"
        description="Creates isolated database boundary, schema partitions, and administrator"
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
    </div>
  );
}
