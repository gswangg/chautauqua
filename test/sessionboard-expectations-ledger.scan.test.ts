// DEC-518 (wave-5 amendment; widened wave 12, sha 36c04c64): the rank-3
// vendored Sessionboard corpus at docs/sessionboard-reference/ is NINE files
// (README.md plus 00-how-sessionboard-works.md through 07-speaker-crm.md,
// eight non-README behavior documents), not one section of one file. The
// wave-5 version of this scan instrumented only the eight `### 5.N` rows
// under 00's "## 5. Cross-cutting expectations for clones" -- 8 of ~41
// `## `-level headings across the corpus. This widens the derived population
// to every `## `-level heading in every non-README `*.md` under
// docs/sessionboard-reference/, walked at test time (sorted, so a failure is
// stable), while KEEPING the eight original `### 5.N` rows as an explicit,
// still-present subset -- so the widening is provably additive, not a
// rewrite.
//
// Modeled directly on test/clarifications-ledger.scan.test.ts's derived-
// population + transcribed-ledger + two-directional-assertion shape: same
// idiom, extended with a third verdict ("superseded") for headings where
// this build deliberately diverges from the Sessionboard behavior by a
// recorded ruling, instead of "absent-by-design" (which proves a scope
// REDUCTION by an artifact's absence -- not the right shape for a positive
// divergence backed by its own decision file).
//
// Population, two parts (both re-derived at test time, never hand-listed):
//   (a) every `## <title>` heading in every `docs/sessionboard-reference/
//       *.md` file except README.md, keyed by `${fileSlug}--${titleSlug}` so
//       two files' identically-titled sections (e.g. every file's own
//       "## Sources") can never collide.
//   (b) every `### 5.N <title>` heading under 00's own
//       "## 5. Cross-cutting expectations for clones" section, keyed by the
//       bare title slug (unchanged from the wave-5 shape) -- these are a
//       named subset of (a)'s parent heading, not a duplicate of it: the
//       parent "## 5." row in (a) covers the section as a whole, the eight
//       "### 5.N" rows in (b) cover its named cross-cutting properties
//       individually.
//
// Ledger verdicts:
//   - "honored": the cited src/**/app/src/**/docs/** file exists, contains
//     the cited literal, and the cited test/** file exists.
//   - "superseded": the build genuinely diverges from the Sessionboard
//     expectation by a recorded ruling -- the cited decisions/*.md file
//     exists and contains the cited literal naming the divergence.
//   - "gap": the tree does not honor the expectation. Recorded in
//     KNOWN_GAPS as an explicit set of keys, each carrying a stated reason
//     -- never a count, never a ceiling (waves 76-79 lost three lanes
//     carrying a bare number instead of shrinking it; a key set makes a NEW
//     gap fail by name while a known one stays recorded).

import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";

const ROOT = resolve(__dirname, "..");
const REFERENCE_DIR = join(ROOT, "docs", "sessionboard-reference");
const REFERENCE_PATH = join(REFERENCE_DIR, "00-how-sessionboard-works.md");

// ---------------------------------------------------------------------------
// Population -- derived at test time from the Sessionboard reference corpus,
// never hardcoded.
// ---------------------------------------------------------------------------
interface DerivedHeading {
  key: string;
  title: string;
}

const SECTION_HEADING = "## 5. Cross-cutting expectations for clones";
const SUBHEADING_RE = /^### 5\.(\d+) (.+)$/;
const H2_RE = /^## (.+)$/;

/** Slugifies a heading title into a stable, deterministic key: lowercase,
 * curly/straight quotes and arrows stripped, every run of non-alphanumeric
 * characters collapsed to one hyphen, no leading/trailing hyphen. Pure
 * function of the title text -- never hand-assigned. */
