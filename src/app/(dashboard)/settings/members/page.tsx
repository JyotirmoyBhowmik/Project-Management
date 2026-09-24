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
  Copy,
  Check,
  ArrowUpDown,
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
  const [sortBy, setSortBy] = React.useState<'name_asc' | 'name_desc' | 'role' | 'date_newest' | 'date_oldest'>('role');
  const [copiedEmailId, setCopiedEmailId] = React.useState<string | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);

  // Invite/Provision Modal State
  const [isInviteOpen, setIsInviteOpen] = React.useState(false);
  const [inviteEmail, setInviteEmail] = React.useState('');
  const [inviteName, setInviteName] = React.useState('');
  const [inviteRole, setInviteRole] = React.useState<UserTenantRole>('member');
  const [isProvisioning, setIsProvisioning] = React.useState(false);

  // Active user menu popover state
  const [openMenuId, setOpenMenuId] = React.useState<string | null>(null);

  // Member Deletion Modal State
  const [memberToDelete, setMemberToDelete] = React.useState<TenantMembership | null>(null);
  const [isRemoving, setIsRemoving] = React.useState(false);

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
  const handleRemoveMember = (membership: TenantMembership) => {
    setOpenMenuId(null);
    setMemberToDelete(membership);
  };

  const confirmRemoveMember = async () => {
    if (!tenantId || !memberToDelete) return;
    setIsRemoving(true);
    try {
      const res = await removeMemberAction(memberToDelete.id, tenantId);
      if (res.success) {
        toast.success(`Member ${memberToDelete.user?.full_name || ''} removed from workspace.`);
        setMemberToDelete(null);
        loadMembers();
      } else {
        toast.error(res.error || 'Failed to remove member');
      }
    } catch (err: any) {
      toast.error(err?.message || 'Member removal error');
    } finally {
      setIsRemoving(false);
    }
  };

  // Role hierarchy weight for sorting
  const ROLE_WEIGHT: Record<string, number> = {
    owner: 5,
    admin: 4,
    project_manager: 3,
    member: 2,
    guest: 1,
  };

  // Filter & Sort Members
  const filteredMembers = React.useMemo(() => {
    const list = members.filter((m) => {
      const nameMatch =
        m.user?.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        m.user?.email?.toLowerCase().includes(searchQuery.toLowerCase());

      if (!nameMatch) return false;

      if (activeTab === 'active') return !m.is_suspended && m.role !== 'guest';
      if (activeTab === 'suspended') return Boolean(m.is_suspended);
      if (activeTab === 'guest') return m.role === 'guest';
      return true;
    });

    return list.sort((a, b) => {
      if (sortBy === 'name_asc') {
        const nameA = a.user?.full_name || a.user?.email || '';
        const nameB = b.user?.full_name || b.user?.email || '';
        return nameA.localeCompare(nameB);
      }
      if (sortBy === 'name_desc') {
        const nameA = a.user?.full_name || a.user?.email || '';
        const nameB = b.user?.full_name || b.user?.email || '';
        return nameB.localeCompare(nameA);
      }
      if (sortBy === 'role') {
        const weightA = ROLE_WEIGHT[a.role] || 0;
        const weightB = ROLE_WEIGHT[b.role] || 0;
        if (weightB !== weightA) return weightB - weightA;
        const nameA = a.user?.full_name || '';
        const nameB = b.user?.full_name || '';
        return nameA.localeCompare(nameB);
      }
      if (sortBy === 'date_newest') {
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      }
      if (sortBy === 'date_oldest') {
        return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      }
      return 0;
    });
  }, [members, searchQuery, activeTab, sortBy]);

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

        {/* Search & Sort Controls */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-64">
            <Search className="w-3.5 h-3.5 absolute left-3 top-3 text-[var(--muted-foreground)]" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search members..."
              className="pl-8 text-xs"
            />
          </div>

          <div className="flex items-center gap-1.5 bg-[var(--card)] border border-[var(--border)] rounded-md px-2.5 py-1">
            <ArrowUpDown className="w-3.5 h-3.5 text-[var(--muted-foreground)] shrink-0" />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="bg-transparent text-xs text-[var(--foreground)] focus:outline-none cursor-pointer"
            >
              <option value="role">Role Hierarchy</option>
              <option value="name_asc">Name (A-Z)</option>
              <option value="name_desc">Name (Z-A)</option>
              <option value="date_newest">Newest Joined</option>
              <option value="date_oldest">Oldest Joined</option>
            </select>
          </div>
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
                          <div className="flex items-center gap-1.5 text-xs text-[var(--muted-foreground)] font-mono">
                            <span>{m.user?.email}</span>
                            {m.user?.email && (
                              <button
                                type="button"
                                onClick={() => {
                                  if (typeof navigator !== 'undefined' && navigator.clipboard) {
                                    navigator.clipboard.writeText(m.user!.email!);
                                    setCopiedEmailId(m.id);
                                    toast.success('Email copied to clipboard');
                                    setTimeout(() => setCopiedEmailId(null), 2000);
                                  }
                                }}
                                className="p-0.5 hover:text-[var(--foreground)] cursor-pointer text-[var(--muted-foreground)]"
                                title="Copy email address"
                              >
                                {copiedEmailId === m.id ? (
                                  <Check className="w-3 h-3 text-emerald-400" />
                                ) : (
                                  <Copy className="w-3 h-3" />
                                )}
                              </button>
                            )}
                          </div>
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
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Direct, prominent Remove button */}
                          <button
                            type="button"
                            onClick={() => handleRemoveMember(m)}
                            disabled={
                              m.user_id === currentUser?.id &&
                              m.role === 'owner' &&
                              members.filter((x) => x.role === 'owner' && !x.is_suspended).length <= 1
                            }
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-red-400 hover:text-red-300 hover:bg-red-500/10 border border-red-500/20 rounded-md transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                            title={
                              m.user_id === currentUser?.id &&
                              m.role === 'owner' &&
                              members.filter((x) => x.role === 'owner' && !x.is_suspended).length <= 1
                                ? 'Cannot remove sole workspace owner'
                                : 'Remove member from workspace'
                            }
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span className="hidden sm:inline">Remove</span>
                          </button>

                          {/* Kebab menu for other management actions */}
                          <div className="relative text-left">
                            <button
                              type="button"
                              onClick={() => setOpenMenuId(openMenuId === m.id ? null : m.id)}
                              className="p-1.5 rounded-md hover:bg-[var(--accent)] text-[var(--muted-foreground)] cursor-pointer"
                              title="More actions"
                            >
                              <MoreVertical className="w-4 h-4" />
                            </button>

                            {openMenuId === m.id && (
                              <>
                                <div
                                  className="fixed inset-0 z-40"
                                  onClick={() => setOpenMenuId(null)}
                                />
                                <div className="absolute right-0 top-8 w-48 bg-[var(--card)] border border-[var(--border)] rounded-lg shadow-xl py-1 z-50 text-left">
                                  <div className="px-3 py-1 text-[10px] uppercase font-bold text-[var(--muted-foreground)]">
                                    Change Role
                                  </div>
                                  <button
                                    onClick={() => handleRoleChange(m.id, 'admin')}
                                    className="w-full px-3 py-1.5 text-xs hover:bg-[var(--accent)] flex items-center gap-2 cursor-pointer"
                                  >
                                    <Shield className="w-3.5 h-3.5 text-blue-400" />
                                    <span>Set as Admin</span>
                                  </button>
                                  <button
                                    onClick={() => handleRoleChange(m.id, 'project_manager')}
                                    className="w-full px-3 py-1.5 text-xs hover:bg-[var(--accent)] flex items-center gap-2 cursor-pointer"
                                  >
                                    <Shield className="w-3.5 h-3.5 text-purple-400" />
                                    <span>Set as Project Manager</span>
                                  </button>
                                  <button
                                    onClick={() => handleRoleChange(m.id, 'member')}
                                    className="w-full px-3 py-1.5 text-xs hover:bg-[var(--accent)] flex items-center gap-2 cursor-pointer"
                                  >
                                    <UserCheck className="w-3.5 h-3.5 text-emerald-400" />
                                    <span>Set as Member</span>
                                  </button>
                                  <button
                                    onClick={() => handleRoleChange(m.id, 'guest')}
                                    className="w-full px-3 py-1.5 text-xs hover:bg-[var(--accent)] flex items-center gap-2 cursor-pointer"
                                  >
                                    <UserCheck className="w-3.5 h-3.5 text-amber-400" />
                                    <span>Set as Guest</span>
                                  </button>

                                  <div className="my-1 border-t border-[var(--border)]" />

                                  <button
                                    onClick={() => handleToggleSuspend(m.id, Boolean(m.is_suspended))}
                                    className="w-full px-3 py-1.5 text-xs hover:bg-[var(--accent)] flex items-center gap-2 text-amber-400 cursor-pointer"
                                  >
                                    <UserX className="w-3.5 h-3.5" />
                                    <span>{m.is_suspended ? 'Reactivate Access' : 'Suspend Access'}</span>
                                  </button>

                                  <button
                                    onClick={() => handleRevokeSessions(m.id, m.user_id)}
                                    className="w-full px-3 py-1.5 text-xs hover:bg-[var(--accent)] flex items-center gap-2 text-blue-400 cursor-pointer"
                                  >
                                    <LogOut className="w-3.5 h-3.5" />
                                    <span>Revoke Sessions</span>
                                  </button>

                                  <button
                                    onClick={() => {
                                      setOpenMenuId(null);
                                      handleRemoveMember(m);
                                    }}
                                    className="w-full px-3 py-1.5 text-xs hover:bg-[var(--accent)] flex items-center gap-2 text-red-400 cursor-pointer"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                    <span>Remove from Workspace</span>
                                  </button>
                                </div>
                              </>
                            )}
                          </div>
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

      {/* Remove Member Confirmation Modal */}
      <Modal
        isOpen={!!memberToDelete}
        onClose={() => setMemberToDelete(null)}
        title="Remove Member from Workspace"
        className="max-w-md"
      >
        <div className="space-y-4 pt-2">
          <div className="flex items-start gap-3 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-xs">
            <AlertTriangle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="font-semibold text-red-400">Revoke Workspace Access</p>
              <p className="text-[var(--muted-foreground)]">
                Are you sure you want to remove <strong>{memberToDelete?.user?.full_name || 'this member'}</strong> ({memberToDelete?.user?.email}) from <strong>{activeTenant?.name}</strong>?
              </p>
              <p className="text-[var(--muted-foreground)]">
                This will immediately invalidate their active sessions and revoke access to all projects, deliverables, and tasks in this workspace.
              </p>
            </div>
          </div>

          <div className="pt-3 border-t border-[var(--border)] flex items-center justify-end gap-2">
            <Button
              variant="outline"
              type="button"
              onClick={() => setMemberToDelete(null)}
              disabled={isRemoving}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={confirmRemoveMember}
              disabled={isRemoving}
            >
              {isRemoving ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                  Removing...
                </>
              ) : (
                <>
                  <Trash2 className="w-3.5 h-3.5 mr-1.5" />
                  Confirm Remove
                </>
              )}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
