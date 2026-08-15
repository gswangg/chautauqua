// DEC-023 (wave-61 amendment): the cron reminder gate (isReminderDue) now
// expands a.dueDate — a DAY LABEL (DEC-522), not an instant — through
// dayLabelEndInstant(a.dueDate, timeZone) in the event's own timezone before
// comparing it to the terminal 7-day tail and the 72h due window. Before this
// amendment, both comparisons used the raw UTC-midnight day label directly,
// which for a timezone behind UTC (e.g. America/Los_Angeles) could flag a
// task's reminder window as closed while it was still "today" in the event's
// own zone.
import { describe, expect, it } from "vitest";
import {
  DUE_WINDOW_MS,
  isReminderDue,
  REMINDER_OVERDUE_TAIL_MS,
  type ReminderAssignment,
} from "../src/domain/reminders";
import { dayLabelEndInstant, dayLabelStartInstant } from "../src/lib/timezone";

function assignment(overrides: Partial<ReminderAssignment>): ReminderAssignment {
  return {
    assignmentId: "a1",
    contactId: "c1",
    status: "pending",
    dueDate: null,
    lastRemindedAt: null,
    taskId: "t1",
    taskTitle: "Some task",
    ...overrides,
  };
}

// wave-61 amendment: the widened SQL pre-filter (listDueReminderContactIds,
// repo/tasks/reminders.ts) uses TWO_DAY_MS of slack on each side, not
// ONE_DAY_MS — see that function's doc-comment. Mirrored here so property (3)
// below checks the ACTUAL bound the repo function applies, not a stale copy.
const TWO_DAY_MS = 2 * 24 * 60 * 60 * 1000;

const ZONES = ["America/Los_Angeles", "Asia/Tokyo"] as const;

describe("isReminderDue is zone-expanded (DEC-023 wave-61 amendment)", () => {
  describe("(1) a task due TODAY in the event's zone is not past the 7-day tail at any instant during that local day", () => {
    for (const tz of ZONES) {
      it(`holds for ${tz}`, () => {
        // "Today" — an arbitrary calendar day, expressed as its UTC-midnight
        // day label (DEC-522 convention).
        const dueDate = Date.UTC(2027, 5, 15);
        const localStart = dayLabelStartInstant(dueDate, tz);
        const localEnd = dayLabelEndInstant(dueDate, tz);

        // Sample many instants spanning the event-local calendar day the
        // task is due on, including both endpoints.
        const sampleCount = 25;
        for (let i = 0; i <= sampleCount; i++) {
          const now = localStart + Math.round(((localEnd - localStart) * i) / sampleCount);
          const a = assignment({ dueDate, lastRemindedAt: null });
          // Never blocked by the terminal tail while `now` is still within
          // the due day itself, in the event's own timezone.
          expect(isReminderDue(a, now, null, tz)).toBe(true);
        }
      });
    }
  });

  describe("(2) the 72h window opens/closes at the event-local end of the due day, not at UTC midnight", () => {
    for (const tz of ZONES) {
      it(`fires just inside, and refuses just outside, the zone-expanded window edge for ${tz}`, () => {
        const dueDate = Date.UTC(2027, 5, 15);
        const dueEnd = dayLabelEndInstant(dueDate, tz);

        // The 72h window is `dueEnd <= now + DUE_WINDOW_MS`, i.e. it opens
        // at now = dueEnd - DUE_WINDOW_MS. Just inside (now one ms later)
        // must fire; just outside (now one ms earlier) must not.
        const justInside = dueEnd - DUE_WINDOW_MS;
        const justOutside = dueEnd - DUE_WINDOW_MS - 1;

        const a = assignment({ dueDate, lastRemindedAt: null });
        expect(isReminderDue(a, justInside, null, tz)).toBe(true);
        expect(isReminderDue(a, justOutside, null, tz)).toBe(false);

        // A UTC-midnight-naive reader would instead open the window at
        // dueDate - DUE_WINDOW_MS, which for these zones and this due date
        // differs from dueEnd - DUE_WINDOW_MS (proving the window really is
        // anchored to the zone-expanded day end, not the raw day label).
        expect(dueEnd).not.toBe(dueDate);
      });
    }
  });

  describe("(3) superset property: every accepted (dueDate, now) pair falls inside the widened SQL pre-filter bound", () => {
    for (const tz of ZONES) {
      it(`holds for ${tz} across a dense grid of dueDate/now offsets`, () => {
        const baseDay = Date.UTC(2027, 0, 1);
        let checked = 0;
        for (let dayOffset = 0; dayOffset < 60; dayOffset += 5) {
          const now = baseDay + dayOffset * 86_400_000 + 12_345_000; // not zone/day aligned
          for (let hourOffset = -240; hourOffset <= 96; hourOffset += 6) {
            const rawInstant = now + hourOffset * 60 * 60 * 1000;
            const d = new Date(rawInstant);
            const dueDate = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
            const a = assignment({ dueDate, lastRemindedAt: null });
            const accepted = isReminderDue(a, now, null, tz);
            checked += 1;
            if (!accepted) continue;

            // Mirrors listDueReminderContactIds' widened bound exactly.
            const windowStart = now - REMINDER_OVERDUE_TAIL_MS - TWO_DAY_MS;
            const windowEnd = now + DUE_WINDOW_MS + TWO_DAY_MS;
            expect(dueDate).toBeGreaterThanOrEqual(windowStart);
            expect(dueDate).toBeLessThanOrEqual(windowEnd);
          }
        }
        expect(checked).toBeGreaterThan(0);
      });
    }
  });
});
