// Desktop drawn-floor ledger (DEC-393 wave-151 amendment; task w7-db).
//
// DEC-393's wave-147 amendment ruled a ledger keying each PHONE
// (width:390) frame's drawn `min-height:NNpx` control to the product rule
// that carries it, and scoped it there deliberately. A frame-context
// census on main (DEC-393 wave-151 amendment) showed the DESKTOP half is
// the LARGER ungraded population: inside desktop frames the pack draws
// `min-height:46px` far more often than `min-height:44px`, and the field
// box the pack draws 91 times across the whole pack --
// `border:1px solid #BAB6A6; border-radius:Npx; background:#FAF8F2` -- is
// drawn at 46px while app/src/styles.css's `.chq-input, .chq-select,
// .chq-textarea` is byte-identical to it except `min-height: 44px`. The
// campaign's goal sentence is "every screen matches its v12 frame on
// desktop AND phone", and the desktop half of that sentence had NO
// geometry instrument: test/desktop-frame-ledger.scan.test.ts grades
// whether a test CITES a frame, test/desktop-control-label.scan.test.ts
// grades the WORDS on controls. This is that instrument -- it MEASURES and
// RATCHETS only, and changes not one product CSS byte.
//
//   1. POPULATION: the identical readdirSync docs/design enumeration and
//      nearest-preceding `font-size:19px ... >TITLE</span>` label/extent
//      walk test/desktop-frame-ledger.scan.test.ts uses (ported here, never
//      imported -- that file is owned by a sibling lane), keeping only the
//      frames whose extent carries NO `width:390px`+`height:844` line
//      (that file's own `isPhone` split, derived, never by naming files).
//      WAVE 33 (DEC-651) adds a second population-step filter, same
//      derivation style: any frame whose title begins `States · ` is a
//      component swatch panel, never a page, so its rows are dropped too
//      (`isStatesSwatchFrameTitle`/`populatedFrames`). Inside each surviving
//      extent, a DRAWN CONTROL is any element whose attribute string carries
//      `min-height:NNpx` AND `border-radius` AND (`border:` OR
//      `background:`), plus any `<a ...min-height:NNpx...>` (the anchor case
//      needs only the min-height, per the task's own grammar -- an anchor is
//      a control shape DESIGN-RULINGS/DEC-393 already treat specially, never
//      requiring a painted face). Recorded as (fileName, line, drawnFloor,
//      label). MEASURED: 266 drawn controls pre-WAVE-33 across 12 of the 13
//      files (docs/design/Chautauqua Docs.dc.html draws none of this
//      shape); 247 post-WAVE-33 (19 States-swatch rows excluded).
//
//   2. JOIN: for each drawn control, every boundary-anchored occurrence of
//      its label (`allBoundaryMatches`, mirroring ./frame-source-corpus's
//      own boundary algorithm but returning EVERY position, not `labelIsMatched`'s
//      single boolean) over the normalized non-test app/src/** + src/**
//      corpus (`enumerateSourceFiles` + `normalizeSource`, skipping the
//      decision registry via `isDecisionRegistryFile` -- DEC-967's
//      one-stripper rule, DEC-976 wave-129 amendment (c)) is kept ONLY when
//      `ownTextEquals` confirms the enclosing tag's own text content -- the
//      run from the nearest preceding `>` to the next `<` -- normalises to
//      EXACTLY the label, never merely CONTAINS it: "the element whose own
//      text content IS the label" (DEC-393 wave-157 amendment). At each
//      surviving position, the enclosing tag's `class=`/`className=`
//      attribute is read (quoted string, `{...}` expression, or template
//      literal -- any syntax, the reader only pulls `chq-` tokens out of
//      the captured attribute-value span) and its `chq-` tokens extracted;
//      tokens from every surviving position across every blob are UNIONED
//      (not the first match per blob, as the pre-repair join did). A
//      position is also REJECTED when the text between the nearest
//      preceding `>` and the match still contains an unclosed `<` -- that
//      shape means the match landed inside an as-yet-unclosed tag's OWN
//      attribute value (e.g. `aria-label="File type"`), not in real
//      rendered text content.
//
//      WAVE 157 REPAIR (DEC-393 amendment, task rb): the pre-repair join's
//      "first occurrence per blob, substring match" shape MIS-ATTRIBUTED
//      two rows. `Chautauqua Account.dc.html`:225's "Back to sign in" (a
//      filled 46px primary) resolved to `chq-auth-tertiary`: the FIRST
//      "Back to sign in" occurrence in src/routes/auth-views.tsx is
//      `&lsaquo; Back to sign in` on a DIFFERENT page's tertiary link,
//      never the LATER plain-text "Back to sign in" on the real
//      `chq-btn chq-btn-primary` anchor. `Chautauqua Submissions.dc.html`:314's
//      "Waitlist" resolved to `chq-overview-btn chq-overview-btn-waitlist`:
//      a real, own-text-exact "Waitlist" button, but Overview's queue move
//      (already phone-hidden, wave-83 receipt), not
//      `SubmissionDetailPage.tsx`'s decision-rail `chq-btn chq-btn-secondary`
//      (whose own rendered text is a JSX expression, never a literal
//      "Waitlist" this scan's text-only join can resolve). Requiring FULL
//      own-text equality (this repair) rejects the "Back to sign in"
//      mis-match and correctly resolves that row to `chq-btn`/
//      `chq-btn-primary`; it cannot relocate "Waitlist" (no literal-text
//      element renders it on the real control), so that row stays
//      attributed to Overview's button -- the ONE genuine survivor this
//      wave's product fix targets (see `app/src/pages/submissions/detail.css`).
//
//   3. GRADE: each `chq-` token found is resolved to its declared
//      `min-height` from any TOP-LEVEL (non-`@media`) rule mentioning it
//      as a class selector anywhere in the app/src/** + src/** corpus --
//      `@media` blocks are stripped before rule extraction (DEC-385:
//      desktop is the base/unqualified declaration, a `max-width` block
//      only narrows it, so the desktop-grading value is never inside one).
//      The MAXIMUM declared min-height across every qualifying rule and
//      every token found is the row's resolved floor. A row is graded
//      UNRESOLVED, never OFFENDER, when: no own-text match exists at all;
//      a match exists but no `chq-` token was extracted; every extracted
//      token's qualifying rule(s) declare no min-height AND none is
//      CONTROL-SHAPED -- its own top-level rule declares a border, a
//      background, a padding-inline, or a min-height, EXCLUDING a bare
//      `border: none`/`background: none`/`transparent`/`0`/`0px` reset
//      (DEC-393 wave-157 amendment (iii): a typography/eyebrow class the
//      pack happens to draw inside a bordered chip -- `.chq-page-title`,
//      `.chq-section-label`, a table-column-label class -- is not the app
//      rendering a control, and grading it OFFENDER at 0 would assert a
//      gap that does not exist). An OFFENDER is a row WITH a control-shaped
//      resolved token that still declares strictly below the drawn floor
//      (an unstyled-height rule counts as declaring 0).
//
//      MEASURED (wave 151, pre-repair): 23 offenders, 129 unresolved.
//      WAVE 155 (DEC-393 amendment, task pe) split the 23 into 12
//      field-name-eyebrow rows (BLESSED as a class in
//      docs/design/DEVIATIONS.md, unchanged by this repair) and 11
//      real-control rows, 9 DRAINED by four scoped desktop rules, 2 left
//      live ("Back to sign in", "Waitlist") -- 14 offenders post-drain.
//      WAVE 157 REPAIR (this file, task rb): re-running the SAME 14-row
//      population through the repaired join/grade -- own-text-exact
//      matching plus the control-shape gate -- resolves "Back to sign in"
//      to `chq-btn`/`chq-btn-primary` (declared 48px via a compound
//      `.chq-bare-page .chq-btn-primary` rule the token-boundary JOIN
//      matches context-blind, already >= the drawn 46px: OK, no CSS
//      moved, `.chq-btn-primary` itself untouched) and reclassifies 10 of
//      the 12 blessed eyebrow rows from OFFENDER to UNRESOLVED (reason
//      `no-control-shape` -- an honest "cannot tell" instead of an
//      asserted-and-then-waived false divergence; two of the twelve,
//      `Chautauqua Contacts.dc.html`:602 and `Chautauqua Settings.dc.html`:1302
//      "Reviewer", instead resolve via the widened own-text-exact search
//      to a NEW, real, control-shaped token -- `chq-pill`, the role-invite
//      chip in `PeopleRolesPanel.tsx` -- and surface as GENUINE new
//      offenders, recorded (never silently drained) in
//      docs/design/audit/desktop-control-floor-v12.md). "Waitlist" stays
//      the one row this repair cannot relocate; its product fix is the one
//      authorised CSS byte in `app/src/pages/submissions/detail.css`.
//      MEASURED (wave 157, post-repair): 3 offenders (2 newly-surfaced
//      `chq-pill` rows, recorded not drained, plus "Waitlist" -- the CSS
//      fix floors the REAL control this frame draws, but the join still
//      resolves this row's tokens to Overview's button, so the ledger's
//      own count cannot move; see the audit doc), 166 unresolved (155
//      no-label-match, 1 no-token, 10 no-control-shape).
//
//      WAVE 156 (DEC-393 amendment, clause (a), task qg): the wave-155
//      amendment's own drain -- "Sign in" -- resolved the offender list to
//      14, but DIDN'T add a machine-checked guard for the 12 label-eyebrow
//      rows clause (a) names; they still graded OFFENDER by luck of not yet
//      being re-measured. This wave adds that guard to `gradeControl`
//      itself: an OFFENDER additionally requires at least one resolved
//      token whose own top-level rule is CONTROL-SHAPED (declares `border:`,
//      `background:`, `padding-inline:`, or `min-height:` -- literal
//      property names only, never `-\w+`-suffixed variants like
//      `border-bottom`, which is a typography underline accent, not a
//      control box). Control-shapedness is read off the rule's SELECTOR too:
//      a token only "owns" a rule when it is the rightmost (own-element)
//      compound of a comma-separated selector -- `.chq-detail-section-title
//      button { background: none; border: none; ... }` resets a NESTED
//      reset-button, not the label's own box, and wrongly graded
//      `chq-detail-section-title` (and therefore Speakers.dc.html:209
//      "Form") control-shaped before this refinement. A token set that is
//      wholly typography/column registers grades `unresolved`/
//      `no-control-shape` instead of `offender`. MEASURED post-corroboration
//      (this branch, forcing both ceilings to -1): 1 offender ("Waitlist",
//      Chautauqua Submissions.dc.html:314 -- the sole real, uncorroborated
//      divergence; "Back to sign in" was already drained by wave-155's own
//      four scoped-rule fixes), 142 unresolved (129 + the 13 rows this
//      clause reclassifies: the 12 clause-(a) eyebrows plus
//      Chautauqua Contacts.dc.html:601 "Speaker", which the wave-155 prose
//      did not name but which the same control-shapedness test resolves
//      identically). Full per-row breakdown in
//      docs/design/audit/desktop-control-floor-v12.md. This wave changes
//      not one product CSS byte -- test/docs only, per its own task scope.
//
//      WAVE 159 (DEC-393 wave-156 clauses (b)/(c), task qh, chained on qg):
//      re-measured on THIS branch (forcing the ceiling to -1) rather than
//      trusting the wave-156/157 prose above, which was written against an
//      earlier tree state: the live offender list is THREE rows, not one --
//      `Chautauqua Contacts.dc.html:602`/`Chautauqua Settings.dc.html:1302`,
//      both labelled "Reviewer" and both resolving to `[chq-pill]`, plus
//      the already-discussed `Chautauqua Submissions.dc.html:314`
//      "Waitlist". Hand-checked all three against the source, mirroring
//      wave-157's own mis-attribution audit: `Chautauqua Settings.dc.html:1302`
//      ("Invite someone" modal) is the GENUINE match -- PeopleRolesPanel.tsx
//      is mounted only from Settings.tsx, its role radiogroup's `.chq-pill`
//      chips (the shared `chq-chipstrip`/`chq-pill` house register, absent
//      from this file's own tap-floor block by design, settings.css:2270)
//      declare no min-height at desktop. Drained by a rule scoped to that
//      radiogroup's own `aria-labelledby` anchor
//      (`[aria-labelledby='people-invite-role-label'] .chq-pill`,
//      settings.css) -- the shared `.chq-pill` base and every other
//      chipstrip in the app stay untouched (wave-156 clause (c): a house
//      register is never raised). `Chautauqua Contacts.dc.html:602`
//      ("Add to an event" modal) is a MIS-ATTRIBUTION of the same shape
//      wave-156/157 already named for other rows: `AddToEventModal.tsx`
//      renders its role list dynamically (its own header comment: "never a
//      hardcoded Speaker/Reviewer/Guest list"), so the join's only literal
//      "Reviewer" own-text match in the whole corpus is PeopleRolesPanel's
//      -- a different page's control. Per wave-156 clause (b), the base
//      rule for a token drawn at two floors takes the LOWER, and the
//      higher floor may only be raised in a rule "scoped to the frame that
//      draws it"; there is no such scope here (no code renders this frame's
//      control at all), so forcing `.chq-pill` to 46px would satisfy the
//      scanner while drawing a fabricated selector that matches nothing
//      real -- exactly the "misattributed row" this chained task's own
//      description warns against. Left live, matching `Chautauqua
//      Submissions.dc.html:314`'s existing, ruling-authorised irreducible
//      status (DEC-393 wave-157: `.chq-detail-decision-secondary-pair
//      .chq-btn` already declares `min-height:44px` in
//      app/src/pages/submissions/detail.css, floors the REAL control, but
//      the join still resolves this row's tokens to Overview's phone-hidden
//      queue button, so the ledger's own count cannot move without a
//      worker's-judgment drain the wave-157 ruling forbids). MEASURED (this
//      branch, post-drain): 2 offenders (both misattributions, neither
//      drainable without gaming the join), 166 unresolved (unchanged --
//      this drain touches only an already-`offender` row's declared value,
//      moving it to `ok`, never creating or removing an `unresolved` row).
//
//      WAVE 27 (DEC-393 amendment, task w27-b): the wave-151/157/159
//      population was grading 28 rows of frame content
//      test/desktop-control-label.scan.test.ts's own FIXTURE_EXCLUSIONS/
//      COMPOSED_EXCLUSIONS tables had already hand-triaged (mock/seed
//      content wearing control geometry, or a label composed/blessed
//      rather than drawn literally) a SECOND time, as UNRESOLVED. Both
//      tables are now `export`ed from that file (no other change there)
//      and imported here (DEC-613 -- one triage table, not two). A drawn
//      row whose own `fileName`+`line` matches either table's entry now
//      grades a new fourth status, `excluded`, carrying that table's own
//      reason string, instead of `unresolved`. Keyed on file+line only
//      (not label): the two files compute a control's "line" from
//      different offsets on the same source line, so line is the shared,
//      construction-proof key. MEASURED (this branch, forcing both
//      ceilings to -1): 28 rows moved unresolved->excluded (3 FIXTURE, 25
//      COMPOSED); UNRESOLVED fell 166->141 (130 no-label-match, 1
//      no-token, 10 no-control-shape); OFFENDERS unchanged at 2 -- neither
//      of the two known mis-attributed rows (Contacts.dc.html:602
//      "Reviewer", Submissions.dc.html:314 "Waitlist") lands on any
//      FIXTURE/COMPOSED file:line coordinate, so this widening does not
//      touch their verdict. Full breakdown, receipts and the retired
//      "left to a later wave, full stop" sentence in
//      docs/design/audit/desktop-control-floor-v12.md's own "WAVE 27"
//      section. Zero product CSS bytes changed.
//
//   4. RATCHET, two-sided, mirroring every prior ledger in this campaign:
//      DESKTOP_FLOOR_DIVERGENCE_CEILING is a single exported const, hand-
//      measured on this branch by forcing it to -1 and reading the printed
//      offender list -- never an expression naming the measured set.
//      DESKTOP_FLOOR_UNRESOLVED_CEILING is its two-sided companion for the
//      unresolved bucket, seeded the identical way. Both registered in
//      `scripts/exit-predicate.ts`'s `OUT_OF_CAMPAIGN_SCOPE` only, never
//      `CAMPAIGN_CONSTANT_NAMES`/`TIER2_CEILING_NAMES`, on the identical
//      reasoning DEC-393 wave-147 gave the phone half: a new non-zero row
//      in the exit gate would move the campaign's goalposts mid-
//      convergence.
//
//   5. VACUITY: exact drawn-control count and per-file breakdown, plus a
//      synthetic positive/negative control pair over a fabricated
//      population in a tmpdir-free, string-only fixture (mirroring
//      desktop-control-label.scan.test.ts's own in-memory fixture idiom --
//      no real product token is ever used to prove the extractor works).
//
//   6. Measured offenders/unresolved rows are recorded in
//      docs/design/audit/desktop-control-floor-v12.md, drift-proof
//      citations only (bare path then a backticked quote, never
//      `path:NNN`, per test/citation-form-drift.scan.test.ts).
//
//   WAVE 28 (DEC-393 + DEC-808, task w28-b): a SECOND match tier, consulted
//   ONLY when the own-text tier above finds no match for a label at all --
//   an occurrence of the label as the COMPLETE value of a quoted
//   `label`/`aria-label`/`placeholder`/`title` attribute inside an opening
//   tag that ALSO carries `chq-` tokens in its own class=/className=
//   attribute (same tag only, never a sibling/ancestor's class --
//   `classTokensInOpenTag`/`attributeLabelTokensInBlob`). Graded through
//   the SAME `gradeControl` path (control-shapedness corroboration,
//   own-element selector guard) so the two tiers cannot diverge in
//   judgment. MEASURED (this branch, forcing each ceiling to -1 before AND
//   after adding the tier): PRE-WIDENING (own-text tier alone, matching
//   wave-159's own measured state) 2 offenders, 166 unresolved (155
//   no-label-match, 1 no-token, 10 no-control-shape). POST-WIDENING (both
//   tiers): 2 offenders (unchanged -- the attribute tier resolves 0 new
//   offenders, only OK rows), 163 unresolved (152 no-label-match, 1
//   no-token, 10 no-control-shape) -- 3 rows newly resolved, all graded OK:
//   `Chautauqua Account.dc.html`:43 and `:195` (both "you@example.com",
//   resolving via a placeholder attribute to `chq-input`/
//   `chq-field-invalid`, declared 48px >= drawn 46/48px) and `Chautauqua
//   Submissions.dc.html`:296 ("Add a co-presenter by name or email…",
//   resolving via a placeholder attribute to `chq-input`, declared 48px >=
//   drawn 46px). Full per-row detail in
//   docs/design/audit/desktop-control-floor-v12.md.
//
// This file names the app's ungraded desktop control-floor fidelity; it
// does not close it, and it does not touch app/src/styles.css or any
// other desktop CSS -- desktop stays frozen.
import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { collapseDigitsToSkeleton, enumerateSourceFiles, normalizeSource } from './frame-source-corpus';
import { COMPOSED_EXCLUSIONS, FIXTURE_EXCLUSIONS } from './desktop-control-label.scan.test';
import { discoverComposedHelpers, resolveComposedLabel, type ComposedHelper } from './helpers/composed-label-resolve';
import { stripCssComments } from './helpers/strip-css-comments';
import { DEC_374, DEC_651, DEC_746, DEC_964 } from '../src/decisions';
void DEC_964; // wave-26 amendment: a cross-surface own-text match (the join's ONLY match resolves into a source file that renders no frame in the same .dc.html cluster) grades UNRESOLVED, never OFFENDER -- gated on a positive receipt test, never a blanket escape.
void DEC_374; // wave-52 amendment: the shared source stripper is string-literal-blind by design, so a `*.css.ts` rule parse must additionally strip CSS comments -- see the "WAVE 52" section below.
void DEC_651; // wave-53 amendment: the desktop drawn-floor ledger's 14 non-composed UNRESOLVED rows get the same per-row adjudication, measure-only -- see MANUAL_JOIN_WIDENING below.

