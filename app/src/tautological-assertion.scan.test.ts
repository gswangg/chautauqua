// DEC-967 (wave-57 amendment): "A CITATION IS NOT AN ASSERTION" -- a test
// whose expected and actual values are the same literal (e.g.
// `expect(true).toBe(true)`) proves nothing and can pass forever regardless
// of what the code under test does. This scan enumerates every *.test.ts /
// *.test.tsx file under app/src and test/ (readdirSync recursive, DEC-808
// idiom, no hand-listed manifest), strips comments first (comment prose may
// legitimately quote a tautological expression while explaining why one
// used to exist here), and fails on any `expect(X).toBe(X)` /
// `expect(X).toEqual(X)` where X is the identical literal on both sides.
//
// There is exactly one offender in the tree as filed by this task (fixed in
// the same commit as this scan, in turn-diet-honesty.render.test.tsx) --
// there is no allowlist mechanism here by design: if the scan ever surfaces
// another one, the fix is to give it a real assertion or delete the test,
// never to exempt it.
import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(HERE, '..', '..');
const APP_SRC = join(REPO_ROOT, 'app', 'src');
const TEST_DIR = join(REPO_ROOT, 'test');

/** Every *.test.ts / *.test.tsx file under `root`, found via recursive readdirSync. */
function allTestFiles(root: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(root, { withFileTypes: true, recursive: true })) {
    if (!entry.isFile()) continue;
    if (!entry.name.endsWith('.test.ts') && !entry.name.endsWith('.test.tsx')) continue;
    out.push(join(entry.parentPath, entry.name));
  }
  return out.sort();
}

/** Strip `//` line comments and `/* *\/` block comments before scanning. */
function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
}

// Matches `expect(<literal>).toBe(<same literal>)` or `.toEqual(<same
// literal>)` where <literal> is one of: `true`, `false`, a bare integer, or
// a single- or double-quoted string with no interpolation/escaping inside
// it. Whitespace between the literal and the closing paren is tolerated.
const LITERAL = String.raw`(?:true|false|-?\d+|'[^'\\]*'|"[^"\\]*")`;
const TAUTOLOGY_RE = new RegExp(`expect\\(\\s*(${LITERAL})\\s*\\)\\s*\\.\\s*to(?:Be|Equal)\\(\\s*(${LITERAL})\\s*\\)`, 'g');

function findTautologies(src: string): string[] {
  const code = stripComments(src);
  const offenders: string[] = [];
  let match: RegExpExecArray | null;
  TAUTOLOGY_RE.lastIndex = 0;
  while ((match = TAUTOLOGY_RE.exec(code)) !== null) {
    const [full, lhs, rhs] = match;
    if (lhs === rhs) offenders.push(full);
  }
  return offenders;
}

describe('no tautological assertion survives in any test file (DEC-967 wave-57 amendment)', () => {
  const appTestFiles = allTestFiles(APP_SRC);
  const rootTestFiles = allTestFiles(TEST_DIR);
  const allFiles = [...appTestFiles, ...rootTestFiles];

  it('found more than 100 test files (sanity check on the enumeration -- a vacuous population passes trivially)', () => {
    expect(allFiles.length).toBeGreaterThan(100);
  });

  it('POSITIVE control: the matcher catches a synthetic tautology', () => {
    // Built via concatenation so this file's own source text never contains
    // a literal `expect(true).toBe(true)` (etc.) -- otherwise the scan
    // below, which includes this very file in its population, would flag
    // itself.
    const trueTautology = ['expect(', 'true', ').toBe(', 'true', ')'].join('');
    const stringTautology = ['expect(', "'x'", ').toBe(', "'x'", ')'].join('');
    const equalTautology = ['expect(', '1', ').toEqual(', '1', ')'].join('');
    expect(findTautologies(`it('x', () => { ${trueTautology}; });`)).toEqual([trueTautology]);
    expect(findTautologies(`it('x', () => { ${stringTautology}; });`)).toEqual([stringTautology]);
    expect(findTautologies(`it('x', () => { ${equalTautology}; });`)).toEqual([equalTautology]);
  });

  it('NEGATIVE control: a real assertion is not matched', () => {
    expect(findTautologies("it('x', () => { expect(getValue()).toBe(true); });")).toEqual([]);
    expect(findTautologies("it('x', () => { expect(result.title).toBe('New Title'); });")).toEqual([]);
    expect(findTautologies("it('x', () => { expect(a).toEqual(b); });")).toEqual([]);
    // A tautology mentioned only in prose (a comment) must not trip the scan.
    const trueTautology = ['expect(', 'true', ').toBe(', 'true', ')'].join('');
    expect(findTautologies(`// old code used to say ${trueTautology} here\nit('x', () => { expect(1).toBe(2); });`)).toEqual([]);
  });

  for (const file of allFiles) {
    const rel = relative(REPO_ROOT, file);
    it(`${rel} has no tautological assertion`, () => {
      const src = readFileSync(file, 'utf-8');
      const offenders = findTautologies(src);
      if (offenders.length > 0) {
        throw new Error(`${rel} has a tautological assertion:\n${offenders.map((o) => `  ${o}`).join('\n')}`);
      }
      expect(offenders).toEqual([]);
    });
  }
});

