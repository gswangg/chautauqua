// Frame control-label ledger (DEC-976/DEC-967 wave-128, wave-129 amendment;
// task w3-j, closed by task w4-l).
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
//      Inside each frame's extent, three kinds of control label:
//        a. FOOTER LABELS -- find the docked-footer signature
//           `flex-shrink:0; border-top:1px solid #1B1D17; background:#EFEBDF`,
//           back up to that div's own opening `<div`, then walk `<div`/`</div>`
//           tokens forward with a depth counter to the BALANCED close (a
//           column-direction footer nests rows inside itself; stopping at the
//           first `</div>` would truncate the region). Every `>text<` node
//           inside the balanced region is a footer label.
//        b. ANCHOR LABELS -- every `<a ...min-height:44px...>LABEL</a>`
//           anywhere in the frame's extent.
//        c. PAINTED-SPAN LABELS (DEC-976 wave-129 amendment (b)) -- every
//           `<span ...>LABEL</span>` whose attribute string carries ALL of
//           `min-height:4[468]px`, `border-radius`, and (`border:1px` OR
//           `background:#4E5C31`) -- a real control FACE drawn as a span
//           outside any footer. A bare `<span min-height:44px>` chip with no
//           painted face stays OUT -- the 283-hit data-chip noise the
//           wave-128 field guide already measured and rejected. Deduped by
//           source offset against the footer walk's own offsets so a footer
//           row wearing a painted face is never counted twice.
//      Both of (a)/(b) drop labels shorter than 2 chars after trim, and any
//      label containing `{{` (a template interpolation, not a literal
//      word the app renders -- same exclusion the desktop ledger already
//      applies to its own population, DEC-976 wave-99).
//
//   2. MATCH: every non-test .ts/.tsx/.css file under app/src/** and src/**
//      (readdirSync recursive, skipping any path containing `.test.`, and
//      skipping src/decisions-data/** and src/decisions.ts -- DEC-976
//      wave-129 amendment (c): the decision registry's own `DEC_NNN`
//      constants are English sentences that quote frame labels verbatim, so
//      a ruling's own prose satisfying the ledger it rules on is DEC-967's
//      "a ledger a comment can satisfy is not a ledger", one level out) is
//      normalized -- comments stripped (so prose merely QUOTING a label
//      cannot satisfy the ledger, DEC-967 wave-128 clause 4), HTML entities
//      decoded (so the source's literal `&lsaquo;` matches the frame's
//      literal `‹`), whitespace collapsed. A label matches when it occurs,
//      after the same whitespace-collapse, BOUNDARY-ANCHORED in some
//      normalized file (DEC-976 wave-129 amendment (a)): preceded by
//      start-of-blob, whitespace, or one of `> " ' \` { ( , :`, and followed
//      by end-of-blob, whitespace, or one of `< " ' \` } ) ( ; , . ! ? {` --
//      a bare substring test let a short label like `Wait` be "matched" by
//      any longer word merely containing it (`Waitlist`), which is exactly
//      the divergence the frame draws.
//
//   3. EXCLUSIONS -- two tables, each entry independently asserted against
//      the pack by exact file:line:label so a re-cut of the pack rots the
//      list loudly (the desktop ledger's own explainer-panel idiom,
//      test/desktop-frame-ledger.scan.test.ts:199-212):
//        a. FIXTURE -- a frame's own mock content wearing control geometry
//           (a demo card styled like a footer/anchor but naming fictional
//           pack data, not a real UI word).
//        b. COMPOSED -- the app assembles the label from parts (a shared
//           component + a prop, a template literal, a counter function,
//           including a live count/name over a shared vocabulary --
//           COMPOSED-from-data), so the literal frame string never appears
//           verbatim in source even though the rendered DOM is correct; or
//           the divergence is already BLESSED by a recorded user ruling
//           (DEVIATIONS.md §3 or §6, cited by section heading only --
//           DEVIATIONS.md itself is owned by an in-flight lane this wave and
//           is never edited here). Each reason quotes the composing
//           expression verbatim, or the blessing citation.
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
//      RATCHET: FOOTER_LABEL_CEILING=7 (raised from wave-128's 6). This is
//      NOT a regression -- the PREDICATE tightened (boundary-anchored
//      matching, the painted-span population, and the decision-registry
//      corpus exclusion together widen what the ledger can see) so the
//      population of real divergences the ledger reports grew from 6 to 7;
//      the tree itself did not get worse. Sibling lanes v12m-w4-m/n/o/p/q/r/s
//      close all seven surviving rows this wave (`See the recipients`,
//      `+ Rule`, `Place the other six ›`, `Send this in`, `Read the full
//      submission`, `Copy link`, `Wait`); the merge-train re-measures the
//      INTEGRATED tree once every lane lands and lowers the ceiling then,
//      not mid-lane (DEC-989 wave-123).
//
// This file names the app's uninstrumented control-label gap; it does not
// close it -- that is scheduled work for the lanes above, not this ledger.
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { enumerateSourceFiles, labelIsMatched, normalizeSource } from './frame-source-corpus';