const HERE = dirname(fileURLToPath(import.meta.url)); // test/
const REPO_ROOT = join(HERE, '..');
const DESIGN_ROOT = join(REPO_ROOT, 'docs', 'design');
const APP_SRC_ROOT = join(REPO_ROOT, 'app', 'src');
const SRC_ROOT = join(REPO_ROOT, 'src');

// -- Population: label/extent walk, ported from
// test/desktop-frame-ledger.scan.test.ts (never imported -- sibling-owned
// file). isPhone derivation identical to that file's own. -----------------

const LABEL_RE = />([^<]+)<\//;

function isPhoneFrameLine(line: string): boolean {
  return line.includes('width:390px') && line.includes('height:844');
}

function isLabelLine(line: string): boolean {
  return line.includes('font-size:19px') && LABEL_RE.test(line);
}

function designFiles(): string[] {
  return readdirSync(DESIGN_ROOT, { withFileTypes: true })
    .filter((e) => e.isFile() && e.name.endsWith('.dc.html'))
    .map((e) => e.name)
    .sort();
}

interface RawLabel {
  line: number;
  title: string;
}

interface FrameExtent {
  fileName: string;
  /** 1-based line number of the label span that opens this frame. */
  line: number;
  title: string;
  /** Extent end (exclusive): the next label line, or Infinity. */
  extentEnd: number;
}

/** 1-based line number of `fileName`'s single `</x-dc>` template close tag.
 * Ported (never imported -- each of the four desktop-ledger files carries
 * its own copy) from test/desktop-frame-ledger.scan.test.ts, so every frame
 * extent clips at the template's own close rather than running into
 * `<script data-dc-script>` or past EOF (DEC-967 wave-41 amendment). Throws
 * loudly if the tag is missing or appears more than once. `root` defaults to
 * DESIGN_ROOT; the non-vacuity control test below is the only caller that
 * ever passes a tmpdir instead. */
function templateCloseLine(fileName: string, root: string = DESIGN_ROOT): number {
  const full = join(root, fileName);
  const lines = readFileSync(full, 'utf-8').split('\n');
  const matches: number[] = [];
  lines.forEach((content, idx) => {
    if (content.includes('</x-dc>')) matches.push(idx + 1);
  });
  if (matches.length !== 1) {
    throw new Error(`${fileName}: expected exactly one </x-dc>, found ${matches.length}`);
  }
  return matches[0]!;
}

function labelsInFile(fileName: string, root: string = DESIGN_ROOT): RawLabel[] {
  const full = join(root, fileName);
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
 * contains a phone (width:390px+height:844) line -- identical derivation
 * to test/desktop-frame-ledger.scan.test.ts's own allFramesInFile. */
function allFramesInFile(fileName: string, root: string = DESIGN_ROOT): { frame: FrameExtent; isPhone: boolean }[] {
  const full = join(root, fileName);
  const lines = readFileSync(full, 'utf-8').split('\n');
  const labels = labelsInFile(fileName, root);
  const closeLine = templateCloseLine(fileName, root);
  return labels.map((label, i) => {
    const nextLabel = labels[i + 1];
    const extentEnd = Math.min(nextLabel ? nextLabel.line : Infinity, closeLine);
    const extentLines = lines.slice(label.line - 1, extentEnd === Infinity ? lines.length : extentEnd - 1);
    const isPhone = extentLines.some(isPhoneFrameLine);
    return { frame: { fileName, line: label.line, title: label.title, extentEnd }, isPhone };
  });
}

const DESKTOP_FRAMES: FrameExtent[] = designFiles().flatMap((f) =>
  allFramesInFile(f)
    .filter((e) => !e.isPhone)
    .map((e) => e.frame)
);

// -- WAVE 33 (DEC-651): States-swatch-frame population exclusion -----------
// "States · hover, pending, drag" (Chautauqua Overview.dc.html:476) is the
// only frame in the whole pack whose title begins `States · ` -- a component
// swatch panel demonstrating Primary/Secondary/Tertiary/Destructive button
// styling and input rest/hover/focus/disabled states, captioned by the pack
// itself "Hover the live column · the rest are drawn states". Its labels
// were never product copy: docs/design/audit/desktop-control-floor-v12.md
// records zero corpus hits for each. Excluded at the population step,
// DERIVED from the frame's own title token -- never a hand-written line
// range -- at the same place this file already applies the `!isPhone` split
// (`allFramesInFile`'s own extent walk), so a re-cut pack that adds or moves
// a `States · ` frame is picked up automatically, never silently missed.
export function isStatesSwatchFrameTitle(title: string): boolean {
  return title.startsWith('States · ');
}

/** The population-step filter this file applies to every frame's extent
 * before extracting drawn controls: drop phone extents (the file's
 * pre-existing split) and drop `States · `-badged swatch-panel extents
 * (WAVE 33, DEC-651). Exported so the non-vacuity fixture below can drive
 * this exact function over fabricated frame entries, never a hand-listed
 * line range. */
export function populatedFrames(entries: { frame: FrameExtent; isPhone: boolean }[]): FrameExtent[] {
  return entries.filter((e) => !e.isPhone && !isStatesSwatchFrameTitle(e.frame.title)).map((e) => e.frame);
}

// -- Drawn-control extraction ------------------------------------------------

export interface DrawnControl {
  fileName: string;
  /** 1-based line number of the text immediately following the drawn
   * control's opening tag. */
  line: number;
  drawnFloor: number;
  label: string;
  frameTitle: string;
  frameLine: number;
}

const OPEN_TAG_RE = /<(\w+)\b([^>]*)>/g;

function isRealLabel(label: string): boolean {
  return label.trim().length >= 2 && !label.includes('{{');
}

/** A drawn control per the task grammar: any element whose attribute
 * string carries min-height:NNpx AND border-radius AND (border: OR
 * background:); or, for an `<a>` specifically, min-height:NNpx alone.
 * Exported so the non-vacuity fixture below can drive this exact function
 * over a fabricated population, never a real product token. */
export function drawnControlFloor(tag: string, attrs: string): number | null {
  const mh = attrs.match(/min-height:(\d+)px/);
  if (!mh) return null;
  const floor = Number(mh[1]);
  if (tag === 'a') return floor;
  const hasBorderRadius = /border-radius/.test(attrs);
  const hasBorderOrBackground = /border:/.test(attrs) || /background:/.test(attrs);
  return hasBorderRadius && hasBorderOrBackground ? floor : null;
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

/** Every drawn control in one frame's raw text extent. Exported so the
 * non-vacuity fixture below can drive this exact function over a
 * fabricated frame, never a real product token. */
export function drawnControlsInFrameText(
  text: string
): { label: string; drawnFloor: number; offset: number }[] {
  const out: { label: string; drawnFloor: number; offset: number }[] = [];
  OPEN_TAG_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = OPEN_TAG_RE.exec(text))) {
    const tag = m[1]!;
    const attrs = m[2]!;
    const floor = drawnControlFloor(tag, attrs);
    if (floor === null) continue;
    const afterOpen = m.index + m[0].length;
    const nextLt = text.indexOf('<', afterOpen);
    const rawLabel = (nextLt === -1 ? text.slice(afterOpen) : text.slice(afterOpen, nextLt)).trim();
    if (!isRealLabel(rawLabel)) continue;
    out.push({ label: rawLabel, drawnFloor: floor, offset: afterOpen });
  }
  return out;
}

function drawnControlsInFile(fileName: string, root: string = DESIGN_ROOT): DrawnControl[] {
  const full = join(root, fileName);
  const content = readFileSync(full, 'utf-8');
  const lines = content.split('\n');
  const lineStartIndex: number[] = [0];
  for (let i = 0; i < lines.length; i++) {
    lineStartIndex.push(lineStartIndex[i]! + lines[i]!.length + 1);
  }

  const frames = populatedFrames(allFramesInFile(fileName, root));
  const out: DrawnControl[] = [];
  for (const frame of frames) {
    const startOff = lineStartIndex[frame.line - 1]!;
    const endOff = frame.extentEnd === Infinity ? content.length : lineStartIndex[frame.extentEnd - 1]!;
    const text = content.slice(startOff, endOff);
    for (const raw of drawnControlsInFrameText(text)) {
      out.push({
        fileName,
        line: offsetToLine(lineStartIndex, startOff + raw.offset),
        drawnFloor: raw.drawnFloor,
        label: raw.label,
        frameTitle: frame.title,
        frameLine: frame.line,
      });
    }
  }
  return out;
}

const ALL_CONTROLS: DrawnControl[] = designFiles().flatMap((f) => drawnControlsInFile(f));

// -- Match side: normalized non-test app/src/** + src/** corpus ------------
// (frame-source-corpus's shared stripper/decoder -- DEC-967's one-stripper
// rule -- imported, never re-implemented.)

const SOURCE_FILES = [...enumerateSourceFiles(APP_SRC_ROOT), ...enumerateSourceFiles(SRC_ROOT)];
const NORMALIZED_BLOBS: string[] = SOURCE_FILES.map((f) => normalizeSource(readFileSync(f, 'utf-8')));

/** The same NORMALIZED_BLOBS pipeline, with every CSS comment additionally
 * removed via the shared, string-aware `stripCssComments` (DEC-613) BEFORE
 * any `RULE_RE` parse below runs -- so a comment can never fold into a
 * following rule's selector text (DEC-374 wave-52 amendment, wave-55
 * repair). Parallel array to NORMALIZED_BLOBS/TOPLEVEL_BLOBS/SOURCE_FILES:
 * index i is always the same source file's clean counterpart.
 * `stripCssComments` is imported, never re-implemented (DEC-613's
 * one-stripper rule); it is already string-aware enough to cover the
 * `.css.ts` template-literal case (it tracks `"`/`'` quote state
 * character-by-character regardless of the surrounding JS syntax), so no
 * extension to the shared helper is needed. Defined here (before
 * TOPLEVEL_BLOBS/TOKEN_INDEX/CONTROL_SHAPE_INDEX below) so every real
 * grading index is built from comment-free source, never a second later
 * copy of this same pipeline (DEC-613: one stripped-blob array, not two). */
const COMMENT_FREE_NORMALIZED_BLOBS: string[] = NORMALIZED_BLOBS.map((b) => stripCssComments(b));

// -- Composed-label resolution tier (DEC-393 wave-23 amendment; task w23-g)
// -- consulted ONLY when neither the own-text nor the attribute tier below
// finds a match. See test/helpers/composed-label-resolve.ts's own header
// for the full algorithm and honesty clauses; that module is the ONE place
// this join lives, shared byte-for-byte with the phone half. ------------

const COMPOSED_HELPERS: ComposedHelper[] = discoverComposedHelpers(join(SRC_ROOT, 'domain'), join(APP_SRC_ROOT, 'lib'));

function isAlnum(ch: string | undefined): boolean {
  return ch !== undefined && /[A-Za-z0-9]/.test(ch);
}

/** First boundary-anchored occurrence of `label` in `blob`, or null.
 * Companion to ./frame-source-corpus's `labelIsMatched` -- same boundary
 * algorithm, but returns a POSITION (labelIsMatched only returns a
 * boolean), because this ledger needs the position to read the nearest
 * class attribute. Not a second copy of the stripper/decoder (those stay
 * solely in frame-source-corpus); this is position-finding only. Exported
 * for the non-vacuity fixture below. */
export function firstBoundaryMatch(label: string, blob: string): number | null {
  const needle = label.replace(/\s+/g, ' ').trim();
  if (needle.length === 0) return null;
  const firstIsAlnum = isAlnum(needle[0]);
  const lastIsAlnum = isAlnum(needle[needle.length - 1]);
  let idx = blob.indexOf(needle);
  while (idx !== -1) {
    const before = idx > 0 ? blob[idx - 1] : undefined;
    const afterIdx = idx + needle.length;
    const after = afterIdx < blob.length ? blob[afterIdx] : undefined;
    const boundaryBeforeOk = !firstIsAlnum || !isAlnum(before);
    const boundaryAfterOk = !lastIsAlnum || !isAlnum(after);
    if (boundaryBeforeOk && boundaryAfterOk) return idx;
    idx = blob.indexOf(needle, idx + 1);
  }
  return null;
}

/** Every boundary-anchored occurrence of `label` in `blob` (companion to
 * `firstBoundaryMatch`, which stops at the first) -- WAVE 157 REPAIR:
 * `firstBoundaryMatch`'s "first occurrence per blob" shape is exactly what
 * mis-attributed `Chautauqua Account.dc.html:225`'s "Back to sign in": the
 * FIRST occurrence in src/routes/auth-views.tsx is
 * `<a className="chq-auth-tertiary">&lsaquo; Back to sign in</a>` (a
 * DIFFERENT page's "Use a different address" sibling), while the real
 * filled-primary "Back to sign in" (`<a className="chq-btn
 * chq-btn-primary">`) is a LATER occurrence in the same file, never
 * reached. Exported for the non-vacuity fixture below. */
export function allBoundaryMatches(label: string, blob: string): number[] {
  const needle = label.replace(/\s+/g, ' ').trim();
  if (needle.length === 0) return [];
  const firstIsAlnum = isAlnum(needle[0]);
  const lastIsAlnum = isAlnum(needle[needle.length - 1]);
  const positions: number[] = [];
  let idx = blob.indexOf(needle);
  while (idx !== -1) {
    const before = idx > 0 ? blob[idx - 1] : undefined;
    const afterIdx = idx + needle.length;
    const after = afterIdx < blob.length ? blob[afterIdx] : undefined;
    const boundaryBeforeOk = !firstIsAlnum || !isAlnum(before);
    const boundaryAfterOk = !lastIsAlnum || !isAlnum(after);
    if (boundaryBeforeOk && boundaryAfterOk) positions.push(idx);
    idx = blob.indexOf(needle, idx + 1);
  }
  return positions;
}

/** True when the text content of the tag immediately enclosing `idx` in
 * `blob` -- from the nearest preceding `>` to the next `<` -- normalises
 * (whitespace-collapsed, trimmed) to EXACTLY `label`. WAVE 157 REPAIR: the
 * pre-repair join accepted any match whose nearest enclosing tag merely
 * CONTAINED the label as a substring -- `&lsaquo; Back to sign in`
 * contains "Back to sign in" and was accepted, misattributing the drawn
 * control to `chq-auth-tertiary` (that anchor's own rendered text is "‹
 * Back to sign in", not the frame's drawn label). Requiring the FULL text
 * node to equal the label -- "the element whose own text content IS the
 * label" -- rejects that occurrence and leaves only the real one (the
 * plain-text "Back to sign in" on `chq-btn chq-btn-primary`). Also rejects
 * the same unclosed-tag-attribute shape `classTokensNear` already guards
 * (an aria-label/placeholder/label prop is not real text-node content).
 * Exported for the non-vacuity fixture below. */
export function ownTextEquals(label: string, blob: string, idx: number): boolean {
  const needle = label.replace(/\s+/g, ' ').trim();
  const prevGt = blob.lastIndexOf('>', idx);
  if (prevGt === -1) return false;
  const afterPrevGt = blob.slice(prevGt + 1, idx);
  if (afterPrevGt.includes('<')) return false;
  const nextLt = blob.indexOf('<', idx);
  const textEnd = nextLt === -1 ? blob.length : nextLt;
  const fullText = blob.slice(prevGt + 1, textEnd).replace(/\s+/g, ' ').trim();
  return fullText === needle;
}

const CLASS_TOKEN_RE = /\bchq-[A-Za-z0-9-]+/g;

/** `chq-` tokens carried by the nearest enclosing element's class=/
 * className= attribute at `idx` in `blob` -- quoted string, `{...}`
 * expression, or template literal, any syntax; the reader only pulls
 * `chq-` tokens out of the captured attribute-value span rather than
 * parsing the expression. Returns [] (UNRESOLVED, never a guess) when:
 *  - `idx` sits inside an as-yet-unclosed opening tag's OWN attribute
 *    value (detected as an unmatched `<` between the nearest preceding
 *    `>` and idx) -- e.g. `aria-label="File type"`, a `label="File"`
 *    prop -- so a sibling/ancestor's class is never misattributed to a
 *    string that is not the control's own rendered label;
 *  - no class=/className= attribute is found on the enclosing tag. */
export function classTokensNear(blob: string, idx: number): string[] {
  const prevGt = blob.lastIndexOf('>', idx);
  const afterPrevGt = blob.slice(prevGt + 1, idx);
  // If the span between the nearest preceding '>' and idx still contains an
  // unmatched '<', idx sits INSIDE an as-yet-unclosed opening tag's own
  // attribute value (e.g. aria-label="File type"), not in real text-node
  // content -- reject rather than misattribute a sibling/ancestor's class.
  if (afterPrevGt.includes('<')) return [];
  if (prevGt === -1) return [];
  // idx is real text content immediately following the tag that closed at
  // prevGt. That enclosing tag's own attribute string runs from ITS
  // opening '<' up to prevGt -- look backward for it.
  const openLt = blob.lastIndexOf('<', prevGt);
  if (openLt === -1) return [];
  const tagChunk = blob.slice(openLt, prevGt + 1);
  const cm = tagChunk.match(/\b(?:class|className)\s*=\s*/);
  if (!cm) return [];
  const startAttr = (cm.index ?? 0) + cm[0].length;
  const opener = tagChunk[startAttr];
  let valueEnd: number;
  if (opener === '"' || opener === "'" || opener === '`') {
    const close = tagChunk.indexOf(opener, startAttr + 1);
    if (close === -1) return [];
    valueEnd = close + 1;
  } else if (opener === '{') {
    let depth = 0;
    let j = startAttr;
    for (; j < tagChunk.length; j++) {
      if (tagChunk[j] === '{') depth++;
      else if (tagChunk[j] === '}') {
        depth--;
        if (depth === 0) {
          j++;
          break;
        }
      }
    }
    valueEnd = j;
  } else {
    return [];
  }
  const valueChunk = tagChunk.slice(startAttr, valueEnd);
  return [...new Set(valueChunk.match(CLASS_TOKEN_RE) ?? [])];
}

// -- Resolve: each chq- token's declared min-height from any TOP-LEVEL
// (non-@media) rule mentioning it -----------------------------------------

/** Strips every `@media ... { ... }` block (brace-balanced) from `text`,
 * leaving only top-level rules. DEC-385: desktop is the unqualified base
 * declaration; a `max-width` block only narrows it for phone, so it is
 * never the desktop-grading value. */
