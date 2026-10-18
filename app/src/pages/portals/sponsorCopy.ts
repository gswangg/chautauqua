// Shared copy for the organizer's sponsor screens (Portals frame, flow 5):
// Settings · Sponsorships, the sponsor-session queue and its review page.
// Pure helpers over the API shapes in ./types; dates go through lib/dates
// and are read in the event's own timezone.
import { epochDayIndex, formatDateTimeInZone, formatRelativeDays } from '../../lib/dates';
import { countOf } from '../../lib/plural';
import { formatNoun } from '../../../../src/domain/sponsors';
import type { AuditEventRow, MailResult, Slot, SponsorSessionDetail, SponsorSessionSpeaker, SponsorSessionStatus } from './types';

/** "Workshop, 120 min" -- the queue's and the review meta line's slot. */
export function slotWords(s: { format: string; minutes: number | null }): string {
  const noun = formatNoun(s.format, true);
  return s.minutes ? `${noun}, ${s.minutes} min` : noun;
}

/** "submitted 2 days ago" / "resubmitted today". Empty for a session
 * never sent. */
export function submittedPhrase(s: Pick<SponsorSessionDetail, 'submittedAt' | 'submitCount'>, now: number): string {
  if (s.submittedAt === null) return '';
  return `${s.submitCount > 1 ? 'resubmitted' : 'submitted'} ${formatRelativeDays(s.submittedAt, now)}`;
}

/** A resubmission after the organizers asked for changes: the review page
 * pins the last note above the submission. */
export function isResubmission(s: Pick<SponsorSessionDetail, 'status' | 'submitCount' | 'lastNote'>): boolean {
  return s.status === 'submitted' && s.submitCount > 1 && s.lastNote !== null;
}

/** "Priya Raman, Ana Ruiz (new)" */
export function speakerList(speakers: SponsorSessionSpeaker[]): string {
  if (speakers.length === 0) return 'No speakers yet';
  return speakers.map((s) => (s.isNew ? `${s.name} (new)` : s.name)).join(', ');
}

/** "Priya Raman, Sofia Marchetti" */
export function nameList(names: string[]): string {
  return names.join(', ');
}

function zoned(ms: number, timeZone: string): { day: string; month: string; year: string; time: string } {
  // formatDateTimeInZone: "14 Apr 2026, 09:14"
  const [date = '', time = ''] = formatDateTimeInZone(ms, timeZone).split(', ');
  const [day = '', month = '', year = ''] = date.split(' ');
  return { day, month, year, time };
}

/** "14 Apr", with the year only when it isn't this year, in the event's
 * timezone. */
export function zonedDay(ms: number, timeZone: string, now: number): string {
  const d = zoned(ms, timeZone);
  const thisYear = zoned(now, timeZone).year;
  return d.year === thisYear ? `${d.day} ${d.month}` : `${d.day} ${d.month} ${d.year}`;
}

/** The history list's time: "Today, 09:14", "Yesterday, 18:02", else the
 * day alone ("11 Apr"), in the event's timezone. */
export function historyWhen(ms: number, timeZone: string, now: number): string {
  const gap = epochDayIndex(now, timeZone) - epochDayIndex(ms, timeZone);
  const { time } = zoned(ms, timeZone);
  if (gap === 0) return `Today, ${time}`;
  if (gap === 1) return `Yesterday, ${time}`;
  return zonedDay(ms, timeZone, now);
}

/** One audit row as the review page's history reads it: "Resubmitted by
 * Priya Raman". */
export function historyLabel(row: AuditEventRow): string {
  const who = row.actorLabel || 'Someone';
  switch (row.action) {
    case 'sponsor_session.submit':
      return `${row.details.resubmitted === true ? 'Resubmitted' : 'Submitted'} by ${who}`;
    case 'sponsor_session.withdraw':
      return `Withdrawn by ${who}`;
    case 'sponsor_session.request_changes':
      return `Changes requested by ${who}`;
    case 'sponsor_session.approve':
      return `Approved by ${who}`;
    case 'sponsor_session.decline':
      return `Declined by ${who}`;
    default:
      return `Updated by ${who}`;
  }
}

/** The organizer's word for where a slot's session stands. */
export const SLOT_STATUS_WORDS: Record<SponsorSessionStatus, string> = {
  draft: 'In draft',
  submitted: 'Awaiting approval',
  changes_requested: 'Changes requested',
  approved: 'Approved',
  declined: 'Not accepted',
};

/** The right-hand mark on a package slot: an approved session uses it,
 * any other session holding it reserves it, nothing leaves it free. */
export function slotMark(slot: Slot): 'Used' | 'Reserved' | 'Free' {
  if (!slot.session) return 'Free';
  return slot.session.status === 'approved' ? 'Used' : 'Reserved';
}

/** " · 1 email didn't send", or nothing. */
export function mailFailurePhrase(mail: MailResult | undefined): string {
  if (!mail || mail.failed === 0) return '';
  return ` · ${countOf(mail.failed, 'email')} didn't send`;
}
