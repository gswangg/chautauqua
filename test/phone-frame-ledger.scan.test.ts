// Phone-frame claim ledger (DEC-808 amendment, wave 83, v12 mobile campaign
// w1; task w1-j).
//
// The campaign's goal is "every screen matches its v12 frame on desktop AND
// phone", and nothing in the tree can answer "how many of the phone frames
// are CLAIMED?" -- docs/mobile-campaign.md's per-cluster counts are a
// hand-written list, which is exactly the desync DEC-808 rules against ("a
// scan that ENUMERATES ... rather than naming them"; field guide: A
// DIRECTORY IS NOT A POPULATION, A HAND-LISTED POPULATION IS NOT A
// POPULATION). So this scan does not read the mandate's counts at all -- it
// derives the population itself:
//
//   1. POPULATION: readdirSync docs/design for *.dc.html (never a
//      hand-listed file list), and within each file, every line carrying
//      both `width:390px` and `height:844` is a phone frame. Its TITLE is
//      resolved from the nearest preceding `font-size:19px ... >TITLE<`
//      label span. A vacuous-population tripwire (exact count 53, exact
//      per-file breakdown) guards against the substring match silently
//      matching nothing, or matching something else, and the whole scan
//      passing green over an empty set.
//
//   2. CLAIM: a frame is claimed when some *.test.ts/*.test.tsx under
//      test/ or app/src/ (enumerated via readdirSync, never named) cites it
//      as `docs/design/<file>.dc.html:<line>` -- the same citation form
//      DEC-976 already governs -- with a line number landing inside the
//      frame's extent: from the frame's own `width:390px`/`height:844`
//      line up to (but not including) the next frame-label line in that
//      file, or end-of-file for the last frame.
//
//   3. RATCHET, never an allowlist populated from the failure output (the
//      house rule stated verbatim in app/src/phone-tap-target.scan.test.ts:
//      30-32): CLAIMED_FLOOR is a single exported const, set to the count
//      actually measured on this branch. The floor may only be RAISED in a
//      future wave as more frames get claimed by real phone-parity tests;
//      it must never be lowered to paper over a regression. The failure
//      message names every unclaimed frame as `<file> :<line> -- <title>`
//      so the planner can schedule it.
//
//      DEC-808 amendment (wave 85): a floor is a two-sided ratchet, the
//      mirror of test/vocabulary-duplication-ratchet.scan.test.ts's ceiling
//      (which must never sit ABOVE the truth). This floor must never sit
//      BELOW the truth either -- a stale floor licenses stagnation exactly
//      as a high ceiling licenses debt. A companion test below FAILS when
//      the measured claim count rises above CLAIMED_FLOOR, printing the
//      exact replacement line, so a stale floor cannot survive a wave that
//      actually lands coverage. Re-measured on this branch (v12m-w2-i):
//      still 6 of 53 -- CLAIMED_FLOOR is not stale today. Expect and intend
//      this companion to go RED in the merge-train batch as this wave's
//      other lanes land phone-parity citations (that is the ratchet
//      working); raising CLAIMED_FLOOR to match is a merge-train act
//      performed once per batch, never a worker's edit mid-lane.
//
//   4. A citation is not an assertion (DEC-976's frame-truth half, applied
//      here to the ledger's own inputs): a separate `it` asserts every
//      citation that claimed a frame actually resolves to a real line
//      number in the named frame file.
//
// goalComplete for the v12 mobile campaign is CLAIMED_FLOOR reaching 53 --
// every enumerated phone frame cited by some test.
import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const HERE = dirname(fileURLToPath(import.meta.url)); // test/
const REPO_ROOT = join(HERE, '..');
const DESIGN_ROOT = join(REPO_ROOT, 'docs', 'design');
const TEST_ROOT = HERE;
const APP_SRC_ROOT = join(REPO_ROOT, 'app', 'src');

// -- Population: every width:390/height:844 phone frame in docs/design -----

interface Frame {
  /** Repo-relative frame file, e.g. "docs/design/Chautauqua Speakers.dc.html". */
  file: string;
  /** Bare filename under docs/design/, e.g. "Chautauqua Speakers.dc.html". */
  fileName: string;
  /** 1-based line number of the width:390px/height:844 declaration. */
  line: number;
  /** Title resolved from the nearest preceding font-size:19px label span. */
  title: string;
  /** Extent end (exclusive): the next frame-label line in the same file,
   * or Infinity if this is the last labelled block in the file. */
  extentEnd: number;
}

