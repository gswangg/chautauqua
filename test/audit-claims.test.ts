// DEC-618: docs/AUDIT.md's route claims are enumerated by a test, not
// maintained by hand. Every `/...` route path AUDIT.md names in backticks
// must resolve against the route manifest the render-sweep gate already
// enumerates (app/src/routeManifest.ts's ROUTE_MANIFEST, walked by
// scripts/render-sweep.ts); and every route in that manifest must either be
// mentioned in AUDIT.md or be listed in the EXCLUDED set below with a
// comment explaining why not. Hand-listed manifests desync — this test is
// what keeps the document honest as routes are added/removed.
//
// DEC-618 wave-30 amendment: a second, independent direction below (see
// "cap claims vs live constants") parses every `` `NAME`=<number> `` cap
// claim in docs/AUDIT.md and checks it two ways: every claim whose NAME is
// a known constant must equal that constant's live value (catches a number
// going stale), and every known constant must be named at least once in the
// document (catches a claim being quietly deleted instead of corrected).
// What this direction does NOT check: prose describing HOW a cap is
// enforced (e.g. "before the true cap runs on the expanded list") is read
// by a human, not this test — only the literal `` `NAME`=<number> `` pairs
// are mechanically verified. A constant this test doesn't know about (one
// not added to CAP_CONSTANTS below) is invisible to it; adding a new cap
// claim to AUDIT.md without also adding its constant here will not fail
// loudly, which is why every constant AUDIT.md's own "No total that was not
// counted" bullet lists is imported and checked in both directions.

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { ROUTE_MANIFEST, type RouteManifestEntry } from "../app/src/routeManifest";
import { app as composedApp } from "../src/index";
import { EXPORT_KINDS } from "../src/server/repo/exports/kinds";
import { DEFAULT_PER_PAGE, MAX_PER_PAGE } from "../src/lib/pagination";
import { MAX_REMINDER_BATCH } from "../src/domain/reminders";
import { MAX_COMPOSE_RECIPIENTS } from "../src/domain/compose";
import { MAX_AUTO_SCHEDULE_PLACEMENTS } from "../src/server/repo/agenda/auto-schedule";
import { MAX_PUBLIC_PAGE } from "../src/server/repo/public/bounds";
import { MAX_CONTACT_DIRECTORY_SCAN } from "../src/server/repo/contacts/rows";
import { MAX_IMPORT_ROWS } from "../src/server/repo/contacts/import";

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
const EXCLUDED = new Set<string>([]);

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

// DEC-618 amendment (wave 7): the J12 section's export-kind list drifted
// from EXPORT_KINDS (src/server/repo/exports/kinds.ts) more than once —
// hand-listing the kinds in prose desyncs the same way route claims did.
// This asserts the J12 section names every kind in backticks and no
// backticked kind-shaped token that isn't actually in EXPORT_KINDS.

