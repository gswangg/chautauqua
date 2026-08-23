// Generated repo-root artifact atomic-write scan (DEC-739 wave-46).
//
// scripts/seed.ts and scripts/perf-seed.ts publish generated artifacts
// (`.seed.sql`, `.seed-assets/manifest.json`, `.seed-assets/sample.pdf`,
// `.seed-assets/sample.png`, `.perf-seed.sql`) onto FIXED repo-root paths
// that SIXTEEN test files spawn `npx tsx scripts/seed.ts` and then
// readFileSync back, under vitest.fast.config.ts's uncapped `pool:
// "threads"`. A plain writeFileSync onto one of these paths is not atomic:
// a concurrent test worker can observe a truncated or mid-write file.
// scripts/lib/write-file-atomic.ts's writeFileAtomic (write-to-temp +
// renameSync, same directory) is the one fix; this scan is the ratchet
// that keeps every qualifying call site routed through it.
//
// SCOPE (deliberately narrow, flagged per the field guide's "narrowest
// reasonable interpretation" rule): "generated repo-root SQL artifacts"
// names files that live directly AT the repo root as dotfiles (or inside a
// dotfile directory at the repo root) -- exactly the shape that a fixed
// relative path (`.seed.sql`, `.seed-assets/...`) resolves to, and exactly
// the shape SIXTEEN spawning test files race on. `scripts/docs-shots.ts`
// (writes into `src/routes/docs-content/...`), `scripts/render-sweep.ts`
// (writes into `docs/design/audit/...`) and
// `scripts/assemble-verification-log.ts` (writes into `docs/...`, via a
// const literally named `ROOT`, not `REPO_ROOT`) all publish into ordinary
// tracked subdirectories, not repo-root dotfiles, and are not read back by
// any concurrent spawning test in this task's population -- out of scope.
//
// POPULATION (derived, never hand-listed): walk scripts/**/*.ts, find every
// `writeFileSync(` and `writeFileAtomic(` call site, resolve its first
// argument (a simple identifier) to the `const NAME = <expr>;` declaring it
// IN THE SAME FILE (module- or function-scoped -- scripts/seed.ts's
// PDF_PATH/PNG_PATH are function-scoped locals inside `main()`), and follow
// `join(X, "literal", ...)` chains until the base resolves to the literal
// identifier `REPO_ROOT` or gives up unresolved. A resolved chain is IN
// POPULATION iff its first segment after REPO_ROOT is a literal string
// starting with `.` (a repo-root dotfile or dotfile directory) -- this is
// what "publishes to the repo root" means for this ratchet.
//
// PREDICATE: a population member is an OFFENDER iff its call site is
// `writeFileSync(` rather than `writeFileAtomic(`.
//
// NON-VACUITY (DEC-967): the section below runs the exact same resolver
// function against two FABRICATED fixture files in a real mkdtempSync dir
// (never against the repo) -- one with a raw `writeFileSync` onto a
// REPO_ROOT-joined dotfile const (must be flagged) and one with the same
// shape routed through `writeFileAtomic` (must not be) -- plus a tripwire
// that the REAL population (walked over this repo's scripts/) is non-empty
// and spans at least two files.

import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { stripCommentsAndTemplateLiterals } from "./helpers/strip-template-literals";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT_DIR = join(HERE, "..");
const SCRIPTS_DIR = join(REPO_ROOT_DIR, "scripts");

// ---------------------------------------------------------------------------
// Resolver: shared by the real population walk and the fixture controls.
// ---------------------------------------------------------------------------

interface WriteCallSite {
  readonly file: string;
  readonly line: number;
  readonly fnName: "writeFileSync" | "writeFileAtomic";
  readonly targetConst: string;
}

/** Finds `const NAME = <expr up to the terminating `;`>;` anywhere in `src`
 * (module- or function-scoped) and returns a map of NAME -> expr text. */
function collectConstDecls(src: string): Map<string, string> {
  const map = new Map<string, string>();
  const re = /\bconst\s+([A-Za-z_$][\w$]*)\s*=\s*([^;]+);/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src)) !== null) {
    map.set(m[1]!, m[2]!.trim());
  }
  return map;
}

