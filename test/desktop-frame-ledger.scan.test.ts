// Desktop-frame claim ledger (DEC-976 amendment, v12 mobile campaign wave 99;
// task v12m-w2-f).
//
// The campaign's goal is "every screen matches its v12 frame on desktop AND
// phone". test/phone-frame-ledger.scan.test.ts has answered the phone half
// since wave 83 by deriving its population from the pack (53 frames, a
// per-file breakdown as a vacuous-population tripwire, claim-by-citation, a
// two-sided CLAIMED_FLOOR). Nothing has ever answered the desktop half --
// "desktop is frozen and already conformant" is eighteen waves of assumption
// with no instrument behind it (field guide, DEC-976 wave-99 amendment). This
// is that instrument. It mirrors the phone ledger's structure, idioms and
// comment discipline; it does not touch that file (a separate lane owns the
// phone half) and it does not touch any desktop CSS or markup -- this ships
// an instrument, not a redesign.
//
//   1. POPULATION: readdirSync docs/design for *.dc.html (never a
//      hand-listed file list). Within each file, every label span matching
//      the phone ledger's own grammar (`font-size:19px ... >TITLE<`) opens a
//      frame whose extent runs to the next label span, or EOF. Unlike the
//      phone ledger -- which anchors a frame on its `width:390px`+`height:844`
//      line and resolves the title from the nearest PRECEDING label -- here
//      every label itself opens a frame, because a desktop frame has no
//      `width:390px` marker of its own to anchor on. A frame is DESKTOP when
//      its extent (the label line up to, but not including, the next label
//      line) contains no `width:390px`+`height:844` line anywhere in it --
//      i.e. it isn't the phone ledger's population wearing a different hat.
//      A vacuous-population tripwire (exact total label count 161, exact
//      total pre-exclusion desktop count 108, exact per-file breakdown after
//      exclusion) guards against the grammar silently matching nothing, or
//      matching something else, and the whole scan passing green over an
//      empty set.
//
//   2. EXCLUSIONS -- written, justified, and asserted against the pack so a
//      re-cut cannot silently grow the list:
//        a. TEMPLATE INTERPOLATIONS -- a label whose title is itself a
//           `{{ ... }}` Mustache-style interpolation is documentation of a
//           data binding, not a screen a v12 frame draws. This is a PATTERN
//           exclusion (title matches /^\{\{.*\}\}$/), not a hand-picked list,
//           and it currently matches three labels in the pack: `{{ e.name }}`
//           at Chautauqua Home.dc.html:205, `{{ e.name }}` at Chautauqua
//           Comms.dc.html:695, and `{{ s.name }}` at Chautauqua Public and
//           Portal.dc.html:716. All three are asserted below by exact
//           citation so the pattern's reach is visible, not just its rule.
//        b. EXPLAINER PANELS -- the pack's own documentation panels, not
//           screens: "Widths · what a wide monitor gets" (Chautauqua
//           Overview.dc.html:353), "Rules you can't see on the page"
//           (Chautauqua Home.dc.html:326), "How the screenshots are made"
//           (Chautauqua Docs.dc.html:210). These are a hand-picked, exact
//           file:line:title list (a pattern cannot distinguish an explainer
//           panel from a real screen by its title alone) -- each is asserted
//           below to still resolve to its cited line, so this list rots
//           loudly like any other citation the moment the pack is re-cut.
//
//   3. CLAIM: identical to the phone ledger -- a frame is claimed when some
//      *.test.ts/*.test.tsx under test/ or app/src/ (enumerated, never
//      named) cites `docs/design/<file>.dc.html:<line>` with a line landing
//      inside that frame's extent.
//
//   4. RATCHET, never an allowlist populated from the failure output (the
//      house rule stated verbatim in app/src/phone-tap-target.scan.test.ts:
//      30-32, and honoured identically by the phone ledger): CLAIMED_FLOOR is
//      a single exported const, set to the count actually measured on this
//      branch. It may only be RAISED in a future wave as more desktop frames
//      get claimed by real desktop-parity tests; it must never be lowered to
//      paper over a regression. Two-sided, mirroring the phone ledger's
//      wave-85 amendment: a companion test FAILS when the measured claim
//      count rises above CLAIMED_FLOOR, printing the exact replacement line,
//      so a stale floor cannot survive a wave that actually lands coverage.
//      The failure message names every unclaimed desktop frame as
//      `<file> :<line> -- <title>` so a planner can schedule it.
//
//   5. A citation is not an assertion (DEC-976's frame-truth half, applied
//      here to the ledger's own inputs, identical to the phone ledger): a
//      separate `it` asserts every citation that claimed a frame actually
//      resolves to a real line number in the named frame file.
//
// goalComplete for the desktop half of the v12 mobile campaign is
// CLAIMED_FLOOR reaching the full desktop population -- every enumerated
// desktop frame cited by some test.
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const HERE = dirname(fileURLToPath(import.meta.url)); // test/
const REPO_ROOT = join(HERE, '..');
const DESIGN_ROOT = join(REPO_ROOT, 'docs', 'design');
const TEST_ROOT = HERE;
const APP_SRC_ROOT = join(REPO_ROOT, 'app', 'src');

