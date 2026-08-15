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
