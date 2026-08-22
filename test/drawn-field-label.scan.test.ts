// Drawn FIELD-LABEL ledger (DEC-613 wave-25, task w25-i).
//
// WHY: DEC-613's own opening names the gap directly -- "No ledger in the
// campaign grades drawn FIELD labels. test/desktop-control-label.scan.
// test.ts and test/frame-control-label.scan.test.ts both derive
// control-shaped populations (footer bands, 44px anchors, painted spans);
// the field-width ledger (test/desktop-field-width.scan.test.ts) reaches
// field labels only as a JOIN KEY and, when the join misses, files an
// honest UNRESOLVED." Two v12 divergences it would have caught (Settings
// Event name/Starts/Ends -- since fixed by wave-24's task w24-e -- and
// Comms "From which plan" -- still open) were found by hand instead of by
// any instrument. Building this instrument found a THIRD, previously
// unrecorded divergence of the same shape (Contacts "Message"/
// BulkEmailModal.tsx's "Body" -- see the DIVERGES map below). This file is
// that instrument. MEASURE AND FILE ONLY: it fixes no divergence and
// touches no product code (task w25-i's own hard clause).
//
//   1. POPULATION, derived from the frames, never from the answers
//      (DEC-180): every `<span style="...">` in docs/design/*.dc.html
//      (readdirSync, never a hand-listed manifest) whose style carries the
//      pack's field-label shape -- `font-size:11px; font-weight:800;
//      letter-spacing:0.1em; text-transform:uppercase` in that literal
//      order (the pack's own consistent authoring order; verified by
//      grepping every font-size:11px style attribute in the tree -- the
//      other weight-800/11px combinations use a different letter-spacing,
//      0.08em/0.09em/0.12em, a DIFFERENT visual register the frames use for
//      pills, badges and mini-eyebrows, not field labels) -- AND whose
//      label text is not a template interpolation (`{{...}}`, DEC-613's own
//      "not an interpolation" clause) -- AND which sits IMMEDIATELY above
//      an input-shaped box: the very next tag in the markup (skipping only
//      whitespace) is a `<div style="...">` whose style carries `border:`.
//      This is the frame's own convention (verified against dozens of
//      sightings): a label span opens a `gap:6px` column wrapper, and the
//      field's bordered value box is its very next sibling. A label
//      followed by anything else -- a plain text span (a display-only
//      heading, e.g. "DevFlow Conf 2027" on the 404 card), a link row
//      ("No account?"), a chip-group wrapper with no border of its own
//      ("Kind", "Stage", "Role" as multi-select chip rows), a `<h1>`, a
//      `sc-for` loop, a mustache-templated wrapper (`{{ q.inputStyle }}`)
//      -- is NOT a field label over an input box and is correctly excluded
//      at the population step itself, not drained later. 121 rows result:
//      100 desktop, 21 phone (390) -- both populations non-empty, per the
//      hard-clause non-vacuity guard below.
//
//   2. GRADE, per row, one of four:
//        - STORED-FIELD-LABEL: the label is organizer-editable FormFieldDef
//          data (a `field.label`/`f.label` read, never a JSX string
//          literal) -- the frame draws the SEED's current label text, not
//          a code-side copy DEC-613 could even grade as hardcoded. Found at
//          two render sites: `src/views/form-render.tsx`'s
//          `{field.label}` (SSR CFP submission form,
//          `src/routes/public/submit-views.tsx`'s speaker/session
//          FormFieldDef sections) and the identical FormFieldsSection path
//          the speaker portal's session-edit form
//          (`src/routes/portal/edit.tsx`) shares with it.
//        - HARDCODED-MATCHES: the frame's label occurs verbatim,
//          boundary-anchored, in the non-test app/src/**+src/** corpus (the
//          SAME normalize+match primitives test/frame-control-label.scan.
//          test.ts already uses, imported from test/frame-source-corpus.ts
//          rather than re-derived -- DEC-613's own trap, one level in) --
//          either as a direct literal, or COMPOSED from a literal base plus
//          a shared, verified constant/expression (the ` · optional`
//          suffix is `src/domain/form-copy.ts`'s `OPTIONAL_SUFFIX`,
//          imported and rendered as a sibling span by both
//          `ModalFrame.tsx`'s `FormRow` and `FieldModal.tsx`'s caller; "What
//          Marcus will read" is `RemindPreviewModal.tsx`'s literal `What
//          {firstNameOf(first.name)} will read` template, "Marcus" being
//          the fixture's own first recipient).
//        - HARDCODED-DIVERGES: a hardcoded label exists for the field, but
//          it is different words than the frame draws.
//        - UNRESOLVED: the join genuinely fails -- no code renders the
//          field at all (a DEVIATIONS.md §6 deferred, unbuilt feature).
//      Every row's grade, reason and citation is individually verified
//      below (this ledger's own non-vacuity requirement: EVERY row is
//      accounted for exactly once, not just the aggregate counts).
//
//   3. CEILINGS, two-sided per DEC-808, seeded at the MEASURED value on
//      this branch (never guessed, never 0): DRAWN_FIELD_LABEL_DIVERGENCE_
//      CEILING=5, DRAWN_FIELD_LABEL_UNRESOLVED_CEILING=1. Registered in
//      scripts/exit-predicate.ts's OUT_OF_CAMPAIGN_SCOPE only, the SAME
//      disposition FIELD_WIDTH_DIVERGENCE_CEILING/FIELD_WIDTH_UNRESOLVED_
//      CEILING already carry: a newly measured population must not move
//      the campaign's exit-gate goalposts mid-convergence (task w25-i's
//      own MEASURE-AND-FILE-ONLY scope: this lane fixes no divergence).
//
//   4. SCOPE NOTE (task w25-i's hard clause 3): measured on THIS branch
//      (v12m-w25-i, forked from main at the wave-25 planning point). Lanes
//      w25-c, w25-h and v12m-w24-e are repairing product code concurrently
//      on their OWN branches this same wave; none of their edits are on
//      this worktree, so every grade below reflects what THIS branch's
//      tree actually renders, not a claim about main after those lanes
//      land.
//
// LEDGER: docs/design/audit/drawn-field-label-v12.md records the whole
// drawn population by file, each row's grade, reason and citation.
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  isInsideADesktopFrame,
  isInsideAPhoneFrame,
} from '../app/src/frame-citation-frames';
import { enumerateSourceFiles, labelIsMatched, normalizeSource } from './frame-source-corpus';

