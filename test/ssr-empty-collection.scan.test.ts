// DEC-919 amendment (task w56-a): the SSR half of the zero-state ruling.
// Every server-rendered (public + portal) surface's zero-collection branch
// must render through PublicEmptyState (src/routes/public/empty-state.tsx),
// never a bare sentence. Mirrors app/src/b7-empty-collection.scan.test.ts's
// shape (full-tree enumeration via readdirSync, never a hand list) but keyed
// on the ternary BRANCH itself, not on a className token -- these SSR
// surfaces don't share the admin app's `chq-empty` class family, so the
// only stable fingerprint is the `{ x.length === 0 ? ( ... ) : ( ... ) }`
// (or `.size === 0`) shape.
//
// Zero allowlist: every site under src/routes/ this scan finds must already
// carry PublicEmptyState in its branch (task w56-a converted the seven live
// offenders this wave named).
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC_ROOT = join(HERE, "..", "src", "routes");

/** Every non-test *.tsx file under src/routes, keyed by its path relative to
 * src/routes (posix separators). */
function allSourceFiles(root: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(root, { withFileTypes: true, recursive: true })) {
    if (!entry.isFile() || !entry.name.endsWith(".tsx")) continue;
    if (entry.name.includes(".test.")) continue;
    const full = join(entry.parentPath, entry.name);
    out.push(relative(root, full).split(sep).join("/"));
  }
  return out.sort();
}

const SOURCE_FILES = allSourceFiles(SRC_ROOT);

/** Matches the opening `{ x.length === 0 ? (` / `{ x.size === 0 ? (` shape --
 * the '(' this regex ends on is the branch's own opening paren, which
 * `matchParen` then walks forward from to find the branch's closing paren. */
const ZERO_BRANCH_RE = /\{\s*[A-Za-z_$][\w$.]*\.(?:length|size)\s*===\s*0\s*\?\s*\(/g;

interface BranchSite {
  line: number;
  text: string;
}

function lineOf(source: string, index: number): number {
  return source.slice(0, index).split("\n").length;
}

/** Walks forward from the index of an opening '(' (inclusive) to its
 * matching close paren, tracking depth across any nested parens. Returns the
 * index one past the matching ')', or -1 if the source ends unbalanced. */
function matchParen(source: string, openIndex: number): number {
  let depth = 0;
  for (let i = openIndex; i < source.length; i++) {
    const ch = source[i];
    if (ch === "(") depth++;
    else if (ch === ")") {
      depth--;
      if (depth === 0) return i + 1;
    }
  }
  return -1;
}

/** Every zero-collection ternary branch in `source`, as its full text from
 * the branch's own opening paren to its matching close paren. */
function findZeroBranches(source: string): BranchSite[] {
  const sites: BranchSite[] = [];
  let m: RegExpExecArray | null;
  ZERO_BRANCH_RE.lastIndex = 0;
  while ((m = ZERO_BRANCH_RE.exec(source))) {
    // m[0] ends in '(' -- its index is m.index + m[0].length - 1.
    const openIndex = m.index + m[0].length - 1;
    const closeIndex = matchParen(source, openIndex);
    if (closeIndex === -1) throw new Error(`ssr-empty-collection scan: unbalanced parens from index ${openIndex}`);
    sites.push({ line: lineOf(source, m.index), text: source.slice(openIndex, closeIndex) });
  }
  return sites;
}

describe("DEC-919 (w56-a): every SSR zero-collection branch under src/routes renders PublicEmptyState", () => {
  it("visits at least 20 source files (vacuous-scan tripwire)", () => {
    expect(SOURCE_FILES.length).toBeGreaterThanOrEqual(20);
  });

  it("finds at least 8 zero-collection branch sites (vacuous-scan tripwire)", () => {
    let total = 0;
    for (const relFile of SOURCE_FILES) {
      const source = readFileSync(join(SRC_ROOT, relFile), "utf8");
      total += findZeroBranches(source).length;
    }
    expect(total).toBeGreaterThanOrEqual(8);
  });

  it("every zero-collection branch's text contains PublicEmptyState (zero allowlist)", () => {
    const offenses: string[] = [];
    for (const relFile of SOURCE_FILES) {
      const source = readFileSync(join(SRC_ROOT, relFile), "utf8");
      for (const site of findZeroBranches(source)) {
        if (!site.text.includes("PublicEmptyState")) {
          offenses.push(`${relFile}:${site.line}: zero-collection branch has no PublicEmptyState`);
        }
      }
    }
    expect(offenses, offenses.join("\n")).toEqual([]);
  });

  describe("negative control on synthetic source (fingerprint precision)", () => {
    it("flags a bare zero-collection branch rendering <p>None.</p>", () => {
      const source = `{items.length === 0 ? (\n  <p>None.</p>\n) : (\n  <ul>{items.map((i) => <li>{i}</li>)}</ul>\n)}`;
      const sites = findZeroBranches(source);
      expect(sites).toHaveLength(1);
      expect(sites[0]!.text).not.toContain("PublicEmptyState");
    });

    it("does NOT flag a zero-collection branch rendering <PublicEmptyState/>", () => {
      const source = `{items.length === 0 ? (\n  <PublicEmptyState variant="fresh" what="None yet." />\n) : (\n  <ul>{items.map((i) => <li>{i}</li>)}</ul>\n)}`;
      const sites = findZeroBranches(source);
      expect(sites).toHaveLength(1);
      expect(sites[0]!.text).toContain("PublicEmptyState");
    });

    it("does NOT match a plain equality expression with no '? (' branch", () => {
      const source = `function f(s: string[]) { return s.length === 0 ? s : x; }`;
      expect(findZeroBranches(source)).toEqual([]);
    });
  });
});
