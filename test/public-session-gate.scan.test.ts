// DEC-274 (amendment wave 12) scan-lock: every source module reachable from
// the public/embed/feed route surface's static import closure that reads
// schema.submission must name visibleSessionConditions or
// visibleSubmissionConditions somewhere in the file, or be named in the
// hard-coded exemption map below with a stated, file-specific reason
// describing what that file ACTUALLY does.
//
// WHAT WAS WRONG BEFORE THIS AMENDMENT (verified against the tree at the
// time this amendment was written): this file used to root its population
// at a single non-recursive readdirSync of src/server/repo/public/. Its
// sibling for the OTHER half of the same DEC-274 split --
// test/participant-invite-audience.scan.test.ts -- walks all of src/ with a
// named exemption map. One decision, two scan-locks, two different ideas of
// the population; the directory-rooted one is the weak twin (field guide:
// A DIRECTORY IS NOT A POPULATION, DEC-367/DEC-808). `publiclyVisibleIds`
// (src/server/repo/agenda/payload.ts:192-203) is a genuine, CORRECT public-
// gate reader that lived outside the walked directory and was invisible to
// this scan -- an unwatched population, not a live leak. Nothing else has
// been found wrong; this amendment does not claim any additional defect.
//
// THE FIX: the population is DERIVED, not directory-rooted. The entry set
// is every relative import specifier in src/index.ts that starts with
// "./routes/public" (today: "./routes/public/submit" and "./routes/public"
// -- the two Hono sub-apps src/index.ts actually mounts for public/embed/
// feed traffic; saved-embed.tsx and feeds.ts already live inside
// src/routes/public/**, so no separate embed/feed root is needed). From
// those entries we walk the static import graph exactly the way
// test/module-reachability.scan.test.ts does: `import ... from`,
// `export ... from` and `import(...)` edges, resolved to a file on disk;
// `import type`/`export type` is NOT an edge (it erases at build time and
// confers no reachability). Every non-test, non-.css module in that closure
// is checked for a genuine schema.submission read.
import { describe, it, expect } from "vitest";
import { existsSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";

const REPO_ROOT = join(__dirname, "..");
const SRC_DIR = join(REPO_ROOT, "src");

// ---------------------------------------------------------------------------
// Entry derivation: every "./routes/public..." import specifier that
// src/index.ts (the Worker's own module, per wrangler.jsonc's "main") itself
// imports and mounts. Never hand-listed.
// ---------------------------------------------------------------------------

function stripTypeOnlyImportExport(source: string): string {
  return source
    .replace(/import\s+type\s*\{[^}]*\}\s*from\s*["'][^"']+["']\s*;?/g, "")
    .replace(/import\s+type\s+[A-Za-z_$][\w$]*\s*from\s*["'][^"']+["']\s*;?/g, "")
    .replace(/export\s+type\s*\{[^}]*\}\s*from\s*["'][^"']+["']\s*;?/g, "");
}

const IMPORT_FROM_RE = /import\s+(?:[^;]*?\s+from\s+)?["']([^"']+)["']/g;
const EXPORT_FROM_RE = /export\s+[^;]*?from\s*["']([^"']+)["']/g;
const DYNAMIC_IMPORT_RE = /import\(\s*["']([^"']+)["']\s*\)/g;

function extractSpecifiers(source: string): string[] {
  const valueOnly = stripTypeOnlyImportExport(source);
  const specs: string[] = [];
  for (const re of [IMPORT_FROM_RE, EXPORT_FROM_RE, DYNAMIC_IMPORT_RE]) {
    re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(valueOnly))) {
      if (m[1]) specs.push(m[1]);
    }
  }
  return specs;
}

const RESOLVE_SUFFIXES = [".ts", ".tsx", ".css", ".mjs", ".js"];