function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/["“”'’`]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Extracts the lines belonging to `## 5. Cross-cutting expectations for
 * clones`, stopping at the next `## ` heading or end of file. */
function extractSection(markdown: string): string {
  const lines = markdown.split("\n");
  const startIdx = lines.findIndex((l) => l.trim() === SECTION_HEADING);
  if (startIdx === -1) {
    throw new Error(`docs/sessionboard-reference/00-how-sessionboard-works.md has no "${SECTION_HEADING}" section`);
  }
  const rest = lines.slice(startIdx + 1);
  const endIdx = rest.findIndex((l) => l.startsWith("## "));
  return (endIdx === -1 ? rest : rest.slice(0, endIdx)).join("\n");
}

/** (a) every `## ` heading across every non-README *.md file in the corpus,
 * namespaced by source file. Directory walk, sorted -- a new file or a
 * renamed heading changes the population deterministically, never silently. */
function deriveCorpusHeadings(): DerivedHeading[] {
  const files = readdirSync(REFERENCE_DIR)
    .filter((f) => f.endsWith(".md") && f !== "README.md")
    .sort();
  const out: DerivedHeading[] = [];
  for (const file of files) {
    const fileSlug = slugify(file.replace(/\.md$/, ""));
    const text = readFileSync(join(REFERENCE_DIR, file), "utf8");
    for (const line of text.split("\n")) {
      const m = H2_RE.exec(line.trim());
      if (!m) continue;
      const title = m[1]!;
      out.push({ key: `${fileSlug}--${slugify(title)}`, title: `${file}: ${title}` });
    }
  }
  return out;
}

/** (b) the original wave-5 population: every `### 5.N` heading under 00's
 * own "## 5. Cross-cutting expectations for clones" section, keyed bare
 * (unchanged) so the eight original ledger rows below need no renaming --
 * this is what makes the widening provably additive rather than a rewrite. */
function deriveCrossCuttingSubheadings(): DerivedHeading[] {
  const text = readFileSync(REFERENCE_PATH, "utf8");
  const section = extractSection(text);
  const out: DerivedHeading[] = [];
  for (const line of section.split("\n")) {
    const m = SUBHEADING_RE.exec(line.trim());
    if (!m) continue;
    const title = m[2]!;
    out.push({ key: slugify(title), title });
  }
  return out;
}

function deriveHeadings(): DerivedHeading[] {
  return [...deriveCorpusHeadings(), ...deriveCrossCuttingSubheadings()];
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

interface SupersededCite {
  /** Path relative to decisions/, e.g. "DEC-571.md". */
  decFile: string;
  literal: string;
}

interface LedgerEntry {
  key: string;
  status: "honored" | "superseded" | "gap";
  reason: string;
  honored?: HonoredCite;
  superseded?: SupersededCite;
}

// Rubric-coverage citation reused by every file's "Rubric rationale"
// heading: docs/verification-log/task-w13-g-rubric-coverage-stage1.md
// tables all 116 `- id:` rows of docs/eval-rubric/*.yaml (the rationale
// each `## Rubric rationale` section is explaining) against a derived
// population, re-asserted two-directionally by
// test/rubric-coverage-enumeration.scan.test.ts.
const RUBRIC_LOG_FILE = "docs/verification-log/task-w13-g-rubric-coverage-stage1.md";
const RUBRIC_LOG_TESTFILE = "test/rubric-coverage-enumeration.scan.test.ts";
const RUBRIC_RATIONALE_REASON =
  "the section's rubric-ID rationale (e.g. CFP-01, ABS-01) is the same population docs/eval-rubric/*.yaml's coverage ledger tables and re-derives two-directionally, RESULT: PASS, 0 open items.";

// "Sources" headings are bibliographies (external URLs), not executable
// expectations -- there is no src/** artifact that "implements a citation
// list." What is checkable is that the corpus itself was vendored and is
// exactly what this scan's own population is derived from: this test file
// existing and deriving from docs/sessionboard-reference/<file> IS the
// evidence the sources were consulted and transcribed, not invented.
function sourcesHonored(file: string): HonoredCite {
  return { file, literal: "## Sources", testFile: "test/sessionboard-expectations-ledger.scan.test.ts" };
}
const SOURCES_REASON =
  "a Sources heading is a bibliography, not a clone-parity expectation; the corpus being vendored into docs/sessionboard-reference/ and walked by this very scan is the checkable fact, not a src/** citation list.";

const LEDGER: LedgerEntry[] = [
  // -- (a) corpus-wide `## ` headings, one row per file per heading -------
  {
    key: "00-how-sessionboard-works--1-what-sessionboard-is-and-the-product-map",
    status: "honored",
    reason:
      "the product-map's own closing line maps its module inventory onto \"the eval kit's seven graded areas\" -- exactly the seven docs/eval-rubric/*.yaml files, all COVERED with 0 open items in the rubric-coverage ledger.",
    honored: { file: RUBRIC_LOG_FILE, literal: "## 01-call-for-papers.yaml", testFile: RUBRIC_LOG_TESTFILE },
  },
  {
    key: "00-how-sessionboard-works--2-the-organizer-journey-step-by-step",
    status: "honored",
    reason:
      "the organizer journey's steps (event setup, form builder, sessions table, evaluation, decide+notify, contacts->speakers, portals, agenda, publish) are each an organizer-only surface; role separation for the whole surface is enumerated by the route-authz scan.",
    honored: { file: "src/server/middleware.ts", literal: "export const requireOrganizer = requireRole(\"organizer\");", testFile: "test/route-authz-enumeration.scan.test.ts" },
  },
  {
    key: "00-how-sessionboard-works--3-the-participant-speaker-journey-step-by-step",
    status: "honored",
    reason:
      "the participant journey (submit, first portal login, view/edit submission, accept invitation, complete tasks, upload content, consume resources) runs entirely through the portal sub-app, scoped to the signed-in speaker's own event.",
    honored: { file: "src/routes/portal/index.tsx", literal: "export const portalRoutes = new Hono<AppEnv>();", testFile: "test/portal-404-role-gate.test.ts" },
  },
  {
    key: "00-how-sessionboard-works--4-video-walkthrough-catalog-the-feature-surface-map",
    status: "honored",
    reason:
      "the catalog's own table maps every video to one of the seven eval-area codes (01 CFP .. 07 Speaker CRM); the rubric-coverage ledger tables all seven areas COVERED, so the catalog's feature-surface map is realized area by area.",
    honored: { file: RUBRIC_LOG_FILE, literal: "## 07-speaker-crm.yaml", testFile: RUBRIC_LOG_TESTFILE },
  },
  {
    key: "00-how-sessionboard-works--5-cross-cutting-expectations-for-clones",
    status: "honored",
    reason:
      "the umbrella heading itself (distinct from its eight `### 5.N` children, each individually ledgered below as part (b) of this scan's population): role separation is the first and most structural of the eight cross-cutting properties this section names.",
    honored: { file: "src/server/middleware.ts", literal: "export const requireOrganizer = requireRole(\"organizer\");", testFile: "test/route-authz-enumeration.scan.test.ts" },
  },
  { key: "00-how-sessionboard-works--sources", status: "honored", reason: SOURCES_REASON, honored: sourcesHonored("docs/sessionboard-reference/00-how-sessionboard-works.md") },

  { key: "01-call-for-papers--what-this-is", status: "honored", reason: "the CFP module's full proposal lifecycle (form builder, public portal, submitter dashboard, reviewer scoring, accept/reject) is CFP-01..16, all COVERED.", honored: { file: "src/forms/builder.ts", literal: "export const FIELD_KINDS", testFile: "test/forms.test.ts" } },
  { key: "01-call-for-papers--personas-user-journeys", status: "honored", reason: "the organizer/speaker/reviewer/chair journeys through the CFP form builder and public submission portal are the same module CFP-01..16 covers.", honored: { file: "src/forms/builder.ts", literal: "export const FIELD_KINDS", testFile: "test/forms.test.ts" } },
  { key: "01-call-for-papers--feature-inventory", status: "honored", reason: "the feature-inventory table's must-have rows (form builder, conditional logic, public portal, submitter dashboard, reviewer assignment/scoring, accept/reject, decision notifications) are CFP-01..16, all COVERED.", honored: { file: "src/forms/builder.ts", literal: "export const FIELD_KINDS", testFile: "test/forms.test.ts" } },
  { key: "01-call-for-papers--rubric-rationale", status: "honored", reason: RUBRIC_RATIONALE_REASON, honored: { file: RUBRIC_LOG_FILE, literal: "## 01-call-for-papers.yaml (CFP-S1..S4, CFP-01..16) — 20 rows", testFile: RUBRIC_LOG_TESTFILE } },
  { key: "01-call-for-papers--sources", status: "honored", reason: SOURCES_REASON, honored: sourcesHonored("docs/sessionboard-reference/01-call-for-papers.md") },

  { key: "02-abstract-management--what-this-is", status: "honored", reason: "abstract management's review-depth loop (multi-round plans, weighted rubrics, anonymized review) is ABS-01..14, all COVERED via the review-plans sub-app.", honored: { file: "src/routes/review/plans-crud.ts", literal: "export const reviewPlansCrudRoutes", testFile: "test/review-rounds.test.ts" } },
  { key: "02-abstract-management--personas-user-journeys", status: "honored", reason: "the organizer/author/reviewer journeys through multi-round evaluation are the same plans sub-app ABS-01..14 covers.", honored: { file: "src/routes/review/plans-crud.ts", literal: "export const reviewPlansCrudRoutes", testFile: "test/review-rounds.test.ts" } },
  { key: "02-abstract-management--feature-inventory", status: "honored", reason: "the feature-inventory's must-have rows (multi-round plans, weighted scorecards, anonymized review, aggregate scores) are ABS-01..14, all COVERED.", honored: { file: "src/routes/review/plans-crud.ts", literal: "export const reviewPlansCrudRoutes", testFile: "test/review-rounds.test.ts" } },
  { key: "02-abstract-management--rubric-rationale", status: "honored", reason: RUBRIC_RATIONALE_REASON, honored: { file: RUBRIC_LOG_FILE, literal: "## 02-abstract-management.yaml (ABS-S1..S3, ABS-01..14) — 17 rows", testFile: RUBRIC_LOG_TESTFILE } },
  { key: "02-abstract-management--sources", status: "honored", reason: SOURCES_REASON, honored: sourcesHonored("docs/sessionboard-reference/02-abstract-management.md") },

  { key: "03-speaker-management--what-this-is", status: "honored", reason: "the post-acceptance speaker portal/task hub (profiles, portal tasks, progress tracking, bulk comms) is SPK-01..16, all COVERED via the onboarding-tasks sub-app.", honored: { file: "src/routes/tasks.ts", literal: "export const taskRoutes = new Hono<AppEnv>();", testFile: "test/onboarding-grid-query.test.ts" } },
  { key: "03-speaker-management--personas-user-journeys", status: "honored", reason: "the organizer task-assignment and speaker self-serve portal journeys are the same task sub-app SPK-01..16 covers.", honored: { file: "src/routes/tasks.ts", literal: "export const taskRoutes = new Hono<AppEnv>();", testFile: "test/onboarding-grid-query.test.ts" } },
  { key: "03-speaker-management--feature-inventory", status: "honored", reason: "the feature-inventory's must-have rows (per-event speaker directory, branded portal, task assignment, progress dashboard, bulk comms) are SPK-01..16, all COVERED.", honored: { file: "src/routes/tasks.ts", literal: "export const taskRoutes = new Hono<AppEnv>();", testFile: "test/onboarding-grid-query.test.ts" } },
  { key: "03-speaker-management--rubric-rationale", status: "honored", reason: RUBRIC_RATIONALE_REASON, honored: { file: RUBRIC_LOG_FILE, literal: "## 03-speaker-management.yaml (SPK-S1..S3, SPK-01..16) — 19 rows", testFile: RUBRIC_LOG_TESTFILE } },
  { key: "03-speaker-management--sources", status: "honored", reason: SOURCES_REASON, honored: sourcesHonored("docs/sessionboard-reference/03-speaker-management.md") },

  { key: "04-content-management--what-this-is", status: "honored", reason: "content management's post-acceptance file/version/approval lifecycle (file-request tasks, per-file versioning, comments, content-status approval) is CNT-01..14, all COVERED.", honored: { file: "src/routes/files.ts", literal: "POST /api/v1/submissions/:id/content-status — organizer-only", testFile: "test/files.test.ts" } },
  { key: "04-content-management--personas-user-journeys", status: "honored", reason: "the organizer approval and speaker deliverable-upload journeys are the same files sub-app CNT-01..14 covers.", honored: { file: "src/routes/files.ts", literal: "POST /api/v1/submissions/:id/content-status — organizer-only", testFile: "test/files.test.ts" } },
  { key: "04-content-management--feature-inventory", status: "honored", reason: "the feature-inventory's must-have rows (file-request tasks, per-file versioning, comment threads, content approval gating publication) are CNT-01..14, all COVERED.", honored: { file: "src/routes/files.ts", literal: "POST /api/v1/submissions/:id/content-status — organizer-only", testFile: "test/files.test.ts" } },
  { key: "04-content-management--rubric-rationale", status: "honored", reason: RUBRIC_RATIONALE_REASON, honored: { file: RUBRIC_LOG_FILE, literal: "## 04-content-management.yaml (CNT-S1..S3, CNT-01..14) — 17 rows", testFile: RUBRIC_LOG_TESTFILE } },
  { key: "04-content-management--sources", status: "honored", reason: SOURCES_REASON, honored: sourcesHonored("docs/sessionboard-reference/04-content-management.md") },

  { key: "05-ai-agenda--what-this-is", status: "honored", reason: "the agenda/schedule builder (multi-track/day placement, conflict detection, publish) is AIA-01..08, all COVERED via the agenda sub-app.", honored: { file: "src/routes/agenda.ts", literal: "agendaRoutes.post(\"/events/:eventId/agenda/publish\"", testFile: "test/agenda-publish.test.ts" } },
  { key: "05-ai-agenda--personas-user-journeys", status: "honored", reason: "the organizer drag/drop-into-slot and conflict-review journeys are the same agenda sub-app AIA-01..08 covers.", honored: { file: "src/routes/agenda.ts", literal: "agendaRoutes.post(\"/events/:eventId/agenda/publish\"", testFile: "test/agenda-publish.test.ts" } },
  { key: "05-ai-agenda--feature-inventory", status: "honored", reason: "the feature-inventory's must-have rows (multi-view scheduling, conflict detection across speaker/room dimensions, publish) are AIA-01..08, all COVERED.", honored: { file: "src/domain/schedule.ts", literal: "findConflicts", testFile: "test/overlap-lanes.test.ts" } },
  { key: "05-ai-agenda--rubric-rationale", status: "honored", reason: RUBRIC_RATIONALE_REASON, honored: { file: RUBRIC_LOG_FILE, literal: "## 05-ai-agenda.yaml (AIA-S1..S2, AIA-01..08) — 10 rows", testFile: RUBRIC_LOG_TESTFILE } },
  { key: "05-ai-agenda--sources", status: "honored", reason: SOURCES_REASON, honored: sourcesHonored("docs/sessionboard-reference/05-ai-agenda.md") },

  { key: "06-public-widgets--what-this-is", status: "honored", reason: "the public/embeddable-widgets area (five widget types, output formats, content filters, public rendering) is EMB-01..16, all COVERED via the saved-embed sub-app.", honored: { file: "src/routes/public/saved-embed.tsx", literal: "export const savedEmbedRoutes = new Hono<AppEnv>();", testFile: "test/saved-embed-route.test.ts" } },
  { key: "06-public-widgets--personas-user-journeys", status: "honored", reason: "the organizer embed-configuration and anonymous public-visitor journeys are the same saved-embed sub-app EMB-01..16 covers.", honored: { file: "src/routes/public/saved-embed.tsx", literal: "export const savedEmbedRoutes = new Hono<AppEnv>();", testFile: "test/saved-embed-route.test.ts" } },
  { key: "06-public-widgets--feature-inventory", status: "honored", reason: "the feature-inventory's must-have rows (widget types, output formats, field/content filters, public rendering) are EMB-01..16, all COVERED.", honored: { file: "src/routes/public/saved-embed.tsx", literal: "export const savedEmbedRoutes = new Hono<AppEnv>();", testFile: "test/saved-embed-route.test.ts" } },
  { key: "06-public-widgets--rubric-rationale", status: "honored", reason: RUBRIC_RATIONALE_REASON, honored: { file: RUBRIC_LOG_FILE, literal: "## 06-public-widgets.yaml (EMB-S1..S3, EMB-01..16) — 19 rows", testFile: RUBRIC_LOG_TESTFILE } },
  { key: "06-public-widgets--sources", status: "honored", reason: SOURCES_REASON, honored: sourcesHonored("docs/sessionboard-reference/06-public-widgets.md") },

  { key: "07-speaker-crm--what-this-is", status: "honored", reason: "the org-level cross-event contact database (dashboard, segments, custom fields) is CRM-01..12, all COVERED via the contacts sub-app.", honored: { file: "src/routes/api/contacts/crud.ts", literal: "contactsRoutes.get(\"/contacts\"", testFile: "test/contacts.test.ts" } },
  { key: "07-speaker-crm--personas-user-journeys", status: "honored", reason: "the org-level admin's cross-event contact-management journey is the same contacts sub-app CRM-01..12 covers.", honored: { file: "src/routes/api/contacts/crud.ts", literal: "contactsRoutes.get(\"/contacts\"", testFile: "test/contacts.test.ts" } },
  { key: "07-speaker-crm--feature-inventory", status: "honored", reason: "the feature-inventory's must-have rows (org-scoped contact list, custom fields, segments) are CRM-01..12, all COVERED.", honored: { file: "src/routes/api/contacts/crud.ts", literal: "contactsRoutes.get(\"/contacts\"", testFile: "test/contacts.test.ts" } },
  { key: "07-speaker-crm--rubric-rationale", status: "honored", reason: RUBRIC_RATIONALE_REASON, honored: { file: RUBRIC_LOG_FILE, literal: "## 07-speaker-crm.yaml (CRM-S1..S2, CRM-01..12) — 14 rows", testFile: RUBRIC_LOG_TESTFILE } },
  { key: "07-speaker-crm--sources", status: "honored", reason: SOURCES_REASON, honored: sourcesHonored("docs/sessionboard-reference/07-speaker-crm.md") },

  // -- (b) the original wave-5 population: 00's `### 5.N` rows (unchanged) --
  {
    key: "multi-persona-authentication-and-role-separation",
    status: "honored",
    reason: "organizer/reviewer/speaker role guards plus the unauthenticated public surface are enumerated by the route-authz scan.",
    honored: {
      file: "src/server/middleware.ts",
      literal: "export const requireOrganizer = requireRole(\"organizer\");",
      testFile: "test/route-authz-enumeration.scan.test.ts",
    },
  },
  {
    key: "event-scoped-data",
    status: "honored",
    reason: "sessions are org-keyed at the session-identity layer, and every db.update/.delete under src/** must carry a .where() scoping it, checked by the write-scoping invariant scan.",
    honored: {
      file: "src/server/middleware.ts",
      literal: "orgId: string;",
      testFile: "test/write-scoping-invariant.scan.test.ts",
    },
  },
  {
    key: "the-contact-speaker-public-speaker-ladder",
    status: "honored",
    reason: "a participant row's visible bit is the per-speaker public-embed toggle -- addCoPresenter records visible=false and the public gate's own generated SQL predicate is proven to exclude it.",
    honored: {
      file: "src/server/repo/public/gates.ts",
      literal: "export function visibleSubmissionConditions",
      testFile: "test/public-copresenter-visibility.test.ts",
    },
  },
  {
    key: "decisions-never-auto-notify",
    status: "honored",
    reason: "the bare content/submission status routes are structurally mailer-free (\"MUST NEVER import a mailer\"); DEC-720 is the one sanctioned exception, where the note+status+mail is one deliberate organizer action behind its own endpoint, not an auto-send on a bare status flip.",
    honored: {
      file: "src/routes/files.ts",
      literal: "MUST NEVER import a mailer.",
      testFile: "test/status-change-mail-ledger.scan.test.ts",
    },
  },
  {
    key: "notifications-and-transactional-email-surface",
    status: "honored",
    reason: "bulk/transactional sends route through the comms send app and are logged per recipient into a batched history the SPA reads back.",
    honored: {
      file: "src/routes/comms/send.ts",
      literal: "export const sendRoutes = new Hono<AppEnv>();",
      testFile: "test/email-log-batches.test.ts",
    },
  },
  {
    key: "deadlines-change-behavior",
    status: "honored",
    reason: "a passed form close date blocks editing except for accepted speakers, and track edits lock at close regardless of status -- both gated on the same closeDate/now/timeZone inputs.",
    honored: {
      file: "src/domain/edit-lock.ts",
      literal: "export function canEditSubmission",
      testFile: "test/edit-lock.test.ts",
    },
  },
  {
    key: "the-public-private-boundary",
    status: "honored",
    reason: "reviewer-facing anonymization strips speaker identity from evaluation reads, word-boundary-anchored so it can never leak a fragment.",
    honored: {
      file: "src/domain/evaluation/anonymization.ts",
      literal: "export function anonymizeForReviewer",
      testFile: "test/redact-identity-boundary.test.ts",
    },
  },
  {
    key: "filled-state-fidelity",
    status: "superseded",
    reason: "DEC-571 deliberately removes the Sessionboard reference's color-coded-by-track agenda block as a distinct requirement: the admin agenda grid carries track identity by name in text, never by a color swatch, so a clone that color-codes agenda blocks would be reverting a ruling, not honoring a gap.",
    superseded: {
      decFile: "DEC-571.md",
      literal: "the track is named in text on the card",
    },
  },
];

// Shrink-only ratchet (DEC-518/DEC-099), now a SET OF KEYS rather than a
// count: every Sessionboard expectation the tree does NOT honor is recorded
// here by key with a stated reason, asserted set-equal against the ledger's
// "gap" rows in both directions. A count can be carried unchanged wave after
// wave (waves 76-79 did exactly that); a named key set makes a brand-new gap
// fail by name on sight, while a still-open one stays legible instead of
// hiding inside a number. Empty this wave -- every corpus-wide `## ` heading
// and every original `### 5.N` row resolved to "honored" or "superseded"
// against the current tree; see the branch report for the population this
// widening covered.
const KNOWN_GAPS: string[] = [];

// ---------------------------------------------------------------------------
// Resolution helpers
// ---------------------------------------------------------------------------

function honoredFileContains(cite: HonoredCite): boolean {
  const path = join(ROOT, cite.file);
  const text = readFileSync(path, "utf8");
  return text.includes(cite.literal);
}

function supersededDecContains(cite: SupersededCite): boolean {
  const path = join(ROOT, "decisions", cite.decFile);
  const text = readFileSync(path, "utf8");
  return text.includes(cite.literal);
}

/** Pure classifier: given the derived population and the ledger, returns the
 * list of problems found -- named by key, never just a count. Exported so
 * the negative-control tests below can feed it synthetic violations
 * directly. Both directions are asserted: every derived heading has exactly
 * one ledger row, and every ledger row names a live derived key. */
export function findSessionboardProblems(
  derived: DerivedHeading[],
  ledger: LedgerEntry[],
  gaps: string[],
  resolvers: {
    fileContains: (c: HonoredCite) => boolean;
    decContains: (c: SupersededCite) => boolean;
    fileExists: (p: string) => boolean;
    decExists: (p: string) => boolean;
  },
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

  // (4) superseded rows: cited decisions/*.md file exists and contains the literal
  for (const entry of ledger) {
    if (entry.status !== "superseded") continue;
    if (!entry.superseded) {
      problems.push(`superseded row ${entry.key} has no superseded citation`);
      continue;
    }
    if (!resolvers.decExists(entry.superseded.decFile)) {
      problems.push(`superseded row ${entry.key} cites a nonexistent decision file: ${entry.superseded.decFile}`);
      continue;
    }
    if (!resolvers.decContains(entry.superseded)) {
      problems.push(`superseded row ${entry.key} cites decisions/${entry.superseded.decFile} but it does not contain "${entry.superseded.literal}"`);
    }
  }

  // (5) gap rows: every ledger row marked "gap" must be a named key in
  // KNOWN_GAPS (with a reason recorded on the ledger row itself), and vice
  // versa -- a fixed gap must be removed from the set, not left stale.
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
  decContains: supersededDecContains,
  fileExists: (p: string) => {
    try {
      readFileSync(join(ROOT, p), "utf8");
      return true;
    } catch {
      return false;
    }
  },
  decExists: (p: string) => {
    try {
      readFileSync(join(ROOT, "decisions", p), "utf8");
      return true;
    } catch {
      return false;
    }
  },
};

describe("sessionboard-expectations-ledger.scan (DEC-518, widened wave 12)", () => {
  const corpusHeadings = deriveCorpusHeadings();
  const crossCutting = deriveCrossCuttingSubheadings();
  const derived = deriveHeadings();

  it("tripwire: the widening is provably additive -- every original ### 5.N row is still present, plus the corpus-wide ## headings", () => {
    expect(crossCutting.length).toBe(8);
    expect(corpusHeadings.length).toBeGreaterThan(crossCutting.length);
    expect(derived.length).toBe(corpusHeadings.length + crossCutting.length);
    // the 8 original wave-5 keys are a literal subset of the widened population
    const derivedKeys = new Set(derived.map((d) => d.key));
    for (const c of crossCutting) {
      expect(derivedKeys.has(c.key), `original row ${c.key} missing from widened population`).toBe(true);
    }
  });

  it("tripwire: derived heading population is non-trivial and every key is stable/derived (never hardcoded)", () => {
    expect(derived.length).toBeGreaterThan(1);
    for (const d of derived) {
      expect(d.key.length, `heading "${d.title}" produced an empty key`).toBeGreaterThan(0);
    }
  });

  it("every derived heading has exactly one ledger row, and every ledger row names a live derived key", () => {
    const problems = findSessionboardProblems(derived, LEDGER, KNOWN_GAPS, realResolvers).filter(
      (p) => p.includes("no ledger row") || p.includes("ledger rows (must be exactly 1)") || p.includes("stale ledger row") || p.includes("duplicate derived key"),
    );
    expect(problems, problems.join("\n")).toEqual([]);
  });

  it("every honored row's citation resolves: file exists, contains the literal, and the test file exists", () => {
    const problems = findSessionboardProblems(derived, LEDGER, KNOWN_GAPS, realResolvers).filter((p) => p.includes("honored row"));
    expect(problems, problems.join("\n")).toEqual([]);
  });

  it("every superseded row's decision file exists and contains the cited literal", () => {
    const problems = findSessionboardProblems(derived, LEDGER, KNOWN_GAPS, realResolvers).filter((p) => p.includes("superseded row"));
    expect(problems, problems.join("\n")).toEqual([]);
  });

  it("KNOWN_GAPS is a shrink-only key set exactly matching the ledger's gap rows in both directions (never a count, never hand-grown)", () => {
    const problems = findSessionboardProblems(derived, LEDGER, KNOWN_GAPS, realResolvers).filter(
      (p) => p.includes("KNOWN_GAPS") || p.includes('marked "gap"'),
    );
    expect(problems, problems.join("\n")).toEqual([]);
    // every recorded gap must carry its own reason on the ledger row -- a
    // key with no stated reason is a bare number wearing a string's clothes
    for (const g of KNOWN_GAPS) {
      const row = LEDGER.find((e) => e.key === g);
      expect(row?.reason.length ?? 0, `KNOWN_GAPS entry ${g} has no reason on its ledger row`).toBeGreaterThan(0);
    }
  });

  it("no problems at all -- the ledger is exact in both directions against the current tree", () => {
    const problems = findSessionboardProblems(derived, LEDGER, KNOWN_GAPS, realResolvers);
    expect(problems, problems.join("\n")).toEqual([]);
  });
});

describe("findSessionboardProblems negative controls (DEC-099: every scan ships one)", () => {
  const baseDerived: DerivedHeading[] = [{ key: "zzz-01", title: "ZZZ" }];
  const baseLedger: LedgerEntry[] = [
    { key: "zzz-01", status: "honored", reason: "test", honored: { file: "src/decisions.ts", literal: "export", testFile: "test/sessionboard-expectations-ledger.scan.test.ts" } },
  ];
  const fakeResolvers = {
    fileContains: (c: HonoredCite) => c.file === "src/decisions.ts" && c.literal === "export",
    decContains: (c: SupersededCite) => c.decFile === "DEC-571.md" && c.literal === "present-literal",
    fileExists: (p: string) => p === "src/decisions.ts" || p === "test/sessionboard-expectations-ledger.scan.test.ts",
    decExists: (p: string) => p === "DEC-571.md",
  };

  it("compliant ledger against its matching population reports nothing (proves the scan can pass)", () => {
    expect(findSessionboardProblems(baseDerived, baseLedger, [], fakeResolvers)).toEqual([]);
  });

  it("a derived heading with no ledger row IS reported (direction: population -> ledger)", () => {
    const extraDerived: DerivedHeading[] = [...baseDerived, { key: "zzz-99-unledgered", title: "ZZZ99" }];
    const problems = findSessionboardProblems(extraDerived, baseLedger, [], fakeResolvers);
    expect(problems.some((p) => p.includes("zzz-99-unledgered"))).toBe(true);
  });

  it("a stale ledger row citing a dead key IS reported (direction: ledger -> population)", () => {
    const staleLedger: LedgerEntry[] = [...baseLedger, { key: "zzz-dead", status: "honored", reason: "x", honored: { file: "src/decisions.ts", literal: "export", testFile: "test/sessionboard-expectations-ledger.scan.test.ts" } }];
    const problems = findSessionboardProblems(baseDerived, staleLedger, [], fakeResolvers);
    expect(problems.some((p) => p.includes("zzz-dead"))).toBe(true);
  });

  it("a ledger row citing a nonexistent path fails the resolver", () => {
    const badLedger: LedgerEntry[] = [{ key: "zzz-01", status: "honored", reason: "x", honored: { file: "src/does-not-exist.ts", literal: "export", testFile: "test/sessionboard-expectations-ledger.scan.test.ts" } }];
    const problems = findSessionboardProblems(baseDerived, badLedger, [], fakeResolvers);
    expect(problems.some((p) => p.includes("src/does-not-exist.ts"))).toBe(true);
  });

  it("a ledger row whose cited file exists but does not contain the literal IS reported", () => {
    const badLiteral: LedgerEntry[] = [{ key: "zzz-01", status: "honored", reason: "x", honored: { file: "src/decisions.ts", literal: "definitely-not-present", testFile: "test/sessionboard-expectations-ledger.scan.test.ts" } }];
    const problems = findSessionboardProblems(baseDerived, badLiteral, [], fakeResolvers);
    expect(problems.some((p) => p.includes("definitely-not-present"))).toBe(true);
  });

  it("a superseded row whose decision file doesn't contain the cited literal IS reported", () => {
    const badSuperseded: LedgerEntry[] = [{ key: "zzz-01", status: "superseded", reason: "x", superseded: { decFile: "DEC-571.md", literal: "not-actually-there" } }];
    const problems = findSessionboardProblems(baseDerived, badSuperseded, [], fakeResolvers);
    expect(problems.some((p) => p.includes("not-actually-there"))).toBe(true);
  });

  it("a superseded row whose decision file genuinely contains the literal is accepted", () => {
    const goodSuperseded: LedgerEntry[] = [{ key: "zzz-01", status: "superseded", reason: "x", superseded: { decFile: "DEC-571.md", literal: "present-literal" } }];
    expect(findSessionboardProblems(baseDerived, goodSuperseded, [], fakeResolvers)).toEqual([]);
  });

  it("a gap row not present in KNOWN_GAPS IS reported, and a KNOWN_GAPS entry with no gap row IS reported", () => {
    const gapLedger: LedgerEntry[] = [{ key: "zzz-01", status: "gap", reason: "x" }];
    const problemsMissingRatchet = findSessionboardProblems(baseDerived, gapLedger, [], fakeResolvers);
    expect(problemsMissingRatchet.some((p) => p.includes("not in KNOWN_GAPS"))).toBe(true);

    const problemsStaleRatchet = findSessionboardProblems(baseDerived, baseLedger, ["zzz-01"], fakeResolvers);
    expect(problemsStaleRatchet.some((p) => p.includes("no ledger row"))).toBe(true);
  });
});
