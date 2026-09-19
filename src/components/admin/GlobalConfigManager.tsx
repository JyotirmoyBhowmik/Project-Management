// ==============================================================================
// src/components/admin/GlobalConfigManager.tsx
// Root-Level Base Application Configuration & Feature Controls Management Module
// Enterprise SuperAdmin Dashboard for Dynamic App Identity, Master Switches,
// Maintenance Emergency Modes & Governance
// ==============================================================================

'use client';

import * as React from 'react';
import {
  FolderKanban,
  Layers,
  ShieldCheck,
  Workflow,
  Sparkles,
  Compass,
  Rocket,
  Cpu,
  Building2,
  Hexagon,
  Boxes,
  Zap,
  Target,
  Kanban,
  Save,
  RotateCcw,
  Sliders,
  Power,
  ShieldAlert,
  Lock,
  Globe,
  Mail,
  Palette,
  Eye,
  CheckCircle2,
  AlertTriangle,
  FileText,
  Clock,
  Check,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useAppConfig, APP_ICON_MAP } from '@/lib/context/app-config-context';
import {
  DEFAULT_GLOBAL_APP_CONFIG,
  SupportedAppIcons,
  type GlobalAppConfig,
} from '@/lib/validation/config-schemas';

export function GlobalConfigManager() {
  const { config, updateConfig, refreshConfig } = useAppConfig();

  const [activeTab, setActiveTab] = React.useState<
    'branding' | 'features' | 'maintenance' | 'security'
  >('branding');

  // Working local state
  const [formData, setFormData] = React.useState<GlobalAppConfig>(config);
  const [isSaving, setIsSaving] = React.useState(false);

  // Synchronize when config loads or changes
  React.useEffect(() => {
    setFormData(config);
  }, [config]);

  const handleSave = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setIsSaving(true);
    try {
      await updateConfig(formData);
      await refreshConfig();
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = () => {
    if (window.confirm('Reset all base application settings to enterprise defaults?')) {
      setFormData(DEFAULT_GLOBAL_APP_CONFIG);
    }
  };

  const updateFeatureFlag = (flagKey: keyof typeof formData.control_features, value: boolean) => {
    setFormData((prev) => ({
      ...prev,
      control_features: {
        ...prev.control_features,
        [flagKey]: value,
      },
    }));
  };

  const ActiveIconComponent = APP_ICON_MAP[formData.app_icon] || FolderKanban;

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12">
      {/* Top Banner & Action Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[var(--border)] pb-5">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <div
              className="h-8 w-8 rounded-lg flex items-center justify-center text-white shadow-xs"
              style={{ backgroundColor: formData.primary_color }}
            >
              <ActiveIconComponent className="h-4 w-4" />
            </div>
            <h1 className="text-xl font-bold tracking-tight text-[var(--foreground)]">
              Global Application Configuration
            </h1>
            <Badge variant="outline" className="font-mono text-[11px] uppercase">
              Root Level
            </Badge>
          </div>
          <p className="text-xs text-[var(--muted-foreground)]">
            Configure platform-wide identity, base branding, master feature switches, and operational security policies.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleReset}
            className="gap-1.5 text-xs"
            disabled={isSaving}
          >
            <RotateCcw className="h-3.5 w-3.5" />
            <span>Reset Defaults</span>
          </Button>

          <Button
            type="button"
            size="sm"
            onClick={() => handleSave()}
            disabled={isSaving}
            className="gap-1.5 text-xs bg-[var(--primary)] text-white shadow-xs hover:brightness-110"
          >
            <Save className="h-3.5 w-3.5" />
            <span>{isSaving ? 'Saving Changes...' : 'Save Configuration'}</span>
          </Button>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex border-b border-[var(--border)] gap-2 overflow-x-auto pb-px">
        {[
          { id: 'branding', label: 'Root & App Identity', icon: Palette },
          { id: 'features', label: 'Master Feature Controls', icon: Sliders },
          { id: 'maintenance', label: 'Emergency & Maintenance', icon: Power },
          { id: 'security', label: 'Security & Governance', icon: ShieldCheck },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 px-3.5 py-2 text-xs font-semibold border-b-2 transition-all cursor-pointer whitespace-nowrap ${
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

      {/* TAB 1: Root & Application Identity */}
      {activeTab === 'branding' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-5 space-y-5 shadow-xs">
              <h2 className="text-sm font-bold text-[var(--foreground)] flex items-center gap-2">
                <Globe className="h-4 w-4 text-[var(--primary)]" />
                <span>Base Application Identity</span>
              </h2>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-[var(--foreground)]">
                    Application Name
                  </label>
                  <Input
                    value={formData.app_name}
                    onChange={(e) => setFormData({ ...formData, app_name: e.target.value })}
                    placeholder="e.g. Enterprise PMS"
                    required
                  />
                  <p className="text-[10px] text-[var(--muted-foreground)]">
                    Visible on header, login screen, and page document titles.
                  </p>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-[var(--foreground)]">
                    Short Name / Acronym
                  </label>
                  <Input
                    value={formData.app_short_name}
                    onChange={(e) => setFormData({ ...formData, app_short_name: e.target.value })}
                    placeholder="e.g. PMS"
                    required
                  />
                  <p className="text-[10px] text-[var(--muted-foreground)]">
                    Pill badge displayed next to the app icon in compact navigation.
                  </p>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-[var(--foreground)]">
                  Application Subtitle / Tagline
                </label>
                <Input
                  value={formData.app_tagline}
                  onChange={(e) => setFormData({ ...formData, app_tagline: e.target.value })}
                  placeholder="e.g. Mission-Critical Project Management & Scheduling Platform"
                />
              </div>

              {/* Curated Icon Selector */}
              <div className="space-y-2 pt-2 border-t border-[var(--border)]">
                <label className="text-xs font-semibold text-[var(--foreground)] block">
                  Application Icon Identifier
                </label>
                <p className="text-[11px] text-[var(--muted-foreground)]">
                  Select the base system logo icon rendered solution-wide:
                </p>

                <div className="grid grid-cols-4 sm:grid-cols-7 gap-2.5 pt-1">
                  {SupportedAppIcons.map((iconKey) => {
                    const IconComp = APP_ICON_MAP[iconKey] || FolderKanban;
                    const isSelected = formData.app_icon === iconKey;
                    return (
                      <button
                        key={iconKey}
                        type="button"
                        onClick={() => setFormData({ ...formData, app_icon: iconKey })}
                        className={`flex flex-col items-center justify-center p-2.5 rounded-xl border transition-all cursor-pointer ${
                          isSelected
                            ? 'border-[var(--primary)] bg-[var(--primary)]/10 text-[var(--primary)] ring-2 ring-[var(--primary)]/30'
                            : 'border-[var(--border)] bg-[var(--secondary)]/40 text-[var(--muted-foreground)] hover:border-[var(--muted-foreground)]'
                        }`}
                      >
                        <IconComp className="h-5 w-5 mb-1" />
                        <span className="text-[9px] font-mono truncate max-w-full">{iconKey}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Primary Color & Organization Details */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2 border-t border-[var(--border)]">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-[var(--foreground)]">
                    Primary Brand Color
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={formData.primary_color}
                      onChange={(e) => setFormData({ ...formData, primary_color: e.target.value })}
                      className="h-8 w-8 rounded-lg cursor-pointer border border-[var(--border)] bg-transparent"
                    />
                    <Input
                      value={formData.primary_color}
                      onChange={(e) => setFormData({ ...formData, primary_color: e.target.value })}
                      className="font-mono text-xs uppercase"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-[var(--foreground)]">
                    Company / Organization
                  </label>
                  <Input
                    value={formData.company_name}
                    onChange={(e) => setFormData({ ...formData, company_name: e.target.value })}
                    placeholder="e.g. Enterprise Core Systems"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-[var(--foreground)]">
                    Platform Support Email
                  </label>
                  <Input
                    type="email"
                    value={formData.support_email}
                    onChange={(e) => setFormData({ ...formData, support_email: e.target.value })}
                    placeholder="support@domain.com"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Live Branding Preview */}
          <div className="space-y-4">
            <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-5 space-y-4 shadow-xs">
              <div className="flex items-center justify-between border-b border-[var(--border)] pb-3">
                <span className="text-xs font-bold text-[var(--foreground)] flex items-center gap-1.5">
                  <Eye className="h-4 w-4 text-[var(--primary)]" />
                  <span>Live App Branding Preview</span>
                </span>
                <Badge variant="outline" className="text-[10px]">Instant</Badge>
              </div>

              {/* Simulated Header Component */}
              <div className="space-y-1">
                <span className="text-[10px] font-semibold text-[var(--muted-foreground)] uppercase">
                  Header App Brand Pill
                </span>
                <div className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-2.5 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div
                      className="h-7 w-7 rounded-lg flex items-center justify-center text-white shadow-xs"
                      style={{ backgroundColor: formData.primary_color }}
                    >
                      <ActiveIconComponent className="h-3.5 w-3.5" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-[var(--foreground)] flex items-center gap-1.5">
                        <span>{formData.app_name || 'Enterprise PMS'}</span>
                        <span className="px-1.5 py-0.2 rounded text-[9px] font-mono bg-[var(--secondary)] text-[var(--muted-foreground)]">
                          {formData.app_short_name || 'PMS'}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Simulated Login Banner */}
              <div className="space-y-1 pt-2">
                <span className="text-[10px] font-semibold text-[var(--muted-foreground)] uppercase">
                  Login Gateway Identity
                </span>
                <div className="rounded-lg border border-[var(--border)] bg-[var(--secondary)]/40 p-4 text-center space-y-2">
                  <div
                    className="h-10 w-10 rounded-xl flex items-center justify-center text-white mx-auto shadow-xs"
                    style={{ backgroundColor: formData.primary_color }}
                  >
                    <ActiveIconComponent className="h-5 w-5" />
                  </div>
                  <h3 className="text-sm font-bold text-[var(--foreground)]">
                    {formData.app_name || 'Enterprise PMS'}
                  </h3>
                  <p className="text-[11px] text-[var(--muted-foreground)] line-clamp-2">
                    {formData.app_tagline || 'Mission-Critical Project Management & Scheduling Platform'}
                  </p>
                </div>
              </div>

              {/* Organization Footer */}
              <div className="pt-2 text-center text-[10px] text-[var(--muted-foreground)] border-t border-[var(--border)]">
                Managed by <span className="font-semibold text-[var(--foreground)]">{formData.company_name}</span>
                <br />
                Support: <span className="font-mono">{formData.support_email}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: Master Control Features */}
      {activeTab === 'features' && (
        <div className="space-y-4">
          <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-5 space-y-4 shadow-xs">
            <div>
              <h2 className="text-sm font-bold text-[var(--foreground)] flex items-center gap-2">
                <Sliders className="h-4 w-4 text-[var(--primary)]" />
                <span>Solution-Wide Master Feature Switches</span>
              </h2>
              <p className="text-xs text-[var(--muted-foreground)]">
                Enable or disable major functional modules globally. Disabling a module seamlessly removes its tabs and links solution-wide.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
              {[
                {
                  key: 'enable_wiki',
                  label: 'Living Documentation & Wiki',
                  description: 'Interactive documentation tree, Markdown editor, and task cross-linking.',
                  icon: FileText,
                },
                {
                  key: 'enable_graphify',
                  label: 'Graphify Network Engine',
                  description: 'Interactive D3 visual knowledge graph and hierarchical WBS tree decomposition.',
                  icon: Sparkles,
                },
                {
                  key: 'enable_sprints',
                  label: 'Agile Sprint Planning',
                  description: 'Velocity tracking, sprint backlog allocation, and burndown analytics.',
                  icon: Zap,
                },
                {
                  key: 'enable_cpm_engine',
                  label: 'Critical Path Engine (CPM)',
                  description: 'Automated forward/backward pass, total float, and critical path identification.',
                  icon: Target,
                },
                {
                  key: 'enable_evm',
                  label: 'Timesheets & EVM Analytics',
                  description: 'Labor time tracking, Earned Value Management (PV/EV/AC), and variance indicators.',
                  icon: Clock,
                },
                {
                  key: 'enable_subtasks',
                  label: 'Hierarchical Subtasks',
                  description: 'Parent-child task decomposition, child count badges, and progress roll-up.',
                  icon: Layers,
                },
                {
                  key: 'enable_milestones',
                  label: 'Milestone Scheduling',
                  description: 'Zero-duration checkpoint markers, Gantt diamond indicators, and filter toggles.',
                  icon: Target,
                },
                {
                  key: 'enable_scim',
                  label: 'SCIM 2.0 Directory Sync',
                  description: 'Automated enterprise identity provisioning and deactivation via Okta/Azure AD.',
                  icon: Building2,
                },
                {
                  key: 'enable_sso',
                  label: 'Enterprise SAML / OIDC SSO',
                  description: 'Single Sign-On authentication and domain-based Identity Provider routing.',
                  icon: ShieldCheck,
                },
                {
                  key: 'enable_sla_milestone_alerts',
                  label: 'SLA Milestone Escalations',
                  description: 'Background cron scanner dispatching alerts for approaching critical milestones.',
                  icon: AlertTriangle,
                },
                {
                  key: 'enable_public_registration',
                  label: 'Public Self-Registration',
                  description: 'Allow new external users to create accounts without invitation.',
                  icon: Globe,
                },
              ].map((feat) => {
                const Icon = feat.icon;
                const isEnabled = Boolean(
                  (formData.control_features as any)?.[feat.key]
                );
                return (
                  <div
                    key={feat.key}
                    className={`p-4 rounded-xl border transition-all flex items-start justify-between gap-3 ${
                      isEnabled
                        ? 'border-[var(--border)] bg-[var(--card)]'
                        : 'border-dashed border-[var(--border)] bg-[var(--secondary)]/20 opacity-75'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div
                        className={`h-8 w-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${
                          isEnabled
                            ? 'bg-[var(--primary)]/10 text-[var(--primary)]'
                            : 'bg-[var(--secondary)] text-[var(--muted-foreground)]'
                        }`}
                      >
                        <Icon className="h-4 w-4" />
                      </div>
                      <div className="space-y-0.5">
                        <div className="text-xs font-bold text-[var(--foreground)] flex items-center gap-2">
                          <span>{feat.label}</span>
                          <span
                            className={`text-[9px] font-mono px-1.5 py-0.2 rounded font-bold uppercase ${
                              isEnabled
                                ? 'bg-emerald-500/10 text-emerald-500'
                                : 'bg-zinc-500/10 text-zinc-400'
                            }`}
                          >
                            {isEnabled ? 'ACTIVE' : 'DISABLED'}
                          </span>
                        </div>
                        <p className="text-[11px] text-[var(--muted-foreground)] leading-relaxed">
                          {feat.description}
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => updateFeatureFlag(feat.key as any, !isEnabled)}
                      className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                        isEnabled ? 'bg-[var(--primary)]' : 'bg-[var(--secondary)]'
                      }`}
                    >
                      <span
                        className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                          isEnabled ? 'translate-x-4' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: Emergency & Maintenance Controls */}
      {activeTab === 'maintenance' && (
        <div className="space-y-5">
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-5 space-y-4 shadow-xs">
            <div className="flex items-start gap-3">
              <div className="h-9 w-9 rounded-lg bg-amber-500/20 text-amber-500 flex items-center justify-center shrink-0">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div className="space-y-1">
                <h2 className="text-sm font-bold text-[var(--foreground)]">
                  Platform Emergency & Scheduled Maintenance Mode
                </h2>
                <p className="text-xs text-[var(--muted-foreground)]">
                  When enabled, non-superadmin users attempting to log in will see a maintenance broadcast screen. SuperAdmins retain full bypass access.
                </p>
              </div>
            </div>

            <div className="p-4 rounded-xl border border-[var(--border)] bg-[var(--card)] space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs font-bold text-[var(--foreground)]">
                    Maintenance Mode Master Switch
                  </div>
                  <div className="text-[11px] text-[var(--muted-foreground)]">
                    Status: {formData.control_features.maintenance_mode ? 'ACTIVATED (LOCKED)' : 'OFF (NORMAL OPERATIONS)'}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() =>
                    updateFeatureFlag(
                      'maintenance_mode',
                      !formData.control_features.maintenance_mode
                    )
                  }
                  className={`text-xs font-bold px-3 py-1.5 rounded-lg cursor-pointer transition-colors shadow-xs ${
                    formData.control_features.maintenance_mode
                      ? 'bg-amber-500 text-white hover:bg-amber-600'
                      : 'bg-[var(--secondary)] text-[var(--foreground)] hover:bg-[var(--secondary)]/80'
                  }`}
                >
                  {formData.control_features.maintenance_mode ? 'Deactivate Maintenance' : 'Activate Maintenance'}
                </button>
              </div>

              <div className="space-y-1.5 pt-2 border-t border-[var(--border)]">
                <label className="text-xs font-semibold text-[var(--foreground)]">
                  Public Maintenance Alert Broadcast Message
                </label>
                <textarea
                  value={formData.control_features.maintenance_message}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      control_features: {
                        ...prev.control_features,
                        maintenance_message: e.target.value,
                      },
                    }))
                  }
                  rows={3}
                  className="w-full rounded-lg border border-[var(--border)] bg-transparent p-2.5 text-xs text-[var(--foreground)] focus:border-[var(--primary)] focus:outline-none"
                  placeholder="Enter maintenance message broadcast to users..."
                />
                <p className="text-[10px] text-[var(--muted-foreground)]">
                  This text will be prominently displayed on the login screen while maintenance mode is active.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: Security & Governance */}
      {activeTab === 'security' && (
        <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-5 space-y-5 shadow-xs">
          <div>
            <h2 className="text-sm font-bold text-[var(--foreground)] flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-[var(--primary)]" />
              <span>Platform Security & Operational Governance</span>
            </h2>
            <p className="text-xs text-[var(--muted-foreground)]">
              Enforce enterprise session durations, file storage limits, and audit retention policies.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-[var(--foreground)]">
                Session Inactivity Timeout (Minutes)
              </label>
              <Input
                type="number"
                min={5}
                max={1440}
                value={formData.security_controls.session_timeout_minutes}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    security_controls: {
                      ...prev.security_controls,
                      session_timeout_minutes: parseInt(e.target.value, 10) || 120,
                    },
                  }))
                }
              />
              <p className="text-[10px] text-[var(--muted-foreground)]">
                Idle sessions are invalidated after this period (default: 120 minutes).
              </p>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-[var(--foreground)]">
                Maximum File Upload Limit (MB)
              </label>
              <Input
                type="number"
                min={1}
                max={500}
                value={formData.security_controls.max_upload_size_mb}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    security_controls: {
                      ...prev.security_controls,
                      max_upload_size_mb: parseInt(e.target.value, 10) || 25,
                    },
                  }))
                }
              />
              <p className="text-[10px] text-[var(--muted-foreground)]">
                Maximum allowed size for document and task attachments (default: 25 MB).
              </p>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-[var(--foreground)]">
                Multi-Factor Authentication (MFA) Tier
              </label>
              <select
                value={formData.security_controls.mfa_enforcement}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    security_controls: {
                      ...prev.security_controls,
                      mfa_enforcement: e.target.value as any,
                    },
                  }))
                }
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--secondary)]/50 p-2 text-xs text-[var(--foreground)] focus:outline-none"
              >
                <option value="optional">Optional (Recommended for standard users)</option>
                <option value="enforced_for_superadmin">Enforced for SuperAdmins & Workspace Owners</option>
                <option value="enforced_all">Enforced for All Users Platform-Wide</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-[var(--foreground)]">
                Audit Trail Retention Duration (Days)
              </label>
              <Input
                type="number"
                min={7}
                max={3650}
                value={formData.security_controls.audit_retention_days}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    security_controls: {
                      ...prev.security_controls,
                      audit_retention_days: parseInt(e.target.value, 10) || 90,
                    },
                  }))
                }
              />
              <p className="text-[10px] text-[var(--muted-foreground)]">
                Audit log retention period before automated compliance archiving (default: 90 days).
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
