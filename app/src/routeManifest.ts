// DEC-144/DEC-139 render-sweep gate: the exhaustive list of app routes the
// browser render-sweep (scripts/render-sweep.ts) visits, one row per route
// pattern. Params are literal ids/slugs pulled from the deterministic seed
// (scripts/seed.ts / scripts/seed-lib.ts's seedId helper) so every entry
// resolves against `npm run seed` data — never invented values.
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
//  - seed_task_assignment_0001: first seeded task assignment row. NOTE: it
//    is not guaranteed to belong to the seeded speaker persona (only
//    accepted submissions' contacts get task assignments in the current
//    seed) — the render-sweep may legitimately report this route as a
//    403/ownership failure until seed data assigns the demo speaker an
//    accepted submission (DEC-145, landing in a different w1 lane).
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

  // --- Admin catch-all (DEC-154, task w2-g's App.tsx <Route path="*">) ---
  // Literal "/*" tail so routeManifest.test.ts's suffix match sees the
  // wildcard segment; noted in w2-g's task text as an expected merge-train
  // touch on this file.
  { path: "/admin/*", role: "organizer" },
] as const;