const HERE = dirname(fileURLToPath(import.meta.url)); // test/
const REPO_ROOT = join(HERE, '..');
const DESIGN_ROOT = join(REPO_ROOT, 'docs', 'design');

// ---------------------------------------------------------------------------
// 1. POPULATION.
// ---------------------------------------------------------------------------

function designFiles(): string[] {
  return readdirSync(DESIGN_ROOT, { withFileTypes: true })
    .filter((e) => e.isFile() && e.name.endsWith('.dc.html'))
    .map((e) => e.name)
    .sort();
}

export interface DrawnFieldLabel {
  fileName: string;
  line: number;
  label: string;
}

const FIELD_LABEL_SPAN_RE =
  /<span\s+style="([^"]*font-size:11px;\s*font-weight:800;\s*letter-spacing:0\.1em;\s*text-transform:uppercase[^"]*)"[^>]*>([^<]*)<\/span>/g;

/** True when the text immediately following a candidate label span's own
 * closing tag (only whitespace may intervene) opens a `<div style="...">`
 * whose style carries `border:` -- the frame's own "label span immediately
 * above a bordered value box" convention. Exported so the non-vacuity
 * fixture below can drive this exact function over a fabricated tail. */
export function tailOpensInputBox(tailText: string): boolean {
  const window = tailText.slice(0, 400);
  const m = window.match(/^\s*<div\s+style="([^"]*)"/);
  return !!m && m[1]!.includes('border:');
}

/** Every drawn field-label span in one file's raw text, extracted via the
 * regex above. Exported so the non-vacuity fixture below can drive this
 * exact function over a fabricated document, never a real product token. */
export function drawnFieldLabelsInText(fileName: string, content: string): DrawnFieldLabel[] {
  const out: DrawnFieldLabel[] = [];
  FIELD_LABEL_SPAN_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = FIELD_LABEL_SPAN_RE.exec(content))) {
    const label = m[2]!.trim();
    if (label.includes('{{')) continue; // DEC-613: not an interpolation
    const tail = content.slice(m.index + m[0].length);
    if (!tailOpensInputBox(tail)) continue;
    const before = content.slice(0, m.index).split('\n');
    out.push({ fileName, line: before.length, label });
  }
  return out;
}

