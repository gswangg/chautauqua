import { describe, expect, it } from "vitest";
import { isFormClosed } from "../src/lib/submit-core";

// Regression guard for the class of defect fixed in wave 49
// (test/spec9-invariants.test.ts): a form's closeDate is a DAY LABEL (UTC
// midnight of the intended calendar day, DEC-522), not an instant — asserting
// isFormClosed with a wall-clock-derived `now` (e.g. `Date.now() - 24h`)
// instead of a frozen day-label pair makes the assertion flip depending on
// the hour the suite runs. This table pins a fixed close day label
// (2027-01-01, America/Los_Angeles) and walks `now` across all 24 UTC hours
// of the FOLLOWING day (2027-01-02), asserting isFormClosed flips from false
// to true at exactly the local end-of-day instant (2027-01-02T08:00:00Z —
// midnight Jan 2 America/Los_Angeles, UTC-8 in January, no DST).
const LA = "America/Los_Angeles";
const CLOSE_JAN_1_2027 = Date.UTC(2027, 0, 1); // day label

describe("isFormClosed hour-by-hour boundary (DEC-522)", () => {
  // Jan 1 23:59:59.999 PST (UTC-8, no DST in January) == Jan 2 07:59:59.999
  // UTC -- the last instant that is still "Jan 1" wall-clock in
  // America/Los_Angeles. isFormClosed is strictly-greater-than, so the form
  // is still open AT this instant and closed one ms later.
  const LOCAL_END_OF_DAY_UTC_MS = Date.UTC(2027, 0, 2, 7, 59, 59, 999);

  for (let h = 0; h < 24; h++) {
    const now = Date.UTC(2027, 0, 2, h, 0, 0);
    const expectedClosed = now > LOCAL_END_OF_DAY_UTC_MS;
    it(`Date.UTC(2027,0,2,${h}) is ${expectedClosed ? "closed" : "still open"}`, () => {
      expect(isFormClosed(CLOSE_JAN_1_2027, now, LA)).toBe(expectedClosed);
    });
  }

  it("flips exactly at the local end-of-day instant, not one ms before", () => {
    expect(isFormClosed(CLOSE_JAN_1_2027, LOCAL_END_OF_DAY_UTC_MS, LA)).toBe(false);
    expect(isFormClosed(CLOSE_JAN_1_2027, LOCAL_END_OF_DAY_UTC_MS + 1, LA)).toBe(true);
  });
});
