// ==============================================================================
// src/components/modals/PurgeTenantModal.tsx
// High-Danger SuperAdmin Tenant Cascade Purge Dialog
// ==============================================================================

'use client';

import * as React from 'react';
import { Skull, AlertTriangle, Trash2, Loader2, CheckSquare, Square } from 'lucide-react';
import { Modal } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { purgeTenantAction } from '@/actions/lifecycle';
import { toast } from 'sonner';

interface PurgeTenantModalProps {
  isOpen: boolean;
  onClose: () => void;
  tenantId: string;
  tenantName: string;
  tenantSlug: string;
  onPurged?: () => void;
}

export function PurgeTenantModal({
  isOpen,
  onClose,
  tenantId,
  tenantName,
  tenantSlug,
  onPurged,
}: PurgeTenantModalProps) {
  const [typedSlug, setTypedSlug] = React.useState('');
  const [confirmedEradication, setConfirmedEradication] = React.useState(false);
  const [confirmedNoLegalHold, setConfirmedNoLegalHold] = React.useState(false);
  const [isPurging, setIsPurging] = React.useState(false);

  const expectedSlug = tenantSlug.trim().toLowerCase();
  const isSlugMatch = typedSlug.trim().toLowerCase() === expectedSlug;
  const isReady = isSlugMatch && confirmedEradication && confirmedNoLegalHold;

  const handlePurge = async () => {
    if (!isReady) return;
    setIsPurging(true);

    try {
      const res = await purgeTenantAction({
        tenant_id: tenantId,
        confirm_slug: typedSlug,
      });

      if (!res.success) {
        toast.error(res.error || 'Failed to purge tenant');
        return;
      }

      toast.success(`Tenant ${tenantName} has been permanently purged from the platform.`);
      onClose();
      if (onPurged) onPurged();
    } catch (err: any) {
      toast.error(err?.message || 'Error occurred during tenant purge');
    } finally {
      setIsPurging(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="DANGER ZONE: Irreversible Tenant Purge"
      className="max-w-lg border-red-500/50"
    >
      <div className="space-y-4 pt-2">
        {/* Red Alert Banner */}
        <div className="p-4 bg-red-950/40 border border-red-500/30 rounded-lg flex items-start gap-3">
          <Skull className="w-6 h-6 text-red-500 shrink-0 mt-0.5" />
          <div className="text-xs space-y-1.5">
            <span className="font-bold text-red-400 text-sm block">Atomic Cascade Purge</span>
            <p className="text-red-200/80 leading-relaxed">
              You are about to permanently purge <strong>{tenantName}</strong> ({expectedSlug}). This will execute an atomic PostgreSQL procedure eradicating all projects, tasks, dependencies, members, teams, documents, financial records, and Supabase storage files.
            </p>
          </div>
        </div>

        {/* Verification Checkboxes */}
        <div className="space-y-2.5 pt-1">
          <div
            onClick={() => setConfirmedEradication(!confirmedEradication)}
            className="flex items-start gap-2.5 cursor-pointer select-none text-xs text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
          >
            {confirmedEradication ? (
              <CheckSquare className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
            ) : (
              <Square className="w-4 h-4 text-[var(--muted-foreground)] shrink-0 mt-0.5" />
            )}
            <span>I understand that this action is irreversible and cannot be recovered via Recycle Bin.</span>
          </div>

          <div
            onClick={() => setConfirmedNoLegalHold(!confirmedNoLegalHold)}
            className="flex items-start gap-2.5 cursor-pointer select-none text-xs text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
          >
            {confirmedNoLegalHold ? (
              <CheckSquare className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
            ) : (
              <Square className="w-4 h-4 text-[var(--muted-foreground)] shrink-0 mt-0.5" />
            )}
            <span>I confirm that no active compliance investigations or legal holds apply to this tenant.</span>
          </div>
        </div>

        {/* Slug Type Guard */}
        <div className="space-y-2 pt-2 border-t border-[var(--border)]">
          <label className="text-xs font-medium text-[var(--muted-foreground)]">
            To proceed, type the tenant slug <span className="font-mono font-bold text-red-400">{expectedSlug}</span> below:
          </label>
          <Input
            value={typedSlug}
            onChange={(e) => setTypedSlug(e.target.value)}
            placeholder={expectedSlug}
            className="font-mono text-sm border-red-500/30 focus-visible:ring-red-500"
            autoFocus
          />
        </div>

        {/* Action Buttons */}
        <div className="pt-3 border-t border-[var(--border)] flex items-center justify-end gap-2">
          <Button variant="outline" onClick={onClose} disabled={isPurging}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handlePurge}
            disabled={!isReady || isPurging}
            className="bg-red-600 hover:bg-red-700 text-white font-bold"
          >
            {isPurging ? (
              <>
                <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
                Purging Tenant...
              </>
            ) : (
              <>
                <Trash2 className="w-4 h-4 mr-1.5" />
                Eradicate Tenant & Data
              </>
            )}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
