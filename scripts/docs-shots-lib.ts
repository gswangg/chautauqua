// Pure declarations + helpers for scripts/docs-shots.ts (v12 intake section
// B; DEC-644 amendment). Sole owner: scripts/docs-shots.ts,
// scripts/docs-shots-lib.ts, test/docs-shots-manifest.test.ts (task w1-b).
//
// docs/design/DESIGN-RULINGS.md:308-316 ("Screenshot rules") is the
// contract this manifest exists to satisfy: shots come from the real app at
// 1600x900, seeded data only (DevFlow Conf 2027), full frames never crops,
// the caption carries the point, no drawn annotation, and the set is
// re-shot every release "so this is a script" -- scripts/docs-shots.ts is
// that script; this file is the declared manifest it reads. Kept
// dependency-free (no node:/playwright imports) so it's plain-vitest
// testable, same split as scripts/render-sweep.ts / render-sweep-lib.ts.
//
// Scripts/ tooling (not src/ pure-core, DEC-002).

/** Exactly 1600x900 -- DESIGN-RULINGS.md:308-316 rule 1 ("From the real app,
 * at 1600 x 900"). Never resized per-shot: a doc set at mixed resolutions
 * is not comparable. */
export const DOCS_SHOT_VIEWPORT = { width: 1600, height: 900 } as const;

/** The six /docs groups ("Grouped by who you are, not by screen" --
 * DESIGN-RULINGS.md "Docs — a new site, and where it stops"). A shot's `id`
 * must be prefixed with its `group` value (see DOCS_SHOT_ID_PATTERN /
 * shotIdMatchesGroup below). */
export const DOCS_SHOT_GROUPS = [
  "getting-started",
  "running-an-event",
  "your-contacts",
  "for-reviewers",
  "for-speakers",
  "running-the-software",
] as const;

export type DocsShotGroup = (typeof DOCS_SHOT_GROUPS)[number];

export interface DocsShotEntry {
  readonly id: string;
  readonly route: string;
  readonly group: DocsShotGroup;
  readonly caption: string;
}

/** Generic shot-id shape: one or more lower-kebab segments, then a
 * zero-padded two-digit ordinal -- `<group>-<article-slug>-<nn>`. Group
 * membership and the group-prefix check are separate (shotIdMatchesGroup),
 * since DOCS_SHOT_GROUPS entries are themselves hyphenated. */
export const DOCS_SHOT_ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*-\d{2}$/;

/** True if `id` starts with `${group}-` -- the grammar's `<group>-` prefix
 * requirement, checked separately from DOCS_SHOT_ID_PATTERN because a group
 * like "getting-started" is itself hyphenated and the regex alone can't tell
 * a group boundary from an article-slug boundary. */
export function shotIdMatchesGroup(id: string, group: string): boolean {
  return id.startsWith(`${group}-`);
}

// Seed literals (scripts/seed.ts, deterministic via seedId()) -- same values
// as app/src/routeManifest.ts / scripts/render-sweep.ts use for the same
// rows, restated here for this file's own provenance rather than imported,
// since this module is deliberately dependency-free (no app/src import) so
// its manifest can be asserted purely against its own grammar in
// test/docs-shots-manifest.test.ts.
const EVENT_SLUG = "devflow-conf-2027";
const SUBMISSION_ID = "seed_submission_0001";
const REVIEWER_SUBMISSION_ID = "seed_submission_0002";
const PLAN_ID = "seed_evaluation_plan_0001";

/**
 * DECLARED manifest (DEC-644 amendment): one row per major screen the first
 * tranche of /docs articles names, seeded per DESIGN-RULINGS.md rule 2
 * ("Seeded data only. DevFlow Conf 2027 is fictional and stable"). Routes
 * are real app/src/routeManifest.ts / src/index.ts-mounted paths -- never
 * invented -- so scripts/docs-shots.ts's own route/role cross-check
 * (buildRoleIndex in this file) can resolve who to log in as before
 * visiting.
 *
 * NEVER hand-mirrored elsewhere (DEC-518): scripts/docs-shots.ts imports
 * this array directly and test/docs-shots-manifest.test.ts asserts its
 * shape -- nothing restates these rows.
 */
export const DOCS_SHOTS: readonly DocsShotEntry[] = [
  {
    id: "getting-started-the-event-hub-01",
    route: "/",
    group: "getting-started",
    caption: "The public event hub — where anyone lands before signing in.",
  },
  {
    id: "getting-started-first-event-01",
    route: "/admin/overview",
    group: "getting-started",
    caption: "The organizer Overview — deadlines, pipeline counts and the nearest task, all in one screen.",
  },
  {
    id: "running-an-event-cfp-and-submissions-01",
    route: "/admin/submissions/forms",
    group: "running-an-event",
    caption: "The CFP builder — the form speakers see when they submit a session.",
  },
  {
    id: "running-an-event-cfp-and-submissions-02",
    route: "/admin/submissions",
    group: "running-an-event",
    caption: "The submissions worklist — every proposal for the event, with status and track at a glance.",
  },
  {
    id: `running-an-event-cfp-and-submissions-03`,
    route: `/admin/submissions/${SUBMISSION_ID}`,
    group: "running-an-event",
    caption: "A single submission's detail page — abstract, participants and the accept/decline decision.",
  },
  {
    id: "running-an-event-building-the-agenda-01",
    route: "/admin/agenda",
    group: "running-an-event",
    caption: "The agenda builder — placing accepted sessions into rooms and time slots.",
  },
  {
    id: "your-contacts-managing-contacts-01",
    route: "/admin/contacts",
    group: "your-contacts",
    caption: "The Contacts list — everyone your event has ever emailed, speakers and non-speakers alike.",
  },
  {
    id: `for-reviewers-scoring-a-submission-01`,
    route: `/admin/review/plans/${PLAN_ID}/submissions/${REVIEWER_SUBMISSION_ID}`,
    group: "for-reviewers",
    caption: "A reviewer's scorecard for one submission — criteria, scores and notes.",
  },
  {
    id: "for-speakers-your-portal-01",
    route: "/portal",
    group: "for-speakers",
    caption: "The speaker portal home — a speaker's submissions, tasks and profile in one place.",
  },
  {
    id: "for-speakers-your-portal-02",
    route: `/portal/submissions/${SUBMISSION_ID}/edit`,
    group: "for-speakers",
    caption: "Editing a submission from the portal — the same form a speaker used to submit it.",
  },
  {
    id: "running-the-software-event-settings-01",
    route: "/admin/settings",
    group: "running-the-software",
    caption: "Event settings — the organizer's control panel for the whole event.",
  },
] as const;

// devflow-conf-2027's slug is the anchor the docs shoot's fail-loud DevFlow
// Conf 2027 check (scripts/docs-shots.ts) probes for; exported so that check
// and this manifest can never name two different seeded events.
export const DOCS_SHOTS_EVENT_SLUG = EVENT_SLUG;