export function stripMediaBlocks(text: string): string {
  const AT_RE = /@media\b[^{]*\{/g;
  let result = '';
  let i = 0;
  let m: RegExpExecArray | null;
  AT_RE.lastIndex = 0;
  while ((m = AT_RE.exec(text))) {
    if (m.index < i) continue;
    result += text.slice(i, m.index);
    let depth = 1;
    let j = AT_RE.lastIndex;
    while (j < text.length && depth > 0) {
      if (text[j] === '{') depth++;
      else if (text[j] === '}') depth--;
      j++;
    }
    i = j;
    AT_RE.lastIndex = j;
  }
  result += text.slice(i);
  return result;
}

const TOPLEVEL_BLOBS: string[] = NORMALIZED_BLOBS.map(stripMediaBlocks);
/** Comment-free counterpart of TOPLEVEL_BLOBS (see COMMENT_FREE_NORMALIZED_BLOBS
 * above) -- this is what TOKEN_INDEX and CONTROL_SHAPE_INDEX below are built
 * from (DEC-374 wave-52 amendment, wave-55 repair), so a `/* ... *\/` comment
 * can never fold into the next rule's selector text and falsely credit a
 * token a min-height/control-shape it never declares. TOPLEVEL_BLOBS itself
 * is left untouched (still comment-including) -- it remains the honest "raw"
 * corpus for the comment-credit MEASUREMENT below (COMMENT_CREDITED_OFFENDERS),
 * which needs the raw text to locate/cite the crediting rule the comment
 * folded into. */
const COMMENT_FREE_TOPLEVEL_BLOBS: string[] = COMMENT_FREE_NORMALIZED_BLOBS.map(stripMediaBlocks);
const RULE_RE = /([^{}]+)\{([^{}]*)\}/g;

function isTokenChar(ch: string | undefined): boolean {
  return ch !== undefined && /[A-Za-z0-9-]/.test(ch);
}

/** True when `.token` occurs in `selectorText`, boundary-anchored so
 * `.chq-btn` never matches inside `.chq-btn-primary`. */
function selectorMentionsToken(selectorText: string, token: string): boolean {
  const needle = `.${token}`;
  let idx = selectorText.indexOf(needle);
  while (idx !== -1) {
    const before = idx > 0 ? selectorText[idx - 1] : undefined;
    const after = selectorText[idx + needle.length];
    if (!isTokenChar(before) && !isTokenChar(after)) return true;
    idx = selectorText.indexOf(needle, idx + 1);
  }
  return false;
}

/** Resolves `token`'s declared min-height from every top-level rule (any
 * source file) whose selector list mentions it: `hasRule` is true the
 * moment any such rule exists (even with no min-height declared, per the
 * task grammar's "an offender at 0"); `maxMinHeight` is the largest
 * min-height px value found across all qualifying rules, or null if none
 * declare one. Exported for the non-vacuity fixture below (over a small
 * fixture blob list); the real corpus join below uses `TOKEN_INDEX`
 * instead, a one-pass precomputed map over the whole corpus -- calling
 * this function per token per row would be O(rows * tokens * rules),
 * where the index is O(rules) total. */
export function resolveTokenMinHeight(
  token: string,
  blobs: readonly string[]
): { hasRule: boolean; maxMinHeight: number | null } {
  let hasRule = false;
  let maxMinHeight: number | null = null;
  for (const blob of blobs) {
    RULE_RE.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = RULE_RE.exec(blob))) {
      const selectorText = m[1]!;
      const body = m[2]!;
      if (!selectorMentionsToken(selectorText, token)) continue;
      hasRule = true;
      const mh = body.match(/min-height\s*:\s*(\d+)px/);
      if (mh) {
        const v = Number(mh[1]);
        if (maxMinHeight === null || v > maxMinHeight) maxMinHeight = v;
      }
    }
  }
  return { hasRule, maxMinHeight };
}

/** Selector-list class tokens, extracted directly (never re-testing every
 * known token against every selector) -- the single-pass companion to
 * `selectorMentionsToken`'s per-token search, used to build `TOKEN_INDEX`
 * below in one walk over the corpus. */
const SELECTOR_CLASS_TOKEN_RE = /\.([A-Za-z][A-Za-z0-9-]*)/g;

/** A top-level rule is CONTROL-SHAPED (task grammar, wave-157 repair (iii))
 * when its own body declares a border, a background, a padding-inline, or
 * a min-height -- the same face-drawing property set the frame side's own
 * `drawnControlFloor` looks for (border-radius plus border/background),
 * widened with padding-inline/min-height since a rule can paint a control
 * box without a radius. Matched one declaration (`prop: value`) at a time
 * (split on `;`) rather than a bare property-name regex over the whole
 * body: `app/src/pages/submissions/detail.css`'s `.chq-detail-section-title
 * button { background: none; border: none; ... }` -- a button RESET so it
 * reads as its parent's plain-text title, not a painted face -- is real
 * top-level code (not a comment) that a bare `/border\s*:/` test wrongly
 * called control-shaped, corrupting Contacts.dc.html:601's grade (measured
 * false positive, closed here). `border`/`background` with an explicit
 * `none`/`transparent`/`0`/`0px` value are excluded for that reason;
 * `padding-inline`/`min-height` are not (a real `0` there is still a
 * declared, gradable value, and the task's own OFFENDER grammar already
 * treats "a qualifying rule with no min-height" as an offender at 0). */
function isControlShapedBody(body: string): boolean {
  const NONE_VALUE_RE = /^(none|transparent|0|0px)$/i;
  for (const raw of body.split(';')) {
    const m = raw.trim().match(/^(border|background|padding-inline|min-height)\s*:\s*(.+)$/);
    if (!m) continue;
    const prop = m[1]!;
    const value = m[2]!.trim();
    if ((prop === 'border' || prop === 'background') && NONE_VALUE_RE.test(value)) continue;
    return true;
  }
  return false;
}

/** One-pass precomputed index: every top-level rule in the whole corpus is
 * visited exactly once, and every `chq-`-token-shaped class its selector
 * list names gets this rule's min-height (if any) folded into the token's
 * running max, plus whether ANY qualifying rule is control-shaped. Built
 * once at module load; the JOIN below is then a plain map lookup per token
 * instead of a corpus re-scan per token. */
const TOKEN_INDEX = new Map<string, { hasRule: boolean; maxMinHeight: number | null; controlShaped: boolean }>();
for (const blob of COMMENT_FREE_TOPLEVEL_BLOBS) {
  RULE_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = RULE_RE.exec(blob))) {
    const selectorText = m[1]!;
    const body = m[2]!;
    const mh = body.match(/min-height\s*:\s*(\d+)px/);
    const v = mh ? Number(mh[1]) : null;
    const shaped = isControlShapedBody(body);
    SELECTOR_CLASS_TOKEN_RE.lastIndex = 0;
    let tm: RegExpExecArray | null;
    const seenInRule = new Set<string>();
    while ((tm = SELECTOR_CLASS_TOKEN_RE.exec(selectorText))) {
      const tok = tm[1]!;
      if (seenInRule.has(tok)) continue;
      seenInRule.add(tok);
      const existing = TOKEN_INDEX.get(tok);
      if (!existing) {
        TOKEN_INDEX.set(tok, { hasRule: true, maxMinHeight: v, controlShaped: shaped });
      } else {
        existing.hasRule = true;
        if (v !== null && (existing.maxMinHeight === null || v > existing.maxMinHeight)) existing.maxMinHeight = v;
        if (shaped) existing.controlShaped = true;
      }
    }
  }
}

function resolveTokenMinHeightIndexed(token: string): {
  hasRule: boolean;
  maxMinHeight: number | null;
  controlShaped: boolean;
} {
  return TOKEN_INDEX.get(token) ?? { hasRule: false, maxMinHeight: null, controlShaped: false };
}

// -- Corroboration: a token set is only OFFENDER-eligible when at least one
// of its resolved tokens is itself CONTROL-SHAPED -- its own top-level
// (non-@media) rule declares a border, a background, a padding-inline, or a
// min-height. A token set consisting solely of typography/column registers
// (e.g. .chq-page-title, .chq-portal-field-label) grades UNRESOLVED under a
// new reason instead of falsely OFFENDING, mirroring this file's existing
// `aria-label="File type"`/chq-chipstrip guard for a different shape (that
// guard's own header calls the drop to UNRESOLVED "honest"). Control-
// shapedness is derived from the RULE BODY, never from a hand-listed token
// allowlist (DEC-180: a hand-listed population is not a population). ------

// Literal property names only -- deliberately NOT `-\w+`-suffixed
// (border-bottom, border-color, background-image, ...), mirroring
// `drawnControlFloor`'s own literal `border:`/`background:` substring test
// above. A directional `border-bottom` underline is a typography accent
// (e.g. `.chq-section-label { border-bottom: 2px solid ...; }`, the eyebrow
// rule the wave-156 amendment names), never the bordered/filled/padded
// control BOX this clause exists to detect.
const CONTROL_SHAPE_RE = /\b(?:border|background|padding-inline|min-height)\s*:/;

/** True when `token` is the RIGHTMOST (own-element) simple selector of at
 * least one comma-separated selector in `selectorText` -- boundary-anchored
 * like `selectorMentionsToken`, but additionally rejects a match that is
 * only an ANCESTOR of the styled element (`.token button`, `.token > .bar`,
 * `.token .child`): a combinator (whitespace/`>`/`+`/`~`) followed by
 * further selector content after the match means some OTHER element
 * receives the declared properties, not `.token` itself. A compound
 * extension with no combinator (`.token.other`, `.token:hover`,
 * `.token[data-x]`) still owns the rule -- same element. Needed only for
 * the control-shape corroboration below: `selectorMentionsToken`/
 * `resolveTokenMinHeightIndexed` above are untouched (DEC-393 wave-151's
 * own min-height resolution is out of this task's scope, INSTRUMENT ONLY).
 * Measured false positive this guards: `.chq-detail-section-title button {
 * background: none; border: none; ... }` in app/src/pages/submissions/
 * detail.css resets a nested reset-button, not the label's own box --
 * without this guard `chq-detail-section-title` (and therefore Chautauqua
 * Speakers.dc.html:209's "Form") wrongly grades control-shaped. */
function selectorOwnsToken(selectorText: string, token: string): boolean {
  const needle = `.${token}`;
  for (const rawSel of selectorText.split(',')) {
    let idx = rawSel.indexOf(needle);
    while (idx !== -1) {
      const before = idx > 0 ? rawSel[idx - 1] : undefined;
      const afterIdx = idx + needle.length;
      const after = rawSel[afterIdx];
      if (!isTokenChar(before) && !isTokenChar(after)) {
        const rest = rawSel.slice(afterIdx);
        if (!/[\s>+~][^\s]/.test(rest)) return true;
      }
      idx = rawSel.indexOf(needle, idx + 1);
    }
  }
  return false;
}

/** True when `token`'s own top-level (non-@media) rule(s) anywhere in the
 * corpus declare a border, a background, a padding-inline, or a min-height
 * -- the control-shape test. Built into the same one-pass TOKEN_INDEX walk
 * (never a second corpus scan) so this stays O(rules) total, like
 * resolveTokenMinHeightIndexed's own index. Exported for the non-vacuity
 * fixture below, driven over a fabricated blob, never a real product
 * token. */
export function tokenIsControlShaped(token: string, blobs: readonly string[]): boolean {
  for (const blob of blobs) {
    RULE_RE.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = RULE_RE.exec(blob))) {
      const selectorText = m[1]!;
      const body = m[2]!;
      if (!selectorOwnsToken(selectorText, token)) continue;
      if (CONTROL_SHAPE_RE.test(body)) return true;
    }
  }
  return false;
}

/** Own-element class tokens per comma-separated selector -- the rightmost
 * compound part only (after the last combinator), companion to
 * `selectorOwnsToken`'s per-token search, used to build `CONTROL_SHAPE_INDEX`
 * below in one pass instead of re-testing every known token per rule (same
 * relationship `SELECTOR_CLASS_TOKEN_RE`'s single-pass extraction has to
 * `selectorMentionsToken` above). `.token button` yields no token for
 * `token` (an ancestor, not the styled element); `.token.other` and
 * `.token:hover` both yield `token` (same element). */
function rightmostSelectorTokens(selectorText: string): string[] {
  const out: string[] = [];
  for (const rawSel of selectorText.split(',')) {
    const parts = rawSel.trim().split(/[\s>+~]+/).filter(Boolean);
    const last = parts[parts.length - 1];
    if (!last) continue;
    SELECTOR_CLASS_TOKEN_RE.lastIndex = 0;
    let tm: RegExpExecArray | null;
    while ((tm = SELECTOR_CLASS_TOKEN_RE.exec(last))) out.push(tm[1]!);
  }
  return out;
}

/** One-pass precomputed companion to `TOKEN_INDEX`: every top-level rule is
 * visited exactly once (same walk TOKEN_INDEX was built from, not a second
 * scan) and every `chq-`-token-shaped class that OWNS its selector's
 * rightmost compound (never merely an ancestor in a descendant selector) is
 * marked control-shaped the moment any one of its rules declares a border,
 * background, padding-inline, or min-height. */
const CONTROL_SHAPE_INDEX = new Map<string, boolean>();
for (const blob of COMMENT_FREE_TOPLEVEL_BLOBS) {
  RULE_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = RULE_RE.exec(blob))) {
    const selectorText = m[1]!;
    const body = m[2]!;
    const shaped = CONTROL_SHAPE_RE.test(body);
    if (!shaped) continue;
    for (const tok of rightmostSelectorTokens(selectorText)) {
      CONTROL_SHAPE_INDEX.set(tok, true);
    }
  }
}

function tokenIsControlShapedIndexed(token: string): boolean {
  return CONTROL_SHAPE_INDEX.get(token) ?? false;
}

// -- Frame-content exclusions (DEC-393 wave-27 amendment, task w27-b) ------
// test/desktop-control-label.scan.test.ts already hand-triages this exact
// pack's FIXTURE (mock/seed content wearing control geometry) and COMPOSED
// (label assembled at render time, or already BLESSED by DEVIATIONS.md)
// rows, each entry asserted against the pack by exact file:line:label. A
// drawn-floor row landing on one of those SAME file:line coordinates is the
// SAME frame content those tables already adjudicated -- grading it a fresh
// UNRESOLVED/OFFENDER here would be a second, independent judgment call
// about content the label ledger already settled (DEC-613: one table, not
// two). Imported, never re-triaged (DEC-613 -- this file already imports
// enumerateSourceFiles/normalizeSource from ./frame-source-corpus, same
// idiom). Keyed on fileName+line only (not label): the two files compute a
// control's "line" from different offsets within the same source line (this
// file: the text immediately after the opening tag; the label ledger: the
// matched text-node offset), so the safe, construction-proof join key is the
// line the two extractions share, not a label string each phrases from a
// different anchor point.
const FRAME_CONTENT_EXCLUSIONS: { fileName: string; line: number; reason: string }[] = [
  ...FIXTURE_EXCLUSIONS.map((e) => ({ fileName: e.fileName, line: e.line, reason: `FIXTURE: ${e.reason}` })),
  ...COMPOSED_EXCLUSIONS.map((e) => ({ fileName: e.fileName, line: e.line, reason: `COMPOSED: ${e.reason}` })),
];

function frameContentExclusionFor(control: DrawnControl): string | null {
  const hit = FRAME_CONTENT_EXCLUSIONS.find((e) => e.fileName === control.fileName && e.line === control.line);
  return hit ? hit.reason : null;
}

// -- WAVE 33 (DEC-651): ruling-settled exclusions ---------------------------
// A SEPARATE table from FRAME_CONTENT_EXCLUSIONS above (that one is sourced
// from the label ledger's own FIXTURE/COMPOSED tables -- a different file's
// adjudication, imported never re-triaged). This table is for a row THIS
// file's own grading pipeline settled by an explicit product ruling -- a row
// enters it only carrying the ruling that settled it, never a hand-written
// line range or a fresh judgment call. Keyed on fileName+line, same
// construction-proof reasoning FRAME_CONTENT_EXCLUSIONS documents. The
// ruling's own DEC_NNN constant is imported and referenced (never a bare
// "DEC-746" string) so the dependency is compile-checked.
const RULING_SETTLED_EXCLUSIONS: { fileName: string; line: number; ruling: string; reason: string }[] = [
  {
    fileName: 'Chautauqua Speakers.dc.html',
    line: 201,
    ruling: 'DEC-746',
    reason:
      `${DEC_746} -- app/src/pages/speakers/TaskModal.tsx's own header comment above ` +
      `kindLabel cites the Speakers frame (docs/design/Chautauqua Speakers.dc.html), lines ` +
      `186-216 -- "Upload, Form, Acknowledge" (this row's line 201 sits inside that exact ` +
      `cited region), and kindLabel(kind) returns exactly those three strings, verified ` +
      `against the source. "Upload a headshot" is the modal's own illustrative task name ` +
      `drawn in the same cited region, not a fresh content gap the ruling left open. (Wave-36 ` +
      `note, DEC-976: this reason field is deliberately reworded so it no longer parses as ` +
      `this test file's own docs/design/*.dc.html:NNN citation into Speakers.dc.html -- this ` +
      `file, per DEC-651, asserts nothing against that frame, so it declares no scope into it; ` +
      `the fact quoted above is TaskModal.tsx's citation, credited there, not here.)`,
  },
];

function rulingSettledExclusionFor(control: DrawnControl): { ruling: string; reason: string } | null {
  return RULING_SETTLED_EXCLUSIONS.find((e) => e.fileName === control.fileName && e.line === control.line) ?? null;
}

// -- WAVE 28 (DEC-393 + DEC-808): second match tier, an attribute/prop
// label read. Consulted ONLY when the own-text tier above finds no match
// for a label at all -- an occurrence of the label as the COMPLETE value of
// a quoted label/aria-label/placeholder/title attribute inside an opening
// tag that ALSO carries chq- tokens in a class=/className= attribute ON THE
// SAME OPENING TAG. Resolving strictly from the same tag (never a sibling
// or an ancestor) is what makes this tier safe to add without reopening the
// wave-157 mis-attribution this file's own header describes: a match
// requires BOTH the label attribute AND the chq- class to sit on the one
// opening tag, so a control's own attribute-carried label can never borrow
// an unrelated element's class. --------------------------------------------

const SOURCE_OPEN_TAG_RE = /<(\w+)\b([^>]*)>/g;
const ATTR_LABEL_VALUE_RE = /\b(?:label|aria-label|placeholder|title)\s*=\s*(["'])((?:(?!\1)[\s\S])*)\1/g;

/** chq- tokens from a class=/className= attribute anywhere within
 * `tagChunk` (a complete opening tag's text, e.g. `<button label="X"
 * className="chq-a chq-b">`) -- quoted string, `{...}` expression, or
 * template literal, any syntax; the reader only pulls chq- tokens out of
 * the captured attribute-value span. Companion to `classTokensNear`, which
 * looks BACKWARD from a text-node position; this one reads a whole already-
 * captured opening tag directly, which is what the attribute/prop label
 * tier below needs (that tag IS the match site, there is no text node).
 * Exported for the non-vacuity fixture below. */
export function classTokensInOpenTag(tagChunk: string): string[] {
  const cm = tagChunk.match(/\b(?:class|className)\s*=\s*/);
  if (!cm) return [];
  const startAttr = (cm.index ?? 0) + cm[0].length;
  const opener = tagChunk[startAttr];
  let valueEnd: number;
  if (opener === '"' || opener === "'" || opener === '`') {
    const close = tagChunk.indexOf(opener, startAttr + 1);
    if (close === -1) return [];
    valueEnd = close + 1;
  } else if (opener === '{') {
    let depth = 0;
    let j = startAttr;
    for (; j < tagChunk.length; j++) {
      if (tagChunk[j] === '{') depth++;
      else if (tagChunk[j] === '}') {
        depth--;
        if (depth === 0) {
          j++;
          break;
        }
      }
    }
    valueEnd = j;
  } else {
    return [];
  }
  const valueChunk = tagChunk.slice(startAttr, valueEnd);
  return [...new Set(valueChunk.match(CLASS_TOKEN_RE) ?? [])];
}

/** Every chq- token found via the attribute/prop label tier for `label` in
 * `blob`: every opening tag whose label/aria-label/placeholder/title
 * attribute value (quoted, complete-value match) equals `label`, AND which
 * also carries chq- tokens in its own class=/className= attribute, unioned
 * across every qualifying tag in `blob`. A tag whose label attribute
 * matches but whose class carries no chq- token contributes nothing (the
 * task grammar's own conjunction: the tag must carry BOTH). Exported for
 * the non-vacuity fixture below. */
export function attributeLabelTokensInBlob(label: string, blob: string): string[] {
  const needle = label.replace(/\s+/g, ' ').trim();
  if (needle.length === 0) return [];
  const tokens: string[] = [];
  SOURCE_OPEN_TAG_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = SOURCE_OPEN_TAG_RE.exec(blob))) {
    const attrs = m[2]!;
    ATTR_LABEL_VALUE_RE.lastIndex = 0;
    let am: RegExpExecArray | null;
    let labelMatched = false;
    while ((am = ATTR_LABEL_VALUE_RE.exec(attrs))) {
      const value = am[2]!.replace(/\s+/g, ' ').trim();
      if (value === needle) {
        labelMatched = true;
        break;
      }
    }
    if (!labelMatched) continue;
    tokens.push(...classTokensInOpenTag(m[0]!));
  }
  return [...new Set(tokens)];
}

