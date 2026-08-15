// Evaluation domain core (SPEC J4), pure module (DEC-002): no node:/cloudflare/
// drizzle imports, plain interfaces only — testable under plain vitest.
//
// Split out of the former monolithic src/domain/evaluation.ts (contention
// decomposition, no behavior change) -- see src/domain/evaluation.ts for
// the re-export barrel.

// DEC-522: openDate/closeDate are day labels (UTC midnight of the intended
// calendar day), not instants -- expand through the owning event's timezone
// at this hard gate, same class of fix as the CFP open/close window.
import { dayLabelStartInstant, dayLabelEndInstant } from "../../lib/timezone";

/**
 * True when `now` falls within the plan's open/close window (DEC-018 queue
 * gating). A null openDate/closeDate means unbounded on that side.
 *
 * DEC-522: openDate/closeDate are day labels (UTC midnight of the intended
 * calendar day), not instants -- a present openDate is expanded through
 * dayLabelStartInstant (start of that day in `timeZone`) and a present
 * closeDate through dayLabelEndInstant (end of that day in `timeZone`), so a
 * plan set to close 2027-03-01 for a Pacific-timezone event stays open
 * through end-of-day Pacific on 2027-03-01, not UTC midnight.
 */
export function isPlanOpen(
  openDate: number | null | undefined,
  closeDate: number | null | undefined,
  now: number,
  timeZone: string,
): boolean {
  if (!timeZone) throw new Error("isPlanOpen requires a non-empty timeZone");
  if (openDate !== null && openDate !== undefined && now < dayLabelStartInstant(openDate, timeZone)) return false;
  if (closeDate !== null && closeDate !== undefined && now > dayLabelEndInstant(closeDate, timeZone)) return false;
  return true;
}