// ---------------------------------------------------------------------------
// DEC-967 wave-99 amendment: "a frame receipt must assert about the TREE,
// not about the frame." The scan above catches `expect(X).toBe(X)` with an
// identical literal on both sides -- and its own header says there is
// exactly one such offender in the tree, no allowlist by design. It is
// blind to the shape this campaign actually produces: an `it()` that cites
// `docs/design/<file>.dc.html:<line>`, reads that exact line back out of
// the design file (often via a `verbatimLine()`-style helper that itself
// contains a real `expect(line).toBe(literal)` -- but that expect lives
// INSIDE the helper function, not in the it() block's own text, so the
// scan above never sees it either), and then asserts a regex against that
// SAME design-file string. Such a test passes forever regardless of what
// the app renders -- it is a citation with a receipt stapled to itself.
//
// A live example says so in its own title:
// `test/portal-remaining-phone-frames.test.ts:54` ("frame container (:1561)
// is the standard 390x844 phone card") -- the describe title carries the
// citation and the it() asserts only `dcLine(1561)`, i.e. the design file
// reading itself back.
//
// This anchor USED to be settings-phone-390.frames.test.ts:236/:260 ("...
// (gap: read-drilled view does not yet render it)"). Those two blocks did
// not stop being tautological -- they left THIS scan's population, because
// the DEC-976 wave-87 receipting pass moved their citations out of the
// `describe(...)` titles and down into it()-level COMMENTS, and a
// comment-only citation is deliberately excluded from the search below (see
// POPULATION/SUBJECT). Two contracts pull opposite ways on the same text:
// DEC-976 wants the citation in the it() beside its quote and expect(),
// DEC-967 reads titles. The tripwire fired exactly as designed when the
// file silently dropped out, so it is repointed at a citation that still
// lives in a title rather than deleted.
//
// POPULATION (DEC-808, never a hand-listed manifest): every *.test.ts /
// *.test.tsx under app/src/ and test/, found via the same `allTestFiles`
// recursive `readdirSync` used above.
//
// SUBJECT: every `it(...)`/`test(...)` call (at any nesting depth, found
// via balanced-brace scanning -- never a regex-only heuristic like the
// tautology matcher above, since a `describe`/`it` body can legitimately
// contain other braces) whose OWN title, or any ENCLOSING `describe(...)`
// title, carries a `docs/design/<Name>.dc.html:<digits>` citation. The
// citation lives in the title deliberately more often than in the body in
// this codebase's actual house style (see both examples above, and every
// `describe(...)` in settings-phone-390.frames.test.ts) -- a citation
// appearing only inside a `//`/`/* */` COMMENT is deliberately excluded
// from this search (comments strip out via the same tokenizer that also
// finds string/template/regex literals; see `buildMask`) because prose may
// legitimately quote a frame path without making a testable claim about it
// (task brief: "comments stripped first -- prose may legitimately quote a
// frame").
//
// RULE: at least one `expect(...)` inside that it() block's own body text
// (never reaching into a called helper's internal `expect`, since that
// text is not visible to a reader of the block) must take a subject that
// resolves to a REPO ARTEFACT -- a `readFileSync`/import of a path outside
// docs/design, a module value derived from one, or a render/DOM query
// (`screen.`, `getBy`/`queryBy`/`findBy`, `within(`, `render(`). A block
// where every `expect()` subject resolves ONLY to a design-file read (or to
// nothing resolvable at all) is an offender.
//
// This is a HOUSE-TECHNIQUE heuristic scan, not a real parser: identifier
// resolution walks `const IDENT = RHS` textually (local-to-the-block scope
// first, then true module-top-level scope, mirroring real JS shadowing
// closely enough for this codebase's actual patterns) and gives up after 6
// hops. It can both under- and over-count relative to a real type-checker;
// the ceiling below is a MEASURED snapshot, not an aspiration, and the
// falsifiability control just below guards against the citation regex
// silently stopping matching (which would make the ceiling vacuous).
import { basename } from 'node:path';

