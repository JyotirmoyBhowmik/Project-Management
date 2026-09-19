'use client';

import * as React from 'react';
import {
  X,
  Calendar,
  Clock,
  Flame,
  MessageSquare,
  Paperclip,
  Activity,
  Send,
  Bold,
  Italic,
  Code,
  List,
  Eye,
  CheckCircle,
  AlertCircle,
  User,
  Sliders,
  Sparkles,
  Trash2,
  Layers,
  Plus,
} from 'lucide-react';
import { toast } from 'sonner';
import { Task, TaskComment, TaskActivityLog, WorkingCalendar, CalendarHoliday, UserProfile } from '@/types/database';
import { useTenantMetadata } from '@/lib/context/tenant-metadata-context';
import { addWorkingDays, formatDateToISO, parseISODate } from '@/lib/calendar/calendar-engine';
import { dbService } from '@/lib/supabase/db-service';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { quickCreateSubtaskAction } from '@/actions/tasks';
import { TaskAttachmentsManager } from './TaskAttachmentsManager';
import { DeleteTaskModal } from '@/components/modals/DeleteTaskModal';

interface TaskDetailDrawerProps {
  task: Task | null;
  isOpen: boolean;
  onClose: () => void;
  tenantId: string;
  projectId: string;
  currentUserId?: string | null;
  currentUserProfile?: UserProfile | null;
  calendar: WorkingCalendar;
  holidays: CalendarHoliday[];
  onTaskUpdate?: (taskId: string, updates: Partial<Task>) => void;
  onTaskDeleted?: (taskId: string) => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

class DrawerErrorBoundary extends React.Component<
  { children: React.ReactNode; onClose: () => void },
  ErrorBoundaryState
> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: any) {
    console.error('TaskDetailDrawer rendering caught error:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex-1 flex flex-col items-center justify-center p-8 text-center space-y-3">
          <div className="text-amber-500 font-bold text-sm">Unable to render task details</div>
          <p className="text-xs text-[var(--muted-foreground)] max-w-xs">
            A minor data formatting anomaly occurred with this task. You can close this drawer and continue working.
          </p>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              this.setState({ hasError: false });
              this.props.onClose();
            }}
          >
            Close Drawer
          </Button>
        </div>
      );
    }
    return this.props.children;
  }
}

