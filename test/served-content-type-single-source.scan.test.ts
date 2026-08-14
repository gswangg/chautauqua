// DEC-995 amendment (wave 42): "one door" for served stored-content headers.
// SPEC §6 forbids serving user content with an HTML content type. Before this
// scan, only src/routes/files.ts called assertServedContentTypeHeader
// (src/domain/files.ts) before writing a "Content-Type" response header --
// four sibling routes (portal/tasks.tsx x2, portal/profile.tsx,
// portal/tasks/resources.tsx) echoed the DB column's contentType value raw.
// This scan makes that invariant STRUCTURAL: every "Content-Type": header
// value under src/routes/**/*.{ts,tsx} that is NOT a source string literal
// (i.e. it comes from a variable/row column, not a fixed value the author
// wrote) must be either (a) the direct, inline result of an
// assertServedContentTypeHeader(...) call, or (b) an identifier whose
// nearest preceding `const`/`let` binding IS such a call. DEC-551's twin
// requirement -- every header object with such a non-literal Content-Type
// must also set X-Content-Type-Options in the SAME header object -- is
// checked alongside it so the two decisions live in one scan, not two.
//
// Deliberately a lightweight brace-matching text scan (same style as
// test/file-delete-ordering.scan.test.ts, whose length-preserving
// stripComments is copied verbatim below so line numbers stay accurate) --
// no parser dependency added.

import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = join(__dirname, "..");
const ROUTES_ROOT = join(ROOT, "src", "routes");
const SKIP_DIRS = new Set(["node_modules", "dist", ".wrangler", "build", ".git"]);

/** Strips `//` line comments and `/* *\/` block comments, replacing every
 * stripped character with a space (newlines preserved verbatim) so the
 * output has EXACTLY the same length -- and therefore the same character
 * offsets and line numbers -- as `src`. String/template literals are
 * tracked so a `//` or `/*` inside a string (e.g. a URL) is never mistaken
 * for the start of a comment. Copied verbatim from
 * test/file-delete-ordering.scan.test.ts so both scans share one proven
 * implementation. */
function stripComments(src: string): string {
  let out = "";
  let i = 0;
  const n = src.length;
  while (i < n) {
    const c = src[i];
    const c2 = i + 1 < n ? src[i + 1] : "";
    if (c === "/" && c2 === "/") {
      while (i < n && src[i] !== "\n") {
        out += " ";
        i++;
      }
      continue;
    }
    if (c === "/" && c2 === "*") {
      out += "  ";
      i += 2;
      while (i < n && !(src[i] === "*" && src[i + 1] === "/")) {
        out += src[i] === "\n" ? "\n" : " ";
        i++;
      }
      if (i < n) {
        out += "  ";
        i += 2;
      }
      continue;
    }
    if (c === '"' || c === "'" || c === "`") {
      const quote = c;
      out += c;
      i++;
      while (i < n && src[i] !== quote) {
        if (src[i] === "\\" && i + 1 < n) {
          out += (src[i] ?? "") + (src[i + 1] ?? "");
          i += 2;
          continue;
        }
        out += src[i];
        i++;
      }
      if (i < n) {
        out += src[i];
        i++;
      }
      continue;
    }
    out += c;
    i++;
  }
  return out;
}

/** Brace-matches a `{` at `openIdx` (the index OF the `{`), returning the
 * index just past its matching `}`. */
function matchBrace(src: string, openIdx: number): number {
  let depth = 1;
  let i = openIdx + 1;
  while (i < src.length && depth > 0) {
    if (src[i] === "{") depth++;
    else if (src[i] === "}") depth--;
    i++;
  }
  return i;
}

/** Finds the nearest UNMATCHED `{` at or before `pos` -- i.e. the opening
 * brace of the object literal `pos` sits inside. Walks backward counting
 * brace depth. */
function findEnclosingBraceOpen(src: string, pos: number): number {
  let depth = 0;
  for (let i = pos - 1; i >= 0; i--) {
    if (src[i] === "}") depth++;
    else if (src[i] === "{") {
      if (depth === 0) return i;
      depth--;
    }
  }
  return -1;
}

/** Reads the header value expression starting at `startIdx` (just after the
 * `"Content-Type":` colon, whitespace already skipped), stopping at the
 * first top-level comma or the object's closing brace. Depth-tracks
 * (), [], {} so a call like `assertServedContentTypeHeader(x.y)` or an
 * object/array value is read whole rather than truncated at an inner
 * delimiter. */
