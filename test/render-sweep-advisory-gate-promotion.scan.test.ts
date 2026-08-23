// DEC-069 wave-41 amendment: every `*_BLOCKING = false` flag in
// scripts/render-sweep-lib.ts needs a named promotion rule, the same
// loophole DEC-069 wave-36 closed for OUT_OF_CAMPAIGN_SCOPE's ten
// promotion-promising rows (src/decisions-data/DEC-069.md, "Amendment
// (wave 36)"). Before this file, PUBLIC_MOBILE_OFFENDER_GATE_BLOCKING,
// TYPE_ROLE_BLOCKING and INTERACTION_STATE_BLOCKING each promised a flip
// ("once a re-confirmed reading settles clean" / "once a reading has come
// back all-PASS") that no rule, registry or instrument could ever force --
// two of the three grade DESIGN-RULINGS requirements directly (B8
// interaction states; the type scale), so those rulings have never been
// enforced by anything that can fail.
//
// This file does NOT import scripts/render-sweep.ts or anything that pulls
// in playwright -- it reads scripts/render-sweep-lib.ts as TEXT and works
// entirely off regex-derived constants, the same "no live gate, no
// process spawn" discipline test/render-sweep-public-gate.test.ts already
// documents. DEC_069 (src/decisions.ts) is imported so this dependency is
// compile-checked.
//
// WHAT THIS FILE CHECKS, in order:
//   (1) the `*_BLOCKING` population is DERIVED from render-sweep-lib.ts's
//       own source via regex over `export const <NAME>_BLOCKING = (true|
//       false);` -- never a hand list (DEC-180/DEC-808: "a hand-listed
//       population is not a population").
//   (2) every member currently reading `false` has an entry in
//       PROMOTION_RULES carrying a principle-shaped reason and a NAMED
//       promotion predicate.
//   (3) a predicate expressible over a constant in the SAME module
//       (PUBLIC_MOBILE_OFFENDER_GATE_BLOCKING's
//       `PUBLIC_MOBILE_CANDIDATE_DEFECT_CEILING === 0`) is actually
//       EVALUATED against that module's current text -- a flag whose
//       predicate reads satisfied while the flag still reads `false` is a
//       FAILURE, not a note, and the failure message names the flip as
//       owed rather than reporting a bare number (field guide: "a
//       declared target is part of the contract", DEC-817).
//   (4) a predicate that turns on a live gate reading no fast-tier test
//       can take (TYPE_ROLE_BLOCKING, INTERACTION_STATE_BLOCKING) must
//       instead name a recorded-reading artifact path under
//       docs/design/audit/, and that file must actually exist and contain
//       a recorded sha -- an unrecordable promise (a path that does not
//       exist, or exists but names no sha) is refused right here.
//   (5) synthetic positive/negative controls over tmpdir fixtures, never
//       against the real repo tree, prove the checker itself fires and
//       does not fire on the right shapes: an unregistered flag fires; a
//       registered flag whose predicate is satisfied fires; a registered
//       flag whose predicate is unsatisfied does not fire; a
//       recorded-reading rule naming a missing file, or a file with no
//       sha, fires.
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { afterAll, describe, expect, it } from "vitest";

import { DEC_069 } from "../src/decisions";
import { stripTsComments } from "./helpers/strip-ts-comments";

const ROOT = resolve(__dirname, "..");
const RENDER_SWEEP_LIB_PATH = join(ROOT, "scripts", "render-sweep-lib.ts");

// ---------------------------------------------------------------------------
// (1) population derivation -- pure regex over source text, reused for both
// the real file and synthetic fixtures below.
// ---------------------------------------------------------------------------

interface BlockingFlag {
  readonly name: string;
  readonly value: boolean;
}

const BLOCKING_FLAG_RE = /export const (\w+)_BLOCKING = (true|false);/g;