const CITATION_RE = /docs\/design\/([A-Za-z][A-Za-z0-9 ]*\.dc\.html):\s*(\d+)/;

interface FrameBlock {
  kind: 'describe' | 'it';
  title: string;
  /** Index (in the file's raw text) where the `describe`/`it`/`test`
   * keyword itself starts -- used both for line numbers and for nesting
   * containment tests. */
  start: number;
  bodyStart: number;
  bodyEnd: number;
}

/**
 * Same-length "mask" of `code`: every character inside a string/template
 * literal, a `//` or `/* *\/` comment, or a regex literal is replaced with
 * `#` -- a character that can never look like a bracket, quote, or
 * identifier fragment -- so brace/paren depth counting elsewhere never
 * desyncs on a literal CSS selector, a comment containing a stray brace, or
 * a regex containing `{}` (this codebase has exactly that: see
 * `findTautologies`'s own `TAUTOLOGY_RE` above, and `ruleIn`'s
 * `/([^{}]+)\{([^{}]*)\}/g` in the phone-frame test files). Real code
 * characters are copied through unchanged.
 *
 * This is a SINGLE-PASS, context-aware tokenizer -- deliberately not "strip
 * comments with one global regex, then re-scan for strings/regex"
 * (`stripComments` above). That two-pass shape corrupts THIS VERY FILE when
 * applied to itself: `TAUTOLOGY_RE`'s own source text contains a literal
 * "//" (the escaped-slash immediately before its closing delimiter), which
 * a blind `/\/\/.*$/gm` reads as a comment start and truncates the rest of
 * that line -- a citation-is-not-an-assertion scan that cannot assert about
 * its own file is exactly the shape this amendment exists to catch, so this
 * derived check does not reuse `stripComments`.
 *
 * JSX (this population includes `.tsx`) gets two explicit guards: a bare
 * `/` is never a regex start immediately before `>` (`<Foo />`) or
 * immediately after `<` (`</Foo>`) -- both would otherwise false-positive
 * against the "previous significant token" heuristic below, since `<`
 * itself is a legitimate regex-preceding token in non-JSX code.
 */
