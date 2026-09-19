// ==============================================================================
// src/components/modals/ImportProjectModal.tsx
// High-Performance Schedule & CPM Import Dialog with Pre-Validation Cycle Guard
// ==============================================================================

'use client';

import * as React from 'react';
import { Upload, FileUp, AlertTriangle, CheckCircle2, Loader2, FileSpreadsheet } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Modal } from '@/components/ui/dialog';
import { toast } from 'sonner';

interface ImportProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: string;
  tenantId: string;
  onImportComplete: () => void;
}

export function ImportProjectModal({
  isOpen,
  onClose,
  projectId,
  tenantId,
  onImportComplete,
}: ImportProjectModalProps) {
  const [jsonText, setJsonText] = React.useState('');
  const [isValidating, setIsValidating] = React.useState(false);
  const [isIngesting, setIsIngesting] = React.useState(false);
  const [validationReport, setValidationReport] = React.useState<{
    total: number;
    valid: number;
    invalid: number;
    hasCycles: boolean;
    preview: any[];
  } | null>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      if (file.name.endsWith('.json')) {
        setJsonText(text);
      } else if (file.name.endsWith('.csv')) {
        // Simple CSV parser converting rows to JSON import rows
        const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
        if (lines.length > 1) {
          const headers = lines[0].split(',').map((h) => h.trim().toLowerCase().replace(/[\s_]/g, ''));
          const rows = lines.slice(1).map((line) => {
            const values = line.split(',').map((v) => v.trim().replace(/^["']|["']$/g, ''));
            const rowObj: Record<string, any> = {};
            headers.forEach((h, idx) => {
              rowObj[h] = values[idx] || '';
            });
            return {
              title: rowObj.title || rowObj.taskname || rowObj.name || 'Imported Task',
              duration_days: parseInt(rowObj.duration || rowObj.durationdays || '1', 10) || 1,
              start_date: rowObj.startdate || rowObj.start || new Date().toISOString().split('T')[0],
              priority: rowObj.priority || 'medium',
              status: rowObj.status || 'todo',
            };
          });
          setJsonText(JSON.stringify(rows, null, 2));
        }
      }
    };
    reader.readAsText(file);
  };

  const handleValidate = async () => {
    if (!jsonText.trim()) {
      toast.error('Please upload a file or paste JSON/CSV data');
      return;
    }

    setIsValidating(true);
    setValidationReport(null);
    try {
      let rows: any[] = [];
      const parsed = JSON.parse(jsonText);
      if (Array.isArray(parsed)) {
        rows = parsed;
      } else if (parsed.tasks && Array.isArray(parsed.tasks)) {
        rows = parsed.tasks;
      } else {
        throw new Error('JSON must be an array of tasks or an object with a tasks array');
      }

      const res = await fetch('/api/v1/import', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-tenant-id': tenantId,
        },
        body: JSON.stringify({
          projectId,
          dryRun: true,
          rows,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Dry run validation failed');
      }

      const payload = data.data;
      setValidationReport({
        total: payload.summary?.totalRows || rows.length,
        valid: payload.summary?.validRows || rows.length,
        invalid: payload.summary?.invalidRows || 0,
        hasCycles: Boolean(payload.cycleCheck?.hasCycle),
        preview: payload.previewResults || [],
      });

      if (payload.cycleCheck?.hasCycle) {
        toast.warning('Schedule dependency cycles detected! Ingestion blocked.');
      } else {
        toast.success(`Validated ${payload.summary?.validRows || rows.length} tasks ready for ingest.`);
      }
    } catch (err: any) {
      toast.error(err?.message || 'Failed to validate data');
    } finally {
      setIsValidating(false);
    }
  };

  const handleIngest = async () => {
    if (!jsonText.trim()) return;

    setIsIngesting(true);
    try {
      let rows: any[] = [];
      const parsed = JSON.parse(jsonText);
      rows = Array.isArray(parsed) ? parsed : parsed.tasks || [];

      const res = await fetch('/api/v1/import', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-tenant-id': tenantId,
        },
        body: JSON.stringify({
          projectId,
          dryRun: false,
          rows,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Import failed');
      }

      toast.success('Project tasks imported successfully!');
      onImportComplete();
      onClose();
    } catch (err: any) {
      toast.error(err?.message || 'Failed to import tasks');
    } finally {
      setIsIngesting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Import Schedule (.csv / .xlsx / .json)"
      className="max-w-lg"
    >
      <div className="space-y-4 pt-1">
        {/* Upload Box */}
        <div className="border border-dashed border-[var(--border)] rounded-xl p-5 text-center bg-[var(--secondary)]/30 hover:bg-[var(--secondary)]/50 transition-colors">
          <FileUp className="w-8 h-8 mx-auto text-blue-400 mb-2" />
          <p className="text-xs font-semibold text-[var(--foreground)]">Choose CSV or JSON Schedule file</p>
          <p className="text-[10px] text-[var(--muted-foreground)] mt-0.5">Supports Microsoft Excel CSV exports and PMS JSON dumps</p>
          <label className="inline-block mt-3">
            <input
              type="file"
              accept=".csv,.json"
              onChange={handleFileSelect}
              className="hidden"
            />
            <span className="cursor-pointer px-3 py-1.5 rounded-lg border border-[var(--border)] bg-[var(--card)] hover:bg-[var(--secondary)] text-xs font-semibold shadow-xs">
              Select File
            </span>
          </label>
        </div>

        {/* JSON Preview / Paste */}
        <div>
          <label className="text-xs font-semibold text-[var(--foreground)] flex items-center justify-between">
            <span>Or Paste Raw JSON / CSV Content</span>
            {jsonText && (
              <button
                type="button"
                onClick={() => {
                  setJsonText('');
                  setValidationReport(null);
                }}
                className="text-[10px] text-red-400 hover:underline cursor-pointer"
              >
                Clear
              </button>
            )}
          </label>
          <textarea
            rows={5}
            value={jsonText}
            onChange={(e) => {
              setJsonText(e.target.value);
              setValidationReport(null);
            }}
            placeholder='[{"title": "Initial Task", "start_date": "2026-10-01", "duration_days": 5, "priority": "high"}]'
            className="mt-1.5 w-full bg-[var(--background)] border border-[var(--border)] rounded-lg p-2.5 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>

        {/* Validation Report */}
        {validationReport && (
          <div className="p-3 rounded-xl border border-[var(--border)] bg-[var(--secondary)]/50 space-y-2 text-xs">
            <div className="flex items-center justify-between">
              <span className="font-bold text-[var(--foreground)]">Dry-Run Validation Report</span>
              <Badge
                variant={validationReport.hasCycles || validationReport.invalid > 0 ? 'destructive' : 'outline'}
                className="text-[10px]"
              >
                {validationReport.valid} / {validationReport.total} Valid
              </Badge>
            </div>

            {validationReport.hasCycles && (
              <div className="flex items-center gap-1.5 text-rose-400 text-xs font-semibold">
                <AlertTriangle className="w-3.5 h-3.5" />
                Circular Dependency Cycle detected in schedule network!
              </div>
            )}
          </div>
        )}

        {/* Modal Footer */}
        <div className="flex items-center justify-end gap-2 pt-3 border-t border-[var(--border)]">
          <Button variant="outline" type="button" onClick={onClose} disabled={isValidating || isIngesting}>
            Cancel
          </Button>

          {!validationReport?.valid ? (
            <Button
              onClick={handleValidate}
              disabled={isValidating || !jsonText.trim()}
              className="gap-1.5"
            >
              {isValidating ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Validating...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Validate Schedule</span>
                </>
              )}
            </Button>
          ) : (
            <Button
              onClick={handleIngest}
              disabled={isIngesting || validationReport.hasCycles}
              className="gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white"
            >
              {isIngesting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Ingesting Tasks...</span>
                </>
              ) : (
                <>
                  <Upload className="w-3.5 h-3.5" />
                  <span>Commit Ingest ({validationReport.valid} Tasks)</span>
                </>
              )}
            </Button>
          )}
        </div>
      </div>
    </Modal>
  );
}