function deriveBlockingFlags(source: string): BlockingFlag[] {
  const out: BlockingFlag[] = [];
  BLOCKING_FLAG_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = BLOCKING_FLAG_RE.exec(source))) {
    out.push({ name: `${m[1]}_BLOCKING`, value: m[2] === "true" });
  }
  return out;
}

/** Extracts `export const <name> = <number>;` from source text. Throws
 * loudly (fail-loud principle) if the named constant is absent -- a
 * predicate naming a constant that does not exist is a broken predicate,
 * not something to fall back past. */
function extractNumericConstant(source: string, name: string): number {
  const re = new RegExp(`export const ${name} = (\\d+);`);
  const m = source.match(re);
  if (!m) {
    throw new Error(
      `predicate names constant ${name}, but no "export const ${name} = <number>;" was found in the module text`,
    );
  }
  return Number(m[1]);
}

// ---------------------------------------------------------------------------
// (2)/(3)/(4) the promotion-rule registry shape and its checker.
// ---------------------------------------------------------------------------

type PromotionPredicate =
  | {
      readonly kind: "constant";
      /** Constant name to extract from the SAME module's source text. */
      readonly constantName: string;
      readonly satisfied: (value: number) => boolean;
      /** Human-readable rendering of the predicate, for failure messages. */
      readonly describe: string;
    }
  | {
      readonly kind: "recorded-reading";
      /** Repo-relative path under docs/design/audit/ to the artifact that
       * records the live-gate reading this predicate turns on. */
      readonly artifactPath: string;
    };

interface PromotionRule {
  /** Principle-shaped reason the flag stays advisory -- never a bare
   * "TODO" or a restatement of the flag name. */
  readonly reason: string;
  readonly predicate: PromotionPredicate;
}

type PromotionRegistry = Readonly<Record<string, PromotionRule>>;

/** A recorded-reading artifact must exist under docs/design/audit/ and
 * name at least one sha-shaped hex string near the word "sha" -- the same
 * loose discipline the verification-log corpus already uses ("recorded at
 * product sha <hex>", "sha <hex>"). Deliberately loose (case-insensitive,
 * word-boundary hex run of 7-40 chars) rather than pinned to one exact
 * phrasing, so a future artifact's own prose style is not constrained by
 * this scan -- but a mere path with no sha nearby is refused. */
const RECORDED_SHA_RE = /\bsha\b[^\n]{0,60}?\b([0-9a-f]{7,40})\b/i;

interface Violation {
  readonly flag: string;
  readonly message: string;
}

/** The full compliance check for one module's text against one registry.
 * `repoRoot` is where recorded-reading artifact paths are resolved from --
 * the real repo root for the real file, a tmpdir fixture root for the
 * synthetic controls, so the SAME function grades both populations. */
