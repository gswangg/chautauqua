// DEC-020 amendment (wave 52): SPEC J8 requires that unapproved content never
// reaches public surfaces, and the mechanism is reopenContentReview
// (src/server/repo/files-content-status.ts) putting a submission's
// content_status back to 'pending' when new bytes land against it. Before
// this scan existed the wiring was hand-verified at exactly two doors
// (src/routes/files.ts, src/routes/portal/tasks.tsx) by per-file tests
// (test/content-reupload-reopens.test.ts, test/task-upload-content.test.ts) --
// neither of which could ever notice a FIFTH door added tomorrow. This scan
// re-derives the population of "every write of a `file` row" AT TEST TIME,
// the same two-directional ledger shape as test/file-delete-ordering.scan.
// test.ts and test/status-change-mail-ledger.scan.test.ts (whose
// length-preserving stripComments is copied verbatim below so reported line
// numbers stay accurate).
//
// WHAT COUNTS AS A "WRITE OF A FILE ROW": a call to `insertFile(` (the
// shared repo helper, src/server/repo/files-versions.ts) OR any
// `db.insert(schema.file)` (a direct write bypassing that helper -- there
// are three: repo/submit.ts, repo/profile.ts, repo/portal-config.ts -- plus
// insertFile's OWN implementation, which also literally contains
// `db.insert(schema.file)`).
//
// CLASSIFICATION: each hit's `submissionId` field/argument is read directly
// out of its enclosing object literal. Only a literal `submissionId: null`
// proves the null case (a null submissionId means there is no submission
// whose content_status could need reopening -- resources, headshots, plain
// handout tasks). Anything else -- an identifier, a property access, a
// shorthand `submissionId,` -- is an UNRESOLVABLE expression and must be
// treated as potentially non-null: it either reaches reopenContentReview
// within its enclosing named function/route-handler slice, or it is
// EXEMPT_HITS-ledgered with a written, file+line-anchored reason. There is
// no third option -- an unresolvable expression is never "assumed safe".
//
// Deliberately a lightweight brace-matching text scan (this repo already
// does text scans of source elsewhere), same idiom as the two reference
// scans above -- no parser dependency added.

import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = join(__dirname, "..");
const SRC_ROOT = join(ROOT, "src");
const SKIP_DIRS = new Set(["node_modules", "dist", ".wrangler", "build", ".git"]);

// ---------------------------------------------------------------------------
// stripComments -- copied verbatim from test/file-delete-ordering.scan.test.ts
// (length-preserving: comments become spaces, newlines inside block comments
// are kept as newlines; string/template literal contents preserved so a
// `//`/`/*` inside a string is never mistaken for a comment start).
// ---------------------------------------------------------------------------
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
    } else if (stat.isFile() && /\.(ts|tsx)$/.test(entry)) {
      out.push(full);
    }
  }
}

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

