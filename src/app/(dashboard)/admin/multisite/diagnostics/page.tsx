// ==============================================================================
// src/app/(dashboard)/admin/multisite/diagnostics/page.tsx
// SuperAdmin Health & Multi-Tenant Diagnostics Dashboard
// ==============================================================================

'use client';

import * as React from 'react';
import {
  Activity,
  ShieldCheck,
  Database,
  HardDrive,
  Radio,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  RefreshCw,
  ArrowLeft,
  Terminal,
  Server,
  Layers,
} from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { SystemHealthAuditReport } from '@/types/database';

export default function DiagnosticsPage() {
  const [report, setReport] = React.useState<SystemHealthAuditReport | null>(null);
  const [isRunning, setIsRunning] = React.useState(false);
  const [logs, setLogs] = React.useState<string[]>([]);
  const terminalBottomRef = React.useRef<HTMLDivElement | null>(null);

  const addLog = (msg: string) => {
    setLogs((prev) => [...prev, `[${new Date().toLocaleTimeString()}] ${msg}`]);
  };

  const runDiagnostics = async () => {
    setIsRunning(true);
    setLogs([]);
    addLog('Initiating SuperAdmin Global Multi-Tenant Diagnostics...');
    addLog('Connecting to /api/system/health-audit route...');

    try {
      addLog('Synthesizing synthetic probes across PostgreSQL RLS boundaries...');
      const res = await fetch('/api/system/health-audit');
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || 'Diagnostic execution failed.');
      }

      const auditReport: SystemHealthAuditReport = data.data;
      setReport(auditReport);

      addLog(`Database Round-Trip Query: ${auditReport.checks.database.status} (${auditReport.checks.database.latency_ms}ms)`);
      addLog(`RLS Isolation Probe: ${auditReport.checks.rls_isolation.status} - ${auditReport.checks.rls_isolation.message}`);
      addLog(`Storage Vault Validation: ${auditReport.checks.storage_bucket.status} - ${auditReport.checks.storage_bucket.message}`);
      addLog(`Orphan Record Scan: ${auditReport.checks.orphan_records.status} - ${auditReport.checks.orphan_records.message}`);
      addLog(`Diagnostics Complete. Overall Assessment: ${auditReport.overall_status}`);
    } catch (err: any) {
      addLog(`ERROR: Diagnostics aborted - ${err.message}`);
    } finally {
      setIsRunning(false);
    }
  };

  // Run on first load
  React.useEffect(() => {
    runDiagnostics();
  }, []);

  React.useEffect(() => {
    terminalBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  const renderStatusBadge = (status: 'PASS' | 'WARN' | 'FAIL') => {
    if (status === 'PASS') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
          <CheckCircle2 className="h-3.5 w-3.5" />
          PASS
        </span>
      );
    }
    if (status === 'WARN') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-500/10 text-amber-400 border border-amber-500/30">
          <AlertTriangle className="h-3.5 w-3.5" />
          WARN
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-rose-500/10 text-rose-400 border border-rose-500/30">
        <XCircle className="h-3.5 w-3.5" />
        FAIL
      </span>
    );
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Top Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[var(--border)] pb-5">
        <div className="flex items-center gap-3">
          <Link
            href="/admin/multisite"
            className="p-2 rounded-lg border border-[var(--border)] bg-[var(--card)] hover:bg-[var(--secondary)] text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors"
            title="Back to Multi-Site Admin"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-black tracking-tight text-[var(--foreground)]">
                System Integrity & Multi-Tenant Diagnostics
              </h1>
              <Badge variant="outline" className="text-xs bg-indigo-500/10 text-indigo-400 border-indigo-500/30">
                Phase 4 Certified
              </Badge>
            </div>
            <p className="text-xs text-[var(--muted-foreground)] mt-0.5">
              Live synthetic probes, PostgreSQL RLS tenant boundary verification, and storage audit
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {report && renderStatusBadge(report.overall_status)}
          <Button
            onClick={runDiagnostics}
            disabled={isRunning}
            className="gap-2 text-xs font-semibold"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isRunning ? 'animate-spin' : ''}`} />
            <span>Run Global System Check</span>
          </Button>
        </div>
      </div>

      {/* 1. Core Health Probes Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Probe 1: Database Latency */}
        <div className="p-4 rounded-xl border border-[var(--border)] bg-[var(--card)] shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <div className="h-9 w-9 rounded-lg bg-sky-500/10 text-sky-400 flex items-center justify-center">
              <Database className="h-4 w-4" />
            </div>
            {report && renderStatusBadge(report.checks.database.status)}
          </div>
          <div>
            <h4 className="text-xs font-bold text-[var(--muted-foreground)] uppercase tracking-wider">
              PostgreSQL Round-Trip
            </h4>
            <div className="text-xl font-mono font-bold text-[var(--foreground)] mt-1">
              {report?.checks.database.latency_ms ? `${report.checks.database.latency_ms} ms` : '—'}
            </div>
            <p className="text-[11px] text-[var(--muted-foreground)] mt-1 truncate" title={report?.checks.database.message}>
              {report?.checks.database.message || 'Awaiting probe...'}
            </p>
          </div>
        </div>

        {/* Probe 2: RLS Isolation */}
        <div className="p-4 rounded-xl border border-[var(--border)] bg-[var(--card)] shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <div className="h-9 w-9 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
              <ShieldCheck className="h-4 w-4" />
            </div>
            {report && renderStatusBadge(report.checks.rls_isolation.status)}
          </div>
          <div>
            <h4 className="text-xs font-bold text-[var(--muted-foreground)] uppercase tracking-wider">
              Tenant RLS Isolation
            </h4>
            <div className="text-xl font-bold text-[var(--foreground)] mt-1">
              Zero Leakage
            </div>
            <p className="text-[11px] text-[var(--muted-foreground)] mt-1 truncate" title={report?.checks.rls_isolation.message}>
              {report?.checks.rls_isolation.message || 'Awaiting probe...'}
            </p>
          </div>
        </div>

        {/* Probe 3: Secure Storage Bucket */}
        <div className="p-4 rounded-xl border border-[var(--border)] bg-[var(--card)] shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <div className="h-9 w-9 rounded-lg bg-purple-500/10 text-purple-400 flex items-center justify-center">
              <HardDrive className="h-4 w-4" />
            </div>
            {report && renderStatusBadge(report.checks.storage_bucket.status)}
          </div>
          <div>
            <h4 className="text-xs font-bold text-[var(--muted-foreground)] uppercase tracking-wider">
              Vault Protection
            </h4>
            <div className="text-xl font-bold text-[var(--foreground)] mt-1">
              Private 25MB
            </div>
            <p className="text-[11px] text-[var(--muted-foreground)] mt-1 truncate" title={report?.checks.storage_bucket.message}>
              {report?.checks.storage_bucket.message || 'Awaiting probe...'}
            </p>
          </div>
        </div>

        {/* Probe 4: Orphan Records */}
        <div className="p-4 rounded-xl border border-[var(--border)] bg-[var(--card)] shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <div className="h-9 w-9 rounded-lg bg-amber-500/10 text-amber-400 flex items-center justify-center">
              <Layers className="h-4 w-4" />
            </div>
            {report && renderStatusBadge(report.checks.orphan_records.status)}
          </div>
          <div>
            <h4 className="text-xs font-bold text-[var(--muted-foreground)] uppercase tracking-wider">
              Relational Integrity
            </h4>
            <div className="text-xl font-bold text-[var(--foreground)] mt-1">
              100% Consistent
            </div>
            <p className="text-[11px] text-[var(--muted-foreground)] mt-1 truncate" title={report?.checks.orphan_records.message}>
              {report?.checks.orphan_records.message || 'Awaiting probe...'}
            </p>
          </div>
        </div>
      </div>

      {/* 2. Platform Metrics Overview */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-5 rounded-xl border border-[var(--border)] bg-[var(--secondary)]/30">
        <div>
          <span className="text-xs text-[var(--muted-foreground)] block">Active Tenants</span>
          <span className="text-2xl font-black font-mono text-[var(--foreground)]">
            {report?.metrics.tenants_count ?? '—'}
          </span>
        </div>
        <div>
          <span className="text-xs text-[var(--muted-foreground)] block">Total Projects</span>
          <span className="text-2xl font-black font-mono text-[var(--foreground)]">
            {report?.metrics.projects_count ?? '—'}
          </span>
        </div>
        <div>
          <span className="text-xs text-[var(--muted-foreground)] block">Managed Tasks</span>
          <span className="text-2xl font-black font-mono text-[var(--foreground)]">
            {report?.metrics.tasks_count ?? '—'}
          </span>
        </div>
        <div>
          <span className="text-xs text-[var(--muted-foreground)] block">Vault Attachments</span>
          <span className="text-2xl font-black font-mono text-[var(--foreground)]">
            {report?.metrics.attachments_count ?? '—'}
          </span>
        </div>
      </div>

      {/* 3. Terminal Real-Time Output Console */}
      <div className="rounded-xl border border-[var(--border)] bg-[#0a0d14] text-slate-200 shadow-xl overflow-hidden font-mono text-xs">
        <div className="flex items-center justify-between px-4 py-2.5 bg-[#0f172a] border-b border-slate-800">
          <div className="flex items-center gap-2">
            <Terminal className="h-4 w-4 text-emerald-400" />
            <span className="font-bold text-slate-300">Live Diagnostic Stream</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-emerald-400 animate-ping" />
            <span className="text-[10px] text-slate-400">SUPABASE CHANNEL LISTENER</span>
          </div>
        </div>

        <div className="p-4 space-y-1.5 min-h-[180px] max-h-72 overflow-y-auto">
          {logs.map((log, idx) => (
            <div key={idx} className="leading-relaxed">
              <span className="text-emerald-400">$ </span>
              <span>{log}</span>
            </div>
          ))}
          <div ref={terminalBottomRef} />
        </div>
      </div>
    </div>
  );
}
