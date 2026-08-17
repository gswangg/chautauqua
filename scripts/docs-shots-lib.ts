// Pure declarations + helpers for scripts/docs-shots.ts (v12 intake section
// B; DEC-644 amendment). Sole owner: scripts/docs-shots.ts,
// scripts/docs-shots-lib.ts, test/docs-shots-manifest.test.ts (task w1-b).
//
// docs/design/DESIGN-RULINGS.md:308-316 ("Screenshot rules") is the
// contract this manifest exists to satisfy: shots come from the real app at
// 1600 wide, seeded data only (DevFlow Conf 2027), never cropped, the
// caption carries the point, no drawn annotation, and the set is re-shot
// every release "so this is a script" -- scripts/docs-shots.ts is that
// script; this file is the declared manifest it reads.
//
// AMENDED by docs/design/DEVIATIONS.md section 4a (USER RULING 2026-08-16):
// the "exactly 1600x900 frame" half of rule 1/3 is overridden. The admin
// shell scrolls inside .chq-main, so a 900px clip cut long screens off
// mid-row; a shot is now as tall as its screen unless it declares
// `capture: "frame"`. Rows may also declare `prep` steps so a figure shows
// the STATE its caption names rather than a route twin's cold load. Kept
// dependency-free (no node:/playwright imports) so it's plain-vitest
// testable, same split as scripts/render-sweep.ts / render-sweep-lib.ts.
//
// Scripts/ tooling (not src/ pure-core, DEC-002).

/** The viewport every shot STARTS at -- 1600x900, DESIGN-RULINGS.md:308-316
 * rule 1 ("From the real app, at 1600 x 900"). The 1600 width is the
 * invariant and is never varied per-shot: a doc set at mixed widths is not
 * comparable. The 900 height is now a floor, not a clip -- see
 * DocsShotCapture and docs/design/DEVIATIONS.md (2026-08-16): a
 * `"fullPage"` shot grows taller than 900 rather than cutting the screen
 * off mid-row. */
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

/** The roles a `clickRole` step may name -- the same ARIA roles the admin
 * SPA actually exposes on the controls these prep flows drive (buttons,
 * anchors, checkboxes and the `role="tab"` pills). Kept a closed union so a
 * typo'd role is a compile error rather than a step that silently never
 * matches. */
export type DocsShotStepRole = "button" | "link" | "checkbox" | "tab";

/**
 * One declarative interaction scripts/docs-shots.ts performs before it
 * captures a figure -- how a shot reaches the STATE its caption names (a
 * newly added break, an import dry-run, a recused queue row) rather than
 * the page's cold-load state. Pure data: this module stays playwright-free
 * (see the file header) and scripts/docs-shots.ts is the only interpreter.
 *
 * FAIL LOUDLY: every step is a hard requirement. A selector that never
 * appears, a role/name that matches nothing, a file input that isn't there
 * -- each aborts the whole run rather than capturing a figure that shows
 * the wrong state (the DEC-518 "never a placeholder image" rule applied to
 * state as well as to pixels).
 */
export type DocsShotStep =
  /** Click the first element matching a CSS selector. */
  | { readonly kind: "click"; readonly selector: string }
  /** Click by accessible role + (substring) accessible name. */
  | { readonly kind: "clickRole"; readonly role: DocsShotStepRole; readonly name: string }
  /** Type `value` into the input/textarea at `selector`. */
  | { readonly kind: "fill"; readonly selector: string; readonly value: string }
  /** Choose an option by its visible label in the <select> at `selector`. */
  | { readonly kind: "select"; readonly selector: string; readonly label: string }
  /** Hand an inline, throwaway file to a file input -- never a fixture on
   * disk, so the shoot carries its own sample CSV with it. */
  | { readonly kind: "upload"; readonly selector: string; readonly fileName: string; readonly content: string }
  /** Block until `selector` exists -- the shape a prep flow uses to prove
   * the state it was after actually arrived before the shutter fires. */
  | { readonly kind: "waitFor"; readonly selector: string };