function drawnFieldLabelsInFile(fileName: string): DrawnFieldLabel[] {
  const content = readFileSync(join(DESIGN_ROOT, fileName), 'utf-8');
  return drawnFieldLabelsInText(fileName, content);
}

const ALL_ROWS: DrawnFieldLabel[] = designFiles().flatMap(drawnFieldLabelsInFile);

// ---------------------------------------------------------------------------
// 2. GRADE.
// ---------------------------------------------------------------------------

export type FieldLabelStatus = 'stored' | 'matches' | 'diverges' | 'unresolved';

export interface GradedFieldLabel {
  row: DrawnFieldLabel;
  status: FieldLabelStatus;
  reason: string;
  citation: string;
}

/** Hand-investigated exceptions (task w25-i), keyed `fileName:line`. Every
 * row NOT in one of these four maps falls through to the generic corpus
 * literal-match check below and grades `matches`/`unresolved` on that
 * basis alone. Each exception's reason and citation was individually
 * verified against this branch's tree (never guessed) -- see the ledger
 * doc for the full investigation trail per row. */

const STORED: Record<string, { reason: string; citation: string }> = {
  'Chautauqua Public and Portal.dc.html:608': {
    reason:
      'Session title is a locked FormFieldDef rendered by FormFieldsSection inside the ' +
      'speaker-portal session-edit form -- the SAME dynamic field.label path the public CFP ' +
      'submission form uses, not a JSX string literal.',
    citation: 'src/routes/portal/edit.tsx`<FormFieldsSection fields={data.fields} section="session"`',
  },
  'Chautauqua Public and Portal.dc.html:918': {
    reason: 'Session title on the public submission form is `f.label` off the session FormFieldDef.',
    citation: 'src/routes/public/submit-views.tsx`const sessionFields = displayFields.filter((f) => f.section === "session");`',
  },
  'Chautauqua Public and Portal.dc.html:962': {
    reason:
      '"Notes for reviewers" is a session FormFieldDef whose LABEL the code never overrides -- only ' +
      'its placeholder is special-cased by exact label match, itself proof the label is read from ' +
      'the field, not hardcoded.',
    citation: 'src/routes/public/submit-views.tsx`if (f.label === "Notes for reviewers") {`',
  },
  'Chautauqua Public and Portal.dc.html:967': {
    reason: '"Accessibility needs" is a session FormFieldDef, same mechanism as "Notes for reviewers" above.',
    citation: 'src/routes/public/submit-views.tsx`if (f.label === "Accessibility needs") {`',
  },
  'Chautauqua Public and Portal.dc.html:979': {
    reason:
      'The collapsed speaker "Name" control is a locked FormFieldDef pair (first_name/last_name) ' +
      'presented as one field by the public submission form (DEC-986 wave-45 amendment).',
    citation:
      'src/routes/public/submit-views.tsx`const firstNameField = byLockedName("first_name");`',
  },
  'Chautauqua Public and Portal.dc.html:983': {
    reason: 'Speaker email is a locked FormFieldDef read by the same byLockedName join as Name above.',
    citation: 'src/routes/public/submit-views.tsx`const emailField = byLockedName("email");`',
  },
  'Chautauqua Public and Portal.dc.html:987': {
    reason: 'Speaker company is a locked FormFieldDef, same byLockedName join.',
    citation: 'src/routes/public/submit-views.tsx`const companyField = byLockedName("company");`',
  },
  'Chautauqua Public and Portal.dc.html:991': {
    reason: 'Speaker job title is a locked FormFieldDef, same byLockedName join.',
    citation: 'src/routes/public/submit-views.tsx`const jobTitleField = byLockedName("job_title");`',
  },
  'Chautauqua Public and Portal.dc.html:995': {
    reason:
      'Speaker bio is a locked FormFieldDef whose stored label ships as-is (DEC-613 wave-19: no ' +
      'label override remains for it).',
    citation: 'src/routes/public/submit-views.tsx`if (lockedFieldName(f.id) === "bio") {`',
  },
  'Chautauqua Public and Portal.dc.html:1031': {
    reason: 'Same session-title FormFieldDef as row 918, a second drawn instance of the same submit form.',
    citation: 'src/routes/public/submit-views.tsx`const sessionFields = displayFields.filter((f) => f.section === "session");`',
  },
  'Chautauqua Public and Portal.dc.html:1240': {
    reason: 'Same session-title FormFieldDef as row 918, drawn on the "rejected on submit" refusal variant.',
    citation: 'src/routes/public/submit-views.tsx`const sessionFields = displayFields.filter((f) => f.section === "session");`',
  },
  'Chautauqua Public and Portal.dc.html:1269': {
    reason: 'Same collapsed speaker Name FormFieldDef pair as row 979, on the refusal variant.',
    citation: 'src/routes/public/submit-views.tsx`const firstNameField = byLockedName("first_name");`',
  },
  'Chautauqua Public and Portal.dc.html:1273': {
    reason: 'Same speaker-email FormFieldDef as row 983, on the refusal variant.',
    citation: 'src/routes/public/submit-views.tsx`const emailField = byLockedName("email");`',
  },
  'Chautauqua Public and Portal.dc.html:1278': {
    reason: 'Same speaker-company FormFieldDef as row 987, on the refusal variant.',
    citation: 'src/routes/public/submit-views.tsx`const companyField = byLockedName("company");`',
  },
  'Chautauqua Public and Portal.dc.html:1282': {
    reason: 'Same speaker-job-title FormFieldDef as row 991, on the refusal variant.',
    citation: 'src/routes/public/submit-views.tsx`const jobTitleField = byLockedName("job_title");`',
  },
  'Chautauqua Public and Portal.dc.html:1393': {
    reason: 'Same session-title FormFieldDef as row 918, drawn on the desktop "Edit your session" variant.',
    citation: 'src/routes/portal/edit.tsx`<FormFieldsSection fields={data.fields} section="session"`',
  },
};

