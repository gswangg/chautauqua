// DEC-967 (wave 100 amendment, extended wave 31): docs/design/DEVIATIONS.md
// is the third authority the v12 mobile-campaign goal names (frames,
// DESIGN-RULINGS.md, DEVIATIONS.md). Every entry in it asserts something
// about the tree -- "the app keeps the recorded A20 ruling", "the Sort
// <select>'s phone display:none was DELETED", ".chq-submissions-columnpicker's
// phone display:none STANDS", "NO STATUS CODE CHANGED" -- and fidelity
// audits are told to cite this file INSTEAD of re-flagging, so a stale
// entry silently suppresses a real finding. Modeled BYTE-FOR-BYTE on
// test/clarifications-ledger.scan.test.ts and
// test/design-rulings-ledger.scan.test.ts's derived-population +
// transcribed-ledger + two-directional-assertion idiom -- same shape, same
// falsifiability controls, no invention.
//
// DEC-967 wave-31 amendment: the original wave-100 build graded only FOUR of
// the file's NINE "## " headings (a hand-listed `INCLUDED_HEADINGS` literal
// array, with a matching hand-listed `EXCLUDED_HEADINGS`). That hard-codes
// the population DEC-180 forbids. This wave replaces both arrays with
// `LEDGER_SECTIONS`, derived at test time from every `^## ` heading the file
// actually contains -- so a heading added or removed from
// docs/design/DEVIATIONS.md changes this test's population automatically,
// never by hand-editing a list here.
//
// The two headings the wave-100 build's header comment gave reasons to
// skip were BOTH stale by wave 31, and this file no longer repeats either
// reason because neither reason is true any more:
//   - "## v12 frame errata" was cited as "an in-flight branch (v12m-w14-b)
//     is actively deleting it". That branch landed; the heading is GONE
//     from docs/design/DEVIATIONS.md (confirmed: `grep -c '^## ' ...` finds
//     nine headings, none of them errata). A derivation from real headings
//     can never re-invent a deleted one, so no special-case is needed to
//     keep skipping it.
//   - "## 5. Pending adjudication" was cited as "stale prose, its one entry
//     is answered by ## 6's Adjudications". The section's OWN TEXT has
//     since been rewritten to say exactly that in the document itself: "No
//     adjudication is currently open. ... was verdicted by the G13 srv1
//     adjudication and is recorded, resolved, in §6's 'Adjudications
//     recorded'." A section whose only content is a statement that nothing
//     is open still asserts something about the tree -- so it is now
//     GRADED, not skipped, as a single divider-style row (see "Divider
//     rows" below) rather than a bulleted one, because it draws zero
//     top-level bullets of its own.
//
// Population: every top-level bullet entry under EVERY "## " heading in
// docs/design/DEVIATIONS.md, re-derived at test time, never hand-listed. A
// "top-level" bullet is a line starting with "- " at column 0 (no leading
// whitespace) -- this naturally excludes nested sub-bullets (e.g. under the
// "Submissions 390 phone head" entry, section 3), which are indented and so
// never match the top-level pattern; their text is still folded into their
// parent bullet's joined text (harmless -- it only ever appears after the
// parent's own lead-in has already been extracted).
//
// Divider rows: a heading that draws ZERO top-level bullets (only "## 5.
// Pending adjudication" currently qualifies -- confirmed by running the
// same bullet-deriving function against all nine headings) still asserts
// something about the tree via its own prose, so it still contributes
// exactly ONE derived population entry, keyed off the HEADING TITLE itself
// rather than off any bullet lead-in. This is the identical reasoning
// test/design-rulings-ledger.scan.test.ts already applies to its own
// section-divider headings ("## A. Extensions", "## B. Uncovered
// surfaces") -- a divider or an empty-by-design section names no single
// artifact of its own, so it is recorded "gap", never force-fit to a
// borrowed citation from a sibling section. "## 4. Voice" is the second
// case that reaches "gap", but for a different structural reason: it DOES
// draw one top-level bullet (so it IS bullet-derived, normally), but that
// bullet's claim -- "docs prose follows the STE-derived house rules" -- is
// a broad style/voice policy governing all docs prose, not a fact any
// single file discharges; the bullet mentions one real supporting file
// (the technical-names glossary), but citing that file as though it proved
// the WHOLE policy would be exactly the force-fit this scan's own "gap"
// verdict exists to avoid. Both are flagged here as the narrowest
// reasonable reading of "genuinely artifact-free prose" per the task's own
// instruction to name a design gap rather than force a citation.
//
// Lead-in extraction, in priority order, applied to a bullet's full joined
// text (its first line plus every continuation line up to the next
// top-level bullet, heading, or bold paragraph-header line) -- unchanged
// from the wave-100 build and verified by reading (not assumed) to also
// cover sections 4a, 7 and 8's bullet shapes, all of which open on a bold
// span like sections 1/2/3:
//   1. If the joined text opens with a bold span ("**...**"), the lead-in
//      is that span's contents (the bold span may itself span multiple
//      source lines, e.g. the Speakers write-failed entry, which is why
//      extraction runs on the JOINED text, not the bullet's first line
//      alone).
//   2. Otherwise (every bullet under "## 6", none of which opens on a bold
//      span -- confirmed by grep), the lead-in is the text before the
//      first " — " (em dash) or ": " (colon-space), whichever occurs
//      first.
//   3. Otherwise (no delimiter found), the lead-in is the whole joined text
//      with a trailing "." stripped.
//
// Ledger verdicts:
//   - "honored": the tree keeps the claim. Two sub-kinds, both under the
//     "honored" status (the task specifies three verdicts, not four, and a
//     "ruled omission" IS a kept claim -- compliance is the artifact's
//     absence, not its presence):
//       - present: a cited file exists, contains the cited literal
//         verbatim, and a cited test file exists.
//       - absent: a cited term must not appear anywhere under src/** or
//         app/src/** (a deliberately-not-built control, DEC-941-style).
//   - "superseded": a LATER section of docs/design/DEVIATIONS.md itself
//     records the adjudication -- the cited literal must appear verbatim in
//     DEVIATIONS.md's own bytes, at or after the citing entry's own
//     section. (One real case: section 1's Speakers write-failed pill
//     entry is superseded by section 6's "Speakers status vocabulary under
//     write-failure (DEC-730, wave-90 amendment)" adjudication -- the same
//     finding, recorded twice, the second time as the resolved word.)
//   - "gap": recorded openly, never faked with a citation that doesn't
//     resolve. Section 6's "Unbuilt features" and "Reworks larger than the
//     freeze window" bullets are legitimately "gap" -- the document's own
//     words say these are deferred, not built, not disguised as done. The
//     wave-31 divider rows ("## 5" itself, and "## 4"'s one bullet) are
//     "gap" for the reason given above.
//
// Both directions are asserted: every derived bullet has exactly one ledger
// row, and every ledger row names a live derived key -- so neither a new
// DEVIATIONS.md entry nor a removed one drifts silently. On failure the
// test prints the exact problem list, never just a count.

import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { DEC_967 } from "../src/decisions";

// DEC-967 is a compile-checked dependency of this file's population and
// verdict logic (see the header above): referencing the constant here
// means a rename/removal of DEC-967's decisions-data entry breaks this
// file's build, not just its runtime.
void DEC_967;

const ROOT = resolve(__dirname, "..");
const DEVIATIONS_PATH = join(ROOT, "docs", "design", "DEVIATIONS.md");
const DEVIATIONS_TEXT = readFileSync(DEVIATIONS_PATH, "utf8");

// ---------------------------------------------------------------------------
// Population -- derived at test time from docs/design/DEVIATIONS.md, never
// hardcoded.
// ---------------------------------------------------------------------------
interface DerivedBullet {
  key: string;
  leadIn: string;
  heading: string;
}

/** DEC-967 wave-31 amendment: every `## ` heading the file actually
 * contains, in document order -- never a hand-listed array. Replaces the
 * wave-100 build's `INCLUDED_HEADINGS`/`EXCLUDED_HEADINGS` literal arrays. */
const LEDGER_SECTIONS: string[] = DEVIATIONS_TEXT.split("\n")
  .filter((l) => l.startsWith("## "))
  .map((l) => l.trim());

/** Slugifies a lead-in phrase into a stable, deterministic key: lowercase,
 * curly/straight quotes and backticks stripped, every run of
 * non-alphanumeric characters collapsed to one hyphen, no leading/trailing
 * hyphen. Pure function of the lead-in text -- never hand-assigned. Matches
 * test/clarifications-ledger.scan.test.ts's slugify() exactly. */
function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/["“”'’`]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Extracts the lines belonging to a `## <heading>` section, stopping at the
 * next `## ` heading or end of file. Throws if the heading is absent, so a
 * broken match can never silently zero a section out. */
function extractSection(markdown: string, heading: string): string {
  const lines = markdown.split("\n");
  const startIdx = lines.findIndex((l) => l.trim() === heading);
  if (startIdx === -1) {
    throw new Error(`docs/design/DEVIATIONS.md has no "${heading}" section`);
  }
  const rest = lines.slice(startIdx + 1);
  const endIdx = rest.findIndex((l) => l.startsWith("## "));
  return (endIdx === -1 ? rest : rest.slice(0, endIdx)).join("\n");
}

const BOLD_OPEN_RE = /^\*\*(.+?)\*\*/;

/** Given a bullet's full joined text, extracts its lead-in per the
 * three-step priority order documented in the file header. */
function extractLeadIn(fullText: string): string {
  const boldMatch = BOLD_OPEN_RE.exec(fullText);
  if (boldMatch) return boldMatch[1]!.trim();

  const emDashIdx = fullText.indexOf(" — ");
  const colonIdx = fullText.indexOf(": ");
  const candidates = [emDashIdx, colonIdx].filter((i) => i !== -1);
  if (candidates.length > 0) {
    const cut = Math.min(...candidates);
    return fullText.slice(0, cut).trim();
  }

  return fullText.replace(/\.$/, "").trim();
}

/** Derives every top-level bullet ("- " at column 0) within one section's
 * text, joining each bullet's continuation lines (indented text, including
 * any nested sub-bullets) until the next top-level bullet, heading, or bold
 * paragraph-header line. */
function deriveSectionBullets(sectionText: string, heading: string): DerivedBullet[] {
  const lines = sectionText.split("\n");
  const out: DerivedBullet[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i]!;
    if (/^- /.test(line)) {
      const parts: string[] = [line.slice(2)];
      let j = i + 1;
      while (j < lines.length && !/^- /.test(lines[j]!) && !/^#/.test(lines[j]!) && !/^\*\*/.test(lines[j]!)) {
        const trimmed = lines[j]!.trim();
        if (trimmed.length > 0) parts.push(trimmed);
        j++;
      }
      const full = parts.join(" ").trim();
      const leadIn = extractLeadIn(full);
      out.push({ key: slugify(leadIn), leadIn, heading });
      i = j;
    } else {
      i++;
    }
  }
  return out;
}

