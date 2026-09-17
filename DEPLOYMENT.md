# Enterprise Project Management System (PMS) - Production Deployment Guide

## 1. System Architecture Overview

Enterprise PMS is a multi-tenant project management platform architected for global scale, strict tenant data isolation, and high resilience.

- **Frontend & App Server:** Next.js 15 (App Router, Server Actions, React Server Components) on Vercel Edge & Serverless network.
- **Styling & Design System:** Tailwind CSS v4, dynamic CSS variable theming, Lucide icons, Framer Motion.
- **Database & Identity:** Supabase (PostgreSQL 16, Row Level Security, PgBouncer / Supavisor connection pooling).
- **Scheduling Engines:** In-engine CPM (Critical Path Method, Float calculation, 4 dependency types: FS/SS/FF/SF, constraints, lag days, auto-scheduling) and Resource Workload Allocator.
- **Transactional Communication:** Resend REST API adapter with exponential backoff with jitter, circuit breaker, and Node.js SMTP transporter fallback.
- **Scheduled Background Workers:** Vercel Cron triggering daily schedule audit (`0 6 * * *`) with Bearer token authentication.

---

## 2. Root SuperAdmin Account Specification

The system provisions a root SuperAdmin account during the automated database migration and seed pipeline:

- **Email:** `admin@jyotirmoyb.com`
- **Full Name:** `System Administrator`
- **Privilege Flag:** `is_superadmin = true`
- **Tenant Scope:** SuperAdmins have platform-wide multi-site privileges (`/admin/superadmin`) while maintaining default operational tenancy in `Enterprise Core` (Tenant Code: `CORE-SYS`, Slug: `core`).

### Initial Authentication Options
1. **Magic Link / Email Invite:** Trigger a passwordless authentication email to `admin@jyotirmoyb.com` via Supabase Auth dashboard or CLI.
2. **Supabase CLI Set Password:**
   ```bash
   supabase auth users create --email admin@jyotirmoyb.com --password "SecureRandomP@ssw0rd!" --email-confirm
   ```

---

## 3. Supabase Database Deployment & Seed Pipeline

### Prerequisites
- Supabase CLI installed (`npm install -g supabase`)
- Supabase Project created on Supabase Cloud

### Migration Execution
All migrations are located in `supabase/migrations/` and must be executed in numerical sequence:

| Migration File | Purpose |
|---|---|
| `00001_core_schema.sql` | Tenants, users, memberships, calendars, holidays, projects, tasks, dependencies, audit logs |
| `00002_rls_policies.sql` | Row Level Security policies enforcing strict tenant isolation |
| `00003_cpm_functions.sql` | CPM database helpers and working calendar calculations |
| `00004_guest_access.sql` | External guest containment schema and security definer functions |
| `00005_teams_and_baselines.sql` | Tenant teams, memberships, and baseline snapshots |
| `00006_custom_fields_and_notifications.sql` | Dynamic custom fields and in-app notifications |
| `00007_task_types_and_system_themes.sql` | Dynamic task types, system themes, and tenant role permissions |
| `00008_dynamic_metadata_and_constraints.sql` | Dynamic status lookups, priority levels, and task constraint types |
| `00009_root_superadmin_and_demo_seed.sql` | Root SuperAdmin `admin@jyotirmoyb.com`, default tenant `Enterprise Core`, and demo project |

### Deploy Migrations to Supabase Cloud
```bash
# Link project ref
supabase link --project-ref your-project-ref

# Push all migrations
supabase db push

# Verify database status
supabase migration list
```

### Local Development Seed (Optional)
```bash
supabase db reset
```

---

## 4. Environment Configuration

Copy `.env.example` to your deployment environment (Vercel Project Settings -> Environment Variables):

```bash
cp .env.example .env.local
```

### Required Production Environment Variables

| Variable | Scope | Description |
|---|---|---|
| `NEXT_PUBLIC_APP_URL` | Client/Server | Canonical production URL (e.g. `https://pms.jyotirmoyb.com`) |
| `NEXT_PUBLIC_ROOT_DOMAIN` | Client/Server | Root domain for tenant subdomains (e.g. `pms.jyotirmoyb.com`) |
| `NEXT_PUBLIC_SUPABASE_URL` | Client/Server | Supabase Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Client/Server | Supabase Anon Key (RLS-enforced) |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-Only | Supabase Service Role Key (Admin operations) |
| `DATABASE_URL` | Server-Only | Pooled connection string (Port 6543 with `?pgbouncer=true`) |
| `DIRECT_URL` | Server-Only | Direct connection string (Port 5432) |
| `CRON_SECRET` | Server-Only | 32+ char secret for authenticating scheduled background workers |
| `EMAIL_PROVIDER` | Server-Only | `resend` (default) or `smtp` |
| `EMAIL_FROM` | Server-Only | Standard sender address (e.g. `notifications@jyotirmoyb.com`) |
| `RESEND_API_KEY` | Server-Only | Resend production API key |

