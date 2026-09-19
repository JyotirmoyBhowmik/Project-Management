// ==============================================================================
// src/app/(dashboard)/timesheets/page.tsx
// Timesheets, Manager Approvals & Financial EVM (Earned Value Management)
// ==============================================================================

'use client';

import * as React from 'react';
import {
  Clock,
  Calendar,
  CheckCircle2,
  XCircle,
  TrendingUp,
  DollarSign,
  AlertTriangle,
  Plus,
  Send,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  Filter,
} from 'lucide-react';
import { useTenantStore } from '@/lib/stores/tenant-store';
import { createClient } from '@/lib/supabase/client';
import { TaskTimeLog, EVMMetrics, Task } from '@/types/database';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  logTimeAction,
  updateTimesheetApprovalAction,
  getTimesheetsAction,
  getProjectEVMMetricsAction,
} from '@/actions/timesheets';
import { toast } from 'sonner';

export default function TimesheetsPage() {
  const { activeTenant, activeRole, currentUser } = useTenantStore();
  const tenantId = activeTenant?.id;
  const isManager = ['owner', 'admin', 'project_manager'].includes(activeRole) || Boolean(currentUser?.is_superadmin);

  const [activeTab, setActiveTab] = React.useState<'my_timesheet' | 'approvals' | 'evm'>('my_timesheet');
  const [logs, setLogs] = React.useState<TaskTimeLog[]>([]);
  const [tasks, setTasks] = React.useState<Task[]>([]);
  const [evmMetrics, setEvmMetrics] = React.useState<EVMMetrics | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);

  // Time logging form
  const [selectedTaskId, setSelectedTaskId] = React.useState('');
  const [logDate, setLogDate] = React.useState(new Date().toISOString().split('T')[0]);
  const [hoursSpent, setHoursSpent] = React.useState('8');
  const [description, setDescription] = React.useState('');
  const [isBillable, setIsBillable] = React.useState(true);
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  // Load Data
  const loadData = React.useCallback(async () => {
    if (!tenantId) return;
    setIsLoading(true);
    try {
      const supabase = createClient();
      // Fetch assigned tasks for user
      const { data: userTasks } = await supabase
        .from('tasks')
        .select('id, title, task_code, project_id, duration_days')
        .eq('tenant_id', tenantId)
        .is('deleted_at', null);

      setTasks((userTasks || []) as Task[]);

      // Fetch Timesheets
      const res = await getTimesheetsAction(tenantId);
      if (res.success && res.data) {
        setLogs(res.data);
      }

      // If userTasks exist, fetch EVM metrics for first project
      if (userTasks && userTasks.length > 0 && userTasks[0].project_id) {
        const evmRes = await getProjectEVMMetricsAction(userTasks[0].project_id, tenantId);
        if (evmRes.success && evmRes.data) {
          setEvmMetrics(evmRes.data);
        }
      }
    } finally {
      setIsLoading(false);
    }
  }, [tenantId]);

  React.useEffect(() => {
    loadData();
  }, [loadData]);

  const handleLogTime = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tenantId || !selectedTaskId) {
      toast.error('Please select a task');
      return;
    }

    const task = tasks.find((t) => t.id === selectedTaskId);
    if (!task) return;

    setIsSubmitting(true);
    try {
      const res = await logTimeAction({
        tenant_id: tenantId,
        project_id: task.project_id,
        task_id: selectedTaskId,
        date_worked: logDate,
        hours_spent: Number(hoursSpent),
        is_billable: isBillable,
        description,
      });

      if (res.success) {
        toast.success('Time logged successfully!');
        setDescription('');
        await loadData();
      } else {
        toast.error(res.error || 'Failed to log time');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleApprove = async (logId: string) => {
    const res = await updateTimesheetApprovalAction([logId], 'approved');
    if (res.success) {
      toast.success('Timesheet approved');
      await loadData();
    } else {
      toast.error(res.error || 'Failed to approve');
    }
  };

  const handleReject = async (logId: string) => {
    const reason = prompt('Enter rejection reason:') || 'Logged hours rejected by manager';
    const res = await updateTimesheetApprovalAction([logId], 'rejected', reason);
    if (res.success) {
      toast.success('Timesheet rejected');
      await loadData();
    } else {
      toast.error(res.error || 'Failed to reject');
    }
  };

  const pendingLogs = logs.filter((l) => l.approval_status === 'pending');

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-[var(--foreground)] flex items-center gap-2">
            <Clock className="h-6 w-6 text-[var(--primary)]" />
            <span>Time Tracking & Financial EVM</span>
          </h1>
          <p className="text-xs text-[var(--muted-foreground)]">
            Log billable project hours, review approvals, and monitor real-time Earned Value Management metrics.
          </p>
        </div>

        {/* Tab Controls */}
        <div className="flex items-center gap-1 bg-[var(--secondary)]/60 p-1 rounded-xl">
          <button
            onClick={() => setActiveTab('my_timesheet')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
              activeTab === 'my_timesheet'
                ? 'bg-[var(--primary)] text-[var(--primary-foreground)]'
                : 'text-[var(--muted-foreground)] hover:text-[var(--foreground)]'
            }`}
          >
            My Timesheet
          </button>
          {isManager && (
            <button
              onClick={() => setActiveTab('approvals')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                activeTab === 'approvals'
                  ? 'bg-[var(--primary)] text-[var(--primary-foreground)]'
                  : 'text-[var(--muted-foreground)] hover:text-[var(--foreground)]'
              }`}
            >
              <span>Approvals Queue</span>
              {pendingLogs.length > 0 && (
                <Badge variant="destructive" className="text-[9px] px-1.5 py-0 h-4">
                  {pendingLogs.length}
                </Badge>
              )}
            </button>
          )}
          <button
            onClick={() => setActiveTab('evm')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
              activeTab === 'evm'
                ? 'bg-[var(--primary)] text-[var(--primary-foreground)]'
                : 'text-[var(--muted-foreground)] hover:text-[var(--foreground)]'
            }`}
          >
            Financial EVM
          </button>
        </div>
      </div>

      {/* 1. My Timesheet Tab */}
      {activeTab === 'my_timesheet' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Quick Logger Card */}
          <div className="bg-[var(--card)] p-5 rounded-2xl border border-[var(--border)] shadow-xs space-y-4">
            <h3 className="text-sm font-bold text-[var(--foreground)] flex items-center gap-2">
              <Plus className="h-4 w-4 text-[var(--primary)]" />
              <span>Log Task Hours</span>
            </h3>

            <form onSubmit={handleLogTime} className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-[var(--foreground)]">Assigned Task</label>
                <select
                  value={selectedTaskId}
                  onChange={(e) => setSelectedTaskId(e.target.value)}
                  className="w-full mt-1 h-9 px-3 text-xs bg-[var(--secondary)] text-[var(--foreground)] border border-[var(--border)] rounded-lg font-medium"
                  required
                >
                  <option value="">-- Choose task --</option>
                  {tasks.map((t) => (
                    <option key={t.id} value={t.id}>
                      [{t.task_code || 'TASK'}] {t.title}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-semibold text-[var(--foreground)]">Date Worked</label>
                  <Input type="date" value={logDate} onChange={(e) => setLogDate(e.target.value)} required />
                </div>
                <div>
                  <label className="text-xs font-semibold text-[var(--foreground)]">Hours</label>
                  <Input
                    type="number"
                    step="0.5"
                    min="0.5"
                    max="24"
                    value={hoursSpent}
                    onChange={(e) => setHoursSpent(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-[var(--foreground)]">Work Description</label>
                <Input
                  placeholder="e.g. Worked on database schema and RLS policies"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="billable"
                  checked={isBillable}
                  onChange={(e) => setIsBillable(e.target.checked)}
                  className="rounded cursor-pointer"
                />
                <label htmlFor="billable" className="text-xs cursor-pointer select-none">
                  Billable to client
                </label>
              </div>

              <Button type="submit" disabled={isSubmitting} className="w-full text-xs font-semibold gap-2 mt-2">
                <Send className="h-3.5 w-3.5" />
                <span>{isSubmitting ? 'Logging...' : 'Submit Time Log'}</span>
              </Button>
            </form>
          </div>

          {/* Timesheet History Table */}
          <div className="lg:col-span-2 bg-[var(--card)] p-5 rounded-2xl border border-[var(--border)] shadow-xs space-y-4">
            <h3 className="text-sm font-bold text-[var(--foreground)]">Recent Time Logs</h3>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-[var(--border)] text-[var(--muted-foreground)]">
                    <th className="pb-2">Date</th>
                    <th className="pb-2">Task</th>
                    <th className="pb-2">Hours</th>
                    <th className="pb-2">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border)]">
                  {logs.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="py-8 text-center text-[var(--muted-foreground)]">
                        No hours logged yet. Use the form to submit your first entry.
                      </td>
                    </tr>
                  ) : (
                    logs.map((log) => (
                      <tr key={log.id} className="hover:bg-[var(--secondary)]/30">
                        <td className="py-2.5 font-mono text-[var(--muted-foreground)]">{log.date_worked}</td>
                        <td className="py-2.5">
                          <div className="font-semibold text-[var(--foreground)]">{log.task?.title || 'Project Task'}</div>
                          <div className="text-[10px] text-[var(--muted-foreground)]">{log.description || 'General progress'}</div>
                        </td>
                        <td className="py-2.5 font-mono font-bold">{log.hours_spent}h</td>
                        <td className="py-2.5">
                          <Badge
                            variant={
                              log.approval_status === 'approved'
                                ? 'default'
                                : log.approval_status === 'rejected'
                                ? 'destructive'
                                : 'secondary'
                            }
                            className="text-[10px] capitalize"
                          >
                            {log.approval_status}
                          </Badge>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* 2. Manager Approvals Queue Tab */}
      {activeTab === 'approvals' && (
        <div className="bg-[var(--card)] p-6 rounded-2xl border border-[var(--border)] shadow-xs space-y-4">
          <div className="flex justify-between items-center pb-3 border-b border-[var(--border)]">
            <h3 className="text-sm font-bold text-[var(--foreground)]">Pending Timesheet Approvals</h3>
            <span className="text-xs text-[var(--muted-foreground)]">{pendingLogs.length} pending items</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-[var(--border)] text-[var(--muted-foreground)]">
                  <th className="pb-2">Member</th>
                  <th className="pb-2">Task Code</th>
                  <th className="pb-2">Task</th>
                  <th className="pb-2">Date</th>
                  <th className="pb-2">Hours</th>
                  <th className="pb-2">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {pendingLogs.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-[var(--muted-foreground)]">
                      All timesheets approved! No pending reviews.
                    </td>
                  </tr>
                ) : (
                  pendingLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-[var(--secondary)]/30">
                      <td className="py-3 font-semibold text-[var(--foreground)]">
                        {log.user?.full_name || log.user?.email || 'Team Member'}
                      </td>
                      <td className="py-3 font-mono text-[var(--primary)] font-bold">{log.task?.task_code || 'TASK'}</td>
                      <td className="py-3 max-w-xs truncate">{log.task?.title}</td>
                      <td className="py-3 font-mono">{log.date_worked}</td>
                      <td className="py-3 font-mono font-bold">{log.hours_spent}h</td>
                      <td className="py-3">
                        <div className="flex items-center gap-2">
                          <Button size="sm" onClick={() => handleApprove(log.id)} className="h-7 text-xs bg-emerald-600 hover:bg-emerald-700 text-white gap-1">
                            <CheckCircle2 className="h-3 w-3" />
                            <span>Approve</span>
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => handleReject(log.id)} className="h-7 text-xs text-red-400 hover:text-red-300 gap-1">
                            <XCircle className="h-3 w-3" />
                            <span>Reject</span>
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 3. Financial EVM Analytics Widget Tab */}
      {activeTab === 'evm' && (
        <div className="space-y-6">
          {evmMetrics ? (
            <>
              {/* Executive EVM Stat Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="bg-[var(--card)] p-4 rounded-2xl border border-[var(--border)]">
                  <div className="text-[10px] uppercase font-bold text-[var(--muted-foreground)]">Planned Value (PV)</div>
                  <div className="text-xl font-bold font-mono mt-1">${evmMetrics.planned_value.toLocaleString()}</div>
                  <div className="text-[10px] text-[var(--muted-foreground)] mt-1">Scheduled work baseline</div>
                </div>

                <div className="bg-[var(--card)] p-4 rounded-2xl border border-[var(--border)]">
                  <div className="text-[10px] uppercase font-bold text-emerald-400">Earned Value (EV)</div>
                  <div className="text-xl font-bold font-mono text-emerald-400 mt-1">${evmMetrics.earned_value.toLocaleString()}</div>
                  <div className="text-[10px] text-[var(--muted-foreground)] mt-1">Value of work completed</div>
                </div>

                <div className="bg-[var(--card)] p-4 rounded-2xl border border-[var(--border)]">
                  <div className="text-[10px] uppercase font-bold text-blue-400">Actual Cost (AC)</div>
                  <div className="text-xl font-bold font-mono text-blue-400 mt-1">${evmMetrics.actual_cost.toLocaleString()}</div>
                  <div className="text-[10px] text-[var(--muted-foreground)] mt-1">Logged hours × user cost rate</div>
                </div>

                <div className="bg-[var(--card)] p-4 rounded-2xl border border-[var(--border)]">
                  <div className="text-[10px] uppercase font-bold text-orange-400">Estimate at Completion (EAC)</div>
                  <div className="text-xl font-bold font-mono text-orange-400 mt-1">${evmMetrics.estimate_at_completion.toLocaleString()}</div>
                  <div className="text-[10px] text-[var(--muted-foreground)] mt-1">BAC / Cost Performance Index</div>
                </div>
              </div>

              {/* Performance Indices */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-[var(--card)] p-5 rounded-2xl border border-[var(--border)] space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-bold text-[var(--foreground)]">Cost Performance Index (CPI)</span>
                    <span className={`text-sm font-mono font-bold ${evmMetrics.cpi >= 1 ? 'text-emerald-400' : 'text-red-400'}`}>
                      {evmMetrics.cpi.toFixed(2)}
                    </span>
                  </div>
                  <p className="text-xs text-[var(--muted-foreground)]">
                    {evmMetrics.cpi >= 1 ? 'Project is under budget. Cost efficiency is favorable.' : 'Project is over budget. Spending exceeds value earned.'}
                  </p>
                </div>

                <div className="bg-[var(--card)] p-5 rounded-2xl border border-[var(--border)] space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-bold text-[var(--foreground)]">Schedule Performance Index (SPI)</span>
                    <span className={`text-sm font-mono font-bold ${evmMetrics.spi >= 1 ? 'text-emerald-400' : 'text-red-400'}`}>
                      {evmMetrics.spi.toFixed(2)}
                    </span>
                  </div>
                  <p className="text-xs text-[var(--muted-foreground)]">
                    {evmMetrics.spi >= 1 ? 'Project is ahead of schedule.' : 'Project is behind schedule compared to baseline.'}
                  </p>
                </div>
              </div>
            </>
          ) : (
            <div className="p-12 text-center text-xs text-[var(--muted-foreground)] bg-[var(--card)] rounded-2xl border border-[var(--border)]">
              No project budget or task baseline found to compute Earned Value Management metrics.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
