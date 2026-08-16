// DEC-583 wave-36 amendment: README.md's "## For evaluators" section is what
// an external grader types in verbatim -- the four persona email/password
// pairs, the seeded demo slug, and the Surface|Route table. Nothing checked
// any of it before this test: test/demo-identities.test.ts only covers
// src/lib/demo-identities.ts (three roles, speaker2 deliberately excluded
// there), and test/audit-claims.test.ts's route-resolution rule (DEC-618) is
// bound to docs/AUDIT.md, not README.md. Modelled on both: fixture parity in
// both directions (test/demo-identities.test.ts's technique) and backtick
// route extraction against ROUTE_MANIFEST with an exact-both-directions
// EXCLUDED set (test/audit-claims.test.ts's technique).

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import { ROUTE_MANIFEST, EVENT_SLUG } from "../app/src/routeManifest";
import { SURFACES } from "../src/routes/public/shell";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const README_PATH = resolve(REPO_ROOT, "README.md");

type FixtureIdentity = { email: string; password: string };

// ---------------------------------------------------------------------------
// Pure, exported parsing/checking functions -- unit-tested directly below
// with synthetic markdown (negative controls), then run against the real
// README.md.
// ---------------------------------------------------------------------------

/** Slices the named `## heading` section out of `markdown`, stopping at the
 * next top-level `## ` heading (or EOF). Throws if the heading is absent --
 * a missing section is an authoring bug, not a thing to silently skip. */
export function extractSection(markdown: string, heading: string): string {
  const lines = markdown.split("\n");
  const startIdx = lines.findIndex((l) => l.trim() === heading);
  if (startIdx === -1) {
    throw new Error(`README.md has no "${heading}" section`);
  }
  const rest = lines.slice(startIdx + 1);
  const endIdx = rest.findIndex((l) => l.startsWith("## "));
  return (endIdx === -1 ? rest : rest.slice(0, endIdx)).join("\n");
}

/** Parses a `| Persona | Email | Password |` markdown table out of
 * `section`, returning one row per data line (header + separator skipped).
 * Cells are expected to carry the email/password in backticks; the
 * backticks are stripped. */
export function parseCredentialsTable(section: string): { persona: string; email: string; password: string }[] {
  const rows: { persona: string; email: string; password: string }[] = [];
  const lines = section.split("\n");
  let inTable = false;
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed.startsWith("|")) {
      continue;
    }
    const cells = trimmed
      .split("|")
      .slice(1, -1)
      .map((c) => c.trim());
    if (cells.length < 3) continue;
    if (cells[0] === "Persona") {
      inTable = true;
      continue;
    }
    if (!inTable) continue;
    if (/^-+$/.test(cells[0]!.replace(/[^-]/g, "-")) && /^:?-+:?$/.test(cells[0]!)) {
      // markdown table separator row (e.g. "---|---|---")
      continue;
    }
    const stripBackticks = (s: string) => s.replace(/^`|`$/g, "");
    rows.push({
      persona: cells[0]!,
      email: stripBackticks(cells[1]!),
      password: stripBackticks(cells[2]!),
    });
  }
  return rows;
}

/** Both-directions check between parsed README credential rows and fixture
 * identities (keyed by role). Returns a list of human-readable error
 * strings naming the drifted cell; empty means the two sides match exactly
 * on (email, password) sets. */
export function checkCredentialParity(
  readmeRows: { persona: string; email: string; password: string }[],
  fixtureIdentities: Record<string, FixtureIdentity>,
): string[] {
  const errors: string[] = [];
  const readmeByEmail = new Map(readmeRows.map((r) => [r.email, r]));

  for (const [role, identity] of Object.entries(fixtureIdentities)) {
    const row = readmeByEmail.get(identity.email);
    if (!row) {
      errors.push(
        `fixture identity "${role}" (${identity.email}) has no matching row in README's credentials table`,
      );
      continue;
    }
    if (row.password !== identity.password) {
      errors.push(
        `README row for ${identity.email} has password "${row.password}", fixture identities.${role} has "${identity.password}"`,
      );
    }
  }

  const fixtureEmails = new Set(Object.values(fixtureIdentities).map((i) => i.email));
  for (const row of readmeRows) {
    if (!fixtureEmails.has(row.email)) {
      errors.push(`README credentials table has row for ${row.email}, which is not any fixture identity`);
    }
  }

  return errors;
}

