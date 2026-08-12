# 2026-08-10 task-w20-b — walkthrough @ 6807b67

Full detail for the `## 2026-08-10 task-w20-b — walkthrough @ 6807b67` section
of `docs/verification-log.md` (extracted per the contention-decomposition of
that file; see the stub entry there for `OPEN ITEMS` / `RESULT` summary).

Full run detail: `docs/verification-log/task-w20-b-walkthrough.md`.

DEC-114 sha check: `main`'s tip is `78bb286` ("scribe wave 20"), which
touches only `decisions/DEC-205.md`, `decisions/DEC-206.md`,
`field-guide/index.md`, and two pure string-constant additions
(`DEC_205`, `DEC_206`) in `src/decisions.ts` — no code logic, within
the DEC-114 bookkeeping exclusion set. DEC-205 states directly that
the newest code-bearing sha is `6807b67`, matching DEC-206's FROZEN
binding sha. No drift — proceeded.

DEC-203 precondition greps at `6807b67` (all present, none missed):
`toLowerCase` in `src/routes/api/users.ts`; `lower(` in
`src/server/repo/users.ts`; `accountRoutes` imported and mounted
(`app.route("/", accountRoutes)`) in `src/index.ts`; the provisioning
welcome-email body in `src/routes/api/users.ts` directs the new user
to sign in with the temporary password shared out-of-band by the
organizer and change it at `/account/password` — no password value is
interpolated into the email text.

Worked in the assigned worktree `chautauqua-wt/task-w20-b` (branch
`task-w20-b`). Confirmed no `.dev.vars` present pre-run (never
read/printed one, per DEC-187). `npm ci` clean. `npm run build` green
(tsc + app tsc + vite build). `rm -rf .wrangler`; `npm run db:migrate`
applied all 14 migrations; `npm run seed` green (D1 rows + 8 R2
objects incl. seed file + 4 headshots). Ran `npx tsx
scripts/ensure-dev-vars.ts` (materialized `.dev.vars` from the tracked
`.dev.vars.example` — required because `npx wrangler dev` is invoked
directly here, bypassing the `dev` script's automatic `predev`
lifecycle hook) then booted `npx wrangler dev --port 8951`; server
reported `Ready on http://localhost:8951`. Ran `npm run walkthrough --
--url http://localhost:8951`.

6/6 modules green: producer, review, speaker, public, data, scale —
all J1-J12 checks passed, including the J2 `/dev/mailbox` GET-200
assertion, the DEC-175 authz probes (existence-hiding 404s vs
authz-denial 403s across reviewer/speaker/API surfaces), and the
DEC-108 invite-visibility gates.

DEC-200 live behavior check via curl (cookie jar + csrf form flow,
same login pattern as `scripts/perf-smoke.ts`, using the seeded
organizer identity from `docs/fixtures/sample-data.json`):
`GET /account/password` with no cookies returned `302` to `/login`;
after logging in as the seeded organizer, `GET /account/password`
returned `200` with the change-password form (current-password and
new-password fields) in the body.

OPEN ITEMS: 0

RESULT: PASS
