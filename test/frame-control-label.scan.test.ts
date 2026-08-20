// Frame control-label ledger (DEC-976/DEC-967 wave-128; task w3-j).
//
// Every prior ledger asks "is this SCREEN cited by some test?"
// (phone-frame-ledger.scan.test.ts, desktop-frame-ledger.scan.test.ts) or "is
// this CITATION true?" (frame-citation.scan.test.ts). None of them asks
// whether the app renders the WORDS the frames print on their buttons and
// footer tabs -- the uninstrumented dimension named in the wave-128 field
// guide entry. This scan derives that population directly from the pack,
// never a hand-listed file list (DEC-808):
//
//   1. POPULATION (ported verbatim from phone-frame-ledger.scan.test.ts's own
//      frame-enumeration idiom): readdirSync docs/design for *.dc.html. A
//      frame opens on any line carrying both `width:390px` and `height:844`;
//      its title is the nearest preceding `font-size:19px ... >TITLE</span>`
//      label; its extent runs to the next such label, or EOF.
//
//      Inside each frame's extent, two kinds of control label:
//        a. FOOTER LABELS -- find the docked-footer signature
//           `flex-shrink:0; border-top:1px solid #1B1D17; background:#EFEBDF`,
//           back up to that div's own opening `<div`, then walk `<div`/`</div>`
//           tokens forward with a depth counter to the BALANCED close (a
//           column-direction footer nests rows inside itself; stopping at the
//           first `</div>` would truncate the region). Every `>text<` node
//           inside the balanced region is a footer label.
//        b. ANCHOR LABELS -- every `<a ...min-height:44px...>LABEL</a>`
//           anywhere in the frame's extent.
//      Both kinds drop labels shorter than 2 chars after trim, and any
//      label containing `{{` (a template interpolation, not a literal
//      word the app renders -- same exclusion the desktop ledger already
//      applies to its own population, DEC-976 wave-99).
//
//   2. MATCH: every non-test .ts/.tsx/.css file under app/src/** and src/**
//      (readdirSync recursive, skipping any path containing `.test.`) is
//      normalized -- comments stripped (so prose merely QUOTING a label
//      cannot satisfy the ledger, DEC-967 wave-128 clause 4), HTML entities
//      decoded (so the source's literal `&lsaquo;` matches the frame's
//      literal `‹`), whitespace collapsed. A label matches when it occurs
//      verbatim, after the same whitespace-collapse, in some normalized file.
//
//   3. EXCLUSIONS -- two tables, each entry independently asserted against
//      the pack by exact file:line:label so a re-cut of the pack rots the
//      list loudly (the desktop ledger's own explainer-panel idiom,
//      test/desktop-frame-ledger.scan.test.ts:199-212):
//        a. FIXTURE -- a frame's own mock content wearing control geometry
//           (a demo card styled like a footer/anchor but naming fictional
//           pack data, not a real UI word).
//        b. COMPOSED -- the app assembles the label from parts (a shared
//           component + a prop, a template literal, a counter function), so
//           the literal frame string never appears verbatim in source even
//           though the rendered DOM is correct. Each reason quotes the
//           composing expression verbatim.
//
//   4. RATCHET, two-sided, mirroring every prior ledger in this campaign:
//      FOOTER_LABEL_CEILING is a single exported const, hand-measured on
//      this branch by forcing it to -1 and reading the printed offender
//      list -- never `= UNMATCHED.length` or any expression naming the
//      measured set (the ninth saturated-ratchet-lie pattern named in the
//      wave-128 field guide: the bound must never equal the measurement for
//      every possible tree). One `it` fails when the offender count rises
//      above the ceiling; a companion `it` fails when it falls below,
//      printing the exact replacement line, so a stale ceiling cannot survive
//      a wave that lands more label coverage.
//
//      RATCHET: FOOTER_LABEL_CEILING=4, re-measured on the integrated tree
//      by the wave-128/129 merge train (was 6). Lanes draining this same
//      control-label population (composing the remaining literal strings, or
//      adding the missing renders) land mid-wave; the merge-train re-measures
//      the INTEGRATED tree once every lane is in and moves the ceiling to the
//      measured count then, not mid-lane (DEC-989 wave-123).
//
// This file names the app's uninstrumented control-label gap; it does not
// close it -- that is scheduled work for the lanes above, not this ledger.
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const HERE = dirname(fileURLToPath(import.meta.url)); // test/
const REPO_ROOT = join(HERE, '..');
const DESIGN_ROOT = join(REPO_ROOT, 'docs', 'design');
const APP_SRC_ROOT = join(REPO_ROOT, 'app', 'src');
const SRC_ROOT = join(REPO_ROOT, 'src');

