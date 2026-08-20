// DEC-808 (wave 115 amendment): the typecheck's population is the UNION of
// its projects' includes, and scripts/ had never been in it — 21 files,
// including scripts/exit-predicate.ts (the DEC-069 exit-predicate gate
// itself), had never been typechecked by anything. tsconfig.scripts.json
// closes the gap; this scan proves the closure is total and stays total.
//
// DEC-808: directory walk, never a hand-listed manifest of source files —
// the population is every *.ts/*.tsx file in the repo (excluding
// node_modules/.git/dist/build/.wrangler), derived the same way
// test/disabled-token-uses.scan.test.ts collects its stylesheets. The three
// tsconfig files' own include/exclude arrays are read and turned into glob
// matchers — the CLAIM is derived from the config files themselves, never
// re-typed here, so a project that widens or narrows its include is
// re-measured automatically rather than silently drifting out of sync with
// this test.
import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { DEC_808 } from "../src/decisions";

void DEC_808; // this scan's own subject: scripts/ closure + population totality

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(HERE, "..");

const PRUNE_DIRS = new Set(["node_modules", ".git", "dist", "build", ".wrangler"]);

function walkTsFiles(dir: string, out: string[]): void {
  for (const entry of readdirSync(dir)) {
    if (PRUNE_DIRS.has(entry)) continue;
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      walkTsFiles(full, out);
    } else if (entry.endsWith(".ts") || entry.endsWith(".tsx")) {
      out.push(full);
    }
  }
}

/** Every *.ts/*.tsx file in the repo, as paths relative to REPO_ROOT with
 * forward slashes (so comparisons are OS-independent). DEC-808: a directory
 * walk, never a hand-listed manifest. */
function collectRepoTsFiles(): string[] {
  const files: string[] = [];
  walkTsFiles(REPO_ROOT, files);
  return files.map((f) => relative(REPO_ROOT, f).split("\\").join("/"));
}

// ---------------------------------------------------------------------------
// Minimal glob engine over posix-style paths, covering exactly the pattern
// vocabulary the three tsconfig files use: bare directory names ("src",
// "test", "scripts" — tsc's own convention: match every supported-extension
// file recursively underneath), literal single-file paths ("../src/decisions.ts"),
// and "**"/"*" globs ("../src/domain/**/*.ts"). Same tokenize-then-escape
// shape as test/test-tiers.test.ts's globToMatcher, generalised to path
// segments instead of vitest's own glob vocabulary.
// ---------------------------------------------------------------------------

function globToRegExp(pattern: string): RegExp {
  const GLOBSTAR_SLASH = " GLOBSTAR_SLASH ";
  const GLOBSTAR = " GLOBSTAR ";
  const STAR = " STAR ";
  const tokenized = pattern
    .split("**/").join(GLOBSTAR_SLASH)
    .split("**").join(GLOBSTAR)
    .split("*").join(STAR);
  const escaped = tokenized.replace(/[.+^${}()|[\]\\]/g, "\\$&");
  const rx = escaped
    .split(GLOBSTAR_SLASH).join("(?:.*/)?")
    .split(GLOBSTAR).join(".*")
    .split(STAR).join("[^/]*");
  return new RegExp(`^${rx}$`);
}

/** A single include/exclude entry from a tsconfig, resolved against the
 * config's own directory (posix-relative to REPO_ROOT), turned into a
 * predicate over repo-relative file paths. */
