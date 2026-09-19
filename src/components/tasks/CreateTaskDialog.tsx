// ==============================================================================
// src/components/tasks/CreateTaskDialog.tsx
// Production Enterprise Task Creation Dialog with Zod, React Hook Form,
// TanStack Query Assignee Roster, and Real-Time Toast / Alert Feedback
// ==============================================================================

'use client';

import * as React from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  AlertCircle,
  Calendar,
  Clock,
  Flag,
  Layers,
  Loader2,
  Sparkles,
  User,
  X,
  Check,
} from 'lucide-react';
import { Modal } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Task, TaskPriority } from '@/types/database';
import { createTaskAction, getTenantMembersAction } from '@/actions/tasks';

// ------------------------------------------------------------------------------
// Validation Schema (Rules 1.1 - 1.4)
// ------------------------------------------------------------------------------

const createTaskFormSchema = z.object({
  title: z
    .string()
    .min(1, 'Task title is required')
    .max(255, 'Title cannot exceed 255 characters'),
  task_code: z.string().optional(),
  start_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Start date must be in YYYY-MM-DD format'),
  end_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'End date must be in YYYY-MM-DD format'),
  duration_days: z
    .number({ invalid_type_error: 'Duration must be a number' })
    .int('Duration must be an integer')
    .min(0, 'Duration cannot be negative'),
  priority: z.enum(['low', 'medium', 'high', 'urgent'] as const),
  status: z.string(),
  assignee_ids: z.array(z.string()),
  description: z.string().optional(),
  is_milestone: z.boolean(),
  parent_id: z.string().uuid().nullable().optional(),
});

type CreateTaskFormData = z.infer<typeof createTaskFormSchema>;

interface CreateTaskDialogProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: string;
  tenantId: string;
  parentId?: string | null;
  parentTaskTitle?: string;
  onTaskCreated?: (task: Task) => void;
}

