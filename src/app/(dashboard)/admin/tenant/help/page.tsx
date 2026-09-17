// ==============================================================================
// src/app/(dashboard)/admin/tenant/help/page.tsx
// Tenant Administrator Manual & Configuration Guide
// Complete guidance for managing teams, calendars, metadata & security
// ==============================================================================

'use client';

import * as React from 'react';
import {
  ShieldCheck,
  Building,
  Calendar,
  Sliders,
  Users2,
  HardDrive,
  Mail,
  Lock,
  ArrowLeft,
  ArrowRight,
  Sparkles,
  CheckCircle,
} from 'lucide-react';
import Link from 'next/link';

export default function TenantAdminManualPage() {
  const sections = [
    {
      title: 'Tenant Organization & Identity Management',
      icon: Building,
      description: 'Configuring workspace branding, custom domains, and organizational identifiers.',
      items: [
        {
          heading: 'Tenant Code & Slug Architecture',
          text: 'Every organization is assigned a unique Tenant Code (e.g. CORE-SYS, ACME-CORP) and URL Slug (e.g. core, acme). Users can sign in by supplying their Tenant Code or navigating to their assigned subdomain (e.g. acme.pms.jyotirmoyb.com).',
        },
        {
          heading: 'Custom Branding & Theming',
          text: 'Administrators can upload company logos and designate default color schemes across 5 enterprise palettes (Light, Dark, Enterprise Navy, Monokai OLED, High-Contrast).',
        },
      ],
    },
    {
      title: 'Working Calendars & Holiday Exceptions',
      icon: Calendar,
      description: 'Governing scheduling mechanics across differing geographic and corporate schedules.',
      items: [
        {
          heading: 'Custom Working Week Configurations',
          text: 'Organizations operating on non-standard work weeks (e.g. Sunday–Thursday in the Middle East or Monday–Friday in Western regions) can configure specific active days and daily working hours (default: 8.0h).',
        },
        {
          heading: 'Public Holiday Schedules',
          text: 'Holidays defined in the tenant calendar are treated as non-working days by the CPM Forward and Backward passes. Tasks spanning holidays automatically shift their finish dates outward without consuming contingency float.',
        },
      ],
    },
    {
      title: 'Dynamic Task Metadata Engine',
      icon: Sliders,
      description: 'Administering custom workflow statuses, priority levels, and task classifications (Zero Hardcoded Values).',
      items: [
        {
          heading: 'Tenant-Configured Statuses',
          text: 'Administrators can create bespoke workflow stages (e.g. Backlog, In Review, QA Verification, Deployed) and map them to system categories (todo, in_progress, done).',
        },
        {
          heading: 'Custom Priority & Type Classifications',
          text: 'Define severity tiers and project task types (e.g. Milestone, Technical Spike, Bug Fix, Compliance Audit) complete with custom color codes and badge styles.',
        },
      ],
    },
    {
      title: 'Team Management & Invitations',
      icon: Users2,
      description: 'Controlling staff provisioning, role-based access, and transactional invitation emails.',
      items: [
        {
          heading: 'Role Hierarchy',
          text: '• Tenant Admin: Full control over tenant settings, calendars, metadata, and user accounts.\n• Project Manager: Creation and CPM scheduling of projects, baselines, and assignments.\n• Member: Task updates, timesheets, and collaborative progress reporting.\n• Guest: Strictly confined to specific projects shared via Guest Access records.',
        },
        {
          heading: 'Transactional Email Invitations',
          text: 'Inviting new members dispatches responsive HTML invitations via Resend or SMTP. Invitations carry secure tokens with cryptographic expiry periods.',
        },
      ],
    },
    {
      title: 'Storage Quotas & Audit Observability',
      icon: HardDrive,
      description: 'Monitoring resource consumption, attachment quotas, and enterprise audit logs.',
      items: [
        {
          heading: 'Tenant Storage Quota Controls',
          text: 'Administrators can monitor cumulative storage usage for project attachments and enforce per-file upload caps (default: 25 MB).',
        },
        {
          heading: 'Audit Trail & Tracing',
          text: 'Every mutation (task schedule updates, dependency creations, role modifications) produces an immutable audit record linked to the actor’s ID and correlation trace ID.',
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
      <div className="relative overflow-hidden rounded-2xl border border-[var(--border)] bg-gradient-to-br from-[var(--card)] via-[var(--secondary)]/30 to-[var(--card)] p-8 shadow-sm">
        <div className="relative z-10 max-w-2xl space-y-3">
          <div className="inline-flex items-center gap-2 rounded-full border border-purple-500/30 bg-purple-500/10 px-3 py-1 text-xs font-semibold text-purple-400">
            <ShieldCheck className="h-3.5 w-3.5" />
            <span>Workspace Administration</span>
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-[var(--foreground)] sm:text-4xl">
            Tenant Administrator Manual
          </h1>
          <p className="text-sm leading-relaxed text-[var(--muted-foreground)]">
            Comprehensive guide to workspace governance, working calendars, dynamic workflow lookups, and multi-user access controls.
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
              <div className="flex items-start gap-4 border-b border-[var(--border)] pb-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-purple-500/10 text-purple-400">
                  <Icon className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-[var(--foreground)]">{section.title}</h2>
                  <p className="mt-0.5 text-xs text-[var(--muted-foreground)]">{section.description}</p>
                </div>
              </div>

              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                {section.items.map((item, itemIdx) => (
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

      {/* SuperAdmin Cross-Link */}
      <div className="flex items-center justify-between rounded-xl border border-[var(--border)] bg-[var(--card)] p-6">
        <div>
          <h3 className="text-sm font-bold text-[var(--foreground)]">Platform & SuperAdmin Operations</h3>
          <p className="text-xs text-[var(--muted-foreground)]">
            Need platform-level multi-site guidance or database maintenance manuals?
          </p>
        </div>
        <Link
          href="/admin/superadmin/help"
          className="flex items-center gap-1.5 rounded-lg bg-[var(--primary)] px-4 py-2 text-xs font-semibold text-white hover:opacity-90 transition-opacity"
        >
          <span>SuperAdmin Multi-Site Manual</span>
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>
    </div>
  );
}
