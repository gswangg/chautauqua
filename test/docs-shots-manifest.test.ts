import { describe, expect, it } from "vitest";

import {
  DOCS_SHOT_GROUPS,
  DOCS_SHOT_ID_PATTERN,
  DOCS_SHOT_VIEWPORT,
  DOCS_SHOTS,
  shotIdMatchesGroup,
} from "../scripts/docs-shots-lib";

describe("DOCS_SHOT_VIEWPORT", () => {
  it("is exactly 1600x900 (DESIGN-RULINGS.md:308-316 rule 1)", () => {
    expect(DOCS_SHOT_VIEWPORT).toEqual({ width: 1600, height: 900 });
  });
});

describe("DOCS_SHOTS manifest", () => {
  it("is non-empty", () => {
    expect(DOCS_SHOTS.length).toBeGreaterThan(0);
  });

  it("has unique ids", () => {
    const ids = DOCS_SHOTS.map((entry) => entry.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("every id matches the <group>-<article-slug>-<nn> grammar", () => {
    for (const entry of DOCS_SHOTS) {
      expect(entry.id, `shot "${entry.id}" must match ${DOCS_SHOT_ID_PATTERN}`).toMatch(DOCS_SHOT_ID_PATTERN);
    }
  });

  it("every id is prefixed by its own declared group", () => {
    for (const entry of DOCS_SHOTS) {
      expect(
        shotIdMatchesGroup(entry.id, entry.group),
        `shot "${entry.id}" must start with "${entry.group}-"`,
      ).toBe(true);
    }
  });

  it("every group is one of the six declared DOCS_SHOT_GROUPS", () => {
    for (const entry of DOCS_SHOTS) {
      expect(DOCS_SHOT_GROUPS, `shot "${entry.id}" has unrecognized group "${entry.group}"`).toContain(entry.group);
    }
  });

  it("every route starts with /", () => {
    for (const entry of DOCS_SHOTS) {
      expect(entry.route.startsWith("/"), `shot "${entry.id}" route "${entry.route}" must start with /`).toBe(true);
    }
  });

  it("every caption is non-empty prose (carries the point on its own -- rule 4)", () => {
    for (const entry of DOCS_SHOTS) {
      expect(entry.caption.trim().length).toBeGreaterThan(10);
    }
  });

  it("covers every declared group at least once", () => {
    const covered = new Set(DOCS_SHOTS.map((entry) => entry.group));
    for (const group of DOCS_SHOT_GROUPS) {
      expect(covered.has(group), `no DOCS_SHOTS row covers group "${group}"`).toBe(true);
    }
  });
});

describe("DOCS_SHOT_ID_PATTERN / shotIdMatchesGroup", () => {
  it("accepts a well-formed id", () => {
    expect("running-an-event-cfp-and-submissions-01").toMatch(DOCS_SHOT_ID_PATTERN);
  });

  it("rejects an id missing its ordinal", () => {
    expect("running-an-event-cfp-and-submissions").not.toMatch(DOCS_SHOT_ID_PATTERN);
  });

  it("rejects an id with an uppercase segment", () => {
    expect("Running-an-event-cfp-01").not.toMatch(DOCS_SHOT_ID_PATTERN);
  });

  it("shotIdMatchesGroup is false when the id belongs to a different group", () => {
    expect(shotIdMatchesGroup("your-contacts-managing-contacts-01", "for-reviewers")).toBe(false);
  });
});
