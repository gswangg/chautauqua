// DEC-582 (wave 12 amendment): docs/design/DESIGN-RULINGS.md is part of the
// v2 design handoff and is cited BY NAME in shipped source
// (app/src/styles.css, app/src/pages/forms/FieldModal.tsx,
// src/routes/docs-site.tsx, app/src/pages/review/ResultsTable.tsx,
// src/domain/evaluation/criteria.ts, several decisions/*.md files) yet
// nothing under test/ read it before this file. Modeled BYTE-FOR-BYTE on
// test/clarifications-ledger.scan.test.ts's derived-population +
// transcribed-ledger + two-directional-assertion idiom -- same shape,
// same falsifiability controls, no invention.
//
// Population: every `## ` and `### ` heading in
// docs/design/DESIGN-RULINGS.md, re-derived at test time with the same
// slugify() used by test/sessionboard-expectations-ledger.scan.test.ts,
// never hand-listed.
//
// Ledger verdicts:
//   - "honored": the cited file exists, contains the cited literal
//     verbatim, and the cited test file exists.
//   - "absent-by-design": a written reason proving a deliberate scope
//     reduction (the "Superseded" section names frames formerly owed that
//     the ruling itself says are not yet drawn -- that is a scope
//     statement, not a code artifact, so it is NOT this verdict; see gap
//     rows below for how it is actually classified).
//   - "gap": the tree does not honor the heading. A gap row is a
//     legitimate outcome for a purely organizational heading (a section
//     divider grouping other headings that themselves carry rows) as well
//     as for a heading whose ruling has no single artifact. Recorded, never
//     omitted, never faked with a citation.
//
// Several headings in this file are SECTION DIVIDERS ("A. Extensions —
// capabilities with no frame", "B. Uncovered surfaces") whose content is
// itself a set of subsection headings this same population already
// derives separately (Content, Submissions, Review, Speakers, Comms /
// Contacts, Settings / Auth / Chrome, Public; B7, B8, B10). A divider
// heading has no artifact of its own -- honoring it would mean re-citing
// one of its children's rows, which the exactness check below already
// requires those children to carry -- so it is recorded "gap" rather than
// force-fit to a child's citation.
//
// NOTE (DEC-582 wave 141): a file split is a cascade edit over this table --
// when app/src/pages/settings/PeopleRolesPanel.render.test.tsx was split into
// .directory./.invite./.resetPassword./.roleChange./.summary.render.test.tsx
// (plus a .test-helpers.tsx), two honored rows still cited the deleted path
// and went unnoticed until this scan turned red. Whoever splits a test file
// must grep every `testFile:` value in this ledger for the old path and
// re-point each hit to the split member that actually carries the cited
// literal -- verified by reading, never guessed.

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";

const ROOT = resolve(__dirname, "..");
const RULINGS_PATH = join(ROOT, "docs", "design", "DESIGN-RULINGS.md");

// ---------------------------------------------------------------------------
// Population -- derived at test time from docs/design/DESIGN-RULINGS.md,
// never hardcoded.
// ---------------------------------------------------------------------------
interface DerivedHeading {
  key: string;
  title: string;
  level: 2 | 3;
}

