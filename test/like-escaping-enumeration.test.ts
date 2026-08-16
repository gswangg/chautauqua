// DEC-511: locks the DEC-506 LIKE-escaping invariant with a GLOBBED
// enumeration over src/server/repo/**/*.ts, rather than the hand-picked
// spot checks that let it rot before (see the field guide's w25-w28
// entries). No allowlist of files is hand-maintained here — a repo module
// added tomorrow is covered automatically because the glob re-reads the
// directory tree at test-run time.
//
// This is verification-only: it reads source files as plain text and
// regex-scans them. It does not import or execute production code (other
// than test/like-escape.test.ts's existing unit tests of likeContains
// itself), so a change here can never affect src/ behavior.

import { describe, expect, it } from "vitest";
import { globSync, readFileSync } from "node:fs";
import path from "node:path";

const REPO_ROOT = path.resolve(__dirname, "..");

/** All repo-layer source files, globbed fresh on every run — DEC-511:
 * "a repo module added tomorrow must be covered automatically". */
const REPO_FILES: string[] = globSync("src/server/repo/**/*.ts", { cwd: REPO_ROOT }).sort();

/** Replaces `//` line comments, `/* *\/` block comments, and `'...'`/`"..."`
 * string literal bodies with same-length whitespace (preserving every
 * offset/line number), while copying template-literal (`` ` ``) bodies
 * through verbatim. Without this, a JSDoc comment containing a stray
 * backtick pair (e.g. "the Drizzle `sql` tag") is mistaken for the start of
 * a real `` sql`...` `` template and desyncs every match after it — this
 * bit the first version of this test against the real
 * src/server/repo/public/sessions.ts JSDoc. Scanning `cleaned` instead of
 * raw source is what makes the enumeration reliable rather than order-
 * dependent on comment contents. */
function stripCommentsAndStrings(text: string): string {
  let out = "";
  let i = 0;
  const n = text.length;
  while (i < n) {
    const c = text[i]!;
    const c2 = text[i + 1];
    if (c === "/" && c2 === "/") {
      while (i < n && text[i] !== "\n") {
        out += " ";
        i++;
      }
      continue;
    }
    if (c === "/" && c2 === "*") {
      out += "  ";
      i += 2;
      while (i < n && !(text[i] === "*" && text[i + 1] === "/")) {
        out += text[i] === "\n" ? "\n" : " ";
        i++;
      }
      out += "  ";
      i += 2;
      continue;
    }
    if (c === '"' || c === "'") {
      out += c;
      i++;
      while (i < n && text[i] !== c) {
        if (text[i] === "\\") {
          out += "  ";
          i += 2;
          continue;
        }
        out += " ";
        i++;
      }
      out += text[i] ?? "";
      i++;
      continue;
    }
    if (c === "`") {
      // Template literal: copy through verbatim (including `${...}`
      // interpolations), tracking brace depth so a `}` inside an
      // interpolation doesn't prematurely end template-mode, and only a
      // backtick at depth 0 closes it.
      out += c;
      i++;
      let depth = 0;
      while (i < n) {
        if (text[i] === "\\") {
          out += text[i]! + (text[i + 1] ?? "");
          i += 2;
          continue;
        }
        if (depth === 0 && text[i] === "`") {
          out += text[i]!;
          i++;
          break;
        }
        if (text[i] === "$" && text[i + 1] === "{") {
          depth++;
          out += "${";
          i += 2;
          continue;
        }
        if (depth > 0 && text[i] === "{") {
          depth++;
          out += text[i]!;
          i++;
          continue;
        }
        if (depth > 0 && text[i] === "}") {
          depth--;
          out += text[i]!;
          i++;
          continue;
        }
        out += text[i]!;
        i++;
      }
      continue;
    }
    out += c;
    i++;
  }
  return out;
}

interface FileText {
  relPath: string;
  absPath: string;
  text: string;
  lines: string[];
}

const FILES: FileText[] = REPO_FILES.map((relPath) => {
  const absPath = path.join(REPO_ROOT, relPath);
  const raw = readFileSync(absPath, "utf8");
  // `text` is the comment/string-stripped view every assertion below scans;
  // it is the same length as `raw` so lineOfOffset() stays valid for both.
  const text = stripCommentsAndStrings(raw);
  return { relPath, absPath, text, lines: text.split("\n") };
});

/** 1-based line number of the first match of `re` within `text`, or the
 * line number containing `index` if a byte offset is supplied directly. */
function lineOfOffset(text: string, offset: number): number {
  return text.slice(0, offset).split("\n").length;
}