describe("docs/AUDIT.md J12 export-kind claims vs EXPORT_KINDS (DEC-618 amendment)", () => {
  const auditText = readFileSync(AUDIT_PATH, "utf-8");
  const lines = auditText.split("\n");
  const startIdx = lines.findIndex((l) => l.trim().startsWith("## J12"));
  if (startIdx === -1) {
    throw new Error('docs/AUDIT.md has no "## J12" section');
  }
  const rest = lines.slice(startIdx + 1);
  const endIdx = rest.findIndex((l) => l.startsWith("## "));
  const j12Section = (endIdx === -1 ? rest : rest.slice(0, endIdx)).join("\n");

  // Every backtick span in the section that is exactly one of EXPORT_KINDS,
  // or that LOOKS like a kind token (a bare lowercase-hyphen word, no
  // slashes/spaces) but isn't a real kind -- the latter is what catches a
  // stale/typo'd kind name.
  const backtickTokens = [...j12Section.matchAll(/`([^`]+)`/g)].map((m) => m[1]!);
  const kindShapedTokens = backtickTokens.filter((t) => /^[a-z][a-z-]*$/.test(t));

  it("EXPORT_KINDS is non-empty (sanity: these checks would be vacuous otherwise)", () => {
    expect(EXPORT_KINDS.length).toBeGreaterThan(0);
  });

  it("every EXPORT_KINDS value is named in backticks in the J12 section", () => {
    const missing = EXPORT_KINDS.filter((k) => !backtickTokens.includes(k));
    expect(
      missing,
      `docs/AUDIT.md's J12 section does not name export kind(s) in backticks: ${missing.join(", ")}`,
    ).toEqual([]);
  });

  it("no backticked kind-shaped token in the J12 section names a kind absent from EXPORT_KINDS", () => {
    const bogus = kindShapedTokens.filter((t) => !(EXPORT_KINDS as readonly string[]).includes(t));
    expect(
      bogus,
      `docs/AUDIT.md's J12 section names backticked token(s) that look like export kinds but ` +
        `are not in EXPORT_KINDS (src/server/repo/exports/kinds.ts): ${bogus.join(", ")}`,
    ).toEqual([]);
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

/** Every registered route pattern in the composed app for `method`, deduped.
 * Generalized (DEC-618 wave-34 amendment) so the `METHOD /path` direction
 * below reuses this same enumeration technique instead of writing a second
 * one. */
function enumerateComposedPatterns(method: string): string[] {
  const patterns = new Set<string>();
  for (const route of composedApp.routes) {
    if (route.method !== method) continue;
    patterns.add(route.path);
  }
  return Array.from(patterns).sort();
}

function enumerateComposedGetPatterns(): string[] {
  return enumerateComposedPatterns("GET");
}

// Routes this test deliberately does not require a ROUTE_MANIFEST entry
// for, each with a reason. Only two reasons are admissible here (DEC-985):
// (a) "renders no HTML" -- the route provably never renders HTML (binary/
// JSON/ICS payload, or a route that only ever 302-redirects), or (b) "not
// idempotently visitable" -- a genuine one-shot/consuming route (e.g. a
// single-use token) that a render sweep cannot safely visit twice without
// burning seed data. Every other route gets a ROUTE_MANIFEST entry so
// gate:render-sweep actually visits it -- an EXCLUDED entry is never a
// parking space for a route someone just hasn't wired up yet.
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
      "Not idempotently visitable -- invite-claim tokens are single-use, so an idempotent render sweep can't safely visit one without burning seed data.",
  },
  {
    pattern: "/reset/:token",
    reason:
      "Not idempotently visitable -- DEC-014's wave-25 amendment makes password-reset grants single-use and 1h-lived, so a render sweep can't visit one without burning it. The sibling /forgot form IS in ROUTE_MANIFEST.",
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

// DEC-618 wave-30 amendment (DEC-618, this wave's ruling): every
// `` `NAME`=<number> `` cap claim in docs/AUDIT.md is checked against the
// real constant it names, mechanically — not restated from memory and not
// left to drift silently when a claim is deleted instead of corrected. See
// the file header above for exactly what this direction does and does not
// check.

type CapClaim = { name: string; value: number };

/** Every `` `NAME`=<number> `` occurrence anywhere in `markdown`, e.g.
 * `` `MAX_PER_PAGE`=200 ``. NAME is whatever backtick-wrapped identifier
 * immediately precedes a bare `=<integer>` — this is deliberately not
 * anchored to any one section, so a cap claim restated or moved elsewhere
 * in the document is still caught. */
function extractCapClaims(markdown: string): CapClaim[] {
  const claims: CapClaim[] = [];
  const re = /`([A-Z][A-Z0-9_]*)`=(\d+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(markdown))) {
    claims.push({ name: m[1]!, value: Number(m[2]) });
  }
  return claims;
}

// `ROW_CAP` (src/server/repo/overview.ts) is a deliberately unexported
// module-private const -- no other file in this codebase reaches across
// that boundary to read it, and this test does not add a new one. Its live
// value is instead read the same way this file's own routeExists/
// symbolExists checks already read source facts they can't import: a plain
// text scan of the declaring file, anchored to the literal `const ROW_CAP =`
// declaration so a future rename or value edit is still caught.
function readRowCapFromSource(): number {
  const path = resolve(REPO_ROOT, "src/server/repo/overview.ts");
  const text = readFileSync(path, "utf-8");
  const m = /const ROW_CAP = (\d+);/.exec(text);
  if (!m) {
    throw new Error(`could not find "const ROW_CAP = <number>;" in ${path} (declaration moved or renamed?)`);
  }
  return Number(m[1]);
}

// The full set of cap constants this test knows how to check live, keyed by
// the exact `NAME` docs/AUDIT.md uses in backticks. Every entry here must
// also be named at least once in docs/AUDIT.md as a literal `` `NAME`=<n> ``
// claim (checked below) -- this is not a one-directional "claims must match
// constants" test, it is also "constants must still be claimed". Note:
// `MAX_PUBLIC_ROWS` is deliberately NOT included here -- docs/AUDIT.md
// states it as the formula `MAX_PUBLIC_ROWS = MAX_PUBLIC_PAGE *
// PUBLIC_PER_PAGE`, never as a literal `` `MAX_PUBLIC_ROWS`=<number> ``
// claim, so it is outside this direction's `NAME`=<number> pattern by
// construction (its factors, `MAX_PUBLIC_PAGE` and `PUBLIC_PER_PAGE`, are
// what would need their own literal claims to be checked this way).
const CAP_CONSTANTS: Record<string, number> = {
  DEFAULT_PER_PAGE,
  MAX_PER_PAGE,
  MAX_REMINDER_BATCH,
  ROW_CAP: readRowCapFromSource(),
  MAX_COMPOSE_RECIPIENTS,
  MAX_AUTO_SCHEDULE_PLACEMENTS,
  MAX_PUBLIC_PAGE,
  MAX_CONTACT_DIRECTORY_SCAN,
  MAX_IMPORT_ROWS,
};

describe("docs/AUDIT.md cap claims vs live constants (DEC-618 wave-30 amendment)", () => {
  const auditText = readFileSync(AUDIT_PATH, "utf-8");
  const lines = auditText.split("\n");
  const claims = extractCapClaims(auditText);

  /** 1-based line number of the first cap claim found for `name`, for a
   * useful failure message (a bare "value mismatch" with no line number
   * would send a reader hunting through a 350-line document). */
  function lineOf(name: string, value: number): number {
    const needle = `\`${name}\`=${value}`;
    const idx = lines.findIndex((l) => l.includes(needle));
    return idx === -1 ? -1 : idx + 1;
  }

  it("parses at least 6 cap claims (tripwire: a regex change must not silently swallow the population)", () => {
    expect(claims.length).toBeGreaterThanOrEqual(6);
  });

  it("every cap claim whose NAME is a known constant equals that constant's live value", () => {
    const mismatches = claims
      .filter((c) => c.name in CAP_CONSTANTS)
      .filter((c) => c.value !== CAP_CONSTANTS[c.name])
      .map((c) => `docs/AUDIT.md:${lineOf(c.name, c.value)} claims \`${c.name}\`=${c.value}, live value is ${CAP_CONSTANTS[c.name]}`);
    expect(mismatches).toEqual([]);
  });

  it("every known cap constant is named at least once in docs/AUDIT.md (a deleted claim goes stale silently otherwise)", () => {
    const claimedNames = new Set(claims.map((c) => c.name));
    const unclaimed = Object.keys(CAP_CONSTANTS).filter((name) => !claimedNames.has(name));
    expect(unclaimed, `constant(s) never named as a \`NAME\`=<number> claim in docs/AUDIT.md: ${unclaimed.join(", ")}`).toEqual(
      [],
    );
  });
});

// DEC-618 wave-34 amendment: extractBacktickRoutePaths above only extracts a
// backtick span STARTING with '/', so a `` `METHOD /path` `` span (e.g.
// `` `POST /admin/content-notes` ``) was never checked against anything —
// a claim naming a route that plain doesn't exist could sit in the document
// undetected. This is a second, independent direction: every backtick span
// of the shape `METHOD /path` is resolved against the COMPOSED app's own
// registered route table (composedApp.routes, via enumerateComposedPatterns
// above — the same enumeration technique the DEC-679 direction already
// uses, not a second hand-written one), with dynamic segments normalized so
// a claim's param NAME need not match the route file's param name (":id"
// and ":eventId" both just mean "some dynamic segment" here, same
// reasoning as patternMatchesManifestPath above).

type MethodRouteClaim = { method: string; path: string; raw: string };

const METHOD_ROUTE_RE = /`(GET|POST|PUT|PATCH|DELETE) (\/[^`]*)`/g;

/** Every `` `METHOD /path` `` backtick span in `markdown`. */
function extractMethodRouteClaims(markdown: string): MethodRouteClaim[] {
  const claims: MethodRouteClaim[] = [];
  let m: RegExpExecArray | null;
  const re = new RegExp(METHOD_ROUTE_RE);
  while ((m = re.exec(markdown))) {
    claims.push({ method: m[1]!, path: m[2]!, raw: m[0]! });
  }
  return claims;
}

/** Replaces every dynamic Hono segment (one starting with ":") with a
 * single normalized marker, so ":id" and ":eventId" compare equal. */
function normalizeDynamicSegments(path: string): string {
  return path
    .split("/")
    .map((seg) => (seg.startsWith(":") ? ":param" : seg))
    .join("/");
}

describe("docs/AUDIT.md `METHOD /path` claims resolve against the composed app (DEC-618 wave-34 amendment)", () => {
  const auditText = readFileSync(AUDIT_PATH, "utf-8");
  const claims = extractMethodRouteClaims(auditText);
  const auditLines = auditText.split("\n");

  const METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE"];
  const composedByMethod = new Map<string, Set<string>>(
    METHODS.map((method) => [
      method,
      new Set(enumerateComposedPatterns(method).map(normalizeDynamicSegments)),
    ]),
  );

  it("parses at least 5 `METHOD /path` claims (tripwire: this direction would be vacuous otherwise)", () => {
    expect(claims.length).toBeGreaterThanOrEqual(5);
  });

  it("every `METHOD /path` claim resolves against a registered route in the composed app", () => {
    const unresolved = claims
      .filter((c) => !composedByMethod.get(c.method)!.has(normalizeDynamicSegments(c.path)))
      .map((c) => {
        const lineIdx = auditLines.findIndex((l) => l.includes(c.raw));
        const line = lineIdx === -1 ? "?" : lineIdx + 1;
        return `docs/AUDIT.md:${line} claims \`${c.raw}\`, but no such route is registered in the composed app`;
      });
    expect(unresolved).toEqual([]);
  });
});
