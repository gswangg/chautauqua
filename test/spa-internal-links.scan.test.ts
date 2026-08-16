// w7-c: an SPA destination reached through a literal same-origin `<a
// href="/...">` reloads the whole bundle instead of a client-side route
// change (SPEC §7's interactive < 300 ms budget). This scan walks every
// app/src/**/*.tsx file (excluding *.test.tsx), collects every string-literal
// href that starts with '/', and asserts each one either targets a
// server-rendered surface the SPA router does NOT own (an allowlisted
// prefix) or fails the test naming the offending file and target -- an SPA
// destination must go through react-router's Link/useNavigate instead.
import { readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = join(__dirname, "..");
const APP_SRC_ROOT = join(ROOT, "app", "src");

// Prefixes that are genuinely server-rendered (or cross-origin-equivalent)
// surfaces the SPA router does not own -- a literal <a href> to one of these
// is correct, not a bug.
const ALLOWED_PREFIXES = [
  "/api/v1/",
  "/files/",
  "/headshots/",
  "/e/",
  "/submit/",
  "/portal",
  "/docs/api",
  "/account/password",
  "/login",
  "/logout",
];

function isTestFile(path: string): boolean {
  return /\.test\.tsx$/.test(path);
}

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...walk(full));
    } else if (entry.isFile() && full.endsWith(".tsx") && !isTestFile(full)) {
      out.push(full);
    }
  }
  return out;
}

// Matches a string-literal href attribute: href="/..." or href='/...'.
// Deliberately does NOT match template-literal hrefs (href={`/...`}) --
// those are still a literal same-origin JSX `<a>` attribute in spirit, but
// this scan is scoped to the plain string-literal form named in the task.
const HREF_LITERAL = /href=(["'])(\/[^"']*)\1/g;

interface Offense {
  file: string;
  target: string;
}

export function findUnallowlistedHrefs(root: string, repoRoot: string): Offense[] {
  const offenses: Offense[] = [];
  for (const file of walk(root)) {
    const rel = relative(repoRoot, file).split("\\").join("/");
    const contents = readFileSync(file, "utf8");
    let match: RegExpExecArray | null;
    HREF_LITERAL.lastIndex = 0;
    while ((match = HREF_LITERAL.exec(contents)) !== null) {
      const target = match[2];
      if (target === undefined) continue;
      const allowed = ALLOWED_PREFIXES.some((prefix) => target.startsWith(prefix));
      if (!allowed) offenses.push({ file: rel, target });
    }
  }
  return offenses;
}

describe("spa-internal-links.scan (w7-c): every SPA destination goes through the router", () => {
  it("scanned at least 1 file under app/src/", () => {
    expect(walk(APP_SRC_ROOT).length).toBeGreaterThan(0);
  });

  it("no string-literal href targets a route the SPA router owns", () => {
    const offenses = findUnallowlistedHrefs(APP_SRC_ROOT, ROOT);
    const message = offenses.map((o) => `${o.file}: href="${o.target}"`).join("\n");
    expect(offenses, message).toEqual([]);
  });

  it("negative control: a synthetic literal href to an un-allowlisted SPA path IS detected", () => {
    const synthetic = 'const x = <a href="/admin/agenda">Go</a>;';
    HREF_LITERAL.lastIndex = 0;
    const match = HREF_LITERAL.exec(synthetic);
    expect(match?.[2]).toBe("/admin/agenda");
  });

  it("positive control: a literal href to an allowlisted server-rendered prefix is NOT flagged", () => {
    for (const prefix of ALLOWED_PREFIXES) {
      const synthetic = `const x = <a href="${prefix}">Go</a>;`;
      HREF_LITERAL.lastIndex = 0;
      const match = HREF_LITERAL.exec(synthetic);
      expect(match).not.toBeNull();
      const target = match?.[2];
      expect(target).toBeDefined();
      expect(ALLOWED_PREFIXES.some((p) => (target as string).startsWith(p))).toBe(true);
    }
  });
});