function buildFrameMask(code: string): string {
  const REGEX_PRECEDING = new Set([
    '(', ',', '=', ':', ';', '!', '&', '|', '?', '+', '-', '*', '%', '^', '~', '<', '>', '[', '{', '}',
  ]);
  const KEYWORD_RE = /(return|typeof|instanceof|in|of|new|void|delete|yield|await|case|do|else)$/;
  const out: string[] = new Array(code.length);
  let i = 0;
  while (i < code.length) {
    const ch = code[i]!;
    if (ch === '"' || ch === "'" || ch === '`') {
      const quote = ch;
      const start = i;
      i++;
      while (i < code.length) {
        if (code[i] === '\\') { i += 2; continue; }
        if (code[i] === quote) { i++; break; }
        i++;
      }
      for (let k = start; k < i; k++) out[k] = '#';
      continue;
    }
    if (ch === '/' && code[i + 1] === '/') {
      const start = i;
      while (i < code.length && code[i] !== '\n') i++;
      for (let k = start; k < i; k++) out[k] = '#';
      continue;
    }
    if (ch === '/' && code[i + 1] === '*') {
      const start = i;
      i += 2;
      while (i < code.length && !(code[i] === '*' && code[i + 1] === '/')) i++;
      i = Math.min(i + 2, code.length);
      for (let k = start; k < i; k++) out[k] = '#';
      continue;
    }
    if (ch === '/' && code[i + 1] === '>') { out[i] = ch; i++; continue; }
    if (ch === '/') {
      const trimmed = code.slice(0, i).trimEnd();
      const prevCh: string = trimmed.length ? trimmed[trimmed.length - 1]! : '';
      if (prevCh === '<') { out[i] = ch; i++; continue; }
      const looksLikeRegex = prevCh === '' || REGEX_PRECEDING.has(prevCh) || KEYWORD_RE.test(trimmed);
      if (looksLikeRegex) {
        const start = i;
        i++;
        let inClass = false;
        while (i < code.length) {
          const c = code[i];
          if (c === '\\') { i += 2; continue; }
          if (c === '[') { inClass = true; i++; continue; }
          if (c === ']') { inClass = false; i++; continue; }
          if (c === '/' && !inClass) { i++; break; }
          if (c === '\n') break; // unterminated -- bail, not a regex after all
          i++;
        }
        while (i < code.length && /[a-z]/i.test(code[i]!)) i++; // flags
        for (let k = start; k < i; k++) out[k] = '#';
        continue;
      }
    }
    out[i] = ch;
    i++;
  }
  return out.join('');
}

/** Balanced `{ ... }` starting at a `{` in `mask`; returns the index right
 * after the matching `}`. Indices refer to `mask` (used for depth-counting
 * only); callers slice the ORIGINAL code at the same indices. */
function matchBrace(mask: string, openIdx: number): number {
  let depth = 1;
  let i = openIdx + 1;
  while (i < mask.length && depth > 0) {
    if (mask[i] === '{') depth++;
    else if (mask[i] === '}') depth--;
    i++;
  }
  if (depth !== 0) throw new Error(`unbalanced brace starting at index ${openIdx}`);
  return i;
}

/** Every `describe(...)`/`it(...)`/`test(...)` call in `code`, at any
 * nesting depth (found via `mask`, so a call named only inside a comment or
 * string is never matched). */
function extractFrameBlocks(code: string, mask: string): FrameBlock[] {
  const out: FrameBlock[] = [];
  const re = /\b(describe|it|test)\(\s*/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(mask)) !== null) {
    const kind = m[1] === 'describe' ? 'describe' : 'it';
    const quoteIdx = m.index + m[0].length;
    const quote = code[quoteIdx];
    if (quote !== '"' && quote !== "'" && quote !== '`') continue; // e.g. `it.each(` -- not a plain title call
    let i = quoteIdx + 1;
    let title = '';
    while (i < code.length) {
      const ch = code[i];
      if (ch === '\\') { title += ch + code[i + 1]; i += 2; continue; }
      if (ch === quote) { i++; break; }
      title += ch;
      i++;
    }
    const braceIdx = mask.indexOf('{', i);
    if (braceIdx === -1) continue;
    const bodyStart = braceIdx + 1;
    const bodyEndAfterBrace = matchBrace(mask, braceIdx);
    out.push({ kind, title, start: m.index, bodyStart, bodyEnd: bodyEndAfterBrace - 1 });
    // Deliberately not skipping past the body: an it() nested inside a
    // describe()'s body must still be found by the same scan.
  }
  return out;
}

