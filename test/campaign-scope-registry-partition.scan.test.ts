// DEC-069 wave-42 (task v12m-w42-a): the campaign's three scope registries
// (CAMPAIGN_CONSTANT_NAMES, TIER2_CEILING_NAMES, OUT_OF_CAMPAIGN_SCOPE, all
// scripts/exit-predicate/campaign-scope.ts) must form a real partition, not
// merely LOOK like one. Wave-42 found TAP_FLOOR_EXEMPT_UNVERIFIABLE_PREMISE_CEILING
// declared in both CAMPAIGN_CONSTANT_NAMES and OUT_OF_CAMPAIGN_SCOPE, absent
// from TIER2_CEILING_NAMES, and printed by no exit-predicate row --
// `assertEveryGradedCeilingIsGated` (DEC-851) accepted OUT_OF_CAMPAIGN_SCOPE
// membership as a discharge for a graded name, the exact "declared knob
// with no reader" state it was written to close.
//
// This file imports the three real registries directly -- never re-typing a
// fourth copy of any of them (DEC-613: a second copy of a vocabulary is a
// trap with a delay fuse) -- and grades:
//   1. CAMPAIGN_CONSTANT_NAMES and OUT_OF_CAMPAIGN_SCOPE share no name.
//   2. TIER2_CEILING_NAMES is a subset of CAMPAIGN_CONSTANT_NAMES, and
//      neither list contains a name twice.
//   3. The wave-36 promotion promise, made a RULE: every OUT_OF_CAMPAIGN_SCOPE
//      entry whose reason text promises promotion, and whose named constant's
//      LIVE value (read off the tree, never a hard-coded map) is 0, must
//      either already be graded (CAMPAIGN_CONSTANT_NAMES) or carry an
//      explicit "DEC-069 wave-36 clause (b) refusal:" sentence naming a
//      sibling constant whose own live value is genuinely non-zero.
//
// DEC-069 dependency is compile-checked via the import below (never a bare
// prose citation -- src/decisions.ts is the binding registry).

import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { DEC_069 } from "../src/decisions";
import {
  CAMPAIGN_CONSTANT_NAMES,
  OUT_OF_CAMPAIGN_SCOPE,
  TIER2_CEILING_NAMES,
} from "../scripts/exit-predicate/campaign-scope";
import { stripTsComments } from "./helpers/strip-ts-comments";

void DEC_069; // wave-42: this file is the instrument that reads the DEC-069 wave-42 ruling.

const REPO_ROOT = join(import.meta.dirname, "..");

/** Matches the campaign's own `[export ]const <NAME> = <int>;` declaration shape. */
const CONST_DECL_RE =
  /^[ \t]*(?:export\s+)?const\s+([A-Z][A-Z0-9_]*)\s*=\s*(-?\d+)\s*;[ \t]*$/gm;

// resolveLiveValue is called once per (name) lookup, and this file checks
// many names -- re-running `git ls-files` and re-reading + re-stripping
// every tracked .ts file on EVERY call (the shape this function had before
// this cache existed) was already close to this suite's own timeout;
// adding the comment-stripping pass below without caching pushed it over.
// Computed once, lazily, and reused for every subsequent name (DEC-613:
// the file list and its stripped content are each derived exactly once,
// never re-derived per caller).
let _strippedTrackedFilesCache: ReadonlyArray<{ path: string; content: string }> | null = null;
function strippedTrackedFiles(repoRoot: string): ReadonlyArray<{ path: string; content: string }> {
  if (_strippedTrackedFilesCache !== null) return _strippedTrackedFilesCache;
  const trackedPaths = execFileSync(
    "git",
    ["ls-files", "--", "test", "app/src", "scripts"],
    { cwd: repoRoot, encoding: "utf8" },
  )
    .split("\n")
    .filter((p) => p.endsWith(".ts"));
  // Comment-blind guard (DEC-374 wave-44, task w44-i, shared
  // test/helpers/strip-ts-comments.ts -- DEC-613, never a private copy): a
  // comment merely QUOTING a `const NAME = N;` declaration shape must
  // never be read as a constant's live value.
  _strippedTrackedFilesCache = trackedPaths.map((path) => ({
    path,
    content: stripTsComments(readFileSync(join(repoRoot, path), "utf8")),
  }));
  return _strippedTrackedFilesCache;
}

