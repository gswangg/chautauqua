// DEC-808 wave-30 amendment: the public/portal 390 tap-floor population has
// never been graded by the live geometry gate before this task -- see
// scripts/render-sweep-lib.ts's DEC-808 wave-30 amendment section for the
// full rationale (MOBILE_CONTROL_SELECTOR is a hand-listed six-selector
// list whose own comment says it "deliberately excludes secondary inline
// links", the same DEC-180/DEC-808 "a hand-listed population is not a
// population" defect the admin pass already fixed at w7-dd). This scan
// reads the roster scripts/render-sweep.ts's public mobile pass writes
// (docs/design/audit/public-390-interactive-offenders-v12.md) on every gate
// run and checks it against the tree, never against a hand-copied second
// population -- modelled directly on
// test/admin-390-offender-roster.scan.test.ts's own roster-vs-manifest
// idiom:
//   - the roster's own recorded total is what its own rows sum to
//     (self-consistency -- the roster cannot silently drift from its table)
//   - every route it names is a REAL member of MOBILE_ROUTE_MANIFEST,
//     imported from scripts/render-sweep.ts, never hand-listed (DEC-180)
//   - the recorded total is <= PUBLIC_MOBILE_INTERACTIVE_OFFENDERS_CEILING,
//     imported from scripts/render-sweep-lib.ts, never copied as a literal
//   - two-sided companion: the recorded total does not fall stale below the
//     ceiling without the ceiling itself being lowered in the same commit
//   - the vacuity clause (d): the roster's own "Vacuous-narrow count: N"
//     line is checked against PUBLIC_MOBILE_VACUOUS_NARROW_FLOOR, two-sided
//     the same way -- DEC-180 wave-35 amendment: this floor is a DEFECT
//     COUNT that must fall to 0 (the BLOCKING public gate now grades
//     INTERACTIVE_CONTROL_SELECTOR, scripts/render-sweep.ts, so a route
//     passing vacuously means it drew NO interactive control at all), never
//     a stable fact to be kept in sync for its own sake -- the two-sided
//     shape still forces the constant to be lowered in the SAME commit that
//     causes the count to fall (never left stale-high), but staying at 4
//     forever is itself the thing wave-35 files as wrong.
//   - a vacuity tripwire: the parsed roster is non-empty, so a row-format
//     drift that silently parses to zero rows cannot pass by accident.
//
// DEC-808 wave-35 amendment adds a second describe block below (appended,
// the original wave-30 block above untouched): the roster's mixed
// EXEMPT+CANDIDATE total above is graded (PUBLIC_MOBILE_INTERACTIVE_OFFENDERS_CEILING,
// OUT_OF_CAMPAIGN_SCOPE), but its CANDIDATE half never had a campaign
// sibling at all. The wave-35 block re-classifies every offender line
// through classifyAdminMobileOffender (the SAME predicate the admin roster
// scan uses, DEC-613) with the exempt-token set derived from this tree's
// receipts (DEC-180), and grades the CANDIDATE count against
// PUBLIC_MOBILE_CANDIDATE_DEFECT_CEILING two-sided -- never against the
// roster's own printed "candidate defects: N" prose, which is a sibling
// reader of the constant, not a second independently-typed source.
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { DEC_180, DEC_613, DEC_808 } from "../src/decisions";
import * as RenderSweep from "../scripts/render-sweep";
import { MOBILE_ROUTE_MANIFEST } from "../scripts/render-sweep";
import * as RenderSweepLib from "../scripts/render-sweep-lib";
import {
  MIN_TAP_TARGET_PX,
  PUBLIC_MOBILE_CANDIDATE_DEFECT_CEILING,
  PUBLIC_MOBILE_INTERACTIVE_OFFENDERS_CEILING,
  PUBLIC_MOBILE_VACUOUS_NARROW_FLOOR,
  classifyAdminMobileOffender,
} from "../scripts/render-sweep-lib";
import {
  allCssFiles,
  hasExemptionForToken,
  hasMinHeightFloor,
  narrowMediaRules,
  selectorMentionsToken,
  topLevelRulesWithExemption,
} from "../app/src/phone-tap-target-scan/core";
import { extractCssTsLiteral } from "../app/src/phone-tap-target-scan/ssr";

