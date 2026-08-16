// DEC-518 (wave 42 amendment): the /docs/api endpoint table is a cross-file
// manifest of the router (J12: the documented REST API is the product's
// premise) and must live in exactly ONE place, JSX-free, so it can be
// diffed against the real registered routes at test time
// (test/docs-api-manifest.scan.test.ts) without importing anything that
// pulls in JSX/Hono render machinery. src/routes/docs.tsx renders from
// these arrays; it does not hand-type any row itself.

export interface Row {
  method: string;
  path: string;
  role: string;
}

/** Grouped rows for the documented /api/v1 surface (rendered as one table
 * per group on /docs/api), and the same rows flattened with a `group` field
 * for test/docs-api-manifest.scan.test.ts's live-route diff. */
export const ROUTE_GROUPS: { title: string; rows: Row[] }[] = [
  {
    title: "Events, tracks & rooms",
    rows: [
      { method: "GET", path: "/api/v1/events", role: "organizer" },
      { method: "POST", path: "/api/v1/events", role: "organizer" },
      { method: "GET", path: "/api/v1/events/:eventId", role: "organizer" },
      { method: "PATCH", path: "/api/v1/events/:eventId", role: "organizer" },
      { method: "GET", path: "/api/v1/events/:eventId/tracks", role: "organizer" },
      { method: "POST", path: "/api/v1/events/:eventId/tracks", role: "organizer" },
      { method: "PATCH", path: "/api/v1/tracks/:trackId", role: "organizer" },
      { method: "DELETE", path: "/api/v1/tracks/:trackId", role: "organizer" },
      { method: "GET", path: "/api/v1/events/:eventId/rooms", role: "organizer" },
      { method: "POST", path: "/api/v1/events/:eventId/rooms", role: "organizer" },
      { method: "PATCH", path: "/api/v1/rooms/:roomId", role: "organizer" },
      { method: "DELETE", path: "/api/v1/rooms/:roomId", role: "organizer" },
      { method: "GET", path: "/api/v1/events/:eventId/overview", role: "organizer" },
      { method: "GET", path: "/api/v1/events/:eventId/public-surfaces", role: "organizer (per-surface published counts, DEC-767)" },
    ],
  },
  {
    title: "Portal settings & resources",
    rows: [
      { method: "GET", path: "/api/v1/events/:eventId/portal-settings", role: "organizer" },
      { method: "PUT", path: "/api/v1/events/:eventId/portal-settings", role: "organizer" },
      { method: "GET", path: "/api/v1/events/:eventId/resources", role: "organizer" },
      { method: "POST", path: "/api/v1/events/:eventId/resources", role: "organizer (JSON -> wiki, multipart -> file)" },
      { method: "PATCH", path: "/api/v1/resources/:resourceId", role: "organizer" },
      { method: "DELETE", path: "/api/v1/resources/:resourceId", role: "organizer" },
    ],
  },
  {
    title: "Forms & fields",
    rows: [
      { method: "GET", path: "/api/v1/events/:eventId/forms", role: "organizer" },
      { method: "PATCH", path: "/api/v1/forms/:formId", role: "organizer" },
      { method: "POST", path: "/api/v1/forms/:formId/fields", role: "organizer" },
      { method: "PATCH", path: "/api/v1/fields/:fieldId", role: "organizer" },
      { method: "DELETE", path: "/api/v1/fields/:fieldId", role: "organizer (409 if dependent rules/answers exist; ?cascade=1 to confirm)" },
      { method: "POST", path: "/api/v1/forms/:formId/fields/reorder", role: "organizer" },
    ],
  },
  {
    title: "Submissions",
    rows: [
      { method: "GET", path: "/api/v1/events/:eventId/submissions", role: "organizer" },
      { method: "GET", path: "/api/v1/submissions/:id", role: "organizer" },
      { method: "PATCH", path: "/api/v1/submissions/:id", role: "organizer (edit title/description/trackIds)" },
      { method: "POST", path: "/api/v1/events/:eventId/submissions", role: "organizer" },
      { method: "POST", path: "/api/v1/submissions/:id/clone", role: "organizer" },
      { method: "POST", path: "/api/v1/events/:eventId/submissions/status", role: "organizer (bulk status change)" },
      {
        method: "GET",
        path: "/api/v1/events/:eventId/submissions/delete-plan",
        role: "organizer (blast-radius preview for the delete confirmation page; DEC-921)",
      },
      {
        method: "POST",
        path: "/api/v1/events/:eventId/submissions/delete",
        role: "organizer (guarded cascade delete; DEC-886, refuses any id with a submitted evaluation)",
      },
      {
        method: "POST",
        path: "/api/v1/submissions/:id/participants",
        role: "organizer (invite co-presenter, invite_status='invited')",
      },
      {
        method: "PATCH",
        path: "/api/v1/submissions/:id/participants/:participantId",
        role: "organizer (toggle visible, set inviteStatus)",
      },
      {
        method: "DELETE",
        path: "/api/v1/submissions/:id/participants/:participantId",
        role: "organizer (remove a co-presenter; the lead participant cannot be removed)",
      },
      { method: "GET", path: "/api/v1/submissions/:id/revisions", role: "organizer" },
      {
        method: "POST",
        path: "/api/v1/submissions/:id/revisions/:revisionId/restore",
        role: "organizer",
      },
      { method: "GET", path: "/api/v1/submissions/:id/history", role: "organizer" },
    ],
  },
  {
    title: "Speaker pipeline",
    rows: [
      { method: "GET", path: "/api/v1/pipeline", role: "organizer" },
      { method: "POST", path: "/api/v1/pipeline", role: "organizer" },
      { method: "GET", path: "/api/v1/pipeline/:id", role: "organizer" },
      { method: "PATCH", path: "/api/v1/pipeline/:id", role: "organizer" },
      { method: "POST", path: "/api/v1/pipeline/:id/notes", role: "organizer" },
    ],
  },
  {
    title: "Review: plans, queue, evaluations, results",
    rows: [
      { method: "GET", path: "/api/v1/events/:eventId/plans", role: "organizer" },
      { method: "POST", path: "/api/v1/events/:eventId/plans", role: "organizer" },
      { method: "GET", path: "/api/v1/plans/:id", role: "organizer" },
      { method: "PATCH", path: "/api/v1/plans/:id", role: "organizer" },
      { method: "DELETE", path: "/api/v1/plans/:id", role: "organizer" },
      { method: "GET", path: "/api/v1/plans/:id/delete-preview", role: "organizer (DEC-929: names what the DELETE below destroys)" },
      { method: "POST", path: "/api/v1/plans/:id/advance-round", role: "organizer" },
      { method: "POST", path: "/api/v1/plans/:id/waves", role: "organizer" },
      { method: "POST", path: "/api/v1/plans/:id/reviewers", role: "organizer" },
      { method: "GET", path: "/api/v1/plans/:id/reviewers", role: "organizer" },
      { method: "DELETE", path: "/api/v1/plans/:id/reviewers/:reviewerId", role: "organizer" },
      { method: "GET", path: "/api/v1/plans/:id/scope-preview", role: "organizer" },
      { method: "GET", path: "/api/v1/plans/:id/progress", role: "organizer" },
      { method: "GET", path: "/api/v1/plans/:id/results", role: "organizer" },
      { method: "POST", path: "/api/v1/plans/:id/remind", role: "organizer" },
      { method: "GET", path: "/api/v1/review/plans", role: "reviewer" },
      {
        method: "GET",
        path: "/api/v1/review/plans/:id",
        role: "reviewer (DEC-819: the plan-scoped queue's own name, same assignment scoping as its /queue)",
      },
      { method: "GET", path: "/api/v1/review/plans/:id/queue", role: "reviewer" },
      { method: "GET", path: "/api/v1/review/submissions/:id", role: "reviewer" },
      {
        method: "GET",
        path: "/api/v1/submissions/:id/evaluations",
        role: "organizer (DEC-596: every evaluation of one submission, across plans; DEC-736: reviewerName always populated; DEC-723: each item carries its own round's criteria + weighted score)",
      },
      { method: "PUT", path: "/api/v1/review/plans/:planId/evaluations/:submissionId", role: "reviewer" },
      { method: "POST", path: "/api/v1/review/plans/:planId/recusals/:submissionId", role: "reviewer" },
      { method: "DELETE", path: "/api/v1/review/plans/:planId/recusals/:submissionId", role: "reviewer" },
      {
        method: "GET",
        path: "/api/v1/plans/:id/assignments/distribute/preview",
        role: "organizer (DEC-786: pure round-robin preview, writes nothing)",
      },
      { method: "POST", path: "/api/v1/plans/:id/assignments/distribute", role: "organizer (DEC-786: applies exactly the previewed pairs)" },
    ],
  },
  {
    title: "Users",
    rows: [
      { method: "GET", path: "/api/v1/users", role: "organizer" },
      { method: "POST", path: "/api/v1/users", role: "organizer" },
      { method: "POST", path: "/api/v1/users/:id/reset-password", role: "organizer" },
      { method: "PATCH", path: "/api/v1/users/:id", role: "organizer (DEC-778: role change; refuses self and the org's last organizer)" },
    ],
  },
  {
    title: "Tasks & assignments",
    rows: [
      { method: "GET", path: "/api/v1/events/:eventId/onboarding", role: "organizer" },
      { method: "GET", path: "/api/v1/events/:eventId/speakers/:contactId", role: "organizer (DEC-930: per-speaker detail read)" },
      { method: "POST", path: "/api/v1/events/:eventId/tasks", role: "organizer" },
      { method: "PATCH", path: "/api/v1/tasks/:id", role: "organizer" },
      { method: "DELETE", path: "/api/v1/tasks/:id", role: "organizer" },
      { method: "GET", path: "/api/v1/tasks/:id/delete-preview", role: "organizer (DEC-933 amendment: names what the DELETE above destroys)" },
      { method: "POST", path: "/api/v1/tasks/:id/assign", role: "organizer" },
      { method: "PATCH", path: "/api/v1/task-assignments/:id", role: "organizer or assigned speaker" },
      { method: "GET", path: "/api/v1/task-assignments/:id/response", role: "organizer (kind='form' only)" },
      { method: "POST", path: "/api/v1/events/:eventId/onboarding/remind", role: "organizer" },
      { method: "POST", path: "/api/v1/events/:eventId/onboarding/remind/preview", role: "organizer" },
    ],
  },
  {
    title: "Templates, compose & email log",
    rows: [
      { method: "GET", path: "/api/v1/events/:eventId/templates", role: "organizer" },
      { method: "POST", path: "/api/v1/events/:eventId/templates", role: "organizer" },
      { method: "PATCH", path: "/api/v1/templates/:templateId", role: "organizer" },
      { method: "DELETE", path: "/api/v1/templates/:templateId", role: "organizer" },
      { method: "POST", path: "/api/v1/events/:eventId/compose/preview", role: "organizer" },
      { method: "POST", path: "/api/v1/events/:eventId/compose/send", role: "organizer" },
      { method: "POST", path: "/api/v1/events/:eventId/portal-invites", role: "organizer" },
      { method: "GET", path: "/api/v1/events/:eventId/email-log", role: "organizer" },
      { method: "GET", path: "/api/v1/events/:eventId/email-log/:emailId", role: "organizer" },
      { method: "GET", path: "/api/v1/mail-status", role: "organizer (DEC-996: provider/configured/fromEmail, never binding internals)" },
    ],
  },
  {
    title: "Agenda & slots",
    rows: [
      { method: "GET", path: "/api/v1/events/:eventId/agenda", role: "organizer" },
      { method: "PUT", path: "/api/v1/submissions/:id/slot", role: "organizer" },
      { method: "DELETE", path: "/api/v1/submissions/:id/slot", role: "organizer" },
      { method: "POST", path: "/api/v1/events/:eventId/agenda/publish", role: "organizer" },
      { method: "POST", path: "/api/v1/events/:eventId/agenda/auto-schedule", role: "organizer" },
      { method: "GET", path: "/api/v1/events/:eventId/breaks", role: "organizer" },
      { method: "POST", path: "/api/v1/events/:eventId/breaks", role: "organizer" },
      { method: "PATCH", path: "/api/v1/breaks/:id", role: "organizer" },
      { method: "DELETE", path: "/api/v1/breaks/:id", role: "organizer" },
    ],
  },
  {
    title: "Files & comments",
    rows: [
      { method: "POST", path: "/api/v1/submissions/:id/files", role: "organizer or submission's speaker" },
      { method: "GET", path: "/api/v1/submissions/:id/files", role: "organizer or submission's speaker" },
      { method: "POST", path: "/api/v1/submissions/:id/content-status", role: "organizer" },
      { method: "POST", path: "/api/v1/submissions/:id/content-note", role: "organizer" },
      { method: "POST", path: "/api/v1/events/:eventId/submissions/content-status", role: "organizer" },
      { method: "GET", path: "/api/v1/events/:eventId/files", role: "organizer" },
      { method: "POST", path: "/api/v1/events/:eventId/files/archive", role: "organizer" },
      { method: "GET", path: "/api/v1/files/:fileId/comments", role: "organizer or submission's speaker" },
      { method: "POST", path: "/api/v1/files/:fileId/comments", role: "organizer or submission's speaker" },
      {
        method: "DELETE",
        path: "/api/v1/files/:fileId",
        role: "organizer (any version), or the uploading speaker (own latest version, pending only)",
      },
    ],
  },
  {
    title: "Contacts, segments & import",
    rows: [
      { method: "GET", path: "/api/v1/contacts", role: "organizer" },
      { method: "POST", path: "/api/v1/contacts", role: "organizer" },
      { method: "GET", path: "/api/v1/contacts/duplicates", role: "organizer" },
      { method: "POST", path: "/api/v1/contacts/duplicates/dismiss", role: "organizer (DEC-770 'Not a duplicate' / 'Keep both')" },
      { method: "GET", path: "/api/v1/contacts/duplicates/check", role: "organizer (DEC-788 create-time duplicate hint)" },
      { method: "GET", path: "/api/v1/contacts/stats", role: "organizer" },
      { method: "GET", path: "/api/v1/contacts/:id", role: "organizer" },
      { method: "PATCH", path: "/api/v1/contacts/:id", role: "organizer" },
      { method: "DELETE", path: "/api/v1/contacts/:id", role: "organizer (409 naming dependent counts; merge instead, DEC-758)" },
      { method: "POST", path: "/api/v1/contacts/:id/headshot", role: "organizer" },
      { method: "POST", path: "/api/v1/contacts/:id/add-to-event", role: "organizer" },
      { method: "POST", path: "/api/v1/contacts/import", role: "organizer" },
      { method: "POST", path: "/api/v1/events/:eventId/import/sessionboard", role: "organizer" },
      { method: "GET", path: "/api/v1/contacts/merge/preview", role: "organizer" },
      { method: "POST", path: "/api/v1/contacts/merge", role: "organizer" },
      { method: "POST", path: "/api/v1/contacts/bulk-email", role: "organizer" },
      { method: "POST", path: "/api/v1/contacts/bulk-email/preview", role: "organizer" },
      { method: "GET", path: "/api/v1/segments", role: "organizer" },
      { method: "POST", path: "/api/v1/segments", role: "organizer" },
      { method: "PATCH", path: "/api/v1/segments/:id", role: "organizer" },
      { method: "DELETE", path: "/api/v1/segments/:id", role: "organizer" },
    ],
  },
  {
    title: "Saved views",
    rows: [
      { method: "GET", path: "/api/v1/events/:eventId/views", role: "organizer" },
      { method: "POST", path: "/api/v1/events/:eventId/views", role: "organizer" },
      { method: "DELETE", path: "/api/v1/views/:id", role: "organizer" },
    ],
  },
  {
    title: "Saved embeds",
    rows: [
      { method: "GET", path: "/api/v1/events/:eventId/embeds", role: "organizer" },
      { method: "POST", path: "/api/v1/events/:eventId/embeds", role: "organizer" },
      { method: "PATCH", path: "/api/v1/embeds/:id", role: "organizer" },
      { method: "DELETE", path: "/api/v1/embeds/:id", role: "organizer" },
    ],
  },
  {
    title: "Exports",
    rows: [
      {
        method: "GET",
        path: "/api/v1/events/:eventId/export/:kind?format=csv|json",
        role: "organizer (kind: submissions, speakers, evaluations, agenda, email-log, contacts (DEC-597, org-scoped))",
      },
      {
        method: "GET",
        path: "/api/v1/events/:eventId/exports/showflow.csv",
        role: "organizer (fixed-column show-flow export, DEC-055)",
      },
    ],
  },
  {
    title: "API tokens",
    rows: [
      { method: "GET", path: "/api/v1/tokens", role: "organizer" },
      { method: "POST", path: "/api/v1/tokens", role: "organizer (cookie session only, DEC-027)" },
      { method: "DELETE", path: "/api/v1/tokens/:id", role: "organizer" },
    ],
  },
  {
    title: "Current user",
    rows: [{ method: "GET", path: "/api/v1/me", role: "any authenticated user" }],
  },
];

