// DEC-370: pure helpers for the Overview worklist page. Kept dependency-free
// (no React, no fetch) so the headline count, deadline ordering, "days late"
// label and the "No action needed" derivation are unit-testable without
// rendering the page. Overview.tsx is the sole consumer.

import type { OverviewPayload } from './types';

/** "1 thing" / "4 things" — used by the headline and section captions. */
export function pluralize(count: number, singular: string, plural: string = `${singular}s`): string {
  return count === 1 ? singular : plural;
}

/** Section 01 row caption, e.g. "4 days late" / "1 day late". Fails loudly
 * on a negative input — a row that isn't actually late should never reach
 * this helper. */
export function daysLateLabel(daysLate: number): string {
  if (daysLate < 0) {
    throw new Error(`daysLateLabel: expected a non-negative daysLate, got ${daysLate}`);
  }
  if (daysLate === 0) return 'Due today';
  return `${daysLate} ${pluralize(daysLate, 'day')} late`;
}

/** The h1: "N things need your attention" — no subtext, no time estimate
 * (DEC-370). Count = every row that carries an inline action across the
 * four actionable sections. */
export function headlineCount(payload: OverviewPayload): number {
  return (
    payload.overdueTasks.total +
    payload.triage.total +
    payload.contentApproval.total +
    payload.agendaWork.unplacedTotal +
    payload.agendaWork.conflictTotal
  );
}

export function headlineText(payload: OverviewPayload): string {
  const count = headlineCount(payload);
  return `${count} ${pluralize(count, 'thing')} need${count === 1 ? 's' : ''} your attention`;
}

export interface DeadlineCell {
  key: 'formCloseDate' | 'nextTaskDueDate' | 'planCloseDate' | 'eventStartDate';
  label: string;
  value: number | null;
  display: string;
  href: string;
  isNearest: boolean;
}

const DEADLINE_META: Record<DeadlineCell['key'], { label: string; href: string }> = {
  formCloseDate: { label: 'CFP closes', href: '/submissions/forms' },
  nextTaskDueDate: { label: 'Tasks due', href: '/speakers' },
  planCloseDate: { label: 'Review wave', href: '/review' },
  eventStartDate: { label: 'Doors open', href: '/agenda' },
};

/** Formats a deadline value relative to `now` — "6 days" / "1 day" /
 * "Today" — or an em dash when no date is set. */
export function formatDeadlineValue(value: number | null, now: number): string {
  if (value === null) return '—';
  const diffDays = Math.round((value - now) / 86_400_000);
  if (diffDays <= 0) return 'Today';
  return `${diffDays} ${pluralize(diffDays, 'day')}`;
}

/** Orders the four deadline cells nearest-first (nulls sort last), so the
 * soonest deadline always lands in the first, border-less cell and is
 * rendered with the "nearest" weight. Pure — Overview.tsx owns the DOM. */
export function buildDeadlineCells(deadlines: OverviewPayload['deadlines'], now: number): DeadlineCell[] {
  const keys = Object.keys(DEADLINE_META) as DeadlineCell['key'][];
  const cells = keys.map((key) => {
    const value = deadlines[key];
    const meta = DEADLINE_META[key];
    return {
      key,
      label: meta.label,
      href: meta.href,
      value,
      display: formatDeadlineValue(value, now),
      isNearest: false,
    };
  });

  cells.sort((a, b) => {
    if (a.value === null && b.value === null) return 0;
    if (a.value === null) return 1;
    if (b.value === null) return -1;
    return a.value - b.value;
  });

  const nearest = cells[0];
  if (nearest !== undefined && nearest.value !== null) {
    cells[0] = { ...nearest, isNearest: true };
  }

  return cells;
}

export interface NoActionRow {
  key: 'review' | 'comms';
  title: string;
  detail: string;
}

/** "No action needed" is derived client-side from the retained v1
 * aggregates (DEC-370) — never asserted by the server, and never rendering
 * the sections that already have dedicated actionable rows above it. */
export function buildNoActionRows(payload: OverviewPayload, now: number): NoActionRow[] {
  const rows: NoActionRow[] = [];

  // DEC-589: the numerator (evaluations submitted) and denominator
  // (evaluations expected — every evaluator×plan assignment row, submitted
  // or not) must be counted over the SAME set, never plans-vs-evaluations.
  // A numerator taken outside its own denominator can exceed it.
  rows.push({
    key: 'review',
    title: 'Review',
    detail:
      payload.review.plans === 0
        ? 'No evaluation plans set up yet.'
        : payload.review.evaluationsExpected === 0
          ? 'No evaluations assigned yet.'
          : `${payload.review.evaluationsSubmitted} of ${payload.review.evaluationsExpected} ${pluralize(payload.review.evaluationsExpected, 'evaluation')} in.`,
  });

  const daysSinceSend =
    payload.comms.lastSentAt !== null ? Math.max(0, Math.round((now - payload.comms.lastSentAt) / 86_400_000)) : null;
  rows.push({
    key: 'comms',
    title: 'Comms',
    detail:
      payload.comms.sentLast7Days > 0
        ? `${payload.comms.sentLast7Days} sent in 7 days${daysSinceSend !== null ? ` · last ${daysSinceSend === 0 ? 'today' : `${daysSinceSend} ${pluralize(daysSinceSend, 'day')} ago`}` : ''}.`
        : 'No messages sent in the last 7 days.',
  });

  return rows;
}