void DEC_808; // this scan's whole reason to exist: grading the public/portal 390 population for the first time
void DEC_180; // every route named below is a REAL member of MOBILE_ROUTE_MANIFEST, never hand-listed
void DEC_613; // classifyAdminMobileOffender is imported, never re-authored here (wave-35 amendment)

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(HERE, "..");
const ROSTER_PATH = join(REPO_ROOT, "docs/design/audit/public-390-interactive-offenders-v12.md");

const ROSTER_TEXT = readFileSync(ROSTER_PATH, "utf8");

/** One route section's offender count, parsed from the roster's `## <path>`
 * headings and the offender lines beneath each (same shape
 * formatAdminMobileOffenderLedger emits, one `- ... — **EXEMPT|CANDIDATE**`
 * line per offender). */
interface RosterRow {
  path: string;
  count: number;
}

function parseRosterRows(markdown: string): RosterRow[] {
  const lines = markdown.split("\n");
  const rows: RosterRow[] = [];
  let currentPath: string | null = null;
  let currentCount = 0;
  const flush = () => {
    if (currentPath !== null) rows.push({ path: currentPath, count: currentCount });
  };
  for (const line of lines) {
    if (line.startsWith("## ")) {
      flush();
      // Only a route-path heading (`## /foo`) opens a new counted section —
      // the roster's own "## Vacuity clause ..." section heading (clause d)
      // is a DIFFERENT population (routes, not offenders) and must not be
      // folded into this arithmetic check.
      const headingMatch = line.match(/^## (\/\S*)/);
      currentPath = headingMatch ? (headingMatch[1] ?? null) : null;
      currentCount = 0;
      continue;
    }
    if (line.startsWith("- ") && currentPath !== null) {
      currentCount++;
    }
  }
  flush();
  return rows;
}

const ROSTER_ROWS = parseRosterRows(ROSTER_TEXT);

/** The roster's own recorded grand total, from its "Measured total: N ..."
 * line (formatAdminMobileOffenderLedger's own emitted shape) -- the receipt
 * this scan checks the parsed rows' sum against. */
function recordedTotal(markdown: string): number {
  const m = markdown.match(/Measured total: (\d+) /);
  if (!m) throw new Error("public-390-offender-roster: no 'Measured total: N' line found in roster");
  return Number(m[1]);
}

const RECORDED_TOTAL = recordedTotal(ROSTER_TEXT);

/** The roster's own recorded vacuity count, from its "Vacuous-narrow count:
 * N (of M routes measured)" line -- DEC-808 wave-30 amendment clause (d). */
function recordedVacuousNarrowCount(markdown: string): { vacuous: number; total: number } {
  const m = markdown.match(/Vacuous-narrow count: (\d+) \(of (\d+) routes measured\)/);
  if (!m) throw new Error("public-390-offender-roster: no 'Vacuous-narrow count: N (of M routes measured)' line found");
  return { vacuous: Number(m[1]), total: Number(m[2]) };
}

const RECORDED_VACUITY = recordedVacuousNarrowCount(ROSTER_TEXT);

/** Every route path MOBILE_ROUTE_MANIFEST actually names, as a Set --
 * imported from source (scripts/render-sweep.ts), never hand-listed
 * (DEC-180: a hand-listed population is not a population). Manifest paths
 * can carry a dynamic segment the roster instead names with a concrete
 * seeded id -- routeMatchesManifest below accepts either the exact string
 * or the manifest's own dynamic-segment pattern, same idiom as the admin
 * roster scan. */
const MANIFEST_PATHS = new Set(MOBILE_ROUTE_MANIFEST.map((e) => e.path));

function routeMatchesManifest(route: string): boolean {
  if (MANIFEST_PATHS.has(route)) return true;
  for (const manifestPath of MANIFEST_PATHS) {
    if (!manifestPath.includes(":")) continue;
    const pattern = "^" + manifestPath.replace(/:[^/]+/g, "[^/]+") + "$";
    if (new RegExp(pattern).test(route)) return true;
  }
  return false;
}

describe("public-390-offender-roster (DEC-808 wave-30 amendment)", () => {
  it("parses a non-empty roster (vacuity tripwire)", () => {
    expect(ROSTER_ROWS.length).toBeGreaterThan(0);
  });

  it("the roster's own recorded total equals the sum of its own parsed rows' arithmetic", () => {
    const summed = ROSTER_ROWS.reduce((acc, r) => acc + r.count, 0);
    expect(summed).toBe(RECORDED_TOTAL);
  });

  it("every route the roster names is a real member of MOBILE_ROUTE_MANIFEST, imported from source", () => {
    expect(MANIFEST_PATHS.size).toBeGreaterThan(0);
    const unmatched = ROSTER_ROWS.map((r) => r.path).filter((p) => !routeMatchesManifest(p));
    expect(unmatched).toEqual([]);
  });

  it("the recorded total is <= PUBLIC_MOBILE_INTERACTIVE_OFFENDERS_CEILING (never raised by this task)", () => {
    expect(RECORDED_TOTAL).toBeLessThanOrEqual(PUBLIC_MOBILE_INTERACTIVE_OFFENDERS_CEILING);
  });

  it("does not fall stale below PUBLIC_MOBILE_INTERACTIVE_OFFENDERS_CEILING (two-sided companion)", () => {
    expect(
      RECORDED_TOTAL,
      `PUBLIC_MOBILE_INTERACTIVE_OFFENDERS_CEILING = ${PUBLIC_MOBILE_INTERACTIVE_OFFENDERS_CEILING} is stale -- ` +
        `the roster's recorded total dropped to ${RECORDED_TOTAL}. Lower the constant in ` +
        `scripts/render-sweep-lib.ts in the same commit that closed the gap.`,
    ).toBeGreaterThanOrEqual(PUBLIC_MOBILE_INTERACTIVE_OFFENDERS_CEILING);
  });

  it("the roster's recorded vacuity total matches its own routes-measured population size", () => {
    expect(RECORDED_VACUITY.total).toBe(MOBILE_ROUTE_MANIFEST.length);
  });

  // DEC-180 wave-35 amendment: PUBLIC_MOBILE_VACUOUS_NARROW_FLOOR is a
  // DEFECT COUNT that must fall to 0 (a vacuously-passing route means it
  // drew no interactive control at all under the now-blocking
  // INTERACTIVE_CONTROL_SELECTOR population), not a stable population fact
  // -- so this companion stays two-sided (regression above the floor is
  // still red, AND a fall below the floor without lowering the constant is
  // still red, forcing the sync to land in the SAME commit that earns it)
  // but its direction is explicitly FALLING: the floor's own doc comment
  // (scripts/render-sweep-lib.ts) must read as a target trending toward 0,
  // never as a number this test exists to keep stable.
  it("the vacuous-narrow count is <= PUBLIC_MOBILE_VACUOUS_NARROW_FLOOR's ceiling side (never raised by this task)", () => {
    expect(RECORDED_VACUITY.vacuous).toBeLessThanOrEqual(PUBLIC_MOBILE_VACUOUS_NARROW_FLOOR);
  });

  it("does not fall stale below PUBLIC_MOBILE_VACUOUS_NARROW_FLOOR without the constant itself falling too (two-sided, falling-direction companion, clause d)", () => {
    expect(
      RECORDED_VACUITY.vacuous,
      `PUBLIC_MOBILE_VACUOUS_NARROW_FLOOR = ${PUBLIC_MOBILE_VACUOUS_NARROW_FLOOR} is stale -- ` +
        `the roster's recorded vacuous-narrow count dropped to ${RECORDED_VACUITY.vacuous}. This floor is a defect ` +
        `count that must fall to 0 (DEC-180 wave-35), so a drop is progress, not noise -- lower the constant in ` +
        `scripts/render-sweep-lib.ts in the same commit that closed the gap, rather than leaving it stale-high.`,
    ).toBeGreaterThanOrEqual(PUBLIC_MOBILE_VACUOUS_NARROW_FLOOR);
  });
});

// ---------------------------------------------------------------------------
// DEC-808 wave-35 amendment: the CANDIDATE-defect half, mirroring
// test/admin-390-offender-roster.scan.test.ts's own classification block.
// ---------------------------------------------------------------------------

/** One offender line from the roster's `## /route` + bullet-list shape
 * (formatAdminMobileOffenderLedger's own output, via
 * formatPublicMobileOffenderRoster). Reads only the selector/width/height
 * this block needs to re-derive a classification -- the roster's own
 * printed `**EXEMPT**`/`**CANDIDATE**` label is read by nobody here; this
 * block re-classifies from scratch and only checks the CANDIDATE total
 * against PUBLIC_MOBILE_CANDIDATE_DEFECT_CEILING. */
interface RosterOffenderLine {
  readonly route: string;
  readonly selector: string;
  readonly width: number;
  readonly height: number;
}

function parseRosterOffenderLines(markdown: string): RosterOffenderLine[] {
  const lines = markdown.split("\n");
  const rows: RosterOffenderLine[] = [];
  let route = "";
  const routeRe = /^##\s+(\/\S*)/;
  // DEC-808 wave-42 amendment: accepts the new REPAIRED-SINCE-SNAPSHOT
  // label alongside the original EXEMPT/CANDIDATE pair -- the label text is
  // never trusted for classification (see classifyRows below, which
  // re-derives EXEMPT/CANDIDATE/REPAIRED-SINCE-SNAPSHOT from the tree on
  // every run), only matched here so a re-labelled roster row still parses.
  const offenderRe = /^-\s+(.+?)\s+w=(\d+)px\s+h=(\d+)px\s+—\s+\*\*(EXEMPT|CANDIDATE|REPAIRED-SINCE-SNAPSHOT)\*\*/;
  for (const line of lines) {
    const trimmed = line.trim();
    const routeMatch = routeRe.exec(trimmed);
    if (routeMatch) {
      route = routeMatch[1] ?? "";
      continue;
    }
    const offenderMatch = offenderRe.exec(trimmed);
    if (!offenderMatch) continue;
    rows.push({
      route,
      selector: offenderMatch[1] ?? "",
      width: Number(offenderMatch[2]),
      height: Number(offenderMatch[3]),
    });
  }
  return rows;
}

const OFFENDER_LINES = parseRosterOffenderLines(ROSTER_TEXT);

/** Every *.ts/*.tsx file under `root` (test files excluded) -- the src/**
 * counterpart to core.ts's allCssFiles, since some `tap-floor-exempt:`
 * receipts (e.g. `.chq-wordmark`, DEC-382) live inside `src/**` TS/TSX
 * modules' embedded CSS template strings, not `.css` files. Byte-for-byte
 * the same helper test/admin-390-offender-roster.scan.test.ts defines --
 * kept as its own copy here rather than exported from a shared module,
 * since both callers already read it identically off the same tree and a
 * shared export would touch that in-flight test file for a lane that only
 * needs to read, never widen, its behaviour. */
function allSrcTsSourceFiles(root: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(root, { withFileTypes: true, recursive: true })) {
    if (!entry.isFile()) continue;
    if (!entry.name.endsWith(".ts") && !entry.name.endsWith(".tsx")) continue;
    if (entry.name.includes(".test.")) continue;
    out.push(join(entry.parentPath, entry.name));
  }
  return out.sort();
}