/**
 * Reads a named constant's LIVE value off the git-tracked tree under
 * test/, app/src/ and scripts/ -- the same population `loadCampaignFiles`
 * (scripts/exit-predicate/campaign.ts) scans -- resolving to exactly one
 * declaration. Throws loudly on zero or more-than-one matches; never a
 * hard-coded value map (the task's own instruction, and DEC-808's "a
 * default is an invitation to guess").
 */
function resolveLiveValue(repoRoot: string, name: string): number {
  const found: number[] = [];
  const locations: string[] = [];
  for (const { path, content } of strippedTrackedFiles(repoRoot)) {
    CONST_DECL_RE.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = CONST_DECL_RE.exec(content)) !== null) {
      if ((m[1] as string) !== name) continue;
      found.push(Number.parseInt(m[2] as string, 10));
      locations.push(path);
    }
  }
  if (found.length === 0) {
    throw new Error(
      `campaign-scope-registry-partition: no declaration of ${name} found under test/, ` +
        `app/src/ or scripts/. A promotion-rule check must not silently skip a missing constant.`,
    );
  }
  if (found.length > 1) {
    throw new Error(
      `campaign-scope-registry-partition: ${name} declared ${found.length} times ` +
        `(${locations.join(", ")}) -- an ambiguous constant can never safely decide a rule.`,
    );
  }
  return found[0] as number;
}

const PROMOTION_PROMISE_RE = /promoted (once|by a later)/;
const REFUSAL_FRAGMENT = "DEC-069 wave-36 clause (b) refusal:";

/**
 * Extracts the sibling constant name a clause-(b) refusal sentence names,
 * by finding the first ALL-CAPS underscored identifier appearing after the
 * refusal fragment in the reason text. Returns null if no refusal fragment
 * is present, or if none is found after it.
 */
function extractRefusalSibling(reason: string): string | null {
  const idx = reason.indexOf(REFUSAL_FRAGMENT);
  if (idx === -1) return null;
  const after = reason.slice(idx + REFUSAL_FRAGMENT.length);
  const m = after.match(/\b[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)+\b/);
  return m ? m[0] : null;
}

/**
 * Runs the promotion rule (item 3 above) against an arbitrary
 * (outOfScope, campaignNames) pair and a value-resolver function -- shared
 * by both the real-registry test and the synthetic control tests so the
 * rule's logic is defined exactly once (DEC-613).
 */
function findPromotionRuleOffenders(
  outOfScope: Readonly<Record<string, string>>,
  campaignNames: ReadonlySet<string>,
  resolveValue: (name: string) => number,
): string[] {
  const offenders: string[] = [];
  for (const [name, reason] of Object.entries(outOfScope)) {
    if (!PROMOTION_PROMISE_RE.test(reason)) continue;
    const liveValue = resolveValue(name);
    if (liveValue !== 0) continue;
    if (campaignNames.has(name)) continue;
    const sibling = extractRefusalSibling(reason);
    if (sibling === null) {
      offenders.push(`${name} (live 0, promotion promised, no clause-(b) refusal sentence)`);
      continue;
    }
    const siblingValue = resolveValue(sibling);
    if (siblingValue === 0) {
      offenders.push(
        `${name} (live 0, refusal names ${sibling} but its live value is also 0 -- not a real refusal)`,
      );
    }
  }
  return offenders;
}