/** Strips the "## " marker off a heading line, leaving the bare title
 * ("5. Pending adjudication (not yet blessed — sweep should verdict)"). */
function headingTitle(heading: string): string {
  return heading.replace(/^## /, "");
}

function deriveBullets(): DerivedBullet[] {
  const out: DerivedBullet[] = [];
  for (const heading of LEDGER_SECTIONS) {
    const bullets = deriveSectionBullets(extractSection(DEVIATIONS_TEXT, heading), heading);
    if (bullets.length > 0) {
      out.push(...bullets);
    } else {
      // A heading with zero top-level bullets of its own is a divider row
      // (see file header "Divider rows"): one derived entry keyed off the
      // heading's own title, not off any bullet.
      const title = headingTitle(heading);
      out.push({ key: slugify(title), leadIn: title, heading });
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Ledger -- transcribed by hand once, then checked against the derived
// population and the tree on every run.
// ---------------------------------------------------------------------------
interface PresentCite {
  kind: "present";
  file: string;
  literal: string;
  testFile: string;
}
interface AbsentCite {
  kind: "absent";
  /** Case-insensitive substring that must not appear anywhere under
   * src/** or app/src/**. */
  term: string;
}
interface SupersededCite {
  /** The literal, verbatim substring from the LATER section of
   * DEVIATIONS.md that records the adjudication. */
  literal: string;
}

/** A single row's citation. Reused, never re-invented (DEC-613): a row
 * whose claim has two halves -- something asserted BUILT and something
 * else asserted explicitly NOT built (the shape DEC-967 wave-145 flags,
 * where a "present" citation of unrelated code let a blessed non-build
 * claim silently go stale once the "not built" half got built) -- carries
 * an array of Cite so both halves resolve against the tree, instead of a
 * single citation standing in for a claim it only half-covers. */
type Cite = PresentCite | AbsentCite;

interface LedgerEntry {
  key: string;
  status: "honored" | "superseded" | "gap";
  reason: string;
  honored?: Cite | Cite[];
  superseded?: SupersededCite;
}

const LEDGER: LedgerEntry[] = [
  // ---- ## 1. Ruled omissions -------------------------------------------
  {
    key: "archive-this-event-frame-09-11-destructive-footer",
    status: "honored",
    reason: 'USER RULING 2026-08-16: deferred until a real customer requests it -- "Archive this event" must not appear anywhere in implementation or docs.',
    honored: { kind: "absent", term: "archive this event" },
  },
  {
    key: "settings-keeping-and-deleting-retention-block-docs-design-chautauqua-settings-dc-html-1161-1180",
    status: "honored",
    reason:
      "DEC-032 (task w17-g): the frame's retention select and two checkboxes are a deliberate non-build -- no retention column, no endpoint and no deletion job backs any of the three controls, so building them would declare a setting nothing reads. The panel that would have carried them records the same non-build in its own header comment.",
    honored: {
      kind: "present",
      file: "app/src/pages/settings/ExportsPanel.tsx",
      literal: "deliberate non-build on DEC-032.",
      testFile: "app/src/pages/settings/ExportsPanel.render.test.tsx",
    },
  },
  {
    key: "docs-design-chautauqua-speakers-dc-html-549-speakers-a-write-failed",
    status: "superseded",
    reason:
      "the same finding (a hand-styled, pre-inversion status pill under a write-failure banner) is recorded a second time, resolved, in section 6's Adjudications: 'Speakers status vocabulary under write-failure (DEC-730, wave-90 amendment)' -- the inverted vocabulary is ruled to apply in every state, no code change needed.",
    superseded: { literal: "Speakers status vocabulary under write-failure (DEC-730, wave-90" },
  },
  // ---- ## 2. State-layer additions --------------------------------------
  {
    key: "shared-chq-table-first-last-cell-16px-insets",
    status: "honored",
    reason: "the shared .chq-table first/last-cell inset is a real, shared CSS rule, not a per-page one-off.",
    honored: { kind: "present", file: "app/src/styles.css", literal: ".chq-table th:first-child,", testFile: "test/table-class-conformance.test.ts" },
  },
  {
    key: "review-plan-row-16px-right-inset",
    status: "honored",
    reason: "the review plan-row carries its own dedicated class, styled to mirror the shared inset.",
    honored: { kind: "present", file: "app/src/pages/review/review.css", literal: ".chq-review-plan-row {", testFile: "app/src/pages/review/PlanList.render.test.tsx" },
  },
  {
    key: "bulk-action-bars-are-always-mounted",
    status: "honored",
    reason: "the always-mounted idle bulk bar with its muted hint line is a shared, shell-level construct, reused (never re-declared) across surfaces.",
    honored: { kind: "present", file: "app/src/styles.css", literal: ".chq-bulkbar-hint {", testFile: "app/src/pages/submissions/BulkActionBar.render.test.tsx" },
  },
  {
    key: "tracks-rooms-edit-rows-use-a-fixed-200px-actions-track",
    status: "honored",
    reason: "the dirty-only Save/Cancel pair renders in place without shifting the row, per-row.",
    honored: { kind: "present", file: "app/src/pages/settings/tracksRooms/TrackEditRow.tsx", literal: "onSave(track)", testFile: "app/src/pages/settings/TracksRoomsPanel-edit-save.render.test.tsx" },
  },
  {
    key: "speakers-grid-task-cells-top-align-on-one-shared-pill-line",
    status: "honored",
    reason: "task cells share one fixed top-align offset so a two-line cell never floats its pill off its siblings' line.",
    honored: { kind: "present", file: "app/src/pages/speakers/speakers.css", literal: "Top-align every task cell with ONE fixed offset", testFile: "app/src/pages/speakers/OnboardingGrid-refusal-shapes.render.test.tsx" },
  },
  {
    key: "disabled-tertiary-link-shaped-controls-keep-no-surface-and-no-hover",
    status: "honored",
    reason: "a disabled tertiary/link-style control keeps no box and no hover response, distinct from B8's filled-tier disabled register.",
    honored: { kind: "present", file: "app/src/styles.css", literal: ".chq-btn-tertiary:disabled,", testFile: "test/button-vocabulary.test.ts" },
  },
  // ---- ## 3. Interpretations where the frames underspecify -------------
  {
    key: "track-colour-picking-is-a-cycle-control",
    status: "honored",
    reason: "the swatch beside the track name is a cycle control (click cycles the five system-token colours in place), not a separate picker.",
    honored: { kind: "present", file: "app/src/pages/settings/tracksRooms/TrackEditRow.tsx", literal: "Track colour for", testFile: "app/src/pages/settings/TracksRoomsPanel.render.test.tsx" },
  },
  {
    key: "agenda-phone-head-band-line-height-1-dec-991-wave-156-verdict",
    status: "honored",
    reason:
      "DEC-991 wave-156 verdict: the wave-27 ban on display-face line-height<=1 governs; the exemption mechanism src/decisions-data/DEC-991.md proposed is retired unbuilt. agenda.css's phone wordmark/h1 rules correctly omit line-height (satisfying the ban) while the frame's own line-height:1 is read as head-band geometry, already met by the band's drawn padding/gap.",
    honored: { kind: "present", file: "src/decisions-data/DEC-991.md", literal: "the BAN governs", testFile: "test/display-heading-line-height.scan.test.ts" },
  },
  {
    key: "contact-drawer-footer",
    status: "honored",
    reason: "the contact drawer keeps the recorded A20 ruling's footer order and its save-scope sentence above the bar.",
    honored: { kind: "present", file: "app/src/pages/contacts/ContactDrawer.tsx", literal: "email: 'Email',", testFile: "app/src/pages/contacts/ContactDrawer.render.test.tsx" },
  },
  {
    key: "wordmark-vertical-position",
    status: "honored",
    reason: "the wordmark's optical nudge is applied and pinned by its own scan test.",
    honored: { kind: "present", file: "app/src/styles.css", literal: ".chq-wordmark {", testFile: "test/wordmark-optical-nudge.scan.test.ts" },
  },
  {
    key: "submissions-390-phone-head-dec-919-amendment-wave-7-task-w7-e",
    status: "honored",
    reason: "the phone head re-lines into a titles row above a full-width actions row (Forms / Export CSV share the row, New submission keeps its own width), per DEC-919 ('re-line, never remove').",
    honored: { kind: "present", file: "app/src/pages/submissions/submissions.css", literal: ".chq-submissions-head-actions {", testFile: "app/src/pages/submissions/submissions-landing-phone-frame.test.ts" },
  },
  {
    key: "plan-editor-phone-dock-copy-is-the-new-plan-captioning-not-a-third-button-pair",
    status: "honored",
    reason: "the phone dock is a CSS-only repositioning of whichever button pair the title row already renders -- never a second copy of the buttons.",
    honored: { kind: "present", file: "app/src/pages/review/review.css", literal: ".chq-review-editor-title-actions {", testFile: "app/src/pages/review/review-admin-phone-frames.test.ts" },
  },
  {
    key: "sign-in-390-keeps-forgot-your-password-re-lined-dec-919-wave-114-amendment",
    status: "honored",
    reason:
      "DEC-919 wave-114 amendment: a frame is the GEOMETRY authority, not a capability manifest -- the 390 sign-in cut drawing the primary alone does not license deleting the only password-reset entry point on phones. The link stays, re-lined: .chq-auth-submitrow goes column-reverse at phone width so the full-width primary sits first and the tertiary is centred beneath it.",
    honored: { kind: "present", file: "src/routes/auth.css.ts", literal: "flex-direction: column-reverse;", testFile: "test/account-docs-phone-frames.test.ts" },
  },
  {
    key: "contact-drawers-phone-edit-stack-is-not-the-frames-read-dock-dec-959-dec-380-wave-120-struck",
    status: "honored",
    reason:
      "DEC-959/DEC-380 wave-120: the frame draws only the 390 READ footer (Email / Edit), so the phone EDIT state's five-control bar is our interpretation, not a frame deviation. It takes the frame footer's own floor (min-height:48px, padding:0 16px), one control per line, and its capability is reached through the dock's own Edit control -- the drawer flips between the two trees on `readMode`, never renders both.",
    honored: { kind: "present", file: "app/src/pages/contacts/ContactDrawer.tsx", literal: "const readMode = isPhone && !phoneEditing;", testFile: "app/src/pages/contacts/ContactDrawer.phoneRead.render.test.tsx" },
  },
  {
    key: "agenda-390-phone-dock-stays-exactly-the-two-frame-controls-publish-schedule-and-breaks-live-in-the-heads-action-row-dec-380-wave-116-amendment",
    status: "honored",
    reason:
      "DEC-380 wave-116 amendment, closing the mandate's open design question: the frame's 390 dock draws exactly Unscheduled + Auto-schedule, unchanged. Publish schedule and Breaks stay in the head's own full-width action row -- a frame is the geometry authority, not a capability manifest, and neither control has any other home on the phone surface. Both reach the 44px floor: the shared .chq-btn rule floors Publish schedule, and a dedicated .chq-link-button rule (appended, not edited in place) floors Breaks.",
    honored: { kind: "present", file: "app/src/pages/agenda/agenda.css", literal: ".chq-agenda-head-actions .chq-link-button {", testFile: "app/src/pages/agenda/PhoneAgenda.dock-membership.render.test.tsx" },
  },
  {
    key: "co-presenter-add-row-keeps-its-no-email-truth-over-the-frames-caption-dec-909-wave-134-task-w9-dd-corrected-and-confirmed-by-dec-380-wave-139",
    status: "honored",
    reason:
      "DEC-909 wave-134, corrected and confirmed by DEC-380 wave-139: the frame's caption claims a new co-presenter 'is emailed a portal link', but the submissions routes never import a mailer (DEC-604 wave-70), so adding a participant cannot send anything. The landed caption states the truth and the portal invite stays a separate explicit act. DEC-380's own wave-137 amendment briefly ruled the frame's caption a build without weighing this pin or the mailer-import scan; wave-139 corrects that on the merits.",
    honored: {
      kind: "present",
      file: "app/src/pages/submissions/SubmissionDetailPage.tsx",
      literal: "Adding a co-presenter here sends no email",
      testFile: "app/src/pages/submissions/SubmissionDetailPage.render.test.tsx",
    },
  },
  {
    key: "reminder-skip-window-wording-stays-reminded-not-emailed-dec-909-wave-134-task-w9-dd",
    status: "honored",
    reason:
      "DEC-909 wave-134: the frame draws 'skips anyone emailed in the last hour', but the dedupe gate is task_assignment.last_reminded_at, not any generic email send. The shared vocabulary module owns the one true phrase for all its consumers, so the app's 'reminded' stands over the frame's 'emailed'.",
    honored: {
      kind: "present",
      file: "app/src/pages/speakers/remindSkipVocabulary.ts",
      literal: "skips anyone reminded in the last hour",
      testFile: "app/src/pages/speakers/remind-skip-vocabulary.scan.test.ts",
    },
  },
  {
    key: "agenda-390-phone-head-band-omits-the-frames-line-height-1-on-the-wordmark-and-the-h1-the-declaration-is-band-geometry-not-a-glyph-metric-dec-991-wave-156-supersession",
    status: "honored",
    reason:
      "DEC-991 wave-156 supersession: the display-face line-height<=1 ban governs, and the frame's line-height:1 on the phone wordmark/h1 declares head-band tightness, not a glyph metric the app must reproduce literally. agenda.css's .chq-phone-agenda-wordmark and .chq-phone-agenda-h1 both omit line-height, and each rule carries its own comment recording the omission under this ruling.",
    honored: {
      kind: "present",
      file: "app/src/pages/agenda/agenda.css",
      literal: "DEC-991 wave-27 amendment bans line-height:1 on the display face",
      testFile: "app/src/pages/agenda/agenda-phone-frame.test.ts",
    },
  },
  {
    key: "settings-embed-edit-head-omits-the-frames-line-height-1-on-the-h1-dec-996",
    status: "honored",
    reason:
      "DEC-996: commit bee981791 copied docs/design/Chautauqua Settings.dc.html:1047's line-height:1 verbatim onto .chq-settings-embed-edit-head h1, tripping the same display-face line-height<=1 ban the Agenda entry above resolves. The declaration is deleted outright (never substituted, never scan-exempted); the rule keeps normal (the font's own line box) to contain the glyphs, same disposition as the Agenda wordmark/h1 pair.",
    honored: {
      kind: "present",
      file: "app/src/pages/settings/settings.css",
      literal: "DEC-991 wave-27 amendment bans line-height:1 on the display face",
      testFile: "test/display-heading-line-height.scan.test.ts",
    },
  },
  {
    key: "plan-editors-v4-title-row-shell-is-blessed-not-the-unrecorded-divergence-the-audit-flagged-and-the-reviewers-who-reviews-what-section-heading-rename-ships-as-part-of-the-same-shell-dec-745-wave-20-amendment",
    status: "honored",
    reason:
      "DEC-745 wave-20 amendment: the plan editor's v4 title-row shell (already recorded under \"## 7. Settled frame divergences\") is BLESSED rather than an unrecorded divergence, and the same ruling covers the roster section heading's rename from the frame's 'Reviewers' to 'Who reviews what' (DEC-745 wave-98 amendment's own text).",
    honored: {
      kind: "present",
      file: "app/src/pages/review/PlanEditor.tsx",
      literal: '<h2 className="chq-section-label">Who reviews what</h2>',
      testFile: "app/src/pages/review/PlanEditor.render.test.tsx",
    },
  },
  // ---- ## 4. Voice (DEC-967 wave-31 amendment) --------------------------
  {
    key: "docs-prose-follows-the-ste-derived-house-rules-not-the-designs-house-voice-note",
    status: "gap",
    reason:
      "a broad style/voice policy governing ALL docs prose (full ASD-STE100 applied 2026-08-16, then deliberately relaxed to writing-rules-plus-natural-rhythm), not a fact any single file discharges. The bullet names one real supporting artifact -- the declared technical-names glossary at src/routes/docs-content/technical-names.ts -- but that file only carries the domain-terms half of the policy (the should/might ambiguity and metaphor bans have no single artifact at all); citing it as though it proved the whole voice policy would be exactly the force-fit this scan's 'gap' verdict exists to avoid. Recorded gap under the same divider reasoning test/design-rulings-ledger.scan.test.ts already applies to its 'governing-principle-applied' row -- a cross-surface prose axiom, not a single-artifact claim.",
  },
  // ---- ## 4a. Docs screenshots: tall frames, prepared states, and focus -
  {
    key: "capture-is-fullpage-by-default-still-at-1600-wide",
    status: "honored",
    reason: "capture defaults to fullPage (grows the viewport to fit the real screen height) unless a row explicitly opts into the fixed 1600x900 frame capture for position:fixed overlays.",
    honored: { kind: "present", file: "scripts/docs-shots.ts", literal: 'const fullPage = (entry.capture ?? "fullPage") === "fullPage";', testFile: "test/docs-shots-manifest.test.ts" },
  },
  {
    key: "a-row-may-declare-prep-steps",
    status: "honored",
    reason: "DocsShotEntry carries an optional prep array of declarative click/fill/select/waitFor steps, run against the real app before the shutter fires.",
    honored: { kind: "present", file: "scripts/docs-shots-lib.ts", literal: "readonly prep?: readonly DocsShotStep[];", testFile: "test/docs-shots-manifest.test.ts" },
  },
  {
    key: "clip-selector-padding",
    status: "honored",
    reason: "a row may declare clip:{selector,padding} to become a vertical band around one element at the full 1600px width, generous context required (never a tight crop) -- a real row uses it for the agenda break-band figure.",
    honored: {
      kind: "present",
      file: "scripts/docs-shots-lib.ts",
      literal: 'clip: { selector: \'.chq-agenda-break-band:has-text("Afternoon break")\', padding: 300 },',
      testFile: "test/docs-shots-manifest.test.ts",
    },
  },
  {
    key: "highlight-selectors-dim",
    status: "honored",
    reason: "a row may declare highlight:{selectors,dim} to draw a brand outline/glow on the caption's subject, optionally dimming the rest -- a real row uses it (with dim) for the agenda held-back/toast figure.",
    honored: {
      kind: "present",
      file: "scripts/docs-shots-lib.ts",
      literal: 'highlight: { selectors: [".chq-agenda-held-back", ".chq-toast"], dim: true },',
      testFile: "test/docs-shots-manifest.test.ts",
    },
  },
  // ---- ## 5. Pending adjudication -- divider row (DEC-967 wave-31) ------
  {
    key: "5-pending-adjudication-not-yet-blessed-sweep-should-verdict",
    status: "gap",
    reason:
      "the section's own text says 'No adjudication is currently open' -- the one entry it used to list (tracks-and-rooms save model) was verdicted by the G13 srv1 adjudication and is recorded, resolved, under ## 6's Adjudications (see the 'tracks-and-rooms-save-model' row below, which cites that section, never this one). A section whose whole content is a statement that nothing is open draws zero top-level bullets, so it is recorded as a single divider-style gap row keyed to its own heading -- same reasoning test/design-rulings-ledger.scan.test.ts applies to its own section-divider headings -- never force-fit to the ## 6 row's citation.",
  },
  // ---- ## 6. Deferred post-deadline -------------------------------------
  {
    key: "your-data-edit-view",
    status: "gap",
    reason: "USER RULING 2026-08-16, G13 sweep: no data model or endpoint behind the retention-select/keeping-and-deleting/revoke-every-token drawing -- recorded as scope, not disguised as built.",
  },
  {
    key: "tracks-rooms-drag-handle-reordering",
    status: "gap",
    reason: "no server-side order field exists to back drag-handle reordering.",
  },
  {
    key: "public-pages-publish-unpublish-control-09-07-and-saved-embed-in-use-on-host-column-09-09",
    status: "gap",
    reason: "no backing data exists for either control.",
  },
  {
    key: "per-person-scope-column-and-per-row-change-on-people-and-roles-read-view",
    status: "gap",
    reason: "users are org-scoped; no per-person scope model exists to read or change.",
  },
  {
    key: "hotel-form-save-draft-per-recipient-reminder-triage-rows-speaker-detail-header-restructure-04-07-frames",
    status: "gap",
    reason: "deferred reworks, G13 sweep -- no code behind the drawings.",
  },
  {
    key: "ai-assisted-triage-eval-abs-14",
    status: "gap",
    reason: "roadmap item, never sketched in the design frames -- there is nothing to cite.",
  },
  {
    key: "plan-editor-reviewer-row-swap",
    status: "honored",
    reason: "the reviewer row's GEOMETRY matches the frame; only the label differs -- copy stays 'Remove' behind ConfirmDialog because no reassign-in-place capability exists in the domain or route layer (DEC-941, DEC-745 wave-98 amendment).",
    honored: { kind: "present", file: "app/src/pages/review/review.css", literal: ".chq-review-reviewer-row {", testFile: "app/src/pages/review/PlanEditor.render.test.tsx" },
  },
  {
    key: "portal-task-list-dock-later",
    status: "gap",
    reason: "the dock's GEOMETRY (Mark the release signed / Later, both min-height:48px) is legitimate future work for whatever primary the page renders, but the portal task model exposes only complete-or-not -- src/routes/portal/**/*.tsx and src/server/repo/portal* carry no snooze/defer/dismiss/later capability -- so 'Later' is recorded openly as unbuilt, not disguised as done.",
  },
  {
    key: "csv-import-the-first-three-rejection-screen-560-card-no-step-rail-download-the-rows-action",
    status: "gap",
    reason: "the validation itself SHIPPED; only the 560-card/no-step-rail/download-the-rows PRESENTATION is deferred -- recorded as scope, not disguised as built.",
  },
  {
    key: "embed-editor-drill-page-anatomy-09-15-sessionboard-importer-modal-per-entity-dispositions-09-25-plan-editor-footer-draft-vs-open-model-email-html-shells-cta-callout-signature-anatomy-07-09-12-shared-confirmdialog-480-subtitle-typed-label-anatomy-09-21-22-portal-resources-block-rework-09-13-docs-ia-expansion-14-further-articles-the-sessionboard-importer-modal-is-drawn-at-docs-design-chautauqua-settings-dc-html-1507-import-from-sessionboard",
    status: "gap",
    reason: "reworks larger than the freeze window -- a bundle of deferred anatomy changes, none built.",
  },
  {
    key: "portal-measure-widened-against-the-frames",
    status: "honored",
    reason: "USER RULING 2026-08-16 (release night): the portal keeps the app-wide --chq-measure (820px) token instead of the drawn 560px --chq-portal-measure.",
    honored: { kind: "present", file: "app/src/styles.css", literal: "--chq-portal-measure: 560px;", testFile: "test/portal-phone-fit.test.ts" },
  },
  {
    key: "tracks-and-rooms-save-model",
    status: "honored",
    reason: "G13 srv1 adjudication: per-row dirty-reveal Save/Cancel is BLESSED; the Done control confirms before discarding dirty rows.",
    honored: { kind: "present", file: "app/src/pages/settings/TracksRoomsPanel.tsx", literal: "confirmingDiscard", testFile: "app/src/pages/settings/TracksRoomsPanel-errors.render.test.tsx" },
  },
  {
    key: "auth-input-fill-stays-chq-surface-faf8f2-no-change-ruled-dec-383-wave-114-amendment",
    status: "honored",
    reason:
      "DEC-383 wave-114 amendment closed the last open adjudication: Chautauqua Account.dc.html draws #FFFFFF on the DESKTOP card's inputs but #FAF8F2 (= --chq-surface) on the same controls in its own 390 cuts, so the pack contradicts itself and no frame reading licenses the off-palette literal. RULED no change -- the app already ships --chq-surface, which is what the card paints.",
    honored: { kind: "present", file: "src/routes/auth.css.ts", literal: "background: var(--chq-surface);", testFile: "test/auth-card-geometry.test.ts" },
  },
  {
    key: "settings-760-measure-09-00-rejected",
    status: "honored",
    reason: "Settings keeps the app-wide --chq-measure token (DEC-744/DEC-808); the drawn 760px literal is not used.",
    honored: { kind: "present", file: "app/src/pages/settings/settings.css", literal: "max-width: var(--chq-measure);", testFile: "app/src/pages/settings/TracksRoomsPanel-css.test.ts" },
  },
  {
    key: "speakers-status-vocabulary-under-write-failure-dec-730-wave-90-amendment",
    status: "honored",
    reason: "the inverted DONE/PEND/LATE vocabulary (complete recedes bare-text, overdue is the filled exception) is the same class family in every state, including under a write-failure banner -- no separate write-failure styling exists.",
    honored: { kind: "present", file: "app/src/pages/speakers/speakers.css", literal: ".chq-speakers-status-complete {", testFile: "app/src/pages/speakers/speakers-css.test.ts" },
  },
  {
    key: "speakers-status-chip-hover",
    status: "honored",
    reason: "USER RULING 2026-08-19 (v12 review): a quiet --chq-surface-sunk background tint on hover, not the frame's box-shadow ring -- rounded status-fill states already paint, so a floating ring read as a false affordance around loose text.",
    honored: { kind: "present", file: "app/src/pages/speakers/speakers.css", literal: "button.chq-speakers-status:hover {", testFile: "app/src/pages/speakers/speakers-css.test.ts" },
  },
  {
    key: "focus-hover-ring-geometry-on-bare-text-controls",
    status: "honored",
    reason: "USER RULING 2026-08-19 (v12 review): quiet-action families (e.g. .chq-link-button) cancel inline padding with an equal-and-opposite negative margin-inline, so the focus/hover ring and hit box gain room while no glyph moves.",
    honored: { kind: "present", file: "app/src/styles.css", literal: ".chq-link-button {", testFile: "app/src/focus-treatment.scan.test.ts" },
  },
  {
    key: "portal-your-profile-dock-has-no-cancel-dec-154-wave-125-dec-576-wave-110-wave-119",
    status: "honored",
    reason:
      "DEC-154 wave-125 / DEC-576 wave-110-119: the 390 frame draws a bordered Cancel beside the docked Save on Your profile, but the page has no leave-without-saving destination distinct from the sign-out and the back-link already on screen -- DEC-576 forbids manufacturing a second control just to fill the band, so the dock carries only the primary Save profile.",
    honored: {
      kind: "present",
      file: "src/routes/portal/profile.tsx",
      literal: "const profileDock = (",
      testFile: "test/portal-phone-frames.test.ts",
    },
  },
  {
    key: "plan-editor-new-plan-footer-save-as-draft-open-the-plan-names-an-unrepresentable-state-dec-380-wave-130-amendment",
    status: "gap",
    reason:
      "DEC-380 wave-130 amendment, reconfirmed wave-140: the new-plan footer's caption names a save-without-opening state the schema has no column for -- a plan's openness is derived from openDate alone and isPlanOpen(openDate=null, closeDate=null, ...) reads an unset open date as open NOW, so the caption would be false if built. Re-tested against the narrowed rule at wave-140: evaluation_plan (src/db/schema/review.ts) still carries no draft/status column -- SCHEMA LACKS THE COLUMN. Recorded openly; the title row keeps its existing Cancel / Create the plan pair.",
  },
  {
    key: "contacts-pipeline-keeps-its-landed-head-action-no-phone-dock-is-minted-dec-576-wave-120-124",
    status: "superseded",
    reason:
      "DEC-967 wave-145: a build landed a Pipeline · 390 phone dock (app/src/pages/contacts/PipelineBoard.tsx renders both Add someone and Filter inside a docked .chq-phone-dock band), reversing this bullet's own 'no phone dock is minted' ruling now that 'Filter' has a wired referent -- the same-screen five-stage facet strip. The reversal is recorded, on its merits, in section 6's Adjudications as 'Contacts Pipeline · 390 dock IS minted; THIS REVERSES DEC-576 wave-120/124'.",
    superseded: { literal: "Contacts Pipeline · 390 dock IS minted" },
  },
  {
    key: "contacts-pipeline-390-dock-is-minted",
    status: "honored",
    reason:
      'DEC-967 wave-145: the reversal\'s two halves, both checked against the tree. Positive -- the dock is real: PipelineBoard.tsx renders a data-chq-phone-dock band with both Add someone and Filter. Negative -- the reversal invents no new domain capability: "Filter" re-slices entries the page already fetched (the same PIPELINE_STAGES the chq-contacts-pipeline-phone-stages strip draws above the list), never a new server query -- src/routes/api/pipeline.ts\'s GET /pipeline reads only page/perPage, no stage query param, so "Filter" cannot be quietly backed by a route this ledger never graded.',
    honored: [
      {
        kind: "present",
        file: "app/src/pages/contacts/PipelineBoard.tsx",
        literal: "data-chq-phone-dock",
        testFile: "app/src/pages/contacts/PipelineBoard.render.test.tsx",
      },
      { kind: "absent", term: 'query("stage")' },
    ],
  },
  {
    key: "the-contacts-390-rule-chips-label-ink-resolves-to-chq-brand-not-a-third-olive-dec-367-amendment-wave-16-r5",
    status: "honored",
    reason:
      "DEC-367 amendment, wave-16 r5: checked against the tree both halves. Positive -- the chip label really does draw --chq-brand: app/src/pages/contacts/contacts.css's .chq-contacts-filter-rule-chip sets color: var(--chq-brand), and the rule's own header comment confirms #2E3A16 resolves there so the label's REST ink is never a state token. Negative -- the resolution mints no new hex literal: --chq-brand (#4E5C31/#4e5c31), --chq-surface-sunk (#EFEBDF/#efebdf) and --chq-muted (#565A4B/#565a4b) are all pre-existing tokens declared in src/views/theme.ts and app/src/styles.css, not a fresh third olive.",
    honored: {
      kind: "present",
      file: "app/src/pages/contacts/contacts.css",
      literal: "color: var(--chq-brand);",
      testFile: "app/src/pages/contacts/FilterRulesPanel.ruleChips.render.test.tsx",
    },
  },
  {
    key: "portal-resource-modal-kind-pair-file-link-docs-design-chautauqua-settings-dc-html-1463-1464",
    status: "honored",
    reason:
      "DEC-380 wave-130 amendment, reconfirmed wave-140: this product's second resource kind is a wiki page with stored markdown, not a link, so there is no link-kind referent to build. Re-tested against the narrowed rule at wave-140: the content schema's kind column (src/db/schema/content.ts) still admits only 'file'/'wiki' -- THE PRODUCT HAS NO SUCH OBJECT. The chips stay File / Wiki page.",
    honored: { kind: "present", file: "app/src/pages/settings/ResourcesPanel.tsx", literal: "resource.kind === 'file' ? 'File' : 'Wiki page'", testFile: "app/src/pages/settings/ResourcesPanel.render.test.tsx" },
  },
  {
    key: "cfp-not-yet-open-pages-link-now-points-at-the-prior-edition",
    status: "superseded",
    reason:
      "DEC-745 wave-150 amendment: the still-owed build recorded through wave-149 (getPriorPublicEvent existed but NotYetOpenPage was never wired to it) landed -- NotYetOpenPage now resolves getPriorPublicEvent at all three call sites and renders the frame's 'Browse last year's sessions' label pointing at the prior edition's sessions surface when one qualifies, falling back to the original link/label unchanged otherwise. This bullet is its own record of that build; nothing external adjudicates it.",
    superseded: { literal: "RETIRES the entry recorded above through wave-149" },
  },
  {
    key: "field-name-eyebrows-drawn-as-bordered-chips-rendered-as-plain-text",
    status: "honored",
    reason:
      "DEC-393 wave-155 amendment (task pe): test/desktop-control-floor.scan.test.ts's desktop drawn-floor ledger extracts any pack element with a min-height + border-radius + (border/background) shape as a DRAWN CONTROL, with no way to tell a real control from decoration. Twelve of that ledger's 23 wave-151 offenders are field-name/section-name labels the pack draws as bordered chips that the app correctly renders as plain, unbordered text via .chq-portal-field-label / .chq-page-title / .chq-section-label -- none of the three is a control anywhere in the app.",
    honored: { kind: "present", file: "src/routes/portal/portal.css.ts", literal: ".chq-portal-field-label {", testFile: "test/desktop-control-floor.scan.test.ts" },
  },
  {
    key: "contacts-390-rule-chip",
    status: "honored",
    reason:
      "DEC-393 wave-16 r4 amendment: the frame's drawn gap:9px between the chip's edit label and its dismiss control is met as hit-box separation, not literal optical separation -- the 44px width floor and a literal 9px drawn gap between glyphs cannot both hold at this glyph size, and the floor wins per DEC-393.",
    honored: {
      kind: "present",
      file: "app/src/pages/contacts/contacts.css",
      literal: ".chq-contacts-filter-rule-chip-edit",
      testFile: "app/src/pages/contacts/contacts-rule-chip-geometry-390.test.ts",
    },
  },
  // ---- ## 7. Settled frame divergences (wave 16 amendment, DEC-663) -----
  {
    key: "contacts-merge-390-picker-block",
    status: "honored",
    reason:
      "the frame's 390 drill goes straight from the head band into the field-by-field compare rows, drawing no intervening control, but MergePage renders an additional radio list above those rows that selects WHICH duplicate pair is being merged -- a capability the frame's already-chosen-pair mock silently assumes; removing it would strand a 3+-member duplicate group's route to a usable merge.",
    honored: {
      kind: "present",
      file: "app/src/pages/contacts/MergePage.tsx",
      literal: "chq-contacts-merge-picks",
      testFile: "app/src/pages/contacts/MergePage.frame390.render.test.tsx",
    },
  },
  {
    key: "speaker-portal-landings-fourth-section-and-its-resources-footer-link",
    status: "honored",
    reason:
      "GET /portal renders a fourth section between 'Waiting on you' and 'Your session' ('Your submissions') and a footer Resources link that the frame's 390 landing cut, drawn before these features existed, omits -- both are shipped product ruled real by DEC-729 and DEC-988.",
    honored: [
      { kind: "present", file: "src/routes/portal/index.tsx", literal: '<section aria-label="Your submissions" class="chq-section">', testFile: "test/portal-390-frame-verdicts.test.ts" },
      { kind: "present", file: "src/routes/portal/index.tsx", literal: '<a href="/portal/resources" class="chq-portal-footer-resources">Resources</a>', testFile: "test/portal-390-frame-verdicts.test.ts" },
    ],
  },
  {
    key: "speakers-390-landings-roster-trigger",
    status: "honored",
    reason:
      "no Speakers 390 landing frame draws an entry point into the roster drill, but the drill's own destination frame IS drawn -- without a trigger that destination would be unreachable dead code, so the app adds the narrowest possible entry point, already commented as scaffolding rather than a frame match.",
    honored: { kind: "present", file: "app/src/pages/speakers/OnboardingGrid.tsx", literal: "chq-speakers-phone-roster-link", testFile: "app/src/pages/speakers/OnboardingGrid.render.test.tsx" },
  },
  {
    key: "submit-a-talks-format-legend",
    status: "honored",
    reason:
      "the frame draws the bare word 'Format' for the 390 submit form's format-choice group legend, but FormatChoices renders <legend>{field.label}</legend> and the seeded fixture's stored label is organizer-authored content ('Session format'), not a product string the frame is specifying -- hardcoding the frame's word would overwrite what an organizer typed into their own CFP form.",
    honored: { kind: "present", file: "src/routes/public/submit-views.tsx", literal: "<legend>{field.label}</legend>", testFile: "test/cfp-stored-label-register.test.ts" },
  },
  {
    key: "cfp-wizard-docks-save-draft-vs-the-frames-draft-already-ruled-recorded-here-only-so-the-ledger-stops-re-filing-it",
    status: "honored",
    reason:
      "the accessible name stays 'Save draft' per DEC-613's wave-96 amendment, one control with one name at every width -- the frame's 'Draft' is a drawing abbreviation rather than a label to ship. The sheet states its own disposition inline; recorded here only so the ledger stops re-filing it.",
    honored: {
      kind: "present",
      file: "src/routes/public/cfp.css.ts",
      literal: 'the accessible name stays "Save draft" per DEC-613 wave-96 amendment',
      testFile: "test/cfp-desktop-frame-verdicts.test.ts",
    },
  },
  {
    key: "plan-editors-v4-title-row-shell-name-as-input-duplicate-save-on-the-back-link-row-is-blessed-superseding-the-frames-separate-h1-footer-save-cancel-anatomy",
    status: "honored",
    reason:
      "the frame's 390 plan-editor draws a standalone <h1> plus a docked footer Save/Cancel pair below the fields; the shipped shell instead renders the plan's name as an editable input with Duplicate/Save on the SAME row as the back link -- rebuilding the frame's separate anatomy would delete rename-in-place, a shipped capability the frame predates.",
    honored: { kind: "present", file: "app/src/pages/review/PlanEditor.tsx", literal: "chq-review-editor-title-row", testFile: "app/src/pages/review/PlanEditor.render.test.tsx" },
  },
  {
    key: "settings-events-read-drill-footer-has-no-cancel",
    status: "honored",
    reason:
      "the frame draws a content+Save/Cancel-footer anatomy for the drilled Event screen; the read view instead stands the head's own 'Change' action down at 390 (a read view holds no form to submit, so no Cancel is manufactured to pair with it) because the read drill's own footer primary already carries the identical edit route. The frame's full Save/Cancel pair renders in the edit drill itself, where a form genuinely exists to submit or discard.",
    honored: [
      {
        kind: "present",
        file: "app/src/pages/settings/settings.css",
        literal: ".chq-settings-panel[data-chq-section='event'] > .chq-settings-section-head > .chq-settings-section-action {",
        testFile: "app/src/pages/settings/EventSettingsPanel.render.test.tsx",
      },
      {
        kind: "present",
        file: "app/src/pages/settings/EventSettingsPanel.tsx",
        literal: 'className="chq-btn chq-btn-secondary" onClick={closeEdit} disabled={saving}>',
        testFile: "app/src/pages/settings/EventSettingsPanel.render.test.tsx",
      },
    ],
  },
  {
    key: "a-modalframe-dialogs-title-stays-an-h2-referenced-by-aria-labelledby-not-the-frames-h1",
    status: "honored",
    reason:
      "every docs/design/*.dc.html 390 drill frame standing in for a ModalFrame-built dialog draws its head as an <h1>, because a static frame has no concept of 'this screen is a dialog layered over a page'. ModalFrame.tsx renders the dialog's title as an <h2> pointed at by aria-labelledby -- the correct document outline (one <h1> per document, dialogs labelled relative to their trigger) -- left as <h2> on purpose; only the tag name diverges.",
    honored: { kind: "present", file: "app/src/components/ModalFrame.tsx", literal: '<h2 className="chq-modal-title">{title}</h2>', testFile: "app/src/components/modal-frame-title-phone-drill.test.ts" },
  },
  {
    key: "contacts-390-stands-down-three-purely-informational-readings-with-no-surviving-path-wave-16-r5-amendment-src-decisions-data-dec-919-md",
    status: "honored",
    reason:
      "two title-row summary clauses (returning speakers, reach across events) and the DirectoryRail's ranked top-companies aggregate are lost outright at 390, not re-lined -- all three are readings with no action attached, and the frame's phone head band has no slot left for any of them (fully spent on the wordmark row, the page title and the re-lined three-clause summary), with no rail slot at all in the body. Stood down as recorded deviations via the rail's own phone display:none rule, not silently dropped inside a receipt that claims re-lining.",
    honored: {
      kind: "present",
      file: "app/src/pages/contacts/contacts.css",
      literal: "  .chq-contacts-rail {\n    display: none;\n  }",
      testFile: "app/src/pages/contacts/DirectoryRail.phone390.render.test.tsx",
    },
  },
  {
    key: "settings-events-slug-field-stays-slug-not-the-frames-public-url-dec-613-wave-24-amendment",
    status: "honored",
    reason:
      "the frame's 'Public URL' label names a field whose drawn value is a full rendered origin+slug, but EventSettingsPanel.tsx's control edits the slug segment alone -- the panel's own PATCH payload and form state key are 'slug', never a composed URL, so adopting the frame's label without also building the origin-prefix presentation it implies would name the field something the input does not accept.",
    honored: { kind: "present", file: "app/src/pages/settings/EventSettingsPanel.tsx", literal: "slug: 'Slug',", testFile: "app/src/pages/settings/EventSettingsPanel.render.test.tsx" },
  },
  // The seven rows below were added by the WAVE-31 MERGE TRAIN, not by task
  // w31-c. w31-c derived this population from DEVIATIONS.md's live headings
  // (replacing the old hand-listed INCLUDED_HEADINGS) while `## 7` carried 10
  // bullets; main had meanwhile grown the section to 17 -- the wave-30
  // megabatch landed DEC-582's "CFP display-only overrides" subsection (six
  // bullets) plus DEC-919's Content-390 chip-strip entry. The merge surfaced
  // all seven as "derived bullet with no ledger row", which is w31-c's
  // derivation working exactly as built: a hand-listed population would have
  // stayed silently green. Each was graded by the same rule as the original
  // ten -- open the cited artifact, confirm it carries the cited literal --
  // and each cites the SAME guard test DEVIATIONS.md's own bullet names, so
  // no row here invents a resolver the prose did not already claim.
  {
    key: "content-390-chip-strip-keeps-its-third-chip-all-accepted-sessions-dec-919-wave-28-amendment",
    status: "honored",
    reason:
      "DEC-919 wave-28 amendment: the frame draws three chips at desktop and only two in both 390 extents, but the product renders all three at every width. RULED that the third stays -- a filter tab is a capability, not prose, so DEC-919's re-line-never-remove governs it, and the frame's own 390 chip row declares overflow-x:auto, meaning a member past the drawn viewport is a drawing boundary rather than an omission to match.",
    honored: {
      kind: "present",
      file: "app/src/pages/content/worklist.ts",
      literal: "export const WORKLIST_TABS = ['needs_decision', 'approved', 'all'] as const;",
      testFile: "app/src/pages/content/ContentApp.landing390.render.test.tsx",
    },
  },
  {
    key: "abstract-helper-text-cfp-abstract-help-text",
    status: "honored",
    reason:
      "DEC-582 wave-30 amendment: frame-copy override. The frame draws this helper beneath the Abstract field and the product ships the identical literal, overriding whatever helper text a producer's own stored field carries -- display-only chrome the frame itself draws, which is the half of DEC-613 wave-27's rule where frame copy wins.",
    honored: {
      kind: "present",
      file: "src/routes/public/submit-views.tsx",
      literal: 'const CFP_ABSTRACT_HELP_TEXT = "Shown on the public sessions page if your talk is accepted";',
      testFile: "test/submit-cfp-frame-copy.test.ts",
    },
  },
  {
    key: "bio-helper-text-cfp-bio-help-text",
    status: "honored",
    reason:
      "DEC-582 wave-30 amendment: frame-copy override. The frame draws this helper beneath the Bio field and the product ships the identical literal. Note this row touches helpText only -- the bio LABEL is the deliberate non-override recorded in its own row below.",
    honored: {
      kind: "present",
      file: "src/routes/public/submit-views.tsx",
      literal: 'const CFP_BIO_HELP_TEXT = "Shown on the public speakers page · you can edit it later in your portal";',
      testFile: "test/submit-cfp-frame-copy.test.ts",
    },
  },
  {
    key: "email-helper-text-cfp-email-help-text-the-one-addition-not-a-frame-match",
    status: "honored",
    reason:
      "DEC-582 wave-30 amendment: the one ADDITION in this subsection, recorded as such rather than dressed up as a frame match. The frame draws no helper under Email at all; the product adds one stating a real, invisible cost (a typo strands the speaker with no other route to their portal) that a static mock has no room to draw.",
    honored: {
      kind: "present",
      file: "src/routes/public/submit-views.tsx",
      literal: 'const CFP_EMAIL_HELP_TEXT = "We send your portal link here, so a typo means you never get it";',
      testFile: "test/submit-cfp-frame-copy.test.ts",
    },
  },
  {
    key: "notes-for-reviewers-placeholder-cfp-notes-for-reviewers-placeholder",
    status: "honored",
    reason:
      "DEC-582 wave-30 amendment (DEC-380 wave-133 for the shape): the frame draws this string as example content INSIDE the textarea, not as a below-field caption, so the product ships it as the control's placeholder attribute -- the closest DOM equivalent of 'content drawn inside the box'.",
    honored: {
      kind: "present",
      file: "src/routes/public/submit-views.tsx",
      literal: 'const CFP_NOTES_FOR_REVIEWERS_PLACEHOLDER = "Never shown publicly";',
      testFile: "test/submit-cfp-frame-copy.test.ts",
    },
  },
  {
    key: "accessibility-needs-placeholder-cfp-accessibility-needs-placeholder",
    status: "honored",
    reason:
      "DEC-582 wave-30 amendment: same pattern as the notes-for-reviewers row above -- the frame draws the string inside the control, so the product ships it as a placeholder. Both fields are asserted together by the one cited guard.",
    honored: {
      kind: "present",
      file: "src/routes/public/submit-views.tsx",
      literal: 'const CFP_ACCESSIBILITY_NEEDS_PLACEHOLDER = "Goes to the venue team only";',
      testFile: "test/submit-cfp-frame-copy.test.ts",
    },
  },
  {
    key: "bio-label-deliberately-not-overridden",
    status: "honored",
    reason:
      "DEC-613 wave-27, quoted verbatim by DEVIATIONS.md itself: 'the bio field's stored label ships at every width -- a frame's abbreviated legend never renames stored data.' The frame draws 'Bio · optional' as the legend, but displayFields applies NO label override for bio, so the producer-authored stored label ships as-is. This row's claim is a NON-build, so it carries the two-cite shape DEC-967 wave-145 requires: the built half (the helpText-only override that proves displayFields reaches this field at all) and the not-built half (no CFP_BIO_LABEL-shaped constant anywhere), so the row cannot go stale by someone later adding the override.",
    honored: [
      {
        kind: "present",
        file: "src/routes/public/submit-views.tsx",
        literal: "return { ...f, helpText: CFP_BIO_HELP_TEXT };",
        testFile: "test/submit-cfp-frame-copy.test.ts",
      },
      { kind: "absent", term: "CFP_BIO_LABEL" },
    ],
  },
  // ---- ## 8. Wave 9 rulings (DEC-976 / DEC-781 wave-9 amendments) -------
  {
    key: "a-pack-frame-that-documents-a-vocabulary-is-not-a-screen",
    status: "honored",
    reason:
      "two pack frames document a VOCABULARY rather than a screen (Comms's 4-up template reference gallery, and Docs's element-library frame drawing nine block kinds); neither is built under the desktop freeze. docsSiteRoutes registers only /docs and /docs/:slug, and the nine block kinds the Docs frame draws live in DocsBlock's own closed union, confirming the vocabulary reading rather than a missed screen.",
    honored: { kind: "present", file: "src/routes/docs-content/types.ts", literal: "DocsBlock's union is DEC-650's closed nine-block element library", testFile: "test/docs-block-vocabulary.test.ts" },
  },
  {
    key: "confirmdialog-gains-no-subtitle-slot",
    status: "honored",
    reason:
      "the frame's ConfirmDialog subtitle names an embed HOST the schema has never carried -- SavedEmbedsPanel.tsx's own comment records that the embeds repo and schema carry no referrer/host column, and DEC-781 already ruled the data-backed consequence lines unbuilt because DEC-380 governs (a frame's drawing does not create a data model). A slot with no reader is deferred on the same footing as the frame's other unbacked consequence line.",
    honored: { kind: "present", file: "app/src/pages/settings/SavedEmbedsPanel.tsx", literal: "Copy rule 3 forbids asserting what no endpoint stores.", testFile: "app/src/pages/settings/SavedEmbedsPanel.render.test.tsx" },
  },
  {
    key: "settings-950s-edit-footer-keeps-its-single-close",
    status: "honored",
    reason:
      "the frame draws a Cancel/Save-changes pair, but this form has no fields to submit -- every role change and removal writes immediately from the row-level controls -- so there is nothing for Save to commit and nothing for Cancel to revert. The frame's 'Change your own password' link beside them IS built, as SettingsEditForm's destructive footer slot.",
    honored: { kind: "present", file: "app/src/pages/settings/PeopleRolesPanel.tsx", literal: '<button type="button" className="chq-btn chq-btn-primary" onClick={closeEdit}>', testFile: "app/src/pages/settings/PeopleRolesPanel.roleChange.render.test.tsx" },
  },
  {
    key: "contacts-720s-single-stage-pill-page-is-the-phone-register",
    status: "honored",
    reason:
      "the tree's .chq-contacts-pipeline-phone-stages IS the frame's pill strip, at the width it belongs to; desktop's five simultaneous Kanban columns are settled truth verdicted MATCHES at the frame's desktop cut. stageEmptyBody() naming the structurally immediately-preceding stage (not the frame copy's two-back reference) is the correct derivation of the frame's own sentence, not a defect.",
    honored: { kind: "present", file: "app/src/pages/contacts/PipelineBoard.tsx", literal: "function stageEmptyBody(stage: PipelineStage, entries: PipelineEntry[]): string {", testFile: "app/src/pages/contacts/PipelineBoard.render.test.tsx" },
  },
];

// ---------------------------------------------------------------------------
// Resolution helpers
// ---------------------------------------------------------------------------

function fileExists(p: string): boolean {
  try {
    readFileSync(join(ROOT, p), "utf8");
    return true;
  } catch {
    return false;
  }
}

function fileContains(file: string, literal: string): boolean {
  const text = readFileSync(join(ROOT, file), "utf8");
  return text.includes(literal);
}

function walkTsFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...walkTsFiles(full));
    } else if (/\.tsx?$/.test(entry.name)) {
      out.push(full);
    }
  }
  return out;
}

