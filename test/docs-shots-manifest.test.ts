// DEC-518 wave-3 reconciliation: scripts/docs-shots-lib.ts's DOCS_SHOTS and
// src/routes/docs-content/**'s DOCS_ARTICLES (figure blocks) each declared
// their own vocabulary of shotIds with ZERO members in common, because
// each self-test (this file and test/docs-content-manifest.test.ts) only
// ever checked its own file's grammar, never the other file's population.
// The fix below is a SET-EQUALITY check in BOTH directions -- no manifest
// row without a figure slot, no figure slot without a manifest row -- with
// a negative control (below) proving it can actually fail.
//
// REPAIR RECIPE for the next drift: three branches are adding five more
// articles this wave (task-w2-a/-b/-e). Adding an article with a `figure`
// block WILL fail this test at merge until a matching
// `{ id, route, group }` row (id === the figure's shotId, group === the
// owning article's group, route === a real ROUTE_MANIFEST-mounted path) is
// added to scripts/docs-shots-lib.ts's DOCS_SHOTS. That failure is the
// intended signal telling you a row is owed -- not a flake to work around.
import { describe, expect, it } from "vitest";

import {
  DOCS_SHOT_GROUPS,
  DOCS_SHOT_ID_PATTERN,
  DOCS_SHOT_VIEWPORT,
  DOCS_SHOTS,
  resolveRoleForRoute,
  shotIdMatchesGroup,
} from "../scripts/docs-shots-lib";
import { ROUTE_MANIFEST } from "../app/src/routeManifest";
import { DOCS_ARTICLES } from "../src/routes/docs-content";

/** Every `{ shotId, group }` a `figure` block in DOCS_ARTICLES declares. */
function articleFigureShots(): { shotId: string; group: string }[] {
  const out: { shotId: string; group: string }[] = [];
  for (const article of DOCS_ARTICLES) {
    for (const block of article.blocks) {
      if (block.kind === "figure") out.push({ shotId: block.shotId, group: article.group });
    }
  }
  return out;
}

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

  it("covers every declared group at least once", () => {
    const covered = new Set(DOCS_SHOTS.map((entry) => entry.group));
    for (const group of DOCS_SHOT_GROUPS) {
      expect(covered.has(group), `no DOCS_SHOTS row covers group "${group}"`).toBe(true);
    }
  });
});

// DEVIATIONS.md 2026-08-16: rows may now carry `prep` (declarative
// interactions run before the shutter) and `capture` ("fullPage" default /
// "frame"). These assert the SHAPE the interpreter in
// scripts/docs-shots.ts switches on -- a step kind it doesn't know, or a
// capture mode outside the two it implements, would silently shoot the
// wrong state.
describe("DOCS_SHOTS prep/capture fields", () => {
  const STEP_KINDS = ["click", "clickRole", "fill", "select", "upload", "waitFor"];
  const STEP_ROLES = ["button", "link", "checkbox", "tab"];

  it("every declared capture mode is one the script implements", () => {
    for (const entry of DOCS_SHOTS) {
      if (entry.capture === undefined) continue;
      expect(["fullPage", "frame"], `shot "${entry.id}" capture`).toContain(entry.capture);
    }
  });

  it("every prep array is non-empty and every step names a known kind", () => {
    for (const entry of DOCS_SHOTS) {
      if (entry.prep === undefined) continue;
      expect(entry.prep.length, `shot "${entry.id}" declares an empty prep array`).toBeGreaterThan(0);
      for (const step of entry.prep) {
        expect(STEP_KINDS, `shot "${entry.id}" has an unrecognized prep step kind`).toContain(step.kind);
      }
    }
  });

  it("every step carries the fields its kind needs (no blank selectors, roles or values)", () => {
    for (const entry of DOCS_SHOTS) {
      for (const step of entry.prep ?? []) {
        const where = `shot "${entry.id}" step ${step.kind}`;
        switch (step.kind) {
          case "click":
          case "waitFor":
            expect(step.selector.length, where).toBeGreaterThan(0);
            break;
          case "clickRole":
            expect(STEP_ROLES, where).toContain(step.role);
            expect(step.name.length, where).toBeGreaterThan(0);
            break;
          case "fill":
            expect(step.selector.length, where).toBeGreaterThan(0);
            expect(step.value.length, where).toBeGreaterThan(0);
            break;
          case "select":
            expect(step.selector.length, where).toBeGreaterThan(0);
            expect(step.label.length, where).toBeGreaterThan(0);
            break;
          case "upload":
            expect(step.selector.length, where).toBeGreaterThan(0);
            expect(step.fileName.endsWith(".csv"), `${where} uploads a non-CSV name`).toBe(true);
            expect(step.content.length, where).toBeGreaterThan(0);
            break;
        }
      }
    }
  });

  it("a prep flow ends by waiting for the state it was after (never a bare click before the shutter)", () => {
    for (const entry of DOCS_SHOTS) {
      if (entry.prep === undefined) continue;
      const last = entry.prep[entry.prep.length - 1]!;
      expect(last.kind, `shot "${entry.id}" prep must end with a waitFor, not a ${last.kind}`).toBe("waitFor");
    }
  });

  it("the shots whose captions name a STATE all declare prep (regression pin: they were byte-identical route twins)", () => {
    const owesPrep = [
      "running-an-event-speakers-tasks-and-content-02",
      "running-an-event-agenda-and-publishing-02",
      "running-an-event-agenda-and-publishing-03",
      "your-contacts-contacts-pipeline-and-comms-01",
      "your-contacts-contacts-pipeline-and-comms-02",
      "your-contacts-contacts-pipeline-and-comms-03",
      "for-reviewers-reviewing-start-to-finish-01",
      "for-reviewers-reviewing-start-to-finish-02",
    ];
    for (const id of owesPrep) {
      const entry = DOCS_SHOTS.find((row) => row.id === id);
      expect(entry, `no DOCS_SHOTS row for "${id}"`).toBeDefined();
      expect((entry!.prep ?? []).length, `shot "${id}" must declare prep steps`).toBeGreaterThan(0);
    }
  });

  it("no two rows sharing a route ALSO share an identical prep+capture (that is what made the duplicate figures)", () => {
    const seen = new Map<string, string>();
    for (const entry of DOCS_SHOTS) {
      const fingerprint = JSON.stringify([entry.route, entry.capture ?? "fullPage", entry.prep ?? []]);
      const twin = seen.get(fingerprint);
      // The /admin/overview pair is the one deliberate exception: two
      // different articles both open on the dashboard, and both captions
      // genuinely describe it.
      if (twin !== undefined && entry.route !== "/admin/overview") {
        throw new Error(`shots "${twin}" and "${entry.id}" would capture the identical frame (${entry.route})`);
      }
      seen.set(fingerprint, entry.id);
    }
  });
});

