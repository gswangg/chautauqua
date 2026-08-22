// DEC-851 amendment (wave 27, task w27-a): "a live offender COUNT is not a
// finding until every offender is NAMED -- the admin-390 roster is the
// blocking gate's missing half". This scan reads the roster this task wrote
// (docs/design/audit/admin-390-interactive-offenders-w27.md) and checks it
// against the tree, never against a hand-copied second population:
//   - every route it names is a REAL member of ADMIN_MOBILE_ROUTE_MANIFEST,
//     imported from scripts/render-sweep.ts, never hand-listed (DEC-180)
//   - the roster's own row table sums to EXACTLY
//     ADMIN_MOBILE_INTERACTIVE_OFFENDERS_CEILING, imported from
//     scripts/render-sweep-lib.ts, the ONE owner of the measured number
//     (DEC-996 wave-28 amendment: no separate "Measured total: **N**"
//     prose literal is parsed and cross-checked any more -- that was the
//     two-copies-joined-by-a-text-parser shape that let the roster and the
//     constant drift to 103 vs 77 in the same merge train, DEC-613)
//   - a vacuity tripwire: the parsed roster is non-empty, so a row-format
//     drift that silently parses to zero rows cannot pass by accident.
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { DEC_180, DEC_851, DEC_996 } from "../src/decisions";
import { ADMIN_MOBILE_ROUTE_MANIFEST } from "../scripts/render-sweep";
import { ADMIN_MOBILE_INTERACTIVE_OFFENDERS_CEILING, classifyAdminMobileOffender } from "../scripts/render-sweep-lib";
import { allCssFiles, hasExemptionForToken } from "../app/src/phone-tap-target-scan/core";

void DEC_851; // this scan's whole reason to exist: naming the gate's 79/80 offenders
void DEC_996; // DEC-996 wave-24 amendment: classifies every named offender EXEMPT/CANDIDATE
void DEC_180; // the exempt set below is DERIVED from the tree's own receipts, never hand-listed

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(HERE, "..");
const ROSTER_PATH = join(REPO_ROOT, "docs/design/audit/admin-390-interactive-offenders-w27.md");

const ROSTER_TEXT = readFileSync(ROSTER_PATH, "utf8");

/** One row of the roster's "Roster (grouped ...)" markdown table, parsed
 * from the pipe-delimited table body (skips the header row and the
 * `|---|---|` separator row). Route(s) is a literal cell that may itself
 * contain multiple routes joined by ", " (e.g. two manifest rows sharing a
 * path, or the dev/mailbox pair) -- split on ", " after stripping any
 * parenthetical qualifier, since the roster's own prose already explains
 * why a route repeats. */
interface RosterRow {
  routes: string[];
  count: number;
}

function parseRosterRows(markdown: string): RosterRow[] {
  const lines = markdown.split("\n");
  const rows: RosterRow[] = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed.startsWith("|")) continue;
    const cells = trimmed
      .split("|")
      .slice(1, -1)
      .map((c) => c.trim());
    if (cells.length < 5) continue;
    const rowNum = cells[0];
    if (!/^\d+$/.test(rowNum ?? "")) continue; // skips header + separator rows
    const routesCell = cells[1] ?? "";
    const countCell = cells[4] ?? "";
    const count = Number(countCell);
    if (!Number.isFinite(count) || count <= 0) continue;
    const routes = routesCell
      .replace(/\(×2[^)]*\)/g, "")
      .split(",")
      .map((r) => r.trim().replace(/^`|`$/g, ""))
      .map((r) => r.replace(/\s*\(.*\)\s*$/, "").trim())
      .filter((r) => r.startsWith("/"));
    rows.push({ routes, count });
  }
  return rows;
}

const ROSTER_ROWS = parseRosterRows(ROSTER_TEXT);

/** DEC-996 wave-28 amendment: the roster and the ceiling constant are now
 * ONE owner rather than two independently-typed copies joined by a text
 * parser (the DEC-613 shape the campaign applied to this exact constant
 * once before and lost, wave-85 amendment) -- this scan no longer parses a
 * separate "Measured total: **N**" prose literal out of the roster and
 * cross-checks it against the constant; it sums the roster's own per-row
 * table (real, structurally-checked audit content: every route a real
 * ADMIN_MOBILE_ROUTE_MANIFEST member, below) and compares THAT directly to
 * ADMIN_MOBILE_INTERACTIVE_OFFENDERS_CEILING, imported from the module
 * that owns the measurement. A hand-edit to one without the other cannot
 * pass silently: either the row table's own sum drifts from the imported
 * constant, or a route stops resolving against the manifest. */
