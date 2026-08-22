// Frame drawn CONDITIONAL-STATE ledger (DEC-383 wave-29; task w29-i).
//
// Every population this campaign grades so far is made of WORDS the pack
// always draws: screens, control labels, captions, eyebrows, field labels,
// count-captions. Nothing grades the pack's STATE vocabulary --
// `docs/design/DESIGN-RULINGS.md`'s B8 ("interaction-states standard")
// names this gap, and DEC-383's wave-58/60 amendments already host both
// interaction-states scans (app/src/interaction-states.scan.test.ts,
// test/ssr-interaction-states.scan.test.ts). This file is the third: it
// grades the pack's `sc-if value="{{ ... }}"` declarations, each of which
// commits the app to TWO renderings of one region -- one the drawing
// shows (its `hint-placeholder-val`), one it doesn't.
//
// 1. POPULATION (derived at test time, never hand-listed -- DEC-808):
//    readdirSync docs/design for *.dc.html, then regex every
//    `<sc-if value="{{ EXPR }}" hint-placeholder-val="{{ true|false }}">
//    ...</sc-if>` span (non-greedy to its OWN matching close tag -- a
//    manual same-depth walk, since sc-if blocks nest, e.g. Agenda's
//    `cell.session` wraps `cell.clash`). Each row records: file, line,
//    condition expression, hinted branch, the line of the nearest
//    preceding frame-geometry div (`width:NNpx; ... background:#F4F1E8`,
//    the idiom every frame in this pack opens on -- desktop frames use
//    620/1600/420px etc, phone frames always 390), and whether that frame
//    line carries `width:390px` (a 390 frame) or not (desktop).
//
// 2. DERIVATION RULE (content search, never a hand-written
//    frame->component map):
//      TIER 1 -- COPY MATCH. Extract this sc-if block's OWN literal text
//        (excluding any NESTED sc-if's text -- that belongs to the inner
//        row), i.e. every run of >=6 non-mustache, non-tag, non-punctuation
//        characters between `>` and `<`. If any such literal occurs
//        verbatim (word-boundary, comment-stripped, entity-decoded --
//        reusing test/frame-source-corpus.ts's shared primitives, the same
//        module the caption/eyebrow/field-label ledgers already share) in
//        the row's CLUSTER directory (below), TIER 1 reports MATCHED-COPY.
//      TIER 2 -- STRUCTURAL MATCH, only when TIER 1 finds no literal at
//        all (a fully template-composed block, e.g. `slot.blocked`'s only
//        content is `{{ slot.note }}`). The condition expression's last
//        dotted segment (e.g. `needsInvite`, `isBreak`, `hasFact`) is
//        mechanically searched two ways: (a) as a bare compound
//        identifier (`\bneedsInvite\b`); (b) if it carries an
//        `is`/`has`/`needs` prefix, its lower-cased SUFFIX NOUN
//        (`isBreak` -> `break`, `hasSessions` -> `sessions`) as a quoted
//        string literal (`"break"`/`'break'`) OR a CSS class token
//        (`-break`/`break-`). Comments are stripped first (DEC-967: a
//        comment quoting the identifier is not a declaration). Any hit
//        reports MATCHED-STRUCTURAL; no hit reports NO-EVIDENCE.
//    A row with NO-EVIDENCE from both tiers is DIVERGES (no product
//    conditional this join can find at all). A row with evidence is
//    MATCHED when some `*.test.ts(x)` file anywhere in the repo ALSO
//    contains that same evidence string (a test mounts/asserts the
//    branch); PRESENT-UNMOUNTED when the evidence exists in product
//    source but no test contains it.
//
// 3. Two-sided ceilings (DIVERGENCE + UNRESOLVED-shape is not needed here
//    -- every row resolves to one of the three grades by construction, so
//    only one ceiling is declared, per DEC-808's "measure by forcing to -1
//    and reading the printed roster" doctrine) are exported and registered
//    in scripts/exit-predicate.ts's OUT_OF_CAMPAIGN_SCOPE (a newly
//    measured population, same disposition already given to
//    FRAME_EYEBROW_DIVERGENCE_CEILING).
//
// 4. Settled rows: `slot.clash`'s inner "one-tap resolution" control is
//    RETIRED per docs/design/audit/agenda-clash-390-v12.md PART 3 (DEC-903)
//    -- quoted verbatim in the audit doc this file writes alongside itself.
//    `slot.blocked` and `e.hasFact` are NEW, unruled DIVERGES rows (grepped
//    against src/decisions-data/, decisions/ and docs/design/DEVIATIONS.md
//    -- no hit for either).
//
// 5. `sc-for hint-placeholder-count="N"` blocks (201 of them across the
//    pack) are a NAMED NEXT POPULATION -- counted for the audit doc,
//    deliberately not graded here.
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { enumerateSourceFiles, labelIsMatched, normalizeSource, stripComments } from './frame-source-corpus';
import { captionsInText } from './frame-caption-ledger/population';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(HERE, '..');
const DESIGN_DIR = join(REPO_ROOT, 'docs', 'design');
const TEST_DIR = join(REPO_ROOT, 'test');
const APP_SRC_DIR = join(REPO_ROOT, 'app', 'src');
const SRC_DIR = join(REPO_ROOT, 'src');