// -- Population: every width:390/height:844 phone frame in docs/design -----
// (identical grammar to test/phone-frame-ledger.scan.test.ts's own Frame
// population, ported rather than imported so this file stands alone.)

interface Frame {
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

const LABEL_SPAN_RE = />([^<]+)<\/span>/;

function isFrameLine(line: string): boolean {
  return line.includes('width:390px') && line.includes('height:844');
}

function isLabelLine(line: string): boolean {
  return line.includes('font-size:19px') && LABEL_SPAN_RE.test(line);
}

/** Every *.dc.html file directly under docs/design, enumerated rather than
 * named (DEC-808). */
export function designFiles(): string[] {
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

// -- Control-label extraction ------------------------------------------------

export interface ControlLabel {
  fileName: string;
  /** 1-based line the label's own text node sits on (not the frame's line). */
  line: number;
  label: string;
  kind: 'footer' | 'anchor';
  frameTitle: string;
  frameLine: number;
}

const FOOTER_SIGNATURE = 'flex-shrink:0; border-top:1px solid #1B1D17; background:#EFEBDF';
const FOOTER_TEXT_NODE_RE = />([^<>]+)</g;
const ANCHOR_RE = /<a\b[^>]*min-height:44px[^>]*>([^<]+)<\/a>/g;

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

/** Walks `<div`/`</div>` tokens forward from `openStart` (which must be the
 * index of a `<div` opening-tag start) with a depth counter, returning the
 * index just past the matching balanced `</div>`'s own `>`. A column-
 * direction footer nests rows inside itself, so stopping at the first
 * `</div>` would truncate the region -- this walk does not stop early. */
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

/** Extracts every footer/anchor control label from one frame's raw text
 * extent. Exported so the non-vacuity synthetic controls below can drive
 * this exact function over a fabricated fixture, never a real product
 * token. `lineStartIndex`/`baseOffset` let callers map back to real file
 * line numbers; a synthetic caller can pass a trivial identity mapping. */
export function labelsInFrameText(
  text: string,
  lineStartIndex: number[],
  baseOffset: number
): { label: string; kind: 'footer' | 'anchor'; offset: number }[] {
  const out: { label: string; kind: 'footer' | 'anchor'; offset: number }[] = [];

  let sigIdx = text.indexOf(FOOTER_SIGNATURE);
  while (sigIdx !== -1) {
    const divStart = text.lastIndexOf('<div', sigIdx);
    if (divStart === -1) {
      throw new Error(`footer signature at offset ${sigIdx} has no enclosing <div`);
    }
    const endIdx = balancedDivEnd(text, divStart);
    const footerText = text.slice(divStart, endIdx);
    FOOTER_TEXT_NODE_RE.lastIndex = 0;
    let tm: RegExpExecArray | null;
    while ((tm = FOOTER_TEXT_NODE_RE.exec(footerText))) {
      const label = tm[1]!.trim();
      if (isRealLabel(label)) {
        out.push({ label, kind: 'footer', offset: divStart + tm.index });
      }
    }
    sigIdx = text.indexOf(FOOTER_SIGNATURE, endIdx);
  }

  ANCHOR_RE.lastIndex = 0;
  let am: RegExpExecArray | null;
  while ((am = ANCHOR_RE.exec(text))) {
    const label = am[1]!.trim();
    if (isRealLabel(label)) {
      out.push({ label, kind: 'anchor', offset: am.index });
    }
  }

  return out;
}

function controlLabelsInFile(fileName: string): ControlLabel[] {
  const full = join(DESIGN_ROOT, fileName);
  const content = readFileSync(full, 'utf-8');
  const lines = content.split('\n');
  const lineStartIndex: number[] = [0];
  for (let i = 0; i < lines.length; i++) {
    lineStartIndex.push(lineStartIndex[i]! + lines[i]!.length + 1);
  }

  const frames = framesInFile(fileName);
  const out: ControlLabel[] = [];
  for (const frame of frames) {
    const startOff = lineStartIndex[frame.line - 1]!;
    const endOff = frame.extentEnd === Infinity ? content.length : lineStartIndex[frame.extentEnd - 1]!;
    const text = content.slice(startOff, endOff);
    const raw = labelsInFrameText(text, lineStartIndex, startOff);
    for (const r of raw) {
      out.push({
        fileName,
        line: offsetToLine(lineStartIndex, startOff + r.offset),
        label: r.label,
        kind: r.kind,
        frameTitle: frame.title,
        frameLine: frame.line,
      });
    }
  }
  return out;
}

const ALL_LABELS: ControlLabel[] = designFiles().flatMap(controlLabelsInFile);

// -- Match side: every non-test .ts/.tsx/.css under app/src/** and src/** --

function isSourceFile(name: string): boolean {
  return name.endsWith('.ts') || name.endsWith('.tsx') || name.endsWith('.css');
}

/** Every .ts/.tsx/.css file under `root`, skipping any path containing
 * `.test.`, enumerated via readdirSync rather than named (DEC-808). */
function enumerateSourceFiles(root: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(root, { withFileTypes: true, recursive: true })) {
    if (!entry.isFile() || !isSourceFile(entry.name)) continue;
    const full = join(entry.parentPath, entry.name);
    if (full.includes('.test.')) continue;
    out.push(full);
  }
  return out.sort();
}

const ENTITY_MAP: Record<string, string> = {
  '&lsaquo;': '‹',
  '&rsaquo;': '›',
  '&middot;': '·',
  '&nbsp;': ' ',
  '&amp;': '&',
  '&mdash;': '—',
  '&ndash;': '–',
  '&rsquo;': '’',
  '&hellip;': '…',
};

/** Strips comments (block and line), decodes the frame-pack's HTML entities,
 * and collapses whitespace runs to a single space -- DEC-967 wave-128
 * clause 4. Exported so the synthetic non-vacuity controls exercise the
 * exact normalization the real match side uses. */
export function normalizeSource(raw: string): string {
  let s = raw.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/[^\n]*/g, ' ');
  for (const [entity, char] of Object.entries(ENTITY_MAP)) {
    s = s.split(entity).join(char);
  }
  return s.replace(/\s+/g, ' ');
}