const ROSTER_ROW_SUM = ROSTER_ROWS.reduce((acc, r) => acc + r.count, 0);

/** Every route path ADMIN_MOBILE_ROUTE_MANIFEST actually names, as a Set --
 * imported from source (scripts/render-sweep.ts), never hand-listed
 * (DEC-180: a hand-listed population is not a population). Manifest paths
 * can carry a dynamic segment (e.g. "/admin/submissions/:id") that the
 * roster instead names with a concrete seeded id
 * ("/admin/submissions/seed_submission_0001") -- exactMatchesManifestRoute
 * below accepts either the exact string or the manifest's own dynamic-
 * segment pattern. */
const MANIFEST_PATHS = new Set(ADMIN_MOBILE_ROUTE_MANIFEST.map((e) => e.path));

function routeMatchesManifest(route: string): boolean {
  if (MANIFEST_PATHS.has(route)) return true;
  for (const manifestPath of MANIFEST_PATHS) {
    if (!manifestPath.includes(":")) continue;
    const pattern = "^" + manifestPath.replace(/:[^/]+/g, "[^/]+") + "$";
    if (new RegExp(pattern).test(route)) return true;
  }
  return false;
}

// DEC-996 wave-24 amendment -----------------------------------------------
//
// The roster above names every sighting; this half CLASSIFIES each one
// EXEMPT (naming the receipt token that reaches it) or CANDIDATE, derived
// from the tree's own receipts, never hand-listed (DEC-180):
//   1. a `/* tap-floor-exempt: … */` CSS comment naming the class's own
//      rule — app/src/phone-tap-target-scan/core.ts's `hasExemptionForToken`
//      over every app/src/**/*.css and src/**/*.ts(x) file (the wordmark
//      idiom-1 receipt lives inside a `src/**` TS module, not a `.css`
//      file).
//   2. the `.chq-check-hit` wrapper idiom — `chq-check` is EXEMPT whenever
//      app/src/styles.css's own `.chq-check-hit` rule carries the 44px
//      floor (it does, in its one terminal `@media (max-width:700px)`
//      block).
// Both idioms are checked structurally against the tree on every run, never
// read from this roster's own prose — the roster's classification column is
// the POPULATION this scan checks its independent derivation against, not
// a source of truth it trusts.

/** Every *.ts/*.tsx file under `root` (test files excluded) — the src/**
 * counterpart to core.ts's allCssFiles, since some `tap-floor-exempt:`
 * receipts (e.g. `.chq-wordmark`, DEC-382) live inside `src/**` TS/TSX
 * modules' embedded CSS template strings, not `.css` files. */
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

/** DEC-996/DEC-180: derives the exempt class-token set for the given
 * candidate tokens by walking the tree's own receipts — never a hand-
 * written array. */
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

/** One row of the roster's "Roster (grouped ...)" markdown table, parsed
 * for its Selector / Box / Classification columns (a different parse of
 * the same table parseRosterRows above reads for Route(s)/Count — kept
 * separate since the two halves check different things against different
 * columns of the same table). */
interface RosterClassificationRow {
  selector: string;
  width: number;
  height: number;
  count: number;
  classification: "EXEMPT" | "CANDIDATE";
}

