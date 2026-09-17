// ==============================================================================
// src/app/(dashboard)/admin/superadmin/help/page.tsx
// SuperAdmin Multi-Site Operations Manual
// Platform-level multi-tenancy, cross-tenant observability, and maintenance
// ==============================================================================

'use client';

import * as React from 'react';
import {
  Globe,
  Database,
  Cpu,
  KeyRound,
  Terminal,
  Server,
  ArrowLeft,
  ShieldAlert,
  Clock,
  Sparkles,
  FileCode,
} from 'lucide-react';
import Link from 'next/link';

export default function SuperAdminManualPage() {
  const sections = [
    {
      title: '1. Root SuperAdmin Account & Privileges',
      icon: KeyRound,
      content: [
        {
          heading: 'Designated Root Account',
          text: 'The platform designates admin@jyotirmoyb.com as the root SuperAdmin. This account has is_superadmin = true and bypasses standard tenant membership restrictions to manage platform-wide state, provision organizations, and monitor cross-tenant performance.',
        },
        {
          heading: 'SuperAdmin Access Matrix',
          text: 'SuperAdmins can access /admin/superadmin to view global metrics, inspect tenant quotas, activate/deactivate organizations, trigger maintenance mode, and manage platform theme palettes.',
        },
      ],
    },
    {
      title: '2. Multi-Tenant Provisioning Pipeline',
      icon: Globe,
      content: [
        {
          heading: 'Tenant Onboarding Lifecycle',
          text: 'When a new organization is provisioned:\n1. A tenant record is generated with a unique Tenant Code and URL Slug.\n2. Default working calendars (e.g. Western Mon-Fri 8h/day) and standard public holidays are instantiated.\n3. Base workflow statuses (Todo, In Progress, In Review, Done) and priority classifications are created.\n4. Initial Tenant Admin profile and membership links are established.',
        },
        {
          heading: 'Subdomain & Wildcard DNS Binding',
          text: 'Wildcard DNS (*.pms.jyotirmoyb.com) routes requests through Cloudflare SSL termination into Vercel Edge Middleware. Middleware inspects the host header, extracts the subdomain slug, and scopes Supabase queries.',
        },
      ],
    },
    {
      title: '3. Background Workers & Automated Cron Architecture',
      icon: Clock,
      content: [
        {
          heading: 'Daily Schedule Worker (/api/cron/daily-schedule)',
          text: 'Configured in vercel.json to trigger daily at 06:00 UTC (0 6 * * *). Protected by Bearer token authorization: Authorization: Bearer ${CRON_SECRET}.',
        },
        {
          heading: 'Automated Operations Performed',
          text: '• SLA Milestone Monitor: Scans critical path milestones approaching target dates within 24/48 hours and dispatches early warning emails.\n• Overdue Task Escalation: Flags past-due work items and notifies assignees and project managers.\n• Daily Digest Dispatch: Compiles summary tables of upcoming and overdue tasks per workspace.',
        },
      ],
    },
    {
      title: '4. Database Integrity & Production Seed Pipeline',
      icon: Database,
      content: [
        {
          heading: 'Production Seed (supabase/seed.sql)',
          text: 'Migration 00009 and supabase/seed.sql provision the baseline operational dataset: root SuperAdmin admin@jyotirmoyb.com, default tenant "Enterprise Core" (CORE-SYS), 2 functional teams, full working calendar, and project "Global Infrastructure Modernization" (PRJ-CORE).',
        },
        {
          heading: 'Connection Pooling & PgBouncer',
          text: 'Server actions and serverless functions connect via Supabase connection pooler (port 6543) using transaction pooling mode to prevent PostgreSQL connection exhaustion under high concurrency.',
        },
      ],
    },
    {
      title: '5. Observability & Distributed Tracing (Rules 4.1 - 4.3)',
      icon: Cpu,
      content: [
        {
          heading: 'Structured JSON Logging',
          text: 'All system components write structured JSON logs with contextual metadata: level, timestamp, service_name, function_name, and correlation_id. Sensitive PII (passwords, tokens) is masked before serialization.',
        },
        {
          heading: 'Circuit Breaker Fail-Safe',
          text: 'Third-party integrations (Resend API, SMTP transporters) are protected by circuit breakers that transition to OPEN state after 4 consecutive failures, avoiding cascading thread lockups.',
        },
      ],
    },
  ];

  return (
    <div className="mx-auto max-w-6xl space-y-8 p-6 lg:p-10">
      {/* Back Link */}
      <div>
        <Link
          href="/help"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--muted-foreground)] hover:text-[var(--primary)] transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          <span>Back to General User Manual</span>
        </Link>
      </div>

      {/* Header Banner */}
      <div className="relative overflow-hidden rounded-2xl border border-red-500/20 bg-gradient-to-br from-[var(--card)] via-red-950/10 to-[var(--card)] p-8 shadow-sm">
        <div className="relative z-10 max-w-2xl space-y-3">
          <div className="inline-flex items-center gap-2 rounded-full border border-red-500/30 bg-red-500/10 px-3 py-1 text-xs font-semibold text-red-400">
            <ShieldAlert className="h-3.5 w-3.5" />
            <span>Root SuperAdmin Operations</span>
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-[var(--foreground)] sm:text-4xl">
            SuperAdmin Multi-Site Operations Manual
          </h1>
          <p className="text-sm leading-relaxed text-[var(--muted-foreground)]">
            Platform architecture, multi-tenant provisioning, automated cron workers, and production deployment protocols for designated administrator <strong className="text-[var(--foreground)]">admin@jyotirmoyb.com</strong>.
          </p>
        </div>
      </div>

      {/* Sections Grid */}
      <div className="space-y-6">
        {sections.map((section, idx) => {
          const Icon = section.icon;
          return (
            <div
              key={idx}
              className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-xs"
            >
              <div className="flex items-center gap-3 border-b border-[var(--border)] pb-4">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-red-500/10 text-red-400">
                  <Icon className="h-5 w-5" />
                </div>
                <h2 className="text-base font-bold text-[var(--foreground)]">{section.title}</h2>
              </div>

              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                {section.content.map((item, itemIdx) => (
                  <div key={itemIdx} className="rounded-lg border border-[var(--border)]/60 bg-[var(--secondary)]/20 p-4">
                    <h3 className="text-sm font-bold text-[var(--foreground)]">{item.heading}</h3>
                    <p className="mt-2 text-xs leading-relaxed text-[var(--muted-foreground)] whitespace-pre-line">
                      {item.text}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Deployment Reference Card */}
      <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-6">
        <div className="flex items-center gap-2 text-sm font-bold text-[var(--foreground)]">
          <FileCode className="h-4 w-4 text-[var(--primary)]" />
          <span>Deployment & Environment Reference</span>
        </div>
        <p className="mt-2 text-xs text-[var(--muted-foreground)] leading-relaxed">
          For step-by-step production deployment instructions, Vercel environment variable matrices, Cloudflare DNS configurations, and database migration commands, refer to <code className="rounded bg-[var(--secondary)] px-1.5 py-0.5 text-[var(--primary)] font-mono">DEPLOYMENT.md</code> in the project root.
        </p>
      </div>
    </div>
  );
}