function checkPromotionCompliance(
  source: string,
  registry: PromotionRegistry,
  repoRoot: string,
): Violation[] {
  const violations: Violation[] = [];
  for (const flag of deriveBlockingFlags(source)) {
    if (flag.value) continue; // true flags need no promotion rule
    const rule = registry[flag.name];
    if (!rule) {
      violations.push({
        flag: flag.name,
        message: `${flag.name} reads false with no PROMOTION_RULES entry -- an advisory flag with no named promotion predicate is the exact loophole DEC-069 wave-41 closes`,
      });
      continue;
    }
    if (!rule.reason || rule.reason.trim().length < 20) {
      violations.push({
        flag: flag.name,
        message: `${flag.name}'s PROMOTION_RULES entry has no principle-shaped reason (got ${JSON.stringify(rule.reason)})`,
      });
      continue;
    }
    if (rule.predicate.kind === "constant") {
      const value = extractNumericConstant(source, rule.predicate.constantName);
      if (rule.predicate.satisfied(value)) {
        violations.push({
          flag: flag.name,
          message: `${flag.name}'s promotion predicate (${rule.predicate.describe}) now reads satisfied (${rule.predicate.constantName} = ${value}) while the flag still reads false -- the flip is OWED: edit scripts/render-sweep-lib.ts to set ${flag.name} = true in the same commit that drains ${rule.predicate.constantName}, per DEC-069 wave-41`,
        });
      }
      continue;
    }
    // recorded-reading kind: the artifact must exist under docs/design/audit/
    // and must contain a recorded sha. This file never evaluates the
    // artifact as PROOF the flag should flip today (that call needs a live
    // gate reading no fast-tier test can take) -- it only refuses an
    // unrecordable promise, per this task's own instruction.
    if (!rule.predicate.artifactPath.startsWith("docs/design/audit/")) {
      violations.push({
        flag: flag.name,
        message: `${flag.name}'s recorded-reading predicate names "${rule.predicate.artifactPath}", which is not under docs/design/audit/`,
      });
      continue;
    }
    const artifactAbsPath = join(repoRoot, rule.predicate.artifactPath);
    if (!existsSync(artifactAbsPath)) {
      violations.push({
        flag: flag.name,
        message: `${flag.name}'s recorded-reading predicate names "${rule.predicate.artifactPath}", which does not exist -- an unrecordable promise is refused at review (DEC-069 wave-41)`,
      });
      continue;
    }
    const artifactText = readFileSync(artifactAbsPath, "utf8");
    if (!RECORDED_SHA_RE.test(artifactText)) {
      violations.push({
        flag: flag.name,
        message: `${flag.name}'s recorded-reading artifact "${rule.predicate.artifactPath}" exists but names no recorded sha -- an unrecordable promise is refused at review (DEC-069 wave-41)`,
      });
    }
  }
  return violations;
}

// ---------------------------------------------------------------------------
// The real registry, covering render-sweep-lib.ts's current false members.
// ---------------------------------------------------------------------------

const RENDER_SWEEP_PROMOTION_RULES: PromotionRegistry = {
  PUBLIC_MOBILE_OFFENDER_GATE_BLOCKING: {
    reason:
      "advisory until the public/portal 390 CANDIDATE offender population it grades (PUBLIC_MOBILE_CANDIDATE_DEFECT_CEILING) is fully drained -- a still-nonzero population is unfinished measurement, not gate-worthy failure yet; gating on it today would fail the sweep for every route the moment it is turned on, which is not this flag's job (DEC-808 wave-30/35).",
    predicate: {
      kind: "constant",
      constantName: "PUBLIC_MOBILE_CANDIDATE_DEFECT_CEILING",
      satisfied: (value) => value === 0,
      describe: "PUBLIC_MOBILE_CANDIDATE_DEFECT_CEILING === 0",
    },
  },
  TYPE_ROLE_BLOCKING: {
    reason:
      "advisory until a live getComputedStyle reading of DESIGN-RULINGS' type-scale roles comes back all-PASS and is reconfirmed on a later branch (DEC-387's flip rule) -- that reading needs a booted server, so no fast-tier test can take it; the recorded-reading artifact carries what evidence exists and what is still owed.",
    predicate: {
      kind: "recorded-reading",
      artifactPath: "docs/design/audit/render-sweep-advisory-gate-promotion-v12.md",
    },
  },
  INTERACTION_STATE_BLOCKING: {
    reason:
      "advisory until a live getComputedStyle reading of DESIGN-RULINGS §B8 (focus/hover/disabled) comes back all-PASS and is reconfirmed on a later branch (DEC-387's flip rule, same as TYPE_ROLE_BLOCKING) -- that reading needs a booted server, so no fast-tier test can take it; the recorded-reading artifact carries what evidence exists and what is still owed.",
    predicate: {
      kind: "recorded-reading",
      artifactPath: "docs/design/audit/render-sweep-advisory-gate-promotion-v12.md",
    },
  },
};

