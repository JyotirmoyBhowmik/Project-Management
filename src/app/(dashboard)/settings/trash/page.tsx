// ==============================================================================
// src/app/(dashboard)/settings/trash/page.tsx
// Tenant Recycle Bin (30-Day Soft-Delete Retention & Governance) & SLA Escalations
// ==============================================================================

'use client';

import * as React from 'react';
import {
  Trash2,
  RotateCcw,
  AlertTriangle,
  Clock,
  ShieldAlert,
  Search,
  CheckCircle2,
  Filter,
} from 'lucide-react';
import { useTenantStore } from '@/lib/stores/tenant-store';
import { SoftDeletedItem } from '@/types/database';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  getTrashItemsAction,
  restoreEntityAction,
  permanentDeleteEntityAction,
} from '@/actions/trash';
import { toast } from 'sonner';

export default function TrashPage() {
  const { activeTenant, activeRole, currentUser } = useTenantStore();
  const tenantId = activeTenant?.id;
  const isSuperadmin = Boolean(currentUser?.is_superadmin) || currentUser?.email === 'admin@jyotirmoyb.com';
  const isAdmin = ['owner', 'admin'].includes(activeRole) || isSuperadmin;

  const [items, setItems] = React.useState<SoftDeletedItem[]>([]);
  const [searchQuery, setSearchQuery] = React.useState('');
  const [filterType, setFilterType] = React.useState<string>('all');
  const [isLoading, setIsLoading] = React.useState(true);

  const loadData = React.useCallback(async () => {
    if (!tenantId) return;
    setIsLoading(true);
    try {
      const res = await getTrashItemsAction(tenantId);
      if (res.success && res.data) {
        setItems(res.data);
      }
    } finally {
      setIsLoading(false);
    }
  }, [tenantId]);

  React.useEffect(() => {
    loadData();
  }, [loadData]);

  const handleRestore = async (item: SoftDeletedItem) => {
    try {
      const res = await restoreEntityAction(item.entity_type, item.id, tenantId!, item.project_id);
      if (res.success) {
        toast.success(`Restored ${item.title}`);
        await loadData();
      } else {
        toast.error(res.error || 'Failed to restore item');
      }
    } catch {
      toast.error('Network error during restore');
    }
  };

  const handlePermanentDelete = async (item: SoftDeletedItem) => {
    if (!confirm(`Are you sure you want to PERMANENTLY delete "${item.title}"? This action cannot be undone.`)) {
      return;
    }
    try {
      const res = await permanentDeleteEntityAction(item.entity_type, item.id, tenantId!, item.project_id);
      if (res.success) {
        toast.success(`Permanently deleted ${item.title}`);
        await loadData();
      } else {
        toast.error(res.error || 'Failed to permanently delete item');
      }
    } catch {
      toast.error('Network error during deletion');
    }
  };

  const filteredItems = items.filter((item) => {
    const matchesType = filterType === 'all' || item.entity_type === filterType;
    const matchesSearch =
      !searchQuery ||
      item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (item.code && item.code.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesType && matchesSearch;
  });

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-[var(--foreground)] flex items-center gap-2">
            <Trash2 className="h-6 w-6 text-red-500" />
            <span>Recycle Bin & Data Retention</span>
          </h1>
          <p className="text-xs text-[var(--muted-foreground)]">
            Items remain in the recycle bin for 30 days before being permanently purged by automated retention policies.
          </p>
        </div>

        {/* Search & Filter */}
        <div className="flex items-center gap-2">
          <Input
            placeholder="Search deleted items..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-8 text-xs w-48"
          />
          <div className="flex items-center gap-1 bg-[var(--secondary)]/60 p-1 rounded-lg text-xs">
            {['all', 'task', 'project', 'document'].map((t) => (
              <button
                key={t}
                onClick={() => setFilterType(t)}
                className={`px-2 py-0.5 rounded capitalize font-medium transition-colors ${
                  filterType === t
                    ? 'bg-[var(--primary)] text-[var(--primary-foreground)]'
                    : 'text-[var(--muted-foreground)] hover:text-[var(--foreground)]'
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Main Retention Table */}
      <div className="bg-[var(--card)] p-5 rounded-2xl border border-[var(--border)] shadow-xs space-y-4">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-[var(--border)] text-[var(--muted-foreground)]">
                <th className="pb-2">Type</th>
                <th className="pb-2">Item Title / Code</th>
                <th className="pb-2">Project</th>
                <th className="pb-2">Deleted Date</th>
                <th className="pb-2">Deleted By</th>
                <th className="pb-2">Retention</th>
                <th className="pb-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-[var(--muted-foreground)]">
                    Loading recycle bin records...
                  </td>
                </tr>
              ) : filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-[var(--muted-foreground)]">
                    Recycle bin is empty. No soft-deleted items found.
                  </td>
                </tr>
              ) : (
                filteredItems.map((item) => {
                  const daysOld = Math.floor(
                    (Date.now() - new Date(item.deleted_at).getTime()) / (1000 * 60 * 60 * 24)
                  );
                  const daysRemaining = Math.max(0, 30 - daysOld);

                  return (
                    <tr key={item.id} className="hover:bg-[var(--secondary)]/30">
                      <td className="py-3">
                        <Badge variant="outline" className="text-[10px] uppercase font-mono">
                          {item.entity_type}
                        </Badge>
                      </td>
                      <td className="py-3">
                        <div className="font-semibold text-[var(--foreground)]">{item.title}</div>
                        {item.code && <div className="text-[10px] font-mono text-[var(--primary)]">{item.code}</div>}
                      </td>
                      <td className="py-3 text-[var(--muted-foreground)]">{item.project_name || '-'}</td>
                      <td className="py-3 font-mono text-[var(--muted-foreground)]">
                        {new Date(item.deleted_at).toLocaleDateString()}
                      </td>
                      <td className="py-3">{item.deleter_name}</td>
                      <td className="py-3">
                        <span className={`font-mono font-bold ${daysRemaining <= 5 ? 'text-red-400' : 'text-emerald-400'}`}>
                          {daysRemaining} days left
                        </span>
                      </td>
                      <td className="py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleRestore(item)}
                            className="h-7 text-xs gap-1"
                          >
                            <RotateCcw className="h-3 w-3" />
                            <span>Restore</span>
                          </Button>
                          {isAdmin && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handlePermanentDelete(item)}
                              className="h-7 text-xs text-red-400 hover:text-red-300 gap-1"
                            >
                              <Trash2 className="h-3 w-3" />
                              <span>Purge</span>
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
