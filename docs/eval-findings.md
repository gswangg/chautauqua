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

## Round 3 (CC-native browser eval — abstract-management area, 2026-08-10)

Passing: ABS-08 (progress dashboard), ABS-10 (results/aggregate, ranked; note headers not click-sortable), ABS-13 (results CSV export). Partial/blocked below.

### [FIXED 2026-08-10, needs swarm ratify+test] /admin/submissions SPA crash
`TypeError: n is not iterable` — SubmissionsTable read `res.items` from `/events/:id/forms`, which returns a single form OBJECT with `.fields[]`, not a list envelope. Fixed to apiGet + res.fields. (Was blocking triage + per-submission assignment across multiple areas.)

### P1 — /admin/review/plans/:id (existing plan detail) SPA crash: "Invalid time value"
`PAGEERROR: Invalid time value` — an unguarded Date format (toISOString/toLocaleDateString) on a null/invalid plan date field renders the plan-detail page (and its /assign, /reviewers sub-routes) fully blank. Blocks ABS-05 (assign submissions to reviewer) and ABS-03/ABS-07 end-to-end (scoring + reviewer-side anonymization can't be reached). Repro: login organizer, /admin/review, open seed_evaluation_plan_0001. Fix: guard date formatting (render '—' for null/invalid), and add a browser render test for plan detail.

### P1 — reviewer queue empty despite assignments; reviewer "Current event" = "No events"
Organizer Progress shows sbek-reviewer 12 assigned / 7 completed (5 pending), but the reviewer's "Your queue" says "Nothing left" and the reviewer's event selector shows only "No events" (can't select DevFlow Conf 2027). Likely root cause: reviewers aren't granted event membership / the event-selector query excludes reviewer-role users, so their queue resolves to no event. Blocks all reviewer scoring (ABS-03 submission, ABS-07).

### P2 — scorecard lacks a free-text criterion type (only rating + dropdown). ABS-03 wants all three.
### P2 — no per-round scorecard: "Rounds" is a single count over one shared scorecard; can't give round 2 its own scorecard (ABS-01).

### Systemic note
Three SPA render crashes on real seeded data (admin redirect loop, submissions iterable, plan-detail date) all passed 898 unit tests + the API-level walkthrough + the swarm's DEC-069 gates, because nothing rendered the admin SPA in a browser. The swarm round that fixes these should ALSO add a browser-level render smoke gate: authenticate and load every /admin/* route, asserting 200 + non-empty #root + zero page errors.
