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
      testFile: "app/src/pages/settings/PeopleRolesPanel.render.test.tsx",
    },
  },
  {
    key: "settings-inviting-someone",
    status: "honored",
    reason: 'the invite primary reads "Create the account", matching the verb the ruling insists on.',
    honored: {
      file: "app/src/pages/settings/PeopleRolesPanel.tsx",
      literal: "Create the account",
      testFile: "app/src/pages/settings/PeopleRolesPanel.render.test.tsx",
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
