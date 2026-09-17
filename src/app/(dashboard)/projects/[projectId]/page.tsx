'use client';

import * as React from 'react';
import { useParams } from 'next/navigation';
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
} from 'lucide-react';
import { useTenantStore } from '@/lib/stores/tenant-store';
import { db } from '@/lib/supabase/mock-db';
import {
  Task,
  TaskDependency,
  Project,
  WorkingCalendar,
  CalendarHoliday,
  ProjectBaseline,
  TaskBaselineSnapshot,
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

export default function ProjectWorkspacePage() {
  const params = useParams();
  const projectId = (params?.projectId as string) || 'd0000000-0000-0000-0000-000000000001';

  const { activeTenant, activeRole, currentUser } = useTenantStore();
  const [activeView, setActiveView] = React.useState<'gantt' | 'kanban' | 'grid' | 'calendar' | 'resource'>('gantt');

  // Local state initialized from db
  const [project, setProject] = React.useState<Project | null>(null);
  const [tasks, setTasks] = React.useState<Task[]>([]);
  const [dependencies, setDependencies] = React.useState<TaskDependency[]>([]);
  const [calendar, setCalendar] = React.useState<WorkingCalendar>(db.calendars[0]);
  const [holidays, setHolidays] = React.useState<CalendarHoliday[]>([]);

  // Baselines State
  const [baselines, setBaselines] = React.useState<ProjectBaseline[]>([]);
  const [selectedBaselineId, setSelectedBaselineId] = React.useState<string | null>(null);
  const [isBaselineModalOpen, setIsBaselineModalOpen] = React.useState(false);
  const [newBaselineName, setNewBaselineName] = React.useState('');
  const [newBaselineDescription, setNewBaselineDescription] = React.useState('');

  // Modals state
  const [exchangeMode, setExchangeMode] = React.useState<'import' | 'export' | null>(null);

  // Real-Time Collaboration Presence
  const { collaborators, activeTaskMap } = useProjectPresence(projectId, currentUser);

  // Load project and tasks data
  const refreshProjectData = React.useCallback(() => {
    const tenantId = activeTenant?.id || 'a0000000-0000-0000-0000-000000000001';
    const userId = currentUser?.id || 'b0000000-0000-0000-0000-000000000002';

    try {
      const prj = db.getProject(projectId, tenantId, userId, activeRole);
      setProject(prj);

      const prjTasks = db.getProjectTasksWithRelations(projectId, tenantId);
      setTasks([...prjTasks]);

      const prjDeps = db.dependencies.filter(d => d.project_id === projectId && d.tenant_id === tenantId);
      setDependencies([...prjDeps]);

      const cal = db.calendars.find(c => c.id === prj.calendar_id) || db.calendars[0];
      setCalendar(cal);

      const hols = db.holidays.filter(h => h.tenant_id === tenantId);
      setHolidays(hols);

      const bls = db.getProjectBaselines(projectId, tenantId);
      setBaselines([...bls]);
      if (bls.length > 0 && !selectedBaselineId) {
        setSelectedBaselineId(bls[0].id);
      }
    } catch (err) {
      console.error('Failed to load project:', err);
    }
  }, [projectId, activeTenant, currentUser, activeRole, selectedBaselineId]);

  React.useEffect(() => {
    refreshProjectData();
  }, [refreshProjectData]);

  // Baseline snapshots for Gantt Ghost Variance visualization
  const baselineSnapshots: TaskBaselineSnapshot[] = React.useMemo(() => {
    if (!selectedBaselineId) return [];
    return db.getBaselineSnapshots(selectedBaselineId);
  }, [selectedBaselineId, baselines]);

  // Task Update Handler (Optimistic with CPM sync)
  const handleTaskUpdate = (taskId: string, updates: Partial<Task>) => {
    const actorId = currentUser?.id || 'b0000000-0000-0000-0000-000000000002';
    const correlationId = `corr-${Date.now()}`;

    try {
      db.updateTask(taskId, updates, actorId, correlationId);
      refreshProjectData();
    } catch (err) {
      console.error('Task update failed:', err);
    }
  };

  // Add Dependency Handler
  const handleAddDependency = (depData: {
    predecessor_id: string;
    successor_id: string;
    type: 'FS' | 'SS' | 'FF' | 'SF';
    lag_days: number;
  }) => {
    const tenantId = activeTenant?.id || 'a0000000-0000-0000-0000-000000000001';
    const actorId = currentUser?.id || 'b0000000-0000-0000-0000-000000000002';
    const correlationId = `corr-${Date.now()}`;

    try {
      db.addDependency(
        {
          ...depData,
          project_id: projectId,
          tenant_id: tenantId,
        },
        actorId,
        correlationId
      );
      refreshProjectData();
    } catch (err) {
      alert((err as Error).message || 'Failed to create dependency');
    }
  };

  // Add Task Handler (Dynamic Priority)
  const handleAddTask = (newTask: {
    title: string;
    start_date: string;
    duration_days: number;
    priority: string;
    is_milestone: boolean;
  }) => {
    const tenantId = activeTenant?.id || 'a0000000-0000-0000-0000-000000000001';
    const actorId = currentUser?.id || 'b0000000-0000-0000-0000-000000000002';
    const correlationId = `corr-${Date.now()}`;

    try {
      db.createTask(
        {
          ...newTask,
          priority: newTask.priority as any,
          project_id: projectId,
          tenant_id: tenantId,
          phase_id: null,
          parent_id: null,
          description: null,
          status: 'todo',
          end_date: newTask.start_date, // will be computed in CPM
          progress_percent: 0,
          order_index: tasks.length + 1,
          created_by: actorId,
        },
        actorId,
        correlationId
      );
      refreshProjectData();
    } catch (err) {
      console.error('Failed to create task:', err);
    }
  };

  // Explicit CPM Recalculate Trigger
  const handleRecalculateCPM = () => {
    const tenantId = activeTenant?.id || 'a0000000-0000-0000-0000-000000000001';
    db.recalculateProjectCPM(projectId, tenantId);
    refreshProjectData();
  };

  // Create Baseline Handler
  const handleCreateBaseline = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBaselineName.trim()) return;

    const tenantId = activeTenant?.id || 'a0000000-0000-0000-0000-000000000001';
    const actorId = currentUser?.id || 'b0000000-0000-0000-0000-000000000002';

    const created = db.createProjectBaseline(
      projectId,
      newBaselineName.trim(),
      tenantId,
      actorId,
      newBaselineDescription.trim() || undefined
    );

    setSelectedBaselineId(created.id);
    setIsBaselineModalOpen(false);
    setNewBaselineName('');
    setNewBaselineDescription('');
    refreshProjectData();
  };

  const criticalTasksCount = tasks.filter(t => t.is_critical).length;

  if (!project) {
    return (
      <div className="flex items-center justify-center h-64 text-xs text-[var(--muted-foreground)]">
        Loading project workspace...
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-6.5rem)] space-y-4">
      {/* 1. Project Title and Meta Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Badge variant="outline" className="font-mono text-[10px]">
              {project.code}
            </Badge>
            <Badge variant={project.status === 'active' ? 'success' : 'secondary'} className="capitalize text-[10px]">
              {project.status}
            </Badge>
            {criticalTasksCount > 0 && (
              <Badge variant="critical" className="gap-1 text-[10px] py-0 px-2">
                <Flame className="h-3 w-3" />
                {criticalTasksCount} Critical Tasks
              </Badge>
            )}
          </div>
          <h1 className="text-xl font-bold text-[var(--foreground)] tracking-tight">
            {project.name}
          </h1>
        </div>

        {/* Global Action Buttons, Baselines & Presence */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Active Collaborators Presence Avatars */}
          <div className="flex items-center -space-x-2 mr-2">
            {collaborators.map((c) => (
              <div
                key={c.userId}
                title={`${c.userName} ${c.activeTaskId ? `(Viewing Task #${c.activeTaskId})` : '(Active)'}`}
                className="relative inline-flex items-center justify-center w-7 h-7 rounded-full text-[10px] font-bold text-white shadow-xs border-2 border-[var(--background)] transition-transform hover:scale-110 cursor-pointer"
                style={{ backgroundColor: c.color }}
              >
                {c.userName.split(' ').map(n => n[0]).join('').substring(0, 2)}
                <span className="absolute bottom-0 right-0 w-2 h-2 rounded-full bg-emerald-500 ring-1 ring-[var(--background)]" />
              </div>
            ))}
          </div>

          {/* Baseline Selector */}
          <div className="flex items-center gap-1.5 bg-[var(--card)] border border-[var(--border)] rounded-md px-2 py-1 shadow-2xs">
            <Bookmark className="h-3.5 w-3.5 text-[var(--primary)]" />
            <select
              value={selectedBaselineId || ''}
              onChange={(e) => setSelectedBaselineId(e.target.value || null)}
              className="bg-transparent text-xs text-[var(--foreground)] outline-hidden cursor-pointer"
            >
              <option value="">No Baseline (Live CPM)</option>
              {baselines.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name} ({new Date(b.created_at).toLocaleDateString()})
                </option>
              ))}
            </select>
            <button
              onClick={() => setIsBaselineModalOpen(true)}
              title="Lock Current Schedule as New Baseline"
              className="text-[10px] font-semibold text-[var(--primary)] hover:underline ml-1 cursor-pointer"
            >
              + Lock
            </button>
          </div>

          <Button
            size="sm"
            variant="outline"
            onClick={() => setExchangeMode('export')}
            className="gap-1.5 text-xs"
          >
            <Download className="h-3.5 w-3.5" />
            Export Schedule
          </Button>

          <Button
            size="sm"
            variant="outline"
            onClick={() => setExchangeMode('import')}
            className="gap-1.5 text-xs"
          >
            <Upload className="h-3.5 w-3.5" />
            Import (.xlsx)
          </Button>
        </div>
      </div>

      {/* 2. Synchronized View Navigation Tabs (5 Views) */}
      <div className="shrink-0">
        <Tabs
          activeTab={activeView}
          onChange={(id) => setActiveView(id as any)}
          items={[
            {
              id: 'gantt',
              label: 'Interactive Gantt & CPM',
              icon: <GanttChartSquare className="h-4 w-4" />,
            },
            {
              id: 'kanban',
              label: 'Kanban Board',
              icon: <Kanban className="h-4 w-4" />,
              count: tasks.length,
            },
            {
              id: 'grid',
              label: 'Hierarchical Grid',
              icon: <Table className="h-4 w-4" />,
            },
            {
              id: 'calendar',
              label: 'Calendar Schedule',
              icon: <CalendarDays className="h-4 w-4" />,
            },
            {
              id: 'resource',
              label: 'Resource Heatmap',
              icon: <Users className="h-4 w-4" />,
            },
          ]}
        />
      </div>

      {/* 3. Dynamic View Container */}
      <div className="flex-1 min-h-0">
        {activeView === 'gantt' && (
          <InteractiveGantt
            tasks={tasks}
            dependencies={dependencies}
            calendar={calendar}
            holidays={holidays}
            baselineSnapshots={baselineSnapshots}
            activeTaskMap={activeTaskMap}
            onTaskUpdate={handleTaskUpdate}
            onAddDependency={handleAddDependency}
            onAddTask={handleAddTask}
            onRecalculateCPM={handleRecalculateCPM}
            onOpenExportModal={() => setExchangeMode('export')}
            onOpenImportModal={() => setExchangeMode('import')}
          />
        )}

        {activeView === 'kanban' && (
          <KanbanBoard tasks={tasks} onTaskUpdate={handleTaskUpdate} />
        )}

        {activeView === 'grid' && (
          <HierarchicalGrid tasks={tasks} onTaskUpdate={handleTaskUpdate} />
        )}

        {activeView === 'calendar' && (
          <ProjectCalendarView tasks={tasks} calendar={calendar} holidays={holidays} />
        )}

        {activeView === 'resource' && (
          <ResourceHeatmapView
            tasks={tasks}
            assignees={db.assignees}
            users={db.users}
            calendar={calendar}
            holidays={holidays}
          />
        )}
      </div>

      {/* 4. Import / Export Modal */}
      <ImportExportModal
        mode={exchangeMode}
        isOpen={exchangeMode !== null}
        onClose={() => setExchangeMode(null)}
        project={project}
        tasks={tasks}
        dependencies={dependencies}
        onImportCompleted={refreshProjectData}
      />

      {/* 5. Lock Schedule Baseline Modal */}
      <Modal
        isOpen={isBaselineModalOpen}
        onClose={() => setIsBaselineModalOpen(false)}
        title="Lock New Schedule Baseline"
        description="Freezes current task dates, durations, and progress into an immutable benchmark for schedule variance tracking."
      >
        <form onSubmit={handleCreateBaseline} className="space-y-4 text-xs">
          <div>
            <label className="font-semibold block mb-1">Baseline Name</label>
            <Input
              value={newBaselineName}
              onChange={(e) => setNewBaselineName(e.target.value)}
              placeholder="e.g. Baseline 1.0 (Post-Sprint Planning)"
              required
            />
          </div>

          <div>
            <label className="font-semibold block mb-1">Description / Rationale (Optional)</label>
            <Input
              value={newBaselineDescription}
              onChange={(e) => setNewBaselineDescription(e.target.value)}
              placeholder="Approved timeline baseline following stakeholder review"
            />
          </div>

          <div className="p-3 bg-[var(--secondary)]/40 rounded-lg text-[11px] text-[var(--muted-foreground)] space-y-1">
            <div className="font-semibold text-[var(--foreground)]">Snapshotted Entities:</div>
            <div>• {tasks.length} Current Tasks & Durations</div>
            <div>• Critical Path & Float Statuses</div>
            <div>• Ghost Baseline overlay will appear on Gantt timeline</div>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-[var(--border)]">
            <Button type="button" variant="outline" onClick={() => setIsBaselineModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit">Lock Baseline</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
