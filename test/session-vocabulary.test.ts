// DEC-908 (wave-9 amendment): the ONE session-shape display vocabulary,
// driven off the seed's OWN literals -- scripts/seed.ts:428's audience
// levels ("Beginner"/"Intermediate"/"Advanced") and the fixture's own
// format labels (docs/fixtures/sample-data.json's session_formats, each
// carrying a trailing parenthetical duration) -- never a hand-shaped
// fixture that pre-lowercases the answer.

import { describe, expect, it } from "vitest";
import { sessionFormatLabel, audienceLevelLabel } from "../src/lib/session-vocabulary";

describe("sessionFormatLabel", () => {
  it("strips the seed's own trailing parenthetical into a comma clause", () => {
    expect(sessionFormatLabel("Talk (30 min)")).toBe("Talk, 30 min");
    expect(sessionFormatLabel("Workshop (120 min)")).toBe("Workshop, 120 min");
    expect(sessionFormatLabel("Keynote (45 min)")).toBe("Keynote, 45 min");
    expect(sessionFormatLabel("Lightning Talk (10 min)")).toBe("Lightning Talk, 10 min");
    expect(sessionFormatLabel("Panel (45 min)")).toBe("Panel, 45 min");
  });

  it("returns a format with no parenthetical verbatim", () => {
    expect(sessionFormatLabel("Workshop")).toBe("Workshop");
  });
});

describe("audienceLevelLabel", () => {
  it("lowercases each of the seed's own audience levels", () => {
    expect(audienceLevelLabel("Beginner")).toBe("beginner");
    expect(audienceLevelLabel("Intermediate")).toBe("intermediate");
    expect(audienceLevelLabel("Advanced")).toBe("advanced");
  });

  it("returns an already-lowercase label verbatim", () => {
    expect(audienceLevelLabel("advanced")).toBe("advanced");
  });
});