describe("DOCS_SHOTS reconciled against DOCS_ARTICLES's figure blocks", () => {
  it("every DOCS_SHOTS id has a matching figure shotId in DOCS_ARTICLES (no manifest row without a figure slot)", () => {
    const articleShotIds = new Set(articleFigureShots().map((s) => s.shotId));
    for (const entry of DOCS_SHOTS) {
      expect(articleShotIds.has(entry.id), `DOCS_SHOTS row "${entry.id}" has no figure block in DOCS_ARTICLES`).toBe(true);
    }
  });

  it("every DOCS_ARTICLES figure shotId has a matching DOCS_SHOTS row (no figure slot without a manifest row)", () => {
    const manifestIds = new Set(DOCS_SHOTS.map((entry) => entry.id));
    for (const { shotId } of articleFigureShots()) {
      expect(manifestIds.has(shotId), `figure shotId "${shotId}" has no DOCS_SHOTS row`).toBe(true);
    }
  });

  it("the two id sets are exactly equal (set equality, not just subset in one direction)", () => {
    const manifestIds = new Set(DOCS_SHOTS.map((entry) => entry.id));
    const articleIds = new Set(articleFigureShots().map((s) => s.shotId));
    expect([...manifestIds].sort()).toEqual([...articleIds].sort());
  });

  it("negative control: set equality DOES fail when the two populations actually diverge", () => {
    const manifestIds = new Set(DOCS_SHOTS.map((entry) => entry.id));
    const articleIds = new Set(articleFigureShots().map((s) => s.shotId));
    const articleIdsWithExtra = new Set([...articleIds, "getting-started-a-shotid-nobody-declared-99"]);
    expect([...manifestIds].sort()).not.toEqual([...articleIdsWithExtra].sort());
  });

  it("every DOCS_SHOTS row's group equals the owning article's group", () => {
    const groupByShotId = new Map(articleFigureShots().map((s) => [s.shotId, s.group]));
    for (const entry of DOCS_SHOTS) {
      expect(groupByShotId.get(entry.id), `shot "${entry.id}" group mismatch`).toBe(entry.group);
    }
  });
});

describe("DOCS_SHOTS resolved against the real app/src/routeManifest.ts (DEC-644 wave 7)", () => {
  it("every DOCS_SHOTS route resolves to exactly one role in ROUTE_MANIFEST", () => {
    for (const entry of DOCS_SHOTS) {
      let role: string;
      try {
        role = resolveRoleForRoute(entry.route, ROUTE_MANIFEST);
      } catch (err) {
        throw new Error(
          `docs-shots-manifest: shot "${entry.id}" (route "${entry.route}") failed to resolve a role: ${
            err instanceof Error ? err.message : String(err)
          }`,
        );
      }
      expect(role, `shot "${entry.id}" (route "${entry.route}") resolved to an unexpected role`).toBeTruthy();
    }
  });

  it("negative control: an unknown route throws the 'route not found' message", () => {
    expect(() => resolveRoleForRoute("/nowhere/at/all", ROUTE_MANIFEST)).toThrow(
      "docs-shots: route not found in app/src/routeManifest.ts: /nowhere/at/all",
    );
  });

  it("negative control: a route present under two different roles throws the 'more than one role' message", () => {
    const syntheticManifest = [
      { path: "/dup", role: "organizer" as const },
      { path: "/dup", role: "reviewer" as const },
    ];
    expect(() => resolveRoleForRoute("/dup", syntheticManifest)).toThrow(
      /docs-shots: route \/dup resolves to more than one role in app\/src\/routeManifest\.ts/,
    );
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