/**
 * How the frame is taken:
 *
 * - `"fullPage"` (the DEFAULT, and what every row without an explicit
 *   `capture` gets): 1600 wide, and TALL ENOUGH TO SHOW THE WHOLE SCREEN.
 *   The admin shell scrolls inside `.chq-main` (app/src/styles.css:
 *   `.chq-shell`/`.chq-main`), not on `<body>`, so a plain 1600x900 clip
 *   cut every long page off mid-row -- the user-filed defect this replaces.
 *   scripts/docs-shots.ts grows the viewport to the tallest scroller's
 *   content height and then captures the whole page.
 * - `"frame"`: exactly the declared 1600x900 viewport. Used ONLY where
 *   growing the viewport makes the shot WORSE -- a `position: fixed`
 *   overlay (a modal card, the agenda's `.chq-toast`) stays pinned to the
 *   viewport, so a tall frame strands it in an ocean of dimmed page
 *   instead of showing it against its own screen.
 *
 * See docs/design/DEVIATIONS.md (2026-08-16) for the ruling this overrides.
 */
export type DocsShotCapture = "fullPage" | "frame";

export interface DocsShotEntry {
  readonly id: string;
  readonly route: string;
  readonly group: DocsShotGroup;
  /** Interactions to perform after landing on `route` and before the
   * shutter fires. Absent means "shoot the page as it loads". */
  readonly prep?: readonly DocsShotStep[];
  /** Absent means `"fullPage"`. */
  readonly capture?: DocsShotCapture;
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
    // Caption: "The task form: a title, a due date, and one choice between
    // all accepted speakers and a selected group." That form is the New
    // task modal, so the figure has to open it -- without this prep it was
    // a byte-identical copy of the roster shot above.
    id: "running-an-event-speakers-tasks-and-content-02",
    route: "/admin/speakers",
    group: "running-an-event",
    prep: [
      { kind: "clickRole", role: "button", name: "New task" },
      { kind: "waitFor", selector: "#task-title" },
      { kind: "fill", selector: "#task-title", value: "Send your session photo" },
      { kind: "fill", selector: "#task-due-date", value: "20 Apr 2027" },
      { kind: "waitFor", selector: 'input[name="task-audience"]' },
    ],
    // The modal is a fixed overlay: a tall frame would strand it above an
    // ocean of dimmed roster.
    capture: "frame",
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
    // Caption: "A new break: one strip that closes the same time slot in
    // every room for the day." So the figure ADDS one (Breaks panel ->
    // Add the break -> Done) and shoots the resulting band on the grid,
    // not the panel that made it. Shoot order matters: the plain day-grid
    // figure above is taken BEFORE this row mutates the day.
    id: "running-an-event-agenda-and-publishing-02",
    route: "/admin/agenda",
    group: "running-an-event",
    prep: [
      { kind: "clickRole", role: "button", name: "Breaks" },
      { kind: "waitFor", selector: "#chq-break-label" },
      { kind: "fill", selector: "#chq-break-label", value: "Afternoon break" },
      { kind: "fill", selector: "#chq-break-start", value: "15:00" },
      { kind: "fill", selector: "#chq-break-duration", value: "20" },
      { kind: "clickRole", role: "button", name: "Add the break" },
      { kind: "clickRole", role: "button", name: "Done" },
      { kind: "waitFor", selector: "text=Afternoon break" },
    ],
  },
  {
    // Caption: "The publish report: the total sessions on the grid, the
    // number that went public, and the held-back number with its cause."
    // That report is what Publish schedule returns -- the held-back panel
    // at the top of the page plus the .chq-toast carrying the counts.
    id: "running-an-event-agenda-and-publishing-03",
    route: "/admin/agenda",
    group: "running-an-event",
    prep: [
      { kind: "clickRole", role: "button", name: "Publish schedule" },
      { kind: "waitFor", selector: ".chq-toast" },
    ],
    // .chq-toast is position:fixed (app/src/styles.css) -- in a tall frame
    // it sits a screen and a half below the panel it belongs with.
    capture: "frame",
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
    // Caption: "A possible-duplicate row in the import wizard: Import as
    // new beside one radio control for each merge option." Reaching it
    // means actually driving the wizard: Import CSV -> upload -> Match the
    // columns -> the DRY-RUN review. The upload is two throwaway rows whose
    // names collide with seeded contacts (Parker Anders has a seeded
    // duplicate pair, so that row shows TWO merge options) but whose
    // addresses do not, which is exactly what
    // findImportDuplicateCandidates (src/domain/contacts-parts/
    // duplicates.ts) calls a possible duplicate. The flow STOPS at the
    // review step: the final "Import 2 rows" is never clicked, so nothing
    // is written and the seed stays clean.
    id: "your-contacts-contacts-pipeline-and-comms-01",
    route: "/admin/contacts",
    group: "your-contacts",
    prep: [
      { kind: "clickRole", role: "button", name: "Import CSV" },
      { kind: "waitFor", selector: "#import-csv-file" },
      {
        kind: "upload",
        selector: "#import-csv-file",
        fileName: "prospects.csv",
        content:
          "firstName,lastName,email,company\n" +
          "Parker,Anders,parker.anders@northlight-imports.test,\n" +
          "Toni,Brightwell,toni.brightwell@northlight-imports.test,Junction Point\n",
      },
      { kind: "clickRole", role: "button", name: "Import 2 rows" },
      { kind: "waitFor", selector: ".chq-contacts-import-review-dupe-group" },
    ],
    capture: "frame",
  },
  {
    // Caption names the pipeline board's five columns -- /admin/contacts
    // lands on the Directory tab, so the board needs its tab clicked.
    id: "your-contacts-contacts-pipeline-and-comms-02",
    route: "/admin/contacts",
    group: "your-contacts",
    prep: [
      { kind: "clickRole", role: "tab", name: "Pipeline" },
      { kind: "waitFor", selector: ".chq-contacts-pipeline-columns" },
    ],
  },
  {
    // Caption: "The compose result after a send: Sent, Skipped, and
    // Remaining reported separately." So the figure sends twice: once to
    // one submission, then again to that submission PLUS another. The
    // dedupe window (one hour, per recipient per submission) holds the
    // first recipient back, which is what puts a real skipped row -- named,
    // with its reason and its retry time -- next to the sent count.
    id: "your-contacts-contacts-pipeline-and-comms-03",
    route: "/admin/comms",
    group: "your-contacts",
    prep: [
      { kind: "click", selector: 'input[aria-label="Select A Practical Guide to Service Meshes"]' },
      { kind: "clickRole", role: "button", name: "Next: choose a template" },
      { kind: "waitFor", selector: "#compose-template" },
      { kind: "select", selector: "#compose-template", label: "Content Reminder" },
      { kind: "clickRole", role: "button", name: "Next: preview" },
      { kind: "clickRole", role: "button", name: "Next: send" },
      { kind: "clickRole", role: "button", name: "Send 1 email" },
      { kind: "clickRole", role: "button", name: "Compose another" },
      { kind: "waitFor", selector: 'input[aria-label="Select A Practical Guide to Service Meshes"]' },
      { kind: "click", selector: 'input[aria-label="Select A Practical Guide to Service Meshes"]' },
      { kind: "click", selector: 'input[aria-label="Select The Hidden Costs of API Design"]' },
      { kind: "clickRole", role: "button", name: "Next: choose a template" },
      { kind: "waitFor", selector: "#compose-template" },
      { kind: "select", selector: "#compose-template", label: "Content Reminder" },
      { kind: "clickRole", role: "button", name: "Next: preview" },
      { kind: "clickRole", role: "button", name: "Next: send" },
      { kind: "clickRole", role: "button", name: "Send 2 emails" },
      { kind: "waitFor", selector: ".chq-comms-send-report-skipped" },
    ],
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
    // ...and the QUEUE, which is what this figure's caption describes, is
    // reached the way a reviewer reaches it: the scorecard's own back link.
    // Keeping `route` on the scorecard is what lets resolveRoleForRoute
    // name a single persona; the prep step is what puts the right screen
    // in the frame.
    prep: [
      { kind: "clickRole", role: "link", name: "Review queue" },
      { kind: "waitFor", selector: ".chq-review-queue-row" },
    ],
  },
  {
    // Caption: "A recused submission is marked RECUSED in your queue, and
    // your assigned and progress numbers adjust to match." So: recuse from
    // the scorecard, walk back to the queue, and expand it far enough to
    // show the recused row (recused rows sort below the scorable ones).
    // Shoot order matters: the clean-queue figure above is taken BEFORE
    // this row recuses.
    id: "for-reviewers-reviewing-start-to-finish-02",
    route: `/admin/review/plans/${PLAN_ID}/submissions/${REVIEWER_SUBMISSION_ID}`,
    group: "for-reviewers",
    prep: [
      { kind: "clickRole", role: "checkbox", name: "Recuse me from this one" },
      { kind: "waitFor", selector: "text=You recused yourself" },
      { kind: "clickRole", role: "link", name: "Review queue" },
      { kind: "waitFor", selector: ".chq-review-queue-footer-showall" },
      { kind: "click", selector: ".chq-review-queue-footer-showall" },
      { kind: "waitFor", selector: ".chq-review-queue-row-recused" },
    ],
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
