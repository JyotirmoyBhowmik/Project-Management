// ==============================================================================
// src/app/(dashboard)/projects/page.tsx
// Projects Portfolio Directory (100% Live Supabase PostgreSQL Data)
// Full CRUD Project Creation Modal & Responsive Empty States
// ==============================================================================

'use client';

import * as React from 'react';
import Link from 'next/link';
import {
  FolderGit2,
  Plus,
  Calendar,
  Layers,
  ArrowRight,
  Search,
  Filter,
  Loader2,
  Trash2,
  LayoutGrid,
  List,
  ArrowUpDown,
} from 'lucide-react';
import { useTenantStore } from '@/lib/stores/tenant-store';
import { createClient } from '@/lib/supabase/client';
import { dbService } from '@/lib/supabase/db-service';
import { Project, ProjectStatus } from '@/types/database';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Modal } from '@/components/ui/dialog';
import { DeleteProjectModal } from '@/components/modals/DeleteProjectModal';

export default function ProjectsPortfolioPage() {
  const supabase = createClient();
  const { activeTenant, activeRole, currentUser } = useTenantStore();

  const [projects, setProjects] = React.useState<Project[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [statusFilter, setStatusFilter] = React.useState<string>('all');
  const [searchQuery, setSearchQuery] = React.useState<string>('');
  const [viewLayout, setViewLayout] = React.useState<'grid' | 'list'>('grid');
  const [sortBy, setSortBy] = React.useState<'name' | 'code' | 'start_date' | 'status'>('start_date');
  const [projectToDelete, setProjectToDelete] = React.useState<Project | null>(null);

  // Project Creation Modal State
  const [isCreateModalOpen, setIsCreateModalOpen] = React.useState<boolean>(false);
  const [projectName, setProjectName] = React.useState('');
  const [projectCode, setProjectCode] = React.useState('');
  const [projectDesc, setProjectDesc] = React.useState('');
  const [startDate, setStartDate] = React.useState(new Date().toISOString().split('T')[0]);
  const [targetEndDate, setTargetEndDate] = React.useState('');
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const tenantId = activeTenant?.id;
  const userId = currentUser?.id;

  const loadProjects = React.useCallback(async () => {
    if (!tenantId) {
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      const data = await dbService.getTenantProjects(tenantId, userId, activeRole, supabase);
      setProjects(data);
    } catch (err) {
      console.error('Failed to fetch projects:', err);
    } finally {
      setIsLoading(false);
    }
  }, [tenantId, userId, activeRole]);

  React.useEffect(() => {
    loadProjects();
  }, [loadProjects]);

  const statusCounts = React.useMemo(() => {
    return {
      all: projects.length,
      planning: projects.filter((p) => p.status === 'planning').length,
      active: projects.filter((p) => p.status === 'active').length,
      completed: projects.filter((p) => p.status === 'completed').length,
      on_hold: projects.filter((p) => p.status === 'on_hold').length,
    };
  }, [projects]);

  const filteredProjects = projects.filter((p) => {
    const matchesStatus = statusFilter === 'all' || p.status === statusFilter;
    const matchesSearch =
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (p.code && p.code.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesStatus && matchesSearch;
  });

  const sortedProjects = React.useMemo(() => {
    return [...filteredProjects].sort((a, b) => {
      if (sortBy === 'name') return a.name.localeCompare(b.name);
      if (sortBy === 'code') return (a.code || '').localeCompare(b.code || '');
      if (sortBy === 'start_date') return (b.start_date || '').localeCompare(a.start_date || '');
      if (sortBy === 'status') return a.status.localeCompare(b.status);
      return 0;
    });
  }, [filteredProjects, sortBy]);

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!projectName.trim() || !projectCode.trim() || !tenantId) return;

    setIsSubmitting(true);
    try {
      await dbService.createProject(
        {
          tenant_id: tenantId,
          name: projectName.trim(),
          code: projectCode.trim().toUpperCase(),
          description: projectDesc.trim() || null,
          status: 'planning',
          start_date: startDate,
          target_end_date: targetEndDate || null,
          created_by: userId || null,
        },
        supabase
      );

      setIsCreateModalOpen(false);
      setProjectName('');
      setProjectCode('');
      setProjectDesc('');
      await loadProjects();
    } catch (err) {
      console.error('Failed to create project:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'active':
        return 'success';
      case 'planning':
        return 'secondary';
      case 'completed':
        return 'default';
      case 'on_hold':
        return 'warning';
      default:
        return 'outline';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[var(--border)] pb-5">
        <div>
          <h1 className="text-2xl font-bold text-[var(--foreground)] tracking-tight">
            Projects Portfolio
          </h1>
          <p className="text-xs text-[var(--muted-foreground)] mt-0.5">
            Manage projects, schedules, milestones, and critical paths for{' '}
            <strong className="text-[var(--foreground)]">{activeTenant?.name || 'Workspace'}</strong>.
          </p>
        </div>

        <Button onClick={() => setIsCreateModalOpen(true)} className="gap-2 text-xs self-start sm:self-auto">
          <Plus className="h-4 w-4" />
          <span>New Project</span>
        </Button>
      </div>

      {/* Filter, Sort, and Search Bar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="relative flex-1 w-full max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--muted-foreground)]" />
          <Input
            placeholder="Search projects by name or code..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 h-9 text-xs bg-[var(--card)]"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Status Filters with Real-Time Counters */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
            {(['all', 'planning', 'active', 'completed', 'on_hold'] as const).map((st) => (
              <button
                key={st}
                onClick={() => setStatusFilter(st)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
                  statusFilter === st
                    ? 'bg-[var(--primary)] text-white'
                    : 'bg-[var(--secondary)] text-[var(--muted-foreground)] hover:text-[var(--foreground)]'
                }`}
              >
                <span className="capitalize">{st.replace('_', ' ')}</span>
                <span className={`text-[10px] px-1.5 rounded-full font-mono ${
                  statusFilter === st ? 'bg-white/20 text-white' : 'bg-[var(--card)] text-[var(--muted-foreground)]'
                }`}>
                  {statusCounts[st]}
                </span>
              </button>
            ))}
          </div>

          {/* Sort Selector */}
          <div className="flex items-center gap-1.5 bg-[var(--card)] border border-[var(--border)] rounded-lg px-2.5 py-1 text-xs">
            <ArrowUpDown className="h-3.5 w-3.5 text-[var(--muted-foreground)]" />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="bg-transparent text-xs text-[var(--foreground)] focus:outline-none cursor-pointer"
            >
              <option value="start_date">Newest Date</option>
              <option value="name">Name (A-Z)</option>
              <option value="code">Project Code</option>
              <option value="status">Status</option>
            </select>
          </div>

          {/* Grid vs List View Toggle */}
          <div className="flex items-center bg-[var(--secondary)]/60 p-0.5 rounded-lg border border-[var(--border)]">
            <button
              type="button"
              onClick={() => setViewLayout('grid')}
              title="Grid View"
              className={`p-1.5 rounded-md transition-colors ${viewLayout === 'grid' ? 'bg-[var(--card)] text-[var(--foreground)] shadow-xs' : 'text-[var(--muted-foreground)] hover:text-[var(--foreground)]'}`}
            >
              <LayoutGrid className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setViewLayout('list')}
              title="List / Table View"
              className={`p-1.5 rounded-md transition-colors ${viewLayout === 'list' ? 'bg-[var(--card)] text-[var(--foreground)] shadow-xs' : 'text-[var(--muted-foreground)] hover:text-[var(--foreground)]'}`}
            >
              <List className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Projects Grid / List or Responsive Empty State */}
      {isLoading ? (
        <div className="h-64 flex flex-col items-center justify-center gap-2">
          <Loader2 className="h-6 w-6 animate-spin text-[var(--primary)]" />
          <p className="text-xs text-[var(--muted-foreground)]">Loading portfolio projects...</p>
        </div>
      ) : sortedProjects.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[var(--border)] bg-[var(--card)] p-12 text-center space-y-4">
          <div className="h-12 w-12 rounded-full bg-[var(--secondary)] flex items-center justify-center mx-auto text-[var(--muted-foreground)]">
            <FolderGit2 className="h-6 w-6" />
          </div>
          <div className="space-y-1">
            <h3 className="text-base font-semibold text-[var(--foreground)]">No projects found in this workspace</h3>
            <p className="text-xs text-[var(--muted-foreground)] max-w-sm mx-auto">
              Create your first project using the button below or contact your workspace administrator to receive an assignment.
            </p>
          </div>
          <Button onClick={() => setIsCreateModalOpen(true)} className="gap-2 text-xs">
            <Plus className="h-4 w-4" />
            <span>Create First Project</span>
          </Button>
        </div>
      ) : viewLayout === 'list' ? (
        /* Tabular List View */
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-[var(--border)] text-[var(--muted-foreground)] bg-[var(--secondary)]/30">
                  <th className="py-3 px-4">Code</th>
                  <th className="py-3 px-4">Project Name</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Schedule Span</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {sortedProjects.map((prj) => (
                  <tr key={prj.id} className="hover:bg-[var(--secondary)]/20 transition-colors">
                    <td className="py-3 px-4 font-mono font-bold text-[var(--primary)]">
                      {prj.code}
                    </td>
                    <td className="py-3 px-4">
                      <Link
                        href={`/projects/${prj.id}`}
                        className="font-bold text-[var(--foreground)] hover:text-[var(--primary)] transition-colors"
                      >
                        {prj.name}
                      </Link>
                      {prj.description && (
                        <p className="text-[11px] text-[var(--muted-foreground)] line-clamp-1 mt-0.5">
                          {prj.description}
                        </p>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <Badge variant={getStatusBadgeVariant(prj.status)} className="text-[10px] capitalize">
                        {prj.status}
                      </Badge>
                    </td>
                    <td className="py-3 px-4 font-mono text-[11px] text-[var(--muted-foreground)]">
                      <div className="flex items-center gap-1.5">
                        <Calendar className="h-3 w-3" />
                        <span>{prj.start_date} {prj.target_end_date ? `→ ${prj.target_end_date}` : ''}</span>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Link
                          href={`/projects/${prj.id}`}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold bg-[var(--secondary)] hover:bg-[var(--primary)] hover:text-white transition-colors"
                        >
                          <span>Open</span>
                          <ArrowRight className="h-3 w-3" />
                        </Link>
                        {(activeRole === 'owner' || activeRole === 'admin' || currentUser?.is_superadmin) && (
                          <button
                            onClick={() => setProjectToDelete(prj)}
                            className="p-1 rounded-md hover:bg-red-500/10 text-[var(--muted-foreground)] hover:text-red-400 transition-colors"
                            title="Delete Project"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* Card Grid View */
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {sortedProjects.map((prj) => (
            <div
              key={prj.id}
              className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-5 hover:border-[var(--primary)] transition-all shadow-xs flex flex-col justify-between group"
            >
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <Badge variant="outline" className="font-mono text-[10px]">
                    {prj.code}
                  </Badge>
                  <Badge variant={getStatusBadgeVariant(prj.status)} className="text-[10px] capitalize">
                    {prj.status}
                  </Badge>
                </div>

                <div>
                  <h2 className="text-base font-bold text-[var(--foreground)] group-hover:text-[var(--primary)] transition-colors">
                    {prj.name}
                  </h2>
                  {prj.description && (
                    <p className="text-xs text-[var(--muted-foreground)] line-clamp-2 mt-1">
                      {prj.description}
                    </p>
                  )}
                </div>

                <div className="space-y-1.5 pt-2 border-t border-[var(--border)]/60 text-[11px] text-[var(--muted-foreground)] font-mono">
                  <div className="flex items-center gap-1.5">
                    <Calendar className="h-3.5 w-3.5" />
                    <span>
                      {prj.start_date} {prj.target_end_date ? `→ ${prj.target_end_date}` : ''}
                    </span>
                  </div>
                </div>
              </div>

              <div className="pt-4 mt-4 border-t border-[var(--border)] flex items-center justify-between">
                <Link
                  href={`/projects/${prj.id}`}
                  className="flex items-center gap-1.5 text-xs font-semibold text-[var(--primary)] hover:underline"
                >
                  <span>Open Workspace</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>

                {(activeRole === 'owner' || activeRole === 'admin' || currentUser?.is_superadmin) && (
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setProjectToDelete(prj);
                    }}
                    className="p-1.5 rounded-md hover:bg-red-500/10 text-[var(--muted-foreground)] hover:text-red-400 transition-colors cursor-pointer"
                    title="Delete Project"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Project Creation Modal */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        title="Create New Project"
      >
        <form onSubmit={handleCreateProject} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-[var(--foreground)]">Project Name</label>
            <Input
              placeholder="e.g. Next-Gen Cloud Platform"
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              required
              autoFocus
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-[var(--foreground)]">Project Code</label>
            <Input
              placeholder="e.g. PRJ-CORE"
              value={projectCode}
              onChange={(e) => setProjectCode(e.target.value)}
              required
              className="font-mono"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-[var(--foreground)]">Description (Optional)</label>
            <Input
              placeholder="Project goals and technical deliverables..."
              value={projectDesc}
              onChange={(e) => setProjectDesc(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-[var(--foreground)]">Start Date</label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-[var(--foreground)]">Target End Date</label>
              <Input
                type="date"
                value={targetEndDate}
                onChange={(e) => setTargetEndDate(e.target.value)}
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsCreateModalOpen(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting || !projectName.trim() || !projectCode.trim()}>
              {isSubmitting ? 'Creating...' : 'Create Project'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Project Destruction Confirmation Modal */}
      {projectToDelete && tenantId && (
        <DeleteProjectModal
          isOpen={!!projectToDelete}
          onClose={() => setProjectToDelete(null)}
          projectId={projectToDelete.id}
          projectName={projectToDelete.name}
          projectCode={projectToDelete.code || projectToDelete.name}
          tenantId={tenantId}
          onDeleted={async () => {
            setProjectToDelete(null);
            await loadProjects();
          }}
        />
      )}
    </div>
  );
}