const DIVERGES: Record<string, { reason: string; citation: string }> = {
  'Chautauqua Comms.dc.html:102': {
    reason:
      'DEC-613\'s own named, still-open outlier: the frame draws "From which plan" but the compose ' +
      'wizard\'s control reads "Evaluation plan" -- different words, same field.',
    citation: 'app/src/pages/comms/ComposeWizard.tsx`Evaluation plan`',
  },
  'Chautauqua Settings.dc.html:739': {
    reason:
      'Blessed, recorded divergence (docs/design/DEVIATIONS.md §7): the frame\'s "Public URL" names a ' +
      'composed origin+slug value the control does not accept -- EventSettingsPanel.tsx keeps the ' +
      'field labeled "Slug", the segment it actually edits.',
    citation: 'app/src/pages/settings/EventSettingsPanel.tsx`value={form.slug}`',
  },
  'Chautauqua Settings.dc.html:1253': {
    reason:
      'The same Event-panel "Public URL"/"Slug" divergence as :739, redrawn on the panel\'s ' +
      '"Nothing was saved" duplicate-slug error-state frame -- same field, same blessed divergence ' +
      '(docs/design/DEVIATIONS.md §7).',
    citation: 'app/src/pages/settings/EventSettingsPanel.tsx`value={form.slug}`',
  },
  'Chautauqua Contacts.dc.html:562': {
    reason:
      'The bulk-email dialog\'s frame draws a "Message" eyebrow over the body textarea, but ' +
      'BulkEmailModal.tsx labels the same control "Body" -- different words, same field. Found by ' +
      'this ledger\'s own boundary-anchored corpus search coincidentally landing on an unrelated ' +
      '"Message-ID:" mail header literal in src/mail/email-binding.ts before this real divergence was ' +
      'hand-verified.',
    citation: 'app/src/pages/contacts/BulkEmailModal.tsx`<FormRow label="Body" htmlFor="bulk-email-body" error={fieldErrors.bodyText}>`',
  },
  'Chautauqua Settings.dc.html:1429': {
    reason:
      'The frame draws a generic instruction label ("Type the file name to confirm") over a box ' +
      'holding the actual filename; ConfirmDialog\'s irreversible-weight prompt instead composes the ' +
      'phrase directly INTO the label text itself -- different words, not a formatting variant.',
    citation: 'app/src/components/ConfirmDialog.tsx`{`Type "${confirmPhrase}" to confirm`}`',
  },
};

const UNRESOLVED: Record<string, { reason: string; citation: string }> = {
  'Chautauqua Settings.dc.html:1173': {
    reason:
      'Falls inside the "Settings · editing your data" extent\'s "Keeping and deleting" retention ' +
      'block, which DEVIATIONS.md §6 / DEC-032 record as a deliberate, deferred non-build (the same ' +
      'extent test/desktop-field-width.scan.test.ts already excludes at its own population step) -- ' +
      'there is no code to grade this label against.',
    citation: 'app/src/pages/settings/YourDataPanel.tsx`Recorded as a deliberate non-build on DEC-032.`',
  },
};