describe(`render-sweep advisory *_BLOCKING flags carry a promotion rule (${DEC_069})`, () => {
  // Comment-blind guard (DEC-374 wave-44, task w44-i, shared
  // test/helpers/strip-ts-comments.ts -- DEC-613, never a private copy): a
  // comment merely QUOTING a `*_BLOCKING` flag declaration must never be
  // read by deriveBlockingFlags as a real flag.
  const source = stripTsComments(readFileSync(RENDER_SWEEP_LIB_PATH, "utf8"));
  const flags = deriveBlockingFlags(source);

  it("derives at least the five known *_BLOCKING flags from source, never a hand list", () => {
    const names = flags.map((f) => f.name).sort();
    expect(names).toEqual(
      [
        "ADMIN_MOBILE_PASS_BLOCKING",
        "FONT_FLOOR_BLOCKING",
        "INTERACTION_STATE_BLOCKING",
        "PUBLIC_MOBILE_OFFENDER_GATE_BLOCKING",
        "TYPE_ROLE_BLOCKING",
      ].sort(),
    );
  });

  it("the two positive precedents (ADMIN_MOBILE_PASS_BLOCKING, FONT_FLOOR_BLOCKING) read true and need no promotion rule", () => {
    const trueFlags = flags.filter((f) => f.value);
    expect(trueFlags.map((f) => f.name).sort()).toEqual(
      ["ADMIN_MOBILE_PASS_BLOCKING", "FONT_FLOOR_BLOCKING"].sort(),
    );
  });

  it("every false *_BLOCKING flag has a registered, satisfiable-checked promotion rule (ceiling: 0, two-sided)", () => {
    const violations = checkPromotionCompliance(source, RENDER_SWEEP_PROMOTION_RULES, ROOT);
    if (violations.length > 0) {
      throw new Error(
        `${violations.length} advisory-gate promotion violation(s):\n` +
          violations.map((v) => `  - ${v.flag}: ${v.message}`).join("\n"),
      );
    }
  });

  it("the registry covers exactly the false flags -- no stale entries for flags that have already flipped true", () => {
    const falseNames = flags.filter((f) => !f.value).map((f) => f.name).sort();
    expect(Object.keys(RENDER_SWEEP_PROMOTION_RULES).sort()).toEqual(falseNames);
  });
});

// ---------------------------------------------------------------------------
// (5) synthetic positive/negative controls, over tmpdir fixtures only.
// ---------------------------------------------------------------------------

