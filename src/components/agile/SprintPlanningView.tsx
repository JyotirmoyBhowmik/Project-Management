// ==============================================================================
// src/components/agile/SprintPlanningView.tsx
// Agile & Sprint Framework (Hybrid Scrum + Waterfall, Drag-and-Drop Allocation)
// Complete with empty state, quick-move actions, and all 4 Agile SVG charts:
// Burndown, Burnup Scope, Velocity History, and Cumulative Flow Diagram (CFD).
// ==============================================================================

'use client';

import * as React from 'react';
import {
  Flame,
  Plus,
  Play,
  CheckCircle2,
  Calendar,
  Layers,
  TrendingUp,
  BarChart3,
  Activity,
  ArrowRight,
  ArrowLeft,
  Sparkles,
  Clock,
  Gauge,
  AlertTriangle,
} from 'lucide-react';
import { Task, ProjectSprint, AgileSprintMetrics } from '@/types/database';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Modal } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import {
  createSprintAction,
  startSprintAction,
  completeSprintAction,
  assignTaskToSprintAction,
  getSprintMetricsAction,
} from '@/actions/sprints';
import { formatDateToISO } from '@/lib/calendar/calendar-engine';
import { toast } from 'sonner';

interface SprintPlanningViewProps {
  tasks: Task[];
  sprints: ProjectSprint[];
  projectId: string;
  tenantId: string;
  onRefresh: () => Promise<void>;
  onSelectTask?: (task: Task) => void;
}