describe("DEC-511: LIKE-escaping invariant, enumerated over src/server/repo/**/*.ts", () => {
  it("found at least one repo file to scan (glob is not silently empty)", () => {
    expect(FILES.length).toBeGreaterThan(10);
  });

  it("exactly one module exports likeContains, and it is src/server/repo/like.ts", () => {
    const exporters = FILES.filter((f) => /export\s+function\s+likeContains\b/.test(f.text));
    const offenders = exporters
      .filter((f) => f.relPath !== "src/server/repo/like.ts")
      .map((f) => {
        const idx = f.text.search(/export\s+function\s+likeContains\b/);
        return `${f.relPath}:${lineOfOffset(f.text, idx)}`;
      });
    expect(offenders, `unexpected likeContains export(s): ${offenders.join(", ")}`).toEqual([]);
    expect(
      exporters.map((f) => f.relPath),
      "likeContains must be exported by exactly one module",
    ).toEqual(["src/server/repo/like.ts"]);
  });

  it("likeContains's body contains no toLowerCase/toUpperCase (case handling is the collation's job, DEC-506)", () => {
    const likeFile = FILES.find((f) => f.relPath === "src/server/repo/like.ts");
    expect(likeFile, "src/server/repo/like.ts not found by the glob").toBeDefined();
    const text = likeFile!.text;
    const offenders: string[] = [];
    for (const re of [/\.toLowerCase\s*\(/g, /\.toUpperCase\s*\(/g]) {
      for (const m of text.matchAll(re)) {
        offenders.push(`${likeFile!.relPath}:${lineOfOffset(text, m.index!)}: ${m[0]}`);
      }
    }
    expect(offenders, `case-folding found in like.ts: ${offenders.join(", ")}`).toEqual([]);
  });

  /** Every occurrence of `sql` tagged-template that contains a LIKE/like SQL
   * keyword, scanned per-file. Matches the drizzle `sql\`...\`` tagged
   * template (backtick-delimited) — this repo's only way of hand-writing a
   * LIKE predicate (see field guide: "two implementations of one invariant
   * means one is wrong"). Reports file:line of the template's start. */
  function likeBearingTemplates(f: FileText): Array<{ line: number; body: string }> {
    const out: Array<{ line: number; body: string }> = [];
    const re = /\bsql`([\s\S]*?)`/g;
    for (const m of f.text.matchAll(re)) {
      const body = m[1]!;
      if (/\bLIKE\b/i.test(body)) {
        out.push({ line: lineOfOffset(f.text, m.index!), body });
      }
    }
    return out;
  }

  it("every sql`...LIKE...` template pairs the keyword with ESCAPE '\\\\'", () => {
    const offenders: string[] = [];
    for (const f of FILES) {
      for (const t of likeBearingTemplates(f)) {
        if (!/ESCAPE\s+'\\\\'/i.test(t.body)) {
          offenders.push(`${f.relPath}:${t.line}`);
        }
      }
    }
    expect(offenders, `LIKE without ESCAPE '\\\\' at: ${offenders.join(", ")}`).toEqual([]);
  });

  it("no repo file imports drizzle-orm's `like` or `ilike` helper (it emits no ESCAPE clause)", () => {
    // Match named-import specifier lists from 'drizzle-orm', e.g.
    // `import { and, eq, like } from "drizzle-orm";` — checked against the
    // parsed specifier list (split on commas inside the braces), not a
    // naive substring/call-site search, so a column or variable named
    // `like` elsewhere doesn't false-positive and a helper named
    // `dislike`/`likeSomething` doesn't either.
    const importRe = /import\s*\{([^}]*)\}\s*from\s*["']drizzle-orm["']/g;
    const offenders: string[] = [];
    for (const f of FILES) {
      for (const m of f.text.matchAll(importRe)) {
        const specifiers = m[1]!
          .split(",")
          .map((s) => s.trim())
          .map((s) => s.split(/\s+as\s+/)[0]!.trim())
          .filter(Boolean);
        if (specifiers.includes("like") || specifiers.includes("ilike")) {
          offenders.push(`${f.relPath}:${lineOfOffset(f.text, m.index!)}`);
        }
      }
    }
    expect(offenders, `drizzle-orm like/ilike import found at: ${offenders.join(", ")}`).toEqual([]);
  });

  it("every LIKE-bearing template uses the ONE idiom: no COLLATE NOCASE, no lower(...) (DEC-506 wave-64 amendment)", () => {
    // SQLite's LIKE already case-folds ASCII by itself (COLLATE NOCASE
    // beside it is inert) and its lower() is ASCII-only while a caller's
    // JS .toLowerCase() is Unicode-aware — mixing the two idioms (or using
    // either one) drops rows whose case differs only in a non-ASCII
    // letter. The single sanctioned shape is the raw (unfolded) escaped
    // needle compared with plain `LIKE ... ESCAPE '\\'`.
    const offenders: string[] = [];
    for (const f of FILES) {
      for (const t of likeBearingTemplates(f)) {
        const hasCollateNocase = /COLLATE\s+NOCASE/i.test(t.body);
        const hasLower = /\blower\s*\(/i.test(t.body);
        if (hasCollateNocase || hasLower) {
          offenders.push(`${f.relPath}:${t.line}`);
        }
      }
    }
    expect(
      offenders,
      `LIKE template with COLLATE NOCASE or lower(...) at: ${offenders.join(", ")}`,
    ).toEqual([]);
  });

  it("no likeContains(...) call argument is itself wrapped in .toLowerCase()/.toUpperCase()", () => {
    // Case-folding belongs nowhere near a LIKE call site now — not on the
    // SQL side (lower()/COLLATE NOCASE, asserted above) and not on the JS
    // side feeding likeContains its needle.
    const offenders: string[] = [];
    const re = /likeContains\s*\(([^)]*)\)/g;
    for (const f of FILES) {
      for (const m of f.text.matchAll(re)) {
        const arg = m[1]!;
        if (/\.toLowerCase\s*\(|\.toUpperCase\s*\(/.test(arg)) {
          offenders.push(`${f.relPath}:${lineOfOffset(f.text, m.index!)}`);
        }
      }
    }
    expect(offenders, `likeContains() call with case-folded argument at: ${offenders.join(", ")}`).toEqual([]);
  });
});
