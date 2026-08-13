// DEC-618: docs/AUDIT.md's route claims are enumerated by a test, not
// maintained by hand. Every `/...` route path AUDIT.md names in backticks
// must resolve against the route manifest the render-sweep gate already
// enumerates (app/src/routeManifest.ts's ROUTE_MANIFEST, walked by
// scripts/render-sweep.ts); and every route in that manifest must either be
// mentioned in AUDIT.md or be listed in the EXCLUDED set below with a
// comment explaining why not. Hand-listed manifests desync — this test is
// what keeps the document honest as routes are added/removed.

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { ROUTE_MANIFEST, type RouteManifestEntry } from "../app/src/routeManifest";
import { app as composedApp } from "../src/index";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const AUDIT_PATH = resolve(REPO_ROOT, "docs/AUDIT.md");

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

// DEC-642: "A claim of absence is testable in exactly the way a claim of
// presence is: name the artefact (file / exported symbol / registered
// route) and assert it is not there." Every bullet in docs/AUDIT.md's
// "Deliberately not built" section carries an HTML-comment marker naming
// the artefact whose *existence* would falsify the bullet; this test
// resolves every marker against the tree and fails, naming the offending
// bullet, if the artefact turns out to actually be present.

type AbsenceMarker = { kind: string; value: string; raw: string };
type Bullet = { text: string; markers: AbsenceMarker[] };

const KNOWN_KINDS = new Set(["file", "symbol", "route"]);

/** Matches an absence-marker HTML comment on its own line, e.g.
 * `<!-- absent: file:src/foo.ts -->` or
 * `<!-- absent: symbol:Foo@src/foo.ts -->` or
 * `<!-- absent: route:GET /api/v1/x -->`. Captures the kind loosely (not
 * restricted to the three known kinds) so an unknown/typo'd kind is caught
 * by the "known kinds" assertion below rather than silently failing to
 * match. */
const MARKER_RE = /^<!--\s*absent:\s*([^\s:]+):(.+?)\s*-->\s*$/;

function extractSection(markdown: string, heading: string): string {
  const lines = markdown.split("\n");
  const startIdx = lines.findIndex((l) => l.trim() === heading);
  if (startIdx === -1) {
    throw new Error(`docs/AUDIT.md has no "${heading}" section`);
  }
  const rest = lines.slice(startIdx + 1);
  const endIdx = rest.findIndex((l) => l.startsWith("## "));
  return (endIdx === -1 ? rest : rest.slice(0, endIdx)).join("\n");
}

/** Walks a markdown section top to bottom, associating every HTML-comment
 * absence marker with the top-level bullet (`- **...`) that immediately
 * follows it. A marker with no following bullet, or a bullet with no
 * preceding marker, is a real authoring bug this parsing surfaces (rather
 * than silently dropping either side). */
function parseBullets(section: string): Bullet[] {
  const lines = section.split("\n");
  const bullets: Bullet[] = [];
  let pendingMarkers: AbsenceMarker[] = [];
  let current: Bullet | null = null;
  for (const line of lines) {
    const markerMatch = MARKER_RE.exec(line);
    if (markerMatch) {
      pendingMarkers.push({ kind: markerMatch[1]!, value: markerMatch[2]!, raw: line.trim() });
      continue;
    }
    if (/^- /.test(line)) {
      current = { text: line, markers: pendingMarkers };
      pendingMarkers = [];
      bullets.push(current);
      continue;
    }
    if (current && line.trim() !== "") {
      current.text += "\n" + line;
    }
  }
  return bullets;
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** True (artefact PRESENT, i.e. the absence claim is FALSE) if `path`
 * exists on disk relative to the repo root. */
function fileExists(path: string): boolean {
  return existsSync(resolve(REPO_ROOT, path));
}

/** True (artefact PRESENT) if `path` exists AND its source text contains an
 * `export` of `name` (function/const/class/interface/type, named or
 * re-exported) — a plain text check, not a TS program, matching the "plain
 * source scan" instruction for the route resolver below. */
function symbolExists(name: string, path: string): boolean {
  if (!fileExists(path)) return false;
  const text = readFileSync(resolve(REPO_ROOT, path), "utf-8");
  const exportRe = new RegExp(
    `export\\s+(default\\s+)?(async\\s+)?(function|const|class|interface|type|enum)\\s+${escapeRegExp(name)}\\b`,
  );
  const namedExportRe = new RegExp(`export\\s*\\{[^}]*\\b${escapeRegExp(name)}\\b[^}]*\\}`);
  return exportRe.test(text) || namedExportRe.test(text);
}

/** Every `.ts`/`.tsx` file under `dir`, recursively. */
function walkFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...walkFiles(full));
    } else if (/\.tsx?$/.test(entry.name)) {
      out.push(full);
    }
  }
  return out;
}

