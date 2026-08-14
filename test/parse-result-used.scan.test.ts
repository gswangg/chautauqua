// DEC-182 (wave-32 amendment): "a parse call whose result is discarded is
// not a parse". src/routes/api/contacts/bulk-email.ts:40 used to call
// parseBoundedIdArray(...) as a bare statement, throw away its deduped
// RESULT, and then re-read `body.contactIds` raw a few lines down --
// silently reintroducing the exact duplicate-id bug the parser was meant to
// close. This scan makes that shape repo-wide: every call to
// parseBoundedIdArray, parseBoundedText, parseBoundedOptionalText,
// readJsonBody, or readOptionalJsonBody across src/**/*.ts(x) (test files
// excluded) must be an assignment, a `return`, an argument to another call,
// or a property initializer -- never a bare statement whose value is
// dropped on the floor.
//
// Deliberately a lightweight brace/text scan (same convention as
// test/file-delete-ordering.scan.test.ts, whose stripComments is copied
// verbatim below to keep line numbers accurate after comment removal) -- no
// parser dependency added.

import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = join(__dirname, "..");
const SRC_ROOT = "src";
const SKIP_DIRS = new Set(["node_modules", "dist", ".wrangler", "build", ".git"]);

const TARGET_FUNCTIONS = ["parseBoundedIdArray", "parseBoundedText", "parseBoundedOptionalText", "readJsonBody", "readOptionalJsonBody"];

/** Strips `//` line comments and `/* *\/` block comments, replacing every
 * stripped character with a space (newlines preserved verbatim) so the
 * output has EXACTLY the same length -- and therefore the same character
 * offsets and line numbers -- as `src`. String/template literals are
 * tracked so a `//` or `/*` inside a string (e.g. a URL) is never mistaken
 * for the start of a comment. Copied verbatim from
 * test/file-delete-ordering.scan.test.ts -- deliberately still a lightweight
 * text pass, not a real lexer. */
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

function walk(dir: string, out: string[]): void {
  for (const entry of readdirSync(dir)) {
    if (SKIP_DIRS.has(entry)) continue;
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      walk(full, out);
    } else if (stat.isFile() && /\.(ts|tsx)$/.test(entry) && !/\.test\.[tj]sx?$/.test(entry)) {
      out.push(full);
    }
  }
}

function collectFiles(): string[] {
  const out: string[] = [];
  walk(join(ROOT, SRC_ROOT), out);
  return out;
}

/** True if the text ending exactly at index `end` (inclusive) equals `word`
 * and is not itself a suffix of a longer identifier (word boundary check on
 * the character before it). */
function precedingIsWord(src: string, end: number, word: string): boolean {
  const start = end - word.length + 1;
  if (start < 0) return false;
  if (src.slice(start, end + 1) !== word) return false;
  const before = start - 1;
  return before < 0 || !/[A-Za-z0-9_$]/.test(src[before] ?? "");
}

type Classification = "declaration" | "consumed" | "statement";

/** Walks backward from `callStart` (the index of the first character of the
 * called function's identifier) past whitespace and an optional `await`
 * keyword, then classifies the single preceding token:
 *  - `function` immediately before  -> this IS the declaration, not a call.
 *  - `(`, `,`, `[`, or `:`          -> argument position / property
 *                                      initializer -> consumed.
 *  - a plain `=` (not `==`, `===`, `!=`, `<=`, `>=`) or a `=>` arrow        -> consumed (assignment / implicit arrow return).
 *  - the word `return`              -> consumed.
 *  - anything else (`;`, `{`, `}`, start of file, or a comparison/logical
 *    operator not in the allowed list above) -> statement (flagged). */
function classify(src: string, callStart: number): Classification {
  let i = callStart - 1;
  const skipWs = () => {
    while (i >= 0 && /\s/.test(src[i] ?? "")) i--;
  };
  skipWs();
  if (i >= 0 && precedingIsWord(src, i, "function")) return "declaration";
  if (i >= 0 && precedingIsWord(src, i, "await")) {
    i -= "await".length;
    skipWs();
  }
  if (i < 0) return "statement";
  const c = src[i] ?? "";
  if (c === "(" || c === "," || c === "[" || c === ":") return "consumed";
  // `?` covers BOTH the then-branch of a ternary (`x = cond ? parse(...) : y`,
  // the shape every optional query-param parse in src/routes/api uses) and the
  // right-hand side of `??`. Both positions feed the surrounding expression,
  // so the result is consumed. (`:` above already covers the else-branch.)
  if (c === "?") return "consumed";
  if (c === ">" && i > 0 && src[i - 1] === "=") return "consumed"; // arrow function implicit return
  if (c === "=") {
    const prev = i > 0 ? src[i - 1] : "";
    if (prev === "=" || prev === "!" || prev === "<" || prev === ">") return "statement"; // ==, ===, !=, <=, >=
    return "consumed"; // plain (or compound, e.g. +=) assignment
  }
  if (precedingIsWord(src, i, "return")) return "consumed";
  return "statement";
}

