// ==============================================================================
// src/components/kanban/KanbanBoard.tsx
// Dynamic Kanban Board Engine (Zero Hardcoded Values Mandate)
// Workflow statuses and priority levels are fetched dynamically from the database.
// ==============================================================================

'use client';

import * as React from 'react';
import {
  Flame,
  Calendar,
  ChevronRight,
  ChevronLeft,
} from 'lucide-react';
import { Task } from '@/types/database';
import { Badge } from '@/components/ui/badge';
import { useTenantMetadata } from '@/lib/context/tenant-metadata-context';

interface KanbanBoardProps {
  tasks: Task[];
  onTaskUpdate: (taskId: string, updates: Partial<Task>) => void;
}

export function KanbanBoard({ tasks, onTaskUpdate }: KanbanBoardProps) {
  const { statuses, priorities } = useTenantMetadata();

  // Dynamic lane order derived from database positions
  const lanes = React.useMemo(() => {
    return [...statuses].sort((a, b) => a.position - b.position);
  }, [statuses]);

  const laneOrder = React.useMemo(() => lanes.map((l) => l.slug), [lanes]);

  const moveLane = (task: Task, direction: 'prev' | 'next') => {
    const currentIndex = laneOrder.indexOf(task.status);
    const newIndex = direction === 'next' ? currentIndex + 1 : currentIndex - 1;
    if (newIndex >= 0 && newIndex < laneOrder.length) {
      onTaskUpdate(task.id, { status: laneOrder[newIndex] });
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

  return (
    <div className="flex h-full gap-4 overflow-x-auto p-4 bg-[var(--background)]">
      {lanes.map((lane) => {
        const laneTasks = tasks.filter((t) => t.status === lane.slug);

        return (
          <div
            key={lane.id}
            className="flex flex-col w-80 shrink-0 rounded-xl border border-[var(--border)] bg-[var(--card)] shadow-xs"
          >
            {/* Dynamic Lane Header */}
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
            </div>

            {/* Lane Task Cards */}
            <div className="flex-1 overflow-y-auto p-3 space-y-3">
              {laneTasks.length === 0 ? (
                <div className="flex items-center justify-center h-28 border border-dashed border-[var(--border)] rounded-lg text-xs text-[var(--muted-foreground)]">
                  No tasks in {lane.name}
                </div>
              ) : (
                laneTasks.map((task) => {
                  const currentIndex = laneOrder.indexOf(task.status);
                  const canMovePrev = currentIndex > 0;
                  const canMoveNext = currentIndex < laneOrder.length - 1;

                  return (
                    <div
                      key={task.id}
                      className={`group rounded-lg border p-3.5 shadow-xs transition-all bg-[var(--card)] hover:shadow-md ${
                        task.is_critical
                          ? 'border-rose-500/50 hover:border-rose-500 ring-1 ring-rose-500/20'
                          : 'border-[var(--border)] hover:border-[var(--primary)]'
                      }`}
                    >
                      {/* Top Badges */}
                      <div className="flex items-center justify-between gap-1 mb-2">
                        <div className="flex items-center gap-1.5">
                          {renderPriorityBadge(task.priority)}
                          {task.is_critical && (
                            <Badge variant="critical" className="gap-1 text-[10px] py-0 px-1.5">
                              <Flame className="h-2.5 w-2.5" />
                              CP
                            </Badge>
                          )}
                        </div>
                        <span className="text-[10px] font-mono text-[var(--muted-foreground)]">
                          {task.duration_days}d
                        </span>
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
                              onClick={() => moveLane(task, 'prev')}
                              className="p-1 rounded hover:bg-[var(--secondary)] text-[var(--muted-foreground)] hover:text-[var(--foreground)] cursor-pointer"
                              title="Move back"
                            >
                              <ChevronLeft className="h-3.5 w-3.5" />
                            </button>
                          )}
                          {canMoveNext && (
                            <button
                              onClick={() => moveLane(task, 'next')}
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
                })
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
