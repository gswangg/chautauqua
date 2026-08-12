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
}

const EVENT_SLUG = "devflow-conf-2027";
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
  {
    path: `/admin/submissions/${SUBMISSION_ID}`,
    role: "organizer",
    params: { id: SUBMISSION_ID },
  },
  { path: "/admin/speakers", role: "organizer" },
  { path: "/admin/content", role: "organizer" },
  { path: "/admin/agenda", role: "organizer" },
  { path: "/admin/comms", role: "organizer" },
  { path: "/admin/contacts", role: "organizer" },
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

  // --- Public submission form (src/routes/public/submit.tsx) ---
  { path: `/submit/${EVENT_SLUG}`, role: "public", params: { eventSlug: EVENT_SLUG } },

  // --- Self-service password change (src/routes/account.tsx, DEC-217 —
  // any authenticated role, one entry per role the sweep logs in as) ---
  { path: "/account/password", role: "organizer" },
  { path: "/account/password", role: "reviewer" },
  { path: "/account/password", role: "speaker" },

  // --- Admin catch-all (DEC-154, task w2-g's App.tsx <Route path="*">) ---
  // Literal "/*" tail so routeManifest.test.ts's suffix match sees the
  // wildcard segment; noted in w2-g's task text as an expected merge-train
  // touch on this file.
  { path: "/admin/*", role: "organizer" },

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
  { path: "/login", role: "public" },
  { path: "/docs/api", role: "public" },
  { path: "/dev/mailbox", role: "public" },
] as const;