const ABSENCE_ROOTS = ["src", "app/src"];

function termAppearsInTree(term: string): boolean {
  const needle = term.toLowerCase();
  for (const root of ABSENCE_ROOTS) {
    for (const file of walkTsFiles(join(ROOT, root))) {
      if (readFileSync(file, "utf8").toLowerCase().includes(needle)) return true;
    }
  }
  return false;
}

function literalAppearsInDeviations(literal: string): boolean {
  return DEVIATIONS_TEXT.includes(literal);
}

/** Derived, not hand-classified (DEC-967 wave-145): true when a bullet's
 * lead-in phrase itself asserts, in the exact grammatical shape this
 * document's own bullets use for a blessed non-build, that something is
 * explicitly NOT built -- "no <noun phrase> is minted/built/sent/reachable"
 * or "must not appear". A bullet matching this pattern makes a claim with a
 * negative half, and that half needs its own citation (see check 3b) --
 * not just a positive citation of some other, always-true fact standing in
 * for it. */
function bulletAssertsNonBuild(leadIn: string): boolean {
  return /\bno\b[^.]*\b(?:is|are)\s+(?:minted|built|sent|reachable)\b/i.test(leadIn) || /\bmust not appear\b/i.test(leadIn);
}

/** Pure classifier: given the derived population and the ledger, returns the
 * list of problems found -- named by key, never just a count. Exported so
 * negative-control tests can feed it synthetic violations directly. */