// -- Population: every font-size:19px label span in docs/design ------------

interface RawLabel {
  /** 1-based line number of the font-size:19px label span. */
  line: number;
  title: string;
}

interface Frame {
  /** Repo-relative frame file, e.g. "docs/design/Chautauqua Speakers.dc.html". */
  file: string;
  /** Bare filename under docs/design/, e.g. "Chautauqua Speakers.dc.html". */
  fileName: string;
  /** 1-based line number of the label span that opens this frame. */
  line: number;
  title: string;
  /** Extent end (exclusive): the next label line in the same file, or
   * Infinity if this is the last labelled block in the file. */
  extentEnd: number;
}

// Same grammar the phone ledger uses for its own title resolution, widened
// to accept any closing tag rather than only `</span>` -- desktop labels are
// sometimes set on an `<a>` (e.g. Chautauqua Home.dc.html:205), and the
// vacuous-population tripwire below (161 total labels, matching the
// field-guide's independently-derived count) confirms this widened grammar
// is the one the pack actually uses, not an accidental over-match.
const LABEL_RE = />([^<]+)<\//;

function isFrameLine(line: string): boolean {
  return line.includes('width:390px') && line.includes('height:844');
}

function isLabelLine(line: string): boolean {
  return line.includes('font-size:19px') && LABEL_RE.test(line);
}

/** Every *.dc.html file directly under docs/design, enumerated rather than
 * named (DEC-808), identical to the phone ledger's own designFiles(). */
function designFiles(): string[] {
  return readdirSync(DESIGN_ROOT, { withFileTypes: true })
    .filter((e) => e.isFile() && e.name.endsWith('.dc.html'))
    .map((e) => e.name)
    .sort();
}

function labelsInFile(fileName: string): RawLabel[] {
  const full = join(DESIGN_ROOT, fileName);
  const lines = readFileSync(full, 'utf-8').split('\n');
  const labels: RawLabel[] = [];
  lines.forEach((content, idx) => {
    if (!isLabelLine(content)) return;
    const m = content.match(LABEL_RE);
    if (m) labels.push({ line: idx + 1, title: m[1]!.trim() });
  });
  return labels;
}

/** Every label-opened frame in `fileName`, tagged with whether its extent
 * contains a phone (width:390px+height:844) line -- i.e. whether it is the
 * phone ledger's population wearing this file's label grammar. */
function allFramesInFile(fileName: string): { frame: Frame; isPhone: boolean }[] {
  const full = join(DESIGN_ROOT, fileName);
  const relFile = relative(REPO_ROOT, full);
  const lines = readFileSync(full, 'utf-8').split('\n');
  const labels = labelsInFile(fileName);

  return labels.map((label, i) => {
    const nextLabel = labels[i + 1];
    const extentEnd = nextLabel ? nextLabel.line : Infinity;
    const extentLines = lines.slice(label.line - 1, extentEnd === Infinity ? lines.length : extentEnd - 1);
    const isPhone = extentLines.some(isFrameLine);
    return {
      frame: { file: relFile, fileName, line: label.line, title: label.title, extentEnd },
      isPhone,
    };
  });
}

const TOTAL_LABELS: number = designFiles().reduce((n, f) => n + labelsInFile(f).length, 0);

