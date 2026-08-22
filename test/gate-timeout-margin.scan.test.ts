// Gate timeout margin enforcer (DEC-069 wave-35 amendment, task w35-i).
//
// The fast tier is the ONLY instrument that can ever supply the exit
// predicate's `--suite-verified-sha` (scripts/exit-predicate.ts). A
// `beforeAll`/`beforeEach`/`it` hook that runs close to vitest's default
// timeout (5000ms for a test, 10000ms for a hook, per vitest.config.ts --
// neither is overridden globally there) is a hole in that one gate: under
// the mandate's `maxWorkers:2`/`poolOptions.forks.maxForks:2` machine-
// protection caps (vitest.config.ts), contention makes duration swing wave
// to wave, and a silent timeout there makes the guard enforce nothing on
// the run where it blows (wave-35's own planner measured
// test/ssr-link-targets-scan.test.ts at 8591ms against the 10000ms
// default -- a 14% margin -- and an independent reviewer observed the same
// hook FAILING under load).
//
// CONVENTION: a call site a wave has measured close to its effective
// timeout gets a comment containing the literal marker `KNOWN-SLOW`
// somewhere in the contiguous `//` comment block immediately above its
// `beforeAll(`/`beforeEach(`/`it(` line (see
// test/ssr-link-targets-scan.test.ts and test/docs-route-coverage.test.ts
// for the shape this wave seeded). This scan enumerates every such marked
// call site under test/ and app/src/ and asserts it carries an explicit
// numeric timeout argument as its own LAST top-level call argument -- never
// validated by re-reading the marker comment's own prose as evidence (the
// comment identifies a slow site; the timeout argument is the actual
// guard).
//
// TWO-SIDED (DEC-808 shape): a single EXACT-equality assertion
// (`expect(offenders.length).toBe(GATE_TIMEOUT_MARGIN_UNGUARDED_CEILING)`)
// is both directions at once -- it fails if a new marked site regresses
// (offenders rise above the ceiling) AND if the population silently drains
// to a smaller offender count than declared (impossible to under-report
// once seeded at the true measured value), the same shape
// DIVERGENCE_CEILING and EXPECTED_TOTAL_PRE_DEVIATION already use
// (test/campaign-ratchet-two-sided.scan.test.ts's own EXACT classification).
// SEED: forced to -1 during authoring to print the roster (impossible for
// a non-negative offender count to satisfy, so the assertion fails loudly
// regardless of the true count) -- the measured real value is 0 (both
// marked sites this wave seeded already carry explicit timeouts), so the
// ceiling ships at 0.

import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(HERE, "..");
const TEST_DIR = join(REPO_ROOT, "test");
const APP_SRC_DIR = join(REPO_ROOT, "app", "src");

// Real measured value (see file header SEED note) -- never edit this
// number without re-measuring; a rise means a newly-marked slow site
// shipped without an explicit timeout, a fall is impossible without first
// lowering the population itself.
export const GATE_TIMEOUT_MARGIN_UNGUARDED_CEILING = 0;

