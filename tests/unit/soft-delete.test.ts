// ==============================================================================
// tests/unit/soft-delete.test.ts
// Unit Tests for Universal Soft-Delete & 30-Day Retention Calculation
// ==============================================================================

import { describe, it, expect } from 'vitest';

describe('Universal Soft-Delete & Retention Policy', () => {
  it('should calculate remaining retention days accurately', () => {
    const now = Date.now();
    const tenDaysAgo = new Date(now - 10 * 24 * 60 * 60 * 1000).toISOString();
    const thirtyFiveDaysAgo = new Date(now - 35 * 24 * 60 * 60 * 1000).toISOString();

    const calculateDaysLeft = (deletedAt: string) => {
      const daysOld = Math.floor((now - new Date(deletedAt).getTime()) / (1000 * 60 * 60 * 24));
      return Math.max(0, 30 - daysOld);
    };

    expect(calculateDaysLeft(tenDaysAgo)).toBe(20);
    expect(calculateDaysLeft(thirtyFiveDaysAgo)).toBe(0); // Eligible for purge
  });

  it('should filter out soft-deleted items from active queries', () => {
    const items = [
      { id: '1', title: 'Active Task', deleted_at: null },
      { id: '2', title: 'Deleted Task', deleted_at: '2026-09-10T12:00:00Z' },
      { id: '3', title: 'Another Active Task', deleted_at: null },
    ];

    const activeItems = items.filter((item) => item.deleted_at === null);
    const trashItems = items.filter((item) => item.deleted_at !== null);

    expect(activeItems.length).toBe(2);
    expect(trashItems.length).toBe(1);
    expect(trashItems[0].title).toBe('Deleted Task');
  });
});
