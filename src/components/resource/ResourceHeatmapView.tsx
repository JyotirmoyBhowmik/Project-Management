// ==============================================================================
// src/components/resource/ResourceHeatmapView.tsx
// Interactive Resource Allocation, Workload & Capacity Heatmap Component
// Real-time capacity utilization tracking with visual conflict alerts.
// ==============================================================================

'use client';

import * as React from 'react';
import {
  Users,
  AlertTriangle,
  CheckCircle2,
  Calendar,
  Clock,
  ChevronDown,
  ChevronRight,
  ChevronLeft,
  Search,
  RotateCcw,
  TrendingUp,
  ShieldAlert,
} from 'lucide-react';
import {
  Task,
  TaskAssignee,
  UserProfile,
  WorkingCalendar,
  CalendarHoliday,
} from '@/types/database';
import { computeResourceWorkload, ResourceHeatmapResult } from '@/lib/resource/resource-engine';
import { parseISODate, formatDateToISO } from '@/lib/calendar/calendar-engine';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface ResourceHeatmapViewProps {
  tasks: Task[];
  assignees?: TaskAssignee[];
  users?: UserProfile[];
  calendar: WorkingCalendar;
  holidays: CalendarHoliday[];
  tenantId?: string;
}

export function ResourceHeatmapView({
  tasks,
  assignees,
  users,
  calendar,
  holidays,
}: ResourceHeatmapViewProps) {
  const [expandedUsers, setExpandedUsers] = React.useState<Record<string, boolean>>({});
  const [timeRange, setTimeRange] = React.useState<'2weeks' | 'month'>('2weeks');
  const [dateOffsetDays, setDateOffsetDays] = React.useState<number>(0);
  const [searchQuery, setSearchQuery] = React.useState<string>('');

  const resolvedAssignees = React.useMemo(() => {
    if (assignees && assignees.length > 0) return assignees;
    const extracted: TaskAssignee[] = [];
    tasks.forEach((t) => {
      if (t.assignees && Array.isArray(t.assignees)) {
        extracted.push(...t.assignees);
      }
    });
    return extracted;
  }, [assignees, tasks]);

  const resolvedUsers = React.useMemo(() => {
    if (users && users.length > 0) return users;
    const userMap = new Map<string, UserProfile>();
    resolvedAssignees.forEach((a) => {
      if (a.user) {
        userMap.set(a.user.id, a.user);
      }
    });
    return Array.from(userMap.values());
  }, [users, resolvedAssignees]);

  // Determine initial anchor date based on project schedule or current date
  const anchorDateStr = React.useMemo(() => {
    const todayStr = formatDateToISO(new Date());
    if (tasks.length === 0) return todayStr;
    const dates = tasks.flatMap((t) => [t.start_date, t.end_date].filter(Boolean));
    if (dates.length === 0) return todayStr;
    dates.sort();
    return dates[0] || todayStr;
  }, [tasks]);

  // Compute window start and end dates with dateOffsetDays
  const { startDate, endDate } = React.useMemo(() => {
    const base = parseISODate(anchorDateStr);
    base.setUTCDate(base.getUTCDate() + dateOffsetDays);
    const startStr = formatDateToISO(base);

    const spanDays = timeRange === '2weeks' ? 13 : 29;
    const endObj = new Date(base.getTime());
    endObj.setUTCDate(endObj.getUTCDate() + spanDays);
    const endStr = formatDateToISO(endObj);

    return { startDate: startStr, endDate: endStr };
  }, [anchorDateStr, dateOffsetDays, timeRange]);

  const heatmap: ResourceHeatmapResult = React.useMemo(() => {
    return computeResourceWorkload(
      startDate,
      endDate,
      resolvedUsers,
      tasks,
      resolvedAssignees,
      calendar,
      holidays,
      8 // 8 hours daily capacity
    );
  }, [startDate, endDate, resolvedUsers, tasks, resolvedAssignees, calendar, holidays]);

  const filteredUsers = React.useMemo(() => {
    if (!searchQuery.trim()) return heatmap.users;
    const q = searchQuery.toLowerCase().trim();
    return heatmap.users.filter(
      (u) => u.userName.toLowerCase().includes(q) || u.userEmail.toLowerCase().includes(q)
    );
  }, [heatmap.users, searchQuery]);

  const toggleUser = (userId: string) => {
    setExpandedUsers((prev) => ({ ...prev, [userId]: !prev[userId] }));
  };

  const totalConflicts = heatmap.conflictAlerts.length;

  return (
    <div className="flex flex-col h-full space-y-4">
      {/* Top Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
        <div className="p-3.5 rounded-xl border border-[var(--border)] bg-[var(--card)] shadow-xs">
          <div className="flex items-center justify-between text-xs text-[var(--muted-foreground)]">
            <span>Total Team Members</span>
            <Users className="h-4 w-4 text-[var(--primary)]" />
          </div>
          <div className="text-xl font-bold mt-1 text-[var(--foreground)]">{resolvedUsers.length}</div>
          <div className="text-[10px] text-[var(--muted-foreground)] mt-0.5">Across current workspace</div>
        </div>

        <div className="p-3.5 rounded-xl border border-[var(--border)] bg-[var(--card)] shadow-xs">
          <div className="flex items-center justify-between text-xs text-[var(--muted-foreground)]">
            <span>Shift Capacity</span>
            <Clock className="h-4 w-4 text-emerald-500" />
          </div>
          <div className="text-xl font-bold mt-1 text-[var(--foreground)]">8.0 hrs/day</div>
          <div className="text-[10px] text-emerald-500 mt-0.5">Standard working shift</div>
        </div>

        <div className="p-3.5 rounded-xl border border-[var(--border)] bg-[var(--card)] shadow-xs">
          <div className="flex items-center justify-between text-xs text-[var(--muted-foreground)]">
            <span>Utilization Target</span>
            <TrendingUp className="h-4 w-4 text-sky-400" />
          </div>
          <div className="text-xl font-bold mt-1 text-[var(--foreground)]">70% - 100%</div>
          <div className="text-[10px] text-sky-400 mt-0.5">Optimal capacity range</div>
        </div>

        <div
          className={`p-3.5 rounded-xl border shadow-xs ${
            totalConflicts > 0
              ? 'border-rose-500/40 bg-rose-500/5'
              : 'border-[var(--border)] bg-[var(--card)]'
          }`}
        >
          <div className="flex items-center justify-between text-xs">
            <span className={totalConflicts > 0 ? 'text-rose-400 font-semibold' : 'text-[var(--muted-foreground)]'}>
              Allocation Conflicts
            </span>
            <AlertTriangle className={`h-4 w-4 ${totalConflicts > 0 ? 'text-rose-500 animate-bounce' : 'text-emerald-500'}`} />
          </div>
          <div className={`text-xl font-bold mt-1 ${totalConflicts > 0 ? 'text-rose-500' : 'text-[var(--foreground)]'}`}>
            {totalConflicts}
          </div>
          <div className="text-[10px] text-[var(--muted-foreground)] mt-0.5">
            {totalConflicts > 0 ? 'Over-allocation (>100%) detected' : 'All resources in safe limits'}
          </div>
        </div>
      </div>

      {/* Conflict Warning Banner if conflicts exist */}
      {totalConflicts > 0 && (
        <div className="p-3.5 rounded-xl border border-rose-500/40 bg-rose-500/10 text-rose-200 text-xs flex items-start gap-3">
          <ShieldAlert className="h-5 w-5 text-rose-400 shrink-0 mt-0.5" />
          <div>
            <div className="font-bold text-rose-400">Resource Allocation Conflict Warning:</div>
            <div className="text-[11px] text-rose-300 mt-0.5">
              Team members are scheduled for over 100% capacity on the following dates:
            </div>
            <div className="flex flex-wrap gap-2 mt-2">
              {heatmap.conflictAlerts.map((alert, idx) => (
                <Badge
                  key={idx}
                  variant="critical"
                  className="text-[10px] py-0.5 px-2 font-mono"
                >
                  {alert.userName} on {alert.date}: {alert.utilizationPercent}% ({alert.conflictingTasks.join(' + ')})
                </Badge>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Main Heatmap Grid */}
      <div className="flex-1 flex flex-col rounded-xl border border-[var(--border)] bg-[var(--card)] overflow-hidden shadow-xs">
        {/* Table Header Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 border-b border-[var(--border)] bg-[var(--secondary)]/40">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-[var(--primary)]" />
              <span className="text-xs font-bold text-[var(--foreground)]">Resource Capacity Heatmap</span>
              <span className="text-[10px] text-[var(--muted-foreground)] font-mono">
                ({startDate} to {endDate})
              </span>
            </div>

            {/* Timeline Period Navigation */}
            <div className="flex items-center gap-1 border-l border-[var(--border)] pl-3">
              <Button
                size="sm"
                variant="outline"
                onClick={() => setDateOffsetDays((prev) => prev - (timeRange === '2weeks' ? 14 : 30))}
                className="h-6 w-6 p-0"
                title="Previous period"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
              </Button>
              <Button
                size="sm"
                variant={dateOffsetDays === 0 ? 'secondary' : 'ghost'}
                onClick={() => setDateOffsetDays(0)}
                className="h-6 px-1.5 text-[10px] font-mono"
                title="Reset to anchor period"
              >
                Today
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setDateOffsetDays((prev) => prev + (timeRange === '2weeks' ? 14 : 30))}
                className="h-6 w-6 p-0"
                title="Next period"
              >
                <ChevronRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Quick Member Search Input */}
            <div className="relative">
              <Search className="absolute left-2 top-2 h-3 w-3 text-[var(--muted-foreground)]" />
              <Input
                placeholder="Search member..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-7 pl-7 pr-2 text-xs w-36 bg-[var(--card)]"
              />
            </div>

            <div className="flex items-center gap-1.5 text-[10px] mr-1 hidden lg:flex">
              <span className="inline-block w-2.5 h-2.5 rounded-xs bg-blue-500/20 border border-blue-500/40" />
              <span className="text-[var(--muted-foreground)]">&lt;70% Under</span>
              <span className="inline-block w-2.5 h-2.5 rounded-xs bg-emerald-500/30 border border-emerald-500/50 ml-1.5" />
              <span className="text-[var(--muted-foreground)]">70-100% Optimal</span>
              <span className="inline-block w-2.5 h-2.5 rounded-xs bg-rose-500/40 border border-rose-500/60 ml-1.5" />
              <span className="text-rose-400 font-bold">&gt;100% Over</span>
            </div>

            <Button
              size="sm"
              variant={timeRange === '2weeks' ? 'default' : 'outline'}
              onClick={() => setTimeRange('2weeks')}
              className="h-7 text-xs px-2.5"
            >
              2 Weeks
            </Button>
            <Button
              size="sm"
              variant={timeRange === 'month' ? 'default' : 'outline'}
              onClick={() => setTimeRange('month')}
              className="h-7 text-xs px-2.5"
            >
              Full Month
            </Button>
          </div>
        </div>

        {/* Scrollable Heatmap Table */}
        <div className="flex-1 overflow-x-auto overflow-y-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-[var(--border)] bg-[var(--secondary)]/70 text-[var(--muted-foreground)]">
                <th className="py-2.5 px-3 min-w-[200px] sticky left-0 bg-[var(--card)] z-10 border-r border-[var(--border)]">
                  Team Member
                </th>
                <th className="py-2.5 px-2 text-center min-w-[60px] border-r border-[var(--border)]">
                  Avg %
                </th>
                {heatmap.dates.map((dateStr) => {
                  const [y, m, d] = dateStr.split('-');
                  const dateObj = new Date(Date.UTC(Number(y), Number(m) - 1, Number(d)));
                  const dayName = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][dateObj.getUTCDay()];
                  const isWeekend = dateObj.getUTCDay() === 0 || dateObj.getUTCDay() === 6;

                  return (
                    <th
                      key={dateStr}
                      className={`py-2 px-1 text-center min-w-[52px] font-mono border-r border-[var(--border)] text-[10px] ${
                        isWeekend ? 'bg-[var(--secondary)]/40 text-[var(--muted-foreground)]/60' : ''
                      }`}
                    >
                      <div className="font-semibold">{dayName}</div>
                      <div className="text-[9px] opacity-75">{d}</div>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {filteredUsers.length === 0 ? (
                <tr>
                  <td
                    colSpan={heatmap.dates.length + 2}
                    className="py-12 text-center text-xs text-[var(--muted-foreground)]"
                  >
                    {searchQuery ? `No team members match "${searchQuery}".` : 'No team members allocated.'}
                  </td>
                </tr>
              ) : (
                filteredUsers.map((u) => {
                const isExpanded = expandedUsers[u.userId];

                return (
                  <React.Fragment key={u.userId}>
                    <tr className="hover:bg-[var(--secondary)]/30 transition-colors">
                      {/* User Info Column (Sticky Left) */}
                      <td className="py-2.5 px-3 sticky left-0 bg-[var(--card)] z-10 border-r border-[var(--border)]">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className="h-6 w-6 rounded-full bg-[var(--primary)] text-white text-[10px] font-bold flex items-center justify-center shrink-0">
                              {u.userName.substring(0, 2).toUpperCase()}
                            </div>
                            <div className="truncate max-w-[140px]">
                              <div className="font-medium text-[var(--foreground)] truncate text-xs">
                                {u.userName}
                              </div>
                              <div className="text-[10px] text-[var(--muted-foreground)] truncate">
                                {u.userEmail}
                              </div>
                            </div>
                          </div>

                          <button
                            onClick={() => toggleUser(u.userId)}
                            className="p-1 rounded hover:bg-[var(--secondary)] text-[var(--muted-foreground)] cursor-pointer"
                            title="Toggle daily task breakdown"
                          >
                            {isExpanded ? (
                              <ChevronDown className="h-3.5 w-3.5" />
                            ) : (
                              <ChevronRight className="h-3.5 w-3.5" />
                            )}
                          </button>
                        </div>
                      </td>

                      {/* Average Utilization */}
                      <td className="py-2.5 px-2 text-center font-mono font-bold text-[11px] border-r border-[var(--border)]">
                        <span
                          className={
                            u.averageUtilization > 100
                              ? 'text-rose-400'
                              : u.averageUtilization >= 70
                              ? 'text-emerald-400'
                              : 'text-blue-400'
                          }
                        >
                          {u.averageUtilization}%
                        </span>
                      </td>

                      {/* Day Heatmap Cells */}
                      {u.dailyWorkloads.map((day) => {
                        let cellBg = '';
                        if (!day.isWorkingDay) {
                          cellBg = 'bg-[var(--secondary)]/20 text-[var(--muted-foreground)]/40';
                        } else if (day.status === 'over') {
                          cellBg = 'bg-rose-500/25 text-rose-300 border border-rose-500/40 font-extrabold shadow-inner';
                        } else if (day.status === 'optimal') {
                          cellBg = 'bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/30';
                        } else if (day.totalAssignedHours > 0) {
                          cellBg = 'bg-blue-500/15 text-blue-300 border border-blue-500/20';
                        } else {
                          cellBg = 'text-[var(--muted-foreground)]/40';
                        }

                        return (
                          <td
                            key={day.date}
                            className="py-1 px-1 text-center font-mono text-[10px] border-r border-[var(--border)]"
                          >
                            <div
                              className={`h-7 w-full rounded flex items-center justify-center ${cellBg}`}
                              title={
                                day.isWorkingDay
                                  ? `${u.userName} on ${day.date}: ${day.utilizationPercent}% (${day.totalAssignedHours} hrs assigned)`
                                  : 'Non-working day'
                              }
                            >
                              {day.isWorkingDay ? (
                                day.totalAssignedHours > 0 ? (
                                  `${day.utilizationPercent}%`
                                ) : (
                                  '0%'
                                )
                              ) : (
                                '-'
                              )}
                            </div>
                          </td>
                        );
                      })}
                    </tr>

                    {/* Expandable Task Breakdown Row */}
                    {isExpanded && (
                      <tr className="bg-[var(--secondary)]/15 border-b border-[var(--border)]">
                        <td
                          colSpan={heatmap.dates.length + 2}
                          className="py-2.5 px-4 text-xs text-[var(--muted-foreground)]"
                        >
                          <div className="font-semibold text-[var(--foreground)] mb-1 text-[11px]">
                            Assigned Tasks for {u.userName}:
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {tasks
                              .filter((t) => resolvedAssignees.some((a) => a.task_id === t.id && a.user_id === u.userId))
                              .map((t) => {
                                const a = resolvedAssignees.find((asgn) => asgn.task_id === t.id && asgn.user_id === u.userId);
                                return (
                                  <div
                                    key={t.id}
                                    className="p-1.5 rounded bg-[var(--card)] border border-[var(--border)] flex items-center gap-2 text-[10px]"
                                  >
                                    <span className="font-medium text-[var(--foreground)]">{t.title}</span>
                                    <span className="font-mono text-sky-400">
                                      ({a?.allocation_percent || 100}% allocation)
                                    </span>
                                    <span className="text-[var(--muted-foreground)]">
                                      {t.start_date} → {t.end_date}
                                    </span>
                                  </div>
                                );
                              })}
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              }))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
