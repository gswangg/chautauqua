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
//      Inside each extent, a DRAWN CONTROL is any element whose attribute
//      string carries `min-height:NNpx` AND `border-radius` AND
//      (`border:` OR `background:`), plus any `<a ...min-height:NNpx...>`
//      (the anchor case needs only the min-height, per the task's own
//      grammar -- an anchor is a control shape DESIGN-RULINGS/DEC-393
//      already treat specially, never requiring a painted face). Recorded
//      as (fileName, line, drawnFloor, label). MEASURED: 266 drawn
//      controls across 12 of the 13 files (docs/design/Chautauqua
//      Docs.dc.html draws none of this shape).
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
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { enumerateSourceFiles, normalizeSource } from './frame-source-corpus';
import { COMPOSED_EXCLUSIONS, FIXTURE_EXCLUSIONS } from './desktop-control-label.scan.test';

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
 * contains a phone (width:390px+height:844) line -- identical derivation
 * to test/desktop-frame-ledger.scan.test.ts's own allFramesInFile. */
function allFramesInFile(fileName: string): { frame: FrameExtent; isPhone: boolean }[] {
  const full = join(DESIGN_ROOT, fileName);
  const lines = readFileSync(full, 'utf-8').split('\n');
  const labels = labelsInFile(fileName);
  return labels.map((label, i) => {
    const nextLabel = labels[i + 1];
    const extentEnd = nextLabel ? nextLabel.line : Infinity;
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

function drawnControlsInFile(fileName: string): DrawnControl[] {
  const full = join(DESIGN_ROOT, fileName);
  const content = readFileSync(full, 'utf-8');
  const lines = content.split('\n');
  const lineStartIndex: number[] = [0];
  for (let i = 0; i < lines.length; i++) {
    lineStartIndex.push(lineStartIndex[i]! + lines[i]!.length + 1);
  }

  const frames = allFramesInFile(fileName)
    .filter((e) => !e.isPhone)
    .map((e) => e.frame);
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

const ALL_CONTROLS: DrawnControl[] = designFiles().flatMap(drawnControlsInFile);

// -- Match side: normalized non-test app/src/** + src/** corpus ------------
// (frame-source-corpus's shared stripper/decoder -- DEC-967's one-stripper
// rule -- imported, never re-implemented.)

const SOURCE_FILES = [...enumerateSourceFiles(APP_SRC_ROOT), ...enumerateSourceFiles(SRC_ROOT)];
const NORMALIZED_BLOBS: string[] = SOURCE_FILES.map((f) => normalizeSource(readFileSync(f, 'utf-8')));

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
for (const blob of TOPLEVEL_BLOBS) {
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
for (const blob of TOPLEVEL_BLOBS) {
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

// -- Join + grade every drawn control ---------------------------------------

export type RowStatus = 'ok' | 'offender' | 'unresolved' | 'excluded';

export interface GradedRow {
  control: DrawnControl;
  status: RowStatus;
  reason: 'no-label-match' | 'no-token' | 'no-rule' | 'no-control-shape' | 'frame-content' | null;
  tokens: string[];
  declaredMinHeight: number | null;
  /** Set only when status === 'excluded': the source table's own reason
   * string, carried through verbatim (never re-worded). */
  excludedReason: string | null;
  /** WAVE 28: which tier resolved this row's tokens, for the ledger's own
   * "newly-resolved" naming -- not part of the grading grammar itself. */
  matchTier: 'own-text' | 'attribute' | null;
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
function gradeControl(control: DrawnControl): GradedRow {
  const frameContentReason = frameContentExclusionFor(control);
  if (frameContentReason !== null) {
    return {
      control,
      status: 'excluded',
      reason: 'frame-content',
      tokens: [],
      declaredMinHeight: null,
      excludedReason: frameContentReason,
      matchTier: null,
    };
  }

  let tokens: string[] = [];
  let ownTextMatched = false;
  for (const blob of NORMALIZED_BLOBS) {
    for (const idx of allBoundaryMatches(control.label, blob)) {
      if (!ownTextEquals(control.label, blob, idx)) continue;
      ownTextMatched = true;
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

  const matchTier: GradedRow['matchTier'] = ownTextMatched ? 'own-text' : attrMatched ? 'attribute' : null;

  if (!ownTextMatched && !attrMatched) {
    return { control, status: 'unresolved', reason: 'no-label-match', tokens, declaredMinHeight: null, excludedReason: null, matchTier };
  }
  if (tokens.length === 0) {
    return { control, status: 'unresolved', reason: 'no-token', tokens, declaredMinHeight: null, excludedReason: null, matchTier };
  }

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
    return { control, status: 'unresolved', reason: 'no-rule', tokens, declaredMinHeight: null, excludedReason: null, matchTier };
  }
  if (!anyControlShaped) {
    return { control, status: 'unresolved', reason: 'no-control-shape', tokens, declaredMinHeight: null, excludedReason: null, matchTier };
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
    return { control, status: 'unresolved', reason: 'no-control-shape', tokens, declaredMinHeight: declared, excludedReason: null, matchTier };
  }
  return { control, status, reason: null, tokens, declaredMinHeight: declared, excludedReason: null, matchTier };
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
export const DESKTOP_FLOOR_DIVERGENCE_CEILING = 2;
export const DESKTOP_FLOOR_UNRESOLVED_CEILING = 138;

describe('desktop drawn-floor ledger (DEC-393 wave-151 amendment, v12 mobile campaign)', () => {
  it('non-vacuity: enumerates exactly 108 desktop frames across 13 files (same population test/desktop-frame-ledger.scan.test.ts measures pre-exclusion)', () => {
    const files = designFiles();
    expect(files.length).toBe(13);
    expect(DESKTOP_FRAMES.length).toBe(108);
  });

  it('non-vacuity: extracts exactly 266 drawn controls, with the exact per-file breakdown', () => {
    const perFile: Record<string, number> = {};
    for (const c of ALL_CONTROLS) perFile[c.fileName] = (perFile[c.fileName] ?? 0) + 1;
    expect(perFile).toEqual({
      'Chautauqua Account.dc.html': 17,
      'Chautauqua Agenda.dc.html': 5,
      'Chautauqua Comms.dc.html': 9,
      'Chautauqua Contacts.dc.html': 28,
      'Chautauqua Content.dc.html': 4,
      'Chautauqua Home.dc.html': 5,
      'Chautauqua Overview.dc.html': 28,
      'Chautauqua Public and Portal.dc.html': 41,
      'Chautauqua Review.dc.html': 15,
      'Chautauqua Settings.dc.html': 67,
      'Chautauqua Speakers.dc.html': 20,
      'Chautauqua Submissions.dc.html': 27,
    });
    expect(ALL_CONTROLS.length).toBe(266);
    // Chautauqua Docs.dc.html draws none of this shape -- confirmed absent
    // rather than silently missing from the breakdown above.
    expect(perFile['Chautauqua Docs.dc.html']).toBeUndefined();
  });

  it('non-vacuity: the drawn-floor histogram is large and spans more than the ruled 44px minimum', () => {
    const histogram: Record<number, number> = {};
    for (const c of ALL_CONTROLS) histogram[c.drawnFloor] = (histogram[c.drawnFloor] ?? 0) + 1;
    expect(histogram[46]).toBeGreaterThan(histogram[44] ?? 0);
    expect(Object.values(histogram).reduce((a, b) => a + b, 0)).toBe(266);
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
    // table grades normally (here, unresolved/no-label-match, since the
    // fabricated label matches no real source) -- the exclusion join never
    // swallows a row it wasn't told to.
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
    expect(gradedOutside.status).toBe('unresolved');
    expect(gradedOutside.reason).toBe('no-label-match');
  });
});