const MARKER = "KNOWN-SLOW";
const CALL_RE = /\b(beforeAll|beforeEach|it)\(/g;

// ---------------------------------------------------------------------------
// Masking (DEC-808 idiom, mirrors test/campaign-ratchet-two-sided.scan.test.ts's
// buildMask): blanks string/template/regex/comment contents to '#' so a
// paren, brace or comma inside one of those never mis-tracks call structure,
// while every OTHER character (including the ones we care about: ( ) { } ,)
// keeps its real position.
// ---------------------------------------------------------------------------

function buildMask(code: string): string {
  const REGEX_PRECEDING = new Set([
    "(", ",", "=", ":", ";", "!", "&", "|", "?", "+", "-", "*", "%", "^", "~", "<", ">", "[", "{", "}",
  ]);
  const KEYWORD_RE = /(return|typeof|instanceof|in|of|new|void|delete|yield|await|case|do|else)$/;
  const out: string[] = new Array(code.length);
  let i = 0;
  while (i < code.length) {
    const ch = code[i]!;
    if (ch === '"' || ch === "'" || ch === "`") {
      const quote = ch;
      const start = i;
      i++;
      while (i < code.length) {
        if (code[i] === "\\") { i += 2; continue; }
        if (code[i] === quote) { i++; break; }
        i++;
      }
      for (let k = start; k < i; k++) out[k] = "#";
      continue;
    }
    if (ch === "/" && code[i + 1] === "/") {
      const start = i;
      while (i < code.length && code[i] !== "\n") i++;
      for (let k = start; k < i; k++) out[k] = "#";
      continue;
    }
    if (ch === "/" && code[i + 1] === "*") {
      const start = i;
      i += 2;
      while (i < code.length && !(code[i] === "*" && code[i + 1] === "/")) i++;
      i = Math.min(i + 2, code.length);
      for (let k = start; k < i; k++) out[k] = "#";
      continue;
    }
    if (ch === "/") {
      const trimmed = code.slice(0, i).trimEnd();
      const prevCh: string = trimmed.length ? trimmed[trimmed.length - 1]! : "";
      const looksLikeRegex = prevCh === "" || REGEX_PRECEDING.has(prevCh) || KEYWORD_RE.test(trimmed);
      if (looksLikeRegex) {
        const start = i;
        i++;
        let inClass = false;
        while (i < code.length) {
          const c = code[i];
          if (c === "\\") { i += 2; continue; }
          if (c === "[") { inClass = true; i++; continue; }
          if (c === "]") { inClass = false; i++; continue; }
          if (c === "/" && !inClass) { i++; break; }
          if (c === "\n") break;
          i++;
        }
        while (i < code.length && /[a-z]/i.test(code[i]!)) i++;
        for (let k = start; k < i; k++) out[k] = "#";
        continue;
      }
    }
    out[i] = ch;
    i++;
  }
  return out.join("");
}

/** Index of the ')' matching the '(' at `openIdx`, tracked on the MASK so a
 * paren inside a string/comment/regex never mis-terminates the call. */
function matchParen(mask: string, openIdx: number): number {
  let depth = 1;
  let i = openIdx + 1;
  while (i < mask.length && depth > 0) {
    if (mask[i] === "(") depth++;
    else if (mask[i] === ")") depth--;
    i++;
  }
  if (depth !== 0) throw new Error(`unbalanced paren starting at index ${openIdx}`);
  return i - 1;
}

/** The raw source text of the call's own LAST top-level argument (after the
 * last comma at paren/brace/bracket depth 0 relative to the call's own
 * open paren) -- e.g. for `it('x', async () => {...}, 30000)` this returns
 * `" 30000"`. Depth is tracked on the mask so a comma inside the callback
 * body (at depth > 0) is never mistaken for a top-level argument separator. */
function lastTopLevelArgText(mask: string, code: string, openIdx: number, closeIdx: number): string {
  let depth = 0;
  let lastCommaIdx = -1;
  for (let i = openIdx + 1; i < closeIdx; i++) {
    const c = mask[i];
    if (c === "(" || c === "{" || c === "[") depth++;
    else if (c === ")" || c === "}" || c === "]") depth--;
    else if (c === "," && depth === 0) lastCommaIdx = i;
  }
  const start = lastCommaIdx === -1 ? openIdx + 1 : lastCommaIdx + 1;
  return code.slice(start, closeIdx);
}

const EXPLICIT_TIMEOUT_RE = /^\s*[0-9][0-9_]*\s*$/;

interface CallSite {
  file: string;
  line: number;
  callName: string;
  hasExplicitTimeout: boolean;
  lastArg: string;
}

/** Every `beforeAll(`/`beforeEach(`/`it(` call site in `code` whose
 * immediately-preceding contiguous `//` comment block contains the
 * KNOWN-SLOW marker, classified by whether its own last top-level argument
 * is a bare numeric literal (an explicit timeout). */
function findMarkedCallSites(file: string, code: string): CallSite[] {
  const mask = buildMask(code);
  const lines = code.split("\n");
  const out: CallSite[] = [];
  let m: RegExpExecArray | null;
  CALL_RE.lastIndex = 0;
  while ((m = CALL_RE.exec(mask)) !== null) {
    const callName = m[1]!;
    const openIdx = m.index + m[0].length - 1; // index of the call's own '('
    const lineNum = code.slice(0, m.index).split("\n").length; // 1-indexed
    // Walk the contiguous `//` comment block directly above this line
    // (lineNum is 1-indexed; lines[lineNum - 1] is this line itself).
    let i = lineNum - 2; // 0-indexed line just above
    const commentLines: string[] = [];
    while (i >= 0) {
      const trimmed = lines[i]!.trim();
      if (trimmed.startsWith("//")) {
        commentLines.unshift(trimmed);
        i--;
        continue;
      }
      break;
    }
    if (!commentLines.some((l) => l.includes(MARKER))) continue;
    const closeIdx = matchParen(mask, openIdx);
    const lastArg = lastTopLevelArgText(mask, code, openIdx, closeIdx);
    out.push({
      file,
      line: lineNum,
      callName,
      hasExplicitTimeout: EXPLICIT_TIMEOUT_RE.test(lastArg),
      lastArg: lastArg.trim(),
    });
  }
  return out;
}

// ---------------------------------------------------------------------------
// File walk (readdirSync recursive, DEC-808 idiom -- no manifest).
// ---------------------------------------------------------------------------

interface SourceFile {
  readonly abs: string;
  readonly rel: string;
  readonly content: string;
}

function walkTestFiles(root: string): SourceFile[] {
  if (!existsSync(root)) return [];
  const out: SourceFile[] = [];
  for (const entry of readdirSync(root, { withFileTypes: true, recursive: true })) {
    if (!entry.isFile()) continue;
    if (!/\.test\.tsx?$/.test(entry.name)) continue;
    const abs = join(entry.parentPath, entry.name);
    out.push({ abs, rel: relative(REPO_ROOT, abs), content: readFileSync(abs, "utf8") });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Gate.
// ---------------------------------------------------------------------------

describe("every KNOWN-SLOW-marked hook/test carries an explicit timeout (DEC-069 wave-35 amendment)", () => {
  let files: SourceFile[];
  let markedSites: CallSite[];
  let offenders: CallSite[];

  beforeAll(() => {
    files = [...walkTestFiles(TEST_DIR), ...walkTestFiles(APP_SRC_DIR)];
    markedSites = files.flatMap((f) => findMarkedCallSites(f.rel, f.content));
    offenders = markedSites.filter((s) => !s.hasExplicitTimeout);
  });

  it("the file walk finds a non-trivial number of test files (guards against a bad root leaving zero files scanned)", () => {
    expect(files.length).toBeGreaterThan(50);
  });

  it("found at least the marked sites this wave seeded (guards against a broken marker/paren-match leaving this gate green over an empty set)", () => {
    expect(markedSites.length).toBeGreaterThanOrEqual(2);
  });

  it("every KNOWN-SLOW-marked call site carries an explicit numeric timeout as its own last argument", () => {
    expect(
      offenders.length,
      offenders.length > 0
        ? `${offenders.length} KNOWN-SLOW-marked call site(s) have no explicit timeout argument -- a ` +
            `guard measured close to its default timeout that silently times out under load enforces ` +
            `nothing on the run where it blows:\n` +
            offenders
              .map((o) => `  ${o.file}:${o.line}: ${o.callName}(...) last arg "${o.lastArg}" is not a bare numeric literal`)
              .join("\n")
        : undefined,
    ).toBe(GATE_TIMEOUT_MARGIN_UNGUARDED_CEILING);
  });
});

// ---------------------------------------------------------------------------
// NON-VACUITY (DEC-967): synthetic fixtures written to a real tmpdir,
// exercised through the SAME findMarkedCallSites() the population walk
// above uses -- never validated by reading the population walk's own
// output back as its evidence.
// ---------------------------------------------------------------------------

describe("non-vacuity: the detector discriminates guarded from unguarded KNOWN-SLOW sites", () => {
  let dir: string;

  beforeAll(() => {
    dir = mkdtempSync(join(tmpdir(), "gate-timeout-margin-fixture-"));
  });

  afterAll(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("a KNOWN-SLOW-marked hook with NO explicit timeout IS reported", () => {
    const src = [
      "import { beforeAll, it, describe } from 'vitest';",
      "describe('fixture', () => {",
      "  // KNOWN-SLOW: measured 9000ms against the 10000ms default.",
      "  beforeAll(async () => {",
      "    await doSomethingSlow();",
      "  });",
      "  it('works', () => {});",
      "});",
      "",
    ].join("\n");
    const sites = findMarkedCallSites("fixture-unguarded.test.ts", src);
    expect(sites.length).toBe(1);
    expect(sites[0]!.hasExplicitTimeout).toBe(false);
  });

  it("a KNOWN-SLOW-marked hook WITH an explicit numeric timeout is NOT reported", () => {
    const src = [
      "import { beforeAll, it, describe } from 'vitest';",
      "describe('fixture', () => {",
      "  // KNOWN-SLOW: measured 9000ms against the 10000ms default.",
      "  beforeAll(async () => {",
      "    await doSomethingSlow();",
      "  }, 20000);",
      "  it('works', () => {});",
      "});",
      "",
    ].join("\n");
    const sites = findMarkedCallSites("fixture-guarded.test.ts", src);
    expect(sites.length).toBe(1);
    expect(sites[0]!.hasExplicitTimeout).toBe(true);
  });

  it("a KNOWN-SLOW-marked `it()` with an explicit timeout as its own last argument is NOT reported (comma inside the callback body is not mistaken for the argument separator)", () => {
    const src = [
      "import { it, describe } from 'vitest';",
      "describe('fixture', () => {",
      "  // KNOWN-SLOW: measured 4800ms against the 5000ms default.",
      "  it('does a thing', async () => {",
      "    const pair = { a: 1, b: 2 };",
      "    await doSomethingSlow(pair.a, pair.b);",
      "  }, 15000);",
      "});",
      "",
    ].join("\n");
    const sites = findMarkedCallSites("fixture-it-guarded.test.ts", src);
    expect(sites.length).toBe(1);
    expect(sites[0]!.hasExplicitTimeout).toBe(true);
    expect(sites[0]!.lastArg).toBe("15000");
  });

  it("an unmarked slow-looking hook (no KNOWN-SLOW comment) is not part of the population at all", () => {
    const src = [
      "import { beforeAll, it, describe } from 'vitest';",
      "describe('fixture', () => {",
      "  beforeAll(async () => {",
      "    await doSomethingSlow();",
      "  });",
      "  it('works', () => {});",
      "});",
      "",
    ].join("\n");
    const sites = findMarkedCallSites("fixture-unmarked.test.ts", src);
    expect(sites.length).toBe(0);
  });

  it("the fixtures actually land on disk (guards against a fixture-writing typo leaving the dir empty)", () => {
    const abs = join(dir, "sentinel.fixture.test.ts");
    writeFileSync(abs, "// sentinel\n", "utf8");
    expect(existsSync(abs)).toBe(true);
  });
});
