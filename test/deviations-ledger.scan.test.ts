// DEC-967 (wave 100 amendment): docs/design/DEVIATIONS.md is the third
// authority the v12 mobile-campaign goal names (frames, DESIGN-RULINGS.md,
// DEVIATIONS.md) and, until this file, the only one with no derived guard.
// Every entry in it asserts something about the tree -- "the app keeps the
// recorded A20 ruling", "the Sort <select>'s phone display:none was
// DELETED", ".chq-submissions-columnpicker's phone display:none STANDS",
// "NO STATUS CODE CHANGED" -- and fidelity audits are told to cite this file
// INSTEAD of re-flagging, so a stale entry silently suppresses a real
// finding. Modeled BYTE-FOR-BYTE on test/clarifications-ledger.scan.test.ts
// and test/design-rulings-ledger.scan.test.ts's derived-population +
// transcribed-ledger + two-directional-assertion idiom -- same shape, same
// falsifiability controls, no invention.
//
// This file does NOT edit docs/design/DEVIATIONS.md (an in-flight lane,
// v12m-w14-b, owns it and deletes its "## v12 frame errata" section) and
// does NOT transcribe rows out of "## v12 frame errata" or "## 5. Pending
// adjudication" -- deliberately, and asserted below as its own test:
//   - "## v12 frame errata" is being actively deleted by an in-flight
//     branch; transcribing it here would make this ledger red the moment
//     that branch lands, for a reason that has nothing to do with whether
//     THIS ledger's claims are honored.
//   - "## 5. Pending adjudication" is stale prose: its one entry
//     ("Tracks-and-rooms save model") is answered verbatim by "## 6.
//     Deferred post-deadline"'s "Adjudications recorded" sub-section
//     (per-row dirty-reveal BLESSED, G13 srv1 adjudication) -- two prior
//     waves misread §5 as open work because nothing pointed at its answer.
//
// Population: every top-level bullet entry under "## 1. Ruled omissions",
// "## 2. State-layer additions...", "## 3. Interpretations..." and "## 6.
// Deferred post-deadline...", re-derived at test time, never hand-listed.
// A "top-level" bullet is a line starting with "- " at column 0 (no leading
// whitespace) -- this naturally excludes the nested sub-bullets under the
// "Submissions 390 phone head" entry (section 3), which are indented and so
// never match the top-level pattern; their text is still folded into their
// parent bullet's joined text (harmless -- it only ever appears after the
// parent's own lead-in has already been extracted).
//
// Lead-in extraction, in priority order, applied to the bullet's full
// joined text (its first line plus every continuation line up to the next
// top-level bullet, heading, or bold paragraph-header line):
//   1. If the joined text opens with a bold span ("**...**"), the lead-in
//      is that span's contents (sections 1/2/3 -- and the bold span may
//      itself span multiple source lines, e.g. the Speakers write-failed
//      entry, which is why extraction runs on the JOINED text, not the
//      bullet's first line alone).
//   2. Otherwise (every bullet under "## 6", none of which opens on a bold
//      span -- confirmed by grep, see the section's own sub-headers being
//      bold PARAGRAPHS, not bold-led bullets), the lead-in is the text
//      before the first " — " (em dash) or ": " (colon-space), whichever
//      occurs first.
//   3. Otherwise (no delimiter found), the lead-in is the whole joined text
//      with a trailing "." stripped.
// This is the narrowest reasonable reading of "keyed by a slugify() of its
// bolded lead phrase" that still covers "## 6", whose bullets are plain
// prose sentences with no bold lead-in in the source file (verified by
// grep: `grep -n '^- ' docs/design/DEVIATIONS.md` shows none of the 14
// section-6 bullets open with "**"). Flagged here per the task's own
// instruction to take the narrowest reasonable interpretation of a design
// gap and name it, rather than force a bold-only rule that would either
// throw on every section-6 bullet or silently zero the section out.
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
//     words say these are deferred, not built, not disguised as done.
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

// ---------------------------------------------------------------------------
// Population -- derived at test time from docs/design/DEVIATIONS.md, never
// hardcoded.
// ---------------------------------------------------------------------------
interface DerivedBullet {
  key: string;
  leadIn: string;
  heading: string;
}

const INCLUDED_HEADINGS = [
  "## 1. Ruled omissions",
  "## 2. State-layer additions (frames draw no row/selection states)",
  "## 3. Interpretations where the frames underspecify",
  "## 6. Deferred post-deadline (USER RULING 2026-08-16, G13 sweep)",
];

// Deliberately excluded (see header comment for why): a section heading
// listed here must NEVER appear in INCLUDED_HEADINGS, enforced by its own
// test below.
//
// DEC-967 (wave-101 amendment): "## v12 frame errata" was dropped from this
// list because v12m-w14-b CLOSED that section and DELETED the heading from
// DEVIATIONS.md -- an exclusion that stops resolving is a work item that
// closed, not a regression. The heading is never re-added to satisfy this
// scan; a derived ledger's exclusion list is part of the derivation.
const EXCLUDED_HEADINGS = ["## 5. Pending adjudication (not yet blessed — sweep should verdict)"];

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