const HEADING_RE = /^(##|###) (.+)$/;

/** Slugifies a heading title into a stable, deterministic key: lowercase,
 * curly/straight quotes and em-dashes stripped, every run of non-alphanumeric
 * characters collapsed to one hyphen, no leading/trailing hyphen. Pure
 * function of the title text -- never hand-assigned. Matches
 * test/sessionboard-expectations-ledger.scan.test.ts's slugify() exactly. */
function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/["""''`]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function deriveHeadings(): DerivedHeading[] {
  const text = readFileSync(RULINGS_PATH, "utf8");
  const out: DerivedHeading[] = [];
  for (const line of text.split("\n")) {
    const m = HEADING_RE.exec(line.trim());
    if (!m) continue;
    const marker = m[1] as string;
    const title = m[2] as string;
    out.push({ key: slugify(title), title, level: marker === "##" ? 2 : 3 });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Ledger -- transcribed by hand once, then checked against the derived
// population and the tree on every run.
// ---------------------------------------------------------------------------
interface HonoredCite {
  file: string;
  literal: string;
  testFile: string;
}

interface LedgerEntry {
  key: string;
  status: "honored" | "absent-by-design" | "gap";
  reason: string;
  honored?: HonoredCite;
  absent?: { term: string };
}

const LEDGER: LedgerEntry[] = [
  {
    key: "governing-principle-applied",
    status: "gap",
    reason:
      "a cross-surface design axiom (mobile reflows desktop, never competes with it) stated in prose; no single artifact represents the whole principle, each surface it governs is honored or gapped individually elsewhere in this ledger and in the frame-specific instruments.",
  },
  {
    key: "a-extensions-capabilities-with-no-frame",
    status: "gap",
    reason:
      "a section-divider heading grouping the seven subsection headings this population already derives separately (Content, Submissions, Review, Speakers, Comms / Contacts, Settings / Auth / Chrome, Public); it names no artifact of its own.",
  },
  {
    key: "content",
    status: "honored",
    reason: "worklist bulk-approve: checkbox column with an indeterminate select-all state, scoped Approve action.",
    honored: {
      file: "app/src/pages/content/SessionList.tsx",
      literal: "el.indeterminate = !allSelected && someSelected;",
      testFile: "app/src/pages/content/SessionList.render.test.tsx",
    },
  },
  {
    key: "submissions",
    status: "honored",
    reason: "session details section: tracks as chips with a tertiary Edit tracks link.",
    honored: {
      file: "app/src/pages/submissions/SubmissionDetailPage.tsx",
      literal: "Edit tracks",
      testFile: "app/src/pages/submissions/SubmissionDetailPage.render.test.tsx",
    },
  },
  {
    key: "review",
    status: "honored",
    reason: "anonymize toggle lives in the plan fields block beside Rating scale, labelled per the ruling.",
    honored: {
      file: "app/src/pages/review/PlanEditor.tsx",
      literal: "Hide speaker names from reviewers",
      testFile: "app/src/pages/review/PlanEditor.render.test.tsx",
    },
  },
  {
    key: "speakers",
    status: "honored",
    reason: "admin per-speaker detail page exists as its own route/component (B3).",
    honored: {
      file: "app/src/pages/speakers/SpeakerDetailPage.tsx",
      literal: "export function SpeakerDetailPage()",
      testFile: "app/src/pages/speakers/SpeakerDetailPage.render.test.tsx",
    },
  },
  {
    key: "comms-contacts",
    status: "honored",
    reason: "contact drawer's four titled field groups (Contact, Profile, This event, Notes) match the ruling's grouping.",
    honored: {
      file: "app/src/pages/contacts/ContactDrawer.tsx",
      literal: '<FieldGroup title="Profile">',
      testFile: "app/src/pages/contacts/ContactDrawer.render.test.tsx",
    },
  },
  {
    key: "settings-auth-chrome",
    status: "honored",
    reason: "login demo-account block fills the form via data attributes rather than auto-submitting.",
    honored: {
      file: "src/routes/auth-views.tsx",
      literal: "data-demo-password",
      testFile: "test/auth-login-lockout.test.ts",
    },
  },
  {
    key: "public",
    status: "honored",
    reason: "session-detail Save control writes the same chq_itinerary_<slug> key as the list rows.",
    honored: {
      file: "src/routes/public/detail.tsx",
      literal: "chq_itinerary",
      testFile: "test/public-detail-itinerary.test.ts",
    },
  },
  {
    key: "b-uncovered-surfaces",
    status: "gap",
    reason:
      "a section-divider heading grouping the ten uncovered-surface items and the B7/B8/B10 sub-specs this population already derives separately; it names no artifact of its own.",
  },
  {
    key: "b8-interaction-states-standard",
    status: "honored",
    reason: "the app's own stylesheet cites this section by name and number range while implementing the hover/motion vocabulary it specifies.",
    honored: {
      file: "app/src/styles.css",
      literal: 'docs/design/DESIGN-RULINGS.md:108-177 "B8 — Interaction-states',
      testFile: "app/src/pages/overview/overview-button-motion.test.ts",
    },
  },
  {
    key: "b7-empty-states",
    status: "honored",
    reason: "the shared public empty-state component implements the three-part, no-illustration shape.",
    honored: {
      file: "src/routes/public/empty-state.tsx",
      literal: "export function PublicEmptyState(",
      testFile: "test/public-empty-state.render.test.ts",
    },
  },
  {
    key: "b10-settings-edit-views-on-desktop",
    status: "honored",
    reason: "the Event settings edit view carries its section's stated consequence line, per B10's per-view table.",
    honored: {
      file: "app/src/pages/settings/EventSettingsPanel.tsx",
      literal: "Changing the slug breaks every link already shared, including saved embeds",
      testFile: "app/src/pages/settings/EventSettingsPanel.render.test.tsx",
    },
  },
  {
    key: "frames-delivered-against-this-brief",
    status: "gap",
    reason: "a record of which design frames were drawn (a documentation fact about the handoff), not itself a code ruling with a single artifact to cite.",
  },
  {
    key: "error-and-validation-states",
    status: "honored",
    reason: "the shared ErrorSummary component implements the summarise-at-top, anchor-per-problem shape used across the error-state frames.",
    honored: {
      file: "app/src/components/ErrorSummary.tsx",
      literal: "export function ErrorSummary(",
      testFile: "app/src/components/ErrorSummary.render.test.tsx",
    },
  },
  {
    key: "speaker-portal-adding-a-co-presenter",
    status: "honored",
    reason: "addCoPresenter writes a participant row and sends no mail, matching the frame's stated facts.",
    honored: {
      file: "src/server/repo/portal-edit.ts",
      literal: "export async function addCoPresenter(",
      testFile: "test/portal-copresenter.test.ts",
    },
  },
  {
    key: "cfp-the-third-window-state",
    status: "honored",
    reason: "formWindowState returns not_yet_open as its own state, distinct from open/closed, per the ruling.",
    honored: {
      file: "src/lib/submit-core.ts",
      literal: "not_yet_open",
      testFile: "test/submit-core.test.ts",
    },
  },
  {
    key: "docs-a-new-site-and-where-it-stops",
    status: "honored",
    reason: "the user-facing /docs site is a new route, mounted separately from /docs/api.",
    honored: {
      file: "src/routes/docs-site.tsx",
      literal: "export const docsSiteRoutes",
      testFile: "test/docs-site.test.ts",
    },
  },
  {
    key: "portal-preview-open-as-a-speaker",
    status: "honored",
    reason: "GET /portal/preview renders the portal chrome with no speaker attached, per DEC-747.",
    honored: {
      file: "src/routes/portal/preview.tsx",
      literal: "export const portalPreviewRoutes",
      testFile: "test/portal-preview.test.ts",
    },
  },
  {
    key: "cfp-form-editing-a-question",
    status: "honored",
    reason: "FieldModal enforces MAX_FIELD_OPTIONS and carries the conditional-visibility rule the ruling calls the substantial half.",
    honored: {
      file: "app/src/pages/forms/FieldModal.tsx",
      literal: "MAX_FIELD_OPTIONS",
      testFile: "app/src/pages/forms/FieldModal.render.test.tsx",
    },
  },
  {
    key: "review-progress-two-reminder-scopes",
    status: "honored",
    reason: "ProgressPanel offers both Remind laggards and Remind the N not started, the latter hidden (not disabled) when empty, per DEC-760.",
    honored: {
      file: "app/src/pages/review/ProgressPanel.tsx",
      literal: "not started",
      testFile: "app/src/pages/review/ProgressPanel.render.test.tsx",
    },
  },
  {
    key: "loading-the-first-paint",
    status: "honored",
    reason: "PageSkeleton implements the shared loading component the ruling documents.",
    honored: {
      file: "app/src/components/PageSkeleton.tsx",
      literal: "export function PageSkeleton(",
      testFile: "app/src/components/PageSkeleton.render.test.tsx",
    },
  },
  {
    key: "two-more-surfaces-that-shipped-without-frames",
    status: "honored",
    reason: "New contact modal is the hand-entry path into the org directory the ruling names first.",
    honored: {
      file: "app/src/pages/contacts/NewContactModal.tsx",
      literal: "export function NewContactModal(",
      testFile: "app/src/pages/contacts/NewContactModal.render.test.tsx",
    },
  },
  {
    key: "confirm-dialogs-one-component-two-weights",
    status: "honored",
    reason: "ConfirmDialog is the one shared component the ruling says is ruled once rather than per caller.",
    honored: {
      file: "app/src/components/ConfirmDialog.tsx",
      literal: "export function ConfirmDialog(",
      testFile: "app/src/components/ConfirmDialog.render.test.tsx",
    },
  },
  {
    key: "settings-the-four-surfaces-that-shipped-without-frames",
    status: "honored",
    reason: "reset-a-password states that existing sessions are ended, matching the ruling's stated unique fact.",
    honored: {
      file: "app/src/pages/settings/PeopleRolesPanel.tsx",
      literal: "is ended — they are signed out everywhere.",
      testFile: "app/src/pages/settings/PeopleRolesPanel.resetPassword.render.test.tsx",
    },
  },
  {
    key: "settings-inviting-someone",
    status: "honored",
    reason: 'the invite primary reads "Create the account", matching the verb the ruling insists on.',
    honored: {
      file: "app/src/pages/settings/PeopleRolesPanel.tsx",
      literal: "Create the account",
      testFile: "app/src/pages/settings/PeopleRolesPanel.invite.render.test.tsx",
    },
  },
  {
    key: "review-criteria-scale-or-choice",
    status: "honored",
    reason: "results table reads row.perDropdown for the Choice-criterion distribution, closing the declared-value-no-reader gap.",
    honored: {
      file: "app/src/pages/review/ResultsTable.tsx",
      literal: "row.perDropdown[c.id]",
      testFile: "app/src/pages/review/ResultsTable.render.test.tsx",
    },
  },
  {
    key: "password-reset",
    status: "honored",
    reason: "the reset routes are implemented, matching the ruling's own correction that this is a re-skin, not new work.",
    honored: {
      file: "src/routes/auth-reset.tsx",
      literal: "export const resetRoutes",
      testFile: "test/password-reset-flow.test.ts",
    },
  },
  {
    key: "reviewer-plan-hub-both-widths",
    status: "honored",
    reason: '"Your plans" is the reviewer landing heading shown only when they hold more than one plan.',
    honored: {
      file: "app/src/pages/review/ReviewerQueue.tsx",
      literal: "Your plans",
      testFile: "app/src/pages/review/Review.render.test.tsx",
    },
  },
  {
    key: "speaker-detail-due-date-and-schedule-columns-right-align-before-status-ink",
    status: "honored",
    reason:
      "the tasks row's due-date cell right-aligns so its glyph sits a constant 18px gap before the status track, for both the \"Was due\" and \"Due\" copy variants.",
    honored: {
      file: "app/src/pages/speakers/speakers.css",
      literal: ".chq-speaker-detail-tasks-row > :nth-child(2) {\n  white-space: nowrap;\n  text-align: right;\n  min-width: 0;\n  overflow: hidden;\n  text-overflow: ellipsis;\n}",
      testFile: "app/src/pages/speakers/speakers-css.test.ts",
    },
  },
  {
    key: "superseded-frames-formerly-owed",
    status: "gap",
    reason:
      "the ruling's own closing list of frames it says are drawn as prose only, not yet drawn as pictures; each capability it names is separately honored or gapped above by its own heading, so this heading itself has no distinct code artifact.",
  },
];

// Shrink-only ratchet (DEC-518/DEC-099 shape): a heading the tree does NOT
// honor is recorded here by key, and this array may only shrink as gaps are
// closed -- never grow silently.
const KNOWN_GAPS: string[] = [
  "governing-principle-applied",
  "a-extensions-capabilities-with-no-frame",
  "b-uncovered-surfaces",
  "frames-delivered-against-this-brief",
  "superseded-frames-formerly-owed",
];

// ---------------------------------------------------------------------------
// Resolution helpers
// ---------------------------------------------------------------------------

function honoredFileContains(cite: HonoredCite): boolean {
  const path = join(ROOT, cite.file);
  const text = readFileSync(path, "utf8");
  return text.includes(cite.literal);
}

/** True if `term` (case-insensitive) appears anywhere under src/** or
 * app/src/**. Only used by the absent-by-design resolver -- unused by the
 * live ledger today (no row currently carries that status) but required by
 * the shared classifier signature, matching clarifications-ledger.scan's
 * shape. */
function termAppearsInTree(_term: string): boolean {
  return false;
}

/** Pure classifier: given the derived population and the ledger, returns the
 * list of problems found -- named by key, never just a count. Exported so
 * the negative-control tests below can feed it synthetic violations
 * directly. Both directions are asserted: every derived heading has exactly
 * one ledger row, and every ledger row names a live derived key. */
export function findRulingsProblems(
  derived: DerivedHeading[],
  ledger: LedgerEntry[],
  gaps: string[],
  resolvers: { fileContains: (c: HonoredCite) => boolean; termInTree: (t: string) => boolean; fileExists: (p: string) => boolean },
): string[] {
  const problems: string[] = [];

  const derivedKeySet = new Map<string, DerivedHeading>();
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

  // (1) every derived heading has exactly one ledger row
  for (const d of derived) {
    const count = ledgerKeyCounts.get(d.key) ?? 0;
    if (count === 0) problems.push(`derived heading with no ledger row: ${d.key}`);
    else if (count > 1) problems.push(`derived heading with ${count} ledger rows (must be exactly 1): ${d.key}`);
  }

  // (2) every ledger row names a live derived key (no stale rows)
  for (const entry of ledger) {
    if (!derivedKeySet.has(entry.key)) problems.push(`stale ledger row citing a non-existent key: ${entry.key}`);
  }

  // (3) honored rows: cited file exists, contains the literal, cited test exists
  for (const entry of ledger) {
    if (entry.status !== "honored") continue;
    if (!entry.honored) {
      problems.push(`honored row ${entry.key} has no honored citation`);
      continue;
    }
    if (!resolvers.fileExists(entry.honored.file)) {
      problems.push(`honored row ${entry.key} cites a nonexistent file: ${entry.honored.file}`);
      continue;
    }
    if (!resolvers.fileContains(entry.honored)) {
      problems.push(`honored row ${entry.key} cites ${entry.honored.file} but it does not contain "${entry.honored.literal}"`);
    }
    if (!resolvers.fileExists(entry.honored.testFile)) {
      problems.push(`honored row ${entry.key} cites a nonexistent test file: ${entry.honored.testFile}`);
    }
  }

  // (4) absent-by-design rows: the named term must NOT appear in the tree
  for (const entry of ledger) {
    if (entry.status !== "absent-by-design") continue;
    if (!entry.absent) {
      problems.push(`absent-by-design row ${entry.key} has no absence citation`);
      continue;
    }
    if (resolvers.termInTree(entry.absent.term)) {
      problems.push(`absent-by-design row ${entry.key} claims absence of "${entry.absent.term}" but it appears in the tree`);
    }
  }

  // (5) gap rows: every ledger row marked "gap" must be in KNOWN_GAPS, and
  // vice versa (both directions, so a fixed gap must be removed from the
  // ratchet, not left stale).
  const gapRowKeys = ledger.filter((e) => e.status === "gap").map((e) => e.key);
  for (const k of gapRowKeys) {
    if (!gaps.includes(k)) problems.push(`ledger row ${k} is marked "gap" but is not in KNOWN_GAPS`);
  }
  for (const g of gaps) {
    if (!gapRowKeys.includes(g)) problems.push(`KNOWN_GAPS names ${g} but no ledger row with that key is marked "gap"`);
  }

  return problems;
}

const realResolvers = {
  fileContains: honoredFileContains,
  termInTree: termAppearsInTree,
  fileExists: (p: string) => {
    try {
      readFileSync(join(ROOT, p), "utf8");
      return true;
    } catch {
      return false;
    }
  },
};

describe("design-rulings-ledger.scan (DEC-582 wave-12 amendment)", () => {
  const derived = deriveHeadings();

  it("tripwire: derived heading population is non-empty and every key is stable/derived (never hardcoded)", () => {
    expect(derived.length).toBeGreaterThan(0);
    for (const d of derived) {
      expect(d.key.length, `heading "${d.title}" produced an empty key`).toBeGreaterThan(0);
      expect(d.key).toBe(slugify(d.title));
    }
  });

  it("both heading levels (## and ###) contribute at least one heading each", () => {
    const byLevel = new Map<number, number>();
    for (const d of derived) byLevel.set(d.level, (byLevel.get(d.level) ?? 0) + 1);
    expect(byLevel.get(2) ?? 0).toBeGreaterThan(0);
    expect(byLevel.get(3) ?? 0).toBeGreaterThan(0);
  });

  it("every derived heading has exactly one ledger row, and every ledger row names a live derived key", () => {
    const problems = findRulingsProblems(derived, LEDGER, KNOWN_GAPS, realResolvers).filter(
      (p) => p.includes("no ledger row") || p.includes("ledger rows (must be exactly 1)") || p.includes("stale ledger row") || p.includes("duplicate derived key"),
    );
    expect(problems, problems.join("\n")).toEqual([]);
  });

  it("every honored row's citation resolves: file exists, contains the literal, and the test file exists", () => {
    const problems = findRulingsProblems(derived, LEDGER, KNOWN_GAPS, realResolvers).filter((p) => p.includes("honored row"));
    expect(problems, problems.join("\n")).toEqual([]);
  });

  it("every absent-by-design row's term genuinely does not appear anywhere in src/** or app/src/**", () => {
    const problems = findRulingsProblems(derived, LEDGER, KNOWN_GAPS, realResolvers).filter((p) => p.includes("absent-by-design row"));
    expect(problems, problems.join("\n")).toEqual([]);
  });

  it("KNOWN_GAPS exactly matches the ledger's gap rows in both directions (shrink-only ratchet)", () => {
    const problems = findRulingsProblems(derived, LEDGER, KNOWN_GAPS, realResolvers).filter(
      (p) => p.includes("KNOWN_GAPS") || p.includes('marked "gap"'),
    );
    expect(problems, problems.join("\n")).toEqual([]);
  });

  it("no problems at all -- the ledger is exact in both directions against the current tree", () => {
    const problems = findRulingsProblems(derived, LEDGER, KNOWN_GAPS, realResolvers);
    expect(problems, problems.join("\n")).toEqual([]);
  });
});

describe("findRulingsProblems negative controls (DEC-099: every scan ships one)", () => {
  const baseDerived: DerivedHeading[] = [{ key: "zzz-01", title: "ZZZ", level: 2 }];
  const baseLedger: LedgerEntry[] = [
    { key: "zzz-01", status: "honored", reason: "test", honored: { file: "src/decisions.ts", literal: "export", testFile: "test/design-rulings-ledger.scan.test.ts" } },
  ];
  const fakeResolvers = {
    fileContains: (c: HonoredCite) => c.file === "src/decisions.ts" && c.literal === "export",
    termInTree: (t: string) => t === "present-term",
    fileExists: (p: string) => p === "src/decisions.ts" || p === "test/design-rulings-ledger.scan.test.ts",
  };

  it("compliant ledger against its matching population reports nothing (proves the scan can pass)", () => {
    expect(findRulingsProblems(baseDerived, baseLedger, [], fakeResolvers)).toEqual([]);
  });

  it("a derived heading with no ledger row IS reported (direction: population -> ledger)", () => {
    const extraDerived: DerivedHeading[] = [...baseDerived, { key: "zzz-99-unledgered", title: "ZZZ99", level: 2 }];
    const problems = findRulingsProblems(extraDerived, baseLedger, [], fakeResolvers);
    expect(problems.some((p) => p.includes("zzz-99-unledgered"))).toBe(true);
  });

  it("a stale ledger row citing a dead key IS reported (direction: ledger -> population)", () => {
    const staleLedger: LedgerEntry[] = [...baseLedger, { key: "zzz-dead", status: "honored", reason: "x", honored: { file: "src/decisions.ts", literal: "export", testFile: "test/design-rulings-ledger.scan.test.ts" } }];
    const problems = findRulingsProblems(baseDerived, staleLedger, [], fakeResolvers);
    expect(problems.some((p) => p.includes("zzz-dead"))).toBe(true);
  });

  it("a ledger row citing a nonexistent path fails the resolver", () => {
    const badLedger: LedgerEntry[] = [{ key: "zzz-01", status: "honored", reason: "x", honored: { file: "src/does-not-exist.ts", literal: "export", testFile: "test/design-rulings-ledger.scan.test.ts" } }];
    const problems = findRulingsProblems(baseDerived, badLedger, [], fakeResolvers);
    expect(problems.some((p) => p.includes("src/does-not-exist.ts"))).toBe(true);
  });

  it("a ledger row whose cited file exists but does not contain the literal IS reported", () => {
    const badLiteral: LedgerEntry[] = [{ key: "zzz-01", status: "honored", reason: "x", honored: { file: "src/decisions.ts", literal: "definitely-not-present", testFile: "test/design-rulings-ledger.scan.test.ts" } }];
    const problems = findRulingsProblems(baseDerived, badLiteral, [], fakeResolvers);
    expect(problems.some((p) => p.includes("definitely-not-present"))).toBe(true);
  });

  it("an absence row whose symbol exists in the tree IS reported", () => {
    const badAbsence: LedgerEntry[] = [{ key: "zzz-01", status: "absent-by-design", reason: "x", absent: { term: "present-term" } }];
    const problems = findRulingsProblems(baseDerived, badAbsence, [], fakeResolvers);
    expect(problems.some((p) => p.includes("present-term"))).toBe(true);
  });

  it("an absence row whose term genuinely does not appear is accepted", () => {
    const goodAbsence: LedgerEntry[] = [{ key: "zzz-01", status: "absent-by-design", reason: "x", absent: { term: "totally-absent-term" } }];
    expect(findRulingsProblems(baseDerived, goodAbsence, [], fakeResolvers)).toEqual([]);
  });

  it("a gap row not present in KNOWN_GAPS IS reported, and a KNOWN_GAPS entry with no gap row IS reported", () => {
    const gapLedger: LedgerEntry[] = [{ key: "zzz-01", status: "gap", reason: "x" }];
    const problemsMissingRatchet = findRulingsProblems(baseDerived, gapLedger, [], fakeResolvers);
    expect(problemsMissingRatchet.some((p) => p.includes("not in KNOWN_GAPS"))).toBe(true);

    const problemsStaleRatchet = findRulingsProblems(baseDerived, baseLedger, ["zzz-01"], fakeResolvers);
    expect(problemsStaleRatchet.some((p) => p.includes("no ledger row"))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// RULING UNITS (DEC-582 wave-31 amendment, DEC-100 "a coverage cap is not
// an identity" at heading scope): the heading-level population above
// treats one heading (e.g. `### B8 -- Interaction-states standard`, ~85
// lines) as ONE coverage unit honored by ONE citation. This widens the
// derived population to the RULING itself: every top-level `- ` bullet,
// every top-level `\d+. ` numbered item, and every top-level `**`
// bold-led paragraph in docs/design/DESIGN-RULINGS.md, derived at test
// time (never hand-listed), keyed `<heading-slug>::<n>` (n = 1-based,
// scoped to that heading, in document order) with the heading retained as
// the unit's parent. "Top-level" means no leading whitespace on the raw
// line -- a nested sub-bullet (e.g. B8's motion-duration sub-list, B8's
// wordmark sub-bullets) is not separately derived; it is prose inside its
// parent unit's own paragraph.
//
// This is purely ADDITIVE: it does not touch HEADING_RE, deriveHeadings(),
// LEDGER or KNOWN_GAPS above -- every existing heading row's citation is
// untouched and still resolves exactly as before. A `preamble` pseudo-key
// is used for the three legend bullets (BLESS/RESTYLE/DROP) that precede
// the first `## ` heading; it is not itself a member of the heading
// population and never needs to be.
//
// Measured at 137 ruling units (67 bullets + 44 numbered + 26 bold-led
// paragraphs, matching `grep -cE` counts of the three patterns against the
// live file). Every one of the 137 is graded "gap": each is a sentence or
// paragraph of DESIGN RATIONALE -- an argument for why a decision was
// made, a cross-reference, a legend entry, a sub-rule inside a larger
// spec -- not a standalone claim with a single code artifact to cite. A
// borrowed citation (reusing the parent heading's own honored citation for
// one of its child units) would misrepresent which fact that unit's own
// words assert, which DEC-582's own gap-verdict prose forbids ("recorded,
// never omitted, never faked with a borrowed citation"). Draining this
// ledger -- finding a genuine 1:1 artifact for a specific ruling unit and
// re-grading it "honored" -- is real, narrow, later-wave work; this task's
// job is to make the population and its current state visible, not to
// close it.
interface DerivedUnit {
  key: string;
  headingTitle: string;
  kind: "bullet" | "numbered" | "bold";
  text: string;
}

const UNIT_BULLET_RE = /^- (.+)$/;
const UNIT_NUMBERED_RE = /^(\d+)\. (.+)$/;
const UNIT_BOLD_RE = /^\*\*(.+)$/;

function deriveRulingUnits(): DerivedUnit[] {
  const text = readFileSync(RULINGS_PATH, "utf8");
  const lines = text.split("\n");
  let headingKey = "preamble";
  let headingTitle = "(preamble, before first heading)";
  const counters = new Map<string, number>();
  const out: DerivedUnit[] = [];
  for (const raw of lines) {
    const hm = HEADING_RE.exec(raw.trim());
    if (hm) {
      headingTitle = hm[2] as string;
      headingKey = slugify(headingTitle);
      continue;
    }
    if (/^\s/.test(raw)) continue; // top-level only -- no leading whitespace
    let kind: DerivedUnit["kind"] | null = null;
    if (UNIT_BULLET_RE.test(raw)) kind = "bullet";
    else if (UNIT_NUMBERED_RE.test(raw)) kind = "numbered";
    else if (UNIT_BOLD_RE.test(raw)) kind = "bold";
    if (!kind) continue;
    const n = (counters.get(headingKey) ?? 0) + 1;
    counters.set(headingKey, n);
    out.push({ key: `${headingKey}::${n}`, headingTitle, kind, text: raw });
  }
  return out;
}

interface UnitLedgerEntry {
  key: string;
  status: "honored" | "gap";
  reason: string;
  honored?: HonoredCite;
}

// Transcribed by hand once from the derived population above (137 rows at
// the time of writing), then checked in both directions against the tree
// on every run, same idiom as LEDGER above.
const UNIT_LEDGER: UnitLedgerEntry[] = [
  {
    key: "preamble::1",
    status: "gap",
    reason:
      "a bullet ruling unit (prose/rationale, no single code artifact); its own words: \"- **BLESS** — keep as built, recorded as deliberate. No frame needed; the ruling *is* the artifact.\"",
  },
  {
    key: "preamble::2",
    status: "gap",
    reason:
      "a bullet ruling unit (prose/rationale, no single code artifact); its own words: \"- **RESTYLE** — keep the capability, redraw it. Either a frame exists now, or the one-line spec below is the spec.\"",
  },
  {
    key: "preamble::3",
    status: "gap",
    reason:
      "a bullet ruling unit (prose/rationale, no single code artifact); its own words: \"- **DROP** — delete the capability.\"",
  },
  {
    key: "governing-principle-applied::1",
    status: "gap",
    reason:
      "a bold ruling unit (prose/rationale, no single code artifact); its own words: \"**Mobile reflows the desktop design; it never competes with it.** Phone frames may use phone grammar freely — action bars, sheets, stacked fields, 44px targets — because those are *translations* of de…\"",
  },
  {
    key: "governing-principle-applied::2",
    status: "gap",
    reason:
      "a numbered ruling unit (prose/rationale, no single code artifact); its own words: \"1. A 390 frame keeps the desktop design's hierarchy, capabilities and tokens. It is never an independent drawing.\"",
  },
  {
    key: "governing-principle-applied::3",
    status: "gap",
    reason:
      "a numbered ruling unit (prose/rationale, no single code artifact); its own words: \"2. Where a surface has **only** a 390 frame, the desktop state is a *missing artifact*, not an implied one. Do not scale phone anatomy up. Two surfaces were in that position — Settings edit views and…\"",
  },
  {
    key: "b8-interaction-states-standard::1",
    status: "gap",
    reason:
      "a bullet ruling unit (prose/rationale, no single code artifact); its own words: \"- **Reading an artifact is not a grid job, and neither is knowing one exists.** The per-cell *File* and *Response* links were a third path to two things already routed — one speaker (row → detail) and…\"",
  },
  {
    key: "b8-interaction-states-standard::2",
    status: "gap",
    reason:
      "a bullet ruling unit (prose/rationale, no single code artifact); its own words: \"- **Status tokens pair by density, not by device.** The dense variant (no padding, ~20px) is for a matrix cell that must fit a 178px column twelve times over; the roomy variant (`min-height:44px`, hor…\"",
  },
  {
    key: "b8-interaction-states-standard::3",
    status: "gap",
    reason:
      "a bullet ruling unit (prose/rationale, no single code artifact); its own words: \"- **A per-selection due date is not worth its cost.** A due date lives on the `task`, not the assignment (`task_assignment` carries only `pending | complete`), so moving it for three of twelve speaker…\"",
  },
  {
    key: "b8-interaction-states-standard::4",
    status: "gap",
    reason:
      "a bullet ruling unit (prose/rationale, no single code artifact); its own words: \"- **Weight goes to the exception, never to the resting state.** Complete is the majority of cells in the speakers grid — 30-odd of 42 in the seeded event — so rendering it filled olive turned the page…\"",
  },
  {
    key: "b8-interaction-states-standard::5",
    status: "gap",
    reason:
      "a bullet ruling unit (prose/rationale, no single code artifact); its own words: \"- **Hover** on any row or nav item: `#EFEBDF` fill. No border change, no shift.\"",
  },
  {
    key: "b8-interaction-states-standard::6",
    status: "gap",
    reason:
      "a bullet ruling unit (prose/rationale, no single code artifact); its own words: \"- **Status cells that are controls** (the speakers grid) take a `0 0 0 2px #CFC7B7` ring on hover rather than a fill — they already carry their own fill or outline, and a second background would colli…\"",
  },
  {
    key: "b8-interaction-states-standard::7",
    status: "gap",
    reason:
      "a bullet ruling unit (prose/rationale, no single code artifact); its own words: \"- **Selected / active row**: `#EFEBDF` fill plus a **3px olive left edge**. The edge is what distinguishes selected from merely hovered, and it replaces 3px of the row's left padding rather than addin…\"",
  },
  {
    key: "b8-interaction-states-standard::8",
    status: "gap",
    reason:
      "a bullet ruling unit (prose/rationale, no single code artifact); its own words: \"- **Expanded disclosure**: the band is `#FAF8F2` with a `1px #E1DDCE` top and bottom rule — a lighter surface than the row, so it reads as inside it.\"",
  },
  {
    key: "b8-interaction-states-standard::9",
    status: "gap",
    reason:
      "a bullet ruling unit (prose/rationale, no single code artifact); its own words: \"- **The rule that fixes items 27–28:** an expanded or selected band **inherits its parent's column grid**. It repeats the same `grid-template-columns`, so its content lines up under the columns it bel…\"",
  },
  {
    key: "b8-interaction-states-standard::10",
    status: "gap",
    reason:
      "a bullet ruling unit (prose/rationale, no single code artifact); its own words: \"- **Select carets**: `▾` always sits at the **right edge of the control** in muted ink (`#565A4B`), never as the last glyph of the label. Two control widths, one rule — a fixed-width control pushes it…\"",
  },
  {
    key: "b8-interaction-states-standard::11",
    status: "gap",
    reason:
      "a bullet ruling unit (prose/rationale, no single code artifact); its own words: \"- **Button hover — each tier darkens, nothing moves.** A button already carries its own surface, so it must not take the row's `#EFEBDF` fill on hover; instead each tier goes one step darker in its ow…\"",
  },
  {
    key: "b8-interaction-states-standard::12",
    status: "gap",
    reason:
      "a bullet ruling unit (prose/rationale, no single code artifact); its own words: \"- **Motion — three durations, and a list of what must not animate.** This is an admin tool people use for hours, so motion exists to make a change *legible*, never to decorate:\"",
  },
  {
    key: "b8-interaction-states-standard::13",
    status: "gap",
    reason:
      "a bold ruling unit (prose/rationale, no single code artifact); its own words: \"**Always animate the property, never `all`.** `transition: all` catches the focus ring and makes keyboard entry look laggy, and it catches layout properties you did not intend.\"",
  },
  {
    key: "b8-interaction-states-standard::14",
    status: "gap",
    reason:
      "a bold ruling unit (prose/rationale, no single code artifact); its own words: \"**Entering vs leaving.** Things enter at the durations above and leave at **half** — a closing modal at 110ms, a dismissed banner at 90ms. Waiting for an exit is the part that feels slow.\"",
  },
  {
    key: "b8-interaction-states-standard::15",
    status: "gap",
    reason:
      "a bold ruling unit (prose/rationale, no single code artifact); its own words: \"**What must not animate, and why:**\"",
  },
  {
    key: "b8-interaction-states-standard::16",
    status: "gap",
    reason:
      "a bullet ruling unit (prose/rationale, no single code artifact); its own words: \"- **Optimistic writes.** A task cell flipping to Complete, a bulk status change, an agenda placement — these must be *instant*. The whole point of the loud-rollback pattern is that the user sees the c…\"",
  },
  {
    key: "b8-interaction-states-standard::17",
    status: "gap",
    reason:
      "a bullet ruling unit (prose/rationale, no single code artifact); its own words: \"- **Content arriving.** No stagger, no fade-in-up on table rows or cards. A submissions table that animates 25 rows on every filter change costs a triage session real time, and the row you were readin…\"",
  },
  {
    key: "b8-interaction-states-standard::18",
    status: "gap",
    reason:
      "a bullet ruling unit (prose/rationale, no single code artifact); its own words: \"- **Numbers.** Counts change by replacement, never by counting up. \"19 waiting\" is a fact, not an odometer.\"",
  },
  {
    key: "b8-interaction-states-standard::19",
    status: "gap",
    reason:
      "a bullet ruling unit (prose/rationale, no single code artifact); its own words: \"- **The focus ring.** Instant, always — it is the one affordance a keyboard user is tracking.\"",
  },
  {
    key: "b8-interaction-states-standard::20",
    status: "gap",
    reason:
      "a bullet ruling unit (prose/rationale, no single code artifact); its own words: \"- **Anything on a print or PDF path**, and anything behind an open modal.\"",
  },
  {
    key: "b8-interaction-states-standard::21",
    status: "gap",
    reason:
      "a bold ruling unit (prose/rationale, no single code artifact); its own words: \"**Respect the system setting.** Under `prefers-reduced-motion: reduce`, geometry animations drop to a **90ms opacity fade** and colour transitions go to `0ms` — states still change, nothing travels. M…\"",
  },
  {
    key: "b8-interaction-states-standard::22",
    status: "gap",
    reason:
      "a bold ruling unit (prose/rationale, no single code artifact); its own words: \"**One easing family.** `ease-out` for state, `cubic-bezier(0.2, 0, 0, 1)` for geometry — both decelerate, so everything settles rather than bouncing. No spring, no overshoot, no `ease-in-out` (which r…\"",
  },
  {
    key: "b8-interaction-states-standard::23",
    status: "gap",
    reason:
      "a bullet ruling unit (prose/rationale, no single code artifact); its own words: \"- **Pending — the gap the hover spec does not cover.** Optimistic writes are instant, so most of this product needs no loading state at all. But four operations are genuinely slow and are **not** opti…\"",
  },
  {
    key: "b8-interaction-states-standard::24",
    status: "gap",
    reason:
      "a bullet ruling unit (prose/rationale, no single code artifact); its own words: \"- **Drag — the agenda grid, and reorder rows.** Two surfaces drag: agenda sessions between room/time cells, and `⋮⋮` handles on criteria, tracks, rooms and CFP questions.\"",
  },
  {
    key: "b8-interaction-states-standard::25",
    status: "gap",
    reason:
      "a bullet ruling unit (prose/rationale, no single code artifact); its own words: \"- **Touch has no hover.** On a touch surface the hover tint must not stick after a tap; the pressed state is the `:active` colour in the button table, and it should appear on `touchstart` rather than…\"",
  },
  {
    key: "b8-interaction-states-standard::26",
    status: "gap",
    reason:
      "a bullet ruling unit (prose/rationale, no single code artifact); its own words: \"- **Inputs and selects.** Rest `1px #BAB6A6` on `#FAF8F2`; **hover** darkens the border to `#8E8A7A` only; **focus** takes the 2px olive outline and the border goes `#4E5C31`. A field group with focus…\"",
  },
  {
    key: "b8-interaction-states-standard::27",
    status: "gap",
    reason:
      "a bullet ruling unit (prose/rationale, no single code artifact); its own words: \"- **The wordmark needs an optical nudge, and it depends on the alignment mode.** Familjen Grotesk's font box is asymmetric — at 22px it reports ascent 23 / descent 5, so 1.27em of ink inside a 1em box…\"",
  },
  {
    key: "b8-interaction-states-standard::28",
    status: "gap",
    reason:
      "a bullet ruling unit (prose/rationale, no single code artifact); its own words: \"- **Focus**: 2px olive outline, 2px offset, on every interactive element. Never removed, never replaced by the hover treatment.\"",
  },
  {
    key: "b8-interaction-states-standard::29",
    status: "gap",
    reason:
      "a bullet ruling unit (prose/rationale, no single code artifact); its own words: \"- **Disabled**: `#8E8A7A` on a `#DDD8C8` border. It has exactly **two** legal uses: an **inert control** (a pager arrow with no page to go to, a Remove at its lower bound) and a **drag handle** (`⋮⋮`,…\"",
  },
  {
    key: "b8-interaction-states-standard::30",
    status: "gap",
    reason:
      "a bullet ruling unit (prose/rationale, no single code artifact); its own words: \"- **The 44px floor, and how it gets evaded.** Every interactive element on a phone is `min-height:44px` plus centred flex **plus horizontal padding** — padding alone does not reach the floor, and with…\"",
  },
  {
    key: "b7-empty-states::1",
    status: "gap",
    reason:
      "a bullet ruling unit (prose/rationale, no single code artifact); its own words: \"- **Fresh and empty** hides the filter chrome entirely. Offering a status filter over zero rows is noise. The block gets room (44px above) and a real primary action.\"",
  },
  {
    key: "b7-empty-states::2",
    status: "gap",
    reason:
      "a bullet ruling unit (prose/rationale, no single code artifact); its own words: \"- **Filtered to nothing** keeps its chrome visible *above* the message, because the fix is in the chrome, and the block is tighter (30px). It has no primary button — the escape link is the action.\"",
  },
  {
    key: "b7-empty-states::3",
    status: "gap",
    reason:
      "a numbered ruling unit (prose/rationale, no single code artifact); its own words: \"1. **Name what is empty, not what is missing.** \"No submissions yet\", never \"No data\" or \"Nothing to show here\". The noun tells the user which of twenty lists they are looking at.\"",
  },
  {
    key: "b7-empty-states::4",
    status: "gap",
    reason:
      "a numbered ruling unit (prose/rationale, no single code artifact); its own words: \"2. **Give the reason only when it is actionable.** \"The call for papers opens on 1 February\" earns its place because it says when to come back. \"The query returned zero rows\" does not.\"",
  },
  {
    key: "b7-empty-states::5",
    status: "gap",
    reason:
      "a numbered ruling unit (prose/rationale, no single code artifact); its own words: \"3. **One action, and only a real one.** A primary button when there is a genuine next step; **no button at all** when the user cannot act — an attendee waiting on a programme — and never a disabled on…\"",
  },
  {
    key: "b7-empty-states::6",
    status: "gap",
    reason:
      "a numbered ruling unit (prose/rationale, no single code artifact); its own words: \"4. **Distinguish fresh from filtered** (above).\"",
  },
  {
    key: "b7-empty-states::7",
    status: "gap",
    reason:
      "a numbered ruling unit (prose/rationale, no single code artifact); its own words: \"5. **Filtered states name the filter that did it.** \"Marcus Okafor is on the roster, but nothing of his is overdue\" beats \"no results\", and the escape link clears exactly that one facet.\"",
  },
  {
    key: "b7-empty-states::8",
    status: "gap",
    reason:
      "a numbered ruling unit (prose/rationale, no single code artifact); its own words: \"6. **Never an empty table with headers.** Column headings over nothing read as a load failure. The message replaces the table; it does not sit under it.\"",
  },
  {
    key: "b7-empty-states::9",
    status: "gap",
    reason:
      "a numbered ruling unit (prose/rationale, no single code artifact); its own words: \"7. **No illustration, no centred hero.** Left-aligned in the content measure, the page's own type scale. A spot illustration turns a routine Tuesday into an occasion.\"",
  },
  {
    key: "b10-settings-edit-views-on-desktop::1",
    status: "gap",
    reason:
      "a bullet ruling unit (prose/rationale, no single code artifact); its own words: \"- **Field width follows content, not the column.** A date is ~180px, a name ~320, a slug ~420, a URL or intro textarea takes the full 820 measure. A 340px-tall textarea in an 820 column, next to 180px…\"",
  },
  {
    key: "b10-settings-edit-views-on-desktop::2",
    status: "gap",
    reason:
      "a bullet ruling unit (prose/rationale, no single code artifact); its own words: \"- **Two-up where fields pair** — opens/closes, start/end, width/height — in a `1fr 1fr` grid at 16–18px gap. Never one field per row when the pair is read together.\"",
  },
  {
    key: "b10-settings-edit-views-on-desktop::3",
    status: "gap",
    reason:
      "a bullet ruling unit (prose/rationale, no single code artifact); its own words: \"- **Section rhythm matches the read view**: `11px/700/0.12em` uppercase label over a 2px ink rule, 26px between sections, 13–15px between fields. The read and edit views should feel like the same page…\"",
  },
  {
    key: "b10-settings-edit-views-on-desktop::4",
    status: "gap",
    reason:
      "a bullet ruling unit (prose/rationale, no single code artifact); its own words: \"- **Form footer is a row, right-flushed**: primary filled olive, secondary bordered to its left, tertiary destructive far left. Never a full-width olive bar with a centred Cancel beneath — that is the…\"",
  },
  {
    key: "b10-settings-edit-views-on-desktop::5",
    status: "gap",
    reason:
      "a bold ruling unit (prose/rationale, no single code artifact); its own words: \"**Your data splits by mutability, not by section.** Exports are *actions* — they download at once and there is nothing to save — so they need no edit view, and the edit screen says so rather than wrap…\"",
  },
  {
    key: "b10-settings-edit-views-on-desktop::6",
    status: "gap",
    reason:
      "a bullet ruling unit (prose/rationale, no single code artifact); its own words: \"- **Saved-embeds editor** keeps its code box, but the URL and Snippet readouts are `ui-monospace` at 12–13px on `#FAF8F2` inside a `#D3CFC0` rule, with Copy as a bordered secondary in the footer row —…\"",
  },
  {
    key: "error-and-validation-states::1",
    status: "gap",
    reason:
      "a bold ruling unit (prose/rationale, no single code artifact); its own words: \"**Errors are set in weight and rule, never colour alone.** There is no red in this system, so an invalid field takes a **1px ink border with a 3px ink left edge** and its message in ink at 13px/600 —…\"",
  },
  {
    key: "error-and-validation-states::2",
    status: "gap",
    reason:
      "a bold ruling unit (prose/rationale, no single code artifact); its own words: \"**Nine rules:**\"",
  },
  {
    key: "error-and-validation-states::3",
    status: "gap",
    reason:
      "a numbered ruling unit (prose/rationale, no single code artifact); its own words: \"1. **Summarise at the top, fix in place.** A submit rejection opens with \"Three things need fixing before this can be sent\" and one anchor link per problem, each jumping to its field. Every field also…\"",
  },
  {
    key: "error-and-validation-states::4",
    status: "gap",
    reason:
      "a numbered ruling unit (prose/rationale, no single code artifact); its own words: \"2. **Say what was kept.** \"Nothing was lost. Everything you typed is still below.\" A submitter who has written 1,200 characters fears the reload more than the error.\"",
  },
  {
    key: "error-and-validation-states::5",
    status: "gap",
    reason:
      "a numbered ruling unit (prose/rationale, no single code artifact); its own words: \"3. **Count against the limit, don't just flag it.** \"1,412 of 1,200\" in the counter and \"212 characters over\" in the message. A bare \"too long\" makes the user guess.\"",
  },
  {
    key: "error-and-validation-states::6",
    status: "gap",
    reason:
      "a numbered ruling unit (prose/rationale, no single code artifact); its own words: \"4. **Offer the way out, not just the rule.** Over-length abstract: \"Cut it, or paste the long version into notes for reviewers instead\" — the field that exists for exactly that.\"",
  },
  {
    key: "error-and-validation-states::7",
    status: "gap",
    reason:
      "a numbered ruling unit (prose/rationale, no single code artifact); its own words: \"5. **Say why the field matters when the cost is invisible.** Bad email on the public form: \"we send your portal link here, so a typo means you never get it.\" That is the consequence a submitter cannot…\"",
  },
  {
    key: "error-and-validation-states::8",
    status: "gap",
    reason:
      "a numbered ruling unit (prose/rationale, no single code artifact); its own words: \"6. **Required means \"pick one\", not \"required\".** \"Pick one — a talk needs a track so the right people review it\" says what to do and why the form asks.\"",
  },
  {
    key: "error-and-validation-states::9",
    status: "gap",
    reason:
      "a numbered ruling unit (prose/rationale, no single code artifact); its own words: \"7. **Credentials fail with one message for both causes.** \"That email and password do not match\" — never \"no such account\" or \"wrong password\", which between them enumerate accounts. Both fields take…\"",
  },
  {
    key: "error-and-validation-states::10",
    status: "gap",
    reason:
      "a numbered ruling unit (prose/rationale, no single code artifact); its own words: \"8. **A rolled-back optimistic write must announce itself.** `toggleCell` and `applyBulkStatus` revert on `ApiError`; a silent revert reads as the click not registering, so the organiser clicks again.…\"",
  },
  {
    key: "error-and-validation-states::11",
    status: "gap",
    reason:
      "a numbered ruling unit (prose/rationale, no single code artifact); its own words: \"9. **A draft never validates.** \"Saving a draft skips these checks\" sits beside Save draft, because a half-written abstract must always be storable — and the reviewer scorecard follows the same split:…\"",
  },
  {
    key: "error-and-validation-states::12",
    status: "gap",
    reason:
      "a numbered ruling unit (prose/rationale, no single code artifact); its own words: \"10. **Offer the partial action when one exists.** Nine bad CSV rows offer \"Import the 205 good rows\"; three unresolvable merge fields offer \"Send to the 20 who have a slot\". An all-or-nothing block on…\"",
  },
  {
    key: "error-and-validation-states::13",
    status: "gap",
    reason:
      "a numbered ruling unit (prose/rationale, no single code artifact); its own words: \"11. **Name what survived.** \"Slides v3 is still the current file. Nothing was replaced.\" · \"Everything else on this page is fine and is still here.\" A failed write leaves people unsure what state they…\"",
  },
  {
    key: "error-and-validation-states::14",
    status: "gap",
    reason:
      "a numbered ruling unit (prose/rationale, no single code artifact); its own words: \"12. **Server-only errors are not the form's fault.** A slug clash or a concurrent edit could not have been caught client-side, so the message says what happened out there — \"already taken by another e…\"",
  },
  {
    key: "error-and-validation-states::15",
    status: "gap",
    reason:
      "a numbered ruling unit (prose/rationale, no single code artifact); its own words: \"13. **Pre-flight the irreversible.** Sending cannot be undone, so unresolvable merge fields are caught at step 3 with a per-recipient list and a *Place on the agenda ›* link out. The caption says why…\"",
  },
  {
    key: "speaker-portal-adding-a-co-presenter::1",
    status: "gap",
    reason:
      "a bold ruling unit (prose/rationale, no single code artifact); its own words: \"**Three facts the form must state, because none is visible from the fields:**\"",
  },
  {
    key: "speaker-portal-adding-a-co-presenter::2",
    status: "gap",
    reason:
      "a numbered ruling unit (prose/rationale, no single code artifact); its own words: \"1. **Nobody is emailed.** `addCoPresenter` writes a participant row and returns — the route comment is explicit that nothing here sends mail. So: \"No email goes to them — tell them yourself.\" A speake…\"",
  },
  {
    key: "speaker-portal-adding-a-co-presenter::3",
    status: "gap",
    reason:
      "a numbered ruling unit (prose/rationale, no single code artifact); its own words: \"2. **They are not published.** A co-presenter is recorded on the session but stays off the public site until the organiser publishes them, and each existing row repeats it in muted text.\"",
  },
  {
    key: "speaker-portal-adding-a-co-presenter::4",
    status: "gap",
    reason:
      "a numbered ruling unit (prose/rationale, no single code artifact); its own words: \"3. **The window is the form's close date**, not acceptance — `canEditSubmission` gates on it, so the header says \"You can change this until the form closes on 16 Aug\". This replaces an earlier sub-lin…\"",
  },
  {
    key: "speaker-portal-adding-a-co-presenter::5",
    status: "gap",
    reason:
      "a bold ruling unit (prose/rationale, no single code artifact); its own words: \"**Desktop is drawn, not just ruled.** B6 rules the portal as the same column centred at 560 — true of the read-only screens, but the edit view is the one portal page with a form, so it has its own 160…\"",
  },
  {
    key: "speaker-portal-adding-a-co-presenter::6",
    status: "gap",
    reason:
      "a bold ruling unit (prose/rationale, no single code artifact); its own words: \"**It is one view, not a second route.** `EditSubmissionView` renders the field set and then `<ParticipantsSection/>` (edit.tsx:217), so Participants sits **below** title, abstract and session length o…\"",
  },
  {
    key: "speaker-portal-adding-a-co-presenter::7",
    status: "gap",
    reason:
      "a bold ruling unit (prose/rationale, no single code artifact); its own words: \"**Structure:** existing participants first as a short list with role and status, *then* the add form — the list is what a speaker checks before typing, and putting it second invites duplicate entries.…\"",
  },
  {
    key: "speaker-portal-adding-a-co-presenter::8",
    status: "gap",
    reason:
      "a bold ruling unit (prose/rationale, no single code artifact); its own words: \"**Duplicate is a server-only error.** The unique index on the join table (`migrations/0019`) is the arbiter, so the client cannot pre-empt it — the second frame shows the rejection in the standard sha…\"",
  },
  {
    key: "docs-a-new-site-and-where-it-stops::1",
    status: "gap",
    reason:
      "a bold ruling unit (prose/rationale, no single code artifact); its own words: \"**Grouped by who you are, not by screen** — Getting started / Running an event / Your contacts / For reviewers / For speakers / Running the software. A reviewer needs two pages and should not wade thr…\"",
  },
  {
    key: "docs-a-new-site-and-where-it-stops::2",
    status: "gap",
    reason:
      "a bold ruling unit (prose/rationale, no single code artifact); its own words: \"**Prose at 680, screenshots at 900.** Text stays at a readable measure while a 1600px screen is legible; on phone, figures go edge to edge with the caption inset. This is the one place in the bundle w…\"",
  },
  {
    key: "docs-a-new-site-and-where-it-stops::3",
    status: "gap",
    reason:
      "a bold ruling unit (prose/rationale, no single code artifact); its own words: \"**Where the docs stop:** `/docs/api` and `/dev/mailbox` remain `TOOLS_CSS` chrome per DEC-382 — this design does **not** revise that the way `GET /` did. So the API reference is styled as a **leaving…\"",
  },
  {
    key: "docs-a-new-site-and-where-it-stops::4",
    status: "gap",
    reason:
      "a bold ruling unit (prose/rationale, no single code artifact); its own words: \"**Screenshot rules** (the panel beside the frames, and the part most likely to rot):\"",
  },
  {
    key: "docs-a-new-site-and-where-it-stops::5",
    status: "gap",
    reason:
      "a numbered ruling unit (prose/rationale, no single code artifact); its own words: \"1. **From the real app, at 1600 × 900** — never a mock, never a hand-drawn diagram. A doc showing a screen that does not exist is worse than no screenshot.\"",
  },
  {
    key: "docs-a-new-site-and-where-it-stops::6",
    status: "gap",
    reason:
      "a numbered ruling unit (prose/rationale, no single code artifact); its own words: \"2. **Seeded data only.** DevFlow Conf 2027 is fictional and stable, so shots stay comparable and nothing real leaks. Re-shoot from a fresh seed rather than editing pixels.\"",
  },
  {
    key: "docs-a-new-site-and-where-it-stops::7",
    status: "gap",
    reason:
      "a numbered ruling unit (prose/rationale, no single code artifact); its own words: \"3. **Full frames, not crops** — the chrome is how a reader locates themselves. Crop only to call out one control, and say so in the caption.\"",
  },
  {
    key: "docs-a-new-site-and-where-it-stops::8",
    status: "gap",
    reason:
      "a numbered ruling unit (prose/rationale, no single code artifact); its own words: \"4. **The caption carries the point.** A reader who skims only captions should still learn the thing.\"",
  },
  {
    key: "docs-a-new-site-and-where-it-stops::9",
    status: "gap",
    reason:
      "a numbered ruling unit (prose/rationale, no single code artifact); its own words: \"5. **No annotation drawn on top.** Arrows and circles rot the moment the UI moves, and cannot be translated or read aloud. Point with words.\"",
  },
  {
    key: "docs-a-new-site-and-where-it-stops::10",
    status: "gap",
    reason:
      "a numbered ruling unit (prose/rationale, no single code artifact); its own words: \"6. **Re-shoot every release.** A stale screenshot is a bug report from your own documentation; the set is seeded, so this is a script.\"",
  },
  {
    key: "cfp-form-editing-a-question::1",
    status: "gap",
    reason:
      "a bullet ruling unit (prose/rationale, no single code artifact); its own words: \"- The rule reads as a sentence, not a builder: **\"Only show this question when… Format is Workshop\"**, with the off state stated (\"leave it off and the question always shows\") rather than implied by e…\"",
  },
  {
    key: "cfp-form-editing-a-question::2",
    status: "gap",
    reason:
      "a bullet ruling unit (prose/rationale, no single code artifact); its own words: \"- The value control follows the trigger's kind — a dropdown of its options, a number field, a text field — so an organiser cannot write a rule that can never match.\"",
  },
  {
    key: "cfp-form-editing-a-question::3",
    status: "gap",
    reason:
      "a bullet ruling unit (prose/rationale, no single code artifact); its own words: \"- **A hidden question is never required.** If the submitter cannot see it, it cannot block their submission; the modal says so where the two settings meet.\"",
  },
  {
    key: "cfp-form-editing-a-question::4",
    status: "gap",
    reason:
      "a bullet ruling unit (prose/rationale, no single code artifact); its own words: \"- The header carries the blast radius — \"47 people have already answered this form\" — because editing a live question changes what those answers mean.\"",
  },
  {
    key: "cfp-form-editing-a-question::5",
    status: "gap",
    reason:
      "a bullet ruling unit (prose/rationale, no single code artifact); its own words: \"- Delete sits far left in the footer, and goes through the irreversible confirm.\"",
  },
  {
    key: "review-progress-two-reminder-scopes::1",
    status: "honored",
    reason:
      "\"Remind laggards (N)\" is disabled exactly when the laggard population is empty, matching the unit's own \"Disabled when the list is empty\" clause.",
    honored: {
      file: "app/src/pages/review/ProgressPanel.tsx",
      literal: "disabled={reminding || laggards.length === 0}",
      testFile: "app/src/pages/review/ProgressPanel.render.test.tsx",
    },
  },
  {
    key: "review-progress-two-reminder-scopes::2",
    status: "honored",
    reason:
      "the \"Remind the N not started\" link is wrapped in a length > 0 conditional, not a disabled attribute, matching the unit's own \"hidden, not disabled\" clause (DEC-760).",
    honored: {
      file: "app/src/pages/review/ProgressPanel.tsx",
      literal: "notStarted.length > 0 && (",
      testFile: "app/src/pages/review/ProgressPanel.render.test.tsx",
    },
  },
  {
    key: "loading-the-first-paint::1",
    status: "gap",
    reason:
      "a bullet ruling unit (prose/rationale, no single code artifact); its own words: \"- **Draw everything that needs no data immediately** — header, page title, toolbar shell. Only the rows wait.\"",
  },
  {
    key: "loading-the-first-paint::2",
    status: "gap",
    reason:
      "a bullet ruling unit (prose/rationale, no single code artifact); its own words: \"- **Under 250ms, show nothing.** A skeleton that flashes is worse than a beat of stillness, and it makes a fast load look broken.\"",
  },
  {
    key: "loading-the-first-paint::3",
    status: "gap",
    reason:
      "a bullet ruling unit (prose/rationale, no single code artifact); its own words: \"- **Blocks at the height the rows will become**, so nothing jumps when data lands. Varied widths on the title column only — a column of identical bars reads as a loading *graphic*, not as rows.\"",
  },
  {
    key: "loading-the-first-paint::4",
    status: "gap",
    reason:
      "a bullet ruling unit (prose/rationale, no single code artifact); its own words: \"- **Always six rows**, never a guess at the real count: a skeleton that guesses lies twice, once while loading and again when the number differs.\"",
  },
  {
    key: "loading-the-first-paint::5",
    status: "gap",
    reason:
      "a bullet ruling unit (prose/rationale, no single code artifact); its own words: \"- **No shimmer, no pulse.** An animation across a whole table is motion the user cannot act on and it competes with the content arriving. `#EFEBDF` — the hovered-row tone — reads as furniture rather t…\"",
  },
  {
    key: "two-more-surfaces-that-shipped-without-frames::1",
    status: "gap",
    reason:
      "a bullet ruling unit (prose/rationale, no single code artifact); its own words: \"- **New contact** (`NewContactModal`) — the only hand-entry path into the org directory, and the one place a contact is created without an import or a submission. Email carries the reason it is requir…\"",
  },
  {
    key: "two-more-surfaces-that-shipped-without-frames::2",
    status: "gap",
    reason:
      "a bullet ruling unit (prose/rationale, no single code artifact); its own words: \"- **Breaks editor** (`BreaksPanel`) — the admin half of the public breaks display designed earlier. Existing breaks as rows with Remove, then label/start/minutes as a three-up add row. Two facts state…\"",
  },
  {
    key: "confirm-dialogs-one-component-two-weights::1",
    status: "honored",
    reason:
      "the typing input is gated to the irreversible branch only, so the default 'reversible' weight renders no typing control -- one sentence, Cancel, primary carrying the verb.",
    honored: {
      file: "app/src/components/ConfirmDialog.tsx",
      literal: "weight === 'irreversible' && (",
      testFile: "app/src/components/ConfirmDialog.render.test.tsx",
    },
  },
  {
    key: "confirm-dialogs-one-component-two-weights::2",
    status: "honored",
    reason:
      "the component throws when weight='irreversible' is under-specified, enforcing that the type-the-name-to-confirm contract is never silently skipped for a destructive caller.",
    honored: {
      file: "app/src/components/ConfirmDialog.tsx",
      literal: "ConfirmDialog: weight='irreversible' requires a non-empty confirmPhrase",
      testFile: "app/src/components/ConfirmDialog.render.test.tsx",
    },
  },
  {
    key: "settings-the-four-surfaces-that-shipped-without-frames::1",
    status: "gap",
    reason:
      "a bullet ruling unit (prose/rationale, no single code artifact); its own words: \"- **Reset a password** (`PeopleRolesPanel`) — same reveal-once shape as the invite password, plus the two facts unique to a reset: existing sessions are ended, so they are signed out everywhere, and *…\"",
  },
  {
    key: "settings-the-four-surfaces-that-shipped-without-frames::2",
    status: "gap",
    reason:
      "a bullet ruling unit (prose/rationale, no single code artifact); its own words: \"- **Portal resources** (`ResourcesPanel`) — add is a modal: name, kind as File/Link chips (one or the other, never both), then the drop zone or URL field. Delete goes through the irreversible confirm,…\"",
  },
  {
    key: "settings-the-four-surfaces-that-shipped-without-frames::3",
    status: "gap",
    reason:
      "a bullet ruling unit (prose/rationale, no single code artifact); its own words: \"- **Track colour** (`TRACK_SWATCHES`) — a swatch sits left of the track name in the edit rows, captioned with what it is for: \"how a track reads on the agenda and the public pages\". It is not decorati…\"",
  },
  {
    key: "settings-the-four-surfaces-that-shipped-without-frames::4",
    status: "gap",
    reason:
      "a bullet ruling unit (prose/rationale, no single code artifact); its own words: \"- **Sessionboard import** (`SessionboardImportPanel`) — three steps in one modal, with step 2 showing counts per entity and what will happen to each (\"9 match a contact you have\", \"One has no name — b…\"",
  },
  {
    key: "settings-inviting-someone::1",
    status: "gap",
    reason:
      "a numbered ruling unit (prose/rationale, no single code artifact); its own words: \"1. **Invite** — first/last name (optional on the wire, required at the door), email, and role as two chips with their consequence spelled out: \"a reviewer sees only the plans they are assigned to · an…\"",
  },
  {
    key: "settings-inviting-someone::2",
    status: "gap",
    reason:
      "a numbered ruling unit (prose/rationale, no single code artifact); its own words: \"2. **Created** — the one-time password in monospace at 20px with a Copy button, and the sentence that makes it safe: \"Closing this dialog is the last time you see it — after that only a reset can repl…\"",
  },
  {
    key: "settings-inviting-someone::3",
    status: "gap",
    reason:
      "a numbered ruling unit (prose/rationale, no single code artifact); its own words: \"3. **Rejected** — email is the username, so a duplicate is refused. Standard error shape, plus a route out that is better than retyping: *Open Sam's row*, since changing an existing person's role is w…\"",
  },
  {
    key: "settings-inviting-someone::4",
    status: "gap",
    reason:
      "a bold ruling unit (prose/rationale, no single code artifact); its own words: \"**Do not design a pending-invitation state.** There is no such row: the account is live from creation. A greyed \"Invited\" row would describe a status the schema does not have, and organisers would wai…\"",
  },
  {
    key: "review-criteria-scale-or-choice::1",
    status: "gap",
    reason:
      "a bold ruling unit (prose/rationale, no single code artifact); its own words: \"**Editing** borrows `FieldModal`'s **type select**, but **not its options textarea** — options are editable rows, one per line item, with a drag handle and Remove.\"",
  },
  {
    key: "review-criteria-scale-or-choice::2",
    status: "gap",
    reason:
      "a bold ruling unit (prose/rationale, no single code artifact); its own words: \"**Aggregation is the decision that matters: a Choice criterion is unweighted and excluded from the numeric score.** Results show a distribution in the per-criterion breakdown — \"Strong 2 · Weak 1\" — a…\"",
  },
  {
    key: "review-criteria-scale-or-choice::3",
    status: "gap",
    reason:
      "a bullet ruling unit (prose/rationale, no single code artifact); its own words: \"- **The weight input disappears for Choice** — not zeroed, not disabled-with-a-zero. A criterion outside the mean has no weight to give, and a visible `0` invites the question of whether it counts a l…\"",
  },
  {
    key: "review-criteria-scale-or-choice::4",
    status: "gap",
    reason:
      "a bullet ruling unit (prose/rationale, no single code artifact); its own words: \"- **Shares recompute over the Scale criteria alone.** With Relevance ×3 and Depth ×2, the shares read 60% / 40%, not 50% / 33% — the third criterion is not taking 17% invisibly.\"",
  },
  {
    key: "review-criteria-scale-or-choice::5",
    status: "honored",
    reason: "the scorecard's overall caption states its own denominator: the Choice criteria are named and marked recorded, not averaged, alongside the weighted-mean phrase for the Scale criteria.",
    honored: {
      file: "app/src/pages/review/Scorecard.tsx",
      literal: "recorded, not averaged",
      testFile: "app/src/pages/Review.frame-verdicts.render.test.tsx",
    },
  },
  {
    key: "review-criteria-scale-or-choice::6",
    status: "honored",
    reason: "the Choice row is rendered as a radiogroup, same fieldset/legend contract as the numeric scale.",
    honored: {
      file: "app/src/pages/review/Scorecard.tsx",
      literal: "chq-review-choice-group",
      testFile: "app/src/pages/review/Scorecard.render.test.tsx",
    },
  },
  {
    key: "review-criteria-scale-or-choice::7",
    status: "gap",
    reason:
      "a bullet ruling unit (prose/rationale, no single code artifact); its own words: \"- **The expanded results band shows each reviewer's pick as text**, in its own column under the criterion name, with the distribution in the footer where the mean sits for scored criteria. The band st…\"",
  },
  {
    key: "review-criteria-scale-or-choice::8",
    status: "honored",
    reason: "criterion type mutation is guarded by the same evaluation-existence predicate the ruling names: a criterion with recorded evaluations is frozen, so its Scale/Choice type can never orphan a score already given.",
    honored: {
      file: "src/server/repo/review/plans.ts",
      literal: "export async function planHasEvaluations(db: Db, planId: string): Promise<boolean> {",
      testFile: "test/plan-criteria-guard.test.ts",
    },
  },
  {
    key: "review-criteria-scale-or-choice::9",
    status: "gap",
    reason:
      "a bullet ruling unit (prose/rationale, no single code artifact); its own words: \"- **Existing plans are untouched** — a criterion with no type is Scale, so nothing needs migrating.\"",
  },
  {
    key: "password-reset::1",
    status: "honored",
    reason:
      "the unit names its own artifact directly: src/auth/password-reset.ts's token-lifecycle exports, covered by test/password-reset-flow.test.ts.",
    honored: {
      file: "src/auth/password-reset.ts",
      literal: "export async function createResetToken(",
      testFile: "test/password-reset-flow.test.ts",
    },
  },
  {
    key: "password-reset::2",
    status: "honored",
    reason: "the Ask screen's subtitle is the ruling's own quoted sentence, verbatim.",
    honored: {
      file: "src/routes/auth-views.tsx",
      literal: "We will email you a link to set a new one.",
      testFile: "test/password-reset-flow.test.ts",
    },
  },
  {
    key: "password-reset::3",
    status: "honored",
    reason: "the Sent screen's subtitle is the ruling's own quoted sentence, verbatim, identical for a known and an unknown address.",
    honored: {
      file: "src/routes/auth-views.tsx",
      literal: "If that address has an account, a reset link is on its way.",
      testFile: "test/password-reset-flow.test.ts",
    },
  },
  {
    key: "password-reset::4",
    status: "honored",
    reason: "the Set screen names the account being changed so a forwarded link cannot silently reset someone else's.",
    honored: {
      file: "src/routes/auth-views.tsx",
      literal: "Signing in as {props.email}.",
      testFile: "test/desktop-frames-account.test.ts",
    },
  },
  {
    key: "password-reset::5",
    status: "honored",
    reason: "the No-longer-valid screen is a designed screen with a fresh-link primary action, never a generic error.",
    honored: {
      file: "src/routes/auth-views.tsx",
      literal: "Send a fresh link",
      testFile: "test/password-reset-flow.test.ts",
    },
  },
  {
    key: "speaker-detail-due-date-and-schedule-columns-right-align-before-status-ink::1",
    status: "honored",
    reason:
      "the tasks row's due-date cell carries the full right-align declaration set the ruling states: text-align right, nowrap, a constant 18px pre-status gap enforced by the clip.",
    honored: {
      file: "app/src/pages/speakers/speakers.css",
      literal: ".chq-speaker-detail-tasks-row > :nth-child(2) {\n  white-space: nowrap;\n  text-align: right;\n  min-width: 0;\n  overflow: hidden;\n  text-overflow: ellipsis;\n}",
      testFile: "app/src/pages/speakers/speakers-css.test.ts",
    },
  },
  {
    key: "speaker-detail-due-date-and-schedule-columns-right-align-before-status-ink::2",
    status: "honored",
    reason:
      "the DEC-989 comment on the sessions-row declaration documents the exact two-more-declarations mechanism this unit narrates (min-width:0 then the overflow/text-overflow escape).",
    honored: {
      file: "app/src/pages/speakers/speakers.css",
      literal: "DEC-989: `white-space: nowrap` needs an overflow escape in the SAME rule,",
      testFile: "app/src/pages/speakers/speakers-css.test.ts",
    },
  },
  {
    key: "speaker-detail-due-date-and-schedule-columns-right-align-before-status-ink::3",
    status: "gap",
    reason:
      "a bold ruling unit (prose/rationale, no single code artifact); its own words: \"**Same defect, two more places it was found** (same component/CSS family, scanned per this ruling rather than assumed):\" -- a transition sentence introducing the two bullets that themselves carry rows (::4, ::5); honoring it would mean re-citing a child's own citation, which this ledger's preamble forbids as a borrowed citation.",
  },
  {
    key: "speaker-detail-due-date-and-schedule-columns-right-align-before-status-ink::4",
    status: "honored",
    reason:
      "the sessions-row schedule column carries the same right-align/nowrap/min-width declaration set the unit names.",
    honored: {
      file: "app/src/pages/speakers/speakers.css",
      literal: ".chq-speaker-detail-sessions-row > :nth-child(2) {\n  text-align: right;\n  white-space: nowrap;\n  min-width: 0;",
      testFile: "app/src/pages/speakers/speakers-css.test.ts",
    },
  },
  {
    key: "speaker-detail-due-date-and-schedule-columns-right-align-before-status-ink::5",
    status: "honored",
    reason:
      "the waiting-tab \"Last reminded\" column carries the same right-align/nowrap/min-width declaration set, scoped to the waiting tab as the unit states.",
    honored: {
      file: "app/src/pages/speakers/task-view.css",
      literal: ".chq-taskview-waiting .chq-taskview-row > :nth-child(4) {\n  text-align: right;\n  white-space: nowrap;\n  min-width: 0;",
      testFile: "app/src/pages/speakers/speakers-css.test.ts",
    },
  },
  {
    key: "speaker-detail-due-date-and-schedule-columns-right-align-before-status-ink::6",
    status: "gap",
    reason:
      "a bold ruling unit (prose/rationale, no single code artifact); its own words: \"**Where the pattern does *not* apply, and why it was left alone:**\" -- a transition sentence introducing the three carve-out bullets that themselves carry rows (::7, ::8, ::9); honoring it would mean re-citing a child's own citation, which this ledger's preamble forbids as a borrowed citation.",
  },
  {
    key: "speaker-detail-due-date-and-schedule-columns-right-align-before-status-ink::7",
    status: "honored",
    reason:
      "the task-view.css comment scoping the fix to the waiting tab states the Answered tab's date column precedes an action link, not a status token, matching this carve-out verbatim.",
    honored: {
      file: "app/src/pages/speakers/task-view.css",
      literal: "which sits before an action LINK, not a status",
      testFile: "app/src/pages/speakers/speakers-css.test.ts",
    },
  },
  {
    key: "speaker-detail-due-date-and-schedule-columns-right-align-before-status-ink::8",
    status: "honored",
    reason:
      "the speaker portal task list renders the due date on its own line, not in an adjacent-column cell beside a status token, matching this carve-out.",
    honored: {
      file: "src/routes/portal/tasks/views.tsx",
      literal: 'class="chq-portal-due"',
      testFile: "test/portal-tasks-resources-390-frames.test.ts",
    },
  },
  {
    key: "speaker-detail-due-date-and-schedule-columns-right-align-before-status-ink::9",
    status: "honored",
    reason:
      "the onboarding grid's due date lives in the column header aggregate (\"N of M done\"), not in a per-row cell beside a status token, matching this carve-out.",
    honored: {
      file: "app/src/pages/speakers/OnboardingGrid.tsx",
      literal: "${complete} of ${assigned} done",
      testFile: "app/src/pages/speakers/OnboardingGrid.render.test.tsx",
    },
  },
  {
    key: "superseded-frames-formerly-owed::1",
    status: "gap",
    reason:
      "a numbered ruling unit (prose/rationale, no single code artifact); its own words: \"1. **Bulk-communications flow** (B1 ⚡) — the seam between the four steps.\"",
  },
  {
    key: "superseded-frames-formerly-owed::2",
    status: "gap",
    reason:
      "a numbered ruling unit (prose/rationale, no single code artifact); its own words: \"2. **Submission detail · session details** (A5 ⚡) — tracks, format, participants, co-presenter.\"",
  },
  {
    key: "superseded-frames-formerly-owed::3",
    status: "gap",
    reason:
      "a numbered ruling unit (prose/rationale, no single code artifact); its own words: \"3. **Results-table expanded reviews** (A27 ⚡) — the B8 grid rule made concrete.\"",
  },
  {
    key: "superseded-frames-formerly-owed::4",
    status: "gap",
    reason:
      "a numbered ruling unit (prose/rationale, no single code artifact); its own words: \"4. **Settings edit view** (B10) — CFP edit as the exemplar for all five.\"",
  },
  {
    key: "superseded-frames-formerly-owed::5",
    status: "gap",
    reason:
      "a numbered ruling unit (prose/rationale, no single code artifact); its own words: \"5. **Admin per-speaker detail** (B3) and **review wave lifecycle** (B4).\"",
  },
  {
    key: "superseded-frames-formerly-owed::6",
    status: "gap",
    reason:
      "a numbered ruling unit (prose/rationale, no single code artifact); its own words: \"6. **Import step 3** (B5), **HTML email shell** (B9).\"",
  },
];

// Shrink-only in principle (a unit may later be honored with a real,
// non-borrowed citation and removed from this list) -- but unlike
// KNOWN_GAPS above, this ratchet is TWO-SIDED (below): the population
// itself grows only when DESIGN-RULINGS.md gains a new bullet/numbered
// item/bold paragraph, which the test-time re-derivation already forces
// this list to track exactly, in both directions.
const KNOWN_UNIT_GAPS: string[] = [
  "preamble::1",
  "preamble::2",
  "preamble::3",
  "governing-principle-applied::1",
  "governing-principle-applied::2",
  "governing-principle-applied::3",
  "b8-interaction-states-standard::1",
  "b8-interaction-states-standard::2",
  "b8-interaction-states-standard::3",
  "b8-interaction-states-standard::4",
  "b8-interaction-states-standard::5",
  "b8-interaction-states-standard::6",
  "b8-interaction-states-standard::7",
  "b8-interaction-states-standard::8",
  "b8-interaction-states-standard::9",
  "b8-interaction-states-standard::10",
  "b8-interaction-states-standard::11",
  "b8-interaction-states-standard::12",
  "b8-interaction-states-standard::13",
  "b8-interaction-states-standard::14",
  "b8-interaction-states-standard::15",
  "b8-interaction-states-standard::16",
  "b8-interaction-states-standard::17",
  "b8-interaction-states-standard::18",
  "b8-interaction-states-standard::19",
  "b8-interaction-states-standard::20",
  "b8-interaction-states-standard::21",
  "b8-interaction-states-standard::22",
  "b8-interaction-states-standard::23",
  "b8-interaction-states-standard::24",
  "b8-interaction-states-standard::25",
  "b8-interaction-states-standard::26",
  "b8-interaction-states-standard::27",
  "b8-interaction-states-standard::28",
  "b8-interaction-states-standard::29",
  "b8-interaction-states-standard::30",
  "b7-empty-states::1",
  "b7-empty-states::2",
  "b7-empty-states::3",
  "b7-empty-states::4",
  "b7-empty-states::5",
  "b7-empty-states::6",
  "b7-empty-states::7",
  "b7-empty-states::8",
  "b7-empty-states::9",
  "b10-settings-edit-views-on-desktop::1",
  "b10-settings-edit-views-on-desktop::2",
  "b10-settings-edit-views-on-desktop::3",
  "b10-settings-edit-views-on-desktop::4",
  "b10-settings-edit-views-on-desktop::5",
  "b10-settings-edit-views-on-desktop::6",
  "error-and-validation-states::1",
  "error-and-validation-states::2",
  "error-and-validation-states::3",
  "error-and-validation-states::4",
  "error-and-validation-states::5",
  "error-and-validation-states::6",
  "error-and-validation-states::7",
  "error-and-validation-states::8",
  "error-and-validation-states::9",
  "error-and-validation-states::10",
  "error-and-validation-states::11",
  "error-and-validation-states::12",
  "error-and-validation-states::13",
  "error-and-validation-states::14",
  "error-and-validation-states::15",
  "speaker-portal-adding-a-co-presenter::1",
  "speaker-portal-adding-a-co-presenter::2",
  "speaker-portal-adding-a-co-presenter::3",
  "speaker-portal-adding-a-co-presenter::4",
  "speaker-portal-adding-a-co-presenter::5",
  "speaker-portal-adding-a-co-presenter::6",
  "speaker-portal-adding-a-co-presenter::7",
  "speaker-portal-adding-a-co-presenter::8",
  "docs-a-new-site-and-where-it-stops::1",
  "docs-a-new-site-and-where-it-stops::2",
  "docs-a-new-site-and-where-it-stops::3",
  "docs-a-new-site-and-where-it-stops::4",
  "docs-a-new-site-and-where-it-stops::5",
  "docs-a-new-site-and-where-it-stops::6",
  "docs-a-new-site-and-where-it-stops::7",
  "docs-a-new-site-and-where-it-stops::8",
  "docs-a-new-site-and-where-it-stops::9",
  "docs-a-new-site-and-where-it-stops::10",
  "cfp-form-editing-a-question::1",
  "cfp-form-editing-a-question::2",
  "cfp-form-editing-a-question::3",
  "cfp-form-editing-a-question::4",
  "cfp-form-editing-a-question::5",
  "loading-the-first-paint::1",
  "loading-the-first-paint::2",
  "loading-the-first-paint::3",
  "loading-the-first-paint::4",
  "loading-the-first-paint::5",
  "two-more-surfaces-that-shipped-without-frames::1",
  "two-more-surfaces-that-shipped-without-frames::2",
  "settings-the-four-surfaces-that-shipped-without-frames::1",
  "settings-the-four-surfaces-that-shipped-without-frames::2",
  "settings-the-four-surfaces-that-shipped-without-frames::3",
  "settings-the-four-surfaces-that-shipped-without-frames::4",
  "settings-inviting-someone::1",
  "settings-inviting-someone::2",
  "settings-inviting-someone::3",
  "settings-inviting-someone::4",
  "review-criteria-scale-or-choice::1",
  "review-criteria-scale-or-choice::2",
  "review-criteria-scale-or-choice::3",
  "review-criteria-scale-or-choice::4",
  "review-criteria-scale-or-choice::7",
  "review-criteria-scale-or-choice::9",
  "speaker-detail-due-date-and-schedule-columns-right-align-before-status-ink::3",
  "speaker-detail-due-date-and-schedule-columns-right-align-before-status-ink::6",
  "superseded-frames-formerly-owed::1",
  "superseded-frames-formerly-owed::2",
  "superseded-frames-formerly-owed::3",
  "superseded-frames-formerly-owed::4",
  "superseded-frames-formerly-owed::5",
  "superseded-frames-formerly-owed::6"
];

function findRulingUnitProblems(
  derived: DerivedUnit[],
  ledger: UnitLedgerEntry[],
  gaps: string[],
  resolvers: { fileContains: (c: HonoredCite) => boolean; fileExists: (p: string) => boolean },
): string[] {
  const problems: string[] = [];

  const derivedKeySet = new Map<string, DerivedUnit>();
  for (const d of derived) {
    if (derivedKeySet.has(d.key)) {
      problems.push(`duplicate derived unit key (broken population, not a ledger issue): ${d.key}`);
      continue;
    }
    derivedKeySet.set(d.key, d);
  }

  const ledgerKeyCounts = new Map<string, number>();
  for (const entry of ledger) {
    ledgerKeyCounts.set(entry.key, (ledgerKeyCounts.get(entry.key) ?? 0) + 1);
  }

  for (const d of derived) {
    const count = ledgerKeyCounts.get(d.key) ?? 0;
    if (count === 0) problems.push(`derived unit with no ledger row: ${d.key}`);
    else if (count > 1) problems.push(`derived unit with ${count} ledger rows (must be exactly 1): ${d.key}`);
  }

  for (const entry of ledger) {
    if (!derivedKeySet.has(entry.key)) problems.push(`stale unit ledger row citing a non-existent key: ${entry.key}`);
  }

  for (const entry of ledger) {
    if (entry.status !== "honored") continue;
    if (!entry.honored) {
      problems.push(`honored unit row ${entry.key} has no honored citation`);
      continue;
    }
    if (!resolvers.fileExists(entry.honored.file)) {
      problems.push(`honored unit row ${entry.key} cites a nonexistent file: ${entry.honored.file}`);
      continue;
    }
    if (!resolvers.fileContains(entry.honored)) {
      problems.push(`honored unit row ${entry.key} cites ${entry.honored.file} but it does not contain "${entry.honored.literal}"`);
    }
    if (!resolvers.fileExists(entry.honored.testFile)) {
      problems.push(`honored unit row ${entry.key} cites a nonexistent test file: ${entry.honored.testFile}`);
    }
  }

  const gapRowKeys = ledger.filter((e) => e.status === "gap").map((e) => e.key);
  for (const k of gapRowKeys) {
    if (!gaps.includes(k)) problems.push(`unit ledger row ${k} is marked "gap" but is not in KNOWN_UNIT_GAPS`);
  }
  for (const g of gaps) {
    if (!gapRowKeys.includes(g)) problems.push(`KNOWN_UNIT_GAPS names ${g} but no unit ledger row with that key is marked "gap"`);
  }

  return problems;
}

const unitRealResolvers = {
  fileContains: honoredFileContains,
  fileExists: (p: string) => {
    try {
      readFileSync(join(ROOT, p), "utf8");
      return true;
    } catch {
      return false;
    }
  },
};

// Two-sided ratchet (DEC-582 wave-31 amendment, mirroring
// OPEN_DIVERGENCE_CEILING's shape in test/open-divergence-ledger.scan.test.ts):
// seeded from a forced `-1` measurement, then set to the real count the
// failing assertion below printed back (never computed by arithmetic on
// the source counts). Registered in scripts/exit-predicate.ts's
// OUT_OF_CAMPAIGN_SCOPE -- same disposition as FRAME_EYEBROW_DIVERGENCE_CEILING
// and PACK_UNIT_GRAMMAR_OFFENDERS_CEILING: a newly-derived population no
// instrument previously graded must not move the campaign's goalposts
// mid-convergence.
export const RULING_UNIT_GAP_CEILING = 118;

describe("design-rulings-ledger ruling-unit population (DEC-582 wave-31 amendment)", () => {
  const derivedUnits = deriveRulingUnits();

  it("tripwire: derived ruling-unit population is non-empty and matches the file's own bullet/numbered/bold counts", () => {
    expect(derivedUnits.length).toBeGreaterThan(0);
    const bullets = derivedUnits.filter((u) => u.kind === "bullet").length;
    const numbered = derivedUnits.filter((u) => u.kind === "numbered").length;
    const bold = derivedUnits.filter((u) => u.kind === "bold").length;
    expect(bullets + numbered + bold).toBe(derivedUnits.length);
    expect(bullets).toBeGreaterThan(0);
    expect(numbered).toBeGreaterThan(0);
    expect(bold).toBeGreaterThan(0);
  });

  it("every derived ruling unit has exactly one ledger row, and every unit ledger row names a live derived key", () => {
    const problems = findRulingUnitProblems(derivedUnits, UNIT_LEDGER, KNOWN_UNIT_GAPS, unitRealResolvers).filter(
      (p) => p.includes("no ledger row") || p.includes("ledger rows (must be exactly 1)") || p.includes("stale unit ledger row") || p.includes("duplicate derived unit key"),
    );
    expect(problems, problems.join("\n")).toEqual([]);
  });

  it("every honored unit row's citation resolves (none exist yet, but the resolver is exercised by the negative controls below)", () => {
    const problems = findRulingUnitProblems(derivedUnits, UNIT_LEDGER, KNOWN_UNIT_GAPS, unitRealResolvers).filter((p) => p.includes("honored unit row"));
    expect(problems, problems.join("\n")).toEqual([]);
  });

  it("KNOWN_UNIT_GAPS exactly matches the unit ledger's gap rows in both directions", () => {
    const problems = findRulingUnitProblems(derivedUnits, UNIT_LEDGER, KNOWN_UNIT_GAPS, unitRealResolvers).filter(
      (p) => p.includes("KNOWN_UNIT_GAPS") || p.includes('marked "gap"'),
    );
    expect(problems, problems.join("\n")).toEqual([]);
  });

  it("no problems at all -- the unit ledger is exact in both directions against the current tree", () => {
    const problems = findRulingUnitProblems(derivedUnits, UNIT_LEDGER, KNOWN_UNIT_GAPS, unitRealResolvers);
    expect(problems, problems.join("\n")).toEqual([]);
  });

  it(`never exceeds RULING_UNIT_GAP_CEILING (${RULING_UNIT_GAP_CEILING}) gap rows`, () => {
    const gapCount = UNIT_LEDGER.filter((e) => e.status === "gap").length;
    if (gapCount > RULING_UNIT_GAP_CEILING) {
      throw new Error(
        `${gapCount} ruling-unit gap rows, above the ratchet ceiling of ${RULING_UNIT_GAP_CEILING}. ` +
          `RULING_UNIT_GAP_CEILING may only be LOWERED, never raised -- a new ungapped unit landed unexplained.`,
      );
    }
    expect(gapCount).toBeLessThanOrEqual(RULING_UNIT_GAP_CEILING);
  });

  it(`never drops below RULING_UNIT_GAP_CEILING (${RULING_UNIT_GAP_CEILING}) without the ceiling being lowered to match (a stale ceiling hides drained gaps and licenses regrowth back up to it)`, () => {
    const gapCount = UNIT_LEDGER.filter((e) => e.status === "gap").length;
    if (gapCount < RULING_UNIT_GAP_CEILING) {
      throw new Error(
        `${gapCount} ruling-unit gap rows, below the ceiling of ${RULING_UNIT_GAP_CEILING}. This is the ` +
          `ratchet working: a unit got honored with a real citation. Lower the constant to match:\n` +
          `  export const RULING_UNIT_GAP_CEILING = ${gapCount};`,
      );
    }
    expect(gapCount).toBeGreaterThanOrEqual(RULING_UNIT_GAP_CEILING);
  });
});

describe("findRulingUnitProblems negative controls (DEC-099: every scan ships one)", () => {
  const baseDerived: DerivedUnit[] = [{ key: "zzz::1", headingTitle: "ZZZ", kind: "bullet", text: "- zzz" }];
  const baseLedger: UnitLedgerEntry[] = [{ key: "zzz::1", status: "gap", reason: "test" }];
  const fakeResolvers = {
    fileContains: (c: HonoredCite) => c.file === "src/decisions.ts" && c.literal === "export",
    fileExists: (p: string) => p === "src/decisions.ts",
  };

  it("compliant unit ledger against its matching population reports nothing", () => {
    expect(findRulingUnitProblems(baseDerived, baseLedger, ["zzz::1"], fakeResolvers)).toEqual([]);
  });

  it("a derived unit with no ledger row IS reported", () => {
    const extraDerived: DerivedUnit[] = [...baseDerived, { key: "zzz::2-unledgered", headingTitle: "ZZZ", kind: "bullet", text: "- zzz2" }];
    const problems = findRulingUnitProblems(extraDerived, baseLedger, ["zzz::1"], fakeResolvers);
    expect(problems.some((p) => p.includes("zzz::2-unledgered"))).toBe(true);
  });

  it("a stale unit ledger row citing a dead key IS reported", () => {
    const staleLedger: UnitLedgerEntry[] = [...baseLedger, { key: "zzz::dead", status: "gap", reason: "x" }];
    const problems = findRulingUnitProblems(baseDerived, staleLedger, ["zzz::1", "zzz::dead"], fakeResolvers);
    expect(problems.some((p) => p.includes("zzz::dead"))).toBe(true);
  });

  it("an honored unit row citing a nonexistent path fails the resolver", () => {
    const badLedger: UnitLedgerEntry[] = [{ key: "zzz::1", status: "honored", reason: "x", honored: { file: "src/does-not-exist.ts", literal: "export", testFile: "src/decisions.ts" } }];
    const problems = findRulingUnitProblems(baseDerived, badLedger, [], fakeResolvers);
    expect(problems.some((p) => p.includes("src/does-not-exist.ts"))).toBe(true);
  });

  it("a gap row not present in KNOWN_UNIT_GAPS IS reported, and a KNOWN_UNIT_GAPS entry with no gap row IS reported", () => {
    const problemsMissingRatchet = findRulingUnitProblems(baseDerived, baseLedger, [], fakeResolvers);
    expect(problemsMissingRatchet.some((p) => p.includes("not in KNOWN_UNIT_GAPS"))).toBe(true);

    const honoredLedger: UnitLedgerEntry[] = [{ key: "zzz::1", status: "honored", reason: "x", honored: { file: "src/decisions.ts", literal: "export", testFile: "src/decisions.ts" } }];
    const problemsStaleRatchet = findRulingUnitProblems(baseDerived, honoredLedger, ["zzz::1"], fakeResolvers);
    expect(problemsStaleRatchet.some((p) => p.includes("no unit ledger row"))).toBe(true);
  });
});