export function findDeviationsProblems(
  derived: DerivedBullet[],
  ledger: LedgerEntry[],
  resolvers: {
    fileExists: (p: string) => boolean;
    fileContains: (file: string, literal: string) => boolean;
    termInTree: (t: string) => boolean;
    literalInDoc: (l: string) => boolean;
  },
): string[] {
  const problems: string[] = [];

  const derivedKeySet = new Map<string, DerivedBullet>();
  for (const d of derived) {
    if (derivedKeySet.has(d.key)) {
      problems.push(`duplicate derived key (broken population, not a ledger issue): ${d.key}`);
      continue;
    }
    derivedKeySet.set(d.key, d);
  }

  const ledgerKeyCounts = new Map<string, number>();
  for (const entry of ledger) {
    ledgerKeyCounts.set(entry.key, (ledgerKeyCounts.get(entry.key) ?? 0) + 1);
  }

  // (1) every derived bullet has exactly one ledger row
  for (const d of derived) {
    const count = ledgerKeyCounts.get(d.key) ?? 0;
    if (count === 0) problems.push(`derived bullet with no ledger row: ${d.key}`);
    else if (count > 1) problems.push(`derived bullet with ${count} ledger rows (must be exactly 1): ${d.key}`);
  }

  // (2) every ledger row names a live derived key (no stale rows)
  for (const entry of ledger) {
    if (!derivedKeySet.has(entry.key)) problems.push(`stale ledger row citing a non-existent key: ${entry.key}`);
  }

  // (3) honored rows. `honored` may be a single Cite or an array of Cite
  // (DEC-967 wave-145): a row whose claim mixes a positive half ("built")
  // with a negative half ("not built") must resolve BOTH against the
  // tree, so every element of the array is checked, not just the first.
  for (const entry of ledger) {
    if (entry.status !== "honored") continue;
    if (!entry.honored) {
      problems.push(`honored row ${entry.key} has no honored citation`);
      continue;
    }
    const cites = Array.isArray(entry.honored) ? entry.honored : [entry.honored];
    if (cites.length === 0) {
      problems.push(`honored row ${entry.key} has an empty citation array`);
      continue;
    }
    for (const cite of cites) {
      if (cite.kind === "present") {
        if (!resolvers.fileExists(cite.file)) {
          problems.push(`honored row ${entry.key} cites a nonexistent file: ${cite.file}`);
        } else if (!resolvers.fileContains(cite.file, cite.literal)) {
          problems.push(`honored row ${entry.key} cites ${cite.file} but it does not contain "${cite.literal}"`);
        }
        if (!resolvers.fileExists(cite.testFile)) {
          problems.push(`honored row ${entry.key} cites a nonexistent test file: ${cite.testFile}`);
        }
      } else {
        if (resolvers.termInTree(cite.term)) {
          problems.push(`honored (absent) row ${entry.key} claims absence of "${cite.term}" but it appears in the tree`);
        }
      }
    }
  }

  // (3b) generalised non-build check (DEC-967 wave-145): any derived
  // bullet whose own text asserts something is explicitly NOT built (the
  // exact phrasing this ledger's bullets use for a blessed non-build --
  // "no ... is minted/built/sent/reachable", or "must not appear") must
  // have an absent-kind Cite among its row's citations if that row is
  // "honored" -- a present-only citation of unrelated code is exactly the
  // hole that let the Contacts Pipeline bullet's "no phone dock is
  // minted" half go unverified while the dock got built underneath it.
  for (const d of derived) {
    if (!bulletAssertsNonBuild(d.leadIn)) continue;
    const entry = ledger.find((e) => e.key === d.key);
    if (!entry || entry.status !== "honored" || !entry.honored) continue;
    const cites = Array.isArray(entry.honored) ? entry.honored : [entry.honored];
    if (!cites.some((c) => c.kind === "absent")) {
      problems.push(
        `honored row ${entry.key} asserts a non-build ("${d.leadIn}") but carries no absent-kind citation for it`,
      );
    }
  }

  // (4) superseded rows: the cited literal must appear verbatim in
  // DEVIATIONS.md's own bytes.
  for (const entry of ledger) {
    if (entry.status !== "superseded") continue;
    if (!entry.superseded) {
      problems.push(`superseded row ${entry.key} has no superseded citation`);
      continue;
    }
    if (!resolvers.literalInDoc(entry.superseded.literal)) {
      problems.push(`superseded row ${entry.key} cites a literal not present in DEVIATIONS.md: "${entry.superseded.literal}"`);
    }
  }

  // (5) gap rows carry no fake citation
  for (const entry of ledger) {
    if (entry.status !== "gap") continue;
    if (entry.honored || entry.superseded) {
      problems.push(`gap row ${entry.key} carries a citation (a gap must never be faked as resolved)`);
    }
  }

  return problems;
}

