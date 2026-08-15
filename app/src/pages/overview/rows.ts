// DEC-370: pure helpers for the Overview worklist page. Kept dependency-free
// (no React, no fetch) so the headline count, deadline ordering, "days late"
// label and the "No action needed" derivation are unit-testable without
// rendering the page. Overview.tsx is the sole consumer.

import type { OverviewPayload } from './types';
import { daysUntil, daysAgo } from '../../lib/dates';
import { spellCount, plural, countOf } from '../../lib/plural';

// DEC-779: every dot-joined caption on the Overview page (triage row,
// content-approval row, §04 unplaced/conflict captions, the "no action
// needed" rows) goes through this ONE join so a missing/blank segment
// (a null trackName, a null durationMin, an absent round) is dropped
// cleanly rather than leaving a leading, trailing or doubled ' · '.
export function joinSegments(parts: Array<string | number | null | undefined>): string {
  return parts
    .map((part) => (part === null || part === undefined ? '' : String(part).trim()))
    .filter((part) => part.length > 0)
    .join(' · ');
}

/** Section 01 row caption, e.g. "4 days late" / "1 day late". Fails loudly
 * on a negative input — a row that isn't actually late should never reach
 * this helper. */
export function daysLateLabel(daysLate: number): string {
  if (daysLate < 0) {
    throw new Error(`daysLateLabel: expected a non-negative daysLate, got ${daysLate}`);
  }
  if (daysLate === 0) return 'Due today';
  return `${countOf(daysLate, 'day')} late`;
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

/** Capitalizes the first letter of a word — no second word list, just a
 * sentence-case transform for spellCount's output. */
export function capitalizeFirst(word: string): string {
  if (word.length === 0) return word;
  return word[0]!.toUpperCase() + word.slice(1);
}

export function headlineText(payload: OverviewPayload): string {
  const count = headlineCount(payload);
  const verb = plural(count, 'needs', 'need');
  // DEC-370 amendment (wave 51): the headline spells counts 1-10 out
  // ("One thing…", "Four things…"), sentence-capitalized, matching the
  // frame's copy voice — the fresh-event 0 case is owned by a different
  // screen block and stays a bare numeral; counts above ten keep the
  // numeral too (spellCount's own documented fallback).
  const countText = count === 0 ? String(count) : capitalizeFirst(spellCount(count));
  return `${countText} ${plural(count, 'thing')} ${verb} your attention`;
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
 * "Today" — or an em dash when no date is set. DEC-831: the day count comes
 * from the ONE days-until reader (dates.ts daysUntil), expanded through the
 * owning event's own timezone rather than a raw-ms subtraction. */
export function formatDeadlineValue(value: number | null, now: number, timezone: string): string {
  if (value === null) return '—';
  const diffDays = daysUntil(value, timezone, now);
  if (diffDays <= 0) return 'Today';
  return countOf(diffDays, 'day');
}

/** Builds the four deadline cells in a FIXED order (CFP close, next task
 * due, Review wave, Doors open) — the strip is a stable reading order, not
 * a ranking, so it never reshuffles as dates change. Only the cell with the
 * nearest (soonest, non-null) value is marked with the "nearest" weight.
 * Pure — Overview.tsx owns the DOM. */
export function buildDeadlineCells(
  deadlines: OverviewPayload['deadlines'],
  now: number,
  timezone: string,
): DeadlineCell[] {
  const keys = Object.keys(DEADLINE_META) as DeadlineCell['key'][];
  const cells = keys.map((key) => {
    const value = deadlines[key];
    const meta = DEADLINE_META[key];
    // DEC-704: "Review wave" carries its round number when the server
    // attributed one to the soonest plan close date; falls back to the
    // bare label otherwise (no plan, or a plan without a round).
    const label = key === 'planCloseDate' && deadlines.planRound !== null ? `${meta.label} ${deadlines.planRound}` : meta.label;
    return {
      key,
      label,
      href: meta.href,
      value,
      display: formatDeadlineValue(value, now, timezone),
      isNearest: false,
    };
  });

  // DEC-611 amendment (wave 2): the nearest-deadline emphasis is a SET, not
  // an arbitrary first-wins pick — on a tie every cell sharing the minimum
  // non-null value is marked isNearest.
  //
  // DEC-370 amendment (wave 5): the tie is measured on the DISPLAYED value,
  // not the raw ms — formatDeadlineValue collapses every value <= 0 days
  // away into the same "Today" text, so two cells with different raw
  // timestamps but the same displayed word must bold together or not at
  // all (never one of two identical-looking cells).
  let nearestValue: number | null = null;
  for (const cell of cells) {
    if (cell.value === null) continue;
    if (nearestValue === null || cell.value < nearestValue) {
      nearestValue = cell.value;
    }
  }
  if (nearestValue !== null) {
    const nearestDisplay = formatDeadlineValue(nearestValue, now, timezone);
    for (let i = 0; i < cells.length; i++) {
      if (cells[i]!.value !== null && cells[i]!.display === nearestDisplay) {
        cells[i] = { ...cells[i]!, isNearest: true };
      }
    }
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
  //
  // DEC-779: the mock's Review row (Chautauqua Overview.dc.html) appends a
  // "wave N complete" clause, but ReviewAggregate carries no round or
  // completion field — inventing one here would be a caption asserting
  // data the payload never named. The evaluation count is the only
  // segment this row actually has, so joinSegments is a single-element
  // no-op today; it exists so a future round/completion field composes
  // without hand-rebuilding the ' · ' plumbing.
  rows.push({
    key: 'review',
    title: 'Review',
    detail:
      payload.review.plans === 0
        ? 'No evaluation plans set up yet.'
        : payload.review.evaluationsExpected === 0
          ? 'No evaluations assigned yet.'
          : joinSegments([`${payload.review.evaluationsSubmitted} of ${countOf(payload.review.evaluationsExpected, 'evaluation')} in`]),
  });

  const daysSinceSend = payload.comms.lastSentAt !== null ? daysAgo(payload.comms.lastSentAt, now) : null;
  rows.push({
    key: 'comms',
    title: 'Comms',
    detail:
      payload.comms.sentLast7Days > 0
        ? joinSegments([
            `${payload.comms.sentLast7Days} sent in 7 days`,
            daysSinceSend !== null ? `last ${daysSinceSend === 0 ? 'today' : `${countOf(daysSinceSend, 'day')} ago`}` : null,
          ])
        : 'No messages sent in the last 7 days.',
  });

  return rows;
}
