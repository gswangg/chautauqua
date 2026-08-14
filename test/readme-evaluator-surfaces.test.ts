// DEC-056 amendment (wave 71): README.md's "For evaluators" surface table is
// hand-maintained prose, same drift risk as docs.tsx's PUBLIC_ROUTE_GROUPS
// (test/docs-route-coverage.test.ts). This test parses that table straight
// from README.md, translates its `<event-slug>`/`<surface>` placeholders to
// the docs page's `:param` form, and requires every path in
// PUBLIC_ROUTE_GROUPS to be either listed there or in a small, named,
// reason-carrying exclusion set below — so a newly shipped public surface
// can't go undocumented for evaluators.

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { PUBLIC_ROUTE_GROUPS } from "../src/routes/docs";

const README_PATH = resolve(import.meta.dirname, "../README.md");

/** Extracts the `| Surface | Route |` markdown table under the "For
 * evaluators" heading, returning each row's Route cell (backtick-quoted
 * path, e.g. `` `/e/<event-slug>/sessions` ``). Deliberately narrow — a
 * table this can't find fails loudly rather than silently passing an empty
 * set. */
function parseEvaluatorTableRoutes(readme: string): string[] {
  const sectionStart = readme.indexOf("## For evaluators");
  if (sectionStart === -1) throw new Error('README.md has no "## For evaluators" section');
  const nextSection = readme.indexOf("\n## ", sectionStart + 1);
  const section = nextSection === -1 ? readme.slice(sectionStart) : readme.slice(sectionStart, nextSection);

  const tableHeaderIdx = section.indexOf("| Surface | Route |");
  if (tableHeaderIdx === -1) throw new Error('"For evaluators" section has no "| Surface | Route |" table');
  const afterHeader = section.slice(tableHeaderIdx);
  const allLines = afterHeader.split("\n");
  // Take only the CONSECUTIVE "|"-prefixed lines starting at the header —
  // stops at the table's first blank line so later unrelated tables further
  // down the same section (persona credentials, jobs) are never swept in.
  const tableLines: string[] = [];
  for (const l of allLines) {
    if (!l.startsWith("|")) break;
    tableLines.push(l);
  }
  // tableLines[0] = header, tableLines[1] = separator (|---|---|), rest = rows
  const rows = tableLines.slice(2);

  const routes: string[] = [];
  for (const line of rows) {
    const cells = line.split("|").map((c) => c.trim());
    // ["", "Surface", "Route", ""]
    const routeCell = cells[2];
    if (!routeCell) continue;
    const match = /^`([^`]+)`$/.exec(routeCell);
    if (!match || !match[1]) throw new Error(`Evaluator table Route cell isn't a single backtick-quoted path: "${routeCell}"`);
    routes.push(match[1]);
  }
  if (routes.length === 0) throw new Error("Parsed zero rows from the evaluator surface table");
  return routes;
}

/** Translates README's `<event-slug>`/`<surface>` placeholders to docs.tsx's
 * `:eventSlug`/`:surface` param spelling. */
function toDocsParamForm(path: string): string {
  return path.replace(/<event-slug>/g, ":eventSlug").replace(/<surface>/g, ":surface");
}

describe("README.md 'For evaluators' surface table vs docs.tsx PUBLIC_ROUTE_GROUPS", () => {
  const readme = readFileSync(README_PATH, "utf-8");
  const tableRoutes = new Set(parseEvaluatorTableRoutes(readme).map((r) => `GET ${toDocsParamForm(r)}`));

  // Legitimate, reason-carrying exclusions: surfaces real for evaluators but
  // deliberately not their own row in the table.
  const EXCLUDED = new Map<string, string>([
    // Bare event root is a redirect to its own sessions list row, not a
    // distinct content surface (see src/routes/public/*).
    ["GET /e/:eventSlug", "redirects to /e/:eventSlug/sessions, already a row"],
    // Per-id detail routes: the list-view rows above already cover the
    // surface; a specific id is not evaluator-navigable without visiting
    // the list first.
    ["GET /e/:eventSlug/sessions/:sessionId", "per-id detail route, reached from the sessions list row"],
    ["GET /e/:eventSlug/speakers/:contactId", "per-id detail route, reached from the speakers list row"],
    ["GET /embed/:eventSlug/sessions/:sessionId", "per-id detail route (embed twin), reached from the embed widget row"],
    ["GET /embed/:eventSlug/speakers/:contactId", "per-id detail route (embed twin), reached from the embed widget row"],
    // Machine-readable feed twins of the embeddable widget row, not a
    // separately evaluator-relevant surface.
    ["GET /embed/:eventSlug/:surface.json", "JSON feed twin of the embeddable widget row"],
    ["GET /embed/:eventSlug/:surface.xml", "XML feed twin of the embeddable widget row"],
    // Saved embed: id-keyed, only reachable via a copy-embed-code action in
    // the admin UI, not a surface an evaluator navigates to directly.
    ["GET /embed/e/:embedId", "saved-embed route, id-keyed and created from the admin UI"],
  ]);

  it("every PUBLIC_ROUTE_GROUPS path is in the evaluator table or a named exclusion", () => {
    const publicPaths = PUBLIC_ROUTE_GROUPS.flatMap((g) => g.rows).map((r) => `${r.method} ${r.path}`);
    const missing = publicPaths.filter((p) => !tableRoutes.has(p) && !EXCLUDED.has(p));
    expect(missing).toEqual([]);
  });

  it("every exclusion is still a real PUBLIC_ROUTE_GROUPS path (no stale exclusion)", () => {
    const publicPaths = new Set(PUBLIC_ROUTE_GROUPS.flatMap((g) => g.rows).map((r) => `${r.method} ${r.path}`));
    const stale = [...EXCLUDED.keys()].filter((p) => !publicPaths.has(p));
    expect(stale).toEqual([]);
  });

  it("no exclusion is also separately listed in the evaluator table (exclusions are genuinely absent)", () => {
    const doubled = [...EXCLUDED.keys()].filter((p) => tableRoutes.has(p));
    expect(doubled).toEqual([]);
  });
});
