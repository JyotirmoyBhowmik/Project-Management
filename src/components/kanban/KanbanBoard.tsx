// ==============================================================================
// src/components/kanban/KanbanBoard.tsx
// Production Kanban Board Engine with Drag-and-Drop, Live Supabase Sync,
// Priority Swimlanes, WIP Limits, and Quick Inline Card Creation
// ==============================================================================

'use client';

import * as React from 'react';
import {
  Flame,
  Calendar,
  ChevronRight,
  ChevronLeft,
  ChevronDown,
  GripVertical,
  AlertTriangle,
  Plus,
  X,
  Layers,
} from 'lucide-react';
import { toast } from 'sonner';
import { Task } from '@/types/database';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useTenantMetadata } from '@/lib/context/tenant-metadata-context';
import { updateTaskStatusAction, createTaskAction } from '@/actions/tasks';

interface KanbanBoardProps {
  tasks: Task[];
  onTaskUpdate: (taskId: string, updates: Partial<Task>) => void;
  onSelectTask?: (task: Task) => void;
  projectId?: string;
  tenantId?: string;
}

export function KanbanBoard({
  tasks,
  onTaskUpdate,
  onSelectTask,
  projectId,
  tenantId,
}: KanbanBoardProps) {
  const { statuses, priorities } = useTenantMetadata();
  const [draggingTaskId, setDraggingTaskId] = React.useState<string | null>(null);
  const [dragOverLaneSlug, setDragOverLaneSlug] = React.useState<string | null>(null);

  // Grouping & Swimlanes state
  const [groupBy, setGroupBy] = React.useState<'none' | 'priority'>('none');
  const [collapsedSwimlanes, setCollapsedSwimlanes] = React.useState<Record<string, boolean>>({});

  // Quick inline card creation state
  const [addingCardLaneSlug, setAddingCardLaneSlug] = React.useState<string | null>(null);
  const [newCardTitle, setNewCardTitle] = React.useState('');
  const [isSubmittingCard, setIsSubmittingCard] = React.useState(false);

  // Target WIP Limit per lane (default 5 for in_progress)
  const wipLimits: Record<string, number> = {
    in_progress: 5,
    in_review: 4,
  };

  // Dynamic lane order derived from database positions
  const lanes = React.useMemo(() => {
    return [...statuses].sort((a, b) => a.position - b.position);
  }, [statuses]);

  const laneOrder = React.useMemo(() => lanes.map((l) => l.slug), [lanes]);

  // Handle status update with optimistic UI and live database synchronization
  const handleStatusChange = async (task: Task, newStatus: string) => {
    if (task.status === newStatus) return;

    const originalStatus = task.status;

    // 1. Optimistically update parent / board state immediately
    onTaskUpdate(task.id, { status: newStatus });

    try {
      // 2. Dispatch Server Action
      const result = await updateTaskStatusAction({
        taskId: task.id,
        status: newStatus,
        projectId: task.project_id,
      });

      if (!result.success) {
        // Revert card back to original column
        onTaskUpdate(task.id, { status: originalStatus });
        toast.error(`Status update rejected: ${result.error || 'Server error'}`);
      } else {
        const laneName = lanes.find((l) => l.slug === newStatus)?.name || newStatus;
        const taskCode = task.code || task.task_code || 'Task';
        toast.success(`${taskCode} moved to ${laneName}`);
      }
    } catch (err: any) {
      onTaskUpdate(task.id, { status: originalStatus });
      toast.error(`Network failure: ${err?.message || 'Could not persist status'}`);
    }
  };

  const moveLane = (task: Task, direction: 'prev' | 'next') => {
    const currentIndex = laneOrder.indexOf(task.status);
    const newIndex = direction === 'next' ? currentIndex + 1 : currentIndex - 1;
    if (newIndex >= 0 && newIndex < laneOrder.length) {
      handleStatusChange(task, laneOrder[newIndex]);
    }
  };

  const handleInlineAdd = async (statusSlug: string) => {
    if (!newCardTitle.trim()) {
      setAddingCardLaneSlug(null);
      return;
    }

    const title = newCardTitle.trim();
    setIsSubmittingCard(true);

    try {
      const projId = projectId || tasks[0]?.project_id;
      const tenId = tenantId || tasks[0]?.tenant_id;
      if (!projId || !tenId) {
        toast.error('Cannot create task: missing project context');
        return;
      }

      const todayIso = new Date().toISOString().split('T')[0];
      const res = await createTaskAction({
        project_id: projId,
        tenant_id: tenId,
        title,
        status: statusSlug as any,
        priority: 'medium',
        start_date: todayIso,
        duration_days: 1,
        is_milestone: false,
      });

      if (res.success && res.data) {
        onTaskUpdate(res.data.id, res.data);
        setNewCardTitle('');
        setAddingCardLaneSlug(null);
        toast.success(`Task "${title}" created`);
      } else {
        toast.error(res.error || 'Failed to create task');
      }
    } catch {
      toast.error('Failed to create task');
    } finally {
      setIsSubmittingCard(false);
    }
  };

  const renderPriorityBadge = (prioritySlug: string) => {
    const p = priorities.find((item) => item.slug === prioritySlug);
    if (!p) {
      return (
        <Badge variant="outline" className="capitalize text-[10px]">
          {prioritySlug}
        </Badge>
      );
    }

    return (
      <span
        className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border"
        style={{
          backgroundColor: `${p.color_hex}15`,
          color: p.color_hex,
          borderColor: `${p.color_hex}40`,
        }}
      >
        {p.name}
      </span>
    );
  };

  // Reusable card renderer
  const renderTaskCard = (task: Task) => {
    const currentIndex = laneOrder.indexOf(task.status);
    const canMovePrev = currentIndex > 0;
    const canMoveNext = currentIndex < laneOrder.length - 1;
    const isBeingDragged = draggingTaskId === task.id;
    const displayCode = task.code || task.task_code;

    return (
      <div
        key={task.id}
        draggable={true}
        onDragStart={(e) => {
          e.dataTransfer.setData('text/plain', task.id);
          e.dataTransfer.effectAllowed = 'move';
          setDraggingTaskId(task.id);
        }}
        onDragEnd={() => {
          setDraggingTaskId(null);
          setDragOverLaneSlug(null);
        }}
        onClick={() => onSelectTask?.(task)}
        className={`group rounded-lg border p-3.5 shadow-xs transition-all bg-[var(--card)] hover:shadow-md cursor-grab active:cursor-grabbing ${
          isBeingDragged
            ? 'opacity-40 border-dashed border-[var(--primary)] ring-2 ring-[var(--primary)]'
            : task.is_critical
            ? 'border-rose-500/50 hover:border-rose-500 ring-1 ring-rose-500/20'
            : 'border-[var(--border)] hover:border-[var(--primary)]'
        }`}
      >
        {/* Top Badges */}
        <div className="flex items-center justify-between gap-1 mb-2">
          <div className="flex items-center gap-1.5 flex-wrap">
            {displayCode && (
              <span className="font-mono text-[10px] font-bold text-[var(--primary)] bg-[var(--primary)]/10 px-1.5 py-0.5 rounded border border-[var(--primary)]/20">
                {displayCode}
              </span>
            )}
            {renderPriorityBadge(task.priority)}
            {task.is_milestone && (
              <Badge
                variant="outline"
                className="text-[9px] py-0 px-1.5 border-purple-500/30 bg-purple-500/10 text-purple-400 font-semibold"
              >
                ◆ Milestone
              </Badge>
            )}
            {task.is_critical && (
              <Badge variant="critical" className="gap-1 text-[10px] py-0 px-1.5">
                <Flame className="h-2.5 w-2.5" />
                CP
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-1 text-[10px] font-mono text-[var(--muted-foreground)]">
            <GripVertical className="h-3.5 w-3.5 opacity-40 group-hover:opacity-100" />
            <span>{task.is_milestone ? '0d' : `${task.duration_days}d`}</span>
          </div>
        </div>

        {/* Title */}
        <h4 className="text-xs font-semibold text-[var(--foreground)] mb-2.5 leading-snug">
          {task.title}
        </h4>

        {/* Date details */}
        <div className="flex items-center justify-between text-[11px] text-[var(--muted-foreground)] pt-2 border-t border-[var(--border)]">
          <div className="flex items-center gap-1">
            <Calendar className="h-3 w-3" />
            <span className="font-mono text-[10px]">{task.end_date}</span>
          </div>

          {/* Lane navigation buttons */}
          <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100 transition-opacity">
            {canMovePrev && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  moveLane(task, 'prev');
                }}
                aria-label="Move task to previous status column"
                className="p-1 rounded hover:bg-[var(--secondary)] text-[var(--muted-foreground)] hover:text-[var(--foreground)] cursor-pointer"
                title="Move back"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
              </button>
            )}
            {canMoveNext && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  moveLane(task, 'next');
                }}
                aria-label="Move task to next status column"
                className="p-1 rounded hover:bg-[var(--secondary)] text-[var(--muted-foreground)] hover:text-[var(--foreground)] cursor-pointer"
                title="Move forward"
              >
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>
    );
  };

  const closedLanesSet = new Set(lanes.filter((l) => l.is_closed_state).map((l) => l.slug));
  const closedTasksCount = tasks.filter((t) => closedLanesSet.has(t.status)).length;
  const criticalTasksCount = tasks.filter((t) => t.is_critical).length;

  return (
    <div className="flex flex-col h-full bg-[var(--background)]">
      {/* Kanban Board Controls & Metrics Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-4 py-2.5 border-b border-[var(--border)] bg-[var(--card)] shrink-0">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-[var(--foreground)]">
            <Layers className="h-4 w-4 text-[var(--primary)]" />
            <span>Workflow Execution</span>
          </div>

          <div className="h-4 w-px bg-[var(--border)]" />

          {/* Group By Selector */}
          <div className="flex items-center gap-1.5 text-xs">
            <span className="text-[var(--muted-foreground)]">View:</span>
            <div className="flex items-center bg-[var(--secondary)]/70 p-0.5 rounded-lg border border-[var(--border)]">
              <button
                type="button"
                onClick={() => setGroupBy('none')}
                className={`px-2 py-1 rounded text-[11px] font-semibold transition-colors ${
                  groupBy === 'none'
                    ? 'bg-[var(--card)] text-[var(--foreground)] shadow-xs'
                    : 'text-[var(--muted-foreground)] hover:text-[var(--foreground)]'
                }`}
              >
                Standard Columns
              </button>
              <button
                type="button"
                onClick={() => setGroupBy('priority')}
                className={`px-2 py-1 rounded text-[11px] font-semibold transition-colors ${
                  groupBy === 'priority'
                    ? 'bg-[var(--card)] text-[var(--foreground)] shadow-xs'
                    : 'text-[var(--muted-foreground)] hover:text-[var(--foreground)]'
                }`}
              >
                Priority Swimlanes
              </button>
            </div>
          </div>
        </div>

        {/* Board Metrics Summary */}
        <div className="flex items-center gap-3 text-[11px] font-mono">
          <span className="text-[var(--muted-foreground)]">
            Total: <strong className="text-[var(--foreground)]">{tasks.length}</strong>
          </span>
          <span className="text-[var(--muted-foreground)]">
            Closed: <strong className="text-emerald-400">{closedTasksCount}</strong>
          </span>
          {criticalTasksCount > 0 && (
            <span className="text-amber-400 font-bold flex items-center gap-1">
              <Flame className="h-3 w-3" />
              {criticalTasksCount} Critical
            </span>
          )}
        </div>
      </div>

      {/* Main Board Content */}
      <div className="flex-1 overflow-auto p-4">
        {groupBy === 'none' ? (
          // Default Flat Columns View
          <div className="flex h-full gap-4 overflow-x-auto">
            {lanes.map((lane) => {
              const laneTasks = tasks.filter((t) => t.status === lane.slug);
              const isDragOver = dragOverLaneSlug === lane.slug;
              const wipLimit = wipLimits[lane.slug];

              return (
                <div
                  key={lane.id}
                  onDragOver={(e) => {
                    e.preventDefault();
                    e.dataTransfer.dropEffect = 'move';
                    if (dragOverLaneSlug !== lane.slug) {
                      setDragOverLaneSlug(lane.slug);
                    }
                  }}
                  onDragLeave={(e) => {
                    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                      setDragOverLaneSlug(null);
                    }
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    setDragOverLaneSlug(null);
                    const droppedTaskId = e.dataTransfer.getData('text/plain') || draggingTaskId;
                    setDraggingTaskId(null);

                    if (!droppedTaskId) return;
                    const task = tasks.find((t) => t.id === droppedTaskId);
                    if (task) {
                      handleStatusChange(task, lane.slug);
                    }
                  }}
                  className={`flex flex-col w-80 shrink-0 rounded-xl border transition-all duration-200 bg-[var(--card)] shadow-xs ${
                    isDragOver
                      ? 'border-[var(--primary)] ring-2 ring-[var(--primary)]/30 bg-[var(--primary)]/5'
                      : 'border-[var(--border)]'
                  }`}
                >
                  {/* Dynamic Lane Header with WIP Alert */}
                  <div className="flex items-center justify-between p-3.5 border-b border-[var(--border)] bg-[var(--secondary)]/40">
                    <div className="flex items-center gap-2">
                      <div
                        className="h-2.5 w-2.5 rounded-full shadow-xs"
                        style={{ backgroundColor: lane.color_hex }}
                      />
                      <h3 className="text-xs font-bold text-[var(--foreground)]">{lane.name}</h3>
                      {lane.is_closed_state && (
                        <span className="text-[9px] uppercase tracking-wider font-semibold px-1.5 py-0.2 bg-emerald-500/10 text-emerald-500 rounded border border-emerald-500/20">
                          Closed
                        </span>
                      )}
                      <span className="text-[11px] font-mono text-[var(--muted-foreground)] bg-[var(--secondary)] px-2 py-0.5 rounded-full border border-[var(--border)]">
                        {laneTasks.length}
                      </span>
                    </div>

                    {/* WIP Limit Indicator */}
                    {wipLimit && laneTasks.length > wipLimit && (
                      <span
                        className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center gap-1 font-bold animate-pulse"
                        title={`WIP Limit exceeded! Target: max ${wipLimit} cards.`}
                      >
                        <AlertTriangle className="h-2.5 w-2.5" />
                        WIP &gt; {wipLimit}
                      </span>
                    )}
                  </div>

                  {/* Lane Task Cards */}
                  <div className="flex-1 overflow-y-auto p-3 space-y-3 min-h-[140px]">
                    {laneTasks.length === 0 ? (
                      <div
                        className={`flex flex-col items-center justify-center h-28 border border-dashed rounded-lg text-xs transition-colors ${
                          isDragOver
                            ? 'border-[var(--primary)] text-[var(--primary)] bg-[var(--primary)]/10 font-semibold'
                            : 'border-[var(--border)] text-[var(--muted-foreground)]'
                        }`}
                      >
                        <span>{isDragOver ? `Drop to move to ${lane.name}` : `No tasks in ${lane.name}`}</span>
                      </div>
                    ) : (
                      laneTasks.map(renderTaskCard)
                    )}
                  </div>

                  {/* Quick Inline Card Creation Footer */}
                  <div className="p-2 border-t border-[var(--border)] bg-[var(--secondary)]/20">
                    {addingCardLaneSlug === lane.slug ? (
                      <div className="space-y-2">
                        <Input
                          autoFocus
                          placeholder="Task title..."
                          value={newCardTitle}
                          onChange={(e) => setNewCardTitle(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              handleInlineAdd(lane.slug);
                            } else if (e.key === 'Escape') {
                              setAddingCardLaneSlug(null);
                              setNewCardTitle('');
                            }
                          }}
                          className="h-7 text-xs bg-[var(--card)]"
                        />
                        <div className="flex items-center justify-end gap-1.5">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              setAddingCardLaneSlug(null);
                              setNewCardTitle('');
                            }}
                            className="h-6 px-2 text-[10px]"
                          >
                            Cancel
                          </Button>
                          <Button
                            size="sm"
                            onClick={() => handleInlineAdd(lane.slug)}
                            disabled={!newCardTitle.trim() || isSubmittingCard}
                            className="h-6 px-2 text-[10px] bg-[var(--primary)] text-[var(--primary-foreground)]"
                          >
                            {isSubmittingCard ? 'Adding...' : 'Add'}
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          setAddingCardLaneSlug(lane.slug);
                          setNewCardTitle('');
                        }}
                        className="w-full flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg text-xs text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--secondary)]/60 transition-colors"
                      >
                        <Plus className="h-3 w-3" />
                        <span>Add card</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          // Priority Swimlanes View
          <div className="space-y-6">
            {priorities.map((priority) => {
              const priorityTasks = tasks.filter((t) => t.priority === priority.slug);
              const isCollapsed = Boolean(collapsedSwimlanes[priority.slug]);

              return (
                <div key={priority.slug} className="space-y-2">
                  {/* Swimlane Header Banner */}
                  <div
                    onClick={() =>
                      setCollapsedSwimlanes((prev) => ({
                        ...prev,
                        [priority.slug]: !prev[priority.slug],
                      }))
                    }
                    className="flex items-center justify-between px-3.5 py-2 rounded-xl bg-[var(--secondary)]/60 border border-[var(--border)] cursor-pointer hover:bg-[var(--secondary)]/90 transition-colors select-none"
                  >
                    <div className="flex items-center gap-2">
                      {isCollapsed ? (
                        <ChevronRight className="h-4 w-4 text-[var(--muted-foreground)]" />
                      ) : (
                        <ChevronDown className="h-4 w-4 text-[var(--muted-foreground)]" />
                      )}
                      <span
                        className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold border"
                        style={{
                          backgroundColor: `${priority.color_hex}15`,
                          color: priority.color_hex,
                          borderColor: `${priority.color_hex}40`,
                        }}
                      >
                        {priority.name} Priority
                      </span>
                      <span className="text-[11px] font-mono text-[var(--muted-foreground)]">
                        ({priorityTasks.length} task{priorityTasks.length !== 1 ? 's' : ''})
                      </span>
                    </div>
                  </div>

                  {/* Swimlane Columns Content */}
                  {!isCollapsed && (
                    <div className="flex gap-4 overflow-x-auto pb-2">
                      {lanes.map((lane) => {
                        const cellTasks = priorityTasks.filter((t) => t.status === lane.slug);
                        const isDragOver = dragOverLaneSlug === `${priority.slug}-${lane.slug}`;

                        return (
                          <div
                            key={`${priority.slug}-${lane.id}`}
                            onDragOver={(e) => {
                              e.preventDefault();
                              e.dataTransfer.dropEffect = 'move';
                              setDragOverLaneSlug(`${priority.slug}-${lane.slug}`);
                            }}
                            onDragLeave={(e) => {
                              if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                                setDragOverLaneSlug(null);
                              }
                            }}
                            onDrop={(e) => {
                              e.preventDefault();
                              setDragOverLaneSlug(null);
                              const droppedTaskId = e.dataTransfer.getData('text/plain') || draggingTaskId;
                              setDraggingTaskId(null);
                              if (!droppedTaskId) return;
                              const task = tasks.find((t) => t.id === droppedTaskId);
                              if (task) {
                                handleStatusChange(task, lane.slug);
                              }
                            }}
                            className={`flex flex-col w-80 shrink-0 rounded-xl border p-2.5 space-y-2 bg-[var(--card)]/90 min-h-[120px] transition-all shadow-2xs ${
                              isDragOver
                                ? 'border-[var(--primary)] ring-2 ring-[var(--primary)]/30 bg-[var(--primary)]/5'
                                : 'border-[var(--border)]'
                            }`}
                          >
                            <div className="flex items-center justify-between text-[10px] font-mono text-[var(--muted-foreground)] px-1 pb-1 border-b border-[var(--border)]/50">
                              <span className="font-semibold text-[var(--foreground)]">{lane.name}</span>
                              <span className="bg-[var(--secondary)] px-1.5 py-0.2 rounded">{cellTasks.length}</span>
                            </div>
                            {cellTasks.length === 0 ? (
                              <div className="flex items-center justify-center h-16 border border-dashed border-[var(--border)]/60 rounded-lg text-[10px] text-[var(--muted-foreground)]">
                                No {priority.name.toLowerCase()} tasks
                              </div>
                            ) : (
                              cellTasks.map(renderTaskCard)
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