/** True when `label` (whitespace-collapsed) occurs verbatim in some already-
 * normalized source blob. Exported so the synthetic controls drive this
 * exact function over a fabricated population. */
export function labelIsMatched(label: string, normalizedBlobs: string[]): boolean {
  const needle = label.replace(/\s+/g, ' ').trim();
  return normalizedBlobs.some((blob) => blob.includes(needle));
}

const SOURCE_FILES = [...enumerateSourceFiles(APP_SRC_ROOT), ...enumerateSourceFiles(SRC_ROOT)];
const NORMALIZED_SOURCE_BLOBS: string[] = SOURCE_FILES.map((f) => normalizeSource(readFileSync(f, 'utf-8')));

const UNMATCHED_RAW: ControlLabel[] = ALL_LABELS.filter((l) => !labelIsMatched(l.label, NORMALIZED_SOURCE_BLOBS));

// -- Exclusions ---------------------------------------------------------------
// (a) FIXTURE -- a frame's own mock content wearing control geometry, not a
// real UI word. Each entry asserted below to still resolve to its cited
// line/label so a pack re-cut rots this list loudly.
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

// (b) COMPOSED -- the app assembles the label from parts at render time, so
// the literal frame string never appears verbatim in source even though the
// rendered DOM is correct. Reason quotes the composing expression verbatim.
const COMPOSED_EXCLUSIONS = [
  {
    fileName: 'Chautauqua Public and Portal.dc.html',
    line: 478,
    label: '‹ Your portal',
    reason: 'PortalBackLink composes `&lsaquo; {portalBackLinkLabel(props.to)}` (src/routes/portal/shared.tsx).',
  },
  {
    fileName: 'Chautauqua Public and Portal.dc.html',
    line: 507,
    label: '‹ Your portal',
    reason: 'PortalBackLink composes `&lsaquo; {portalBackLinkLabel(props.to)}` (src/routes/portal/shared.tsx).',
  },
  {
    fileName: 'Chautauqua Public and Portal.dc.html',
    line: 533,
    label: '‹ Your portal',
    reason: 'PortalBackLink composes `&lsaquo; {portalBackLinkLabel(props.to)}` (src/routes/portal/shared.tsx).',
  },
  {
    fileName: 'Chautauqua Public and Portal.dc.html',
    line: 565,
    label: '‹ Your portal',
    reason: 'PortalBackLink composes `&lsaquo; {portalBackLinkLabel(props.to)}` (src/routes/portal/shared.tsx).',
  },
  {
    fileName: 'Chautauqua Public and Portal.dc.html',
    line: 1563,
    label: '‹ Your portal',
    reason: 'PortalBackLink composes `&lsaquo; {portalBackLinkLabel(props.to)}` (src/routes/portal/shared.tsx).',
  },
  {
    fileName: 'Chautauqua Public and Portal.dc.html',
    line: 602,
    label: '‹ Your session',
    reason: 'PortalBackLink composes `&lsaquo; {portalBackLinkLabel(props.to)}` (src/routes/portal/shared.tsx).',
  },
  {
    fileName: 'Chautauqua Public and Portal.dc.html',
    line: 1306,
    label: '‹ Your session',
    reason: 'PortalBackLink composes `&lsaquo; {portalBackLinkLabel(props.to)}` (src/routes/portal/shared.tsx).',
  },
  {
    fileName: 'Chautauqua Contacts.dc.html',
    line: 524,
    label: '‹ Duplicates',
    reason:
      "MergePage.tsx's phone-hidden prefix span composes the `‹ Duplicates` back link (no `Contacts ·` prefix on phone).",
  },
  {
    fileName: 'Chautauqua Submissions.dc.html',
    line: 358,
    label: '‹ Triage',
    reason: '.chq-detail-back-short (app/src/pages/submissions/SubmissionDetailPage.tsx) composes the short back label.',
  },
  {
    fileName: 'Chautauqua Content.dc.html',
    line: 279,
    label: 'Approve 2',
    reason: "countOf-built `Approve {selectedIds.size}` (app/src/pages/content/SessionList.tsx) composes the count.",
  },
  {
    fileName: 'Chautauqua Content.dc.html',
    line: 256,
    label: 'All 5',
    reason: 'countOf-built `All {items.length}` (app/src/pages/content/ContentApp.tsx) composes the count.',
  },
  {
    fileName: 'Chautauqua Review.dc.html',
    line: 283,
    label: '‹ Wave 2 queue',
    reason: "the scorecard's `&lsaquo; {plan.name} queue` (app/src/pages/review/Scorecard.tsx) composes the plan name.",
  },
  {
    fileName: 'Chautauqua Review.dc.html',
    line: 936,
    label: '‹ Wave 2 queue',
    reason: "the scorecard's `&lsaquo; {plan.name} queue` (app/src/pages/review/Scorecard.tsx) composes the plan name.",
  },
];

