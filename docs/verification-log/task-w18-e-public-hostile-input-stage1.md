# task-w18-e: hostile-input sweep of every unauthenticated surface (DEC-459 enumeration lane #2)

sha: `d034a9e0610b35b908503084525f1f04d93cb8df` (branch `task-w18-e`, parent of this
lane's own commit; this log is a snapshot of the working tree at that sha,
before this task's own commit lands).

Src is UNCHANGED in this lane -- test-only, per the task instructions ("Do NOT
change anything under src/ in this lane"). No decisions/, src/, or app/ file
was touched; only test/public-surface-hostile-input.test.ts (new) and this log.

## Enumeration (18 routes, exhaustive over src/index.ts's mounts)

Every route below is reachable with zero session cookie / zero bearer token.
Citations are `file:line` of the `.get(`/`.post(` registration.

| # | Route | File:line | Mounted via (src/index.ts) |
|---|-------|-----------|------------------------------|
| 1 | GET /e/:eventSlug/{sessions,speakers,agenda,schedule,gallery} | src/routes/public/index.tsx:105 | `app.route("/", publicRoutes)` |
| 2 | GET /e/:eventSlug/speakers/:contactId | src/routes/public/index.tsx:125 | `app.route("/", publicRoutes)` |
| 3 | GET /e/:eventSlug/sessions/:sessionId | src/routes/public/index.tsx:139 | `app.route("/", publicRoutes)` |
| 4 | GET /embed/:eventSlug/:surface.json | src/routes/public/index.tsx:160 | `app.route("/", publicRoutes)` |
| 5 | GET /embed/:eventSlug/:surface | src/routes/public/index.tsx:174 | `app.route("/", publicRoutes)` |
| 6 | GET /e/:eventSlug/schedule.ics | src/routes/public/index.tsx:197 | `app.route("/", publicRoutes)` |
| 7 | GET /e/:eventSlug/agenda.ics | src/routes/public/index.tsx:234 | `app.route("/", publicRoutes)` |
| 8 | GET /submit/:eventSlug | src/routes/public/submit.tsx:410 | `app.route("/", publicSubmitRoutes)` |
| 9 | POST /submit/:eventSlug/save-draft | src/routes/public/submit.tsx:466 | `app.route("/", publicSubmitRoutes)` |
| 10 | POST /submit/:eventSlug | src/routes/public/submit.tsx:554 | `app.route("/", publicSubmitRoutes)` |
| 11 | GET /login | src/routes/auth.tsx:152 | `app.route("/", authRoutes)` |
| 12 | POST /login | src/routes/auth.tsx:158 | `app.route("/", authRoutes)` (minus the two DEC-459 carve-outs, see below) |
| 13 | POST /logout | src/routes/auth.tsx:226 | `app.route("/", authRoutes)` (no session required to reach it -- it only no-ops if there's no cookie) |
| 14 | GET /claim/:token | src/routes/auth.tsx:237 | `app.route("/", authRoutes)` |
| 15 | POST /claim/:token | src/routes/auth.tsx:249 | `app.route("/", authRoutes)` |
| 16 | GET / | src/routes/root.tsx:130 | `app.route("/", rootRoutes)` |
| 17 | GET /docs/api | src/routes/docs.tsx:332 | `app.route("/", docsRoutes)` |
| 18 | GET /headshots/:fileId | src/routes/portal/profile.tsx:406 | `app.route("/", headshotServeRoutes)` |

**Explicitly considered and excluded:**

- GET /files/:fileId (src/routes/files.ts:385) -- its first line is
  `const scope = await authzServeFile(c, fileId)`, which calls
  `requireAuth(c)` (src/routes/files.ts:56-60) and throws `unauthorized`
  before any fileId parsing/lookup happens. With no session it 401s
  unconditionally and never reaches hostile-input-sensitive code, so it is
  not a "reachable without a session" file-serving path in the sense DEC-459
  means (contrast GET /headshots/:fileId, which serves real bytes to an
  anonymous caller for publicly-visible speakers).
- GET /admin, GET /admin/* (src/routes/root.tsx:59,66) -- both redirect to
  /login immediately when `c.var.auth` is absent, before touching ASSETS or
  any dynamic segment; the `/admin/*` wildcard's only work with no session is
  the `path.startsWith("/admin/assets/")` string check. No parsing surface
  worth probing beyond what's already covered by the static-GET query-tail
  probes below.
- src/routes/dev/mailbox.ts -- gated by `shouldMountDevMailbox`/
  `guardDevMailbox` (dev-mode only), not part of the always-reachable public
  surface DEC-459 scopes.

**DEC-459's explicit scope carve-out** (assigned to task-w18-c, not probed
here): the oversized-email POST /login case, and the oversized
`x-forwarded-for` cases (both routes' IP-derived rate-limit key path). See
`docs/verification-log/task-w18-c-c3-contacts-list.md`'s sibling lane
ownership note in the w18 task list for that assignment.

## Probes run (per DEC-459's list, applied per route as applicable)

- 100k-char values in query params and body fields.
- Wrong types: arrays where a string is expected (`?page[]=1&page[]=2`,
  repeated form field `email=...` x50 read via a scalar accessor).
- Missing required params/fields (bare GETs with no query string; POST
  bodies missing `password`/`email`/every field).
- Unicode/4-byte emoji in slugs, tokens, search text, email/password fields.
- Slug/token values that look like traversal (`../../../etc/passwd`, its
  percent-encoded form, and a 5000-char slug).
- Non-finite/hostile numerics (`1e308`, `NaN`, `-1`, `0`, `2**53`,
  `Infinity`) on `?page=`, `?limit=`, `?ids=`.
- The same query param repeated 50 times (`?q=`, `?ids=`, `?x=`, `?email=`).
- Malformed JSON bodies (`content-type: application/json` with truncated/
  invalid JSON) posted at every POST route that accepts a body, even though
  none of them are designed to parse JSON (all use `c.req.parseBody()` for
  form data) -- specifically to confirm a JSON content-type + garbage body
  doesn't crash the form-body parser.

Every probe asserts, via a shared `assertSafe()` helper: `res.status` is in
`[200, 500)` (i.e. a valid 2xx/3xx/4xx, never 5xx), and the response body
text contains no stack-trace-shaped line (`at ...:<line>:<col>`), no
absolute source path (`/Users/.../*.ts(x)` or `/home/.../*.ts(x)` or
`/src/*.ts(x)`), and no raw JS exception type name (TypeError/
ReferenceError/RangeError/SyntaxError) outside of a quoted JSON `code`
field.

## Harness notes (test-only, no product code touched)

`test/public-surface-hostile-input.test.ts` mounts the six real sub-apps
(`publicRoutes`, `publicSubmitRoutes`, `authRoutes`, `rootRoutes`,
`docsRoutes`, `headshotServeRoutes`) the same way `src/index.ts` does, behind
`registerErrorHandler`, against a fake drizzle-chain `db` (same shape as
`test/public.test.ts`'s established `makeChain` pattern) and a fake KV (one
pre-seeded valid claim record, everything else "not found").

Two db factories are used, deliberately kept separate:

- `makeDb()`: first `select()` in a request resolves to a valid event row (so
  eventSlug/contactId/sessionId/token-shaped hostile path segments reach real
  handler logic -- query-param parsing, repo calls, template rendering --
  instead of short-circuiting on a bare "event not found"); every later
  `select()` resolves empty.
- `makeEmptyDb()`: always empty. Used for the POST /login and POST /claim
  probes, whose first `select()` queries `schema.user`/`schema.contact`, not
  an event -- reusing `makeDb()`'s event-shaped first row there fed
  `verifyPassword()` an object with no `passwordHash`, which is a **mock**
  defect (an artifact of the harness, not the product): the initial draft of
  this test file hit exactly that bug (6 false-positive "500" failures on
  POST /login and POST /claim's 100k-password case) until the db factory was
  split. Documented here as a **gotcha for future workers writing
  full-app-composition tests against these repo modules**: a generic "first
  select() = X" fake is only safe within one repo module's query sequence: it
  does not generalize across route groups whose first query targets a
  different table.

## Result

214 probes run (see `npx vitest run test/public-surface-hostile-input.test.ts`
-- 214 tests, all passing after the harness fix above). Routes enumerated: 18.
Findings (genuine product-code 5xx/leak defects): **0**. Every one of the 214
probes across all 18 enumerated routes returned a non-5xx status with no
stack trace / absolute path / raw exception leak, using the real handler code
paths (not stubbed-out route logic) for the parsing/validation layers each
route's own control flow reaches before its first db-shaped short-circuit
(see harness notes above for exactly how deep each route's mock reaches).

`npm run build` -- clean (tsc x2 + vite build).
`npm test --silent` -- 282 files / 2533 tests passed (full suite, this
lane's new file included).

OPEN ITEMS: 0
FAIL-unowned: none found by this lane's probes.
PENDING-OWNED: none.
RESULT: PASS
