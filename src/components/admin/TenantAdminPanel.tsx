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
  Sliders,
  Sparkles,
  GitBranch,
  Layers,
  AlertCircle,
} from 'lucide-react';
import { useTenantStore } from '@/lib/stores/tenant-store';
import { db } from '@/lib/supabase/mock-db';
import {
  TenantTaskStatus,
  TenantTaskPriority,
  TenantCustomField,
  TenantRolePermission,
  CustomFieldType,
} from '@/types/database';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs } from '@/components/ui/tabs';
import { Modal } from '@/components/ui/dialog';
import { useTenantMetadata } from '@/lib/context/tenant-metadata-context';

export function TenantAdminPanel() {
  const { activeTenant, activeRole } = useTenantStore();
  const { refreshMetadata } = useTenantMetadata();
  const [activeTab, setActiveTab] = React.useState('statuses');
  const [savedSuccess, setSavedSuccess] = React.useState(false);
  const [notificationMsg, setNotificationMsg] = React.useState<string | null>(null);

  const tenantId = activeTenant?.id || 'a0000000-0000-0000-0000-000000000001';

  // State: Task Statuses
  const [statuses, setStatuses] = React.useState<TenantTaskStatus[]>(() => db.getTenantTaskStatuses(tenantId));
  const [isAddStatusModalOpen, setIsAddStatusModalOpen] = React.useState(false);
  const [newStatusName, setNewStatusName] = React.useState('');
  const [newStatusSlug, setNewStatusSlug] = React.useState('');
  const [newStatusColor, setNewStatusColor] = React.useState('#3b82f6');
  const [newStatusIsClosed, setNewStatusIsClosed] = React.useState(false);

  // State: Task Priorities
  const [priorities, setPriorities] = React.useState<TenantTaskPriority[]>(() => db.getTenantTaskPriorities(tenantId));
  const [isAddPriorityModalOpen, setIsAddPriorityModalOpen] = React.useState(false);
  const [newPriorityName, setNewPriorityName] = React.useState('');
  const [newPrioritySlug, setNewPrioritySlug] = React.useState('');
  const [newPriorityColor, setNewPriorityColor] = React.useState('#f59e0b');
  const [newPriorityWeight, setNewPriorityWeight] = React.useState(50);
  const [newPrioritySlaHours, setNewPrioritySlaHours] = React.useState(24);

  // State: Custom Fields
  const [customFields, setCustomFields] = React.useState<TenantCustomField[]>(() => db.getTenantCustomFields(tenantId));
  const [isAddFieldModalOpen, setIsAddFieldModalOpen] = React.useState(false);
  const [newFieldName, setNewFieldName] = React.useState('');
  const [newFieldKey, setNewFieldKey] = React.useState('');
  const [newFieldType, setNewFieldType] = React.useState<CustomFieldType>('text');
  const [newFieldOptions, setNewFieldOptions] = React.useState('');
  const [newFieldRequired, setNewFieldRequired] = React.useState(false);

  // State: Role Permissions
  const [permissions, setPermissions] = React.useState<TenantRolePermission[]>(() => db.getTenantRolePermissions(tenantId));

  // Tenant Calendar Settings
  const tenantCalendar = db.calendars.find(c => c.tenant_id === tenantId) || db.calendars[0];
  const [weekStart, setWeekStart] = React.useState(tenantCalendar?.week_start_day ?? 1);
  const [workingDays, setWorkingDays] = React.useState<number[]>(tenantCalendar?.working_days || [1, 2, 3, 4, 5]);

  // Tenant Holidays
  const [holidays, setHolidays] = React.useState(db.holidays.filter(h => h.tenant_id === tenantId));
  const [newHolidayName, setNewHolidayName] = React.useState('');
  const [newHolidayDate, setNewHolidayDate] = React.useState('2026-12-31');

  // Audit Logs
  const auditLogs = db.auditLogs.filter(l => l.tenant_id === tenantId);

  const showNotification = (msg: string) => {
    setNotificationMsg(msg);
    setTimeout(() => setNotificationMsg(null), 3000);
  };

  // --- STATUS HANDLERS ---
  const handleAddStatus = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStatusName.trim() || !newStatusSlug.trim()) return;

    db.createTenantTaskStatus({
      tenant_id: tenantId,
      name: newStatusName.trim(),
      slug: newStatusSlug.trim().toLowerCase(),
      color_hex: newStatusColor,
      badge_variant: 'default',
      position: statuses.length + 1,
      is_default: false,
      is_closed_state: newStatusIsClosed,
    });

    setStatuses([...db.getTenantTaskStatuses(tenantId)]);
    refreshMetadata();
    setIsAddStatusModalOpen(false);
    setNewStatusName('');
    setNewStatusSlug('');
    showNotification(`Status "${newStatusName}" added to workflow pipeline.`);
  };

  const handleDeleteStatus = (id: string) => {
    db.deleteTenantTaskStatus(id);
    setStatuses([...db.getTenantTaskStatuses(tenantId)]);
    refreshMetadata();
    showNotification('Workflow status removed.');
  };

  // --- PRIORITY HANDLERS ---
  const handleAddPriority = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPriorityName.trim() || !newPrioritySlug.trim()) return;

    db.createTenantTaskPriority({
      tenant_id: tenantId,
      name: newPriorityName.trim(),
      slug: newPrioritySlug.trim().toLowerCase(),
      color_hex: newPriorityColor,
      urgency_weight: newPriorityWeight,
      sla_response_hours: newPrioritySlaHours,
      icon_key: 'alert-triangle',
      is_default: false,
    });

    setPriorities([...db.getTenantTaskPriorities(tenantId)]);
    refreshMetadata();
    setIsAddPriorityModalOpen(false);
    setNewPriorityName('');
    setNewPrioritySlug('');
    showNotification(`Priority "${newPriorityName}" created with ${newPrioritySlaHours}h SLA.`);
  };

  const handleDeletePriority = (id: string) => {
    db.deleteTenantTaskPriority(id);
    setPriorities([...db.getTenantTaskPriorities(tenantId)]);
    refreshMetadata();
    showNotification('Task priority level removed.');
  };

  // --- CUSTOM FIELD HANDLERS ---
  const handleAddCustomField = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFieldName.trim() || !newFieldKey.trim()) return;

    const options = (newFieldType === 'dropdown' || newFieldType === 'multiselect')
      ? newFieldOptions.split(',').map(s => s.trim()).filter(Boolean)
      : undefined;

    db.createTenantCustomField({
      tenant_id: tenantId,
      entity_type: 'task',
      field_name: newFieldName.trim(),
      field_key: newFieldKey.trim().toLowerCase().replace(/[^a-z0-9_]/g, '_'),
      field_type: newFieldType,
      options_json: options,
      is_required: newFieldRequired,
      sort_order: customFields.length + 1,
    });

    setCustomFields([...db.getTenantCustomFields(tenantId)]);
    refreshMetadata();
    setIsAddFieldModalOpen(false);
    setNewFieldName('');
    setNewFieldKey('');
    setNewFieldOptions('');
    showNotification(`Custom field "${newFieldName}" registered into JSONB schema.`);
  };

  const handleDeleteCustomField = (id: string) => {
    db.deleteTenantCustomField(id);
    setCustomFields([...db.getTenantCustomFields(tenantId)]);
    refreshMetadata();
    showNotification('Custom field removed.');
  };

  // --- PERMISSION HANDLERS ---
  const handleTogglePermission = (role: string, permissionKey: string, currentVal: boolean) => {
    db.updateRolePermission(tenantId, role, permissionKey, !currentVal);
    setPermissions([...db.getTenantRolePermissions(tenantId)]);
    refreshMetadata();
    showNotification(`Updated permission [${permissionKey}] for role ${role}.`);
  };

  // --- CALENDAR HANDLERS ---
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
      tenant_id: tenantId,
      calendar_id: tenantCalendar.id,
      name: newHolidayName,
      holiday_date: newHolidayDate,
      date: newHolidayDate,
      is_recurring: true,
      created_at: new Date().toISOString(),
    };

    db.holidays.push(newH);
    setHolidays([...db.holidays.filter(h => h.tenant_id === tenantId)]);
    setNewHolidayName('');
    showNotification(`Added holiday "${newH.name}".`);
  };

  const handleDeleteHoliday = (id: string) => {
    db.holidays = db.holidays.filter(h => h.id !== id);
    setHolidays([...db.holidays.filter(h => h.tenant_id === tenantId)]);
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
      showNotification('Working calendar saved & CPM synced.');
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

  const PERMISSION_KEYS = [
    { key: 'tasks.create', label: 'Create Tasks' },
    { key: 'tasks.update', label: 'Edit & Move Tasks' },
    { key: 'tasks.delete', label: 'Delete Tasks' },
    { key: 'cpm.recalculate', label: 'Trigger CPM Recalculate' },
    { key: 'baseline.create', label: 'Lock Schedule Baseline' },
    { key: 'export.download', label: 'Export Schedule Data' },
    { key: 'settings.manage', label: 'Administer Tenant Metadata' },
  ];

  const ROLES = ['admin', 'manager', 'member', 'guest'];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-[var(--foreground)] flex items-center gap-2">
            <Building2 className="h-5 w-5 text-[var(--primary)]" />
            {activeTenant?.name} — Tenant Administration & Metadata Engine
          </h1>
          <p className="text-xs text-[var(--muted-foreground)] mt-0.5">
            Configure database-driven workflow pipelines, task priorities, custom fields, role permissions, and calendars.
          </p>
        </div>

        {notificationMsg && (
          <div className="text-xs text-emerald-500 font-semibold flex items-center gap-1.5 animate-in fade-in">
            <CheckCircle2 className="h-4 w-4" />
            {notificationMsg}
          </div>
        )}
      </div>

      {/* Synchronized Configuration Tabs */}
      <Tabs
        activeTab={activeTab}
        onChange={setActiveTab}
        items={[
          { id: 'statuses', label: 'Workflow Pipeline', icon: <GitBranch className="h-4 w-4" />, count: statuses.length },
          { id: 'priorities', label: 'Task Priorities & SLA', icon: <Sliders className="h-4 w-4" />, count: priorities.length },
          { id: 'custom_fields', label: 'Dynamic Custom Fields', icon: <Layers className="h-4 w-4" />, count: customFields.length },
          { id: 'permissions', label: 'Role Permissions Matrix', icon: <Shield className="h-4 w-4" /> },
          { id: 'calendar', label: 'Working Calendar & Holidays', icon: <Calendar className="h-4 w-4" /> },
          { id: 'members', label: 'Members & Roles', icon: <Users className="h-4 w-4" /> },
          { id: 'audit', label: 'Compliance Audit Logs', icon: <Activity className="h-4 w-4" />, count: auditLogs.length },
        ]}
      />

      {/* Tab 1: Workflow Pipeline Statuses */}
      {activeTab === 'statuses' && (
        <div className="space-y-4">
          <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-6 space-y-4 shadow-xs">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-bold text-[var(--foreground)]">Task Workflow Pipeline Stages</h2>
                <p className="text-xs text-[var(--muted-foreground)]">
                  All Kanban columns and task statuses are database-driven with zero hardcoded values.
                </p>
              </div>
              <Button size="sm" onClick={() => setIsAddStatusModalOpen(true)} className="gap-1 text-xs">
                <Plus className="h-3.5 w-3.5" />
                Add Pipeline Stage
              </Button>
            </div>

            {/* Pipeline Visual Ribbon */}
            <div className="flex items-center gap-2 overflow-x-auto py-2">
              {statuses.map((s, idx) => (
                <div key={s.id} className="flex items-center gap-2 shrink-0">
                  <div
                    className="flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-semibold shadow-2xs"
                    style={{
                      borderColor: s.color_hex,
                      backgroundColor: `${s.color_hex}15`,
                      color: s.color_hex,
                    }}
                  >
                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: s.color_hex }} />
                    {s.name}
                    {s.is_closed_state && <Badge variant="secondary" className="text-[9px] py-0">CLOSED</Badge>}
                  </div>
                  {idx < statuses.length - 1 && (
                    <span className="text-[var(--muted-foreground)] text-xs">→</span>
                  )}
                </div>
              ))}
            </div>

            {/* Statuses Table */}
            <div className="divide-y divide-[var(--border)] border border-[var(--border)] rounded-lg overflow-hidden text-xs">
              {statuses.map((s) => (
                <div key={s.id} className="p-3 bg-[var(--card)] flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="w-4 h-4 rounded-full border border-black/20" style={{ backgroundColor: s.color_hex }} />
                    <div>
                      <span className="font-semibold text-[var(--foreground)]">{s.name}</span>
                      <span className="text-[11px] text-[var(--muted-foreground)] font-mono ml-2">{s.slug}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    {s.is_closed_state && (
                      <Badge variant="outline" className="text-[10px] text-emerald-500 border-emerald-500/30">
                        Terminal Closed State
                      </Badge>
                    )}
                    <button
                      onClick={() => handleDeleteStatus(s.id)}
                      className="text-[var(--muted-foreground)] hover:text-rose-500 transition-colors cursor-pointer"
                      title="Delete Status"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Task Priorities & SLA */}
      {activeTab === 'priorities' && (
        <div className="space-y-4">
          <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-6 space-y-4 shadow-xs">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-bold text-[var(--foreground)]">Dynamic Task Priority Levels & SLA Rules</h2>
                <p className="text-xs text-[var(--muted-foreground)]">
                  Governs priority badges, urgency weighting for CPM dispatch, and resolution SLAs.
                </p>
              </div>
              <Button size="sm" onClick={() => setIsAddPriorityModalOpen(true)} className="gap-1 text-xs">
                <Plus className="h-3.5 w-3.5" />
                Add Priority Level
              </Button>
            </div>

            <div className="divide-y divide-[var(--border)] border border-[var(--border)] rounded-lg overflow-hidden text-xs">
              {priorities.map((p) => (
                <div key={p.id} className="p-3 bg-[var(--card)] flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span
                      className="px-2 py-0.5 rounded text-[10px] font-bold"
                      style={{ backgroundColor: `${p.color_hex}25`, color: p.color_hex, border: `1px solid ${p.color_hex}40` }}
                    >
                      {p.name.toUpperCase()}
                    </span>
                    <span className="text-[11px] text-[var(--muted-foreground)] font-mono">slug: {p.slug}</span>
                  </div>

                  <div className="flex items-center gap-4">
                    <span className="text-[11px] text-[var(--muted-foreground)]">
                      Urgency Weight: <strong className="text-[var(--foreground)]">{p.urgency_weight}</strong>
                    </span>
                    {p.sla_response_hours !== undefined && (
                      <span className="text-[11px] text-[var(--muted-foreground)]">
                        SLA: <strong className="text-[var(--foreground)]">{p.sla_response_hours}h</strong>
                      </span>
                    )}
                    <button
                      onClick={() => handleDeletePriority(p.id)}
                      className="text-[var(--muted-foreground)] hover:text-rose-500 transition-colors cursor-pointer"
                      title="Delete Priority"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Tab 3: Dynamic Custom Fields */}
      {activeTab === 'custom_fields' && (
        <div className="space-y-4">
          <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-6 space-y-4 shadow-xs">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-bold text-[var(--foreground)]">Tenant Custom Fields Engine (EAV / JSONB)</h2>
                <p className="text-xs text-[var(--muted-foreground)]">
                  Extend tasks and projects with arbitrary structured schema attributes without database migrations.
                </p>
              </div>
              <Button size="sm" onClick={() => setIsAddFieldModalOpen(true)} className="gap-1 text-xs">
                <Plus className="h-3.5 w-3.5" />
                Add Custom Field
              </Button>
            </div>

            <div className="divide-y divide-[var(--border)] border border-[var(--border)] rounded-lg overflow-hidden text-xs">
              {customFields.length === 0 ? (
                <div className="p-4 text-center text-[var(--muted-foreground)]">
                  No custom fields defined. Click "Add Custom Field" to create your first attribute.
                </div>
              ) : (
                customFields.map((cf) => (
                  <div key={cf.id} className="p-3 bg-[var(--card)] flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-[var(--foreground)]">{cf.field_name}</span>
                        <Badge variant="outline" className="font-mono text-[9px] uppercase">
                          {cf.field_type}
                        </Badge>
                        {cf.is_required && (
                          <Badge variant="critical" className="text-[9px] py-0">REQUIRED</Badge>
                        )}
                      </div>
                      <div className="text-[10px] text-[var(--muted-foreground)] font-mono mt-0.5">
                        key: {cf.field_key} • entity: {cf.entity_type}
                        {cf.options_json && ` • options: [${cf.options_json.join(', ')}]`}
                      </div>
                    </div>

                    <button
                      onClick={() => handleDeleteCustomField(cf.id)}
                      className="text-[var(--muted-foreground)] hover:text-rose-500 transition-colors cursor-pointer"
                      title="Delete Custom Field"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Tab 4: Role Permissions Matrix */}
      {activeTab === 'permissions' && (
        <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-6 space-y-4 shadow-xs">
          <div>
            <h2 className="text-sm font-bold text-[var(--foreground)]">Role-Based Access Control (RBAC) Permission Matrix</h2>
            <p className="text-xs text-[var(--muted-foreground)]">
              Fine-grained operation security nodes dynamically evaluated at the API gateway and client boundaries.
            </p>
          </div>

          <div className="overflow-x-auto border border-[var(--border)] rounded-lg">
            <table className="w-full text-xs text-left">
              <thead className="bg-[var(--secondary)]/40 border-b border-[var(--border)] font-semibold text-[var(--muted-foreground)]">
                <tr>
                  <th className="p-3">Permission Node</th>
                  {ROLES.map((role) => (
                    <th key={role} className="p-3 text-center uppercase tracking-wider text-[10px]">
                      {role}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {PERMISSION_KEYS.map((perm) => (
                  <tr key={perm.key} className="hover:bg-[var(--secondary)]/20 transition-colors">
                    <td className="p-3">
                      <div className="font-semibold text-[var(--foreground)]">{perm.label}</div>
                      <div className="text-[10px] text-[var(--muted-foreground)] font-mono">{perm.key}</div>
                    </td>
                    {ROLES.map((role) => {
                      const isGranted = db.hasPermission(tenantId, role, perm.key);
                      return (
                        <td key={role} className="p-3 text-center">
                          <input
                            type="checkbox"
                            checked={isGranted}
                            disabled={role === 'admin'}
                            onChange={() => handleTogglePermission(role, perm.key, isGranted)}
                            className="w-4 h-4 rounded text-[var(--primary)] cursor-pointer disabled:cursor-not-allowed"
                          />
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 5: Calendar Settings */}
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

      {/* Tab 6: Members Roster */}
      {activeTab === 'members' && (
        <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-xs">
          <h2 className="text-sm font-bold text-[var(--foreground)] mb-4">Workspace Roster & RLS Scopes</h2>
          <div className="divide-y divide-[var(--border)] border border-[var(--border)] rounded-lg overflow-hidden">
            {db.users.map((u) => {
              const membership = db.memberships.find(m => m.user_id === u.id && m.tenant_id === tenantId);
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

      {/* Tab 7: Audit Logs */}
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
                    <span className="text-[10px] font-mono text-[var(--muted-foreground)]">{log.entity_id}</span>
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

      {/* Modal: Add Status */}
      <Modal
        isOpen={isAddStatusModalOpen}
        onClose={() => setIsAddStatusModalOpen(false)}
        title="Add Workflow Pipeline Stage"
        description="Creates a dynamic task status and Kanban lane for this tenant."
      >
        <form onSubmit={handleAddStatus} className="space-y-4 text-xs">
          <div>
            <label className="font-semibold block mb-1">Status Name</label>
            <Input
              value={newStatusName}
              onChange={(e) => {
                setNewStatusName(e.target.value);
                setNewStatusSlug(e.target.value.toLowerCase().replace(/[^a-z0-9]/g, '_'));
              }}
              placeholder="e.g. Code Review"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="font-semibold block mb-1">Slug (Identifier)</label>
              <Input
                value={newStatusSlug}
                onChange={(e) => setNewStatusSlug(e.target.value)}
                placeholder="code_review"
                required
              />
            </div>
            <div>
              <label className="font-semibold block mb-1">Color (Hex)</label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={newStatusColor}
                  onChange={(e) => setNewStatusColor(e.target.value)}
                  className="w-8 h-8 rounded-md cursor-pointer border border-[var(--border)]"
                />
                <Input
                  value={newStatusColor}
                  onChange={(e) => setNewStatusColor(e.target.value)}
                  className="font-mono"
                />
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 pt-1">
            <input
              type="checkbox"
              id="isClosedStatus"
              checked={newStatusIsClosed}
              onChange={(e) => setNewStatusIsClosed(e.target.checked)}
              className="w-4 h-4 rounded text-[var(--primary)] cursor-pointer"
            />
            <label htmlFor="isClosedStatus" className="font-semibold cursor-pointer">
              Mark as Terminal / Completed State (100% progress closure)
            </label>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-[var(--border)]">
            <Button type="button" variant="outline" onClick={() => setIsAddStatusModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit">Create Status</Button>
          </div>
        </form>
      </Modal>

      {/* Modal: Add Priority */}
      <Modal
        isOpen={isAddPriorityModalOpen}
        onClose={() => setIsAddPriorityModalOpen(false)}
        title="Add Task Priority Level"
        description="Defines urgency ranking and resolution SLA for CPM dispatch."
      >
        <form onSubmit={handleAddPriority} className="space-y-4 text-xs">
          <div>
            <label className="font-semibold block mb-1">Priority Name</label>
            <Input
              value={newPriorityName}
              onChange={(e) => {
                setNewPriorityName(e.target.value);
                setNewPrioritySlug(e.target.value.toLowerCase().replace(/[^a-z0-9]/g, '_'));
              }}
              placeholder="e.g. Critical P0"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="font-semibold block mb-1">Slug</label>
              <Input
                value={newPrioritySlug}
                onChange={(e) => setNewPrioritySlug(e.target.value)}
                placeholder="critical_p0"
                required
              />
            </div>
            <div>
              <label className="font-semibold block mb-1">Color</label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={newPriorityColor}
                  onChange={(e) => setNewPriorityColor(e.target.value)}
                  className="w-8 h-8 rounded-md cursor-pointer border border-[var(--border)]"
                />
                <Input
                  value={newPriorityColor}
                  onChange={(e) => setNewPriorityColor(e.target.value)}
                  className="font-mono"
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="font-semibold block mb-1">Urgency Weight (1-100)</label>
              <Input
                type="number"
                value={newPriorityWeight}
                onChange={(e) => setNewPriorityWeight(parseInt(e.target.value, 10) || 50)}
                required
              />
            </div>
            <div>
              <label className="font-semibold block mb-1">SLA Response (Hours)</label>
              <Input
                type="number"
                value={newPrioritySlaHours}
                onChange={(e) => setNewPrioritySlaHours(parseInt(e.target.value, 10) || 24)}
                required
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-[var(--border)]">
            <Button type="button" variant="outline" onClick={() => setIsAddPriorityModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit">Create Priority</Button>
          </div>
        </form>
      </Modal>

      {/* Modal: Add Custom Field */}
      <Modal
        isOpen={isAddFieldModalOpen}
        onClose={() => setIsAddFieldModalOpen(false)}
        title="Add Dynamic Custom Field"
        description="Creates an EAV schema attribute stored in entity JSONB records."
      >
        <form onSubmit={handleAddCustomField} className="space-y-4 text-xs">
          <div>
            <label className="font-semibold block mb-1">Field Label</label>
            <Input
              value={newFieldName}
              onChange={(e) => {
                setNewFieldName(e.target.value);
                setNewFieldKey(e.target.value.toLowerCase().replace(/[^a-z0-9]/g, '_'));
              }}
              placeholder="e.g. Security Review Signoff"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="font-semibold block mb-1">Field Key (API identifier)</label>
              <Input
                value={newFieldKey}
                onChange={(e) => setNewFieldKey(e.target.value)}
                placeholder="security_signoff"
                required
              />
            </div>
            <div>
              <label className="font-semibold block mb-1">Field Type</label>
              <select
                value={newFieldType}
                onChange={(e) => setNewFieldType(e.target.value as CustomFieldType)}
                className="w-full h-9 rounded-md border border-[var(--input)] bg-[var(--card)] px-3 text-xs"
              >
                <option value="text">Text (String)</option>
                <option value="number">Number (Float/Integer)</option>
                <option value="date">Date (ISO 8601)</option>
                <option value="dropdown">Dropdown (Select)</option>
                <option value="checkbox">Checkbox (Boolean)</option>
                <option value="multiselect">Multiselect</option>
                <option value="user_reference">User Reference</option>
              </select>
            </div>
          </div>

          {(newFieldType === 'dropdown' || newFieldType === 'multiselect') && (
            <div>
              <label className="font-semibold block mb-1">Dropdown Options (Comma-separated)</label>
              <Input
                value={newFieldOptions}
                onChange={(e) => setNewFieldOptions(e.target.value)}
                placeholder="Option A, Option B, Option C"
                required
              />
            </div>
          )}

          <div className="flex items-center gap-2 pt-1">
            <input
              type="checkbox"
              id="isRequiredField"
              checked={newFieldRequired}
              onChange={(e) => setNewFieldRequired(e.target.checked)}
              className="w-4 h-4 rounded text-[var(--primary)] cursor-pointer"
            />
            <label htmlFor="isRequiredField" className="font-semibold cursor-pointer">
              Enforce non-null requirement on entity save
            </label>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-[var(--border)]">
            <Button type="button" variant="outline" onClick={() => setIsAddFieldModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit">Register Custom Field</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
