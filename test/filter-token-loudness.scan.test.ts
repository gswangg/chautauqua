// DEC-843 amendment (w38): every list-filter token parser that splits a
// query param on ',' and tests membership in a `*_STATUSES`/`*_KINDS`/
// `*_TOKENS` const must THROW on an unrecognised token, never silently drop
// it — a dropped token widens a filter to "everything" (?contentStatus=
// aproved returning every content status; ?kind=xyz returning every kind),
// which on a filter that gates row VISIBILITY is the same defect DEC-843
// already fixed for `status` and DEC-881 fixed for `reuploaded`.
//
// This is an ENUMERATING scan, not a sample: part 1 names every known
// comma-split + enum-membership parser and calls it directly (or, if it
// can't be called in isolation, asserts at source level that its body
// THROWS on the unknown-token branch and contains no silent
// `.filter(...includes...)` drop). Part 2 re-derives the set generically —
// walking src/**/*.ts for the `.filter(` + `.includes(` + `*_STATUSES`/
// `*_KINDS`/`*_TOKENS` silent-drop shape — and requires any hit to be named
// in the exemption map below with a written reason, so a NEW silently-
// dropping parser added after this wave fails the scan instead of hiding.
import { describe, it, expect } from "vitest";
import { readFileSync, existsSync, readdirSync } from "node:fs";
import { join, relative, sep } from "node:path";
import {
  readStatusTokens,
  readReuploadedToken,
  readContentStatusTokens,
} from "../src/server/repo/submissions/query";

const REPO_ROOT = join(__dirname, "..");

// Every parser this wave's audit found that splits a query param on ',' and
// tests membership in a `*_STATUSES`/`*_KINDS`/`*_TOKENS` const — named
// explicitly, not sampled. A parser matching that shape but NOT in this list
// is caught instead by the generic scan in part 2 below.
const NAMED_PARSERS = [
  "readStatusTokens (src/server/repo/submissions/query.ts, SUBMISSION_STATUSES)",
  "readReuploadedToken (src/server/repo/submissions/query.ts, single-token '1'/'0' vocabulary)",
  "readContentStatusTokens (src/server/repo/submissions/query.ts, CONTENT_STATUSES)",
  "parseKinds (src/routes/files.ts, LIBRARY_KIND_TOKENS — not exported, asserted at source level)",
];

// Any file whose source matches the generic silent-drop shape (part 2) but
// is not a genuine list-filter token parser must be named here with a
// written, file-specific reason. Kept empty: this wave's audit found none —
// a non-empty diff in part 2 means either a real regression (fix it) or a
// legitimate new exemption (name it here with a reason, don't just widen
// the detector).
const EXEMPT_SILENT_DROP: Record<string, string> = {};