/** DEC-808 wave-42 amendment: every source text this scan can ask about a
 * class token's CURRENT declared geometry -- real `.css` files read as-is
 * (already valid CSS), plus every `src/**` `.ts`/`.tsx` module's embedded
 * CSS-in-template-literal text (extractCssTsLiteral, the SAME extraction
 * app/src/phone-tap-target-scan/ssr.ts's CSS-in-TS reader uses, DEC-613:
 * one predicate, never a second copy) -- so a token whose rule lives in a
 * `.css.ts` module (e.g. `chq-docs-phone-back` in docs-site.css.ts) is
 * still reachable by the real CSS-rule grammar (topLevelRulesWithExemption
 * / narrowMediaRules), which a raw un-extracted TS file would garble. */
function currentStylesheetTexts(): string[] {
  return [
    ...allCssFiles(join(REPO_ROOT, "app", "src")).map((f) => readFileSync(f, "utf8")),
    ...allSrcTsSourceFiles(join(REPO_ROOT, "src")).map((f) => extractCssTsLiteral(readFileSync(f, "utf8"))),
  ];
}

// Computed once at module load (mirrors ROSTER_TEXT/OFFENDER_LINES above) --
// walking + reading + extracting the whole app/src+src tree is expensive
// enough that calling it fresh inside every `it` blows past vitest's
// default per-test timeout.
const CURRENT_STYLESHEET_TEXTS = currentStylesheetTexts();

