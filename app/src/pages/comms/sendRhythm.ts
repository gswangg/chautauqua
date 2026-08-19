import { formatDate, formatDateTimeWeekday } from '../../lib/dates';

// DEC-905 (wave-59 amendment): the send rhythm sentence -- "N sent in the
// last 7 days · M failed · last <date>" -- has exactly ONE producer.
// Comms.tsx computes the figures (two dedicated `?since=&status=…&perPage=1`
// requests read off `res.total`, never a sum over a page of batches) and
// this pure formatter turns them into the sentence; both Comms.tsx's head
// and RecentSends' section head call it with the SAME numbers, so the two
// cannot diverge in wording even by a comma.
export interface SendRhythm {
  sentLast7Days: number;
  failedLast7Days: number;
  /** The most recent send's timestamp, or null when nothing has been sent. */
  lastSentAt: number | null;
}

export function formatSendRhythm(rhythm: SendRhythm): string {
  const { sentLast7Days, failedLast7Days, lastSentAt } = rhythm;
  const failedSuffix = failedLast7Days > 0 ? ` · ${failedLast7Days} failed` : '';
  const lastSuffix = lastSentAt !== null ? ` · last ${formatDate(lastSentAt)}` : '';
  return `${sentLast7Days} sent in the last 7 days${failedSuffix}${lastSuffix}`;
}

// v12 mobile campaign w1 (DEC-621 amendment; planner's ruling): the phone
// landing's send-rhythm line follows the frame's own shorter grammar --
// frame docs/design/Chautauqua Comms.dc.html:184: `4 sent in 7 days · last
// Tue 4:12pm` -- dropping desktop's "the last" wording and its
// failed-count clause, neither of which the frame's phone line carries.
// Built from the SAME rhythm figures formatSendRhythm above formats for
// desktop (never re-derived), so the two sentences can't disagree on the
// numbers, only the wording. `lastSentAt` renders through
// formatDateTimeWeekday (lib/dates.ts, "Tue 11 Aug, 4:12pm") rather than a
// hand-rolled "Tue 4:12pm" -- this task's file scope excludes lib/dates.ts,
// so the day+month formatDateTimeWeekday already prints ride along in the
// output too; recorded as a fidelity gap in docs/design/audit/comms-v12.md.
export function formatPhoneSendRhythm(rhythm: SendRhythm): string {
  const { sentLast7Days, lastSentAt } = rhythm;
  const lastSuffix = lastSentAt !== null ? ` · last ${formatDateTimeWeekday(lastSentAt)}` : '';
  return `${sentLast7Days} sent in 7 days${lastSuffix}`;
}