export function TaskDetailDrawer({
  task,
  isOpen,
  onClose,
  tenantId,
  projectId,
  currentUserId,
  currentUserProfile,
  calendar,
  holidays,
  onTaskUpdate,
  onTaskDeleted,
}: TaskDetailDrawerProps) {
  const { statuses, priorities } = useTenantMetadata();
  const [activeTab, setActiveTab] = React.useState<'details' | 'discussion' | 'attachments'>('details');
  const [isDeleteModalOpen, setIsDeleteModalOpen] = React.useState(false);

  // Local editable task fields
  const [title, setTitle] = React.useState('');
  const [description, setDescription] = React.useState('');
  const [status, setStatus] = React.useState('todo');
  const [priority, setPriority] = React.useState('medium');
  const [startDate, setStartDate] = React.useState('');
  const [durationDays, setDurationDays] = React.useState(1);
  const [progress, setProgress] = React.useState(0);
  const [isMilestone, setIsMilestone] = React.useState(false);

  // Discussion & Comments state
  const [comments, setComments] = React.useState<TaskComment[]>([]);
  const [activityLogs, setActivityLogs] = React.useState<TaskActivityLog[]>([]);
  const [commentInput, setCommentInput] = React.useState('');
  const [isPreviewComment, setIsPreviewComment] = React.useState(false);
  const [isSubmittingComment, setIsSubmittingComment] = React.useState(false);

  // Subtasks state
  const [subtasks, setSubtasks] = React.useState<Task[]>([]);
  const [newSubtaskTitle, setNewSubtaskTitle] = React.useState('');
  const [isAddingSubtask, setIsAddingSubtask] = React.useState(false);

  // @Mention Autocomplete state
  const [teamMembers, setTeamMembers] = React.useState<Array<{ id: string; user_id: string; role: string; profile: UserProfile }>>([]);
  const [mentionQuery, setMentionQuery] = React.useState<string | null>(null);
  const [mentionCursorIndex, setMentionCursorIndex] = React.useState<number>(-1);
  const textareaRef = React.useRef<HTMLTextAreaElement | null>(null);

  const supabase = React.useMemo(() => createClient(), []);

  const loadSubtasks = React.useCallback(async () => {
    if (!task) return;
    try {
      const { data, error } = await supabase
        .from('tasks')
        .select('*')
        .or(`parent_id.eq.${task.id},parent_task_id.eq.${task.id}`)
        .is('deleted_at', null)
        .order('created_at', { ascending: true });
      if (!error && data) {
        setSubtasks(data as Task[]);
      }
    } catch (err) {
      console.error('Failed to load subtasks', err);
    }
  }, [task, supabase]);

  // Sync state when task changes
  React.useEffect(() => {
    if (task) {
      setTitle(task.title || '');
      setDescription(task.description || '');
      setStatus(task.status || 'todo');
      setPriority(task.priority || 'medium');
      setStartDate(task.start_date || '');
      setDurationDays(task.duration_days || 1);
      setProgress(task.progress ?? task.progress_percent ?? 0);
      setIsMilestone(task.is_milestone || false);
      loadSubtasks();
    }
  }, [task, loadSubtasks]);

  // Load comments, activity stream, and team members
  React.useEffect(() => {
    if (!task || !isOpen) return;

    let isMounted = true;

    async function loadData() {
      if (!task) return;
      try {
        const [cList, aList, mList] = await Promise.all([
          dbService.getTaskComments(task.id, supabase),
          dbService.getTaskActivityLogs(task.id, supabase),
          dbService.getTenantMembersWithProfiles(tenantId, supabase),
        ]);
        if (isMounted) {
          setComments(cList);
          setActivityLogs(aList);
          setTeamMembers(mList);
        }
      } catch (err) {
        console.error('Failed to load drawer data', err);
      }
    }

    loadData();
    return () => {
      isMounted = false;
    };
  }, [task, isOpen, tenantId, supabase]);

  // Close on Escape key
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !task) return null;

  // Handle saving task detail fields
  const handleSaveDetails = (updates: Partial<Task>) => {
    if (!task) return;
    onTaskUpdate?.(task.id, updates);
  };

  const handleDurationChange = (newDays: number) => {
    const d = Math.max(1, newDays);
    setDurationDays(d);
    if (startDate) {
      const s = parseISODate(startDate);
      const e = addWorkingDays(s, d, calendar, holidays);
      const endIso = formatDateToISO(e);
      handleSaveDetails({ duration_days: d, end_date: endIso });
    } else {
      handleSaveDetails({ duration_days: d });
    }
  };

  const handleStartDateChange = (newStart: string) => {
    setStartDate(newStart);
    if (newStart) {
      const s = parseISODate(newStart);
      const e = addWorkingDays(s, durationDays, calendar, holidays);
      const endIso = formatDateToISO(e);
      handleSaveDetails({ start_date: newStart, end_date: endIso });
    }
  };

  const handleMilestoneToggle = (enabled: boolean) => {
    setIsMilestone(enabled);
    if (enabled) {
      setDurationDays(0);
      handleSaveDetails({ is_milestone: true, duration_days: 0, end_date: startDate });
    } else {
      setDurationDays(1);
      if (startDate) {
        const s = parseISODate(startDate);
        const e = addWorkingDays(s, 1, calendar, holidays);
        handleSaveDetails({ is_milestone: false, duration_days: 1, end_date: formatDateToISO(e) });
      } else {
        handleSaveDetails({ is_milestone: false, duration_days: 1 });
      }
    }
  };

  const handleToggleSubtaskStatus = async (subtask: Task) => {
    const isCompleted = subtask.status === 'completed';
    const nextStatus = isCompleted ? 'todo' : 'completed';
    const nextProgress = isCompleted ? 0 : 100;

    setSubtasks((prev) =>
      prev.map((s) =>
        s.id === subtask.id ? { ...s, status: nextStatus, progress: nextProgress } : s
      )
    );

    await supabase
      .from('tasks')
      .update({
        status: nextStatus,
        progress: nextProgress,
        progress_percent: nextProgress,
        updated_at: new Date().toISOString(),
      })
      .eq('id', subtask.id);
  };

  const handleCreateSubtask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSubtaskTitle.trim() || !task || isAddingSubtask) return;
    setIsAddingSubtask(true);
    try {
      const res = await quickCreateSubtaskAction({
        parent_id: task.id,
        title: newSubtaskTitle.trim(),
        project_id: projectId,
        tenant_id: tenantId,
        start_date: task.start_date,
        due_date: task.end_date,
      });

      if (res.success && res.task) {
        setSubtasks((prev) => [...prev, res.task!]);
        setNewSubtaskTitle('');
        toast.success(`Subtask "${newSubtaskTitle.trim()}" added`);
        if (onTaskUpdate) {
          onTaskUpdate(task.id, {});
        }
      } else {
        toast.error(res.error || 'Failed to create subtask');
      }
    } catch {
      toast.error('Network error creating subtask');
    } finally {
      setIsAddingSubtask(false);
    }
  };

  const subtasksCompletedCount = subtasks.filter((s) => s.status === 'completed').length;
  const subtasksPercent =
    subtasks.length > 0 ? Math.round((subtasksCompletedCount / subtasks.length) * 100) : null;

  const handleSyncParentProgress = () => {
    if (subtasksPercent === null) return;
    setProgress(subtasksPercent);
    handleSaveDetails({ progress: subtasksPercent, progress_percent: subtasksPercent });
    toast.success(
      `Progress updated to ${subtasksPercent}% (${subtasksCompletedCount}/${subtasks.length} subtasks completed)`
    );
  };