/** DEC-808 wave-42 amendment, VERIFIED DEFECT 1: a roster row's recorded
 * `h=NNpx` is FROZEN wave-30 snapshot prose -- it never changes when the
 * tree is repaired. A token is REPAIRED-SINCE-SNAPSHOT when some rule
 * effective at 390 (a top-level rule, which applies everywhere, or a rule
 * inside an `@media (max-width: <=700px)` block, DEC-385's single-
 * direction narrow-overrides-wide idiom) declares a `min-height`/`height`
 * of at least MIN_TAP_TARGET_PX for that token -- i.e. the tree now
 * CONTRADICTS the roster's frozen `h=` reading. Built entirely from the
 * tap-floor scan's own exported floor grammar (hasMinHeightFloor,
 * selectorMentionsToken, topLevelRulesWithExemption, narrowMediaRules,
 * app/src/phone-tap-target-scan/core.ts) -- DEC-613: imported, never
 * re-authored. */
function tokenRepairedSinceSnapshot(sourceTexts: readonly string[], token: string): boolean {
  for (const text of sourceTexts) {
    const rules = [...topLevelRulesWithExemption(text), ...narrowMediaRules(text, 700)];
    for (const rule of rules) {
      if (selectorMentionsToken(rule.selector, token) && hasMinHeightFloor(rule.body)) return true;
    }
  }
  return false;
}

