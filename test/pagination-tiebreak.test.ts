// DEC-534: every OFFSET-paged list must end its ORDER BY in a unique
// column, enforced by a GLOBBED scan over src/server/repo/**/*.ts rather
// than a hand-maintained allowlist (field guide: "hand-listed manifests
// desync -- enumerate in a test"). No file-path literals below are used to
// select the offending sites; the glob re-reads the tree at run time.
//
// Scope: this deliberately matches only the OFFSET-paged class of query --
// a direct `.orderBy(...).limit(n).offset(m)` chain, or this codebase's
// conditional idiom (`page ? await base.limit(page.limit).offset(page.offset)
// : await base`, or `const rows = await (offset > 0 ? query.offset(offset) :
// query)`). It deliberately does NOT sweep in capped non-offset reads
// (`.limit(ROW_CAP)`, `.limit(1)`, contacts/stats.ts:50's top-5
// `orderBy(desc(count(*)))`) -- those never page past row 1 of a LIMIT
// window, so a repeated/dropped row is not observable the way it is for an
// OFFSET-paged list. This is verification-only: it reads source files as
// plain text/regex, never imports or executes production code.
//
// Self-check performed by hand while writing this test (not re-run
// automatically): temporarily reverting the DEC-534 tiebreak just added to
// src/server/repo/email.ts (dropping the trailing `asc(schema.emailLog.id)`)
// made "every OFFSET-paged orderBy ends in a unique column" fail with that
// file listed as an offender; restoring the tiebreak made it pass again.
// Confirmed the same for contacts/history.ts, public/sessions.ts (both
// branches) and public/speakers.ts.

import { describe, expect, it } from "vitest";
import { globSync, readFileSync } from "node:fs";
import path from "node:path";

const REPO_ROOT = path.resolve(__dirname, "..");

/** All repo-layer source files, globbed fresh on every run. */
const REPO_FILES: string[] = globSync("src/server/repo/**/*.ts", { cwd: REPO_ROOT }).sort();

/** Replaces `//` line comments and `/* *\/` block comments with same-length
 * whitespace (preserving offsets), copies `'...'`/`"..."` string bodies
 * through as blanks, and copies template-literal (`` ` ``) bodies through
 * verbatim -- ported from test/like-escaping-enumeration.test.ts (DEC-511),
 * whose header notes a stray backtick in a JSDoc comment can desync a naive
 * scanner if comments aren't stripped first. */
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
  text: string;
}

const FILES: FileText[] = REPO_FILES.map((relPath) => {
  const absPath = path.join(REPO_ROOT, relPath);
  const raw = readFileSync(absPath, "utf8");
  return { relPath, text: stripCommentsAndStrings(raw) };
});

function lineOfOffset(text: string, offset: number): number {
  return text.slice(0, offset).split("\n").length;
}

/** Splits `text` on top-level commas only -- commas nested inside
 * (), [], {} or backtick template literals do not split. */
function topLevelSplit(text: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let cur = "";
  let inBacktick = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i]!;
    if (inBacktick) {
      cur += c;
      if (c === "`") inBacktick = false;
      continue;
    }
    if (c === "`") {
      inBacktick = true;
      cur += c;
      continue;
    }
    if (c === "(" || c === "[" || c === "{") {
      depth++;
      cur += c;
      continue;
    }
    if (c === ")" || c === "]" || c === "}") {
      depth--;
      cur += c;
      continue;
    }
    if (c === "," && depth === 0) {
      parts.push(cur);
      cur = "";
      continue;
    }
    cur += c;
  }
  if (cur.trim() !== "") parts.push(cur);
  return parts.map((s) => s.trim()).filter((s) => s !== "");
}

/** Given the full argument-list text of a call (already stripped of the
 * surrounding parens), extracts a balanced call/statement starting at
 * `openIdx` (index of the opening bracket char) up to and including its
 * matching close, respecting nested (), [], {} and backtick templates. */
function extractBalanced(text: string, openIdx: number, openCh: string, closeCh: string): { inner: string; endIdx: number } {
  let depth = 0;
  let i = openIdx;
  let inBacktick = false;
  for (; i < text.length; i++) {
    const c = text[i]!;
    if (inBacktick) {
      if (c === "`") inBacktick = false;
      continue;
    }
    if (c === "`") {
      inBacktick = true;
      continue;
    }
    if (c === openCh) depth++;
    else if (c === closeCh) {
      depth--;
      if (depth === 0) {
        return { inner: text.slice(openIdx + 1, i), endIdx: i + 1 };
      }
    }
  }
  throw new Error(`unbalanced ${openCh}${closeCh} starting at ${openIdx}`);
}

const UNIQUE_COL_RE = /\bid\b|\bseq\b/;

