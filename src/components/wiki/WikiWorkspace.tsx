// ==============================================================================
// src/components/wiki/WikiWorkspace.tsx
// Project Knowledge Base & Living Documentation (Wiki) with Live Task Embedding
// Full Hierarchical Tree: Recursive nesting, search filter, expand/collapse,
// breadcrumbs, sub-page creation, and task linkages.
// ==============================================================================

'use client';

import * as React from 'react';
import {
  FileText,
  Plus,
  ChevronRight,
  ChevronDown,
  Folder,
  FolderOpen,
  Search,
  Save,
  Trash2,
  Link as LinkIcon,
  Code,
  List,
  Heading1,
  Heading2,
  Bold,
  Italic,
  ExternalLink,
  ChevronsUpDown,
  X,
  Layers,
  Sparkles,
  Clock,
  User,
  Columns,
  Eye,
  Edit3,
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
import { softDeleteEntityAction } from '@/actions/trash';
import { toast } from 'sonner';

interface WikiWorkspaceProps {
  documents: ProjectDocument[];
  tasks: Task[];
  projectId: string;
  tenantId: string;
  onRefresh: () => Promise<void>;
  onSelectTask?: (task: Task) => void;
}

/**
 * Recursively find a document by ID across all hierarchy levels.
 */
function findDocRecursive(docs: ProjectDocument[], id: string): ProjectDocument | null {
  for (const d of docs) {
    if (d.id === id) return d;
    if (d.children && d.children.length > 0) {
      const found = findDocRecursive(d.children, id);
      if (found) return found;
    }
  }
  return null;
}

/**
 * Recursively collect all document IDs in the tree.
 */
function collectAllDocIds(docs: ProjectDocument[]): string[] {
  const ids: string[] = [];
  function traverse(list: ProjectDocument[]) {
    for (const item of list) {
      ids.push(item.id);
      if (item.children && item.children.length > 0) {
        traverse(item.children);
      }
    }
  }
  traverse(docs);
  return ids;
}

/**
 * Build breadcrumb trail path from root to target doc ID.
 */
function buildDocPath(docs: ProjectDocument[], targetId: string, currentPath: ProjectDocument[] = []): ProjectDocument[] | null {
  for (const doc of docs) {
    const newPath = [...currentPath, doc];
    if (doc.id === targetId) return newPath;
    if (doc.children && doc.children.length > 0) {
      const found = buildDocPath(doc.children, targetId, newPath);
      if (found) return found;
    }
  }
  return null;
}

/**
 * Filter tree by search query; returns matching nodes and retains parents of matching children.
 */
function filterDocTree(
  docs: ProjectDocument[],
  query: string
): { filtered: ProjectDocument[]; matchingIds: Set<string>; ancestorIds: Set<string> } {
  const q = query.trim().toLowerCase();
  const matchingIds = new Set<string>();
  const ancestorIds = new Set<string>();

  if (!q) {
    return { filtered: docs, matchingIds, ancestorIds };
  }

  function checkNode(node: ProjectDocument, path: string[]): boolean {
    const isDirectMatch = (node.title || '').toLowerCase().includes(q);
    if (isDirectMatch) {
      matchingIds.add(node.id);
      path.forEach((pId) => ancestorIds.add(pId));
    }

    let childMatched = false;
    if (node.children && node.children.length > 0) {
      for (const child of node.children) {
        const matches = checkNode(child, [...path, node.id]);
        if (matches) childMatched = true;
      }
    }

    return isDirectMatch || childMatched;
  }

  function filterNodes(list: ProjectDocument[]): ProjectDocument[] {
    return list
      .filter((n) => matchingIds.has(n.id) || ancestorIds.has(n.id))
      .map((n) => ({
        ...n,
        children: n.children ? filterNodes(n.children) : [],
      }));
  }

  docs.forEach((doc) => checkNode(doc, []));
  const filtered = filterNodes(docs);

  return { filtered, matchingIds, ancestorIds };
}

export function WikiWorkspace({
  documents,
  tasks,
  projectId,
  tenantId,
  onRefresh,
  onSelectTask,
}: WikiWorkspaceProps) {
  // Active document selection
  const [selectedDocId, setSelectedDocId] = React.useState<string>(documents[0]?.id || '');
  
  // Expanded branches set
  const [expandedDocIds, setExpandedDocIds] = React.useState<Set<string>>(() => {
    return new Set(collectAllDocIds(documents));
  });

  // Real-time Search query
  const [searchQuery, setSearchQuery] = React.useState('');

  // Find active doc recursively
  const selectedDoc = React.useMemo(() => {
    return findDocRecursive(documents, selectedDocId) || documents[0] || null;
  }, [documents, selectedDocId]);

  // Editor states
  const [title, setTitle] = React.useState<string>(selectedDoc?.title || '');
  const [markdownContent, setMarkdownContent] = React.useState<string>(
    typeof (selectedDoc?.content_json as any)?.text === 'string'
      ? (selectedDoc?.content_json as any)?.text
      : '# Project Knowledge Base\n\nWelcome to your living project documentation.\n\nType `/task [code]` to embed a live interactive task card.'
  );
  const [isSaving, setIsSaving] = React.useState(false);
  const [isLinkingTask, setIsLinkingTask] = React.useState(false);
  const [selectedTaskIdToLink, setSelectedTaskIdToLink] = React.useState('');
  const [isDeleting, setIsDeleting] = React.useState(false);
  const [viewLayout, setViewLayout] = React.useState<'split' | 'edit' | 'preview'>('split');

  // Track unsaved dirty state against active document
  const isDirty = React.useMemo(() => {
    if (!selectedDoc) return false;
    const initialText = (selectedDoc.content_json as any)?.text || `# ${selectedDoc.title}\n\nStart typing documentation...`;
    return title.trim() !== selectedDoc.title || markdownContent !== initialText;
  }, [selectedDoc, title, markdownContent]);

  // Sync state when selected doc changes
  React.useEffect(() => {
    if (selectedDoc) {
      setTitle(selectedDoc.title);
      setMarkdownContent(
        (selectedDoc.content_json as any)?.text || `# ${selectedDoc.title}\n\nStart typing documentation...`
      );
    }
  }, [selectedDoc?.id]);

  // Filtered documents for tree navigation
  const { filtered: displayedDocs, ancestorIds } = React.useMemo(() => {
    return filterDocTree(documents, searchQuery);
  }, [documents, searchQuery]);

  // When search query is active, auto-expand matching ancestor branches
  React.useEffect(() => {
    if (searchQuery.trim() && ancestorIds.size > 0) {
      setExpandedDocIds((prev) => {
        const next = new Set(prev);
        ancestorIds.forEach((id) => next.add(id));
        return next;
      });
    }
  }, [searchQuery, ancestorIds]);

  // Expand / Collapse toggling
  const toggleExpand = (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setExpandedDocIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleExpandAll = () => {
    setExpandedDocIds(new Set(collectAllDocIds(documents)));
  };

  const handleCollapseAll = () => {
    setExpandedDocIds(new Set());
  };

  // Breadcrumbs calculation
  const breadcrumbTrail = React.useMemo(() => {
    if (!selectedDoc) return [];
    return buildDocPath(documents, selectedDoc.id) || [selectedDoc];
  }, [documents, selectedDoc]);

  // Total count of all pages in project
  const totalDocsCount = React.useMemo(() => {
    return collectAllDocIds(documents).length;
  }, [documents]);

  // Create document (root or nested child)
  const handleCreateDoc = async (parentId?: string) => {
    try {
      const res = await createDocumentAction({
        tenant_id: tenantId,
        project_id: projectId,
        parent_doc_id: parentId || null,
        title: parentId ? 'New Sub-Page' : 'Untitled Document',
        content_json: {
          text: parentId
            ? '# New Sub-Page\n\nDocument hierarchical sub-specifications and details here.'
            : '# Untitled Document\n\nStart typing content here...',
        },
      });

      if (res.success && res.data) {
        toast.success(parentId ? 'Sub-page created successfully' : 'Document created successfully');
        if (parentId) {
          setExpandedDocIds((prev) => new Set(prev).add(parentId));
        }
        setSelectedDocId(res.data.id);
        await onRefresh();
      } else {
        toast.error(res.error || 'Failed to create document');
      }
    } catch {
      toast.error('Failed to create document');
    }
  };

  // Save active document
  const handleSaveDoc = async () => {
    if (!selectedDoc) return;
    setIsSaving(true);
    try {
      const res = await updateDocumentContentAction(selectedDoc.id, {
        title: title.trim() || 'Untitled Document',
        content_json: { text: markdownContent },
        projectId,
      });

      if (res.success) {
        toast.success('Document changes saved');
        await onRefresh();
      } else {
        toast.error(res.error || 'Failed to save document');
      }
    } finally {
      setIsSaving(false);
    }
  };

  // Keyboard shortcut Ctrl+S / Cmd+S to save document
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        if (selectedDoc && !isSaving) {
          handleSaveDoc();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedDoc, title, markdownContent, isSaving]);

  // Soft-delete active document to Recycle Bin
  const handleDeleteDoc = async (docIdToDelete?: string) => {
    const id = docIdToDelete || selectedDoc?.id;
    if (!id) return;
    if (!confirm('Are you sure you want to move this page and its sub-pages to the Recycle Bin?')) {
      return;
    }

    setIsDeleting(true);
    try {
      const res = await softDeleteEntityAction('document', id, tenantId, projectId);
      if (res.success) {
        toast.success('Page moved to Recycle Bin (retention: 30 days)');
        await onRefresh();
        const remaining = collectAllDocIds(documents).filter((docId) => docId !== id);
        if (remaining.length > 0) {
          setSelectedDocId(remaining[0]);
        } else {
          setSelectedDocId('');
        }
      } else {
        toast.error(res.error || 'Failed to delete page');
      }
    } finally {
      setIsDeleting(false);
    }
  };

  // Link Task to Active Document
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

  // Unlink Task from Active Document
  const handleUnlinkTask = async (taskId: string) => {
    if (!selectedDoc) return;
    const res = await unlinkTaskFromDocAction(selectedDoc.id, taskId);
    if (res.success) {
      toast.success('Task unlinked from document');
      await onRefresh();
    } else {
      toast.error(res.error || 'Failed to unlink task');
    }
  };

  // Quick Markdown formatting helpers
  const insertFormatting = (prefix: string, suffix: string = '') => {
    setMarkdownContent((prev: string) => {
      return `${prev}\n${prefix}Text${suffix}`;
    });
  };

  // Render embedded live interactive task cards in document
  const renderDocumentWithEmbeddedTasks = (text: string) => {
    const lines = text.split('\n');
    return lines.map((line, idx) => {
      const taskMatch = line.match(/\/task\s+([A-Za-z0-9-_]+)/);
      if (taskMatch) {
        const taskCode = taskMatch[1];
        const linkedTask = tasks.find(
          (t) => (t.task_code || (t as any).code || '').toLowerCase() === taskCode.toLowerCase()
        );

        if (linkedTask) {
          return (
            <div
              key={idx}
              onClick={() => onSelectTask?.(linkedTask)}
              className="my-3 p-3 bg-[var(--secondary)]/60 hover:bg-[var(--secondary)] border border-[var(--border)] rounded-xl cursor-pointer flex items-center justify-between transition-colors group"
            >
              <div className="flex items-center gap-2.5">
                <span className="font-mono font-bold text-xs text-[var(--primary)]">
                  {linkedTask.task_code || (linkedTask as any).code}
                </span>
                <span className="text-xs font-semibold text-[var(--foreground)]">{linkedTask.title}</span>
                {linkedTask.is_milestone && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-500/10 text-purple-400 border border-purple-500/20 font-semibold">
                    ◆ Milestone
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-[10px] capitalize font-mono">
                  {linkedTask.status}
                </Badge>
                <ExternalLink className="h-3.5 w-3.5 text-[var(--muted-foreground)] group-hover:text-[var(--foreground)]" />
              </div>
            </div>
          );
        }
      }

      if (line.startsWith('# ')) {
        return (
          <h1 key={idx} className="text-lg font-bold text-[var(--foreground)] mt-4 mb-2 pb-1 border-b border-[var(--border)]">
            {line.replace('# ', '')}
          </h1>
        );
      }
      if (line.startsWith('## ')) {
        return (
          <h2 key={idx} className="text-sm font-bold text-[var(--foreground)] mt-3 mb-1.5">
            {line.replace('## ', '')}
          </h2>
        );
      }
      if (line.startsWith('### ')) {
        return (
          <h3 key={idx} className="text-xs font-bold text-[var(--foreground)] mt-2 mb-1">
            {line.replace('### ', '')}
          </h3>
        );
      }
      if (line.startsWith('- ') || line.startsWith('* ')) {
        return (
          <li key={idx} className="ml-4 list-disc text-xs text-[var(--foreground)]/90 my-0.5">
            {line.replace(/^[-*]\s+/, '')}
          </li>
        );
      }

      return (
        <p key={idx} className="my-1.5 leading-relaxed text-xs text-[var(--foreground)]/90">
          {line}
        </p>
      );
    });
  };

  /**
   * Recursive Document Tree Item Renderer
   */
  const renderDocTreeItem = (doc: ProjectDocument, depth = 0) => {
    const hasChildren = Boolean(doc.children && doc.children.length > 0);
    const isExpanded = expandedDocIds.has(doc.id);
    const isSelected = selectedDocId === doc.id;
    const isMatch = searchQuery.trim() && (doc.title || '').toLowerCase().includes(searchQuery.trim().toLowerCase());

    return (
      <div key={doc.id} className="flex flex-col select-none">
        <div
          onClick={() => setSelectedDocId(doc.id)}
          style={{ paddingLeft: `${depth * 14 + 6}px` }}
          className={`group flex items-center justify-between pr-2 py-1.5 rounded-lg text-xs font-medium cursor-pointer transition-all ${
            isSelected
              ? 'bg-[var(--primary)] text-[var(--primary-foreground)] shadow-xs'
              : isMatch
              ? 'bg-[var(--primary)]/15 text-[var(--foreground)] font-semibold'
              : 'text-[var(--muted-foreground)] hover:bg-[var(--secondary)] hover:text-[var(--foreground)]'
          }`}
        >
          {/* Node Icon & Title */}
          <div className="flex items-center gap-1.5 min-w-0 flex-1">
            {hasChildren ? (
              <button
                type="button"
                onClick={(e) => toggleExpand(doc.id, e)}
                className={`p-0.5 rounded hover:bg-black/10 dark:hover:bg-white/10 shrink-0 transition-transform ${
                  isSelected ? 'text-[var(--primary-foreground)]' : 'text-[var(--muted-foreground)]'
                }`}
              >
                {isExpanded ? (
                  <ChevronDown className="h-3.5 w-3.5" />
                ) : (
                  <ChevronRight className="h-3.5 w-3.5" />
                )}
              </button>
            ) : (
              <div className="w-4 shrink-0" />
            )}

            {hasChildren ? (
              isExpanded ? (
                <FolderOpen
                  className={`h-3.5 w-3.5 shrink-0 ${
                    isSelected ? 'text-[var(--primary-foreground)]' : 'text-amber-500'
                  }`}
                />
              ) : (
                <Folder
                  className={`h-3.5 w-3.5 shrink-0 ${
                    isSelected ? 'text-[var(--primary-foreground)]' : 'text-amber-500/80'
                  }`}
                />
              )
            ) : (
              <FileText
                className={`h-3.5 w-3.5 shrink-0 ${
                  isSelected ? 'text-[var(--primary-foreground)]' : 'text-[var(--muted-foreground)]'
                }`}
              />
            )}

            <span className="truncate text-xs">{doc.title || 'Untitled Document'}</span>
          </div>

          {/* Quick Actions (Add Child Sub-Page on Hover) & Badges */}
          <div className="flex items-center gap-1 shrink-0 ml-1">
            {hasChildren && (
              <span
                className={`text-[10px] font-mono px-1 rounded ${
                  isSelected
                    ? 'bg-white/20 text-white'
                    : 'bg-[var(--secondary)] text-[var(--muted-foreground)]'
                }`}
              >
                {doc.children!.length}
              </span>
            )}

            {/* + Child Page Button */}
            <button
              type="button"
              title="Add nested child page under this page"
              onClick={(e) => {
                e.stopPropagation();
                handleCreateDoc(doc.id);
              }}
              className={`p-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity ${
                isSelected
                  ? 'hover:bg-white/20 text-white'
                  : 'hover:bg-[var(--secondary)] text-[var(--muted-foreground)] hover:text-[var(--foreground)]'
              }`}
            >
              <Plus className="h-3 w-3" />
            </button>
          </div>
        </div>

        {/* Recursive Children Rendering */}
        {hasChildren && isExpanded && (
          <div className="flex flex-col space-y-0.5 mt-0.5 relative before:absolute before:left-[14px] before:top-0 before:bottom-0 before:w-px before:bg-[var(--border)]/50">
            {doc.children!.map((child) => renderDocTreeItem(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="flex flex-col md:flex-row gap-4 h-[720px] bg-[var(--card)] border border-[var(--border)] rounded-2xl overflow-hidden shadow-xs">
      {/* 1. Left Document Tree Sidebar */}
      <div className="w-full md:w-72 border-r border-[var(--border)] flex flex-col bg-[var(--card)]/40 shrink-0">
        {/* Tree Sidebar Header */}
        <div className="p-3 border-b border-[var(--border)] flex items-center justify-between bg-[var(--card)]">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-[var(--foreground)] flex items-center gap-1.5">
              <Layers className="h-4 w-4 text-[var(--primary)]" />
              <span>Living Docs</span>
            </span>
            <Badge variant="outline" className="text-[10px] font-mono py-0 px-1.5">
              {totalDocsCount}
            </Badge>
          </div>

          <div className="flex items-center gap-1">
            <Button
              size="sm"
              variant="ghost"
              onClick={handleExpandAll}
              title="Expand All Pages"
              className="h-6 w-6 p-0 text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
            >
              <ChevronsUpDown className="h-3.5 w-3.5" />
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleCreateDoc()}
              title="Create Root Page"
              className="h-6 px-2 text-[11px] gap-1 font-semibold"
            >
              <Plus className="h-3 w-3" />
              <span>Page</span>
            </Button>
          </div>
        </div>

        {/* Search & Filter Bar */}
        <div className="p-2 border-b border-[var(--border)] bg-[var(--secondary)]/30">
          <div className="relative flex items-center">
            <Search className="absolute left-2.5 h-3.5 w-3.5 text-[var(--muted-foreground)] pointer-events-none" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Filter pages tree..."
              className="h-7 text-xs pl-8 pr-7 bg-[var(--card)] border-[var(--border)] focus-visible:ring-1"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2 text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </div>
        </div>

        {/* Recursive Tree Body */}
        <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
          {displayedDocs.length === 0 ? (
            <div className="p-6 text-center text-xs text-[var(--muted-foreground)] flex flex-col items-center gap-2">
              <FileText className="h-8 w-8 opacity-40" />
              {searchQuery ? (
                <span>No pages match &ldquo;{searchQuery}&rdquo;</span>
              ) : (
                <span>No documents yet. Click &ldquo;+ Page&rdquo; to start documentation.</span>
              )}
            </div>
          ) : (
            displayedDocs.map((doc) => renderDocTreeItem(doc, 0))
          )}
        </div>

        {/* Sidebar Footer Info */}
        <div className="p-2.5 border-t border-[var(--border)] bg-[var(--card)] text-[10px] text-[var(--muted-foreground)] flex items-center justify-between">
          <span className="flex items-center gap-1">
            <Sparkles className="h-3 w-3 text-amber-500" />
            <span>Type /task [code] to link</span>
          </span>
          <button
            onClick={handleCollapseAll}
            className="hover:text-[var(--foreground)] underline transition-colors"
          >
            Collapse All
          </button>
        </div>
      </div>

      {/* 2. Main Editor & Preview Pane */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {selectedDoc ? (
          <>
            {/* Header with Breadcrumb Trail, Title & Toolbar */}
            <div className="p-3 border-b border-[var(--border)] bg-[var(--card)] flex flex-col gap-2">
              {/* Breadcrumb Path */}
              <div className="flex items-center gap-1 text-[11px] text-[var(--muted-foreground)] overflow-x-auto whitespace-nowrap">
                <span className="hover:text-[var(--foreground)] transition-colors cursor-default">
                  Documentation
                </span>
                {breadcrumbTrail.map((crumb, idx) => (
                  <React.Fragment key={crumb.id}>
                    <ChevronRight className="h-3 w-3 shrink-0 opacity-60" />
                    <button
                      type="button"
                      onClick={() => setSelectedDocId(crumb.id)}
                      className={`truncate max-w-[150px] transition-colors ${
                        idx === breadcrumbTrail.length - 1
                          ? 'font-bold text-[var(--foreground)]'
                          : 'hover:text-[var(--foreground)]'
                      }`}
                    >
                      {crumb.title || 'Untitled'}
                    </button>
                  </React.Fragment>
                ))}
              </div>

              {/* Title & Action Bar */}
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2 max-w-md flex-1">
                  <Input
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="h-8 text-sm font-bold bg-transparent border-transparent hover:border-[var(--border)] focus:border-[var(--primary)] px-2"
                    placeholder="Document Title"
                  />
                  {isDirty && (
                    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-medium bg-amber-500/15 text-amber-500 border border-amber-500/30 shrink-0">
                      <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" />
                      Unsaved
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  {/* View Mode Toggle: Edit / Split / Preview */}
                  <div className="flex items-center bg-[var(--secondary)]/60 p-0.5 rounded-md border border-[var(--border)]">
                    <button
                      type="button"
                      onClick={() => setViewLayout('edit')}
                      title="Editor Only"
                      className={`p-1 rounded text-xs transition-colors ${viewLayout === 'edit' ? 'bg-[var(--card)] text-[var(--foreground)] shadow-xs' : 'text-[var(--muted-foreground)] hover:text-[var(--foreground)]'}`}
                    >
                      <Edit3 className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setViewLayout('split')}
                      title="Split View (Editor & Live Preview)"
                      className={`p-1 rounded text-xs transition-colors ${viewLayout === 'split' ? 'bg-[var(--card)] text-[var(--foreground)] shadow-xs' : 'text-[var(--muted-foreground)] hover:text-[var(--foreground)]'}`}
                    >
                      <Columns className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setViewLayout('preview')}
                      title="Preview Only"
                      className={`p-1 rounded text-xs transition-colors ${viewLayout === 'preview' ? 'bg-[var(--card)] text-[var(--foreground)] shadow-xs' : 'text-[var(--muted-foreground)] hover:text-[var(--foreground)]'}`}
                    >
                      <Eye className="h-3.5 w-3.5" />
                    </button>
                  </div>

                  {/* + Sub-page button */}
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleCreateDoc(selectedDoc.id)}
                    className="h-7 text-xs gap-1.5"
                    title="Create child sub-page under this document"
                  >
                    <Plus className="h-3 w-3" />
                    <span>Sub-Page</span>
                  </Button>

                  {/* Link Task */}
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setIsLinkingTask(!isLinkingTask)}
                    className="h-7 text-xs gap-1.5"
                  >
                    <LinkIcon className="h-3 w-3" />
                    <span>Link Task</span>
                  </Button>

                  {/* Save */}
                  <Button
                    size="sm"
                    onClick={handleSaveDoc}
                    disabled={isSaving}
                    className="h-7 text-xs gap-1.5 bg-[var(--primary)] text-[var(--primary-foreground)]"
                    title="Save document changes (Ctrl+S)"
                  >
                    <Save className="h-3 w-3" />
                    <span>{isSaving ? 'Saving...' : 'Save'}</span>
                    <kbd className="hidden sm:inline-block font-mono text-[9px] opacity-70 bg-black/20 px-1 py-0.5 rounded">Ctrl+S</kbd>
                  </Button>

                  {/* Delete Page */}
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleDeleteDoc()}
                    disabled={isDeleting}
                    className="h-7 w-7 p-0 text-rose-500 hover:bg-rose-500/10 hover:text-rose-600"
                    title="Move to Recycle Bin"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>

              {/* Metadata strip: Author, Created, Linked Tasks count */}
              <div className="flex items-center gap-3 text-[11px] text-[var(--muted-foreground)]">
                {selectedDoc.author && (
                  <span className="flex items-center gap-1">
                    <User className="h-3 w-3" />
                    <span>{selectedDoc.author.full_name || 'Team Member'}</span>
                  </span>
                )}
                {selectedDoc.created_at && (
                  <span className="flex items-center gap-1 font-mono text-[10px]">
                    <Clock className="h-3 w-3" />
                    <span>{new Date(selectedDoc.created_at).toLocaleDateString()}</span>
                  </span>
                )}
                {selectedDoc.linked_tasks && selectedDoc.linked_tasks.length > 0 && (
                  <div className="flex items-center gap-1">
                    <span className="font-semibold text-[var(--foreground)]">Linked:</span>
                    {selectedDoc.linked_tasks.map((lt) => (
                      <span
                        key={lt.id}
                        onClick={() => onSelectTask?.(lt)}
                        className="font-mono text-[10px] px-1 py-0.5 rounded bg-[var(--secondary)] hover:bg-[var(--primary)]/20 cursor-pointer border border-[var(--border)] transition-colors"
                      >
                        {lt.task_code || (lt as any).code}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Task Linking Bar */}
            {isLinkingTask && (
              <div className="p-3 bg-[var(--secondary)]/60 border-b border-[var(--border)] flex flex-wrap items-center gap-2 text-xs">
                <span className="font-medium text-[var(--foreground)]">Select Task to link:</span>
                <select
                  value={selectedTaskIdToLink}
                  onChange={(e) => setSelectedTaskIdToLink(e.target.value)}
                  className="h-7 text-xs bg-[var(--card)] border border-[var(--border)] rounded px-2"
                >
                  <option value="">-- Choose task --</option>
                  {tasks.map((t) => (
                    <option key={t.id} value={t.id}>
                      [{t.task_code || (t as any).code || 'TASK'}] {t.title}
                    </option>
                  ))}
                </select>
                <Button size="sm" onClick={handleLinkTask} className="h-7 text-xs">
                  Link Task
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setIsLinkingTask(false)}
                  className="h-7 text-xs"
                >
                  Cancel
                </Button>
              </div>
            )}

            {/* Markdown Quick Toolbar */}
            <div className="px-3 py-1.5 border-b border-[var(--border)] bg-[var(--secondary)]/20 flex items-center gap-1 text-xs">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => insertFormatting('**', '**')}
                className="h-6 w-6 p-0"
                title="Bold"
              >
                <Bold className="h-3 w-3" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => insertFormatting('*', '*')}
                className="h-6 w-6 p-0"
                title="Italic"
              >
                <Italic className="h-3 w-3" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => insertFormatting('# ')}
                className="h-6 w-6 p-0"
                title="Heading 1"
              >
                <Heading1 className="h-3 w-3" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => insertFormatting('## ')}
                className="h-6 w-6 p-0"
                title="Heading 2"
              >
                <Heading2 className="h-3 w-3" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => insertFormatting('- ')}
                className="h-6 w-6 p-0"
                title="Bullet List"
              >
                <List className="h-3 w-3" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => insertFormatting('`', '`')}
                className="h-6 w-6 p-0"
                title="Code"
              >
                <Code className="h-3 w-3" />
              </Button>
              <span className="text-[var(--border)] mx-1">|</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  const code = tasks[0]?.task_code || (tasks[0] as any)?.code || 'TASK-01';
                  insertFormatting(`/task ${code}`);
                }}
                className="h-6 px-1.5 text-[10px] font-mono gap-1 text-[var(--primary)]"
                title="Embed interactive Task Card syntax"
              >
                <LinkIcon className="h-2.5 w-2.5" />
                <span>/task [code]</span>
              </Button>
            </div>

            {/* Dynamic Layout Editor & Preview */}
            <div className={`flex-1 overflow-hidden ${
              viewLayout === 'split' ? 'grid grid-cols-1 md:grid-cols-2' : 'flex flex-col'
            }`}>
              {/* Raw Editor */}
              {(viewLayout === 'split' || viewLayout === 'edit') && (
                <div className={`p-4 ${viewLayout === 'split' ? 'border-r border-[var(--border)]' : ''} flex-1 flex flex-col overflow-hidden bg-[var(--card)]`}>
                  <div className="text-[10px] font-bold uppercase tracking-wider text-[var(--muted-foreground)] mb-2 flex items-center justify-between">
                    <span>Markdown Editor</span>
                    <span className="font-mono">{markdownContent.length} chars</span>
                  </div>
                  <textarea
                    value={markdownContent}
                    onChange={(e) => setMarkdownContent(e.target.value)}
                    className="flex-1 w-full bg-transparent border-0 resize-none font-mono text-xs text-[var(--foreground)] outline-none leading-relaxed"
                    placeholder="Write your markdown living documentation here..."
                  />
                </div>
              )}

              {/* Rendered Preview with Embedded Task Cards */}
              {(viewLayout === 'split' || viewLayout === 'preview') && (
                <div className="p-4 flex-1 overflow-y-auto bg-[var(--secondary)]/15">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-[var(--muted-foreground)] mb-2 flex items-center justify-between">
                    <span>Live Interactive Preview</span>
                    <span className="text-[9px] text-[var(--muted-foreground)]">Rendered in Real-Time</span>
                  </div>
                  <div className="prose dark:prose-invert max-w-none text-xs">
                    {renderDocumentWithEmbeddedTasks(markdownContent)}
                  </div>
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-xs text-[var(--muted-foreground)] gap-3 p-8 text-center">
            <FileText className="h-12 w-12 opacity-30" />
            <div className="font-semibold text-sm text-[var(--foreground)]">No Document Selected</div>
            <p className="max-w-sm">
              Select an existing page from the hierarchy tree on the left, or click &ldquo;+ Page&rdquo; to create your first documentation page.
            </p>
            <Button size="sm" onClick={() => handleCreateDoc()} className="gap-1.5 text-xs">
              <Plus className="h-3.5 w-3.5" />
              <span>Create First Document</span>
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
