import { formatDate } from '../../lib/dates';

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