const ALL_DESKTOP_FRAMES_PRE_EXCLUSION: Frame[] = designFiles().flatMap((f) =>
  allFramesInFile(f)
    .filter((entry) => !entry.isPhone)
    .map((entry) => entry.frame)
);

// -- Exclusions --------------------------------------------------------------

/** A label whose entire title is a `{{ ... }}` Mustache interpolation is
 * documentation of a data binding, not a screen. Pattern exclusion, not a
 * hand-picked list -- see EXPECTED_TEMPLATE_TITLES below for what it
 * currently reaches. */
const TEMPLATE_INTERPOLATION_RE = /^\{\{.*\}\}$/;

function isTemplateInterpolation(frame: Frame): boolean {
  return TEMPLATE_INTERPOLATION_RE.test(frame.title);
}

/** Exact citations the template-interpolation pattern is expected to reach
 * today. Asserted below so the pattern's blast radius is visible and a
 * re-cut that silently grows it fails loudly. */
const EXPECTED_TEMPLATE_TITLES = [
  { fileName: 'Chautauqua Home.dc.html', line: 205, title: '{{ e.name }}' },
  { fileName: 'Chautauqua Comms.dc.html', line: 695, title: '{{ e.name }}' },
  { fileName: 'Chautauqua Public and Portal.dc.html', line: 716, title: '{{ s.name }}' },
];

/** The pack's own explainer/documentation panels -- not screens, so not
 * desktop frames. A pattern cannot distinguish these from a real screen by
 * title alone, so this is a hand-picked, exact file:line:title list,
 * asserted below to still resolve to its cited line (rots loudly like any
 * other citation on a re-cut). */
const EXPLAINER_PANELS = [
  { fileName: 'Chautauqua Overview.dc.html', line: 353, title: "Widths · what a wide monitor gets" },
  { fileName: 'Chautauqua Home.dc.html', line: 326, title: "Rules you can't see on the page" },
  { fileName: 'Chautauqua Docs.dc.html', line: 210, title: 'How the screenshots are made' },
];

function isExplainerPanel(frame: Frame): boolean {
  return EXPLAINER_PANELS.some((p) => p.fileName === frame.fileName && p.line === frame.line);
}

const ALL_FRAMES: Frame[] = ALL_DESKTOP_FRAMES_PRE_EXCLUSION.filter(
  (f) => !isTemplateInterpolation(f) && !isExplainerPanel(f)
);

const EXPECTED_PER_FILE: Record<string, number> = {
  'Chautauqua Account.dc.html': 8,
  'Chautauqua Agenda.dc.html': 2,
  'Chautauqua Comms.dc.html': 9,
  'Chautauqua Contacts.dc.html': 12,
  'Chautauqua Content.dc.html': 4,
  'Chautauqua Docs.dc.html': 3,
  'Chautauqua Home.dc.html': 3,
  'Chautauqua Overview.dc.html': 5,
  'Chautauqua Public and Portal.dc.html': 13,
  'Chautauqua Review.dc.html': 8,
  'Chautauqua Settings.dc.html': 17,
  'Chautauqua Speakers.dc.html': 10,
  'Chautauqua Submissions.dc.html': 8,
};

const EXPECTED_TOTAL_LABELS = 161;
const EXPECTED_TOTAL_DESKTOP_PRE_EXCLUSION = 108;
const EXPECTED_TOTAL = 102;

// -- Claims: every *.test.ts/*.test.tsx under test/ or app/src/ ------------
// Identical machinery to the phone ledger's own claim side.

function isTestFile(name: string): boolean {
  return name.endsWith('.test.ts') || name.endsWith('.test.tsx');
}

/** Every *.test.ts/*.test.tsx file under `root`, enumerated via readdirSync
 * rather than named (DEC-808). */
function enumerateTestFiles(root: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(root, { withFileTypes: true, recursive: true })) {
    if (!entry.isFile() || !isTestFile(entry.name)) continue;
    out.push(join(entry.parentPath, entry.name));
  }
  return out.sort();
}

const CLAIM_TEST_FILES = [...enumerateTestFiles(TEST_ROOT), ...enumerateTestFiles(APP_SRC_ROOT)];