function entryToMatcher(entry: string, configDirRel: string): (file: string) => boolean {
  const resolvedRaw = configDirRel === "" ? entry : `${configDirRel}/${entry}`;
  // Normalise "../" segments and "./"; posix-join by hand since these stay
  // as plain strings (no real filesystem join needed — REPO_ROOT-relative
  // strings only).
  const parts = resolvedRaw.split("/");
  const stack: string[] = [];
  for (const part of parts) {
    if (part === "." || part === "") continue;
    if (part === "..") {
      if (stack.length === 0) {
        throw new Error(`entryToMatcher: "${entry}" (from config dir "${configDirRel}") escapes REPO_ROOT`);
      }
      stack.pop();
    } else {
      stack.push(part);
    }
  }
  const resolved = stack.join("/");

  const isBareDirectory = !entry.includes("*") && !/\.(ts|tsx)$/.test(entry);
  if (isBareDirectory) {
    const prefix = `${resolved}/`;
    return (file: string) => file.startsWith(prefix) && (file.endsWith(".ts") || file.endsWith(".tsx"));
  }
  if (!entry.includes("*")) {
    // Literal single-file entry.
    return (file: string) => file === resolved;
  }
  const re = globToRegExp(resolved);
  return (file: string) => re.test(file);
}

interface TsConfigShape {
  compilerOptions?: Record<string, unknown>;
  include?: string[];
  exclude?: string[];
}

interface Project {
  name: string;
  configPath: string; // repo-relative
}

const PROJECTS: Project[] = [
  { name: "root", configPath: "tsconfig.json" },
  { name: "app", configPath: "app/tsconfig.json" },
  { name: "scripts", configPath: "tsconfig.scripts.json" },
];

interface DerivedProject {
  name: string;
  claims: (file: string) => boolean;
  includeRaw: string[];
  excludeRaw: string[];
}

function deriveProject(project: Project): DerivedProject {
  const absConfigPath = join(REPO_ROOT, project.configPath);
  const parsed = JSON.parse(readFileSync(absConfigPath, "utf-8")) as TsConfigShape;
  const configDirRel = relative(REPO_ROOT, dirname(absConfigPath)).split("\\").join("/");
  const includeRaw = parsed.include ?? [];
  const excludeRaw = parsed.exclude ?? [];
  if (includeRaw.length === 0) {
    throw new Error(`deriveProject: ${project.configPath} has no "include" — a vacuous project can't claim anything`);
  }
  const includeMatchers = includeRaw.map((e) => entryToMatcher(e, configDirRel));
  const excludeMatchers = excludeRaw.map((e) => entryToMatcher(e, configDirRel));
  return {
    name: project.name,
    includeRaw,
    excludeRaw,
    claims: (file: string) =>
      includeMatchers.some((m) => m(file)) && !excludeMatchers.some((m) => m(file)),
  };
}

function deriveAllProjects(): DerivedProject[] {
  return PROJECTS.map(deriveProject);
}

// ---------------------------------------------------------------------------
// Named exclusion class: files that legitimately sit outside every tsc
// project because they are loaded by another tool's own bundler/loader, not
// by tsc. A silent exemption is illegal (DEC-843) — every row here must
// carry a written reason, and a "stale exclusion" check below fails loudly
// the moment a listed file either stops existing or becomes claimed by a
// project (at which point the row is dead and must be deleted, not kept).
// ---------------------------------------------------------------------------

const NAMED_EXCLUSIONS: Record<string, string> = {
  "vitest.config.ts": "loaded directly by vitest's own esbuild-based config loader, not tsc — no tsconfig project includes the repo root's *.config.ts files",
  "vitest.fast.config.ts": "loaded directly by vitest's own esbuild-based config loader, not tsc — same as vitest.config.ts",
  "app/vite.config.ts": "loaded directly by vite's own esbuild-based config loader, not tsc — app/tsconfig.json's include is scoped to app/src plus named repo-src files, never app/vite.config.ts",
};