/** Resolves the "final ordering term(s)" of an ORDER BY argument-list text.
 * Handles three shapes seen in this codebase:
 *  - a plain comma-separated arg list, e.g. `asc(a), asc(b)` -> last arg `asc(b)`
 *  - a single `` sql`...` `` tagged template whose *SQL text* is itself
 *    comma-separated (e.g. `` sql`${a} asc, ${b} asc` ``) -> last SQL segment
 *  - a single delegated call to a local helper function (e.g.
 *    `orderByForSort(params.sort)`), which is resolved by finding
 *    `function <name>(...)` in the same file and recursively resolving
 *    every `return ...;` branch inside it (e.g. submissions/list.ts's
 *    per-sort switch, each branch a `` sql`...` `` template with a `seq`
 *    tiebreak) -- ALL branches must carry a unique-column tiebreak, since
 *    any one of them can be the one that actually runs.
 * Returns the list of final-term strings to regex-check (more than one only
 * when delegated to a multi-branch helper). */
function resolveFinalTerms(argsText: string, fileText: string, depth = 0): string[] {
  if (depth > 5) throw new Error("resolveFinalTerms: recursion too deep (cycle in helper delegation?)");
  const terms = topLevelSplit(argsText);
  if (terms.length === 0) return [];

  if (terms.length === 1) {
    const single = terms[0]!;
    const sqlMatch = /^sql`([\s\S]*)`$/.exec(single);
    if (sqlMatch) {
      const sqlSegments = sqlMatch[1]!.split(",");
      return [sqlSegments[sqlSegments.length - 1]!.trim()];
    }
    const callMatch = /^([A-Za-z_$][\w$]*)\s*\(/.exec(single);
    if (callMatch && !["asc", "desc", "sql"].includes(callMatch[1]!)) {
      const fnName = callMatch[1]!;
      const defRe = new RegExp(`function\\s+${fnName}\\s*\\(`);
      const defMatch = defRe.exec(fileText);
      if (!defMatch) {
        // Not a locally-defined helper we can resolve (e.g. a drizzle
        // builtin or imported fn) -- fall through and check the call-site
        // text itself, which will correctly fail the regex if it has no
        // inline id/seq reference.
        return [single];
      }
      const paramsOpen = fileText.indexOf("(", defMatch.index);
      const { endIdx: paramsEnd } = extractBalanced(fileText, paramsOpen, "(", ")");
      const bodyOpen = fileText.indexOf("{", paramsEnd);
      const { inner: body } = extractBalanced(fileText, bodyOpen, "{", "}");
      const returnRe = /\breturn\s+/g;
      const branches: string[] = [];
      let m: RegExpExecArray | null;
      while ((m = returnRe.exec(body))) {
        const exprStart = m.index + m[0].length;
        const { expr } = extractStatementExpr(body, exprStart);
        branches.push(expr);
      }
      if (branches.length === 0) {
        throw new Error(`resolveFinalTerms: no return statements found in helper ${fnName}`);
      }
      return branches.flatMap((b) => resolveFinalTerms(b, fileText, depth + 1));
    }
    return [single];
  }

  const last = terms[terms.length - 1]!;
  const sqlMatch = /^sql`([\s\S]*)`$/.exec(last);
  if (sqlMatch) {
    const sqlSegments = sqlMatch[1]!.split(",");
    return [sqlSegments[sqlSegments.length - 1]!.trim()];
  }
  return [last];
}

/** Scans forward from `start` in `body` for a top-level `;` (respecting
 * nested (), [], {} and backtick templates) and returns the expression text
 * before it. */
function extractStatementExpr(body: string, start: number): { expr: string; endIdx: number } {
  let depth = 0;
  let inBacktick = false;
  let i = start;
  for (; i < body.length; i++) {
    const c = body[i]!;
    if (inBacktick) {
      if (c === "`") inBacktick = false;
      continue;
    }
    if (c === "`") {
      inBacktick = true;
      continue;
    }
    if (c === "(" || c === "[" || c === "{") depth++;
    else if (c === ")" || c === "]" || c === "}") depth--;
    else if (c === ";" && depth === 0) {
      return { expr: body.slice(start, i).trim(), endIdx: i + 1 };
    }
  }
  throw new Error("extractStatementExpr: no terminating ; found");
}

interface OrderByCall {
  relPath: string;
  line: number;
  argsText: string;
  offsetPaged: boolean;
}

/** Every `.orderBy(...)` call site across the repo layer, each tagged with
 * whether it belongs to an OFFSET-paged query (a `.offset(` call appears in
 * the forward window before the next `.orderBy(` call, or within 2000 chars
 * -- generous enough to span this codebase's conditional-offset idiom and
 * its explanatory comments, but bounded so it can't bleed into an unrelated
 * later function). */
function findOrderByCalls(f: FileText): OrderByCall[] {
  const calls: OrderByCall[] = [];
  const re = /\.orderBy\s*\(/g;
  const starts: number[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(f.text))) {
    starts.push(m.index + m[0].length - 1);
  }
  for (let k = 0; k < starts.length; k++) {
    const openIdx = starts[k]!;
    const { inner, endIdx } = extractBalanced(f.text, openIdx, "(", ")");
    const nextStart = starts[k + 1] ?? f.text.length;
    const windowEnd = Math.min(nextStart, endIdx + 2000, f.text.length);
    const window = f.text.slice(endIdx, windowEnd);
    const offsetPaged = /\.offset\s*\(/.test(window);
    calls.push({ relPath: f.relPath, line: lineOfOffset(f.text, openIdx), argsText: inner, offsetPaged });
  }
  return calls;
}

const ALL_ORDER_BY_CALLS: OrderByCall[] = FILES.flatMap((f) => findOrderByCalls(f));
const OFFSET_PAGED_CALLS = ALL_ORDER_BY_CALLS.filter((c) => c.offsetPaged);

describe("DEC-534: every OFFSET-paged .orderBy() ends in a unique column, enumerated over src/server/repo/**/*.ts", () => {
  it("found at least one repo file to scan (glob is not silently empty)", () => {
    expect(FILES.length).toBeGreaterThan(10);
  });

  it("found at least one OFFSET-paged orderBy call (the class this test actually checks)", () => {
    expect(OFFSET_PAGED_CALLS.length).toBeGreaterThan(5);
  });

  it("every OFFSET-paged orderBy's final term references id or seq", () => {
    const offenders: string[] = [];
    const fileTextByPath = new Map(FILES.map((f) => [f.relPath, f.text]));
    for (const call of OFFSET_PAGED_CALLS) {
      const fileText = fileTextByPath.get(call.relPath)!;
      const finals = resolveFinalTerms(call.argsText, fileText);
      for (const finalTerm of finals) {
        if (!UNIQUE_COL_RE.test(finalTerm)) {
          offenders.push(`${call.relPath}:${call.line}: final term "${finalTerm}" has no id/seq tiebreak`);
        }
      }
    }
    expect(offenders, `OFFSET-paged orderBy without a unique-column tiebreak:\n${offenders.join("\n")}`).toEqual([]);
  });

  it("known-compliant sites are present and correctly classified as OFFSET-paged", () => {
    // Spot-check (not the enforcement above, which is glob-driven) that the
    // matcher actually reaches the sites named in DEC-534's task notes,
    // rather than silently matching zero calls in each. A regression here
    // means the offset-detection heuristic itself broke, independent of
    // whether any tiebreak is present.
    const expectedFiles = [
      "src/server/repo/email.ts",
      // contacts/history.ts's "last 20 emails" query is a capped (non-
      // offset) read, not OFFSET-paged — its tiebreak was fixed above for
      // stability, but it deliberately isn't part of this test's checked
      // set (see the file header carve-out).
      "src/server/repo/public/sessions.ts",
      "src/server/repo/public/speakers.ts",
      "src/server/repo/tasks/grid.ts",
      "src/server/repo/submissions/list.ts",
      "src/server/repo/review/reviewers.ts",
      "src/server/repo/review/plans.ts",
      "src/server/repo/contacts/segments.ts",
      "src/server/repo/users.ts",
      // files-library.ts (DEC-773): the merged files-library list (deliverable
      // chains + headshots) now fetches every MATCHING root once (totalSizeBytes
      // has to visit every match anyway) and paginates via an in-memory slice,
      // not a SQL OFFSET — so it's deliberately no longer part of this check.
      "src/server/repo/views.ts",
      "src/server/repo/portal-config.ts",
      "src/server/repo/events.ts",
      "src/server/repo/pipeline.ts",
      "src/server/repo/comms.ts",
    ];
    const offsetPagedFiles = new Set(OFFSET_PAGED_CALLS.map((c) => c.relPath));
    const missing = expectedFiles.filter((rel) => REPO_FILES.includes(rel) && !offsetPagedFiles.has(rel));
    expect(missing, `expected these files to have an OFFSET-paged orderBy call: ${missing.join(", ")}`).toEqual([]);
  });

  it("deliberately excludes non-offset capped reads from the checked set", () => {
    // contacts/stats.ts's top-5 `orderBy(desc(count(*))).limit(5)` has no
    // offset(), so it must not appear in OFFSET_PAGED_CALLS at all -- this
    // guards the "scope to the offset class" carve-out described in the
    // task notes and the file header above.
    const statsFile = FILES.find((f) => f.relPath === "src/server/repo/contacts/stats.ts");
    expect(statsFile, "src/server/repo/contacts/stats.ts not found by the glob").toBeDefined();
    const statsOffsetPaged = OFFSET_PAGED_CALLS.filter((c) => c.relPath === "src/server/repo/contacts/stats.ts");
    expect(statsOffsetPaged).toEqual([]);
  });
});