// Strict citation form: docs/design/<Frame Name>.dc.html:<line-blob>
// (mirrors app/src/frame-citation.scan.test.ts's STRICT_RE and the phone
// ledger's own CITATION_RE; DEC-976).
const CITATION_RE = /docs\/design\/([A-Za-z][A-Za-z0-9 ]*\.dc\.html):\s*([\d/,-]+)/g;

interface Citation {
  /** Repo-relative path of the citing test file. */
  citingFile: string;
  frameFileName: string;
  /** First line number named by the citation (a multi-line citation like
   * ":97/101" cites several lines; the first is the one checked, mirroring
   * frame-citation.scan.test.ts's own convention). */
  firstLine: number;
  matchText: string;
}

function firstLineNumber(blob: string): number {
  const m = blob.match(/\d+/);
  if (!m) throw new Error(`no digit found in line reference "${blob}"`);
  return Number(m[0]);
}

/** Collapses comment-wrap line breaks (and any run of whitespace) to a
 * single space, so a citation split across a wrapped comment line is still
 * read as one contiguous string -- mirrors the phone ledger's own
 * `flatten`. */
function flatten(content: string): string {
  return content
    .replace(/\r?\n[ \t]*\*\/?[ \t]?/g, ' ')
    .replace(/\r?\n[ \t]*\/\/[ \t]?/g, ' ')
    .replace(/\s+/g, ' ');
}

function citationsInFile(absFile: string): Citation[] {
  const relFile = relative(REPO_ROOT, absFile);
  const content = flatten(readFileSync(absFile, 'utf-8'));
  const out: Citation[] = [];
  for (const m of content.matchAll(CITATION_RE)) {
    out.push({
      citingFile: relFile,
      frameFileName: m[1]!,
      firstLine: firstLineNumber(m[2]!),
      matchText: m[0],
    });
  }
  return out;
}

const ALL_CITATIONS: Citation[] = CLAIM_TEST_FILES.flatMap(citationsInFile);

/** True if `citation` lands inside `frame`'s extent. */
function citationClaims(citation: Citation, frame: Frame): boolean {
  if (citation.frameFileName !== frame.fileName) return false;
  return citation.firstLine >= frame.line && citation.firstLine < frame.extentEnd;
}

interface Claim {
  frame: Frame;
  citation: Citation;
}

const CLAIMS: Claim[] = [];
for (const frame of ALL_FRAMES) {
  const citation = ALL_CITATIONS.find((c) => citationClaims(c, frame));
  if (citation) CLAIMS.push({ frame, citation });
}

// -- Ratchet -----------------------------------------------------------------
// Measured on this branch (v12m-w2-f): 16 of 102 desktop frames are cited by
// an existing test. May only be RAISED in a future wave as more frames get
// real desktop-parity coverage; never lowered.
export const CLAIMED_FLOOR = 16;

