// DEC-664: One reporter for every send. Every send-like endpoint (reviewer
// reminders, onboarding-task reminders) returns a variant of this envelope,
// and every call site renders it through describeSendResult rather than
// hand-building a message from a subset of the fields — a message that
// reads only `sent` can render "sent to 0" after every recipient failed.
import { plural } from './plural';

export interface SendResult {
  sent: number;
  failed?: { email: string; message: string }[];
  skipped?: number;
  remaining?: number;
}

/** Renders a SendResult into one sentence that always states how many were
 * actually sent, and calls out failures/skips/remaining whenever present —
 * never restating the pre-send intent count (the caller's "N selected"). */
export function describeSendResult(result: SendResult, noun: { one: string; many: string }): string {
  const failedCount = result.failed?.length ?? 0;
  const skipped = result.skipped ?? 0;
  const remaining = result.remaining ?? 0;

  const parts: string[] = [];

  if (result.sent > 0) {
    parts.push(`Sent to ${result.sent} ${plural(result.sent, noun.one, noun.many)}.`);
  } else if (failedCount === 0 && skipped === 0 && remaining === 0) {
    parts.push('Nothing was outstanding.');
  } else {
    parts.push('Nothing was sent.');
  }

  if (failedCount > 0) {
    parts.push(`${failedCount} ${plural(failedCount, 'failure', 'failures')}.`);
  }

  if (skipped > 0) {
    parts.push(`${skipped} skipped.`);
  }

  if (remaining > 0) {
    parts.push(`${remaining} still outstanding — run it again to continue.`);
  }

  return parts.join(' ');
}

/** DEC-664 (wave 59 amendment): the ONE send-failure reporter for toast/
 * inline-string contexts that can't render <SendFailures> (see
 * ../components/SendFailures.tsx for the list-of-rows equivalent). Joins
 * each failure's server-computed reason -- never the bare address -- so a
 * single-recipient failure reads "Ada Lovelace has no email address on
 * file" rather than a restated count. Returns '' when there is nothing to
 * report, so callers can append it unconditionally. */
export function failureLines(result: SendResult): string {
  const failed = result.failed ?? [];
  if (failed.length === 0) return '';
  return failed.map((f) => f.message).join('; ');
}
