// DEC-056: public, no-login API docs page at GET /docs/api. Hand-maintained
// SSR (not runtime introspection) — architectural simplicity, and it
// documents no secrets so it's safe to be public. Route files export a
// named Hono sub-app; only src/index.ts mounts it (DEC-012).

import { Hono } from "hono";
import type { AppEnv } from "../server/env";
import { DEC_056, DEC_012, DEC_013, DEC_382, DEC_518 } from "../decisions";
import { ThemeStyles } from "../views/theme";
import { ToolsStyles } from "./tools.css";
import { ROUTE_GROUPS, PUBLIC_ROUTE_GROUPS } from "./docs-endpoints";

export const docsRoutes = new Hono<AppEnv>();

void DEC_056;
void DEC_012;
void DEC_013;
void DEC_382;
void DEC_518;

// DEC-518 (wave 42 amendment): the endpoint rows themselves live in the
// JSX-free src/routes/docs-endpoints.ts (the single source
// test/docs-api-manifest.scan.test.ts diffs against the real router) — this
// file re-exports them so existing consumers (test/docs-route-coverage.test.ts,
// test/api-docs-enumerated.test.ts, test/readme-evaluator-surfaces.test.ts)
// keep working unchanged, and renders from them below.
export { ROUTE_GROUPS, PUBLIC_ROUTE_GROUPS };

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

          <div class="chq-section">
            <div class="chq-section-label">Public read surfaces (no login)</div>
            <p>
              Everything below needs no token and no login — no <code class="chq-tool-code">Authorization</code>{" "}
              header, no session cookie.
            </p>
          </div>

          {PUBLIC_ROUTE_GROUPS.map((group) => (
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
