// ==============================================================================
// src/components/grid/HierarchicalGrid.tsx
// Dynamic Hierarchical Grid Table with Custom Fields Projection
// Zero Hardcoded Values: Statuses, priorities, and custom fields fetched dynamically.
// ==============================================================================

'use client';

import * as React from 'react';
import {
  ChevronRight,
  ChevronDown,
  Flame,
  Plus,
  Layers,
} from 'lucide-react';
import { Task } from '@/types/database';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useTenantMetadata } from '@/lib/context/tenant-metadata-context';

interface HierarchicalGridProps {
  tasks: Task[];
  onTaskUpdate: (taskId: string, updates: Partial<Task>) => void;
  onCustomFieldUpdate?: (taskId: string, fieldId: string, value: unknown) => void;
  onSelectTask?: (task: Task) => void;
  onAddSubtask?: (parentId: string, parentTitle: string) => void;
}

export function HierarchicalGrid({
  tasks,
  onTaskUpdate,
  onSelectTask,
  onAddSubtask,
}: HierarchicalGridProps) {
  const { statuses, priorities, customFields } = useTenantMetadata();
  const [expandedMap, setExpandedMap] = React.useState<Record<string, boolean>>({});

  const taskCustomFields = React.useMemo(() => {
    return customFields.filter((cf) => cf.entity_type === 'task');
  }, [customFields]);

  const toggleExpand = (taskId: string) => {
    setExpandedMap((prev) => ({ ...prev, [taskId]: !prev[taskId] }));
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

  // Separate root tasks and index children by parent_id
  const { rootTasks, subtaskMap } = React.useMemo(() => {
    const roots: Task[] = [];
    const children: Record<string, Task[]> = {};
    const taskIds = new Set(tasks.map((t) => t.id));

    tasks.forEach((t) => {
      const pId = t.parent_id || (t as any).parent_task_id;
      if (pId && taskIds.has(pId)) {
        if (!children[pId]) children[pId] = [];
        children[pId].push(t);
      } else {
        roots.push(t);
      }
    });

    return { rootTasks: roots, subtaskMap: children };
  }, [tasks]);

  const renderTaskRow = (
    task: Task,
    displayIndex: string,
    isSubtask: boolean,
    parentTitle?: string
  ) => {
    const isCritical = task.is_critical;
    const subtasks = subtaskMap[task.id] || task.subtasks || [];
    const hasChildren = subtasks.length > 0;
    const isExpanded = expandedMap[task.id] ?? true;
    const progressVal = task.progress ?? task.progress_percent ?? 0;
    const displayCode = task.code || task.task_code;

    return (
      <tr
        key={task.id}
        className={`group hover:bg-[var(--secondary)]/40 transition-colors ${
          isCritical ? 'bg-rose-500/5' : ''
        } ${isSubtask ? 'bg-[var(--secondary)]/15' : ''}`}
      >
        {/* Row Number */}
        <td className="py-3 px-4 text-center font-mono text-[var(--muted-foreground)] text-[11px]">
          {displayIndex}
        </td>

        {/* Title with Nesting Indentation */}
        <td className="py-3 px-4">
          <div className="flex items-center gap-2 flex-wrap">
            {isSubtask && (
              <div className="flex items-center gap-1.5 ml-3 text-[var(--muted-foreground)]">
                <span className="font-mono text-[11px]">↳</span>
                <span className="text-[9px] uppercase font-mono px-1 py-0.2 rounded bg-purple-500/10 text-purple-400 border border-purple-500/20">
                  Subtask
                </span>
              </div>
            )}

            {hasChildren ? (
              <button
                onClick={() => toggleExpand(task.id)}
                className="p-0.5 rounded hover:bg-[var(--secondary)] text-[var(--muted-foreground)] cursor-pointer"
              >
                {isExpanded ? (
                  <ChevronDown className="h-3.5 w-3.5" />
                ) : (
                  <ChevronRight className="h-3.5 w-3.5" />
                )}
              </button>
            ) : !isSubtask ? (
              <div className="w-4" />
            ) : null}

            {displayCode && (
              <span className="font-mono text-[10px] font-bold text-[var(--primary)] bg-[var(--primary)]/10 px-1.5 py-0.5 rounded border border-[var(--primary)]/20 shrink-0">
                {displayCode}
              </span>
            )}

            {task.is_milestone && (
              <span className="inline-flex items-center gap-1 font-semibold text-[10px] px-1.5 py-0.5 rounded bg-purple-500/15 text-purple-400 border border-purple-500/30 shrink-0">
                ◆ Milestone
              </span>
            )}

            <span
              onClick={() => onSelectTask?.(task)}
              className="font-medium text-[var(--foreground)] truncate max-w-sm cursor-pointer hover:text-[var(--primary)] hover:underline transition-colors"
              title="Click to view details & discussion"
            >
              {task.title}
            </span>

            {hasChildren && (
              <span className="text-[10px] font-mono text-[var(--muted-foreground)] bg-[var(--secondary)] px-1.5 py-0.5 rounded border border-[var(--border)]">
                {subtasks.length} subtask{subtasks.length > 1 ? 's' : ''}
              </span>
            )}

            {!isSubtask && onAddSubtask && (
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  onAddSubtask(task.id, task.title);
                }}
                className="h-5 px-1.5 text-[10px] text-[var(--muted-foreground)] hover:text-[var(--foreground)] opacity-0 group-hover:opacity-100 transition-opacity gap-1"
                title="Add subtask to this work item"
              >
                <Plus className="h-2.5 w-2.5" />
                <span>Subtask</span>
              </Button>
            )}
          </div>
        </td>

        {/* Dynamic Status Dropdown */}
        <td className="py-3 px-4">
          <select
            value={task.status}
            onChange={(e) => onTaskUpdate(task.id, { status: e.target.value })}
            className="h-7 px-2 text-[11px] rounded border border-[var(--border)] bg-[var(--card)] text-[var(--foreground)] cursor-pointer"
          >
            {statuses.map((s) => (
              <option key={s.slug} value={s.slug}>
                {s.name}
              </option>
            ))}
          </select>
        </td>

        {/* Dynamic Priority Badge */}
        <td className="py-3 px-4">
          {renderPriorityBadge(task.priority)}
        </td>

        {/* Dates */}
        <td className="py-3 px-4 font-mono text-[11px] text-[var(--muted-foreground)]">
          {task.start_date}
        </td>
        <td className="py-3 px-4 font-mono text-[11px] text-[var(--muted-foreground)]">
          {task.end_date}
        </td>

        {/* Duration */}
        <td className="py-3 px-4 text-center font-mono font-semibold">
          {task.duration_days}d
        </td>

        {/* Float */}
        <td className="py-3 px-4 text-center font-mono">
          <span
            className={
              task.total_float <= 0
                ? 'text-rose-500 font-bold'
                : 'text-[var(--muted-foreground)]'
            }
          >
            {task.total_float}
          </span>
        </td>

        {/* Progress Slider */}
        <td className="py-3 px-4">
          <div className="flex items-center gap-2">
            <input
              type="range"
              min={0}
              max={100}
              value={progressVal}
              onChange={(e) => {
                const val = parseInt(e.target.value, 10);
                onTaskUpdate(task.id, { progress: val, progress_percent: val });
              }}
              className="w-20 h-1.5 bg-[var(--secondary)] rounded-lg appearance-none cursor-pointer accent-[var(--primary)]"
            />
            <span className="font-mono text-[11px] text-[var(--muted-foreground)] w-8">
              {progressVal}%
            </span>
          </div>
        </td>

        {/* Dynamically Projected Custom Field Values */}
        {taskCustomFields.map((cf) => {
          const val = task.custom_field_values?.[cf.field_key];
          return (
            <td key={cf.id} className="py-3 px-4 text-[11px]">
              {cf.field_type === 'checkbox' ? (
                <input
                  type="checkbox"
                  checked={Boolean(val)}
                  readOnly
                  className="rounded border-[var(--border)] text-[var(--primary)] pointer-events-none"
                />
              ) : val !== undefined && val !== null ? (
                <span className="font-mono">{String(val)}</span>
              ) : (
                <span className="text-[var(--muted-foreground)] italic">-</span>
              )}
            </td>
          );
        })}

        {/* Critical Path Indicator */}
        <td className="py-3 px-4 text-center">
          {isCritical ? (
            <Badge variant="critical" className="gap-1 text-[10px] py-0 px-2 inline-flex">
              <Flame className="h-3 w-3" />
              Critical
            </Badge>
          ) : (
            <span className="text-[var(--muted-foreground)] font-mono text-[11px]">
              No
            </span>
          )}
        </td>
      </tr>
    );
  };

  return (
    <div className="flex flex-col h-full bg-[var(--card)] border border-[var(--border)] rounded-xl overflow-hidden shadow-xs">
      <div className="overflow-x-auto overflow-y-auto">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="border-b border-[var(--border)] bg-[var(--secondary)]/60 text-[var(--muted-foreground)] font-semibold">
              <th className="py-3 px-4 w-12 text-center">#</th>
              <th className="py-3 px-4 min-w-[280px]">Task Name / Hierarchy</th>
              <th className="py-3 px-4 min-w-[130px]">Status</th>
              <th className="py-3 px-4 min-w-[100px]">Priority</th>
              <th className="py-3 px-4 min-w-[100px] font-mono">Start Date</th>
              <th className="py-3 px-4 min-w-[100px] font-mono">End Date</th>
              <th className="py-3 px-4 text-center font-mono">Days</th>
              <th className="py-3 px-4 text-center font-mono">Float</th>
              <th className="py-3 px-4 min-w-[140px]">Progress</th>
              {/* Dynamically Projected Custom Field Headers */}
              {taskCustomFields.map((cf) => (
                <th key={cf.id} className="py-3 px-4 min-w-[120px] font-semibold">
                  {cf.field_name}
                </th>
              ))}
              <th className="py-3 px-4 text-center">Critical Path</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border)]">
            {rootTasks.length === 0 ? (
              <tr>
                <td
                  colSpan={10 + taskCustomFields.length}
                  className="py-12 text-center text-xs text-[var(--muted-foreground)]"
                >
                  No tasks found in this project. Click &ldquo;+ Add Task&rdquo; to create your first work item.
                </td>
              </tr>
            ) : (
              rootTasks.map((task, rootIndex) => {
                const subtasks = subtaskMap[task.id] || task.subtasks || [];
                const hasChildren = subtasks.length > 0;
                const isExpanded = expandedMap[task.id] ?? true;

                return (
                  <React.Fragment key={task.id}>
                    {renderTaskRow(task, `${rootIndex + 1}`, false)}
                    {hasChildren &&
                      isExpanded &&
                      subtasks.map((subtask, subIndex) =>
                        renderTaskRow(
                          subtask,
                          `${rootIndex + 1}.${subIndex + 1}`,
                          true,
                          task.title
                        )
                      )}
                  </React.Fragment>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