function resolveSpecifier(fromFile: string, spec: string): string | undefined {
  if (!spec.startsWith(".")) return undefined; // bare/external specifier -- not a repo module
  const dir = dirname(fromFile);
  const base = resolve(dir, spec);
  if (existsSync(base) && statSync(base).isFile()) return base;
  for (const suffix of RESOLVE_SUFFIXES) {
    if (existsSync(base + suffix)) return base + suffix;
  }
  for (const suffix of RESOLVE_SUFFIXES) {
    const indexPath = join(base, `index${suffix}`);
    if (existsSync(indexPath)) return indexPath;
  }
  return undefined;
}

function deriveEntryPoints(): string[] {
  const indexFile = join(SRC_DIR, "index.ts");
  const source = readFileSync(indexFile, "utf-8");
  const specs = extractSpecifiers(source).filter((s) => s.startsWith("./routes/public"));
  if (specs.length === 0) {
    throw new Error(
      "src/index.ts no longer imports anything from ./routes/public -- the public surface's entry set needs " +
        "re-deriving, not silently trusting a stale comment.",
    );
  }
  return specs.map((spec) => {
    const resolved = resolveSpecifier(indexFile, spec);
    if (!resolved) {
      throw new Error(`src/index.ts imports "${spec}" from ./routes/public, which doesn't resolve to a file.`);
    }
    return resolved;
  });
}

// ---------------------------------------------------------------------------
// Closure walk: every module statically reachable from the entry set (not
// just files under src/routes/public/** -- a public route's write/rollback
// path routinely reaches into src/server/repo/** modules that live
// elsewhere, and those are exactly the readers this scan must watch).
// ---------------------------------------------------------------------------

function walkReachable(entries: string[]): Set<string> {
  const seen = new Set<string>();
  const stack = [...entries];
  while (stack.length > 0) {
    const file = stack.pop()!;
    if (seen.has(file)) continue;
    seen.add(file);
    if (!existsSync(file)) continue;
    if (file.endsWith(".css")) continue; // CSS has no JS import statements to parse
    const source = readFileSync(file, "utf-8");
    for (const spec of extractSpecifiers(source)) {
      const resolved = resolveSpecifier(file, spec);
      if (resolved) stack.push(resolved);
    }
  }
  return seen;
}

const isTestFile = (f: string) => f.endsWith(".test.ts") || f.endsWith(".test.tsx");

const GATE_MARKERS = ["visibleSessionConditions", "visibleSubmissionConditions"];

