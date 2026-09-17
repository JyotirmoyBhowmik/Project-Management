'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Building2, ArrowRight, ShieldCheck, CheckCircle2, AlertCircle } from 'lucide-react';
import { db } from '@/lib/supabase/mock-db';
import { useTenantStore } from '@/lib/stores/tenant-store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';

export default function LoginPage() {
  const router = useRouter();
  const { setActiveTenant } = useTenantStore();
  const [tenantCode, setTenantCode] = React.useState('ACME-CORP');
  const [error, setError] = React.useState('');
  const [resolvedTenant, setResolvedTenant] = React.useState<any>(db.tenants[0]);

  const handleLookup = (code: string) => {
    setTenantCode(code);
    setError('');
    const found = db.getTenantBySlugOrCode(code);
    if (found) {
      setResolvedTenant(found);
    } else {
      setResolvedTenant(null);
    }
  };

  const handleLogin = (role: string) => {
    if (!resolvedTenant) {
      setError('Please enter a valid tenant code or domain slug (e.g. ACME-CORP, GLOBEX)');
      return;
    }

    setActiveTenant(resolvedTenant, role);
    document.cookie = `pms_user_role=${role}; path=/; max-age=31536000; SameSite=Lax`;
    router.push('/');
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--background)] p-4">
      <div className="w-full max-w-md rounded-2xl border border-[var(--border)] bg-[var(--card)] p-8 shadow-2xl space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="h-12 w-12 rounded-2xl bg-[var(--primary)] text-white flex items-center justify-center font-bold text-xl mx-auto shadow-lg shadow-blue-500/20">
            P
          </div>
          <h1 className="text-2xl font-bold text-[var(--foreground)] tracking-tight">Enterprise PMS</h1>
          <p className="text-xs text-[var(--muted-foreground)]">
            Multi-Tenant Project Management & Critical Path Scheduling Platform
          </p>
        </div>

        {/* Tenant Code Lookup Input */}
        <div className="space-y-2">
          <label className="text-xs font-semibold block text-[var(--foreground)]">
            Tenant Code or Domain Slug
          </label>
          <div className="flex gap-2">
            <Input
              value={tenantCode}
              onChange={(e) => handleLookup(e.target.value)}
              placeholder="e.g. ACME-CORP or globex"
              className="text-xs font-mono"
            />
          </div>
          {error && <p className="text-[11px] text-rose-500">{error}</p>}
        </div>

        {/* Resolved Tenant Confirmation */}
        {resolvedTenant ? (
          <div className="p-3.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-emerald-500 flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4" />
                Tenant Resolved
              </span>
              <Badge variant="outline" className="font-mono text-[10px]">
                {resolvedTenant.code}
              </Badge>
            </div>
            <div className="text-xs font-semibold text-[var(--foreground)]">{resolvedTenant.name}</div>
            <div className="text-[11px] text-[var(--muted-foreground)] font-mono">
              Domain: {resolvedTenant.domain || `${resolvedTenant.slug}.pms.internal`}
            </div>
          </div>
        ) : (
          <div className="p-3.5 rounded-xl border border-rose-500/30 bg-rose-500/10 text-xs text-rose-500">
            Tenant not found. Try <strong className="font-mono">ACME-CORP</strong> or <strong className="font-mono">GLOBEX</strong>.
          </div>
        )}

        {/* Role Quick Sign-in */}
        <div className="space-y-2 pt-2">
          <label className="text-xs font-semibold block text-[var(--muted-foreground)] uppercase tracking-wider">
            Sign In As (Simulated Identity)
          </label>
          <div className="grid grid-cols-2 gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleLogin('tenant_admin')}
              className="justify-between text-xs"
            >
              <span>Tenant Admin</span>
              <ArrowRight className="h-3 w-3" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleLogin('project_manager')}
              className="justify-between text-xs"
            >
              <span>Project Manager</span>
              <ArrowRight className="h-3 w-3" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleLogin('contributor')}
              className="justify-between text-xs"
            >
              <span>Contributor</span>
              <ArrowRight className="h-3 w-3" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleLogin('guest')}
              className="justify-between text-xs text-amber-500 border-amber-500/30"
            >
              <span>Scoped Guest</span>
              <ArrowRight className="h-3 w-3" />
            </Button>
          </div>
        </div>

        <div className="pt-4 border-t border-[var(--border)] text-center text-[10px] text-[var(--muted-foreground)]">
          Protected by PostgreSQL 16 Row Level Security (RLS) & Vercel Edge Middleware.
        </div>
      </div>
    </div>
  );
}