/** True (artefact PRESENT) if any file under src/routes registers
 * `METHOD path` as a literal Hono call, e.g. `.post("/events/:eventId/...")`.
 * A plain source scan (no router-enumeration helper): checks both the
 * marker's path as written and with a leading `/api/v1` stripped, since
 * route sub-apps register paths relative to their mount point. */
function routeExists(method: string, path: string): boolean {
  const routesDir = resolve(REPO_ROOT, "src/routes");
  const files = walkFiles(routesDir);
  const candidates = [path, path.replace(/^\/api\/v1/, "")];
  const methodRe = method.toLowerCase();
  for (const file of files) {
    const text = readFileSync(file, "utf-8");
    for (const candidate of candidates) {
      const re = new RegExp(`\\.${methodRe}\\(\\s*["'\`]${escapeRegExp(candidate)}["'\`]`);
      if (re.test(text)) return true;
    }
  }
  return false;
}

describe('docs/AUDIT.md "Deliberately not built" absence markers (DEC-642)', () => {
  const auditText = readFileSync(AUDIT_PATH, "utf-8");
  const section = extractSection(auditText, "## Deliberately not built (stage 1 scope, per SPEC §10 and `decisions/DEC-446.md`)");
  const bullets = parseBullets(section);
  const allMarkers = bullets.flatMap((b) => b.markers);

  it("the section is non-empty (sanity: these checks would be vacuous otherwise)", () => {
    expect(bullets.length).toBeGreaterThan(0);
  });

  it("parses at least as many markers as bullets, and every bullet carries at least one", () => {
    expect(allMarkers.length).toBeGreaterThanOrEqual(bullets.length);
    const unmarked = bullets.filter((b) => b.markers.length === 0);
    expect(
      unmarked.map((b) => b.text.slice(0, 60)),
      "bullet(s) with no absence marker",
    ).toEqual([]);
  });

  it("every marker's kind is one of file / symbol / route (an unknown kind is a typo)", () => {
    const bad = allMarkers.filter((m) => !KNOWN_KINDS.has(m.kind));
    expect(bad.map((m) => m.raw), "marker(s) with an unrecognized kind").toEqual([]);
  });

  it.each(bullets.map((b) => [b.text.slice(0, 70), b] as const))(
    "bullet %s: every absence marker's artefact does NOT exist",
    (_label, bullet) => {
      for (const marker of bullet.markers) {
        if (marker.kind === "file") {
          expect(fileExists(marker.value), `${marker.raw} — file exists but bullet claims absence`).toBe(
            false,
          );
        } else if (marker.kind === "symbol") {
          const [name, path] = marker.value.split("@");
          expect(name && path, `${marker.raw} — malformed symbol marker, expected Name@path`).toBeTruthy();
          expect(
            symbolExists(name!, path!),
            `${marker.raw} — symbol is exported but bullet claims absence`,
          ).toBe(false);
        } else if (marker.kind === "route") {
          const [method, ...pathParts] = marker.value.split(" ");
          const path = pathParts.join(" ");
          expect(method && path, `${marker.raw} — malformed route marker, expected "METHOD /path"`).toBeTruthy();
          expect(
            routeExists(method!, path!),
            `${marker.raw} — route is registered but bullet claims absence`,
          ).toBe(false);
        } else {
          throw new Error(`unreachable: unknown marker kind ${marker.kind}`);
        }
      }
    },
  );
});

