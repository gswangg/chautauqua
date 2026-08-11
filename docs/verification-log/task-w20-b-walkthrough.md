# task-w20-b — walkthrough @ 6807b67

## DEC-114 sha check

`git -C chautauqua log --oneline -3` at the tip of `task-w20-b`'s branch
point (`main`) shows:

```
78bb286 scribe wave 20
6807b67 merge task-w18-b
16f6020 DEC-200: self-service password change route, strip password from welcome email
```

`78bb286` ("scribe wave 20") touches only `decisions/DEC-205.md`,
`decisions/DEC-206.md`, `field-guide/index.md`, and two pure
string-constant additions (`DEC_205`, `DEC_206`) appended to
`src/decisions.ts` — no code logic, within the DEC-114 bookkeeping
exclusion set. DEC-205 (binding) states this directly: "newest
code-bearing sha = 6807b67". `6807b67` is therefore confirmed as the
newest code-bearing sha, matching the FROZEN binding sha named in
DEC-206. No drift — proceeding.

## DEC-203 precondition greps (all present)

- `toLowerCase` in the users route: `src/routes/api/users.ts`
- `lower(` in the users repo: `src/server/repo/users.ts`
- `accountRoutes` mounted: `src/index.ts:4` (import) and
  `src/index.ts:41` (`app.route("/", accountRoutes)`)
- Password-free welcome copy: `src/routes/api/users.ts` generates a
  one-time password and hashes it, but the provisioning-email body
  reads "Sign in at /login with the temporary password your organizer
  will share with you; you can change it at /account/password after
  signing in." — no password value is interpolated into the email
  text.

## Run

Ran inside the assigned worktree
`/Users/wednesdayniemeyer/Documents/gniemeyer/Projects/chautauqua-wt/task-w20-b`
(branch `task-w20-b`, checked out at `78bb286`, code content frozen at
`6807b67` per the check above). `.dev.vars` was never read or printed
(DEC-187).

- `rm -rf .wrangler`
- `npm run db:migrate` — all 14 migrations applied clean
- `npm run seed` — D1 rows + 8 R2 objects (incl. seed file + 4
  headshots) seeded clean
- `npx tsx scripts/ensure-dev-vars.ts` then `npx wrangler dev --port
  8951` — materialized `.dev.vars` from the tracked
  `.dev.vars.example` (required because `npx wrangler dev` is invoked
  directly, bypassing the `dev` script's `predev` lifecycle hook);
  server reported `Ready on http://localhost:8951`
- `npm run walkthrough -- --url http://localhost:8951`

All five required modules passed, plus `scale`:

```
Summary:
  PASS producer
  PASS review
  PASS speaker
  PASS public
  PASS data
  PASS scale

walkthrough OK
```

Producer module includes the J2 `/dev/mailbox` GET-200 assertion
(passed once `.dev.vars` — with `DEV_MODE=1` — existed; the mailbox
routes 404 by design per DEC-005 when `DEV_MODE` isn't the literal
string `'1'`). Speaker, public, and data modules include the DEC-175
existence-hiding/authz probes, the DEC-108 invite-visibility gates,
and the J11/J12 CRM + API-token/export checks — all green.

## DEC-200 live behavior check (curl, cookie jar + csrf form flow)

Followed the same login pattern as `scripts/perf-smoke.ts`
(`GET /login` for the `chq_csrf` cookie, `POST /login` with
`email`/`password`/`chq_csrf` form-encoded, `chq_session` cookie
captured from the 302 response) using the seeded organizer identity
from `docs/fixtures/sample-data.json`
(`identities.organizer` — `sbek-organizer@example.com`).

1. `GET /account/password` with no cookies:
   `curl -s -o /dev/null -w "%{http_code} %{redirect_url}\n" http://localhost:8951/account/password`
   → `302 http://localhost:8951/login` — matches expected redirect.
2. Logged in as the seeded organizer (cookie jar as above).
3. `GET /account/password` with the session cookie → `200`, body
   contains the change-password form (current-password and
   new-password fields present).

```
OK: GET /account/password (no cookies) -> 302 /login
OK: logged in as sbek-organizer@example.com
OK: GET /account/password (logged in) -> 200, contains change-password form
DEC-200 live behavior check: PASS
```

Stopped the `wrangler dev` process after the run.

**OPEN ITEMS: 0**

**RESULT: PASS**