const READ_PATTERNS = [
  /\.from\(schema\.submission\)/,
  /innerJoin\(\s*schema\.submission\b/,
  /leftJoin\(\s*schema\.submission\b/,
  /from\s*\$\{schema\.submission\}/,
];

function hasSubmissionRead(src: string): boolean {
  return READ_PATTERNS.some((re) => re.test(src));
}

function declaresGate(src: string): boolean {
  return GATE_MARKERS.some((marker) => src.includes(marker));
}

// Every module in the public-surface closure that has a genuine
// schema.submission read but is not (and, per its stated reason, should
// not be) gated by visibleSessionConditions/visibleSubmissionConditions.
// Each reason describes what the file at that path ACTUALLY does (read at
// the time this amendment was written), not a guess -- and is machine-
// checked for principle-shaped language by
// test/exemption-reason-is-a-principle.scan.test.ts (no wave numbers, no
// branch names, no "later wave", no TODO).
const EVERY_SESSION_GATE_EXEMPTION: Record<string, string> = {
  "src/server/repo/submit.ts":
    "the public submission write path itself: createSubmission INSERTs a new submission row then selects it back " +
    "by its own freshly-minted id to hand the caller { id, seq } (DEC-100's atomic seq subquery) -- a write " +
    "confirming its own row, not a visibility read.",
  "src/server/repo/submission-delete.ts":
    "organizer delete cascade, reached only through submit-post.tsx's rollback path (commitSubmissionDelete undoes " +
    "a just-created submission on a later step's failure) -- planSubmissionDelete/commitSubmissionDelete select and " +
    "delete rows by (eventId, an already-known id set), not a visibility-filtered listing.",
  "src/server/repo/contacts/crud.ts":
    "delete-reference check: listContactReferenceRows lists every submission a contact participates in so a delete " +
    "refusal can name them, regardless of session visibility -- reached via submit-post.tsx's deleteContact " +
    "rollback path, same file and same reason the participant-audience sibling scan already exempts it for.",
  "src/server/repo/comms.ts":
    "the J5 compose repo module (organizer email-compose data loading), pulled into the public closure only " +
    "because submit-post.tsx imports the unrelated findAccountUserId helper from it -- its own schema.submission " +
    "reads (loadComposeSubmissions and friends) are event-scoped admin compose queries, never reached from the " +
    "public request path.",
  "src/server/repo/review/submissions.ts":
    "the review-queue repo module (which submissions a plan/reviewer can see), pulled into the public closure " +
    "transitively via comms.ts -> review/evaluations.ts -> review/submissions.ts (comms.ts imports " +
    "submittedEvaluationCondition for compose eligibility) -- its listPlanFilteredSubmissions-style reads are " +
    "reviewer-scope queries, never reached from the public request path.",
  "src/server/repo/review/reviewers.ts":
    "the reviewer-scope repo module (plan_reviewer rows), pulled into the public closure transitively via " +
    "comms.ts -> review/evaluations.ts -> review/submissions.ts -> review/reviewers.ts -- its schema.submission " +
    "read resolves a reviewer-scope batch by id, never reached from the public request path.",
};

describe("public-session-gate scan (DEC-274, amendment wave 12)", () => {
  const entries = deriveEntryPoints();
  const reachable = walkReachable(entries);
  const closureModules = [...reachable].filter(
    (f) => (f.endsWith(".ts") || f.endsWith(".tsx")) && !isTestFile(f),
  );

  it("derived at least a plausible floor of entries and closure modules (the walk can't have silently narrowed)", () => {
    expect(entries.length).toBeGreaterThanOrEqual(2);
    expect(closureModules.length).toBeGreaterThanOrEqual(50);
  });

  it("every read-but-undeclared schema.submission-read module in the public closure is exactly the hard-coded exemption map", () => {
    const readUndeclared: string[] = [];
    for (const abs of closureModules) {
      const src = readFileSync(abs, "utf-8");
      if (hasSubmissionRead(src) && !declaresGate(src)) {
        readUndeclared.push(relative(REPO_ROOT, abs).split("\\").join("/"));
      }
    }
    readUndeclared.sort();
    const expected = Object.keys(EVERY_SESSION_GATE_EXEMPTION).sort();
    expect(readUndeclared).toEqual(expected);
  });

  it("every reason in the exemption map is a non-empty string", () => {
    for (const [, reason] of Object.entries(EVERY_SESSION_GATE_EXEMPTION)) {
      expect(typeof reason).toBe("string");
      expect(reason.trim().length).toBeGreaterThan(0);
    }
  });

  it("no exemption entry names a file that no longer exists", () => {
    for (const path of Object.keys(EVERY_SESSION_GATE_EXEMPTION)) {
      expect(existsSync(join(REPO_ROOT, path))).toBe(true);
    }
  });

  it("no exemption entry names a file that now declares a gate (a stale exemption fails loudly)", () => {
    for (const path of Object.keys(EVERY_SESSION_GATE_EXEMPTION)) {
      const src = readFileSync(join(REPO_ROOT, path), "utf-8");
      expect(declaresGate(src)).toBe(false);
    }
  });

  it("no exemption entry names a file outside the derived public closure (a stale entry from the old directory root)", () => {
    const reachableRel = new Set(closureModules.map((f) => relative(REPO_ROOT, f).split("\\").join("/")));
    for (const path of Object.keys(EVERY_SESSION_GATE_EXEMPTION)) {
      expect(reachableRel.has(path)).toBe(true);
    }
  });
});
