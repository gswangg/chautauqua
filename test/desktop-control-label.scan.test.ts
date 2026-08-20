// Desktop + modal control-label ledger (DEC-976 wave-130 amendment; task
// w5-o, chained on w5-n's test/frame-source-corpus.ts).
//
// test/frame-control-label.scan.test.ts asks "does the app render the words
// the PHONE frames print on their buttons and footer tabs" -- its
// population is `width:390px`+`height:844` only. Nothing on main asks the
// same question of the pack's non-390 frames: the 75 frames drawn at
// `width:1600px` and the ~26 modal cards drawn at 440-640px. This scan is
// that instrument, ported from frame-control-label.scan.test.ts's own
// enumeration/extraction/match idiom rather than reinvented (DEC-808: a
// hand-listed population is not a population).
//
// A prior lane (v12m-w3-i) built a version of this and was DROPPED by a
// merge train -- `git merge-base --is-ancestor v12m-w3-i main` says
// NOT-MERGED and neither of its files exists on main (wave-130 field guide).
// This lane does not resurrect that branch; it is built fresh against the
// current pack.
//
//   1. POPULATION: readdirSync docs/design for *.dc.html (never a
//      hand-listed file list). A frame's CONTAINER line is the pack's card
//      signature -- `background:#F4F1E8`, `border-radius:6px`,
//      `box-shadow:0 18px 44px` -- which is disjoint from the phone frame's
//      own `border-radius:20px` card signature (measured: 104 desktop/modal
//      container lines vs 53 phone container lines, zero overlap). A
//      frame's title is the nearest preceding `font-size:19px ...
//      >TITLE</span>` label (identical grammar and code to
//      frame-control-label.scan.test.ts's own framesInFile, ported rather
//      than imported so this file stands alone); its extent runs to the
//      next such label, or EOF.
//
//      Inside each frame's extent, the same two control-label kinds this
//      task's ruling asks for:
//        a. CONTROL FACE -- an `<a>`, `<span>`, or `<button>` whose inline
//           style carries `border-radius` AND `padding` AND either
//           `border:1px solid #(BAB6A6|CFC7B7|1B1D17)` or
//           `background:#4E5C31`.
//        b. TERTIARY LINK -- an `<a>` with `font-weight:(600|700|800)` and
//           no `border` and no `background` in its inline style.
//      Both drop labels under 2 chars after trim, and any label containing
//      `{{` (a template interpolation, identical exclusion to the phone
//      ledger and the desktop frame-claim ledger).
//
//      BADGE EXCLUSION -- the pack's own frame-size badges (`1600`, `1800`,
//      `Modal`, `560`, ...) are drawn as a `<span>` whose inline style
//      carries `letter-spacing:0.1em` AND `padding:5px 10px` AND
//      `background:#(1B1D17|4E5C31)`. That shape also satisfies the CONTROL
//      FACE predicate (border-radius + padding + background:#4E5C31), so
//      badges are dropped BEFORE face/link classification, not after --
//      dropping after would never fire because a badge that already matched
//      CONTROL FACE is never re-examined. The badge-drop count is asserted
//      non-zero below so this predicate can never silently stop matching.
//
//   2. MATCH: `labelIsMatched`/`normalizeSource` imported from
//      test/frame-source-corpus.ts (task v12m-w5-n) -- the single shared,
//      boundary-anchored, comment/entity-aware corpus this task's own
//      sibling ledger uses. Never a second copy (DEC-967 wave-128 clause 4:
//      two independent copies of this logic rot independently).
//
//   3. EXCLUSIONS -- two self-checking tables, each entry independently
//      asserted against the pack by exact file:line:label so a re-cut of
//      the pack rots the list loudly (the idiom at
//      test/frame-control-label.scan.test.ts:349-455 /
//      test/desktop-frame-ledger.scan.test.ts:199-212):
//        a. FIXTURE -- a frame's own mock content wearing control geometry,
//           not a real UI word the app renders.
//        b. COMPOSED -- the app assembles the label from parts at render
//           time (a shared component + a prop, a template literal, a
//           counter function, including COMPOSED-from-data over a shared
//           label vocabulary plus a live count/name), so the literal frame
//           string never appears verbatim in source even though the
//           rendered DOM is correct.
//      Every excluded row is named with its reason; none is silently
//      dropped.
//
//   4. RATCHET, two-sided, identical shape to every prior ledger in this
//      campaign: DESKTOP_LABEL_CEILING is a single exported const,
//      hand-measured on this branch by forcing it to -1 and reading the
//      printed offender list -- never `= UNMATCHED.length` or any
//      expression naming the measured set (the saturated-ratchet-lie
//      pattern named repeatedly in the field guide: the bound must never
//      equal the measurement for every possible tree). One `it` fails when
//      the offender count rises above the ceiling; a companion `it` fails
//      when it falls below, printing the exact replacement line.
//
// This lane NAMES the desktop/modal control-label residue; it does not
// close it -- that is scheduled work for future lanes, not this ledger.
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

