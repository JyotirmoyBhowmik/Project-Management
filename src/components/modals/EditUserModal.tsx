// ==============================================================================
// src/components/modals/EditUserModal.tsx
// Platform SuperAdmin Global User Editing & Cross-Tenant Access Administration
// ==============================================================================

'use client';

import * as React from 'react';
import { Shield, User, Mail, Building2, Plus, Trash2, CheckCircle2, Loader2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Modal } from '@/components/ui/dialog';
import { Tenant, UserTenantRole } from '@/types/database';
import { updateGlobalUserAction } from '@/actions/members';
import { toast } from 'sonner';

interface EditUserModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: {
    id: string;
    email: string;
    full_name: string;
    is_superadmin?: boolean;
    memberships?: Array<{
      id?: string;
      tenant_id: string;
      role: UserTenantRole;
      is_active?: boolean;
      tenant?: {
        id: string;
        name: string;
        slug: string;
        code?: string;
      };
    }>;
  } | null;
  allTenants: Tenant[];
  onUserUpdated: () => void;
}

export function EditUserModal({
  isOpen,
  onClose,
  user,
  allTenants,
  onUserUpdated,
}: EditUserModalProps) {
  const [fullName, setFullName] = React.useState('');
  const [email, setEmail] = React.useState('');
  const [isSuperAdmin, setIsSuperAdmin] = React.useState(false);
  const [memberships, setMemberships] = React.useState<
    Array<{ tenant_id: string; role: UserTenantRole; is_active: boolean }>
  >([]);
  const [newTenantId, setNewTenantId] = React.useState<string>('');
  const [newTenantRole, setNewTenantRole] = React.useState<UserTenantRole>('member');
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  React.useEffect(() => {
    if (user) {
      setFullName(user.full_name || '');
      setEmail(user.email || '');
      setIsSuperAdmin(Boolean(user.is_superadmin));
      setMemberships(
        (user.memberships || []).map((m) => ({
          tenant_id: m.tenant_id,
          role: m.role || 'member',
          is_active: m.is_active !== false,
        }))
      );
    }
  }, [user]);

  if (!user) return null;

  const handleRoleChange = (tenantId: string, role: UserTenantRole) => {
    setMemberships((prev) =>
      prev.map((m) => (m.tenant_id === tenantId ? { ...m, role } : m))
    );
  };

  const handleRemoveMembership = (tenantId: string) => {
    setMemberships((prev) => prev.filter((m) => m.tenant_id !== tenantId));
  };

  const handleAddMembership = () => {
    if (!newTenantId) return;
    if (memberships.some((m) => m.tenant_id === newTenantId)) {
      toast.error('User is already assigned to this workspace');
      return;
    }
    setMemberships((prev) => [
      ...prev,
      { tenant_id: newTenantId, role: newTenantRole, is_active: true },
    ]);
    setNewTenantId('');
    setNewTenantRole('member');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim() || !email.trim()) {
      toast.error('Full name and email are required');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await updateGlobalUserAction({
        user_id: user.id,
        full_name: fullName.trim(),
        email: email.trim(),
        is_superadmin: isSuperAdmin,
        tenant_memberships: memberships,
      });

      if (res.success) {
        toast.success(`User ${fullName} updated successfully`);
        onUserUpdated();
        onClose();
      } else {
        toast.error(res.error || 'Failed to update user');
      }
    } catch (err: any) {
      toast.error(err?.message || 'Error updating user');
    } finally {
      setIsSubmitting(false);
    }
  };

  const unassignedTenants = allTenants.filter(
    (t) => !memberships.some((m) => m.tenant_id === t.id)
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Edit Global User & Workspace Access"
      className="max-w-xl"
    >
      <form onSubmit={handleSubmit} className="space-y-5 pt-1">
        {/* User Identity Section */}
        <div className="space-y-3.5 bg-[var(--secondary)]/40 p-3.5 rounded-xl border border-[var(--border)]">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-[var(--foreground)] uppercase tracking-wider flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-blue-500" />
              Identity Details
            </span>
            <span className="text-[10px] font-mono text-[var(--muted-foreground)]">ID: {user.id.substring(0, 8)}...</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-[var(--foreground)]">Full Name *</label>
              <Input
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
                className="mt-1 text-xs"
                placeholder="Jane Doe"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-[var(--foreground)]">Email Address *</label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="mt-1 text-xs font-mono"
                placeholder="jane@enterprise.com"
              />
            </div>
          </div>

          <div className="pt-2 border-t border-[var(--border)] flex items-center justify-between">
            <div>
              <div className="text-xs font-semibold text-[var(--foreground)] flex items-center gap-1.5">
                <Shield className="w-3.5 h-3.5 text-red-500" />
                Platform SuperAdmin
              </div>
              <p className="text-[10px] text-[var(--muted-foreground)]">
                SuperAdmins have full visibility and administrative rights across all tenant boundaries.
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={isSuperAdmin}
                onChange={(e) => setIsSuperAdmin(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-9 h-5 bg-[var(--border)] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-red-600"></div>
            </label>
          </div>
        </div>

        {/* Tenant Memberships Section */}
        <div className="space-y-3 bg-[var(--secondary)]/40 p-3.5 rounded-xl border border-[var(--border)]">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-[var(--foreground)] uppercase tracking-wider flex items-center gap-1.5">
              <Building2 className="w-3.5 h-3.5 text-purple-500" />
              Workspace Memberships ({memberships.length})
            </span>
          </div>

          <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
            {memberships.map((m) => {
              const tenantObj = allTenants.find((t) => t.id === m.tenant_id);
              return (
                <div
                  key={m.tenant_id}
                  className="flex items-center justify-between p-2 rounded-lg border border-[var(--border)] bg-[var(--card)] text-xs"
                >
                  <div className="min-w-0 pr-2">
                    <div className="font-semibold text-[var(--foreground)] truncate">
                      {tenantObj?.name || 'Workspace'}
                    </div>
                    <div className="text-[10px] font-mono text-[var(--muted-foreground)]">
                      {tenantObj?.code || tenantObj?.slug || m.tenant_id}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <select
                      value={m.role}
                      onChange={(e) => handleRoleChange(m.tenant_id, e.target.value as UserTenantRole)}
                      className="bg-[var(--background)] border border-[var(--border)] rounded px-2 py-1 text-[11px] focus:outline-none"
                    >
                      <option value="owner">Owner</option>
                      <option value="admin">Admin</option>
                      <option value="project_manager">PM</option>
                      <option value="member">Member</option>
                      <option value="guest">Guest</option>
                    </select>

                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRemoveMembership(m.tenant_id)}
                      className="h-7 w-7 p-0 text-red-400 hover:text-red-300 hover:bg-red-950/30"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              );
            })}

            {memberships.length === 0 && (
              <p className="text-xs text-[var(--muted-foreground)] italic py-2 text-center">
                User has no workspace memberships.
              </p>
            )}
          </div>

          {/* Add to Workspace Sub-form */}
          {unassignedTenants.length > 0 && (
            <div className="pt-2 border-t border-[var(--border)] flex items-center gap-2">
              <select
                value={newTenantId}
                onChange={(e) => setNewTenantId(e.target.value)}
                className="flex-1 bg-[var(--background)] border border-[var(--border)] rounded px-2.5 py-1.5 text-xs focus:outline-none"
              >
                <option value="">-- Add to Workspace --</option>
                {unassignedTenants.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} ({t.code || t.slug})
                  </option>
                ))}
              </select>

              <select
                value={newTenantRole}
                onChange={(e) => setNewTenantRole(e.target.value as UserTenantRole)}
                className="bg-[var(--background)] border border-[var(--border)] rounded px-2 py-1.5 text-xs focus:outline-none"
              >
                <option value="member">Member</option>
                <option value="project_manager">PM</option>
                <option value="admin">Admin</option>
                <option value="owner">Owner</option>
                <option value="guest">Guest</option>
              </select>

              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleAddMembership}
                disabled={!newTenantId}
                className="text-xs gap-1"
              >
                <Plus className="w-3 h-3" />
                <span>Add</span>
              </Button>
            </div>
          )}
        </div>

        {/* Modal Actions */}
        <div className="flex items-center justify-end gap-2 pt-2 border-t border-[var(--border)]">
          <Button variant="outline" type="button" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? (
              <>
                <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                Saving Changes...
              </>
            ) : (
              'Save User Changes'
            )}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
