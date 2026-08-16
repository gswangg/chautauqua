// DEC-518 (wave 42 amendment): the /docs/api endpoint table is a cross-file
// manifest of the router and must be DERIVED-CHECKED in both directions,
// never hand-mirrored. src/routes/docs-endpoints.ts is the single source
// (docs.tsx renders from it, nothing else hand-types a row); this scan
// diffs its API_DOC_ENDPOINTS against the real /api/v1 registrations found
// by test/helpers/registered-routes.ts's enumerateRegisteredRoutes() (the
// same source-text scanner test/pubcache-purge-classification.test.ts
// uses), in both directions:
//   - every documented row must match a live registration
//   - every live /api/v1 registration must be documented OR named, with a
//     reason, in DOCS_OMITTED below (and every DOCS_OMITTED row must itself
//     still match a live registration -- a stale omission fails as loudly
//     as an undocumented route)
//
// Detection logic is a pure function, findDocsManifestProblems(live,
// documented, omitted), fed a synthetic violating case and a synthetic
// compliant case (field guide: A PROOF NOBODY HAS SHOWN A VIOLATION TO IS
// NOT A PROOF).

import { describe, expect, it } from "vitest";
import { enumerateRegisteredRoutes, type RegisteredRoute } from "./helpers/registered-routes";
import { API_DOC_ENDPOINTS, type ApiDocEndpoint } from "../src/routes/docs-endpoints";

export interface DocsOmittedEntry {
  method: string;
  path: string;
  reason: string;
}

/** Normalizes a Hono `:param` (including regex-constrained forms like
 * `:kind{[^/]+}`) and this repo's friendlier `:paramName` docs spelling to
 * the same bare `:param` token so the two sides compare equal regardless of
 * the exact identifier or constraint used. */
function normalizePath(path: string): string {
  return path
    .split("?")[0]!
    .replace(/:([A-Za-z0-9_]+)(\{[^}]*\})?/g, ":param");
}

function toLiveKeys(live: { method: string; path: string }[]): Set<string> {
  return new Set(live.map((r) => `${r.method} ${normalizePath(r.path)}`));
}

/** Pure classifier: given the live /api/v1 registrations, the documented
 * manifest, and the omission ledger, returns one problem string per defect
 * found. Empty array = clean. Never mutates its inputs. */
export function findDocsManifestProblems(
  live: { method: string; path: string }[],
  documented: { method: string; path: string }[],
  omitted: DocsOmittedEntry[],
): string[] {
  const problems: string[] = [];
  const liveKeys = toLiveKeys(live);
  const documentedKeys = new Set(documented.map((r) => `${r.method} ${normalizePath(r.path)}`));
  const omittedKeys = new Set(omitted.map((r) => `${r.method} ${normalizePath(r.path)}`));

  for (const entry of omitted) {
    if (!entry.reason || entry.reason.trim().length === 0) {
      problems.push(`DOCS_OMITTED entry ${entry.method} ${entry.path} has no reason`);
    }
    const key = `${entry.method} ${normalizePath(entry.path)}`;
    if (!liveKeys.has(key)) {
      problems.push(`DOCS_OMITTED entry ${entry.method} ${entry.path} does not match any live registration (stale omission)`);
    }
  }

  for (const r of live) {
    const key = `${r.method} ${normalizePath(r.path)}`;
    if (!documentedKeys.has(key) && !omittedKeys.has(key)) {
      problems.push(`Live registration ${r.method} ${r.path} is undocumented and not in DOCS_OMITTED`);
    }
  }

  for (const r of documented) {
    const key = `${r.method} ${normalizePath(r.path)}`;
    if (!liveKeys.has(key)) {
      problems.push(`Documented row ${r.method} ${r.path} does not match any live registration (stale doc row)`);
    }
  }

  return problems;
}

// Closed, reasoned ledger of live /api/v1 registrations deliberately not
// printed as a docs row. Every row must (a) name a reason and (b) still
// resolve to a real registration -- enforced by the scan below, not by
// convention.
//
// NOTE: GET /api/v1 (the {name, version} meta endpoint) is registered on
// `app` directly inside src/server/app.ts's createBaseApp(), which
// enumerateRegisteredRoutes() deliberately does not scan (it walks
// src/routes/** + src/index.ts only) -- it is real at runtime but outside
// this scan's population, so it is neither documented nor listed here.
const DOCS_OMITTED: DocsOmittedEntry[] = [];

