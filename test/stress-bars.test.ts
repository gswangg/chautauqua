import { describe, expect, it } from "vitest";
import {
  STRESS_BAR_IDS,
  STRESS_BAR_EVALUATORS,
  bulkStatus500,
  autoSchedule320,
  remindersHonesty,
  overviewRowCap,
  duplicatesLatency,
  OVERVIEW_ROW_CAP,
  DUPLICATES_LATENCY_CEILING_MS,
} from "../scripts/stress-bars";
import { BULK_STATUS_CHUNK_SIZE } from "../app/src/pages/submissions/bulk";
import { MAX_REMINDER_BATCH } from "../src/domain/reminders";

describe("STRESS_BAR_IDS / STRESS_BAR_EVALUATORS", () => {
  it("enumerates exactly the five scale-mandate functional bars, each with an evaluator", () => {
    expect(STRESS_BAR_IDS).toEqual([
      "bulkStatus500",
      "autoSchedule320",
      "remindersHonesty",
      "overviewRowCap",
      "duplicatesLatency",
    ]);
    for (const id of STRESS_BAR_IDS) {
      expect(typeof STRESS_BAR_EVALUATORS[id]).toBe("function");
    }
    expect(Object.keys(STRESS_BAR_EVALUATORS).sort()).toEqual([...STRESS_BAR_IDS].sort());
  });
});

describe("bulkStatus500", () => {
  it("passes when updated matches selected, request count matches the DEC-193 chunk size, and nothing rolled back", () => {
    const selected = BULK_STATUS_CHUNK_SIZE + 100; // forces 2 chunks
    const result = bulkStatus500({
      selected,
      updated: selected,
      requestCount: 2,
      rolledBack: false,
    });
    expect(result.ok).toBe(true);
    expect(result.detail).toContain(`selected=${selected}`);
    expect(result.detail).toContain("updated=" + selected);
  });

  it("fails when updated undercounts, request count is wrong, or a committed batch rolled back", () => {
    const selected = BULK_STATUS_CHUNK_SIZE + 100;
    const undercounted = bulkStatus500({ selected, updated: selected - 1, requestCount: 2, rolledBack: false });
    expect(undercounted.ok).toBe(false);

    const wrongRequestCount = bulkStatus500({ selected, updated: selected, requestCount: 1, rolledBack: false });
    expect(wrongRequestCount.ok).toBe(false);

    const rolledBack = bulkStatus500({ selected, updated: selected, requestCount: 2, rolledBack: true });
    expect(rolledBack.ok).toBe(false);
    expect(rolledBack.detail).toContain("rolledBack=true");
  });
});

describe("autoSchedule320", () => {
  it("passes when every unplaced session carries a non-empty reason", () => {
    const result = autoSchedule320({
      unplacedTotal: 3,
      reasons: ["no free slot", "double booked", "duration exceeds day"],
    });
    expect(result.ok).toBe(true);
  });

  it("fails when reasons undercount unplacedTotal or any reason is blank", () => {
    const undercount = autoSchedule320({ unplacedTotal: 3, reasons: ["a", "b"] });
    expect(undercount.ok).toBe(false);

    const blank = autoSchedule320({ unplacedTotal: 2, reasons: ["a", "   "] });
    expect(blank.ok).toBe(false);
    expect(blank.detail).toContain("emptyReasons=1");
  });
});

describe("remindersHonesty", () => {
  it("passes when sent+skipped+remaining accounts for every due contact and sent stays under the cap", () => {
    const result = remindersHonesty({ due: 250, sent: MAX_REMINDER_BATCH, skipped: 10, remaining: 140 });
    expect(result.ok).toBe(true);
    expect(result.detail).toContain(`MAX_REMINDER_BATCH=${MAX_REMINDER_BATCH}`);
  });

  it("fails when the counts don't add up to due, or sent exceeds the cap", () => {
    const undercounted = remindersHonesty({ due: 250, sent: 90, skipped: 10, remaining: 140 });
    expect(undercounted.ok).toBe(false);

    const overCap = remindersHonesty({
      due: MAX_REMINDER_BATCH + 10,
      sent: MAX_REMINDER_BATCH + 10,
      skipped: 0,
      remaining: 0,
    });
    expect(overCap.ok).toBe(false);
  });
});

describe("overviewRowCap", () => {
  it("passes when every over-cap section's rows stay at or under the cap", () => {
    const result = overviewRowCap([
      { name: "overdueTasks", rowsLength: OVERVIEW_ROW_CAP, total: 60 },
      { name: "triage", rowsLength: 3, total: 3 },
    ]);
    expect(result.ok).toBe(true);
  });

  it("fails when an over-cap section's rows exceed the cap, and when no section is actually over cap", () => {
    const violates = overviewRowCap([{ name: "overdueTasks", rowsLength: OVERVIEW_ROW_CAP + 1, total: 60 }]);
    expect(violates.ok).toBe(false);
    expect(violates.detail).toContain("overdueTasks");

    const noProbe = overviewRowCap([{ name: "triage", rowsLength: 2, total: 2 }]);
    expect(noProbe.ok).toBe(false);
  });
});

describe("duplicatesLatency", () => {
  it("passes when observed ms is below the named ceiling", () => {
    const result = duplicatesLatency({ ms: DUPLICATES_LATENCY_CEILING_MS - 1 });
    expect(result.ok).toBe(true);
    expect(result.detail).toContain(`ceilingMs=${DUPLICATES_LATENCY_CEILING_MS}`);
  });

  it("fails when observed ms is at or above the ceiling", () => {
    const result = duplicatesLatency({ ms: DUPLICATES_LATENCY_CEILING_MS });
    expect(result.ok).toBe(false);
  });
});
