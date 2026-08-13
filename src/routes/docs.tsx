// DEC-056: public, no-login API docs page at GET /docs/api. Hand-maintained
// SSR (not runtime introspection) — architectural simplicity, and it
// documents no secrets so it's safe to be public. Route files export a
// named Hono sub-app; only src/index.ts mounts it (DEC-012).

import { Hono } from "hono";
import type { AppEnv } from "../server/env";
import { DEC_056, DEC_012, DEC_013, DEC_382 } from "../decisions";
import { ThemeStyles } from "../views/theme";
import { ToolsStyles } from "./tools.css";

export const docsRoutes = new Hono<AppEnv>();

void DEC_056;
void DEC_012;
void DEC_013;
void DEC_382;

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
        <ThemeStyles />
        <ToolsStyles />
      </head>
      <body>
        <header class="chq-header">
          <a class="chq-wordmark" href="/">
            chautauqua
          </a>
        </header>
        <main class="chq-measure">
          <div class="chq-section">
            <div class="chq-section-label">API docs</div>
            <p>
              All endpoints below are namespaced under <code class="chq-tool-code">/api/v1</code>. This page is
              public and requires no login.
            </p>
          </div>

          <div class="chq-section">
            <div class="chq-section-label">Authentication</div>
            <p>Two ways to authenticate against the API:</p>
            <ul>
              <li>
                <strong>Session cookie</strong> — log in via the browser at <a href="/login">/login</a>; the admin
                SPA and its JSON calls use the resulting session cookie automatically.
              </li>
              <li>
                <strong>Bearer token</strong> — send{" "}
                <code class="chq-tool-code">Authorization: Bearer chq_&hellip;</code>. Tokens are minted under
                Admin &rarr; Settings &rarr; API tokens. Minting a token itself requires an active cookie session
                (tokens cannot mint other tokens).
              </li>
            </ul>
          </div>

          <div class="chq-section">
            <div class="chq-section-label">Envelopes</div>
            <p>Errors (any non-2xx response) are shaped as:</p>
            <pre class="chq-tool-pre">{`{ "error": { "code": "invalid", "message": "...", "fields": { "name": "required" } } }`}</pre>
            <p>List endpoints are shaped as:</p>
            <pre class="chq-tool-pre">{`{ "items": [ ... ], "total": 42, "page": 1, "perPage": 20 }`}</pre>
          </div>

          <div class="chq-section">
            <div class="chq-section-label">CSRF</div>
            <p>
              Cookie-authenticated JSON mutations (POST/PATCH/PUT/DELETE) must include the header{" "}
              <code class="chq-tool-code">x-chq-csrf: 1</code>. This is a same-origin fetch signal, not a secret
              token. Requests authenticated with a <code class="chq-tool-code">Bearer chq_&hellip;</code> token are
              exempt from this check.
            </p>
          </div>

          {ROUTE_GROUPS.map((group) => (
            <div class="chq-section">
              <div class="chq-section-label">{group.title}</div>
              <div class="chq-tool-table-wrap">
                <table class="chq-table">
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
                          <code class="chq-tool-code">{row.path}</code>
                        </td>
                        <td>{row.role}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </main>
      </body>
    </html>
  );
}

docsRoutes.get("/docs/api", async (c) => {
  return c.html(<DocsPage />);
});
