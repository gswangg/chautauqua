import { describe, expect, it } from 'vitest';
import {
  buildDeadlineCells,
  buildNoActionRows,
  daysLateLabel,
  formatDeadlineValue,
  headlineCount,
  headlineText,
  joinSegments,
  pluralize,
} from './rows';
import type { OverviewPayload } from './types';

const DAY = 86_400_000;
// DEC-831: `now` sits at the END of "today" (23:59:59.999 UTC) rather than
// exactly at midnight -- daysUntil expands a day-label deadline through
// dayLabelEndInstant, so a `now` pinned to midnight would read one day high
// for every N-days-ahead deadline below (the fix's own w40 finding). Placing
// `now` at today's own day-label end keeps every existing "N days" fixture
// value unchanged while exercising the real (zone-aware) formula.
const NOW = Date.UTC(2027, 0, 1) + DAY - 1;

function payload(overrides: Partial<OverviewPayload> = {}): OverviewPayload {
  return {
    deadlines: {
      formCloseDate: NOW + 6 * DAY,
      nextTaskDueDate: NOW + 2 * DAY,
      planCloseDate: NOW + 19 * DAY,
      planRound: 2,
      eventStartDate: NOW + 94 * DAY,
    },
    overdueTasks: { total: 0, rows: [] },
    triage: { total: 0, oldestSubmittedAt: null, rows: [] },
    contentApproval: { total: 0, reuploadedCount: 0, rows: [] },
    agendaWork: { unplacedTotal: 0, conflictTotal: 0, conflicts: [], unplaced: [] },
    'triage-counts': { pending: 0, accept_queue: 0, decline_queue: 0 },
    review: { plans: 0, evaluationsSubmitted: 0, evaluationsExpected: 0 },
    speakers: { contactsOwing: 0, overdueAssignments: 0 },
    content: { awaitingApproval: 0 },
    agenda: { unplaced: 0, conflicts: 0 },
    comms: { sentLast7Days: 0, lastSentAt: null },
    ...overrides,
  };
}

describe('joinSegments', () => {
  it('joins present segments with a single centered dot', () => {
    expect(joinSegments(['Dana Whitmore', 'Developer Experience', 'DFC-033', 'waiting 6 days'])).toBe(
      'Dana Whitmore · Developer Experience · DFC-033 · waiting 6 days',
    );
  });

  it('drops null and undefined segments without leaving a doubled separator', () => {
    expect(joinSegments(['Dana Whitmore', null, 'DFC-033', undefined])).toBe('Dana Whitmore · DFC-033');
  });

  it('drops blank string segments', () => {
    expect(joinSegments(['Dana Whitmore', '', '  ', 'DFC-033'])).toBe('Dana Whitmore · DFC-033');
  });

  it('never leaves a leading or trailing separator', () => {
    expect(joinSegments([null, 'DFC-033', undefined])).toBe('DFC-033');
  });

  it('renders numbers as segments', () => {
    expect(joinSegments(['30 min', 42])).toBe('30 min · 42');
  });

  it('returns an empty string when every segment is absent', () => {
    expect(joinSegments([null, undefined, ''])).toBe('');
  });
});

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
    expect(formatDeadlineValue(null, NOW, 'UTC')).toBe('—');
  });

  it('renders whole day counts', () => {
    expect(formatDeadlineValue(NOW + 6 * DAY, NOW, 'UTC')).toBe('6 days');
    expect(formatDeadlineValue(NOW + 1 * DAY, NOW, 'UTC')).toBe('1 day');
  });

  it('renders Today for a same-day or past deadline', () => {
    expect(formatDeadlineValue(NOW, NOW, 'UTC')).toBe('Today');
    expect(formatDeadlineValue(NOW - DAY, NOW, 'UTC')).toBe('Today');
  });
});