export const PUBLIC_ROUTE_GROUPS: { title: string; rows: Row[] }[] = [
  {
    title: "Instance home & docs",
    rows: [
      {
        method: "GET",
        path: "/",
        role: "public event hub — the org's events grouped by open CFP / published programme / past; signed-in users are redirected to /admin or /portal",
      },
      { method: "GET", path: "/docs/api", role: "this page" },
    ],
  },
  {
    title: "Public event surfaces (HTML)",
    rows: [
      { method: "GET", path: "/e/:eventSlug", role: "public (redirects to /e/:eventSlug/sessions)" },
      { method: "GET", path: "/e/:eventSlug/sessions", role: "public" },
      { method: "GET", path: "/e/:eventSlug/speakers", role: "public" },
      { method: "GET", path: "/e/:eventSlug/gallery", role: "public" },
      { method: "GET", path: "/e/:eventSlug/agenda", role: "public" },
      { method: "GET", path: "/e/:eventSlug/schedule", role: "public" },
      { method: "GET", path: "/e/:eventSlug/sessions/:sessionId", role: "public" },
      { method: "GET", path: "/e/:eventSlug/speakers/:contactId", role: "public" },
      { method: "GET", path: "/e/:eventSlug/programme", role: "public (print-first one-page programme)" },
    ],
  },
  {
    title: "Public calendar feeds",
    rows: [
      { method: "GET", path: "/e/:eventSlug/agenda.ics", role: "public (whole published agenda)" },
      { method: "GET", path: "/e/:eventSlug/schedule.ics", role: "public (itinerary; ?ids= selects a subset)" },
    ],
  },
  {
    title: "Embeds (chromeless, iframe-safe)",
    rows: [
      { method: "GET", path: "/embed/:eventSlug/:surface", role: "public, chromeless, iframe-safe" },
      { method: "GET", path: "/embed/:eventSlug/:surface.json", role: "public, chromeless, iframe-safe (JSON feed twin)" },
      { method: "GET", path: "/embed/:eventSlug/:surface.xml", role: "public, chromeless, iframe-safe (XML feed twin)" },
      { method: "GET", path: "/embed/:eventSlug/sessions/:sessionId", role: "public, chromeless, iframe-safe" },
      { method: "GET", path: "/embed/:eventSlug/speakers/:contactId", role: "public, chromeless, iframe-safe" },
      { method: "GET", path: "/embed/e/:embedId", role: "public, saved embed; disabled returns an empty 200" },
    ],
  },
  {
    title: "Public submission (CFP)",
    rows: [{ method: "GET", path: "/submit/:eventSlug", role: "public" }],
  },
];

export interface ApiDocEndpoint {
  method: string;
  path: string;
  role: string;
  group: string;
}

/** Flattened, single-source manifest of every documented /api/v1 row for
 * test/docs-api-manifest.scan.test.ts's two-directional diff against
 * enumerateRegisteredRoutes(). Derived from ROUTE_GROUPS (the same array
 * docs.tsx renders) so there is exactly one place these rows are typed. */
export const API_DOC_ENDPOINTS: ApiDocEndpoint[] = ROUTE_GROUPS.flatMap((g) =>
  g.rows.map((r) => ({ ...r, group: g.title })),
);
