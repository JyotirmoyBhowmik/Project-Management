// ==============================================================================
// src/app/(dashboard)/settings/automations/page.tsx
// No-Code Workflow Automation & Webhooks Engine
// ==============================================================================

'use client';

import * as React from 'react';
import {
  Zap,
  Plus,
  Trash2,
  CheckCircle2,
  XCircle,
  Clock,
  Globe,
  Settings,
  ShieldCheck,
  ChevronRight,
  Sparkles,
} from 'lucide-react';
import { useTenantStore } from '@/lib/stores/tenant-store';
import { TenantAutomation, AutomationExecutionLog, TenantWebhook } from '@/types/database';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Modal } from '@/components/ui/dialog';
import {
  createAutomationAction,
  toggleAutomationAction,
  deleteAutomationAction,
  getTenantAutomationsAction,
  createWebhookAction,
  getTenantWebhooksAction,
} from '@/actions/automations';
import { toast } from 'sonner';

export default function AutomationsPage() {
  const { activeTenant, activeRole, currentUser } = useTenantStore();
  const tenantId = activeTenant?.id;
  const isSuperadmin = Boolean(currentUser?.is_superadmin) || currentUser?.email === 'admin@jyotirmoyb.com';
  const isAdmin = ['owner', 'admin', 'project_manager'].includes(activeRole) || isSuperadmin;

  const [automations, setAutomations] = React.useState<TenantAutomation[]>([]);
  const [logs, setLogs] = React.useState<AutomationExecutionLog[]>([]);
  const [webhooks, setWebhooks] = React.useState<TenantWebhook[]>([]);
  const [activeTab, setActiveTab] = React.useState<'rules' | 'logs' | 'webhooks'>('rules');

  // Rule Builder Modal
  const [isCreateModalOpen, setIsCreateModalOpen] = React.useState(false);
  const [ruleName, setRuleName] = React.useState('');
  const [triggerType, setTriggerType] = React.useState<'task_status_changed' | 'task_created' | 'due_date_approaching' | 'dependency_cleared'>('task_status_changed');
  const [conditionField, setConditionField] = React.useState('priority');
  const [conditionOperator, setConditionOperator] = React.useState<'equals' | 'not_equals' | 'greater_than' | 'is_empty'>('equals');
  const [conditionValue, setConditionValue] = React.useState('urgent');
  const [actionType, setActionType] = React.useState<'update_field' | 'assign_user' | 'dispatch_webhook'>('update_field');
  const [actionFieldValue, setActionFieldValue] = React.useState('review');

  // Webhook Modal
  const [isWebhookModalOpen, setIsWebhookModalOpen] = React.useState(false);
  const [webhookUrl, setWebhookUrl] = React.useState('');

  const loadData = React.useCallback(async () => {
    if (!tenantId) return;
    const res = await getTenantAutomationsAction(tenantId);
    if (res.success && res.data) {
      setAutomations(res.data.automations);
      setLogs(res.data.logs);
    }
    const hookRes = await getTenantWebhooksAction(tenantId);
    if (hookRes.success && hookRes.data) {
      setWebhooks(hookRes.data);
    }
  }, [tenantId]);

  React.useEffect(() => {
    loadData();
  }, [loadData]);

  const handleCreateRule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tenantId) return;

    try {
      const res = await createAutomationAction({
        tenant_id: tenantId,
        name: ruleName,
        trigger_type: triggerType,
        trigger_config: {},
        conditions: [
          {
            field: conditionField,
            operator: conditionOperator,
            value: conditionValue,
          },
        ],
        actions: [
          {
            action_type: actionType,
            payload:
              actionType === 'update_field'
                ? { status: actionFieldValue }
                : { user_id: actionFieldValue },
          },
        ],
      });

      if (res.success) {
        toast.success('Automation rule created!');
        setIsCreateModalOpen(false);
        setRuleName('');
        await loadData();
      } else {
        toast.error(res.error || 'Failed to create automation');
      }
    } catch {
      toast.error('Failed to create automation');
    }
  };

  const handleToggle = async (id: string, currentActive: boolean) => {
    const res = await toggleAutomationAction(id, !currentActive);
    if (res.success) {
      toast.success(currentActive ? 'Automation paused' : 'Automation activated');
      await loadData();
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this automation rule?')) return;
    const res = await deleteAutomationAction(id);
    if (res.success) {
      toast.success('Automation deleted');
      await loadData();
    }
  };

  const handleCreateWebhook = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tenantId) return;
    const res = await createWebhookAction(tenantId, webhookUrl, ['task.created', 'task.updated']);
    if (res.success) {
      toast.success('Webhook registered successfully');
      setIsWebhookModalOpen(false);
      setWebhookUrl('');
      await loadData();
    }
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-[var(--foreground)] flex items-center gap-2">
            <Zap className="h-6 w-6 text-yellow-400" />
            <span>Workflow Automations & Webhooks</span>
          </h1>
          <p className="text-xs text-[var(--muted-foreground)]">
            Configure event-driven triggers, conditional field updates, and webhooks across the workspace.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {activeTab === 'rules' && isAdmin && (
            <Button size="sm" onClick={() => setIsCreateModalOpen(true)} className="gap-1.5 text-xs font-semibold">
              <Plus className="h-4 w-4" />
              <span>Create Rule</span>
            </Button>
          )}
          {activeTab === 'webhooks' && isAdmin && (
            <Button size="sm" onClick={() => setIsWebhookModalOpen(true)} className="gap-1.5 text-xs font-semibold">
              <Globe className="h-4 w-4" />
              <span>New Webhook</span>
            </Button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-[var(--border)]">
        {[
          { id: 'rules', label: 'Active Rules', icon: Zap },
          { id: 'logs', label: 'Execution Logs', icon: Clock },
          { id: 'webhooks', label: 'Outbound Webhooks', icon: Globe },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 px-3.5 py-2 text-xs font-semibold border-b-2 transition-all cursor-pointer ${
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

      {/* 1. Rules Tab */}
      {activeTab === 'rules' && (
        <div className="space-y-4">
          {automations.length === 0 ? (
            <div className="p-12 text-center text-xs text-[var(--muted-foreground)] bg-[var(--card)] rounded-2xl border border-[var(--border)] space-y-2">
              <Zap className="h-8 w-8 text-yellow-400 mx-auto opacity-50" />
              <p className="font-semibold text-[var(--foreground)]">No workflow automations active</p>
              <p>Create your first rule to automate task updates when statuses change or deadlines approach.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {automations.map((rule) => (
                <div
                  key={rule.id}
                  className="bg-[var(--card)] p-5 rounded-2xl border border-[var(--border)] shadow-xs space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="h-8 w-8 rounded-lg bg-yellow-400/10 flex items-center justify-center text-yellow-400">
                        <Zap className="h-4 w-4" />
                      </div>
                      <h4 className="text-xs font-bold text-[var(--foreground)]">{rule.name}</h4>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleToggle(rule.id, rule.is_active)}
                        className={`h-5 w-9 rounded-full transition-colors relative cursor-pointer ${
                          rule.is_active ? 'bg-emerald-500' : 'bg-[var(--secondary)]'
                        }`}
                      >
                        <span
                          className={`h-4 w-4 rounded-full bg-white absolute top-0.5 transition-transform ${
                            rule.is_active ? 'right-0.5' : 'left-0.5'
                          }`}
                        />
                      </button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleDelete(rule.id)}
                        className="h-7 w-7 p-0 text-red-400 hover:text-red-300"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>

                  {/* Visual trigger sequence */}
                  <div className="p-3 bg-[var(--secondary)]/40 rounded-xl text-xs space-y-1 font-mono text-[11px]">
                    <div className="text-[var(--muted-foreground)]">
                      WHEN: <span className="text-[var(--primary)] font-semibold">{rule.trigger_type}</span>
                    </div>
                    {rule.conditions && rule.conditions.length > 0 && (
                      <div className="text-[var(--muted-foreground)]">
                        IF: <span className="text-orange-400 font-semibold">{JSON.stringify(rule.conditions[0])}</span>
                      </div>
                    )}
                    <div className="text-[var(--muted-foreground)]">
                      THEN: <span className="text-emerald-400 font-semibold">{JSON.stringify(rule.actions[0])}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 2. Execution Logs Tab */}
      {activeTab === 'logs' && (
        <div className="bg-[var(--card)] p-5 rounded-2xl border border-[var(--border)] shadow-xs space-y-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--muted-foreground)]">Recent Execution History</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-[var(--border)] text-[var(--muted-foreground)]">
                  <th className="pb-2">Timestamp</th>
                  <th className="pb-2">Status</th>
                  <th className="pb-2">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {logs.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="py-8 text-center text-[var(--muted-foreground)]">
                      No executions logged yet. Triggers will appear here live.
                    </td>
                  </tr>
                ) : (
                  logs.map((l) => (
                    <tr key={l.id}>
                      <td className="py-2.5 font-mono text-[var(--muted-foreground)]">{new Date(l.triggered_at).toLocaleString()}</td>
                      <td className="py-2.5">
                        <Badge
                          variant={l.status === 'success' ? 'default' : l.status === 'failed' ? 'destructive' : 'secondary'}
                          className="text-[10px] capitalize"
                        >
                          {l.status}
                        </Badge>
                      </td>
                      <td className="py-2.5 font-mono text-[10px] text-[var(--muted-foreground)] max-w-md truncate">
                        {JSON.stringify(l.log_details)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 3. Outbound Webhooks Tab */}
      {activeTab === 'webhooks' && (
        <div className="bg-[var(--card)] p-5 rounded-2xl border border-[var(--border)] shadow-xs space-y-4">
          <div className="flex justify-between items-center pb-2 border-b border-[var(--border)]">
            <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--foreground)]">Subscribed Endpoints</h3>
            <span className="text-xs text-[var(--muted-foreground)]">{webhooks.length} endpoints</span>
          </div>

          <div className="space-y-3">
            {webhooks.length === 0 ? (
              <div className="py-8 text-center text-xs text-[var(--muted-foreground)]">
                No webhooks configured. Register an endpoint to stream events to external platforms.
              </div>
            ) : (
              webhooks.map((hook) => (
                <div key={hook.id} className="p-3 bg-[var(--secondary)]/40 rounded-xl border border-[var(--border)] flex justify-between items-center">
                  <div>
                    <div className="font-mono text-xs font-bold text-[var(--foreground)]">{hook.target_url}</div>
                    <div className="text-[10px] text-[var(--muted-foreground)]">Secret: {hook.secret_hash.substring(0, 12)}...</div>
                  </div>
                  <Badge variant={hook.is_active ? 'default' : 'secondary'} className="text-[10px]">
                    {hook.is_active ? 'Active' : 'Disabled'}
                  </Badge>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Rule Creation Modal */}
      <Modal isOpen={isCreateModalOpen} onClose={() => setIsCreateModalOpen(false)} title="Create Automation Rule">
        <form onSubmit={handleCreateRule} className="space-y-3">
          <div>
            <label className="text-xs font-semibold">Rule Name</label>
            <Input value={ruleName} onChange={(e) => setRuleName(e.target.value)} placeholder="e.g. Auto-escalate Urgent Tasks" required />
          </div>

          <div>
            <label className="text-xs font-semibold">Trigger Event (When)</label>
            <select
              value={triggerType}
              onChange={(e) => setTriggerType(e.target.value as any)}
              className="w-full mt-1 h-9 px-3 text-xs bg-[var(--secondary)] text-[var(--foreground)] border border-[var(--border)] rounded-lg font-medium"
            >
              <option value="task_status_changed">Task Status Changed</option>
              <option value="task_created">Task Created</option>
              <option value="due_date_approaching">Due Date Approaching (24h)</option>
              <option value="dependency_cleared">All Predecessors Completed</option>
            </select>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs font-semibold">Condition Field (If)</label>
              <select
                value={conditionField}
                onChange={(e) => setConditionField(e.target.value)}
                className="w-full mt-1 h-9 px-3 text-xs bg-[var(--secondary)] text-[var(--foreground)] border border-[var(--border)] rounded-lg font-medium"
              >
                <option value="priority">Priority</option>
                <option value="status">Status</option>
                <option value="story_points">Story Points</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold">Condition Value</label>
              <Input value={conditionValue} onChange={(e) => setConditionValue(e.target.value)} />
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold">Action (Then)</label>
            <div className="grid grid-cols-2 gap-2 mt-1">
              <select
                value={actionType}
                onChange={(e) => setActionType(e.target.value as any)}
                className="h-9 px-3 text-xs bg-[var(--secondary)] text-[var(--foreground)] border border-[var(--border)] rounded-lg font-medium"
              >
                <option value="update_field">Update Field (Status)</option>
                <option value="assign_user">Auto-assign Team Member</option>
              </select>
              <Input
                value={actionFieldValue}
                onChange={(e) => setActionFieldValue(e.target.value)}
                placeholder="Value (e.g. review)"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-3">
            <Button type="button" variant="outline" onClick={() => setIsCreateModalOpen(false)}>Cancel</Button>
            <Button type="submit">Create Automation</Button>
          </div>
        </form>
      </Modal>

      {/* Webhook Modal */}
      <Modal isOpen={isWebhookModalOpen} onClose={() => setIsWebhookModalOpen(false)} title="Register Outbound Webhook">
        <form onSubmit={handleCreateWebhook} className="space-y-3">
          <div>
            <label className="text-xs font-semibold">Endpoint URL</label>
            <Input
              type="url"
              value={webhookUrl}
              onChange={(e) => setWebhookUrl(e.target.value)}
              placeholder="https://api.example.com/pms-webhook"
              required
            />
          </div>
          <div className="flex justify-end gap-2 pt-3">
            <Button type="button" variant="outline" onClick={() => setIsWebhookModalOpen(false)}>Cancel</Button>
            <Button type="submit">Save Webhook</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
