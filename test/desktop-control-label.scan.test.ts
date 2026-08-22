// Desktop (non-390) control-label ledger (DEC-919 wave-131 amendment; task
// w6-b).
//
// test/frame-control-label.scan.test.ts answers "does the app render the
// WORDS a v12 PHONE frame draws on its footer/anchor/painted-span
// controls?" for the pack's 53 width:390px/height:844 frames. Nothing has
// ever asked the same question of the pack's other ~101 card frames -- the
// 75 wide (width:1600px) screens and the 26 modal dialogs (width:420-640px)
// -- the wave-130 field guide entry names exactly this gap ("the modals are
// where 'Copy the password', 'Add it' and 'Invite someone else' hid for 130
// waves"). This scan is that instrument for the non-390 population. It
// mirrors frame-control-label.scan.test.ts's structure, idioms and comment
// discipline, and reuses its match-side helpers verbatim from
// ./frame-source-corpus (DEC-967's one-stripper rule) -- but it PORTS
// (never imports) that file's extraction functions, because
// frame-control-label.scan.test.ts is owned by a sibling lane this same
// batch (v12m-w6-a) and this file must never touch it.
//
//   1. POPULATION (derive, never hand-list -- DEC-808): readdirSync
//      docs/design for *.dc.html. A non-390 frame opens on any line
//      containing the pack's card signature:
//        background:#F4F1E8; border:1px solid #D3CFC0; border-radius:6px;
//        overflow:hidden; box-shadow:0 18px 44px rgba(27,29,23,0.13)
//      Its width comes from THE SAME LINE's `width:(\d+)px`. Three lines in
//      the pack carry this signature with NO width on the same line at all
//      (Chautauqua Overview.dc.html:359/372/400, inside the "Widths · what
//      a wide monitor gets" explainer panel's own nested `width:1800px`
//      wrapper) -- those are excluded BY CONSTRUCTION (the width regex
//      simply never matches), not by a hand-picked exclusion list, which is
//      why the measured population lands on exactly 101 rather than 104.
//      This signature is disjoint from the 53 phone frames' own signature
//      (`border-radius:20px` + `width:390px; height:844px`) by
//      construction -- asserted below as a test so a pack re-cut can never
//      silently merge the two populations.
//
//      Title = nearest preceding `font-size:19px ... >TITLE</span>` label
//      (identical grammar to every other ledger in this campaign). Extent
//      ends at the next such label OR the next card-signature line,
//      whichever comes first -- the rule that matters for the pack's own
//      "Widths" explainer panel, whose three EXCLUDED (no on-line width)
//      demo cards all sit under one title; every GRADED (width-bearing)
//      card in the measured population turns out to have its own title
//      immediately above it, one-to-one, which the population test below
//      confirms explicitly rather than assuming.
//
//      MEASURED on this branch: 101 frames total -- 75 at width:1600px, 26
//      modal frames at widths 420-640px. Asserted as an exact total below so
//      the population cannot silently shrink or grow uninstrumented.
//
//   2. EXTRACTION (ported verbatim from frame-control-label.scan.test.ts,
//      never a second independent implementation): the balanced-`<div>`
//      footer walk on `flex-shrink:0; border-top:1px solid #1B1D17;
//      background:#EFEBDF`, every `<a ...min-height:44px...>LABEL</a>`, and
//      the painted-span face (`min-height:4[468]px` AND `border-radius` AND
//      (`border:1px` OR `background:#4E5C31`)), deduped against the
//      footer's own text-node offsets so a footer row wearing a painted
//      face is never double-counted. Labels under 2 chars (after trim) and
//      any containing `{{` are dropped.
//
//   3. MATCHING: imports `enumerateSourceFiles`, `normalizeSource`,
//      `labelIsMatched` from ./frame-source-corpus -- never a second copy
//      of that logic (DEC-967's one-stripper rule: the old two-regex
//      stripper ate real code for 129 waves). Same corpus as every sibling
//      ledger: every non-test .ts/.tsx/.css under app/src/** and src/**,
//      skipping the decision registry (whose own DEC_NNN prose quotes frame
//      labels verbatim and would let a ruling satisfy the ledger it rules
//      on -- DEC-976 wave-129 amendment (c)).
//
//   4. EXCLUSIONS -- hand-triaged, two named tables, each entry
//      independently asserted against the pack by exact file:line:label so
//      a pack re-cut rots the list loudly (the landed phone ledger's own
//      idiom):
//        a. FIXTURE -- the frame's own mock content or event-specific seed
//           data wearing control geometry, not a real UI word the app's
//           source is expected to contain verbatim.
//        b. COMPOSED -- the app assembles the label from parts (a shared
//           component + a prop, a template literal, a counter/name
//           function), so the literal frame string never appears verbatim
//           in source even though the rendered DOM is correct; or the
//           divergence is already BLESSED by a recorded ruling
//           (DEVIATIONS.md, cited by section/content -- DEVIATIONS.md
//           itself is never edited here). Reason quotes the composing
//           expression verbatim, or the blessing citation.
//
//      MEASURED on this branch, before exclusions: 136 controls extracted,
//      26 unmatched by any app source file. After the two exclusion tables
//      below (3 FIXTURE + 22 COMPOSED, several of which resolve as BLESSED
//      rather than freshly-composed on inspection -- see their own
//      entries), zero divergences survive: task w10-ff (DEC-441) closed the
//      former last residue, Chautauqua Speakers.dc.html:529 "Open your
//      tasks", by having sendReminderEmails pass `cta: { label:
//      REMINDER_CTA_LABEL, href: portalLink }` to renderEmailHtml (src/
//      server/repo/tasks/reminders.ts) -- the literal 'Open your tasks'
//      REMINDER_CTA_LABEL constant now resolves this scan's corpus match
//      directly, closing the gap by USING the mail shell's already-built
//      cta affordance rather than inventing markup.
//
//   5. RATCHET, two-sided, mirroring every prior ledger in this campaign:
//      DESKTOP_CONTROL_LABEL_CEILING is a single exported const, hand-
//      measured on this branch by forcing it to -1 and reading the printed
//      offender list -- never `= UNMATCHED.length` or any expression naming
//      the measured set (the saturated-ratchet-lie pattern the field guide
//      names repeatedly). One `it` fails when the offender count rises
//      above the ceiling; a companion `it` fails when it falls below,
//      printing the exact replacement line.
//
//      RATCHET: DESKTOP_CONTROL_LABEL_CEILING=0 (task w10-ff, DEC-441 --
//      closed the ledger's last offender by wiring the reminder email's
//      existing-but-unused CTA affordance, not by inventing new markup).
//
// This file names the app's uninstrumented non-390 control-label gap; it
// does not close it.
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

