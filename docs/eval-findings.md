# Eval findings — round 2 (CC-native browser eval, 2026-08-10)

Source: a Claude Code browser-driving eval (subscription-auth, no API key) run
against a fresh seeded `wrangler dev`. This drives the RENDERED app through a
real browser, following redirects — which the API-level walkthrough and unit
tests do not, so it catches UI-reachability bugs they miss. Per DEC-069, fixing
these is code-bearing and reopens the exit predicate: re-run gates before
re-declaring stage-1. Prune entries as they land.

## P0 [FIXED DIRECTLY 2026-08-10 — needs swarm gate-ratification + regression test] — authenticated /admin was an infinite redirect loop

**Fix applied:** `wrangler.jsonc` assets `html_handling: "none"` so the worker's explicit `/admin/index.html` fetch returns 200 instead of ASSETS' auto-trailing-slash 307. Verified: authed /admin + /admin/ -> 200 SPA, deep links + assets 200, unauth -> /login intact. SWARM TODO: ratify under DEC-069 gates and add a redirect-following regression test (authenticate, assert GET /admin/ is 200 SPA not 3xx) — the gap that let this ship.

### Original report

Reproduction (fresh `npm run seed` + `wrangler dev`, real browser or curl):
- Unauthenticated `GET /admin` -> `302 /login` (correct).
- Log in as organizer (sbek-organizer@example.com / SbekTest!2027-org) — login
  succeeds, `chq_session` set, POST /login redirects to /admin.
- Authenticated `GET /admin`  -> `307 Location: /admin/`
- Authenticated `GET /admin/` -> `307 Location: /admin/`  (redirects to ITSELF — infinite loop)
- Browsers report `ERR_TOO_MANY_REDIRECTS`; the built SPA index is never served.

Impact: the entire organizer console (J3 triage, J4 review, J5 disposition,
J6 onboarding dashboard, J9 agenda — most of the rubric, and swyx's #1 stated
requirement "admin ui first") cannot be loaded in a browser. Note this passed
the swarm's own walkthrough + 898 unit tests because those assert against API
routes, never rendering /admin through redirect-following HTTP.

Root cause: `src/routes/root.tsx` — the authed `/admin` and `/admin/*` handlers
call `fetchAsset(c, "/admin/index.html")`, but `fetchAsset` (same file) proxies
the INBOUND request (`c.req.raw`, path `/admin/`) to the ASSETS binding, whose
trailing-slash/html_handling normalization returns `307 -> /admin/`, looping.
The fetchAsset comment already flags "may carry /admin/* path segments ASSETS
doesn't own."

Fix direction: fetchAsset must fetch a NORMALIZED asset request
(`new Request(new URL("/admin/index.html", origin), {headers})`) against ASSETS
instead of passing the inbound `/admin/` path; and/or set the assets binding's
`html_handling`/`not_found_handling` in wrangler.jsonc so `/admin/` does not
307. Add a browser-level (redirect-following) regression test that authenticates
and asserts `GET /admin/` returns 200 with the SPA index, not a 3xx — the gap
that let this ship.
