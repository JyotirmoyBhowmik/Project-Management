// ==============================================================================
// tests/unit/evm-engine.test.ts
// Unit Tests for Financial EVM (Earned Value Management) Formulations
// ==============================================================================

import { describe, it, expect } from 'vitest';
import { EVMMetrics } from '@/types/database';

describe('Earned Value Management (EVM) Formulations', () => {
  it('should correctly calculate Cost Variance (CV) and Schedule Variance (SV)', () => {
    const plannedValue = 50000; // PV
    const earnedValue = 42000;   // EV
    const actualCost = 45000;    // AC

    const cv = earnedValue - actualCost;
    const sv = earnedValue - plannedValue;

    expect(cv).toBe(-3000); // Over budget
    expect(sv).toBe(-8000); // Behind schedule
  });

  it('should correctly calculate Cost Performance Index (CPI) and Schedule Performance Index (SPI)', () => {
    const plannedValue = 50000;
    const earnedValue = 45000;
    const actualCost = 40000;

    const cpi = Math.round((earnedValue / actualCost) * 100) / 100;
    const spi = Math.round((earnedValue / plannedValue) * 100) / 100;

    expect(cpi).toBe(1.13); // Favorable cost efficiency (> 1.0)
    expect(spi).toBe(0.9);   // Behind schedule (< 1.0)
  });

  it('should correctly project Estimate at Completion (EAC) and Variance at Completion (VAC)', () => {
    const budgetAtCompletion = 100000; // BAC
    const cpi = 0.8; // Cost overrun factor

    const eac = Math.round(budgetAtCompletion / cpi);
    const vac = budgetAtCompletion - eac;

    expect(eac).toBe(125000);
    expect(vac).toBe(-25000);
  });

  it('should handle zero actual cost gracefully without division by zero', () => {
    const earnedValue = 10000;
    const actualCost = 0;

    const cpi = actualCost > 0 ? earnedValue / actualCost : 1.0;
    expect(cpi).toBe(1.0);
  });
});
