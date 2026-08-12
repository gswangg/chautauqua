import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// DEC-385 one-breakpoint guard: every stylesheet in the tree collapses to
// phone layout at the SAME max-width (700px), with 900px reserved as the
// only sanctioned intermediate multi-column collapse. This codebase is
// single-direction -- narrow overrides wide via max-width only, never
// min-width.

const REPO_ROOT = join(__dirname, "..");

/** Recursively collect files under `dir` whose path matches one of `suffixes`. */
function glob(dir: string, suffixes: string[]): string[] {
  if (!existsSync(dir)) return [];
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      out.push(...glob(full, suffixes));
    } else if (suffixes.some((suffix) => entry.endsWith(suffix))) {
      out.push(full);
    }
  }
  return out;
}

function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
}

const stylesheetFiles = [
  ...glob(join(REPO_ROOT, "app/src"), [".css"]),
  ...glob(join(REPO_ROOT, "src"), [".css.ts"]),
];

const ALLOWED_MAX_WIDTHS = new Set(["700px", "900px"]);

// Matches an @media rule's condition list, e.g. "@media (max-width: 700px)"
// or "@media screen and (max-width: 700px)". Conditions naming no width
// (print, prefers-reduced-motion, etc.) simply produce no width matches
// below and are ignored.
const MEDIA_RE = /@media\s*([^{]+)\{/g;
const WIDTH_RE = /(min|max)-width\s*:\s*([0-9.]+px)/g;

describe("breakpoint conformance (DEC-385)", () => {
  it("scanned at least 12 stylesheet files", () => {
    // Guards against the glob silently matching nothing (e.g. a path typo)
    // and the whole test suite passing vacuously.
    expect(stylesheetFiles.length).toBeGreaterThanOrEqual(12);
  });

  it("every media query's max-width is one of the two sanctioned breakpoints (700px, 900px)", () => {
    const violations: string[] = [];
    for (const file of stylesheetFiles) {
      const clean = stripComments(readFileSync(file, "utf8"));
      let m: RegExpExecArray | null;
      MEDIA_RE.lastIndex = 0;
      while ((m = MEDIA_RE.exec(clean))) {
        const condition = m[1]!;
        let w: RegExpExecArray | null;
        WIDTH_RE.lastIndex = 0;
        while ((w = WIDTH_RE.exec(condition))) {
          const [, kind, value] = w;
          if (kind === "min") {
            violations.push(`${file}: min-width media query found (${value}) -- this codebase is single-direction`);
            continue;
          }
          if (!ALLOWED_MAX_WIDTHS.has(value!)) {
            violations.push(`${file}: non-conforming max-width ${value}`);
          }
        }
      }
    }
    expect(violations).toEqual([]);
  });

  it("no min-width media query appears anywhere in the scanned trees", () => {
    // Scoped to @media condition lists only -- `min-width` is also a
    // legitimate ordinary CSS declaration property (e.g. on a <select>),
    // which is not a media query and must not trip this check.
    const violations: string[] = [];
    for (const file of stylesheetFiles) {
      const clean = stripComments(readFileSync(file, "utf8"));
      let m: RegExpExecArray | null;
      MEDIA_RE.lastIndex = 0;
      while ((m = MEDIA_RE.exec(clean))) {
        if (/min-width\s*:/.test(m[1]!)) {
          violations.push(file);
        }
      }
    }
    expect(violations).toEqual([]);
  });
});