describe('desktop-frame claim ledger (DEC-976 wave-99 amendment, v12 mobile campaign)', () => {
  it('enumerates exactly 161 font-size:19px label spans across 13 files (vacuous-grammar guard)', () => {
    const files = designFiles();
    expect(files.length).toBe(13);
    expect(TOTAL_LABELS).toBe(EXPECTED_TOTAL_LABELS);
  });

  it('classifies exactly 108 of those labels as desktop frames before exclusion (vacuous-classifier guard)', () => {
    expect(ALL_DESKTOP_FRAMES_PRE_EXCLUSION.length).toBe(EXPECTED_TOTAL_DESKTOP_PRE_EXCLUSION);
  });

  it('the template-interpolation exclusion reaches exactly the three citations it is expected to', () => {
    const matched = ALL_DESKTOP_FRAMES_PRE_EXCLUSION.filter(isTemplateInterpolation)
      .map((f) => ({ fileName: f.fileName, line: f.line, title: f.title }))
      .sort((a, b) => a.fileName.localeCompare(b.fileName) || a.line - b.line);
    const expected = [...EXPECTED_TEMPLATE_TITLES].sort(
      (a, b) => a.fileName.localeCompare(b.fileName) || a.line - b.line
    );
    expect(matched).toEqual(expected);
  });

  it('every excluded explainer panel still resolves to its cited line and title', () => {
    for (const panel of EXPLAINER_PANELS) {
      const found = ALL_DESKTOP_FRAMES_PRE_EXCLUSION.find(
        (f) => f.fileName === panel.fileName && f.line === panel.line
      );
      if (!found) {
        throw new Error(
          `explainer-panel exclusion "${panel.title}" no longer resolves to ` +
            `${panel.fileName}:${panel.line} -- the pack was re-cut; update the exclusion list, ` +
            `don't just delete the entry`
        );
      }
      expect(found.title).toBe(panel.title);
    }
    // And the exclusion list is exhaustive: nothing else is dropped silently.
    const droppedCount = ALL_DESKTOP_FRAMES_PRE_EXCLUSION.length - ALL_FRAMES.length;
    expect(droppedCount).toBe(EXPECTED_TEMPLATE_TITLES.length + EXPLAINER_PANELS.length);
  });

  it('enumerates exactly 102 desktop frames across 13 files after exclusion (vacuous-population guard)', () => {
    const actualPerFile: Record<string, number> = {};
    for (const frame of ALL_FRAMES) {
      actualPerFile[frame.fileName] = (actualPerFile[frame.fileName] ?? 0) + 1;
    }
    expect(actualPerFile).toEqual(EXPECTED_PER_FILE);
    expect(ALL_FRAMES.length).toBe(EXPECTED_TOTAL);
  });

  it(`claims at least CLAIMED_FLOOR (${CLAIMED_FLOOR}) of 102 desktop frames, and never fewer than the ratchet`, () => {
    if (CLAIMS.length < CLAIMED_FLOOR) {
      const claimedKeys = new Set(CLAIMS.map((c) => `${c.frame.file}:${c.frame.line}`));
      const unclaimed = ALL_FRAMES.filter((f) => !claimedKeys.has(`${f.file}:${f.line}`)).map(
        (f) => `${f.file} :${f.line} -- ${f.title}`
      );
      throw new Error(
        `claimed ${CLAIMS.length} of ${ALL_FRAMES.length} desktop frames, below the ratchet ` +
          `floor of ${CLAIMED_FLOOR}. CLAIMED_FLOOR may only be RAISED, never lowered -- ` +
          `schedule coverage for the unclaimed frames below (never shrink the floor to match ` +
          `a regression):\n${unclaimed.join('\n')}`
      );
    }
    expect(CLAIMS.length).toBeGreaterThanOrEqual(CLAIMED_FLOOR);
    // goalComplete for the desktop half of the v12 mobile campaign is this
    // reaching 102 of 102.
  });

  it(`never claims MORE than CLAIMED_FLOOR (${CLAIMED_FLOOR}) without the floor being raised to match (a stale floor licenses stagnation)`, () => {
    if (CLAIMS.length > CLAIMED_FLOOR) {
      throw new Error(
        `claimed ${CLAIMS.length} of ${ALL_FRAMES.length} desktop frames, above the ratchet ` +
          `floor of ${CLAIMED_FLOOR}. This is the ratchet working: coverage landed. Raise the ` +
          `floor in the same commit (a merge-train act, never a worker's edit mid-lane) by ` +
          `replacing the line:\n  export const CLAIMED_FLOOR = ${CLAIMS.length};`
      );
    }
    expect(CLAIMS.length).toBeLessThanOrEqual(CLAIMED_FLOOR);
  });

  it('every citation that claimed a frame resolves to a real line in the named frame file', () => {
    const frameLineCounts = new Map<string, number>();
    for (const fileName of designFiles()) {
      const count = readFileSync(join(DESIGN_ROOT, fileName), 'utf-8').split('\n').length;
      frameLineCounts.set(fileName, count);
    }

    const bad = CLAIMS.filter((claim) => {
      const total = frameLineCounts.get(claim.frame.fileName);
      return total === undefined || claim.citation.firstLine < 1 || claim.citation.firstLine > total;
    }).map(
      (claim) =>
        `${claim.citation.citingFile}: "${claim.citation.matchText}" cites ${claim.frame.fileName}:${claim.citation.firstLine}, which does not exist in that frame file`
    );
    expect(bad).toEqual([]);
  });
});
