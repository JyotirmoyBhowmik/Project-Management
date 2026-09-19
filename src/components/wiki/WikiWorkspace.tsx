// ==============================================================================
// src/components/wiki/WikiWorkspace.tsx
// Project Knowledge Base & Living Documentation (Wiki) with Live Task Embedding
// ==============================================================================

'use client';

import * as React from 'react';
import {
  FileText,
  Plus,
  ChevronRight,
  ChevronDown,
  Folder,
  Save,
  Trash2,
  Link as LinkIcon,
  Code,
  List,
  Heading1,
  Heading2,
  Bold,
  Italic,
  Sparkles,
  ExternalLink,
} from 'lucide-react';
import { ProjectDocument, Task } from '@/types/database';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  createDocumentAction,
  updateDocumentContentAction,
  linkTaskToDocAction,
  unlinkTaskFromDocAction,
} from '@/actions/wiki';
import { toast } from 'sonner';

interface WikiWorkspaceProps {
  documents: ProjectDocument[];
  tasks: Task[];
  projectId: string;
  tenantId: string;
  onRefresh: () => Promise<void>;
  onSelectTask?: (task: Task) => void;
}

export function WikiWorkspace({
  documents,
  tasks,
  projectId,
  tenantId,
  onRefresh,
  onSelectTask,
}: WikiWorkspaceProps) {
  const [selectedDocId, setSelectedDocId] = React.useState<string>(documents[0]?.id || '');
  const [expandedDocIds, setExpandedDocIds] = React.useState<Set<string>>(new Set(documents.map((d) => d.id)));

  const selectedDoc = documents.find((d) => d.id === selectedDocId) || documents[0];

  const [title, setTitle] = React.useState(selectedDoc?.title || '');
  const [markdownContent, setMarkdownContent] = React.useState(
    (selectedDoc?.content_json as any)?.text || '# Project Knowledge Base\n\nWelcome to your living project documentation.\n\nType `/task [code]` to embed a live task card.'
  );
  const [isSaving, setIsSaving] = React.useState(false);
  const [isLinkingTask, setIsLinkingTask] = React.useState(false);
  const [selectedTaskIdToLink, setSelectedTaskIdToLink] = React.useState('');

  // Sync state when selected doc changes
  React.useEffect(() => {
    if (selectedDoc) {
      setTitle(selectedDoc.title);
      setMarkdownContent((selectedDoc.content_json as any)?.text || `# ${selectedDoc.title}\n\nStart writing documentation...`);
    }
  }, [selectedDocId, selectedDoc]);

  const toggleExpand = (id: string) => {
    setExpandedDocIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleCreateDoc = async (parentId?: string) => {
    try {
      const res = await createDocumentAction({
        tenant_id: tenantId,
        project_id: projectId,
        parent_doc_id: parentId || null,
        title: 'Untitled Document',
        content_json: { text: '# Untitled Document\n\nStart typing content here...' },
      });

      if (res.success && res.data) {
        toast.success('Document created');
        setSelectedDocId(res.data.id);
        await onRefresh();
      } else {
        toast.error(res.error || 'Failed to create document');
      }
    } catch {
      toast.error('Failed to create document');
    }
  };

  const handleSaveDoc = async () => {
    if (!selectedDoc) return;
    setIsSaving(true);
    try {
      const res = await updateDocumentContentAction(selectedDoc.id, {
        title,
        content_json: { text: markdownContent },
        projectId,
      });

      if (res.success) {
        toast.success('Document saved');
        await onRefresh();
      } else {
        toast.error(res.error || 'Failed to save document');
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleLinkTask = async () => {
    if (!selectedDoc || !selectedTaskIdToLink) return;
    const res = await linkTaskToDocAction(selectedDoc.id, selectedTaskIdToLink, tenantId);
    if (res.success) {
      toast.success('Task linked to document');
      setIsLinkingTask(false);
      setSelectedTaskIdToLink('');
      await onRefresh();
    } else {
      toast.error(res.error || 'Failed to link task');
    }
  };

  // Render embedded live task cards in document
  const renderDocumentWithEmbeddedTasks = (text: string) => {
    const lines = text.split('\n');
    return lines.map((line, idx) => {
      const taskMatch = line.match(/\/task\s+([A-Za-z0-9-_]+)/);
      if (taskMatch) {
        const taskCode = taskMatch[1];
        const linkedTask = tasks.find((t) => (t.task_code || '').toLowerCase() === taskCode.toLowerCase());

        if (linkedTask) {
          return (
            <div
              key={idx}
              onClick={() => onSelectTask?.(linkedTask)}
              className="my-3 p-3 bg-[var(--secondary)]/60 hover:bg-[var(--secondary)] border border-[var(--border)] rounded-xl cursor-pointer flex items-center justify-between transition-colors group"
            >
              <div className="flex items-center gap-2.5">
                <span className="font-mono font-bold text-xs text-[var(--primary)]">{linkedTask.task_code}</span>
                <span className="text-xs font-semibold text-[var(--foreground)]">{linkedTask.title}</span>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-[10px] capitalize">{linkedTask.status}</Badge>
                <ExternalLink className="h-3.5 w-3.5 text-[var(--muted-foreground)] group-hover:text-[var(--foreground)]" />
              </div>
            </div>
          );
        }
      }
      return <p key={idx} className="my-1 leading-relaxed text-xs">{line}</p>;
    });
  };

  return (
    <div className="flex flex-col md:flex-row gap-4 h-[650px] bg-[var(--card)] border border-[var(--border)] rounded-2xl overflow-hidden shadow-xs">
      {/* 1. Left Document Tree Sidebar */}
      <div className="w-full md:w-64 border-r border-[var(--border)] flex flex-col bg-[var(--card)]/50">
        <div className="p-3 border-b border-[var(--border)] flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-wider text-[var(--muted-foreground)] flex items-center gap-1.5">
            <FileText className="h-3.5 w-3.5" />
            <span>Pages Tree</span>
          </span>
          <Button size="sm" variant="ghost" onClick={() => handleCreateDoc()} className="h-6 w-6 p-0">
            <Plus className="h-3.5 w-3.5" />
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {documents.length === 0 ? (
            <div className="p-4 text-center text-xs text-[var(--muted-foreground)]">
              No documents yet. Click + to create your first page.
            </div>
          ) : (
            documents.map((doc) => (
              <div
                key={doc.id}
                onClick={() => setSelectedDocId(doc.id)}
                className={`flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-medium cursor-pointer transition-colors ${
                  selectedDocId === doc.id
                    ? 'bg-[var(--primary)] text-[var(--primary-foreground)]'
                    : 'text-[var(--muted-foreground)] hover:bg-[var(--secondary)] hover:text-[var(--foreground)]'
                }`}
              >
                <div className="flex items-center gap-2 truncate">
                  <FileText className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">{doc.title}</span>
                </div>
                {doc.children && doc.children.length > 0 && (
                  <span className="text-[10px] opacity-70">{doc.children.length}</span>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      {/* 2. Main Editor & Preview Pane */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {selectedDoc ? (
          <>
            {/* Toolbar Header */}
            <div className="p-3 border-b border-[var(--border)] flex flex-wrap items-center justify-between gap-2 bg-[var(--card)]">
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="h-8 text-sm font-bold max-w-sm bg-transparent border-transparent hover:border-[var(--border)] focus:border-[var(--primary)]"
                placeholder="Document Title"
              />

              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setIsLinkingTask(!isLinkingTask)}
                  className="h-7 text-xs gap-1.5"
                >
                  <LinkIcon className="h-3 w-3" />
                  <span>Link Task</span>
                </Button>

                <Button
                  size="sm"
                  onClick={handleSaveDoc}
                  disabled={isSaving}
                  className="h-7 text-xs gap-1.5 bg-[var(--primary)] text-white"
                >
                  <Save className="h-3 w-3" />
                  <span>{isSaving ? 'Saving...' : 'Save'}</span>
                </Button>
              </div>
            </div>

            {/* Task Linking Bar */}
            {isLinkingTask && (
              <div className="p-3 bg-[var(--secondary)]/60 border-b border-[var(--border)] flex items-center gap-2 text-xs">
                <span>Select Task to link:</span>
                <select
                  value={selectedTaskIdToLink}
                  onChange={(e) => setSelectedTaskIdToLink(e.target.value)}
                  className="h-7 text-xs bg-[var(--card)] border border-[var(--border)] rounded px-2"
                >
                  <option value="">-- Choose task --</option>
                  {tasks.map((t) => (
                    <option key={t.id} value={t.id}>
                      [{t.task_code || 'TASK'}] {t.title}
                    </option>
                  ))}
                </select>
                <Button size="sm" onClick={handleLinkTask} className="h-7 text-xs">
                  Link
                </Button>
              </div>
            )}

            {/* Two-Pane Editor & Preview */}
            <div className="flex-1 grid grid-cols-1 md:grid-cols-2 overflow-hidden">
              {/* Raw Editor */}
              <div className="p-4 border-r border-[var(--border)] flex flex-col overflow-hidden">
                <div className="text-[10px] font-bold uppercase tracking-wider text-[var(--muted-foreground)] mb-2">
                  Markdown Editor
                </div>
                <textarea
                  value={markdownContent}
                  onChange={(e) => setMarkdownContent(e.target.value)}
                  className="flex-1 w-full bg-transparent border-0 resize-none font-mono text-xs text-[var(--foreground)] outline-none leading-relaxed"
                  placeholder="Write your markdown here..."
                />
              </div>

              {/* Rendered Preview with Embedded Task Cards */}
              <div className="p-4 overflow-y-auto bg-[var(--secondary)]/10">
                <div className="text-[10px] font-bold uppercase tracking-wider text-[var(--muted-foreground)] mb-2">
                  Live Preview
                </div>
                <div className="prose dark:prose-invert max-w-none text-xs">
                  {renderDocumentWithEmbeddedTasks(markdownContent)}
                </div>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-xs text-[var(--muted-foreground)]">
            Select or create a document to begin.
          </div>
        )}
      </div>
    </div>
  );
}