// ---------------------------------------------------------------------------
// Enclosing-scope detection: named function/method declarations (as in
// file-delete-ordering.scan.test.ts) PLUS route-handler registrations
// (`<router>.<method>("path", ...middleware, async (c) => { ... })`), since
// most write sites here live inside an anonymous route-handler arrow, not a
// named function.
// ---------------------------------------------------------------------------
const FUNCTION_DECL = /^(?:export\s+)?(?:async\s+)?function\s+([A-Za-z0-9_]+)\s*(?:<[^>]*>)?\s*\(/;
const RESERVED_METHOD_NAMES = new Set(["if", "for", "while", "switch", "catch", "function", "try", "else"]);
const METHOD_DECL = /^\s*(?:export\s+)?(?:async\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*\(.*\)\s*(?::\s*[^{]+)?\{\s*$/;
const ROUTE_HANDLER_RE = /\.\w+\(\s*(["'`])([^"'`]*)\1\s*,\s*(?:\w+\s*,\s*)*async\s*\(?[^)]*\)?\s*=>\s*\{/g;

interface NamedScope {
  name: string;
  bodyStart: number;
  bodyEnd: number;
}

function findNamedScopes(src: string): NamedScope[] {
  const out: NamedScope[] = [];
  const lines = src.split("\n");
  let offset = 0;
  const lineOffsets: number[] = [];
  for (const line of lines) {
    lineOffsets.push(offset);
    offset += line.length + 1;
  }
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? "";
    const fn = FUNCTION_DECL.exec(line);
    const method = fn ? null : METHOD_DECL.exec(line);
    const name = fn?.[1] ?? method?.[1];
    if (!name || RESERVED_METHOD_NAMES.has(name)) continue;
    const lineStart = lineOffsets[i] ?? 0;
    const searchFrom = lineStart + (fn ? fn[0].length - 1 : line.length - 1);
    const openIdx = src.indexOf("{", Math.max(lineStart, searchFrom));
    if (openIdx === -1) continue;
    const bodyStart = openIdx + 1;
    const bodyEnd = matchBrace(src, openIdx) - 1;
    out.push({ name, bodyStart, bodyEnd });
  }

  let m: RegExpExecArray | null;
  ROUTE_HANDLER_RE.lastIndex = 0;
  while ((m = ROUTE_HANDLER_RE.exec(src))) {
    const openIdx = m.index + m[0].length - 1;
    const bodyStart = openIdx + 1;
    const bodyEnd = matchBrace(src, openIdx) - 1;
    out.push({ name: `route:${m[2]}`, bodyStart, bodyEnd });
  }
  return out;
}

/** Innermost enclosing named/route scope for `pos` (smallest span that
 * contains it), or "(module scope)" if none. */
function nearestEnclosingScope(scopes: NamedScope[], pos: number): string {
  const enclosing = scopes
    .filter((s) => pos >= s.bodyStart && pos < s.bodyEnd)
    .sort((a, b) => a.bodyEnd - a.bodyStart - (b.bodyEnd - b.bodyStart));
  return enclosing[0]?.name ?? "(module scope)";
}

function scopeSlice(scopes: NamedScope[], src: string, pos: number): string {
  const enclosing = scopes
    .filter((s) => pos >= s.bodyStart && pos < s.bodyEnd)
    .sort((a, b) => a.bodyEnd - a.bodyStart - (b.bodyEnd - b.bodyStart));
  const scope = enclosing[0];
  if (!scope) return src;
  return src.slice(scope.bodyStart, scope.bodyEnd);
}

// ---------------------------------------------------------------------------
// Write-site detection: `insertFile(` calls (never the declaration itself --
// filtered out below by checking the text isn't preceded by `function `) and
// every `db.insert(schema.file)`.
// ---------------------------------------------------------------------------
const INSERT_FILE_CALL = /\binsertFile\s*\(/g;
const DB_INSERT_FILE = /\bdb\s*\.\s*insert\s*\(\s*schema\s*\.\s*file\s*\)/g;
const FUNCTION_DECL_TAIL = /function\s+$/;

interface WriteHit {
  file: string; // repo-relative path
  line: number;
  kind: "insertFile-call" | "db.insert(schema.file)";
  scope: string;
  submissionIdExpr: string | null; // null when the field couldn't be found at all
  isNullLiteral: boolean;
}

/** From `pos` (index just past the write-site match, i.e. right after the
 * opening paren of the call), locates the nearest `{` within a short window,
 * brace-matches it, and extracts the `submissionId` field's raw value --
 * handling both `submissionId: <expr>` and shorthand `submissionId,`/
 * `submissionId }`. Returns null if no `submissionId` field is found in that
 * object literal at all (a fail-loud signal, not an assumed-safe default). */
function extractSubmissionIdExpr(src: string, searchFrom: number): string | null {
  const windowEnd = Math.min(src.length, searchFrom + 400);
  const openIdx = src.indexOf("{", searchFrom);
  if (openIdx === -1 || openIdx > windowEnd) return null;
  const bodyStart = openIdx + 1;
  const bodyEnd = matchBrace(src, openIdx) - 1;
  const body = src.slice(bodyStart, bodyEnd);
  const m = /\bsubmissionId\b\s*(:\s*([^,}]+))?/.exec(body);
  if (!m) return null;
  if (m[2] !== undefined) return m[2].trim();
  return "submissionId"; // shorthand -- the identifier itself, never a literal
}

function scanForWriteHits(): WriteHit[] {
  const files: string[] = [];
  walk(SRC_ROOT, files);

  const hits: WriteHit[] = [];
  for (const file of files) {
    const rawSrc = readFileSync(file, "utf8");
    const src = stripComments(rawSrc);
    const scopes = findNamedScopes(src);
    const rel = relative(ROOT, file).split("\\").join("/");

    let match: RegExpExecArray | null;
    INSERT_FILE_CALL.lastIndex = 0;
    while ((match = INSERT_FILE_CALL.exec(src))) {
      const before = src.slice(Math.max(0, match.index - 20), match.index);
      if (FUNCTION_DECL_TAIL.test(before)) continue; // the declaration itself, not a call
      const pos = match.index;
      const submissionIdExpr = extractSubmissionIdExpr(src, match.index + match[0].length);
      const lineIdx = src.slice(0, pos).split("\n").length - 1;
      hits.push({
        file: rel,
        line: lineIdx + 1,
        kind: "insertFile-call",
        scope: nearestEnclosingScope(scopes, pos),
        submissionIdExpr,
        isNullLiteral: submissionIdExpr === "null",
      });
    }

    DB_INSERT_FILE.lastIndex = 0;
    while ((match = DB_INSERT_FILE.exec(src))) {
      const pos = match.index;
      const submissionIdExpr = extractSubmissionIdExpr(src, match.index + match[0].length);
      const lineIdx = src.slice(0, pos).split("\n").length - 1;
      hits.push({
        file: rel,
        line: lineIdx + 1,
        kind: "db.insert(schema.file)",
        scope: nearestEnclosingScope(scopes, pos),
        submissionIdExpr,
        isNullLiteral: submissionIdExpr === "null",
      });
    }
  }
  return hits;
}

/** True if this hit's enclosing named/route scope's own source slice
 * contains a `reopenContentReview` call. */
function reachesReopen(src: string, scopes: NamedScope[], pos: number): boolean {
  return /\breopenContentReview\s*\(/.test(scopeSlice(scopes, src, pos));
}

// ---------------------------------------------------------------------------
// EXEMPT_HITS -- ledgered, file + enclosing-scope-name keyed, one-line reason
// each. Both entries are non-null-capable `submissionId` writes whose
// enclosing scope legitimately never calls reopenContentReview.
// ---------------------------------------------------------------------------
const EXEMPT_HITS: { file: string; scope: string; reason: string }[] = [
  {
    file: "src/server/repo/submit.ts",
    scope: "insertAttachmentFile",
    reason:
      "The public CFP create path (src/routes/public/submit-post.tsx calls this while minting a brand-new submission in the SAME request). The submission has no prior content_status to reopen -- it doesn't exist as an approved/changes_requested row yet at the moment this file row is written.",
  },
  {
    file: "src/server/repo/files-versions.ts",
    scope: "insertFile",
    reason:
      "This is insertFile()'s own db.insert(schema.file) implementation -- not a caller of insertFile, it IS insertFile. The reopen obligation belongs to each individual `insertFile(...)` CALL SITE (scanned separately, by kind 'insertFile-call' above), which decides whether to reopen based on its own caller context after insertFile returns.",
  },
];

describe("content-review reopen door coverage scan (DEC-020 amendment, wave 52)", () => {
  it("finds a non-zero number of file-row write sites (matcher isn't vacuous)", () => {
    const hits = scanForWriteHits();
    expect(hits.length).toBeGreaterThan(0);
  });

  it("finds both call shapes: insertFile( calls and db.insert(schema.file) sites", () => {
    const hits = scanForWriteHits();
    expect(hits.some((h) => h.kind === "insertFile-call")).toBe(true);
    expect(hits.some((h) => h.kind === "db.insert(schema.file)")).toBe(true);
  });

  it("every non-null-capable submissionId write reaches reopenContentReview in its enclosing scope, or is EXEMPT-ledgered", () => {
    const files: string[] = [];
    walk(SRC_ROOT, files);
    const srcByFile = new Map<string, { src: string; scopes: NamedScope[] }>();
    for (const file of files) {
      const rel = relative(ROOT, file).split("\\").join("/");
      const src = stripComments(readFileSync(file, "utf8"));
      srcByFile.set(rel, { src, scopes: findNamedScopes(src) });
    }

    const hits = scanForWriteHits();
    const offenders: string[] = [];
    for (const hit of hits) {
      if (hit.submissionIdExpr === null) {
        offenders.push(
          `${hit.file}:${hit.line} (${hit.kind}, in ${hit.scope}) -- no submissionId field found at all near this write ` +
            `-- unresolvable, must be classified explicitly (add a submissionId field, or investigate why the extractor missed it).`,
        );
        continue;
      }
      if (hit.isNullLiteral) continue; // proven safe: no submission, nothing to reopen

      const exempt = EXEMPT_HITS.find((e) => e.file === hit.file && e.scope === hit.scope);
      if (exempt) continue;

      const entry = srcByFile.get(hit.file);
      if (!entry) {
        offenders.push(`${hit.file}:${hit.line} -- file vanished mid-scan`);
        continue;
      }
      // Recompute the match position in this file's stripped src to look up
      // the enclosing scope's reopenContentReview presence.
      const reFind = hit.kind === "insertFile-call" ? INSERT_FILE_CALL : DB_INSERT_FILE;
      reFind.lastIndex = 0;
      let pos = -1;
      let m: RegExpExecArray | null;
      while ((m = reFind.exec(entry.src))) {
        const lineIdx = entry.src.slice(0, m.index).split("\n").length - 1;
        if (lineIdx + 1 === hit.line) {
          if (hit.kind === "insertFile-call") {
            const before = entry.src.slice(Math.max(0, m.index - 20), m.index);
            if (FUNCTION_DECL_TAIL.test(before)) continue;
          }
          pos = m.index;
          break;
        }
      }
      if (pos === -1) {
        offenders.push(`${hit.file}:${hit.line} -- could not relocate hit for reopen check`);
        continue;
      }

      if (!reachesReopen(entry.src, entry.scopes, pos)) {
        offenders.push(
          `${hit.file}:${hit.line} (${hit.kind}, in ${hit.scope}) -- submissionId is non-null-capable ` +
            `(expression: "${hit.submissionIdExpr}") and its enclosing scope never calls reopenContentReview -- ` +
            `either call reopenContentReview(db, submissionId) after this write commits, or add a ` +
            `{ file, scope, reason } entry to EXEMPT_HITS in test/content-reopen-door-coverage.scan.test.ts.`,
        );
      }
    }

    expect(offenders, offenders.join("\n")).toEqual([]);
  });

  it("every EXEMPT_HITS entry still matches a real hit (no stale lines)", () => {
    const hits = scanForWriteHits();
    const stale = EXEMPT_HITS.filter((entry) => !hits.some((hit) => hit.file === entry.file && hit.scope === entry.scope));
    expect(
      stale,
      stale.map((entry) => `${entry.file} / ${entry.scope}: stale EXEMPT_HITS entry -- delete this line, no matching hit was found by the scan.`).join("\n"),
    ).toEqual([]);
  });

  it("every EXEMPT_HITS entry has a written reason", () => {
    for (const entry of EXEMPT_HITS) {
      expect(entry.reason.length, `${entry.file} / ${entry.scope} has no stated reason`).toBeGreaterThan(0);
    }
  });
});
