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
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { DEC_180, DEC_808 } from "../src/decisions";
import { MOBILE_ROUTE_MANIFEST } from "../scripts/render-sweep";
import {
  PUBLIC_MOBILE_INTERACTIVE_OFFENDERS_CEILING,
  PUBLIC_MOBILE_VACUOUS_NARROW_FLOOR,
} from "../scripts/render-sweep-lib";

void DEC_808; // this scan's whole reason to exist: grading the public/portal 390 population for the first time
void DEC_180; // every route named below is a REAL member of MOBILE_ROUTE_MANIFEST, never hand-listed

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