// -- Population: every non-390 (desktop/modal) frame in docs/design --------
// (Ported from test/frame-control-label.scan.test.ts's own frame-
// enumeration idiom -- the only change is the container-line predicate,
// swapped from the phone card signature to the desktop/modal one.)

interface Frame {
  /** Bare filename under docs/design/, e.g. "Chautauqua Speakers.dc.html". */
  fileName: string;
  /** 1-based line number of the frame's container declaration. */
  line: number;
  /** Title resolved from the nearest preceding font-size:19px label span. */
  title: string;
  /** Extent end (exclusive): the next frame-label line in the same file,
   * or Infinity if this is the last labelled block in the file. */
  extentEnd: number;
}

const LABEL_SPAN_RE = />([^<]+)<\/span>/;

// The pack's desktop/modal card signature -- disjoint from the phone
// frame's own `border-radius:20px` card signature (measured: 104
// desktop/modal container lines vs 53 phone container lines, zero
// overlap; every desktop/modal frame resolves a preceding title with this
// exact grammar, zero throws).
function isFrameLine(line: string): boolean {
  return (
    line.includes('background:#F4F1E8') &&
    line.includes('border-radius:6px') &&
    line.includes('box-shadow:0 18px 44px')
  );
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
  kind: 'face' | 'tertiary';
  frameTitle: string;
  frameLine: number;
}

// One element walk covers all three tag shapes the ruling names
// (`<a>`/`<span>`/`<button>`), each captured with its own inline-style
// attribute string and single text node.
const ELEMENT_RE = /<(a|span|button)\b([^>]*)>([^<]+)<\/\1>/g;

const BORDER_RADIUS_RE = /border-radius/;
const PADDING_RE = /padding/;
const FACE_BORDER_RE = /border:1px solid #(?:BAB6A6|CFC7B7|1B1D17)/;
const FACE_BACKGROUND_RE = /background:#4E5C31/;
const TERTIARY_WEIGHT_RE = /font-weight:(?:600|700|800)/;
const ANY_BORDER_RE = /border/;
const ANY_BACKGROUND_RE = /background/;

// Frame-size badges (`1600`, `1800`, `Modal`, `560`, ...) -- a span whose
// style carries letter-spacing:0.1em AND padding:5px 10px AND
// background:#(1B1D17|4E5C31). This shape ALSO satisfies the CONTROL FACE
// predicate (border-radius + padding + background:#4E5C31), so badges are
// tested and dropped before face/link classification -- testing after
// would never fire, since a badge already classified as a face is never
// re-examined.
const BADGE_LETTER_SPACING_RE = /letter-spacing:0\.1em/;
const BADGE_PADDING_RE = /padding:5px 10px/;
const BADGE_BACKGROUND_RE = /background:#(?:1B1D17|4E5C31)/;

function isBadge(tag: string, attrs: string): boolean {
  return (
    tag === 'span' &&
    BADGE_LETTER_SPACING_RE.test(attrs) &&
    BADGE_PADDING_RE.test(attrs) &&
    BADGE_BACKGROUND_RE.test(attrs)
  );
}

function isControlFace(attrs: string): boolean {
  return BORDER_RADIUS_RE.test(attrs) && PADDING_RE.test(attrs) && (FACE_BORDER_RE.test(attrs) || FACE_BACKGROUND_RE.test(attrs));
}

function isTertiaryLink(tag: string, attrs: string): boolean {
  return tag === 'a' && TERTIARY_WEIGHT_RE.test(attrs) && !ANY_BORDER_RE.test(attrs) && !ANY_BACKGROUND_RE.test(attrs);
}