describe("campaign-scope registry partition (DEC-069 wave-42)", () => {
  it("CAMPAIGN_CONSTANT_NAMES and OUT_OF_CAMPAIGN_SCOPE share no name", () => {
    const campaign = new Set(CAMPAIGN_CONSTANT_NAMES);
    const overlap = Object.keys(OUT_OF_CAMPAIGN_SCOPE).filter((name) => campaign.has(name));
    expect(
      overlap,
      `these name(s) are declared in BOTH CAMPAIGN_CONSTANT_NAMES and ` +
        `OUT_OF_CAMPAIGN_SCOPE, so they are graded and excused simultaneously and print ` +
        `by no row: ${overlap.join(", ")}`,
    ).toEqual([]);
  });

  it("TIER2_CEILING_NAMES is a subset of CAMPAIGN_CONSTANT_NAMES", () => {
    const campaign = new Set(CAMPAIGN_CONSTANT_NAMES);
    const notGraded = TIER2_CEILING_NAMES.filter((name) => !campaign.has(name));
    expect(
      notGraded,
      `these TIER2_CEILING_NAMES entries are not members of CAMPAIGN_CONSTANT_NAMES: ` +
        `${notGraded.join(", ")}`,
    ).toEqual([]);
  });

  it("CAMPAIGN_CONSTANT_NAMES contains no duplicate of itself", () => {
    const seen = new Map<string, number>();
    for (const name of CAMPAIGN_CONSTANT_NAMES) {
      seen.set(name, (seen.get(name) ?? 0) + 1);
    }
    const dupes = [...seen.entries()].filter(([, n]) => n > 1).map(([name]) => name);
    expect(dupes, `CAMPAIGN_CONSTANT_NAMES lists these name(s) more than once: ${dupes.join(", ")}`).toEqual(
      [],
    );
  });

  it("TIER2_CEILING_NAMES contains no duplicate of itself", () => {
    const seen = new Map<string, number>();
    for (const name of TIER2_CEILING_NAMES) {
      seen.set(name, (seen.get(name) ?? 0) + 1);
    }
    const dupes = [...seen.entries()].filter(([, n]) => n > 1).map(([name]) => name);
    expect(dupes, `TIER2_CEILING_NAMES lists these name(s) more than once: ${dupes.join(", ")}`).toEqual(
      [],
    );
  });

  it("every OUT_OF_CAMPAIGN_SCOPE promotion promise reading live 0 is either graded or carries a genuine clause-(b) refusal", () => {
    const campaign = new Set(CAMPAIGN_CONSTANT_NAMES);
    const offenders = findPromotionRuleOffenders(OUT_OF_CAMPAIGN_SCOPE, campaign, (name) =>
      resolveLiveValue(REPO_ROOT, name),
    );
    expect(
      offenders,
      `promotion-rule offender(s): ${offenders.join("; ")}. Each must be promoted into ` +
        `CAMPAIGN_CONSTANT_NAMES, or its OUT_OF_CAMPAIGN_SCOPE reason must gain a ` +
        `"DEC-069 wave-36 clause (b) refusal:" sentence naming a sibling constant whose own ` +
        `live value is genuinely non-zero.`,
    ).toEqual([]);
  });
});