/** COMPOSED matches: the corpus-wide literal search below cannot find these
 * because the rendered string is assembled from two separate JSX
 * expressions (a label + a shared suffix constant, or a template literal
 * with a dynamic name) rather than written as one literal -- verified by
 * hand per task w25-i, not re-derived by a second parser (DEC-613). */
const COMPOSED: Record<string, { reason: string; citation: string }> = {
  'Chautauqua Contacts.dc.html:838': {
    reason:
      'Composed from FormRow\'s literal label="Company" plus the shared OPTIONAL_SUFFIX constant ' +
      '(" · optional") both concatenate to render, sibling <span> elements rather than one literal ' +
      'string, so the corpus-wide literal search cannot find it as one token.',
    citation: 'app/src/pages/contacts/NewContactModal.tsx`<FormRow label="Company" htmlFor="new-contact-company" error={fields.company} optional>`',
  },
  'Chautauqua Contacts.dc.html:842': {
    reason: 'Same FormRow optional-suffix composition as :838, label="Title".',
    citation: 'app/src/pages/contacts/NewContactModal.tsx`<FormRow label="Title" htmlFor="new-contact-title" error={fields.title} optional>`',
  },
  'Chautauqua Speakers.dc.html:516': {
    reason:
      'RemindPreviewModal composes the literal template `What ${firstNameOf(first.name)} will read` ' +
      '-- "Marcus" is the reminder-preview fixture\'s own first recipient, not a hardcoded name.',
    citation: 'app/src/pages/speakers/RemindPreviewModal.tsx`<div className="chq-speakers-modal-label">What {firstNameOf(first.name)} will read</div>`',
  },
  'Chautauqua Submissions.dc.html:684': {
    reason: 'FieldModal composes label="Help text" plus the same shared OPTIONAL_SUFFIX constant as the Contacts rows above.',
    citation: 'app/src/pages/forms/FieldModal.tsx`<FormRow label="Help text" htmlFor="field-help-text" optional>`',
  },
};

const SOURCE_FILES = enumerateSourceFiles(join(REPO_ROOT, 'app', 'src')).concat(
  enumerateSourceFiles(join(REPO_ROOT, 'src'))
);
const NORMALIZED_BLOBS: string[] = SOURCE_FILES.map((f) => normalizeSource(readFileSync(f, 'utf-8')));

function gradeRow(row: DrawnFieldLabel): GradedFieldLabel {
  const key = `${row.fileName}:${row.line}`;
  const stored = STORED[key];
  if (stored) return { row, status: 'stored', reason: stored.reason, citation: stored.citation };
  const diverges = DIVERGES[key];
  if (diverges) return { row, status: 'diverges', reason: diverges.reason, citation: diverges.citation };
  const unresolved = UNRESOLVED[key];
  if (unresolved) return { row, status: 'unresolved', reason: unresolved.reason, citation: unresolved.citation };
  const composed = COMPOSED[key];
  if (composed) return { row, status: 'matches', reason: composed.reason, citation: composed.citation };
  if (labelIsMatched(row.label, NORMALIZED_BLOBS)) {
    return {
      row,
      status: 'matches',
      reason: 'occurs verbatim, boundary-anchored, in the non-test app/src/**+src/** corpus.',
      citation: 'see docs/design/audit/drawn-field-label-v12.md for this row\'s specific source citation',
    };
  }
  // Should be unreachable: every row this branch's population produces
  // that isn't a corpus literal match is hand-classified above. A future
  // wave's re-cut of the pack landing a genuinely new, ungraded row lands
  // here honestly rather than silently mis-grading it as a match.
  return {
    row,
    status: 'unresolved',
    reason: 'no boundary-anchored literal match in the corpus, and not hand-investigated by task w25-i.',
    citation: 'none -- ungraded row, see task w25-i notes',
  };
}

const GRADED: GradedFieldLabel[] = ALL_ROWS.map(gradeRow);
const STORED_ROWS = GRADED.filter((r) => r.status === 'stored');
const MATCHES_ROWS = GRADED.filter((r) => r.status === 'matches');
const DIVERGES_ROWS = GRADED.filter((r) => r.status === 'diverges');
const UNRESOLVED_ROWS = GRADED.filter((r) => r.status === 'unresolved');