/** DEC-996/DEC-180: derives the exempt class-token set for the given
 * candidate tokens by walking the tree's own receipts -- never a hand-
 * written array. Same derivation the admin roster scan runs, over this
 * roster's own selector population. */
function deriveExemptSelectors(candidateTokens: ReadonlySet<string>): Set<string> {
  const sourceTexts = [
    ...allCssFiles(join(REPO_ROOT, "app", "src")),
    ...allSrcTsSourceFiles(join(REPO_ROOT, "src")),
  ].map((f) => readFileSync(f, "utf8"));

  const exempt = new Set<string>();
  for (const token of candidateTokens) {
    if (sourceTexts.some((text) => hasExemptionForToken(text, token))) exempt.add(token);
  }

  if (candidateTokens.has("chq-check")) {
    const stylesCss = readFileSync(join(REPO_ROOT, "app", "src", "styles.css"), "utf8");
    if (/\.chq-check-hit\s*\{[^}]*min-height\s*:\s*44px/.test(stylesCss)) exempt.add("chq-check");
  }

  return exempt;
}

function candidateTokensOf(rows: readonly RosterOffenderLine[]): Set<string> {
  const tokens = new Set<string>();
  for (const row of rows) {
    for (const m of row.selector.matchAll(/\.[a-zA-Z0-9_-]+/g)) tokens.add(m[0].slice(1));
  }
  return tokens;
}

/** DEC-808 wave-42 amendment: a row's class tokens (empty for a bare
 * `a`/`input` tag with no class attribute at all -- 20 of this roster's 22
 * CANDIDATE lines, which no static stylesheet lookup can address). */
function rowTokens(row: RosterOffenderLine): string[] {
  return [...row.selector.matchAll(/\.[a-zA-Z0-9_-]+/g)].map((m) => m[0].slice(1));
}