/** Resolves NAME's declaration, following `join(X, "literal", ...)` chains,
 * to a segment list whose first element is "REPO_ROOT" once the chain
 * bottoms out at the literal REPO_ROOT identifier. Returns null if the
 * chain can't be resolved (undeclared name, or a shape this resolver
 * doesn't understand). */
function resolveSegments(name: string, decls: Map<string, string>, depth = 0): string[] | null {
  if (depth > 10) return null;
  if (name === "REPO_ROOT") return ["REPO_ROOT"];
  const expr = decls.get(name);
  if (expr === undefined) return null;
  const joinMatch = /^join\(\s*([A-Za-z_$][\w$]*)\s*,\s*(.+)\)$/s.exec(expr);
  if (!joinMatch) return null;
  const [, baseIdent, restRaw] = joinMatch;
  const base = resolveSegments(baseIdent!, decls, depth + 1);
  if (base === null) return null;
  const literalRe = /"((?:[^"\\]|\\.)*)"|'((?:[^'\\]|\\.)*)'/g;
  const literals: string[] = [];
  let lm: RegExpExecArray | null;
  while ((lm = literalRe.exec(restRaw!)) !== null) {
    literals.push((lm[1] ?? lm[2])!);
  }
  return [...base, ...literals];
}

/** True iff `segments` is a resolved chain rooted at REPO_ROOT whose first
 * path segment is a dotfile/dotdir -- "publishes to the repo root" for this
 * ratchet's narrow scope (see file header SCOPE section). */
function isRepoRootDotPublish(segments: string[] | null): boolean {
  if (segments === null || segments.length < 2) return false;
  return segments[0] === "REPO_ROOT" && segments[1]!.startsWith(".");
}

/** Finds every `writeFileSync(IDENT` / `writeFileAtomic(IDENT` call site in
 * `src` (comments/template literals stripped first) whose first argument is
 * a simple identifier resolving to a repo-root dotfile/dotdir const. */
