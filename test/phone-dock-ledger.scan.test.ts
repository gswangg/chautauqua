// Phone dock membership ledger (DEC-976, wave-19 task w19-c).
//
// FOOTER_LABEL_CEILING (test/frame-control-label.scan.test.ts) has read 0
// for waves while the pack drew two docks the app never built -- because
// that ledger asks "does the app render this WORD somewhere in source?",
// never "does the app render EVERY word of THIS dock, in the SAME file
// that declares the dock band?" (`Add someone` was satisfied by an empty-
// column link reading "Add someone to Identified ›" -- a different control
// entirely). This ledger asks the membership question directly:
//
//   1. POPULATION, derived from the pack, never hand-listed (DEC-808): the
//      frame-enumeration grammar and the balanced `<div`/`</div>` footer
//      walk are PORTED VERBATIM from test/frame-control-label.scan.test.ts
//      (that file is itself a vitest suite -- importing it would re-execute
//      its own describe/it blocks under this file's context, so the code
//      is copied rather than imported; the shared, non-suite corpus module
//      test/frame-source-corpus.ts is imported normally). Inside each
//      frame's extent, the docked-footer signature is
//      `flex-shrink:0; border-top:1px solid #1B1D17` (deliberately shorter
//      than frame-control-label's own `background:#EFEBDF`-qualified
//      signature -- a strict superset, so every band that ledger sees this
//      one sees too, plus any that omit the background clause). Walk from
//      that signature's enclosing `<div` to the BALANCED close (a column-
//      direction dock nests rows inside itself); every `>text<` node inside
//      the balanced region is a dock label.
//
//      Measured on this branch: 41 frames carry such a band -- asserted
//      below as a vacuous-population tripwire.
//
//   2. DISCRIMINATOR, stated as such and not as an exclusion list
//      (DEC-180): a band whose body contains `list="{{ tabs }}"` is the
//      SHELL TAB BAR (the `<sc-for list="{{ tabs }}">` the pack uses for
//      the bottom-of-shell navigation, present on 7 of the 41 frames), not
//      a page dock. The remaining 34 are ACTION DOCKS and are this
//      ledger's graded population. Both counts are asserted below.
//
//   3. CLAIM: an action dock is claimed when SOME non-test file under
//      app/src/** or src/** (recursive walk via test/frame-source-corpus.ts's
//      enumerateSourceFiles -- skips any path containing `.test.`, and
//      skips src/decisions-data/** and src/decisions.ts so a ruling's own
//      prose can never satisfy the ledger it rules on, DEC-967 wave-129)
//      BOTH:
//        (a) declares a docked band -- contains `chq-phone-dock` or
//            `data-chq-phone-dock` anywhere in the file, OR (for a .css
//            file) declares a rule inside a `max-width: 700px` block whose
//            body carries `position: sticky|fixed`, `bottom: 0`, and a
//            `border-top` (the same geometry
//            app/src/phone-dock-declares.scan.test.ts's extractDockedClasses
//            derives a docked band from -- reimplemented locally here for
//            the same reason the frame walk above is copied rather than
//            imported: that file is itself a suite), AND
//        (b) renders EVERY one of that band's drawn labels, normalized
//            (comments stripped, entities decoded, whitespace collapsed)
//            and matched BOUNDARY-ANCHORED, exactly as
//            test/frame-control-label.scan.test.ts already does (via the
//            shared test/frame-source-corpus.ts normalizeSource /
//            labelIsMatched this file imports rather than reimplements).
//            Unlike that ledger's match-anywhere-in-the-corpus test, here
//            the match is scoped to the SAME candidate file for every
//            label in the band -- a dock split across a CSS file that
//            declares the geometry and a .tsx file that renders the words
//            is a real membership gap, not a pass.
//
//   4. EXCLUSIONS -- two tables in the same shape
//      test/frame-control-label.scan.test.ts already carries, each entry
//      independently asserted against the pack so a re-cut rots it loudly:
//        a. FIXTURE -- a band's own mock content wearing control geometry
//           but naming fictional pack data, not a real UI word.
//        b. COMPOSED -- the app assembles the label from parts at render
//           time (quoting the composing expression verbatim), or the
//           divergence is already BLESSED by a recorded user ruling
//           (DEVIATIONS.md §3/§6, cited by heading only -- DEVIATIONS.md
//           itself is owned by an in-flight lane this wave and is never
//           edited here).
//      Excluded labels are removed from a band's required set before the
//      claim check runs; a band whose every label is excluded is claimed
//      vacuously (the exclusion IS the explanation for why no file needs
//      to literally spell it).
//      Every row below is ported from test/frame-control-label.scan.test.ts's
//      own FIXTURE_EXCLUSIONS / COMPOSED_EXCLUSIONS tables -- same
//      file:line:label triples, independently re-verified against this
//      ledger's own band-label extraction (not merely copy-pasted) --
//      because this ledger's population is a superset of that one's footer
//      labels and the same real-world divergences recur here.
//
//   5. RATCHET, two-sided, mirroring every prior ledger in this campaign:
//      PHONE_DOCK_UNCLAIMED_CEILING is measured on this branch by forcing
//      the constant to -1 and reading the printed offender list -- never
//      `= OFFENDERS.length` or any expression naming the measured set (the
//      saturated-ratchet-lie pattern, nine-plus prior sightings). One `it`
//      fails when the offender count rises above the ceiling; a companion
//      `it` fails when it falls below, printing the exact replacement
//      line, so a stale ceiling cannot survive a wave that lands more
//      dock-membership coverage.
//
//      RATCHET: see PHONE_DOCK_UNCLAIMED_CEILING below and
//      docs/design/audit/phone-dock-membership-v12.md for the full,
//      per-offender breakdown by owning cluster. Two sibling lanes this
//      wave (v12m-w19-a Contacts Pipeline, v12m-w19-b Settings edit view)
//      drain two of these offenders in parallel; the merge train
//      re-measures the integrated tree and lowers this ceiling (never
//      raises it for a drain) once, as a merge-train act.
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { enumerateSourceFiles, labelIsMatched, normalizeSource } from './frame-source-corpus';

