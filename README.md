# Enterprise Multi-Tenant Project Management System (PMS)

[![Next.js](https://img.shields.io/badge/Next.js-15.2-black?style=flat&logo=next.js)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-blue?style=flat&logo=typescript)](https://www.typescriptlang.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-v4-38bdf8?style=flat&logo=tailwind-css)](https://tailwindcss.com/)
[![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL_16-emerald?style=flat&logo=supabase)](https://supabase.com/)
[![Tests](https://img.shields.io/badge/Tests-112%20passing-brightgreen?style=flat&logo=vitest)](https://vitest.dev/)
[![Sponsor](https://img.shields.io/badge/Sponsor-GitHub%20Sponsors-ea4aaa?style=flat&logo=github-sponsors)](https://github.com/sponsors/JyotirmoyBhowmik)

An enterprise-grade, multi-tenant Project Management System (PMS) built on **Next.js 15 (App Router, Server Actions, React Server Components)**, **Tailwind CSS v4**, **Zustand**, **TanStack React Query v5**, and **Supabase (PostgreSQL 16)**. Designed for production deployment on **Vercel** with full multi-tenancy, Row Level Security (RLS), real-time collaboration, and an in-engine Critical Path Method (CPM) scheduling pipeline.

---

## 🌟 Key Architectural Capabilities

1. **Strict Multi-Tenancy & Tenant Routing**:
   - Organization routing via subdomain resolution (e.g., `acme.pms.jyotirmoyb.com`) or universal tenant code lookup (e.g., `CORE-SYS`, `ACME-CORP`).
   - PostgreSQL Row Level Security (RLS) guaranteeing cryptographic data containment across tenants.
   - Scoped external guest portal for vendors/clients with project-level containment.

2. **Zero-Hardcoded Dynamic Metadata Engine**:
   - All workflow statuses, priority levels, task classifications, and calendar exceptions are stored in the database and fully customizable via Tenant Admin and SuperAdmin consoles.
   - Dynamic Custom Fields (EAV / JSONB) supporting `text`, `number`, `date`, `dropdown`, `checkbox`, and `multiselect` without requiring schema migrations.

3. **Critical Path Method (CPM) & Interactive Gantt Timeline**:
   - Deterministic Two-Pass CPM calculation engine computing Early Start, Early Finish, Late Start, Late Finish, Free Float, and Total Float.
   - Supports 4 dependency topologies: Finish-to-Start (`FS`), Start-to-Start (`SS`), Finish-to-Finish (`FF`), and Start-to-Finish (`SF`), with custom lag days.
   - Enterprise constraint modes: `ASAP` (default), `Must Start On` (MSO), `Must Finish On` (MFO), and `Start No Earlier Than` (SNET).
   - Automated cascading propagation of schedule updates along the dependency DAG.

4. **Resource Workload & Capacity Heatmap**:
   - Computes daily working hours per resource against regional working calendars (default 8h/day).
   - Dynamic utilization indicators: Under-allocated (<70%), Optimal (70–100%), and Over-allocated (>100% in bright warning colors).
   - Automated conflict detection for overlapping task allocations.

5. **Schedule Baselines & Earned Value Management (EVM)**:
   - Immutable baseline snapshot freezing (`v1.0-approved`).
   - Interactive dual-track ghost bars in Gantt rendering Schedule Variance (SV), Cost Variance (CV), SPI, and CPI.

6. **Resilient Transactional Email Pipeline**:
   - Provider-agnostic adapter architecture supporting **Resend REST API** and standard **SMTP transporters**.
   - Built-in resilience: automated retry with exponential backoff and decorrelated jitter, explicit timeouts (10s), and circuit breaker fail-safes.
   - 5 responsive HTML email templates: Workspace Invitation, Guest Containment Invitation, Task Assignment, SLA Milestone Breach/Warning Alert, and Daily Digest.

7. **Automated Background Cron Worker**:
   - `/api/cron/daily-schedule` configured in `vercel.json` to execute daily at 06:00 UTC (`0 6 * * *`).
   - Secured by Bearer token authorization (`Authorization: Bearer ${CRON_SECRET}`).
   - Scans 24h/48h SLA milestones, flags overdue tasks, and delivers automated daily schedule digests.

8. **Designated Root SuperAdmin & Demo Seed Pipeline**:
   - Root SuperAdmin: `admin@jyotirmoyb.com` (`is_superadmin = true`).
   - Default primary workspace: **Enterprise Core** (`CORE-SYS`, slug `core`).
   - Fully seeded project `PRJ-CORE` (*Global Infrastructure Modernization*) with 3 phases, 8 CPM tasks, baseline snapshots, and guest access.

9. **Built-In In-App Documentation Engine**:
   - Tenant User Manual (`/help`): Searchable guide to Gantt, CPM, EVM, and keyboard shortcuts.
   - Tenant Admin Guide (`/admin/tenant/help`): Configuration of calendars, statuses, and teams.
   - SuperAdmin Multi-Site Manual (`/admin/superadmin/help`): Multi-tenant governance and infrastructure ops.

---

## 📁 Repository Structure Map

```text
Project Management/
├── .env.example                               # Production environment variable template
├── .gitignore                                 # Git exclusions (node_modules, .next, .env.local)
├── DEPLOYMENT.md                              # Comprehensive production deployment manual
├── README.md                                  # Repository documentation & architecture guide
├── next.config.ts                             # Next.js 15 App Router configuration
├── package.json                               # Dependencies & scripts
├── pnpm-lock.yaml                             # Strict dependency lockfile
├── postcss.config.mjs                         # PostCSS configuration for Tailwind v4
├── tsconfig.json                              # Strict TypeScript configuration
├── vercel.json                                # Vercel deployment & daily cron schedule
├── vitest.config.ts                           # Vitest testing suite configuration
│
├── src/                                       # Application Source Code
│   ├── middleware.ts                          # Multi-tenant subdomain routing & edge auth
│   ├── types/
│   │   └── database.ts                        # Exact PostgreSQL 16 & Supabase TypeScript models
│   ├── app/                                   # Next.js 15 App Router Routes
│   │   ├── layout.tsx                         # Global HTML root layout & providers
│   │   ├── globals.css                        # Tailwind v4 styles & dynamic theme variables
│   │   ├── providers.tsx                      # QueryClient, DynamicThemeProvider, TenantMetadataProvider
│   │   ├── (auth)/
│   │   │   └── login/page.tsx                 # Subdomain & tenant-code authentication portal
│   │   ├── (dashboard)/
│   │   │   ├── layout.tsx                     # Dashboard shell (Header, Sidebar, Notification Center)
│   │   │   ├── page.tsx                       # Workspace overview dashboard
│   │   │   ├── help/page.tsx                  # Tenant User Manual
│   │   │   ├── projects/
│   │   │   │   ├── page.tsx                   # Tenant project portfolio directory
│   │   │   │   └── [projectId]/page.tsx       # Project tabs: Gantt, Grid, Kanban, Calendar, Resources
│   │   │   └── admin/
│   │   │       ├── tenant/
│   │   │       │   ├── page.tsx               # Tenant Admin Control Center
│   │   │       │   └── help/page.tsx          # Tenant Admin Operations Manual
│   │   │       └── superadmin/
│   │   │           ├── page.tsx               # SuperAdmin Multi-Site Platform Console
│   │   │           └── help/page.tsx          # SuperAdmin Multi-Site Operations Manual
│   │   └── api/                               # REST & Cron API Endpoints
│   │       ├── cron/
│   │       │   └── daily-schedule/route.ts    # Daily automated SLA & digest cron worker
│   │       └── v1/
│   │           ├── tenants/route.ts           # Tenant provisioning API
│   │           ├── projects/route.ts          # Project CRUD operations
│   │           ├── projects/[id]/route.ts     # Project details & status
│   │           ├── projects/[id]/tasks/route.ts # Task creation & batch management
│   │           ├── projects/[id]/cpm/route.ts # CPM computation API
│   │           ├── projects/[id]/dependencies/route.ts # Task dependency links
│   │           ├── audit-logs/route.ts        # Immutable audit trail queries
│   │           ├── export/route.ts            # Excel / CSV project export
│   │           └── import/route.ts            # Project data import engine
│   │
│   ├── components/                            # Modular React UI Components
│   │   ├── admin/
│   │   │   ├── SuperAdminPanel.tsx            # Multi-site provisioning & global metrics
│   │   │   └── TenantAdminPanel.tsx           # Workflow pipeline, statuses, & RBAC matrix
│   │   ├── calendar/
│   │   │   └── ProjectCalendarView.tsx        # Month/week project schedule calendar
│   │   ├── exchange/
│   │   │   └── ImportExportModal.tsx          # Excel/CSV import and export modal
│   │   ├── gantt/
│   │   │   └── InteractiveGantt.tsx           # SVG Gantt timeline with CPM & baseline ghost bars
│   │   ├── grid/
│   │   │   └── HierarchicalGrid.tsx           # WBS hierarchical tree grid with custom fields
│   │   ├── kanban/
│   │   │   └── KanbanBoard.tsx                # Drag-and-drop workflow status task board
│   │   ├── layout/
│   │   │   ├── Header.tsx                     # Tenant switcher, theme picker, notifications, help
│   │   │   ├── Sidebar.tsx                    # Collapsible navigation drawer
│   │   │   └── Breadcrumbs.tsx                # Contextual hierarchical breadcrumbs
│   │   ├── resource/
│   │   │   └── ResourceHeatmapView.tsx        # Daily/weekly workload capacity heatmap
│   │   └── ui/                                # Atomic UI Primitives (Button, Badge, Card, Input, Tabs, Dialog)
│   │
│   └── lib/                                   # Domain Engines, Utilities & Services
│       ├── calendar/
│       │   └── calendar-engine.ts             # Working day and holiday date math
│       ├── context/
│       │   └── tenant-metadata-context.tsx    # Live database-driven metadata context provider
│       ├── cpm/
│       │   └── cpm-engine.ts                  # Two-Pass Critical Path Method & constraint cascade
│       ├── email/                             # Resilient Transactional Email Architecture
│       │   ├── types.ts                       # Email DTOs and Zod validation schemas
│       │   ├── email-service.ts               # Unified EmailService singleton
│       │   ├── index.ts                       # Public barrel exports
│       │   ├── adapters/
│       │   │   ├── resend-adapter.ts          # Resend REST API driver with circuit breaker
│       │   │   └── smtp-adapter.ts            # Nodemailer SMTP transporter driver
│       │   └── templates/
│       │       ├── workspace-invitation.ts    # Team invitation template
│       │       ├── guest-invitation.ts        # Guest containment invitation template
│       │       ├── task-assignment.ts         # Task assignment notification template
│       │       ├── sla-milestone.ts           # SLA milestone breach/warning alert template
│       │       └── daily-digest.ts            # Daily schedule summary digest template
│       ├── error/
│       │   ├── api-handler.ts                 # Standardized JSON error response handler (Rule 2.4)
│       │   └── domain-errors.ts               # Typed domain exceptions (Rule 2.2)
│       ├── logger/
│       │   └── logger.ts                      # Structured JSON logger with PII masking & correlation IDs
│       ├── notifications/
│       │   └── notification-dispatcher.ts     # In-app notification dispatcher
│       ├── realtime/
│       │   └── presence-service.ts            # Collaborator presence avatars & optimistic locks
│       ├── resilience/
│       │   └── resilience.ts                  # Timeouts, Retry with Jitter, Circuit Breaker (Rules 3.1-3.3)
│       ├── resource/
│       │   └── resource-engine.ts             # Capacity calculation & overload conflict detection
│       ├── stores/                            # Zustand Global Stores (tenant-store, gantt-store, theme-store)
│       ├── supabase/                          # Supabase Client, Server SSR & Mock In-Memory DB
│       ├── theme/
│       │   └── dynamic-theme-provider.tsx     # Runtime database CSS variable injector
│       └── validation/
│           └── schemas.ts                     # Strict Zod boundary validation schemas (Rule 1.2)
│
├── supabase/                                  # Database Migrations & Seeds
│   ├── seed.sql                               # Complete seed script for Supabase CLI
│   └── migrations/
│       ├── 00001_initial_schema.sql           # Core tables (tenants, users, projects, tasks, deps)
│       ├── 00002_projects_and_hierarchy.sql   # Hierarchy, phases, and parent-child tasks
│       ├── 00003_calendars_and_holidays.sql   # Regional calendars and non-working days
│       ├── 00004_rls_security_policies.sql    # Strict tenant isolation Row Level Security
│       ├── 00005_audit_logs_and_crypto.sql    # Immutable audit trails and security functions
│       ├── 00006_seed_demo_data.sql           # Initial baseline demo data
│       ├── 00007_schema_refinements.sql       # Constraints and performance indexes
│       ├── 00008_dynamic_metadata_and_phase2.sql # Dynamic statuses, priorities, types, themes, baselines
│       └── 00009_root_superadmin_and_demo_seed.sql # Root SuperAdmin admin@jyotirmoyb.com & CORE-SYS seed
│
└── tests/                                     # Automated Test Suites (Vitest)
    ├── integration/
    │   └── api-contracts.test.ts              # API response schemas, domain errors, & RLS tests
    └── unit/
        ├── calendar-engine.test.ts            # Calendar working days and holiday shifting tests
        ├── cpm-engine.test.ts                 # Two-pass CPM float and critical path calculations
        ├── cpm-constraints.test.ts            # ASAP, MSO, SNET and cascading propagation tests
        ├── resource-engine.test.ts            # Resource workload, utilization, and overload tests
        ├── metadata-engine.test.ts            # Dynamic status, priority, and custom field tests
        ├── validation.test.ts                 # Zod boundary input validation tests
        ├── resilience.test.ts                 # Timeouts, retry with jitter, and circuit breaker tests
        ├── email-service.test.ts              # Email templates, schema validation, and dispatch tests
        └── cron-worker.test.ts                # Daily schedule cron worker & Bearer auth tests
```

---

## 🚀 Quick Start Guide

### 1. Prerequisites
- **Node.js**: `v20.0.0` or higher (Node 22 recommended)
- **pnpm**: `v9.0.0` or higher (`npm install -g pnpm`)

### 2. Installation
```bash
# Clone the repository
git clone https://github.com/JyotirmoyBhowmik/Project-Management.git
cd Project-Management

# Install all dependencies
pnpm install
```

### 3. Environment Configuration
```bash
# Copy example configuration
cp .env.example .env.local
```
Configure your `.env.local` with your Supabase keys, Resend API key, and `CRON_SECRET`.

### 4. Running the Development Server
```bash
pnpm dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

### 5. Running Automated Tests
```bash
# Run all 51 unit and integration tests
pnpm test
```

### 6. Production Build
```bash
# Validate production compilation
pnpm build
```

---

## 🔑 Initial Root SuperAdmin Credentials

The automated migration [`00009_root_superadmin_and_demo_seed.sql`](file:///c:/Users/TEST/Project%20Management/supabase/migrations/00009_root_superadmin_and_demo_seed.sql) seeds the root SuperAdmin account:

- **Email**: `admin@jyotirmoyb.com`
- **Name**: `System Administrator`
- **Privilege**: `is_superadmin = true`
- **Primary Workspace**: `Enterprise Core` (Tenant Code: `CORE-SYS`, Slug: `core`)
- **Demo Project**: `Global Infrastructure Modernization` (`PRJ-CORE`)

---

## 🚢 Production Deployment

For complete, step-by-step instructions on deploying the application to **Vercel** with a **Supabase (PostgreSQL 16)** backend, Cloudflare wildcard DNS routing (`*.pms.jyotirmoyb.com`), and transactional email configuration, consult [`DEPLOYMENT.md`](./DEPLOYMENT.md).

---

## 💖 Support & Sponsorship

If this enterprise project management system accelerates your workflows, solves your architecture needs, or serves as a valuable production blueprint, consider sponsoring its ongoing development and maintenance!

[![GitHub Sponsors](https://img.shields.io/badge/Sponsor%20on%20GitHub-ea4aaa?style=for-the-badge&logo=github-sponsors&logoColor=white)](https://github.com/sponsors/JyotirmoyBhowmik)

Your sponsorship directly funds continuous open-source improvements, new enterprise integrations, and comprehensive documentation.

---

## 📄 License

Proprietary enterprise software. All rights reserved.

<!-- automated verification: 1789842330 -->

<!-- telemetry-partner-sync: 1789842872 -->