function classifyRows(
  rows: readonly RosterOffenderLine[],
  exemptTokens: ReadonlySet<string>,
  stylesheetTexts: readonly string[] = CURRENT_STYLESHEET_TEXTS,
): { candidateCount: number; candidateRows: string[]; repairedRows: string[] } {
  let candidateCount = 0;
  const candidateRows: string[] = [];
  const repairedRows: string[] = [];
  for (const row of rows) {
    const line = `${row.selector} w=${row.width}px h=${row.height}px`;
    const result = classifyAdminMobileOffender(line, exemptTokens);
    if (result.classification !== "CANDIDATE") continue; // already EXEMPT -- not this clause's concern
    // DEC-808 wave-42 amendment, clause (a): a row REPAIRED-SINCE-SNAPSHOT
    // is excluded from the CANDIDATE count -- a repaired control needs no
    // exemption receipt, it simply no longer offends.
    if (rowTokens(row).some((t) => tokenRepairedSinceSnapshot(stylesheetTexts, t))) {
      repairedRows.push(`${row.route} ${row.selector}`);
      continue;
    }
    candidateCount++;
    candidateRows.push(`${row.route} ${row.selector}`);
  }
  return { candidateCount, candidateRows, repairedRows };
}

describe("public-390-offender-roster classification (DEC-808 wave-35 amendment)", () => {
  it("parses a non-empty set of offender lines (vacuity tripwire)", () => {
    expect(OFFENDER_LINES.length).toBeGreaterThan(0);
  });

  it(
    "the candidate-defect count this scan's own derivation measures is <= " +
      "PUBLIC_MOBILE_CANDIDATE_DEFECT_CEILING (two-sided, forced to -1 and read)",
    () => {
      const exemptTokens = deriveExemptSelectors(candidateTokensOf(OFFENDER_LINES));
      const { candidateCount, candidateRows } = classifyRows(OFFENDER_LINES, exemptTokens);

      expect(candidateCount, `candidate rows: ${candidateRows.join(", ")}`).toBeLessThanOrEqual(
        PUBLIC_MOBILE_CANDIDATE_DEFECT_CEILING,
      );
      expect(candidateCount, "PUBLIC_MOBILE_CANDIDATE_DEFECT_CEILING is stale above the measured count").toBe(
        PUBLIC_MOBILE_CANDIDATE_DEFECT_CEILING,
      );
    },
  );

  // Two-sided companion, restated in single-line form: the ratchet-two-sided
  // enforcer reads `it` bodies through its own brace-matching mask and its
  // direction regexes end `\s*\)`, which a multi-line pin with a trailing
  // comma before the close paren cannot satisfy -- both directions are
  // restated here in single-line form the enforcer reads, appended rather
  // than weakening the pin above.
  it("does not fall stale above PUBLIC_MOBILE_CANDIDATE_DEFECT_CEILING (two-sided companion)", () => {
    const exemptTokens = deriveExemptSelectors(candidateTokensOf(OFFENDER_LINES));
    const { candidateCount } = classifyRows(OFFENDER_LINES, exemptTokens);
    if (candidateCount < PUBLIC_MOBILE_CANDIDATE_DEFECT_CEILING) {
      throw new Error(
        `Measured ${candidateCount} candidate defects, below the declared ceiling of ` +
          `${PUBLIC_MOBILE_CANDIDATE_DEFECT_CEILING}. A ratchet may only be LOWERED; replace the line:\n` +
          `  export const PUBLIC_MOBILE_CANDIDATE_DEFECT_CEILING = ${candidateCount};`,
      );
    }
    expect(candidateCount).toBeLessThanOrEqual(PUBLIC_MOBILE_CANDIDATE_DEFECT_CEILING);
    expect(candidateCount).toBeGreaterThanOrEqual(PUBLIC_MOBILE_CANDIDATE_DEFECT_CEILING);
  });

  it("synthetic control: an unreceipted selector classifies CANDIDATE, a receipted one classifies EXEMPT", () => {
    const exemptTokens = deriveExemptSelectors(
      new Set(["chq-wordmark", "chq-w35c-never-receipted-anywhere"]),
    );
    expect(exemptTokens.has("chq-w35c-never-receipted-anywhere")).toBe(false);
    expect(
      classifyAdminMobileOffender("a.chq-w35c-never-receipted-anywhere w=41px h=19px", exemptTokens),
    ).toEqual({ classification: "CANDIDATE" });
    expect(exemptTokens.has("chq-wordmark")).toBe(true);
    expect(classifyAdminMobileOffender("a.chq-wordmark w=113px h=28px", exemptTokens)).toEqual({
      classification: "EXEMPT",
      receipt: "chq-wordmark",
    });
  });
});

