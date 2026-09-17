// ==============================================================================
// src/app/(auth)/login/page.tsx
// Two-Stage Tenant-Aware Authentication Gateway (Zero Hardcoded Data)
// Stage 1: Workspace Resolution -> Stage 2: Tenant-Scoped Credential Authentication
// ==============================================================================

'use client';

import * as React from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Building2,
  ArrowRight,
  ShieldCheck,
  AlertCircle,
  Lock,
  Mail,
  Loader2,
  ArrowLeft,
  Database,
  CheckCircle2,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { dbService } from '@/lib/supabase/db-service';
import { useTenantStore } from '@/lib/stores/tenant-store';
import { Tenant } from '@/types/database';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';

function LoginPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();
  const { setActiveTenant, setCurrentUser } = useTenantStore();

  const [step, setStep] = React.useState<1 | 2>(1);
  const [workspaceCode, setWorkspaceCode] = React.useState('');
  const [resolvedTenant, setResolvedTenant] = React.useState<Tenant | null>(null);

  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');

  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // Check if Supabase environment variables are available
  const isSupabaseConfigured = Boolean(
    (process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL) &&
    (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_PUBLISHABLE_KEY)
  );

  // Auto-detect tenant code from query or subdomain
  React.useEffect(() => {
    const tenantParam = searchParams.get('tenant') || searchParams.get('code');
    if (tenantParam) {
      setWorkspaceCode(tenantParam);
      handleResolveWorkspace(tenantParam);
    }
  }, [searchParams]);

  const handleResolveWorkspace = async (codeOverride?: string) => {
    const targetCode = (codeOverride || workspaceCode).trim();
    if (!targetCode) {
      setError('Please enter a workspace code or company slug.');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const tenant = await dbService.getTenantBySlugOrCode(targetCode, supabase);

      if (!tenant) {
        setError('Workspace not found. Please verify your workspace code or domain slug.');
        setIsLoading(false);
        return;
      }

      setResolvedTenant(tenant);
      setStep(2);
    } catch (err) {
      setError('Failed to resolve workspace. Please check your network connection.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resolvedTenant) return;

    if (!email.trim() || !password) {
      setError('Please enter both your work email and password.');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // 1. Authenticate with Supabase Auth
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (authError || !authData.user) {
        setError(authError?.message || 'Invalid credentials. Please check your email and password.');
        setIsLoading(false);
        return;
      }

      const user = authData.user;

      // 2. Fetch User Profile
      const profile = await dbService.getUserProfile(user.id, supabase);

      // 3. Verify Tenant Membership
      const memberships = await dbService.getUserTenantMemberships(user.id, supabase);
      const activeMembership = memberships.find((m) => m.tenant_id === resolvedTenant.id);

      if (activeMembership) {
        // Authenticated member
        if (typeof document !== 'undefined') {
          document.cookie = `pms_active_tenant_id=${resolvedTenant.id}; path=/; max-age=31536000; SameSite=Lax`;
          document.cookie = `pms_user_role=${activeMembership.role}; path=/; max-age=31536000; SameSite=Lax`;
        }

        if (profile) setCurrentUser(profile);
        setActiveTenant(resolvedTenant, activeMembership.role);
        router.push('/');
        return;
      }

      // 4. Check for Guest Containment Access
      const guestAccess = await dbService.getUserGuestAccess(user.id, user.email, supabase);
      const isGuestForTenant = guestAccess.some((g) => g.tenant_id === resolvedTenant.id);

      if (isGuestForTenant) {
        if (typeof document !== 'undefined') {
          document.cookie = `pms_active_tenant_id=${resolvedTenant.id}; path=/; max-age=31536000; SameSite=Lax`;
          document.cookie = `pms_user_role=guest; path=/; max-age=31536000; SameSite=Lax`;
        }

        if (profile) setCurrentUser(profile);
        setActiveTenant(resolvedTenant, 'guest');
        router.push('/');
        return;
      }

      // Check if user is platform SuperAdmin
      if (profile?.is_superadmin) {
        if (typeof document !== 'undefined') {
          document.cookie = `pms_active_tenant_id=${resolvedTenant.id}; path=/; max-age=31536000; SameSite=Lax`;
          document.cookie = `pms_user_role=admin; path=/; max-age=31536000; SameSite=Lax`;
        }

        setCurrentUser(profile);
        setActiveTenant(resolvedTenant, 'admin');
        router.push('/');
        return;
      }

      // Neither member, guest, nor superadmin for this tenant
      await supabase.auth.signOut();
      setError('Access denied. You are not an authorized member of this workspace.');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'An unexpected error occurred during login.';
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--background)] p-4">
      <div className="w-full max-w-md rounded-2xl border border-[var(--border)] bg-[var(--card)] p-8 shadow-2xl space-y-6">
        {/* Brand Header */}
        <div className="text-center space-y-2">
          <div className="h-12 w-12 rounded-2xl bg-[var(--primary)] text-white flex items-center justify-center font-bold text-xl mx-auto shadow-lg shadow-blue-500/20">
            P
          </div>
          <h1 className="text-2xl font-bold text-[var(--foreground)] tracking-tight">Enterprise PMS</h1>
          <p className="text-xs text-[var(--muted-foreground)]">
            Multi-Tenant Project Management & Critical Path Scheduling Platform
          </p>
        </div>

        {/* Database Connection Notice (When Supabase env vars not configured) */}
        {!isSupabaseConfigured && (
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3.5 text-xs text-amber-300 space-y-1.5">
            <div className="flex items-center gap-1.5 font-bold">
              <Database className="h-4 w-4" />
              <span>Database Connection Pending</span>
            </div>
            <p className="text-[11px] leading-relaxed text-amber-200/90">
              Please configure <code className="font-mono bg-amber-950/40 px-1 py-0.5 rounded">NEXT_PUBLIC_SUPABASE_URL</code> and <code className="font-mono bg-amber-950/40 px-1 py-0.5 rounded">NEXT_PUBLIC_SUPABASE_ANON_KEY</code> in your environment, and execute the migrations in <code className="font-mono">supabase/migrations/</code>.
            </p>
          </div>
        )}

        {/* Error Alert */}
        {error && (
          <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3.5 text-xs text-red-400 flex items-start gap-2 animate-in fade-in duration-200">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
            <span className="leading-snug">{error}</span>
          </div>
        )}

        {/* STAGE 1: WORKSPACE RESOLUTION */}
        {step === 1 && (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold block text-[var(--foreground)]">
                Step 1: Enter Workspace Code or Domain Slug
              </label>
              <p className="text-[11px] text-[var(--muted-foreground)]">
                Enter your organization’s unique tenant identifier (e.g. <code className="font-mono">CORE-SYS</code> or <code className="font-mono">core</code>).
              </p>
              <div className="relative mt-2">
                <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--muted-foreground)]" />
                <Input
                  placeholder="e.g. CORE-SYS, ACME, core"
                  value={workspaceCode}
                  onChange={(e) => {
                    setWorkspaceCode(e.target.value);
                    setError(null);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleResolveWorkspace();
                    }
                  }}
                  className="pl-9 h-11 text-sm bg-[var(--background)] font-mono"
                  disabled={isLoading}
                  autoFocus
                />
              </div>
            </div>

            <Button
              onClick={() => handleResolveWorkspace()}
              disabled={isLoading || !workspaceCode.trim()}
              className="w-full h-11 gap-2 text-xs font-semibold"
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Validating Workspace...</span>
                </>
              ) : (
                <>
                  <span>Continue to Sign In</span>
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </Button>
          </div>
        )}

        {/* STAGE 2: TENANT-SCOPED CREDENTIAL LOGIN */}
        {step === 2 && resolvedTenant && (
          <form onSubmit={handleLogin} className="space-y-4">
            {/* Resolved Tenant Badge */}
            <div className="flex items-center justify-between p-3 rounded-xl border border-[var(--border)] bg-[var(--secondary)]/30">
              <div className="flex items-center gap-2.5">
                <div className="h-8 w-8 rounded-lg bg-[var(--primary)] text-white flex items-center justify-center font-bold text-xs">
                  {resolvedTenant.name.substring(0, 2).toUpperCase()}
                </div>
                <div>
                  <div className="text-xs font-bold text-[var(--foreground)]">{resolvedTenant.name}</div>
                  <div className="text-[10px] font-mono text-[var(--muted-foreground)]">
                    Code: {resolvedTenant.tenant_code || resolvedTenant.code || resolvedTenant.slug}
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setStep(1);
                  setError(null);
                }}
                className="text-[11px] text-[var(--primary)] hover:underline flex items-center gap-1 cursor-pointer"
              >
                <ArrowLeft className="h-3 w-3" />
                <span>Change</span>
              </button>
            </div>

            {/* Email Input */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold block text-[var(--foreground)]">Work Email</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--muted-foreground)]" />
                <Input
                  type="email"
                  placeholder="name@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-9 h-11 text-sm bg-[var(--background)]"
                  disabled={isLoading}
                  required
                  autoFocus
                />
              </div>
            </div>

            {/* Password Input */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold block text-[var(--foreground)]">Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--muted-foreground)]" />
                <Input
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-9 h-11 text-sm bg-[var(--background)]"
                  disabled={isLoading}
                  required
                />
              </div>
            </div>

            <Button type="submit" disabled={isLoading} className="w-full h-11 gap-2 text-xs font-semibold mt-2">
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Verifying Membership & Signing In...</span>
                </>
              ) : (
                <>
                  <ShieldCheck className="h-4 w-4" />
                  <span>Authenticate to {resolvedTenant.name}</span>
                </>
              )}
            </Button>
          </form>
        )}

        {/* Security & RLS Footer */}
        <div className="pt-2 border-t border-[var(--border)] text-center">
          <p className="text-[11px] text-[var(--muted-foreground)] flex items-center justify-center gap-1.5">
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" />
            <span>PostgreSQL 16 Multi-Tenant Row Level Security Enforced</span>
          </p>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <React.Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-[var(--background)]">
          <Loader2 className="h-8 w-8 animate-spin text-[var(--primary)]" />
        </div>
      }
    >
      <LoginPageContent />
    </React.Suspense>
  );
}
