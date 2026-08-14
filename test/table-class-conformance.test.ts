import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// DEC-402 every admin table is addressable by its page's stylesheet: every
// `<table>` element must carry `chq-table` plus a second, page-prefixed
// class (e.g. `chq-settings-exports-table`) so a page's stylesheet can
// target it without redefining the shared `.chq-table` class.
//
// DEC-402 amendment (wave 20): the original guard matched
// `className="chq-table..."` line-by-line — it only saw a table whose
// className was a double-quoted literal with `chq-table` as its FIRST
// token, and its only tripwire counted scanned FILES (>= 1), so the guard
// would report green over zero matches. This rebuild enumerates every
// `<table` JSX element under app/src (mirroring the element-level parsing
// in test/control-class-conformance.test.ts) and checks each one directly,
// with a match-count tripwire so a broken scan fails loudly instead of
// passing vacuously.
//
// Scope is app/src ONLY. Server-rendered surfaces under src/ are
// deliberately out of scope: this guard enforces an SPA-stylesheet
// addressing convention (app/src/styles.css page-prefixed classes) that
// has no counterpart on server-rendered surfaces, so scanning src/ would
// be checking an invariant that doesn't apply there. That holds for both
// the original file-level scan and this element-level rebuild: neither
// widens past app/src.

const REPO_ROOT = join(__dirname, "..");
const APP_SRC = join(REPO_ROOT, "app/src");

/** Recursively collect `.tsx` files under `dir`, skipping test files. */
function glob(dir: string): string[] {
  if (!existsSync(dir)) return [];
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      out.push(...glob(full));
    } else if (entry.endsWith(".tsx") && !entry.endsWith(".test.tsx") && !entry.endsWith(".render.test.tsx")) {
      out.push(full);
    }
  }
  return out;
}

const tsxFiles = glob(APP_SRC);

const SECOND_CLASS_RE = /^chq-[a-z]+-[a-z0-9-]+$/;

/**
 * Blank out `//` and `/* *\/` comments (keeping newlines, so line numbers
 * stay accurate) so a `<table>` mentioned inside a docblock is never
 * mistaken for a live element. String/template contents are left alone.
 */
function stripComments(src: string): string {
  let out = "";
  let i = 0;
  while (i < src.length) {
    const two = src.slice(i, i + 2);
    if (two === "//") {
      while (i < src.length && src[i] !== "\n") {
        out += " ";
        i++;
      }
      continue;
    }
    if (two === "/*") {
      out += "  ";
      i += 2;
      while (i < src.length && src.slice(i, i + 2) !== "*/") {
        out += src[i] === "\n" ? "\n" : " ";
        i++;
      }
      out += "  ";
      i += 2;
      continue;
    }
    const ch = src[i]!;
    if (ch === '"' || ch === "'" || ch === "`") {
      out += ch;
      i++;
      while (i < src.length && src[i] !== ch) {
        out += src[i];
        if (src[i] === "\\" && i + 1 < src.length) {
          i++;
          out += src[i];
        }
        i++;
      }
      if (i < src.length) {
        out += src[i];
        i++;
      }
      continue;
    }
    out += ch;
    i++;
  }
  return out;
}

/** From `start` (index of `<`), find the index of the top-level `>` that
 * closes the opening tag, skipping over `{...}` JS expressions and quoted
 * strings so an embedded `>` doesn't terminate the scan early. */
function findTagEnd(src: string, start: number): number {
  let i = start;
  let braceDepth = 0;
  while (i < src.length) {
    const ch = src[i]!;
    if (ch === "{") {
      braceDepth++;
    } else if (ch === "}") {
      braceDepth--;
    } else if (ch === '"' || ch === "'" || ch === "`") {
      const quote = ch;
      i++;
      while (i < src.length && src[i] !== quote) {
        if (src[i] === "\\") i++;
        i++;
      }
    } else if (ch === ">" && braceDepth === 0) {
      return i;
    }
    i++;
  }
  return -1;
}

/** Find the value substring for `attrName="..."` / `attrName={...}` within
 * an opening-tag's attribute text, returning null if the attribute is
 * absent. */
function extractAttrValue(attrs: string, attrName: string): string | null {
  const re = new RegExp(`\\b${attrName}\\s*=\\s*`, "g");
  const m = re.exec(attrs);
  if (!m) return null;
  const start = m.index + m[0]!.length;
  const opener = attrs[start];
  if (opener === '"' || opener === "'") {
    const end = attrs.indexOf(opener, start + 1);
    return attrs.slice(start, end + 1);
  }
  if (opener === "{") {
    let depth = 0;
    let i = start;
    for (; i < attrs.length; i++) {
      if (attrs[i] === "{") depth++;
      else if (attrs[i] === "}") {
        depth--;
        if (depth === 0) break;
      }
    }
    return attrs.slice(start, i + 1);
  }
  return null;
}

interface Violation {
  file: string;
  line: number;
  message: string;
}

interface ScanResult {
  violations: Violation[];
  matchCount: number;
}

function scanFile(file: string): ScanResult {
  const rawSrc = readFileSync(file, "utf8");
  const src = stripComments(rawSrc);
  const violations: Violation[] = [];
  let matchCount = 0;
  const tagRe = /<table(?=[\s/>])/g;
  let m: RegExpExecArray | null;
  while ((m = tagRe.exec(src))) {
    matchCount++;
    const tagStart = m.index;
    const tagEnd = findTagEnd(src, tagStart);
    if (tagEnd === -1) {
      throw new Error(`${file}: unterminated <table> starting at offset ${tagStart}`);
    }
    const attrs = src.slice(tagStart, tagEnd + 1);
    const lineNumber = src.slice(0, tagStart).split("\n").length;

    const classValue = extractAttrValue(attrs, "className");
    if (classValue === null) {
      violations.push({ file, line: lineNumber, message: "<table> has no className attribute" });
      continue;
    }
    if (classValue.startsWith("{")) {
      violations.push({
        file,
        line: lineNumber,
        message:
          "<table> className is a computed expression, not a static string literal, so this guard can't read it -- " +
          "split the literal so `chq-table <page-prefixed>` stays static",
      });
      continue;
    }
    // classValue is a quoted literal: `"..."` or `'...'`. Strip the quotes.
    const literal = classValue.slice(1, -1);
    const tokens = literal.split(/\s+/).filter(Boolean);
    const hasBase = tokens.includes("chq-table");
    const hasPagePrefixedClass = tokens.some((c) => c !== "chq-table" && SECOND_CLASS_RE.test(c));
    if (!hasBase || !hasPagePrefixedClass) {
      violations.push({
        file,
        line: lineNumber,
        message: `<table className="${literal}"> missing chq-table and/or a page-prefixed second class`,
      });
    }
  }
  return { violations, matchCount };
}

describe("table class conformance (DEC-402)", () => {
  it("scanned at least 12 <table> elements", () => {
    // Guards against the parser silently breaking (e.g. a directory rename
    // or a regex regression) and the whole suite passing vacuously over
    // zero matches. 14 exist on main at time of writing.
    let total = 0;
    for (const file of tsxFiles) {
      total += scanFile(file).matchCount;
    }
    expect(total).toBeGreaterThanOrEqual(12);
  });

  it("every <table> carries chq-table plus a page-prefixed second class", () => {
    const violations: Violation[] = [];
    for (const file of tsxFiles) {
      violations.push(...scanFile(file).violations);
    }
    const message = violations.map((v) => `${v.file}:${v.line} ${v.message}`).join("\n");
    expect(violations, `\n${message}`).toEqual([]);
  });
});
