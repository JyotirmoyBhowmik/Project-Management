// ==============================================================================
// src/components/modals/DeleteProjectModal.tsx
// High-Safety Project Destruction Dialog with Code Verification Guard
// ==============================================================================

'use client';

import * as React from 'react';
import { AlertOctagon, Trash2, Loader2, ShieldAlert } from 'lucide-react';
import { Modal } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { deleteProjectAction } from '@/actions/lifecycle';
import { toast } from 'sonner';

interface DeleteProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: string;
  projectName: string;
  projectCode?: string;
  tenantId: string;
  onDeleted?: () => void;
}

export function DeleteProjectModal({
  isOpen,
  onClose,
  projectId,
  projectName,
  projectCode,
  tenantId,
  onDeleted,
}: DeleteProjectModalProps) {
  const [confirmationInput, setConfirmationInput] = React.useState('');
  const [isHardDelete, setIsHardDelete] = React.useState(false);
  const [isDeleting, setIsDeleting] = React.useState(false);

  const expectedCode = (projectCode || projectName).trim().toUpperCase();
  const isMatch = confirmationInput.trim().toUpperCase() === expectedCode;

  const handleDelete = async () => {
    if (!isMatch) return;
    setIsDeleting(true);

    try {
      const res = await deleteProjectAction({
        project_id: projectId,
        tenant_id: tenantId,
        confirm_project_code: confirmationInput,
        is_hard_delete: isHardDelete,
      });

      if (!res.success) {
        toast.error(res.error || 'Failed to delete project');
        return;
      }

      toast.success(isHardDelete ? 'Project permanently purged.' : 'Project moved to Recycle Bin.');
      onClose();
      if (onDeleted) onDeleted();
    } catch (err: any) {
      toast.error(err?.message || 'Error occurred while deleting project');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Delete Project & Cascade Deliverables"
      className="max-w-lg"
    >
      <div className="space-y-4 pt-2">
        {/* Destructive Warning Alert */}
        <div className="p-3.5 bg-red-50/10 border border-red-500/20 rounded-lg flex items-start gap-3">
          <AlertOctagon className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
          <div className="text-xs text-[var(--foreground)] space-y-1">
            <span className="font-bold text-red-400 block text-sm">Destructive Administrative Action</span>
            <p className="text-[var(--muted-foreground)] leading-relaxed">
              Deleting <strong>{projectName}</strong> will cascade across all associated phases, tasks, dependencies, sprint cadences, living wiki documents, and budget metrics.
            </p>
          </div>
        </div>

        {/* Verification Guard */}
        <div className="space-y-2">
          <label className="text-xs font-medium text-[var(--muted-foreground)]">
            To confirm destruction, type the project code <span className="font-mono font-bold text-red-400">{expectedCode}</span> below:
          </label>
          <Input
            value={confirmationInput}
            onChange={(e) => setConfirmationInput(e.target.value)}
            placeholder={expectedCode}
            className="font-mono text-sm uppercase"
            autoFocus
          />
        </div>

        {/* Soft vs Hard Delete Toggle */}
        <div className="pt-2 border-t border-[var(--border)] flex items-center justify-between">
          <div className="text-xs">
            <span className="font-semibold block text-[var(--foreground)]">Permanently Purge Records & Storage</span>
            <span className="text-[var(--muted-foreground)]">
              {isHardDelete ? 'Bypasses 30-day Recycle Bin' : 'Soft delete with 30-day restoration window'}
            </span>
          </div>
          <button
            type="button"
            onClick={() => setIsHardDelete(!isHardDelete)}
            className={`w-10 h-6 rounded-full transition-colors relative ${
              isHardDelete ? 'bg-red-500' : 'bg-[var(--muted)]'
            }`}
          >
            <div
              className={`w-4 h-4 rounded-full bg-white transition-transform transform absolute top-1 ${
                isHardDelete ? 'left-5' : 'left-1'
              }`}
            />
          </button>
        </div>

        {/* Action Buttons */}
        <div className="pt-3 border-t border-[var(--border)] flex items-center justify-end gap-2">
          <Button variant="outline" onClick={onClose} disabled={isDeleting}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={!isMatch || isDeleting}
          >
            {isDeleting ? (
              <>
                <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
                Deleting Project...
              </>
            ) : (
              <>
                <Trash2 className="w-4 h-4 mr-1.5" />
                {isHardDelete ? 'Permanently Purge Project' : 'Move Project to Trash'}
              </>
            )}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