// -- WAVE 29 (DEC-808 amendment, task w29-e): digit-collapsed skeleton
// re-grade pass, over the no-label-match bucket only ------------------------
// A frame draws a live-looking value (a date, a clock time, a retention
// count, a masked password's dot-count) whose DIGITS the real product
// renders differently at runtime (today's date, a real clock reading, a
// live counter) while every surrounding word stays identical. The own-text/
// attribute/composed tiers above require an EXACT string match, so a row
// like `Chautauqua Settings.dc.html`:1174 "24 months" never resolves even
// when the app draws "`{months} months`" with `months` currently 24 in one
// place and something else in another. Collapsing every digit run to one
// sentinel on BOTH sides turns that into an exact match again, without ever
// touching non-digit words -- a date's month name, an email's domain, a
// button's verb all still have to match letter-for-letter.

// `collapseDigitsToSkeleton` itself now lives in ./frame-source-corpus
// (wave-33, task w33-f amendment) so test/frame-eyebrow-label.scan.test.ts
// can import the identical sentinel without cross-importing this
// `.scan.test.ts` file's module (which would drag this file's own
// `describe` blocks into that ledger's run). Re-exported here so every
// existing call site in THIS file is unchanged.
export { collapseDigitsToSkeleton };

/** The same NORMALIZED_BLOBS the own-text tier already searches, with every
 * digit run further collapsed to the skeleton sentinel. Built once at module
 * load (same one-pass-per-file cost as NORMALIZED_BLOBS itself), never
 * recomputed per row. */
const SKELETON_BLOBS: string[] = NORMALIZED_BLOBS.map(collapseDigitsToSkeleton);

/** Every chq- token the skeleton join resolves for `label`, plus whether it
 * matched at all -- SAME algorithm as the own-text tier (`allBoundaryMatches`
 * + `ownTextEquals` + `classTokensNear`), run over `SKELETON_BLOBS` with a
 * digit-collapsed `label`, so a token set the primary tier could never see
 * (because the drawn and rendered digit runs differ) resolves identically to
 * how a literal match would have. Skipped entirely (returns unmatched) when
 * `label` carries no digit at all -- collapsing would be a no-op and the
 * primary own-text tier has already tried the identical string. Exported for
 * the non-vacuity fixture below. */
export function skeletonOwnTextTokens(label: string): { tokens: string[]; matched: boolean } {
  if (!/\d/.test(label)) return { tokens: [], matched: false };
  const skelLabel = collapseDigitsToSkeleton(label);
  const tokens: string[] = [];
  let matched = false;
  for (const blob of SKELETON_BLOBS) {
    for (const idx of allBoundaryMatches(skelLabel, blob)) {
      if (!ownTextEquals(skelLabel, blob, idx)) continue;
      matched = true;
      tokens.push(...classTokensNear(blob, idx));
    }
  }
  return { tokens: [...new Set(tokens)], matched };
}

// -- WAVE 29 (DEC-808 amendment): composed-literal disposition for whatever
// the skeleton pass still cannot resolve -----------------------------------
// A row that STILL carries reason `no-label-match` after the skeleton pass
// is not automatically "the app never draws this" -- a label that occurs
// only inside a JS conditional expression (`{loading ? 'Saving…' : 'Save
// the question'}`) is real, live app text the own-text tier's "the tag's own
// FULL text content IS the label" rule can never see by construction (the
// tag's own text content is the whole expression, not the string literal
// alone). This tier checks the weaker, narrower question "does this exact
// string occur ANYWHERE in the corpus as a complete quoted literal" --
// enough to distinguish "composed, and the join is blind to it" from "not
// written into the product at all", but never strong enough to resolve a
// token or move a row off `unresolved` into `ok`/`offender` (a ternary
// branch carries no reachable class attribute this join can safely
// attribute to the label -- the enclosing tag's class may belong to either
// branch, or neither).

function isQuoteChar(ch: string | undefined): boolean {
  return ch === '"' || ch === "'" || ch === '`';
}

/** True when `label` (whitespace-collapsed) occurs, boundary-anchored,
 * as a COMPLETE quoted string literal (flanked by the SAME quote character
 * on both sides) anywhere in `blobs` -- e.g. the alternate branch of a
 * ternary, a named constant's value, a switch case. Exported for the
 * non-vacuity fixture below. */
export function labelIsComposedLiteral(label: string, blobs: readonly string[]): boolean {
  const needle = label.replace(/\s+/g, ' ').trim();
  if (needle.length === 0) return false;
  for (const blob of blobs) {
    let idx = blob.indexOf(needle);
    while (idx !== -1) {
      const before = idx > 0 ? blob[idx - 1] : undefined;
      const after = blob[idx + needle.length];
      if (isQuoteChar(before) && before === after) return true;
      idx = blob.indexOf(needle, idx + 1);
    }
  }
  return false;
}

/** True when `label` has the SHAPE of a concrete data value the frame drew
 * as illustrative fixture content -- a masked password, an email, a date, a
 * clock time, a timezone/IANA-zone name, a bare count, a slug/URL, a venue
 * address, a two-word proper name, or free-run body copy (an abstract, a
 * bio, a review comment) long enough that it is self-evidently reviewer/
 * speaker-authored content, never static app vocabulary -- mirroring the
 * SAME judgment test/desktop-control-label.scan.test.ts's own
 * FIXTURE_EXCLUSIONS/COMPOSED_EXCLUSIONS tables already make by hand for
 * this pack ("mock/seed content ... not a literal app vocabulary word",
 * "COMPOSED-from-data"). This content is genuinely rendered by the real
 * control from a live record; no literal-text join can ever match a
 * specific fixture instance value against source code that names no such
 * literal, because the app names no literal at all -- it names a field.
 * Exported for the non-vacuity fixture below. */
