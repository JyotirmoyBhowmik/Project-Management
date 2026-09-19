// ==============================================================================
// src/app/(dashboard)/admin/multisite/tenants/[tenantId]/danger/page.tsx
// SuperAdmin Tenant Danger Zone & Eradication Portal
// ==============================================================================

'use client';

import * as React from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Skull,
  AlertTriangle,
  ArrowLeft,
  Trash2,
  Layers,
  Database,
  Users,
  Briefcase,
  HardDrive,
  ShieldAlert,
  Loader2,
  CheckCircle2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { createClient } from '@/lib/supabase/client';
import { PurgeTenantModal } from '@/components/modals/PurgeTenantModal';
import { toast } from 'sonner';

export default function TenantDangerZonePage() {
  const params = useParams();
  const router = useRouter();
  const tenantId = typeof params?.tenantId === 'string' ? params.tenantId : Array.isArray(params?.tenantId) ? params.tenantId[0] : '';

  const [loading, setLoading] = React.useState(true);
  const [tenant, setTenant] = React.useState<any | null>(null);
  const [counts, setCounts] = React.useState<{
    projects: number;
    tasks: number;
    members: number;
    documents: number;
  }>({
    projects: 0,
    tasks: 0,
    members: 0,
    documents: 0,
  });
  const [isPurgeModalOpen, setIsPurgeModalOpen] = React.useState(false);

  React.useEffect(() => {
    if (!tenantId) return;

    let isMounted = true;
    async function loadTenantDetails() {
      setLoading(true);
      try {
        const supabase = createClient();
        const { data: tenantData, error: tenantErr } = await supabase
          .from('tenants')
          .select('*')
          .eq('id', tenantId)
          .single();

        if (tenantErr || !tenantData) {
          toast.error('Tenant not found or access denied');
          if (isMounted) setLoading(false);
          return;
        }

        const [projRes, taskRes, memberRes, docRes] = await Promise.all([
          supabase.from('projects').select('id', { count: 'exact', head: true }).eq('tenant_id', tenantId),
          supabase.from('tasks').select('id', { count: 'exact', head: true }).eq('tenant_id', tenantId),
          supabase.from('tenant_memberships').select('id', { count: 'exact', head: true }).eq('tenant_id', tenantId),
          supabase.from('project_documents').select('id', { count: 'exact', head: true }).eq('tenant_id', tenantId),
        ]);

        if (isMounted) {
          setTenant(tenantData);
          setCounts({
            projects: projRes.count || 0,
            tasks: taskRes.count || 0,
            members: memberRes.count || 0,
            documents: docRes.count || 0,
          });
          setLoading(false);
        }
      } catch (err: any) {
        toast.error(err?.message || 'Error loading tenant details');
        if (isMounted) setLoading(false);
      }
    }

    loadTenantDetails();

    return () => {
      isMounted = false;
    };
  }, [tenantId]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] space-y-3">
        <Loader2 className="w-8 h-8 animate-spin text-[var(--primary)]" />
        <p className="text-xs text-[var(--muted-foreground)]">Scanning tenant isolation boundary...</p>
      </div>
    );
  }

  if (!tenant) {
    return (
      <div className="p-8 max-w-2xl mx-auto text-center space-y-4">
        <AlertTriangle className="w-12 h-12 text-yellow-500 mx-auto" />
        <h2 className="text-lg font-bold text-[var(--foreground)]">Tenant Not Found</h2>
        <p className="text-xs text-[var(--muted-foreground)]">
          The requested tenant ID <span className="font-mono">{tenantId}</span> does not exist or has already been purged.
        </p>
        <Link href="/admin/multisite">
          <Button variant="outline" size="sm">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Return to SuperAdmin
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12">
      {/* Navigation Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/admin/multisite">
            <Button variant="outline" size="sm" className="gap-1.5 text-xs">
              <ArrowLeft className="w-3.5 h-3.5" />
              SuperAdmin Multi-Site
            </Button>
          </Link>
          <span className="text-[var(--border)]">/</span>
          <Badge variant="destructive" className="font-mono text-xs uppercase tracking-wider">
            Danger Zone
          </Badge>
        </div>

        <Badge variant={tenant.is_active ? 'default' : 'secondary'} className="text-xs font-mono">
          STATUS: {tenant.status?.toUpperCase() || 'ACTIVE'}
        </Badge>
      </div>

      {/* Tenant Identity Header */}
      <div className="bg-[var(--card)] border border-red-500/30 rounded-xl p-6 shadow-sm space-y-4">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <h1 className="text-2xl font-black text-[var(--foreground)] tracking-tight flex items-center gap-2.5">
              <Skull className="w-6 h-6 text-red-500" />
              {tenant.name}
            </h1>
            <p className="text-xs text-[var(--muted-foreground)] flex items-center gap-3 font-mono">
              <span>Code: <strong className="text-[var(--foreground)]">{tenant.code}</strong></span>
              <span>Slug: <strong className="text-red-400">{tenant.slug}</strong></span>
              <span>ID: <strong className="text-[var(--foreground)]">{tenant.id}</strong></span>
            </p>
          </div>

          <Badge variant="outline" className="text-xs border-red-500/40 text-red-400">
            PostgreSQL Schema Purge Target
          </Badge>
        </div>

        {/* Affected Entities Statistics */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-4 border-t border-[var(--border)]">
          <div className="p-3.5 rounded-lg bg-[var(--secondary)]/40 border border-[var(--border)] space-y-1">
            <div className="flex items-center gap-2 text-xs text-[var(--muted-foreground)]">
              <Briefcase className="w-3.5 h-3.5 text-blue-400" />
              <span>Projects</span>
            </div>
            <p className="text-lg font-bold text-[var(--foreground)] font-mono">{counts.projects}</p>
          </div>

          <div className="p-3.5 rounded-lg bg-[var(--secondary)]/40 border border-[var(--border)] space-y-1">
            <div className="flex items-center gap-2 text-xs text-[var(--muted-foreground)]">
              <Layers className="w-3.5 h-3.5 text-indigo-400" />
              <span>Tasks & Deps</span>
            </div>
            <p className="text-lg font-bold text-[var(--foreground)] font-mono">{counts.tasks}</p>
          </div>

          <div className="p-3.5 rounded-lg bg-[var(--secondary)]/40 border border-[var(--border)] space-y-1">
            <div className="flex items-center gap-2 text-xs text-[var(--muted-foreground)]">
              <Users className="w-3.5 h-3.5 text-green-400" />
              <span>Members</span>
            </div>
            <p className="text-lg font-bold text-[var(--foreground)] font-mono">{counts.members}</p>
          </div>

          <div className="p-3.5 rounded-lg bg-[var(--secondary)]/40 border border-[var(--border)] space-y-1">
            <div className="flex items-center gap-2 text-xs text-[var(--muted-foreground)]">
              <HardDrive className="w-3.5 h-3.5 text-amber-400" />
              <span>Documents</span>
            </div>
            <p className="text-lg font-bold text-[var(--foreground)] font-mono">{counts.documents}</p>
          </div>
        </div>
      </div>

      {/* Irreversible Destruction Warning Card */}
      <div className="bg-red-950/20 border border-red-500/50 rounded-xl p-6 space-y-6">
        <div className="flex items-start gap-4">
          <div className="p-3 bg-red-500/10 rounded-lg border border-red-500/30">
            <ShieldAlert className="w-8 h-8 text-red-500" />
          </div>
          <div className="space-y-1.5">
            <h3 className="text-base font-bold text-red-400">
              Irreversible Multi-Tenant Cascade Purge
            </h3>
            <p className="text-xs text-red-200/80 leading-relaxed max-w-2xl">
              Executing this operation invokes the PostgreSQL Security Definer stored procedure{' '}
              <code className="px-1 py-0.5 rounded bg-red-950/60 border border-red-500/40 text-red-300 font-mono text-[11px]">
                purge_tenant_cascade(p_tenant_id)
              </code>
              . It will atomically erase all database tables, foreign key trees, audit trails, and attachments linked to this tenant.
            </p>
          </div>
        </div>

        <div className="border-t border-red-500/30 pt-4 space-y-3 text-xs text-red-200/90">
          <p className="font-semibold text-red-300">The following cascading eradication rules will be executed:</p>
          <ul className="list-disc list-inside space-y-1 pl-2 text-red-200/80 font-mono text-[11px]">
            <li>All CPM schedules, dependencies, critical paths, and baseline locks will be destroyed.</li>
            <li>All project wiki documents, attachments, comments, and time entries will be purged.</li>
            <li>All tenant identity federation configs (SAML 2.0 IdPs and AD/LDAP sync configs) will be wiped.</li>
            <li>All tenant user memberships will be detached; global user auth records remain unlinked.</li>
          </ul>
        </div>

        <div className="pt-2 flex items-center justify-between border-t border-red-500/30">
          <span className="text-xs text-[var(--muted-foreground)]">
            Requires SuperAdmin authorization and explicit confirmation code.
          </span>
          <Button
            variant="destructive"
            onClick={() => setIsPurgeModalOpen(true)}
            className="bg-red-600 hover:bg-red-700 text-white font-bold gap-2 text-xs shadow-lg shadow-red-950/40"
          >
            <Trash2 className="w-4 h-4" />
            Initiate Complete Tenant Purge
          </Button>
        </div>
      </div>

      {/* Purge Modal */}
      <PurgeTenantModal
        isOpen={isPurgeModalOpen}
        onClose={() => setIsPurgeModalOpen(false)}
        tenantId={tenant.id}
        tenantName={tenant.name}
        tenantSlug={tenant.slug}
        onPurged={() => {
          router.push('/admin/multisite');
        }}
      />
    </div>
  );
}
