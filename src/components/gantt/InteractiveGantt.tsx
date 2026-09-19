'use client';

import * as React from 'react';
import {
  ZoomIn,
  ZoomOut,
  Flame,
  Calendar as CalendarIcon,
  Plus,
  RefreshCw,
  Download,
  Upload,
  Link2,
  AlertCircle,
  Clock,
  ChevronDown,
  ChevronRight,
  Sparkles,
  AlertTriangle,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import { updateTaskScheduleAction } from '@/actions/tasks';
import { Task, TaskDependency, WorkingCalendar, CalendarHoliday, TaskBaselineSnapshot } from '@/types/database';
import { useGanttStore, GanttZoomLevel } from '@/lib/stores/gantt-store';
import {
  parseISODate,
  formatDateToISO,
  generateDayGrid,
  addWorkingDays,
  calculateWorkingDays,
} from '@/lib/calendar/calendar-engine';
import { topologicalSort } from '@/lib/cpm/cpm-engine';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Modal } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { useTenantMetadata } from '@/lib/context/tenant-metadata-context';
import { CollaboratorPresence } from '@/lib/realtime/presence-service';

interface InteractiveGanttProps {
  tasks: Task[];
  dependencies: TaskDependency[];
  calendar: WorkingCalendar;
  holidays: CalendarHoliday[];
  baselineSnapshots?: TaskBaselineSnapshot[];
  activeTaskMap?: Record<string, CollaboratorPresence[]>;
  onTaskUpdate?: (taskId: string, updates: Partial<Task>) => void;
  onAddDependency?: (dep: { predecessor_id: string; successor_id: string; type: 'FS' | 'SS' | 'FF' | 'SF'; lag_days: number }) => void;
  onAddTask?: (task: { title: string; start_date: string; duration_days: number; priority: string; is_milestone: boolean }) => void;
  onAddTaskClick?: () => void;
  onRecalculateCPM?: () => void;
  onOpenExportModal?: () => void;
  onOpenImportModal?: () => void;
  onSelectTask?: (task: Task) => void;
}