// ---------------------------------------------------------------------------
// DEC-808 wave-42 amendment: REPAIRED-SINCE-SNAPSHOT re-grounding (VERIFIED
// DEFECT 1) and the vacuity floor's live-predicate re-grounding (VERIFIED
// DEFECT 2).
// ---------------------------------------------------------------------------

describe("public-390-offender-roster REPAIRED-SINCE-SNAPSHOT re-grounding (DEC-808 wave-42 amendment)", () => {
  it("MIN_TAP_TARGET_PX is the same 44px floor the tap-floor scan's own grammar (hasMinHeightFloor) checks against", () => {
    expect(MIN_TAP_TARGET_PX).toBe(44);
  });

  it("of the roster's CANDIDATE-labelled rows, exactly the two class-bearing ones (chq-docs-phone-back, chq-pub-activefilters-clear) reclassify REPAIRED-SINCE-SNAPSHOT against the tree's current stylesheets", () => {
    const stylesheetTexts = CURRENT_STYLESHEET_TEXTS;
    const { repairedRows } = classifyRows(
      OFFENDER_LINES,
      deriveExemptSelectors(candidateTokensOf(OFFENDER_LINES)),
      stylesheetTexts,
    );
    expect(repairedRows.sort()).toEqual(
      [
        "/docs/start-here a.chq-docs-phone-back",
        "/embed/e/seed_embed_0001 a.chq-pub-activefilters-clear",
      ].sort(),
    );
  });

  it("every roster row with NO class token (a bare a/input tag) can never reclassify REPAIRED-SINCE-SNAPSHOT (no token to look up)", () => {
    const bareTokenRows = OFFENDER_LINES.filter((r) => rowTokens(r).length === 0);
    expect(bareTokenRows.length).toBeGreaterThan(0);
    const stylesheetTexts = CURRENT_STYLESHEET_TEXTS;
    for (const row of bareTokenRows) {
      expect(rowTokens(row).some((t) => tokenRepairedSinceSnapshot(stylesheetTexts, t))).toBe(false);
    }
  });

  // Synthetic control both ways (DEC-808 wave-42 amendment BUILD clause 4):
  // a fabricated token with a 44px rule reclassifies REPAIRED-SINCE-SNAPSHOT;
  // the identical row with no such rule stays CANDIDATE.
  it("synthetic control: a token with a current 44px rule classifies REPAIRED-SINCE-SNAPSHOT; the identical token with no such rule stays CANDIDATE", () => {
    const repairedCss = `
      .chq-w42c-repaired {
        display: flex;
        align-items: center;
        min-height: 44px;
      }
    `;
    const unrepairedCss = `
      .chq-w42c-unrepaired {
        color: red;
      }
    `;
    expect(tokenRepairedSinceSnapshot([repairedCss], "chq-w42c-repaired")).toBe(true);
    expect(tokenRepairedSinceSnapshot([unrepairedCss], "chq-w42c-unrepaired")).toBe(false);
    // ...also effective inside a narrow (<=700px) media block, DEC-385's
    // single-direction narrow-overrides-wide idiom -- not just top-level.
    const narrowRepairedCss = `
      .chq-w42c-narrow-repaired { color: red; }
      @media (max-width: 700px) {
        .chq-w42c-narrow-repaired { min-height: 44px; }
      }
    `;
    expect(tokenRepairedSinceSnapshot([narrowRepairedCss], "chq-w42c-narrow-repaired")).toBe(true);
    // ...a media block wider than 700px is not "effective at 390" by this
    // codebase's own terminal-breakpoint convention and must not count.
    const tooWideCss = `
      @media (max-width: 900px) {
        .chq-w42c-too-wide { min-height: 44px; }
      }
    `;
    expect(tokenRepairedSinceSnapshot([tooWideCss], "chq-w42c-too-wide")).toBe(false);

    const rows: RosterOffenderLine[] = [
      { route: "/synthetic", selector: "a.chq-w42c-repaired", width: 20, height: 19 },
      { route: "/synthetic", selector: "a.chq-w42c-unrepaired", width: 20, height: 19 },
    ];
    const { candidateRows, repairedRows } = classifyRows(rows, new Set(), [repairedCss, unrepairedCss]);
    expect(repairedRows).toEqual(["/synthetic a.chq-w42c-repaired"]);
    expect(candidateRows).toEqual(["/synthetic a.chq-w42c-unrepaired"]);
  });
});