describe("promotion rule synthetic controls (not tautological against the real registry)", () => {
  it("FAILS a fabricated promise-entry reading live 0 with no refusal sentence (positive control)", () => {
    const fixture: Record<string, string> = {
      FABRICATED_PROMISE_CEILING:
        "measures a made-up population; it is promoted once its measurement technique is " +
        "proven complete enough to gate on.",
    };
    const resolveValue = (name: string): number => {
      if (name === "FABRICATED_PROMISE_CEILING") return 0;
      throw new Error(`unexpected constant lookup in synthetic control: ${name}`);
    };
    const offenders = findPromotionRuleOffenders(fixture, new Set(), resolveValue);
    expect(offenders).toHaveLength(1);
    expect(offenders[0]).toMatch(/FABRICATED_PROMISE_CEILING/);
  });

  it("PASSES the same entry once it carries a refusal naming a genuinely non-zero sibling", () => {
    const fixture: Record<string, string> = {
      FABRICATED_PROMISE_CEILING:
        "measures a made-up population; it is promoted once its measurement technique is " +
        "proven complete enough to gate on. DEC-069 wave-36 clause (b) refusal: its " +
        "instrument-completeness sibling, FABRICATED_SIBLING_CEILING, is not 0 and carries no " +
        "individual per-row adjudication, so promoting the divergence ceiling now would assert " +
        "fidelity over an unverified remainder.",
    };
    const resolveValue = (name: string): number => {
      if (name === "FABRICATED_PROMISE_CEILING") return 0;
      if (name === "FABRICATED_SIBLING_CEILING") return 5;
      throw new Error(`unexpected constant lookup in synthetic control: ${name}`);
    };
    const offenders = findPromotionRuleOffenders(fixture, new Set(), resolveValue);
    expect(offenders).toEqual([]);
  });

  it("FAILS when the refusal names a sibling whose live value is ALSO 0 (a fake refusal)", () => {
    const fixture: Record<string, string> = {
      FABRICATED_PROMISE_CEILING:
        "measures a made-up population; it is promoted once its measurement technique is " +
        "proven complete enough to gate on. DEC-069 wave-36 clause (b) refusal: its " +
        "instrument-completeness sibling, FABRICATED_SIBLING_CEILING, is not 0.",
    };
    const resolveValue = (name: string): number => {
      if (name === "FABRICATED_PROMISE_CEILING") return 0;
      if (name === "FABRICATED_SIBLING_CEILING") return 0;
      throw new Error(`unexpected constant lookup in synthetic control: ${name}`);
    };
    const offenders = findPromotionRuleOffenders(fixture, new Set(), resolveValue);
    expect(offenders).toHaveLength(1);
    expect(offenders[0]).toMatch(/FABRICATED_PROMISE_CEILING/);
  });

  it("PASSES an entry with no promotion promise at all, regardless of live value", () => {
    const fixture: Record<string, string> = {
      NO_PROMISE_CEILING: "measures a made-up population that carries no promotion promise at all.",
    };
    const resolveValue = (name: string): number => {
      if (name === "NO_PROMISE_CEILING") return 0;
      throw new Error(`unexpected constant lookup in synthetic control: ${name}`);
    };
    const offenders = findPromotionRuleOffenders(fixture, new Set(), resolveValue);
    expect(offenders).toEqual([]);
  });

  it("PASSES a promotion-promising entry whose live value is already non-zero (nothing to promote yet)", () => {
    const fixture: Record<string, string> = {
      STILL_MEASURING_CEILING:
        "measures a made-up population; it is promoted once its measurement technique is " +
        "proven complete enough to gate on.",
    };
    const resolveValue = (name: string): number => {
      if (name === "STILL_MEASURING_CEILING") return 3;
      throw new Error(`unexpected constant lookup in synthetic control: ${name}`);
    };
    const offenders = findPromotionRuleOffenders(fixture, new Set(), resolveValue);
    expect(offenders).toEqual([]);
  });

  it("PASSES a promotion-promising entry reading live 0 that has already been graded into CAMPAIGN_CONSTANT_NAMES", () => {
    const fixture: Record<string, string> = {
      ALREADY_PROMOTED_CEILING:
        "measures a made-up population; it is promoted once its measurement technique is " +
        "proven complete enough to gate on.",
    };
    const resolveValue = (name: string): number => {
      if (name === "ALREADY_PROMOTED_CEILING") return 0;
      throw new Error(`unexpected constant lookup in synthetic control: ${name}`);
    };
    const offenders = findPromotionRuleOffenders(
      fixture,
      new Set(["ALREADY_PROMOTED_CEILING"]),
      resolveValue,
    );
    expect(offenders).toEqual([]);
  });
});