export function looksLikeDataValue(label: string): boolean {
  const s = label.trim();
  if (/^[•]{3,}$/.test(s)) return true; // masked password
  if (/^\S+@\S+\.\S+$/.test(s)) return true; // email address
  if (/^\S+@\S+$/.test(s) && s.includes('@')) return true; // truncated email fixture ("dana@example")
  if (/^\d{1,2}\s+[A-Za-z]{3,9}\s+\d{4}$/.test(s)) return true; // "16 Aug 2027"
  if (/^\d{1,2}:\d{2}$/.test(s)) return true; // clock time "15:30"
  if (/^[A-Z][a-z]+\s\d{1,2}$/.test(s)) return true; // calendar day "Wed 13"
  if (/^[A-Za-z_]+\/[A-Za-z_]+$/.test(s)) return true; // IANA zone "America/Los_Angeles"
  if (/^(Pacific|Eastern|Central|Mountain|UTC|GMT)$/.test(s)) return true; // zone short name
  if (/^\d+$/.test(s)) return true; // bare number
  if (/^\d+\s+(months?|to)\s*\d*$/.test(s)) return true; // "24 months" / "1 to 5"
  if (/^[a-z0-9]+(-[a-z0-9]+)+$/.test(s) && /\d/.test(s)) return true; // slug "devflow-conf-2028"
  if (/^[a-z0-9.]+\.[a-z]{2,}\//.test(s)) return true; // bare domain path "chautauqua.cc/e/..."
  if (/,\s*[A-Z][a-z]+(\s[A-Z][a-z]+)*$/.test(s) && /^[A-Z]/.test(s)) return true; // "Moscone West, San Francisco"
  if (/^[A-Z][a-z]+ [A-Z][a-z]+$/.test(s)) return true; // two-word proper name "Priya Raman"
  if (/^[A-Z][a-z]+$/.test(s) && s.length <= 12) return true; // bare given/family name "Sam" / "Whitfield"
  if (/▾$/.test(s)) return true; // a closed dropdown's CURRENT selection, chevron-suffixed (Section/Kind/Field/Is/Value pickers this pack draws throughout, e.g. Chautauqua Submissions.dc.html:671/675/707/711/715) -- the selection is a live field/round/format value, never static app vocabulary
  if (s.length >= 40) return true; // long free-run body copy: a talk title/abstract, a bio, a review comment
  return false;
}

// -- WAVE 29 (DEC-808 amendment): hand-verified composed rows -----------
// A small, explicit, HAND-VERIFIED table for the handful of no-label-match
// rows this wave's automatic passes (skeleton join, composed-literal,
// data-value shape) cannot classify on pattern alone -- each entry backed by
// a real, checked citation to the rendering source, mirroring
// test/desktop-control-label.scan.test.ts's own FIXTURE_EXCLUSIONS/
// COMPOSED_EXCLUSIONS idiom (a SEPARATE table, never editing that
// in-flight-owned file -- DEC-613's "one join" rule is about the join
// technique, not about every table feeding it). Keyed on fileName+line only
// (construction-proof, same reasoning FRAME_CONTENT_EXCLUSIONS above uses).
const HAND_VERIFIED_COMPOSED: { fileName: string; line: number; reason: string }[] = [
  {
    fileName: 'Chautauqua Account.dc.html',
    line: 84,
    reason:
      'COMPOSED-from-a-constant: src/routes/auth-views.tsx:352 renders `placeholder={`At least ${MIN_PASSWORD_LENGTH} characters`}` -- a backtick template literal with an interpolation hole, a shape neither the own-text tier (placeholder, not text content) nor the attribute tier (its quote-char capture is `["\']` only, never a backtick) nor the digit-skeleton join (the SOURCE carries no literal digit at all, only the variable name) can see.',
  },
  {
    fileName: 'Chautauqua Account.dc.html',
    line: 248,
    reason: 'Same MIN_PASSWORD_LENGTH-composed placeholder as the :84 entry above (auth-views.tsx:352), reused on the reset-password screen.',
  },
  {
    fileName: 'Chautauqua Comms.dc.html',
    line: 103,
    reason:
      "COMPOSED-from-data: the frame's \"From which plan\" control is a live review-round picker showing the currently-selected round's own name (PlanEditor.tsx's `round`/`draft.name`); \"Wave 1 — first pass, all tracks\" is this pack's fixture round name, not static app copy.",
  },
  {
    fileName: 'Chautauqua Contacts.dc.html',
    line: 560,
    reason:
      'COMPOSED-from-a-merge-field: app/src/pages/contacts/BulkEmailModal.tsx:357 renders `placeholder="A quick question about your {event_name} session"` -- the frame draws the RESOLVED preview with the `{event_name}` merge token elided; stripping the token from both sides makes them equal.',
  },
  {
    fileName: 'Chautauqua Contacts.dc.html',
    line: 563,
    reason:
      'COMPOSED-from-a-merge-field: app/src/pages/contacts/BulkEmailModal.tsx:369 renders `placeholder="Hi {speaker_name}, ..."` -- the same merge-field-template shape as the :560 entry above, naming a different field (`speaker_name` vs the frame\'s `first_name`) and ASCII `...` vs the frame\'s `…`; BulkEmailModal.tsx:420\'s own comment documents `{first_name}` and `{company}` as this component\'s blessed merge-field vocabulary.',
  },
  {
    fileName: 'Chautauqua Contacts.dc.html',
    line: 597,
    reason:
      "COMPOSED-from-data: the Add-to-event modal's event picker lists OTHER events by name+status (AddToEventModal.tsx); \"DevFlow Conf 2028 · planning\" is this pack's fixture second-event row, a live event name plus its live status, not static app copy.",
  },
  {
    fileName: 'Chautauqua Contacts.dc.html',
    line: 657,
    reason:
      "COMPOSED-from-data: the frame's own \"Why them · One line · shown on the card\" label immediately above this row (Contacts.dc.html:654) names it as a free-text field; PipelineBoard.tsx's suggestion card renders this note from the live suggestion record, never a literal string.",
  },
  {
    fileName: 'Chautauqua Overview.dc.html',
    line: 597,
    reason:
      "COMPOSED-from-data (DEC-777): the Inputs states swatch's \"Read-only\" example reuses the SAME sessionFormatLabel-composed \"N min\" session-length vocabulary DEC-777's wave-148 amendment already rules on for src/routes/portal/edit.tsx's read-only Session-length row -- never a literal string in source.",
  },
  {
    fileName: 'Chautauqua Public and Portal.dc.html',
    line: 919,
    reason:
      "COMPOSED-from-data: a submitted talk's own title (SubmissionsTable/portal rendering of the live `submission.title` field); this pack's fixture title, not static app copy.",
  },
  {
    fileName: 'Chautauqua Public and Portal.dc.html',
    line: 1405,
    reason:
      'COMPOSED-from-data (DEC-777): src/routes/portal/edit.tsx:273-284\'s own comment cites THIS EXACT ROW ("Chautauqua Public and Portal.dc.html:1405 (desktop)") as the read-only Session-length row composed via `sessionFormatLabel(data.formatLabel)` (DEC-908 vocabulary) -- already adjudicated, not a fresh finding.',
  },
  {
    fileName: 'Chautauqua Settings.dc.html',
    line: 665,
    reason:
      'COMPOSED-from-data: the "Form name" field (labelled immediately above at Settings.dc.html:664) is CallForPapersPanel.tsx\'s live `title`/`formResult.title` state ("Default CFP form" is this pack\'s fixture form name), not static app copy.',
  },
  {
    fileName: 'Chautauqua Settings.dc.html',
    line: 1060,
    reason:
      'COMPOSED-from-data: SavedEmbedsPanel.tsx:319 renders `{embed.name}`; app/src/routeManifest.ts\'s own comment documents the seed data naming this exact embed "AI track sessions" -- a live, user-editable embed name, not static app copy.',
  },
  {
    fileName: 'Chautauqua Settings.dc.html',
    line: 1430,
    reason:
      'COMPOSED-from-data: ResourcesPanel.tsx:289 renders `{resource.title}`; "Speaker handbook 2027.pdf" is this pack\'s fixture resource filename (ResourcesPanel.tsx:448\'s own comment quotes this exact confirm-dialog title shape), not static app copy.',
  },
  {
    fileName: 'Chautauqua Settings.dc.html',
    line: 1455,
    reason: 'COMPOSED-from-data: same `{resource.title}` field as the :1430 entry above (ResourcesPanel.tsx:289), a second fixture resource name.',
  },
  {
    fileName: 'Chautauqua Submissions.dc.html',
    line: 274,
    reason:
      "COMPOSED-from-data: app/src/lib/formatLabel.ts's own header names the exact composition (\"Talk, 30 min\" from a stored \"(30 min)\" parenthetical) that produces this shape; \"Lightning talk, 10 min\" is the same sessionFormatLabel/formatLabel vocabulary (DEC-908) applied to a different stored format, never a literal string.",
  },
];

function handVerifiedComposedReason(control: DrawnControl): string | null {
  const hit = HAND_VERIFIED_COMPOSED.find((e) => e.fileName === control.fileName && e.line === control.line);
  return hit ? hit.reason : null;
}

// -- Join + grade every drawn control ---------------------------------------

export type RowStatus = 'ok' | 'offender' | 'unresolved' | 'excluded';

export interface GradedRow {
  control: DrawnControl;
  status: RowStatus;
  reason:
    | 'no-label-match'
    | 'no-token'
    | 'no-rule'
    | 'no-control-shape'
    | 'frame-content'
    /** WAVE 33 (DEC-651): the row's coordinate is already settled by a
     * named product ruling -- a row enters this disposition only carrying
     * the ruling that settled it, never a fresh judgment call. */
    | 'ruling-settled'
    | 'cross-surface-match'
    /** WAVE 29 (DEC-808 amendment): the label resolves as a quoted string
     * literal SOMEWHERE in the corpus (e.g. a ternary's alternate branch)
     * but not as any tag's own full text content or attribute value -- the
     * app composes/renders this exact string, the join just cannot attach
     * it to a control's class list. Never OFFENDER: real, live app text. */
    | 'composed-unseen'
    | null;
  tokens: string[];
  declaredMinHeight: number | null;
  /** Set when status === 'excluded': the source table's own reason string,
   * carried through verbatim (never re-worded). WAVE 29 (DEC-808 amendment):
   * also set, prefixed `HAND-VERIFIED:`, for an `unresolved`/
   * `composed-unseen` row whose disposition came from the hand-verified
   * `HAND_VERIFIED_COMPOSED` table rather than an automatic pass. */
  excludedReason: string | null;
  /** WAVE 28: which tier resolved this row's tokens, for the ledger's own
   * "newly-resolved" naming -- not part of the grading grammar itself.
   * WAVE 23 (DEC-393 amendment) adds 'composed'. WAVE 29 (DEC-808
   * amendment) adds 'skeleton'. */
  /** WAVE 53 (DEC-651 amendment, task w53-c): a per-coordinate widened join
   * -- the ancestor/sibling token that actually paints the control face,
   * verified by hand against the real render source, for a row whose
   * automatic own-text/attribute/composed/skeleton tiers land on the WRONG
   * element (an input's placeholder vs. its own `.chq-input`, an option's
   * text vs. its enclosing `.chq-select`, a dynamically-rendered role/label
   * vs. the static text the naive join finds elsewhere). */
  matchTier: 'own-text' | 'attribute' | 'composed' | 'skeleton' | 'manual-widened' | null;
  /** WAVE 26 amendment (DEC-964): set only when reason === 'cross-surface-match'
   * -- the repo-relative path of the named receipt test that asserts the
   * REAL control's floor byte-for-byte, carried onto the row so the ledger
   * prints it (never a bare assertion with no citation). */
  receiptPath: string | null;
}

/** WAVE 157 REPAIR (DEC-393 amendment): resolves the token set from the
 * class attribute of the element whose OWN text content IS the label --
 * every boundary-anchored occurrence in every blob (`allBoundaryMatches`),
 * kept only when `ownTextEquals` confirms the enclosing tag's full text
 * node is exactly the label, never the nearest-preceding-class read a mere
 * substring match used to license. A row with a resolved token set but no
 * CONTROL-SHAPED member (iii) grades UNRESOLVED rather than OFFENDER: a
 * typography/eyebrow class (`.chq-page-title`, `.chq-section-label`, a
 * table-column label class, …) the pack happens to draw bordered is not
 * the app rendering a bare label as a control, it is the JOIN's own
 * conservatism finding a real element with no control face to grade. */
/** WAVE 26 amendment (DEC-964): grades one control WITHOUT the
 * cross-surface-match reclassification below, additionally returning the
 * set of source files the own-text tier matched into (unpopulated for any
 * other tier). Split out of `gradeControl` so (a) the cross-surface disposition
 * can be driven by real per-row match data instead of re-deriving it, and
 * (b) `SOURCE_FILE_CLUSTERS` below can be built from this SAME function over
 * the real `ALL_CONTROLS` population -- never a second, independently-written
 * join. */
function gradeControlPreCrossSurface(control: DrawnControl): { row: GradedRow; ownTextSourceFiles: Set<string> } {
  const ownTextSourceFiles = new Set<string>();
  const frameContentReason = frameContentExclusionFor(control);
  if (frameContentReason !== null) {
    return {
      row: {
        control,
        status: 'excluded',
        reason: 'frame-content',
        tokens: [],
        declaredMinHeight: null,
        excludedReason: frameContentReason,
        matchTier: null,
        receiptPath: null,
      },
      ownTextSourceFiles,
    };
  }

  const rulingHit = rulingSettledExclusionFor(control);
  if (rulingHit !== null) {
    return {
      row: {
        control,
        status: 'excluded',
        reason: 'ruling-settled',
        tokens: [],
        declaredMinHeight: null,
        excludedReason: `RULING ${rulingHit.ruling}: ${rulingHit.reason}`,
        matchTier: null,
        receiptPath: null,
      },
      ownTextSourceFiles,
    };
  }

  let tokens: string[] = [];
  let ownTextMatched = false;
  for (let i = 0; i < NORMALIZED_BLOBS.length; i++) {
    const blob = NORMALIZED_BLOBS[i]!;
    for (const idx of allBoundaryMatches(control.label, blob)) {
      if (!ownTextEquals(control.label, blob, idx)) continue;
      ownTextMatched = true;
      ownTextSourceFiles.add(SOURCE_FILES[i]!);
      tokens.push(...classTokensNear(blob, idx));
    }
  }
  tokens = [...new Set(tokens)];

  // WAVE 28: attribute/prop label tier, consulted ONLY when the own-text
  // tier found no match for this label anywhere in the corpus.
  let attrMatched = false;
  if (!ownTextMatched) {
    const attrTokens: string[] = [];
    for (const blob of NORMALIZED_BLOBS) {
      const found = attributeLabelTokensInBlob(control.label, blob);
      if (found.length > 0) {
        attrMatched = true;
        attrTokens.push(...found);
      }
    }
    tokens = [...new Set(attrTokens)];
  }

  // WAVE 23 (DEC-393 amendment): composed-label tier, consulted ONLY when
  // NEITHER the own-text nor the attribute tier above found a match.
  let composedMatched = false;
  if (!ownTextMatched && !attrMatched) {
    const composed = resolveComposedLabel(control.label, COMPOSED_HELPERS, NORMALIZED_BLOBS, classTokensNear);
    if (composed !== null) {
      composedMatched = true;
      tokens = composed.tokens;
    }
  }

  const matchTier: GradedRow['matchTier'] = ownTextMatched
    ? 'own-text'
    : attrMatched
      ? 'attribute'
      : composedMatched
        ? 'composed'
        : null;

  if (!ownTextMatched && !attrMatched && !composedMatched) {
    return {
      row: { control, status: 'unresolved', reason: 'no-label-match', tokens, declaredMinHeight: null, excludedReason: null, matchTier, receiptPath: null },
      ownTextSourceFiles,
    };
  }
  if (tokens.length === 0) {
    return {
      row: { control, status: 'unresolved', reason: 'no-token', tokens, declaredMinHeight: null, excludedReason: null, matchTier, receiptPath: null },
      ownTextSourceFiles,
    };
  }

  const fin = finalizeTokens(control, tokens);
  return {
    row: { control, status: fin.status, reason: fin.reason, tokens, declaredMinHeight: fin.declaredMinHeight, excludedReason: null, matchTier, receiptPath: null },
    ownTextSourceFiles,
  };
}

/** Resolves a non-empty, already-extracted token set to a final ok/offender/
 * unresolved verdict -- the shared tail every match tier (own-text,
 * attribute, composed, and WAVE 29's skeleton tier below) funnels through,
 * so no tier can diverge in judgment from another (DEC-393 wave-28's own
 * stated reason for routing its attribute tier through the same
 * `gradeControl` path). Extracted from `gradeControlPreCrossSurface`'s
 * former inline tail (WAVE 29, DEC-808 amendment) so the skeleton tier can
 * reuse it verbatim rather than re-implementing the resolve/corroborate
 * logic a second time (DEC-613: one join, not two). */
function finalizeTokens(
  control: DrawnControl,
  tokens: readonly string[]
): { status: RowStatus; reason: GradedRow['reason']; declaredMinHeight: number | null } {
  let best: number | null = null;
  let anyRule = false;
  let anyControlShaped = false;
  for (const token of tokens) {
    const { hasRule, maxMinHeight, controlShaped } = resolveTokenMinHeightIndexed(token);
    if (hasRule) anyRule = true;
    if (controlShaped) anyControlShaped = true;
    if (maxMinHeight !== null && (best === null || maxMinHeight > best)) best = maxMinHeight;
  }
  if (!anyRule) {
    return { status: 'unresolved', reason: 'no-rule', declaredMinHeight: null };
  }
  if (!anyControlShaped) {
    return { status: 'unresolved', reason: 'no-control-shape', declaredMinHeight: null };
  }
  const declared = best ?? 0;
  const status: RowStatus = declared < control.drawnFloor ? 'offender' : 'ok';
  if (status === 'offender' && !tokens.some((t) => tokenIsControlShapedIndexed(t))) {
    // Corroboration (DEC-393 wave-156 clause (a)): none of the resolved
    // tokens is itself control-shaped -- the whole set is a typography/
    // column register (e.g. .chq-page-title, .chq-portal-field-label)
    // resolving purely by co-incidence of a shared class list. Grading this
    // OFFENDER would put min-height on a heading; drop to UNRESOLVED,
    // honest per the file's own existing chq-chipstrip precedent.
    return { status: 'unresolved', reason: 'no-control-shape', declaredMinHeight: declared };
  }
  return { status, reason: null, declaredMinHeight: declared };
}

/** WAVE 29 (DEC-808 amendment, task w29-e): re-grades a row that fell out of
 * `gradeControlPreCrossSurface` as `unresolved`/`no-label-match` -- first
 * via the digit-collapsed skeleton join (see `skeletonOwnTextTokens` above),
 * then, if that too finds nothing, via the composed-literal/data-value
 * disposition that DISTINGUISHES "the app composes this label and the join
 * cannot see it" from "the app does not draw this label at all" (the task's
 * own required split). Never invoked for any other reason -- a row already
 * excluded, cross-surface-matched, or unresolved for `no-token`/`no-rule`/
 * `no-control-shape` reasons carries its own, already-honest disposition
 * from the primary tiers and is untouched. */
function applySkeletonAndComposedDisposition(control: DrawnControl, row: GradedRow): GradedRow {
  if (row.status !== 'unresolved' || row.reason !== 'no-label-match') return row;

  const { tokens, matched } = skeletonOwnTextTokens(control.label);
  if (matched) {
    if (tokens.length === 0) {
      return { ...row, reason: 'no-token', matchTier: 'skeleton' };
    }
    const fin = finalizeTokens(control, tokens);
    return { ...row, status: fin.status, reason: fin.reason, tokens, declaredMinHeight: fin.declaredMinHeight, matchTier: 'skeleton' };
  }

  // Skeleton pass found nothing either. Distinguish composed-but-unseen
  // (a live JS string literal the join's own-text-exact/attribute rule
  // cannot attach to a class -- e.g. a ternary's alternate branch -- a
  // fixture-shaped data value the frame drew as illustrative instance
  // content, which the app genuinely renders from a live record rather
  // than a literal string at all -- or a specific, hand-verified composed
  // row this wave checked against the real rendering source) from
  // genuinely absent.
  const handVerified = handVerifiedComposedReason(control);
  if (handVerified !== null) {
    return { ...row, reason: 'composed-unseen', excludedReason: `HAND-VERIFIED: ${handVerified}` };
  }
  if (labelIsComposedLiteral(control.label, NORMALIZED_BLOBS) || looksLikeDataValue(control.label)) {
    return { ...row, reason: 'composed-unseen' };
  }

  // Neither the skeleton join, a literal string-quote occurrence anywhere
  // in the corpus, nor the data-value shape test finds any trace of this
  // label -- the app does not draw this content at all. This is an
  // OFFENDER (a content-completeness divergence), never parked back as
  // 'unresolved': DESKTOP IS FROZEN, so this is RECORDED in the audit doc,
  // never silently fixed.
  return { ...row, status: 'offender', reason: null, declaredMinHeight: null };
}

// -- WAVE 26 amendment (DEC-964): cross-surface-match disposition ----------
// "A join that lands on another surface is not evidence about this one."
// A row whose sole own-text match resolves into a source file that renders
// NO frame belonging to the same .dc.html cluster as the drawn row is a
// JOIN artifact, not a divergence -- exactly the shape DEC-964's wave-26
// amendment names for Chautauqua Contacts.dc.html:602 ("Reviewer", resolving
// into PeopleRolesPanel.tsx, a Settings-only file) and Chautauqua
// Submissions.dc.html:314 ("Waitlist", resolving into Overview's queue-move
// button, a different page's control). This is INSTRUMENT ONLY -- it moves
// no product CSS byte, and it can never be used as a blanket escape: it
// requires (a) the row's own-text tier matched into EXACTLY ONE source file
// corpus-wide, (b) that file renders no OTHER control (via a real, OK-graded
// own-text match) belonging to the SAME .dc.html cluster, and (c) a named
// receipt test already asserts the real control's floor byte-for-byte, with
// its path carried onto the row.

/** True when `sourceFile` renders SOME frame belonging to the `.dc.html`
 * cluster named by `clusterFileName`, per `sourceFileClusters` (built from
 * OK-graded own-text matches only -- see `buildSourceFileClusters` below).
 * Exported for the non-vacuity fixture below (fabricated cluster map, never
 * the real corpus). */
export function crossSurfaceDisposition(
  clusterFileName: string,
  receiptKey: string,
  ownTextSourceFiles: ReadonlySet<string>,
  sourceFileClusters: ReadonlyMap<string, ReadonlySet<string>>,
  receiptIndex: ReadonlyMap<string, { receiptPath: string }>
): { crossSurface: boolean; receiptPath: string | null } {
  // "ITS ONLY own-text match" -- a control whose label matched more than one
  // distinct source file is not eligible; a multi-file match is not the
  // single-mismatch shape this disposition exists to catch.
  if (ownTextSourceFiles.size !== 1) return { crossSurface: false, receiptPath: null };
  const [onlySourceFile] = ownTextSourceFiles;
  const clusters = sourceFileClusters.get(onlySourceFile!) ?? new Set<string>();
  // Same-cluster match: the source file genuinely renders (per an OK-graded
  // row) something belonging to this row's own cluster -- not cross-surface,
  // grades normally (stays OFFENDER, a real divergence).
  if (clusters.has(clusterFileName)) return { crossSurface: false, receiptPath: null };
  // Cross-cluster match, but with no named receipt in the gate table: stays
  // OFFENDER -- this disposition is never usable without a positive receipt.
  const receipt = receiptIndex.get(receiptKey);
  if (!receipt) return { crossSurface: false, receiptPath: null };
  return { crossSurface: true, receiptPath: receipt.receiptPath };
}

/** Builds the source-file -> cluster-membership map from `controls`, using
 * ONLY rows that grade 'ok' via the own-text tier (never 'offender' -- an
 * offender row's own match is exactly what might be a cross-surface
 * mismatch, so it must never contribute to the population that judges it or
 * any other row). Derived entirely from `ALL_CONTROLS` (the frame population
 * this scan already walks), never a hand-listed file:cluster table. */
function buildSourceFileClusters(controls: readonly DrawnControl[]): Map<string, Set<string>> {
  const map = new Map<string, Set<string>>();
  for (const control of controls) {
    const { row, ownTextSourceFiles } = gradeControlPreCrossSurface(control);
    if (row.status !== 'ok' || row.matchTier !== 'own-text') continue;
    // Require an UNAMBIGUOUS single-source own-text match to contribute a
    // cluster membership: a generic, shared-vocabulary label ("Cancel",
    // "Save", ...) matches own-text in dozens of source files at once, and
    // treating every one of those as "belongs to this row's cluster" would
    // make nearly every file claim membership in nearly every cluster --
    // exactly the noise this disposition exists to reject, not launder.
    // Only a label whose OK match resolves into exactly one source file is
    // real evidence that file renders THIS row's own cluster.
    if (ownTextSourceFiles.size !== 1) continue;
    const [onlySourceFile] = ownTextSourceFiles;
    let set = map.get(onlySourceFile!);
    if (!set) {
      set = new Set<string>();
      map.set(onlySourceFile!, set);
    }
    set.add(control.fileName);
  }
  return map;
}

const SOURCE_FILE_CLUSTERS: Map<string, Set<string>> = buildSourceFileClusters(ALL_CONTROLS);

/** One (fileName, line) -> receipt-test entry per row this disposition may
 * ever apply to. A POSITIVE gate, never a blanket escape: at module load,
 * every entry's receipt file must exist AND its content must still match
 * `floorAssertionRe` (the real control's floor, byte-for-byte) -- if a
 * receipt stops asserting what this table claims, the module fails to load
 * (fail loudly) rather than silently keep draining the row. */
interface CrossSurfaceReceipt {
  fileName: string;
  line: number;
  /** Repo-relative path, printed on the row so the ledger can cite it. */
  receiptPath: string;
  floorAssertionRe: RegExp;
}

const CROSS_SURFACE_RECEIPTS: CrossSurfaceReceipt[] = [
  {
    fileName: 'Chautauqua Contacts.dc.html',
    line: 602,
    receiptPath: 'app/src/pages/contacts/contacts-role-chip-floor.scan.test.ts',
    floorAssertionRe: /min-height:\s*46px/,
  },
  {
    fileName: 'Chautauqua Submissions.dc.html',
    line: 314,
    receiptPath: 'app/src/pages/submissions/submissions-decision-pair-floor.scan.test.ts',
    floorAssertionRe: /min-height:\s*44px/,
  },
];

const CROSS_SURFACE_RECEIPT_INDEX: Map<string, { receiptPath: string }> = (() => {
  const map = new Map<string, { receiptPath: string }>();
  for (const r of CROSS_SURFACE_RECEIPTS) {
    const full = join(REPO_ROOT, r.receiptPath);
    const content = readFileSync(full, 'utf-8');
    if (!r.floorAssertionRe.test(content)) {
      throw new Error(
        `cross-surface receipt ${r.receiptPath} no longer asserts ${r.floorAssertionRe} for ` +
          `${r.fileName}:${r.line} -- this disposition may only fire on a POSITIVE, live receipt.`
      );
    }
    map.set(`${r.fileName}:${r.line}`, { receiptPath: r.receiptPath });
  }
  return map;
})();

/** WAVE 157 REPAIR (DEC-393 amendment): resolves the token set from the
 * class attribute of the element whose OWN text content IS the label --
 * every boundary-anchored occurrence in every blob (`allBoundaryMatches`),
 * kept only when `ownTextEquals` confirms the enclosing tag's full text
 * node is exactly the label, never the nearest-preceding-class read a mere
 * substring match used to license. A row with a resolved token set but no
 * CONTROL-SHAPED member (iii) grades UNRESOLVED rather than OFFENDER: a
 * typography/eyebrow class (`.chq-page-title`, `.chq-section-label`, a
 * table-column label class, …) the pack happens to draw bordered is not
 * the app rendering a bare label as a control, it is the JOIN's own
 * conservatism finding a real element with no control face to grade.
 * WAVE 26 amendment (DEC-964): an OFFENDER row whose sole own-text match is
 * a cross-surface mismatch (see above) is reclassified UNRESOLVED, gated on
 * a named, live receipt. */
// -- WAVE 53 (DEC-651 amendment, task w53-c): per-row manual join widening --
// The desktop drawn-floor ledger's own-text/attribute/composed/skeleton
// tiers all join on the drawn LABEL's literal text. Fourteen rows (the
// file's own wave-29/33 unresolved detail, minus the 121 `composed-unseen`
// rows out of this task's scope) land on the WRONG element or no element at
// all for a shape those tiers structurally cannot see: an `<input>`'s
// rendered VALUE is never a text node (`value={form.durationMin}`, an
// `<option>` inherits no class of its own, a role/kind button renders its
// label from a shared vocabulary constant rather than a literal string).
// Each entry below is a hand-verified (fileName, line) -> real-control-token
// mapping, checked against the actual render source (cited in each note),
// never a guess -- and every one of the 14 rows named in
// docs/design/audit/desktop-control-floor-v12.md's "WAVE 53" section is
// covered by exactly one of these entries. Once resolved, the row runs
// through the SAME `finalizeTokens` every other tier uses -- no bespoke
// verdict, no hand-typed declaredMinHeight number: DESKTOP IS FROZEN, so
// this widens the INSTRUMENT'S join, never asserts a number the CSS itself
// doesn't already carry.
interface ManualJoinWidening {
  fileName: string;
  line: number;
  tokens: string[];
  note: string;
}

const MANUAL_JOIN_WIDENING: ManualJoinWidening[] = [
  {
    fileName: 'Chautauqua Agenda.dc.html',
    line: 241,
    tokens: ['chq-input'],
    note:
      'BreaksPanel.tsx:449 renders the "Minutes" break-duration field as ' +
      '<input id="chq-break-duration" className="chq-input" type="number" value={form.durationMin} /> ' +
      '-- the drawn "20" is that input\'s live VALUE, never a text node the own-text join can match.',
  },
  {
    fileName: 'Chautauqua Contacts.dc.html',
    line: 567,
    tokens: ['chq-select'],
    note:
      'BulkEmailModal.tsx:381-387 renders the Template field as ' +
      '<select id="bulk-email-template" className="chq-select"><option value="">No template — write it here</option>...</select> ' +
      '-- own-text matches the <option>, which carries no class of its own; the real control is its enclosing <select>.',
  },
  {
    fileName: 'Chautauqua Contacts.dc.html',
    line: 601,
    tokens: ['chq-add-to-event-role-btn'],
    note:
      'AddToEventModal.tsx:176 renders every "As" role chip (Speaker/Reviewer/Guest) with ' +
      'className={`chq-btn chq-add-to-event-role-btn${role === opt.value ? \' is-selected\' : \'\'}`} from ' +
      'PARTICIPANT_ROLE_OPTIONS -- a shared vocabulary, never a literal "Speaker" string, so own-text lands on an ' +
      'unrelated worklist-column-header/page-title token set instead. contacts-panels.css:1215 floors the real ' +
      'class at 46px, top-level, matching the frame exactly.',
  },
  {
    fileName: 'Chautauqua Contacts.dc.html',
    line: 602,
    tokens: ['chq-add-to-event-role-btn'],
    note:
      'Same control as :601 above (the "As" role chip group\'s unselected state, "Reviewer"). Supersedes the ' +
      'cross-surface-match disposition\'s chq-pill mis-attribution (contacts-role-chip-floor.scan.test.ts, DEC-393 ' +
      'wave-17): that receipt already names chq-add-to-event-role-btn as the real control at 46px, matching the ' +
      'frame\'s drawn 46px exactly -- this is RESOLVED, not an artefact needing exclusion.',
  },
  {
    fileName: 'Chautauqua Contacts.dc.html',
    line: 824,
    tokens: ['chq-input'],
    note:
      'NewContactModal.tsx:140-148 renders "First name" as a FormRow label PLUS a sibling ' +
      '<input className="chq-input" placeholder="First name" /> -- own-text matches the label span ' +
      '(chq-portal-field-label), never the real input beside it.',
  },
  {
    fileName: 'Chautauqua Contacts.dc.html',
    line: 828,
    tokens: ['chq-input'],
    note: 'NewContactModal.tsx:150-157, "Last name" -- same shape as :824 above.',
  },
  {
    fileName: 'Chautauqua Contacts.dc.html',
    line: 839,
    tokens: ['chq-input'],
    note: 'NewContactModal.tsx:178-185, "Company" -- same shape as :824 above.',
  },
  {
    fileName: 'Chautauqua Public and Portal.dc.html',
    line: 1435,
    tokens: ['chq-input'],
    note:
      'src/routes/portal/edit.tsx:445-449, the co-presenter "First name" field: ' +
      '<label class="chq-portal-field-label" for="cp-first-name">First name</label>' +
      '<input id="cp-first-name" class="chq-input" .../> -- same label-vs-input shape as the Contacts rows above.',
  },
  {
    fileName: 'Chautauqua Public and Portal.dc.html',
    line: 1439,
    tokens: ['chq-input'],
    note: 'src/routes/portal/edit.tsx:455-459, the co-presenter "Last name" field -- same shape as :1435 above.',
  },
  {
    fileName: 'Chautauqua Settings.dc.html',
    line: 1064,
    tokens: ['chq-select'],
    note:
      'EmbedsPanel.tsx:392-397 renders the embed "Surface" field as ' +
      '<select className="chq-select" ...>, whose current value happens to read "Sessions" -- own-text finds that ' +
      'literal word elsewhere in unrelated page-title/section-label registers, never this select.',
  },
  {
    fileName: 'Chautauqua Settings.dc.html',
    line: 1287,
    tokens: ['chq-input'],
    note:
      'PeopleRolesPanel.tsx:535-538, the "Invite someone" modal\'s "First name" field -- same FormRow-label-vs-input ' +
      'shape as the Contacts rows above.',
  },
  {
    fileName: 'Chautauqua Settings.dc.html',
    line: 1291,
    tokens: ['chq-input'],
    note: 'PeopleRolesPanel.tsx:545-548, "Last name" -- same shape as :1287 above.',
  },
  {
    fileName: 'Chautauqua Submissions.dc.html',
    line: 314,
    tokens: ['chq-detail-decision-secondary-pair'],
    note:
      'Supersedes the cross-surface-match disposition\'s chq-overview-btn mis-attribution ' +
      '(submissions-decision-pair-floor.scan.test.ts, DEC-964 wave-26): SubmissionDetailPage.tsx renders the ' +
      'secondary decision pair\'s label via decisionActionLabel(status), never a literal "Waitlist" string, inside ' +
      '.chq-detail-decision-secondary-pair; detail.css floors ".chq-detail-decision-secondary-pair .chq-btn" at ' +
      'the frame\'s own 44px, top-level -- RESOLVED, not an artefact needing exclusion.',
  },
  {
    fileName: 'Chautauqua Submissions.dc.html',
    line: 680,
    tokens: ['chq-input'],
    note:
      'FieldModal.tsx:231-242, the CFP form field editor\'s "Label" input: ' +
      '<FormRow label="Label" htmlFor="field-label" ...><input id="field-label" className="chq-input" value={label} .../></FormRow> ' +
      '-- own-text matches the drawn VALUE ("Audience level", a stored field label), never the input rendering it.',
  },
];

function manualJoinWideningFor(control: DrawnControl): ManualJoinWidening | null {
  return MANUAL_JOIN_WIDENING.find((e) => e.fileName === control.fileName && e.line === control.line) ?? null;
}

function gradeControl(control: DrawnControl): GradedRow {
  const manual = manualJoinWideningFor(control);
  if (manual !== null) {
    const fin = finalizeTokens(control, manual.tokens);
    return {
      control,
      status: fin.status,
      reason: fin.reason,
      tokens: manual.tokens,
      declaredMinHeight: fin.declaredMinHeight,
      excludedReason: null,
      matchTier: 'manual-widened',
      receiptPath: null,
    };
  }
  const { row: preRow, ownTextSourceFiles } = gradeControlPreCrossSurface(control);
  const row = applySkeletonAndComposedDisposition(control, preRow);
  if (row.status === 'offender' && row.matchTier === 'own-text') {
    const disp = crossSurfaceDisposition(
      control.fileName,
      `${control.fileName}:${control.line}`,
      ownTextSourceFiles,
      SOURCE_FILE_CLUSTERS,
      CROSS_SURFACE_RECEIPT_INDEX
    );
    if (disp.crossSurface) {
      return { ...row, status: 'unresolved', reason: 'cross-surface-match', receiptPath: disp.receiptPath };
    }
  }
  return row;
}

const GRADED: GradedRow[] = ALL_CONTROLS.map(gradeControl);

const OFFENDERS: GradedRow[] = GRADED.filter((r) => r.status === 'offender');
const UNRESOLVED: GradedRow[] = GRADED.filter((r) => r.status === 'unresolved');
const EXCLUDED: GradedRow[] = GRADED.filter((r) => r.status === 'excluded');

// -- Ratchets -----------------------------------------------------------
// Both measured on this branch by forcing each to -1 and reading the
// printed row list. Two-sided per DEC-808 (every ratchet in this campaign
// is two-sided); registered in scripts/exit-predicate.ts's
// OUT_OF_CAMPAIGN_SCOPE only (DEC-393 wave-151 amendment's own reasoning).
// WAVE 26 amendment (DEC-964, task w26-h): both prior survivors --
// `Chautauqua Contacts.dc.html`:602 ("Reviewer") and `Chautauqua
// Submissions.dc.html`:314 ("Waitlist") -- were join artifacts, not
// divergences: each row's ONLY own-text match resolves into a source file
// that renders no frame in its own `.dc.html` cluster (PeopleRolesPanel.tsx
// is Settings-only; Overview's queue-move button is a different page), and
// each real control is genuinely floored in product CSS with a named,
// live receipt (`app/src/pages/contacts/contacts-role-chip-floor.scan.test.ts`,
// `app/src/pages/submissions/submissions-decision-pair-floor.scan.test.ts`).
// Both now grade `unresolved`/`cross-surface-match` instead of `offender`.
// Re-measured on this branch (forcing both ceilings to -1 before AND after):
// 0 offenders (was 2), 139 unresolved (was 137 -- exactly the 2 rows that
// moved). See docs/design/audit/desktop-control-floor-v12.md's "WAVE 26"
// section for the full receipt.
// WAVE 29 (DEC-808 amendment, task w29-e): the digit-collapsed skeleton pass
// plus the composed-literal/data-value/hand-verified dispositions above
// drained the 139-row unresolved residue's no-label-match bucket to a real
// verdict on every row. Re-measured on this branch (forcing both ceilings
// to -1 before AND after): 4 genuine new offenders surface -- none
// resolvable by CSS (DESKTOP IS FROZEN; none of the four is a v12-desktop-
// frame min-height:44px-vs-lower mismatch, they are CONTENT the app never
// renders at all), recorded, never fixed, in
// docs/design/audit/desktop-control-floor-v12.md's "WAVE 29" section:
//   - Chautauqua Overview.dc.html:514 "Remind this task" (frame: States ·
//     hover, pending, drag)
//   - Chautauqua Overview.dc.html:520 "Archive this event" (same frame)
//   - Chautauqua Overview.dc.html:585 "Hover me" (same frame)
//   - Chautauqua Speakers.dc.html:201 "Upload a headshot" (DEC-746: the
//     segmented control's real label is "Upload", an already-ruled
//     simplification, not a fresh gap)
// WAVE 33 (DEC-651): none of the four was a divergence -- the audit's own
// "recorded, not fixed" section said so. The three States-frame rows are
// component-swatch-panel labels (never product copy) and the fourth is
// already ruled: RE-DISPOSITIONED, never re-adjudicated. (a) The `States ·
// hover, pending, drag` frame (Chautauqua Overview.dc.html:476-688) is now
// excluded at the POPULATION step (`isStatesSwatchFrameTitle`), so its
// three offender rows -- and all 19 of the frame's drawn-control rows,
// which were never product copy either -- no longer enter ALL_CONTROLS at
// all. (b) `Chautauqua Speakers.dc.html:201` moves into
// `RULING_SETTLED_EXCLUSIONS` carrying DEC-746 as its ruling id, grading
// `excluded`/`ruling-settled` instead of `offender`. Re-measured on this
// branch (forcing both ceilings to -1 before AND after): 0 offenders (was
// 4), ALL_CONTROLS drops 266 -> 247 (19 population-excluded rows), and
// unresolved drops 135 -> 131 (4 of the removed States-frame rows were
// themselves `unresolved`, not `offender` -- MEASURED, not assumed: see
// docs/design/audit/desktop-control-floor-v12.md's "WAVE 33" section for
// the full receipt). Zero product CSS bytes moved; desktop stays frozen.
// WAVE 53 (DEC-651 amendment, task w53-c): the 14 non-composed unresolved
// rows (2 no-token, 10 no-control-shape, 2 cross-surface-match) were
// individually adjudicated via `MANUAL_JOIN_WIDENING` -- re-measured on
// this branch (forcing both ceilings to -1 before AND after): 0 offenders
// (UNCHANGED), all 14 RESOLVED to `ok` (none OFFENDER, none
// POPULATION-EXCLUDED). Full per-row disposition in
// docs/design/audit/desktop-control-floor-v12.md's "WAVE 53" section. Zero
// product CSS bytes moved; desktop stays frozen.
export const DESKTOP_FLOOR_DIVERGENCE_CEILING = 0;
// Lowered wave-13-xb (DEC-613): re-measured at 137, was stale at 138.
// WAVE 23 (DEC-393 amendment, task w23-g): the composed-label tier
// (test/helpers/composed-label-resolve.ts, shared with the phone half)
// was added to this file's gradeControl, consulted only when neither the
// own-text nor the attribute tier resolves a label. Re-measured on this
// branch (forcing both ceilings to -1): BOTH constants are UNCHANGED --
// 2 offenders, 137 unresolved, byte-identical to the pre-widening
// measurement. The tier genuinely resolves ZERO desktop rows: every
// composed-copy label this campaign has ("Move DFC-047 to 11:30", via
// schedule-copy.ts's conflictMoveLabel) is drawn only inside a PHONE
// (width:390) frame extent in its own source .dc.html file, so it never
// enters this file's own `!isPhone` population at all -- there is no
// desktop-frame row for the tier to have a chance at. A widening that
// finds nothing is a real result, not a bug; see
// docs/design/audit/desktop-control-floor-v12.md's "WAVE 23" section for
// the full before/after receipt.
// WAVE 29 (DEC-808 amendment): re-measured on this branch (forcing both
// ceilings to -1 before AND after adding the skeleton/composed-disposition
// passes): 135 unresolved (was 139 -- the 4 rows above moved to offender,
// zero rows moved to/from excluded/cross-surface-match/ok). Breakdown: 121
// composed-unseen (2 skeleton-resolved-to-no-token do NOT count here --
// see the no-token line below), 2 no-token, 10 no-control-shape, 2
// cross-surface-match. Full per-row detail in
// docs/design/audit/desktop-control-floor-v12.md's "WAVE 29" section.
// WAVE 33 (DEC-651): re-measured on this branch (forcing both ceilings to -1
// before AND after the States-swatch population exclusion + DEC-746 ruling-
// settled move above): 131 unresolved (was 135) -- this MOVES, contrary to
// the task's own "expect unchanged" prior. Verified by printing every one of
// the States frame's 19 rows' pre-exclusion disposition: 8 `ok` (Save
// changes x4, Cancel x4), 3 `offender` (the three named above), 4
// `unresolved`/`composed-unseen` ("Priya Raman" x2, "dana@example", "Talk,
// 30 min" -- fixture/data-value shapes), 4 `excluded`/`frame-content`
// ("Send 23 emails" x2, "Sending 12 of 23…", "Uploading…" -- already
// FIXTURE/COMPOSED-excluded by the label ledger). 8+3+4+4 = 19, matching the
// frame's own control count. The DEC-746 move is offender->excluded only and
// moves zero unresolved rows; the 4-row unresolved delta is entirely the
// population exclusion's own `composed-unseen` rows leaving the population.
// WAVE 53 (DEC-651 amendment, task w53-c): re-measured on this branch
// (forcing both ceilings to -1 before AND after): 117 unresolved (was 131)
// -- exactly the 14 rows `MANUAL_JOIN_WIDENING` resolves to `ok`, all other
// 117 rows (all `composed-unseen`) untouched. See docs/design/audit/
// desktop-control-floor-v12.md's "WAVE 53" section for the full receipt.
export const DESKTOP_FLOOR_UNRESOLVED_CEILING = 117;

// -- WAVE 52 (DEC-374 wave-52 amendment, task w52-f); WAVE 55 (DEC-374
// wave-52 amendment, task w55-a): comment-credited floors -- MEASUREMENT,
// RATCHET, AND REPAIR --------------------------------------------------
// PROVEN root cause (task description, not re-derived here): frame-source-
// corpus's `stripComments` deliberately enters a template/single/double
// STRING state on a quote and copies everything through verbatim to the
// closing quote, so every `src/**/*.css.ts` sheet -- one giant template
// literal -- keeps ALL of its CSS `/* ... */` comments through
// `normalizeSource`. `RULE_RE` above then parses rules as "everything
// between two braces", which folds each surviving comment into the NEXT
// rule's raw selector text, and `selectorMentionsToken` matches a
// dot-prefixed class token written in prose there -- crediting that token a
// min-height it never declares. The error is proven ONE-DIRECTIONAL: a
// comment can only ADD tokens to a selector (never remove a real one), so it
// can only SUPPRESS true offenders already in `OFFENDERS`/`UNRESOLVED`
// above. Wave 52 only MEASURED this defect's population and ratcheted it,
// deferring the repair. Wave 55 EXECUTES the repair DEC_374 already orders:
// TOKEN_INDEX and CONTROL_SHAPE_INDEX above are now built from
// COMMENT_FREE_TOPLEVEL_BLOBS (defined up near TOPLEVEL_BLOBS, before either
// index's build loop runs), not TOPLEVEL_BLOBS -- so a comment can no longer
// fold into a following rule's selector text anywhere in this file's real
// grading path. `resolveTokenMinHeightIndexed`/`gradeControl`/`OFFENDERS`/
// `UNRESOLVED` above are consequently now driven by the CLEAN index; the
// fold being one-directional (comments only ever ADD tokens) means this
// repair can only REVEAL previously-suppressed OFFENDER/UNRESOLVED rows,
// never hide a real one. TOPLEVEL_BLOBS itself is untouched (still
// comment-including) and remains the honest "raw" corpus below, so the
// measurement/ratchet machinery (COMMENT_CREDITED_OFFENDERS) is unchanged
// code, now simply measuring an index that has already been repaired --
// with TOKEN_INDEX now built from the same comment-free blobs as the
// "clean" comparison side, no token's real-pipeline credit can any longer
// diverge from its comment-stripped credit, so the offender count is 0.

/** True when `token` currently resolves a min-height over `rawBlobs` but
 * resolves NONE at all over `cleanBlobs` (the same blobs with CSS comments
 * additionally stripped) -- i.e. the token's ENTIRE min-height credit
 * exists only via comment text folded into a selector, never via a genuine
 * declaration. A token with no credit at all over `rawBlobs` is not a
 * comment-credited offender (nothing to suppress a genuine gap for) and
 * grades false, same as a token whose credit survives comment-stripping
 * unchanged (a real declaration). Exported for the non-vacuity control
 * below, which drives it over a fabricated blob pair, never a real product
 * token. */
export function isCommentOnlyCredited(token: string, rawBlobs: readonly string[], cleanBlobs: readonly string[]): boolean {
  const raw = resolveTokenMinHeight(token, rawBlobs);
  if (raw.maxMinHeight === null) return false;
  const clean = resolveTokenMinHeight(token, cleanBlobs);
  return clean.maxMinHeight === null;
}

export interface CommentCreditedOffender {
  token: string;
  creditedMinHeight: number;
  fileName: string;
  cleanSelector: string;
}

/** One-pass companion to TOKEN_INDEX's own build loop above (same shape,
 * same RULE_RE walk), run over the comment-stripped blobs instead of the
 * raw ones -- O(rules) total, never re-scanned per token. Used only to
 * check whether a token's credit survives comment-stripping; never merged
 * into the real TOKEN_INDEX (this file's existing grading is untouched). */
function buildMinHeightIndex(blobs: readonly string[]): Map<string, { maxMinHeight: number | null }> {
  const index = new Map<string, { maxMinHeight: number | null }>();
  for (const blob of blobs) {
    RULE_RE.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = RULE_RE.exec(blob))) {
      const selectorText = m[1]!;
      const body = m[2]!;
      const mh = body.match(/min-height\s*:\s*(\d+)px/);
      const v = mh ? Number(mh[1]) : null;
      SELECTOR_CLASS_TOKEN_RE.lastIndex = 0;
      let tm: RegExpExecArray | null;
      const seenInRule = new Set<string>();
      while ((tm = SELECTOR_CLASS_TOKEN_RE.exec(selectorText))) {
        const tok = tm[1]!;
        if (seenInRule.has(tok)) continue;
        seenInRule.add(tok);
        const existing = index.get(tok);
        if (!existing) {
          index.set(tok, { maxMinHeight: v });
        } else if (v !== null && (existing.maxMinHeight === null || v > existing.maxMinHeight)) {
          existing.maxMinHeight = v;
        }
      }
    }
  }
  return index;
}

