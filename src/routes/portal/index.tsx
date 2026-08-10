// Speaker portal shell, per DEC-005 (/portal/* Hono JSX SSR, light
// progressive enhancement) + DEC-012 (thin handlers: gate -> repo -> render)
// + DEC-016 (status label mapping never leaks internal queue states).
//
// Route files export a named Hono sub-app; only src/index.ts mounts it.

import { Hono } from "hono";
import type { AppEnv } from "../../server/env";
import {
  assertSpeakerContactId,
  getPortalData,
  getPortalSubmissionDetail,
  type PortalData,
  type PortalSubmissionDetail,
} from "../../server/repo/portal";

export const portalRoutes = new Hono<AppEnv>();

// Gate: no session -> /login; a session that isn't a speaker (organizer,
// reviewer) -> /admin. This is deliberately distinct from the JSON-error
// requireSpeaker middleware (DEC-012), which is built for /api/v1 — an SSR
// surface redirects instead of returning a 401/403 body.
portalRoutes.use("*", async (c, next) => {
  const auth = c.var.auth;
  if (!auth) return c.redirect("/login", 302);
  if (auth.role !== "speaker") return c.redirect("/admin", 302);
  await next();
});

function Layout(props: { branding: PortalData["branding"]; children: unknown }) {
  const accent = props.branding.accentColor ?? "#2b2b2b";
  return (
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <title>{props.branding.eventName} - Speaker Portal</title>
        <style>{`:root { --accent: ${accent}; } h1 { color: var(--accent); }`}</style>
      </head>
      <body>
        <header>
          {props.branding.logoUrl ? <img src={props.branding.logoUrl} alt="" height={40} /> : null}
          <h1>{props.branding.eventName}</h1>
          {props.branding.welcomeMessage ? <p>{props.branding.welcomeMessage}</p> : null}
        </header>
        <main>{props.children as any}</main>
      </body>
    </html>
  );
}

function PortalPage(props: { data: PortalData }) {
  const { branding, submissions, tasks } = props.data;
  return (
    <Layout branding={branding}>
      <nav aria-label="Portal navigation">
        <a href="/portal">My Submissions</a>
        {" | "}
        <a href="/portal/profile">Profile</a>
        {" | "}
        <a href="/portal/tasks">Tasks</a>
      </nav>
      <section aria-label="My Submissions">
        <h2>My Submissions</h2>
        {submissions.length === 0 ? (
          <p>You haven't submitted anything yet.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Ref</th>
                <th>Title</th>
                <th>Status</th>
                <th>Submitted</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {submissions.map((s) => (
                <tr>
                  <td>{s.ref}</td>
                  <td>{s.title}</td>
                  <td>{s.statusLabel}</td>
                  <td>{new Date(s.submittedAt).toISOString().slice(0, 10)}</td>
                  <td>
                    <a href={`/portal/submissions/${s.id}`}>View</a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section aria-label="My Tasks">
        <h2>My Tasks</h2>
        {tasks.length === 0 ? (
          <p>No tasks assigned yet.</p>
        ) : (
          <ul>
            {tasks.map((t) => (
              <li>
                {t.title}
                {t.required ? <strong> (required)</strong> : null}
                {t.dueDate ? <span> — due {new Date(t.dueDate).toISOString().slice(0, 10)}</span> : null}
                {" — "}
                {t.status}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-label="Sessions">
        <h2>Sessions</h2>
        <p>Session invitations will appear here.</p>
      </section>

      <section aria-label="Resources">
        <h2>Resources</h2>
        <p>Event resources will appear here.</p>
      </section>
    </Layout>
  );
}

function SubmissionDetailPage(props: { branding: PortalData["branding"]; detail: PortalSubmissionDetail }) {
  const { detail } = props;
  return (
    <Layout branding={props.branding}>
      <a href="/portal">&larr; Back to My Submissions</a>
      <h2>
        {detail.ref}: {detail.title}
      </h2>
      <p>Status: {detail.statusLabel}</p>
      <p>Submitted: {new Date(detail.submittedAt).toISOString().slice(0, 10)}</p>
      {detail.description ? <p>{detail.description}</p> : null}
      <h3>Answers</h3>
      {detail.answers.length === 0 ? (
        <p>No additional answers.</p>
      ) : (
        <dl>
          {detail.answers.map((a) => (
            <>
              <dt>{a.label}</dt>
              <dd>{String(a.value)}</dd>
            </>
          ))}
        </dl>
      )}
    </Layout>
  );
}

portalRoutes.get("/", async (c) => {
  const auth = c.var.auth!;
  const contactId = assertSpeakerContactId(auth);
  const data = await getPortalData(c.var.db, contactId, auth.orgId);
  return c.html(<PortalPage data={data} />);
});

portalRoutes.get("/submissions/:id", async (c) => {
  const auth = c.var.auth!;
  const contactId = assertSpeakerContactId(auth);
  const id = c.req.param("id");
  const detail = await getPortalSubmissionDetail(c.var.db, id, contactId, auth.orgId);
  if (!detail) {
    return c.text("Not found", 404);
  }
  // Re-derive branding for the header; cheap relative to the round trip
  // already spent on the detail query, and keeps this handler thin.
  const data = await getPortalData(c.var.db, contactId, auth.orgId);
  return c.html(<SubmissionDetailPage branding={data.branding} detail={detail} />);
});
