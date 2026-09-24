// ==============================================================================
// src/lib/automations/condition-evaluator.ts
// Pure Condition Evaluator for No-Code Workflow Automations Engine
// ==============================================================================

export interface AutomationCondition {
  field: string;
  operator: 'equals' | 'not_equals' | 'greater_than' | 'less_than' | 'contains' | 'is_empty' | 'is_not_empty' | string;
  value: any;
}

/**
 * Pure evaluation function for automation trigger condition criteria.
 */
export function evaluateAutomationCondition(
  cond: AutomationCondition,
  payload: Record<string, any>
): boolean {
  const actualVal = payload[cond.field];
  switch (cond.operator) {
    case 'equals':
      return actualVal === cond.value;
    case 'not_equals':
      return actualVal !== cond.value;
    case 'greater_than':
      return Number(actualVal) > Number(cond.value);
    case 'less_than':
      return Number(actualVal) < Number(cond.value);
    case 'contains':
      return String(actualVal || '').toLowerCase().includes(String(cond.value || '').toLowerCase());
    case 'is_empty':
      return actualVal === null || actualVal === undefined || actualVal === '';
    case 'is_not_empty':
      return actualVal !== null && actualVal !== undefined && actualVal !== '';
    default:
      return actualVal === cond.value;
  }
}
