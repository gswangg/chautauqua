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
 * DECLARED manifest (DEC-644 amendment; DEC-518 wave-3 reconciliation):
 * one row per `figure` block's shotId in src/routes/docs-content/**
 * (DOCS_ARTICLES) -- the id SET here must equal the id set the article
 * registry declares, checked in both directions by
 * test/docs-shots-manifest.test.ts. Routes are real
 * app/src/routeManifest.ts / src/index.ts-mounted paths -- never invented
 * -- so scripts/docs-shots.ts's own route/role cross-check
 * (resolveRoleForRoute in scripts/docs-shots.ts) can resolve who to log in
 * as before visiting. No `caption` field here: the article's own figure
 * block owns the caption (a second copy is the DEC-613 trap) --
 * scripts/docs-shots.ts reads a shot's caption from DOCS_ARTICLES when it
 * needs one for logging/alt text.
 *
 * NEVER hand-mirrored elsewhere (DEC-518): scripts/docs-shots.ts imports
 * this array directly and test/docs-shots-manifest.test.ts asserts its
 * shape -- nothing restates these rows.
 */
export const DOCS_SHOTS: readonly DocsShotEntry[] = [
  {
    id: "getting-started-start-here-01",
    route: "/admin/overview",
    group: "getting-started",
  },
  {
    id: "running-an-event-call-for-papers-and-submissions-01",
    route: "/admin/submissions/forms",
    group: "running-an-event",
  },
  {
    id: "running-an-event-call-for-papers-and-submissions-02",
    route: "/admin/submissions",
    group: "running-an-event",
  },
  {
    id: "running-an-event-speakers-tasks-and-content-01",
    route: "/admin/speakers",
    group: "running-an-event",
  },
  {
    id: "running-an-event-speakers-tasks-and-content-02",
    route: "/admin/speakers",
    group: "running-an-event",
  },
  {
    id: "running-an-event-speakers-tasks-and-content-03",
    route: `/admin/content/${SUBMISSION_ID}`,
    group: "running-an-event",
  },
  {
    id: "running-an-event-agenda-and-publishing-01",
    route: "/admin/agenda",
    group: "running-an-event",
  },
  {
    id: "running-an-event-agenda-and-publishing-02",
    route: "/admin/agenda",
    group: "running-an-event",
  },
  {
    id: "running-an-event-agenda-and-publishing-03",
    route: "/admin/agenda",
    group: "running-an-event",
  },
  {
    id: "running-an-event-embeds-and-public-pages-01",
    route: `/e/${EVENT_SLUG}/sessions`,
    group: "running-an-event",
  },
  {
    id: "running-an-event-embeds-and-public-pages-02",
    route: "/admin/settings",
    group: "running-an-event",
  },
  {
    id: "your-contacts-contacts-pipeline-and-comms-01",
    route: "/admin/contacts",
    group: "your-contacts",
  },
  {
    id: "your-contacts-contacts-pipeline-and-comms-02",
    route: "/admin/contacts",
    group: "your-contacts",
  },
  {
    id: "your-contacts-contacts-pipeline-and-comms-03",
    route: "/admin/comms",
    group: "your-contacts",
  },
  {
    id: "for-reviewers-reviewing-start-to-finish-01",
    // DEC-518 wave-3: /admin/review and /admin/review/plans/:planId are
    // BOTH ambiguous -- ROUTE_MANIFEST lists each path once for
    // role:"organizer" and once for role:"reviewer" (PlanEditor and
    // ReviewerQueue mount the same URLs), and scripts/docs-shots.ts's
    // resolveRoleForRoute throws rather than guess between them. The
    // plan-scoped submission route below is the only reviewer-only path
    // ROUTE_MANIFEST declares, so both reviewer-group shots reuse it.
    route: `/admin/review/plans/${PLAN_ID}/submissions/${REVIEWER_SUBMISSION_ID}`,
    group: "for-reviewers",
  },
  {
    id: "for-reviewers-reviewing-start-to-finish-02",
    route: `/admin/review/plans/${PLAN_ID}/submissions/${REVIEWER_SUBMISSION_ID}`,
    group: "for-reviewers",
  },
  {
    id: "for-speakers-your-speaker-portal-01",
    route: "/portal/tasks",
    group: "for-speakers",
  },
  {
    id: "for-speakers-your-speaker-portal-02",
    route: "/portal/profile",
    group: "for-speakers",
  },
  {
    id: "running-the-software-running-the-software-01",
    route: "/admin/overview",
    group: "running-the-software",
  },
  {
    id: "running-the-software-running-the-software-02",
    route: "/dev/mailbox",
    group: "running-the-software",
  },
] as const;

// devflow-conf-2027's slug is the anchor the docs shoot's fail-loud DevFlow
// Conf 2027 check (scripts/docs-shots.ts) probes for; exported so that check
// and this manifest can never name two different seeded events.
export const DOCS_SHOTS_EVENT_SLUG = EVENT_SLUG;

/** The four personas a DOCS_SHOTS route can resolve to -- same vocabulary as
 * app/src/routeManifest.ts's RouteManifestEntry["role"], restated here (not
 * imported) so this module stays dependency-free (no app/src import; see
 * this file's header). */
export type DocsShotRole = "organizer" | "reviewer" | "speaker" | "public";

/**
 * Resolves the one role a DOCS_SHOTS route needs by looking it up in the
 * real app/src/routeManifest.ts route table `manifest` (same table
 * render-sweep drives off), passed in by the caller rather than imported so
 * this stays a pure function testable without a playwright dependency (DEC-
 * 644 amendment). Fails loudly rather than guessing: a route absent from
 * `manifest`, or present under more than one DIFFERENT role (e.g.
 * `/admin/review/plans/:id`, which PlanEditor and ReviewerQueue both mount
 * on), cannot be resolved to a single persona and must not be shot from
 * this manifest without disambiguating first.
 */
export function resolveRoleForRoute(
  route: string,
  manifest: readonly { readonly path: string; readonly role: DocsShotRole }[],
): DocsShotRole {
  const matches = manifest.filter((entry) => entry.path === route);
  if (matches.length === 0) {
    throw new Error(`docs-shots: route not found in app/src/routeManifest.ts: ${route}`);
  }
  const roles = new Set(matches.map((entry) => entry.role));
  if (roles.size > 1) {
    throw new Error(
      `docs-shots: route ${route} resolves to more than one role in app/src/routeManifest.ts (${[...roles].join(
        ", ",
      )}) -- ambiguous, pick a route that names a single persona`,
    );
  }
  return matches[0]!.role;
}