function parseRosterClassificationRows(markdown: string): RosterClassificationRow[] {
  const lineRe =
    /^\|\s*\d+\s*\|[^|]*\|\s*`([^`]+)`[^|]*\|\s*(\d+)×(\d+)\s*\|\s*(\d+)\s*\|\s*\*\*(EXEMPT|CANDIDATE)/gm;
  const rows: RosterClassificationRow[] = [];
  let m: RegExpExecArray | null;
  while ((m = lineRe.exec(markdown)) !== null) {
    rows.push({
      selector: m[1] ?? "",
      width: Number(m[2]),
      height: Number(m[3]),
      count: Number(m[4]),
      classification: (m[5] ?? "CANDIDATE") as "EXEMPT" | "CANDIDATE",
    });
  }
  return rows;
}

const ROSTER_CLASSIFICATION_ROWS = parseRosterClassificationRows(ROSTER_TEXT);

/** DEC-996/DEC-967 wave-24: two-sided ratchet on the CANDIDATE (non-exempt)
 * count this scan's own derivation measures, forced to -1 and the printed
 * rows read (DEC-967: a ceiling is measured by running the scan, never
 * invented) — every one of the 103 admin-390 sightings is EXEMPT by an
 * already-adjudicated receipt, so the honest candidate-defect count is 0. */
export const ADMIN_MOBILE_CANDIDATE_DEFECT_CEILING = 0;

describe("admin-390-offender-roster classification (DEC-996 wave-24 amendment)", () => {
  it("parses a non-empty set of classification rows from the hand roster (vacuity tripwire)", () => {
    expect(ROSTER_CLASSIFICATION_ROWS.length).toBeGreaterThan(0);
  });

  it("the derived classification agrees row-for-row with the hand roster's own classification column", () => {
    const candidateTokens = new Set<string>();
    for (const row of ROSTER_CLASSIFICATION_ROWS) {
      for (const m of row.selector.matchAll(/\.[a-zA-Z0-9_-]+/g)) candidateTokens.add(m[0].slice(1));
    }
    const exemptTokens = deriveExemptSelectors(candidateTokens);

    const disagreements: string[] = [];
    for (const row of ROSTER_CLASSIFICATION_ROWS) {
      const line = `${row.selector} w=${row.width}px h=${row.height}px`;
      const result = classifyAdminMobileOffender(line, exemptTokens);
      if (result.classification !== row.classification) {
        disagreements.push(
          `${row.selector} (roster says ${row.classification}, derived ${result.classification})`,
        );
      }
    }
    expect(disagreements).toEqual([]);
  });

  it(
    "the candidate-defect count this scan's own derivation measures is <= ADMIN_MOBILE_CANDIDATE_DEFECT_CEILING " +
      "(two-sided, forced to -1 and read)",
    () => {
      const candidateTokens = new Set<string>();
      for (const row of ROSTER_CLASSIFICATION_ROWS) {
        for (const m of row.selector.matchAll(/\.[a-zA-Z0-9_-]+/g)) candidateTokens.add(m[0].slice(1));
      }
      const exemptTokens = deriveExemptSelectors(candidateTokens);

      let candidateCount = 0;
      const candidateRows: string[] = [];
      for (const row of ROSTER_CLASSIFICATION_ROWS) {
        const line = `${row.selector} w=${row.width}px h=${row.height}px`;
        const result = classifyAdminMobileOffender(line, exemptTokens);
        if (result.classification === "CANDIDATE") {
          candidateCount += row.count;
          candidateRows.push(row.selector);
        }
      }
      expect(candidateCount, `candidate rows: ${candidateRows.join(", ")}`).toBeLessThanOrEqual(
        ADMIN_MOBILE_CANDIDATE_DEFECT_CEILING,
      );
      expect(candidateCount, "ADMIN_MOBILE_CANDIDATE_DEFECT_CEILING is stale above the measured count").toBe(
        ADMIN_MOBILE_CANDIDATE_DEFECT_CEILING,
      );
    },
  );

  it("synthetic control: an unreceipted selector classifies CANDIDATE, a receipted one classifies EXEMPT", () => {
    const exemptTokens = deriveExemptSelectors(new Set(["chq-check", "chq-w24i-never-receipted-anywhere"]));
    expect(exemptTokens.has("chq-w24i-never-receipted-anywhere")).toBe(false);
    expect(
      classifyAdminMobileOffender("input.chq-w24i-never-receipted-anywhere w=18px h=18px", exemptTokens),
    ).toEqual({ classification: "CANDIDATE" });
    expect(exemptTokens.has("chq-check")).toBe(true);
    expect(classifyAdminMobileOffender("input.chq-check w=18px h=18px", exemptTokens)).toEqual({
      classification: "EXEMPT",
      receipt: "chq-check",
    });
  });

  // Two-sided companion (DEC-808 wave-85 amendment), appended wave 28 when
  // DEC-808's wave-28 amendment registered this constant in
  // CAMPAIGN_CONSTANT_NAMES/TIER2_CEILING_NAMES and so pulled it into
  // test/campaign-ratchet-two-sided.scan.test.ts's derived population. The
  // exact-equality pin in the ceiling `it` above states both directions, but
  // that enforcer reads `it` bodies through its own brace-matching mask and
  // sees neither direction on it: its direction regexes end `\s*\)`, and the
  // pin above is formatted multi-line with a trailing comma before the close
  // paren (`ADMIN_MOBILE_CANDIDATE_DEFECT_CEILING,\n)`), which that pattern
  // cannot cross. Both directions are therefore restated here in single-line
  // form the enforcer reads -- appended, never by weakening the pin above.
  it("does not fall stale above ADMIN_MOBILE_CANDIDATE_DEFECT_CEILING (two-sided companion, DEC-808 wave-28)", () => {
    const candidateTokens = new Set<string>();
    for (const row of ROSTER_CLASSIFICATION_ROWS) {
      for (const m of row.selector.matchAll(/\.[a-zA-Z0-9_-]+/g)) candidateTokens.add(m[0].slice(1));
    }
    const exemptTokens = deriveExemptSelectors(candidateTokens);
    const candidateCount = ROSTER_CLASSIFICATION_ROWS.filter(
      (row) =>
        classifyAdminMobileOffender(`${row.selector} w=${row.width}px h=${row.height}px`, exemptTokens)
          .classification === "CANDIDATE",
    ).reduce((acc, row) => acc + row.count, 0);
    if (candidateCount < ADMIN_MOBILE_CANDIDATE_DEFECT_CEILING) {
      throw new Error(
        `Measured ${candidateCount} candidate defects, below the declared ceiling of ` +
          `${ADMIN_MOBILE_CANDIDATE_DEFECT_CEILING}. A ratchet may only be LOWERED; replace the line:\n` +
          `  export const ADMIN_MOBILE_CANDIDATE_DEFECT_CEILING = ${candidateCount};`,
      );
    }
    expect(candidateCount).toBeLessThanOrEqual(ADMIN_MOBILE_CANDIDATE_DEFECT_CEILING);
    expect(candidateCount).toBeGreaterThanOrEqual(ADMIN_MOBILE_CANDIDATE_DEFECT_CEILING);
  });
});

describe("admin-390-offender-roster (DEC-851 amendment, wave 27)", () => {
  it("parses a non-empty roster (vacuity tripwire)", () => {
    expect(ROSTER_ROWS.length).toBeGreaterThan(0);
  });

  it("every route the roster names is a real member of ADMIN_MOBILE_ROUTE_MANIFEST, imported from source", () => {
    expect(MANIFEST_PATHS.size).toBeGreaterThan(0);
    const unmatched: string[] = [];
    for (const row of ROSTER_ROWS) {
      for (const route of row.routes) {
        if (!routeMatchesManifest(route)) unmatched.push(route);
      }
    }
    expect(unmatched).toEqual([]);
  });

  it("at least one route in the roster is named more than once (the organizer/reviewer manifest double-count the roster's own prose explains)", () => {
    const allRoutes = ROSTER_ROWS.flatMap((r) => r.routes);
    const seen = new Set<string>();
    const duplicated = new Set<string>();
    for (const route of allRoutes) {
      if (seen.has(route)) duplicated.add(route);
      seen.add(route);
    }
    expect(duplicated.size).toBeGreaterThan(0);
  });

  // DEC-996 wave-28 amendment: ONE owner, not two independently-typed
  // copies joined by a text parser (the DEC-613 shape lost at the wave-85
  // amendment this replaces -- see the removed `recordedTotal()`/
  // `RECORDED_TOTAL` parse of the roster's own "Measured total: **N**"
  // prose line above). ADMIN_MOBILE_INTERACTIVE_OFFENDERS_CEILING
  // (scripts/render-sweep-lib.ts) is the module that owns the measurement;
  // this exact-equality pin against ROSTER_ROW_SUM is BOTH directions at
  // once (the two-sided-ratchet detector credits a single-`it`
  // exact-equality pin as two-sided, same shape as the pre-wave-13m pin
  // this restores) -- a roster edit that drops a row redlines this the same
  // way a roster edit that adds one does, and neither can be "fixed" by
  // silently moving the other number to match.
  it("the roster's own row table sums to exactly ADMIN_MOBILE_INTERACTIVE_OFFENDERS_CEILING (two-sided, DEC-996 wave-28 amendment)", () => {
    expect(
      ROSTER_ROW_SUM,
      `ROSTER_ROW_SUM = ${ROSTER_ROW_SUM} != ADMIN_MOBILE_INTERACTIVE_OFFENDERS_CEILING = ` +
        `${ADMIN_MOBILE_INTERACTIVE_OFFENDERS_CEILING} -- re-derive the population from the tree ` +
        `(npm run db:migrate && npm run seed && npm run gate:render-sweep) rather than editing either ` +
        `number to match the other; then update BOTH the roster's table and the constant from that run.`,
    ).toBe(ADMIN_MOBILE_INTERACTIVE_OFFENDERS_CEILING);
  });
});