const HERE = dirname(fileURLToPath(import.meta.url)); // test/
const REPO_ROOT = join(HERE, '..');
const DESIGN_ROOT = join(REPO_ROOT, 'docs', 'design');
const APP_SRC_ROOT = join(REPO_ROOT, 'app', 'src');
const SRC_ROOT = join(REPO_ROOT, 'src');

// -- Population: frame enumeration, ported verbatim from
// test/frame-control-label.scan.test.ts (see that file's own header
// comment for why this is a copy, not an import: it is itself a vitest
// suite). ----------------------------------------------------------------

interface Frame {
  fileName: string;
  line: number;
  title: string;
  extentEnd: number;
}

const LABEL_SPAN_RE = />([^<]+)<\/span>/;

function isFrameLine(line: string): boolean {
  return line.includes('width:390px') && line.includes('height:844');
}

function isLabelLine(line: string): boolean {
  return line.includes('font-size:19px') && LABEL_SPAN_RE.test(line);
}

function designFiles(): string[] {
  return readdirSync(DESIGN_ROOT, { withFileTypes: true })
    .filter((e) => e.isFile() && e.name.endsWith('.dc.html'))
    .map((e) => e.name)
    .sort();
}

function framesInFile(fileName: string): Frame[] {
  const full = join(DESIGN_ROOT, fileName);
  const lines = readFileSync(full, 'utf-8').split('\n');

  const labelLines: { line: number; title: string }[] = [];
  const frameLineNums: number[] = [];
  lines.forEach((content, idx) => {
    const lineNo = idx + 1;
    if (isLabelLine(content)) {
      const m = content.match(LABEL_SPAN_RE);
      if (m) labelLines.push({ line: lineNo, title: m[1]!.trim() });
    }
    if (isFrameLine(content)) frameLineNums.push(lineNo);
  });

  return frameLineNums.map((frameLine) => {
    let title: string | undefined;
    for (let i = labelLines.length - 1; i >= 0; i--) {
      if (labelLines[i]!.line <= frameLine) {
        title = labelLines[i]!.title;
        break;
      }
    }
    if (title === undefined) {
      throw new Error(`${fileName}:${frameLine} -- no preceding font-size:19px label found`);
    }
    const nextLabel = labelLines.find((l) => l.line > frameLine);
    return {
      fileName,
      line: frameLine,
      title,
      extentEnd: nextLabel ? nextLabel.line : Infinity,
    };
  });
}