/**
 * Every `const IDENT = RHS;` found in `mask` within `[fromIdx, toIdx)`.
 * When `requireDepthZero` is set, only accepts a `const` whose own brace
 * depth (relative to `fromIdx`) is 0 -- used to build the TRUE
 * module-top-level scope, so a same-named local inside some unrelated
 * helper function's body (e.g. `verbatimLine`'s own internal
 * `const line = lines[lineNo - 1]`) never leaks in as a false global
 * binding. RHS text is sliced from the ORIGINAL `code`, not `mask`.
 */
function extractFrameConsts(
  code: string,
  mask: string,
  fromIdx: number,
  toIdx: number,
  requireDepthZero: boolean
): Map<string, string> {
  const map = new Map<string, string>();
  const re = /\bconst\s+([A-Za-z_$][A-Za-z0-9_$]*)\s*=\s*/g;
  re.lastIndex = fromIdx;
  let m: RegExpExecArray | null;
  while ((m = re.exec(mask)) !== null) {
    if (m.index >= toIdx) break;
    if (requireDepthZero) {
      let braceDepth = 0;
      for (let k = fromIdx; k < m.index; k++) {
        if (mask[k] === '{') braceDepth++;
        else if (mask[k] === '}') braceDepth--;
      }
      if (braceDepth !== 0) continue;
    }
    const ident = m[1]!;
    const start = m.index + m[0].length;
    let i = start;
    let depth = 0;
    while (i < code.length) {
      const ch = mask[i];
      if (ch === '(' || ch === '[' || ch === '{') depth++;
      else if (ch === ')' || ch === ']' || ch === '}') depth--;
      if (ch === ';' && depth <= 0) break;
      if (ch === ',' && depth <= 0) break; // multi-declarator statement -- stop at the first
      i++;
    }
    if (!map.has(ident)) map.set(ident, code.slice(start, i));
  }
  return map;
}

type FrameSubjectOrigin = 'design' | 'repo' | 'unknown';

/** Classifies an expression's textual origin: does it trace to a
 * docs/design read (`design`), a repo artefact / render query (`repo`), or
 * neither resolvably (`unknown`, treated as NOT an offender-clearing
 * subject but also not proof of a design-only read -- see call site). */
function classifyFrameExpr(
  expr: string,
  consts: Map<string, string>,
  depth: number,
  seen: Set<string>
): FrameSubjectOrigin {
  if (depth > 6) return 'unknown';
  if (/\b(screen\.|getBy|queryBy|findBy|within\(|render\()/.test(expr)) return 'repo';
  const readFileCalls = [...expr.matchAll(/readFileSync\(([^)]*)\)/g)];
  for (const call of readFileCalls) {
    const arg = call[1] ?? '';
    return /DESIGN_FILE|DESIGN_ROOT|docs.*design|design.*\.dc\.html/i.test(arg) ? 'design' : 'repo';
  }
  const idents = new Set<string>();
  for (const im of expr.matchAll(/\b([A-Za-z_$][A-Za-z0-9_$]*)\b/g)) {
    const id = im[1]!;
    if (['expect', 'const', 'let', 'var', 'true', 'false', 'null', 'undefined', 'new', 'typeof', 'function', 'return'].includes(id)) continue;
    idents.add(id);
  }
  let sawDesign = false;
  let sawRepo = false;
  for (const id of idents) {
    if (id === 'DESIGN_FILE' || id === 'DESIGN_ROOT') { sawDesign = true; continue; }
    if (seen.has(id)) continue;
    const rhs = consts.get(id);
    if (rhs === undefined) continue;
    seen.add(id);
    const cls = classifyFrameExpr(rhs, consts, depth + 1, seen);
    if (cls === 'design') sawDesign = true;
    if (cls === 'repo') sawRepo = true;
  }
  if (sawRepo) return 'repo';
  if (sawDesign) return 'design';
  return 'unknown';
}

/** Every `expect(...)` call's argument text within `body`, found via
 * `bodyMask` (so a paren inside a string/regex argument never truncates
 * the match early). */
function extractFrameExpectArgs(body: string, bodyMask: string): string[] {
  const out: string[] = [];
  const re = /\bexpect\(/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(bodyMask)) !== null) {
    const start = m.index + m[0].length;
    let i = start;
    let depth = 1;
    while (i < body.length && depth > 0) {
      const ch = bodyMask[i];
      if (ch === '(') depth++;
      else if (ch === ')') { depth--; if (depth === 0) { i++; break; } }
      i++;
    }
    out.push(body.slice(start, i - 1));
  }
  return out;
}