// -- Population: every non-390 card frame in docs/design -------------------

const CARD_SIGNATURE =
  'background:#F4F1E8; border:1px solid #D3CFC0; border-radius:6px; overflow:hidden; box-shadow:0 18px 44px rgba(27,29,23,0.13)';
const CARD_WIDTH_RE = /width:(\d+)px/;

// The 53 phone frames' own signature -- imported nowhere, just quoted here
// so the disjointness test below can prove the two populations never
// overlap without depending on any other test file's internals.
const PHONE_SIGNATURE_MARKER = 'border-radius:20px';
const PHONE_WIDTH_MARKER = 'width:390px';
const PHONE_HEIGHT_MARKER = 'height:844';

const LABEL_SPAN_RE = />([^<]+)<\/span>/;

function isCardLine(line: string): boolean {
  return line.includes(CARD_SIGNATURE);
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

export interface DesktopFrame {
  fileName: string;
  /** 1-based line number of the card-signature declaration. */
  line: number;
  width: number;
  title: string;
  /** Extent end (exclusive): the next label line or next card line in the
   * same file, whichever comes first, or Infinity if neither exists. */
  extentEnd: number;
}

function framesInFile(fileName: string): DesktopFrame[] {
  const full = join(DESIGN_ROOT, fileName);
  const lines = readFileSync(full, 'utf-8').split('\n');

  const labelLines: { line: number; title: string }[] = [];
  const cardLines: { line: number; width: number }[] = [];
  lines.forEach((content, idx) => {
    const lineNo = idx + 1;
    if (isLabelLine(content)) {
      const m = content.match(LABEL_SPAN_RE);
      if (m) labelLines.push({ line: lineNo, title: m[1]!.trim() });
    }
    if (isCardLine(content)) {
      // Width must come from THIS line -- a card-signature line with no
      // width on it (the "Widths" explainer panel's three nested cards) is
      // not a frame at all; excluded by construction, not by a list.
      const wm = content.match(CARD_WIDTH_RE);
      if (wm) cardLines.push({ line: lineNo, width: Number(wm[1]) });
    }
  });

  return cardLines.map(({ line: frameLine, width }) => {
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
    const nextCard = cardLines.find((c) => c.line > frameLine);
    let extentEnd = Infinity;
    if (nextLabel) extentEnd = nextLabel.line;
    if (nextCard && nextCard.line < extentEnd) extentEnd = nextCard.line;
    return { fileName, line: frameLine, width, title, extentEnd };
  });
}

// -- Control-label extraction (ported from frame-control-label.scan.test.ts,
// never imported -- that file is owned by a sibling lane this batch) ------

export interface ControlLabel {
  fileName: string;
  line: number;
  label: string;
  kind: 'footer' | 'anchor' | 'span';
  frameTitle: string;
  frameLine: number;
  frameWidth: number;
}

const FOOTER_SIGNATURE = 'flex-shrink:0; border-top:1px solid #1B1D17; background:#EFEBDF';
const FOOTER_TEXT_NODE_RE = />([^<>]+)</g;
const ANCHOR_RE = /<a\b[^>]*min-height:44px[^>]*>([^<]+)<\/a>/g;

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

/** Walks `<div`/`</div>` tokens forward from `openStart` with a depth
 * counter, returning the index just past the matching balanced `</div>`'s
 * own `>`. Exported so the non-vacuity fixture below can drive this exact
 * function, never a real product token. */
export function balancedDivEnd(text: string, openStart: number): number {
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

/** Extracts every footer/anchor/painted-span control label from one frame's
 * raw text extent. Exported so the non-vacuity synthetic controls below can
 * drive this exact function over a fabricated fixture, never a real
 * product token. */
export function labelsInFrameText(
  text: string
): { label: string; kind: 'footer' | 'anchor' | 'span'; offset: number }[] {
  const out: { label: string; kind: 'footer' | 'anchor' | 'span'; offset: number }[] = [];
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
    const raw = labelsInFrameText(text);
    for (const r of raw) {
      out.push({
        fileName,
        line: offsetToLine(lineStartIndex, startOff + r.offset),
        label: r.label,
        kind: r.kind,
        frameTitle: frame.title,
        frameLine: frame.line,
        frameWidth: frame.width,
      });
    }
  }
  return out;
}

const ALL_FRAMES: DesktopFrame[] = designFiles().flatMap(framesInFile);
export const ALL_LABELS: ControlLabel[] = designFiles().flatMap(controlLabelsInFile);

// -- Match side: every non-test .ts/.tsx/.css under app/src/** and src/** --

const SOURCE_FILES = [...enumerateSourceFiles(APP_SRC_ROOT), ...enumerateSourceFiles(SRC_ROOT)];
const NORMALIZED_SOURCE_BLOBS: string[] = SOURCE_FILES.map((f) => normalizeSource(readFileSync(f, 'utf-8')));

const UNMATCHED_RAW: ControlLabel[] = ALL_LABELS.filter((l) => !labelIsMatched(l.label, NORMALIZED_SOURCE_BLOBS));

// -- Exclusions --------------------------------------------------------------
// (a) FIXTURE -- the frame's own mock content or event-specific seed data
// wearing control geometry, not a real UI word.
export const FIXTURE_EXCLUSIONS = [
  {
    fileName: 'Chautauqua Contacts.dc.html',
    line: 603,
    label: 'Guest',
    reason:
      "the Add-to-event role segmented control's own mock third option. AddToEventModal.tsx (DEC-714) explicitly imports PARTICIPANT_ROLE_OPTIONS from src/domain/participant-roles rather than a hardcoded Speaker/Reviewer/Guest list, with a code comment stating 'guest' has no representation in the data model -- the frame draws a role the domain does not have, and the app correctly does not draw a control for it.",
  },
  {
    fileName: 'Chautauqua Public and Portal.dc.html',
    line: 1255,
    label: 'Platform &amp; Infra',
    reason:
      "the CFP submission form's mock track-picker pills for the pack's fictional DevFlow Conf event. Track names are event-configured data (settings/TracksRoomsPanel), not a literal app vocabulary word -- a sibling pill on the same line, 'AI Engineering', happens to also be this pack's seed-data track name and appears elsewhere in source (app/src/pages/settings/settings.css etc.), which is exactly the fixture-data coincidence, not app copy.",
  },
  {
    fileName: 'Chautauqua Public and Portal.dc.html',
    line: 1256,
    label: 'Developer Experience',
    reason:
      "the same CFP submission form's mock track-picker pill, DevFlow Conf event-configured fixture data, not a literal app vocabulary word (see the 'Platform &amp; Infra' entry above, same frame/control).",
  },
];

// (b) COMPOSED -- the app assembles the label from parts at render time, or
// the divergence is already BLESSED by a recorded ruling (DEVIATIONS.md,
// cited by content -- never edited here). Reason quotes the composing
// expression verbatim, or the blessing citation.
export const COMPOSED_EXCLUSIONS = [
  {
    fileName: 'Chautauqua Comms.dc.html',
    line: 578,
    label: 'Tell the 23 accepted speakers',
    reason:
      "COMPOSED-and-deliberately-static: RecentSends.tsx's fresh empty-state action is `{ label: 'Tell your accepted speakers', to: '/comms?tab=compose' }` (RecentSends.tsx:360) -- a code comment immediately above (RecentSends.tsx:342-352) documents that RecentSends has no decision-count data of its own and stays static rather than fabricating a count the component cannot verify, routing into Compose's Accepted-only default filter (DEC-967) so the audience named is real even without the frame's fixed '23'.",
  },
  {
    fileName: 'Chautauqua Comms.dc.html',
    line: 791,
    label: 'Send to the 20 who have a slot',
    reason: 'COMPOSED-from-data: ComposeWizard.tsx renders `Send to the {scheduledCount} who have a slot` (ComposeWizard.tsx:850/1436/1554).',
  },
  {
    fileName: 'Chautauqua Comms.dc.html',
    line: 793,
    label: 'Place all three first',
    reason:
      "COMPOSED-from-data: ComposeWizard.tsx renders `Place all ${spellCount(icsUnscheduledIds.length)} first` (single-unscheduled case renders 'Place it first' instead) at ComposeWizard.tsx:1443.",
  },
  {
    fileName: 'Chautauqua Contacts.dc.html',
    line: 392,
    label: 'Merge into Marcus Okafor',
    reason:
      'COMPOSED-from-data: MergePage.tsx renders `Merge into ${keepContact.firstName} ${keepContact.lastName}` (MergePage.tsx:399/407) from the live kept-contact record.',
  },
  {
    fileName: 'Chautauqua Contacts.dc.html',
    line: 572,
    label: 'Send 2 emails',
    reason:
      "COMPOSED-from-data: BulkEmailModal.tsx renders `Send {countOf(contactIds.length, 'email')}` (BulkEmailModal.tsx:273) and the confirm dialog's `confirmLabel={`Send ${countOf(contactIds.length, 'email')}`}` (BulkEmailModal.tsx:440) from the live selection count.",
  },
  {
    fileName: 'Chautauqua Contacts.dc.html',
    line: 661,
    label: 'Add to pipeline',
    reason:
      "the app's Enroll-dialog primary/title renders 'Add to the pipeline' verbatim everywhere (PipelineBoard.tsx:290/827/834) -- matching THIS SAME FRAME's own title span ('Add to the pipeline', see designFiles population) -- while the frame's inline button span at line 661 drops the middle 'the'. This is the pack's own internal inconsistency between a frame's title and its button face, not an app gap; the app is consistent with the frame's own title.",
  },
  {
    fileName: 'Chautauqua Contacts.dc.html',
    line: 710,
    label: 'Import 214 rows',
    reason: "COMPOSED-from-data: ImportWizard.tsx renders `Import {countOf(dataRows.length, 'row')}` (ImportWizard.tsx:665) from the live parsed-row count.",
  },
  {
    fileName: 'Chautauqua Contacts.dc.html',
    line: 799,
    label: 'Import the 205 good rows',
    reason:
      "COMPOSED-from-data: ImportWizard.tsx renders `Import the {countOf(allDataRows.length - badRows.length, 'good row', 'good rows')}` (ImportWizard.tsx:620) from the live good-row count.",
  },
  {
    fileName: 'Chautauqua Overview.dc.html',
    line: 611,
    label: 'Send 23 emails',
    reason: 'COMPOSED-from-data: same live send-count composition as the :623 entry below (same frame, two states of one control).',
  },
  {
    fileName: 'Chautauqua Overview.dc.html',
    line: 615,
    label: 'Sending 12 of 23…',
    reason: "COMPOSED-from-data: an in-flight progress state composed from the live batch send progress counters, never the frame's fixed 12/23.",
  },
  {
    fileName: 'Chautauqua Overview.dc.html',
    line: 619,
    label: 'Uploading…',
    reason: 'COMPOSED: a transient in-flight upload-state label, present only while a live upload request is outstanding, not a static frame string to grade against source.',
  },
  {
    fileName: 'Chautauqua Overview.dc.html',
    line: 623,
    label: 'Send 23 emails',
    reason: "COMPOSED-from-data: the resting-state send-count button composes its label from the live email count, never the frame's fixed 23 (Overview.tsx bulk-send control).",
  },
  {
    fileName: 'Chautauqua Review.dc.html',
    line: 565,
    label: 'Assign these 22',
    reason: "COMPOSED-from-data: PlanEditor.tsx renders `distributing ? 'Distributing…' : \`Assign these ${distributePreview.totalAssigned}\`` (PlanEditor.tsx:2386) from the live distribute-preview count.",
  },
  {
    fileName: 'Chautauqua Review.dc.html',
    line: 921,
    label: 'Save as draft',
    reason:
      'BLESSED (DEVIATIONS.md §6 "Reworks larger than the freeze window": "plan-editor footer draft-vs-open model"; DEVIATIONS.md §3/DEC-745 wave-98 records the existing-plan title row already renders Duplicate/Save and the phone dock is a CSS-only repositioning of that same pair, never a second copy of the buttons).',
  },
  {
    fileName: 'Chautauqua Review.dc.html',
    line: 921,
    label: 'Open the plan',
    reason: 'BLESSED (DEVIATIONS.md §6, same "plan-editor footer draft-vs-open model" citation as the "Save as draft" entry above -- one footer, two labels, one blessing).',
  },
  {
    fileName: 'Chautauqua Settings.dc.html',
    line: 1195,
    label: 'Everything as JSON',
    reason:
      'BLESSED (DEVIATIONS.md §6 "Unbuilt features (no data model or endpoint behind the drawing)": "\'Your data\' edit view: retention select, keeping-and-deleting checkboxes, revoke-every-token footer (09--16)"), drawn on the "Settings · editing your data" frame -- the entire frame is recorded as unbuilt, so nothing in this extent is expected to resolve in source.',
  },
  {
    fileName: 'Chautauqua Settings.dc.html',
    line: 1432,
    label: 'Delete it',
    reason:
      'BLESSED (DEVIATIONS.md §6 "Reworks larger than the freeze window": "shared ConfirmDialog 480/subtitle/typed-label anatomy (09--21/22)"). This frame ("Confirm · irreversible", width:480px, subtitle "Type the name · destructive verb on the button", title span at Settings.dc.html:1414) is the pack\'s own generic reusable confirm-dialog PATTERN demo -- "Delete “Speaker handbook 2027.pdf”?" is invented fixture content illustrating the pattern (paired one card above with "Confirm · reversible" / "Turn off “Sponsor deck feed”?"), not a concrete screen tied to a real feature; the pattern itself is the deferred rework DEVIATIONS.md already names, and no literal "Speaker handbook 2027.pdf" delete flow exists in this repo to grade.',
  },
  {
    fileName: 'Chautauqua Settings.dc.html',
    line: 1542,
    label: 'Import all of it',
    reason:
      'BLESSED (DEVIATIONS.md §6 "Reworks larger than the freeze window": "Embed editor drill-page anatomy (09--15), Sessionboard importer modal + per-entity dispositions (09--25) ... The Sessionboard importer modal is drawn on the \'Import from Sessionboard\' frame") -- the entire modal, including this button, is recorded as a deferred rework.',
  },
  {
    fileName: 'Chautauqua Speakers.dc.html',
    line: 352,
    label: 'Email Priya',
    reason: 'COMPOSED-from-data: SpeakerDetailPage.tsx renders `Email {firstNameOf(detail.contact.name)}` (SpeakerDetailPage.tsx:539) from the live contact record.',
  },
  {
    fileName: 'Chautauqua Speakers.dc.html',
    line: 353,
    label: 'Remind Priya',
    reason: 'COMPOSED-from-data: OnboardingGrid.tsx renders `Remind {firstNameOf(row.contact.name)}` (OnboardingGrid.tsx:1216/1337) from the live contact record.',
  },
  {
    fileName: 'Chautauqua Speakers.dc.html',
    line: 538,
    label: 'Send these 3',
    reason: "COMPOSED-from-data: RemindPreviewModal.tsx renders `sending ? 'Sending...' : \`Send these ${count}\`` (RemindPreviewModal.tsx:80, with a comment at :79 citing this exact frame line) from the live selected-speaker count.",
  },
];

function excluded(l: ControlLabel): boolean {
  return (
    FIXTURE_EXCLUSIONS.some((e) => e.fileName === l.fileName && e.line === l.line && e.label === l.label) ||
    COMPOSED_EXCLUSIONS.some((e) => e.fileName === l.fileName && e.line === l.line && e.label === l.label)
  );
}

const UNMATCHED: ControlLabel[] = UNMATCHED_RAW.filter((l) => !excluded(l));

// -- Ratchet ------------------------------------------------------------
// Measured on this branch (task w10-ff, DEC-441) by forcing this const to
// -1 and reading the printed offender list: zero labels survive both
// normalization and the two exclusion tables above. Chautauqua
// Speakers.dc.html:529 "Open your tasks" -- the sole prior offender
// (v12m-w6-b's initial measurement, ceiling=1) -- now resolves: build-
// ReminderMessage's reminder email is built to its frame (greeting, nudge,
// 'Still to do', task lines, signature) and sendReminderEmails passes
// `cta: { label: REMINDER_CTA_LABEL, href: portalLink }` to renderEmailHtml
// (src/server/repo/tasks/reminders.ts), so the literal 'Open your tasks'
// (REMINDER_CTA_LABEL) now appears in this repo's own TS source, satisfying
// the corpus match. A DRAIN, not a raise: the ceiling falls to the measured
// residue.
export const DESKTOP_CONTROL_LABEL_CEILING = 0;

describe('desktop (non-390) control-label ledger (DEC-919 wave-131, v12 mobile campaign)', () => {
  it('non-vacuity: population totals exactly 101 frames -- 75 at width:1600px, 26 modal frames', () => {
    expect(ALL_FRAMES.length).toBe(101);
    const width1600 = ALL_FRAMES.filter((f) => f.width === 1600);
    const modal = ALL_FRAMES.filter((f) => f.width !== 1600);
    expect(width1600.length).toBe(75);
    expect(modal.length).toBe(26);
    for (const f of modal) {
      expect(f.width).toBeGreaterThanOrEqual(420);
      expect(f.width).toBeLessThanOrEqual(640);
    }
  });

  it('non-vacuity: 3 card-signature lines with no width on their own line are excluded by construction, not counted', () => {
    // The "Widths · what a wide monitor gets" explainer panel's three nested
    // demo cards (Chautauqua Overview.dc.html:359/372/400) carry the card
    // signature but their width lives on an ENCLOSING line, not their own --
    // the population's width regex must never reach across lines to find it.
    const full = join(DESIGN_ROOT, 'Chautauqua Overview.dc.html');
    const lines = readFileSync(full, 'utf-8').split('\n');
    for (const lineNo of [359, 372, 400]) {
      const content = lines[lineNo - 1]!;
      expect(content.includes(CARD_SIGNATURE)).toBe(true);
      expect(CARD_WIDTH_RE.test(content)).toBe(false);
    }
    const included = ALL_FRAMES.some(
      (f) => f.fileName === 'Chautauqua Overview.dc.html' && [359, 372, 400].includes(f.line)
    );
    expect(included).toBe(false);
  });

  it('disjointness: the card signature never co-occurs with the phone frame markers (width:390px + height:844)', () => {
    for (const fileName of designFiles()) {
      const full = join(DESIGN_ROOT, fileName);
      const lines = readFileSync(full, 'utf-8').split('\n');
      for (const content of lines) {
        if (content.includes(CARD_SIGNATURE)) {
          expect(content.includes(PHONE_WIDTH_MARKER) && content.includes(PHONE_HEIGHT_MARKER)).toBe(false);
        }
        if (content.includes(PHONE_WIDTH_MARKER) && content.includes(PHONE_HEIGHT_MARKER)) {
          expect(content.includes(CARD_SIGNATURE)).toBe(false);
        }
      }
    }
    // And the phone signature's own border-radius never appears on the same
    // line as this population's card signature (the two card shapes are
    // mutually exclusive geometry, not just mutually exclusive width/height
    // markers).
    for (const f of ALL_FRAMES) {
      const full = join(DESIGN_ROOT, f.fileName);
      const lines = readFileSync(full, 'utf-8').split('\n');
      expect(lines[f.line - 1]!.includes(PHONE_SIGNATURE_MARKER)).toBe(false);
    }
  });

  it('non-vacuity: extracted-label population is large and spans many frames and many source files', () => {
    expect(ALL_LABELS.length).toBeGreaterThan(100);
    const distinctFrames = new Set(ALL_LABELS.map((l) => `${l.fileName}:${l.frameLine}`));
    expect(distinctFrames.size).toBeGreaterThanOrEqual(15);
    expect(SOURCE_FILES.length).toBeGreaterThanOrEqual(100);
  });

  it('non-vacuity: synthetic positive/negative controls over a fabricated single-file population', () => {
    // A fabricated frame extent -- never a real product token -- wearing
    // exactly the three control shapes this scan looks for.
    const fabricatedFrameText = [
      '<div style="display:flex; flex-direction:column">',
      '  <a href="#" style="min-height:44px; display:flex">Zzy Synthetic Anchor</a>',
      '  <span style="background:#4E5C31; color:#F7F9F0; border-radius:4px; min-height:46px; display:flex">Zzy Synthetic Span Present</span>',
      '  <span style="background:#4E5C31; color:#F7F9F0; border-radius:4px; min-height:46px; display:flex">Zzy Synthetic Span Absent</span>',
      '  <div style="flex-shrink:0; border-top:1px solid #1B1D17; background:#EFEBDF; display:flex">',
      '    <div style="flex:1">',
      '      <span>Zzy Synthetic Footer Present</span>',
      '    </div>',
      '  </div>',
      '  <span style="min-height:44px; display:flex">Zzy Synthetic Bare Chip</span>',
      '</div>',
    ].join('\n');

    const extracted = labelsInFrameText(fabricatedFrameText);
    const extractedLabels = extracted.map((e) => e.label);
    expect(extractedLabels).toContain('Zzy Synthetic Anchor');
    expect(extractedLabels).toContain('Zzy Synthetic Span Present');
    expect(extractedLabels).toContain('Zzy Synthetic Span Absent');
    expect(extractedLabels).toContain('Zzy Synthetic Footer Present');
    // NEGATIVE: a bare min-height chip with no border-radius/border/olive
    // background is data-chip noise, not a control face -- never extracted.
    expect(extractedLabels).not.toContain('Zzy Synthetic Bare Chip');

    const fabricatedSource = [
      '// this comment mentions Zzy Synthetic Span Absent and must not satisfy it',
      'const label = "Zzy Synthetic Span Present";',
      'const anchorLabel = "Zzy Synthetic Anchor";',
      'const footerLabel = "Zzy Synthetic Footer Present";',
    ].join('\n');
    const normalized = [normalizeSource(fabricatedSource)];

    // POSITIVE: present in normalized source is matched.
    expect(labelIsMatched('Zzy Synthetic Span Present', normalized)).toBe(true);
    expect(labelIsMatched('Zzy Synthetic Anchor', normalized)).toBe(true);
    expect(labelIsMatched('Zzy Synthetic Footer Present', normalized)).toBe(true);
    // NEGATIVE: absent from real code (only inside a stripped comment) is
    // correctly flagged as unmatched.
    expect(labelIsMatched('Zzy Synthetic Span Absent', normalized)).toBe(false);
  });

  it('extent grammar: every graded (width-bearing) card resolves to its own immediately-preceding title', () => {
    // Sanity check on the ported population grammar over the real pack:
    // unlike the pack's excluded (no on-line width) explainer-panel demo
    // cards -- which DO share one title across several nested cards -- every
    // GRADED card in the measured 101-frame population turns out to sit
    // directly under its own title span, one-to-one. This is a measured
    // fact about the current pack, asserted so a re-cut that introduces a
    // real shared-title card group is caught rather than silently assumed
    // away by the title-resolution logic.
    const byTitle = new Map<string, number>();
    for (const f of ALL_FRAMES) {
      const key = `${f.fileName}::${f.title}`;
      byTitle.set(key, (byTitle.get(key) ?? 0) + 1);
    }
    const sharedTitles = [...byTitle.values()].filter((n) => n > 1);
    expect(sharedTitles.length).toBe(0);
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

  it(`never exceeds DESKTOP_CONTROL_LABEL_CEILING (${DESKTOP_CONTROL_LABEL_CEILING}) unmatched control labels`, () => {
    if (UNMATCHED.length > DESKTOP_CONTROL_LABEL_CEILING) {
      const offenders = UNMATCHED.map(
        (l) => `${l.fileName}:${l.line} -- "${l.label}" (frame: ${l.frameTitle}, width:${l.frameWidth}px)`
      );
      throw new Error(
        `${UNMATCHED.length} desktop control labels are unmatched by any app source file, above the ceiling of ` +
          `${DESKTOP_CONTROL_LABEL_CEILING}. DESKTOP_CONTROL_LABEL_CEILING may only be RAISED (a merge-train act, ` +
          `never a worker's edit mid-lane), and only once new exclusions or coverage are landed and re-measured. ` +
          `Offenders:\n${offenders.join('\n')}`
      );
    }
    expect(UNMATCHED.length).toBeLessThanOrEqual(DESKTOP_CONTROL_LABEL_CEILING);
  });

  it(`never sits BELOW DESKTOP_CONTROL_LABEL_CEILING (${DESKTOP_CONTROL_LABEL_CEILING}) without the ceiling being lowered to match (a stale ceiling licenses stagnation)`, () => {
    if (UNMATCHED.length < DESKTOP_CONTROL_LABEL_CEILING) {
      throw new Error(
        `${UNMATCHED.length} desktop control labels are unmatched, below the ceiling of ${DESKTOP_CONTROL_LABEL_CEILING}. ` +
          `This is the ratchet working: coverage landed. Lower the ceiling in the same commit (a merge-train ` +
          `act) by replacing the line:\n  export const DESKTOP_CONTROL_LABEL_CEILING = ${UNMATCHED.length};`
      );
    }
    expect(UNMATCHED.length).toBeGreaterThanOrEqual(DESKTOP_CONTROL_LABEL_CEILING);
  });
});
