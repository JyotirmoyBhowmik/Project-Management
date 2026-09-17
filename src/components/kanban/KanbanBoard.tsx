'use client';

import * as React from 'react';
import {
  MoreHorizontal,
  Flame,
  Clock,
  Calendar,
  ChevronRight,
  ChevronLeft,
  CheckCircle2,
  AlertCircle,
  Plus,
} from 'lucide-react';
import { Task, TaskStatus } from '@/types/database';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

interface KanbanBoardProps {
  tasks: Task[];
  onTaskUpdate: (taskId: string, updates: Partial<Task>) => void;
}

const LANES: { id: TaskStatus; label: string; color: string }[] = [
  { id: 'backlog', label: 'Backlog', color: '#64748b' },
  { id: 'todo', label: 'To Do', color: '#3b82f6' },
  { id: 'in_progress', label: 'In Progress', color: '#f59e0b' },
  { id: 'review', label: 'In Review', color: '#8b5cf6' },
  { id: 'completed', label: 'Completed', color: '#10b981' },
];

export function KanbanBoard({ tasks, onTaskUpdate }: KanbanBoardProps) {
  const laneOrder: TaskStatus[] = ['backlog', 'todo', 'in_progress', 'review', 'completed'];

  const moveLane = (task: Task, direction: 'prev' | 'next') => {
    const currentIndex = laneOrder.indexOf(task.status);
    const newIndex = direction === 'next' ? currentIndex + 1 : currentIndex - 1;
    if (newIndex >= 0 && newIndex < laneOrder.length) {
      onTaskUpdate(task.id, { status: laneOrder[newIndex] });
    }
  };

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case 'urgent':
        return <Badge variant="critical">Urgent</Badge>;
      case 'high':
        return <Badge variant="warning">High</Badge>;
      case 'medium':
        return <Badge variant="secondary">Medium</Badge>;
      default:
        return <Badge variant="outline">Low</Badge>;
    }
  };

  return (
    <div className="flex h-full gap-4 overflow-x-auto p-4 bg-[var(--background)]">
      {LANES.map((lane) => {
        const laneTasks = tasks.filter((t) => t.status === lane.id);

        return (
          <div
            key={lane.id}
            className="flex flex-col w-80 shrink-0 rounded-xl border border-[var(--border)] bg-[var(--card)] shadow-xs"
          >
            {/* Lane Header */}
            <div className="flex items-center justify-between p-3.5 border-b border-[var(--border)] bg-[var(--secondary)]/40">
              <div className="flex items-center gap-2">
                <div
                  className="h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: lane.color }}
                />
                <h3 className="text-xs font-bold text-[var(--foreground)]">{lane.label}</h3>
                <span className="text-[11px] font-mono text-[var(--muted-foreground)] bg-[var(--secondary)] px-2 py-0.5 rounded-full border border-[var(--border)]">
                  {laneTasks.length}
                </span>
              </div>
            </div>

            {/* Lane Task Cards */}
            <div className="flex-1 overflow-y-auto p-3 space-y-3">
              {laneTasks.length === 0 ? (
                <div className="flex items-center justify-center h-28 border border-dashed border-[var(--border)] rounded-lg text-xs text-[var(--muted-foreground)]">
                  No tasks in this lane
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
                          {getPriorityBadge(task.priority)}
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
