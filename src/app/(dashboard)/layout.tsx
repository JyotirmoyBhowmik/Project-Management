// ==============================================================================
// src/app/(dashboard)/layout.tsx
// Authenticated Dashboard Layout Shell
// Enforces Supabase Session Validation & Live Workspace Context Population
// ==============================================================================

'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Header } from '@/components/layout/Header';
import { Sidebar } from '@/components/layout/Sidebar';
import { Breadcrumbs } from '@/components/layout/Breadcrumbs';
import { createClient } from '@/lib/supabase/client';
import { dbService } from '@/lib/supabase/db-service';
import { useTenantStore } from '@/lib/stores/tenant-store';
import { Loader2, ShieldAlert, Database, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const supabase = createClient();
  const {
    activeTenant,
    currentUser,
    isLoading,
    setActiveTenant,
    setCurrentUser,
    setMemberships,
  } = useTenantStore();

  const [isInitializing, setIsInitializing] = React.useState(true);
  const [accessDenied, setAccessDenied] = React.useState<string | null>(null);

  const isSupabaseConfigured = Boolean(
    (process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL) &&
    (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_PUBLISHABLE_KEY)
  );

  React.useEffect(() => {
    let isMounted = true;

    async function initSession() {
      if (!isSupabaseConfigured) {
        setIsInitializing(false);
        return;
      }

      try {
        // 1. Validate Supabase Session
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!session?.user) {
          router.replace('/login');
          return;
        }

        const authUser = session.user;

        // 2. Fetch User Profile
        const profile = await dbService.getUserProfile(authUser.id, supabase);
        const userProfile = profile || {
          id: authUser.id,
          email: authUser.email || '',
          full_name: authUser.user_metadata?.full_name || authUser.email?.split('@')[0] || 'User',
          avatar_url: authUser.user_metadata?.avatar_url || null,
          is_superadmin: false,
          created_at: authUser.created_at || new Date().toISOString(),
        };

        if (isMounted) setCurrentUser(userProfile);

        // 3. Fetch Authorized Workspace Memberships
        const memberships = await dbService.getUserTenantMemberships(authUser.id, supabase);
        if (isMounted) setMemberships(memberships);

        // 4. Resolve Active Workspace
        let activeId: string | null = null;
        if (typeof document !== 'undefined') {
          const match = document.cookie.match(/pms_active_tenant_id=([^;]+)/);
          if (match) activeId = match[1];
        }

        let targetMembership = memberships.find((m) => m.tenant_id === activeId);
        if (!targetMembership && memberships.length > 0) {
          targetMembership = memberships[0];
        }

        if (targetMembership && targetMembership.tenant) {
          if (isMounted) {
            setActiveTenant(targetMembership.tenant, targetMembership.role);
            setIsInitializing(false);
          }
          return;
        }

        // 5. Check for Guest Containment Access
        const guestRecords = await dbService.getUserGuestAccess(authUser.id, authUser.email, supabase);
        if (guestRecords.length > 0) {
          const guestTenant = await dbService.getTenantById(guestRecords[0].tenant_id, supabase);
          if (guestTenant && isMounted) {
            setActiveTenant(guestTenant, 'guest');
            setIsInitializing(false);
            return;
          }
        }

        // 6. Check if Platform SuperAdmin
        if (userProfile.is_superadmin) {
          const allTenants = await dbService.getAllTenants(supabase);
          if (allTenants.length > 0 && isMounted) {
            setActiveTenant(allTenants[0], 'admin');
            setIsInitializing(false);
            return;
          }
        }

        // No authorized tenant memberships found
        if (isMounted) {
          setAccessDenied(
            `You are signed in as ${authUser.email}, but you are not assigned to any active workspace. Please contact your organization administrator to receive an invitation.`
          );
          setIsInitializing(false);
        }
      } catch (err) {
        console.error('Session initialization error:', err);
        router.replace('/login');
      }
    }

    initSession();

    return () => {
      isMounted = false;
    };
  }, [router, isSupabaseConfigured]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    if (typeof document !== 'undefined') {
      document.cookie = 'pms_active_tenant_id=; path=/; max-age=0';
      document.cookie = 'pms_user_role=; path=/; max-age=0';
    }
    router.push('/login');
  };

  // Loading Screen
  if (isInitializing) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[var(--background)] gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-[var(--primary)]" />
        <p className="text-xs font-medium text-[var(--muted-foreground)]">
          Authenticating workspace session...
        </p>
      </div>
    );
  }

  // Database Connection Pending Screen
  if (!isSupabaseConfigured) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--background)] p-4">
        <div className="w-full max-w-md rounded-2xl border border-[var(--border)] bg-[var(--card)] p-8 text-center space-y-4 shadow-xl">
          <div className="h-12 w-12 rounded-2xl bg-amber-500/10 text-amber-500 flex items-center justify-center mx-auto">
            <Database className="h-6 w-6" />
          </div>
          <h2 className="text-lg font-bold text-[var(--foreground)]">Database Connection Pending</h2>
          <p className="text-xs leading-relaxed text-[var(--muted-foreground)]">
            Supabase environment variables are missing. Please set <code className="font-mono bg-[var(--secondary)] px-1 py-0.5 rounded">NEXT_PUBLIC_SUPABASE_URL</code> and <code className="font-mono bg-[var(--secondary)] px-1 py-0.5 rounded">NEXT_PUBLIC_SUPABASE_ANON_KEY</code> in your environment, and execute migrations in Supabase.
          </p>
          <Button onClick={() => router.push('/login')} className="text-xs">
            Go to Login Gateway
          </Button>
        </div>
      </div>
    );
  }

  // Access Denied Screen (No memberships)
  if (accessDenied) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--background)] p-4">
        <div className="w-full max-w-md rounded-2xl border border-red-500/20 bg-[var(--card)] p-8 text-center space-y-4 shadow-xl">
          <div className="h-12 w-12 rounded-2xl bg-red-500/10 text-red-400 flex items-center justify-center mx-auto">
            <ShieldAlert className="h-6 w-6" />
          </div>
          <h2 className="text-lg font-bold text-[var(--foreground)]">Workspace Access Restricted</h2>
          <p className="text-xs leading-relaxed text-[var(--muted-foreground)]">{accessDenied}</p>
          <Button onClick={handleSignOut} variant="outline" className="gap-2 text-xs">
            <LogOut className="h-3.5 w-3.5" />
            <span>Sign Out</span>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-[var(--background)]">
      <Header />
      <div className="flex flex-1">
        <Sidebar />
        <main className="flex-1 flex flex-col min-w-0 overflow-y-auto">
          <Breadcrumbs />
          <div className="flex-1 p-4 sm:p-6">{children}</div>
        </main>
      </div>
    </div>
  );
}