export function InteractiveGantt({
  tasks,
  dependencies,
  calendar,
  holidays,
  baselineSnapshots = [],
  activeTaskMap = {},
  onTaskUpdate,
  onAddDependency,
  onAddTask,
  onAddTaskClick,
  onRecalculateCPM,
  onOpenExportModal,
  onOpenImportModal,
  onSelectTask,
}: InteractiveGanttProps) {
  const {
    zoomLevel,
    columnWidth,
    rowHeight,
    setZoomLevel,
    selectedTaskId,
    setSelectedTaskId,
    highlightCriticalPath,
    toggleCriticalPathHighlight,
    isConnectingDependency,
    sourceTaskId,
    sourceHandle,
    startDependencyConnection,
    cancelDependencyConnection,
  } = useGanttStore();

  const [mousePos, setMousePos] = React.useState<{ x: number; y: number } | null>(null);
  const [cycleWarning, setCycleWarning] = React.useState<string | null>(null);

  const [draggingTask, setDraggingTask] = React.useState<{
    taskId: string;
    action: 'move' | 'resize-start' | 'resize-end';
    startX: number;
    origStartDate: string;
    origEndDate: string;
    origDuration: number;
  } | null>(null);

  const [dragPreview, setDragPreview] = React.useState<{
    taskId: string;
    start_date: string;
    end_date: string;
    duration_days: number;
  } | null>(null);

  const { priorities } = useTenantMetadata();

  const [isAddTaskModalOpen, setIsAddTaskModalOpen] = React.useState(false);
  const [newTaskTitle, setNewTaskTitle] = React.useState('');
  const [newTaskStartDate, setNewTaskStartDate] = React.useState('2026-10-01');
  const [newTaskDuration, setNewTaskDuration] = React.useState(5);
  const [newTaskPriority, setNewTaskPriority] = React.useState<string>('medium');
  const [newTaskIsMilestone, setNewTaskIsMilestone] = React.useState(false);

  const svgRef = React.useRef<SVGSVGElement | null>(null);
  const containerRef = React.useRef<HTMLDivElement | null>(null);

  // Scaling factor: pixels per single calendar day based on zoom preset
  const pxPerDay = React.useMemo(() => {
    switch (zoomLevel) {
      case 'day':
        return columnWidth; // 48px / day
      case 'week':
        return columnWidth / 7; // 120px / 7 days ~ 17.14px / day
      case 'month':
        return columnWidth / 30; // 200px / 30 days ~ 6.67px / day
      case 'quarter':
        return columnWidth / 90; // 320px / 90 days ~ 3.55px / day
      default:
        return columnWidth;
    }
  }, [zoomLevel, columnWidth]);

  // Determine timeline boundary dates
  const { minDate, maxDate, dayGrid } = React.useMemo(() => {
    let min = parseISODate('2026-10-01');
    let max = parseISODate('2026-12-15');

    tasks.forEach((t) => {
      const s = parseISODate(t.start_date);
      const e = parseISODate(t.end_date);
      if (s < min) min = s;
      if (e > max) max = e;
    });

    // Add buffer days on both ends
    const startBound = new Date(min.getTime());
    startBound.setUTCDate(startBound.getUTCDate() - 7);
    const endBound = new Date(max.getTime());
    endBound.setUTCDate(endBound.getUTCDate() + 21);

    const grid = generateDayGrid(startBound, endBound, calendar, holidays);
    return { minDate: startBound, maxDate: endBound, dayGrid: grid };
  }, [tasks, calendar, holidays]);

  const timelineWidth = Math.max(1200, dayGrid.length * pxPerDay);
  const headerHeight = 56;
  const contentHeight = Math.max(400, tasks.length * rowHeight);
  const totalSvgHeight = headerHeight + contentHeight;

  // Coordinate conversion helper functions
  const dateToX = React.useCallback(
    (dateStr: string): number => {
      const target = parseISODate(dateStr);
      const diffDays = Math.round((target.getTime() - minDate.getTime()) / (1000 * 60 * 60 * 24));
      return Math.max(0, diffDays * pxPerDay);
    },
    [minDate, pxPerDay]
  );

  // Handle Drag Move & Resize
  const handleMouseDown = (
    e: React.MouseEvent,
    taskId: string,
    action: 'move' | 'resize-start' | 'resize-end'
  ) => {
    e.stopPropagation();
    const task = tasks.find((t) => t.id === taskId);
    if (!task) return;

    setDraggingTask({
      taskId,
      action,
      startX: e.clientX,
      origStartDate: task.start_date,
      origEndDate: task.end_date,
      origDuration: task.duration_days,
    });
    setDragPreview({
      taskId,
      start_date: task.start_date,
      end_date: task.end_date,
      duration_days: task.duration_days,
    });
  };

  const updateDragPreviewPosition = React.useCallback(
    (clientX: number) => {
      if (!draggingTask) return;

      const deltaX = clientX - draggingTask.startX;
      const deltaDays = Math.round(deltaX / pxPerDay);

      const task = tasks.find((t) => t.id === draggingTask.taskId);
      if (!task) return;

      if (deltaDays === 0) {
        setDragPreview({
          taskId: task.id,
          start_date: draggingTask.origStartDate,
          end_date: draggingTask.origEndDate,
          duration_days: draggingTask.origDuration,
        });
        return;
      }

      if (draggingTask.action === 'move') {
        const newStart = parseISODate(draggingTask.origStartDate);
        newStart.setUTCDate(newStart.getUTCDate() + deltaDays);
        const newEnd = addWorkingDays(newStart, draggingTask.origDuration, calendar, holidays);

        setDragPreview({
          taskId: task.id,
          start_date: formatDateToISO(newStart),
          end_date: formatDateToISO(newEnd),
          duration_days: draggingTask.origDuration,
        });
      } else if (draggingTask.action === 'resize-end') {
        const newDuration = Math.max(1, draggingTask.origDuration + deltaDays);
        const start = parseISODate(draggingTask.origStartDate);
        const newEnd = addWorkingDays(start, newDuration, calendar, holidays);

        setDragPreview({
          taskId: task.id,
          start_date: draggingTask.origStartDate,
          end_date: formatDateToISO(newEnd),
          duration_days: newDuration,
        });
      } else if (draggingTask.action === 'resize-start') {
        const origStart = parseISODate(draggingTask.origStartDate);
        const newStart = new Date(origStart.getTime());
        newStart.setUTCDate(newStart.getUTCDate() + deltaDays);
        const currentEnd = parseISODate(draggingTask.origEndDate);

        if (newStart <= currentEnd) {
          const newDuration = Math.max(1, calculateWorkingDays(newStart, currentEnd, calendar, holidays));
          setDragPreview({
            taskId: task.id,
            start_date: formatDateToISO(newStart),
            end_date: draggingTask.origEndDate,
            duration_days: newDuration,
          });
        }
      }
    },
    [draggingTask, pxPerDay, tasks, calendar, holidays]
  );

  const handleMouseMove = (e: React.MouseEvent) => {
    if (svgRef.current) {
      const rect = svgRef.current.getBoundingClientRect();
      setMousePos({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      });
    }

    if (draggingTask) {
      updateDragPreviewPosition(e.clientX);
    }
  };

  const handleMouseUp = React.useCallback(async () => {
    if (draggingTask && dragPreview) {
      const activeDragging = draggingTask;
      const activePreview = dragPreview;

      setDraggingTask(null);
      setDragPreview(null);

      const hasChanged =
        activePreview.start_date !== activeDragging.origStartDate ||
        activePreview.end_date !== activeDragging.origEndDate ||
        activePreview.duration_days !== activeDragging.origDuration;

      if (hasChanged) {
        // 1. Optimistic update
        onTaskUpdate?.(activeDragging.taskId, {
          start_date: activePreview.start_date,
          end_date: activePreview.end_date,
          duration_days: activePreview.duration_days,
        });

        // 2. Dispatch Server Action for persistent database write
        try {
          const task = tasks.find((t) => t.id === activeDragging.taskId);
          const result = await updateTaskScheduleAction({
            taskId: activeDragging.taskId,
            startDate: activePreview.start_date,
            endDate: activePreview.end_date,
            durationDays: activePreview.duration_days,
            projectId: task?.project_id,
          });

          if (!result.success) {
            // Revert back to original on database failure
            onTaskUpdate?.(activeDragging.taskId, {
              start_date: activeDragging.origStartDate,
              end_date: activeDragging.origEndDate,
              duration_days: activeDragging.origDuration,
            });
            toast.error(
              `Schedule update failed to save to server: ${result.error || 'Database error'}`
            );
          } else {
            toast.success('Schedule update saved.');
          }
        } catch (err: any) {
          onTaskUpdate?.(activeDragging.taskId, {
            start_date: activeDragging.origStartDate,
            end_date: activeDragging.origEndDate,
            duration_days: activeDragging.origDuration,
          });
          toast.error('Schedule update failed to save to server.');
        }
      }
    } else if (draggingTask) {
      setDraggingTask(null);
      setDragPreview(null);
    }
  }, [draggingTask, dragPreview, onTaskUpdate, tasks]);

  // Window event listeners to guarantee drag releases even outside the SVG bounds
  React.useEffect(() => {
    if (!draggingTask) return;

    const onGlobalMouseMove = (e: MouseEvent) => {
      updateDragPreviewPosition(e.clientX);
    };

    const onGlobalMouseUp = () => {
      handleMouseUp();
    };

    window.addEventListener('mousemove', onGlobalMouseMove);
    window.addEventListener('mouseup', onGlobalMouseUp);

    return () => {
      window.removeEventListener('mousemove', onGlobalMouseMove);
      window.removeEventListener('mouseup', onGlobalMouseUp);
    };
  }, [draggingTask, updateDragPreviewPosition, handleMouseUp]);

  // Drag-to-connect dependency complete handler with Kahn's loop guard
  const handleConnectorMouseUp = (targetTaskId: string, targetHandle: 'start' | 'finish') => {
    if (isConnectingDependency && sourceTaskId && sourceTaskId !== targetTaskId) {
      let type: 'FS' | 'SS' | 'FF' | 'SF' = 'FS';
      if (sourceHandle === 'finish' && targetHandle === 'start') type = 'FS';
      else if (sourceHandle === 'start' && targetHandle === 'start') type = 'SS';
      else if (sourceHandle === 'finish' && targetHandle === 'finish') type = 'FF';
      else if (sourceHandle === 'start' && targetHandle === 'finish') type = 'SF';

      // 1. Circular Dependency Guard using Kahn's algorithm
      const candidateDep: TaskDependency = {
        id: 'candidate-check',
        tenant_id: tasks[0]?.tenant_id || '',
        project_id: tasks[0]?.project_id || '',
        predecessor_id: sourceTaskId,
        successor_id: targetTaskId,
        dependency_type: type,
        lag_days: 0,
        created_at: new Date().toISOString(),
      };

      const { hasCycle } = topologicalSort(tasks, [...dependencies, candidateDep]);
      if (hasCycle) {
        const predTask = tasks.find((t) => t.id === sourceTaskId);
        const succTask = tasks.find((t) => t.id === targetTaskId);
        setCycleWarning(
          `Circular Dependency Blocked: Connecting "${predTask?.title || 'Predecessor'}" to "${succTask?.title || 'Successor'}" creates an impossible cyclic loop in the project network.`
        );
        setTimeout(() => setCycleWarning(null), 6000);
        cancelDependencyConnection();
        return;
      }

      onAddDependency?.({
        predecessor_id: sourceTaskId,
        successor_id: targetTaskId,
        type,
        lag_days: 0,
      });
    }
    cancelDependencyConnection();
  };

  const handleTaskClick = (task: Task) => {
    setSelectedTaskId(task.id);
    onSelectTask?.(task);
  };

  const handleCreateTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskTitle.trim()) return;

    onAddTask?.({
      title: newTaskTitle,
      start_date: newTaskStartDate,
      duration_days: newTaskIsMilestone ? 0 : newTaskDuration,
      priority: newTaskPriority,
      is_milestone: newTaskIsMilestone,
    });

    setIsAddTaskModalOpen(false);
    setNewTaskTitle('');
  };

  return (
    <div className="flex flex-col h-full bg-[var(--card)] border border-[var(--border)] rounded-xl overflow-hidden shadow-xs relative">
      {/* Loop Prevention Alert Toast */}
      {cycleWarning && (
        <div className="absolute top-14 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 bg-rose-950/95 text-rose-200 border border-rose-500/50 px-4 py-2.5 rounded-lg shadow-xl text-xs backdrop-blur-md animate-in fade-in slide-in-from-top-2">
          <AlertTriangle className="h-4 w-4 text-rose-400 shrink-0" />
          <span className="font-medium">{cycleWarning}</span>
          <button
            onClick={() => setCycleWarning(null)}
            className="p-1 hover:bg-rose-800/50 rounded cursor-pointer ml-1"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* 1. Control Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-3 border-b border-[var(--border)] bg-[var(--secondary)]/50">
        <div className="flex items-center gap-2">
          {/* Zoom Selector */}
          <div className="flex items-center rounded-lg border border-[var(--border)] bg-[var(--card)] p-0.5">
            {(['day', 'week', 'month', 'quarter'] as GanttZoomLevel[]).map((level) => (
              <button
                key={level}
                onClick={() => setZoomLevel(level)}
                className={`px-2.5 py-1 text-xs font-semibold capitalize rounded-md transition-all cursor-pointer ${
                  zoomLevel === level
                    ? 'bg-[var(--primary)] text-[var(--primary-foreground)] shadow-xs'
                    : 'text-[var(--muted-foreground)] hover:text-[var(--foreground)]'
                }`}
              >
                {level}
              </button>
            ))}
          </div>

          {/* Critical Path Toggle */}
          <button
            onClick={toggleCriticalPathHighlight}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border transition-all cursor-pointer ${
              highlightCriticalPath
                ? 'bg-amber-500/20 border-amber-500 text-amber-400 shadow-xs'
                : 'border-[var(--border)] text-[var(--muted-foreground)] hover:text-[var(--foreground)]'
            }`}
          >
            <Flame className="h-3.5 w-3.5 text-amber-400" />
            <span>Critical Path</span>
          </button>

          {/* Recalculate CPM Button */}
          <button
            onClick={() => onRecalculateCPM?.()}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-[var(--border)] bg-[var(--card)] text-[var(--foreground)] hover:bg-[var(--secondary)] transition-colors cursor-pointer"
            title="Recalculate Early/Late Schedules & Critical Slack"
          >
            <RefreshCw className="h-3.5 w-3.5 text-[var(--primary)]" />
            <span>Run CPM</span>
          </button>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => onOpenExportModal?.()}
            className="gap-1.5 text-xs"
          >
            <Download className="h-3.5 w-3.5" />
            Export
          </Button>

          <Button
            size="sm"
            variant="outline"
            onClick={() => onOpenImportModal?.()}
            className="gap-1.5 text-xs"
          >
            <Upload className="h-3.5 w-3.5" />
            Import (.xlsx)
          </Button>

          <Button
            size="sm"
            onClick={() => (onAddTaskClick ? onAddTaskClick() : setIsAddTaskModalOpen(true))}
            className="gap-1.5 text-xs"
          >
            <Plus className="h-3.5 w-3.5" />
            Add Task
          </Button>
        </div>
      </div>

      {/* 2. Main Workspace Split: Left Task Tree + Right SVG Timeline Canvas */}
      <div
        ref={containerRef}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        className="flex flex-1 overflow-x-auto overflow-y-auto select-none"
      >
        {/* Left Frozen Task Grid */}
        <div className="w-80 shrink-0 border-r border-[var(--border)] bg-[var(--card)] sticky left-0 z-20 shadow-md">
          {/* Grid Header */}
          <div
            style={{ height: headerHeight }}
            className="flex items-center justify-between px-4 border-b border-[var(--border)] bg-[var(--secondary)] text-xs font-bold text-[var(--foreground)]"
          >
            <span>Work Breakdown Structure (WBS)</span>
            <span className="text-[10px] text-[var(--muted-foreground)] font-mono">DUR / FLOAT</span>
          </div>

          {/* Grid Rows */}
          <div className="divide-y divide-[var(--border)]">
            {tasks.map((task, index) => {
              const isZeroFloat = task.total_float === 0;
              const isCritical = (task.is_critical || isZeroFloat) && highlightCriticalPath;
              const isSelected = selectedTaskId === task.id;

              return (
                <div
                  key={task.id}
                  onClick={() => handleTaskClick(task)}
                  style={{ height: rowHeight }}
                  className={`flex items-center justify-between px-3 text-xs transition-colors cursor-pointer ${
                    isSelected
                      ? 'bg-[var(--secondary)] text-[var(--foreground)] font-semibold'
                      : 'hover:bg-[var(--secondary)]/40 text-[var(--foreground)]'
                  }`}
                >
                  <div className="flex items-center gap-2 overflow-hidden">
                    <span className="text-[10px] text-[var(--muted-foreground)] font-mono w-4 shrink-0">
                      {index + 1}
                    </span>
                    {task.parent_id && <span className="text-[var(--muted-foreground)] ml-2">↳</span>}
                    <span className="truncate max-w-[170px]" title={task.title}>
                      {task.title}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    {isCritical && (
                      <Badge variant="critical" className="text-[9px] py-0 px-1 bg-amber-500/20 text-amber-300 border-amber-500/40">
                        CP
                      </Badge>
                    )}
                    <span className="text-[11px] font-mono text-[var(--muted-foreground)]">
                      {task.duration_days}d / {task.total_float}f
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Interactive SVG Timeline Canvas */}
        <div className="relative flex-1 bg-[var(--background)]">
          <svg
            ref={svgRef}
            width={timelineWidth}
            height={totalSvgHeight}
            className="overflow-visible"
          >
            <defs>
              {/* Standard Dependency Arrowhead Marker */}
              <marker
                id="dep-arrow"
                viewBox="0 0 10 10"
                refX="6"
                refY="5"
                markerWidth="6"
                markerHeight="6"
                orient="auto-start-reverse"
              >
                <path d="M 0 1 L 10 5 L 0 9 z" fill="var(--muted-foreground)" />
              </marker>

              {/* Critical Path Arrowhead Marker */}
              <marker
                id="dep-arrow-critical"
                viewBox="0 0 10 10"
                refX="6"
                refY="5"
                markerWidth="6"
                markerHeight="6"
                orient="auto-start-reverse"
              >
                <path d="M 0 1 L 10 5 L 0 9 z" fill="#f59e0b" />
              </marker>

              {/* CPM Neon Amber Glow Shader */}
              <filter id="cpm-neon-glow" x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur stdDeviation="3" result="blur" />
                <feColorMatrix
                  type="matrix"
                  values="0 0 0 0 0.96  0 0 0 0 0.62  0 0 0 0 0.04  0 0 0 0.85 0"
                  result="coloredBlur"
                />
                <feMerge>
                  <feMergeNode in="coloredBlur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>

            {/* 1. Header Scale Dates across 4 Zoom Presets */}
            <g className="timeline-header">
              <rect
                x="0"
                y="0"
                width={timelineWidth}
                height={headerHeight}
                fill="var(--secondary)"
                className="border-b border-[var(--border)]"
              />

              {/* Header Rendering based on zoomLevel */}
              {zoomLevel === 'day' &&
                dayGrid.map((day, i) => {
                  const x = i * pxPerDay;
                  const d = day.date;
                  const isFirstOfMonth = d.getUTCDate() === 1 || i === 0;

                  return (
                    <g key={day.dateString} transform={`translate(${x}, 0)`}>
                      {isFirstOfMonth && (
                        <text
                          x="4"
                          y="18"
                          className="text-[11px] font-bold fill-[var(--foreground)]"
                        >
                          {d.toLocaleString('default', { month: 'short', year: 'numeric' })}
                        </text>
                      )}
                      <text
                        x={pxPerDay / 2}
                        y="42"
                        textAnchor="middle"
                        className={`text-[10px] font-mono ${
                          day.isWeekend
                            ? 'fill-[var(--muted-foreground)] opacity-60'
                            : day.isHoliday
                            ? 'fill-rose-500 font-bold'
                            : 'fill-[var(--foreground)] font-medium'
                        }`}
                      >
                        {d.getUTCDate()}
                      </text>
                      <line
                        x1={pxPerDay}
                        y1="24"
                        x2={pxPerDay}
                        y2={headerHeight}
                        stroke="var(--border)"
                        strokeWidth="1"
                      />
                    </g>
                  );
                })}

              {zoomLevel === 'week' &&
                (() => {
                  const weeks: { startDayIndex: number; date: Date; weekNum: number }[] = [];
                  for (let i = 0; i < dayGrid.length; i += 7) {
                    const d = dayGrid[i].date;
                    const weekNum = Math.ceil((d.getUTCDate() + 6) / 7);
                    weeks.push({ startDayIndex: i, date: d, weekNum });
                  }

                  return weeks.map((w, idx) => {
                    const x = w.startDayIndex * pxPerDay;
                    const weekWidth = 7 * pxPerDay;
                    return (
                      <g key={`week-${idx}`} transform={`translate(${x}, 0)`}>
                        <text
                          x="6"
                          y="18"
                          className="text-[11px] font-bold fill-[var(--foreground)]"
                        >
                          {w.date.toLocaleString('default', { month: 'short', year: 'numeric' })}
                        </text>
                        <text
                          x={weekWidth / 2}
                          y="42"
                          textAnchor="middle"
                          className="text-[10px] font-semibold fill-[var(--foreground)]"
                        >
                          Week {idx + 1} ({w.date.getUTCMonth() + 1}/{w.date.getUTCDate()})
                        </text>
                        <line
                          x1={weekWidth}
                          y1="0"
                          x2={weekWidth}
                          y2={headerHeight}
                          stroke="var(--border)"
                          strokeWidth="1"
                        />
                      </g>
                    );
                  });
                })()}

              {zoomLevel === 'month' &&
                (() => {
                  const months: { startDayIndex: number; date: Date }[] = [];
                  for (let i = 0; i < dayGrid.length; i++) {
                    const d = dayGrid[i].date;
                    if (d.getUTCDate() === 1 || i === 0) {
                      months.push({ startDayIndex: i, date: d });
                    }
                  }

                  return months.map((m, idx) => {
                    const x = m.startDayIndex * pxPerDay;
                    const nextX = idx < months.length - 1 ? months[idx + 1].startDayIndex * pxPerDay : timelineWidth;
                    const width = nextX - x;
                    return (
                      <g key={`month-${idx}`} transform={`translate(${x}, 0)`}>
                        <text
                          x="8"
                          y="22"
                          className="text-[12px] font-bold fill-[var(--foreground)]"
                        >
                          {m.date.toLocaleString('default', { month: 'long', year: 'numeric' })}
                        </text>
                        {/* Weekly sub-ticks */}
                        <text
                          x={width / 2}
                          y="44"
                          textAnchor="middle"
                          className="text-[9px] font-mono fill-[var(--muted-foreground)]"
                        >
                          Aggregated Weekly Schedule
                        </text>
                        <line
                          x1={width}
                          y1="0"
                          x2={width}
                          y2={headerHeight}
                          stroke="var(--border)"
                          strokeWidth="1.5"
                        />
                      </g>
                    );
                  });
                })()}

              {zoomLevel === 'quarter' &&
                (() => {
                  const quarters: { startDayIndex: number; date: Date; q: number }[] = [];
                  for (let i = 0; i < dayGrid.length; i++) {
                    const d = dayGrid[i].date;
                    const m = d.getUTCMonth();
                    if ((m % 3 === 0 && d.getUTCDate() === 1) || i === 0) {
                      quarters.push({ startDayIndex: i, date: d, q: Math.floor(m / 3) + 1 });
                    }
                  }

                  return quarters.map((q, idx) => {
                    const x = q.startDayIndex * pxPerDay;
                    const nextX = idx < quarters.length - 1 ? quarters[idx + 1].startDayIndex * pxPerDay : timelineWidth;
                    const width = nextX - x;
                    return (
                      <g key={`quarter-${idx}`} transform={`translate(${x}, 0)`}>
                        <text
                          x="8"
                          y="22"
                          className="text-[12px] font-bold fill-[var(--foreground)]"
                        >
                          Q{q.q} {q.date.getUTCFullYear()}
                        </text>
                        <text
                          x={width / 2}
                          y="44"
                          textAnchor="middle"
                          className="text-[10px] font-semibold fill-[var(--muted-foreground)]"
                        >
                          Monthly Partition Scale
                        </text>
                        <line
                          x1={width}
                          y1="0"
                          x2={width}
                          y2={headerHeight}
                          stroke="var(--border)"
                          strokeWidth="2"
                        />
                      </g>
                    );
                  });
                })()}
            </g>

            {/* 2. Non-Working Day and Holiday Vertical Stripes (Cross-Zoom Scaled) */}
            <g className="non-working-stripes pointer-events-none">
              {dayGrid.map((day) => {
                if (day.isWorkingDay) return null;
                const x = dateToX(day.dateString);

                return (
                  <rect
                    key={`bg-${day.dateString}`}
                    x={x}
                    y={headerHeight}
                    width={pxPerDay}
                    height={contentHeight}
                    fill={day.isHoliday ? 'rgba(239, 68, 68, 0.12)' : 'rgba(100, 116, 139, 0.08)'}
                  />
                );
              })}
            </g>

            {/* 3. Horizontal Row Guides */}
            <g className="row-guides">
              {tasks.map((_, index) => {
                const y = headerHeight + (index + 1) * rowHeight;
                return (
                  <line
                    key={`guide-${index}`}
                    x1="0"
                    y1={y}
                    x2={timelineWidth}
                    y2={y}
                    stroke="var(--border)"
                    strokeWidth="0.75"
                    strokeDasharray="2,2"
                  />
                );
              })}
            </g>

            {/* 4. Dependency Connector Lines (Bezier Curves) */}
            <g className="dependency-links">
              {dependencies.map((dep) => {
                const predIndex = tasks.findIndex((t) => t.id === dep.predecessor_id);
                const succIndex = tasks.findIndex((t) => t.id === dep.successor_id);
                if (predIndex === -1 || succIndex === -1) return null;

                const predTask = tasks[predIndex];
                const succTask = tasks[succIndex];

                const predStartX = dateToX(predTask.start_date);
                const predEndX = dateToX(predTask.end_date) + pxPerDay;
                const succStartX = dateToX(succTask.start_date);
                const succEndX = dateToX(succTask.end_date) + pxPerDay;

                const predY = headerHeight + predIndex * rowHeight + rowHeight / 2;
                const succY = headerHeight + succIndex * rowHeight + rowHeight / 2;

                let startX = predEndX;
                let endX = succStartX;

                if (dep.type === 'SS') {
                  startX = predStartX;
                  endX = succStartX;
                } else if (dep.type === 'FF') {
                  startX = predEndX;
                  endX = succEndX;
                } else if (dep.type === 'SF') {
                  startX = predStartX;
                  endX = succEndX;
                }

                const isCriticalLink =
                  highlightCriticalPath &&
                  (predTask.is_critical || predTask.total_float === 0) &&
                  (succTask.is_critical || succTask.total_float === 0);

                const strokeColor = isCriticalLink ? '#f59e0b' : 'var(--muted-foreground)';
                const strokeWidth = isCriticalLink ? 2.5 : 1.5;
                const markerEnd = isCriticalLink ? 'url(#dep-arrow-critical)' : 'url(#dep-arrow)';

                const dx = Math.abs(endX - startX) / 2;
                const pathD = `M ${startX} ${predY} C ${startX + dx} ${predY}, ${endX - dx} ${succY}, ${endX} ${succY}`;

                return (
                  <path
                    key={dep.id}
                    d={pathD}
                    fill="none"
                    stroke={strokeColor}
                    strokeWidth={strokeWidth}
                    markerEnd={markerEnd}
                    className="transition-all hover:stroke-indigo-400"
                  />
                );
              })}
            </g>

            {/* 5. Interactive Task Bars & Milestone Diamonds */}
            <g className="task-bars">
              {tasks.map((task, index) => {
                const effectiveStart = dragPreview?.taskId === task.id ? dragPreview.start_date : task.start_date;
                const effectiveEnd = dragPreview?.taskId === task.id ? dragPreview.end_date : task.end_date;
                const y = headerHeight + index * rowHeight + (rowHeight - 26) / 2;
                const startX = dateToX(effectiveStart);
                const endX = dateToX(effectiveEnd) + pxPerDay;
                const width = Math.max(pxPerDay, endX - startX);
                const isZeroFloat = task.total_float === 0;
                const isCritical = (task.is_critical || isZeroFloat) && highlightCriticalPath;
                const isSelected = selectedTaskId === task.id;

                // Baseline Variance
                const baselineSnapshot = baselineSnapshots.find((s) => s.task_id === task.id);
                const baseStartX = baselineSnapshot ? dateToX(baselineSnapshot.start_date) : 0;
                const baseEndX = baselineSnapshot ? dateToX(baselineSnapshot.end_date) + pxPerDay : 0;
                const baseWidth = baselineSnapshot ? Math.max(pxPerDay, baseEndX - baseStartX) : 0;
                const varianceDays = baselineSnapshot
                  ? Math.round(
                      (parseISODate(task.end_date).getTime() - parseISODate(baselineSnapshot.end_date).getTime()) /
                        (1000 * 60 * 60 * 24)
                    )
                  : 0;

                // Milestone Rendering
                if (task.is_milestone) {
                  const centerX = startX + pxPerDay / 2;
                  const centerY = y + 13;

                  return (
                    <g key={task.id} className="cursor-pointer group">
                      <polygon
                        points={`${centerX},${centerY - 10} ${centerX + 10},${centerY} ${centerX},${centerY + 10} ${centerX - 10},${centerY}`}
                        fill={isCritical ? '#f59e0b' : 'var(--primary)'}
                        stroke={isSelected ? '#ffffff' : isCritical ? '#fcd34d' : 'none'}
                        strokeWidth="2"
                        className="transition-transform group-hover:scale-125"
                        onClick={() => handleTaskClick(task)}
                      />
                      <text
                        x={centerX + 16}
                        y={centerY + 4}
                        className="text-[10px] font-semibold fill-[var(--foreground)] pointer-events-none"
                      >
                        {task.title}
                      </text>
                    </g>
                  );
                }

                return (
                  <g key={task.id} className="group">
                    {/* Ghost Baseline Rendering */}
                    {baselineSnapshot && (
                      <g className="pointer-events-none opacity-70">
                        <rect
                          x={baseStartX}
                          y={y + 28}
                          width={baseWidth}
                          height="5"
                          rx="2.5"
                          fill="rgba(148, 163, 184, 0.4)"
                          stroke="#94a3b8"
                          strokeWidth="1"
                          strokeDasharray="3 2"
                        />
                        {varianceDays !== 0 && (
                          <text
                            x={Math.max(startX + width, baseStartX + baseWidth) + 8}
                            y={y + 22}
                            className={`text-[9px] font-mono font-bold ${
                              varianceDays > 0 ? 'fill-rose-400' : 'fill-emerald-400'
                            }`}
                          >
                            {varianceDays > 0 ? `+${varianceDays}d slip` : `${varianceDays}d`}
                          </text>
                        )}
                      </g>
                    )}

                    {/* Main Bar Background & Critical Path Glow Shader */}
                    <rect
                      x={startX}
                      y={y}
                      width={width}
                      height="26"
                      rx="6"
                      fill={isCritical ? '#f59e0b' : 'var(--primary)'}
                      stroke={isCritical ? '#fef08a' : isSelected ? '#ffffff' : 'transparent'}
                      strokeWidth={isCritical ? '2' : isSelected ? '2' : '0'}
                      filter={isCritical ? 'url(#cpm-neon-glow)' : undefined}
                      className={`cursor-grab active:cursor-grabbing transition-all ${
                        isCritical ? 'animate-pulse' : ''
                      }`}
                      onMouseDown={(e) => handleMouseDown(e, task.id, 'move')}
                      onClick={() => handleTaskClick(task)}
                    />

                    {/* Active Collaborator Presence Markers */}
                    {activeTaskMap[task.id] && activeTaskMap[task.id].length > 0 && (
                      <g transform={`translate(${startX + width + 6}, ${y + 5})`}>
                        {activeTaskMap[task.id].map((c, cIdx) => (
                          <g key={c.userId} transform={`translate(${cIdx * 18}, 0)`}>
                            <circle cx="8" cy="8" r="8" fill={c.color} stroke="white" strokeWidth="1.5" />
                            <text x="8" y="11" textAnchor="middle" fill="white" fontSize="8" fontWeight="bold">
                              {c.userName.substring(0, 1).toUpperCase()}
                            </text>
                          </g>
                        ))}
                      </g>
                    )}

                    {/* Progress Fill Bar */}
                    {(task.progress ?? task.progress_percent ?? 0) > 0 && (
                      <rect
                        x={startX}
                        y={y}
                        width={(width * (task.progress ?? task.progress_percent ?? 0)) / 100}
                        height="26"
                        rx="6"
                        fill="rgba(255, 255, 255, 0.25)"
                        className="pointer-events-none"
                      />
                    )}

                    {/* Task Title Label */}
                    <text
                      x={startX + 8}
                      y={y + 17}
                      className="text-[11px] font-semibold fill-white pointer-events-none truncate select-none"
                    >
                      {(task.code || task.task_code ? `${task.code || task.task_code}: ` : '') + task.title}
                    </text>

                    {/* Resize Left Handle (Start Date change) */}
                    <rect
                      x={startX}
                      y={y}
                      width="8"
                      height="26"
                      fill="transparent"
                      className="cursor-ew-resize hover:fill-white/30"
                      onMouseDown={(e) => handleMouseDown(e, task.id, 'resize-start')}
                    />

                    {/* Resize Right Handle (Duration change) */}
                    <rect
                      x={startX + width - 8}
                      y={y}
                      width="8"
                      height="26"
                      fill="transparent"
                      className="cursor-ew-resize hover:fill-white/30"
                      onMouseDown={(e) => handleMouseDown(e, task.id, 'resize-end')}
                    />

                    {/* Dependency Connector Anchors (Start & Finish) */}
                    <circle
                      cx={startX - 5}
                      cy={y + 13}
                      r="5"
                      fill="#38bdf8"
                      stroke="#ffffff"
                      strokeWidth="1.5"
                      className="opacity-0 group-hover:opacity-100 cursor-crosshair transition-opacity"
                      onMouseDown={(e) => {
                        e.stopPropagation();
                        startDependencyConnection(task.id, 'start');
                      }}
                      onMouseUp={(e) => {
                        e.stopPropagation();
                        handleConnectorMouseUp(task.id, 'start');
                      }}
                    >
                      <title>Drag to connect dependency</title>
                    </circle>

                    <circle
                      cx={startX + width + 5}
                      cy={y + 13}
                      r="5"
                      fill="#38bdf8"
                      stroke="#ffffff"
                      strokeWidth="1.5"
                      className="opacity-0 group-hover:opacity-100 cursor-crosshair transition-opacity"
                      onMouseDown={(e) => {
                        e.stopPropagation();
                        startDependencyConnection(task.id, 'finish');
                      }}
                      onMouseUp={(e) => {
                        e.stopPropagation();
                        handleConnectorMouseUp(task.id, 'finish');
                      }}
                    >
                      <title>Drag to connect dependency</title>
                    </circle>
                  </g>
                );
              })}
            </g>

            {/* 6. Active Dragging Dependency Line Preview */}
            {isConnectingDependency && sourceTaskId && mousePos && (
              <g className="active-dep-preview pointer-events-none">
                {(() => {
                  const sIdx = tasks.findIndex((t) => t.id === sourceTaskId);
                  if (sIdx === -1) return null;
                  const sTask = tasks[sIdx];
                  const sX =
                    sourceHandle === 'start'
                      ? dateToX(sTask.start_date)
                      : dateToX(sTask.end_date) + pxPerDay;
                  const sY = headerHeight + sIdx * rowHeight + rowHeight / 2;

                  return (
                    <line
                      x1={sX}
                      y1={sY}
                      x2={mousePos.x}
                      y2={mousePos.y}
                      stroke="#38bdf8"
                      strokeWidth="2.5"
                      strokeDasharray="4,4"
                      markerEnd="url(#dep-arrow)"
                    />
                  );
                })()}
              </g>
            )}
          </svg>
        </div>
      </div>

      {/* 3. Add Task Modal */}
      <Modal
        isOpen={isAddTaskModalOpen}
        onClose={() => setIsAddTaskModalOpen(false)}
        title="Schedule New Task"
        description="Creates a hierarchical task with calendar working-day calculation"
      >
        <form onSubmit={handleCreateTask} className="space-y-4 text-xs">
          <div>
            <label className="font-semibold block mb-1">Task Title</label>
            <Input
              value={newTaskTitle}
              onChange={(e) => setNewTaskTitle(e.target.value)}
              placeholder="e.g. Build GraphQL Gateway Service"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="font-semibold block mb-1">Start Date</label>
              <Input
                type="date"
                value={newTaskStartDate}
                onChange={(e) => setNewTaskStartDate(e.target.value)}
                required
              />
            </div>

            <div>
              <label className="font-semibold block mb-1">Duration (Working Days)</label>
              <Input
                type="number"
                min={0}
                max={365}
                disabled={newTaskIsMilestone}
                value={newTaskDuration}
                onChange={(e) => setNewTaskDuration(parseInt(e.target.value, 10) || 0)}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="font-semibold block mb-1">Priority</label>
              <select
                value={newTaskPriority}
                onChange={(e) => setNewTaskPriority(e.target.value)}
                className="w-full h-9 rounded-md border border-[var(--input)] bg-[var(--card)] px-3 text-xs cursor-pointer"
              >
                {priorities.map((p) => (
                  <option key={p.slug} value={p.slug}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-2 pt-5">
              <input
                type="checkbox"
                id="isMilestone"
                checked={newTaskIsMilestone}
                onChange={(e) => setNewTaskIsMilestone(e.target.checked)}
                className="rounded border-[var(--input)]"
              />
              <label htmlFor="isMilestone" className="font-semibold cursor-pointer">
                Milestone (0 Duration)
              </label>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-[var(--border)]">
            <Button type="button" variant="outline" onClick={() => setIsAddTaskModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit">Create Task</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