/** One-pass companion evidence walk (same RULE_RE walk as `buildMinHeightIndex`
 * above, O(rules) total): for every token whose RAW selector text credits it
 * a min-height, but whose comment-stripped selector text does NOT name it,
 * records the FIRST such (fileName, cleanSelector) -- the exact real rule
 * the comment folded into. Never re-scans the corpus per flagged token. */
function buildCommentCreditEvidence(
  rawSourceRelativeNames: readonly string[],
  rawTopLevelBlobs: readonly string[]
): Map<string, { fileName: string; cleanSelector: string }> {
  const evidence = new Map<string, { fileName: string; cleanSelector: string }>();
  for (let i = 0; i < rawTopLevelBlobs.length; i++) {
    const blob = rawTopLevelBlobs[i]!;
    RULE_RE.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = RULE_RE.exec(blob))) {
      const selectorText = m[1]!;
      const body = m[2]!;
      if (!/min-height\s*:\s*\d+px/.test(body)) continue;
      const cleanSelector = stripCssComments(selectorText).replace(/\s+/g, ' ').trim();
      SELECTOR_CLASS_TOKEN_RE.lastIndex = 0;
      let tm: RegExpExecArray | null;
      while ((tm = SELECTOR_CLASS_TOKEN_RE.exec(selectorText))) {
        const tok = tm[1]!;
        if (evidence.has(tok)) continue;
        if (selectorMentionsToken(cleanSelector, tok)) continue; // a genuine mention, not comment-sourced
        evidence.set(tok, { fileName: rawSourceRelativeNames[i]!, cleanSelector });
      }
    }
  }
  return evidence;
}

/** Every `chq-` token the file's existing `TOKEN_INDEX` credits with a
 * min-height whose entire credit is comment-only -- i.e. `resolveTokenMinHeight`
 * over the comment-stripped blobs finds no min-height for it at all -- paired
 * with a located crediting rule for citation: the first rule anywhere in the
 * raw (comment-including) corpus whose raw selector text names the token and
 * declares a min-height, but whose comment-stripped selector text does NOT
 * name the token -- the exact rule the comment folded into. Both passes are
 * one-time O(rules) walks (`buildMinHeightIndex`/`buildCommentCreditEvidence`
 * above), never a per-token corpus re-scan. Throws loudly (never silently
 * drops a row) if a flagged token has no locatable crediting rule -- that
 * would mean this function's own logic is inconsistent with TOKEN_INDEX's
 * build, an instrument bug, not a defect to report quietly. Exported so the
 * non-vacuity control below and the audit doc's population are driven by the
 * SAME function, never a second copy. */