export function CreateTaskDialog({
  isOpen,
  onClose,
  projectId,
  tenantId,
  parentId = null,
  parentTaskTitle,
  onTaskCreated,
}: CreateTaskDialogProps) {
  const [serverError, setServerError] = React.useState<string | null>(null);
  const [serverErrorDetails, setServerErrorDetails] = React.useState<string | null>(null);

  const todayStr = React.useMemo(() => new Date().toISOString().split('T')[0], []);
  const defaultEndStr = React.useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + 4);
    return d.toISOString().split('T')[0];
  }, []);

  const {
    register,
    handleSubmit,
    control,
    watch,
    setValue,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CreateTaskFormData>({
    resolver: zodResolver(createTaskFormSchema),
    defaultValues: {
      title: '',
      task_code: '',
      start_date: todayStr,
      end_date: defaultEndStr,
      duration_days: 5,
      priority: 'medium',
      status: 'todo',
      assignee_ids: [],
      description: '',
      is_milestone: false,
    },
  });

  const watchStart = watch('start_date');
  const watchDuration = watch('duration_days');
  const watchIsMilestone = watch('is_milestone');
  const selectedAssignees = watch('assignee_ids');

  // Dynamically sync end date when start date or duration changes
  React.useEffect(() => {
    if (watchStart && typeof watchDuration === 'number') {
      if (watchDuration <= 1 || watchIsMilestone) {
        setValue('end_date', watchStart);
      } else {
        const start = new Date(watchStart);
        if (!isNaN(start.getTime())) {
          start.setDate(start.getDate() + (watchDuration - 1));
          setValue('end_date', start.toISOString().split('T')[0]);
        }
      }
    }
  }, [watchStart, watchDuration, watchIsMilestone, setValue]);

  // Fetch tenant workspace members using TanStack React Query via Security Definer RPC
  const {
    data: members = [],
    isLoading: isLoadingMembers,
  } = useQuery({
    queryKey: ['tenant-members-roster', tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      return await getTenantMembersAction(tenantId);
    },
    enabled: isOpen && !!tenantId,
    staleTime: 1000 * 60 * 5, // 5 minutes cache
  });

  // Handle form submission
  const onSubmit = async (data: CreateTaskFormData) => {
    setServerError(null);
    setServerErrorDetails(null);

    const toastId = toast.loading('Creating task...');

    try {
      const result = await createTaskAction({
        title: data.title,
        project_id: projectId,
        tenant_id: tenantId,
        parent_id: parentId || undefined,
        start_date: data.start_date,
        end_date: data.is_milestone ? data.start_date : data.end_date,
        duration_days: data.is_milestone ? 0 : data.duration_days,
        priority: data.priority,
        status: data.status,
        description: data.description || null,
        task_code: data.task_code ? data.task_code.trim() : undefined,
        is_milestone: data.is_milestone || data.duration_days === 0,
        assignee_ids: data.assignee_ids,
      });

      if (!result.success || !result.task) {
        const errMsg = result.error || 'Failed to save task to database';
        setServerError(errMsg);
        if (result.details) {
          setServerErrorDetails(
            typeof result.details === 'object'
              ? JSON.stringify(result.details, null, 2)
              : String(result.details)
          );
        }
        toast.error(`Failed to create task: ${errMsg}`, { id: toastId });
        return;
      }

      toast.success(
        parentId ? 'Subtask created successfully' : 'Task created successfully',
        { id: toastId }
      );
      reset();
      onClose();
      if (onTaskCreated) onTaskCreated(result.task);
    } catch (err: any) {
      const msg = err?.message || 'Unexpected application failure';
      setServerError(msg);
      toast.error(`Failed to create task: ${msg}`, { id: toastId });
    }
  };

  const handleToggleAssignee = (userId: string) => {
    const current = selectedAssignees || [];
    if (current.includes(userId)) {
      setValue(
        'assignee_ids',
        current.filter((id) => id !== userId)
      );
    } else {
      setValue('assignee_ids', [...current, userId]);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={parentId ? 'Create Hierarchical Subtask' : 'Create Work Item'}
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        {/* Parent Task Context Banner */}
        {parentId && (
          <div className="flex items-center gap-2 p-2.5 rounded-lg border border-purple-500/30 bg-purple-500/10 text-xs text-purple-300">
            <Layers className="h-4 w-4 shrink-0 text-purple-400" />
            <span>
              Adding subtask under parent:{' '}
              <strong className="text-purple-200">{parentTaskTitle || 'Parent Task'}</strong>
            </span>
          </div>
        )}

        {/* Persistent In-Form Error Alert Banner */}
        {serverError && (
          <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-3.5 text-xs text-rose-300 space-y-1.5 animate-in fade-in slide-in-from-top-2 duration-200">
            <div className="flex items-center gap-2 font-semibold text-rose-200">
              <AlertCircle className="h-4 w-4 shrink-0 text-rose-400" />
              <span>Database Persistence Rejection</span>
            </div>
            <p className="font-mono text-[11px] leading-relaxed text-rose-300">
              {serverError}
            </p>
            {serverErrorDetails && (
              <pre className="mt-1.5 p-2 rounded bg-black/40 text-[10px] font-mono text-rose-400 overflow-x-auto max-h-24">
                {serverErrorDetails}
              </pre>
            )}
          </div>
        )}

        {/* Task Title */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-[var(--foreground)] flex items-center justify-between">
            <span>Task Title <span className="text-rose-500">*</span></span>
            {errors.title && (
              <span className="text-[10px] text-rose-400">{errors.title.message}</span>
            )}
          </label>
          <Input
            placeholder="e.g. Critical Path Scheduling & Gantt Canvas"
            {...register('title')}
            autoFocus
            className={errors.title ? 'border-rose-500/50' : ''}
          />
        </div>

        {/* Task Code & Milestone Toggle */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-[var(--foreground)] flex items-center justify-between">
              <span>Task Code</span>
              <span className="text-[10px] text-[var(--muted-foreground)]">Auto-generated if blank</span>
            </label>
            <Input
              placeholder="e.g. PRJ-001"
              {...register('task_code')}
              className="font-mono uppercase"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-[var(--foreground)]">Item Type</label>
            <div className="flex items-center gap-2 pt-1.5">
              <label className="flex items-center gap-2 text-xs text-[var(--muted-foreground)] cursor-pointer select-none">
                <input
                  type="checkbox"
                  {...register('is_milestone')}
                  onChange={(e) => {
                    setValue('is_milestone', e.target.checked);
                    if (e.target.checked) {
                      setValue('duration_days', 0);
                    } else if (watchDuration === 0) {
                      setValue('duration_days', 1);
                    }
                  }}
                  className="rounded border-[var(--border)] text-[var(--primary)] focus:ring-[var(--primary)] h-4 w-4"
                />
                <span>Milestone (0d duration)</span>
              </label>
            </div>
          </div>
        </div>

        {/* Dates & Duration Grid */}
        <div className="grid grid-cols-3 gap-3">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-[var(--foreground)]">Start Date <span className="text-rose-500">*</span></label>
            <Input
              type="date"
              {...register('start_date')}
              className="font-mono text-xs"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-[var(--foreground)]">Duration (Days)</label>
            <Input
              type="number"
              min="0"
              disabled={watchIsMilestone}
              {...register('duration_days', { valueAsNumber: true })}
              className="font-mono text-xs"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-[var(--foreground)]">End Date</label>
            <Input
              type="date"
              {...register('end_date')}
              className="font-mono text-xs bg-[var(--secondary)]/40 cursor-not-allowed opacity-90"
              readOnly
            />
          </div>
        </div>

        {/* Priority & Status */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-[var(--foreground)]">Priority</label>
            <select
              {...register('priority')}
              className="w-full rounded-md border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-xs text-[var(--foreground)] focus:outline-none focus:ring-1 focus:ring-[var(--primary)]"
            >
              <option value="low">Low Priority</option>
              <option value="medium">Medium Priority</option>
              <option value="high">High Priority</option>
              <option value="urgent">Urgent</option>
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-[var(--foreground)]">Initial Status</label>
            <select
              {...register('status')}
              className="w-full rounded-md border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-xs text-[var(--foreground)] focus:outline-none focus:ring-1 focus:ring-[var(--primary)]"
            >
              <option value="todo">To Do</option>
              <option value="in_progress">In Progress</option>
              <option value="in_review">In Review</option>
              <option value="completed">Completed</option>
            </select>
          </div>
        </div>

        {/* Team Assignees Roster Dropdown / Multi-Select */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-[var(--foreground)] flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <User className="h-3.5 w-3.5 text-[var(--muted-foreground)]" />
              <span>Assignees (Workspace Team Roster)</span>
            </span>
            {isLoadingMembers && (
              <span className="text-[10px] text-[var(--muted-foreground)] flex items-center gap-1">
                <Loader2 className="h-3 w-3 animate-spin" />
                <span>Loading team...</span>
              </span>
            )}
          </label>

          {members.length === 0 && !isLoadingMembers ? (
            <p className="text-[11px] text-[var(--muted-foreground)] italic p-2 rounded bg-[var(--secondary)]/30 border border-[var(--border)]">
              No workspace members found.
            </p>
          ) : (
            <div className="max-h-36 overflow-y-auto rounded-lg border border-[var(--border)] bg-[var(--card)] p-1.5 space-y-1 divide-y divide-[var(--border)]/40">
              {members.map((member: any) => {
                const isSelected = selectedAssignees?.includes(member.id);
                return (
                  <div
                    key={member.id}
                    onClick={() => handleToggleAssignee(member.id)}
                    className={`flex items-center justify-between p-1.5 rounded-md text-xs cursor-pointer transition-colors ${
                      isSelected
                        ? 'bg-[var(--primary)]/15 text-[var(--foreground)]'
                        : 'hover:bg-[var(--secondary)]/50 text-[var(--muted-foreground)]'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      {member.avatar_url ? (
                        <img
                          src={member.avatar_url}
                          alt={member.full_name}
                          className="h-6 w-6 rounded-full object-cover border border-[var(--border)] shrink-0"
                        />
                      ) : (
                        <div className="h-6 w-6 rounded-full bg-[var(--secondary)] flex items-center justify-center font-bold text-[10px] text-[var(--foreground)] shrink-0">
                          {member.full_name?.charAt(0) || 'U'}
                        </div>
                      )}
                      <div className="truncate">
                        <div className="font-semibold text-xs text-[var(--foreground)] leading-tight truncate">
                          {member.full_name}
                        </div>
                        <div className="text-[10px] text-[var(--muted-foreground)] truncate">
                          {member.email}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <Badge variant="outline" className="text-[9px] capitalize py-0 px-1.5">
                        {member.role || 'member'}
                      </Badge>
                      <div
                        className={`h-4 w-4 rounded border flex items-center justify-center ${
                          isSelected
                            ? 'bg-[var(--primary)] border-[var(--primary)] text-white'
                            : 'border-[var(--border)] bg-[var(--card)]'
                        }`}
                      >
                        {isSelected && <Check className="h-3 w-3" />}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Task Description */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-[var(--foreground)]">Description</label>
          <textarea
            rows={2}
            placeholder="Operational objectives, technical constraints, or acceptance criteria..."
            {...register('description')}
            className="w-full rounded-md border border-[var(--border)] bg-[var(--card)] p-2.5 text-xs text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] focus:outline-none focus:ring-1 focus:ring-[var(--primary)] resize-none"
          />
        </div>

        {/* Modal Action Buttons */}
        <div className="flex justify-end gap-2 pt-2 border-t border-[var(--border)]">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={isSubmitting}
            className="text-xs"
          >
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={isSubmitting}
            className="gap-1.5 text-xs"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                <span>Creating task...</span>
              </>
            ) : (
              <>
                <Sparkles className="h-3.5 w-3.5" />
                <span>Create Task</span>
              </>
            )}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
