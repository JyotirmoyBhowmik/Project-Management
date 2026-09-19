// ==============================================================================
// src/app/(dashboard)/admin/multisite/users/page.tsx
// Platform SuperAdmin Cross-Tenant User Roster & Global IAM Governance
// ==============================================================================

'use client';

import * as React from 'react';
import {
  Users,
  Shield,
  Search,
  Lock,
  Unlock,
  KeyRound,
  Mail,
  Loader2,
  Building2,
  CheckCircle2,
  AlertOctagon,
} from 'lucide-react';
import { useTenantStore } from '@/lib/stores/tenant-store';
import { CrossTenantUser } from '@/types/database';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { getCrossTenantUsersAction, toggleGlobalUserLockAction } from '@/actions/members';
import { toast } from 'sonner';

export default function CrossTenantUsersPage() {
  const { currentUser } = useTenantStore();
  const isSuperadmin = Boolean(currentUser?.is_superadmin) || currentUser?.email === 'admin@jyotirmoyb.com';

  const [users, setUsers] = React.useState<CrossTenantUser[]>([]);
  const [searchQuery, setSearchQuery] = React.useState('');
  const [filterProvider, setFilterProvider] = React.useState<string>('all');
  const [isLoading, setIsLoading] = React.useState(true);

  const loadUsers = React.useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await getCrossTenantUsersAction();
      if (res.success && res.data) {
        setUsers(res.data);
      } else {
        toast.error(res.error || 'Failed to load cross-tenant user directory');
      }
    } catch (err) {
      console.error('Failed to load users', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  React.useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  const handleToggleLock = async (userId: string, currentSuspended: boolean) => {
    try {
      const res = await toggleGlobalUserLockAction(userId, !currentSuspended);
      if (res.success) {
        toast.success(currentSuspended ? 'Account unlocked across all workspaces.' : 'Account locked platform-wide.');
        loadUsers();
      } else {
        toast.error(res.error || 'Lock toggle failed');
      }
    } catch (err: any) {
      toast.error(err?.message || 'Error updating account lock');
    }
  };

  if (!isSuperadmin) {
    return (
      <div className="p-8 text-center max-w-md mx-auto space-y-3">
        <Shield className="w-12 h-12 text-amber-500 mx-auto" />
        <h2 className="text-lg font-bold">SuperAdmin Access Required</h2>
        <p className="text-xs text-[var(--muted-foreground)]">
          The Cross-Tenant User Roster is restricted to platform SuperAdministrators.
        </p>
      </div>
    );
  }

  const filteredUsers = users.filter((u) => {
    const query = searchQuery.toLowerCase();
    const matchSearch =
      u.email.toLowerCase().includes(query) ||
      u.full_name.toLowerCase().includes(query) ||
      u.tenants.some((t) => t.tenant_name.toLowerCase().includes(query));

    if (!matchSearch) return false;
    if (filterProvider !== 'all' && u.auth_provider !== filterProvider) return false;
    return true;
  });

  return (
    <div className="space-y-6 pb-12 max-w-7xl mx-auto p-4 md:p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-[var(--border)] pb-5">
        <div>
          <h1 className="text-2xl font-black tracking-tight flex items-center gap-2.5">
            <Users className="w-6 h-6 text-purple-500" />
            <span>Cross-Tenant User Roster</span>
          </h1>
          <p className="text-xs text-[var(--muted-foreground)] mt-1">
            Global IAM directory for inspecting identities, multi-workspace affiliations, and locking accounts.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-xs font-mono border-purple-500/30 text-purple-400 bg-purple-500/10">
            Total Identities: {users.length}
          </Badge>
        </div>
      </div>

      {/* Controls */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <select
            value={filterProvider}
            onChange={(e) => setFilterProvider(e.target.value)}
            className="bg-[var(--card)] border border-[var(--border)] rounded-md px-3 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-purple-500"
          >
            <option value="all">All Auth Providers</option>
            <option value="SAML/AzureAD">SAML 2.0 / Azure AD</option>
            <option value="Password">Standard Password</option>
            <option value="MagicLink">Magic Link</option>
            <option value="SCIM">SCIM Inbound</option>
          </select>
        </div>

        <div className="relative w-full sm:w-72">
          <Search className="w-3.5 h-3.5 absolute left-3 top-3 text-[var(--muted-foreground)]" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search email, name, or tenant..."
            className="pl-8 text-xs"
          />
        </div>
      </div>

      {/* User Table */}
      <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl overflow-hidden shadow-xs">
        {isLoading ? (
          <div className="p-8 text-center text-xs text-[var(--muted-foreground)] flex items-center justify-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin text-purple-500" />
            <span>Loading user directory...</span>
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="p-8 text-center text-xs text-[var(--muted-foreground)]">
            No identities match your search filters.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-[var(--border)] bg-[var(--muted)]/30 text-[var(--muted-foreground)]">
                  <th className="py-3 px-4 font-semibold">User Identity</th>
                  <th className="py-3 px-4 font-semibold">Auth Provider</th>
                  <th className="py-3 px-4 font-semibold">Tenant Affiliations</th>
                  <th className="py-3 px-4 font-semibold">Status</th>
                  <th className="py-3 px-4 font-semibold text-right">Global Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {filteredUsers.map((u) => (
                  <tr key={u.id} className="hover:bg-[var(--accent)]/30 transition-colors">
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-500 font-bold flex items-center justify-center text-xs">
                          {u.full_name.substring(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <div className="font-semibold text-sm text-[var(--foreground)] flex items-center gap-2">
                            <span>{u.full_name}</span>
                            {u.is_superadmin && (
                              <Badge variant="outline" className="text-[10px] text-purple-400 border-purple-500/30 bg-purple-500/10">
                                SuperAdmin
                              </Badge>
                            )}
                          </div>
                          <div className="text-xs text-[var(--muted-foreground)] font-mono">{u.email}</div>
                        </div>
                      </div>
                    </td>

                    <td className="py-3 px-4">
                      <Badge
                        variant="secondary"
                        className="text-[11px] font-mono gap-1.5 py-0.5 border border-[var(--border)]"
                      >
                        <KeyRound className="w-3 h-3 text-blue-400" />
                        <span>{u.auth_provider}</span>
                      </Badge>
                    </td>

                    <td className="py-3 px-4">
                      <div className="flex flex-wrap gap-1.5 max-w-sm">
                        {u.tenants.length === 0 ? (
                          <span className="text-[var(--muted-foreground)] italic">No workspaces</span>
                        ) : (
                          u.tenants.map((t) => (
                            <Badge
                              key={t.tenant_id}
                              variant="outline"
                              className="text-[10px] gap-1 py-0 border-[var(--border)] bg-[var(--muted)]/40"
                            >
                              <Building2 className="w-2.5 h-2.5 text-[var(--muted-foreground)]" />
                              <span>{t.tenant_name}</span>
                              <span className="text-[var(--muted-foreground)]">({t.role})</span>
                            </Badge>
                          ))
                        )}
                      </div>
                    </td>

                    <td className="py-3 px-4">
                      {u.is_suspended ? (
                        <Badge variant="destructive" className="text-[10px] font-bold uppercase">
                          Locked
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-[10px] font-bold uppercase text-emerald-400 border-emerald-500/30 bg-emerald-500/10">
                          Active
                        </Badge>
                      )}
                    </td>

                    <td className="py-3 px-4 text-right">
                      {!u.is_superadmin && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleToggleLock(u.id, Boolean(u.is_suspended))}
                          className={`text-xs gap-1.5 ${
                            u.is_suspended ? 'text-emerald-400 border-emerald-500/30' : 'text-amber-400 border-amber-500/30'
                          }`}
                        >
                          {u.is_suspended ? (
                            <>
                              <Unlock className="w-3 h-3" />
                              <span>Unlock Account</span>
                            </>
                          ) : (
                            <>
                              <Lock className="w-3 h-3" />
                              <span>Lock Account</span>
                            </>
                          )}
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
