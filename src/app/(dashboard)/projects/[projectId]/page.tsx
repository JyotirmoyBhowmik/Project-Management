// ==============================================================================
// src/app/(dashboard)/projects/[projectId]/page.tsx
// Active Project Workspace (100% Live Supabase PostgreSQL Data)
// Interactive Gantt, CPM Engine, Kanban, Grid, Baselines & Clean Empty States
// ==============================================================================

'use client';

import * as React from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  GanttChartSquare,
  Kanban,
  Table,
  CalendarDays,
  Flame,
  Clock,
  Sparkles,
  Download,
  Upload,
  RefreshCw,
  Layers,
  Users,
  Bookmark,
  Check,
  Plus,
  ArrowLeft,
  Loader2,
  FolderGit2,
} from 'lucide-react';
import { useTenantStore } from '@/lib/stores/tenant-store';
import { createClient } from '@/lib/supabase/client';
import { dbService } from '@/lib/supabase/db-service';
import {
  Task,
  TaskDependency,
  Project,
  WorkingCalendar,
  CalendarHoliday,
  ProjectBaseline,
  TaskBaselineSnapshot,
  TaskPriority,
  TaskStatus,
} from '@/types/database';
import { Tabs } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { InteractiveGantt } from '@/components/gantt/InteractiveGantt';
import { KanbanBoard } from '@/components/kanban/KanbanBoard';
import { HierarchicalGrid } from '@/components/grid/HierarchicalGrid';
import { ProjectCalendarView } from '@/components/calendar/ProjectCalendarView';
import { ResourceHeatmapView } from '@/components/resource/ResourceHeatmapView';
import { ImportExportModal } from '@/components/exchange/ImportExportModal';
import { useProjectPresence } from '@/lib/realtime/presence-service';
import { calculateCPM } from '@/lib/cpm/cpm-engine';

