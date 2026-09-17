// ==============================================================================
// src/app/(dashboard)/help/page.tsx
// Tenant User Manual & System Guide
// Interactive in-app documentation with search, visual walkthroughs & shortcuts
// ==============================================================================

'use client';

import * as React from 'react';
import {
  BookOpen,
  Search,
  Calendar,
  Layers,
  Users,
  Activity,
  Shield,
  Clock,
  Sparkles,
  Command,
  ArrowRight,
  CheckCircle2,
  AlertTriangle,
  GitBranch,
} from 'lucide-react';
import Link from 'next/link';

export default function TenantUserManualPage() {
  const [searchQuery, setSearchQuery] = React.useState('');
  const [selectedSection, setSelectedSection] = React.useState('all');

  const sections = [
    {
      id: 'getting-started',
      title: '1. Getting Started & Workspace Concepts',
      icon: BookOpen,
      content: [
        {
          heading: 'Multi-Tenant Isolation',
          text: 'Enterprise PMS operates with absolute database-level row containment. Every project, task, milestone, dependency, and resource allocation belongs strictly to your active tenant. Cross-tenant leakage is mathematically prevented via Row Level Security (RLS) policies.',
        },
        {
          heading: 'Tenant Code & Subdomain Login',
          text: 'You can sign in directly through your dedicated company subdomain (e.g. acme.pms.jyotirmoyb.com) or enter your organization’s unique tenant code (e.g. CORE-SYS, ACME-CORP) on the universal login screen.',
        },
      ],
    },
    {
      id: 'cpm-scheduling',
      title: '2. Critical Path Method (CPM) & Gantt Engine',
      icon: Layers,
      content: [
        {
          heading: 'CPM Calculation Engine',
          text: 'The scheduling engine executes a deterministic Two-Pass CPM algorithm (Forward Pass calculates Early Start / Early Finish; Backward Pass calculates Late Start / Late Finish). Total Float and Free Float are dynamically derived.',
        },
        {
          heading: 'Dependency Types Supported',
          text: 'Enterprise PMS supports all 4 standard CPM relationship topologies with custom Lag Days:\n• Finish-to-Start (FS): Successor starts when predecessor completes.\n• Start-to-Start (SS): Successor starts once predecessor begins.\n• Finish-to-Finish (FF): Successor finishes when predecessor finishes.\n• Start-to-Finish (SF): Successor finishes when predecessor starts.',
        },
        {
          heading: 'Task Constraint Modes',
          text: 'Tasks can be pinned using enterprise constraint modes:\n• ASAP (As Soon As Possible): Default dynamic positioning driven by dependencies.\n• Must Start On (MSO): Pins task start strictly to a fixed calendar date.\n• Must Finish On (MFO): Pins completion date.\n• Start No Earlier Than (SNET): Constrains the earliest possible start window.',
        },
        {
          heading: 'Auto-Scheduling & Cascading Propagation',
          text: 'When a predecessor task is delayed or lengthened, downstream connected tasks automatically cascade forward while respecting working calendars and public holidays.',
        },
      ],
    },
    {
      id: 'resource-management',
      title: '3. Resource Capacity & Workload Allocation',
      icon: Users,
      content: [
        {
          heading: 'Capacity Utilization Calculation',
          text: 'The resource engine calculates each team member’s daily workload by aggregating allocated hours across all active concurrent tasks and dividing by the working calendar’s daily capacity (default: 8 hours).',
        },
        {
          heading: 'Over-Allocation Warnings',
          text: 'When a resource exceeds 100% capacity on any working day, visual badges highlight the overload in bright amber/rose, allowing project managers to level workloads across team members.',
        },
      ],
    },
    {
      id: 'baselines-evm',
      title: '4. Baseline Snapshots & Earned Value (EVM)',
      icon: Activity,
      content: [
        {
          heading: 'Versioned Baseline Snapshots',
          text: 'Project managers can capture immutable baseline snapshots at major project milestones. The system stores start dates, end dates, durations, and budget estimates to compare against actual performance.',
        },
        {
          heading: 'Variance & EVM Metrics',
          text: 'The Gantt view renders dual bars (baseline versus current live schedule). Metrics tracked include Schedule Variance (SV), Cost Variance (CV), Schedule Performance Index (SPI), and Cost Performance Index (CPI).',
        },
      ],
    },
    {
      id: 'guest-containment',
      title: '5. External Guest Portal & Containment',
      icon: Shield,
      content: [
        {
          heading: 'Secure Vendor & Client Collaboration',
          text: 'External stakeholders can be invited to collaborate on specific projects as Guests (Viewer or Collaborator). Guests cannot see other projects, tenant settings, financial metadata, or team directories.',
        },
      ],
    },
    {
      id: 'keyboard-shortcuts',
      title: '6. Keyboard Navigation & Productivity Shortcuts',
      icon: Command,
      content: [
        {
          heading: 'Global Hotkeys',
          text: '• ? : Open this Help & Documentation center\n• Ctrl + K (or Cmd + K) : Open Global Command Palette\n• G then P : Navigate to Projects\n• G then T : Navigate to Tasks\n• G then G : Navigate to Gantt View\n• G then R : Navigate to Resource Capacity\n• Esc : Dismiss modals, drawers, and popovers',
        },
      ],
    },
  ];

  const filteredSections = sections.filter((s) => {
    if (selectedSection !== 'all' && s.id !== selectedSection) return false;
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      s.title.toLowerCase().includes(q) ||
      s.content.some((c) => c.heading.toLowerCase().includes(q) || c.text.toLowerCase().includes(q))
    );
  });

  return (
    <div className="mx-auto max-w-6xl space-y-8 p-6 lg:p-10">
      {/* Header Banner */}
      <div className="relative overflow-hidden rounded-2xl border border-[var(--border)] bg-gradient-to-br from-[var(--card)] via-[var(--secondary)]/30 to-[var(--card)] p-8 shadow-sm">
        <div className="relative z-10 max-w-2xl space-y-3">
          <div className="inline-flex items-center gap-2 rounded-full border border-blue-500/30 bg-blue-500/10 px-3 py-1 text-xs font-semibold text-blue-400">
            <Sparkles className="h-3.5 w-3.5" />
            <span>Official In-App Guide</span>
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-[var(--foreground)] sm:text-4xl">
            User Operations Manual
          </h1>
          <p className="text-sm leading-relaxed text-[var(--muted-foreground)]">
            Everything you need to master project planning, CPM scheduling, resource allocation, and baseline tracking in Enterprise PMS.
          </p>
        </div>

        {/* Search Input */}
        <div className="mt-6 max-w-lg">
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--muted-foreground)]" />
            <input
              type="text"
              placeholder="Search guides, CPM rules, hotkeys, features..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-xl border border-[var(--border)] bg-[var(--card)] py-2.5 pl-10 pr-4 text-sm text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] focus:border-[var(--primary)] focus:outline-none focus:ring-1 focus:ring-[var(--primary)]"
            />
          </div>
        </div>
      </div>

      {/* Quick Nav Badges */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setSelectedSection('all')}
          className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
            selectedSection === 'all'
              ? 'bg-[var(--primary)] text-white'
              : 'border border-[var(--border)] bg-[var(--card)] text-[var(--muted-foreground)] hover:bg-[var(--secondary)]'
          }`}
        >
          All Topics
        </button>
        {sections.map((sec) => (
          <button
            key={sec.id}
            onClick={() => setSelectedSection(sec.id)}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
              selectedSection === sec.id
                ? 'bg-[var(--primary)] text-white'
                : 'border border-[var(--border)] bg-[var(--card)] text-[var(--muted-foreground)] hover:bg-[var(--secondary)]'
            }`}
          >
            <sec.icon className="h-3.5 w-3.5" />
            <span>{sec.title.split('. ')[1]}</span>
          </button>
        ))}
      </div>

      {/* Manual Content Sections */}
      <div className="space-y-6">
        {filteredSections.map((sec) => {
          const Icon = sec.icon;
          return (
            <div
              key={sec.id}
              className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-xs transition-shadow hover:shadow-md"
            >
              <div className="flex items-center gap-3 border-b border-[var(--border)] pb-4">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[var(--primary)]/10 text-[var(--primary)]">
                  <Icon className="h-5 w-5" />
                </div>
                <h2 className="text-lg font-bold text-[var(--foreground)]">{sec.title}</h2>
              </div>

              <div className="mt-4 grid gap-6 sm:grid-cols-2">
                {sec.content.map((item, idx) => (
                  <div key={idx} className="rounded-lg border border-[var(--border)]/60 bg-[var(--secondary)]/20 p-4">
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

        {filteredSections.length === 0 && (
          <div className="rounded-xl border border-dashed border-[var(--border)] p-12 text-center">
            <p className="text-sm text-[var(--muted-foreground)]">No manual entries match your search query.</p>
          </div>
        )}
      </div>

      {/* Admin Manual Link Footer */}
      <div className="flex flex-col sm:flex-row items-center justify-between rounded-xl border border-[var(--border)] bg-[var(--card)] p-6 gap-4">
        <div>
          <h3 className="text-sm font-bold text-[var(--foreground)]">Looking for Administrator Guides?</h3>
          <p className="text-xs text-[var(--muted-foreground)]">
            Explore Tenant Administration guides for calendars, teams, statuses, and security policies.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/admin/tenant/help"
            className="flex items-center gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--secondary)] px-4 py-2 text-xs font-semibold text-[var(--foreground)] hover:bg-[var(--secondary)]/80 transition-colors"
          >
            <span>Tenant Admin Guide</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
          <Link
            href="/admin/superadmin/help"
            className="flex items-center gap-1.5 rounded-lg bg-[var(--primary)] px-4 py-2 text-xs font-semibold text-white hover:opacity-90 transition-opacity"
          >
            <span>SuperAdmin Guide</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>
    </div>
  );
}