export function SprintPlanningView({
  tasks,
  sprints,
  projectId,
  tenantId,
  onRefresh,
  onSelectTask,
}: SprintPlanningViewProps) {
  const [activeSprintId, setActiveSprintId] = React.useState<string>(() => {
    const active = sprints.find((s) => s.status === 'active');
    return active?.id || sprints[0]?.id || '';
  });

  // Keep activeSprintId synced if sprints list changes
  React.useEffect(() => {
    if (!activeSprintId && sprints.length > 0) {
      const active = sprints.find((s) => s.status === 'active');
      setActiveSprintId(active?.id || sprints[0].id);
    } else if (activeSprintId && !sprints.some((s) => s.id === activeSprintId)) {
      setActiveSprintId(sprints[0]?.id || '');
    }
  }, [sprints, activeSprintId]);

  const [activeTab, setActiveTab] = React.useState<'board' | 'burndown' | 'burnup' | 'velocity' | 'cfd'>('board');
  const [metrics, setMetrics] = React.useState<AgileSprintMetrics | null>(null);
  const [isLoadingMetrics, setIsLoadingMetrics] = React.useState(false);

  // Modals
  const [isNewSprintModalOpen, setIsNewSprintModalOpen] = React.useState(false);
  const [isCompleteModalOpen, setIsCompleteModalOpen] = React.useState(false);
  const [newSprintName, setNewSprintName] = React.useState('');
  const [newSprintGoal, setNewSprintGoal] = React.useState('');
  const [newStartDate, setNewStartDate] = React.useState(() => formatDateToISO(new Date()));
  const [newEndDate, setNewEndDate] = React.useState(() => {
    const twoWeeks = new Date(Date.now() + 14 * 86400000);
    return formatDateToISO(twoWeeks);
  });
  const [rolloverTarget, setRolloverTarget] = React.useState<'next_sprint' | 'backlog'>('backlog');
  const [sprintCapacity, setSprintCapacity] = React.useState<number>(30);

  const activeSprint = sprints.find((s) => s.id === activeSprintId);
  const backlogTasks = tasks.filter((t) => !t.sprint_id);
  const sprintTasks = tasks.filter((t) => t.sprint_id === activeSprintId);

  const backlogPoints = backlogTasks.reduce((sum, t) => sum + (Number(t.story_points) || 1), 0);
  const sprintTotalPoints = sprintTasks.reduce((sum, t) => sum + (Number(t.story_points) || 1), 0);
  const sprintCompletedPoints = sprintTasks
    .filter((t) => t.status === 'completed' || t.status === 'done')
    .reduce((sum, t) => sum + (Number(t.story_points) || 1), 0);

  const incompleteTasks = sprintTasks.filter((t) => t.status !== 'completed' && t.status !== 'done');
  const incompletePoints = incompleteTasks.reduce((sum, t) => sum + (Number(t.story_points) || 1), 0);
  const nextSprint = sprints.find((s) => s.id !== activeSprintId && s.status === 'planning');

  const capacityPercent = sprintCapacity > 0 ? Math.round((sprintTotalPoints / sprintCapacity) * 100) : 0;
  const isOverloaded = sprintTotalPoints > sprintCapacity;

  // Load Metrics when tab changes
  React.useEffect(() => {
    if (activeSprintId && activeTab !== 'board') {
      setIsLoadingMetrics(true);
      getSprintMetricsAction(activeSprintId, projectId)
        .then((res) => {
          if (res.success && res.data) setMetrics(res.data);
        })
        .finally(() => setIsLoadingMetrics(false));
    }
  }, [activeSprintId, activeTab, projectId]);

  // Drag and drop handlers
  const handleDragStart = (e: React.DragEvent, taskId: string) => {
    e.dataTransfer.setData('text/plain', taskId);
  };

  const handleDrop = async (e: React.DragEvent, targetSprintId: string | null) => {
    e.preventDefault();
    const taskId = e.dataTransfer.getData('text/plain');
    if (!taskId) return;

    if (targetSprintId && sprints.length === 0) {
      toast.error('Please create a sprint first before adding tasks.');
      setIsNewSprintModalOpen(true);
      return;
    }

    try {
      const res = await assignTaskToSprintAction(taskId, targetSprintId, undefined, projectId);
      if (res.success) {
        toast.success(targetSprintId ? 'Task assigned to sprint' : 'Task returned to backlog');
        await onRefresh();
      } else {
        toast.error(res.error || 'Failed to reassign task');
      }
    } catch {
      toast.error('Network failure during sprint reassignment');
    }
  };

  const handleMoveTask = async (taskId: string, targetSprintId: string | null) => {
    if (targetSprintId && !activeSprintId) {
      toast.error('Please create or select a sprint first.');
      setIsNewSprintModalOpen(true);
      return;
    }
    try {
      const res = await assignTaskToSprintAction(taskId, targetSprintId, undefined, projectId);
      if (res.success) {
        toast.success(targetSprintId ? 'Task moved to Sprint' : 'Task returned to Backlog');
        await onRefresh();
      } else {
        toast.error(res.error || 'Failed to move task');
      }
    } catch {
      toast.error('Network error moving task');
    }
  };

  const handleCreateSprint = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSprintName.trim()) return;

    try {
      const res = await createSprintAction({
        tenant_id: tenantId,
        project_id: projectId,
        name: newSprintName.trim(),
        sprint_goal: newSprintGoal.trim() || null,
        start_date: newStartDate || formatDateToISO(new Date()),
        end_date: newEndDate || formatDateToISO(new Date(Date.now() + 14 * 86400000)),
      });

      if (res.success && res.data) {
        toast.success(`Sprint "${res.data.name}" created successfully`);
        setIsNewSprintModalOpen(false);
        setActiveSprintId(res.data.id);
        setNewSprintName('');
        setNewSprintGoal('');
        await onRefresh();
      } else {
        toast.error(res.error || 'Failed to create sprint');
      }
    } catch {
      toast.error('Failed to create sprint');
    }
  };

  const handleStartSprint = async () => {
    if (!activeSprintId) return;
    const res = await startSprintAction(activeSprintId, projectId);
    if (res.success) {
      toast.success('Sprint started successfully');
      await onRefresh();
    } else {
      toast.error(res.error || 'Failed to start sprint');
    }
  };

  const handleCompleteSprint = async () => {
    if (!activeSprintId) return;
    const nextSprint = sprints.find((s) => s.id !== activeSprintId && s.status === 'planning');
    const res = await completeSprintAction(
      activeSprintId,
      projectId,
      rolloverTarget,
      rolloverTarget === 'next_sprint' ? nextSprint?.id : undefined
    );

    if (res.success) {
      toast.success(`Sprint completed. ${res.data?.rolledOverTasks || 0} tasks rolled over.`);
      setIsCompleteModalOpen(false);
      await onRefresh();
    } else {
      toast.error(res.error || 'Failed to complete sprint');
    }
  };

  return (
    <div className="space-y-4">
      {/* Top Header & Sprint Selector */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[var(--card)] p-4 rounded-2xl border border-[var(--border)] shadow-xs">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-orange-500/10 flex items-center justify-center text-orange-500 shrink-0">
            <Flame className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold text-[var(--foreground)]">Agile & Sprint Hub</h2>
              {activeSprint && (
                <Badge
                  variant={activeSprint.status === 'active' ? 'default' : 'secondary'}
                  className="text-[10px] capitalize font-mono"
                >
                  {activeSprint.status}
                </Badge>
              )}
            </div>
            <p className="text-xs text-[var(--muted-foreground)]">
              {activeSprint?.sprint_goal || 'Sprint backlog planning, capacity velocity, and burndown schedule.'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Sprint Picker */}
          {sprints.length > 0 ? (
            <select
              value={activeSprintId}
              onChange={(e) => setActiveSprintId(e.target.value)}
              className="h-8 px-2.5 text-xs bg-[var(--secondary)] text-[var(--foreground)] border border-[var(--border)] rounded-lg font-medium cursor-pointer"
            >
              {sprints.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.status})
                </option>
              ))}
            </select>
          ) : (
            <span className="text-xs text-[var(--muted-foreground)] italic">No active sprints</span>
          )}

          {activeSprint?.status === 'planning' && (
            <Button
              size="sm"
              onClick={handleStartSprint}
              className="gap-1.5 text-xs h-8 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
            >
              <Play className="h-3.5 w-3.5 fill-current" />
              <span>Start Sprint</span>
            </Button>
          )}

          {activeSprint?.status === 'active' && (
            <Button
              size="sm"
              onClick={() => setIsCompleteModalOpen(true)}
              className="gap-1.5 text-xs h-8 bg-blue-600 hover:bg-blue-700 text-white font-semibold"
            >
              <CheckCircle2 className="h-3.5 w-3.5" />
              <span>Complete Sprint</span>
            </Button>
          )}

          <Button
            size="sm"
            variant="outline"
            onClick={() => setIsNewSprintModalOpen(true)}
            className="gap-1.5 text-xs h-8 font-semibold"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>New Sprint</span>
          </Button>
        </div>
      </div>

      {/* Sub-Navigation Tabs */}
      <div className="flex items-center gap-1 border-b border-[var(--border)] px-1 overflow-x-auto">
        {[
          { id: 'board', label: 'Sprint Planning', icon: Layers },
          { id: 'burndown', label: 'Burndown Chart', icon: Flame },
          { id: 'burnup', label: 'Burnup Scope', icon: TrendingUp },
          { id: 'velocity', label: 'Velocity History', icon: BarChart3 },
          { id: 'cfd', label: 'Cumulative Flow (CFD)', icon: Activity },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 px-3 py-2 text-xs font-semibold border-b-2 transition-all cursor-pointer whitespace-nowrap ${
                isActive
                  ? 'border-[var(--primary)] text-[var(--primary)]'
                  : 'border-transparent text-[var(--muted-foreground)] hover:text-[var(--foreground)]'
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* 1. Two-Pane Planning Board */}
      {activeTab === 'board' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Backlog Column */}
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => handleDrop(e, null)}
            className="flex flex-col h-[580px] bg-[var(--card)] border border-[var(--border)] rounded-2xl p-4 shadow-xs"
          >
            <div className="flex items-center justify-between pb-3 border-b border-[var(--border)] mb-3">
              <div className="flex items-center gap-2">
                <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--foreground)]">Product Backlog</h3>
                <Badge variant="secondary" className="text-[10px]">
                  {backlogTasks.length} tasks • {backlogPoints} pts
                </Badge>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto space-y-2 pr-1">
              {backlogTasks.length === 0 ? (
                <div className="text-center py-16 text-xs text-[var(--muted-foreground)] flex flex-col items-center gap-2">
                  <Layers className="h-8 w-8 opacity-30" />
                  <span>No unassigned backlog tasks.</span>
                </div>
              ) : (
                backlogTasks.map((t) => (
                  <div
                    key={t.id}
                    draggable
                    onDragStart={(e) => handleDragStart(e, t.id)}
                    onClick={() => onSelectTask?.(t)}
                    className="p-3 bg-[var(--secondary)]/40 hover:bg-[var(--secondary)]/70 border border-[var(--border)] rounded-xl cursor-grab active:cursor-grabbing transition-all space-y-2 group"
                  >
                    <div className="flex items-center justify-between text-[10px]">
                      <span className="font-mono font-bold text-[var(--primary)]">
                        {t.task_code || (t as any).code || 'TASK'}
                      </span>
                      <div className="flex items-center gap-1.5">
                        <Badge variant="outline" className="text-[9px] px-1.5 py-0 capitalize">
                          {t.priority}
                        </Badge>
                        {activeSprintId && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleMoveTask(t.id, activeSprintId);
                            }}
                            className="h-5 px-1.5 text-[10px] gap-1 opacity-0 group-hover:opacity-100 transition-opacity text-orange-400 hover:text-orange-300"
                            title="Move to Active Sprint"
                          >
                            <span>Sprint</span>
                            <ArrowRight className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                    </div>
                    <div className="text-xs font-semibold text-[var(--foreground)]">{t.title}</div>
                    <div className="flex items-center justify-between pt-1 text-[10px] text-[var(--muted-foreground)]">
                      <span>{t.duration_days || 1}d duration</span>
                      <span className="font-mono font-bold text-orange-400">{t.story_points || 1} pts</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Active Sprint Bucket */}
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => handleDrop(e, activeSprintId || null)}
            className="flex flex-col h-[580px] bg-[var(--card)] border border-[var(--border)] rounded-2xl p-4 shadow-xs"
          >
            <div className="flex items-center justify-between pb-3 border-b border-[var(--border)] mb-3">
              <div className="flex items-center gap-2">
                <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--foreground)]">
                  {activeSprint?.name || 'Sprint Bucket'}
                </h3>
                {activeSprint && (
                  <Badge variant="default" className="text-[10px]">
                    {sprintTasks.length} tasks • {sprintCompletedPoints}/{sprintTotalPoints} pts
                  </Badge>
                )}
              </div>
            </div>

            {/* Team Capacity & Velocity Meter */}
            {activeSprint && (
              <div className="mb-3 p-3 rounded-xl bg-[var(--secondary)]/40 border border-[var(--border)] space-y-2.5">
                {/* Team Capacity vs Planned Points */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-[11px]">
                    <div className="flex items-center gap-1.5 font-medium text-[var(--foreground)]">
                      <Gauge className="h-3.5 w-3.5 text-[var(--muted-foreground)]" />
                      <span>Sprint Capacity</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {isOverloaded && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-rose-500 bg-rose-500/10 px-1.5 py-0.5 rounded border border-rose-500/20">
                          <AlertTriangle className="h-2.5 w-2.5" /> Overload (+{sprintTotalPoints - sprintCapacity} pts)
                        </span>
                      )}
                      <span className="text-[10px] font-mono text-[var(--muted-foreground)]">
                        <strong className={isOverloaded ? 'text-rose-400 font-bold' : 'text-[var(--foreground)]'}>
                          {sprintTotalPoints}
                        </strong>{' '}
                        / {sprintCapacity} pts ({capacityPercent}%)
                      </span>
                    </div>
                  </div>
                  <div className="w-full bg-[var(--secondary)] rounded-full h-1.5 overflow-hidden">
                    <div
                      className={`h-1.5 rounded-full transition-all ${
                        isOverloaded
                          ? 'bg-rose-500'
                          : capacityPercent >= 80
                          ? 'bg-amber-500'
                          : 'bg-emerald-500'
                      }`}
                      style={{ width: `${Math.min(100, capacityPercent)}%` }}
                    />
                  </div>
                </div>

                {/* Delivery Burn Progress */}
                <div className="space-y-1 pt-1.5 border-t border-[var(--border)]/40">
                  <div className="flex justify-between text-[10px] text-[var(--muted-foreground)]">
                    <span>Delivery Progress</span>
                    <span className="font-mono">
                      {sprintTotalPoints > 0 ? Math.round((sprintCompletedPoints / sprintTotalPoints) * 100) : 0}% ({sprintCompletedPoints}/{sprintTotalPoints} pts)
                    </span>
                  </div>
                  <div className="w-full bg-[var(--secondary)] rounded-full h-1.5 overflow-hidden">
                    <div
                      className="bg-emerald-500 h-1.5 rounded-full transition-all"
                      style={{
                        width: `${
                          sprintTotalPoints > 0 ? (sprintCompletedPoints / sprintTotalPoints) * 100 : 0
                        }%`,
                      }}
                    />
                  </div>
                </div>
              </div>
            )}

            <div className="flex-1 overflow-y-auto space-y-2 pr-1">
              {!activeSprint ? (
                <div className="h-full flex flex-col items-center justify-center p-8 text-center border-2 border-dashed border-[var(--border)] rounded-xl space-y-3">
                  <Flame className="h-10 w-10 text-orange-500/40" />
                  <div className="font-bold text-xs text-[var(--foreground)]">No Sprint Created Yet</div>
                  <p className="text-[11px] text-[var(--muted-foreground)] max-w-xs">
                    Create your first sprint to start dragging backlog tasks into your delivery cycle.
                  </p>
                  <Button
                    size="sm"
                    onClick={() => setIsNewSprintModalOpen(true)}
                    className="gap-1.5 text-xs font-semibold"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    <span>Create First Sprint</span>
                  </Button>
                </div>
              ) : sprintTasks.length === 0 ? (
                <div className="text-center py-16 border-2 border-dashed border-[var(--border)] rounded-xl text-xs text-[var(--muted-foreground)] space-y-1">
                  <p className="font-semibold text-[var(--foreground)]">Drag tasks from the Product Backlog here</p>
                  <p className="text-[10px]">Or click &ldquo;Sprint →&rdquo; on any backlog card to assign.</p>
                </div>
              ) : (
                sprintTasks.map((t) => (
                  <div
                    key={t.id}
                    draggable
                    onDragStart={(e) => handleDragStart(e, t.id)}
                    onClick={() => onSelectTask?.(t)}
                    className="p-3 bg-[var(--secondary)]/40 hover:bg-[var(--secondary)]/70 border border-[var(--border)] rounded-xl cursor-grab active:cursor-grabbing transition-all space-y-2 group"
                  >
                    <div className="flex items-center justify-between text-[10px]">
                      <span className="font-mono font-bold text-[var(--primary)]">
                        {t.task_code || (t as any).code || 'TASK'}
                      </span>
                      <div className="flex items-center gap-1.5">
                        <span className="capitalize text-[10px] font-semibold text-emerald-400">{t.status}</span>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleMoveTask(t.id, null);
                          }}
                          className="h-5 px-1.5 text-[10px] gap-1 opacity-0 group-hover:opacity-100 transition-opacity text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
                          title="Return to Backlog"
                        >
                          <ArrowLeft className="h-3 w-3" />
                          <span>Backlog</span>
                        </Button>
                      </div>
                    </div>
                    <div className="text-xs font-semibold text-[var(--foreground)]">{t.title}</div>
                    <div className="flex items-center justify-between pt-1 text-[10px] text-[var(--muted-foreground)]">
                      <span>{t.duration_days || 1}d duration</span>
                      <span className="font-mono font-bold text-orange-400">{t.story_points || 1} pts</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* 2. Agile Charts Rendering */}
      {activeTab !== 'board' && (
        <div className="bg-[var(--card)] p-6 rounded-2xl border border-[var(--border)] shadow-xs min-h-[420px]">
          {isLoadingMetrics ? (
            <div className="py-28 text-center text-xs text-[var(--muted-foreground)] flex flex-col items-center gap-2">
              <Clock className="h-6 w-6 animate-spin text-orange-500" />
              <span>Computing sprint metrics and capacity burn...</span>
            </div>
          ) : !activeSprint ? (
            <div className="py-28 text-center text-xs text-[var(--muted-foreground)] flex flex-col items-center gap-2">
              <Flame className="h-8 w-8 opacity-30" />
              <span>Please create a sprint first to visualize metrics and velocity charts.</span>
              <Button size="sm" onClick={() => setIsNewSprintModalOpen(true)} className="mt-2 text-xs">
                Create First Sprint
              </Button>
            </div>
          ) : !metrics ? (
            <div className="py-28 text-center text-xs text-[var(--muted-foreground)]">
              No metrics available for {activeSprint.name}.
            </div>
          ) : (
            <div>
              <div className="flex justify-between items-center mb-6">
                <div>
                  <h3 className="text-sm font-bold text-[var(--foreground)] capitalize">
                    {activeTab === 'burndown' && 'Burndown Schedule Chart'}
                    {activeTab === 'burnup' && 'Burnup Scope & Progress Curve'}
                    {activeTab === 'velocity' && 'Historical Velocity Chart'}
                    {activeTab === 'cfd' && 'Cumulative Flow Diagram (CFD)'}
                  </h3>
                  <p className="text-xs text-[var(--muted-foreground)]">
                    Sprint: <strong className="text-[var(--foreground)]">{metrics.sprint.name}</strong> •{' '}
                    {metrics.sprint.total_story_points} points committed
                  </p>
                </div>
              </div>

              {/* Chart 1: Burndown Chart */}
              {activeTab === 'burndown' && (
                <div className="space-y-4">
                  <div className="h-64 flex items-end gap-2 pt-6 border-b border-[var(--border)] px-4">
                    {metrics.burndown.map((pt, idx) => {
                      const maxVal = Math.max(...metrics.burndown.map((b) => b.ideal_remaining), 10);
                      const idealHeight = (pt.ideal_remaining / maxVal) * 100;
                      const actHeight = (pt.actual_remaining / maxVal) * 100;
                      return (
                        <div key={idx} className="flex-1 flex flex-col items-center gap-1 h-full justify-end">
                          <div className="w-full flex justify-center gap-1 items-end h-full">
                            <div
                              className="w-2 bg-blue-500/40 rounded-t"
                              style={{ height: `${idealHeight}%` }}
                              title={`Ideal: ${pt.ideal_remaining} pts`}
                            />
                            <div
                              className="w-2 bg-orange-500 rounded-t"
                              style={{ height: `${actHeight}%` }}
                              title={`Actual: ${pt.actual_remaining} pts`}
                            />
                          </div>
                          <span className="text-[9px] text-[var(--muted-foreground)] truncate max-w-[36px]">
                            {pt.date.slice(5)}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                  <div className="flex justify-center gap-6 text-xs text-[var(--muted-foreground)]">
                    <div className="flex items-center gap-1.5">
                      <span className="h-2.5 w-2.5 bg-blue-500/50 rounded-xs" /> Ideal Burndown
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="h-2.5 w-2.5 bg-orange-500 rounded-xs" /> Actual Remaining
                    </div>
                  </div>
                </div>
              )}

              {/* Chart 2: Burnup Scope Chart */}
              {activeTab === 'burnup' && (
                <div className="space-y-4">
                  <div className="h-64 flex items-end gap-2 pt-6 border-b border-[var(--border)] px-4">
                    {metrics.burnup.map((pt, idx) => {
                      const maxScope = Math.max(...metrics.burnup.map((b) => b.total_scope), 10);
                      const scopeHeight = (pt.total_scope / maxScope) * 100;
                      const compHeight = (pt.completed_points / maxScope) * 100;
                      return (
                        <div key={idx} className="flex-1 flex flex-col items-center gap-1 h-full justify-end">
                          <div className="w-full flex justify-center gap-1 items-end h-full">
                            <div
                              className="w-2 bg-slate-500/40 rounded-t"
                              style={{ height: `${scopeHeight}%` }}
                              title={`Total Scope: ${pt.total_scope} pts`}
                            />
                            <div
                              className="w-2 bg-emerald-500 rounded-t"
                              style={{ height: `${compHeight}%` }}
                              title={`Completed: ${pt.completed_points} pts`}
                            />
                          </div>
                          <span className="text-[9px] text-[var(--muted-foreground)] truncate max-w-[36px]">
                            {pt.date.slice(5)}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                  <div className="flex justify-center gap-6 text-xs text-[var(--muted-foreground)]">
                    <div className="flex items-center gap-1.5">
                      <span className="h-2.5 w-2.5 bg-slate-500/50 rounded-xs" /> Total Scope
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="h-2.5 w-2.5 bg-emerald-500 rounded-xs" /> Completed Points
                    </div>
                  </div>
                </div>
              )}

              {/* Chart 3: Velocity History */}
              {activeTab === 'velocity' && (
                <div className="space-y-4">
                  <div className="h-64 flex items-end gap-6 pt-6 border-b border-[var(--border)] px-6">
                    {metrics.velocity_history.length === 0 ? (
                      <div className="w-full text-center py-20 text-xs text-[var(--muted-foreground)]">
                        No previous completed sprints to compare velocity.
                      </div>
                    ) : (
                      metrics.velocity_history.map((vh, idx) => (
                        <div key={idx} className="flex-1 flex flex-col items-center gap-1.5 h-full justify-end">
                          <div
                            className="w-12 bg-emerald-500 rounded-t shadow-xs transition-all hover:bg-emerald-400"
                            style={{ height: `${Math.min(100, Math.max(10, vh.points * 3))}%` }}
                            title={`${vh.sprint_name}: ${vh.points} pts`}
                          />
                          <span className="text-xs font-bold font-mono text-[var(--foreground)]">{vh.points} pts</span>
                          <span className="text-[10px] text-[var(--muted-foreground)] truncate max-w-[90px]">
                            {vh.sprint_name}
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                  <div className="flex justify-center text-xs text-[var(--muted-foreground)]">
                    <span>Delivered Story Points across Recent Sprints</span>
                  </div>
                </div>
              )}

              {/* Chart 4: Cumulative Flow Diagram (CFD) */}
              {activeTab === 'cfd' && (
                <div className="space-y-4">
                  <div className="h-64 flex items-end gap-2 pt-6 border-b border-[var(--border)] px-4">
                    {metrics.cfd.map((pt, idx) => {
                      const totalCount = Math.max(1, pt.todo + pt.in_progress + pt.in_review + pt.completed);
                      const completedPct = (pt.completed / totalCount) * 100;
                      const reviewPct = (pt.in_review / totalCount) * 100;
                      const inProgPct = (pt.in_progress / totalCount) * 100;
                      const todoPct = (pt.todo / totalCount) * 100;

                      return (
                        <div key={idx} className="flex-1 flex flex-col items-center gap-1 h-full justify-end">
                          {/* Stacked Bar */}
                          <div className="w-full flex flex-col items-stretch h-full justify-end rounded-t overflow-hidden">
                            <div className="bg-slate-500/40" style={{ height: `${todoPct}%` }} title={`Todo: ${pt.todo}`} />
                            <div className="bg-blue-500" style={{ height: `${inProgPct}%` }} title={`In Progress: ${pt.in_progress}`} />
                            <div className="bg-purple-500" style={{ height: `${reviewPct}%` }} title={`In Review: ${pt.in_review}`} />
                            <div className="bg-emerald-500" style={{ height: `${completedPct}%` }} title={`Completed: ${pt.completed}`} />
                          </div>
                          <span className="text-[9px] text-[var(--muted-foreground)] truncate max-w-[36px]">
                            {pt.date.slice(5)}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                  <div className="flex justify-center gap-4 text-xs text-[var(--muted-foreground)] flex-wrap">
                    <div className="flex items-center gap-1.5">
                      <span className="h-2.5 w-2.5 bg-slate-500/50 rounded-xs" /> To Do
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="h-2.5 w-2.5 bg-blue-500 rounded-xs" /> In Progress
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="h-2.5 w-2.5 bg-purple-500 rounded-xs" /> In Review
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="h-2.5 w-2.5 bg-emerald-500 rounded-xs" /> Completed
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* New Sprint Modal */}
      <Modal isOpen={isNewSprintModalOpen} onClose={() => setIsNewSprintModalOpen(false)} title="Create New Sprint">
        <form onSubmit={handleCreateSprint} className="space-y-3">
          <div>
            <label className="text-xs font-semibold text-[var(--foreground)]">Sprint Name *</label>
            <Input
              value={newSprintName}
              onChange={(e) => setNewSprintName(e.target.value)}
              placeholder="e.g. Sprint 1 - Core Platform"
              required
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-[var(--foreground)]">Sprint Goal</label>
            <Input
              value={newSprintGoal}
              onChange={(e) => setNewSprintGoal(e.target.value)}
              placeholder="e.g. Deliver WBS hierarchy, Wiki tree & Milestone engine"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs font-semibold text-[var(--foreground)]">Start Date</label>
              <Input
                type="date"
                value={newStartDate}
                onChange={(e) => setNewStartDate(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-[var(--foreground)]">End Date</label>
              <Input
                type="date"
                value={newEndDate}
                onChange={(e) => setNewEndDate(e.target.value)}
                required
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-3 border-t border-[var(--border)]">
            <Button type="button" variant="outline" onClick={() => setIsNewSprintModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={!newSprintName.trim()}>
              Create Sprint
            </Button>
          </div>
        </form>
      </Modal>

      {/* Complete Sprint Modal */}
      <Modal isOpen={isCompleteModalOpen} onClose={() => setIsCompleteModalOpen(false)} title="Complete Sprint">
        <div className="space-y-4">
          {incompleteTasks.length === 0 ? (
            <div className="p-3.5 bg-emerald-500/10 border border-emerald-500/30 rounded-xl flex items-center gap-3 text-xs text-emerald-400">
              <CheckCircle2 className="h-5 w-5 shrink-0" />
              <div>
                <p className="font-semibold text-sm">All sprint tasks completed!</p>
                <p className="text-[11px] text-emerald-400/80">Every task in this sprint has been finished. No task rollover required.</p>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl flex items-start gap-2.5 text-xs text-amber-400">
                <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                <div className="space-y-0.5">
                  <p className="font-semibold">
                    {incompleteTasks.length} incomplete task{incompleteTasks.length !== 1 ? 's' : ''} ({incompletePoints} pts) remaining
                  </p>
                  <p className="text-[11px] text-amber-400/80">
                    These tasks will not be marked as completed. Choose where they should be moved:
                  </p>
                </div>
              </div>

              {/* Incomplete Tasks Preview List */}
              <div className="border border-[var(--border)] rounded-xl overflow-hidden">
                <div className="bg-[var(--secondary)]/60 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--muted-foreground)] flex justify-between">
                  <span>Task</span>
                  <span>Estimate</span>
                </div>
                <div className="max-h-36 overflow-y-auto divide-y divide-[var(--border)]">
                  {incompleteTasks.map((t) => (
                    <div key={t.id} className="px-3 py-2 text-xs flex items-center justify-between hover:bg-[var(--secondary)]/30">
                      <div className="flex items-center gap-2 min-w-0 pr-2">
                        <span className="font-mono text-[10px] font-bold text-[var(--primary)] shrink-0">
                          {t.task_code || (t as any).code || 'TASK'}
                        </span>
                        <span className="truncate text-[var(--foreground)] text-xs">{t.title}</span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <Badge variant="outline" className="text-[9px] px-1.5 py-0 capitalize">
                          {t.status}
                        </Badge>
                        <span className="font-mono text-[10px] font-bold text-orange-400">
                          {t.story_points || 1} pts
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Rollover Destination Option Cards */}
              <div className="space-y-2">
                <label className="text-xs font-semibold text-[var(--foreground)]">Rollover Destination</label>
                <div className="space-y-2">
                  <div
                    onClick={() => setRolloverTarget('backlog')}
                    className={`p-3 rounded-xl border cursor-pointer transition-all flex items-start gap-3 ${
                      rolloverTarget === 'backlog'
                        ? 'border-[var(--primary)] bg-[var(--primary)]/5 ring-1 ring-[var(--primary)]/30'
                        : 'border-[var(--border)] bg-[var(--card)] hover:bg-[var(--secondary)]/50'
                    }`}
                  >
                    <input
                      type="radio"
                      name="rollover"
                      value="backlog"
                      checked={rolloverTarget === 'backlog'}
                      onChange={() => setRolloverTarget('backlog')}
                      className="mt-0.5 cursor-pointer"
                    />
                    <div className="text-xs space-y-0.5">
                      <div className="font-semibold text-[var(--foreground)]">Product Backlog</div>
                      <p className="text-[11px] text-[var(--muted-foreground)]">
                        Return incomplete tasks to the unassigned backlog for future sprint cycles.
                      </p>
                    </div>
                  </div>

                  <div
                    onClick={() => {
                      if (nextSprint) setRolloverTarget('next_sprint');
                    }}
                    className={`p-3 rounded-xl border transition-all flex items-start gap-3 ${
                      !nextSprint
                        ? 'opacity-50 cursor-not-allowed border-[var(--border)] bg-[var(--secondary)]/20'
                        : rolloverTarget === 'next_sprint'
                        ? 'border-[var(--primary)] bg-[var(--primary)]/5 ring-1 ring-[var(--primary)]/30 cursor-pointer'
                        : 'border-[var(--border)] bg-[var(--card)] hover:bg-[var(--secondary)]/50 cursor-pointer'
                    }`}
                  >
                    <input
                      type="radio"
                      name="rollover"
                      value="next_sprint"
                      disabled={!nextSprint}
                      checked={rolloverTarget === 'next_sprint'}
                      onChange={() => {
                        if (nextSprint) setRolloverTarget('next_sprint');
                      }}
                      className="mt-0.5 cursor-pointer"
                    />
                    <div className="text-xs space-y-0.5">
                      <div className="font-semibold text-[var(--foreground)] flex items-center gap-2">
                        <span>Next Planned Sprint</span>
                        {nextSprint && (
                          <Badge variant="outline" className="text-[10px] font-normal">
                            {nextSprint.name}
                          </Badge>
                        )}
                      </div>
                      <p className="text-[11px] text-[var(--muted-foreground)]">
                        {nextSprint
                          ? `Directly transfer unfinished tasks into "${nextSprint.name}".`
                          : 'No upcoming sprint in planning status found. Create a new sprint to enable rollover.'}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-3 border-t border-[var(--border)]">
            <Button variant="outline" onClick={() => setIsCompleteModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCompleteSprint} className="bg-blue-600 hover:bg-blue-700 text-white font-semibold">
              Complete Sprint
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
