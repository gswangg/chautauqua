// DEC-962 (wave-63 amendment): "every mutator reachable in one hop from
// src/routes/portal/** either names a scope column beyond its own primary
// key, or appears in a ledger whose reasons are STRUCTURAL ... never a
// branch note, and the population is derived by walking the imports, never
// hand-listed (DEC-367/DEC-808)."
//
// The population is derived as a PROPERTY, not a hand-listed set: every
// value identifier NAMED-imported by a file under src/routes/portal/** from
// a specifier that resolves into src/server/repo/** (following pure
// re-export barrels — e.g. src/server/repo/portal.ts, src/server/repo/
// tasks.ts, src/server/repo/files.ts, src/server/repo/submissions.ts are
// all barrels with no writes of their own — to the file that actually
// DECLARES the function, since that's what "the repo module it touches"
// means once indirection is followed), whose declaring function body issues
// a `db.update(schema.X)` / `db.delete(schema.X)` statement.
//
// Each such statement's `.where(...)` must name a `schema.<Table>.<column>`
// reference beyond the row's own primary key (`id`), or the whole function
// must sit in the named EXEMPTIONS ledger below with a STRUCTURAL reason.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROUTES_ROOT = join(HERE, "..", "src", "routes", "portal");
const REPO_ROOT = join(HERE, "..", "src", "server", "repo");

/** Every source file under `root`, excluding test files. */
function allSourceFiles(root: string, extRe: RegExp): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(root, { withFileTypes: true, recursive: true })) {
    if (!entry.isFile()) continue;
    if (!extRe.test(entry.name)) continue;
    if (entry.name.includes(".test.")) continue;
    out.push(join(entry.parentPath, entry.name));
  }
  return out.sort();
}

// -----------------------------------------------------------------------
// Step 1: from every src/routes/portal/**/*.{ts,tsx} file, read its import
// statements and collect every named (non-type) VALUE import whose
// specifier resolves into src/server/repo/**.
// -----------------------------------------------------------------------

interface RepoImport {
  name: string; // the ORIGINAL exported identifier (pre-`as` alias)
  specifierFile: string; // the file the import specifier itself resolves to
}

const IMPORT_BLOCK_RE = /import\s*\{([\s\S]*?)\}\s*from\s*["']([^"']+)["']/g;

/** Resolves a relative import specifier from `fromFile` to an absolute file
 * path, the same way Node/TS module resolution would (file before
 * directory index) -- a plain existence check, not a fallback (this is the
 * allowed "file existence check" boundary, not error-swallowing). */
function resolveSpecifier(fromFile: string, specifier: string): string | null {
  if (!specifier.startsWith(".")) return null; // not a relative import
  const base = join(dirname(fromFile), specifier);
  const candidates = [`${base}.ts`, `${base}.tsx`, join(base, "index.ts"), join(base, "index.tsx")];
  for (const c of candidates) {
    let isFile = false;
    try {
      isFile = statSync(c).isFile();
    } catch {
      isFile = false;
    }
    if (isFile) return c;
  }
  return null;
}

function extractRepoImports(file: string, src: string): RepoImport[] {
  const out: RepoImport[] = [];
  for (const m of src.matchAll(IMPORT_BLOCK_RE)) {
    const body = m[1] as string;
    const specifier = m[2] as string;
    const resolved = resolveSpecifier(file, specifier);
    if (!resolved) continue;
    if (!resolved.startsWith(REPO_ROOT + sep) && resolved !== REPO_ROOT) continue;
    for (const rawEntry of body.split(",")) {
      const entry = rawEntry.trim();
      if (!entry) continue;
      if (entry.startsWith("type ")) continue; // type-only import: no runtime code
      // "Name" or "Name as Local" -- the DECLARED name is what we search for.
      const name = (entry.split(/\s+as\s+/)[0] as string).trim();
      if (!name || name.startsWith("type ")) continue;
      out.push({ name, specifierFile: resolved });
    }
  }
  return out;
}

