// ==============================================================================
// tests/unit/automation-engine.test.ts
// Unit Tests for No-Code Workflow Automations & Condition Evaluators
// ==============================================================================

import { describe, it, expect } from 'vitest';

interface Condition {
  field: string;
  operator: 'equals' | 'not_equals' | 'greater_than' | 'contains' | 'is_empty';
  value: any;
}

function evaluateConditions(conditions: Condition[], payload: Record<string, any>): boolean {
  for (const cond of conditions) {
    const actual = payload[cond.field];
    if (cond.operator === 'equals' && actual !== cond.value) return false;
    if (cond.operator === 'not_equals' && actual === cond.value) return false;
    if (cond.operator === 'greater_than' && !(Number(actual) > Number(cond.value))) return false;
    if (cond.operator === 'contains' && !(String(actual).includes(String(cond.value)))) return false;
    if (cond.operator === 'is_empty' && actual !== null && actual !== undefined && actual !== '') return false;
  }
  return true;
}

describe('Workflow Automation Engine Condition Evaluator', () => {
  it('should match exact equality conditions', () => {
    const conditions: Condition[] = [{ field: 'priority', operator: 'equals', value: 'urgent' }];
    expect(evaluateConditions(conditions, { priority: 'urgent' })).toBe(true);
    expect(evaluateConditions(conditions, { priority: 'low' })).toBe(false);
  });

  it('should match numeric thresholds (e.g. story points > 8)', () => {
    const conditions: Condition[] = [{ field: 'story_points', operator: 'greater_than', value: 8 }];
    expect(evaluateConditions(conditions, { story_points: 13 })).toBe(true);
    expect(evaluateConditions(conditions, { story_points: 5 })).toBe(false);
    expect(evaluateConditions(conditions, { story_points: 8 })).toBe(false);
  });

  it('should detect empty assignees', () => {
    const conditions: Condition[] = [{ field: 'assignee_id', operator: 'is_empty', value: null }];
    expect(evaluateConditions(conditions, { assignee_id: null })).toBe(true);
    expect(evaluateConditions(conditions, { assignee_id: '' })).toBe(true);
    expect(evaluateConditions(conditions, { assignee_id: 'user-123' })).toBe(false);
  });
});
