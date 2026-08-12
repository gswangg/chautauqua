// Dev mailbox: read-only viewer over email_log, per DEC-005 ("/dev/mailbox
// dev-only email sink UI, mounted only when env DEV_MODE='1'") and DEC-006
// (DevSinkMailer writes full rendered content inline). Route file exports a
// named Hono sub-app; only src/index.ts mounts it, and only behind the
// shouldMountDevMailbox(env) guard below — when DEV_MODE isn't '1' these
// routes must not exist (404), never merely reject with 403.
//
// SPEC §6: never serve raw recipient-controlled HTML as a page — the HTML
// body is rendered inside a sandboxed <iframe srcdoc> (no same-origin
// scripting/navigation), not injected into the mailbox page's own DOM.

import { Hono } from "hono";
import { isDevMode, type AppEnv, type Bindings } from "../../server/env";
import { getEmailLogById, listEmailLog } from "../../server/repo/email";
import { clampPage, clampPerPage } from "../../lib/pagination";
import { icsDownloadHeaders } from "../../mail/ics";
import { ThemeStyles } from "../../views/theme";
import { ToolsStyles } from "../tools.css";

/** Pure mounting predicate (DEC-005, DEC-434): delegates to the one
 * isDevMode(env) predicate — DEV_MODE must be the exact string '1'.
 * Anything else (unset, 'true', '0', ...) means the routes don't exist at
 * all. */
export function shouldMountDevMailbox(env: Pick<Bindings, "DEV_MODE">): boolean {
  return isDevMode(env);
}

export const devMailboxRoutes = new Hono<AppEnv>();

function formatSentAt(ms: number): string {
  return new Date(ms).toISOString();
}

function MailboxListPage(props: {
  rows: Awaited<ReturnType<typeof listEmailLog>>["items"];
  total: number;
  page: number;
  perPage: number;
}) {
  const { rows, total, page, perPage } = props;
  const hasNext = page * perPage < total;
  const hasPrev = page > 1;
  return (
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>Dev mailbox - Chautauqua</title>
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
            <div class="chq-section-label">Dev mailbox</div>
            <p class="chq-tool-meta">
              {total} message(s) — page {page}
            </p>
            <div class="chq-tool-table-wrap">
              <table class="chq-table">
                <thead>
                  <tr>
                    <th>Recipient</th>
                    <th>Subject</th>
                    <th>Status</th>
                    <th>Sent</th>
                    <th>Event</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr>
                      <td>{row.toEmail}</td>
                      <td>
                        <a href={`/dev/mailbox/${row.id}`}>{row.subject}</a>
                      </td>
                      <td>{row.status}</td>
                      <td>{formatSentAt(row.sentAt)}</td>
                      <td>{row.eventName}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <nav class="chq-pager">
              <span>{hasPrev ? <a class="chq-btn chq-btn-tertiary" href={`/dev/mailbox?page=${page - 1}`}>Newer</a> : null}</span>
              <span>{hasNext ? <a class="chq-btn chq-btn-tertiary" href={`/dev/mailbox?page=${page + 1}`}>Older</a> : null}</span>
            </nav>
          </div>
        </main>
      </body>
    </html>
  );
}

function MailboxDetailPage(props: { row: NonNullable<Awaited<ReturnType<typeof getEmailLogById>>> }) {
  const { row } = props;
  return (
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>{row.subject} - Dev mailbox - Chautauqua</title>
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
          <a class="chq-btn chq-btn-tertiary" href="/dev/mailbox">
            &larr; Back to mailbox
          </a>

          <div class="chq-section">
            <div class="chq-section-label">{row.subject}</div>
            <dl class="chq-kv">
              <dt>To</dt>
              <dd>{row.toEmail}</dd>
              <dt>Status</dt>
              <dd>{row.status}</dd>
              <dt>Sent</dt>
              <dd>{formatSentAt(row.sentAt)}</dd>
              <dt>Event</dt>
              <dd>{row.eventName}</dd>
            </dl>
            {row.icsText ? (
              <p>
                <a class="chq-btn chq-btn-secondary" href={`/dev/mailbox/${row.id}/ics`}>
                  Download calendar invite ({row.icsFilename ?? "invite.ics"})
                </a>
              </p>
            ) : null}
          </div>

          <div class="chq-section">
            <div class="chq-section-label">Text body</div>
            <pre class="chq-tool-pre">{row.bodyText}</pre>
          </div>

          {row.bodyHtml ? (
            <div class="chq-section">
              <div class="chq-section-label">HTML body</div>
              {/* Sandboxed: no same-origin, scripts, or top-level navigation —
                  never trust recipient-facing HTML enough to render it inline
                  (SPEC §6). */}
              <iframe class="chq-tool-iframe" sandbox="" srcdoc={row.bodyHtml} title="HTML email body" />
            </div>
          ) : null}
        </main>
      </body>
    </html>
  );
}

devMailboxRoutes.get("/dev/mailbox", async (c) => {
  const page = clampPage(c.req.query("page"));
  const perPage = clampPerPage(c.req.query("perPage"));
  const { items, total } = await listEmailLog(c.var.db, { page, perPage });
  return c.html(<MailboxListPage rows={items} total={total} page={page} perPage={perPage} />);
});

devMailboxRoutes.get("/dev/mailbox/:emailId/ics", async (c) => {
  const row = await getEmailLogById(c.var.db, c.req.param("emailId"));
  if (!row || !row.icsText) {
    return c.text("Not found", 404);
  }
  const headers = icsDownloadHeaders(row.icsFilename ?? "invite.ics");
  return new Response(row.icsText, { headers });
});

devMailboxRoutes.get("/dev/mailbox/:emailId", async (c) => {
  const row = await getEmailLogById(c.var.db, c.req.param("emailId"));
  if (!row) {
    return c.text("Not found", 404);
  }
  return c.html(<MailboxDetailPage row={row} />);
});
