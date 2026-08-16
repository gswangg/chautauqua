// DEC-489 (wave-12 amendment): the ONE surface->knob table lives in pure
// core (src/lib/embed-knobs.ts). This test pins the exact table the
// amendment declared, and the app/ boundary-crossing re-export, so a future
// drift-by-comment (the defect this wave found) fails a real assertion
// instead of a stale code comment.

import { describe, expect, it } from "vitest";
import {
  EMBED_SURFACES,
  EMBED_KNOBS_BY_SURFACE,
  knobsForSurface,
  trackKnobMode,
  type EmbedSurface,
} from "../src/lib/embed-knobs";
import * as appEmbedKnobs from "../app/src/lib/embed-knobs";

const EXPECTED: Record<EmbedSurface, readonly string[]> = {
  sessions: ["trackId", "format", "roomId", "day", "q", "limit", "fields", "accent"],
  speakers: ["trackId", "q", "limit", "accent"],
  gallery: ["trackId", "q", "limit", "accent"],
  agenda: ["trackId", "day", "q", "accent"],
  // DEC-851 (wave-55 amendment): schedule drops trackId -- no reader
  // honors it (ScheduleContent never read the highlight prop, the
  // .json/.xml feed twin never threaded it).
  schedule: ["day", "q", "accent"],
};

const EXPECTED_TRACK_MODE: Record<EmbedSurface, "filter" | "highlight"> = {
  sessions: "filter",
  speakers: "filter",
  gallery: "filter",
  agenda: "highlight",
  schedule: "highlight",
};

describe("DEC-489 wave-12 amendment: embed-knobs table", () => {
  it.each(EMBED_SURFACES)("surface '%s' exposes exactly the ruled knob set", (surface) => {
    expect(knobsForSurface(surface)).toEqual(EXPECTED[surface]);
    expect(EMBED_KNOBS_BY_SURFACE[surface]).toEqual(EXPECTED[surface]);
  });

  it.each(EMBED_SURFACES)("surface '%s' carries the ruled trackId filter/highlight mode", (surface) => {
    expect(trackKnobMode(surface)).toBe(EXPECTED_TRACK_MODE[surface]);
  });

  it("agenda/schedule never list format, roomId, limit or fields", () => {
    for (const surface of ["agenda", "schedule"] as const) {
      const knobs = knobsForSurface(surface);
      expect(knobs).not.toContain("format");
      expect(knobs).not.toContain("roomId");
      expect(knobs).not.toContain("limit");
      expect(knobs).not.toContain("fields");
    }
  });

  it("the app/ boundary crossing re-exports the identical table (never a hand copy)", () => {
    for (const surface of EMBED_SURFACES) {
      expect(appEmbedKnobs.knobsForSurface(surface)).toEqual(knobsForSurface(surface));
      expect(appEmbedKnobs.trackKnobMode(surface)).toBe(trackKnobMode(surface));
    }
  });
});