// DEC-679: ROUTE_MANIFEST is hand-listed by design (its param values must
// resolve against real seed data — nothing can derive those), but its
// COVERAGE of the app's own routes must not be. This walks the REAL
// composed route table (`app` exported by src/index.ts, DEC-637 — the same
// enumeration technique test/anonymous-route-probe.test.ts (DEC-550) uses
// via app.routes) and asserts every registered GET route that renders HTML
// is either matched by a ROUTE_MANIFEST entry or explicitly named in
// HTML_ROUTE_EXCLUDED with a reason. This is what caught w12-c's
// /embed/:eventSlug/sessions/:sessionId + speakers/:contactId desync (DEC-
// 679's own text) — a future route added to a route file and never added
// to ROUTE_MANIFEST now fails HERE, by name, instead of gate:render-sweep
// silently never visiting it.

/** Whether a registered Hono PATTERN (":name" / ":name{regex}" segments
 * match any single path segment; a trailing bare "*" segment matches the
 * rest) matches one of ROUTE_MANIFEST's own concrete literal paths. This is
 * test/anonymous-route-probe.test.ts's literalFor/toRequestPath technique
 * run in the opposite direction: instead of inventing a literal FOR a
 * pattern, it checks whether a manifest entry's real seed-derived literal
 * resolves against the pattern — so coverage is checked against the
 * manifest's actual entries, never a second hand-written pattern list, and
 * is immune to a manifest entry using a different param NAME than the
 * route file does (e.g. ROUTE_MANIFEST's `speakerId` vs the route's own
 * `:contactId` — both are just "some dynamic segment" here). */
function patternMatchesManifestPath(pattern: string, concretePath: string): boolean {
  const pSegs = pattern.split("/");
  const cSegs = concretePath.split("/");
  if (pSegs[pSegs.length - 1] === "*") {
    const prefixLen = pSegs.length - 1;
    if (cSegs.length < prefixLen) return false;
    return pSegs.slice(0, prefixLen).every((seg, i) => seg.startsWith(":") || seg === cSegs[i]);
  }
  if (pSegs.length !== cSegs.length) return false;
  return pSegs.every((seg, i) => seg.startsWith(":") || seg === cSegs[i]);
}

/** Every registered GET route pattern in the composed app, deduped. */
function enumerateComposedGetPatterns(): string[] {
  const patterns = new Set<string>();
  for (const route of composedApp.routes) {
    if (route.method !== "GET") continue;
    patterns.add(route.path);
  }
  return Array.from(patterns).sort();
}

// Routes this test deliberately does not require a ROUTE_MANIFEST entry
// for, each with a reason. Two kinds of reason are legitimate here: (a) the
// route provably never renders HTML (binary/JSON/ICS payload, or a route
// that only ever 302-redirects), or (b) a genuine PRE-EXISTING gap this
// test surfaced that is out of task-w13-e's scope (DEC-679 names the
// /embed detail-route desync specifically) — flagged here for a follow-up
// task rather than silently left uncovered.
const HTML_ROUTE_EXCLUDED: { pattern: string; reason: string }[] = [
  {
    pattern: "/e/:eventSlug",
    reason: "DEC-661: always 302-redirects to /e/:slug/sessions -- never renders HTML itself.",
  },
  {
    pattern: "/embed/:eventSlug",
    reason: "DEC-661: always 302-redirects to /embed/:slug/sessions -- never renders HTML itself.",
  },
  {
    pattern: "/embed/:eventSlug/:surface{[a-z]+\\.json}",
    reason: "JSON embed data feed (EMB), not an HTML page.",
  },
  { pattern: "/e/:eventSlug/schedule.ics", reason: "iCalendar feed (DEC-007), not HTML." },
  { pattern: "/e/:eventSlug/agenda.ics", reason: "iCalendar feed (DEC-310), not HTML." },
  { pattern: "/dev/mailbox/:emailId/ics", reason: "iCalendar attachment download, not HTML." },
  { pattern: "/files/:fileId", reason: "Binary uploaded-file serve, not HTML." },
  { pattern: "/headshots/:fileId", reason: "Binary image serve, not HTML." },
  { pattern: "/portal/tasks/:assignmentId/file", reason: "Binary uploaded-file serve, not HTML." },
  { pattern: "/portal/tasks/:assignmentId/file/:fileId", reason: "Binary uploaded-file serve, not HTML." },
  { pattern: "/portal/resources/:resourceId/download", reason: "Binary resource-file serve, not HTML." },
  {
    pattern: "/admin",
    reason:
      "Bare /admin serves the identical admin-SPA shell as /admin/* -- ROUTE_MANIFEST's concrete /admin/... entries (e.g. /admin/overview) already exercise that shell; visiting the bare route too is redundant, not a coverage gap.",
  },
  {
    pattern: "/claim/:token",
    reason:
      "PRE-EXISTING GAP, out of task-w13-e's scope (DEC-679 is the /embed detail-route desync only) -- invite-claim tokens are single-use, so an idempotent render sweep can't safely visit one without burning seed data. Flagged for a follow-up task, not silently swept under EXCLUDED as if it were fine.",
  },
  {
    pattern: "/",
    reason:
      "PRE-EXISTING GAP, out of task-w13-e's scope -- the SSR landing page (src/routes/root.tsx) is entirely missing from ROUTE_MANIFEST, so gate:render-sweep has never visited it. Flagged for a follow-up task.",
  },
  {
    pattern: "/dev/mailbox/:emailId",
    reason:
      "PRE-EXISTING GAP, out of task-w13-e's scope -- the single sent-email detail view has no ROUTE_MANIFEST entry (scripts/seed.ts does seed email_log rows this could resolve against). Flagged for a follow-up task.",
  },
  {
    pattern: "/portal/resources",
    reason:
      "PRE-EXISTING GAP, out of task-w13-e's scope -- the speaker-facing resources list page has no ROUTE_MANIFEST entry. Flagged for a follow-up task.",
  },
  {
    pattern: "/embed/e/:embedId",
    reason:
      "DEC-785 (task w3-d): the saved-embed public route, covered directly by test/saved-embed-route.test.ts (missing/disabled 404, enabled renders). No seeded `embed` row exists yet for ROUTE_MANIFEST to resolve a concrete literal against -- flagged for a follow-up task to seed one and add a manifest entry rather than silently left uncovered.",
  },
];

