// DEC-618: docs/AUDIT.md's route claims are enumerated by a test, not
// maintained by hand. Every `/...` route path AUDIT.md names in backticks
// must resolve against the route manifest the render-sweep gate already
// enumerates (app/src/routeManifest.ts's ROUTE_MANIFEST, walked by
// scripts/render-sweep.ts); and every route in that manifest must either be
// mentioned in AUDIT.md or be listed in the EXCLUDED set below with a
// comment explaining why not. Hand-listed manifests desync — this test is
// what keeps the document honest as routes are added/removed.

import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { ROUTE_MANIFEST, type RouteManifestEntry } from "../app/src/routeManifest";

const AUDIT_PATH = resolve(dirname(fileURLToPath(import.meta.url)), "../docs/AUDIT.md");

// Manifest entries carry literal seed ids/slugs (e.g.
// "/admin/submissions/seed_submission_0001") so render-sweep can visit real
// data; AUDIT.md documents route *patterns* (e.g.
// "/admin/submissions/:id"). This turns one back into the other using the
// entry's own params map, the same provenance render-sweep relies on — never
// a second hand-written pattern list.
function normalize(entry: RouteManifestEntry): string {
  let path: string = entry.path;
  if (entry.params) {
    for (const [key, value] of Object.entries(entry.params)) {
      path = path.split(value).join(`:${key}`);
    }
  }
  return path;
}

/** Every `/...` token found inside a backtick span in `text`. The whole
 * backtick span is the token (not a whitespace-split sub-match), so a
 * mention like `` `POST /api/v1/events/:id/import/x` `` (a not-yet-mounted
 * API route, not part of ROUTE_MANIFEST) is deliberately NOT extracted —
 * only a backtick span that is itself exactly a path counts as a claim this
 * test can check. */
function extractBacktickRoutePaths(markdown: string): string[] {
  const found: string[] = [];
  const backtickRe = /`([^`]+)`/g;
  let m: RegExpExecArray | null;
  while ((m = backtickRe.exec(markdown))) {
    const content = m[1]!;
    if (content.startsWith("/")) found.push(content);
  }
  return found;
}

// Routes deliberately not named in AUDIT.md, with a reason each. Keep this
// list short and commented — anything added here is a route this test will
// no longer catch drifting.
const EXCLUDED = new Set<string>([
  // (none yet — every ROUTE_MANIFEST route is currently documented in
  // docs/AUDIT.md; add entries here only with a comment justifying the
  // omission, per DEC-618.)
]);

describe("docs/AUDIT.md route claims vs app/src/routeManifest.ts (DEC-618)", () => {
  const auditText = readFileSync(AUDIT_PATH, "utf-8");
  const manifestPatterns = new Set(ROUTE_MANIFEST.map(normalize));
  const auditPaths = extractBacktickRoutePaths(auditText);

  it("ROUTE_MANIFEST and AUDIT.md are both non-empty (sanity: these checks would be vacuous otherwise)", () => {
    expect(ROUTE_MANIFEST.length).toBeGreaterThan(0);
    expect(auditPaths.length).toBeGreaterThan(0);
  });

  it("every `/...` route path AUDIT.md names resolves against ROUTE_MANIFEST", () => {
    const unresolved = [...new Set(auditPaths)].filter((p) => !manifestPatterns.has(p));
    expect(
      unresolved,
      `docs/AUDIT.md names route path(s) not in app/src/routeManifest.ts (a slug that ` +
        `was not read): ${unresolved.join(", ")}`,
    ).toEqual([]);
  });

  it("every ROUTE_MANIFEST route is documented in AUDIT.md or explicitly EXCLUDED", () => {
    const mentioned = new Set(auditPaths);
    const undocumented = [...manifestPatterns].filter(
      (p) => !mentioned.has(p) && !EXCLUDED.has(p),
    );
    expect(
      undocumented,
      `app/src/routeManifest.ts has route(s) docs/AUDIT.md never mentions and that are ` +
        `not in this test's EXCLUDED set: ${undocumented.join(", ")}`,
    ).toEqual([]);
  });

  it("EXCLUDED never lists a route AUDIT.md already documents (no dead exclusions)", () => {
    const mentioned = new Set(auditPaths);
    const staleExclusions = [...EXCLUDED].filter((p) => mentioned.has(p));
    expect(staleExclusions).toEqual([]);
  });

  it("EXCLUDED only lists real ROUTE_MANIFEST patterns (no typo'd exclusion)", () => {
    const bogus = [...EXCLUDED].filter((p) => !manifestPatterns.has(p));
    expect(bogus).toEqual([]);
  });
});
