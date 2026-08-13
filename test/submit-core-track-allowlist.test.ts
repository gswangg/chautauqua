// DEC-416: validateTrackChoice must reject foreign/unknown track ids even
// when the form offers zero tracks — the membership check runs before the
// DEC-301 "zero offered" relaxation, not after.

import { describe, expect, it } from "vitest";
import { validateTrackChoice } from "../src/lib/submit-core";

describe("validateTrackChoice (DEC-416 allowlist ordering)", () => {
  it("rejects a foreign id when zero tracks are offered", () => {
    const result = validateTrackChoice(["foreign-track"], []);
    expect(result).toEqual({ ok: false, error: "Selected track is not offered by this form." });
  });

  it("allows nothing selected when zero tracks are offered (DEC-301)", () => {
    const result = validateTrackChoice([], []);
    expect(result).toEqual({ ok: true });
  });

  it("rejects a foreign id when the form offers a non-empty set", () => {
    const result = validateTrackChoice(["foreign-track"], ["t1", "t2"]);
    expect(result).toEqual({ ok: false, error: "Selected track is not offered by this form." });
  });

  it("allows a valid subset of a non-empty offered set", () => {
    const result = validateTrackChoice(["t1"], ["t1", "t2"]);
    expect(result).toEqual({ ok: true });
  });

  it("rejects nothing-selected when the form offers a non-empty set", () => {
    const result = validateTrackChoice([], ["t1", "t2"]);
    expect(result).toEqual({ ok: false, error: "Select a track" });
  });
});
