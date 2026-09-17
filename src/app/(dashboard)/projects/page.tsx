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
} from 'lucide-react';
import { useTenantStore } from '@/lib/stores/tenant-store';
import { createClient } from '@/lib/supabase/client';
import { dbService } from '@/lib/supabase/db-service';
import { Project, ProjectStatus } from '@/types/database';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Modal } from '@/components/ui/dialog';

export default function ProjectsPortfolioPage() {
  const supabase = createClient();
  const { activeTenant, activeRole, currentUser } = useTenantStore();

  const [projects, setProjects] = React.useState<Project[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [statusFilter, setStatusFilter] = React.useState<string>('all');
  const [searchQuery, setSearchQuery] = React.useState<string>('');

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

  const filteredProjects = projects.filter((p) => {
    const matchesStatus = statusFilter === 'all' || p.status === statusFilter;
    const matchesSearch =
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (p.code && p.code.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesStatus && matchesSearch;
  });

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

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-center gap-3">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--muted-foreground)]" />
          <Input
            placeholder="Search projects by name or code..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 h-9 text-xs bg-[var(--card)]"
          />
        </div>

        <div className="flex items-center gap-1.5 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
          {['all', 'planning', 'active', 'completed', 'on_hold'].map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap cursor-pointer ${
                statusFilter === st
                  ? 'bg-[var(--primary)] text-white'
                  : 'bg-[var(--secondary)] text-[var(--muted-foreground)] hover:text-[var(--foreground)]'
              }`}
            >
              <span className="capitalize">{st.replace('_', ' ')}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Projects Grid or Responsive Empty State */}
      {isLoading ? (
        <div className="h-64 flex flex-col items-center justify-center gap-2">
          <Loader2 className="h-6 w-6 animate-spin text-[var(--primary)]" />
          <p className="text-xs text-[var(--muted-foreground)]">Loading portfolio projects...</p>
        </div>
      ) : filteredProjects.length === 0 ? (
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
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {filteredProjects.map((prj) => (
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
    </div>
  );
}