function extractValueExpr(src: string, startIdx: number): { value: string; endIdx: number } {
  let depth = 0;
  let i = startIdx;
  let out = "";
  while (i < src.length) {
    const c = src[i];
    if (c === "(" || c === "[" || c === "{") depth++;
    if (c === ")" || c === "]" || c === "}") {
      if (depth === 0) break;
      depth--;
    }
    if (c === "," && depth === 0) break;
    out += c;
    i++;
  }
  return { value: out.trim(), endIdx: i };
}

function lineOf(src: string, idx: number): number {
  return src.slice(0, idx).split("\n").length;
}

const STRING_LITERAL_RE = /^"[^"]*"$|^'[^']*'$/;
const DIRECT_ASSERT_RE = /^assertServedContentTypeHeader\s*\(/;
const SIMPLE_IDENTIFIER_RE = /^[A-Za-z_$][A-Za-z0-9_$]*$/;

const CONTENT_TYPE_KEY_RE = /"Content-Type"\s*:/g;

/**
 * Pure classifier (no fs access): given a set of already-read source files,
 * returns a list of "path:line reason" problem strings. Empty array means
 * every "Content-Type" header assignment in `files` is either a source
 * string literal, or traces directly (inline call or single traced
 * `const`/`let` binding) to assertServedContentTypeHeader(...), AND every
 * header object holding a non-literal Content-Type also sets
 * X-Content-Type-Options in that same object literal.
 *
 * Exported so unit tests below can feed it synthetic compliant/violating
 * sources -- a negative control proving this scan can both pass and fail,
 * not just happen to pass on today's tree.
 */
export function findServedContentTypeProblems(files: { path: string; text: string }[]): string[] {
  const problems: string[] = [];
  for (const file of files) {
    const src = stripComments(file.text);
    CONTENT_TYPE_KEY_RE.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = CONTENT_TYPE_KEY_RE.exec(src))) {
      let valueStart = m.index + m[0].length;
      while (valueStart < src.length && /\s/.test(src[valueStart] ?? "")) valueStart++;
      const { value } = extractValueExpr(src, valueStart);
      const line = lineOf(src, m.index);

      if (STRING_LITERAL_RE.test(value)) continue; // a fixed value the author wrote -- never a DB column echo.

      // Non-literal: must trace to assertServedContentTypeHeader(...).
      let traced = DIRECT_ASSERT_RE.test(value) && value.endsWith(")");
      if (!traced && SIMPLE_IDENTIFIER_RE.test(value)) {
        const bindingRe = new RegExp(`\\b(?:const|let)\\s+${value}\\s*=\\s*assertServedContentTypeHeader\\s*\\(`, "g");
        let bindingMatch: RegExpExecArray | null;
        let lastBindingBeforeUse = -1;
        while ((bindingMatch = bindingRe.exec(src))) {
          if (bindingMatch.index < m.index) lastBindingBeforeUse = bindingMatch.index;
        }
        traced = lastBindingBeforeUse !== -1;
      }
      if (!traced) {
        problems.push(
          `${file.path}:${line} "Content-Type" header value "${value}" is not a source string literal and does not trace to a direct assertServedContentTypeHeader(...) call (DEC-995 amendment, wave 42) -- route it through assertServedContentTypeHeader before writing the header.`,
        );
      }

      // DEC-551 twin: the enclosing header object must also set
      // X-Content-Type-Options.
      const braceOpen = findEnclosingBraceOpen(src, m.index);
      if (braceOpen === -1) {
        problems.push(`${file.path}:${line} "Content-Type" header assignment is not inside a recognizable object literal -- cannot verify X-Content-Type-Options.`);
        continue;
      }
      const braceClose = matchBrace(src, braceOpen);
      const objectBody = src.slice(braceOpen + 1, braceClose - 1);
      if (!objectBody.includes("X-Content-Type-Options")) {
        problems.push(
          `${file.path}:${line} non-literal "Content-Type" header object is missing "X-Content-Type-Options" in the same header object (DEC-551) -- add "X-Content-Type-Options": "nosniff" alongside it.`,
        );
      }
    }
  }
  return problems;
}

function walk(dir: string, out: string[]): void {
  for (const entry of readdirSync(dir)) {
    if (SKIP_DIRS.has(entry)) continue;
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      walk(full, out);
    } else if (stat.isFile() && /\.(ts|tsx)$/.test(entry)) {
      out.push(full);
    }
  }
}

function readRoutesFiles(): { path: string; text: string }[] {
  const abs: string[] = [];
  walk(ROUTES_ROOT, abs);
  return abs.map((full) => ({
    path: relative(ROOT, full).split("\\").join("/"),
    text: readFileSync(full, "utf8"),
  }));
}