function formatSafeDateTime(val: string | null | undefined): string {
  if (!val) return '';
  try {
    const d = new Date(val);
    return isNaN(d.getTime()) ? '' : d.toLocaleString();
  } catch {
    return '';
  }
}

function formatSafeTime(val: string | null | undefined): string {
  if (!val) return '';
  try {
    const d = new Date(val);
    return isNaN(d.getTime()) ? '' : d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
}

  // Unified Chronological History Feed
  const unifiedHistory = React.useMemo(() => {
    type FeedItem =
      | { type: 'comment'; data: TaskComment; timestamp: number }
      | { type: 'activity'; data: TaskActivityLog; timestamp: number };

    const items: FeedItem[] = [
      ...comments.map((c) => ({
        type: 'comment' as const,
        data: c,
        timestamp: c?.created_at ? new Date(c.created_at).getTime() || 0 : 0,
      })),
      ...activityLogs.map((a) => ({
        type: 'activity' as const,
        data: a,
        timestamp: a?.created_at ? new Date(a.created_at).getTime() || 0 : 0,
      })),
    ];

    return items.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
  }, [comments, activityLogs]);

  // Handle Comment Submission & @Mentions
  const handleCommentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    const cursorPos = e.target.selectionStart;
    setCommentInput(val);

    // Detect @ trigger
    const textBeforeCursor = val.slice(0, cursorPos);
    const lastAtIndex = textBeforeCursor.lastIndexOf('@');

    if (lastAtIndex !== -1 && (lastAtIndex === 0 || /\s/.test(val[lastAtIndex - 1]))) {
      const query = textBeforeCursor.slice(lastAtIndex + 1);
      if (!query.includes(' ')) {
        setMentionQuery(query.toLowerCase());
        setMentionCursorIndex(lastAtIndex);
        return;
      }
    }
    setMentionQuery(null);
  };

  const insertMention = (member: { profile: UserProfile }) => {
    if (mentionCursorIndex === -1) return;
    const before = commentInput.slice(0, mentionCursorIndex);
    const after = commentInput.slice(mentionCursorIndex + (mentionQuery?.length || 0) + 1);
    const mentionTag = `@${member.profile.full_name.replace(/\s+/g, '_')} `;
    setCommentInput(before + mentionTag + after);
    setMentionQuery(null);
    textareaRef.current?.focus();
  };

  const submitComment = async () => {
    if (!commentInput.trim() || !currentUserId || isSubmittingComment) return;
    setIsSubmittingComment(true);

    try {
      const created = await dbService.createTaskComment(
        {
          tenant_id: tenantId,
          task_id: task.id,
          user_id: currentUserId,
          content_markdown: commentInput,
        },
        supabase
      );

      if (created) {
        setComments((prev) => [...prev, created]);

        // Process @mentions and trigger notifications
        const mentionMatches = commentInput.match(/@([a-zA-Z0-9_-]+)/g);
        if (mentionMatches && teamMembers.length > 0) {
          for (const match of mentionMatches) {
            const cleanName = match.slice(1).replace(/_/g, ' ').toLowerCase();
            const mentionedMember = teamMembers.find(
              (m) =>
                m.profile?.full_name?.toLowerCase() === cleanName ||
                m.profile?.email?.toLowerCase().includes(cleanName)
            );

            if (mentionedMember && mentionedMember.user_id !== currentUserId) {
              await dbService.createNotification(
                {
                  tenant_id: tenantId,
                  recipient_id: mentionedMember.user_id,
                  actor_id: currentUserId,
                  event_type: 'mention',
                  title: `Mentioned by ${currentUserProfile?.full_name || 'a teammate'}`,
                  message: `${currentUserProfile?.full_name || 'Someone'} mentioned you on task: "${task.title}"`,
                  entity_type: 'task',
                  entity_id: task.id,
                },
                supabase
              );
            }
          }
        }
      }

      setCommentInput('');
      setIsPreviewComment(false);
    } catch (err) {
      console.error('Failed to submit comment', err);
    } finally {
      setIsSubmittingComment(false);
    }
  };

  const filteredMembers = React.useMemo(() => {
    if (!mentionQuery) return [];
    return teamMembers.filter((m) =>
      m.profile?.full_name?.toLowerCase().includes(mentionQuery) ||
      m.profile?.email?.toLowerCase().includes(mentionQuery)
    );
  }, [teamMembers, mentionQuery]);

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-xs transition-opacity animate-in fade-in duration-200">
      {/* Click outside to close */}
      <div className="flex-1" onClick={onClose} />

      {/* Drawer Container */}
      <div className="w-full max-w-2xl bg-[var(--card)] border-l border-[var(--border)] shadow-2xl flex flex-col h-full overflow-hidden animate-in slide-in-from-right duration-300">
        <DrawerErrorBoundary onClose={onClose}>
        {/* Drawer Header */}
        <div className="flex items-center justify-between p-4 border-b border-[var(--border)] bg-[var(--secondary)]/40">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-xs font-mono text-[var(--primary)] bg-[var(--primary)]/10 px-2 py-0.5 rounded border border-[var(--primary)]/20 font-bold">
              {task.task_code || (task as any).code || `TASK-${(task.id || '').slice(0, 6).toUpperCase()}`}
            </span>
            {task.is_critical && (
              <Badge variant="critical" className="gap-1 text-[10px] py-0 px-1.5 bg-amber-500/20 text-amber-300 border-amber-500/40">
                <Flame className="h-3 w-3 text-amber-400" />
                Critical Path
              </Badge>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsDeleteModalOpen(true)}
              className="p-1.5 rounded-lg hover:bg-red-500/10 text-[var(--muted-foreground)] hover:text-red-400 transition-colors cursor-pointer"
              title="Delete Task"
            >
              <Trash2 className="h-4 w-4" />
            </button>
            <button
              onClick={onClose}
              aria-label="Close task details"
              className="p-1.5 rounded-lg hover:bg-[var(--secondary)] text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Task Title & Primary Bar */}
        <div className="p-4 border-b border-[var(--border)] bg-[var(--card)]">
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={() => handleSaveDetails({ title })}
            className="w-full text-base font-bold text-[var(--foreground)] bg-transparent border-b border-transparent hover:border-[var(--border)] focus:border-[var(--primary)] outline-hidden px-1 py-1 transition-colors"
            placeholder="Task Title"
          />

          {/* Tab Navigation */}
          <div className="flex items-center gap-2 mt-4 border-b border-[var(--border)]">
            <button
              onClick={() => setActiveTab('details')}
              className={`flex items-center gap-1.5 pb-2 px-2 text-xs font-semibold border-b-2 transition-all cursor-pointer ${
                activeTab === 'details'
                  ? 'border-[var(--primary)] text-[var(--foreground)]'
                  : 'border-transparent text-[var(--muted-foreground)] hover:text-[var(--foreground)]'
              }`}
            >
              <Sliders className="h-3.5 w-3.5" />
              <span>Details & Schedule</span>
            </button>

            <button
              onClick={() => setActiveTab('discussion')}
              className={`flex items-center gap-1.5 pb-2 px-2 text-xs font-semibold border-b-2 transition-all cursor-pointer ${
                activeTab === 'discussion'
                  ? 'border-[var(--primary)] text-[var(--foreground)]'
                  : 'border-transparent text-[var(--muted-foreground)] hover:text-[var(--foreground)]'
              }`}
            >
              <MessageSquare className="h-3.5 w-3.5" />
              <span>Discussion & History ({comments.length + activityLogs.length})</span>
            </button>

            <button
              onClick={() => setActiveTab('attachments')}
              className={`flex items-center gap-1.5 pb-2 px-2 text-xs font-semibold border-b-2 transition-all cursor-pointer ${
                activeTab === 'attachments'
                  ? 'border-[var(--primary)] text-[var(--foreground)]'
                  : 'border-transparent text-[var(--muted-foreground)] hover:text-[var(--foreground)]'
              }`}
            >
              <Paperclip className="h-3.5 w-3.5" />
              <span>Attachments</span>
            </button>
          </div>
        </div>

        {/* Drawer Body Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-5">
          {/* TAB 1: DETAILS & SCHEDULE */}
          {activeTab === 'details' && (
            <div className="space-y-5 text-xs">
              {/* Description */}
              <div>
                <label className="font-bold text-[var(--muted-foreground)] block mb-1.5">
                  Description
                </label>
                <textarea
                  rows={4}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  onBlur={() => handleSaveDetails({ description })}
                  placeholder="Add detailed task context or acceptance criteria..."
                  className="w-full rounded-lg border border-[var(--border)] bg-[var(--secondary)]/30 p-3 text-xs text-[var(--foreground)] outline-hidden focus:border-[var(--primary)]"
                />
              </div>

              {/* Status & Priority Grid */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="font-bold text-[var(--muted-foreground)] block mb-1.5">
                    Workflow Status
                  </label>
                  <select
                    value={status}
                    onChange={(e) => {
                      setStatus(e.target.value);
                      handleSaveDetails({ status: e.target.value as any });
                    }}
                    className="w-full h-9 rounded-md border border-[var(--input)] bg-[var(--card)] px-3 text-xs cursor-pointer font-medium"
                  >
                    {statuses.map((s) => (
                      <option key={s.slug} value={s.slug}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="font-bold text-[var(--muted-foreground)] block mb-1.5">
                    Priority Level
                  </label>
                  <select
                    value={priority}
                    onChange={(e) => {
                      setPriority(e.target.value);
                      handleSaveDetails({ priority: e.target.value as any });
                    }}
                    className="w-full h-9 rounded-md border border-[var(--input)] bg-[var(--card)] px-3 text-xs cursor-pointer font-medium"
                  >
                    {priorities.map((p) => (
                      <option key={p.slug} value={p.slug}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Scheduling & Working Calendar Grid */}
              <div className="p-4 rounded-xl border border-[var(--border)] bg-[var(--secondary)]/20 space-y-3">
                <h4 className="font-bold text-[var(--foreground)] flex items-center gap-1.5">
                  <Calendar className="h-3.5 w-3.5 text-[var(--primary)]" />
                  <span>Calendar & Critical Path Schedule</span>
                </h4>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="font-semibold text-[var(--muted-foreground)] block mb-1">
                      Start Date
                    </label>
                    <input
                      type="date"
                      value={startDate}
                      onChange={(e) => handleStartDateChange(e.target.value)}
                      className="w-full h-8 rounded-md border border-[var(--border)] bg-[var(--card)] px-2 text-xs font-mono"
                    />
                  </div>

                  <div>
                    <label className="font-semibold text-[var(--muted-foreground)] block mb-1">
                      Duration (Working Days)
                    </label>
                    <input
                      type="number"
                      min={0}
                      max={365}
                      disabled={isMilestone}
                      value={isMilestone ? 0 : durationDays}
                      onChange={(e) => handleDurationChange(parseInt(e.target.value, 10) || 0)}
                      className="w-full h-8 rounded-md border border-[var(--border)] bg-[var(--card)] px-2 text-xs font-mono disabled:opacity-60 disabled:cursor-not-allowed"
                    />
                  </div>
                </div>

                {/* Milestone Toggle Switch */}
                <div className="flex items-center justify-between p-2.5 rounded-lg border border-[var(--border)] bg-[var(--card)]">
                  <div className="space-y-0.5">
                    <div className="font-semibold text-xs text-[var(--foreground)] flex items-center gap-1.5">
                      <span className="text-purple-400 font-bold">◆</span>
                      <span>Milestone (Zero-Duration Target)</span>
                    </div>
                    <p className="text-[10px] text-[var(--muted-foreground)]">
                      Milestones mark key deliverables or checkpoint dates without working duration.
                    </p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={isMilestone}
                      onChange={(e) => handleMilestoneToggle(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-8 h-4 bg-[var(--border)] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-purple-600"></div>
                  </label>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-[var(--border)] text-[11px] text-[var(--muted-foreground)] font-mono">
                  <div>
                    <span>Calculated End Date: </span>
                    <strong className="text-[var(--foreground)]">{task.end_date}</strong>
                  </div>
                  <div>
                    <span>Total Float: </span>
                    <strong className={task.total_float === 0 ? 'text-amber-400' : 'text-emerald-400'}>
                      {task.total_float} days
                    </strong>
                  </div>
                </div>
              </div>

              {/* Progress Slider */}
              <div className="p-4 rounded-xl border border-[var(--border)] bg-[var(--secondary)]/20 space-y-2">
                <div className="flex items-center justify-between font-semibold">
                  <span className="text-[var(--foreground)]">Completion Progress</span>
                  <span className="font-mono text-[var(--primary)]">{progress}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={progress}
                  onChange={(e) => {
                    const p = parseInt(e.target.value, 10);
                    setProgress(p);
                    handleSaveDetails({ progress: p, progress_percent: p });
                  }}
                  className="w-full accent-[var(--primary)] cursor-pointer"
                />
              </div>

              {/* Subtasks Checklist Section */}
              <div className="p-4 rounded-xl border border-[var(--border)] bg-[var(--secondary)]/20 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-[var(--foreground)] flex items-center gap-1.5">
                    <Layers className="h-3.5 w-3.5 text-purple-400" />
                    <span>Subtasks ({subtasks.length})</span>
                  </h4>
                  {subtasks.length > 0 && subtasksPercent !== null && (
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-mono text-[var(--muted-foreground)]">
                        {subtasksCompletedCount}/{subtasks.length} ({subtasksPercent}%)
                      </span>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={handleSyncParentProgress}
                        className="h-6 text-[10px] py-0 px-2 border-purple-500/30 text-purple-400 hover:text-purple-300 hover:bg-purple-950/20"
                      >
                        Sync Progress
                      </Button>
                    </div>
                  )}
                </div>

                {/* Subtask items list */}
                <div className="space-y-1.5 max-h-48 overflow-y-auto">
                  {subtasks.map((sub) => {
                    const isDone = sub.status === 'completed';
                    return (
                      <div
                        key={sub.id}
                        onClick={() => handleToggleSubtaskStatus(sub)}
                        className={`flex items-center gap-2.5 p-2 rounded-lg border text-xs cursor-pointer transition-colors ${
                          isDone
                            ? 'bg-emerald-500/5 border-emerald-500/20 text-[var(--muted-foreground)]'
                            : 'bg-[var(--card)] border-[var(--border)] text-[var(--foreground)] hover:bg-[var(--secondary)]/40'
                        }`}
                      >
                        <div
                          className={`h-4 w-4 rounded border flex items-center justify-center shrink-0 ${
                            isDone
                              ? 'bg-emerald-600 border-emerald-600 text-white'
                              : 'border-[var(--border)] bg-[var(--card)]'
                          }`}
                        >
                          {isDone && <CheckCircle className="h-3 w-3" />}
                        </div>
                        <span
                          className={`flex-1 truncate ${
                            isDone ? 'line-through opacity-70' : 'font-medium'
                          }`}
                        >
                          {sub.title}
                        </span>
                        <Badge
                          variant="outline"
                          className="text-[9px] uppercase font-mono py-0 px-1"
                        >
                          {sub.status}
                        </Badge>
                      </div>
                    );
                  })}

                  {subtasks.length === 0 && (
                    <p className="text-[11px] text-[var(--muted-foreground)] italic py-1">
                      No subtasks defined for this work item.
                    </p>
                  )}
                </div>

                {/* Inline Add Subtask Input */}
                <form
                  onSubmit={handleCreateSubtask}
                  className="flex items-center gap-2 pt-1 border-t border-[var(--border)]"
                >
                  <input
                    type="text"
                    placeholder="+ Add a subtask (press Enter)..."
                    value={newSubtaskTitle}
                    onChange={(e) => setNewSubtaskTitle(e.target.value)}
                    disabled={isAddingSubtask}
                    className="flex-1 h-7 text-xs bg-[var(--card)] border border-[var(--border)] rounded px-2.5 text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] focus:outline-none focus:border-[var(--primary)]"
                  />
                  <Button
                    type="submit"
                    size="sm"
                    disabled={!newSubtaskTitle.trim() || isAddingSubtask}
                    className="h-7 text-xs px-2.5 gap-1"
                  >
                    <Plus className="h-3 w-3" />
                    <span>Add</span>
                  </Button>
                </form>
              </div>
            </div>
          )}

          {/* TAB 2: DISCUSSION & ACTIVITY STREAM */}
          {activeTab === 'discussion' && (
            <div className="space-y-5 flex flex-col h-full">
              {/* Markdown Editor & Mention Autocomplete */}
              <div className="rounded-xl border border-[var(--border)] bg-[var(--secondary)]/30 p-3 space-y-2 relative">
                {/* Formatting Toolbar */}
                <div className="flex items-center justify-between border-b border-[var(--border)] pb-2 text-[var(--muted-foreground)]">
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setCommentInput((prev) => `${prev}**bold** `)}
                      className="p-1 hover:bg-[var(--secondary)] rounded cursor-pointer"
                      title="Bold"
                    >
                      <Bold className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setCommentInput((prev) => `${prev}*italic* `)}
                      className="p-1 hover:bg-[var(--secondary)] rounded cursor-pointer"
                      title="Italic"
                    >
                      <Italic className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setCommentInput((prev) => `${prev}\`\`\`\ncode\n\`\`\` `)}
                      className="p-1 hover:bg-[var(--secondary)] rounded cursor-pointer"
                      title="Code Block"
                    >
                      <Code className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setCommentInput((prev) => `${prev}\n- List item `)}
                      className="p-1 hover:bg-[var(--secondary)] rounded cursor-pointer"
                      title="Bullet List"
                    >
                      <List className="h-3.5 w-3.5" />
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() => setIsPreviewComment((p) => !p)}
                    className="flex items-center gap-1 text-[10px] font-semibold hover:text-[var(--foreground)] cursor-pointer"
                  >
                    <Eye className="h-3 w-3" />
                    <span>{isPreviewComment ? 'Edit' : 'Preview'}</span>
                  </button>
                </div>

                {/* Input Textarea or Preview */}
                {isPreviewComment ? (
                  <div className="min-h-[80px] p-2 bg-[var(--card)] rounded border border-[var(--border)] text-xs text-[var(--foreground)] whitespace-pre-wrap font-sans">
                    {commentInput || <span className="text-[var(--muted-foreground)] italic">Nothing to preview</span>}
                  </div>
                ) : (
                  <textarea
                    ref={textareaRef}
                    rows={3}
                    value={commentInput}
                    onChange={handleCommentChange}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                        submitComment();
                      }
                    }}
                    placeholder="Write a comment or note... Type @ to mention team members (Ctrl+Enter to post)"
                    className="w-full text-xs text-[var(--foreground)] bg-transparent outline-hidden resize-none placeholder:text-[var(--muted-foreground)]"
                  />
                )}

                {/* @Mention Autocomplete Popover */}
                {mentionQuery !== null && filteredMembers.length > 0 && (
                  <div className="absolute left-3 bottom-12 z-30 w-64 rounded-lg border border-[var(--border)] bg-[var(--card)] shadow-xl p-1 max-h-48 overflow-y-auto">
                    <div className="px-2 py-1 text-[10px] font-bold text-[var(--muted-foreground)] uppercase">
                      Mention Teammate
                    </div>
                    {filteredMembers.map((m) => (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => insertMention(m)}
                        className="w-full flex items-center gap-2 p-1.5 rounded hover:bg-[var(--secondary)] text-left cursor-pointer"
                      >
                        <div className="h-5 w-5 rounded-full bg-[var(--primary)]/20 text-[var(--primary)] flex items-center justify-center text-[10px] font-bold shrink-0">
                          {m.profile?.full_name?.charAt(0) || 'U'}
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-[var(--foreground)] truncate">
                            {m.profile?.full_name}
                          </p>
                          <p className="text-[10px] text-[var(--muted-foreground)] truncate">
                            {m.role}
                          </p>
                        </div>
                      </button>
                    ))}
                  </div>
                )}

                {/* Post Button */}
                <div className="flex justify-end pt-1">
                  <Button
                    size="sm"
                    onClick={submitComment}
                    disabled={!commentInput.trim() || isSubmittingComment}
                    className="gap-1.5 text-xs h-7"
                  >
                    <Send className="h-3 w-3" />
                    <span>Comment</span>
                  </Button>
                </div>
              </div>

              {/* History Feed Stream */}
              <div className="space-y-3 flex-1 overflow-y-auto">
                <h4 className="font-bold text-[var(--foreground)] text-xs flex items-center gap-1.5">
                  <Activity className="h-3.5 w-3.5 text-[var(--primary)]" />
                  <span>Activity & Comments History</span>
                </h4>

                {unifiedHistory.length === 0 ? (
                  <div className="text-center py-8 text-[var(--muted-foreground)] text-xs border border-dashed border-[var(--border)] rounded-lg">
                    No comments or activity logged on this task yet.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {unifiedHistory.map((item, idx) => {
                      if (item.type === 'comment') {
                        const c = item.data;
                        return (
                          <div
                            key={`c-${c.id}`}
                            className="p-3 rounded-lg border border-[var(--border)] bg-[var(--card)] space-y-1.5 shadow-xs"
                          >
                            <div className="flex items-center justify-between text-[11px]">
                              <div className="flex items-center gap-2">
                                <div className="h-5 w-5 rounded-full bg-[var(--primary)]/20 text-[var(--primary)] flex items-center justify-center font-bold text-[10px]">
                                  {c.author?.full_name?.charAt(0) || 'U'}
                                </div>
                                <span className="font-bold text-[var(--foreground)]">
                                  {c.author?.full_name || 'Team Member'}
                                </span>
                              </div>
                              <span className="text-[10px] text-[var(--muted-foreground)] font-mono">
                                {formatSafeDateTime(c.created_at)}
                              </span>
                            </div>
                            <div className="text-xs text-[var(--foreground)] whitespace-pre-wrap pl-7">
                              {c.content_markdown}
                            </div>
                          </div>
                        );
                      } else {
                        const a = item.data;
                        return (
                          <div
                            key={`a-${a.id || idx}`}
                            className="flex items-start gap-2 text-[11px] text-[var(--muted-foreground)] py-1 pl-2 border-l-2 border-[var(--border)]"
                          >
                            <div className="h-1.5 w-1.5 rounded-full bg-[var(--primary)] mt-1.5 shrink-0" />
                            <div className="flex-1">
                              <span className="font-semibold text-[var(--foreground)]">
                                {a.actor?.full_name || 'System'}{' '}
                              </span>
                              <span>{(a.action_type || 'activity').replace(/_/g, ' ')}</span>
                              {a.metadata && Object.keys(a.metadata).length > 0 && (
                                <span className="text-[10px] font-mono block text-[var(--muted-foreground)]">
                                  {JSON.stringify(a.metadata)}
                                </span>
                              )}
                            </div>
                            <span className="text-[10px] font-mono shrink-0">
                              {formatSafeTime(a.created_at)}
                            </span>
                          </div>
                        );
                      }
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 3: ATTACHMENTS */}
          {activeTab === 'attachments' && (
            <TaskAttachmentsManager
              tenantId={tenantId}
              projectId={projectId}
              taskId={task.id}
              currentUserId={currentUserId}
              canEdit={true}
            />
          )}
        </div>
        </DrawerErrorBoundary>
      </div>

      {/* Cascading Task Deletion Modal */}
      {task && (
        <DeleteTaskModal
          isOpen={isDeleteModalOpen}
          onClose={() => setIsDeleteModalOpen(false)}
          taskId={task.id}
          taskTitle={task.title || 'Untitled Task'}
          taskCode={task.task_code || `TASK-${task.id.slice(0, 6).toUpperCase()}`}
          tenantId={tenantId}
          projectId={projectId}
          onDeleted={() => {
            setIsDeleteModalOpen(false);
            onClose();
            if (onTaskDeleted) onTaskDeleted(task.id);
          }}
        />
      )}
    </div>
  );
}
