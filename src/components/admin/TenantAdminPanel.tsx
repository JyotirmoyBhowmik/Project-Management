'use client';

import * as React from 'react';
import {
  Building2,
  Calendar,
  Users,
  Shield,
  Clock,
  Save,
  CheckCircle2,
  Activity,
  Plus,
  Trash2,
} from 'lucide-react';
import { useTenantStore } from '@/lib/stores/tenant-store';
import { db } from '@/lib/supabase/mock-db';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs } from '@/components/ui/tabs';

export function TenantAdminPanel() {
  const { activeTenant, activeRole } = useTenantStore();
  const [activeTab, setActiveTab] = React.useState('calendar');
  const [savedSuccess, setSavedSuccess] = React.useState(false);

  // Tenant Calendar Settings
  const tenantCalendar = db.calendars.find(c => c.tenant_id === activeTenant?.id) || db.calendars[0];
  const [weekStart, setWeekStart] = React.useState(tenantCalendar?.week_start_day ?? 1);
  const [workingDays, setWorkingDays] = React.useState<number[]>(tenantCalendar?.working_days || [1, 2, 3, 4, 5]);

  // Tenant Holidays
  const [holidays, setHolidays] = React.useState(db.holidays.filter(h => h.tenant_id === activeTenant?.id));
  const [newHolidayName, setNewHolidayName] = React.useState('');
  const [newHolidayDate, setNewHolidayDate] = React.useState('2026-12-31');

  // Audit Logs
  const auditLogs = db.auditLogs.filter(l => l.tenant_id === activeTenant?.id);

  const toggleDay = (day: number) => {
    if (workingDays.includes(day)) {
      setWorkingDays(workingDays.filter(d => d !== day));
    } else {
      setWorkingDays([...workingDays, day].sort());
    }
  };

  const handleAddHoliday = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newHolidayName) return;

    const newH = {
      id: `h-${Date.now()}`,
      tenant_id: activeTenant!.id,
      calendar_id: tenantCalendar.id,
      name: newHolidayName,
      holiday_date: newHolidayDate,
      date: newHolidayDate,
      is_recurring: true,
      created_at: new Date().toISOString(),
    };

    db.holidays.push(newH);
    setHolidays([...db.holidays.filter(h => h.tenant_id === activeTenant?.id)]);
    setNewHolidayName('');
  };

  const handleDeleteHoliday = (id: string) => {
    db.holidays = db.holidays.filter(h => h.id !== id);
    setHolidays([...db.holidays.filter(h => h.tenant_id === activeTenant?.id)]);
  };

  const handleSaveCalendar = () => {
    if (tenantCalendar) {
      tenantCalendar.week_start_day = weekStart;
      tenantCalendar.working_days = workingDays;
      if (activeTenant) {
        activeTenant.week_starts_on = weekStart;
        activeTenant.weekend_days = [0, 1, 2, 3, 4, 5, 6].filter(d => !workingDays.includes(d));
      }
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 3000);
    }
  };

  const days = [
    { id: 0, label: 'Sun' },
    { id: 1, label: 'Mon' },
    { id: 2, label: 'Tue' },
    { id: 3, label: 'Wed' },
    { id: 4, label: 'Thu' },
    { id: 5, label: 'Fri' },
    { id: 6, label: 'Sat' },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-[var(--foreground)] flex items-center gap-2">
            <Building2 className="h-5 w-5 text-[var(--primary)]" />
            {activeTenant?.name} — Tenant Administration
          </h1>
          <p className="text-xs text-[var(--muted-foreground)] mt-0.5">
            Configure regional working calendars, working days, holiday exclusions, and inspect immutable audit logs.
          </p>
        </div>
      </div>

      {/* Tabs */}
      <Tabs
        activeTab={activeTab}
        onChange={setActiveTab}
        items={[
          { id: 'calendar', label: 'Working Calendar & Holidays', icon: <Calendar className="h-4 w-4" /> },
          { id: 'members', label: 'Members & Roles', icon: <Users className="h-4 w-4" /> },
          { id: 'audit', label: 'Compliance Audit Logs', icon: <Activity className="h-4 w-4" /> },
        ]}
      />

      {/* Tab: Calendar Settings */}
      {activeTab === 'calendar' && (
        <div className="space-y-6">
          <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-6 space-y-6 shadow-xs">
            <h2 className="text-sm font-bold text-[var(--foreground)]">Regional Working Days Engine Configuration</h2>

            {/* Week Start Day */}
            <div className="max-w-md">
              <label className="text-xs font-semibold block mb-1">Week Start Day</label>
              <select
                value={weekStart}
                onChange={(e) => setWeekStart(parseInt(e.target.value, 10))}
                className="w-full h-9 rounded-md border border-[var(--input)] bg-[var(--card)] px-3 text-xs"
              >
                <option value={1}>Monday (Western / ISO Standard)</option>
                <option value={0}>Sunday (Middle East / North America Standard)</option>
              </select>
            </div>

            {/* Working Days Selector */}
            <div>
              <label className="text-xs font-semibold block mb-2">Automated Working Days Selection</label>
              <div className="flex gap-2">
                {days.map((d) => {
                  const isWorking = workingDays.includes(d.id);
                  return (
                    <button
                      key={d.id}
                      type="button"
                      onClick={() => toggleDay(d.id)}
                      className={`h-10 w-12 rounded-lg text-xs font-bold border transition-all cursor-pointer ${
                        isWorking
                          ? 'bg-[var(--primary)] text-[var(--primary-foreground)] border-transparent shadow-xs'
                          : 'bg-[var(--secondary)] text-[var(--muted-foreground)] border-[var(--border)] hover:text-[var(--foreground)]'
                      }`}
                    >
                      {d.label}
                    </button>
                  );
                })}
              </div>
              <p className="text-[11px] text-[var(--muted-foreground)] mt-2">
                Non-working days are automatically shaded on the Gantt canvas and bypassed in duration calculations.
              </p>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <Button onClick={handleSaveCalendar} className="gap-2 text-xs">
                <Save className="h-3.5 w-3.5" />
                Save Calendar Settings
              </Button>
              {savedSuccess && (
                <span className="flex items-center gap-1 text-xs text-emerald-500 font-semibold animate-in fade-in">
                  <CheckCircle2 className="h-3.5 w-3.5" /> Calendar saved & CPM synchronized
                </span>
              )}
            </div>
          </div>

          {/* Holiday Schedule */}
          <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-6 space-y-4 shadow-xs">
            <h2 className="text-sm font-bold text-[var(--foreground)]">Tenant Non-Working Holidays</h2>

            {/* Add Holiday Form */}
            <form onSubmit={handleAddHoliday} className="flex gap-3 max-w-xl">
              <Input
                placeholder="Holiday name (e.g. Labor Day)"
                value={newHolidayName}
                onChange={(e) => setNewHolidayName(e.target.value)}
                required
              />
              <Input
                type="date"
                value={newHolidayDate}
                onChange={(e) => setNewHolidayDate(e.target.value)}
                required
                className="w-44"
              />
              <Button type="submit" size="sm" className="gap-1 shrink-0">
                <Plus className="h-3.5 w-3.5" /> Add
              </Button>
            </form>

            <div className="divide-y divide-[var(--border)] max-w-xl border border-[var(--border)] rounded-lg overflow-hidden">
              {holidays.map((h) => (
                <div key={h.id} className="flex items-center justify-between p-3 text-xs bg-[var(--card)]">
                  <div>
                    <span className="font-semibold text-[var(--foreground)]">{h.name}</span>
                    <span className="text-[11px] text-[var(--muted-foreground)] ml-2 font-mono">{h.date}</span>
                  </div>
                  <button
                    onClick={() => handleDeleteHoliday(h.id)}
                    className="text-[var(--muted-foreground)] hover:text-rose-500 transition-colors cursor-pointer"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Tab: Members Roster */}
      {activeTab === 'members' && (
        <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-xs">
          <h2 className="text-sm font-bold text-[var(--foreground)] mb-4">Workspace Roster & RLS Scopes</h2>
          <div className="divide-y divide-[var(--border)] border border-[var(--border)] rounded-lg overflow-hidden">
            {db.users.map((u) => {
              const membership = db.memberships.find(m => m.user_id === u.id && m.tenant_id === activeTenant?.id);
              return (
                <div key={u.id} className="flex items-center justify-between p-3.5 text-xs">
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-full bg-[var(--secondary)] font-bold flex items-center justify-center text-[var(--foreground)] border border-[var(--border)]">
                      {u.full_name.substring(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <div className="font-semibold text-[var(--foreground)]">{u.full_name}</div>
                      <div className="text-[11px] text-[var(--muted-foreground)] font-mono">{u.email}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={membership?.role === 'guest' ? 'warning' : 'outline'}>
                      {membership?.role?.replace('_', ' ') || 'member'}
                    </Badge>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Tab: Audit Logs */}
      {activeTab === 'audit' && (
        <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-sm font-bold text-[var(--foreground)]">Immutable Compliance Audit Trail</h2>
              <p className="text-[11px] text-[var(--muted-foreground)]">Captures destructive mutations, before/after JSON diffs, and distributed trace IDs.</p>
            </div>
            <Badge variant="outline" className="font-mono">{auditLogs.length} Events</Badge>
          </div>

          <div className="divide-y divide-[var(--border)] border border-[var(--border)] rounded-lg overflow-hidden text-xs">
            {auditLogs.map((log) => (
              <div key={log.id} className="p-3 bg-[var(--card)] space-y-1.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Badge variant={log.action === 'DELETE' ? 'destructive' : log.action === 'INSERT' ? 'success' : 'secondary'}>
                      {log.action}
                    </Badge>
                    <span className="font-semibold text-[var(--foreground)] capitalize">{log.entity_type}</span>
                    <span className="text-[10px] text-[var(--muted-foreground)] font-mono">{log.entity_id}</span>
                  </div>
                  <span className="text-[10px] font-mono text-[var(--muted-foreground)]">{log.created_at}</span>
                </div>
                <div className="flex items-center justify-between text-[11px] text-[var(--muted-foreground)] font-mono">
                  <span>trace: {log.correlation_id}</span>
                  <span>ip: {log.ip_address}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