function isRealLabel(label: string): boolean {
  return label.trim().length >= 2 && !label.includes('{{');
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

/** Extracts every control-face/tertiary-link label from one frame's raw
 * text extent, and counts how many badge spans were dropped along the way.
 * Exported so the non-vacuity synthetic controls below can drive this
 * exact function over a fabricated fixture, never a real product token. */
export function labelsInFrameText(
  text: string
): { labels: { label: string; kind: 'face' | 'tertiary'; offset: number }[]; badgeDrops: number } {
  const out: { label: string; kind: 'face' | 'tertiary'; offset: number }[] = [];
  let badgeDrops = 0;

  ELEMENT_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = ELEMENT_RE.exec(text))) {
    const tag = m[1]!;
    const attrs = m[2]!;
    const rawLabel = m[3]!;

    if (isBadge(tag, attrs)) {
      badgeDrops++;
      continue;
    }

    const label = rawLabel.trim();
    if (!isRealLabel(label)) continue;

    if (isControlFace(attrs)) {
      out.push({ label, kind: 'face', offset: m.index });
    } else if (isTertiaryLink(tag, attrs)) {
      out.push({ label, kind: 'tertiary', offset: m.index });
    }
  }

  return { labels: out, badgeDrops };
}

let TOTAL_BADGE_DROPS = 0;

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
    const { labels: raw, badgeDrops } = labelsInFrameText(text);
    TOTAL_BADGE_DROPS += badgeDrops;
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
// real UI word the app renders. Each entry asserted below to still resolve
// to its cited line/label so a pack re-cut rots this list loudly.
const FIXTURE_EXCLUSIONS: { fileName: string; line: number; label: string; reason: string }[] = [
  {
    fileName: 'Chautauqua Contacts.dc.html',
    line: 392,
    label: 'Merge into Marcus Okafor',
    reason: "the Contacts duplicates/merge frame's own mock merge-suggestion fixture naming a fictional contact, not a UI word.",
  },
  {
    fileName: 'Chautauqua Speakers.dc.html',
    line: 352,
    label: 'Email Priya',
    reason: "the Speaker-detail frame's own mock quick-action fixture naming a fictional speaker, not a UI word.",
  },
  {
    fileName: 'Chautauqua Speakers.dc.html',
    line: 353,
    label: 'Remind Priya',
    reason: "the Speaker-detail frame's own mock quick-action fixture naming a fictional speaker, not a UI word.",
  },
  {
    fileName: 'Chautauqua Speakers.dc.html',
    line: 365,
    label: 'Taming 40-Minute CI: Incremental Builds at Monorepo Scale',
    reason: "the Speaker-detail frame's own mock talk-title fixture, not a UI word the app renders.",
  },
  {
    fileName: 'Chautauqua Agenda.dc.html',
    line: 67,
    label: 'Wed 13 May',
    reason: "the Agenda desktop day-grid frame's own mock header fixture (a fixed pair of illustrative dates), not the live composed day pill (formatDayLabel, see the phone-frame twin exclusion at app/src/pages/agenda/PhoneAgenda.tsx).",
  },
  {
    fileName: 'Chautauqua Agenda.dc.html',
    line: 68,
    label: 'Thu 14 May',
    reason: "the Agenda desktop day-grid frame's own mock header fixture (a fixed pair of illustrative dates), not the live composed day pill (formatDayLabel, see the phone-frame twin exclusion at app/src/pages/agenda/PhoneAgenda.tsx).",
  },
  {
    fileName: 'Chautauqua Public and Portal.dc.html',
    line: 1255,
    label: 'Platform &amp; Infra',
    reason: "the CFP-error frame's own mock track-name fixture illustrating a track pill, not a literal UI word.",
  },
  {
    fileName: 'Chautauqua Public and Portal.dc.html',
    line: 1256,
    label: 'Developer Experience',
    reason: "the CFP-error frame's own mock track-name fixture illustrating a track pill, not a literal UI word.",
  },
  {
    fileName: 'Chautauqua Settings.dc.html',
    line: 1384,
    label: "Open Sam's row",
    reason: "the Invite-rejected frame's own mock row-reference fixture naming a fictional invitee, not a UI word.",
  },
  {
    fileName: 'Chautauqua Overview.dc.html',
    line: 150,
    label: 'Move DFC-047 to 11:30',
    reason:
      "the Overview conflict-panel's own mock two-sessions-in-one-room fixture (fictional session ref DFC-047, Priya Raman/Ruth Adeyemi), not the real composed suggestion (`Move ${laterInfo.ref} to ${clockHMM(slot.startMin)}`, src/server/repo/overview/scheduling.ts:192).",
  },
  {
    fileName: 'Chautauqua Overview.dc.html',
    line: 514,
    label: 'Remind this task',
    reason: "the 'States · hover, pending, drag' panel's own illustrative button-state swatches (Secondary/Tertiary/Destructive x resting/hover/active/disabled), documentation of a palette, not a real screen's control.",
  },
  {
    fileName: 'Chautauqua Overview.dc.html',
    line: 520,
    label: 'Archive this event',
    reason: "the 'States · hover, pending, drag' panel's own illustrative button-state swatches (Secondary/Tertiary/Destructive x resting/hover/active/disabled), documentation of a palette, not a real screen's control.",
  },
  {
    fileName: 'Chautauqua Submissions.dc.html',
    line: 325,
    label: 'Dana Whitmore',
    reason: "the Submission-detail frame's own mock submitter-name fixture, not a UI word the app renders.",
  },
];