describe("served stored-content Content-Type single-source scan (DEC-995 amendment, DEC-551, wave 42)", () => {
  it("scans a non-trivial number of src/routes files (floor tripwire -- a silently empty walk must fail loudly)", () => {
    const files = readRoutesFiles();
    expect(files.length).toBeGreaterThanOrEqual(20);
  });

  it("real tree: every Content-Type header under src/routes is a literal or traces to assertServedContentTypeHeader, with X-Content-Type-Options alongside every non-literal one", () => {
    const files = readRoutesFiles();
    const problems = findServedContentTypeProblems(files);
    expect(problems, problems.join("\n")).toEqual([]);
  });

  it("real tree: the scan actually finds Content-Type header assignments (not vacuously passing on zero hits)", () => {
    const files = readRoutesFiles();
    let hits = 0;
    for (const file of files) {
      const src = stripComments(file.text);
      CONTENT_TYPE_KEY_RE.lastIndex = 0;
      while (CONTENT_TYPE_KEY_RE.exec(src)) hits++;
    }
    // As of wave 42: files.ts x2 (1 literal, 1 assert-derived), portal/tasks.tsx
    // x2 (assert-derived), portal/profile.tsx x1, portal/tasks/resources.tsx
    // x1, public/index.tsx x3 (literal), review/plans-progress.ts x1 (literal)
    // = 10 total, 5 of them non-literal.
    expect(hits).toBeGreaterThanOrEqual(10);
  });

  // --- Negative control: proves the classifier itself can both pass and
  // fail, not just happen to pass on today's real tree. ---

  it("classifier: a literal Content-Type value is compliant with no assert needed", () => {
    const problems = findServedContentTypeProblems([
      {
        path: "synthetic/literal.ts",
        text: `return c.body(csv, 200, { "Content-Type": "text/csv; charset=utf-8" });`,
      },
    ]);
    expect(problems).toEqual([]);
  });

  it("classifier: an inline assertServedContentTypeHeader(...) call with X-Content-Type-Options alongside is compliant", () => {
    const problems = findServedContentTypeProblems([
      {
        path: "synthetic/inline.ts",
        text: `return c.body(obj.body, 200, {
    "Content-Type": assertServedContentTypeHeader(row.contentType),
    "X-Content-Type-Options": "nosniff",
  });`,
      },
    ]);
    expect(problems).toEqual([]);
  });

  it("classifier: a traced const binding through assertServedContentTypeHeader(...) is compliant", () => {
    const problems = findServedContentTypeProblems([
      {
        path: "synthetic/traced.ts",
        text: `const contentType = assertServedContentTypeHeader(row.contentType);
  return c.body(obj.body, 200, {
    "Content-Type": contentType,
    "X-Content-Type-Options": "nosniff",
  });`,
      },
    ]);
    expect(problems).toEqual([]);
  });

  it("classifier: a raw DB-column echo with no assert is flagged, naming file:line", () => {
    const problems = findServedContentTypeProblems([
      {
        path: "synthetic/raw-echo.ts",
        text: `return c.body(obj.body, 200, {
    "Content-Type": row.contentType,
    "X-Content-Type-Options": "nosniff",
  });`,
      },
    ]);
    expect(problems).toEqual([expect.stringContaining("synthetic/raw-echo.ts:2")]);
  });

  it("classifier: an identifier NOT bound via assertServedContentTypeHeader is flagged", () => {
    const problems = findServedContentTypeProblems([
      {
        path: "synthetic/unbound-identifier.ts",
        text: `const contentType = row.contentType;
  return c.body(obj.body, 200, {
    "Content-Type": contentType,
    "X-Content-Type-Options": "nosniff",
  });`,
      },
    ]);
    expect(problems.some((p) => p.includes("synthetic/unbound-identifier.ts:3"))).toBe(true);
  });

  it("classifier: a non-literal Content-Type missing X-Content-Type-Options in the same object is flagged (DEC-551)", () => {
    const problems = findServedContentTypeProblems([
      {
        path: "synthetic/missing-xcto.ts",
        text: `return c.body(obj.body, 200, {
    "Content-Type": assertServedContentTypeHeader(row.contentType),
  });`,
      },
    ]);
    expect(problems.some((p) => p.includes("X-Content-Type-Options"))).toBe(true);
  });

  it("classifier: X-Content-Type-Options in a DIFFERENT header object does not satisfy DEC-551 for this one", () => {
    const problems = findServedContentTypeProblems([
      {
        path: "synthetic/wrong-object.ts",
        text: `const other = { "X-Content-Type-Options": "nosniff" };
  return c.body(obj.body, 200, {
    "Content-Type": assertServedContentTypeHeader(row.contentType),
  });`,
      },
    ]);
    expect(problems.some((p) => p.includes("X-Content-Type-Options"))).toBe(true);
  });
});