// -----------------------------------------------------------------------
// Step 2: find, across src/server/repo/**/*.ts, the file that DECLARES each
// exported function name -- this is what "resolve the repo module it
// touches" means once a barrel (a file that only re-exports) is involved:
// following a pure re-export is resolving indirection, not adding a hop of
// insight, the same way `export * from "./x"` is a transparent alias.
// -----------------------------------------------------------------------

interface FoundFn {
  file: string;
  name: string;
  body: string;
}

const EXPORTED_FN_RE = /export\s+(?:async\s+)?function\s+([A-Za-z0-9_]+)\s*\(/g;

/** Extracts every top-level exported function's name + body text from a
 * source file, by brace-depth counting from the declaration's first `{`
 * (never a naive regex over the whole file, which cannot know where one
 * function ends and the next begins, and must skip an inline object return
 * type's own braces). */
function extractExportedFunctions(src: string): { name: string; body: string }[] {
  const out: { name: string; body: string }[] = [];
  for (const m of src.matchAll(EXPORTED_FN_RE)) {
    const name = m[1] as string;
    const sigStart = (m.index ?? 0) + m[0].length;
    let depth = 1;
    let i = sigStart;
    while (i < src.length && depth > 0) {
      if (src[i] === "(") depth++;
      else if (src[i] === ")") depth--;
      i++;
    }
    let angleDepth = 0;
    let braceStart = -1;
    for (let k = i; k < src.length; k++) {
      const ch = src[k];
      if (ch === "<") angleDepth++;
      else if (ch === ">") angleDepth = Math.max(0, angleDepth - 1);
      else if (ch === "{" && angleDepth === 0) {
        braceStart = k;
        break;
      }
    }
    if (braceStart === -1) continue;
    let braceDepth = 1;
    let j = braceStart + 1;
    while (j < src.length && braceDepth > 0) {
      if (src[j] === "{") braceDepth++;
      else if (src[j] === "}") braceDepth--;
      j++;
    }
    out.push({ name, body: src.slice(braceStart, j) });
  }
  return out;
}

const REPO_FILES = allSourceFiles(REPO_ROOT, /\.ts$/);

/** name -> every (file, body) that declares an exported function of that
 * name across the whole repo tree. Built once, source-derived (no
 * hand-listing) -- this is how a barrel's indirection gets resolved to the
 * file that actually holds the write. */
const DECLARATIONS = new Map<string, FoundFn[]>();
for (const file of REPO_FILES) {
  const src = readFileSync(file, "utf-8");
  for (const { name, body } of extractExportedFunctions(src)) {
    const list = DECLARATIONS.get(name) ?? [];
    list.push({ file, name, body });
    DECLARATIONS.set(name, list);
  }
}

const ROUTE_FILES = allSourceFiles(ROUTES_ROOT, /\.tsx?$/);

// The population itself: every distinct (file, name) declaration reachable
// by name from a portal route file's repo-rooted import, whose body issues
// a schema write.
const WRITE_RE = /\.(update|delete)\(\s*schema\.[A-Za-z0-9_]+\s*\)/;

const POPULATION: FoundFn[] = [];
const seen = new Set<string>();
for (const routeFile of ROUTE_FILES) {
  const src = readFileSync(routeFile, "utf-8");
  for (const { name } of extractRepoImports(routeFile, src)) {
    const decls = DECLARATIONS.get(name);
    if (!decls) continue;
    for (const decl of decls) {
      if (!WRITE_RE.test(decl.body)) continue;
      const key = `${decl.file}::${decl.name}`;
      if (seen.has(key)) continue;
      seen.add(key);
      POPULATION.push(decl);
    }
  }
}

/** For one function body, every write STATEMENT: from each
 * `.update(schema.X)`/`.delete(schema.X)` match forward to the
 * statement-terminating `;` -- this codebase's chained-builder style never
 * nests a semicolon inside one such statement. */
function writeStatements(body: string): string[] {
  const out: string[] = [];
  const re = new RegExp(WRITE_RE, "g");
  for (const m of body.matchAll(re)) {
    const start = m.index ?? 0;
    const end = body.indexOf(";", start);
    out.push(end === -1 ? body.slice(start) : body.slice(start, end + 1));
  }
  return out;
}

/** A statement is scoped iff its `.where(...)` clause names at least one
 * `schema.<Table>.<column>` reference where `column !== 'id'` -- a scope
 * predicate beyond the row's own primary key. No `.where(` at all is never
 * scoped (a full-table write). */
function scopedBeyondOwnPk(statement: string): boolean {
  const whereIdx = statement.indexOf(".where(");
  if (whereIdx === -1) return false;
  const whereClause = statement.slice(whereIdx);
  const colRe = /schema\.[A-Za-z0-9_]+\.([A-Za-z0-9_]+)/g;
  for (const m of whereClause.matchAll(colRe)) {
    if (m[1] !== "id") return true;
  }
  return false;
}

// -----------------------------------------------------------------------
// Named exemption list — STRUCTURAL reasons only.
// -----------------------------------------------------------------------
interface Exemption {
  file: string;
  fn: string;
  reason: string;
}

const EXEMPTIONS: Exemption[] = [
  {
    file: join(REPO_ROOT, "portal-config.ts"),
    fn: "deleteFileRow",
    reason:
      "Deletes schema.file by fileId alone, but fileId is never taken from a request parameter at either of its two callers in the whole codebase: the portal upload-rollback path (src/routes/portal/tasks.tsx) passes a fileId this SAME request just minted via insertFile a few lines above; the admin resource-delete path (src/routes/api/portal-config.ts) passes a fileId read off an already org-scoped resource row (deleteResource). The id is always self-originated from a trusted prior step in the same request, never external input.",
  },
  {
    file: join(REPO_ROOT, "profile.ts"),
    fn: "updateContactProfile",
    reason:
      "Updates schema.contact where contact.id = contactId, and contactId is the caller's own identity (assertSpeakerContactId(auth)) at its only call site (src/routes/portal/profile.tsx) -- never a request param. The WHERE key IS the authenticated caller's identity: contact.id === auth.contactId, the same structural class as src/server/repo/portal-edit.ts's saveSubmissionEdits contact-update below.",
  },
  {
    file: join(REPO_ROOT, "profile.ts"),
    fn: "setContactHeadshot",
    reason:
      "Updates schema.contact where contact.id = contactId, and contactId is the caller's own identity (assertSpeakerContactId(auth)) at its only call site (src/routes/portal/profile.tsx) -- never a request param. Same structural class as updateContactProfile above.",
  },
  {
    file: join(REPO_ROOT, "portal-edit.ts"),
    fn: "saveSubmissionEdits",
    reason:
      "Issues two writes. The schema.submission update (src/server/repo/portal-edit.ts:258-270) already carries a correlated EXISTS-over-participant.contactId predicate in its own WHERE text and is detected as scoped by this very scan. The schema.contact update (src/server/repo/portal-edit.ts:312) has WHERE contact.id = contactId, where contactId is the caller's own identity (assertSpeakerContactId(auth) in src/routes/portal/edit.tsx) -- never a request param -- the same structural class as profile.ts's writers above.",
  },
];

describe("no repo write reachable one hop from src/routes/portal/** is missing its own scope predicate (DEC-962 wave-63 amendment)", () => {
  it("scanned more than 5 repo files and more than 3 portal route files", () => {
    expect(REPO_FILES.length).toBeGreaterThan(5);
    expect(ROUTE_FILES.length).toBeGreaterThan(3);
  });

  it("every allowlist entry still names a live file", () => {
    for (const entry of EXEMPTIONS) {
      expect(() => statSync(entry.file), `exempted file no longer exists: ${entry.file}`).not.toThrow();
    }
  });

  it("the population is non-empty", () => {
    expect(POPULATION.length).toBeGreaterThan(0);
  });

  it("every exempted (file, fn) pair is actually present in the population", () => {
    const present = new Set(POPULATION.map((p) => `${p.file}::${p.name}`));
    for (const entry of EXEMPTIONS) {
      expect(
        present.has(`${entry.file}::${entry.fn}`),
        `exemption ${relative(HERE, entry.file)}::${entry.fn} no longer issues a portal-reachable write -- remove the entry`,
      ).toBe(true);
    }
  });

  it("every population member either scopes beyond its own primary key, or is named in the exemption list", () => {
    const exemptSet = new Set(EXEMPTIONS.map((e) => `${e.file}::${e.fn}`));
    const offenders: string[] = [];
    for (const fn of POPULATION) {
      if (exemptSet.has(`${fn.file}::${fn.name}`)) continue;
      const statements = writeStatements(fn.body);
      const allScoped = statements.length > 0 && statements.every(scopedBeyondOwnPk);
      if (!allScoped) offenders.push(`${relative(HERE, fn.file)}::${fn.name}`);
    }
    expect(offenders, `unscoped, unexempted portal-reachable writers:\n${offenders.join("\n")}`).toEqual([]);
  });

  // Positive control: the two functions this DEC amendment names by line
  // number ARE in the population and ARE now scoped -- proves the detector
  // isn't vacuously passing everything.
  it("positive control: saveTaskFormResponse/saveTaskFileCompletion are in the population and scoped on contactId", () => {
    const targets = POPULATION.filter(
      (p) => p.file.endsWith(join("repo", "portal", "tasks.ts")) && (p.name === "saveTaskFormResponse" || p.name === "saveTaskFileCompletion"),
    );
    expect(targets.map((t) => t.name).sort()).toEqual(["saveTaskFileCompletion", "saveTaskFormResponse"]);
    for (const t of targets) {
      const statements = writeStatements(t.body);
      expect(statements.length).toBeGreaterThan(0);
      expect(statements.every(scopedBeyondOwnPk)).toBe(true);
    }
  });

  // Positive control: the two other real finds this task closed (setInviteStatus,
  // updateAssignmentStatus) are also in the population and scoped.
  it("positive control: setInviteStatus and updateAssignmentStatus are in the population and scoped", () => {
    const invite = POPULATION.find((p) => p.name === "setInviteStatus");
    const status = POPULATION.find((p) => p.name === "updateAssignmentStatus");
    expect(invite).toBeDefined();
    expect(status).toBeDefined();
    expect(writeStatements(invite!.body).every(scopedBeyondOwnPk)).toBe(true);
    expect(writeStatements(status!.body).every(scopedBeyondOwnPk)).toBe(true);
  });

  // Negative control: a synthetic unscoped write (WHERE is a bare id) IS
  // reported unscoped by the same predicate this scan uses.
  it("negative control: a synthetic write whose WHERE is a bare id fails the matcher", () => {
    const fixtureSrc = `
export async function unscopedWrite(db: Db, x: string): Promise<void> {
  await db
    .update(schema.taskAssignment)
    .set({ status: "complete" })
    .where(eq(schema.taskAssignment.id, x));
}
`;
    const fns = extractExportedFunctions(fixtureSrc);
    expect(fns.map((f) => f.name)).toEqual(["unscopedWrite"]);
    const body = fns[0]!.body;
    expect(WRITE_RE.test(body)).toBe(true);
    const statements = writeStatements(body);
    expect(statements.length).toBe(1);
    expect(statements.every(scopedBeyondOwnPk)).toBe(false);
  });

  // Positive control (statement-shape): a synthetic SCOPED write (WHERE
  // names a column beyond the row's own id) IS recognized as scoped.
  it("positive control: a synthetic contactId-scoped write passes the matcher", () => {
    const fixtureSrc = `
export async function scopedWrite(db: Db, contactId: string, x: string): Promise<void> {
  await db
    .update(schema.taskAssignment)
    .set({ status: "complete" })
    .where(and(eq(schema.taskAssignment.id, x), eq(schema.taskAssignment.contactId, contactId)));
}
`;
    const fns = extractExportedFunctions(fixtureSrc);
    const body = fns[0]!.body;
    const statements = writeStatements(body);
    expect(statements.length).toBe(1);
    expect(statements.every(scopedBeyondOwnPk)).toBe(true);
  });

  // Vacuous-scan tripwire.
  it("vacuous-scan tripwire: the repo scan walked more than 10 files and found more than 3 portal-reachable writers", () => {
    expect(REPO_FILES.length).toBeGreaterThan(10);
    expect(POPULATION.length).toBeGreaterThan(3);
  });
});
