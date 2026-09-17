'use client';

import * as React from 'react';
import {
  Download,
  Upload,
  FileSpreadsheet,
  FileJson,
  CheckCircle2,
  AlertTriangle,
  FileText,
  Sparkles,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { Modal } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Task, TaskDependency, Project } from '@/types/database';

interface ImportExportModalProps {
  mode: 'import' | 'export' | null;
  isOpen: boolean;
  onClose: () => void;
  project: Project;
  tasks: Task[];
  dependencies: TaskDependency[];
  onImportCompleted: () => void;
}

export function ImportExportModal({
  mode,
  isOpen,
  onClose,
  project,
  tasks,
  dependencies,
  onImportCompleted,
}: ImportExportModalProps) {
  const [activeTab, setActiveTab] = React.useState<'xlsx' | 'json'>('xlsx');
  const [dryRunResult, setDryRunResult] = React.useState<{
    totalRows: number;
    validCount: number;
    errorCount: number;
    preview: Array<{
      rowIndex: number;
      isValid: boolean;
      errors: string[];
      parsed?: any;
    }>;
  } | null>(null);

  const [isProcessing, setIsProcessing] = React.useState(false);
  const [parsedRows, setParsedRows] = React.useState<any[]>([]);

  // 1. Download Standardized CSV / XLSX Template
  const handleDownloadTemplate = (format: 'csv' | 'xlsx') => {
    const templateData = [
      {
        title: 'Backend Microservice Architecture',
        start_date: '2026-10-01',
        duration_days: 5,
        status: 'todo',
        priority: 'high',
        assignee: 'Elena Rostova',
      },
      {
        title: 'PostgreSQL Connection Pooling',
        start_date: '2026-10-08',
        duration_days: 4,
        status: 'todo',
        priority: 'medium',
        assignee: 'David Miller',
      },
    ];

    const worksheet = XLSX.utils.json_to_sheet(templateData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Tasks');

    if (format === 'csv') {
      XLSX.writeFile(workbook, 'pms-import-template.csv', { bookType: 'csv' });
    } else {
      XLSX.writeFile(workbook, 'pms-import-template.xlsx', { bookType: 'xlsx' });
    }
  };

  // 2. Export Project Data
  const handleExport = (format: 'json' | 'csv' | 'xlsx') => {
    if (format === 'json') {
      const payload = {
        exported_at: new Date().toISOString(),
        project,
        tasks,
        dependencies,
      };
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${project.code}-schedule.json`;
      a.click();
      URL.revokeObjectURL(url);
    } else {
      const rows = tasks.map(t => ({
        ID: t.id,
        Title: t.title,
        Status: t.status,
        Priority: t.priority,
        'Start Date': t.start_date,
        'End Date': t.end_date,
        'Duration Days': t.duration_days,
        'Progress %': t.progress_percent,
        'Critical Path': t.is_critical ? 'YES' : 'NO',
      }));

      const worksheet = XLSX.utils.json_to_sheet(rows);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Schedule');

      if (format === 'csv') {
        XLSX.writeFile(workbook, `${project.code}-schedule.csv`, { bookType: 'csv' });
      } else {
        XLSX.writeFile(workbook, `${project.code}-schedule.xlsx`, { bookType: 'xlsx' });
      }
    }
  };

  // 3. File Upload & Dry-Run Validation
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessing(true);
    try {
      let rows: any[] = [];

      if (file.name.endsWith('.json')) {
        const text = await file.text();
        const json = JSON.parse(text);
        rows = Array.isArray(json) ? json : json.tasks || [];
      } else {
        const buffer = await file.arrayBuffer();
        const wb = XLSX.read(buffer, { type: 'array' });
        const firstSheet = wb.Sheets[wb.SheetNames[0]];
        rows = XLSX.utils.sheet_to_json(firstSheet);
      }

      setParsedRows(rows);

      // Perform dry-run validation via API
      const res = await fetch('/api/v1/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: project.id,
          dryRun: true,
          rows,
        }),
      });

      const data = await res.json();
      if (data.data) {
        setDryRunResult(data.data);
      }
    } catch (err) {
      console.error('Failed to parse import file:', err);
    } finally {
      setIsProcessing(false);
    }
  };

  // 4. Commit Validated Import
  const handleCommitImport = async () => {
    if (parsedRows.length === 0) return;
    setIsProcessing(true);
    try {
      const res = await fetch('/api/v1/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: project.id,
          dryRun: false,
          rows: parsedRows,
        }),
      });

      if (res.ok) {
        onImportCompleted();
        onClose();
      }
    } catch (err) {
      console.error('Import commit error:', err);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={mode === 'export' ? 'Export Project Schedule' : 'Data Exchange: Import Schedule'}
      description={
        mode === 'export'
          ? 'Download complete WBS schedule with CPM dependency matrices.'
          : 'Dry-run preview with schema validation and conflict detection.'
      }
      maxWidth="max-w-2xl"
    >
      {mode === 'export' ? (
        <div className="space-y-4 text-xs">
          <p className="text-[var(--muted-foreground)]">
            Select export format to download schedule parameters, working day durations, and dependency relations:
          </p>

          <div className="grid grid-cols-3 gap-3 pt-2">
            <button
              onClick={() => handleExport('xlsx')}
              className="flex flex-col items-center justify-center p-4 rounded-xl border border-[var(--border)] bg-[var(--card)] hover:border-[var(--primary)] hover:bg-[var(--secondary)] transition-all cursor-pointer group"
            >
              <FileSpreadsheet className="h-8 w-8 text-emerald-500 mb-2 group-hover:scale-110 transition-transform" />
              <span className="font-bold text-xs text-[var(--foreground)]">Excel Workbook</span>
              <span className="text-[10px] text-[var(--muted-foreground)] font-mono">.xlsx</span>
            </button>

            <button
              onClick={() => handleExport('csv')}
              className="flex flex-col items-center justify-center p-4 rounded-xl border border-[var(--border)] bg-[var(--card)] hover:border-[var(--primary)] hover:bg-[var(--secondary)] transition-all cursor-pointer group"
            >
              <FileText className="h-8 w-8 text-sky-500 mb-2 group-hover:scale-110 transition-transform" />
              <span className="font-bold text-xs text-[var(--foreground)]">Delimited CSV</span>
              <span className="text-[10px] text-[var(--muted-foreground)] font-mono">.csv</span>
            </button>

            <button
              onClick={() => handleExport('json')}
              className="flex flex-col items-center justify-center p-4 rounded-xl border border-[var(--border)] bg-[var(--card)] hover:border-[var(--primary)] hover:bg-[var(--secondary)] transition-all cursor-pointer group"
            >
              <FileJson className="h-8 w-8 text-amber-500 mb-2 group-hover:scale-110 transition-transform" />
              <span className="font-bold text-xs text-[var(--foreground)]">CPM Schema JSON</span>
              <span className="text-[10px] text-[var(--muted-foreground)] font-mono">.json</span>
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-4 text-xs">
          {/* Template Download Section */}
          <div className="flex items-center justify-between p-3 rounded-lg border border-[var(--border)] bg-[var(--secondary)]/30">
            <div>
              <div className="font-semibold text-[var(--foreground)]">Download Standardized Template</div>
              <div className="text-[11px] text-[var(--muted-foreground)]">Use this template for error-free ingestion</div>
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => handleDownloadTemplate('xlsx')}>
                XLSX Template
              </Button>
              <Button size="sm" variant="outline" onClick={() => handleDownloadTemplate('csv')}>
                CSV Template
              </Button>
            </div>
          </div>

          {/* File Upload Area */}
          <div>
            <label className="font-semibold block mb-1">Select Excel (.xlsx) or JSON File</label>
            <input
              type="file"
              accept=".xlsx,.xls,.csv,.json"
              onChange={handleFileUpload}
              className="w-full text-xs text-[var(--muted-foreground)] file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-[var(--primary)] file:text-[var(--primary-foreground)] hover:file:opacity-90 cursor-pointer border border-[var(--input)] rounded-md p-1"
            />
          </div>

          {/* Dry-Run Preview Table */}
          {dryRunResult && (
            <div className="space-y-3 pt-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-xs">Dry-Run Validation Analysis</span>
                <div className="flex gap-2">
                  <Badge variant="success">{dryRunResult.validCount} Valid</Badge>
                  {dryRunResult.errorCount > 0 && (
                    <Badge variant="destructive">{dryRunResult.errorCount} Errors</Badge>
                  )}
                </div>
              </div>

              <div className="max-h-52 overflow-y-auto rounded-lg border border-[var(--border)]">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[var(--secondary)] font-semibold border-b border-[var(--border)]">
                    <tr>
                      <th className="p-2">Row</th>
                      <th className="p-2">Title</th>
                      <th className="p-2">Start Date</th>
                      <th className="p-2">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border)]">
                    {dryRunResult.preview.map((p) => (
                      <tr key={p.rowIndex} className={p.isValid ? '' : 'bg-rose-500/10'}>
                        <td className="p-2 font-mono">{p.rowIndex}</td>
                        <td className="p-2 font-medium">{p.parsed?.title || 'Unknown'}</td>
                        <td className="p-2 font-mono">{p.parsed?.start_date || 'Invalid'}</td>
                        <td className="p-2">
                          {p.isValid ? (
                            <span className="flex items-center gap-1 text-emerald-500">
                              <CheckCircle2 className="h-3.5 w-3.5" /> Valid
                            </span>
                          ) : (
                            <span className="text-rose-500 font-semibold truncate block max-w-xs" title={p.errors.join(', ')}>
                              {p.errors[0]}
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {dryRunResult.validCount > 0 && (
                <div className="flex justify-end gap-2 pt-2">
                  <Button variant="outline" onClick={onClose}>
                    Cancel
                  </Button>
                  <Button onClick={handleCommitImport} disabled={isProcessing}>
                    {isProcessing ? 'Importing...' : `Commit ${dryRunResult.validCount} Valid Tasks`}
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}
