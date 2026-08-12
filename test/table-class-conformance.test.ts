import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// DEC-402 every admin table is addressable by its page's stylesheet: every
// `<table className="chq-table ...">` must carry a second, page-prefixed
// class (e.g. `chq-settings-exports-table`) so a page's stylesheet can
// target it without redefining the shared `.chq-table` class.

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

const tsxFiles = glob(join(REPO_ROOT, "app/src"), [".tsx"]);

// Matches className="chq-table ..." on a JSX <table> element (also matches
// the bare `className="chq-table"` case, which is itself the violation).
const CLASS_ATTR_RE = /className="chq-table([^"]*)"/g;
const SECOND_CLASS_RE = /^chq-[a-z]+-[a-z0-9-]+$/;

describe("table class conformance (DEC-402)", () => {
  it("scanned at least 1 tsx file", () => {
    // Guards against the glob silently matching nothing (e.g. a path typo)
    // and the whole test suite passing vacuously.
    expect(tsxFiles.length).toBeGreaterThanOrEqual(1);
  });

  it("every chq-table className carries a page-prefixed second class", () => {
    const violations: string[] = [];
    for (const file of tsxFiles) {
      const src = readFileSync(file, "utf8");
      const lines = src.split("\n");
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i]!;
        CLASS_ATTR_RE.lastIndex = 0;
        let m: RegExpExecArray | null;
        while ((m = CLASS_ATTR_RE.exec(line))) {
          const rest = m[1]!.trim();
          const classes = rest.split(/\s+/).filter(Boolean);
          const hasPagePrefixedClass = classes.some((c) => c !== "chq-table" && SECOND_CLASS_RE.test(c));
          if (!hasPagePrefixedClass) {
            violations.push(`${file}:${i + 1}`);
          }
        }
      }
    }
    expect(violations, `chq-table without a page-prefixed second class found at: ${violations.join(", ")}`).toEqual(
      [],
    );
  });
});