function excluded(l: ControlLabel): boolean {
  return (
    FIXTURE_EXCLUSIONS.some((e) => e.fileName === l.fileName && e.line === l.line && e.label === l.label) ||
    COMPOSED_EXCLUSIONS.some((e) => e.fileName === l.fileName && e.line === l.line && e.label === l.label)
  );
}

const UNMATCHED: ControlLabel[] = UNMATCHED_RAW.filter((l) => !excluded(l));

// -- Ratchet -------------------------------------------------------------
// Measured on this branch (v12m-w3-j) by forcing this const to -1 and
// reading the printed offender list: 4 labels survive both normalization and
// the two exclusion tables above -- real frame/app divergences, not fixture
// noise or a composed-at-render label. Re-measured on the integrated tree by
// the wave-128/129 merge train (DEC-989 wave-123): was 6; the TaskFormPage
// submit-label lane (v12m-w4-m, TASK_FORM_SUBMIT_LABEL) drained two, so the
// ceiling drops to the measured 4.
export const FOOTER_LABEL_CEILING = 4;

describe('frame control-label ledger (DEC-976/DEC-967 wave-128, v12 mobile campaign)', () => {
  it('non-vacuity: population is large and spans many frames and many source files', () => {
    expect(ALL_LABELS.length).toBeGreaterThan(60);
    const distinctFrames = new Set(ALL_LABELS.map((l) => `${l.fileName}:${l.frameLine}`));
    expect(distinctFrames.size).toBeGreaterThanOrEqual(8);
    expect(SOURCE_FILES.length).toBeGreaterThanOrEqual(100);
  });

  it('non-vacuity: synthetic positive/negative controls over a fabricated single-file population', () => {
    // A fabricated frame extent -- never a real product token -- wearing
    // exactly the two control shapes this scan looks for.
    const fabricatedFrameText = [
      '<div style="display:flex; flex-direction:column">',
      '  <a href="#" style="min-height:44px; display:flex">‹ Zzy Synthetic Anchor</a>',
      '  <div style="flex-shrink:0; border-top:1px solid #1B1D17; background:#EFEBDF; display:flex">',
      '    <div style="flex:1">',
      '      <span>Zzy Synthetic Present</span>',
      '      <span>Zzy Synthetic Absent</span>',
      '    </div>',
      '  </div>',
      '</div>',
    ].join('\n');

    const extracted = labelsInFrameText(fabricatedFrameText, [0], 0);
    const extractedLabels = extracted.map((e) => e.label);
    expect(extractedLabels).toContain('‹ Zzy Synthetic Anchor');
    expect(extractedLabels).toContain('Zzy Synthetic Present');
    expect(extractedLabels).toContain('Zzy Synthetic Absent');

    // Fabricated single-file "source" population: contains the PRESENT
    // control, wrapped in a comment that must be stripped before matching,
    // and using the entity form of the anchor's leading character.
    const fabricatedSource = [
      '// this comment mentions Zzy Synthetic Absent and must not satisfy it',
      'const label = "Zzy Synthetic Present";',
      'const back = "&lsaquo; Zzy Synthetic Anchor";',
    ].join('\n');
    const normalized = [normalizeSource(fabricatedSource)];

    // POSITIVE: present in (normalized, comment-stripped, entity-decoded)
    // source is flagged as matched.
    expect(labelIsMatched('Zzy Synthetic Present', normalized)).toBe(true);
    expect(labelIsMatched('‹ Zzy Synthetic Anchor', normalized)).toBe(true);

    // NEGATIVE: absent from real code (only inside a stripped comment) is
    // correctly flagged as unmatched.
    expect(labelIsMatched('Zzy Synthetic Absent', normalized)).toBe(false);
  });

  it('FIXTURE exclusions each resolve to their cited file:line:label in the current pack', () => {
    for (const e of FIXTURE_EXCLUSIONS) {
      const hit = ALL_LABELS.find((l) => l.fileName === e.fileName && l.line === e.line && l.label === e.label);
      expect(hit, `${e.fileName}:${e.line} -- "${e.label}" no longer resolves in the pack`).toBeDefined();
    }
  });

  it('COMPOSED exclusions each resolve to their cited file:line:label in the current pack', () => {
    for (const e of COMPOSED_EXCLUSIONS) {
      const hit = ALL_LABELS.find((l) => l.fileName === e.fileName && l.line === e.line && l.label === e.label);
      expect(hit, `${e.fileName}:${e.line} -- "${e.label}" no longer resolves in the pack`).toBeDefined();
    }
  });

  it(`never exceeds FOOTER_LABEL_CEILING (${FOOTER_LABEL_CEILING}) unmatched control labels`, () => {
    if (UNMATCHED.length > FOOTER_LABEL_CEILING) {
      const offenders = UNMATCHED.map(
        (l) => `${l.fileName}:${l.line} -- "${l.label}" (frame: ${l.frameTitle})`
      );
      throw new Error(
        `${UNMATCHED.length} control labels are unmatched by any app source file, above the ceiling of ` +
          `${FOOTER_LABEL_CEILING}. FOOTER_LABEL_CEILING may only be RAISED (a merge-train act, never a ` +
          `worker's edit mid-lane), and only once new exclusions or coverage are landed and re-measured. ` +
          `Offenders:\n${offenders.join('\n')}`
      );
    }
    expect(UNMATCHED.length).toBeLessThanOrEqual(FOOTER_LABEL_CEILING);
  });

  it(`never sits BELOW FOOTER_LABEL_CEILING (${FOOTER_LABEL_CEILING}) without the ceiling being lowered to match (a stale ceiling licenses stagnation)`, () => {
    if (UNMATCHED.length < FOOTER_LABEL_CEILING) {
      throw new Error(
        `${UNMATCHED.length} control labels are unmatched, below the ceiling of ${FOOTER_LABEL_CEILING}. ` +
          `This is the ratchet working: coverage landed. Lower the ceiling in the same commit (a merge-train ` +
          `act) by replacing the line:\n  export const FOOTER_LABEL_CEILING = ${UNMATCHED.length};`
      );
    }
    expect(UNMATCHED.length).toBeGreaterThanOrEqual(FOOTER_LABEL_CEILING);
  });
});