// API routes are JSON by construction (DEC-012), and /health is a JSON
// liveness probe defined inline in src/server/app.ts -- both filtered by
// this blanket rule rather than hand-listed one route at a time, so a new
// /api/v1/... route is automatically out of this HTML-coverage test's scope
// without anyone maintaining a second list.
function isKnownNonHtmlByPrefix(path: string): boolean {
  return path === "/health" || path === "/api/v1" || path.startsWith("/api/v1/");
}

describe("every registered GET route that renders HTML is in ROUTE_MANIFEST or HTML_ROUTE_EXCLUDED (DEC-679)", () => {
  const composedPatterns = enumerateComposedGetPatterns().filter((p) => !isKnownNonHtmlByPrefix(p));
  const manifestPaths = ROUTE_MANIFEST.map((e) => e.path);
  const excludedPatterns = new Set(HTML_ROUTE_EXCLUDED.map((e) => e.pattern));

  it("enumerates more than a trivial number of composed GET routes (sanity: this check would be vacuous otherwise)", () => {
    expect(composedPatterns.length).toBeGreaterThan(10);
  });

  it("every composed HTML-rendering GET route pattern is covered by ROUTE_MANIFEST or named in HTML_ROUTE_EXCLUDED", () => {
    const missing = composedPatterns.filter(
      (pattern) =>
        !excludedPatterns.has(pattern) && !manifestPaths.some((path) => patternMatchesManifestPath(pattern, path)),
    );
    expect(
      missing,
      `route pattern(s) registered in the app but neither resolved by any app/src/routeManifest.ts ` +
        `ROUTE_MANIFEST entry nor named in this file's HTML_ROUTE_EXCLUDED: ${missing.join(", ")} -- ` +
        `add a ROUTE_MANIFEST entry with a concrete seed literal (app/src/routeManifest.ts) so ` +
        `gate:render-sweep visits it, or add it to HTML_ROUTE_EXCLUDED here with a reason.`,
    ).toEqual([]);
  });

  it("every HTML_ROUTE_EXCLUDED entry still matches a currently-registered GET pattern (no stale exclusion)", () => {
    const stale = HTML_ROUTE_EXCLUDED.filter((e) => !composedPatterns.includes(e.pattern)).map((e) => e.pattern);
    expect(stale).toEqual([]);
  });
});