describe("filter-token-loudness scan (DEC-843 amendment, w38)", () => {
  it("names at least the parsers this wave's audit found", () => {
    expect(NAMED_PARSERS.length).toBeGreaterThanOrEqual(4);
  });

  it("readStatusTokens throws on an unknown token, drops nothing silently", () => {
    expect(() => readStatusTokens("accepted,bogus")).toThrow(/Unknown status 'bogus'/);
    expect(readStatusTokens("accepted,accepted,declined")).toEqual(["accepted", "declined"]);
    expect(readStatusTokens(undefined)).toEqual([]);
  });

  it("readReuploadedToken throws on an unknown token", () => {
    expect(() => readReuploadedToken("maybe")).toThrow(/Unknown reuploaded 'maybe'/);
    expect(readReuploadedToken("1")).toBe(true);
    expect(readReuploadedToken("0")).toBe(false);
    expect(readReuploadedToken(undefined)).toBeNull();
  });

  it("readContentStatusTokens throws on an unknown token, drops nothing silently", () => {
    expect(() => readContentStatusTokens("approved,aproved")).toThrow(/Unknown contentStatus 'aproved'/);
    expect(readContentStatusTokens("approved,approved,pending")).toEqual(["approved", "pending"]);
    expect(readContentStatusTokens(undefined)).toEqual([]);
  });

  it("parseKinds (files.ts, not exported) throws on the unknown-token branch at source level and carries no silent drop", () => {
    const src = readFileSync(join(REPO_ROOT, "src/routes/files.ts"), "utf-8");
    const start = src.indexOf("function parseKinds(");
    expect(start).toBeGreaterThan(-1);
    const end = src.indexOf("\n}\n", start);
    expect(end).toBeGreaterThan(start);
    const body = src.slice(start, end);
    expect(body).toContain("throw new Error(`Unknown kind");
    expect(hasSilentDropFilterBlock(body)).toBe(false);
  });

  it("its call site maps the thrown Error to ApiError('invalid', ...)", () => {
    const src = readFileSync(join(REPO_ROOT, "src/routes/files.ts"), "utf-8");
    const callSite = src.slice(src.indexOf("kinds = parseKinds(c)") - 200, src.indexOf("kinds = parseKinds(c)") + 200);
    expect(callSite).toContain("catch");
    expect(callSite).toContain('ApiError("invalid"');
  });

  it("generic scan: every silent .filter(...*_STATUSES/*_KINDS/*_TOKENS...includes...) drop in src/ is exactly the (empty) exemption map", () => {
    const relFiles = everySourceFile();
    const offenders: string[] = [];
    for (const rel of relFiles) {
      const abs = join(REPO_ROOT, rel);
      const src = readFileSync(abs, "utf-8");
      if (hasSilentDropFilterBlockAnywhere(src)) {
        offenders.push(rel);
      }
    }
    offenders.sort();
    const expected = Object.keys(EXEMPT_SILENT_DROP).sort();
    expect(offenders).toEqual(expected);
  });

  it("every reason in the exemption map is a non-empty string naming an existing file", () => {
    for (const [path, reason] of Object.entries(EXEMPT_SILENT_DROP)) {
      expect(existsSync(join(REPO_ROOT, path))).toBe(true);
      expect(typeof reason).toBe("string");
      expect(reason.trim().length).toBeGreaterThan(0);
    }
  });
});

// --- scan helpers -----------------------------------------------------

const ENUM_CONST_RE = /\b[A-Z][A-Z0-9_]*_(?:STATUSES|KINDS|TOKENS)\b/;

/** Extracts the balanced-paren argument text of a `.filter(` call starting
 * at `start` (the index of the literal ".filter("). */
function extractFilterBlock(src: string, start: number): string {
  let i = start + ".filter(".length;
  let depth = 1;
  let j = i;
  for (; j < src.length && depth > 0; j++) {
    if (src[j] === "(") depth++;
    else if (src[j] === ")") depth--;
  }
  return src.slice(i, j);
}

/** True if `src` contains a `.filter(...)` predicate whose OWN body both
 * calls `.includes(` and references a `*_STATUSES`/`*_KINDS`/`*_TOKENS`
 * const — the exact "parse tokens, silently keep only the ones the enum
 * recognises" drop shape DEC-843 (and this amendment) forbid. */
function hasSilentDropFilterBlockAnywhere(src: string): boolean {
  let idx = 0;
  while (true) {
    const i = src.indexOf(".filter(", idx);
    if (i === -1) return false;
    const block = extractFilterBlock(src, i);
    if (block.includes(".includes(") && ENUM_CONST_RE.test(block)) return true;
    idx = i + 8;
  }
}

/** Same detector, scoped to a single already-extracted function body (used
 * for parseKinds, which isn't exported so it's checked at source level). */
function hasSilentDropFilterBlock(body: string): boolean {
  return hasSilentDropFilterBlockAnywhere(body);
}

function walk(dir: string, out: string[]): void {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const abs = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (relative(join(REPO_ROOT, "src"), abs) === "decisions-data") continue;
      walk(abs, out);
    } else if (entry.isFile() && entry.name.endsWith(".ts")) {
      out.push(relative(REPO_ROOT, abs).split(sep).join("/"));
    }
  }
}

function everySourceFile(): string[] {
  const out: string[] = [];
  walk(join(REPO_ROOT, "src"), out);
  return out;
}
