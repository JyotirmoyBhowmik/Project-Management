// ==============================================================================
// tests/unit/automation-engine.test.ts
// Unit Tests for No-Code Workflow Automations & Condition Evaluators
// ==============================================================================

import { describe, it, expect } from 'vitest';
import { evaluateAutomationCondition } from '@/lib/automations/condition-evaluator';

describe('Workflow Automation Engine Condition Evaluator', () => {
  it('should match exact equality conditions', () => {
    expect(evaluateAutomationCondition({ field: 'priority', operator: 'equals', value: 'urgent' }, { priority: 'urgent' })).toBe(true);
    expect(evaluateAutomationCondition({ field: 'priority', operator: 'equals', value: 'urgent' }, { priority: 'low' })).toBe(false);
  });

  it('should match not_equals conditions', () => {
    expect(evaluateAutomationCondition({ field: 'status', operator: 'not_equals', value: 'completed' }, { status: 'in_progress' })).toBe(true);
    expect(evaluateAutomationCondition({ field: 'status', operator: 'not_equals', value: 'completed' }, { status: 'completed' })).toBe(false);
  });

  it('should match numeric thresholds (greater_than and less_than)', () => {
    expect(evaluateAutomationCondition({ field: 'story_points', operator: 'greater_than', value: 8 }, { story_points: 13 })).toBe(true);
    expect(evaluateAutomationCondition({ field: 'story_points', operator: 'greater_than', value: 8 }, { story_points: 5 })).toBe(false);
    expect(evaluateAutomationCondition({ field: 'story_points', operator: 'less_than', value: 5 }, { story_points: 3 })).toBe(true);
    expect(evaluateAutomationCondition({ field: 'story_points', operator: 'less_than', value: 5 }, { story_points: 8 })).toBe(false);
  });

  it('should match case-insensitive text contains', () => {
    expect(evaluateAutomationCondition({ field: 'title', operator: 'contains', value: 'Bug' }, { title: '[BUG-101] Fix crash' })).toBe(true);
    expect(evaluateAutomationCondition({ field: 'title', operator: 'contains', value: 'frontend' }, { title: 'Backend API migration' })).toBe(false);
  });

  it('should detect empty and not_empty fields', () => {
    expect(evaluateAutomationCondition({ field: 'assignee_id', operator: 'is_empty', value: null }, { assignee_id: null })).toBe(true);
    expect(evaluateAutomationCondition({ field: 'assignee_id', operator: 'is_empty', value: null }, { assignee_id: '' })).toBe(true);
    expect(evaluateAutomationCondition({ field: 'assignee_id', operator: 'is_empty', value: null }, { assignee_id: 'user-123' })).toBe(false);

    expect(evaluateAutomationCondition({ field: 'assignee_id', operator: 'is_not_empty', value: null }, { assignee_id: 'user-123' })).toBe(true);
    expect(evaluateAutomationCondition({ field: 'assignee_id', operator: 'is_not_empty', value: null }, { assignee_id: null })).toBe(false);
  });
});