const realResolvers = {
  fileExists,
  fileContains,
  termInTree: termAppearsInTree,
  literalInDoc: literalAppearsInDeviations,
};

describe("deviations-ledger.scan (DEC-967 wave-100 amendment, wave-31 population extension)", () => {
  const derived = deriveBullets();

  it("tripwire: derived bullet population is non-empty and every key is stable/derived (never hardcoded)", () => {
    expect(derived.length).toBeGreaterThan(0);
    for (const d of derived) {
      expect(d.key.length, `bullet "${d.leadIn}" produced an empty key`).toBeGreaterThan(0);
      expect(d.key).toBe(slugify(d.leadIn));
    }
  });

  it("LEDGER_SECTIONS is derived from the live file, not a literal array, and finds all nine real headings", () => {
    expect(LEDGER_SECTIONS.length).toBe(9);
    for (const heading of LEDGER_SECTIONS) {
      expect(DEVIATIONS_TEXT.includes(heading), `expected DEVIATIONS.md to contain "${heading}"`).toBe(true);
    }
  });

  it("vacuous-population tripwire: exact entry count per section (re-measured wave-31, all nine headings now graded)", () => {
    const bySection = new Map<string, number>();
    for (const d of derived) bySection.set(d.heading, (bySection.get(d.heading) ?? 0) + 1);
    expect(bySection.get("## 1. Ruled omissions")).toBe(3);
    expect(bySection.get("## 2. State-layer additions (frames draw no row/selection states)")).toBe(6);
    expect(bySection.get("## 3. Interpretations where the frames underspecify")).toBe(18);
    expect(bySection.get("## 4. Voice")).toBe(1);
    expect(bySection.get("## 4a. Docs screenshots: tall frames, prepared states, and focus (USER RULINGS 2026-08-16 / 2026-08-17)")).toBe(4);
    expect(bySection.get("## 5. Pending adjudication (not yet blessed — sweep should verdict)")).toBe(1);
    expect(bySection.get("## 6. Deferred post-deadline (USER RULING 2026-08-16, G13 sweep)")).toBe(22);
    expect(bySection.get("## 7. Settled frame divergences (wave 16 amendment, DEC-663)")).toBe(17);
    expect(bySection.get("## 8. Wave 9 rulings (DEC-976 / DEC-781 wave-9 amendments)")).toBe(4);
    expect(derived.length).toBe(76);
  });

  it("'## 5. Pending adjudication' derives exactly one DIVIDER row (its own heading), never re-deriving ## 6's 'tracks-and-rooms-save-model' bullet -- no key collision between the two sections", () => {
    const fromFive = derived.filter((d) => d.heading === "## 5. Pending adjudication (not yet blessed — sweep should verdict)");
    expect(fromFive).toHaveLength(1);
    expect(fromFive[0]!.key).toBe("5-pending-adjudication-not-yet-blessed-sweep-should-verdict");
    const trsmBullets = derived.filter((d) => d.key === "tracks-and-rooms-save-model");
    expect(trsmBullets).toHaveLength(1);
    expect(trsmBullets[0]!.heading).toBe("## 6. Deferred post-deadline (USER RULING 2026-08-16, G13 sweep)");
  });

  it("every derived bullet has exactly one ledger row, and every ledger row names a live derived key", () => {
    const problems = findDeviationsProblems(derived, LEDGER, realResolvers).filter(
      (p) => p.includes("no ledger row") || p.includes("ledger rows (must be exactly 1)") || p.includes("stale ledger row") || p.includes("duplicate derived key"),
    );
    expect(problems, problems.join("\n")).toEqual([]);
  });

  it("every honored row's citation resolves (present: file exists + contains literal + test exists; absent: term genuinely absent from src/** and app/src/**)", () => {
    const problems = findDeviationsProblems(derived, LEDGER, realResolvers).filter((p) => p.includes("honored"));
    expect(problems, problems.join("\n")).toEqual([]);
  });

  it("every superseded row's cited literal genuinely appears in DEVIATIONS.md", () => {
    const problems = findDeviationsProblems(derived, LEDGER, realResolvers).filter((p) => p.includes("superseded row"));
    expect(problems, problems.join("\n")).toEqual([]);
  });

  it("no gap row carries a fake citation", () => {
    const problems = findDeviationsProblems(derived, LEDGER, realResolvers).filter((p) => p.includes("gap row"));
    expect(problems, problems.join("\n")).toEqual([]);
  });

  it("no problems at all -- the ledger is exact in both directions against the current tree", () => {
    const problems = findDeviationsProblems(derived, LEDGER, realResolvers);
    expect(problems, problems.join("\n")).toEqual([]);
  });

  // DEC-808 wave-20 amendment: this file's DEC-996 bullet names the
  // Settings frame from inside the file's header block (above the first
  // describe(), naming shorthand only) -- the header-block exemption's
  // companion rule requires at least one fully-receipted, non-header
  // citation into that same frame elsewhere in the file to pay for it.
  // This is that citation: a backtick quote read verbatim from the frame
  // line, immediately followed by a real expect(...).toBe(...) pinning it
  // (DEC-967 verbatimLine idiom).
  // docs/design/Chautauqua Settings.dc.html:1047 `              <h1 style="margin:0; font-family:'Familjen Grotesk', sans-serif; font-size:30px; font-weight:700; letter-spacing:-0.04em; line-height:1">AI track sessions</h1>`
  it("DEC-996 citation is verbatim: the Settings frame's :1047 h1 draws the literal this ledger's bullet cites", () => {
    const settingsDesignFile = join(ROOT, "docs", "design", "Chautauqua Settings.dc.html");
    const lines = readFileSync(settingsDesignFile, "utf8").split("\n");
    const line = lines[1047 - 1];
    expect(line).toBe(
      "              <h1 style=\"margin:0; font-family:'Familjen Grotesk', sans-serif; font-size:30px; font-weight:700; letter-spacing:-0.04em; line-height:1\">AI track sessions</h1>",
    );
  });
});

