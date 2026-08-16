// DEC-522 (wave-52 amendment): a day label is minted at UTC midnight, never
// measured from a sub-day clock. Unit coverage for the isDayLabelMs
// predicate itself (src/routes/api/validators.ts); door-level 400 coverage
// lives in test/plan-form-dates.test.ts.

import { describe, expect, it } from "vitest";
import { DAY_LABEL_MS, isDayLabelMs } from "../src/routes/api/validators";

describe("isDayLabelMs (DEC-522)", () => {
  it("accepts a UTC-midnight day label", () => {
    expect(isDayLabelMs(Date.UTC(2027, 0, 1))).toBe(true);
    expect(isDayLabelMs(0)).toBe(true); // 1970-01-01T00:00:00.000Z
  });

  it("accepts DAY_LABEL_MS itself and its negative", () => {
    expect(isDayLabelMs(DAY_LABEL_MS)).toBe(true);
    expect(isDayLabelMs(-DAY_LABEL_MS)).toBe(true);
  });

  it("rejects a sub-day instant (e.g. Date.now()-style offset)", () => {
    expect(isDayLabelMs(Date.UTC(2027, 0, 1) + 1)).toBe(false);
    expect(isDayLabelMs(Date.UTC(2027, 0, 1) + 60_000)).toBe(false); // +1 minute
    expect(isDayLabelMs(Date.UTC(2027, 0, 1) - 1)).toBe(false);
  });

  it("rejects non-integers and out-of-range values (defers to isEpochMs)", () => {
    expect(isDayLabelMs(1.5 * DAY_LABEL_MS)).toBe(false);
    expect(isDayLabelMs("2027-01-01")).toBe(false);
    expect(isDayLabelMs(null)).toBe(false);
    expect(isDayLabelMs(1e18)).toBe(false); // out of isEpochMs's bound
  });
});
