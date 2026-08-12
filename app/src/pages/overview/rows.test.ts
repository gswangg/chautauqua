import { describe, expect, it } from 'vitest';
import {
  buildDeadlineCells,
  buildNoActionRows,
  daysLateLabel,
  formatDeadlineValue,
  headlineCount,
  headlineText,
  pluralize,
} from './rows';
import type { OverviewPayload } from './types';

const NOW = Date.UTC(2027, 0, 1);
const DAY = 86_400_000;

function payload(overrides: Partial<OverviewPayload> = {}): OverviewPayload {
  return {
    deadlines: {
      formCloseDate: NOW + 6 * DAY,
      nextTaskDueDate: NOW + 2 * DAY,
      planCloseDate: NOW + 19 * DAY,
      eventStartDate: NOW + 94 * DAY,
    },
    overdueTasks: { total: 0, rows: [] },
    triage: { total: 0, oldestSubmittedAt: null, rows: [] },
    contentApproval: { total: 0, reuploadedCount: 0, rows: [] },
    agendaWork: { unplacedTotal: 0, conflictTotal: 0, conflicts: [], unplaced: [] },
    'triage-counts': { pending: 0, accept_queue: 0, decline_queue: 0 },
    review: { plans: 0, evaluationsSubmitted: 0 },
    speakers: { contactsOwing: 0, overdueAssignments: 0 },
    content: { awaitingApproval: 0 },
    agenda: { unplaced: 0, conflicts: 0 },
    comms: { sentLast7Days: 0, lastSentAt: null },
    ...overrides,
  };
}

describe('pluralize', () => {
  it('singular for 1, plural otherwise', () => {
    expect(pluralize(1, 'thing')).toBe('thing');
    expect(pluralize(0, 'thing')).toBe('things');
    expect(pluralize(4, 'thing')).toBe('things');
  });
});

describe('daysLateLabel', () => {
  it('formats singular and plural day counts', () => {
    expect(daysLateLabel(1)).toBe('1 day late');
    expect(daysLateLabel(4)).toBe('4 days late');
  });

  it('handles zero as due today', () => {
    expect(daysLateLabel(0)).toBe('Due today');
  });

  it('throws loudly on a negative daysLate', () => {
    expect(() => daysLateLabel(-1)).toThrow();
  });
});

describe('headlineCount / headlineText', () => {
  it('sums every actionable row across the four sections', () => {
    const p = payload({
      overdueTasks: { total: 3, rows: [] },
      triage: { total: 2, oldestSubmittedAt: null, rows: [] },
      contentApproval: { total: 1, reuploadedCount: 0, rows: [] },
      agendaWork: { unplacedTotal: 1, conflictTotal: 1, conflicts: [], unplaced: [] },
    });
    expect(headlineCount(p)).toBe(8);
    expect(headlineText(p)).toBe('8 things need your attention');
  });

  it('uses singular phrasing for exactly one thing', () => {
    const p = payload({ overdueTasks: { total: 1, rows: [] } });
    expect(headlineText(p)).toBe('1 thing needs your attention');
  });

  it('reads zero things when nothing needs attention', () => {
    expect(headlineText(payload())).toBe('0 things need your attention');
  });
});

describe('formatDeadlineValue', () => {
  it('renders an em dash for no deadline', () => {
    expect(formatDeadlineValue(null, NOW)).toBe('—');
  });

  it('renders whole day counts', () => {
    expect(formatDeadlineValue(NOW + 6 * DAY, NOW)).toBe('6 days');
    expect(formatDeadlineValue(NOW + 1 * DAY, NOW)).toBe('1 day');
  });

  it('renders Today for a same-day or past deadline', () => {
    expect(formatDeadlineValue(NOW, NOW)).toBe('Today');
    expect(formatDeadlineValue(NOW - DAY, NOW)).toBe('Today');
  });
});

describe('buildDeadlineCells', () => {
  it('orders nearest-first and marks the first cell as nearest', () => {
    const cells = buildDeadlineCells(payload().deadlines, NOW);
    expect(cells.map((c) => c.key)).toEqual(['nextTaskDueDate', 'formCloseDate', 'planCloseDate', 'eventStartDate']);
    expect(cells[0]!.isNearest).toBe(true);
    expect(cells.slice(1).every((c) => c.isNearest === false)).toBe(true);
  });

  it('sorts null deadlines to the end and does not mark them nearest', () => {
    const cells = buildDeadlineCells(
      { formCloseDate: null, nextTaskDueDate: NOW + 3 * DAY, planCloseDate: null, eventStartDate: null },
      NOW,
    );
    expect(cells[0]!.key).toBe('nextTaskDueDate');
    expect(cells[0]!.isNearest).toBe(true);
    expect(cells.slice(1).every((c) => c.value === null && c.isNearest === false)).toBe(true);
  });

  it('marks no cell nearest when every deadline is unset', () => {
    const cells = buildDeadlineCells(
      { formCloseDate: null, nextTaskDueDate: null, planCloseDate: null, eventStartDate: null },
      NOW,
    );
    expect(cells.every((c) => c.isNearest === false)).toBe(true);
  });
});

describe('buildNoActionRows', () => {
  it('derives Review and Comms rows from the retained aggregates', () => {
    const p = payload({
      review: { plans: 3, evaluationsSubmitted: 1 },
      comms: { sentLast7Days: 4, lastSentAt: NOW - 2 * DAY },
    });
    const rows = buildNoActionRows(p, NOW);
    expect(rows.map((r) => r.key)).toEqual(['review', 'comms']);
    expect(rows[0]!.detail).toBe('1 of 3 evaluation plans in.');
    expect(rows[1]!.detail).toBe('4 sent in 7 days · last 2 days ago.');
  });

  it('reads zero states plainly', () => {
    const rows = buildNoActionRows(payload(), NOW);
    expect(rows[0]!.detail).toBe('No evaluation plans set up yet.');
    expect(rows[1]!.detail).toBe('No messages sent in the last 7 days.');
  });
});
