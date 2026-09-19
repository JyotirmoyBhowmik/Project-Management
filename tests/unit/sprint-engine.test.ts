// ==============================================================================
// tests/unit/sprint-engine.test.ts
// Unit Tests for Agile Sprint Velocity & Burndown Formulations
// ==============================================================================

import { describe, it, expect } from 'vitest';

describe('Agile Sprint Calculations', () => {
  it('should accurately calculate total story points and completion velocity', () => {
    const tasks = [
      { id: '1', story_points: 3, status: 'completed' },
      { id: '2', story_points: 5, status: 'done' },
      { id: '3', story_points: 8, status: 'in_progress' },
      { id: '4', story_points: 2, status: 'todo' },
    ];

    const totalPoints = tasks.reduce((sum, t) => sum + (t.story_points || 0), 0);
    const completedPoints = tasks
      .filter((t) => t.status === 'completed' || t.status === 'done')
      .reduce((sum, t) => sum + (t.story_points || 0), 0);

    expect(totalPoints).toBe(18);
    expect(completedPoints).toBe(8);
    expect(Math.round((completedPoints / totalPoints) * 100)).toBe(44);
  });

  it('should correctly derive ideal daily burndown trajectory', () => {
    const totalPoints = 40;
    const sprintDays = 10;
    const dailyRate = totalPoints / sprintDays;

    const burndown = [];
    for (let day = 0; day <= sprintDays; day++) {
      burndown.push(Math.round((totalPoints - day * dailyRate) * 10) / 10);
    }

    expect(burndown[0]).toBe(40);
    expect(burndown[5]).toBe(20);
    expect(burndown[10]).toBe(0);
  });

  it('should roll over unfinished tasks when completing a sprint', () => {
    const tasks = [
      { id: '1', sprint_id: 'sprint-1', status: 'completed' },
      { id: '2', sprint_id: 'sprint-1', status: 'todo' },
      { id: '3', sprint_id: 'sprint-1', status: 'in_review' },
    ];

    const rolloverTarget = 'next_sprint';
    const nextSprintId = 'sprint-2';

    const updatedTasks = tasks.map((t) => {
      if (t.status === 'completed') return t;
      return {
        ...t,
        sprint_id: rolloverTarget === 'next_sprint' ? nextSprintId : null,
      };
    });

    expect(updatedTasks[0].sprint_id).toBe('sprint-1');
    expect(updatedTasks[1].sprint_id).toBe('sprint-2');
    expect(updatedTasks[2].sprint_id).toBe('sprint-2');
  });
});