export function findCommentCreditedOffenders(
  tokenIndex: ReadonlyMap<string, { hasRule: boolean; maxMinHeight: number | null; controlShaped: boolean }>,
  rawSourceRelativeNames: readonly string[],
  rawTopLevelBlobs: readonly string[],
  cleanTopLevelBlobs: readonly string[]
): CommentCreditedOffender[] {
  const cleanIndex = buildMinHeightIndex(cleanTopLevelBlobs);
  const evidenceIndex = buildCommentCreditEvidence(rawSourceRelativeNames, rawTopLevelBlobs);
  const out: CommentCreditedOffender[] = [];
  for (const [token, entry] of tokenIndex) {
    if (!token.startsWith('chq-')) continue; // task grammar: "every chq- class token" -- TOKEN_INDEX's own SELECTOR_CLASS_TOKEN_RE also matches non-chq- `.word` tokens (file-extension mentions like ".ts"/".css" in prose), out of this ceiling's scope
    if (entry.maxMinHeight === null) continue;
    const cleanEntry = cleanIndex.get(token);
    if (cleanEntry && cleanEntry.maxMinHeight !== null) continue; // survives comment-stripping: a genuine declaration
    const evidence = evidenceIndex.get(token);
    if (!evidence) {
      throw new Error(
        `comment-credited token "${token}" has no locatable crediting rule -- ` +
          `findCommentCreditedOffenders is inconsistent with its own clean-index pass (instrument bug)`
      );
    }
    out.push({ token, creditedMinHeight: entry.maxMinHeight, fileName: evidence.fileName, cleanSelector: evidence.cleanSelector });
  }
  return out.sort((a, b) => a.token.localeCompare(b.token));
}

const SOURCE_FILE_RELATIVE_NAMES: string[] = SOURCE_FILES.map((f) => relative(REPO_ROOT, f));

const COMMENT_CREDITED_OFFENDERS: CommentCreditedOffender[] = findCommentCreditedOffenders(
  TOKEN_INDEX,
  SOURCE_FILE_RELATIVE_NAMES,
  TOPLEVEL_BLOBS,
  COMMENT_FREE_TOPLEVEL_BLOBS
);

// RATCHET, two-sided, mirroring DESKTOP_FLOOR_DIVERGENCE_CEILING above.
// MEASURED on this branch by forcing to -1 and reading the printed offender
// list -- never an expression naming the measured set. Registered in
// scripts/exit-predicate/campaign-scope/out-of-campaign-scope.ts ONLY
// (never CAMPAIGN_CONSTANT_NAMES/TIER2_CEILING_NAMES): a fresh measurement
// never moves the exit gate's goalposts mid-convergence (DEC-393 wave-147's
// reasoning for DESKTOP_FLOOR_DIVERGENCE_CEILING/DESKTOP_FLOOR_UNRESOLVED_CEILING
// above, restated wave-52 for this new instrument-soundness ceiling). This
// ceiling counts an INSTRUMENT defect (a suppressed OFFENDER/UNRESOLVED
// count elsewhere in this file), not a product CSS gap -- repairing the
// parse itself is a later, separately-scoped lane.
export const COMMENT_CREDITED_FLOOR_CEILING = 0;