describe("checkPromotionCompliance synthetic controls (tmpdir fixtures, never the real tree)", () => {
  const fixtureDirs: string[] = [];

  afterAll(() => {
    for (const dir of fixtureDirs) rmSync(dir, { recursive: true, force: true });
  });

  function makeFixtureRoot(): string {
    const dir = mkdtempSync(join(tmpdir(), "render-sweep-promotion-fixture-"));
    fixtureDirs.push(dir);
    return dir;
  }

  it("a fabricated *_BLOCKING = false flag absent from the registry fires", () => {
    const source = `export const X_BLOCKING = false;\n`;
    const violations = checkPromotionCompliance(source, {}, makeFixtureRoot());
    expect(violations).toHaveLength(1);
    expect(violations[0]!.flag).toBe("X_BLOCKING");
    expect(violations[0]!.message).toMatch(/no PROMOTION_RULES entry/);
  });

  it("a registered flag whose constant-kind predicate is SATISFIED while still false fires", () => {
    const source = [`export const Y_BLOCKING = false;`, `export const Y_CEILING = 0;`].join("\n");
    const registry: PromotionRegistry = {
      Y_BLOCKING: {
        reason: "advisory until Y_CEILING drains to zero, per the same shape as PUBLIC_MOBILE_OFFENDER_GATE_BLOCKING",
        predicate: {
          kind: "constant",
          constantName: "Y_CEILING",
          satisfied: (v) => v === 0,
          describe: "Y_CEILING === 0",
        },
      },
    };
    const violations = checkPromotionCompliance(source, registry, makeFixtureRoot());
    expect(violations).toHaveLength(1);
    expect(violations[0]!.flag).toBe("Y_BLOCKING");
    expect(violations[0]!.message).toMatch(/flip is OWED/);
  });

  it("a registered flag whose constant-kind predicate is UNSATISFIED does not fire", () => {
    const source = [`export const Z_BLOCKING = false;`, `export const Z_CEILING = 5;`].join("\n");
    const registry: PromotionRegistry = {
      Z_BLOCKING: {
        reason: "advisory until Z_CEILING drains to zero, per the same shape as PUBLIC_MOBILE_OFFENDER_GATE_BLOCKING",
        predicate: {
          kind: "constant",
          constantName: "Z_CEILING",
          satisfied: (v) => v === 0,
          describe: "Z_CEILING === 0",
        },
      },
    };
    const violations = checkPromotionCompliance(source, registry, makeFixtureRoot());
    expect(violations).toHaveLength(0);
  });

  it("a recorded-reading rule naming a MISSING artifact fires", () => {
    const source = `export const W_BLOCKING = false;\n`;
    const registry: PromotionRegistry = {
      W_BLOCKING: {
        reason: "advisory until a live gate reading is recorded and reconfirmed, same DEC-387 shape as TYPE_ROLE_BLOCKING",
        predicate: { kind: "recorded-reading", artifactPath: "docs/design/audit/does-not-exist-w41-g.md" },
      },
    };
    const violations = checkPromotionCompliance(source, registry, makeFixtureRoot());
    expect(violations).toHaveLength(1);
    expect(violations[0]!.message).toMatch(/does not exist/);
  });

  it("a recorded-reading rule naming an artifact that exists but names no sha fires", () => {
    const root = makeFixtureRoot();
    const artifactDir = join(root, "docs", "design", "audit");
    mkdirSync(artifactDir, { recursive: true });
    writeFileSync(join(artifactDir, "no-sha-w41-g.md"), "This artifact records nothing measured.\n");
    const source = `export const V_BLOCKING = false;\n`;
    const registry: PromotionRegistry = {
      V_BLOCKING: {
        reason: "advisory until a live gate reading is recorded and reconfirmed, same DEC-387 shape as TYPE_ROLE_BLOCKING",
        predicate: { kind: "recorded-reading", artifactPath: "docs/design/audit/no-sha-w41-g.md" },
      },
    };
    const violations = checkPromotionCompliance(source, registry, root);
    expect(violations).toHaveLength(1);
    expect(violations[0]!.message).toMatch(/names no recorded sha/);
  });

  it("a recorded-reading rule naming an artifact that exists AND names a sha does not fire", () => {
    const root = makeFixtureRoot();
    const artifactDir = join(root, "docs", "design", "audit");
    mkdirSync(artifactDir, { recursive: true });
    writeFileSync(
      join(artifactDir, "has-sha-w41-g.md"),
      "Recorded at sha 6edb526323f8ce3af8f8e71d791a722a7b1a69ad.\n",
    );
    const source = `export const U_BLOCKING = false;\n`;
    const registry: PromotionRegistry = {
      U_BLOCKING: {
        reason: "advisory until a live gate reading is recorded and reconfirmed, same DEC-387 shape as TYPE_ROLE_BLOCKING",
        predicate: { kind: "recorded-reading", artifactPath: "docs/design/audit/has-sha-w41-g.md" },
      },
    };
    const violations = checkPromotionCompliance(source, registry, root);
    expect(violations).toHaveLength(0);
  });

  it("the real registry's own recorded-reading artifacts, checked against the real repo root, pass structurally", () => {
    const violations = checkPromotionCompliance(
      readFileSync(RENDER_SWEEP_LIB_PATH, "utf8"),
      RENDER_SWEEP_PROMOTION_RULES,
      ROOT,
    );
    expect(violations).toHaveLength(0);
  });
});