describe('buildDeadlineCells', () => {
  it('keeps the fixed reading order (CFP close, next task due, Review wave, Doors open) and marks only the nearest', () => {
    const cells = buildDeadlineCells(payload().deadlines, NOW, 'UTC');
    expect(cells.map((c) => c.key)).toEqual(['formCloseDate', 'nextTaskDueDate', 'planCloseDate', 'eventStartDate']);
    expect(cells.find((c) => c.key === 'nextTaskDueDate')!.isNearest).toBe(true);
    expect(cells.filter((c) => c.key !== 'nextTaskDueDate').every((c) => c.isNearest === false)).toBe(true);
  });

  it('carries the round number onto the Review wave label', () => {
    const cells = buildDeadlineCells(payload().deadlines, NOW, 'UTC');
    expect(cells.find((c) => c.key === 'planCloseDate')!.label).toBe('Review wave 2');
  });

  it('falls back to the bare Review wave label when no round is attributed', () => {
    const cells = buildDeadlineCells(
      { formCloseDate: null, nextTaskDueDate: null, planCloseDate: NOW + 5 * DAY, planRound: null, eventStartDate: null },
      NOW,
      'UTC',
    );
    expect(cells.find((c) => c.key === 'planCloseDate')!.label).toBe('Review wave');
  });

  it('keeps the fixed order and marks the nearest even when nulls are interleaved', () => {
    const cells = buildDeadlineCells(
      { formCloseDate: null, nextTaskDueDate: NOW + 3 * DAY, planCloseDate: null, planRound: null, eventStartDate: null },
      NOW,
      'UTC',
    );
    expect(cells.map((c) => c.key)).toEqual(['formCloseDate', 'nextTaskDueDate', 'planCloseDate', 'eventStartDate']);
    expect(cells.find((c) => c.key === 'nextTaskDueDate')!.isNearest).toBe(true);
    expect(cells.filter((c) => c.key !== 'nextTaskDueDate').every((c) => c.value === null && c.isNearest === false)).toBe(true);
  });

  it('marks no cell nearest when every deadline is unset', () => {
    const cells = buildDeadlineCells(
      { formCloseDate: null, nextTaskDueDate: null, planCloseDate: null, planRound: null, eventStartDate: null },
      NOW,
      'UTC',
    );
    expect(cells.every((c) => c.isNearest === false)).toBe(true);
  });

  // DEC-611 amendment (wave 2): nearest-deadline emphasis is a SET — a tie
  // marks every cell sharing the minimum value, never an arbitrary
  // first-wins pick.
  it('marks every tied cell nearest when two deadlines share the same soonest value', () => {
    const cells = buildDeadlineCells(
      { formCloseDate: NOW + 2 * DAY, nextTaskDueDate: NOW + 2 * DAY, planCloseDate: NOW + 9 * DAY, planRound: null, eventStartDate: null },
      NOW,
      'UTC',
    );
    expect(cells.find((c) => c.key === 'formCloseDate')!.isNearest).toBe(true);
    expect(cells.find((c) => c.key === 'nextTaskDueDate')!.isNearest).toBe(true);
    expect(cells.find((c) => c.key === 'planCloseDate')!.isNearest).toBe(false);
    expect(cells.find((c) => c.key === 'eventStartDate')!.isNearest).toBe(false);
  });
});

describe('buildNoActionRows', () => {
  // DEC-589: the Review row must name its own denominator — evaluations
  // submitted out of evaluations EXPECTED (every assigned evaluation row),
  // never out of the unrelated plan count ("40 of 3 evaluation plans in").
  it('derives Review and Comms rows from the retained aggregates', () => {
    const p = payload({
      review: { plans: 3, evaluationsSubmitted: 1, evaluationsExpected: 12 },
      comms: { sentLast7Days: 4, lastSentAt: NOW - 2 * DAY },
    });
    const rows = buildNoActionRows(p, NOW);
    expect(rows.map((r) => r.key)).toEqual(['review', 'comms']);
    expect(rows[0]!.detail).toBe('1 of 12 evaluations in.');
    expect(rows[1]!.detail).toBe('4 sent in 7 days · last 2 days ago.');
    // A numerator taken outside its own denominator can exceed it -- assert
    // the rendered pair never violates submitted <= expected.
    expect(p.review.evaluationsSubmitted).toBeLessThanOrEqual(p.review.evaluationsExpected);
  });

  it('reads the zero-plans state plainly', () => {
    const rows = buildNoActionRows(payload(), NOW);
    expect(rows[0]!.detail).toBe('No evaluation plans set up yet.');
    expect(rows[1]!.detail).toBe('No messages sent in the last 7 days.');
  });

  it('reads a distinct zero-expected state when plans exist but nothing is assigned', () => {
    const p = payload({ review: { plans: 2, evaluationsSubmitted: 0, evaluationsExpected: 0 } });
    const rows = buildNoActionRows(p, NOW);
    expect(rows[0]!.detail).toBe('No evaluations assigned yet.');
  });

  it('handles the boundary where every expected evaluation has been submitted', () => {
    const p = payload({ review: { plans: 1, evaluationsSubmitted: 5, evaluationsExpected: 5 } });
    const rows = buildNoActionRows(p, NOW);
    expect(rows[0]!.detail).toBe('5 of 5 evaluations in.');
    expect(p.review.evaluationsSubmitted).toBeLessThanOrEqual(p.review.evaluationsExpected);
  });
});
