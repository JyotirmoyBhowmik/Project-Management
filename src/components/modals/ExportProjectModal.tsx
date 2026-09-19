// ==============================================================================
// src/components/modals/ExportProjectModal.tsx
// High-Performance Project Schedule & CPM Graph Exporter (CSV & JSON)
// ==============================================================================

'use client';

import * as React from 'react';
import { Download, FileSpreadsheet, FileJson, CheckCircle2, Loader2, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Modal } from '@/components/ui/dialog';
import { Project, Task, TaskDependency } from '@/types/database';
import { toast } from 'sonner';

interface ExportProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  project: Project | null;
  tasks: Task[];
  dependencies: TaskDependency[];
  tenantId: string;
}

export function ExportProjectModal({
  isOpen,
  onClose,
  project,
  tasks,
  dependencies,
  tenantId,
}: ExportProjectModalProps) {
  const [selectedFormat, setSelectedFormat] = React.useState<'csv' | 'json'>('csv');
  const [isExporting, setIsExporting] = React.useState(false);

  if (!project) return null;

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const url = `/api/v1/export?projectId=${project.id}&tenant_id=${tenantId}&format=${selectedFormat}`;
      const res = await fetch(url, {
        headers: {
          'x-tenant-id': tenantId,
        },
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || `Export failed with status ${res.status}`);
      }

      const blob = await res.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      const fileExt = selectedFormat === 'csv' ? 'csv' : 'json';
      link.download = `${project.code || 'project'}-schedule.${fileExt}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(downloadUrl);

      toast.success(`Project exported successfully as ${selectedFormat.toUpperCase()}.`);
      onClose();
    } catch (err: any) {
      toast.error(err?.message || 'Failed to export project schedule');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Export Project Schedule & Network"
      className="max-w-md"
    >
      <div className="space-y-4 pt-1">
        {/* Project Metadata Card */}
        <div className="p-3.5 rounded-xl border border-[var(--border)] bg-[var(--secondary)]/40 space-y-2">
          <div className="flex items-center justify-between">
            <span className="font-bold text-xs text-[var(--foreground)] truncate max-w-[200px]">
              {project.name}
            </span>
            <Badge variant="outline" className="font-mono text-[10px]">
              {project.code || 'PRJ'}
            </Badge>
          </div>
          <div className="flex items-center gap-4 text-xs text-[var(--muted-foreground)]">
            <span>
              <strong className="text-[var(--foreground)]">{tasks.length}</strong> Tasks
            </span>
            <span>•</span>
            <span>
              <strong className="text-[var(--foreground)]">{dependencies.length}</strong> CPM Dependencies
            </span>
            <span>•</span>
            <span>
              <strong className="text-emerald-400">
                {tasks.filter((t) => t.is_critical).length}
              </strong>{' '}
              Critical Path
            </span>
          </div>
        </div>

        {/* Format Selection */}
        <div className="space-y-2">
          <label className="text-xs font-semibold text-[var(--foreground)]">Select Export Format</label>

          <div className="grid grid-cols-2 gap-3">
            {/* CSV Option */}
            <button
              type="button"
              onClick={() => setSelectedFormat('csv')}
              className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between gap-2 ${
                selectedFormat === 'csv'
                  ? 'border-emerald-500/80 bg-emerald-500/10 shadow-xs'
                  : 'border-[var(--border)] hover:bg-[var(--secondary)]/40'
              }`}
            >
              <div className="flex items-center justify-between">
                <FileSpreadsheet className={`w-5 h-5 ${selectedFormat === 'csv' ? 'text-emerald-400' : 'text-muted-foreground'}`} />
                {selectedFormat === 'csv' && <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
              </div>
              <div>
                <div className="font-bold text-xs text-[var(--foreground)]">CSV Spreadsheet</div>
                <p className="text-[10px] text-[var(--muted-foreground)] mt-0.5">
                  Compatible with Microsoft Excel, Google Sheets, & Numbers.
                </p>
              </div>
            </button>

            {/* JSON Option */}
            <button
              type="button"
              onClick={() => setSelectedFormat('json')}
              className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between gap-2 ${
                selectedFormat === 'json'
                  ? 'border-blue-500/80 bg-blue-500/10 shadow-xs'
                  : 'border-[var(--border)] hover:bg-[var(--secondary)]/40'
              }`}
            >
              <div className="flex items-center justify-between">
                <FileJson className={`w-5 h-5 ${selectedFormat === 'json' ? 'text-blue-400' : 'text-muted-foreground'}`} />
                {selectedFormat === 'json' && <CheckCircle2 className="w-4 h-4 text-blue-400" />}
              </div>
              <div>
                <div className="font-bold text-xs text-[var(--foreground)]">Full JSON Schema</div>
                <p className="text-[10px] text-[var(--muted-foreground)] mt-0.5">
                  Preserves CPM dependency graphs, lags, and exact schema.
                </p>
              </div>
            </button>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-end gap-2 pt-3 border-t border-[var(--border)]">
          <Button variant="outline" type="button" onClick={onClose} disabled={isExporting}>
            Cancel
          </Button>
          <Button onClick={handleExport} disabled={isExporting} className="gap-1.5">
            {isExporting ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Exporting...</span>
              </>
            ) : (
              <>
                <Download className="w-3.5 h-3.5" />
                <span>Download {selectedFormat.toUpperCase()}</span>
              </>
            )}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