---

## 5. Vercel Deployment Pipeline

### Deploy via Vercel CLI
```bash
# Install Vercel CLI
pnpm add -g vercel

# Build & Deploy
vercel --prod
```

### Deploy via GitHub Integration
1. Push branch `main` to your remote repository.
2. Link the repository in the Vercel Dashboard.
3. Configure **Build Command**: `pnpm build`.
4. Configure **Install Command**: `pnpm install`.
5. Enter the Environment Variables from Section 4.
6. Trigger deployment.

### Vercel Cron Configuration
The repository includes `vercel.json`:
```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "crons": [
    {
      "path": "/api/cron/daily-schedule",
      "schedule": "0 6 * * *"
    }
  ]
}
```
Vercel automatically registers this cron job on deployment to run daily at 06:00 UTC and transmits `Authorization: Bearer <CRON_SECRET>`.

---

## 6. Cloudflare & Custom Domain Wildcard Setup

To enable multi-tenant company subdomains (e.g. `acme.pms.jyotirmoyb.com`, `core.pms.jyotirmoyb.com`):

### Cloudflare DNS Settings
1. Add CNAME record for root application:
   - **Type:** `CNAME`
   - **Name:** `pms`
   - **Target:** `cname.vercel-dns.com`
   - **Proxy status:** Proxied (Orange cloud)
2. Add Wildcard CNAME record for tenant routing:
   - **Type:** `CNAME`
   - **Name:** `*.pms`
   - **Target:** `cname.vercel-dns.com`
   - **Proxy status:** Proxied (Orange cloud)

### Cloudflare SSL/TLS Configuration
- Ensure SSL/TLS encryption mode is set to **Full (strict)**.
- Under Edge Certificates, enable **Always Use HTTPS** and **Minimum TLS Version: 1.2**.

---

## 7. Transactional Email DNS Verification (Resend)

To ensure 100% email deliverability without spam folder flags:
1. In Resend Dashboard, add the domain `jyotirmoyb.com`.
2. Configure DNS records on Cloudflare / DNS registrar:
   - **DKIM:** TXT record provided by Resend (`resend._domainkey.jyotirmoyb.com`).
   - **SPF:** TXT record: `v=spf1 include:amazonses.com ~all`.
   - **DMARC:** TXT record: `v=DMARC1; p=none; rua=mailto:dmarc-reports@jyotirmoyb.com`.
3. Verify domain in Resend and update `RESEND_API_KEY` and `EMAIL_FROM`.

---

## 8. Post-Deployment Verification & Smoke Tests

Execute the following verification sequence once deployed to staging/production:

1. **Root SuperAdmin Access:**
   - Sign in as `admin@jyotirmoyb.com`.
   - Navigate to `/admin/superadmin` and confirm platform metrics, tenant directory, and maintenance controls render properly.

2. **Tenant Resolution:**
   - Navigate to `https://core.pms.jyotirmoyb.com` or use tenant code `CORE-SYS` on login.
   - Confirm workspace title displays **Enterprise Core**.

3. **CPM Engine & Gantt Timeline:**
   - Open project `PRJ-CORE` (Global Infrastructure Modernization).
   - Switch to Gantt Timeline view.
   - Confirm the critical path is highlighted in red, task dependencies are rendered, and floats are accurately calculated.

4. **Background Cron Worker Smoke Test:**
   ```bash
   curl -X GET \
     -H "Authorization: Bearer $CRON_SECRET" \
     https://pms.jyotirmoyb.com/api/cron/daily-schedule
   ```
   **Expected Response (HTTP 200):**
   ```json
   {
     "success": true,
     "timestamp": "2026-09-17T06:00:00.000Z",
     "executionTimeMs": 142,
     "correlationId": "cron-daily-...",
     "metrics": {
       "milestonesAlerted": 1,
       "overdueTasksProcessed": 0,
       "digestsSent": 1
     }
   }
   ```

5. **In-App Help Documentation:**
   - Click the Help (`?`) icon in the top header.
   - Verify `/help`, `/admin/tenant/help`, and `/admin/superadmin/help` render with full navigation and search.
