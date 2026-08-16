import { describe, expect, it } from "vitest";
import { describeConflict, type Conflict, type ConflictLabels } from "../src/domain/schedule";

const labels: ConflictLabels = {
  roomNameById: new Map([["room-1", "Ballroom A"]]),
  titleBySubmissionId: new Map([
    ["sub-1", "Intro to Widgets"],
    ["sub-2", "Advanced Widgets"],
  ]),
  speakerNameByContactId: new Map([["ct-1", "Ada Lovelace"]]),
};

describe("describeConflict (DEC-557)", () => {
  it("names the room and both session titles for a room_overlap, never an id", () => {
    const c: Conflict = {
      kind: "room_overlap",
      submissionIds: ["sub-1", "sub-2"],
      day: "2026-09-01",
      roomId: "room-1",
      speakerContactIds: [],
      breakId: null,
      breakLabel: null,
    };
    const text = describeConflict(c, labels);
    expect(text).toContain("Ballroom A");
    expect(text).toContain("Intro to Widgets");
    expect(text).toContain("Advanced Widgets");
    expect(text).not.toContain("room-1");
    expect(text).not.toContain("sub-1");
    expect(text).not.toContain("sub-2");
  });

  it("names the shared speakers and both session titles for a speaker_overlap, never an id", () => {
    const c: Conflict = {
      kind: "speaker_overlap",
      submissionIds: ["sub-1", "sub-2"],
      day: "2026-09-01",
      roomId: null,
      speakerContactIds: ["ct-1"],
      breakId: null,
      breakLabel: null,
    };
    const text = describeConflict(c, labels);
    expect(text).toContain("Ada Lovelace");
    expect(text).toContain("Intro to Widgets");
    expect(text).toContain("Advanced Widgets");
    expect(text).not.toContain("ct-1");
    expect(text).not.toContain("sub-1");
    expect(text).not.toContain("sub-2");
  });

  it("falls back to the raw id when a label is unresolved, rather than blanking", () => {
    const emptyLabels: ConflictLabels = {
      roomNameById: new Map(),
      titleBySubmissionId: new Map(),
      speakerNameByContactId: new Map(),
    };
    const room: Conflict = {
      kind: "room_overlap",
      submissionIds: ["sub-1", "sub-2"],
      day: "2026-09-01",
      roomId: "room-1",
      speakerContactIds: [],
      breakId: null,
      breakLabel: null,
    };
    const text = describeConflict(room, emptyLabels);
    expect(text).toContain("room-1");
    expect(text).toContain("sub-1");
    expect(text).toContain("sub-2");

    const speaker: Conflict = {
      kind: "speaker_overlap",
      submissionIds: ["sub-1", "sub-2"],
      day: "2026-09-01",
      roomId: null,
      speakerContactIds: ["ct-1"],
      breakId: null,
      breakLabel: null,
    };
    const speakerText = describeConflict(speaker, emptyLabels);
    expect(speakerText).toContain("ct-1");
  });
});