describe('desktop drawn-floor ledger (DEC-393 wave-151 amendment, v12 mobile campaign)', () => {
  it('non-vacuity: digit-collapsed skeleton join -- fabricated positive (drawn digits differ from rendered digits) vs negative (no digit in label, skeleton never invoked)', () => {
    expect(collapseDigitsToSkeleton('At least 12 characters, 3 tries left')).toBe('At least # characters, # tries left');
    // POSITIVE: label carries digits that differ from the corpus's own
    // rendered digits -- the literal own-text tier would never match "20
    // min" against a corpus rendering "45 min", but the skeleton join does.
    const skelBlobs = [normalizeSource('<span className="chq-zzy-skel-fixture">45 min</span>')];
    const skelLabel = collapseDigitsToSkeleton('20 min');
    let matched = false;
    for (const blob of skelBlobs) {
      const collapsedBlob = collapseDigitsToSkeleton(blob);
      for (const idx of allBoundaryMatches(skelLabel, collapsedBlob)) {
        if (ownTextEquals(skelLabel, collapsedBlob, idx)) {
          matched = true;
          expect(classTokensNear(collapsedBlob, idx)).toEqual(['chq-zzy-skel-fixture']);
        }
      }
    }
    expect(matched).toBe(true);
    // NEGATIVE: a label with no digit at all is never handed to the
    // skeleton tier -- collapsing would be a no-op, and skeletonOwnTextTokens
    // (over the REAL corpus) short-circuits it explicitly.
    expect(skeletonOwnTextTokens('Zzy No Digit Label Present Nowhere').matched).toBe(false);
  });

  it('non-vacuity: composed-literal disposition -- fabricated positive (quoted anywhere, e.g. a ternary branch) vs negative (bare substring, no flanking quote)', () => {
    const ternaryBlob = normalizeSource("{loading ? 'Saving…' : 'Zzy Composed Ternary Label'}");
    expect(labelIsComposedLiteral('Zzy Composed Ternary Label', [ternaryBlob])).toBe(true);
    // NEGATIVE: the same text with no flanking quote character at all (a
    // plain comment/prose mention) must not resolve.
    const proseBlob = normalizeSource('// mentions Zzy Composed Ternary Label in passing, never quoted');
    expect(labelIsComposedLiteral('Zzy Composed Ternary Label', [normalizeSource(proseBlob)])).toBe(false);
    // NEGATIVE: mismatched flanking quote characters (single vs double) must
    // not resolve -- both sides must be the SAME quote character.
    const mismatchedBlob = "'Zzy Mismatched Quote Label\"";
    expect(labelIsComposedLiteral('Zzy Mismatched Quote Label', [mismatchedBlob])).toBe(false);
  });

  it('non-vacuity: looksLikeDataValue -- fabricated positives across every shape vs a negative (a short UI verb-phrase button caption)', () => {
    expect(looksLikeDataValue('••••••••')).toBe(true);
    expect(looksLikeDataValue('zzy@example.com')).toBe(true);
    expect(looksLikeDataValue('16 Aug 2027')).toBe(true);
    expect(looksLikeDataValue('15:30')).toBe(true);
    expect(looksLikeDataValue('Wed 13')).toBe(true);
    expect(looksLikeDataValue('America/Los_Angeles')).toBe(true);
    expect(looksLikeDataValue('24')).toBe(true);
    expect(looksLikeDataValue('devflow-conf-2028')).toBe(true);
    expect(looksLikeDataValue('chautauqua.cc/e/devflow-conf-2027')).toBe(true);
    expect(looksLikeDataValue('Moscone West, San Francisco')).toBe(true);
    expect(looksLikeDataValue('Priya Raman')).toBe(true);
    expect(looksLikeDataValue('Whitfield')).toBe(true);
    expect(looksLikeDataValue('Format ▾')).toBe(true);
    expect(looksLikeDataValue('A'.repeat(45))).toBe(true);
    // NEGATIVE: a short, static, verb-phrase UI action caption -- exactly
    // the shape a real "app does not draw this" offender has -- must NOT be
    // misclassified as a data value.
    expect(looksLikeDataValue('Save the question')).toBe(false);
    expect(looksLikeDataValue('Turn it off')).toBe(false);
  });

  it('non-vacuity: enumerates exactly 108 desktop frames across 13 files (same population test/desktop-frame-ledger.scan.test.ts measures pre-exclusion)', () => {
    const files = designFiles();
    expect(files.length).toBe(13);
    expect(DESKTOP_FRAMES.length).toBe(108);
  });

  it('non-vacuity: extracts exactly 247 drawn controls, with the exact per-file breakdown', () => {
    const perFile: Record<string, number> = {};
    for (const c of ALL_CONTROLS) perFile[c.fileName] = (perFile[c.fileName] ?? 0) + 1;
    expect(perFile).toEqual({
      'Chautauqua Account.dc.html': 17,
      'Chautauqua Agenda.dc.html': 5,
      'Chautauqua Comms.dc.html': 9,
      'Chautauqua Contacts.dc.html': 28,
      'Chautauqua Content.dc.html': 4,
      'Chautauqua Home.dc.html': 5,
      'Chautauqua Overview.dc.html': 9,
      'Chautauqua Public and Portal.dc.html': 41,
      'Chautauqua Review.dc.html': 15,
      'Chautauqua Settings.dc.html': 67,
      'Chautauqua Speakers.dc.html': 20,
      'Chautauqua Submissions.dc.html': 27,
    });
    expect(ALL_CONTROLS.length).toBe(247);
    // Chautauqua Docs.dc.html draws none of this shape -- confirmed absent
    // rather than silently missing from the breakdown above.
    expect(perFile['Chautauqua Docs.dc.html']).toBeUndefined();
  });

  it('non-vacuity: the drawn-floor histogram is large and spans more than the ruled 44px minimum', () => {
    const histogram: Record<number, number> = {};
    for (const c of ALL_CONTROLS) histogram[c.drawnFloor] = (histogram[c.drawnFloor] ?? 0) + 1;
    expect(histogram[46]).toBeGreaterThan(histogram[44] ?? 0);
    expect(Object.values(histogram).reduce((a, b) => a + b, 0)).toBe(247);
  });

  it('non-vacuity: source population is large and spans both app/src and src', () => {
    expect(SOURCE_FILES.length).toBeGreaterThan(300);
    expect(SOURCE_FILES.some((f) => f.startsWith(APP_SRC_ROOT))).toBe(true);
    expect(SOURCE_FILES.some((f) => f.startsWith(SRC_ROOT) && !f.startsWith(APP_SRC_ROOT))).toBe(true);
  });

  it('non-vacuity: synthetic positive/negative controls over a fabricated single-file population', () => {
    // Fabricated frame text -- never a real product token -- wearing the
    // three drawn-control shapes the extractor looks for, plus a negative
    // (bare min-height, no border-radius/border/background) that must NOT
    // be extracted.
    const fabricatedFrameText = [
      '<div style="display:flex; flex-direction:column">',
      '  <span style="border:1px solid #BAB6A6; border-radius:6px; background:#FAF8F2; min-height:46px">Zzy Field Present</span>',
      '  <span style="background:#4E5C31; border-radius:4px; min-height:44px">Zzy Chip Present</span>',
      '  <a href="#" style="min-height:44px">Zzy Anchor Present</a>',
      '  <span style="min-height:44px">Zzy Bare Chip Absent</span>',
      '</div>',
    ].join('\n');
    const extracted = drawnControlsInFrameText(fabricatedFrameText);
    const labels = extracted.map((e) => e.label);
    expect(labels).toContain('Zzy Field Present');
    expect(labels).toContain('Zzy Chip Present');
    expect(labels).toContain('Zzy Anchor Present');
    // NEGATIVE: bare min-height with no border-radius/border/background is
    // not a drawn control face -- never extracted.
    expect(labels).not.toContain('Zzy Bare Chip Absent');
    expect(extracted.find((e) => e.label === 'Zzy Field Present')?.drawnFloor).toBe(46);

    // POSITIVE class-token read: a label directly inside a classed tag's
    // text content resolves that tag's chq- tokens.
    const positiveBlob = normalizeSource('<span className="chq-zzy-fixture chq-zzy-other">Zzy Field Present</span>');
    const posIdx = firstBoundaryMatch('Zzy Field Present', positiveBlob)!;
    expect(posIdx).not.toBeNull();
    expect(classTokensNear(positiveBlob, posIdx).sort()).toEqual(['chq-zzy-fixture', 'chq-zzy-other']);

    // NEGATIVE: a match landing inside an attribute value (not real text
    // content) must not misattribute the enclosing tag's class.
    const negativeBlob = normalizeSource('<div className="chq-zzy-wrapper" aria-label="Zzy Field Present type">x</div>');
    const negIdx = firstBoundaryMatch('Zzy Field Present', negativeBlob)!;
    expect(negIdx).not.toBeNull();
    expect(classTokensNear(negativeBlob, negIdx)).toEqual([]);

    // Rule resolution: top-level rule wins, @media-scoped rule is ignored
    // for the desktop grading value.
    const fixtureCss = normalizeSource(
      [
        '.chq-zzy-fixture { min-height: 30px; }',
        '@media (max-width: 700px) { .chq-zzy-fixture { min-height: 60px; } }',
      ].join('\n')
    );
    const stripped = stripMediaBlocks(fixtureCss);
    expect(stripped).not.toContain('60px');
    const resolved = resolveTokenMinHeight('chq-zzy-fixture', [stripped]);
    expect(resolved).toEqual({ hasRule: true, maxMinHeight: 30 });
    // NEGATIVE: an unmentioned token has no rule at all.
    const unresolved = resolveTokenMinHeight('chq-zzy-unmentioned', [stripped]);
    expect(unresolved).toEqual({ hasRule: false, maxMinHeight: null });
  });

  it('non-vacuity: control-shape corroboration -- fabricated positive (bordered control) vs negative (typography-only) tokens', () => {
    // POSITIVE: a fabricated control-shaped rule -- declares border-radius
    // and min-height, the drawn-control face itself -- is control-shaped.
    const controlBlob = normalizeSource(
      '.chq-zzy-control { border: 1px solid #BAB6A6; border-radius: 6px; min-height: 46px; }'
    );
    expect(tokenIsControlShaped('chq-zzy-control', [stripMediaBlocks(controlBlob)])).toBe(true);

    // POSITIVE (background-only face, e.g. a solid chip with no border):
    const bgBlob = normalizeSource('.chq-zzy-chip { background: #4E5C31; border-radius: 4px; min-height: 44px; }');
    expect(tokenIsControlShaped('chq-zzy-chip', [stripMediaBlocks(bgBlob)])).toBe(true);

    // POSITIVE (padding-inline face, no border/background of its own):
    const padBlob = normalizeSource('.chq-zzy-padded { padding-inline: 18px; min-height: 44px; }');
    expect(tokenIsControlShaped('chq-zzy-padded', [stripMediaBlocks(padBlob)])).toBe(true);

    // NEGATIVE: a fabricated typography/column register -- font-size,
    // letter-spacing, text-transform, no border/background/padding-inline/
    // min-height anywhere in its own rule -- is NOT control-shaped, exactly
    // the .chq-page-title / .chq-portal-field-label shape this clause
    // exists to keep off the offender ledger.
    const labelBlob = normalizeSource(
      '.chq-zzy-label { font-size: 11px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; }'
    );
    expect(tokenIsControlShaped('chq-zzy-label', [stripMediaBlocks(labelBlob)])).toBe(false);

    // NEGATIVE: an unmentioned token has no rule at all, so it is not
    // control-shaped either (absence, never a false positive).
    expect(tokenIsControlShaped('chq-zzy-unmentioned-shape', [stripMediaBlocks(labelBlob)])).toBe(false);

    // FULL-PIPELINE GRADE: a fabricated offender row whose ONLY resolved
    // token is the typography-only register above must be reclassified to
    // 'unresolved'/'no-control-shape' rather than 'offender', mirroring
    // gradeControl's own corroboration clause (re-implemented here over the
    // fabricated blob set, never the real corpus/TOKEN_INDEX, since those
    // are frozen at module load over app/src+src).
    const fabricatedTokens = ['chq-zzy-label'];
    const fabricatedBlobs = [stripMediaBlocks(labelBlob)];
    const fabricatedResolved = resolveTokenMinHeight('chq-zzy-label', fabricatedBlobs);
    expect(fabricatedResolved.hasRule).toBe(true); // rule exists (grades OFFENDER pre-corroboration)
    expect(fabricatedResolved.maxMinHeight).toBeNull(); // declares 0 -- an offender at 0 by the file's own grammar
    const anyControlShaped = fabricatedTokens.some((t) => tokenIsControlShaped(t, fabricatedBlobs));
    expect(anyControlShaped).toBe(false); // corroboration clause fires: reclassify to unresolved
  });

  it('non-vacuity: attribute/prop label tier -- fabricated positive (same-tag label+class) vs negative (class on a different tag)', () => {
    // POSITIVE: the label is the COMPLETE value of a quoted `label` attribute
    // on a tag that ALSO carries chq- tokens in its own class attribute --
    // resolves.
    const positiveTagBlob = normalizeSource(
      '<button label="Zzy Attr Present" className="chq-zzy-attr-fixture chq-zzy-attr-other">x</button>'
    );
    expect(attributeLabelTokensInBlob('Zzy Attr Present', positiveTagBlob).sort()).toEqual([
      'chq-zzy-attr-fixture',
      'chq-zzy-attr-other',
    ]);

    // POSITIVE: same shape via aria-label/placeholder/title, each alone.
    expect(
      attributeLabelTokensInBlob(
        'Zzy Aria Present',
        normalizeSource('<div aria-label="Zzy Aria Present" className="chq-zzy-aria-fixture">x</div>')
      )
    ).toEqual(['chq-zzy-aria-fixture']);
    expect(
      attributeLabelTokensInBlob(
        'Zzy Placeholder Present',
        normalizeSource('<input placeholder="Zzy Placeholder Present" className="chq-zzy-placeholder-fixture" />')
      )
    ).toEqual(['chq-zzy-placeholder-fixture']);
    expect(
      attributeLabelTokensInBlob(
        'Zzy Title Present',
        normalizeSource('<a title="Zzy Title Present" className="chq-zzy-title-fixture">x</a>')
      )
    ).toEqual(['chq-zzy-title-fixture']);

    // NEGATIVE: the label attribute matches, but the chq- class lives on a
    // DIFFERENT tag (an ancestor) -- must NOT resolve, since the tier
    // requires both on the SAME opening tag.
    const differentTagBlob = normalizeSource(
      '<div className="chq-zzy-ancestor-only"><button label="Zzy Attr Absent">x</button></div>'
    );
    expect(attributeLabelTokensInBlob('Zzy Attr Absent', differentTagBlob)).toEqual([]);

    // NEGATIVE: the label attribute matches but the SAME tag carries no
    // class/className at all -- must NOT resolve.
    const noClassBlob = normalizeSource('<button label="Zzy Attr Bare">x</button>');
    expect(attributeLabelTokensInBlob('Zzy Attr Bare', noClassBlob)).toEqual([]);

    // NEGATIVE: a partial (not complete-value) attribute match must NOT
    // resolve -- the label is a substring of the attribute value, not equal
    // to it.
    const partialBlob = normalizeSource(
      '<button label="Zzy Attr Present plus extra" className="chq-zzy-attr-partial">x</button>'
    );
    expect(attributeLabelTokensInBlob('Zzy Attr Present', partialBlob)).toEqual([]);

    // FULL-PIPELINE: classTokensInOpenTag reads a whole captured opening tag
    // directly (companion to classTokensNear's backward text-node walk).
    expect(
      classTokensInOpenTag('<button label="Zzy Attr Present" className="chq-zzy-attr-fixture chq-zzy-attr-other">')
        .sort()
    ).toEqual(['chq-zzy-attr-fixture', 'chq-zzy-attr-other']);
    expect(classTokensInOpenTag('<button label="Zzy Attr Present">')).toEqual([]);
  });

  it(`never exceeds DESKTOP_FLOOR_DIVERGENCE_CEILING (${DESKTOP_FLOOR_DIVERGENCE_CEILING}) resolved offenders`, () => {
    if (OFFENDERS.length > DESKTOP_FLOOR_DIVERGENCE_CEILING) {
      const rows = OFFENDERS.map(
        (r) =>
          `${r.control.fileName}:${r.control.line} -- "${r.control.label}" draws min-height:${r.control.drawnFloor}px ` +
          `(frame: ${r.control.frameTitle}); resolved tokens [${r.tokens.join(', ')}] declare ${r.declaredMinHeight}px`
      );
      throw new Error(
        `${OFFENDERS.length} desktop drawn-floor divergences, above the ceiling of ` +
          `${DESKTOP_FLOOR_DIVERGENCE_CEILING}. DESKTOP_FLOOR_DIVERGENCE_CEILING may only be RAISED ` +
          `(a merge-train act, never a worker's edit mid-lane). Offenders:\n${rows.join('\n')}`
      );
    }
    expect(OFFENDERS.length).toBeLessThanOrEqual(DESKTOP_FLOOR_DIVERGENCE_CEILING);
  });

  it(`never sits BELOW DESKTOP_FLOOR_DIVERGENCE_CEILING (${DESKTOP_FLOOR_DIVERGENCE_CEILING}) without the ceiling being lowered to match (a stale ceiling licenses stagnation)`, () => {
    if (OFFENDERS.length < DESKTOP_FLOOR_DIVERGENCE_CEILING) {
      throw new Error(
        `${OFFENDERS.length} desktop drawn-floor divergences, below the ceiling of ` +
          `${DESKTOP_FLOOR_DIVERGENCE_CEILING}. Lower the ceiling in the same commit by replacing the line:\n` +
          `  export const DESKTOP_FLOOR_DIVERGENCE_CEILING = ${OFFENDERS.length};`
      );
    }
    expect(OFFENDERS.length).toBeGreaterThanOrEqual(DESKTOP_FLOOR_DIVERGENCE_CEILING);
  });

  it(`never exceeds DESKTOP_FLOOR_UNRESOLVED_CEILING (${DESKTOP_FLOOR_UNRESOLVED_CEILING}) unresolved rows`, () => {
    if (UNRESOLVED.length > DESKTOP_FLOOR_UNRESOLVED_CEILING) {
      throw new Error(
        `${UNRESOLVED.length} desktop drawn-floor rows are unresolved, above the ceiling of ` +
          `${DESKTOP_FLOOR_UNRESOLVED_CEILING}. DESKTOP_FLOOR_UNRESOLVED_CEILING may only be RAISED ` +
          `(a merge-train act, never a worker's edit mid-lane).`
      );
    }
    expect(UNRESOLVED.length).toBeLessThanOrEqual(DESKTOP_FLOOR_UNRESOLVED_CEILING);
  });

  it(`never sits BELOW DESKTOP_FLOOR_UNRESOLVED_CEILING (${DESKTOP_FLOOR_UNRESOLVED_CEILING}) without the ceiling being lowered to match (a stale ceiling licenses stagnation)`, () => {
    if (UNRESOLVED.length < DESKTOP_FLOOR_UNRESOLVED_CEILING) {
      throw new Error(
        `${UNRESOLVED.length} desktop drawn-floor rows are unresolved, below the ceiling of ` +
          `${DESKTOP_FLOOR_UNRESOLVED_CEILING}. Lower the ceiling in the same commit by replacing the line:\n` +
          `  export const DESKTOP_FLOOR_UNRESOLVED_CEILING = ${UNRESOLVED.length};`
      );
    }
    expect(UNRESOLVED.length).toBeGreaterThanOrEqual(DESKTOP_FLOOR_UNRESOLVED_CEILING);
  });

  it('every row is accounted for exactly once across ok/offender/unresolved/excluded', () => {
    expect(GRADED.length).toBe(ALL_CONTROLS.length);
    const okCount = GRADED.filter((r) => r.status === 'ok').length;
    expect(okCount + OFFENDERS.length + UNRESOLVED.length + EXCLUDED.length).toBe(ALL_CONTROLS.length);
  });

  it('non-vacuity: synthetic positive/negative controls over the frame-content exclusion join', () => {
    // POSITIVE: a fabricated row landing on a FIXTURE_EXCLUSIONS file:line
    // grades EXCLUDED, carrying that table's own reason string, never
    // UNRESOLVED or OFFENDER.
    const fixtureEntry = FIXTURE_EXCLUSIONS[0]!;
    const fabricatedFixtureControl: DrawnControl = {
      fileName: fixtureEntry.fileName,
      line: fixtureEntry.line,
      drawnFloor: 44,
      label: 'Zzy Fabricated Fixture Row',
      frameTitle: 'Zzy Fabricated Frame',
      frameLine: fixtureEntry.line,
    };
    const gradedFixture = gradeControl(fabricatedFixtureControl);
    expect(gradedFixture.status).toBe('excluded');
    expect(gradedFixture.reason).toBe('frame-content');
    expect(gradedFixture.excludedReason).toBe(`FIXTURE: ${fixtureEntry.reason}`);

    // POSITIVE: same for a COMPOSED_EXCLUSIONS coordinate.
    const composedEntry = COMPOSED_EXCLUSIONS[0]!;
    const fabricatedComposedControl: DrawnControl = {
      fileName: composedEntry.fileName,
      line: composedEntry.line,
      drawnFloor: 46,
      label: 'Zzy Fabricated Composed Row',
      frameTitle: 'Zzy Fabricated Frame',
      frameLine: composedEntry.line,
    };
    const gradedComposed = gradeControl(fabricatedComposedControl);
    expect(gradedComposed.status).toBe('excluded');
    expect(gradedComposed.reason).toBe('frame-content');
    expect(gradedComposed.excludedReason).toBe(`COMPOSED: ${composedEntry.reason}`);

    // NEGATIVE: a fabricated row on a file:line that appears in NEITHER
    // table grades normally -- the exclusion join never swallows a row it
    // wasn't told to. WAVE 29 (DEC-808 amendment): a label matching NOTHING
    // anywhere (not the own-text/attribute/composed tiers, not the digit-
    // skeleton join, not a composed-literal/data-value/hand-verified
    // disposition) now grades OFFENDER, never parked back as
    // 'unresolved'/'no-label-match' -- exactly the split this wave's task
    // required ("the app does not draw this label at all").
    const fabricatedOutsideControl: DrawnControl = {
      fileName: fixtureEntry.fileName,
      line: 999999,
      drawnFloor: 44,
      label: 'Zzy Fabricated Outside Row',
      frameTitle: 'Zzy Fabricated Frame',
      frameLine: 999999,
    };
    const gradedOutside = gradeControl(fabricatedOutsideControl);
    expect(gradedOutside.status).not.toBe('excluded');
    expect(gradedOutside.status).toBe('offender');
    expect(gradedOutside.reason).toBe(null);
  });

  it('non-vacuity: WAVE 33 (DEC-651) States-swatch-frame population exclusion -- fabricated negative (a non-States title still contributes its rows) vs the badged extent (excluded), derived from the frame title, never a hand-written line range', () => {
    const plainFrame: FrameExtent = {
      fileName: 'Zzy Fabricated.dc.html',
      line: 10,
      title: 'Zzy Ordinary Frame',
      extentEnd: 20,
    };
    const statesFrame: FrameExtent = {
      fileName: 'Zzy Fabricated.dc.html',
      line: 30,
      title: 'States · hover, pending, drag',
      extentEnd: 40,
    };
    const otherStatesFrame: FrameExtent = {
      fileName: 'Zzy Fabricated.dc.html',
      line: 50,
      title: 'States · some other swatch',
      extentEnd: 60,
    };

    // NEGATIVE CONTROL: a synthetic frame whose title does NOT begin
    // `States · ` still contributes its rows -- the exclusion is not a
    // blanket "drop everything" escape.
    const populated = populatedFrames([
      { frame: plainFrame, isPhone: false },
      { frame: statesFrame, isPhone: false },
      { frame: otherStatesFrame, isPhone: false },
    ]);
    expect(populated).toContainEqual(plainFrame);

    // POSITIVE CONTROL: a row inside the badged extent is excluded -- any
    // frame titled `States · ...`, not merely the one real pack frame,
    // proving the derivation reads the title token and never a hand-listed
    // coordinate.
    expect(populated).not.toContainEqual(statesFrame);
    expect(populated).not.toContainEqual(otherStatesFrame);
    expect(populated.length).toBe(1);

    // The predicate itself, keyed purely on the title token.
    expect(isStatesSwatchFrameTitle('States · hover, pending, drag')).toBe(true);
    expect(isStatesSwatchFrameTitle('States · anything else')).toBe(true);
    expect(isStatesSwatchFrameTitle('Not States · at all')).toBe(false);
    expect(isStatesSwatchFrameTitle('States')).toBe(false);
  });

  it('non-vacuity: WAVE 33 (DEC-651) DEC-746 ruling-settled exclusion -- fabricated positive (the real coordinate grades excluded/ruling-settled) vs negative (an unrelated coordinate is untouched by this table)', () => {
    const rulingEntry = RULING_SETTLED_EXCLUSIONS[0]!;
    const fabricatedRulingControl: DrawnControl = {
      fileName: rulingEntry.fileName,
      line: rulingEntry.line,
      drawnFloor: 46,
      label: 'Zzy Fabricated Ruling Row',
      frameTitle: 'Zzy Fabricated Frame',
      frameLine: rulingEntry.line,
    };
    const gradedRuling = gradeControl(fabricatedRulingControl);
    expect(gradedRuling.status).toBe('excluded');
    expect(gradedRuling.reason).toBe('ruling-settled');
    expect(gradedRuling.excludedReason).toBe(`RULING ${rulingEntry.ruling}: ${rulingEntry.reason}`);

    // NEGATIVE: a coordinate this table was never told about grades
    // normally -- the ruling-settled join never swallows a row it wasn't
    // pointed at.
    const fabricatedElsewhereControl: DrawnControl = {
      fileName: rulingEntry.fileName,
      line: 888888,
      drawnFloor: 46,
      label: 'Zzy Fabricated Elsewhere Row',
      frameTitle: 'Zzy Fabricated Frame',
      frameLine: 888888,
    };
    const gradedElsewhere = gradeControl(fabricatedElsewhereControl);
    expect(gradedElsewhere.status).not.toBe('excluded');
  });

  it('non-vacuity: cross-surface-match disposition -- fabricated positive (cross-cluster + receipt) vs two negatives (same-cluster; cross-cluster with no receipt), over a fabricated cluster map, never the real corpus', () => {
    const fabricatedClusters = new Map<string, ReadonlySet<string>>([
      ['zzy-source-a.tsx', new Set(['Chautauqua Zzy.dc.html'])],
      ['zzy-source-b.tsx', new Set(['Chautauqua Other.dc.html'])],
    ]);
    const fabricatedReceiptIndex = new Map<string, { receiptPath: string }>([
      ['Chautauqua Zzy.dc.html:1', { receiptPath: 'zzy/receipt.scan.test.ts' }],
    ]);

    // POSITIVE: the drawn row's cluster ('Chautauqua Zzy.dc.html') is NOT a
    // member of the only matched source file's cluster set
    // ('Chautauqua Other.dc.html' only), and a receipt IS registered for
    // this exact row -- crosses over, carries the receipt path.
    const positive = crossSurfaceDisposition(
      'Chautauqua Zzy.dc.html',
      'Chautauqua Zzy.dc.html:1',
      new Set(['zzy-source-b.tsx']),
      fabricatedClusters,
      fabricatedReceiptIndex
    );
    expect(positive).toEqual({ crossSurface: true, receiptPath: 'zzy/receipt.scan.test.ts' });

    // NEGATIVE: a SAME-cluster match (the matched source file's cluster set
    // DOES include this row's own cluster) never crosses over, receipt or
    // not -- this is a genuine, real-control match, not a join artifact.
    const sameCluster = crossSurfaceDisposition(
      'Chautauqua Zzy.dc.html',
      'Chautauqua Zzy.dc.html:1',
      new Set(['zzy-source-a.tsx']),
      fabricatedClusters,
      fabricatedReceiptIndex
    );
    expect(sameCluster).toEqual({ crossSurface: false, receiptPath: null });

    // NEGATIVE: a cross-cluster match with NO registered receipt stays a
    // real OFFENDER -- this disposition can never be a blanket escape.
    const noReceipt = crossSurfaceDisposition(
      'Chautauqua Zzy.dc.html',
      'Chautauqua Zzy.dc.html:999',
      new Set(['zzy-source-b.tsx']),
      fabricatedClusters,
      fabricatedReceiptIndex
    );
    expect(noReceipt).toEqual({ crossSurface: false, receiptPath: null });

    // NEGATIVE: matching more than one distinct source file is not the
    // "ITS ONLY own-text match" shape this disposition targets -- stays
    // OFFENDER regardless of cluster membership or receipt registration.
    const multiSource = crossSurfaceDisposition(
      'Chautauqua Zzy.dc.html',
      'Chautauqua Zzy.dc.html:1',
      new Set(['zzy-source-a.tsx', 'zzy-source-b.tsx']),
      fabricatedClusters,
      fabricatedReceiptIndex
    );
    expect(multiSource).toEqual({ crossSurface: false, receiptPath: null });

    // POSITIVE receipt gate is LIVE against the real corpus: every
    // registered receipt file genuinely asserts the floor it claims (module
    // load already threw above if not); confirm the index carries both real
    // rows this wave discharges.
    expect([...CROSS_SURFACE_RECEIPT_INDEX.keys()].sort()).toEqual([
      'Chautauqua Contacts.dc.html:602',
      'Chautauqua Submissions.dc.html:314',
    ]);
  });

  // -- WAVE 52 (DEC-374 wave-52 amendment, task w52-f): comment-credited
  // floors -- see the derivation's own header above for the full defect
  // description. Ratchet is two-sided, mirroring every prior ledger in this
  // file. ------------------------------------------------------------------

  it("non-vacuity: comment-credited floor detection -- fabricated positive (a token named only in a comment folded into the NEXT rule's selector) vs two negatives (a genuine declaration; no credit at all)", () => {
    // POSITIVE: 'chq-zzy-comment-fixture' is named only inside a CSS
    // comment; RULE_RE folds that comment into the following rule's
    // selector text, and selectorMentionsToken matches the dot-prefixed
    // token in the prose -- crediting it the following rule's min-height.
    // Comment-stripped, no rule mentions it at all.
    const rawFixtureBlob =
      '/* see .chq-zzy-comment-fixture for context */\n.chq-zzy-comment-real { min-height: 44px; }';
    const cleanFixtureBlob = stripCssComments(rawFixtureBlob);
    expect(isCommentOnlyCredited('chq-zzy-comment-fixture', [rawFixtureBlob], [cleanFixtureBlob])).toBe(true);

    // NEGATIVE: the SAME rule's real selector token, 'chq-zzy-comment-real',
    // survives comment-stripping unchanged -- a genuine declaration, never
    // flagged.
    expect(isCommentOnlyCredited('chq-zzy-comment-real', [rawFixtureBlob], [cleanFixtureBlob])).toBe(false);

    // NEGATIVE: a token with no credit at all in either blob -- nothing to
    // suppress a gap for, so it is not a comment-credited offender either.
    expect(isCommentOnlyCredited('chq-zzy-comment-absent', [rawFixtureBlob], [cleanFixtureBlob])).toBe(false);

    // FULL-PIPELINE: findCommentCreditedOffenders over a fabricated
    // TOKEN_INDEX-shaped map reproduces the same positive/negative split,
    // locating the exact crediting rule for citation.
    const fabricatedIndex = new Map<string, { hasRule: boolean; maxMinHeight: number | null; controlShaped: boolean }>([
      ['chq-zzy-comment-fixture', { hasRule: true, maxMinHeight: 44, controlShaped: false }],
      ['chq-zzy-comment-real', { hasRule: true, maxMinHeight: 44, controlShaped: true }],
    ]);
    const found = findCommentCreditedOffenders(
      fabricatedIndex,
      ['zzy/fabricated-sheet.css.ts'],
      [rawFixtureBlob],
      [cleanFixtureBlob]
    );
    expect(found).toEqual([
      {
        token: 'chq-zzy-comment-fixture',
        creditedMinHeight: 44,
        fileName: 'zzy/fabricated-sheet.css.ts',
        cleanSelector: '.chq-zzy-comment-real',
      },
    ]);
  });

  it(`never exceeds COMMENT_CREDITED_FLOOR_CEILING (${COMMENT_CREDITED_FLOOR_CEILING}) comment-credited tokens`, () => {
    if (COMMENT_CREDITED_OFFENDERS.length > COMMENT_CREDITED_FLOOR_CEILING) {
      const rows = COMMENT_CREDITED_OFFENDERS.map(
        (o) =>
          `${o.fileName}: token "${o.token}" credited min-height:${o.creditedMinHeight}px only via a comment folded into ` +
          `the selector \`${o.cleanSelector}\``
      );
      throw new Error(
        `${COMMENT_CREDITED_OFFENDERS.length} comment-credited desktop floor tokens, above the ceiling of ` +
          `${COMMENT_CREDITED_FLOOR_CEILING}. COMMENT_CREDITED_FLOOR_CEILING may only be RAISED ` +
          `(a merge-train act, never a worker's edit mid-lane). Offenders:\n${rows.join('\n')}`
      );
    }
    expect(COMMENT_CREDITED_OFFENDERS.length).toBeLessThanOrEqual(COMMENT_CREDITED_FLOOR_CEILING);
  });

  it(`never sits BELOW COMMENT_CREDITED_FLOOR_CEILING (${COMMENT_CREDITED_FLOOR_CEILING}) without the ceiling being lowered to match (a stale ceiling licenses stagnation)`, () => {
    if (COMMENT_CREDITED_OFFENDERS.length < COMMENT_CREDITED_FLOOR_CEILING) {
      throw new Error(
        `${COMMENT_CREDITED_OFFENDERS.length} comment-credited desktop floor tokens, below the ceiling of ` +
          `${COMMENT_CREDITED_FLOOR_CEILING}. Lower the ceiling in the same commit by replacing the line:\n` +
          `  export const COMMENT_CREDITED_FLOOR_CEILING = ${COMMENT_CREDITED_OFFENDERS.length};`
      );
    }
    expect(COMMENT_CREDITED_OFFENDERS.length).toBeGreaterThanOrEqual(COMMENT_CREDITED_FLOOR_CEILING);
  });
});

// ---------------------------------------------------------------------------
// NON-VACUITY (DEC-967 wave-41): a fabricated drawn-control-shaped string on
// either side of a tmpdir copy's own </x-dc>, run through
// drawnControlsInFile exactly as ALL_CONTROLS above is built.
// ---------------------------------------------------------------------------

describe('non-vacuity: a drawn control past the tmpdir copy own </x-dc> is not swept into the last frame extent', () => {
  let dir: string;
  const FIXTURE_NAME = 'Fixture Control Floor.dc.html';

  beforeAll(() => {
    dir = mkdtempSync(join(tmpdir(), 'desktop-control-floor-close-fixture-'));
    const lines = [
      '<x-dc>',
      `  <span style="font-family:'Familjen Grotesk', sans-serif; font-size:19px; font-weight:600">Fixture · last frame</span>`,
      '  <a style="min-height:44px; border-radius:8px; border:1px solid #000">Before close</a>',
      '</x-dc>',
      '<script type="text/x-dc" data-dc-script">',
      '  <a style="min-height:44px; border-radius:8px; border:1px solid #000">After close</a>',
      '</script>',
    ];
    writeFileSync(join(dir, FIXTURE_NAME), lines.join('\n') + '\n', 'utf8');
  });

  afterAll(() => rmSync(dir, { recursive: true, force: true }));

  it('the control drawn before </x-dc> is captured; the identically-shaped one after it is not', () => {
    const controls = drawnControlsInFile(FIXTURE_NAME, dir);
    const labels = controls.map((c) => c.label);
    expect(labels).toContain('Before close');
    expect(labels).not.toContain('After close');
  });
});

