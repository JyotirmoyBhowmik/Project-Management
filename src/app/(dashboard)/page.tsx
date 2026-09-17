'use client';

import * as React from 'react';
import Link from 'next/link';
import {
  FolderGit2,
  Flame,
  Clock,
  ShieldCheck,
  ChevronRight,
  ArrowUpRight,
  Layers,
  Activity,
  Calendar,
} from 'lucide-react';
import { useTenantStore } from '@/lib/stores/tenant-store';
import { db } from '@/lib/supabase/mock-db';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

export default function DashboardOverviewPage() {
  const { activeTenant, activeRole, currentUser } = useTenantStore();

  const tenantProjects = db.getProjectsForUser(
    activeTenant?.id || 'a0000000-0000-0000-0000-000000000001',
    currentUser?.id || 'b0000000-0000-0000-0000-000000000002',
    activeRole
  );

  const tenantTasks = db.tasks.filter(t => t.tenant_id === activeTenant?.id);
  const criticalTasks = tenantTasks.filter(t => t.is_critical);
  const auditLogs = db.auditLogs.filter(l => l.tenant_id === activeTenant?.id).slice(0, 5);

  return (
    <div className="space-y-6">
      {/* Welcome Banner */}
      <div className="rounded-2xl border border-[var(--border)] bg-gradient-to-r from-[var(--primary)]/10 via-[var(--card)] to-[var(--secondary)] p-6 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Badge variant="outline" className="font-mono text-[10px]">
                {activeTenant?.code}
              </Badge>
              <Badge variant={activeRole === 'guest' ? 'warning' : 'success'} className="text-[10px] capitalize">
                Role: {activeRole.replace('_', ' ')}
              </Badge>
            </div>
            <h1 className="text-2xl font-bold text-[var(--foreground)] tracking-tight">
              Welcome back, {currentUser?.full_name?.split(' ')[0]}
            </h1>
            <p className="text-xs text-[var(--muted-foreground)] mt-1 max-w-xl">
              Connected to enterprise workspace <strong className="text-[var(--foreground)]">{activeTenant?.name}</strong>.
              PostgreSQL 16 Row Level Security (RLS) active.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Link href="/projects/d0000000-0000-0000-0000-000000000001">
              <Button className="gap-2 text-xs">
                <Layers className="h-4 w-4" />
                Launch Active Workspace
              </Button>
            </Link>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold text-[var(--muted-foreground)]">
              Accessible Projects
            </CardTitle>
            <FolderGit2 className="h-4 w-4 text-[var(--primary)]" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-[var(--foreground)]">{tenantProjects.length}</div>
            <p className="text-[11px] text-[var(--muted-foreground)] mt-1">
              {activeRole === 'guest' ? 'Scoped to assigned projects' : 'Domain-wide visibility'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold text-[var(--muted-foreground)]">
              Critical Path Tasks
            </CardTitle>
            <Flame className="h-4 w-4 text-rose-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-rose-500">{criticalTasks.length}</div>
            <p className="text-[11px] text-[var(--muted-foreground)] mt-1">Zero total float (CPM Bottleneck)</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold text-[var(--muted-foreground)]">
              Total Work Items
            </CardTitle>
            <Clock className="h-4 w-4 text-sky-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-[var(--foreground)]">{tenantTasks.length}</div>
            <p className="text-[11px] text-[var(--muted-foreground)] mt-1">
              {tenantTasks.filter(t => t.status === 'completed').length} completed
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold text-[var(--muted-foreground)]">
              Security & Compliance
            </CardTitle>
            <ShieldCheck className="h-4 w-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-500">100%</div>
            <p className="text-[11px] text-[var(--muted-foreground)] mt-1">RLS policies enforced</p>
          </CardContent>
        </Card>
      </div>

      {/* Main Grid: Projects List + Critical Path Alerts & Audit */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Project Portfolio Quick Access */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-[var(--foreground)]">Active Projects in Workspace</h2>
            <Link href="/projects" className="text-xs text-[var(--primary)] hover:underline flex items-center gap-1">
              View All <ArrowUpRight className="h-3 w-3" />
            </Link>
          </div>

          <div className="space-y-3">
            {tenantProjects.map((prj) => (
              <Link
                key={prj.id}
                href={`/projects/${prj.id}`}
                className="block p-4 rounded-xl border border-[var(--border)] bg-[var(--card)] hover:border-[var(--primary)] hover:shadow-md transition-all group cursor-pointer"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-bold text-sm text-[var(--foreground)] group-hover:text-[var(--primary)] transition-colors">
                        {prj.name}
                      </span>
                      <Badge variant="outline" className="font-mono text-[10px]">
                        {prj.code}
                      </Badge>
                      <Badge variant="success" className="text-[10px] py-0">
                        {prj.status}
                      </Badge>
                    </div>
                    <p className="text-xs text-[var(--muted-foreground)] line-clamp-1">
                      {prj.description}
                    </p>
                  </div>
                  <ChevronRight className="h-5 w-5 text-[var(--muted-foreground)] group-hover:translate-x-1 transition-transform" />
                </div>

                <div className="flex items-center gap-4 text-[11px] text-[var(--muted-foreground)] mt-3 pt-3 border-t border-[var(--border)] font-mono">
                  <span className="flex items-center gap-1">
                    <Calendar className="h-3.5 w-3.5" />
                    {prj.start_date} → {prj.target_end_date || 'TBD'}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </div>

        {/* Right: Critical Path Alerts & Compliance Audit */}
        <div className="space-y-6">
          {/* Critical Path Notice */}
          <div className="rounded-xl border border-rose-500/30 bg-rose-500/5 p-4 space-y-3">
            <div className="flex items-center gap-2 text-rose-500 font-bold text-xs">
              <Flame className="h-4 w-4" />
              <span>Critical Path Method (CPM) Insights</span>
            </div>
            <p className="text-xs text-[var(--muted-foreground)] leading-relaxed">
              <strong>{criticalTasks.length} tasks</strong> are currently on the Critical Path. Any delay in these items directly delays overall project completion.
            </p>
            <div className="space-y-1.5 pt-1">
              {criticalTasks.slice(0, 3).map(t => (
                <div key={t.id} className="text-[11px] font-medium text-[var(--foreground)] flex items-center justify-between">
                  <span className="truncate max-w-[190px]">{t.title}</span>
                  <span className="font-mono text-[10px] text-rose-500">{t.duration_days}d</span>
                </div>
              ))}
            </div>
          </div>

          {/* Audit Activity */}
          <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-[var(--foreground)] flex items-center gap-1.5">
                <Activity className="h-3.5 w-3.5 text-emerald-500" />
                Recent Audit Trail
              </span>
              <span className="text-[10px] font-mono text-[var(--muted-foreground)]">Rule 4.2</span>
            </div>
            <div className="divide-y divide-[var(--border)] text-xs">
              {auditLogs.map(log => (
                <div key={log.id} className="py-2 flex items-center justify-between">
                  <div>
                    <span className="font-semibold capitalize text-[var(--foreground)]">{log.action}</span>
                    <span className="text-[var(--muted-foreground)] ml-1">on {log.entity_type}</span>
                  </div>
                  <span className="text-[10px] font-mono text-[var(--muted-foreground)]">
                    {log.created_at.split('T')[0]}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
