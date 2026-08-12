# task-w11-e — coldstart / zero-secrets @ a3dbba6

DEC-423 lane. Verifies the stage-1 hard rule (SPEC.md:42-47, §7, §8): a
fresh checkout with ZERO secrets in the environment is a fully working app.
Fresh `git clone` of `main` at `a3dbba6` into a scratch directory (no
`node_modules`, `.wrangler`, or `.dev.vars` copied across). No source file
in this repo or the clone was touched.

## Environment secret check

`env | grep -iE 'CHQ|RESEND|AIRTABLE|CLOUDFLARE'` → no matches. Confirmed
clean before any command ran.

## Cold-start command sequence (exit codes)

| Step | Command | Exit | Secret demanded? |
|---|---|---|---|
| 1 | `npm ci` | 0 | No — 366 packages installed, no prompt/failure |
| 2 | `npm run db:migrate` (`wrangler d1 migrations apply chautauqua --local`) | 0 | No — 19 migrations applied against local D1, no external creds |
| 3 | `npm run seed` (`tsx scripts/seed.ts && wrangler d1 execute ... && tsx scripts/seed-r2.ts`) | 0 | No — wrote seed rows to local D1 and 8 objects to local R2, all local-emulated |
| 4 | `npm run dev` (`predev`: `tsx scripts/ensure-dev-vars.ts && vite build` → `wrangler dev`) | ran to "Ready on http://localhost:8787" (process kept alive, not a terminating exit code) | No — `ensure-dev-vars.ts` cloned `.dev.vars.example` to `.dev.vars` (no real secret; DEV_MODE + local placeholder vars only) because no `.dev.vars` pre-existed; `wrangler dev` bound KV/D1/R2/EMAIL/ASSETS as `local` mode with no external account contacted |

No step at any point demanded an API key, external account, or network
credential. `.dev.vars` after `predev`:
```
env.MAIL_FROM_EMAIL ("hello@chautauqua.cc")
env.MAIL_FROM_NAME ("Chautauqua")
env.DEV_MODE ("(hidden)")
env.PUBLIC_BASE_URL ("(hidden)")
```
— all local dev-sink placeholders sourced from `.dev.vars.example`, not a
real secret store.

## (a) Four seeded personas log in through the real `/login` form

Used `docs/fixtures/sample-data.json`-sourced credentials as documented
verbatim in README's "For evaluators" table, against `GET /login` (to
obtain the `chq_csrf` double-submit cookie + hidden field per
`src/server/middleware.ts` `csrfForm`) then `POST /login`:

| Persona | Email | HTTP status |
|---|---|---|
| Organizer | `sbek-organizer@example.com` | 302 |
| Speaker | `sbek-speaker@example.com` | 302 |
| Speaker (second) | `sbek-speaker2@example.com` | 302 |
| Reviewer | `sbek-reviewer@example.com` | 302 |

All four returned `302` (post-login redirect — the app's real success
response for a form POST; a login failure re-renders `/login` with `200`).

## (b) `GET /dev/mailbox`

`200`. `predev` ran (see step 4 above) and wrote `.dev.vars` with
`DEV_MODE` set, so the dev mailbox route was mounted and reachable; no 404.

## (c) Public surface + embed, no login

- `GET /e/devflow-conf-2027/sessions` → `200`
- `GET /embed/devflow-conf-2027/sessions` → `200`

Both requested with a fresh (no cookie) client.

## (d) Seeded R2 file via authenticated Worker route

Queried local D1 for a seeded file row (`select id, filename from file
limit 5`) → `seed_file_0001` / `slides-v1.pdf`. `GET /files/seed_file_0001`
with the organizer's authenticated session cookie → `200`, `608` bytes
downloaded, verified with `file(1)` as a genuine `PDF document, version
1.4, 1 pages`. Confirms the authenticated file-serve route
(`src/routes/files.ts` `fileServeRoutes.get("/files/:fileId")`, mounted at
root in `src/index.ts`) round-trips real R2 bytes, not a stub.

## (e) Cron / scheduled path

`npx wrangler dev --test-scheduled` exposes `/__scheduled` in this
wrangler version (`4.120.0`) — confirmed via `npx wrangler dev --help`
showing `--test-scheduled  Test scheduled events by visiting /__scheduled
in browser`. Restarted the dev server with this flag (the startup banner's
"Scheduled Workers are not automatically triggered" warning, present on
the plain `npm run dev` run, was absent here, confirming the flag took
effect). `GET /__scheduled` → `200`, body `Ran scheduled event`.
`wrangler.jsonc` declares `"crons": ["*/15 * * * *"]` and `src/index.ts`
wires `scheduled: handleScheduled` from `src/server/scheduled.ts` — this
exercised the real handler, not a no-op stub. No INSTRUMENT-BLOCKED
condition arose; this wrangler version does expose the test hook.

## (f) `vite build` output vs SPEC §7 `< 300 KB gz` budget

`npm run bundle:check` (`scripts/bundle-check.ts`, DEC-058) on the
`predev`-produced `public/admin/assets/` output:

```
Entry bundle: index-OGWrPj8G.js + index-C7tew5xN.css = 62.07 kB gzip (budget 300.00 kB)
bundle:check PASSED
```

Entry JS alone: `58.46 KB` gzip (`59868` bytes). Entry JS + entry CSS:
`62.07 KB` gzip — well under the `300 KB gz` budget SPEC.md:355 states
("SPA code-split by route; initial bundle < 300 KB gz"). For context, the
sum of gzip sizes across *all* emitted JS chunks (entry + every
lazy-loaded route chunk, i.e. everything the SPA could ever load, not just
the initial bundle) is `118.96 KB` gzip — also comfortably under budget
even in that stricter (non-SPEC) reading.

## OPEN ITEMS: 0

## RESULT: PASS
