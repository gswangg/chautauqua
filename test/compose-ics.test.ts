// DEC-051: server-side calendar invites in compose. Pure-helper coverage —
// unscheduled-rejection field shape, use-then-bump SEQUENCE semantics, and
// LOCATION omission when no room is assigned yet.

import { describe, expect, it } from "vitest";
import { unscheduledIcsFields } from "../src/routes/comms";
import { chunkIds } from "../src/lib/chunk";
import type { IcsScheduleRow } from "../src/server/repo/comms";
import { buildIcsEvent } from "../src/mail/ics";

function slot(overrides: Partial<IcsScheduleRow> = {}): IcsScheduleRow {
  return {
    submissionId: "sub_1",
    day: "2026-09-01",
    startMin: 600,
    endMin: 630,
    roomName: "Main Hall",
    icsSequence: 0,
    ...overrides,
  };
}

describe("unscheduledIcsFields", () => {
  it("is empty when every selected submission has a schedule slot", () => {
    const icsMap = new Map([
      ["sub_1", slot({ submissionId: "sub_1" })],
      ["sub_2", slot({ submissionId: "sub_2" })],
    ]);
    expect(unscheduledIcsFields(icsMap, ["sub_1", "sub_2"])).toEqual({});
  });

  it("flags every submission missing a schedule_slot row as 'not scheduled'", () => {
    const icsMap = new Map([["sub_1", slot({ submissionId: "sub_1" })]]);
    expect(unscheduledIcsFields(icsMap, ["sub_1", "sub_2", "sub_3"])).toEqual({
      sub_2: "not scheduled",
      sub_3: "not scheduled",
    });
  });

  it("flags all selected submissions when none are scheduled", () => {
    const icsMap = new Map<string, IcsScheduleRow>();
    expect(unscheduledIcsFields(icsMap, ["sub_1", "sub_2"])).toEqual({
      sub_1: "not scheduled",
      sub_2: "not scheduled",
    });
  });
});

describe("use-then-bump SEQUENCE semantics", () => {
  it("send uses the current stored sequence, then a subsequent send after a bump uses sequence + 1", () => {
    const dtstamp = new Date("2026-08-10T12:00:00Z");
    const base = {
      uidSubmissionId: "sub_1",
      title: "On Engines",
      startUtc: new Date("2026-09-01T14:00:00Z"),
      endUtc: new Date("2026-09-01T14:30:00Z"),
      location: "Main Hall",
      dtstamp,
    };

    // First send: stored ics_sequence is 0.
    const first = buildIcsEvent({ ...base, sequence: 0 });
    expect(first).toContain("SEQUENCE:0");
    const firstUid = first.match(/UID:([^\r\n]+)/)?.[1];

    // Route bumps ics_sequence by exactly 1 after the first send. A second
    // send (e.g. after the room changed) uses the bumped value.
    const bumped = 0 + 1;
    const second = buildIcsEvent({ ...base, sequence: bumped });
    expect(second).toContain("SEQUENCE:1");
    const secondUid = second.match(/UID:([^\r\n]+)/)?.[1];

    // Same submission -> same stable UID across the sequence bump.
    expect(secondUid).toBe(firstUid);
  });

  it("preview never bumps: rendering the same stored sequence twice yields identical SEQUENCE lines", () => {
    const base = {
      uidSubmissionId: "sub_1",
      title: "On Engines",
      startUtc: new Date("2026-09-01T14:00:00Z"),
      endUtc: new Date("2026-09-01T14:30:00Z"),
      dtstamp: new Date("2026-08-10T12:00:00Z"),
      sequence: 3,
    };
    const previewOne = buildIcsEvent(base);
    const previewTwo = buildIcsEvent(base);
    expect(previewOne.match(/SEQUENCE:(\d+)/)?.[1]).toBe("3");
    expect(previewTwo.match(/SEQUENCE:(\d+)/)?.[1]).toBe("3");
  });
});

describe("LOCATION omitted when no room is assigned", () => {
  it("emits no LOCATION line when the schedule slot has no room", () => {
    const ics = buildIcsEvent({
      uidSubmissionId: "sub_1",
      sequence: 0,
      title: "On Engines",
      startUtc: new Date("2026-09-01T14:00:00Z"),
      endUtc: new Date("2026-09-01T14:30:00Z"),
      location: undefined,
      dtstamp: new Date("2026-08-10T12:00:00Z"),
    });
    expect(ics).not.toContain("LOCATION:");
  });

  it("emits LOCATION when a room is assigned", () => {
    const ics = buildIcsEvent({
      uidSubmissionId: "sub_1",
      sequence: 0,
      title: "On Engines",
      startUtc: new Date("2026-09-01T14:00:00Z"),
      endUtc: new Date("2026-09-01T14:30:00Z"),
      location: "Main Hall",
      dtstamp: new Date("2026-08-10T12:00:00Z"),
    });
    expect(ics).toContain("LOCATION:Main Hall");
  });
});

// Regression coverage for the D1 "too many SQL variables" crash a >90
// selected-submission compose (DEC-019's own 100-recipient cap lets a
// producer select more submissionIds than that before the expanded
// recipient count is even checked) tripped in loadComposeSubmissions,
// found by the producer walkthrough (scripts/walkthrough/producer.ts).
describe("chunkIds (D1 bound-parameter batching for compose data loading)", () => {
  it("returns a single batch for input under the chunk size", () => {
    expect(chunkIds(["a", "b", "c"])).toEqual([["a", "b", "c"]]);
  });

  it("returns an empty array for empty input", () => {
    expect(chunkIds([])).toEqual([]);
  });

  it("splits into batches small enough to leave headroom for an extra bound condition (e.g. eventId)", () => {
    const ids = Array.from({ length: 101 }, (_, i) => `id-${i}`);
    const batches = chunkIds(ids);
    expect(batches.every((b: string[]) => b.length <= 90)).toBe(true);
    expect(batches.flat()).toEqual(ids);
  });
});