/** Parses `Seeded demo event slug: \`<slug>\`` out of `section`. Throws if
 * absent (an authoring bug, not something to silently skip). */
export function parseSeededSlug(section: string): string {
  const m = /Seeded demo event slug:\s*`([^`]+)`/.exec(section);
  if (!m) {
    throw new Error('README "For evaluators" section has no "Seeded demo event slug: `...`" line');
  }
  return m[1]!;
}

/** Every backticked `/...` token found inside the `| Surface | Route |`
 * table in `section` -- restricted to that table (not the whole section),
 * matching the task's "every backticked /... token in the Surface|Route
 * table" instruction. */
export function extractRouteTokensFromTable(section: string): string[] {
  const lines = section.split("\n");
  const tableStart = lines.findIndex((l) => l.trim().startsWith("| Surface"));
  if (tableStart === -1) {
    throw new Error('README "For evaluators" section has no "| Surface | Route |" table');
  }
  const found: string[] = [];
  for (let i = tableStart; i < lines.length; i++) {
    const line = lines[i]!;
    if (i > tableStart && !line.trim().startsWith("|")) break;
    const backtickRe = /`([^`]+)`/g;
    let m: RegExpExecArray | null;
    while ((m = backtickRe.exec(line))) {
      const content = m[1]!;
      if (content.startsWith("/")) found.push(content);
    }
  }
  return found;
}

/** Substitutes `<event-slug>` -> `eventSlug` and, if `<surface>` is present,
 * `<surface>` -> each of `surfaces` in turn (producing one candidate literal
 * path per surface). A token with neither placeholder produces exactly one
 * candidate: itself. */
export function substituteRouteToken(token: string, eventSlug: string, surfaces: readonly string[]): string[] {
  const withSlug = token.split("<event-slug>").join(eventSlug);
  if (!withSlug.includes("<surface>")) {
    return [withSlug];
  }
  return surfaces.map((s) => withSlug.split("<surface>").join(s));
}

/** Checks every extracted route token against the manifest's literal path
 * set (README substitutes concrete values, never patterns, so a direct
 * literal-set membership check is the correct resolution rule here). A
 * token resolves iff EVERY one of its substituted candidates is a literal
 * ROUTE_MANIFEST path. Returns the list of tokens (original, unsubstituted
 * form) that fail to resolve. */
export function unresolvedRouteTokens(
  tokens: string[],
  eventSlug: string,
  surfaces: readonly string[],
  manifestLiteralPaths: ReadonlySet<string>,
): string[] {
  const unresolved: string[] = [];
  for (const token of new Set(tokens)) {
    const candidates = substituteRouteToken(token, eventSlug, surfaces);
    const allResolve = candidates.every((c) => manifestLiteralPaths.has(c));
    if (!allResolve) unresolved.push(token);
  }
  return unresolved;
}

