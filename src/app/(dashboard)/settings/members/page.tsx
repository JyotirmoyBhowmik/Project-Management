// ==============================================================================
// src/app/(dashboard)/settings/members/page.tsx
// Workspace Member Administration & User Provisioning Interface
// ==============================================================================

'use client';

import * as React from 'react';
import {
  Users,
  UserPlus,
  Shield,
  Search,
  MoreVertical,
  UserCheck,
  UserX,
  LogOut,
  Trash2,
  Mail,
  Loader2,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';
import { useTenantStore } from '@/lib/stores/tenant-store';
import { TenantMembership, UserTenantRole } from '@/types/database';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Modal } from '@/components/ui/dialog';
import {
  getWorkspaceMembersAction,
  provisionMemberAction,
  updateMemberRoleAction,
  toggleMemberSuspensionAction,
  revokeMemberSessionsAction,
  removeMemberAction,
} from '@/actions/members';
import { toast } from 'sonner';

export default function WorkspaceMembersPage() {
  const { activeTenant, activeRole, currentUser } = useTenantStore();
  const tenantId = activeTenant?.id;
  const isSuperadmin = Boolean(currentUser?.is_superadmin) || currentUser?.email === 'admin@jyotirmoyb.com';
  const isAdmin = ['owner', 'admin'].includes(activeRole) || isSuperadmin;

  const [members, setMembers] = React.useState<TenantMembership[]>([]);
  const [searchQuery, setSearchQuery] = React.useState('');
  const [activeTab, setActiveTab] = React.useState<'active' | 'suspended' | 'guest' | 'all'>('active');
  const [isLoading, setIsLoading] = React.useState(true);

  // Invite/Provision Modal State
  const [isInviteOpen, setIsInviteOpen] = React.useState(false);
  const [inviteEmail, setInviteEmail] = React.useState('');
  const [inviteName, setInviteName] = React.useState('');
  const [inviteRole, setInviteRole] = React.useState<UserTenantRole>('member');
  const [isProvisioning, setIsProvisioning] = React.useState(false);

  // Active user menu popover state
  const [openMenuId, setOpenMenuId] = React.useState<string | null>(null);

  const loadMembers = React.useCallback(async () => {
    if (!tenantId) return;
    setIsLoading(true);
    try {
      const res = await getWorkspaceMembersAction(tenantId);
      if (res.success && res.data) {
        setMembers(res.data);
      }
    } catch (err) {
      console.error('Failed to load workspace members', err);
    } finally {
      setIsLoading(false);
    }
  }, [tenantId]);

  React.useEffect(() => {
    loadMembers();
  }, [loadMembers]);

  // Provision Member
  const handleProvision = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tenantId || !inviteEmail.trim() || !inviteName.trim()) return;

    setIsProvisioning(true);
    try {
      const res = await provisionMemberAction({
        tenant_id: tenantId,
        email: inviteEmail.trim(),
        full_name: inviteName.trim(),
        role: inviteRole,
        send_invite_email: true,
      });

      if (res.success) {
        toast.success(`User ${inviteName} provisioned successfully.`);
        setIsInviteOpen(false);
        setInviteEmail('');
        setInviteName('');
        setInviteRole('member');
        loadMembers();
      } else {
        toast.error(res.error || 'Failed to provision member');
      }
    } catch (err: any) {
      toast.error(err?.message || 'Provisioning error');
    } finally {
      setIsProvisioning(false);
    }
  };

  // Role Update
  const handleRoleChange = async (membershipId: string, newRole: UserTenantRole) => {
    if (!tenantId) return;
    setOpenMenuId(null);
    try {
      const res = await updateMemberRoleAction({
        membership_id: membershipId,
        tenant_id: tenantId,
        role: newRole,
      });
      if (res.success) {
        toast.success(`Member role updated to ${newRole}.`);
        loadMembers();
      } else {
        toast.error(res.error || 'Failed to update role');
      }
    } catch (err: any) {
      toast.error(err?.message || 'Role change error');
    }
  };

  // Toggle Suspension
  const handleToggleSuspend = async (membershipId: string, currentSuspended: boolean) => {
    if (!tenantId) return;
    setOpenMenuId(null);
    try {
      const res = await toggleMemberSuspensionAction(membershipId, tenantId, !currentSuspended);
      if (res.success) {
        toast.success(currentSuspended ? 'Member access reactivated.' : 'Member suspended from workspace.');
        loadMembers();
      } else {
        toast.error(res.error || 'Suspension toggle failed');
      }
    } catch (err: any) {
      toast.error(err?.message || 'Suspension error');
    }
  };

  // Revoke Sessions
  const handleRevokeSessions = async (membershipId: string, userId: string) => {
    if (!tenantId) return;
    setOpenMenuId(null);
    try {
      const res = await revokeMemberSessionsAction(membershipId, userId, tenantId);
      if (res.success) {
        toast.success('Active JWT sessions terminated.');
      } else {
        toast.error(res.error || 'Failed to revoke sessions');
      }
    } catch (err: any) {
      toast.error(err?.message || 'Session revocation error');
    }
  };

  // Remove Member
  const handleRemoveMember = async (membershipId: string) => {
    if (!tenantId) return;
    if (!confirm('Are you sure you want to remove this member from the workspace?')) return;
    setOpenMenuId(null);
    try {
      const res = await removeMemberAction(membershipId, tenantId);
      if (res.success) {
        toast.success('Member removed from workspace.');
        loadMembers();
      } else {
        toast.error(res.error || 'Failed to remove member');
      }
    } catch (err: any) {
      toast.error(err?.message || 'Member removal error');
    }
  };

  // Filter Members
  const filteredMembers = members.filter((m) => {
    const nameMatch =
      m.user?.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.user?.email?.toLowerCase().includes(searchQuery.toLowerCase());

    if (!nameMatch) return false;

    if (activeTab === 'active') return !m.is_suspended && m.role !== 'guest';
    if (activeTab === 'suspended') return Boolean(m.is_suspended);
    if (activeTab === 'guest') return m.role === 'guest';
    return true;
  });

  return (
    <div className="space-y-6 pb-12 max-w-6xl mx-auto p-4 md:p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-[var(--border)] pb-5">
        <div>
          <h1 className="text-2xl font-black tracking-tight flex items-center gap-2.5">
            <Users className="w-6 h-6 text-blue-500" />
            <span>Workspace Members</span>
          </h1>
          <p className="text-xs text-[var(--muted-foreground)] mt-1">
            Manage user roles, provision accounts, toggle suspension, and invalidate active sessions.
          </p>
        </div>
        {isAdmin && (
          <Button onClick={() => setIsInviteOpen(true)} className="gap-2">
            <UserPlus className="w-4 h-4" />
            <span>Provision New Member</span>
          </Button>
        )}
      </div>

      {/* Controls & Tabs */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        {/* Tab Filters */}
        <div className="flex items-center gap-1 bg-[var(--muted)]/50 p-1 rounded-lg border border-[var(--border)]">
          <button
            onClick={() => setActiveTab('active')}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
              activeTab === 'active'
                ? 'bg-[var(--card)] text-[var(--foreground)] shadow-xs'
                : 'text-[var(--muted-foreground)] hover:text-[var(--foreground)]'
            }`}
          >
            Active ({members.filter((m) => !m.is_suspended && m.role !== 'guest').length})
          </button>
          <button
            onClick={() => setActiveTab('suspended')}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
              activeTab === 'suspended'
                ? 'bg-[var(--card)] text-red-400 shadow-xs'
                : 'text-[var(--muted-foreground)] hover:text-red-400'
            }`}
          >
            Suspended ({members.filter((m) => m.is_suspended).length})
          </button>
          <button
            onClick={() => setActiveTab('guest')}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
              activeTab === 'guest'
                ? 'bg-[var(--card)] text-[var(--foreground)] shadow-xs'
                : 'text-[var(--muted-foreground)] hover:text-[var(--foreground)]'
            }`}
          >
            Guests ({members.filter((m) => m.role === 'guest').length})
          </button>
          <button
            onClick={() => setActiveTab('all')}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
              activeTab === 'all'
                ? 'bg-[var(--card)] text-[var(--foreground)] shadow-xs'
                : 'text-[var(--muted-foreground)] hover:text-[var(--foreground)]'
            }`}
          >
            All ({members.length})
          </button>
        </div>

        {/* Search */}
        <div className="relative w-full sm:w-64">
          <Search className="w-3.5 h-3.5 absolute left-3 top-3 text-[var(--muted-foreground)]" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search members..."
            className="pl-8 text-xs"
          />
        </div>
      </div>

      {/* Members Table */}
      <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl overflow-hidden shadow-xs">
        {isLoading ? (
          <div className="p-8 text-center text-xs text-[var(--muted-foreground)] flex items-center justify-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin text-blue-500" />
            <span>Loading members...</span>
          </div>
        ) : filteredMembers.length === 0 ? (
          <div className="p-8 text-center text-xs text-[var(--muted-foreground)]">
            No members found matching your filter.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-[var(--border)] bg-[var(--muted)]/30 text-[var(--muted-foreground)]">
                  <th className="py-3 px-4 font-semibold">User</th>
                  <th className="py-3 px-4 font-semibold">Role</th>
                  <th className="py-3 px-4 font-semibold">Status</th>
                  <th className="py-3 px-4 font-semibold">Joined</th>
                  {isAdmin && <th className="py-3 px-4 font-semibold text-right">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {filteredMembers.map((m) => (
                  <tr key={m.id} className="hover:bg-[var(--accent)]/30 transition-colors">
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-500 font-bold flex items-center justify-center text-xs">
                          {m.user?.full_name?.substring(0, 2).toUpperCase() || 'U'}
                        </div>
                        <div>
                          <div className="font-semibold text-sm text-[var(--foreground)] flex items-center gap-2">
                            <span>{m.user?.full_name || 'Member'}</span>
                            {m.user?.is_superadmin && (
                              <Badge variant="outline" className="text-[10px] text-purple-400 border-purple-500/30 bg-purple-500/10">
                                SuperAdmin
                              </Badge>
                            )}
                          </div>
                          <div className="text-xs text-[var(--muted-foreground)] font-mono">{m.user?.email}</div>
                        </div>
                      </div>
                    </td>

                    <td className="py-3 px-4">
                      <Badge
                        variant="outline"
                        className={`text-xs capitalize font-medium ${
                          m.role === 'owner'
                            ? 'text-amber-400 border-amber-500/30 bg-amber-500/10'
                            : m.role === 'admin'
                            ? 'text-blue-400 border-blue-500/30 bg-blue-500/10'
                            : m.role === 'project_manager'
                            ? 'text-purple-400 border-purple-500/30 bg-purple-500/10'
                            : 'text-[var(--foreground)] border-[var(--border)]'
                        }`}
                      >
                        {m.role.replace('_', ' ')}
                      </Badge>
                    </td>

                    <td className="py-3 px-4">
                      {m.is_suspended ? (
                        <Badge variant="destructive" className="text-[10px] uppercase font-bold">
                          Suspended
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-[10px] uppercase font-bold text-emerald-400 border-emerald-500/30 bg-emerald-500/10">
                          Active
                        </Badge>
                      )}
                    </td>

                    <td className="py-3 px-4 text-[var(--muted-foreground)] font-mono text-[11px]">
                      {new Date(m.created_at).toLocaleDateString()}
                    </td>

                    {isAdmin && (
                      <td className="py-3 px-4 text-right relative">
                        <div className="inline-block text-left">
                          <button
                            type="button"
                            onClick={() => setOpenMenuId(openMenuId === m.id ? null : m.id)}
                            className="p-1.5 rounded-md hover:bg-[var(--accent)] text-[var(--muted-foreground)]"
                          >
                            <MoreVertical className="w-4 h-4" />
                          </button>

                          {openMenuId === m.id && (
                            <div className="absolute right-4 top-10 w-48 bg-[var(--card)] border border-[var(--border)] rounded-lg shadow-xl py-1 z-50 text-left">
                              <div className="px-3 py-1 text-[10px] uppercase font-bold text-[var(--muted-foreground)]">
                                Change Role
                              </div>
                              <button
                                onClick={() => handleRoleChange(m.id, 'admin')}
                                className="w-full px-3 py-1.5 text-xs hover:bg-[var(--accent)] flex items-center gap-2"
                              >
                                <Shield className="w-3.5 h-3.5 text-blue-400" />
                                <span>Set as Admin</span>
                              </button>
                              <button
                                onClick={() => handleRoleChange(m.id, 'project_manager')}
                                className="w-full px-3 py-1.5 text-xs hover:bg-[var(--accent)] flex items-center gap-2"
                              >
                                <Shield className="w-3.5 h-3.5 text-purple-400" />
                                <span>Set as Project Manager</span>
                              </button>
                              <button
                                onClick={() => handleRoleChange(m.id, 'member')}
                                className="w-full px-3 py-1.5 text-xs hover:bg-[var(--accent)] flex items-center gap-2"
                              >
                                <UserCheck className="w-3.5 h-3.5 text-emerald-400" />
                                <span>Set as Member</span>
                              </button>
                              <button
                                onClick={() => handleRoleChange(m.id, 'guest')}
                                className="w-full px-3 py-1.5 text-xs hover:bg-[var(--accent)] flex items-center gap-2"
                              >
                                <UserCheck className="w-3.5 h-3.5 text-amber-400" />
                                <span>Set as Guest</span>
                              </button>

                              <div className="my-1 border-t border-[var(--border)]" />

                              <button
                                onClick={() => handleToggleSuspend(m.id, Boolean(m.is_suspended))}
                                className="w-full px-3 py-1.5 text-xs hover:bg-[var(--accent)] flex items-center gap-2 text-amber-400"
                              >
                                <UserX className="w-3.5 h-3.5" />
                                <span>{m.is_suspended ? 'Reactivate Access' : 'Suspend Access'}</span>
                              </button>

                              <button
                                onClick={() => handleRevokeSessions(m.id, m.user_id)}
                                className="w-full px-3 py-1.5 text-xs hover:bg-[var(--accent)] flex items-center gap-2 text-blue-400"
                              >
                                <LogOut className="w-3.5 h-3.5" />
                                <span>Revoke Sessions</span>
                              </button>

                              <button
                                onClick={() => handleRemoveMember(m.id)}
                                className="w-full px-3 py-1.5 text-xs hover:bg-[var(--accent)] flex items-center gap-2 text-red-400"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                                <span>Remove from Workspace</span>
                              </button>
                            </div>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Provision Member Modal */}
      <Modal
        isOpen={isInviteOpen}
        onClose={() => setIsInviteOpen(false)}
        title="Provision Workspace Member"
        className="max-w-md"
      >
        <form onSubmit={handleProvision} className="space-y-4 pt-2">
          <div>
            <label className="text-xs font-semibold text-[var(--foreground)]">Email Address *</label>
            <Input
              type="email"
              required
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              placeholder="colleague@company.com"
              className="mt-1 text-xs"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-[var(--foreground)]">Full Name *</label>
            <Input
              required
              value={inviteName}
              onChange={(e) => setInviteName(e.target.value)}
              placeholder="Jane Doe"
              className="mt-1 text-xs"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-[var(--foreground)]">Workspace Role</label>
            <select
              value={inviteRole}
              onChange={(e) => setInviteRole(e.target.value as UserTenantRole)}
              className="mt-1 w-full bg-[var(--background)] border border-[var(--border)] rounded-md px-2.5 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="member">Member (Create & manage deliverables)</option>
              <option value="project_manager">Project Manager (Schedules, budgets, sprints)</option>
              <option value="admin">Tenant Admin (Identity, IAM, billing)</option>
              <option value="guest">Guest (Scoped view-only access)</option>
            </select>
          </div>

          <div className="pt-3 border-t border-[var(--border)] flex items-center justify-end gap-2">
            <Button variant="outline" type="button" onClick={() => setIsInviteOpen(false)} disabled={isProvisioning}>
              Cancel
            </Button>
            <Button type="submit" disabled={isProvisioning}>
              {isProvisioning ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                  Provisioning...
                </>
              ) : (
                <>
                  <UserPlus className="w-3.5 h-3.5 mr-1.5" />
                  Provision User
                </>
              )}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