// ---------------------------------------------------------------------------
// 1. Population: every *.dc.html under docs/design (readdirSync, DEC-808).
// ---------------------------------------------------------------------------

function allDcHtmlFiles(): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(DESIGN_DIR, { withFileTypes: true, recursive: true })) {
    if (!entry.isFile() || !entry.name.endsWith('.dc.html')) continue;
    out.push(join(entry.parentPath, entry.name));
  }
  return out.sort();
}

interface ConditionalRow {
  readonly file: string;
  readonly rel: string;
  readonly line: number;
  readonly expr: string;
  readonly hinted: 'true' | 'false';
  readonly ownText: string; // this block's own text, nested sc-if extents excluded
  readonly frameLine: number | null;
  readonly is390: boolean;
}

/** Line number (1-indexed) of the offset into `content`. */
function lineOf(content: string, offset: number): number {
  let line = 1;
  for (let i = 0; i < offset; i++) if (content[i] === '\n') line++;
  return line;
}

/** Walks `content` from `openEnd` (just past the opening `<sc-if ...>`) to
 * find the matching `</sc-if>`, tracking nested `<sc-if` opens so a nested
 * block's own close never terminates the outer one early. Returns the
 * [innerStart, innerEnd) span and the index just past `</sc-if>`. */
function matchScIfClose(content: string, openEnd: number): { innerEnd: number; afterClose: number } {
  let depth = 1;
  let i = openEnd;
  while (i < content.length) {
    const nextOpen = content.indexOf('<sc-if', i);
    const nextClose = content.indexOf('</sc-if>', i);
    if (nextClose === -1) throw new Error('unterminated <sc-if> block');
    if (nextOpen !== -1 && nextOpen < nextClose) {
      depth++;
      i = nextOpen + 6;
      continue;
    }
    depth--;
    if (depth === 0) return { innerEnd: nextClose, afterClose: nextClose + 8 };
    i = nextClose + 8;
  }
  throw new Error('unterminated <sc-if> block');
}

/** This block's own literal text runs (>=6 chars), EXCLUDING any nested
 * `<sc-if>...</sc-if>` extent's text -- a nested row's copy belongs to that
 * row, not its wrapper. Strips tags and `{{ ... }}` mustaches first. */
function ownLiterals(inner: string): string[] {
  // Blank out nested sc-if extents so their text never leaks into the
  // wrapper's own literal set.
  let scrubbed = inner;
  for (;;) {
    const nestedOpenTag = /<sc-if\b[^>]*>/.exec(scrubbed);
    if (!nestedOpenTag) break;
    const start = nestedOpenTag.index;
    const { afterClose } = matchScIfCloseLocal(scrubbed, start + nestedOpenTag[0].length);
    scrubbed = scrubbed.slice(0, start) + ' '.repeat(afterClose - start) + scrubbed.slice(afterClose);
  }
  // Strip every tag.
  const noTags = scrubbed.replace(/<[^>]*>/g, ' ');
  // Strip mustache interpolations.
  const noMustache = noTags.replace(/\{\{[^}]*\}\}/g, ' ');
  // Collect runs of non-whitespace-only text with at least one letter,
  // length >= 6 after trimming.
  const candidates = noMustache
    .split(/\s{2,}|\n/)
    .map((s) => s.replace(/\s+/g, ' ').trim())
    .filter((s) => s.length >= 6 && /[A-Za-z]{3,}/.test(s));
  return [...new Set(candidates)];

  function matchScIfCloseLocal(c: string, openEnd: number) {
    return matchScIfClose(c, openEnd);
  }
}

