// DEC-615 (wave 69 amendment): unplacedReasonLabel must cover every member
// of the server's UnplacedReason union with a non-empty short label. The
// member list here is DERIVED from the exhaustive switch in schedule-copy.ts
// (parsed from the case labels), not hand-typed, so a future switch member
// that reuses an already-covered case would still be caught by TypeScript's
// exhaustiveness check at build time -- this test guards the runtime output
// for the cases that actually exist in the source today.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { unplacedReasonLabel } from "../src/domain/schedule-copy";
import type { UnplacedReason } from "../src/domain/schedule";

function reasonsFromSwitch(): UnplacedReason[] {
  const source = readFileSync(new URL("../src/domain/schedule-copy.ts", import.meta.url), "utf-8");
  const switchBody = source.slice(source.indexOf("switch (reason)"));
  const matches = [...switchBody.matchAll(/case\s+"([a-z_]+)":/g)];
  expect(matches.length).toBeGreaterThan(0);
  return matches.map((m) => m[1] as UnplacedReason);
}

describe("unplacedReasonLabel", () => {
  it("returns a non-empty label for every switch member", () => {
    const reasons = reasonsFromSwitch();
    for (const reason of reasons) {
      const label = unplacedReasonLabel(reason);
      expect(typeof label).toBe("string");
      expect(label.length).toBeGreaterThan(0);
    }
  });

  it("covers all seven server-declared UnplacedReason members", () => {
    const reasons = reasonsFromSwitch();
    expect(new Set(reasons)).toEqual(
      new Set([
        "no_rooms_configured",
        "duration_exceeds_day",
        "no_free_slot",
        "speaker_double_booked",
        "write_cap_reached",
        "slot_outside_event_range",
        "changed_during_run",
      ]),
    );
  });

  it("gives changed_during_run an honest, non-undefined label", () => {
    expect(unplacedReasonLabel("changed_during_run")).not.toMatch(/undefined/i);
    expect(unplacedReasonLabel("changed_during_run").length).toBeGreaterThan(0);
  });
});
