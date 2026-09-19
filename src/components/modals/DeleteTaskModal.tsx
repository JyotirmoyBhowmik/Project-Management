// ==============================================================================
// src/components/modals/DeleteTaskModal.tsx
// Two-Tier Task Deletion Dialog with Intelligent Dependency Bridging
// ==============================================================================

'use client';

import * as React from 'react';
import {
  AlertTriangle,
  GitMerge,
  Unlink,
  Trash2,
  Loader2,
  CheckCircle2,
} from 'lucide-react';
import { Modal } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { deleteTaskAction } from '@/actions/lifecycle';
import { toast } from 'sonner';

interface DeleteTaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  taskId: string;
  taskTitle: string;
  taskCode?: string;
  tenantId: string;
  projectId: string;
  onDeleted?: () => void;
}

export function DeleteTaskModal({
  isOpen,
  onClose,
  taskId,
  taskTitle,
  taskCode,
  tenantId,
  projectId,
  onDeleted,
}: DeleteTaskModalProps) {
  const [strategy, setStrategy] = React.useState<'bridge' | 'sever'>('bridge');
  const [isHardDelete, setIsHardDelete] = React.useState(false);
  const [isDeleting, setIsDeleting] = React.useState(false);

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      const res = await deleteTaskAction({
        task_id: taskId,
        tenant_id: tenantId,
        project_id: projectId,
        dependency_strategy: strategy,
        is_hard_delete: isHardDelete,
      });

      if (!res.success) {
        toast.error(res.error || 'Failed to delete task');
        return;
      }

      if (strategy === 'bridge' && (res.data?.bridgedDependenciesCount || 0) > 0) {
        toast.success(
          `Task deleted. Intelligently bridged ${res.data?.bridgedDependenciesCount} dependency relationships.`
        );
      } else {
        toast.success(isHardDelete ? 'Task permanently purged.' : 'Task moved to Recycle Bin.');
      }

      onClose();
      if (onDeleted) onDeleted();
    } catch (err: any) {
      toast.error(err?.message || 'Error occurred while deleting task');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Delete Task & Resolve Dependencies"
      className="max-w-lg"
    >
      <div className="space-y-4 pt-2">
        {/* Task Summary Banner */}
        <div className="p-3 bg-[var(--muted)]/50 rounded-lg border border-[var(--border)] flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
          <div className="text-sm">
            <div className="font-semibold flex items-center gap-2">
              {taskCode && <Badge variant="secondary" className="font-mono text-xs">{taskCode}</Badge>}
              <span>{taskTitle}</span>
            </div>
            <p className="text-xs text-[var(--muted-foreground)] mt-1">
              Deleting this work item impacts linked predecessor and successor schedules.
            </p>
          </div>
        </div>

        {/* Dependency Strategy Selection */}
        <div className="space-y-2">
          <label className="text-xs font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">
            Dependency Resolution Strategy
          </label>
          <div className="grid grid-cols-1 gap-2.5">
            {/* Bridge Option */}
            <div
              onClick={() => setStrategy('bridge')}
              className={`p-3 rounded-lg border cursor-pointer transition-all flex items-start gap-3 ${
                strategy === 'bridge'
                  ? 'border-blue-500 bg-blue-50/10 shadow-xs'
                  : 'border-[var(--border)] hover:bg-[var(--accent)]/50'
              }`}
            >
              <GitMerge className="w-5 h-5 text-blue-500 shrink-0 mt-0.5" />
              <div>
                <div className="text-sm font-semibold flex items-center gap-2">
                  <span>Bridge Dependencies</span>
                  <Badge variant="outline" className="text-[10px] bg-blue-500/10 text-blue-400 border-blue-500/20">
                    Recommended
                  </Badge>
                </div>
                <p className="text-xs text-[var(--muted-foreground)] mt-0.5">
                  Automatically reconnects predecessors directly to successors (Task A → Task C), preserving CPM timeline integrity.
                </p>
              </div>
            </div>

            {/* Sever Option */}
            <div
              onClick={() => setStrategy('sever')}
              className={`p-3 rounded-lg border cursor-pointer transition-all flex items-start gap-3 ${
                strategy === 'sever'
                  ? 'border-red-500 bg-red-50/10 shadow-xs'
                  : 'border-[var(--border)] hover:bg-[var(--accent)]/50'
              }`}
            >
              <Unlink className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
              <div>
                <div className="text-sm font-semibold">Sever All Dependencies</div>
                <p className="text-xs text-[var(--muted-foreground)] mt-0.5">
                  Removes all dependency arrows. Dependent successor tasks will lose their scheduling constraints.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Soft Delete vs Hard Purge Toggle */}
        <div className="pt-2 border-t border-[var(--border)] flex items-center justify-between">
          <div className="text-xs">
            <span className="font-semibold block text-[var(--foreground)]">Permanently Purge Task</span>
            <span className="text-[var(--muted-foreground)]">
              {isHardDelete ? 'Bypasses 30-day Recycle Bin retention' : 'Can be recovered from Recycle Bin within 30 days'}
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

        {/* Modal Action Buttons */}
        <div className="pt-3 border-t border-[var(--border)] flex items-center justify-end gap-2">
          <Button variant="outline" onClick={onClose} disabled={isDeleting}>
            Cancel
          </Button>
          <Button
            variant={isHardDelete ? 'destructive' : 'default'}
            className={!isHardDelete ? 'bg-amber-600 hover:bg-amber-700 text-white' : ''}
            onClick={handleDelete}
            disabled={isDeleting}
          >
            {isDeleting ? (
              <>
                <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
                Deleting...
              </>
            ) : (
              <>
                <Trash2 className="w-4 h-4 mr-1.5" />
                {isHardDelete ? 'Permanently Purge' : 'Move to Trash'}
              </>
            )}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
