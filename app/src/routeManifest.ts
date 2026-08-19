// DEC-144/DEC-139 render-sweep gate: the exhaustive list of app routes the
// browser render-sweep (scripts/render-sweep.ts) visits, one row per route
// pattern. Params are literal ids/slugs pulled from the deterministic seed
// (scripts/seed.ts / scripts/seed-lib.ts's seedId helper) so every entry
// resolves against `npm run seed` data — never invented values.
//
// DEC-403: this manifest is the UNION of the SPA's own routes (below) and
// every no-login surface the mobile pass (scripts/render-sweep.ts's
// MOBILE_ROUTE_MANIFEST) visits, so the desktop sweep covers everything the
// mobile sweep covers. The extra entries appended at the bottom of
// ROUTE_MANIFEST reuse the exact same deterministic seed ids/slug as the
// mobile manifest (MOBILE_EVENT_SLUG / MOBILE_SESSION_ID / MOBILE_SPEAKER_ID
// in scripts/render-sweep.ts — same values as EVENT_SLUG/SUBMISSION_ID
// below, restated here as their own constants for clarity of provenance).
//
// Enumerated from:
//  - app/src/App.tsx (organizer SPA nav routes + submissions/forms +
//    submissions/:id)
//  - app/src/pages/Review.tsx (organizer plan tree + reviewer queue/
//    scorecard tree — role gated by DEC-024)
//  - src/routes/portal/{index,profile,tasks,edit}.tsx (mounted at /portal
//    in src/index.ts)
//  - src/routes/public.tsx SURFACES loop (/e/:eventSlug/<surface>) and
//    src/routes/public/submit.tsx (/submit/:eventSlug)
//  - src/routes/account.tsx (/account/password, self-service password
//    change — any authenticated role, mounted at "/" in src/index.ts)
//
// Seed literals used below (all from scripts/seed.ts, deterministic via
// seedId()):
//  - event slug: "devflow-conf-2027" (scripts/seed.ts event insert)
//  - seed_submission_0001: first fixture submission, owned by the seeded
//    speaker persona's contact (seed_contact_0001) — used for both the
//    organizer submission-detail view and the speaker's own portal views.
//  - seed_submission_0002: first submission in track index 0, evaluated by
//    the seeded reviewer persona — used for the reviewer scorecard route.
//  - seed_evaluation_plan_0001: the single seeded evaluation plan.
//  - seed_task_assignment_0001: first seeded task assignment row — task
//    counter 1 of (acceptedSubmissions x taskIds), i.e. contactIdx 0 /
//    taskIdx 0: acceptedSubmissions[0].contactId is seed_contact_0001 (the
//    demo speaker persona, DEC-145) and taskIds[0] is the 'Hotel stay
//    requirement form' template (kind='form'). Its status is pending
//    ((contactIdx+taskIdx) % 3 === 0, scripts/seed.ts). So this id is
//    form-kind, pending, and owned by the seeded speaker's contact — the
//    portal task-form route resolves end-to-end (DEC-172).
export interface RouteManifestEntry {
  readonly path: string;
  readonly role: "organizer" | "reviewer" | "speaker" | "public";
  readonly params?: Record<string, string>;
  /** Expected HTTP status for this row's navigation. Defaults to 200 when
   * omitted (evaluateRoute in scripts/render-sweep-lib.ts). Only rows whose
   * real destination is a deliberate non-200 (e.g. the DEC-945 chromeless
   * 404 for an unmatched /admin/* path) set this. */
  readonly expectedStatus?: number;
  /** Expected pathname the browser lands on after navigation settles.
   * Defaults to `entry.path` when omitted -- only rows whose role cannot
   * reach `entry.path` (a guard redirects it elsewhere) declare where it
   * actually lands, so the sweep grades the real destination instead of
   * silently grading whatever page a redirect happened to land on. */
  readonly expectedLandedPath?: string;
}

export const EVENT_SLUG = "devflow-conf-2027";
const SUBMISSION_ID = "seed_submission_0001";
const REVIEWER_SUBMISSION_ID = "seed_submission_0002";
const PLAN_ID = "seed_evaluation_plan_0001";
const TASK_ASSIGNMENT_ID = "seed_task_assignment_0001";
// Same seed ids as scripts/render-sweep.ts's MOBILE_SESSION_ID / MOBILE_SPEAKER_ID.
const MOBILE_SESSION_ID = SUBMISSION_ID;
const MOBILE_SPEAKER_ID = "seed_contact_0001";