// ---------------------------------------------------------------------------
// Tokens this test deliberately does not require a literal ROUTE_MANIFEST
// match for, each with a reason. Kept short and commented, like audit-
// claims.test.ts's EXCLUDED -- anything added here is a route this test no
// longer catches drifting.
// ---------------------------------------------------------------------------
const EXCLUDED = new Set<string>([
  // Bare /admin is never a literal ROUTE_MANIFEST entry -- only its
  // concrete children (/admin/overview, /admin/submissions, ...) and the
  // /admin/* wildcard are, matching test/audit-claims.test.ts's
  // HTML_ROUTE_EXCLUDED reasoning: bare /admin serves the identical
  // admin-SPA shell as /admin/*, so it's a real route but not a distinct
  // manifest literal.
  "/admin",
  // Calendar-export .ics feeds are binary/text feeds, not HTML pages the
  // render sweep visits, so they were never given ROUTE_MANIFEST entries
  // (mirrors test/audit-claims.test.ts's HTML_ROUTE_EXCLUDED entries for
  // the sibling /e/:eventSlug/schedule.ics and /e/:eventSlug/agenda.ics
  // patterns). The routes themselves are real and tested elsewhere.
  "/e/<event-slug>/schedule.ics",
  "/e/<event-slug>/agenda.ics",
  // The docs site's article route is a PATTERN, not a literal: docs.tsx's
  // PUBLIC_ROUTE_GROUPS registers `GET /docs/:slug` and
  // test/readme-evaluator-surfaces.test.ts requires the evaluator table to
  // carry that exact token, while ROUTE_MANIFEST holds only the concrete
  // articles it can actually render-sweep (/docs/start-here). Same shape as
  // bare /admin above: a real route whose children, not the pattern, are the
  // manifest literals.
  "/docs/:slug",
]);

describe("README.md 'For evaluators' block is a machine-checked grader contract (DEC-583 wave-36)", () => {
  const readmeText = readFileSync(README_PATH, "utf-8");
  const section = extractSection(readmeText, "## For evaluators");
  const manifestLiteralPaths = new Set(ROUTE_MANIFEST.map((e) => e.path));

  it("the 'For evaluators' section is non-empty (sanity)", () => {
    expect(section.length).toBeGreaterThan(0);
  });

  describe("credentials table vs docs/fixtures/sample-data.json identities", () => {
    const fixture = JSON.parse(
      readFileSync(resolve(REPO_ROOT, "docs/fixtures/sample-data.json"), "utf-8"),
    ) as { identities: Record<string, FixtureIdentity> };
    const rows = parseCredentialsTable(section);

    it("parses a non-trivial number of rows (sanity)", () => {
      expect(rows.length).toBeGreaterThan(0);
    });

    it("has exactly one row per fixture identity, matching email and password in both directions", () => {
      const errors = checkCredentialParity(rows, fixture.identities);
      expect(errors, errors.join("\n")).toEqual([]);
    });

    it("covers all four fixture roles (organizer, speaker, speaker2, reviewer)", () => {
      expect(Object.keys(fixture.identities).sort()).toEqual(
        ["organizer", "reviewer", "speaker", "speaker2"].sort(),
      );
      expect(rows.length).toBe(Object.keys(fixture.identities).length);
    });
  });

  describe("seeded demo slug vs EVENT_SLUG (app/src/routeManifest.ts)", () => {
    it("matches EVENT_SLUG exactly", () => {
      expect(parseSeededSlug(section)).toBe(EVENT_SLUG);
    });
  });

  describe("Surface|Route table vs ROUTE_MANIFEST", () => {
    const tokens = extractRouteTokensFromTable(section);

    it("extracts a non-trivial number of route tokens (sanity)", () => {
      expect(tokens.length).toBeGreaterThan(5);
    });

    it("every extracted route token resolves against ROUTE_MANIFEST or is EXCLUDED", () => {
      const unresolved = unresolvedRouteTokens(tokens, EVENT_SLUG, SURFACES, manifestLiteralPaths);
      const unexplained = unresolved.filter((t) => !EXCLUDED.has(t));
      expect(
        unexplained,
        `route token(s) in README's Surface|Route table that don't resolve against ` +
          `app/src/routeManifest.ts and aren't in this test's EXCLUDED set: ${unexplained.join(", ")}`,
      ).toEqual([]);
    });

    it("EXCLUDED is exact: every excluded token is actually unresolved (no dead exclusion)", () => {
      const unresolved = new Set(unresolvedRouteTokens(tokens, EVENT_SLUG, SURFACES, manifestLiteralPaths));
      const stale = [...EXCLUDED].filter((t) => tokens.includes(t) && !unresolved.has(t));
      expect(stale, `EXCLUDED entry no longer needed (now resolves): ${stale.join(", ")}`).toEqual([]);
    });

    it("EXCLUDED never lists a token absent from the table (no typo'd exclusion)", () => {
      const bogus = [...EXCLUDED].filter((t) => !tokens.includes(t));
      expect(bogus, `EXCLUDED lists token(s) not found in README's table: ${bogus.join(", ")}`).toEqual([]);
    });
  });
});

