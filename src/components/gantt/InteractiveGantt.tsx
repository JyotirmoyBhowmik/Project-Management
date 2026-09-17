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
} from 'lucide-react';
import { Task, TaskDependency, WorkingCalendar, CalendarHoliday, TaskBaselineSnapshot } from '@/types/database';
import { useGanttStore, GanttZoomLevel } from '@/lib/stores/gantt-store';
import {
  parseISODate,
  formatDateToISO,
  generateDayGrid,
  addWorkingDays,
} from '@/lib/calendar/calendar-engine';
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
  onRecalculateCPM?: () => void;
  onOpenExportModal?: () => void;
  onOpenImportModal?: () => void;
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
  onRecalculateCPM,
  onOpenExportModal,
  onOpenImportModal,
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
  const [draggingTask, setDraggingTask] = React.useState<{
    taskId: string;
    action: 'move' | 'resize-start' | 'resize-end';
    startX: number;
    origStartDate: string;
    origEndDate: string;
    origDuration: number;
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

  // Determine timeline boundary dates
  const { minDate, maxDate, dayGrid } = React.useMemo(() => {
    let min = parseISODate('2026-10-01');
    let max = parseISODate('2026-12-15');

    tasks.forEach(t => {
      const s = parseISODate(t.start_date);
      const e = parseISODate(t.end_date);
      if (s < min) min = s;
      if (e > max) max = e;
    });

    // Add buffer days on both ends
    const startBound = new Date(min.getTime());
    startBound.setUTCDate(startBound.getUTCDate() - 5);
    const endBound = new Date(max.getTime());
    endBound.setUTCDate(endBound.getUTCDate() + 15);

    const grid = generateDayGrid(startBound, endBound, calendar, holidays);
    return { minDate: startBound, maxDate: endBound, dayGrid: grid };
  }, [tasks, calendar, holidays]);

  const timelineWidth = dayGrid.length * columnWidth;
  const headerHeight = 52;
  const contentHeight = tasks.length * rowHeight;
  const totalSvgHeight = headerHeight + contentHeight;

  // Coordinate conversion helper functions
  const dateToX = React.useCallback(
    (dateStr: string): number => {
      const target = parseISODate(dateStr);
      const diffDays = Math.round((target.getTime() - minDate.getTime()) / (1000 * 60 * 60 * 24));
      return Math.max(0, diffDays * columnWidth);
    },
    [minDate, columnWidth]
  );

  const xToDate = React.useCallback(
    (x: number): Date => {
      const dayIndex = Math.floor(x / columnWidth);
      const result = new Date(minDate.getTime());
      result.setUTCDate(result.getUTCDate() + dayIndex);
      return result;
    },
    [minDate, columnWidth]
  );

  // Handle Drag Move & Resize
  const handleMouseDown = (
    e: React.MouseEvent,
    taskId: string,
    action: 'move' | 'resize-start' | 'resize-end'
  ) => {
    e.stopPropagation();
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;

    setDraggingTask({
      taskId,
      action,
      startX: e.clientX,
      origStartDate: task.start_date,
      origEndDate: task.end_date,
      origDuration: task.duration_days,
    });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (svgRef.current) {
      const rect = svgRef.current.getBoundingClientRect();
      setMousePos({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      });
    }

    if (!draggingTask) return;

    const deltaX = e.clientX - draggingTask.startX;
    const deltaDays = Math.round(deltaX / columnWidth);
    if (deltaDays === 0) return;

    const task = tasks.find(t => t.id === draggingTask.taskId);
    if (!task) return;

    if (draggingTask.action === 'move') {
      const newStart = parseISODate(draggingTask.origStartDate);
      newStart.setUTCDate(newStart.getUTCDate() + deltaDays);
      const newEnd = addWorkingDays(newStart, task.duration_days, calendar, holidays);

      onTaskUpdate?.(task.id, {
        start_date: formatDateToISO(newStart),
        end_date: formatDateToISO(newEnd),
      });
    } else if (draggingTask.action === 'resize-end') {
      const newDuration = Math.max(1, draggingTask.origDuration + deltaDays);
      const start = parseISODate(task.start_date);
      const newEnd = addWorkingDays(start, newDuration, calendar, holidays);

      onTaskUpdate?.(task.id, {
        duration_days: newDuration,
        end_date: formatDateToISO(newEnd),
      });
    }
  };

  const handleMouseUp = () => {
    if (draggingTask) {
      setDraggingTask(null);
    }
  };

  // Drag-to-connect dependency complete handler
  const handleConnectorMouseUp = (targetTaskId: string, targetHandle: 'start' | 'finish') => {
    if (isConnectingDependency && sourceTaskId && sourceTaskId !== targetTaskId) {
      // Determine dependency type based on handle combination:
      // Finish -> Start = FS
      // Start -> Start = SS
      // Finish -> Finish = FF
      // Start -> Finish = SF
      let type: 'FS' | 'SS' | 'FF' | 'SF' = 'FS';
      if (sourceHandle === 'finish' && targetHandle === 'start') type = 'FS';
      else if (sourceHandle === 'start' && targetHandle === 'start') type = 'SS';
      else if (sourceHandle === 'finish' && targetHandle === 'finish') type = 'FF';
      else if (sourceHandle === 'start' && targetHandle === 'finish') type = 'SF';

      onAddDependency?.({
        predecessor_id: sourceTaskId,
        successor_id: targetTaskId,
        type,
        lag_days: 0,
      });
    }
    cancelDependencyConnection();
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
    <div className="flex flex-col h-full bg-[var(--card)] border border-[var(--border)] rounded-xl overflow-hidden shadow-xs">
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
                ? 'bg-rose-500/15 border-rose-500 text-rose-500 shadow-xs'
                : 'border-[var(--border)] text-[var(--muted-foreground)] hover:text-[var(--foreground)]'
            }`}
          >
            <Flame className="h-3.5 w-3.5" />
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
            onClick={() => setIsAddTaskModalOpen(true)}
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
              const isCritical = task.is_critical && highlightCriticalPath;
              const isSelected = selectedTaskId === task.id;

              return (
                <div
                  key={task.id}
                  onClick={() => setSelectedTaskId(task.id)}
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
                      <Badge variant="critical" className="text-[9px] py-0 px-1">
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
                <path d="M 0 1 L 10 5 L 0 9 z" fill="#f43f5e" />
              </marker>
            </defs>

            {/* 1. Header Scale Dates */}
            <g className="timeline-header">
              <rect
                x="0"
                y="0"
                width={timelineWidth}
                height={headerHeight}
                fill="var(--secondary)"
                className="border-b border-[var(--border)]"
              />
              {dayGrid.map((day, i) => {
                const x = i * columnWidth;
                const d = day.date;
                const isFirstOfMonth = d.getUTCDate() === 1;

                return (
                  <g key={day.dateString} transform={`translate(${x}, 0)`}>
                    {/* Top Month Header Label */}
                    {isFirstOfMonth && (
                      <text
                        x="4"
                        y="18"
                        className="text-[11px] font-bold fill-[var(--foreground)]"
                      >
                        {d.toLocaleString('default', { month: 'short', year: 'numeric' })}
                      </text>
                    )}
                    {/* Bottom Day Label */}
                    <text
                      x={columnWidth / 2}
                      y="40"
                      textAnchor="middle"
                      className={`text-[10px] font-mono ${
                        day.isWeekend
                          ? 'fill-[var(--muted-foreground)] font-normal opacity-60'
                          : day.isHoliday
                          ? 'fill-rose-500 font-bold'
                          : 'fill-[var(--foreground)] font-medium'
                      }`}
                    >
                      {d.getUTCDate()}
                    </text>
                    <line
                      x1={columnWidth}
                      y1="24"
                      x2={columnWidth}
                      y2={headerHeight}
                      stroke="var(--border)"
                      strokeWidth="1"
                    />
                  </g>
                );
              })}
            </g>

            {/* 2. Non-Working Day and Holiday Vertical Stripes */}
            <g className="non-working-stripes">
              {dayGrid.map((day, i) => {
                const x = i * columnWidth;
                if (day.isWorkingDay) return null;

                return (
                  <rect
                    key={`bg-${day.dateString}`}
                    x={x}
                    y={headerHeight}
                    width={columnWidth}
                    height={contentHeight}
                    fill={day.isHoliday ? 'var(--holiday-day)' : 'var(--non-working-day)'}
                    className="pointer-events-none"
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
                const predIndex = tasks.findIndex(t => t.id === dep.predecessor_id);
                const succIndex = tasks.findIndex(t => t.id === dep.successor_id);
                if (predIndex === -1 || succIndex === -1) return null;

                const predTask = tasks[predIndex];
                const succTask = tasks[succIndex];

                const predStartX = dateToX(predTask.start_date);
                const predEndX = dateToX(predTask.end_date) + columnWidth;
                const succStartX = dateToX(succTask.start_date);
                const succEndX = dateToX(succTask.end_date) + columnWidth;

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
                  highlightCriticalPath && predTask.is_critical && succTask.is_critical;
                const strokeColor = isCriticalLink ? '#f43f5e' : 'var(--muted-foreground)';
                const strokeWidth = isCriticalLink ? 2.5 : 1.5;
                const markerEnd = isCriticalLink ? 'url(#dep-arrow-critical)' : 'url(#dep-arrow)';

                // Compute smooth bezier path
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
                const y = headerHeight + index * rowHeight + (rowHeight - 24) / 2;
                const startX = dateToX(task.start_date);
                const endX = dateToX(task.end_date) + columnWidth;
                const width = Math.max(columnWidth, endX - startX);
                const isCritical = task.is_critical && highlightCriticalPath;
                const isSelected = selectedTaskId === task.id;

                // Baseline Variance calculation
                const baselineSnapshot = baselineSnapshots.find((s) => s.task_id === task.id);
                const baseStartX = baselineSnapshot ? dateToX(baselineSnapshot.start_date) : 0;
                const baseEndX = baselineSnapshot ? dateToX(baselineSnapshot.end_date) + columnWidth : 0;
                const baseWidth = baselineSnapshot ? Math.max(columnWidth, baseEndX - baseStartX) : 0;
                const varianceDays = baselineSnapshot
                  ? Math.round(
                      (parseISODate(task.end_date).getTime() - parseISODate(baselineSnapshot.end_date).getTime()) /
                        (1000 * 60 * 60 * 24)
                    )
                  : 0;

                // Milestone Rendering (Rotated Diamond)
                if (task.is_milestone) {
                  const centerX = startX + columnWidth / 2;
                  const centerY = y + 12;

                  return (
                    <g key={task.id} className="cursor-pointer group">
                      <polygon
                        points={`${centerX},${centerY - 10} ${centerX + 10},${centerY} ${centerX},${centerY + 10} ${centerX - 10},${centerY}`}
                        fill={isCritical ? '#f43f5e' : 'var(--primary)'}
                        stroke={isSelected ? '#ffffff' : 'none'}
                        strokeWidth="2"
                        className="transition-transform group-hover:scale-125"
                        onClick={() => setSelectedTaskId(task.id)}
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

                // Standard Task Bar
                return (
                  <g key={task.id} className="group">
                    {/* Dual-Bar Ghost Baseline Rendering */}
                    {baselineSnapshot && (
                      <g className="pointer-events-none opacity-70">
                        <rect
                          x={baseStartX}
                          y={y + 26}
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
                            y={y + 20}
                            className={`text-[9px] font-mono font-bold ${
                              varianceDays > 0 ? 'fill-rose-400' : 'fill-emerald-400'
                            }`}
                          >
                            {varianceDays > 0 ? `+${varianceDays}d slip` : `${varianceDays}d`}
                          </text>
                        )}
                      </g>
                    )}

                    {/* Main Bar Background & Critical Glow */}
                    <rect
                      x={startX}
                      y={y}
                      width={width}
                      height="24"
                      rx="5"
                      fill={isCritical ? '#f43f5e' : 'var(--primary)'}
                      className={`cursor-grab active:cursor-grabbing transition-all ${
                        isCritical ? 'filter drop-shadow(0 0 6px rgba(244, 63, 94, 0.6))' : ''
                      } ${isSelected ? 'stroke-2 stroke-white' : ''}`}
                      onMouseDown={(e) => handleMouseDown(e, task.id, 'move')}
                      onClick={() => setSelectedTaskId(task.id)}
                    />

                    {/* Active Collaborator Presence Markers */}
                    {activeTaskMap[task.id] && activeTaskMap[task.id].length > 0 && (
                      <g transform={`translate(${startX + width + 6}, ${y + 4})`}>
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
                        height="24"
                        rx="5"
                        fill="rgba(255, 255, 255, 0.25)"
                        className="pointer-events-none"
                      />
                    )}

                    {/* Task Title Label inside bar */}
                    <text
                      x={startX + 8}
                      y={y + 16}
                      className="text-[11px] font-medium fill-white pointer-events-none truncate"
                    >
                      {task.title}
                    </text>

                    {/* Resize Left Handle */}
                    <rect
                      x={startX}
                      y={y}
                      width="6"
                      height="24"
                      fill="transparent"
                      className="cursor-ew-resize hover:fill-white/30"
                      onMouseDown={(e) => handleMouseDown(e, task.id, 'resize-start')}
                    />

                    {/* Resize Right Handle */}
                    <rect
                      x={startX + width - 6}
                      y={y}
                      width="6"
                      height="24"
                      fill="transparent"
                      className="cursor-ew-resize hover:fill-white/30"
                      onMouseDown={(e) => handleMouseDown(e, task.id, 'resize-end')}
                    />

                    {/* Dependency Connectors (Left = Start, Right = Finish) */}
                    <circle
                      cx={startX - 4}
                      cy={y + 12}
                      r="4"
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
                    />

                    <circle
                      cx={startX + width + 4}
                      cy={y + 12}
                      r="4"
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
                    />
                  </g>
                );
              })}
            </g>

            {/* 6. Active Dragging Dependency Line Preview */}
            {isConnectingDependency && sourceTaskId && mousePos && (
              <g className="active-dep-preview pointer-events-none">
                {(() => {
                  const sIdx = tasks.findIndex(t => t.id === sourceTaskId);
                  if (sIdx === -1) return null;
                  const sTask = tasks[sIdx];
                  const sX =
                    sourceHandle === 'start'
                      ? dateToX(sTask.start_date)
                      : dateToX(sTask.end_date) + columnWidth;
                  const sY = headerHeight + sIdx * rowHeight + rowHeight / 2;

                  return (
                    <line
                      x1={sX}
                      y1={sY}
                      x2={mousePos.x}
                      y2={mousePos.y}
                      stroke="#38bdf8"
                      strokeWidth="2"
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
