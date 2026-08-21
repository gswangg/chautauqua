// DEC-851 amendment (wave 27, task w27-a): "a live offender COUNT is not a
// finding until every offender is NAMED -- the admin-390 roster is the
// blocking gate's missing half". This scan reads the roster this task wrote
// (docs/design/audit/admin-390-interactive-offenders-w27.md) and checks it
// against the tree, never against a hand-copied second population:
//   - the roster's own recorded total is what its own rows sum to
//     (self-consistency -- the roster cannot silently drift from its table)
//   - every route it names is a REAL member of ADMIN_MOBILE_ROUTE_MANIFEST,
//     imported from scripts/render-sweep.ts, never hand-listed (DEC-180)
//   - the recorded total is <= ADMIN_MOBILE_INTERACTIVE_OFFENDERS_CEILING,
//     imported from scripts/render-sweep-lib.ts, never copied as a literal
//   - a vacuity tripwire: the parsed roster is non-empty, so a row-format
//     drift that silently parses to zero rows cannot pass by accident.
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { DEC_851 } from "../src/decisions";
import { ADMIN_MOBILE_ROUTE_MANIFEST } from "../scripts/render-sweep";
import { ADMIN_MOBILE_INTERACTIVE_OFFENDERS_CEILING } from "../scripts/render-sweep-lib";

void DEC_851; // this scan's whole reason to exist: naming the gate's 79/80 offenders

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

/** The roster's own recorded grand total, from its "Measured total: **N**"
 * line -- the receipt this scan checks the parsed rows' sum against, so a
 * hand-edit to one without the other cannot pass silently. */
function recordedTotal(markdown: string): number {
  const m = markdown.match(/Measured total: \*\*(\d+)\*\*/);
  if (!m) throw new Error("admin-390-offender-roster: no 'Measured total: **N**' line found in roster");
  return Number(m[1]);
}

const RECORDED_TOTAL = recordedTotal(ROSTER_TEXT);

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

describe("admin-390-offender-roster (DEC-851 amendment, wave 27)", () => {
  it("parses a non-empty roster (vacuity tripwire)", () => {
    expect(ROSTER_ROWS.length).toBeGreaterThan(0);
  });

  it("the roster's own recorded total equals the sum of its own parsed rows", () => {
    const summed = ROSTER_ROWS.reduce((acc, r) => acc + r.count, 0);
    expect(summed).toBe(RECORDED_TOTAL);
  });

  it("the recorded total is <= ADMIN_MOBILE_INTERACTIVE_OFFENDERS_CEILING (never raised by this task)", () => {
    expect(RECORDED_TOTAL).toBeLessThanOrEqual(ADMIN_MOBILE_INTERACTIVE_OFFENDERS_CEILING);
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
});