const LABEL_RE = />([^<]+)<\/span>/;

function isFrameLine(line: string): boolean {
  return line.includes('width:390px') && line.includes('height:844');
}

function isLabelLine(line: string): boolean {
  return line.includes('font-size:19px') && LABEL_RE.test(line);
}

/** DEC-967 wave-41 amendment: the 1-based line of the single `</x-dc>`
 * template close in `fileName`, throwing loudly on zero or multiple
 * matches. A frame's extent is never allowed to reach past this line --
 * without the clip, the last labelled block of a file swallows the
 * template's own closing tag and everything after it (fixture
 * `data-dc-script` bodies, trailing markup). Ported (not imported) into
 * each ledger this ruling touches, per this file's own "stands alone"
 * precedent above. */
function templateCloseLine(fullPath: string): number {
  const lines = readFileSync(fullPath, 'utf-8').split('\n');
  const matches: number[] = [];
  lines.forEach((line, idx) => {
    if (line.includes('</x-dc>')) matches.push(idx + 1);
  });
  if (matches.length !== 1) {
    throw new Error(`${fullPath}: expected exactly one </x-dc>, found ${matches.length} (lines ${matches.join(', ')})`);
  }
  return matches[0]!;
}

/** Every *.dc.html file directly under docs/design, enumerated rather than
 * named (DEC-808). */
function designFiles(): string[] {
  return readdirSync(DESIGN_ROOT, { withFileTypes: true })
    .filter((e) => e.isFile() && e.name.endsWith('.dc.html'))
    .map((e) => e.name)
    .sort();
}

function framesInFile(fileName: string): Frame[] {
  const full = join(DESIGN_ROOT, fileName);
  const relFile = relative(REPO_ROOT, full);
  const lines = readFileSync(full, 'utf-8').split('\n');

  const labelLines: { line: number; title: string }[] = [];
  const frameLineNums: number[] = [];
  lines.forEach((content, idx) => {
    const lineNo = idx + 1;
    if (isLabelLine(content)) {
      const m = content.match(LABEL_RE);
      if (m) labelLines.push({ line: lineNo, title: m[1]!.trim() });
    }
    if (isFrameLine(content)) frameLineNums.push(lineNo);
  });

  return frameLineNums.map((frameLine) => {
    // Nearest preceding label resolves the title.
    let title: string | undefined;
    for (let i = labelLines.length - 1; i >= 0; i--) {
      if (labelLines[i]!.line <= frameLine) {
        title = labelLines[i]!.title;
        break;
      }
    }
    if (title === undefined) {
      throw new Error(`${relFile}:${frameLine} -- no preceding font-size:19px label found`);
    }
    // Extent end: next label line strictly after this frame's own line, or
    // EOF -- clipped at the template's own close (DEC-967 wave-41
    // amendment) so the last labelled block can never swallow `</x-dc>`
    // and everything past it.
    const nextLabel = labelLines.find((l) => l.line > frameLine);
    return {
      file: relFile,
      fileName,
      line: frameLine,
      title,
      extentEnd: Math.min(nextLabel ? nextLabel.line : Infinity, templateCloseLine(full)),
    };
  });
}

const ALL_FRAMES: Frame[] = designFiles().flatMap(framesInFile);

const EXPECTED_PER_FILE: Record<string, number> = {
  'Chautauqua Account.dc.html': 2,
  'Chautauqua Agenda.dc.html': 1,
  'Chautauqua Comms.dc.html': 3,
  'Chautauqua Contacts.dc.html': 5,
  'Chautauqua Content.dc.html': 4,
  'Chautauqua Docs.dc.html': 1,
  'Chautauqua Home.dc.html': 3,
  'Chautauqua Overview.dc.html': 1,
  'Chautauqua Public and Portal.dc.html': 14,
  'Chautauqua Review.dc.html': 5,
  'Chautauqua Settings.dc.html': 9,
  'Chautauqua Speakers.dc.html': 2,
  'Chautauqua Submissions.dc.html': 3,
};

const EXPECTED_TOTAL = 53;