function frameLineAt(raw: string, idx: number): number {
  let n = 1;
  for (let i = 0; i < idx && i < raw.length; i++) if (raw.charCodeAt(i) === 10) n++;
  return n;
}

interface FrameOffender {
  file: string;
  line: number;
  title: string;
}

interface FrameScanResult {
  citationBlockCount: number;
  offenders: FrameOffender[];
}

/** Runs the whole scan over `files` (repo-relative paths for reporting,
 * absolute paths for reading). Exported at module scope (not inlined in an
 * `it`) so the POSITIVE/NEGATIVE controls below can drive it with a
 * synthetic single-file population. */
function scanFrameReceiptAssertions(files: { abs: string; rel: string }[]): FrameScanResult {
  let citationBlockCount = 0;
  const offenders: FrameOffender[] = [];
  for (const { abs, rel } of files) {
    const raw = readFileSync(abs, 'utf-8');
    const mask = buildFrameMask(raw);
    const globalConsts = extractFrameConsts(raw, mask, 0, raw.length, true);
    const blocks = extractFrameBlocks(raw, mask);
    const describes = blocks.filter((b) => b.kind === 'describe');
    const its = blocks.filter((b) => b.kind === 'it');
    for (const block of its) {
      const enclosing = describes.filter((d) => d.bodyStart <= block.start && block.bodyEnd <= d.bodyEnd);
      const citationText = [block.title, ...enclosing.map((d) => d.title)].join(' ');
      if (!CITATION_RE.test(citationText)) continue;
      citationBlockCount++;
      const body = raw.slice(block.bodyStart, block.bodyEnd);
      const bodyMask = mask.slice(block.bodyStart, block.bodyEnd);
      const args = extractFrameExpectArgs(body, bodyMask);
      const localConsts = extractFrameConsts(raw, mask, block.bodyStart, block.bodyEnd, false);
      const merged = new Map([...globalConsts, ...localConsts]);
      const classes = args.map((a) => classifyFrameExpr(a, merged, 0, new Set()));
      const anyRepoBacked = classes.includes('repo');
      const everyDesignOnly = args.length === 0 || classes.every((c) => c === 'design');
      if (!anyRepoBacked && everyDesignOnly) {
        offenders.push({ file: rel, line: frameLineAt(raw, block.start), title: block.title });
      }
    }
  }
  return { citationBlockCount, offenders };
}

/** Ratchet ceiling (DEC-967 wave-99 amendment): the count of it()/test()
 * blocks in the tree that cite a design-file line and whose every
 * expect() subject resolves ONLY to a design-file read -- measured on this
 * branch by the same technique this test runs. TWO-SIDED so it can only
 * TIGHTEN (`toBeLessThanOrEqual`, never raised to paper over a regression),
 * NOT an allowlist. Lowered 5 -> 3 on the merge of v12m-w2-l: the two
 * settings-phone-390.frames.test.ts offenders this ceiling used to carry
 * left the population when DEC-976 wave-87 receipting moved their citations
 * from the describe titles into it()-level comments (see header). The three
 * that remain are the portal frame containers. Measured, not guessed --
 * lowering only, never raised back. */
const FRAME_RECEIPT_OFFENDER_CEILING = 3;

