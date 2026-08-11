// DEC-056: public, no-login API docs page at GET /docs/api. Hand-maintained
// SSR (not runtime introspection) — architectural simplicity, and it
// documents no secrets so it's safe to be public. Route files export a
// named Hono sub-app; only src/index.ts mounts it (DEC-012).

import { Hono } from "hono";
import type { AppEnv } from "../server/env";
import { DEC_056, DEC_012, DEC_013 } from "../decisions";

export const docsRoutes = new Hono<AppEnv>();

void DEC_056;
void DEC_012;
void DEC_013;

type Row = { method: string; path: string; role: string };

// Exported for test/docs-route-coverage.test.ts, which mounts the real
// sub-apps the same way src/index.ts does and diffs this table against
// their actual registered routes so this hand-maintained page can't drift.
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
      { method: "DELETE", path: "/api/v1/fields/:fieldId", role: "organizer" },
      { method: "POST", path: "/api/v1/forms/:formId/fields/reorder", role: "organizer" },
    ],
  },
  {
    title: "Submissions",
    rows: [
      { method: "GET", path: "/api/v1/events/:eventId/submissions", role: "organizer" },
      { method: "GET", path: "/api/v1/submissions/:id", role: "organizer" },
      { method: "PATCH", path: "/api/v1/submissions/:id", role: "organizer (edit title/description)" },
      { method: "POST", path: "/api/v1/events/:eventId/submissions", role: "organizer" },
      { method: "POST", path: "/api/v1/submissions/:id/clone", role: "organizer" },
      { method: "POST", path: "/api/v1/events/:eventId/submissions/status", role: "organizer (bulk status change)" },
      {
        method: "POST",
        path: "/api/v1/submissions/:id/participants",
        role: "organizer (invite co-presenter, invite_status='invited')",
      },
      {
        method: "PATCH",
        path: "/api/v1/submissions/:id/participants/:participantId",
        role: "organizer (toggle visible)",
      },
      { method: "GET", path: "/api/v1/submissions/:id/revisions", role: "organizer" },
      {
        method: "POST",
        path: "/api/v1/submissions/:id/revisions/:revisionId/restore",
        role: "organizer",
      },
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
      { method: "POST", path: "/api/v1/plans/:id/advance-round", role: "organizer" },
      { method: "POST", path: "/api/v1/plans/:id/reviewers", role: "organizer" },
      { method: "GET", path: "/api/v1/plans/:id/reviewers", role: "organizer" },
      { method: "DELETE", path: "/api/v1/plans/:id/reviewers/:reviewerId", role: "organizer" },
      { method: "GET", path: "/api/v1/plans/:id/progress", role: "organizer" },
      { method: "GET", path: "/api/v1/plans/:id/results", role: "organizer" },
      { method: "POST", path: "/api/v1/plans/:id/remind", role: "organizer" },
      { method: "GET", path: "/api/v1/review/plans", role: "reviewer" },
      { method: "GET", path: "/api/v1/review/plans/:id/queue", role: "reviewer" },
      { method: "GET", path: "/api/v1/review/submissions/:id", role: "reviewer" },
      { method: "PUT", path: "/api/v1/review/plans/:planId/evaluations/:submissionId", role: "reviewer" },
      { method: "POST", path: "/api/v1/review/plans/:planId/recusals/:submissionId", role: "reviewer" },
      { method: "DELETE", path: "/api/v1/review/plans/:planId/recusals/:submissionId", role: "reviewer" },
    ],
  },
  {
    title: "Users",
    rows: [
      { method: "GET", path: "/api/v1/users", role: "organizer" },
      { method: "POST", path: "/api/v1/users", role: "organizer" },
      { method: "POST", path: "/api/v1/users/:id/reset-password", role: "organizer" },
    ],
  },
  {
    title: "Tasks & assignments",
    rows: [
      { method: "GET", path: "/api/v1/events/:eventId/onboarding", role: "organizer" },
      { method: "POST", path: "/api/v1/events/:eventId/tasks", role: "organizer" },
      { method: "PATCH", path: "/api/v1/tasks/:id", role: "organizer" },
      { method: "DELETE", path: "/api/v1/tasks/:id", role: "organizer" },
      { method: "POST", path: "/api/v1/tasks/:id/assign", role: "organizer" },
      { method: "PATCH", path: "/api/v1/task-assignments/:id", role: "organizer or assigned speaker" },
      { method: "POST", path: "/api/v1/events/:eventId/onboarding/remind", role: "organizer" },
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
      { method: "GET", path: "/api/v1/events/:eventId/email-log", role: "organizer" },
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
    ],
  },
  {
    title: "Files & comments",
    rows: [
      { method: "POST", path: "/api/v1/submissions/:id/files", role: "organizer or submission's speaker" },
      { method: "GET", path: "/api/v1/submissions/:id/files", role: "organizer or submission's speaker" },
      { method: "POST", path: "/api/v1/submissions/:id/content-status", role: "organizer" },
      { method: "GET", path: "/api/v1/events/:eventId/files", role: "organizer" },
      { method: "POST", path: "/api/v1/events/:eventId/files/archive", role: "organizer" },
      { method: "GET", path: "/api/v1/files/:fileId/comments", role: "organizer or submission's speaker" },
      { method: "POST", path: "/api/v1/files/:fileId/comments", role: "organizer or submission's speaker" },
    ],
  },
  {
    title: "Contacts, segments & import",
    rows: [
      { method: "GET", path: "/api/v1/contacts", role: "organizer" },
      { method: "POST", path: "/api/v1/contacts", role: "organizer" },
      { method: "GET", path: "/api/v1/contacts/duplicates", role: "organizer" },
      { method: "GET", path: "/api/v1/contacts/stats", role: "organizer" },
      { method: "GET", path: "/api/v1/contacts/:id", role: "organizer" },
      { method: "PATCH", path: "/api/v1/contacts/:id", role: "organizer" },
      { method: "POST", path: "/api/v1/contacts/:id/headshot", role: "organizer" },
      { method: "POST", path: "/api/v1/contacts/:id/add-to-event", role: "organizer" },
      { method: "POST", path: "/api/v1/contacts/import", role: "organizer" },
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
    title: "Exports",
    rows: [
      {
        method: "GET",
        path: "/api/v1/events/:eventId/export/:kind?format=csv|json",
        role: "organizer (kind: submissions, speakers, evaluations, agenda, email-log)",
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

function DocsPage() {
  return (
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>Chautauqua API docs</title>
        <style>{`body { font-family: system-ui, sans-serif; margin: 0; color: #1a1a1a; } main { max-width: 900px; margin: 2rem auto; padding: 0 1rem 3rem; } h2 { margin-top: 2.5rem; border-bottom: 1px solid #ddd; padding-bottom: 0.25rem; } table { border-collapse: collapse; width: 100%; margin-top: 0.5rem; } th, td { text-align: left; padding: 0.35rem 0.6rem; border-bottom: 1px solid #eee; font-size: 0.92rem; } code, pre { background: #f4f4f4; padding: 0.1rem 0.35rem; border-radius: 3px; font-size: 0.92rem; } pre { padding: 0.75rem; overflow-x: auto; }`}</style>
      </head>
      <body>
        <main>
          <p>
            <a href="/">Chautauqua</a>
          </p>
          <h1>Chautauqua API</h1>
          <p>
            All endpoints below are namespaced under <code>/api/v1</code>. This page is public and requires no login.
          </p>

          <h2>Authentication</h2>
          <p>Two ways to authenticate against the API:</p>
          <ul>
            <li>
              <strong>Session cookie</strong> — log in via the browser at <a href="/login">/login</a>; the admin SPA
              and its JSON calls use the resulting session cookie automatically.
            </li>
            <li>
              <strong>Bearer token</strong> — send <code>Authorization: Bearer chq_&hellip;</code>. Tokens are minted
              under Admin &rarr; Settings &rarr; API tokens. Minting a token itself requires an active cookie
              session (tokens cannot mint other tokens).
            </li>
          </ul>

          <h2>Envelopes</h2>
          <p>Errors (any non-2xx response) are shaped as:</p>
          <pre>{`{ "error": { "code": "invalid", "message": "...", "fields": { "name": "required" } } }`}</pre>
          <p>List endpoints are shaped as:</p>
          <pre>{`{ "items": [ ... ], "total": 42, "page": 1, "perPage": 20 }`}</pre>

          <h2>CSRF</h2>
          <p>
            Cookie-authenticated JSON mutations (POST/PATCH/PUT/DELETE) must include the header{" "}
            <code>x-chq-csrf: 1</code>. This is a same-origin fetch signal, not a secret token. Requests
            authenticated with a <code>Bearer chq_&hellip;</code> token are exempt from this check.
          </p>

          <h2>Endpoints</h2>
          {ROUTE_GROUPS.map((group) => (
            <section>
              <h2>{group.title}</h2>
              <table>
                <thead>
                  <tr>
                    <th>Method</th>
                    <th>Path</th>
                    <th>Role</th>
                  </tr>
                </thead>
                <tbody>
                  {group.rows.map((row) => (
                    <tr>
                      <td>{row.method}</td>
                      <td>
                        <code>{row.path}</code>
                      </td>
                      <td>{row.role}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          ))}
        </main>
      </body>
    </html>
  );
}

docsRoutes.get("/docs/api", async (c) => {
  return c.html(<DocsPage />);
});