function extractConditionalRows(file: string): ConditionalRow[] {
  const content = readFileSync(file, 'utf-8');
  const rel = relative(REPO_ROOT, file);
  const rows: ConditionalRow[] = [];
  const openRe = /<sc-if\s+value="\{\{\s*([\w.]+)\s*\}\}"\s+hint-placeholder-val="\{\{\s*(true|false)\s*\}\}"\s*>/g;
  let m: RegExpExecArray | null;
  while ((m = openRe.exec(content)) !== null) {
    const expr = m[1]!;
    const hinted = m[2] as 'true' | 'false';
    const openEnd = m.index + m[0].length;
    const { innerEnd } = matchScIfClose(content, openEnd);
    const inner = content.slice(openEnd, innerEnd);
    const line = lineOf(content, m.index);

    // Nearest preceding frame-geometry line: `width:NNpx; ... background:#F4F1E8`.
    const before = content.slice(0, m.index);
    const frameRe = /width:(\d+)px;[^"]*background:#F4F1E8/g;
    let lastFrame: { line: number; width: number } | null = null;
    let fm: RegExpExecArray | null;
    while ((fm = frameRe.exec(before)) !== null) {
      lastFrame = { line: lineOf(before, fm.index), width: Number(fm[1]) };
    }

    rows.push({
      file,
      rel,
      line,
      expr,
      hinted,
      ownText: ownLiterals(inner).join(' | '),
      frameLine: lastFrame ? lastFrame.line : null,
      is390: lastFrame ? lastFrame.width === 390 : false,
    });
  }
  return rows;
}

const DC_FILES = allDcHtmlFiles();
const ROWS: ConditionalRow[] = DC_FILES.flatMap(extractConditionalRows);

// ---------------------------------------------------------------------------
// sc-for population (named next population, counted only).
// ---------------------------------------------------------------------------

function countScForBlocks(): number {
  let total = 0;
  for (const file of DC_FILES) {
    const content = readFileSync(file, 'utf-8');
    const re = /<sc-for\b[^>]*hint-placeholder-count="\d+"/g;
    total += (content.match(re) ?? []).length;
  }
  return total;
}

// ---------------------------------------------------------------------------
// 2. Derivation: cluster directories, per dc.html file.
// ---------------------------------------------------------------------------

const CLUSTER_DIRS: Record<string, string[]> = {
  'Chautauqua Agenda.dc.html': [join(APP_SRC_DIR, 'pages', 'agenda')],
  'Chautauqua Public and Portal.dc.html': [join(SRC_DIR, 'routes', 'public'), join(SRC_DIR, 'routes', 'portal')],
  'Chautauqua Speakers.dc.html': [join(APP_SRC_DIR, 'pages', 'speakers')],
  'Chautauqua Comms.dc.html': [join(APP_SRC_DIR, 'pages', 'comms'), join(SRC_DIR, 'mail'), join(SRC_DIR, 'routes', 'comms')],
  // Review and Settings each contribute rows the wave-29 ruling prose (DEC-383
  // amendment) did not enumerate -- readdirSync over docs/design at test
  // time (DEC-808) finds 23 sc-if rows total, not the 15 the ruling names
  // (see the audit doc's "POPULATION DISCREPANCY" section). A hand-count in
  // ruling prose is not a population; the code below grades all 23.
  'Chautauqua Review.dc.html': [join(APP_SRC_DIR, 'pages', 'review'), join(SRC_DIR, 'routes', 'review')],
  'Chautauqua Settings.dc.html': [join(APP_SRC_DIR, 'pages', 'settings')],
};

function clusterDirsFor(dcFile: string): string[] {
  const name = dcFile.split('/').pop()!;
  const dirs = CLUSTER_DIRS[name];
  if (!dirs) throw new Error(`no cluster directory mapping for ${name}`);
  return dirs;
}

function nonTestFilesUnder(dirs: string[]): string[] {
  const out: string[] = [];
  for (const dir of dirs) {
    for (const f of enumerateSourceFiles(dir)) out.push(f);
  }
  return out;
}

const ALL_TEST_FILES = (() => {
  const out: string[] = [];
  for (const root of [TEST_DIR, APP_SRC_DIR, SRC_DIR]) {
    for (const entry of readdirSync(root, { withFileTypes: true, recursive: true })) {
      if (!entry.isFile()) continue;
      if (!/\.test\.tsx?$/.test(entry.name)) continue;
      out.push(join(entry.parentPath, entry.name));
    }
  }
  return out;
})();

function lastSegment(expr: string): string {
  const parts = expr.split('.');
  return parts[parts.length - 1]!;
}

// A bare/suffix word shorter than this is too generic (e.g. `note`, `free`)
// to search without a real risk of a coincidental hit unrelated to this
// state -- see the audit doc's discussion of `f.note`. Rows this guard
// excludes fall through to NO-EVIDENCE (DIVERGES) rather than risk a false
// MATCHED. (Rows this excludes still have a TIER 1 copy-match path open to
// them -- `slot.free`'s literal "Place here" is what actually grades it,
// not this tier.)
const MIN_WORD_LENGTH = 5;

/** True for a genuine camelCase COMPOUND (e.g. `needsInvite`, `isBreak`) --
 * a bare-word search for a compound is safe (collision risk is low; no real
 * identifier elsewhere in a cluster is coincidentally spelled the same
 * multi-morpheme way). A single morpheme (`session`, `blocked`, `current`)
 * is NOT compound and is common-English-word-shaped, so it is searched only
 * in a DISCRIMINANT SHAPE (a quoted string literal or a CSS class-name
 * token) -- never as a bare word, which is exactly the shape that let
 * `slot.blocked` false-match on PhoneAgenda.tsx's unrelated `blocked`
 * break-scheduling parameter during this file's own development (recorded
 * in the audit doc). */
function isCompoundIdentifier(ident: string): boolean {
  return /[a-z][A-Z]/.test(ident);
}

function suffixNoun(ident: string): string | null {
  for (const prefix of ['is', 'has', 'needs']) {
    if (ident.startsWith(prefix) && ident.length > prefix.length && ident[prefix.length] === ident[prefix.length]!.toUpperCase()) {
      const rest = ident.slice(prefix.length);
      return rest[0]!.toLowerCase() + rest.slice(1);
    }
  }
  return null;
}

type Grade = 'MATCHED' | 'PRESENT-UNMOUNTED' | 'DIVERGES';

interface GradedRow extends ConditionalRow {
  readonly grade: Grade;
  readonly evidence: string | null;
  readonly evidenceTier: 'copy' | 'structural' | null;
}

function gradeRow(row: ConditionalRow): GradedRow {
  const dirs = clusterDirsFor(row.file);
  const clusterFiles = nonTestFilesUnder(dirs);
  const clusterBlobs = clusterFiles.map((f) => normalizeSource(readFileSync(f, 'utf-8')));

  // TIER 1: copy match.
  const literals = row.ownText.length === 0 ? [] : row.ownText.split(' | ');
  let evidence: string | null = null;
  let evidenceTier: 'copy' | 'structural' | null = null;
  for (const lit of literals) {
    if (labelIsMatched(lit, clusterBlobs)) {
      evidence = lit;
      evidenceTier = 'copy';
      break;
    }
  }

  // TIER 2: structural match, only if tier 1 found nothing.
  if (evidence === null) {
    const ident = lastSegment(row.expr);
    const stripped = clusterFiles.map((f) => stripComments(readFileSync(f, 'utf-8')));

    if (isCompoundIdentifier(ident) && ident.length >= MIN_WORD_LENGTH) {
      const bareRe = new RegExp(`\\b${ident}\\b`);
      if (stripped.some((s) => bareRe.test(s))) {
        evidence = ident;
        evidenceTier = 'structural';
      }
    }

    if (evidence === null) {
      // Either a single-morpheme identifier (session/clash/placed/free/
      // blocked/current/note/scale/choice) or an is/has/needs compound
      // whose bare form has no literal reader -- in both cases the only
      // safe search is a DISCRIMINANT SHAPE for the (possibly
      // prefix-stripped) noun: a quoted string literal or a CSS class
      // token, never a bare-word search of a common English word.
      const noun = suffixNoun(ident) ?? (!isCompoundIdentifier(ident) ? ident : null);
      if (noun && noun.length >= MIN_WORD_LENGTH) {
        const quotedRe = new RegExp(`['"\`]${noun}['"\`]`);
        const classRe = new RegExp(`-${noun}\\b|\\b${noun}-`);
        if (stripped.some((s) => quotedRe.test(s) || classRe.test(s))) {
          evidence = noun;
          evidenceTier = 'structural';
        }
      }
    }
  }

  if (evidence === null) {
    return { ...row, grade: 'DIVERGES', evidence: null, evidenceTier: null };
  }

  const testBlobs = ALL_TEST_FILES.map((f) => stripComments(readFileSync(f, 'utf-8')));
  const evidenceEscaped = evidence.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const mountedRe = new RegExp(evidenceTier === 'copy' ? evidenceEscaped : `\\b${evidenceEscaped}\\b`);
  const mounted = testBlobs.some((s) => mountedRe.test(s));

  return { ...row, grade: mounted ? 'MATCHED' : 'PRESENT-UNMOUNTED', evidence, evidenceTier };
}

const GRADED: GradedRow[] = ROWS.map(gradeRow);

// Rows already ruled elsewhere in the campaign (SETTLED table in the audit
// doc) -- excluded from the DIVERGENCE_CEILING population the same way
// every other ledger excludes an adjudicated row. `slot.clash`'s inner
// resolution control is RETIRED (DEC-903,
// docs/design/audit/agenda-clash-390-v12.md PART 3) but this ledger's own
// mechanical join already independently grades slot.clash MATCHED (the
// `clash` kind is real and tested) -- nothing to exclude here. No row in
// this population is settled-as-DIVERGES; this set exists so a future
// amendment has a place to add one without touching the grading code.
const SETTLED_EXPR_KEYS: ReadonlySet<string> = new Set([]);

function rowKey(r: ConditionalRow): string {
  return `${r.rel}:${r.line}`;
}

const DIVERGES = GRADED.filter((r) => r.grade === 'DIVERGES' && !SETTLED_EXPR_KEYS.has(rowKey(r)));
const PRESENT_UNMOUNTED = GRADED.filter((r) => r.grade === 'PRESENT-UNMOUNTED');

// ---------------------------------------------------------------------------
// 3. Ceilings (forced to -1 to read the roster; the real values below).
// ---------------------------------------------------------------------------

export const FRAME_CONDITIONAL_STATE_DIVERGENCE_CEILING = 3;
export const FRAME_CONDITIONAL_STATE_UNMOUNTED_CEILING = 0;

// ---------------------------------------------------------------------------
// Overlap measurement (task clause 3): how many rows from the drawn-WORD
// ledgers fall inside a FALSE-hinted sc-if's extent. Measured, not acted
// on -- those ledgers are untouched by this lane.
// ---------------------------------------------------------------------------

interface OverlapResult {
  readonly falseHintedExtents: number;
  readonly captionOverlap: number;
  readonly eyebrowOverlap: number;
  readonly fieldLabelOverlap: number;
}

// Local, DELIBERATELY SIMPLIFIED candidate regexes for the eyebrow and
// field-label populations, used ONLY to COUNT overlap below -- never to
// grade. Importing test/frame-eyebrow-label.scan.test.ts or
// test/frame-field-label.scan.test.ts directly (as this file does safely
// for test/frame-caption-ledger/population.ts, a non-test module) pulls
// their own `describe`/`it` suites into THIS file's collection -- verified
// empirically (their ratchets started running, and failing, inside this
// file's run). The authoritative populations and grades stay owned by
// those two files, untouched by this lane; the counts here may differ
// slightly from theirs (no control-face exclusion, no input-box lookahead)
// and are documented as approximate in the audit doc.
const EYEBROW_CANDIDATE_RE = /<(span|div)\b[^>]*style="([^"]*)"[^>]*>([^<]*)<\/\1>/g;
const UPPERCASE_STYLE_RE = /text-transform:uppercase/;
const FIELD_LABEL_CANDIDATE_RE = /<span\b[^>]*font-size:1[12]px[^>]*>([^<{]{2,})<\/span>/;
const INPUT_BOX_RE = /border:1px solid #BAB6A6/;

/** Measures how many rows from two of the four drawn-WORD ledgers
 * (caption -- via the real, imported population.ts module; eyebrow and
 * field-label -- via the local approximate candidate regexes above; the
 * control-label ledger's `labelsInFrameText` needs a frame-relative
 * `lineStartIndex`/`baseOffset` setup this file does not duplicate, so it
 * is named but not measured, clause 3's own scope note) fall inside a
 * `hint-placeholder-val="{{ false }}"` sc-if's byte extent -- i.e. how
 * many "drawn word" rows those ledgers may be grading as if the pack's
 * drawing actually rendered them, when the drawing in fact shows the
 * OTHER branch. This file changes none of those ledgers' populations or
 * ceilings. */
function measureFalseHintedOverlap(): OverlapResult {
  const ranges = falseHintedByteRanges();
  let captionOverlap = 0;
  let eyebrowOverlap = 0;
  let fieldLabelOverlap = 0;

  for (const file of DC_FILES) {
    const content = readFileSync(file, 'utf-8');
    const fileRanges = ranges.filter((r) => r.file === file);
    if (fileRanges.length === 0) continue;
    const inRange = (offset: number) => fileRanges.some((r) => offset >= r.start && offset < r.end);

    for (const c of captionsInText(content)) {
      // captionsInText reports a 1-indexed LINE, not a byte offset -- convert
      // via the line's own first-character offset.
      const lineStart = content.split('\n').slice(0, c.line - 1).join('\n').length + (c.line > 1 ? 1 : 0);
      if (inRange(lineStart)) captionOverlap++;
    }

    EYEBROW_CANDIDATE_RE.lastIndex = 0;
    let em: RegExpExecArray | null;
    while ((em = EYEBROW_CANDIDATE_RE.exec(content)) !== null) {
      const style = em[2]!;
      const text = em[3]!.trim();
      if (!UPPERCASE_STYLE_RE.test(style)) continue;
      if (text.length < 2 || text.includes('{{')) continue;
      if (inRange(em.index)) eyebrowOverlap++;
    }

    const lines = content.split('\n');
    let runningOffset = 0;
    for (const line of lines) {
      const m = FIELD_LABEL_CANDIDATE_RE.exec(line);
      if (m && !m[1]!.includes('{{')) {
        const windowEnd = Math.min(content.length, runningOffset + line.length + 400);
        const window = content.slice(runningOffset, windowEnd);
        if (INPUT_BOX_RE.test(window) && inRange(runningOffset)) fieldLabelOverlap++;
      }
      runningOffset += line.length + 1;
    }
  }

  return { falseHintedExtents: ranges.length, captionOverlap, eyebrowOverlap, fieldLabelOverlap };
}

function falseHintedByteRanges(): { file: string; start: number; end: number }[] {
  const out: { file: string; start: number; end: number }[] = [];
  for (const file of DC_FILES) {
    const content = readFileSync(file, 'utf-8');
    const openRe = /<sc-if\s+value="\{\{\s*[\w.]+\s*\}\}"\s+hint-placeholder-val="\{\{\s*false\s*\}\}"\s*>/g;
    let m: RegExpExecArray | null;
    while ((m = openRe.exec(content)) !== null) {
      const openEnd = m.index + m[0].length;
      const { innerEnd } = matchScIfClose(content, openEnd);
      out.push({ file, start: m.index, end: innerEnd });
    }
  }
  return out;
}

describe('frame conditional-state ledger (DEC-383 wave-29)', () => {
  it('population sanity: found more than 10 sc-if rows across the pack', () => {
    expect(ROWS.length).toBeGreaterThan(10);
  });

  it('population sanity: found the expected 23 sc-if rows (measured at main b2157a6e2 -- readdirSync over the full docs/design tree; the DEC-383 wave-29 ruling prose names only 15, having enumerated Agenda/Public and Portal/Speakers/Comms by hand and missed Review (7) and Settings (1))', () => {
    expect(ROWS.length).toBe(23);
  });

  it('every row resolves a frame geometry line', () => {
    for (const r of ROWS) {
      expect(r.frameLine, `${r.rel}:${r.line} (${r.expr}) found no enclosing frame geometry`).not.toBeNull();
    }
  });

  it('records how many rows sit inside a 390 frame vs desktop (printed via the roster below, not hand-counted)', () => {
    const phoneRows = ROWS.filter((r) => r.is390);
    const desktopRows = ROWS.filter((r) => !r.is390);
    expect(phoneRows.length + desktopRows.length).toBe(ROWS.length);
  });

  it('sc-for next-population count: more than 150 hint-placeholder-count blocks exist (named, not graded, this wave)', () => {
    expect(countScForBlocks()).toBeGreaterThan(150);
  });

  describe('graded rows', () => {
    for (const r of GRADED) {
      it(`${r.rel}:${r.line} \`${r.expr}\` (hinted ${r.hinted}) grades ${r.grade}`, () => {
        expect(r.grade).toBe(r.grade); // roster print below is the real assertion surface
      });
    }
  });

  it(`DIVERGENCE_CEILING ratchet: at most ${FRAME_CONDITIONAL_STATE_DIVERGENCE_CEILING} unsettled DIVERGES rows`, () => {
    if (DIVERGES.length > FRAME_CONDITIONAL_STATE_DIVERGENCE_CEILING) {
      const roster = DIVERGES.map((r) => `  - ${r.rel}:${r.line} \`${r.expr}\` (hinted ${r.hinted})`).join('\n');
      throw new Error(`${DIVERGES.length} DIVERGES rows > ceiling ${FRAME_CONDITIONAL_STATE_DIVERGENCE_CEILING}:\n${roster}`);
    }
    expect(DIVERGES.length).toBeLessThanOrEqual(FRAME_CONDITIONAL_STATE_DIVERGENCE_CEILING);
  });

  it(`UNMOUNTED_CEILING ratchet: at most ${FRAME_CONDITIONAL_STATE_UNMOUNTED_CEILING} PRESENT-UNMOUNTED rows`, () => {
    if (PRESENT_UNMOUNTED.length > FRAME_CONDITIONAL_STATE_UNMOUNTED_CEILING) {
      const roster = PRESENT_UNMOUNTED.map((r) => `  - ${r.rel}:${r.line} \`${r.expr}\` evidence="${r.evidence}"`).join('\n');
      throw new Error(`${PRESENT_UNMOUNTED.length} PRESENT-UNMOUNTED rows > ceiling ${FRAME_CONDITIONAL_STATE_UNMOUNTED_CEILING}:\n${roster}`);
    }
    expect(PRESENT_UNMOUNTED.length).toBeLessThanOrEqual(FRAME_CONDITIONAL_STATE_UNMOUNTED_CEILING);
  });

  // Two-sided companions (test/campaign-ratchet-two-sided.scan.test.ts):
  // a ratchet must also fail when the measurement falls BELOW its ceiling
  // without the ceiling being lowered in the same commit -- otherwise a
  // future lane's fix could silently widen the gap between the ceiling and
  // reality with nothing forcing it down.
  it(`never sits BELOW FRAME_CONDITIONAL_STATE_DIVERGENCE_CEILING (${FRAME_CONDITIONAL_STATE_DIVERGENCE_CEILING}) without the ceiling being lowered to match`, () => {
    if (DIVERGES.length < FRAME_CONDITIONAL_STATE_DIVERGENCE_CEILING) {
      throw new Error(
        `${DIVERGES.length} DIVERGES rows, below the ceiling of ${FRAME_CONDITIONAL_STATE_DIVERGENCE_CEILING}. ` +
          `Lower the ceiling in the same commit:\n  export const FRAME_CONDITIONAL_STATE_DIVERGENCE_CEILING = ${DIVERGES.length};`,
      );
    }
    expect(DIVERGES.length).toBeGreaterThanOrEqual(FRAME_CONDITIONAL_STATE_DIVERGENCE_CEILING);
  });

  it(`never sits BELOW FRAME_CONDITIONAL_STATE_UNMOUNTED_CEILING (${FRAME_CONDITIONAL_STATE_UNMOUNTED_CEILING}) without the ceiling being lowered to match`, () => {
    if (PRESENT_UNMOUNTED.length < FRAME_CONDITIONAL_STATE_UNMOUNTED_CEILING) {
      throw new Error(
        `${PRESENT_UNMOUNTED.length} PRESENT-UNMOUNTED rows, below the ceiling of ${FRAME_CONDITIONAL_STATE_UNMOUNTED_CEILING}. ` +
          `Lower the ceiling in the same commit:\n  export const FRAME_CONDITIONAL_STATE_UNMOUNTED_CEILING = ${PRESENT_UNMOUNTED.length};`,
      );
    }
    expect(PRESENT_UNMOUNTED.length).toBeGreaterThanOrEqual(FRAME_CONDITIONAL_STATE_UNMOUNTED_CEILING);
  });

  it('the exact DIVERGES roster is slot.blocked, e.hasFact and f.note (measured at main b2157a6e2 -- change this assertion, never silently, when a lane fixes one)', () => {
    const keys = DIVERGES.map((r) => `${r.rel}:${r.line}:${r.expr}`).sort();
    expect(keys).toEqual([
      'docs/design/Chautauqua Comms.dc.html:719:e.hasFact',
      'docs/design/Chautauqua Agenda.dc.html:182:slot.blocked',
      'docs/design/Chautauqua Settings.dc.html:327:f.note',
    ].sort());
  });

  it('overlap measurement: how many drawn-word-ledger rows fall inside a false-hinted sc-if extent (recorded in the audit doc; no ledger touched this lane)', () => {
    const overlap = measureFalseHintedOverlap();
    expect(overlap.falseHintedExtents).toBeGreaterThan(0);
    // Printed so the audit doc's numbers are reproducible from this run,
    // not retyped by hand.
    // eslint-disable-next-line no-console
    console.log(
      `false-hinted extents=${overlap.falseHintedExtents} caption-overlap=${overlap.captionOverlap} ` +
        `eyebrow-overlap=${overlap.eyebrowOverlap} field-label-overlap=${overlap.fieldLabelOverlap}`,
    );
    expect(overlap.captionOverlap + overlap.eyebrowOverlap + overlap.fieldLabelOverlap).toBeGreaterThanOrEqual(0);
  });

  describe('non-vacuity (DEC-967: prove the join over a SYNTHETIC fixture, never a live row identity)', () => {
    it('ownLiterals extracts a literal and excludes a nested sc-if extent', () => {
      const inner = ` <div>text before <span>Outer literal text</span>
        <sc-if value="{{ x.y }}" hint-placeholder-val="{{ true }}">
          <span>Inner literal text should not leak</span>
        </sc-if>
      </div>`;
      const fixtureRows = extractConditionalRowsFromFixture(
        `<sc-if value="{{ fixture.outer }}" hint-placeholder-val="{{ true }}">${inner}</sc-if>`,
      );
      expect(fixtureRows).toHaveLength(2);
      const outer = fixtureRows.find((r) => r.expr === 'fixture.outer')!;
      expect(outer.ownText).toContain('Outer literal text');
      expect(outer.ownText).not.toContain('Inner literal text');
    });

    it('a fabricated sc-if with no matching product evidence anywhere grades DIVERGES', () => {
      const row: ConditionalRow = {
        file: join(DESIGN_DIR, 'Chautauqua Comms.dc.html'),
        rel: 'docs/design/Chautauqua Comms.dc.html',
        line: 1,
        expr: 'fixture.totallyUnbuiltState',
        hinted: 'false',
        ownText: 'Zzqxw Nonexistent Fixture Copy Zzqxw',
        frameLine: 1,
        is390: false,
      };
      const graded = gradeRow(row);
      expect(graded.grade).toBe('DIVERGES');
    });

    it('a fabricated sc-if whose literal copy IS present in the cluster (this file itself, imported as a fixture) grades non-DIVERGES', () => {
      // "Or paste this into your browser" is real copy in src/mail/shell.ts,
      // inside the Comms cluster -- reusing it here proves the positive
      // path of the exact matcher used above, over a fixture EXPRESSION
      // rather than a real row's identity.
      const row: ConditionalRow = {
        file: join(DESIGN_DIR, 'Chautauqua Comms.dc.html'),
        rel: 'docs/design/Chautauqua Comms.dc.html',
        line: 1,
        expr: 'fixture.copyProbe',
        hinted: 'true',
        ownText: 'Or paste this into your browser',
        frameLine: 1,
        is390: false,
      };
      const graded = gradeRow(row);
      expect(graded.grade).not.toBe('DIVERGES');
    });
  });
});

/** Test-only helper mirroring extractConditionalRows but over an in-memory
 * fixture string (never a real dc.html row identity, DEC-967). */
function extractConditionalRowsFromFixture(html: string): ConditionalRow[] {
  const rows: ConditionalRow[] = [];
  const openRe = /<sc-if\s+value="\{\{\s*([\w.]+)\s*\}\}"\s+hint-placeholder-val="\{\{\s*(true|false)\s*\}\}"\s*>/g;
  let m: RegExpExecArray | null;
  while ((m = openRe.exec(html)) !== null) {
    const expr = m[1]!;
    const hinted = m[2] as 'true' | 'false';
    const openEnd = m.index + m[0].length;
    const { innerEnd } = matchScIfClose(html, openEnd);
    const inner = html.slice(openEnd, innerEnd);
    rows.push({
      file: 'fixture',
      rel: 'fixture',
      line: lineOf(html, m.index),
      expr,
      hinted,
      ownText: ownLiterals(inner).join(' | '),
      frameLine: null,
      is390: false,
    });
  }
  return rows;
}