describe('a frame receipt asserts about the tree, not about the frame (DEC-967 wave-99 amendment)', () => {
  const population = [
    ...allTestFiles(APP_SRC).map((abs) => ({ abs, rel: relative(REPO_ROOT, abs) })),
    ...allTestFiles(TEST_DIR).map((abs) => ({ abs, rel: relative(REPO_ROOT, abs) })),
  ];

  it('POSITIVE control: a design-file-only citation block is flagged', () => {
    const dir = mkdtempSync(join(tmpdir(), 'frame-receipt-scan-pos-'));
    const file = join(dir, 'synthetic.test.ts');
    try {
      writeFileSync(
        file,
        [
          "import { describe, expect, it } from 'vitest';",
          "import { readFileSync } from 'node:fs';",
          "const DESIGN_FILE = '/tmp/does-not-matter.dc.html';",
          "describe('v12 phone frame (390) -- docs/design/Fake Frame.dc.html:12', () => {",
          "  it('reads a design line only', () => {",
          "    const line = readFileSync(DESIGN_FILE, 'utf-8');",
          "    expect(line).toMatch(/whatever/);",
          '  });',
          '});',
        ].join('\n')
      );
      const result = scanFrameReceiptAssertions([{ abs: file, rel: 'synthetic.test.ts' }]);
      expect(result.citationBlockCount).toBe(1);
      expect(result.offenders).toEqual([{ file: 'synthetic.test.ts', line: 5, title: 'reads a design line only' }]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('NEGATIVE control: a citation block that also asserts against a repo artefact is not flagged', () => {
    const dir = mkdtempSync(join(tmpdir(), 'frame-receipt-scan-neg-'));
    const file = join(dir, 'synthetic.test.ts');
    try {
      writeFileSync(
        file,
        [
          "import { describe, expect, it } from 'vitest';",
          "import { readFileSync } from 'node:fs';",
          "const DESIGN_FILE = '/tmp/does-not-matter.dc.html';",
          "const APP_CSS = readFileSync('/tmp/app.css', 'utf-8');",
          "describe('v12 phone frame (390) -- docs/design/Fake Frame.dc.html:12', () => {",
          "  it('reads a design line and asserts the app css', () => {",
          "    const line = readFileSync(DESIGN_FILE, 'utf-8');",
          "    expect(line).toMatch(/whatever/);",
          '    expect(APP_CSS).toMatch(/min-height:44px/);',
          '  });',
          '});',
        ].join('\n')
      );
      const result = scanFrameReceiptAssertions([{ abs: file, rel: 'synthetic.test.ts' }]);
      expect(result.citationBlockCount).toBe(1);
      expect(result.offenders).toEqual([]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('the citation-carrying block population is non-empty and above a floor (guards against the citation regex silently matching nothing)', () => {
    const { citationBlockCount } = scanFrameReceiptAssertions(population);
    expect(citationBlockCount).toBeGreaterThan(100);
  });

  it('known-good: portal-remaining-phone-frames.test.ts:54 is a known offender inside the seeded ceiling (guards against the scan going silently empty)', () => {
    const { offenders } = scanFrameReceiptAssertions(population);
    const known = offenders.some(
      (o) => o.file === 'test/portal-remaining-phone-frames.test.ts' && o.line === 54
    );
    expect(known).toBe(true);
  });

  it(`no more than FRAME_RECEIPT_OFFENDER_CEILING (${FRAME_RECEIPT_OFFENDER_CEILING}) frame-receipt blocks assert only about the design file, never the tree (ceiling may only be lowered)`, () => {
    const { offenders } = scanFrameReceiptAssertions(population);
    if (offenders.length > FRAME_RECEIPT_OFFENDER_CEILING) {
      throw new Error(
        `${offenders.length} it()/test() blocks cite a design-file line and assert only about the design ` +
          `file, above the ratchet ceiling of ${FRAME_RECEIPT_OFFENDER_CEILING} ` +
          `(FRAME_RECEIPT_OFFENDER_CEILING may only be LOWERED, never raised to paper over a regression):\n` +
          offenders.map((o) => `  ${o.file}:${o.line} — ${o.title}`).join('\n')
      );
    }
    expect(offenders.length).toBeLessThanOrEqual(FRAME_RECEIPT_OFFENDER_CEILING);
  });

  it('every offender basename is a real file under the population roots (sanity check on the reporting path)', () => {
    const { offenders } = scanFrameReceiptAssertions(population);
    for (const o of offenders) {
      expect(basename(o.file).endsWith('.test.ts') || basename(o.file).endsWith('.test.tsx')).toBe(true);
    }
  });
});