export { labelIsMatched, normalizeSource };

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
  kind: 'footer' | 'anchor' | 'span';
  frameTitle: string;
  frameLine: number;
}

const FOOTER_SIGNATURE = 'flex-shrink:0; border-top:1px solid #1B1D17; background:#EFEBDF';
const FOOTER_TEXT_NODE_RE = />([^<>]+)</g;
const ANCHOR_RE = /<a\b[^>]*min-height:44px[^>]*>([^<]+)<\/a>/g;

// Painted-span controls (DEC-976 wave-129 amendment (b)): the frames also
// draw real controls as a <span> carrying a control FACE outside any
// footer. A bare `<span min-height:44px>` chip with no painted face stays
// OUT -- that is the 283-hit data-chip noise the wave-128 field guide
// already measured and rejected (`Slides · 22`, `Tue 12`, `Identified · 7`).
const SPAN_RE = /<span\b([^>]*)>([^<]+)<\/span>/g;
const SPAN_MIN_HEIGHT_RE = /min-height:4[468]px/;
const SPAN_BORDER_RADIUS_RE = /border-radius/;
const SPAN_BORDER_RE = /border:1px/;
const SPAN_BACKGROUND_RE = /background:#4E5C31/;

function isPaintedSpanFace(attrs: string): boolean {
  return (
    SPAN_MIN_HEIGHT_RE.test(attrs) &&
    SPAN_BORDER_RADIUS_RE.test(attrs) &&
    (SPAN_BORDER_RE.test(attrs) || SPAN_BACKGROUND_RE.test(attrs))
  );
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
): { label: string; kind: 'footer' | 'anchor' | 'span'; offset: number }[] {
  const out: { label: string; kind: 'footer' | 'anchor' | 'span'; offset: number }[] = [];
  // Offsets (of the text node's own leading `>`) already collected by the
  // footer walk -- the span walk dedupes against this set so a footer row
  // wearing a painted span face is never counted twice (the planner's
  // prototype double-counted every footer row; that is the bug to avoid).
  const footerOffsets = new Set<number>();

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
      const offset = divStart + tm.index;
      if (isRealLabel(label)) {
        out.push({ label, kind: 'footer', offset });
        footerOffsets.add(offset);
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

  SPAN_RE.lastIndex = 0;
  let sm: RegExpExecArray | null;
  while ((sm = SPAN_RE.exec(text))) {
    const attrs = sm[1]!;
    if (!isPaintedSpanFace(attrs)) continue;
    const label = sm[2]!.trim();
    if (!isRealLabel(label)) continue;
    const openTagEnd = text.indexOf('>', sm.index);
    if (openTagEnd === -1) {
      throw new Error(`span at offset ${sm.index} has no closing '>' on its opening tag`);
    }
    if (footerOffsets.has(openTagEnd)) continue;
    out.push({ label, kind: 'span', offset: openTagEnd });
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
// rendered DOM is correct (including the COMPOSED-from-data subclass -- a
// day pill, room name, or stage/kind chip built from a shared label
// vocabulary plus a live count/name, never the frame's fixed numeral), or
// the divergence is already BLESSED by a recorded user ruling (DEVIATIONS.md
// §3 or §6, cited by section heading only -- DEVIATIONS.md itself is owned
// by an in-flight lane this wave and is never edited here). Reason quotes
// the composing expression verbatim, or the blessing citation.
const COMPOSED_EXCLUSIONS = [
  {
    fileName: 'Chautauqua Agenda.dc.html',
    line: 136,
    label: 'Wed 13',
    reason:
      "COMPOSED-from-data: formatDayLabel(day)/roomLabel-style day-pill helpers compose the weekday+day-of-month pill from the live schedule day, never the frame's fixed date (app/src/pages/agenda/PhoneAgenda.tsx `dayLabel`, app/src/lib/dates.ts `formatDayLabel`).",
  },
  {
    fileName: 'Chautauqua Agenda.dc.html',
    line: 137,
    label: 'Thu 14',
    reason:
      "COMPOSED-from-data: formatDayLabel(day)/roomLabel-style day-pill helpers compose the weekday+day-of-month pill from the live schedule day, never the frame's fixed date (app/src/pages/agenda/PhoneAgenda.tsx `dayLabel`, app/src/lib/dates.ts `formatDayLabel`).",
  },
  {
    fileName: 'Chautauqua Agenda.dc.html',
    line: 142,
    label: 'Room 2B',
    reason:
      "COMPOSED-from-data: `roomLabel(room)` returns `room.name` from the live room record, never the frame's fixed room (app/src/pages/agenda/PhoneAgenda.tsx:62-63). Its unplaced-room fallback is a placeholder token the scan's own schedule-shape grammar reserves, so it is described rather than quoted here.",
  },
  {
    fileName: 'Chautauqua Contacts.dc.html',
    line: 196,
    label: 'Speakers · 41',
    reason:
      "COMPOSED-from-data: `countOf(stats.speakerCount, 'speaker')` composes the speaker count from live pipeline stats (app/src/pages/contacts/ContactsApp.tsx:366), rendered count-first (`41 speakers`) rather than the frame's label-first chip form.",
  },
  {
    fileName: 'Chautauqua Contacts.dc.html',
    line: 454,
    label: 'Contacted · 5',
    reason:
      "COMPOSED-from-data: `{PIPELINE_STAGE_LABELS[stage]} · {entries.filter((e) => e.stage === stage).length}` composes every stage chip's label+count from the live pipeline (app/src/pages/contacts/PipelineBoard.tsx:383).",
  },
  {
    fileName: 'Chautauqua Contacts.dc.html',
    line: 455,
    label: 'Interested · 4',
    reason:
      "COMPOSED-from-data: `{PIPELINE_STAGE_LABELS[stage]} · {entries.filter((e) => e.stage === stage).length}` composes every stage chip's label+count from the live pipeline (app/src/pages/contacts/PipelineBoard.tsx:383).",
  },
  {
    fileName: 'Chautauqua Contacts.dc.html',
    line: 456,
    label: 'Confirmed · 2',
    reason:
      "COMPOSED-from-data: `{PIPELINE_STAGE_LABELS[stage]} · {entries.filter((e) => e.stage === stage).length}` composes every stage chip's label+count from the live pipeline (app/src/pages/contacts/PipelineBoard.tsx:383).",
  },
  {
    fileName: 'Chautauqua Contacts.dc.html',
    line: 457,
    label: 'Declined · 2',
    reason:
      "COMPOSED-from-data: `{PIPELINE_STAGE_LABELS[stage]} · {entries.filter((e) => e.stage === stage).length}` composes every stage chip's label+count from the live pipeline (app/src/pages/contacts/PipelineBoard.tsx:383).",
  },
  {
    fileName: 'Chautauqua Content.dc.html',
    line: 211,
    label: 'Approved · 9',
    reason:
      "COMPOSED-from-data: `{TAB_LABELS[t]}{counts[t] !== null ? \` · ${counts[t]}\` : ''}` composes every worklist tab's label+count from the live counts (app/src/pages/content/SessionList.tsx:256-257).",
  },
  {
    fileName: 'Chautauqua Content.dc.html',
    line: 261,
    label: 'Approved · 9',
    reason:
      "COMPOSED-from-data: `{TAB_LABELS[t]}{counts[t] !== null ? \` · ${counts[t]}\` : ''}` composes every worklist tab's label+count from the live counts (app/src/pages/content/SessionList.tsx:256-257).",
  },
  {
    fileName: 'Chautauqua Content.dc.html',
    line: 345,
    label: 'Slides · 22',
    reason:
      'COMPOSED-from-data: `{LIBRARY_KIND_LABELS[k]} &middot; {kindCounts?.[k] ?? 0}` composes every files-library kind chip from the server-aggregated kindCounts (app/src/pages/content/FilesLibrary.tsx:266).',
  },
  {
    fileName: 'Chautauqua Content.dc.html',
    line: 346,
    label: 'Video · 4',
    reason:
      'COMPOSED-from-data: `{LIBRARY_KIND_LABELS[k]} &middot; {kindCounts?.[k] ?? 0}` composes every files-library kind chip from the server-aggregated kindCounts (app/src/pages/content/FilesLibrary.tsx:266).',
  },
  {
    fileName: 'Chautauqua Content.dc.html',
    line: 387,
    label: 'Recording · 1 version',
    reason:
      "COMPOSED-from-data: `{DELIVERABLE_LABELS[kind]} · {countOf(chain.length, 'version')}` composes every deliverable's kind+version-count chip from the live chain (app/src/pages/content/DeliverableDetail.tsx:543).",
  },
  {
    fileName: 'Chautauqua Overview.dc.html',
    line: 276,
    label: 'Move DFC-047 to 11:30',
    reason:
      'COMPOSED-from-data: `` `Move ${laterInfo.ref} to ${clockHMM(slot.startMin)}` `` composes the conflict-resolution suggestion label from the live ref/slot (src/server/repo/overview/scheduling.ts:192).',
  },
  {
    fileName: 'Chautauqua Overview.dc.html',
    line: 215,
    label: 'Remind all three',
    reason:
      "COMPOSED: Overview.tsx renders `Remind all {spellCount(...)}` -- the number word is composed from the live laggard count, never the frame's fixed 'three' (app/src/pages/overview/Overview.tsx).",
  },
  {
    fileName: 'Chautauqua Public and Portal.dc.html',
    line: 379,
    label: 'Wed 13',
    reason:
      'COMPOSED-from-data: `{formatDayShort(day)}` composes the public agenda day-switcher pill from the live event day, never the frame\'s fixed date (src/routes/public/agenda-controls.tsx:120).',
  },
  {
    fileName: 'Chautauqua Public and Portal.dc.html',
    line: 380,
    label: 'Thu 14',
    reason:
      'COMPOSED-from-data: `{formatDayShort(day)}` composes the public agenda day-switcher pill from the live event day, never the frame\'s fixed date (src/routes/public/agenda-controls.tsx:120).',
  },
  {
    fileName: 'Chautauqua Public and Portal.dc.html',
    line: 381,
    label: 'My schedule · 4',
    reason:
      'COMPOSED-from-data: `<span id="chq-ics-count">0</span> saved in this browser` composes the itinerary count client-side from localStorage (src/routes/public/agenda-rail.tsx:42, populated by agenda-itinerary-script.tsx), never the frame\'s fixed 4.',
  },
  {
    fileName: 'Chautauqua Public and Portal.dc.html',
    line: 493,
    label: 'Mark the release signed',
    reason:
      'COMPOSED, DEC-613 wave-128 shared-vocabulary family: the portal tasks dock primary is rendered by `tasksPageDockPrimary` (src/routes/portal/tasks/views.tsx:411), the same shared control the row itself renders -- never a per-frame retyped copy.',
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
  {
    fileName: 'Chautauqua Public and Portal.dc.html',
    line: 494,
    label: 'Later',
    reason:
      'BLESSED (DEVIATIONS.md §6, DEC-967 wave-106): the dock GEOMETRY is legitimate but the portal task model exposes only complete-or-not -- no snooze/defer/dismiss capability exists anywhere in the domain or route layer, so the second button\'s copy is not manufactured.',
  },
  {
    fileName: 'Chautauqua Submissions.dc.html',
    line: 151,
    label: 'All 47',
    reason:
      'COMPOSED-from-data: `` `All ${allTotal}` `` composes the tab total from the live submissions count, never the frame\'s fixed 47 (app/src/pages/submissions/FilterBar.tsx:106).',
  },
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
  // DEC-976 wave-131: the nine rows below are labels the tree renders
  // CORRECTLY and composes at render, so the literal no longer occurs in
  // source even though the drill still paints it. The tree IMPROVED and the
  // ledger lost sight of it -- the exact inverse of a regression, and
  // precisely what COMPOSED_EXCLUSIONS exists for.
  ...([318, 349, 395, 446, 483, 512, 554, 580] as const).map((line) => ({
    fileName: 'Chautauqua Settings.dc.html',
    line,
    label: '‹ Settings',
    reason:
      "COMPOSED: the settings shell composes the read-drill back label from the section vocabulary -- `&lsaquo; {editingSection ? editingSection.label : 'Settings'}` (app/src/pages/Settings.tsx) -- so the frame's literal never occurs verbatim in source while the read drill still paints it (DEC-896 wave-130's two-level head: the back link names the section it returns to).",
  })),
  {
    fileName: 'Chautauqua Overview.dc.html',
    line: 277,
    label: 'Place the other six ›',
    reason:
      "COMPOSED-from-data: the 390 remainder link composes the frame's own imperative with the live count -- `` `Place the other ${spellCount(payload.agendaWork.unplacedTotal - payload.agendaWork.unplaced.length)} ›` `` (app/src/pages/overview/AgendaWorkSection.tsx) -- never the frame's fixed numeral (DEC-919 wave-129: the frame is printing this section's own spelled-count imperative grammar back at it).",
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
// reading the printed offender list: 6 labels survive both normalization and
// the two exclusion tables above -- real frame/app divergences, not fixture
// noise or a composed-at-render label. Lanes w3-k/w3-l/w3-n drain this same
// population in parallel; the merge train re-measures the integrated tree
// and raises (never lowers) this ceiling once, as a merge-train act
// (DEC-989 wave-123).
// Measured on this branch (v12m-w4-l), forcing this const to -1 and reading
// the printed offender list, after closing all three DEC-976 wave-129
// holes (boundary-anchored matching, painted-span population, decision-
// registry corpus exclusion): 7 labels survive. This is a RAISE from the
// wave-128 ceiling of 6, not a regression -- the PREDICATE tightened (the
// boundary-anchored matcher now catches `Wait` where the old substring test
// let `Waitlist` satisfy it) and the POPULATION grew (the painted-span
// extractor surfaces `Copy link`, `See the recipients`, `+ Rule` for the
// first time), so more real divergences are visible, not more regressions.
// The 7 survivors are real frame/app divergences already scheduled to
// sibling lanes this wave (v12m-w4-m/n/o/p/q/r/s close all seven): `See the
// recipients`, `+ Rule`, `Place the other six ›`, `Send this in`, `Read the
// full submission`, `Copy link`, `Wait`.
//
// DRAIN (DEC-976 wave-131, merge-train re-measurement of the integrated
// tree): 7 -> 0. This ceiling movement is a DRAIN -- coverage landed and the
// ledger caught up -- not a raise, not a predicate change, not a paper-over.
// Six of the seven wave-129 survivors were closed outright by their lanes.
// The remaining one (`Place the other six ›`) and eight newly-visible
// `‹ Settings` rows are not gaps at all: v12m-w5-k built the frames'
// two-level settings head and v12m-w4-s landed DEC-919 wave-129's reversal,
// so both labels are now COMPOSED at render and the literal frame string
// stopped occurring in source while the drills still paint it. All nine are
// named COMPOSED_EXCLUSIONS rows above, each quoting its composing
// expression. Measured on the integrated tree by forcing this const to -1
// and reading the printed offender list: 0 survive.
export const FOOTER_LABEL_CEILING = 0;

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

  it('boundary anchoring: a short label is not "matched" by being a substring of a longer word (DEC-976 wave-129 (a))', () => {
    // Fabricated source blobs -- never a real product count -- proving the
    // matcher is boundary-anchored, not a bare substring test. `Wait` must
    // not be satisfied merely because `Waitlist` contains it, exactly the
    // divergence the frame draws at Chautauqua Submissions.dc.html:391.
    const wordBlob = [normalizeSource('const x = "Waitlist";')];
    expect(labelIsMatched('Wait', wordBlob)).toBe(false);

    const markupBlob = [normalizeSource('const el = ">Wait<";')];
    expect(labelIsMatched('Wait', markupBlob)).toBe(true);
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