/** Walks `<div`/`</div>` tokens forward from `openStart` with a depth
 * counter to the matching balanced `</div>`, ported verbatim from
 * test/frame-control-label.scan.test.ts's balancedDivEnd. */
function balancedDivEnd(text: string, openStart: number): number {
  const re = /<(\/?)div\b/g;
  re.lastIndex = openStart;
  let depth = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    if (m[1] === '/') {
      depth--;
      if (depth === 0) {
        const closeGt = text.indexOf('>', m.index);
        if (closeGt === -1) throw new Error('unterminated </div> tag during balanced walk');
        return closeGt + 1;
      }
    } else {
      depth++;
    }
  }
  throw new Error(`balancedDivEnd: <div> at offset ${openStart} never closed`);
}

function offsetToLine(lineStartIndex: number[], offset: number): number {
  let lo = 0;
  let hi = lineStartIndex.length - 1;
  let ans = 0;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (lineStartIndex[mid]! <= offset) {
      ans = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  return ans + 1;
}

function isRealLabel(label: string): boolean {
  return label.trim().length >= 2 && !label.includes('{{');
}

// -- Dock-band extraction (this ledger's own grammar: signature is a
// deliberate SUPERSET of frame-control-label's own footer signature -- see
// header comment) ----------------------------------------------------------

const DOCK_SIGNATURE = 'flex-shrink:0; border-top:1px solid #1B1D17';
const TEXT_NODE_RE = />([^<>]+)</g;
const TABS_DISCRIMINATOR_RE = /list="\{\{ tabs \}\}"/;

export interface DockLabel {
  fileName: string;
  line: number;
  label: string;
}

export interface DockBand {
  fileName: string;
  frameLine: number;
  frameTitle: string;
  bandLine: number;
  isShellTabBar: boolean;
  labels: DockLabel[];
}

function bandsInFile(fileName: string): DockBand[] {
  const full = join(DESIGN_ROOT, fileName);
  const content = readFileSync(full, 'utf-8');
  const lines = content.split('\n');
  const lineStartIndex: number[] = [0];
  for (let i = 0; i < lines.length; i++) {
    lineStartIndex.push(lineStartIndex[i]! + lines[i]!.length + 1);
  }

  const frames = framesInFile(fileName);
  const out: DockBand[] = [];
  for (const frame of frames) {
    const startOff = lineStartIndex[frame.line - 1]!;
    const endOff = frame.extentEnd === Infinity ? content.length : lineStartIndex[frame.extentEnd - 1]!;
    const text = content.slice(startOff, endOff);

    const sigIdx = text.indexOf(DOCK_SIGNATURE);
    if (sigIdx === -1) continue;

    const divStart = text.lastIndexOf('<div', sigIdx);
    if (divStart === -1) {
      throw new Error(`${fileName}:${frame.line} -- dock signature has no enclosing <div`);
    }
    const endIdx = balancedDivEnd(text, divStart);
    const bandText = text.slice(divStart, endIdx);
    const isShellTabBar = TABS_DISCRIMINATOR_RE.test(bandText);

    TEXT_NODE_RE.lastIndex = 0;
    const labels: DockLabel[] = [];
    let tm: RegExpExecArray | null;
    while ((tm = TEXT_NODE_RE.exec(bandText))) {
      const label = tm[1]!.trim();
      if (!isRealLabel(label)) continue;
      const offset = startOff + divStart + tm.index;
      labels.push({ fileName, line: offsetToLine(lineStartIndex, offset), label });
    }

    out.push({
      fileName,
      frameLine: frame.line,
      frameTitle: frame.title,
      bandLine: offsetToLine(lineStartIndex, startOff + divStart),
      isShellTabBar,
      labels,
    });
  }
  return out;
}

const ALL_BANDS: DockBand[] = designFiles().flatMap(bandsInFile);
const SHELL_TAB_BARS = ALL_BANDS.filter((b) => b.isShellTabBar);
const ACTION_DOCKS = ALL_BANDS.filter((b) => !b.isShellTabBar);

// -- Claim side: does SOME non-test source file both declare a docked band
// and render every one of this band's (non-excluded) labels? --------------

const SOURCE_FILES = [...enumerateSourceFiles(APP_SRC_ROOT), ...enumerateSourceFiles(SRC_ROOT)];

const MAX_WIDTH_700_MEDIA_RE = /@media([^{]*)\{/g;

/** True when a .css file's text declares a rule inside a
 * `max-width: 700px` media body whose declaration carries
 * `position: sticky|fixed`, `bottom: 0`, and a `border-top` -- the same
 * geometry app/src/phone-dock-declares.scan.test.ts's extractDockedClasses
 * derives a docked band from, reimplemented locally (that file is itself a
 * suite; importing it would re-run its own describe/it blocks here). */
function hasDockGeometryRule(cssText: string): boolean {
  const stripped = cssText.replace(/\/\*[\s\S]*?\*\//g, '');
  MAX_WIDTH_700_MEDIA_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = MAX_WIDTH_700_MEDIA_RE.exec(stripped))) {
    const condition = m[1];
    const bodyStart = MAX_WIDTH_700_MEDIA_RE.lastIndex;
    let depth = 1;
    let i = bodyStart;
    for (; i < stripped.length && depth > 0; i++) {
      if (stripped[i] === '{') depth++;
      else if (stripped[i] === '}') depth--;
    }
    const body = stripped.slice(bodyStart, i - 1);
    MAX_WIDTH_700_MEDIA_RE.lastIndex = i;
    if (condition === undefined || !/max-width:\s*700px/.test(condition)) continue;
    const ruleRe = /([^{}]+)\{([^{}]*)\}/g;
    let rm: RegExpExecArray | null;
    while ((rm = ruleRe.exec(body))) {
      const ruleBody = rm[2];
      if (ruleBody === undefined) continue;
      const isStickyOrFixed = /position\s*:\s*(sticky|fixed)\b/.test(ruleBody);
      const isBottomZero = /bottom\s*:\s*0(px)?\b/.test(ruleBody);
      const hasBorderTop = /border-top\s*:/.test(ruleBody);
      if (isStickyOrFixed && isBottomZero && hasBorderTop) return true;
    }
  }
  return false;
}

function declaresDockBand(file: string, raw: string): boolean {
  if (/data-chq-phone-dock/.test(raw) || /\bchq-phone-dock\b/.test(raw)) return true;
  if (file.endsWith('.css')) return hasDockGeometryRule(raw);
  return false;
}

interface CandidateFile {
  file: string;
  normalized: string;
  declares: boolean;
}

const CANDIDATE_FILES: CandidateFile[] = SOURCE_FILES.map((f) => {
  const raw = readFileSync(f, 'utf-8');
  return { file: f, normalized: normalizeSource(raw), declares: declaresDockBand(f, raw) };
});

// -- Exclusions -------------------------------------------------------------
// (a) FIXTURE -- ported from test/frame-control-label.scan.test.ts's own
// FIXTURE_EXCLUSIONS table (same file:line:label triples; re-verified
// against this ledger's own band-label extraction, not merely copied).
const FIXTURE_EXCLUSIONS = [
  {
    fileName: 'Chautauqua Agenda.dc.html',
    line: 193,
    label: 'Docs That Answer Back',
    reason: "the Agenda frame's own mock session-title fixture, not a UI word the app renders.",
  },
  {
    fileName: 'Chautauqua Agenda.dc.html',
    line: 194,
    label: 'DFC-033 · lightning talk, 10 min',
    reason: "the Agenda frame's own mock session-code/format fixture, not a UI word the app renders.",
  },
  {
    fileName: 'Chautauqua Contacts.dc.html',
    line: 434,
    label: 'Email Priya',
    reason: "the Contacts frame's own mock quick-action fixture naming a fictional contact, not a UI word.",
  },
  {
    fileName: 'Chautauqua Public and Portal.dc.html',
    line: 464,
    label: 'Priya Raman · Latticework Systems',
    reason: "the Public/Portal frame's own mock speaker-identity fixture, not a UI word the app renders.",
  },
];

// (b) COMPOSED -- ported from test/frame-control-label.scan.test.ts's own
// COMPOSED_EXCLUSIONS table (same file:line:label triples and reasons,
// re-verified against this ledger's own band-label extraction).
const COMPOSED_EXCLUSIONS = [
  {
    fileName: 'Chautauqua Public and Portal.dc.html',
    line: 493,
    label: 'Mark the release signed',
    reason:
      "COMPOSED, DEC-613 wave-128 shared-vocabulary family: the portal tasks dock primary is rendered by `tasksPageDockPrimary` (src/routes/portal/tasks/views.tsx:411), the same shared control the row itself renders -- never a per-frame retyped copy.",
  },
  {
    fileName: 'Chautauqua Public and Portal.dc.html',
    line: 494,
    label: 'Later',
    reason:
      'BLESSED (DEVIATIONS.md §6, DEC-967 wave-106): the dock GEOMETRY is legitimate but the portal task model exposes only complete-or-not -- no snooze/defer/dismiss capability exists anywhere in the domain or route layer, so the second button\'s copy is not manufactured.',
  },
  {
    fileName: 'Chautauqua Public and Portal.dc.html',
    line: 588,
    label: 'Upload slides',
    reason:
      "COMPOSED, DEC-613 wave-128 shared-vocabulary family: `taskActionLabel(t)` ('Fill out form' / 'Upload file' / 'Open task') is the ONE shared label for every file-request task (src/routes/portal/index.tsx:128-132) -- 'Upload slides' would be wrong for every file-request task that is not slides.",
  },
  {
    fileName: 'Chautauqua Review.dc.html',
    line: 666,
    label: 'Save the plan',
    reason:
      'BLESSED (DEVIATIONS.md §3, DEC-745 wave-98): an existing plan\'s title row renders "Duplicate"/"Save"; the phone dock is a CSS-only repositioning of whichever pair the title row already renders, never a second copy of the buttons, and the frame\'s "Save the plan"/"Cancel" copy is read as the new-plan state\'s captioning.',
  },
];

function isExcluded(l: DockLabel): boolean {
  return (
    FIXTURE_EXCLUSIONS.some((e) => e.fileName === l.fileName && e.line === l.line && e.label === l.label) ||
    COMPOSED_EXCLUSIONS.some((e) => e.fileName === l.fileName && e.line === l.line && e.label === l.label)
  );
}

interface DockOffender {
  band: DockBand;
  remaining: DockLabel[];
}

function isBandClaimed(band: DockBand): boolean {
  const remaining = band.labels.filter((l) => !isExcluded(l));
  if (remaining.length === 0) return true;
  return CANDIDATE_FILES.some(
    (cf) => cf.declares && remaining.every((l) => labelIsMatched(l.label, [cf.normalized]))
  );
}

const UNCLAIMED: DockOffender[] = ACTION_DOCKS.filter((b) => !isBandClaimed(b)).map((band) => ({
  band,
  remaining: band.labels.filter((l) => !isExcluded(l)),
}));

// Measured on this branch by forcing this const to -1 and reading the
// printed offender list -- never `= UNCLAIMED.length` or any expression
// naming the measured set (the saturated-ratchet-lie pattern).
export const PHONE_DOCK_UNCLAIMED_CEILING = 13;

describe('phone dock membership ledger (DEC-976, v12 mobile campaign)', () => {
  it('non-vacuity: 41 frames carry a dock-shaped footer band, 7 are shell tab bars, 34 are action docks', () => {
    expect(ALL_BANDS.length).toBe(41);
    expect(SHELL_TAB_BARS.length).toBe(7);
    expect(ACTION_DOCKS.length).toBe(34);
    expect(SOURCE_FILES.length).toBeGreaterThanOrEqual(100);
  });

  it('non-vacuity: synthetic positive/negative controls over a fabricated single-band fixture', () => {
    const fabricatedBandText = [
      '<div style="flex-shrink:0; border-top:1px solid #1B1D17; display:flex; flex-direction:column">',
      '  <div style="display:flex">',
      '    <span>Zzy Synthetic Present</span>',
      '    <span>Zzy Synthetic Absent</span>',
      '  </div>',
      '</div>',
    ].join('\n');
    TEXT_NODE_RE.lastIndex = 0;
    const found: string[] = [];
    let m: RegExpExecArray | null;
    while ((m = TEXT_NODE_RE.exec(fabricatedBandText))) {
      const label = m[1]!.trim();
      if (isRealLabel(label)) found.push(label);
    }
    expect(found).toContain('Zzy Synthetic Present');
    expect(found).toContain('Zzy Synthetic Absent');

    const fabricatedSource = [
      '// mentions Zzy Synthetic Absent in a comment only, must not satisfy it',
      'export function Fixture() { return <div className="chq-phone-dock">Zzy Synthetic Present</div>; }',
    ].join('\n');
    expect(declaresDockBand('fixture.tsx', fabricatedSource)).toBe(true);
    const normalized = normalizeSource(fabricatedSource);
    expect(labelIsMatched('Zzy Synthetic Present', [normalized])).toBe(true);
    expect(labelIsMatched('Zzy Synthetic Absent', [normalized])).toBe(false);
  });

  it('tabs discriminator: the shell tab bar band is present in every one of its 7 frames', () => {
    for (const b of SHELL_TAB_BARS) {
      expect(TABS_DISCRIMINATOR_RE.test('list="{{ tabs }}"')).toBe(true);
      expect(b.isShellTabBar).toBe(true);
    }
  });

  it('FIXTURE exclusions each resolve to their cited file:line:label in the current pack', () => {
    const allLabels = ACTION_DOCKS.flatMap((b) => b.labels);
    for (const e of FIXTURE_EXCLUSIONS) {
      const hit = allLabels.find((l) => l.fileName === e.fileName && l.line === e.line && l.label === e.label);
      expect(hit, `${e.fileName}:${e.line} -- "${e.label}" no longer resolves in the pack`).toBeDefined();
    }
  });

  it('COMPOSED exclusions each resolve to their cited file:line:label in the current pack', () => {
    const allLabels = ACTION_DOCKS.flatMap((b) => b.labels);
    for (const e of COMPOSED_EXCLUSIONS) {
      const hit = allLabels.find((l) => l.fileName === e.fileName && l.line === e.line && l.label === e.label);
      expect(hit, `${e.fileName}:${e.line} -- "${e.label}" no longer resolves in the pack`).toBeDefined();
    }
  });

  it(`never exceeds PHONE_DOCK_UNCLAIMED_CEILING (${PHONE_DOCK_UNCLAIMED_CEILING}) unclaimed action docks`, () => {
    if (UNCLAIMED.length > PHONE_DOCK_UNCLAIMED_CEILING) {
      const offenders = UNCLAIMED.map(
        (o) =>
          `${o.band.fileName}:${o.band.bandLine} -- frame "${o.band.frameTitle}" (frame line ${o.band.frameLine}) -- ` +
          `unclaimed labels: ${o.remaining.map((l) => `${l.line}:"${l.label}"`).join(', ')}`
      );
      throw new Error(
        `${UNCLAIMED.length} action docks have no single non-test source file that both declares a docked band ` +
          `and renders every one of their labels, above the ceiling of ${PHONE_DOCK_UNCLAIMED_CEILING}. ` +
          `PHONE_DOCK_UNCLAIMED_CEILING may only be RAISED (a merge-train act, never a worker's edit mid-lane), ` +
          `and only once re-measured. Offenders:\n${offenders.join('\n')}`
      );
    }
    expect(UNCLAIMED.length).toBeLessThanOrEqual(PHONE_DOCK_UNCLAIMED_CEILING);
  });

  it(`never sits BELOW PHONE_DOCK_UNCLAIMED_CEILING (${PHONE_DOCK_UNCLAIMED_CEILING}) without the ceiling being lowered to match (a stale ceiling licenses stagnation)`, () => {
    if (UNCLAIMED.length < PHONE_DOCK_UNCLAIMED_CEILING) {
      throw new Error(
        `${UNCLAIMED.length} action docks are unclaimed, below the ceiling of ${PHONE_DOCK_UNCLAIMED_CEILING}. ` +
          `This is the ratchet working: coverage landed. Lower the ceiling in the same commit (a merge-train act) ` +
          `by replacing the line:\n  export const PHONE_DOCK_UNCLAIMED_CEILING = ${UNCLAIMED.length};`
      );
    }
    expect(UNCLAIMED.length).toBeGreaterThanOrEqual(PHONE_DOCK_UNCLAIMED_CEILING);
  });
});
