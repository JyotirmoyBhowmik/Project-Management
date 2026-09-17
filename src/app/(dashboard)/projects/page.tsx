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
} from 'lucide-react';
import { useTenantStore } from '@/lib/stores/tenant-store';
import { db } from '@/lib/supabase/mock-db';
import { Project, ProjectStatus } from '@/types/database';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Modal } from '@/components/ui/dialog';

export default function ProjectsPortfolioPage() {
  const { activeTenant, activeRole, currentUser } = useTenantStore();
  const [statusFilter, setStatusFilter] = React.useState<string>('all');
  const [searchQuery, setSearchQuery] = React.useState<string>('');
  const [isCreateModalOpen, setIsCreateModalOpen] = React.useState<boolean>(false);

  // New Project Form State
  const [projectName, setProjectName] = React.useState('');
  const [projectCode, setProjectCode] = React.useState('');
  const [projectDesc, setProjectDesc] = React.useState('');
  const [startDate, setStartDate] = React.useState('2026-10-01');
  const [targetEndDate, setTargetEndDate] = React.useState('2026-12-31');

  const tenantProjects = db.getProjectsForUser(
    activeTenant?.id || 'a0000000-0000-0000-0000-000000000001',
    currentUser?.id || 'b0000000-0000-0000-0000-000000000002',
    activeRole
  );

  const filteredProjects = tenantProjects.filter((p) => {
    const matchesStatus = statusFilter === 'all' || p.status === statusFilter;
    const matchesSearch =
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (p.code && p.code.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesStatus && matchesSearch;
  });

  const handleCreateProject = (e: React.FormEvent) => {
    e.preventDefault();
    if (!projectName || !projectCode) return;

    const newPrj: Project = {
      id: `prj-${Date.now()}`,
      tenant_id: activeTenant!.id,
      name: projectName,
      code: projectCode.toUpperCase(),
      description: projectDesc || null,
      status: 'active' as ProjectStatus,
      start_date: startDate,
      target_end_date: targetEndDate || null,
      calendar_id: 'c0000000-0000-0000-0000-000000000001',
      is_archived: false,
      created_by: currentUser?.id || null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    db.projects.push(newPrj);
    setIsCreateModalOpen(false);
    setProjectName('');
    setProjectCode('');
    setProjectDesc('');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-[var(--foreground)] flex items-center gap-2">
            <FolderGit2 className="h-5 w-5 text-[var(--primary)]" />
            Project Portfolio
          </h1>
          <p className="text-xs text-[var(--muted-foreground)] mt-0.5">
            Manage projects, scopes, and critical schedules within <strong className="text-[var(--foreground)]">{activeTenant?.name}</strong>.
          </p>
        </div>

        {activeRole !== 'guest' && (
          <Button onClick={() => setIsCreateModalOpen(true)} className="gap-2 text-xs">
            <Plus className="h-4 w-4" />
            Create Project
          </Button>
        )}
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-3 rounded-xl border border-[var(--border)] bg-[var(--card)] shadow-xs">
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-[var(--muted-foreground)]" />
          <Input
            placeholder="Search projects or codes..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 h-9 text-xs"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Filter className="h-3.5 w-3.5 text-[var(--muted-foreground)]" />
          <div className="flex items-center rounded-lg border border-[var(--border)] bg-[var(--secondary)] p-0.5 text-xs">
            {['all', 'active', 'planning', 'completed'].map((status) => (
              <button
                key={status}
                onClick={() => setStatusFilter(status)}
                className={`px-3 py-1 rounded-md capitalize font-medium transition-colors cursor-pointer ${
                  statusFilter === status
                    ? 'bg-[var(--card)] text-[var(--foreground)] shadow-xs font-semibold'
                    : 'text-[var(--muted-foreground)] hover:text-[var(--foreground)]'
                }`}
              >
                {status}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Project Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredProjects.map((project) => {
          const prjTasks = db.tasks.filter(t => t.project_id === project.id);
          const completedTasks = prjTasks.filter(t => t.status === 'completed');
          const criticalTasks = prjTasks.filter(t => t.is_critical);
          const progress = prjTasks.length > 0 ? Math.round((completedTasks.length / prjTasks.length) * 100) : 0;

          return (
            <div
              key={project.id}
              className="flex flex-col justify-between rounded-xl border border-[var(--border)] bg-[var(--card)] p-5 shadow-xs hover:border-[var(--primary)] hover:shadow-md transition-all group"
            >
              <div>
                <div className="flex items-center justify-between gap-2 mb-2">
                  <Badge variant="outline" className="font-mono text-[10px]">
                    {project.code}
                  </Badge>
                  <Badge variant={project.status === 'active' ? 'success' : 'secondary'} className="capitalize text-[10px]">
                    {project.status}
                  </Badge>
                </div>

                <h3 className="text-sm font-bold text-[var(--foreground)] group-hover:text-[var(--primary)] transition-colors leading-snug">
                  {project.name}
                </h3>
                <p className="text-xs text-[var(--muted-foreground)] line-clamp-2 mt-1.5 leading-relaxed">
                  {project.description || 'No description provided.'}
                </p>
              </div>

              <div className="pt-4 mt-4 border-t border-[var(--border)] space-y-3">
                {/* Progress Bar */}
                <div>
                  <div className="flex items-center justify-between text-[11px] mb-1">
                    <span className="text-[var(--muted-foreground)]">Completion</span>
                    <span className="font-semibold font-mono text-[var(--foreground)]">{progress}%</span>
                  </div>
                  <div className="w-full bg-[var(--secondary)] rounded-full h-1.5 overflow-hidden">
                    <div className="bg-[var(--primary)] h-1.5 rounded-full" style={{ width: `${progress}%` }} />
                  </div>
                </div>

                {/* Metrics */}
                <div className="flex items-center justify-between text-[11px] text-[var(--muted-foreground)] font-mono">
                  <span>{prjTasks.length} Work Items</span>
                  {criticalTasks.length > 0 && (
                    <span className="text-rose-500 font-semibold">{criticalTasks.length} Critical Path</span>
                  )}
                </div>

                {/* Link to Workspace */}
                <Link href={`/projects/${project.id}`} className="block pt-1">
                  <Button variant="secondary" className="w-full justify-between text-xs font-semibold group-hover:bg-[var(--primary)] group-hover:text-[var(--primary-foreground)] transition-colors">
                    <span>Enter Workspace</span>
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Button>
                </Link>
              </div>
            </div>
          );
        })}
      </div>

      {/* Create Project Modal */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        title="Create New Project"
        description="Initialize Work Breakdown Structure and scheduling parameters"
      >
        <form onSubmit={handleCreateProject} className="space-y-4 text-xs">
          <div>
            <label className="font-semibold block mb-1">Project Name</label>
            <Input
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              placeholder="e.g. SOC2 Type II Audit"
              required
            />
          </div>

          <div>
            <label className="font-semibold block mb-1">Project Code (2-32 Alphanumeric)</label>
            <Input
              value={projectCode}
              onChange={(e) => setProjectCode(e.target.value.toUpperCase())}
              placeholder="PRJ-SEC-02"
              required
            />
          </div>

          <div>
            <label className="font-semibold block mb-1">Description</label>
            <textarea
              value={projectDesc}
              onChange={(e) => setProjectDesc(e.target.value)}
              className="w-full h-20 rounded-md border border-[var(--input)] bg-[var(--card)] p-2 text-xs"
              placeholder="Project goals and technical scope..."
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="font-semibold block mb-1">Start Date</label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="font-semibold block mb-1">Target End Date</label>
              <Input
                type="date"
                value={targetEndDate}
                onChange={(e) => setTargetEndDate(e.target.value)}
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-[var(--border)]">
            <Button type="button" variant="outline" onClick={() => setIsCreateModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit">Create Project</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
