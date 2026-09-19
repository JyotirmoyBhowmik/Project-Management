// ==============================================================================
// src/components/agile/SprintPlanningView.tsx
// Agile & Sprint Framework (Hybrid Scrum + Waterfall, Drag-and-Drop Allocation)
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
  AlertCircle,
  MoreHorizontal,
  ChevronRight,
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

  const [activeTab, setActiveTab] = React.useState<'board' | 'burndown' | 'burnup' | 'velocity' | 'cfd'>('board');
  const [metrics, setMetrics] = React.useState<AgileSprintMetrics | null>(null);
  const [isLoadingMetrics, setIsLoadingMetrics] = React.useState(false);

  // Modals
  const [isNewSprintModalOpen, setIsNewSprintModalOpen] = React.useState(false);
  const [isCompleteModalOpen, setIsCompleteModalOpen] = React.useState(false);
  const [newSprintName, setNewSprintName] = React.useState('');
  const [newSprintGoal, setNewSprintGoal] = React.useState('');
  const [newStartDate, setNewStartDate] = React.useState('');
  const [newEndDate, setNewEndDate] = React.useState('');
  const [rolloverTarget, setRolloverTarget] = React.useState<'next_sprint' | 'backlog'>('backlog');

  const activeSprint = sprints.find((s) => s.id === activeSprintId);
  const backlogTasks = tasks.filter((t) => !t.sprint_id);
  const sprintTasks = tasks.filter((t) => t.sprint_id === activeSprintId);

  const backlogPoints = backlogTasks.reduce((sum, t) => sum + (Number(t.story_points) || 1), 0);
  const sprintTotalPoints = sprintTasks.reduce((sum, t) => sum + (Number(t.story_points) || 1), 0);
  const sprintCompletedPoints = sprintTasks
    .filter((t) => t.status === 'completed' || t.status === 'done')
    .reduce((sum, t) => sum + (Number(t.story_points) || 1), 0);

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

    try {
      const res = await assignTaskToSprintAction(taskId, targetSprintId, undefined, projectId);
      if (res.success) {
        toast.success(targetSprintId ? 'Task moved to Sprint' : 'Task moved to Backlog');
        await onRefresh();
      } else {
        toast.error(res.error || 'Failed to reassign task');
      }
    } catch {
      toast.error('Network failure during sprint reassignment');
    }
  };

  const handleCreateSprint = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await createSprintAction({
        tenant_id: tenantId,
        project_id: projectId,
        name: newSprintName,
        sprint_goal: newSprintGoal,
        start_date: newStartDate || new Date().toISOString(),
        end_date: newEndDate || new Date(Date.now() + 14 * 86400000).toISOString(),
      });

      if (res.success && res.data) {
        toast.success(`Sprint ${res.data.name} created!`);
        setIsNewSprintModalOpen(false);
        setActiveSprintId(res.data.id);
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
      toast.success('Sprint started!');
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
          <div className="h-10 w-10 rounded-xl bg-orange-500/10 flex items-center justify-center text-orange-500">
            <Flame className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold text-[var(--foreground)]">Agile & Sprint Hub</h2>
              {activeSprint && (
                <Badge
                  variant={activeSprint.status === 'active' ? 'default' : 'secondary'}
                  className="text-[10px] capitalize"
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
          {sprints.length > 0 && (
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
          )}

          {activeSprint?.status === 'planning' && (
            <Button size="sm" onClick={handleStartSprint} className="gap-1.5 text-xs h-8 bg-emerald-600 hover:bg-emerald-700 text-white">
              <Play className="h-3.5 w-3.5 fill-current" />
              <span>Start Sprint</span>
            </Button>
          )}

          {activeSprint?.status === 'active' && (
            <Button size="sm" onClick={() => setIsCompleteModalOpen(true)} className="gap-1.5 text-xs h-8 bg-blue-600 hover:bg-blue-700 text-white">
              <CheckCircle2 className="h-3.5 w-3.5" />
              <span>Complete Sprint</span>
            </Button>
          )}

          <Button size="sm" variant="outline" onClick={() => setIsNewSprintModalOpen(true)} className="gap-1.5 text-xs h-8">
            <Plus className="h-3.5 w-3.5" />
            <span>New Sprint</span>
          </Button>
        </div>
      </div>

      {/* Sub-Navigation Tabs */}
      <div className="flex items-center gap-1 border-b border-[var(--border)] px-1">
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
              className={`flex items-center gap-2 px-3 py-2 text-xs font-semibold border-b-2 transition-all cursor-pointer ${
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
                <div className="text-center py-12 text-xs text-[var(--muted-foreground)]">
                  No unassigned backlog tasks.
                </div>
              ) : (
                backlogTasks.map((t) => (
                  <div
                    key={t.id}
                    draggable
                    onDragStart={(e) => handleDragStart(e, t.id)}
                    onClick={() => onSelectTask?.(t)}
                    className="p-3 bg-[var(--secondary)]/40 hover:bg-[var(--secondary)]/70 border border-[var(--border)] rounded-xl cursor-grab active:cursor-grabbing transition-all space-y-2"
                  >
                    <div className="flex items-center justify-between text-[10px]">
                      <span className="font-mono font-bold text-[var(--primary)]">{t.task_code || 'TASK'}</span>
                      <Badge variant="outline" className="text-[9px] px-1.5 py-0 capitalize">
                        {t.priority}
                      </Badge>
                    </div>
                    <div className="text-xs font-semibold text-[var(--foreground)]">{t.title}</div>
                    <div className="flex items-center justify-between pt-1 text-[10px] text-[var(--muted-foreground)]">
                      <span>{t.duration_days}d duration</span>
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
                <Badge variant="default" className="text-[10px]">
                  {sprintTasks.length} tasks • {sprintCompletedPoints}/{sprintTotalPoints} pts
                </Badge>
              </div>
            </div>

            {/* Velocity Progress Bar */}
            <div className="mb-3 space-y-1">
              <div className="flex justify-between text-[10px] text-[var(--muted-foreground)]">
                <span>Sprint Progress</span>
                <span>{sprintTotalPoints > 0 ? Math.round((sprintCompletedPoints / sprintTotalPoints) * 100) : 0}%</span>
              </div>
              <div className="w-full bg-[var(--secondary)] rounded-full h-2 overflow-hidden">
                <div
                  className="bg-emerald-500 h-2 rounded-full transition-all"
                  style={{ width: `${sprintTotalPoints > 0 ? (sprintCompletedPoints / sprintTotalPoints) * 100 : 0}%` }}
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto space-y-2 pr-1">
              {sprintTasks.length === 0 ? (
                <div className="text-center py-16 border-2 border-dashed border-[var(--border)] rounded-xl text-xs text-[var(--muted-foreground)] space-y-1">
                  <p>Drag tasks from the Product Backlog here</p>
                  <p className="text-[10px]">Tasks added will automatically track towards sprint burndown</p>
                </div>
              ) : (
                sprintTasks.map((t) => (
                  <div
                    key={t.id}
                    draggable
                    onDragStart={(e) => handleDragStart(e, t.id)}
                    onClick={() => onSelectTask?.(t)}
                    className="p-3 bg-[var(--secondary)]/40 hover:bg-[var(--secondary)]/70 border border-[var(--border)] rounded-xl cursor-grab active:cursor-grabbing transition-all space-y-2"
                  >
                    <div className="flex items-center justify-between text-[10px]">
                      <span className="font-mono font-bold text-[var(--primary)]">{t.task_code || 'TASK'}</span>
                      <span className="capitalize text-[10px] font-semibold text-emerald-400">{t.status}</span>
                    </div>
                    <div className="text-xs font-semibold text-[var(--foreground)]">{t.title}</div>
                    <div className="flex items-center justify-between pt-1 text-[10px] text-[var(--muted-foreground)]">
                      <span>{t.duration_days}d duration</span>
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
        <div className="bg-[var(--card)] p-6 rounded-2xl border border-[var(--border)] shadow-xs min-h-[400px]">
          {isLoadingMetrics ? (
            <div className="py-24 text-center text-xs text-[var(--muted-foreground)]">Loading sprint metrics...</div>
          ) : !metrics ? (
            <div className="py-24 text-center text-xs text-[var(--muted-foreground)]">No sprint metrics available yet.</div>
          ) : (
            <div>
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-sm font-bold text-[var(--foreground)] capitalize">{activeTab} Chart</h3>
                <span className="text-xs text-[var(--muted-foreground)] font-mono">Sprint: {metrics.sprint.name}</span>
              </div>

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
                            <div className="w-2 bg-blue-500/40 rounded-t" style={{ height: `${idealHeight}%` }} title={`Ideal: ${pt.ideal_remaining}`} />
                            <div className="w-2 bg-orange-500 rounded-t" style={{ height: `${actHeight}%` }} title={`Actual: ${pt.actual_remaining}`} />
                          </div>
                          <span className="text-[9px] text-[var(--muted-foreground)] truncate max-w-[36px]">{pt.date.slice(5)}</span>
                        </div>
                      );
                    })}
                  </div>
                  <div className="flex justify-center gap-6 text-xs text-[var(--muted-foreground)]">
                    <div className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 bg-blue-500/50 rounded-xs" /> Ideal Burndown</div>
                    <div className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 bg-orange-500 rounded-xs" /> Actual Remaining</div>
                  </div>
                </div>
              )}

              {activeTab === 'velocity' && (
                <div className="space-y-4">
                  <div className="h-64 flex items-end gap-4 pt-6 border-b border-[var(--border)] px-4">
                    {metrics.velocity_history.map((vh, idx) => (
                      <div key={idx} className="flex-1 flex flex-col items-center gap-1 h-full justify-end">
                        <div className="w-8 bg-emerald-500 rounded-t" style={{ height: `${Math.min(100, vh.points * 3)}%` }} />
                        <span className="text-xs font-bold font-mono">{vh.points}</span>
                        <span className="text-[10px] text-[var(--muted-foreground)]">{vh.sprint_name}</span>
                      </div>
                    ))}
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
            <label className="text-xs font-semibold">Sprint Name</label>
            <Input value={newSprintName} onChange={(e) => setNewSprintName(e.target.value)} placeholder="e.g. Sprint 15" required />
          </div>
          <div>
            <label className="text-xs font-semibold">Sprint Goal</label>
            <Input value={newSprintGoal} onChange={(e) => setNewSprintGoal(e.target.value)} placeholder="e.g. Complete User Auth & Graph Engine" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs font-semibold">Start Date</label>
              <Input type="date" value={newStartDate} onChange={(e) => setNewStartDate(e.target.value)} />
            </div>
            <div>
              <label className="text-xs font-semibold">End Date</label>
              <Input type="date" value={newEndDate} onChange={(e) => setNewEndDate(e.target.value)} />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-3">
            <Button type="button" variant="outline" onClick={() => setIsNewSprintModalOpen(false)}>Cancel</Button>
            <Button type="submit">Create Sprint</Button>
          </div>
        </form>
      </Modal>

      {/* Complete Sprint Modal */}
      <Modal isOpen={isCompleteModalOpen} onClose={() => setIsCompleteModalOpen(false)} title="Complete Sprint">
        <div className="space-y-4">
          <p className="text-xs text-[var(--muted-foreground)]">
            Select what should happen with incomplete tasks remaining in this sprint.
          </p>
          <div className="space-y-2 text-xs">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="rollover"
                value="backlog"
                checked={rolloverTarget === 'backlog'}
                onChange={() => setRolloverTarget('backlog')}
              />
              <span>Move incomplete tasks back to Product Backlog</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="rollover"
                value="next_sprint"
                checked={rolloverTarget === 'next_sprint'}
                onChange={() => setRolloverTarget('next_sprint')}
              />
              <span>Roll over to next upcoming sprint</span>
            </label>
          </div>
          <div className="flex justify-end gap-2 pt-3">
            <Button variant="outline" onClick={() => setIsCompleteModalOpen(false)}>Cancel</Button>
            <Button onClick={handleCompleteSprint}>Complete Sprint</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