export default function ProjectWorkspacePage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params?.projectId as string;
  const supabase = createClient();

  const { activeTenant, activeRole, currentUser } = useTenantStore();

  const searchParams = useSearchParams();
  const viewParam = searchParams?.get('view') || 'gantt';
  const validViews = ['gantt', 'kanban', 'grid', 'calendar', 'resource'] as const;
  type ViewType = typeof validViews[number];
  const activeView: ViewType = (validViews as readonly string[]).includes(viewParam) ? (viewParam as ViewType) : 'gantt';

  const [isPending, startTransition] = React.useTransition();

  const setActiveView = React.useCallback((view: ViewType) => {
    startTransition(() => {
      const params = new URLSearchParams(searchParams?.toString() || '');
      params.set('view', view);
      router.replace(`?${params.toString()}`, { scroll: false });
    });
  }, [searchParams, router]);

  const [project, setProject] = React.useState<Project | null>(null);
  const [tasks, setTasks] = React.useState<Task[]>([]);
  const [dependencies, setDependencies] = React.useState<TaskDependency[]>([]);
  const [calendar, setCalendar] = React.useState<WorkingCalendar>({
    working_days: [1, 2, 3, 4, 5],
    weekend_days: [0, 6],
    daily_working_hours: 8,
    is_default: true,
  });
  const [holidays, setHolidays] = React.useState<CalendarHoliday[]>([]);
  const [baselines, setBaselines] = React.useState<ProjectBaseline[]>([]);
  const [selectedBaselineId, setSelectedBaselineId] = React.useState<string | null>(null);
  const [baselineSnapshots, setBaselineSnapshots] = React.useState<TaskBaselineSnapshot[]>([]);

  const [isLoading, setIsLoading] = React.useState(true);
  const [isCpmCalculating, setIsCpmCalculating] = React.useState(false);

  // Modals state
  const [isAddTaskModalOpen, setIsAddTaskModalOpen] = React.useState(false);
  const [isLockBaselineModalOpen, setIsLockBaselineModalOpen] = React.useState(false);
  const [exchangeMode, setExchangeMode] = React.useState<'import' | 'export' | null>(null);

  // New Task Form
  const [newTaskTitle, setNewTaskTitle] = React.useState('');
  const [newTaskCode, setNewTaskCode] = React.useState('');
  const [newTaskDuration, setNewTaskDuration] = React.useState(5);
  const [newTaskStart, setNewTaskStart] = React.useState(new Date().toISOString().split('T')[0]);
  const [newTaskPriority, setNewTaskPriority] = React.useState<TaskPriority>('medium');
  const [isSubmittingTask, setIsSubmittingTask] = React.useState(false);

  // Baseline Form
  const [baselineName, setBaselineName] = React.useState('');
  const [isLockingBaseline, setIsLockingBaseline] = React.useState(false);

  const tenantId = activeTenant?.id;
  const userId = currentUser?.id;

  // Real-Time Collaboration Presence
  const { collaborators, activeTaskMap } = useProjectPresence(projectId, currentUser);

  // Load project data
  const refreshProjectData = React.useCallback(async () => {
    if (!projectId || !tenantId) {
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);

      const [prj, prjTasks, prjDeps, prjCal, prjHols, prjBaselines] = await Promise.all([
        dbService.getProjectDetails(projectId, tenantId, supabase),
        dbService.getProjectTasks(projectId, tenantId, supabase),
        dbService.getProjectDependencies(projectId, tenantId, supabase),
        dbService.getWorkingCalendar(tenantId, null, supabase),
        dbService.getCalendarHolidays(tenantId, supabase),
        dbService.getProjectBaselines(projectId, tenantId, supabase),
      ]);

      setProject(prj);
      setTasks(prjTasks);
      setDependencies(prjDeps);
      setCalendar(prjCal);
      setHolidays(prjHols);
      setBaselines(prjBaselines);

      if (prjBaselines.length > 0 && !selectedBaselineId) {
        setSelectedBaselineId(prjBaselines[0].id);
      }
    } catch (err) {
      console.error('Failed loading project workspace:', err);
    } finally {
      setIsLoading(false);
    }
  }, [projectId, tenantId, selectedBaselineId]);

  React.useEffect(() => {
    refreshProjectData();
  }, [refreshProjectData]);

  // Load baseline snapshots when selected baseline changes
  React.useEffect(() => {
    async function loadSnapshots() {
      if (!selectedBaselineId) {
        setBaselineSnapshots([]);
        return;
      }
      const snaps = await dbService.getBaselineSnapshots(selectedBaselineId, supabase);
      setBaselineSnapshots(snaps);
    }
    loadSnapshots();
  }, [selectedBaselineId]);

  // Task Creation Handler
  const [taskError, setTaskError] = React.useState<string | null>(null);

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskTitle.trim() || !projectId || !tenantId) return;

    setIsSubmittingTask(true);
    setTaskError(null);
    try {
      await dbService.createTask(
        {
          project_id: projectId,
          tenant_id: tenantId,
          title: newTaskTitle.trim(),
          duration_days: Number(newTaskDuration) || 1,
          start_date: newTaskStart,
          end_date: newTaskStart,
          priority: newTaskPriority,
          status: 'todo',
          progress: 0,
          is_milestone: Number(newTaskDuration) === 0,
          order_index: tasks.length + 1,
          created_by: userId || null,
        },
        supabase
      );

      setIsAddTaskModalOpen(false);
      setNewTaskTitle('');
      setNewTaskCode('');
      await refreshProjectData();
    } catch (err: any) {
      const pgCode = err?.code || '';
      const msg = err?.message || 'Unknown error';
      setTaskError(`Task creation failed [${pgCode}]: ${msg}`);
      console.error('Failed creating task:', err);
    } finally {
      setIsSubmittingTask(false);
    }
  };

  // Run CPM Calculation
  const handleRunCPM = async () => {
    if (tasks.length === 0 || !tenantId) return;

    setIsCpmCalculating(true);
    try {
      const cpmResult = calculateCPM(tasks, dependencies, calendar, holidays);

      // Persist computed CPM values to Supabase
      await Promise.all(
        cpmResult.tasks.map((t) =>
          dbService.updateTask(
            t.id,
            {
              early_start: t.early_start,
              early_finish: t.early_finish,
              late_start: t.late_start,
              late_finish: t.late_finish,
              total_float: t.total_float,
              free_float: t.free_float,
              is_critical: t.is_critical,
            },
            supabase
          )
        )
      );

      await refreshProjectData();
    } catch (err) {
      console.error('CPM execution failed:', err);
    } finally {
      setIsCpmCalculating(false);
    }
  };

  // Lock Baseline Snapshot
  const handleLockBaseline = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!baselineName.trim() || !projectId || !tenantId) return;

    setIsLockingBaseline(true);
    try {
      const newBaseline = await dbService.createBaselineSnapshot(
        projectId,
        tenantId,
        baselineName.trim(),
        tasks,
        userId || undefined,
        supabase
      );

      if (newBaseline) {
        setSelectedBaselineId(newBaseline.id);
      }
      setIsLockBaselineModalOpen(false);
      setBaselineName('');
      await refreshProjectData();
    } catch (err) {
      console.error('Failed creating baseline:', err);
    } finally {
      setIsLockingBaseline(false);
    }
  };

  if (isLoading) {
    return (
      <div className="h-96 flex flex-col items-center justify-center gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-[var(--primary)]" />
        <p className="text-xs font-medium text-[var(--muted-foreground)]">
          Loading project schedule and critical path data...
        </p>
      </div>
    );
  }

  // Project Not Found Screen
  if (!project) {
    return (
      <div className="rounded-2xl border border-dashed border-[var(--border)] bg-[var(--card)] p-12 text-center space-y-4 max-w-lg mx-auto mt-12">
        <div className="h-12 w-12 rounded-full bg-[var(--secondary)] flex items-center justify-center mx-auto text-[var(--muted-foreground)]">
          <FolderGit2 className="h-6 w-6" />
        </div>
        <h2 className="text-lg font-bold text-[var(--foreground)]">Project Not Found</h2>
        <p className="text-xs text-[var(--muted-foreground)]">
          The requested project does not exist in this workspace or you do not have permission to access it.
        </p>
        <Link href="/projects">
          <Button variant="outline" className="gap-2 text-xs">
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>Return to Projects Portfolio</span>
          </Button>
        </Link>
      </div>
    );
  }

  const criticalTasksCount = tasks.filter((t) => t.is_critical).length;

  return (
    <div className="space-y-5">
      {/* Project Header Banner */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-[var(--border)] pb-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Link
              href="/projects"
              className="text-xs font-semibold text-[var(--muted-foreground)] hover:text-[var(--primary)] flex items-center gap-1 transition-colors"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              <span>Projects</span>
            </Link>
            <span className="text-[var(--muted-foreground)]">/</span>
            <Badge variant="outline" className="font-mono text-[10px]">
              {project.code}
            </Badge>
            <Badge variant={project.status === 'active' ? 'success' : 'secondary'} className="text-[10px]">
              {project.status}
            </Badge>
            {criticalTasksCount > 0 && (
              <Badge variant="destructive" className="gap-1 text-[10px] font-mono">
                <Flame className="h-3 w-3" />
                <span>{criticalTasksCount} Critical Tasks</span>
              </Badge>
            )}
          </div>
          <h1 className="text-2xl font-bold text-[var(--foreground)] tracking-tight">
            {project.name}
          </h1>
          {project.description && (
            <p className="text-xs text-[var(--muted-foreground)] max-w-2xl">{project.description}</p>
          )}
        </div>

        {/* Global Project Actions */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Baseline Snapshot Picker */}
          {baselines.length > 0 ? (
            <div className="flex items-center gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--secondary)]/60 px-2.5 py-1">
              <Bookmark className="h-3.5 w-3.5 text-blue-400" />
              <select
                value={selectedBaselineId || ''}
                onChange={(e) => setSelectedBaselineId(e.target.value)}
                className="bg-transparent text-xs text-[var(--foreground)] font-medium focus:outline-none cursor-pointer"
              >
                {baselines.map((bl) => (
                  <option key={bl.id} value={bl.id} className="bg-[var(--card)] text-[var(--foreground)]">
                    Baseline: {bl.name} ({bl.snapshot_date || new Date(bl.created_at).toLocaleDateString()})
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsLockBaselineModalOpen(true)}
              className="gap-1.5 text-xs"
            >
              <Bookmark className="h-3.5 w-3.5 text-blue-400" />
              <span>Lock Baseline</span>
            </Button>
          )}

          <Button
            variant="outline"
            size="sm"
            onClick={handleRunCPM}
            disabled={isCpmCalculating || tasks.length === 0}
            className="gap-1.5 text-xs"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isCpmCalculating ? 'animate-spin' : ''}`} />
            <span>Run CPM</span>
          </Button>

          <Button size="sm" onClick={() => setIsAddTaskModalOpen(true)} className="gap-1.5 text-xs">
            <Plus className="h-3.5 w-3.5" />
            <span>Add Task</span>
          </Button>
        </div>
      </div>

      {/* Navigation Tabs (Gantt, Kanban, Grid, Calendar, Resource) */}
      <div className="border-b border-[var(--border)]">
        <div className="flex gap-2 overflow-x-auto pb-px">
          {[
            { id: 'gantt', label: 'Interactive Gantt & CPM', icon: GanttChartSquare },
            { id: 'kanban', label: `Kanban Board (${tasks.length})`, icon: Kanban },
            { id: 'grid', label: 'Hierarchical Grid', icon: Table },
            { id: 'calendar', label: 'Calendar Schedule', icon: CalendarDays },
            { id: 'resource', label: 'Resource Heatmap', icon: Users },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeView === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveView(tab.id as any)}
                className={`flex items-center gap-2 px-3.5 py-2 text-xs font-semibold border-b-2 transition-all cursor-pointer whitespace-nowrap ${
                  isActive
                    ? 'border-[var(--primary)] text-[var(--primary)]'
                    : 'border-transparent text-[var(--muted-foreground)] hover:text-[var(--foreground)]'
                }`}
              >
                <Icon className="h-4 w-4" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* View Rendering or Clean Empty State */}
      {tasks.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[var(--border)] bg-[var(--card)] p-12 text-center space-y-4">
          <div className="h-12 w-12 rounded-full bg-[var(--secondary)] flex items-center justify-center mx-auto text-[var(--muted-foreground)]">
            <Layers className="h-6 w-6" />
          </div>
          <div className="space-y-1">
            <h3 className="text-base font-semibold text-[var(--foreground)]">No tasks in this project yet</h3>
            <p className="text-xs text-[var(--muted-foreground)] max-w-sm mx-auto">
              Get started by adding your first task or milestone to generate the CPM schedule and Gantt timeline.
            </p>
          </div>
          <Button onClick={() => setIsAddTaskModalOpen(true)} className="gap-2 text-xs">
            <Plus className="h-4 w-4" />
            <span>Add First Task</span>
          </Button>
        </div>
      ) : (
        <div>
          {activeView === 'gantt' && (
            <InteractiveGantt
              tasks={tasks}
              dependencies={dependencies}
              baselineSnapshots={baselineSnapshots}
              calendar={calendar}
              holidays={holidays}
              onTaskUpdate={async (taskId, updates) => {
                await dbService.updateTask(taskId, updates, supabase);
                await refreshProjectData();
              }}
              onAddDependency={async (dep) => {
                if (!projectId || !tenantId) return;
                await dbService.createDependency(
                  {
                    project_id: projectId,
                    tenant_id: tenantId,
                    predecessor_id: dep.predecessor_id,
                    successor_id: dep.successor_id,
                    dependency_type: dep.type,
                    lag_days: dep.lag_days,
                  },
                  supabase
                );
                await refreshProjectData();
              }}
              onAddTask={async (task) => {
                if (!projectId || !tenantId) return;
                await dbService.createTask(
                  {
                    project_id: projectId,
                    tenant_id: tenantId,
                    title: task.title,
                    code: `TSK-${tasks.length + 1}`,
                    start_date: task.start_date,
                    end_date: task.start_date,
                    duration_days: task.duration_days,
                    priority: task.priority,
                    status: 'todo',
                    is_milestone: task.is_milestone,
                    created_by: userId || null,
                    order_index: tasks.length + 1,
                  },
                  supabase
                );
                await refreshProjectData();
              }}
              onRecalculateCPM={handleRunCPM}
              onOpenExportModal={() => setExchangeMode('export')}
              onOpenImportModal={() => setExchangeMode('import')}
            />
          )}

          {activeView === 'kanban' && (
            <KanbanBoard
              tasks={tasks}
              onTaskUpdate={async (taskId, updates) => {
                await dbService.updateTask(taskId, updates, supabase);
                await refreshProjectData();
              }}
            />
          )}

          {activeView === 'grid' && (
            <HierarchicalGrid
              tasks={tasks}
              onTaskUpdate={async (taskId, updates) => {
                await dbService.updateTask(taskId, updates, supabase);
                await refreshProjectData();
              }}
            />
          )}

          {activeView === 'calendar' && (
            <ProjectCalendarView tasks={tasks} calendar={calendar} holidays={holidays} />
          )}

          {activeView === 'resource' && (
            <ResourceHeatmapView
              tasks={tasks}
              calendar={calendar}
              holidays={holidays}
              tenantId={tenantId || ''}
            />
          )}
        </div>
      )}

      {/* Add Task Modal */}
      <Modal
        isOpen={isAddTaskModalOpen}
        onClose={() => setIsAddTaskModalOpen(false)}
        title="Add New Work Item"
      >
        <form onSubmit={handleCreateTask} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-[var(--foreground)]">Task Title</label>
            <Input
              placeholder="e.g. Database Schema & RLS Matrix"
              value={newTaskTitle}
              onChange={(e) => setNewTaskTitle(e.target.value)}
              required
              autoFocus
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-[var(--foreground)]">Task Code</label>
              <Input
                placeholder="e.g. TSK-101"
                value={newTaskCode}
                onChange={(e) => setNewTaskCode(e.target.value)}
                className="font-mono"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-[var(--foreground)]">Duration (Days)</label>
              <Input
                type="number"
                min="0"
                value={newTaskDuration}
                onChange={(e) => setNewTaskDuration(Number(e.target.value))}
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-[var(--foreground)]">Start Date</label>
              <Input
                type="date"
                value={newTaskStart}
                onChange={(e) => setNewTaskStart(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-[var(--foreground)]">Priority</label>
              <select
                value={newTaskPriority}
                onChange={(e) => setNewTaskPriority(e.target.value as TaskPriority)}
                className="w-full rounded-md border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-xs text-[var(--foreground)]"
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsAddTaskModalOpen(false)}
              disabled={isSubmittingTask}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmittingTask || !newTaskTitle.trim()}>
              {isSubmittingTask ? 'Adding...' : 'Add Task'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Lock Baseline Modal */}
      <Modal
        isOpen={isLockBaselineModalOpen}
        onClose={() => setIsLockBaselineModalOpen(false)}
        title="Lock Schedule Baseline"
      >
        <form onSubmit={handleLockBaseline} className="space-y-4">
          <p className="text-xs text-[var(--muted-foreground)]">
            Locking an approved baseline snapshot preserves current planned dates and durations to track schedule slip (SV/SPI) in the Gantt timeline.
          </p>
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-[var(--foreground)]">Baseline Name</label>
            <Input
              placeholder="e.g. Initial Approved Schedule Baseline"
              value={baselineName}
              onChange={(e) => setBaselineName(e.target.value)}
              required
              autoFocus
            />
          </div>

          <div className="flex justify-end gap-2 pt-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsLockBaselineModalOpen(false)}
              disabled={isLockingBaseline}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isLockingBaseline || !baselineName.trim()}>
              {isLockingBaseline ? 'Locking...' : 'Lock Baseline'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
