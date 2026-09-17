'use client';

import * as React from 'react';
import {
  ChevronRight,
  ChevronDown,
  Flame,
  CheckCircle2,
  AlertCircle,
  Clock,
  Sparkles,
} from 'lucide-react';
import { Task, TaskStatus } from '@/types/database';
import { Badge } from '@/components/ui/badge';

interface HierarchicalGridProps {
  tasks: Task[];
  onTaskUpdate: (taskId: string, updates: Partial<Task>) => void;
}

export function HierarchicalGrid({ tasks, onTaskUpdate }: HierarchicalGridProps) {
  const [expandedMap, setExpandedMap] = React.useState<Record<string, boolean>>({});

  const toggleExpand = (taskId: string) => {
    setExpandedMap(prev => ({ ...prev, [taskId]: !prev[taskId] }));
  };

  return (
    <div className="flex flex-col h-full bg-[var(--card)] border border-[var(--border)] rounded-xl overflow-hidden shadow-xs">
      <div className="overflow-x-auto overflow-y-auto">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="border-b border-[var(--border)] bg-[var(--secondary)]/60 text-[var(--muted-foreground)] font-semibold">
              <th className="py-3 px-4 w-12 text-center">#</th>
              <th className="py-3 px-4 min-w-[280px]">Task Name / Hierarchy</th>
              <th className="py-3 px-4 min-w-[120px]">Status</th>
              <th className="py-3 px-4 min-w-[90px]">Priority</th>
              <th className="py-3 px-4 min-w-[100px] font-mono">Start Date</th>
              <th className="py-3 px-4 min-w-[100px] font-mono">End Date</th>
              <th className="py-3 px-4 text-center font-mono">Days</th>
              <th className="py-3 px-4 text-center font-mono">Float</th>
              <th className="py-3 px-4 min-w-[140px]">Progress</th>
              <th className="py-3 px-4 text-center">Critical Path</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border)]">
            {tasks.map((task, index) => {
              const isCritical = task.is_critical;
              const hasChildren = (task.subtasks && task.subtasks.length > 0) || false;
              const isExpanded = expandedMap[task.id] ?? true;

              return (
                <tr
                  key={task.id}
                  className={`hover:bg-[var(--secondary)]/40 transition-colors ${
                    isCritical ? 'bg-rose-500/5' : ''
                  }`}
                >
                  {/* Row Number */}
                  <td className="py-3 px-4 text-center font-mono text-[var(--muted-foreground)]">
                    {index + 1}
                  </td>

                  {/* Title with Nesting Indentation */}
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-2">
                      {task.parent_id && <div className="w-4 h-px bg-[var(--border)] ml-2" />}
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
                      ) : (
                        <div className="w-4" />
                      )}
                      <span className="font-medium text-[var(--foreground)] truncate max-w-sm">
                        {task.title}
                      </span>
                    </div>
                  </td>

                  {/* Status Dropdown */}
                  <td className="py-3 px-4">
                    <select
                      value={task.status}
                      onChange={(e) => onTaskUpdate(task.id, { status: e.target.value as TaskStatus })}
                      className="h-7 px-2 text-[11px] rounded border border-[var(--border)] bg-[var(--card)] text-[var(--foreground)]"
                    >
                      <option value="backlog">Backlog</option>
                      <option value="todo">To Do</option>
                      <option value="in_progress">In Progress</option>
                      <option value="review">Review</option>
                      <option value="completed">Completed</option>
                    </select>
                  </td>

                  {/* Priority */}
                  <td className="py-3 px-4 capitalize">
                    <Badge variant={task.priority === 'urgent' ? 'critical' : task.priority === 'high' ? 'warning' : 'secondary'}>
                      {task.priority}
                    </Badge>
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
                    {task.duration_days}
                  </td>

                  {/* Float */}
                  <td className="py-3 px-4 text-center font-mono">
                    <span className={task.total_float === 0 ? 'text-rose-500 font-bold' : 'text-[var(--muted-foreground)]'}>
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
                        value={task.progress_percent}
                        onChange={(e) =>
                          onTaskUpdate(task.id, { progress_percent: parseInt(e.target.value, 10) })
                        }
                        className="w-20 accent-[var(--primary)] cursor-pointer"
                      />
                      <span className="font-mono text-[10px] w-8">{task.progress_percent}%</span>
                    </div>
                  </td>

                  {/* Critical Path Flag */}
                  <td className="py-3 px-4 text-center">
                    {isCritical ? (
                      <Badge variant="critical" className="gap-1 text-[10px] py-0 px-2">
                        <Flame className="h-3 w-3" />
                        Critical
                      </Badge>
                    ) : (
                      <span className="text-[var(--muted-foreground)] text-[11px]">Normal</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