// (b) COMPOSED -- the app assembles the label from parts at render time, so
// the literal frame string never appears verbatim in source even though the
// rendered DOM is correct (including the COMPOSED-from-data subclass -- a
// day pill, room name, or stage/kind chip built from a shared label
// vocabulary plus a live count/name, never the frame's fixed numeral).
const COMPOSED_EXCLUSIONS: { fileName: string; line: number; label: string; reason: string }[] = [
  {
    fileName: 'Chautauqua Comms.dc.html',
    line: 144,
    label: 'Send 23 emails',
    reason: 'COMPOSED-from-data: `` `Send ${countOf(previewPlan.willSend, \'email\')}` `` composes the send-count primary from the live preview plan (app/src/pages/comms/ComposeWizard.tsx:135).',
  },
  {
    fileName: 'Chautauqua Comms.dc.html',
    line: 409,
    label: 'Declined · 11',
    reason: 'COMPOSED-from-data: `{STATUS_LABELS[status]}{count !== null && <span>{count}</span>}` composes every status pill label+count from the live statusCounts (app/src/pages/comms/ComposeWizard.tsx:902-909).',
  },
  {
    fileName: 'Chautauqua Comms.dc.html',
    line: 410,
    label: 'Waitlisted · 4',
    reason: 'COMPOSED-from-data: `{STATUS_LABELS[status]}{count !== null && <span>{count}</span>}` composes every status pill label+count from the live statusCounts (app/src/pages/comms/ComposeWizard.tsx:902-909).',
  },
  {
    fileName: 'Chautauqua Comms.dc.html',
    line: 418,
    label: 'Select all 23 accepted',
    reason: 'COMPOSED-from-data: `` `Select all ${total} ${STATUS_LABELS[statusFilter[0]].toLowerCase()}` `` composes the select-all affordance from the live filtered total (app/src/pages/comms/ComposeWizard.tsx:970-971).',
  },
  {
    fileName: 'Chautauqua Comms.dc.html',
    line: 791,
    label: 'Send to the 20 who have a slot',
    reason: 'COMPOSED: `Send to the {scheduledCount} who have a slot` composes the send-blocked banner primary from the live scheduled count (app/src/pages/comms/ComposeWizard.tsx:1436).',
  },
  {
    fileName: 'Chautauqua Comms.dc.html',
    line: 793,
    label: 'Place all three first',
    reason: 'COMPOSED-from-data: `` icsUnscheduledIds.length === 1 ? \'Place it first\' : `Place all ${spellCount(icsUnscheduledIds.length)} first` `` composes the unscheduled-count secondary (app/src/pages/comms/ComposeWizard.tsx:1443).',
  },
  {
    fileName: 'Chautauqua Contacts.dc.html',
    line: 68,
    label: 'Duplicates · 6',
    reason: 'COMPOSED-from-data: `` if (key === \'duplicates\') label = `${label} · ${duplicateTotal}` `` composes the tab chip from the live duplicate total (app/src/pages/contacts/ContactsApp.tsx:423).',
  },
  {
    fileName: 'Chautauqua Contacts.dc.html',
    line: 69,
    label: 'Segments · 5',
    reason: 'COMPOSED-from-data: `` if (key === \'segments\') label = `${label} · ${segments.length}` `` composes the tab chip from the live segments array (app/src/pages/contacts/ContactsApp.tsx:424).',
  },
  {
    fileName: 'Chautauqua Contacts.dc.html',
    line: 302,
    label: 'Import 214 rows',
    reason: 'COMPOSED-from-data: `Import {countOf(dataRows.length, \'row\')}` composes the import-preview primary from the live parsed row count (app/src/pages/contacts/ImportWizard.tsx:665).',
  },
  {
    fileName: 'Chautauqua Contacts.dc.html',
    line: 572,
    label: 'Send 2 emails',
    reason: 'COMPOSED-from-data: `Send {countOf(contactIds.length, \'email\')}` composes the bulk-email primary from the live selection count (app/src/pages/contacts/BulkEmailModal.tsx:273).',
  },
  {
    fileName: 'Chautauqua Contacts.dc.html',
    line: 710,
    label: 'Import 214 rows',
    reason: 'COMPOSED-from-data: `` restLabel: `Import ${countOf(plan ? plan.rows.length - skipLines.size : 0, \'row\')}` `` composes the commit-step primary from the live plan (app/src/pages/contacts/ImportWizard.tsx:189).',
  },
  {
    fileName: 'Chautauqua Contacts.dc.html',
    line: 750,
    label: 'Identified · 7',
    reason: 'COMPOSED-from-data: `{PIPELINE_STAGE_LABELS[stage]}` + `{entries.filter((e) => e.stage === stage).length}` compose every pipeline column\'s name+count header from the live entries (app/src/pages/contacts/PipelineBoard.tsx:310-313).',
  },
  {
    fileName: 'Chautauqua Contacts.dc.html',
    line: 751,
    label: 'Contacted · 5',
    reason: 'COMPOSED-from-data: `{PIPELINE_STAGE_LABELS[stage]}` + `{entries.filter((e) => e.stage === stage).length}` compose every pipeline column\'s name+count header from the live entries (app/src/pages/contacts/PipelineBoard.tsx:310-313).',
  },
  {
    fileName: 'Chautauqua Contacts.dc.html',
    line: 752,
    label: 'Interested · 4',
    reason: 'COMPOSED-from-data: `{PIPELINE_STAGE_LABELS[stage]}` + `{entries.filter((e) => e.stage === stage).length}` compose every pipeline column\'s name+count header from the live entries (app/src/pages/contacts/PipelineBoard.tsx:310-313).',
  },
  {
    fileName: 'Chautauqua Contacts.dc.html',
    line: 754,
    label: 'Declined · 2',
    reason: 'COMPOSED-from-data: `{PIPELINE_STAGE_LABELS[stage]}` + `{entries.filter((e) => e.stage === stage).length}` compose every pipeline column\'s name+count header from the live entries (app/src/pages/contacts/PipelineBoard.tsx:310-313).',
  },
  {
    fileName: 'Chautauqua Contacts.dc.html',
    line: 799,
    label: 'Import the 205 good rows',
    reason: 'COMPOSED-from-data: `Import the {countOf(allDataRows.length - badRows.length, \'good row\', \'good rows\')}` composes the file-refusal primary from the live good-row count (app/src/pages/contacts/ImportWizard.tsx:620).',
  },
  {
    fileName: 'Chautauqua Contacts.dc.html',
    line: 800,
    label: 'Download the 9 rows',
    reason: 'COMPOSED-from-data: `Download the {countOf(badRows.length, \'row\')}` composes the file-refusal tertiary from the live bad-row count (app/src/pages/contacts/ImportWizard.tsx:626).',
  },
  {
    fileName: 'Chautauqua Content.dc.html',
    line: 141,
    label: 'Recording · 1 version',
    reason: "COMPOSED-from-data: `{DELIVERABLE_LABELS[kind]} · {countOf(chain.length, 'version')}` composes every deliverable's kind+version-count chip from the live chain (app/src/pages/content/DeliverableDetail.tsx:543).",
  },
  {
    fileName: 'Chautauqua Content.dc.html',
    line: 306,
    label: 'Slides · 22',
    reason: 'COMPOSED-from-data: `{LIBRARY_KIND_LABELS[k]} &middot; {kindCounts?.[k] ?? 0}` composes every files-library kind chip from the server-aggregated kindCounts (app/src/pages/content/FilesLibrary.tsx:266).',
  },
  {
    fileName: 'Chautauqua Content.dc.html',
    line: 307,
    label: 'Video · 4',
    reason: 'COMPOSED-from-data: `{LIBRARY_KIND_LABELS[k]} &middot; {kindCounts?.[k] ?? 0}` composes every files-library kind chip from the server-aggregated kindCounts (app/src/pages/content/FilesLibrary.tsx:266).',
  },
  {
    fileName: 'Chautauqua Content.dc.html',
    line: 308,
    label: 'Other · 5',
    reason: 'COMPOSED-from-data: `{LIBRARY_KIND_LABELS[k]} &middot; {kindCounts?.[k] ?? 0}` composes every files-library kind chip from the server-aggregated kindCounts (app/src/pages/content/FilesLibrary.tsx:266).',
  },
  {
    fileName: 'Chautauqua Overview.dc.html',
    line: 75,
    label: 'Remind all three',
    reason: 'COMPOSED: `Remind all {spellCount(new Set(payload.overdueTasks.rows.map((r) => r.contactId)).size)}` composes the number word from the live distinct-laggard count (app/src/pages/Overview.tsx:329).',
  },
  {
    fileName: 'Chautauqua Overview.dc.html',
    line: 118,
    label: 'All 5 · 2 re-uploaded',
    reason: 'COMPOSED-from-data: `All {payload.contentApproval.total} · {payload.contentApproval.reuploadedCount} re-uploaded` composes the deliverables-panel caption from live counts (app/src/pages/Overview.tsx:439).',
  },
  {
    fileName: 'Chautauqua Review.dc.html',
    line: 97,
    label: 'Remind laggards (5)',
    reason: 'COMPOSED-from-data: `Remind laggards ({laggards.length})` composes the toolbar action from the live laggards array (app/src/pages/review/ProgressPanel.tsx:235).',
  },
  {
    fileName: 'Chautauqua Review.dc.html',
    line: 98,
    label: 'Remind the 4 not started',
    reason: 'COMPOSED-from-data: `Remind the {notStarted.length} not started` composes the section-head action from the live not-started array (app/src/pages/review/ProgressPanel.tsx:244).',
  },
  {
    fileName: 'Chautauqua Review.dc.html',
    line: 400,
    label: 'Show all 18',
    reason: 'COMPOSED-from-data: `` `Show all ${totalRows}` `` composes the reviewer-queue affordance from the live total (app/src/pages/review/ReviewerQueue.tsx:414).',
  },
  {
    fileName: 'Chautauqua Review.dc.html',
    line: 565,
    label: 'Assign these 22',
    reason: 'COMPOSED: `Assign these {distributePreview.totalAssigned}` composes the distribute-preview primary from the live assignment count (app/src/pages/review/PlanEditor.tsx:2386).',
  },
  {
    fileName: 'Chautauqua Submissions.dc.html',
    line: 638,
    label: 'All 47',
    reason: "COMPOSED-from-data: `{allTotal !== null ? `All ${allTotal}` : 'All'}` composes the filter-bar tab total from the live submissions count (app/src/pages/submissions/FilterBar.tsx:106).",
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
// Measured on this branch (v12m-w5-o) by forcing this const to -1 and
// reading the printed offender list: 57 control labels survive both
// normalization and the two exclusion tables above -- real frame/app
// divergences (mostly the Settings two-level-back-link/consequence-line
// gaps named in the wave-131/wave-132 field guide entries, the Docs
// article-nav rail, and a handful of composed-but-unverified count chips),
// not fixture noise or a composed-at-render label this task closed. This
// lane names the residue; it does not close it -- future lanes drain this
// population the same way sibling lanes drained the phone ledger's own
// FOOTER_LABEL_CEILING.
export const DESKTOP_LABEL_CEILING = 57;

describe('desktop + modal control-label ledger (DEC-976 wave-130 amendment, v12 mobile campaign)', () => {
  it('non-vacuity: population is large and spans many frames and many source files', () => {
    expect(ALL_LABELS.length).toBeGreaterThan(60);
    const distinctFrames = new Set(ALL_LABELS.map((l) => `${l.fileName}:${l.frameLine}`));
    expect(distinctFrames.size).toBeGreaterThanOrEqual(8);
    expect(SOURCE_FILES.length).toBeGreaterThanOrEqual(100);
  });

  it('badge-drop predicate is live: the pack draws at least one frame-size badge dropped from the population', () => {
    // Force ALL_LABELS to be computed first (module-level, already done),
    // which populates TOTAL_BADGE_DROPS as a side effect of controlLabelsInFile.
    expect(TOTAL_BADGE_DROPS).toBeGreaterThan(0);
  });

  it('non-vacuity: synthetic positive/negative controls over a fabricated single-file population', () => {
    // A fabricated frame extent -- never a real product token -- wearing
    // exactly the two control-label shapes this scan looks for, plus one
    // badge that must be dropped and one plain span that must be ignored.
    const fabricatedFrameText = [
      '<div style="display:flex; flex-direction:column">',
      '  <a href="#" style="font-weight:700; font-size:13px">Zzy Synthetic Tertiary ›</a>',
      '  <span style="border:1px solid #BAB6A6; border-radius:6px; padding:0 14px">Zzy Synthetic Face</span>',
      '  <span style="letter-spacing:0.1em; padding:5px 10px; background:#4E5C31; border-radius:4px">1600</span>',
      '  <span style="min-height:44px">Zzy Synthetic Absent</span>',
      '</div>',
    ].join('\n');

    const { labels: extracted, badgeDrops } = labelsInFrameText(fabricatedFrameText);
    const extractedLabels = extracted.map((e) => e.label);
    expect(extractedLabels).toContain('Zzy Synthetic Tertiary ›');
    expect(extractedLabels).toContain('Zzy Synthetic Face');
    expect(extractedLabels).not.toContain('1600');
    expect(extractedLabels).not.toContain('Zzy Synthetic Absent');
    expect(badgeDrops).toBe(1);

    // Fabricated single-file "source" population: contains the FACE label,
    // wrapped in a comment that must be stripped before matching, and using
    // the entity form of the tertiary link's trailing character.
    const fabricatedSource = [
      '// this comment mentions Zzy Synthetic Absent and must not satisfy it',
      'const label = "Zzy Synthetic Face";',
      'const link = "Zzy Synthetic Tertiary &rsaquo;";',
    ].join('\n');
    const normalized = [normalizeSource(fabricatedSource)];

    expect(labelIsMatched('Zzy Synthetic Face', normalized)).toBe(true);
    expect(labelIsMatched('Zzy Synthetic Tertiary ›', normalized)).toBe(true);
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

  it(`never exceeds DESKTOP_LABEL_CEILING (${DESKTOP_LABEL_CEILING}) unmatched control labels`, () => {
    if (UNMATCHED.length > DESKTOP_LABEL_CEILING) {
      const offenders = UNMATCHED.map((l) => `${l.fileName}:${l.line} -- "${l.label}" (frame: ${l.frameTitle}, kind: ${l.kind})`);
      throw new Error(
        `${UNMATCHED.length} control labels are unmatched by any app source file, above the ceiling of ` +
          `${DESKTOP_LABEL_CEILING}. DESKTOP_LABEL_CEILING may only be RAISED (a merge-train act, never a ` +
          `worker's edit mid-lane), and only once new exclusions or coverage are landed and re-measured. ` +
          `Offenders:\n${offenders.join('\n')}`
      );
    }
    expect(UNMATCHED.length).toBeLessThanOrEqual(DESKTOP_LABEL_CEILING);
  });

  it(`never sits BELOW DESKTOP_LABEL_CEILING (${DESKTOP_LABEL_CEILING}) without the ceiling being lowered to match (a stale ceiling licenses stagnation)`, () => {
    if (UNMATCHED.length < DESKTOP_LABEL_CEILING) {
      throw new Error(
        `${UNMATCHED.length} control labels are unmatched, below the ceiling of ${DESKTOP_LABEL_CEILING}. ` +
          `This is the ratchet working: coverage landed. Lower the ceiling in the same commit (a merge-train ` +
          `act) by replacing the line:\n  export const DESKTOP_LABEL_CEILING = ${UNMATCHED.length};`
      );
    }
    expect(UNMATCHED.length).toBeGreaterThanOrEqual(DESKTOP_LABEL_CEILING);
  });
});