export const ROUTE_MANIFEST: readonly RouteManifestEntry[] = [
  // --- Organizer SPA (app/src/App.tsx NAV_SECTIONS + extra Routes) ---
  { path: "/admin/overview", role: "organizer" },
  { path: "/admin/submissions", role: "organizer" },
  { path: "/admin/submissions/forms", role: "organizer" },
  // DEC-886: session delete is a page at its own URL (app/src/pages/
  // submissions/DeleteSubmissionsPage.tsx) -- ids travel in the query
  // string, not a path param, so no seed-id substitution is needed (mirrors
  // /admin/contacts/merge above).
  { path: "/admin/submissions/delete", role: "organizer" },
  {
    path: `/admin/submissions/${SUBMISSION_ID}`,
    role: "organizer",
    params: { id: SUBMISSION_ID },
  },
  { path: "/admin/speakers", role: "organizer" },
  // DEC-930: per-speaker detail page (app/src/pages/speakers/SpeakerDetailPage.tsx).
  {
    path: "/admin/speakers/seed_contact_0001",
    role: "organizer",
    params: { contactId: "seed_contact_0001" },
  },
  // Design pack v12: the task view (app/src/pages/speakers/TaskView.tsx),
  // "One task, every speaker". taskIds[0] in scripts/seed.ts is
  // seedId("task", 1) -- the 'Hotel stay requirement form' template, the
  // form-kind task the header comment above already names, so this row
  // sweeps the answered tab with real saved responses behind it.
  {
    path: "/admin/speakers/tasks/seed_task_0001",
    role: "organizer",
    params: { taskId: "seed_task_0001" },
  },
  { path: "/admin/content", role: "organizer" },
  // DEC-935: a session's content (deliverables/versions/notes) at its own
  // URL, not behind ?submissionId= on the worklist route.
  {
    path: `/admin/content/${SUBMISSION_ID}`,
    role: "organizer",
    params: { submissionId: SUBMISSION_ID },
  },
  { path: "/admin/agenda", role: "organizer" },
  { path: "/admin/comms", role: "organizer" },
  { path: "/admin/contacts", role: "organizer" },
  // DEC-684: contact merge is a page at its own URL (app/src/pages/contacts/
  // MergePage.tsx), reached from the Duplicates tab -- ids travel in the
  // query string, not a path param, so no seed-id substitution is needed.
  { path: "/admin/contacts/merge", role: "organizer" },
  { path: "/admin/settings", role: "organizer" },

  // --- Organizer review tree (app/src/pages/Review.tsx, me.role !== 'reviewer') ---
  { path: "/admin/review", role: "organizer" },
  { path: "/admin/review/plans/new", role: "organizer" },
  {
    path: `/admin/review/plans/${PLAN_ID}`,
    role: "organizer",
    params: { planId: PLAN_ID },
  },
  {
    path: `/admin/review/plans/${PLAN_ID}/progress`,
    role: "organizer",
    params: { planId: PLAN_ID },
  },
  {
    path: `/admin/review/plans/${PLAN_ID}/results`,
    role: "organizer",
    params: { planId: PLAN_ID },
  },

  // --- Reviewer review tree (app/src/pages/Review.tsx, me.role === 'reviewer') ---
  { path: "/admin/review", role: "reviewer" },
  {
    path: `/admin/review/plans/${PLAN_ID}`,
    role: "reviewer",
    params: { planId: PLAN_ID },
  },
  {
    path: `/admin/review/plans/${PLAN_ID}/submissions/${REVIEWER_SUBMISSION_ID}`,
    role: "reviewer",
    params: { planId: PLAN_ID, submissionId: REVIEWER_SUBMISSION_ID },
  },

  // --- Speaker portal (src/routes/portal/*.tsx, mounted at /portal) ---
  { path: "/portal", role: "speaker" },
  // DEC-747 (findings wave 7 amendment): the organizer-only read-only portal
  // preview (src/routes/portal/preview.tsx). The real page needs an
  // ?eventId= query, which ROUTE_MANIFEST paths cannot carry (audit-claims
  // matches a row's path against the route PATTERN segment by segment, and
  // no row anywhere in this manifest has a query string), so the bare path
  // is what the sweep visits — and the bare path's honest destination IS the
  // 404 card, the same one PortalSettingsPanel's link produces when no event
  // is selected. The populated preview is covered by test/portal-preview.test.ts,
  // not by the render sweep.
  { path: "/portal/preview", role: "organizer", expectedStatus: 404 },
  // DEC-729: the speaker's own submission list (every submission they own,
  // pending and declined included) — a static path, like /portal/tasks.
  { path: "/portal/submissions", role: "speaker" },
  {
    path: `/portal/submissions/${SUBMISSION_ID}`,
    role: "speaker",
    params: { id: SUBMISSION_ID },
  },
  {
    path: `/portal/submissions/${SUBMISSION_ID}/edit`,
    role: "speaker",
    params: { id: SUBMISSION_ID },
  },
  { path: "/portal/profile", role: "speaker" },
  { path: "/portal/tasks", role: "speaker" },
  {
    path: `/portal/tasks/${TASK_ASSIGNMENT_ID}/form`,
    role: "speaker",
    params: { assignmentId: TASK_ASSIGNMENT_ID },
  },

  // --- Public surfaces (src/routes/public.tsx SURFACES loop) ---
  { path: `/e/${EVENT_SLUG}/sessions`, role: "public", params: { eventSlug: EVENT_SLUG } },
  { path: `/e/${EVENT_SLUG}/speakers`, role: "public", params: { eventSlug: EVENT_SLUG } },
  { path: `/e/${EVENT_SLUG}/gallery`, role: "public", params: { eventSlug: EVENT_SLUG } },
  { path: `/e/${EVENT_SLUG}/agenda`, role: "public", params: { eventSlug: EVENT_SLUG } },
  { path: `/e/${EVENT_SLUG}/schedule`, role: "public", params: { eventSlug: EVENT_SLUG } },
  // DEC-683 amendment (wave 65): the printable programme -- a public,
  // no-login HTML GET like the surfaces above, so the render sweep must
  // visit it (DEC-679: every composed HTML GET is manifested or excluded).
  { path: `/e/${EVENT_SLUG}/programme`, role: "public", params: { eventSlug: EVENT_SLUG } },

  // --- Public submission form (src/routes/public/submit.tsx) ---
  { path: `/submit/${EVENT_SLUG}`, role: "public", params: { eventSlug: EVENT_SLUG } },

  // --- Self-service password change (src/routes/account.tsx, DEC-217 —
  // any authenticated role, one entry per role the sweep logs in as) ---
  { path: "/account/password", role: "organizer" },
  { path: "/account/password", role: "reviewer" },
  { path: "/account/password", role: "speaker" },

  // --- Sign-out (src/routes/auth-login.tsx, DEC-154 amendment wave 8/w45-a
  // correction) — GET /logout has no screen for any role: a bare GET side
  // effect would be a CSRF hole, so it mutates nothing and always 302s
  // straight to /login (loginRoutes.get("/logout", ...) unconditionally
  // redirects, regardless of role). Both rows below declare
  // expectedLandedPath so the sweep grades the real destination instead of
  // vacuously re-grading the sign-in card as if it were /logout's own
  // content (w45-a: the prior "renders a real confirmation card" comment
  // here was stale — the route has always been an inert redirect). ---
  { path: "/logout", role: "organizer", expectedLandedPath: "/login" },
  { path: "/logout", role: "speaker", expectedLandedPath: "/login" },

  // --- Admin catch-all (DEC-154, task w2-g's App.tsx <Route path="*">) ---
  // Literal "/*" tail so routeManifest.test.ts's suffix match sees the
  // wildcard segment; noted in w2-g's task text as an expected merge-train
  // touch on this file. w45-a: matchesAdminRoute("/*") is FALSE (no admin
  // route pattern matches a literal "*" segment), so src/routes/root.tsx's
  // DEC-945 chromeless-404 branch answers this path with a real 404 -- the
  // sweep must expect that, not 200.
  { path: "/admin/*", role: "organizer", expectedStatus: 404 },

  // --- DEC-403: no-login surfaces the mobile pass visits, not otherwise
  // reachable from App.tsx's own <Route> tree, added so the desktop sweep
  // covers everything the mobile sweep covers. ---
  {
    path: `/e/${EVENT_SLUG}/sessions/${MOBILE_SESSION_ID}`,
    role: "public",
    params: { eventSlug: EVENT_SLUG, sessionId: MOBILE_SESSION_ID },
  },
  {
    path: `/e/${EVENT_SLUG}/speakers/${MOBILE_SPEAKER_ID}`,
    role: "public",
    params: { eventSlug: EVENT_SLUG, speakerId: MOBILE_SPEAKER_ID },
  },
  { path: `/embed/${EVENT_SLUG}/sessions`, role: "public", params: { eventSlug: EVENT_SLUG } },
  { path: `/embed/${EVENT_SLUG}/agenda`, role: "public", params: { eventSlug: EVENT_SLUG } },
  { path: `/embed/${EVENT_SLUG}/speakers`, role: "public", params: { eventSlug: EVENT_SLUG } },
  // DEC-489/DEC-490 (task-w25-d): the remaining two of the five public-
  // surface embed twins (SURFACES in src/routes/public/shell.tsx is
  // sessions/speakers/agenda/schedule/gallery) — /embed/:slug/schedule and
  // /embed/:slug/gallery were missing from this manifest even though the
  // producer-side embed generator (app/src/pages/settings/EmbedsPanel.tsx)
  // and the generic `/embed/:eventSlug/:surface` route (src/routes/public/
  // index.tsx) already support all five.
  { path: `/embed/${EVENT_SLUG}/schedule`, role: "public", params: { eventSlug: EVENT_SLUG } },
  { path: `/embed/${EVENT_SLUG}/gallery`, role: "public", params: { eventSlug: EVENT_SLUG } },
  // DEC-679 (task-w13-e): the two /embed detail-page twins of the
  // /e/:eventSlug/sessions/:sessionId and /e/:eventSlug/speakers/:contactId
  // drill-ins already listed above (src/routes/public/index.tsx :235/:249,
  // DEC-672) — registered when task-w12-c added the routes but never added
  // here, so gate:render-sweep never visited them. Same deterministic seed
  // ids as their /e twins (MOBILE_SESSION_ID / MOBILE_SPEAKER_ID).
  {
    path: `/embed/${EVENT_SLUG}/sessions/${MOBILE_SESSION_ID}`,
    role: "public",
    params: { eventSlug: EVENT_SLUG, sessionId: MOBILE_SESSION_ID },
  },
  {
    path: `/embed/${EVENT_SLUG}/speakers/${MOBILE_SPEAKER_ID}`,
    role: "public",
    params: { eventSlug: EVENT_SLUG, speakerId: MOBILE_SPEAKER_ID },
  },
  { path: "/login", role: "public" },
  // DEC-014 (wave-25 amendment): the "forgot password" form is a plain
  // public GET with no token and no seed data -- idempotently visitable,
  // so it gets a real manifest entry rather than an exclusion. Its sibling
  // /reset/:token is single-use and excluded in test/audit-claims.test.ts.
  { path: "/forgot", role: "public" },
  { path: "/docs/api", role: "public" },
  // DEC-382 wave-3 amendment: the public docs site (src/routes/docs-site.tsx)
  // -- the index and one concrete article slug ("start-here",
  // src/routes/docs-content/start-here.ts) so the sweep visits a real
  // article, not just the index shell.
  { path: "/docs", role: "public" },
  { path: "/docs/start-here", role: "public" },
  // w45-a: guardDevMailbox (src/server/app.ts) redirects an anonymous
  // visitor to /login and requires role 'organizer' -- this row was
  // declaring role: "public" but no anonymous visitor can actually reach
  // this path, so the sweep was vacuously grading the sign-in card. Flipped
  // to organizer (matches the seeded organizer persona that logs in for
  // every other "role: organizer" row).
  { path: "/dev/mailbox", role: "organizer" },

  // --- DEC-985 (task w32-c): four routes the render sweep never visited
  // because HTML_ROUTE_EXCLUDED (test/audit-claims.test.ts) parked them
  // behind "pre-existing gap" reasons instead of wiring them up. ---
  // DEC-581/582: the anonymous event hub (src/routes/root.tsx) -- 302s to
  // the signed-in user's default surface when a session exists, otherwise
  // renders HTML directly, so it must be swept as `public`.
  { path: "/", role: "public" },
  // Speaker-facing resources list page (src/routes/portal/...), no dynamic
  // segment -- a static path like /portal/tasks.
  { path: "/portal/resources", role: "speaker" },
  // Single sent-email detail view. scripts/seed.ts:2370 seeds email_log
  // rows via seedId("email_log", i + 1); the first is seed_email_log_0001.
  // w45-a: role flipped to organizer for the same reason as the bare
  // /dev/mailbox row above -- guardDevMailbox requires role 'organizer'.
  {
    path: "/dev/mailbox/seed_email_log_0001",
    role: "organizer",
    params: { emailId: "seed_email_log_0001" },
  },
  // DEC-785 (task w3-d): the saved-embed public route. scripts/seed.ts:787
  // seeds seed_embed_0001 as "AI track sessions" with enabled: true (the
  // sibling seed_embed_0002 "Last year's speakers" is disabled) -- so this
  // literal resolves to the enabled row, not the disabled one that would
  // serve an empty 200.
  {
    path: "/embed/e/seed_embed_0001",
    role: "public",
    params: { embedId: "seed_embed_0001" },
  },
] as const;
