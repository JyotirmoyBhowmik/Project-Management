// ==============================================================================
// src/components/grid/HierarchicalGrid.tsx
// Dynamic Hierarchical Grid Table with Work Breakdown Structure (WBS) Indexing,
// Real-Time Search, Expand/Collapse All, and Custom Fields Projection.
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
  Search,
  ChevronsUpDown,
  X,
  Sparkles,
  GitFork,
} from 'lucide-react';
import { Task } from '@/types/database';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useTenantMetadata } from '@/lib/context/tenant-metadata-context';

interface HierarchicalGridProps {
  tasks: Task[];
  onTaskUpdate: (taskId: string, updates: Partial<Task>) => void;
  onCustomFieldUpdate?: (taskId: string, fieldId: string, value: unknown) => void;
  onSelectTask?: (task: Task) => void;
  onAddSubtask?: (parentId: string, parentTitle: string) => void;
}

interface WbsTaskNode {
  task: Task;
  wbsCode: string;
  depth: number;
  children: WbsTaskNode[];
  rollup?: {
    earliestStart: string;
    latestEnd: string;
    durationDays: number;
    averageProgress: number;
    subtaskCount: number;
  };
}

export function HierarchicalGrid({
  tasks,
  onTaskUpdate,
  onCustomFieldUpdate,
  onSelectTask,
  onAddSubtask,
}: HierarchicalGridProps) {
  const { statuses, priorities, customFields } = useTenantMetadata();
  const [expandedMap, setExpandedMap] = React.useState<Record<string, boolean>>({});
  const [searchQuery, setSearchQuery] = React.useState('');

  const taskCustomFields = React.useMemo(() => {
    return customFields.filter((cf) => cf.entity_type === 'task');
  }, [customFields]);

  // Build recursive WBS Hierarchy
  const { rootNodes, allParentIds } = React.useMemo(() => {
    const parentMap: Record<string, Task[]> = {};
    const taskMap = new Map<string, Task>();
    const parents = new Set<string>();

    tasks.forEach((t) => {
      taskMap.set(t.id, t);
      const pId = t.parent_id || (t as any).parent_task_id;
      if (pId) {
        if (!parentMap[pId]) parentMap[pId] = [];
        parentMap[pId].push(t);
        parents.add(pId);
      }
    });

    function buildNodes(taskList: Task[], prefix: string, depth: number): WbsTaskNode[] {
      return taskList.map((t, idx) => {
        const wbsCode = prefix ? `${prefix}.${idx + 1}` : `${idx + 1}.0`;
        const childrenTasks = parentMap[t.id] || t.subtasks || [];
        const childNodes = buildNodes(childrenTasks, prefix ? `${prefix}.${idx + 1}` : `${idx + 1}`, depth + 1);

        let rollup: WbsTaskNode['rollup'] | undefined = undefined;
        if (childNodes.length > 0) {
          const allDescendants: Task[] = [];
          function collectDescendants(nodes: WbsTaskNode[]) {
            nodes.forEach((n) => {
              allDescendants.push(n.task);
              if (n.children && n.children.length > 0) collectDescendants(n.children);
            });
          }
          collectDescendants(childNodes);

          const starts = allDescendants.map((d) => d.start_date).filter(Boolean);
          const ends = allDescendants.map((d) => d.end_date).filter(Boolean);
          const progresses = allDescendants.map((d) => d.progress ?? (d as any).progress_percent ?? 0);

          starts.sort();
          ends.sort();

          const earliestStart = starts[0] || t.start_date;
          const latestEnd = ends[ends.length - 1] || t.end_date;
          const avgProgress = progresses.length > 0
            ? Math.round(progresses.reduce((a, b) => a + b, 0) / progresses.length)
            : (t.progress ?? 0);

          let durationDays = t.duration_days;
          if (earliestStart && latestEnd) {
            const s = new Date(earliestStart).getTime();
            const e = new Date(latestEnd).getTime();
            const diff = Math.round((e - s) / (1000 * 60 * 60 * 24));
            durationDays = Math.max(1, diff + 1);
          }

          rollup = {
            earliestStart,
            latestEnd,
            durationDays,
            averageProgress: avgProgress,
            subtaskCount: allDescendants.length,
          };
        }

        return {
          task: t,
          wbsCode,
          depth,
          children: childNodes,
          rollup,
        };
      });
    }

    // Top-level root tasks (tasks with no valid parent in the list)
    const roots = tasks.filter((t) => {
      const pId = t.parent_id || (t as any).parent_task_id;
      return !pId || !taskMap.has(pId);
    });

    return {
      rootNodes: buildNodes(roots, '', 0),
      allParentIds: Array.from(parents),
    };
  }, [tasks]);

  // Auto-expand all parents by default on initial load
  React.useEffect(() => {
    if (allParentIds.length > 0) {
      setExpandedMap((prev) => {
        const next = { ...prev };
        allParentIds.forEach((id) => {
          if (next[id] === undefined) next[id] = true;
        });
        return next;
      });
    }
  }, [allParentIds]);

  const toggleExpand = (taskId: string) => {
    setExpandedMap((prev) => ({ ...prev, [taskId]: !prev[taskId] }));
  };

  const handleExpandAll = () => {
    const next: Record<string, boolean> = {};
    allParentIds.forEach((id) => {
      next[id] = true;
    });
    setExpandedMap(next);
  };

  const handleCollapseAll = () => {
    const next: Record<string, boolean> = {};
    allParentIds.forEach((id) => {
      next[id] = false;
    });
    setExpandedMap(next);
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

  // Filter nodes according to search query, preserving parent branches
  const { filteredNodes, matchingTaskIds } = React.useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const matched = new Set<string>();

    if (!q) {
      return { filteredNodes: rootNodes, matchingTaskIds: matched };
    }

    function matchTask(t: Task): boolean {
      const titleMatch = (t.title || '').toLowerCase().includes(q);
      const codeMatch = (t.code || t.task_code || '').toLowerCase().includes(q);
      const statusMatch = (t.status || '').toLowerCase().includes(q);
      const priorityMatch = (t.priority || '').toLowerCase().includes(q);
      return titleMatch || codeMatch || statusMatch || priorityMatch;
    }

    function filterNodeList(nodes: WbsTaskNode[]): WbsTaskNode[] {
      const result: WbsTaskNode[] = [];

      for (const node of nodes) {
        const isSelfMatch = matchTask(node.task);
        const filteredChildren = filterNodeList(node.children);

        if (isSelfMatch || filteredChildren.length > 0) {
          if (isSelfMatch) matched.add(node.task.id);
          result.push({
            ...node,
            children: filteredChildren,
          });
        }
      }

      return result;
    }

    return {
      filteredNodes: filterNodeList(rootNodes),
      matchingTaskIds: matched,
    };
  }, [rootNodes, searchQuery]);

  // If searching, auto-expand parents of matching tasks
  React.useEffect(() => {
    if (searchQuery.trim() && matchingTaskIds.size > 0) {
      const next = { ...expandedMap };
      allParentIds.forEach((id) => {
        next[id] = true;
      });
      setExpandedMap(next);
    }
  }, [searchQuery, matchingTaskIds, allParentIds]);

  // Project statistics for toolbar summary
  const totalTasksCount = tasks.length;
  const milestonesCount = tasks.filter((t) => t.is_milestone || t.duration_days === 0).length;
  const criticalTasksCount = tasks.filter((t) => t.is_critical).length;

  /**
   * Render single Task row in the grid table with WBS code and hierarchy
   */
  const renderTaskRow = (node: WbsTaskNode, isChild: boolean) => {
    const { task, wbsCode, depth, children } = node;
    const isCritical = task.is_critical;
    const hasChildren = children.length > 0;
    const isExpanded = expandedMap[task.id] ?? true;
    const progressVal = task.progress ?? task.progress_percent ?? 0;
    const displayCode = task.code || task.task_code;
    const isSearchMatch = searchQuery.trim() && matchingTaskIds.has(task.id);

    return (
      <React.Fragment key={task.id}>
        <tr
          className={`group hover:bg-[var(--secondary)]/40 transition-colors ${
            isSearchMatch ? 'bg-[var(--primary)]/10 font-medium' : ''
          } ${isCritical ? 'bg-rose-500/5' : ''} ${isChild ? 'bg-[var(--secondary)]/15' : ''}`}
        >
          {/* WBS Code Column */}
          <td className="py-2.5 px-3 text-center">
            <span className="font-mono text-[11px] font-bold px-1.5 py-0.5 rounded bg-[var(--secondary)] text-[var(--foreground)] border border-[var(--border)]">
              {wbsCode}
            </span>
          </td>

          {/* Title with Nesting Indentation & Tree Connectors */}
          <td className="py-2.5 px-3">
            <div
              className="flex items-center gap-1.5 flex-wrap"
              style={{ paddingLeft: depth > 0 ? `${depth * 20}px` : undefined }}
            >
              {depth > 0 && (
                <span className="text-[var(--muted-foreground)] font-mono text-xs select-none">
                  ↳
                </span>
              )}

              {hasChildren ? (
                <button
                  type="button"
                  onClick={() => toggleExpand(task.id)}
                  className="p-0.5 rounded hover:bg-[var(--secondary)] text-[var(--muted-foreground)] cursor-pointer"
                  title={isExpanded ? 'Collapse subtasks' : 'Expand subtasks'}
                >
                  {isExpanded ? (
                    <ChevronDown className="h-3.5 w-3.5" />
                  ) : (
                    <ChevronRight className="h-3.5 w-3.5" />
                  )}
                </button>
              ) : depth === 0 ? (
                <div className="w-4 shrink-0" />
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
                <span className="text-[9px] font-mono text-[var(--muted-foreground)] bg-[var(--secondary)] px-1 py-0.2 rounded border border-[var(--border)]">
                  {children.length} subtask{children.length > 1 ? 's' : ''}
                </span>
              )}

              {node.rollup && (
                <span
                  className="inline-flex items-center gap-0.5 text-[9px] font-bold text-purple-400 bg-purple-500/10 px-1.5 py-0.5 rounded border border-purple-500/20 shrink-0"
                  title={`Rolled up from ${node.rollup.subtaskCount} subtasks: ${node.rollup.earliestStart} to ${node.rollup.latestEnd} (${node.rollup.durationDays}d span, avg progress: ${node.rollup.averageProgress}%)`}
                >
                  Σ Rollup
                </span>
              )}

              {onAddSubtask && (
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
          <td className="py-2.5 px-3">
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
          <td className="py-2.5 px-3">
            {renderPriorityBadge(task.priority)}
          </td>

          {/* Dates */}
          <td className="py-2.5 px-3 font-mono text-[11px] text-[var(--muted-foreground)]">
            <div className="flex flex-col">
              <span>{task.start_date || '-'}</span>
              {node.rollup && node.rollup.earliestStart !== task.start_date && (
                <span className="text-[9px] text-purple-400 font-mono" title="Rolled up earliest start date">
                  Σ {node.rollup.earliestStart}
                </span>
              )}
            </div>
          </td>
          <td className="py-2.5 px-3 font-mono text-[11px] text-[var(--muted-foreground)]">
            <div className="flex flex-col">
              <span>{task.end_date || '-'}</span>
              {node.rollup && node.rollup.latestEnd !== task.end_date && (
                <span className="text-[9px] text-purple-400 font-mono" title="Rolled up latest finish date">
                  Σ {node.rollup.latestEnd}
                </span>
              )}
            </div>
          </td>

          {/* Duration */}
          <td className="py-2.5 px-3 text-center font-mono font-semibold">
            <div className="flex flex-col items-center">
              <span>{task.duration_days}d</span>
              {node.rollup && (
                <span className="text-[9px] text-purple-400 font-mono font-normal" title="Total schedule span of subtasks">
                  Σ {node.rollup.durationDays}d
                </span>
              )}
            </div>
          </td>

          {/* Total Float */}
          <td className="py-2.5 px-3 text-center font-mono">
            <span
              className={
                task.total_float <= 0
                  ? 'text-rose-500 font-bold'
                  : 'text-[var(--muted-foreground)]'
              }
            >
              {task.total_float ?? 0}
            </span>
          </td>

          {/* Progress Slider */}
          <td className="py-2.5 px-3">
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
              <div className="flex flex-col">
                <span className="font-mono text-[11px] text-[var(--muted-foreground)] w-8">
                  {progressVal}%
                </span>
                {node.rollup && (
                  <span className="text-[9px] font-mono text-purple-400 font-bold" title="Average subtask completion">
                    Σ {node.rollup.averageProgress}%
                  </span>
                )}
              </div>
            </div>
          </td>

          {/* Dynamically Projected Custom Field Values */}
          {taskCustomFields.map((cf) => {
            const val = task.custom_field_values?.[cf.field_key];
            return (
              <td key={cf.id} className="py-2.5 px-3 text-[11px]">
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
          <td className="py-2.5 px-3 text-center">
            {isCritical ? (
              <Badge variant="critical" className="gap-1 text-[10px] py-0 px-1.5 inline-flex">
                <Flame className="h-3 w-3" />
                Critical
              </Badge>
            ) : (
              <span className="text-[var(--muted-foreground)] font-mono text-[11px]">
                -
              </span>
            )}
          </td>
        </tr>

        {/* Recursive Children Rows if Expanded */}
        {hasChildren &&
          isExpanded &&
          children.map((childNode) => renderTaskRow(childNode, true))}
      </React.Fragment>
    );
  };

  return (
    <div className="flex flex-col h-full bg-[var(--card)] border border-[var(--border)] rounded-xl overflow-hidden shadow-xs">
      {/* 1. Grid Toolbar Controls */}
      <div className="p-3 border-b border-[var(--border)] bg-[var(--secondary)]/30 flex flex-wrap items-center justify-between gap-3">
        {/* Left: Search input & Expand/Collapse All */}
        <div className="flex items-center gap-2 flex-1 max-w-md">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[var(--muted-foreground)] pointer-events-none" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search tasks, WBS, code, status..."
              className="h-8 text-xs pl-8 pr-7 bg-[var(--card)] border-[var(--border)] focus-visible:ring-1"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-1 border-l border-[var(--border)] pl-2">
            <Button
              size="sm"
              variant="outline"
              onClick={handleExpandAll}
              className="h-8 text-xs gap-1 px-2.5"
              title="Expand all hierarchical subtasks"
            >
              <ChevronsUpDown className="h-3.5 w-3.5" />
              <span>Expand All</span>
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={handleCollapseAll}
              className="h-8 text-xs px-2.5 text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
              title="Collapse all subtasks"
            >
              Collapse All
            </Button>
          </div>
        </div>

        {/* Right: Metrics Badges */}
        <div className="flex items-center gap-2 text-xs">
          <Badge variant="outline" className="gap-1.5 py-1 px-2.5 font-medium">
            <Layers className="h-3.5 w-3.5 text-[var(--primary)]" />
            <span>Tasks:</span>
            <span className="font-mono font-bold">{totalTasksCount}</span>
          </Badge>

          {milestonesCount > 0 && (
            <Badge variant="outline" className="gap-1.5 py-1 px-2.5 bg-purple-500/10 text-purple-400 border-purple-500/20 font-medium">
              <span>◆ Milestones:</span>
              <span className="font-mono font-bold">{milestonesCount}</span>
            </Badge>
          )}

          {criticalTasksCount > 0 && (
            <Badge variant="outline" className="gap-1.5 py-1 px-2.5 bg-rose-500/10 text-rose-400 border-rose-500/20 font-medium">
              <Flame className="h-3.5 w-3.5 text-rose-500" />
              <span>Critical:</span>
              <span className="font-mono font-bold">{criticalTasksCount}</span>
            </Badge>
          )}
        </div>
      </div>

      {/* 2. Hierarchical Grid Table */}
      <div className="flex-1 overflow-x-auto overflow-y-auto">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="border-b border-[var(--border)] bg-[var(--secondary)]/60 text-[var(--muted-foreground)] font-semibold sticky top-0 z-10 backdrop-blur-xs">
              <th className="py-2.5 px-3 w-16 text-center">WBS</th>
              <th className="py-2.5 px-3 min-w-[280px]">Task Name / WBS Hierarchy</th>
              <th className="py-2.5 px-3 min-w-[130px]">Status</th>
              <th className="py-2.5 px-3 min-w-[100px]">Priority</th>
              <th className="py-2.5 px-3 min-w-[95px] font-mono">Start Date</th>
              <th className="py-2.5 px-3 min-w-[95px] font-mono">End Date</th>
              <th className="py-2.5 px-3 text-center font-mono">Days</th>
              <th className="py-2.5 px-3 text-center font-mono">Float</th>
              <th className="py-2.5 px-3 min-w-[140px]">Progress</th>
              {/* Dynamically Projected Custom Field Headers */}
              {taskCustomFields.map((cf) => (
                <th key={cf.id} className="py-2.5 px-3 min-w-[120px] font-semibold">
                  {cf.field_name}
                </th>
              ))}
              <th className="py-2.5 px-3 text-center">Critical Path</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border)]">
            {filteredNodes.length === 0 ? (
              <tr>
                <td
                  colSpan={10 + taskCustomFields.length}
                  className="py-12 text-center text-xs text-[var(--muted-foreground)]"
                >
                  {searchQuery ? (
                    <div className="flex flex-col items-center gap-1.5">
                      <span>No tasks match &ldquo;{searchQuery}&rdquo;</span>
                      <Button
                        size="sm"
                        variant="link"
                        onClick={() => setSearchQuery('')}
                        className="text-xs h-auto p-0"
                      >
                        Clear search filter
                      </Button>
                    </div>
                  ) : (
                    'No tasks found in this project. Click "+ Add Task" to create your first work item.'
                  )}
                </td>
              </tr>
            ) : (
              filteredNodes.map((rootNode) => renderTaskRow(rootNode, false))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