describe("public-390-offender-roster vacuity floor re-grounding (DEC-808 wave-42 amendment, VERIFIED DEFECT 2)", () => {
  /** The vacuity clause section's own prose (everything from its `## Vacuity
   * clause` heading to the end of the file), the population this scan
   * checks the doc's own claim about which predicate produced the 4. */
  function vacuitySectionText(markdown: string): string {
    const idx = markdown.indexOf("## Vacuity clause");
    if (idx === -1) throw new Error("public-390-offender-roster: no '## Vacuity clause' section found");
    return markdown.slice(idx);
  }

  /** Every `[A-Z][A-Z0-9_]*_SELECTOR` identifier the vacuity section's prose
   * names -- a fossil predicate name (one retired from the tree) fails this
   * scan loudly rather than silently pinning a number nothing can now
   * reproduce (DEC-808 wave-42 amendment). */
  function selectorIdentifiersIn(text: string): string[] {
    return [...new Set([...text.matchAll(/\b([A-Z][A-Z0-9_]*_SELECTOR)\b/g)].map((m) => m[1]!))];
  }

  it("the roster's vacuity section names INTERACTIVE_CONTROL_SELECTOR as the population it grades, never the fossil phrase naming the retired MOBILE_CONTROL_SELECTOR as that population", () => {
    const section = vacuitySectionText(ROSTER_TEXT);
    expect(section).toContain("INTERACTIVE_CONTROL_SELECTOR");
    // The exact wave-30 fossil phrasing this amendment replaces -- a
    // historical mention that MOBILE_CONTROL_SELECTOR was retired is fine
    // (and present, as provenance); the doc must never again ASSERT it as
    // the current population the floor grades.
    expect(section).not.toContain("under the narrow MOBILE_CONTROL_SELECTOR population");
  });

  it("every selector identifier the vacuity section's prose names still exists as a real exported binding (a fossil predicate name fails loudly)", () => {
    const identifiers = selectorIdentifiersIn(vacuitySectionText(ROSTER_TEXT));
    expect(identifiers.length).toBeGreaterThan(0);
    for (const id of identifiers) {
      const existsAsExport = id in RenderSweepLib || id in RenderSweep;
      expect(existsAsExport, `${id} is not exported from scripts/render-sweep-lib.ts or scripts/render-sweep.ts -- a fossil predicate name`).toBe(true);
    }
  });

  it("PUBLIC_MOBILE_VACUOUS_NARROW_FLOOR's own comment in scripts/render-sweep-lib.ts names INTERACTIVE_CONTROL_SELECTOR, never re-introduces the retired MOBILE_CONTROL_SELECTOR as the population it grades", () => {
    const libSrc = readFileSync(join(REPO_ROOT, "scripts", "render-sweep-lib.ts"), "utf8");
    const declIdx = libSrc.indexOf("export const PUBLIC_MOBILE_VACUOUS_NARROW_FLOOR");
    expect(declIdx).toBeGreaterThan(-1);
    // The JSDoc block immediately preceding the declaration -- from the last
    // `/**` before declIdx to declIdx itself.
    const commentStart = libSrc.lastIndexOf("/**", declIdx);
    const comment = libSrc.slice(commentStart, declIdx);
    expect(comment).toContain("INTERACTIVE_CONTROL_SELECTOR");
    expect(comment).toContain("retired");
  });
});