// -- Claims: every *.test.ts/*.test.tsx under test/ or app/src/ ------------

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
// (mirrors app/src/frame-citation.scan.test.ts's STRICT_RE; DEC-976).
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
 * single space, so a citation split across a wrapped comment line -- e.g.
 * "docs/design/Chautauqua Home.dc.html:\n// 33, :101" -- is still read as
 * one contiguous string, mirroring frame-citation.scan.test.ts's own
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
// Measured on this branch (v12m-w3-j, rebased off main after several w2
// citation-landing lanes merged): 11 of 53 frames are cited by an existing
// test -- not the 6 recorded when this const was first written. May only
// be RAISED in a future wave as more frames get real phone-parity
// coverage; never lowered.
export const CLAIMED_FLOOR = 53;

describe('phone-frame claim ledger (DEC-808 amendment wave 83, v12 mobile campaign)', () => {
  it('enumerates exactly 53 phone frames across 13 files (vacuous-population guard)', () => {
    const files = designFiles();
    expect(files.length).toBe(13);

    const actualPerFile: Record<string, number> = {};
    for (const frame of ALL_FRAMES) {
      actualPerFile[frame.fileName] = (actualPerFile[frame.fileName] ?? 0) + 1;
    }
    expect(actualPerFile).toEqual(EXPECTED_PER_FILE);
    expect(ALL_FRAMES.length).toBe(EXPECTED_TOTAL);
  });

  it(`claims at least CLAIMED_FLOOR (${CLAIMED_FLOOR}) of 53 frames, and never fewer than the ratchet`, () => {
    if (CLAIMS.length < CLAIMED_FLOOR) {
      const claimedKeys = new Set(CLAIMS.map((c) => `${c.frame.file}:${c.frame.line}`));
      const unclaimed = ALL_FRAMES.filter((f) => !claimedKeys.has(`${f.file}:${f.line}`)).map(
        (f) => `${f.file} :${f.line} -- ${f.title}`
      );
      throw new Error(
        `claimed ${CLAIMS.length} of ${ALL_FRAMES.length} phone frames, below the ratchet ` +
          `floor of ${CLAIMED_FLOOR}. CLAIMED_FLOOR may only be RAISED, never lowered -- ` +
          `schedule coverage for the unclaimed frames below (never shrink the floor to match ` +
          `a regression):\n${unclaimed.join('\n')}`
      );
    }
    expect(CLAIMS.length).toBeGreaterThanOrEqual(CLAIMED_FLOOR);
    // goalComplete for the v12 mobile campaign is this reaching 53 of 53.
  });

  it(`never claims MORE than CLAIMED_FLOOR (${CLAIMED_FLOOR}) without the floor being raised to match (a stale floor licenses stagnation)`, () => {
    if (CLAIMS.length > CLAIMED_FLOOR) {
      throw new Error(
        `claimed ${CLAIMS.length} of ${ALL_FRAMES.length} phone frames, above the ratchet ` +
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

  it('control (DEC-967 wave-41 amendment): a fabricated label-shaped string after the template close is excluded from a frame\'s extent, and the same shape before the close is included', () => {
    const dir = mkdtempSync(join(tmpdir(), 'template-close-synth-'));
    try {
      const fixturePath = join(dir, 'Zzy Fixture.dc.html');
      const lines = [
        '<div style="font-size:19px">Zzy Frame</span>', // line 1: label
        '<div style="width:390px; height:844px">', // line 2: frame line
        '  <span>Zzy Before Close Label</span>', // line 3: inside the frame, before close
        '</div>', // line 4
        '</x-dc>', // line 5: template close
        '<span>Zzy After Close Label</span>', // line 6: after close -- must not enter
      ];
      writeFileSync(fixturePath, lines.join('\n'));

      const closeLine = templateCloseLine(fixturePath);
      expect(closeLine).toBe(5);

      // Mirrors framesInFile's own extentEnd computation above: no next
      // label after the frame line (2), so the raw extent would run to
      // Infinity -- clipped here to the template close, exactly as the
      // production `extentEnd: Math.min(nextLabel ? nextLabel.line :
      // Infinity, templateCloseLine(full))` does.
      const frameLine = 2;
      const extentEnd = Math.min(Infinity, templateCloseLine(fixturePath));
      expect(extentEnd).toBe(5);

      const beforeLine = 3;
      const afterLine = 6;
      // POSITIVE: the before-close label sits inside the clipped extent.
      expect(beforeLine >= frameLine && beforeLine < extentEnd).toBe(true);
      // NEGATIVE: the after-close label, despite being label-shaped and in
      // the same file, sits outside the clipped extent -- exactly the
      // swallow this ruling closes (a frame's extent can never reach past
      // its own template's `</x-dc>`).
      expect(afterLine >= frameLine && afterLine < extentEnd).toBe(false);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