function findQualifyingCallSites(file: string, rawSrc: string): WriteCallSite[] {
  const decls = collectConstDecls(rawSrc);
  const stripped = stripCommentsAndTemplateLiterals(rawSrc);
  const out: WriteCallSite[] = [];
  const callRe = /\b(writeFileSync|writeFileAtomic)\(\s*([A-Za-z_$][\w$]*)/g;
  let m: RegExpExecArray | null;
  while ((m = callRe.exec(stripped)) !== null) {
    const fnName = m[1] as "writeFileSync" | "writeFileAtomic";
    const targetConst = m[2]!;
    const segments = resolveSegments(targetConst, decls);
    if (!isRepoRootDotPublish(segments)) continue;
    const line = stripped.slice(0, m.index).split("\n").length;
    out.push({ file, line, fnName, targetConst });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Real population walk.
// ---------------------------------------------------------------------------

function walkScriptFiles(root: string): { abs: string; rel: string }[] {
  const out: { abs: string; rel: string }[] = [];
  for (const entry of readdirSync(root, { withFileTypes: true, recursive: true })) {
    if (!entry.isFile()) continue;
    if (!entry.name.endsWith(".ts") && !entry.name.endsWith(".tsx")) continue;
    const abs = join(entry.parentPath, entry.name);
    out.push({ abs, rel: relative(REPO_ROOT_DIR, abs) });
  }
  return out;
}

function computePopulation(): WriteCallSite[] {
  const files = walkScriptFiles(SCRIPTS_DIR);
  const sites: WriteCallSite[] = [];
  for (const f of files) {
    const src = readFileSync(f.abs, "utf8");
    for (const site of findQualifyingCallSites(f.rel, src)) {
      sites.push(site);
    }
  }
  return sites;
}

const POPULATION = computePopulation();
const OFFENDERS = POPULATION.filter((s) => s.fnName === "writeFileSync");

// A ceiling of 0 by design (DEC-739 wave-46): every generated repo-root
// dotfile/dotdir artifact write in scripts/ must route through
// writeFileAtomic. There is no legitimate offender.
export const GENERATED_ARTIFACT_ATOMIC_WRITE_CEILING = 0;

describe("generated repo-root artifacts publish atomically (DEC-739)", () => {
  it(`no more than ${GENERATED_ARTIFACT_ATOMIC_WRITE_CEILING} un-migrated writeFileSync call sites onto a repo-root dotfile/dotdir`, () => {
    if (OFFENDERS.length > GENERATED_ARTIFACT_ATOMIC_WRITE_CEILING) {
      const detail = OFFENDERS.map((o) => `${o.file}:${o.line} (${o.targetConst})`).join("\n  ");
      throw new Error(
        `${OFFENDERS.length} un-migrated writeFileSync call site(s) publish onto a repo-root dotfile/dotdir without writeFileAtomic:\n  ${detail}`,
      );
    }
    expect(OFFENDERS.length).toBeLessThanOrEqual(GENERATED_ARTIFACT_ATOMIC_WRITE_CEILING);
  });

  it("the ceiling is not stale", () => {
    expect(OFFENDERS.length).toBe(GENERATED_ARTIFACT_ATOMIC_WRITE_CEILING);
  });

  it("vacuous-population tripwire: the derived population is real and spans >= 2 script files", () => {
    expect(POPULATION.length).toBeGreaterThan(0);
    const files = new Set(POPULATION.map((s) => s.file));
    expect(files.size).toBeGreaterThanOrEqual(2);
  });
});

// ---------------------------------------------------------------------------
// Fixture controls (DEC-967): exercise the SAME resolver functions against
// fabricated files in a real tmpdir, never against the repo's own tree.
// ---------------------------------------------------------------------------

describe("generated-artifact-atomic-write resolver: fixture controls", () => {
  let fixtureDir: string;

  beforeAll(() => {
    fixtureDir = mkdtempSync(join(tmpdir(), "atomic-write-fixture-"));
  });

  afterAll(() => {
    rmSync(fixtureDir, { recursive: true, force: true });
  });

  it("positive control: a raw writeFileSync onto a REPO_ROOT-joined dotfile const is flagged", () => {
    const src = [
      `const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));`,
      `const REPO_ROOT = join(SCRIPT_DIR, "..");`,
      `const OUTPUT_PATH = join(REPO_ROOT, ".fixture-output.sql");`,
      `writeFileSync(OUTPUT_PATH, sql, "utf-8");`,
    ].join("\n");
    const sites = findQualifyingCallSites("fixture-positive.ts", src);
    expect(sites).toHaveLength(1);
    expect(sites[0]!.fnName).toBe("writeFileSync");
    expect(sites[0]!.targetConst).toBe("OUTPUT_PATH");
  });

  it("negative control: the same shape routed through writeFileAtomic is not flagged as an offender", () => {
    const src = [
      `const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));`,
      `const REPO_ROOT = join(SCRIPT_DIR, "..");`,
      `const OUTPUT_PATH = join(REPO_ROOT, ".fixture-output.sql");`,
      `writeFileAtomic(OUTPUT_PATH, sql);`,
    ].join("\n");
    const sites = findQualifyingCallSites("fixture-negative.ts", src);
    expect(sites).toHaveLength(1);
    expect(sites[0]!.fnName).toBe("writeFileAtomic");
    const offenders = sites.filter((s) => s.fnName === "writeFileSync");
    expect(offenders).toHaveLength(0);
  });

  it("a write onto a non-repo-root-joined path (e.g. under src/) is not in population", () => {
    const src = [
      `const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));`,
      `const REPO_ROOT = join(SCRIPT_DIR, "..");`,
      `const SHOTS_PATH = join(REPO_ROOT, "src", "routes", "docs-content", "shots-available.ts");`,
      `writeFileSync(SHOTS_PATH, body);`,
    ].join("\n");
    const sites = findQualifyingCallSites("fixture-nonrepo.ts", src);
    expect(sites).toHaveLength(0);
  });

  it("writes fixture files to a real tmpdir (never the repo) and reads them back, proving the harness itself isn't the fixture", () => {
    const fixturePath = join(fixtureDir, "fixture.ts");
    const src = `writeFileSync(X, y);`;
    writeFileSync(fixturePath, src, "utf-8");
    expect(readFileSync(fixturePath, "utf-8")).toBe(src);
  });
});