// ---------------------------------------------------------------------------
// 3. RATCHETS. Both measured on this branch by counting the graded rows
// above -- never guessed, never seeded at 0 (DEC-808). Registered in
// scripts/exit-predicate.ts's OUT_OF_CAMPAIGN_SCOPE, mirroring
// FIELD_WIDTH_DIVERGENCE_CEILING/FIELD_WIDTH_UNRESOLVED_CEILING's own
// reasoning.
// ---------------------------------------------------------------------------
export const DRAWN_FIELD_LABEL_DIVERGENCE_CEILING = 5;
export const DRAWN_FIELD_LABEL_UNRESOLVED_CEILING = 1;

describe('drawn FIELD-label ledger (DEC-613 wave-25, v12 mobile campaign, task w25-i)', () => {
  it('non-vacuity: population is non-empty and resolves from BOTH desktop and 390 frames', () => {
    expect(ALL_ROWS.length).toBe(121);
    const phoneRows = ALL_ROWS.filter((r) => isInsideAPhoneFrame(r.fileName, r.line));
    const desktopRows = ALL_ROWS.filter((r) => isInsideADesktopFrame(r.fileName, r.line));
    expect(phoneRows.length).toBeGreaterThan(0);
    expect(desktopRows.length).toBeGreaterThan(0);
    // Every row resolves to exactly one of the two -- no orphan extent.
    expect(phoneRows.length + desktopRows.length).toBe(ALL_ROWS.length);
  });

  it('non-vacuity: synthetic positive/negative extraction over fabricated fixtures', () => {
    const fabricated = [
      '<div style="display:flex; flex-direction:column; gap:6px">',
      '  <span style="font-size:11px; font-weight:800; letter-spacing:0.1em; text-transform:uppercase; color:#565A4B">Zzy Field</span>',
      '  <div style="border:1px solid #BAB6A6; border-radius:4px; min-height:46px">Zzy value</div>',
      '</div>',
      '<div style="display:flex; flex-direction:column; gap:6px">',
      '  <span style="font-size:11px; font-weight:800; letter-spacing:0.1em; text-transform:uppercase">Zzy heading</span>',
      '  <span style="font-size:28px">Not a box</span>',
      '</div>',
      '<span style="font-size:11px; font-weight:800; letter-spacing:0.1em; text-transform:uppercase">Zzy interpolated {{ x.y }}</span>',
      '<span style="font-size:11px; font-weight:800; letter-spacing:0.08em; text-transform:uppercase">Zzy wrong spacing</span>',
      '<div style="border:1px solid #000">Zzy value 2</div>',
    ].join('\n');
    const rows = drawnFieldLabelsInText('fixture.dc.html', fabricated);
    // POSITIVE: exactly the one real field label over a bordered box.
    expect(rows.length).toBe(1);
    expect(rows[0]!.label).toBe('Zzy Field');
    // NEGATIVE checks, direct:
    expect(tailOpensInputBox('<span style="font-size:28px">Not a box</span>')).toBe(false);
    expect(tailOpensInputBox('<div style="border:1px solid #000">box</div>')).toBe(true);
    expect(tailOpensInputBox('<div style="min-height:46px">no border</div>')).toBe(false);
  });

  it('every row is accounted for exactly once across stored/matches/diverges/unresolved', () => {
    expect(GRADED.length).toBe(ALL_ROWS.length);
    expect(STORED_ROWS.length + MATCHES_ROWS.length + DIVERGES_ROWS.length + UNRESOLVED_ROWS.length).toBe(
      ALL_ROWS.length
    );
  });

  it('every graded row carries a non-empty reason and citation (no silent grade)', () => {
    for (const r of GRADED) {
      expect(r.reason.length).toBeGreaterThan(0);
      expect(r.citation.length).toBeGreaterThan(0);
    }
  });

  it('DEC-613\'s own two named outliers grade as this file predicts', () => {
    const fromWhichPlan = GRADED.find(
      (r) => r.row.fileName === 'Chautauqua Comms.dc.html' && r.row.label === 'From which plan'
    );
    expect(fromWhichPlan?.status).toBe('diverges');
    const eventName = GRADED.find(
      (r) => r.row.fileName === 'Chautauqua Settings.dc.html' && r.row.label === 'Event name'
    );
    // wave-24's task w24-e already renamed EventSettingsPanel.tsx's label
    // to match the frame verbatim -- this ledger measures that as a match,
    // not a stale divergence.
    expect(eventName?.status).toBe('matches');
  });

  it(`never exceeds DRAWN_FIELD_LABEL_DIVERGENCE_CEILING (${DRAWN_FIELD_LABEL_DIVERGENCE_CEILING}) resolved divergences`, () => {
    if (DIVERGES_ROWS.length > DRAWN_FIELD_LABEL_DIVERGENCE_CEILING) {
      const rows = DIVERGES_ROWS.map(
        (r) => `${r.row.fileName}:${r.row.line} "${r.row.label}" -- ${r.reason} (${r.citation})`
      );
      throw new Error(
        `${DIVERGES_ROWS.length} drawn field-label divergences, above the ceiling of ` +
          `${DRAWN_FIELD_LABEL_DIVERGENCE_CEILING}. DRAWN_FIELD_LABEL_DIVERGENCE_CEILING may only be ` +
          `RAISED (a merge-train act, never a worker's edit mid-lane). Divergences:\n${rows.join('\n')}`
      );
    }
    expect(DIVERGES_ROWS.length).toBeLessThanOrEqual(DRAWN_FIELD_LABEL_DIVERGENCE_CEILING);
  });

  it(`never sits BELOW DRAWN_FIELD_LABEL_DIVERGENCE_CEILING (${DRAWN_FIELD_LABEL_DIVERGENCE_CEILING}) without the ceiling being lowered to match (a stale ceiling licenses stagnation)`, () => {
    if (DIVERGES_ROWS.length < DRAWN_FIELD_LABEL_DIVERGENCE_CEILING) {
      throw new Error(
        `${DIVERGES_ROWS.length} drawn field-label divergences, below the ceiling of ` +
          `${DRAWN_FIELD_LABEL_DIVERGENCE_CEILING}. Lower the ceiling in the same commit by replacing ` +
          `the line:\n  export const DRAWN_FIELD_LABEL_DIVERGENCE_CEILING = ${DIVERGES_ROWS.length};`
      );
    }
    expect(DIVERGES_ROWS.length).toBeGreaterThanOrEqual(DRAWN_FIELD_LABEL_DIVERGENCE_CEILING);
  });

  it(`never exceeds DRAWN_FIELD_LABEL_UNRESOLVED_CEILING (${DRAWN_FIELD_LABEL_UNRESOLVED_CEILING}) unresolved rows`, () => {
    if (UNRESOLVED_ROWS.length > DRAWN_FIELD_LABEL_UNRESOLVED_CEILING) {
      const rows = UNRESOLVED_ROWS.map((r) => `${r.row.fileName}:${r.row.line} "${r.row.label}" -- ${r.reason}`);
      throw new Error(
        `${UNRESOLVED_ROWS.length} drawn field-label rows are unresolved, above the ceiling of ` +
          `${DRAWN_FIELD_LABEL_UNRESOLVED_CEILING}. DRAWN_FIELD_LABEL_UNRESOLVED_CEILING may only be ` +
          `RAISED (a merge-train act, never a worker's edit mid-lane). Unresolved:\n${rows.join('\n')}`
      );
    }
    expect(UNRESOLVED_ROWS.length).toBeLessThanOrEqual(DRAWN_FIELD_LABEL_UNRESOLVED_CEILING);
  });

  it(`never sits BELOW DRAWN_FIELD_LABEL_UNRESOLVED_CEILING (${DRAWN_FIELD_LABEL_UNRESOLVED_CEILING}) without the ceiling being lowered to match (a stale ceiling licenses stagnation)`, () => {
    if (UNRESOLVED_ROWS.length < DRAWN_FIELD_LABEL_UNRESOLVED_CEILING) {
      throw new Error(
        `${UNRESOLVED_ROWS.length} drawn field-label rows are unresolved, below the ceiling of ` +
          `${DRAWN_FIELD_LABEL_UNRESOLVED_CEILING}. Lower the ceiling in the same commit by replacing ` +
          `the line:\n  export const DRAWN_FIELD_LABEL_UNRESOLVED_CEILING = ${UNRESOLVED_ROWS.length};`
      );
    }
    expect(UNRESOLVED_ROWS.length).toBeGreaterThanOrEqual(DRAWN_FIELD_LABEL_UNRESOLVED_CEILING);
  });
});
