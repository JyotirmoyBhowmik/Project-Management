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
  AlertCircle,
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
  ProjectSprint,
  ProjectDocument,
  ProjectPhase,
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
import { GraphCanvas } from '@/components/graphify/GraphCanvas';
import { SprintPlanningView } from '@/components/agile/SprintPlanningView';
import { WikiWorkspace } from '@/components/wiki/WikiWorkspace';
import { ImportExportModal } from '@/components/exchange/ImportExportModal';
import { TaskDetailDrawer } from '@/components/tasks/TaskDetailDrawer';
import { CreateTaskDialog } from '@/components/tasks/CreateTaskDialog';
import { useProjectPresence } from '@/lib/realtime/presence-service';
import { calculateCPM } from '@/lib/cpm/cpm-engine';
import { getProjectSprintsAction } from '@/actions/sprints';
import { getDocumentTreeAction } from '@/actions/wiki';

function ProjectWorkspaceContent() {
  const params = useParams();
  const router = useRouter();
  const projectId = params?.projectId as string;
  const supabase = createClient();

  const { activeTenant, activeRole, currentUser } = useTenantStore();

  const searchParams = useSearchParams();
  const rawView = searchParams?.get('view') || 'gantt';
  const viewParam = rawView === 'heatmap' ? 'resource' : rawView;
  const validViews = ['gantt', 'kanban', 'grid', 'graph', 'sprint', 'wiki', 'calendar', 'resource'] as const;
  type ViewType = typeof validViews[number];
  const activeView: ViewType = (validViews as readonly string[]).includes(viewParam) ? (viewParam as ViewType) : 'gantt';

  const [isPending, startTransition] = React.useTransition();

  const setActiveView = React.useCallback((view: ViewType) => {
    startTransition(() => {
      const p = new URLSearchParams(searchParams?.toString() || '');
      p.set('view', view);
      router.push(`?${p.toString()}`, { scroll: false });
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
  const [sprints, setSprints] = React.useState<ProjectSprint[]>([]);
  const [documents, setDocuments] = React.useState<ProjectDocument[]>([]);
  const [phases, setPhases] = React.useState<ProjectPhase[]>([]);

  const [isLoading, setIsLoading] = React.useState(true);
  const [isCpmCalculating, setIsCpmCalculating] = React.useState(false);
  const [selectedTaskForDrawer, setSelectedTaskForDrawer] = React.useState<Task | null>(null);

  // Modals state
  const [isAddTaskModalOpen, setIsAddTaskModalOpen] = React.useState(false);
  const [isLockBaselineModalOpen, setIsLockBaselineModalOpen] = React.useState(false);
  const [exchangeMode, setExchangeMode] = React.useState<'import' | 'export' | null>(null);

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

      const [prj, prjTasks, prjDeps, prjCal, prjHols, prjBaselines, sprintsRes, docsRes, prjPhases] = await Promise.all([
        dbService.getProjectDetails(projectId, tenantId, supabase),
        dbService.getProjectTasks(projectId, tenantId, supabase),
        dbService.getProjectDependencies(projectId, tenantId, supabase),
        dbService.getWorkingCalendar(tenantId, null, supabase),
        dbService.getCalendarHolidays(tenantId, supabase),
        dbService.getProjectBaselines(projectId, tenantId, supabase),
        getProjectSprintsAction(projectId),
        getDocumentTreeAction(projectId),
        dbService.getProjectPhases(projectId, tenantId, supabase),
      ]);

      setProject(prj);
      setTasks(prjTasks);
      setDependencies(prjDeps);
      setCalendar(prjCal);
      setHolidays(prjHols);
      setBaselines(prjBaselines);
      setPhases(prjPhases || []);

      if (sprintsRes.success && sprintsRes.data) {
        setSprints(sprintsRes.data);
      }
      if (docsRes.success && docsRes.data) {
        setDocuments(docsRes.data);
      }

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
            { id: 'graph', label: 'Graphify Network', icon: Sparkles },
            { id: 'sprint', label: `Agile Sprints (${sprints.length})`, icon: Flame },
            { id: 'wiki', label: `Living Docs (${documents.length})`, icon: Layers },
            { id: 'calendar', label: 'Calendar Schedule', icon: CalendarDays },
            { id: 'resource', label: 'Resource Heatmap', icon: Users },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeView === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveView(tab.id as any)}
                data-state={isActive ? 'active' : 'inactive'}
                className={`flex items-center gap-2 px-3.5 py-2 text-xs font-semibold border-b-2 transition-all cursor-pointer whitespace-nowrap data-[state=active]:border-[var(--primary)] data-[state=active]:text-[var(--primary)] ${
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

      {/* Active Viewport Rendering */}
      <div>
        {activeView === 'gantt' && (
          tasks.length === 0 ? (
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
            <InteractiveGantt
              tasks={tasks}
              dependencies={dependencies}
              baselineSnapshots={baselineSnapshots}
              calendar={calendar}
              holidays={holidays}
              onTaskUpdate={async (taskId, updates) => {
                setTasks((prev) =>
                  prev.map((t) => (t.id === taskId ? { ...t, ...updates } : t))
                );
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
              onSelectTask={(t) => setSelectedTaskForDrawer(t)}
            />
          )
        )}

        {activeView === 'kanban' && (
          <KanbanBoard
            tasks={tasks}
            onTaskUpdate={(taskId, updates) => {
              setTasks((prev) =>
                prev.map((t) => (t.id === taskId ? { ...t, ...updates } : t))
              );
            }}
            onSelectTask={(t) => setSelectedTaskForDrawer(t)}
          />
        )}

        {activeView === 'grid' && (
          <HierarchicalGrid
            tasks={tasks}
            onTaskUpdate={async (taskId, updates) => {
              setTasks((prev) =>
                prev.map((t) => (t.id === taskId ? { ...t, ...updates } : t))
              );
              await dbService.updateTask(taskId, updates, supabase);
              await refreshProjectData();
            }}
            onSelectTask={(t) => setSelectedTaskForDrawer(t)}
          />
        )}

        {activeView === 'graph' && (
          <GraphCanvas
            tasks={tasks}
            dependencies={dependencies}
            phases={phases}
            documents={documents}
            onSelectTask={(t) => setSelectedTaskForDrawer(t)}
            onCreateDependency={async (predId, succId, type) => {
              if (!projectId || !tenantId) return;
              await dbService.createDependency(
                {
                  project_id: projectId,
                  tenant_id: tenantId,
                  predecessor_id: predId,
                  successor_id: succId,
                  dependency_type: type,
                  lag_days: 0,
                },
                supabase
              );
              await refreshProjectData();
            }}
          />
        )}

        {activeView === 'sprint' && (
          <SprintPlanningView
            tasks={tasks}
            sprints={sprints}
            projectId={projectId}
            tenantId={tenantId || ''}
            onRefresh={refreshProjectData}
            onSelectTask={(t) => setSelectedTaskForDrawer(t)}
          />
        )}

        {activeView === 'wiki' && (
          <WikiWorkspace
            documents={documents}
            tasks={tasks}
            projectId={projectId}
            tenantId={tenantId || ''}
            onRefresh={refreshProjectData}
            onSelectTask={(t) => setSelectedTaskForDrawer(t)}
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

      {/* Interactive Task Detail Drawer */}
      <TaskDetailDrawer
        isOpen={!!selectedTaskForDrawer}
        task={selectedTaskForDrawer}
        onClose={() => setSelectedTaskForDrawer(null)}
        tenantId={tenantId || ''}
        projectId={projectId || ''}
        currentUserId={userId}
        currentUserProfile={currentUser}
        calendar={calendar}
        holidays={holidays}
        onTaskUpdate={async (taskId, updates) => {
          await dbService.updateTask(taskId, updates, supabase);
          if (selectedTaskForDrawer && selectedTaskForDrawer.id === taskId) {
            setSelectedTaskForDrawer((prev) => (prev ? { ...prev, ...updates } : null));
          }
          await refreshProjectData();
        }}
        onTaskDeleted={async () => {
          setSelectedTaskForDrawer(null);
          await refreshProjectData();
        }}
      />

      {/* Create Task Dialog */}
      <CreateTaskDialog
        isOpen={isAddTaskModalOpen}
        onClose={() => setIsAddTaskModalOpen(false)}
        projectId={projectId}
        tenantId={tenantId || ''}
        onTaskCreated={(newTask) => {
          setTasks((prev) => [...prev, newTask]);
          refreshProjectData();
        }}
      />

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

export default function ProjectWorkspacePage() {
  return (
    <React.Suspense
      fallback={
        <div className="flex h-96 items-center justify-center">
          <RefreshCw className="h-6 w-6 animate-spin text-[var(--primary)]" />
        </div>
      }
    >
      <ProjectWorkspaceContent />
    </React.Suspense>
  );
}