function deriveBullets(): DerivedBullet[] {
  const text = readFileSync(DEVIATIONS_PATH, "utf8");
  const out: DerivedBullet[] = [];
  for (const heading of INCLUDED_HEADINGS) {
    out.push(...deriveSectionBullets(extractSection(text, heading), heading));
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

interface LedgerEntry {
  key: string;
  status: "honored" | "superseded" | "gap";
  reason: string;
  honored?: PresentCite | AbsentCite;
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
    key: "csv-import-the-first-three-rejection-screen-560-card-no-step-rail-download-the-rows-action",
    status: "gap",
    reason: "the validation itself SHIPPED; only the 560-card/no-step-rail/download-the-rows PRESENTATION is deferred -- recorded as scope, not disguised as built.",
  },
  {
    key: "embed-editor-drill-page-anatomy-09-15-sessionboard-importer-modal-per-entity-dispositions-09-25-plan-editor-footer-draft-vs-open-model-email-html-shells-cta-callout-signature-anatomy-07-09-12-shared-confirmdialog-480-subtitle-typed-label-anatomy-09-21-22-portal-resources-block-rework-09-13-docs-ia-expansion-14-further-articles",
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
    key: "auth-input-fill-ffffff-frames-vs-palette-closure-ban-on-the-literal",
    status: "gap",
    reason: "needs a README palette ruling before any change -- recorded openly, no artifact to cite either way.",
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

const DEVIATIONS_TEXT = readFileSync(DEVIATIONS_PATH, "utf8");

function literalAppearsInDeviations(literal: string): boolean {
  return DEVIATIONS_TEXT.includes(literal);
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

  // (3) honored rows
  for (const entry of ledger) {
    if (entry.status !== "honored") continue;
    if (!entry.honored) {
      problems.push(`honored row ${entry.key} has no honored citation`);
      continue;
    }
    if (entry.honored.kind === "present") {
      const cite = entry.honored;
      if (!resolvers.fileExists(cite.file)) {
        problems.push(`honored row ${entry.key} cites a nonexistent file: ${cite.file}`);
      } else if (!resolvers.fileContains(cite.file, cite.literal)) {
        problems.push(`honored row ${entry.key} cites ${cite.file} but it does not contain "${cite.literal}"`);
      }
      if (!resolvers.fileExists(cite.testFile)) {
        problems.push(`honored row ${entry.key} cites a nonexistent test file: ${cite.testFile}`);
      }
    } else {
      const absentCite = entry.honored;
      if (resolvers.termInTree(absentCite.term)) {
        problems.push(`honored (absent) row ${entry.key} claims absence of "${absentCite.term}" but it appears in the tree`);
      }
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

describe("deviations-ledger.scan (DEC-967 wave-100 amendment)", () => {
  const derived = deriveBullets();

  it("tripwire: derived bullet population is non-empty and every key is stable/derived (never hardcoded)", () => {
    expect(derived.length).toBeGreaterThan(0);
    for (const d of derived) {
      expect(d.key.length, `bullet "${d.leadIn}" produced an empty key`).toBeGreaterThan(0);
      expect(d.key).toBe(slugify(d.leadIn));
    }
  });

  it("vacuous-population tripwire: exact entry count per included section", () => {
    const bySection = new Map<string, number>();
    for (const d of derived) bySection.set(d.heading, (bySection.get(d.heading) ?? 0) + 1);
    expect(bySection.get("## 1. Ruled omissions")).toBe(2);
    expect(bySection.get("## 2. State-layer additions (frames draw no row/selection states)")).toBe(6);
    expect(bySection.get("## 3. Interpretations where the frames underspecify")).toBe(5);
    expect(bySection.get("## 6. Deferred post-deadline (USER RULING 2026-08-16, G13 sweep)")).toBe(16);
    expect(derived.length).toBe(29);
  });

  it("deliberately excludes '## 5. Pending adjudication' and '## v12 frame errata' -- neither heading is in INCLUDED_HEADINGS, and no derived key originates from either section", () => {
    for (const excluded of EXCLUDED_HEADINGS) {
      expect(INCLUDED_HEADINGS).not.toContain(excluded);
    }
    // §5's only bullet ("Tracks-and-rooms save model") would collide in
    // TEXT with §6's differently-worded adjudication bullet if both were
    // ever included -- confirming here that the derived population's single
    // "tracks-and-rooms-save-model" key comes from §6 (which the ledger
    // row above cites with a §6 artifact), never from the excluded §5.
    const trsmBullets = derived.filter((d) => d.key === "tracks-and-rooms-save-model");
    expect(trsmBullets).toHaveLength(1);
    expect(trsmBullets[0]!.heading).toBe("## 6. Deferred post-deadline (USER RULING 2026-08-16, G13 sweep)");
  });

  it("both excluded headings are genuinely present in the document (a moved/renamed heading would silently defeat the exclusion, not just skip it)", () => {
    const text = readFileSync(DEVIATIONS_PATH, "utf8");
    for (const heading of EXCLUDED_HEADINGS) {
      expect(text.includes(heading), `expected DEVIATIONS.md to contain "${heading}"`).toBe(true);
    }
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
});