// ---------------------------------------------------------------------------
// Negative controls: the parsers/checkers are pure functions, so a synthetic
// input with a known defect must be REPORTED, proving the checks aren't
// vacuously green.
// ---------------------------------------------------------------------------
describe("negative controls (pure functions correctly report synthetic drift)", () => {
  it("a wrong password in a README row is reported by checkCredentialParity", () => {
    const fixtureIdentities: Record<string, FixtureIdentity> = {
      organizer: { email: "org@example.com", password: "correct-pw" },
    };
    const readmeRows = [{ persona: "Organizer", email: "org@example.com", password: "WRONG-pw" }];
    const errors = checkCredentialParity(readmeRows, fixtureIdentities);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some((e) => e.includes("org@example.com"))).toBe(true);
  });

  it("a fixture identity missing from the README table is reported", () => {
    const fixtureIdentities: Record<string, FixtureIdentity> = {
      organizer: { email: "org@example.com", password: "pw" },
      speaker2: { email: "speaker2@example.com", password: "pw2" },
    };
    const readmeRows = [{ persona: "Organizer", email: "org@example.com", password: "pw" }];
    const errors = checkCredentialParity(readmeRows, fixtureIdentities);
    expect(errors.some((e) => e.includes("speaker2"))).toBe(true);
  });

  it("a README row not present in the fixture is reported", () => {
    const fixtureIdentities: Record<string, FixtureIdentity> = {
      organizer: { email: "org@example.com", password: "pw" },
    };
    const readmeRows = [
      { persona: "Organizer", email: "org@example.com", password: "pw" },
      { persona: "Ghost", email: "ghost@example.com", password: "pw" },
    ];
    const errors = checkCredentialParity(readmeRows, fixtureIdentities);
    expect(errors.some((e) => e.includes("ghost@example.com"))).toBe(true);
  });

  it("a synthetic route absent from ROUTE_MANIFEST is reported by unresolvedRouteTokens", () => {
    const manifestLiteralPaths = new Set(["/e/devflow-conf-2027/sessions", "/login"]);
    const tokens = ["/login", "/e/<event-slug>/nonexistent-surface"];
    const unresolved = unresolvedRouteTokens(tokens, "devflow-conf-2027", ["sessions"], manifestLiteralPaths);
    expect(unresolved).toEqual(["/e/<event-slug>/nonexistent-surface"]);
  });

  it("a <surface> token only resolves when EVERY surface variant is present in the manifest", () => {
    const manifestLiteralPaths = new Set(["/embed/devflow-conf-2027/sessions"]);
    const tokens = ["/embed/<event-slug>/<surface>"];
    const unresolved = unresolvedRouteTokens(
      tokens,
      "devflow-conf-2027",
      ["sessions", "speakers"],
      manifestLiteralPaths,
    );
    expect(unresolved).toEqual(["/embed/<event-slug>/<surface>"]);
  });

  it("parseSeededSlug throws when the slug line is absent (fail loudly, not a silent default)", () => {
    expect(() => parseSeededSlug("no slug line here")).toThrow();
  });

  it("extractSection throws when the heading is absent", () => {
    expect(() => extractSection("# Title\n\nbody", "## Missing")).toThrow();
  });
});