describe("src/routes/docs-endpoints.ts API_DOC_ENDPOINTS vs the real /api/v1 router (DEC-518)", () => {
  const live: RegisteredRoute[] = enumerateRegisteredRoutes().filter((r) => r.path.startsWith("/api/v1"));

  it("finds at least 100 live /api/v1 registrations (scanner floor tripwire)", () => {
    expect(live.length).toBeGreaterThanOrEqual(100);
  });

  it("documents at least 80 rows (manifest floor tripwire)", () => {
    expect(API_DOC_ENDPOINTS.length).toBeGreaterThanOrEqual(80);
  });

  it("every documented row matches a live registration, and every live registration is documented or reasoned in DOCS_OMITTED (both directions)", () => {
    const problems = findDocsManifestProblems(live, API_DOC_ENDPOINTS, DOCS_OMITTED);
    expect(problems, `Docs manifest drift found:\n${problems.join("\n")}`).toEqual([]);
  });

  it("every DOCS_OMITTED entry names a non-empty reason", () => {
    for (const entry of DOCS_OMITTED) {
      expect(entry.reason.trim().length, `${entry.method} ${entry.path} has no reason`).toBeGreaterThan(0);
    }
  });
});

describe("findDocsManifestProblems: pure classifier negative control", () => {
  const cleanLive = [
    { method: "GET", path: "/api/v1/widgets" },
    { method: "POST", path: "/api/v1/widgets" },
  ];
  const cleanDocumented: ApiDocEndpoint[] = [
    { method: "GET", path: "/api/v1/widgets", role: "organizer", group: "Widgets" },
    { method: "POST", path: "/api/v1/widgets", role: "organizer", group: "Widgets" },
  ];

  it("reports no problems for a fully-matched, fully-documented set (compliant snippet)", () => {
    expect(findDocsManifestProblems(cleanLive, cleanDocumented, [])).toEqual([]);
  });

  it("reports an undocumented-route violation when a live registration has no documented row and no omission (violating snippet)", () => {
    const liveWithExtra = [...cleanLive, { method: "DELETE", path: "/api/v1/widgets/:id" }];
    const problems = findDocsManifestProblems(liveWithExtra, cleanDocumented, []);
    expect(problems.some((p) => p.includes("DELETE /api/v1/widgets/:id") && p.includes("undocumented"))).toBe(true);
  });

  it("reports a stale-doc-row violation when a documented row has no matching live registration", () => {
    const documentedWithStale: ApiDocEndpoint[] = [
      ...cleanDocumented,
      { method: "GET", path: "/api/v1/ghost", role: "organizer", group: "Widgets" },
    ];
    const problems = findDocsManifestProblems(cleanLive, documentedWithStale, []);
    expect(problems.some((p) => p.includes("GET /api/v1/ghost") && p.includes("stale doc row"))).toBe(true);
  });

  it("reports a stale-omission violation when a DOCS_OMITTED row no longer matches a live registration", () => {
    const staleOmission: DocsOmittedEntry[] = [{ method: "GET", path: "/api/v1/vanished", reason: "was internal" }];
    const problems = findDocsManifestProblems(cleanLive, cleanDocumented, staleOmission);
    expect(problems.some((p) => p.includes("GET /api/v1/vanished") && p.includes("stale omission"))).toBe(true);
  });

  it("reports a missing-reason violation when a DOCS_OMITTED row has an empty reason", () => {
    const unreasoned: DocsOmittedEntry[] = [{ method: "GET", path: "/api/v1/widgets", reason: "" }];
    const problems = findDocsManifestProblems(cleanLive, cleanDocumented, unreasoned);
    expect(problems.some((p) => p.includes("no reason"))).toBe(true);
  });

  it("normalizes param names so :id and :widgetId compare equal", () => {
    const liveParam = [{ method: "GET", path: "/api/v1/widgets/:id" }];
    const documentedParam: ApiDocEndpoint[] = [
      { method: "GET", path: "/api/v1/widgets/:widgetId", role: "organizer", group: "Widgets" },
    ];
    expect(findDocsManifestProblems(liveParam, documentedParam, [])).toEqual([]);
  });
});