describe("DEC-808: the union of tsconfig projects' includes covers every *.ts/*.tsx file in the repo", () => {
  it("vacuous-population tripwire: the repo scan finds a non-trivial number of files and a known member", () => {
    const files = collectRepoTsFiles();
    expect(files.length).toBeGreaterThan(1500);
    expect(files).toContain("src/decisions.ts");
    expect(files).toContain("scripts/exit-predicate.ts");
  });

  it("each project's derived matcher claims at least one real file (a dead include is a silent no-op)", () => {
    const files = collectRepoTsFiles();
    for (const project of deriveAllProjects()) {
      const claimedCount = files.filter((f) => project.claims(f)).length;
      expect(claimedCount, `project "${project.name}" (include: ${project.includeRaw.join(", ")}) claims zero files`).toBeGreaterThan(0);
    }
  });

  it("scripts/exit-predicate.ts (the DEC-069 exit-predicate gate) is claimed by the scripts project", () => {
    const scripts = deriveAllProjects().find((p) => p.name === "scripts")!;
    expect(scripts.claims("scripts/exit-predicate.ts")).toBe(true);
  });

  it("no NAMED_EXCLUSIONS row is stale (must exist, and must NOT be claimed by any project — else: delete this line)", () => {
    const files = new Set(collectRepoTsFiles());
    const projects = deriveAllProjects();
    const stale: string[] = [];
    for (const file of Object.keys(NAMED_EXCLUSIONS)) {
      if (!files.has(file)) {
        stale.push(`${file}: no longer exists in the repo — delete this line`);
        continue;
      }
      const claimant = projects.find((p) => p.claims(file));
      if (claimant) {
        stale.push(`${file}: now claimed by project "${claimant.name}" — delete this line, it's no longer unclaimed`);
      }
    }
    expect(stale, stale.join("\n")).toEqual([]);
  });

  it("negative control: a synthetic file in a directory no project includes is NOT claimed by any project", () => {
    const projects = deriveAllProjects();
    const synthetic = "orphan-dir/orphan-file.ts";
    for (const project of projects) {
      expect(project.claims(synthetic), `project "${project.name}" unexpectedly claims ${synthetic}`).toBe(false);
    }
  });

  it("negative control: root's exclude(\"app\") really does veto files under app/ from the root project", () => {
    const root = deriveAllProjects().find((p) => p.name === "root")!;
    expect(root.claims("app/src/main.tsx")).toBe(false);
  });

  // -------------------------------------------------------------------------
  // The two-sided ratchet: every real repo file must be claimed by at least
  // one project OR named in NAMED_EXCLUSIONS with a written reason. Fixed
  // at 0 (never widened) — a regression here means a new top-level file (or
  // a narrowed include) silently dropped out of every typecheck gate.
  // -------------------------------------------------------------------------
  const UNCLAIMED_CEILING = 0;

  function unclaimedFiles(): string[] {
    const files = collectRepoTsFiles();
    const projects = deriveAllProjects();
    return files.filter(
      (f) => !(f in NAMED_EXCLUSIONS) && !projects.some((p) => p.claims(f)),
    );
  }

  it(`every *.ts/*.tsx file is claimed by a project or a named exclusion (ceiling: UNCLAIMED_CEILING, may only be lowered)`, () => {
    const offenders = unclaimedFiles();
    if (offenders.length > UNCLAIMED_CEILING) {
      throw new Error(
        `${offenders.length} file(s) typechecked by NOTHING, exceeding the ceiling of ${UNCLAIMED_CEILING} ` +
          "(may only be LOWERED, never raised to paper over a regression):\n" +
          offenders.join("\n"),
      );
    }
    expect(offenders.length).toBeLessThanOrEqual(UNCLAIMED_CEILING);
  });

  it("the ceiling is not stale: the measured unclaimed count is not below UNCLAIMED_CEILING (two-sided ratchet)", () => {
    const offenders = unclaimedFiles();
    if (offenders.length < UNCLAIMED_CEILING) {
      throw new Error(
        `Measured unclaimed count ${offenders.length} is BELOW the ceiling of ${UNCLAIMED_CEILING} — lower the constant: ` +
          `const UNCLAIMED_CEILING = ${offenders.length};`,
      );
    }
    expect(offenders.length).toBeGreaterThanOrEqual(UNCLAIMED_CEILING);
  });
});