describe("findDeviationsProblems negative controls (DEC-099: every scan ships one)", () => {
  const baseDerived: DerivedBullet[] = [{ key: "zzz-01", leadIn: "ZZZ", heading: "## 1. Ruled omissions" }];
  const baseLedger: LedgerEntry[] = [
    { key: "zzz-01", status: "honored", reason: "test", honored: { kind: "present", file: "src/decisions.ts", literal: "export", testFile: "test/deviations-ledger.scan.test.ts" } },
  ];
  const fakeResolvers = {
    fileExists: (p: string) => p === "src/decisions.ts" || p === "test/deviations-ledger.scan.test.ts",
    fileContains: (f: string, l: string) => f === "src/decisions.ts" && l === "export",
    termInTree: (t: string) => t === "present-term",
    literalInDoc: (l: string) => l === "real-doc-literal",
  };

  it("compliant ledger against its matching population reports nothing (proves the scan can pass)", () => {
    expect(findDeviationsProblems(baseDerived, baseLedger, fakeResolvers)).toEqual([]);
  });

  it("a derived bullet with no ledger row IS reported (direction: population -> ledger)", () => {
    const extraDerived: DerivedBullet[] = [...baseDerived, { key: "zzz-99-unledgered", leadIn: "ZZZ99", heading: "## 1. Ruled omissions" }];
    const problems = findDeviationsProblems(extraDerived, baseLedger, fakeResolvers);
    expect(problems.some((p) => p.includes("zzz-99-unledgered"))).toBe(true);
  });

  it("a stale ledger row citing a dead key IS reported (direction: ledger -> population)", () => {
    const staleLedger: LedgerEntry[] = [...baseLedger, { key: "zzz-dead", status: "honored", reason: "x", honored: { kind: "present", file: "src/decisions.ts", literal: "export", testFile: "test/deviations-ledger.scan.test.ts" } }];
    const problems = findDeviationsProblems(baseDerived, staleLedger, fakeResolvers);
    expect(problems.some((p) => p.includes("zzz-dead"))).toBe(true);
  });

  it("a present-honored row citing a nonexistent path fails the resolver", () => {
    const badLedger: LedgerEntry[] = [{ key: "zzz-01", status: "honored", reason: "x", honored: { kind: "present", file: "src/does-not-exist.ts", literal: "export", testFile: "test/deviations-ledger.scan.test.ts" } }];
    const problems = findDeviationsProblems(baseDerived, badLedger, fakeResolvers);
    expect(problems.some((p) => p.includes("src/does-not-exist.ts"))).toBe(true);
  });

  it("a present-honored row whose cited file exists but does not contain the literal IS reported", () => {
    const badLiteral: LedgerEntry[] = [{ key: "zzz-01", status: "honored", reason: "x", honored: { kind: "present", file: "src/decisions.ts", literal: "definitely-not-present", testFile: "test/deviations-ledger.scan.test.ts" } }];
    const problems = findDeviationsProblems(baseDerived, badLiteral, fakeResolvers);
    expect(problems.some((p) => p.includes("definitely-not-present"))).toBe(true);
  });

  it("an absent-honored row whose term exists in the tree IS reported", () => {
    const badAbsence: LedgerEntry[] = [{ key: "zzz-01", status: "honored", reason: "x", honored: { kind: "absent", term: "present-term" } }];
    const problems = findDeviationsProblems(baseDerived, badAbsence, fakeResolvers);
    expect(problems.some((p) => p.includes("present-term"))).toBe(true);
  });

  it("an absent-honored row whose term genuinely does not appear is accepted", () => {
    const goodAbsence: LedgerEntry[] = [{ key: "zzz-01", status: "honored", reason: "x", honored: { kind: "absent", term: "totally-absent-term" } }];
    expect(findDeviationsProblems(baseDerived, goodAbsence, fakeResolvers)).toEqual([]);
  });

  it("a superseded row whose literal is not in DEVIATIONS.md IS reported", () => {
    const badSuperseded: LedgerEntry[] = [{ key: "zzz-01", status: "superseded", reason: "x", superseded: { literal: "not-in-doc" } }];
    const problems = findDeviationsProblems(baseDerived, badSuperseded, fakeResolvers);
    expect(problems.some((p) => p.includes("not-in-doc"))).toBe(true);
  });

  it("a superseded row whose literal genuinely appears in DEVIATIONS.md is accepted", () => {
    const goodSuperseded: LedgerEntry[] = [{ key: "zzz-01", status: "superseded", reason: "x", superseded: { literal: "real-doc-literal" } }];
    expect(findDeviationsProblems(baseDerived, goodSuperseded, fakeResolvers)).toEqual([]);
  });

  it("a gap row carrying a citation IS reported (a gap must never be faked as resolved)", () => {
    const fakedGap: LedgerEntry[] = [{ key: "zzz-01", status: "gap", reason: "x", honored: { kind: "absent", term: "present-term" } }];
    const problems = findDeviationsProblems(baseDerived, fakedGap, fakeResolvers);
    expect(problems.some((p) => p.includes("gap row zzz-01"))).toBe(true);
  });

  it("a clean gap row with no citation is accepted", () => {
    const cleanGap: LedgerEntry[] = [{ key: "zzz-01", status: "gap", reason: "x" }];
    expect(findDeviationsProblems(baseDerived, cleanGap, fakeResolvers)).toEqual([]);
  });

  // DEC-967 wave-145: array-of-Cite support and the generalised non-build
  // check, both proved on synthetic fixtures this test OWNS -- never on a
  // real product offender's identity (a sentinel anchored to a live row
  // dies the moment that row is fixed; DEC-967 waves 100/123/143).
  it("an honored row's citation array requires EVERY element to resolve -- one bad element among good ones IS reported", () => {
    const mixedArray: LedgerEntry[] = [
      {
        key: "zzz-01",
        status: "honored",
        reason: "x",
        honored: [
          { kind: "present", file: "src/decisions.ts", literal: "export", testFile: "test/deviations-ledger.scan.test.ts" },
          { kind: "absent", term: "present-term" },
        ],
      },
    ];
    const problems = findDeviationsProblems(baseDerived, mixedArray, fakeResolvers);
    expect(problems.some((p) => p.includes("present-term"))).toBe(true);
  });

  it("an honored row's citation array where every element resolves is accepted", () => {
    const goodArray: LedgerEntry[] = [
      {
        key: "zzz-01",
        status: "honored",
        reason: "x",
        honored: [
          { kind: "present", file: "src/decisions.ts", literal: "export", testFile: "test/deviations-ledger.scan.test.ts" },
          { kind: "absent", term: "totally-absent-term" },
        ],
      },
    ];
    expect(findDeviationsProblems(baseDerived, goodArray, fakeResolvers)).toEqual([]);
  });

  it("bulletAssertsNonBuild: matches the document's own non-build phrasing, not arbitrary prose", () => {
    expect(bulletAssertsNonBuild("no phone dock is minted")).toBe(true);
    expect(bulletAssertsNonBuild("Contacts Pipeline keeps its landed head action; no phone dock is minted (DEC-576 wave-120/124)")).toBe(true);
    expect(bulletAssertsNonBuild('"Archive this event" must not appear anywhere')).toBe(true);
    expect(bulletAssertsNonBuild("Contacts Pipeline · 390 dock IS minted")).toBe(false);
    expect(bulletAssertsNonBuild("Tracks/rooms drag-handle reordering")).toBe(false);
  });

  it("a non-build bullet whose honored row carries ONLY a present citation IS reported (the exact hole DEC-967 wave-145 closes)", () => {
    const nonBuildDerived: DerivedBullet[] = [{ key: "zzz-nb", leadIn: "no synthetic widget is minted", heading: "## 1. Ruled omissions" }];
    const presentOnly: LedgerEntry[] = [
      { key: "zzz-nb", status: "honored", reason: "x", honored: { kind: "present", file: "src/decisions.ts", literal: "export", testFile: "test/deviations-ledger.scan.test.ts" } },
    ];
    const problems = findDeviationsProblems(nonBuildDerived, presentOnly, fakeResolvers);
    expect(problems.some((p) => p.includes("zzz-nb") && p.includes("no absent-kind citation"))).toBe(true);
  });

  it("a non-build bullet whose honored row also carries an absent citation is accepted", () => {
    const nonBuildDerived: DerivedBullet[] = [{ key: "zzz-nb", leadIn: "no synthetic widget is minted", heading: "## 1. Ruled omissions" }];
    const both: LedgerEntry[] = [
      {
        key: "zzz-nb",
        status: "honored",
        reason: "x",
        honored: [
          { kind: "present", file: "src/decisions.ts", literal: "export", testFile: "test/deviations-ledger.scan.test.ts" },
          { kind: "absent", term: "totally-absent-term" },
        ],
      },
    ];
    expect(findDeviationsProblems(nonBuildDerived, both, fakeResolvers)).toEqual([]);
  });

  it("a non-build bullet whose row is 'superseded' (not 'honored') is exempt from the absent-clause requirement -- supersession, not a live non-build claim, resolves it", () => {
    const nonBuildDerived: DerivedBullet[] = [{ key: "zzz-nb", leadIn: "no synthetic widget is minted", heading: "## 1. Ruled omissions" }];
    const superseded: LedgerEntry[] = [{ key: "zzz-nb", status: "superseded", reason: "x", superseded: { literal: "real-doc-literal" } }];
    expect(findDeviationsProblems(nonBuildDerived, superseded, fakeResolvers)).toEqual([]);
  });
});