interface CallSite {
  file: string;
  line: number;
  fn: string;
  classification: Classification;
}

function scanForCallSites(): CallSite[] {
  const files = collectFiles();
  const out: CallSite[] = [];
  for (const file of files) {
    const rawSrc = readFileSync(file, "utf8");
    const src = stripComments(rawSrc);
    for (const fn of TARGET_FUNCTIONS) {
      const re = new RegExp(`\\b${fn}\\s*\\(`, "g");
      let match: RegExpExecArray | null;
      while ((match = re.exec(src))) {
        const classification = classify(src, match.index);
        if (classification === "declaration") continue;
        const lineIdx = src.slice(0, match.index).split("\n").length - 1;
        out.push({
          file: relative(ROOT, file).split("\\").join("/"),
          line: lineIdx + 1,
          fn,
          classification,
        });
      }
    }
  }
  return out;
}

describe("parse-result-used scan negative control (DEC-518 wave-35 amendment)", () => {
  // classify(src, callStart) is the pure predicate the repo-wide walk above
  // feeds every real call site through. These tests feed it synthetic
  // snippets directly -- a bare-statement call must classify "statement"
  // (the violation this scan exists to catch), and every consuming shape
  // (assignment, return, argument, property initializer) must classify
  // "consumed" -- proving the scan can both fail and pass.
  function callStartOf(src: string, fn: string): number {
    const idx = src.indexOf(fn);
    if (idx < 0) throw new Error(`fixture bug: ${fn} not found in ${JSON.stringify(src)}`);
    return idx;
  }

  it("VIOLATION: a bare-statement call classifies as 'statement' (discarded result)", () => {
    const src = "parseBoundedIdArray(body.ids, 'ids');";
    expect(classify(src, callStartOf(src, "parseBoundedIdArray"))).toBe("statement");
  });

  it("COMPLIANT: an assignment classifies as 'consumed'", () => {
    const src = "const ids = parseBoundedIdArray(body.ids, 'ids');";
    expect(classify(src, callStartOf(src, "parseBoundedIdArray"))).toBe("consumed");
  });

  it("COMPLIANT: a return classifies as 'consumed'", () => {
    const src = "function f() { return parseBoundedIdArray(body.ids, 'ids'); }";
    expect(classify(src, callStartOf(src, "parseBoundedIdArray"))).toBe("consumed");
  });

  it("COMPLIANT: an argument position classifies as 'consumed'", () => {
    const src = "foo(parseBoundedIdArray(body.ids, 'ids'));";
    expect(classify(src, callStartOf(src, "parseBoundedIdArray"))).toBe("consumed");
  });

  it("COMPLIANT: a property initializer classifies as 'consumed'", () => {
    const src = "const obj = { ids: parseBoundedIdArray(body.ids, 'ids') };";
    expect(classify(src, callStartOf(src, "parseBoundedIdArray"))).toBe("consumed");
  });
});

describe("parse-result-used scan (DEC-182 wave-32 amendment)", () => {
  it("finds at least 15 call sites across src/ (floor guards against the matcher silently narrowing)", () => {
    const hits = scanForCallSites();
    expect(hits.length).toBeGreaterThanOrEqual(15);
  });

  it("every parseBoundedIdArray/parseBoundedText/parseBoundedOptionalText/readJsonBody/readOptionalJsonBody call consumes its result", () => {
    const hits = scanForCallSites();
    const offenders = hits.filter((h) => h.classification === "statement");
    expect(
      offenders,
      offenders
        .map(
          (o) =>
            `${o.file}:${o.line} -- ${o.fn}(...) is called as a bare statement; its return value is discarded ` +
            `(DEC-182). Assign it (const x = ${o.fn}(...)), return it, pass it as an argument, or use it as a ` +
            `property initializer -- never call it and then re-read the raw input separately.`,
        )
        .join("\n"),
    ).toEqual([]);
  });
});
