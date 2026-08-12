# 2026-08-10 task-w11-b — walkthrough @ 7561cc1

Full detail for the `## 2026-08-10 task-w11-b — walkthrough @ 7561cc1` section
of `docs/verification-log.md` (extracted per the contention-decomposition of
that file; see the stub entry there for `OPEN ITEMS` / `RESULT` summary).

DEC-186/DEC-185/DEC-177 wave-11 exit-gate battery, walkthrough lane,
log-only (no code changes). Full detail in
`docs/verification-log/task-w11-b-walkthrough.md`. Note: an inert
first-campaign homonym section titled `task-w11-b — build+test @
3b7ed3d` already exists earlier in this file (DEC-186 homonym guard);
this section is distinguished by its full heading including `@
7561cc1` and is unrelated to that history.

S' derived per DEC-114 first-parent walk from `main` (tip observed:
`bdc472b` "scribe wave 11"): `bdc472b` (bookkeeping — new decision doc
+ its `src/decisions.ts` constant + field-guide compaction) and
`b57bdfd` ("merge task-w9-g", doc-only ledger diff) both skipped, so
S' = `7561cc1` ("merge task-w10-d"), matching the DEC-186 expectation
exactly. `git merge-base --is-ancestor 2dd2f33 7561cc1` exits 0.

All 17 preconditions (12 DEC-177 anchors + 5 DEC-185 markers: DEC-179
in `src/lib/csv.ts`, DEC-180 in `src/lib/rate-limit.ts`, DEC-181 in
`src/server/middleware.ts`, DEC-182 in `src/server/http.ts`, DEC-183
in `wrangler.jsonc`) grep-confirmed present at S'. No precondition
FAIL.

Fresh detached worktree at `7561cc1`: `npm ci` clean, `npm run build`
PASS (0 tsc errors, vite build clean), `npm run db:migrate` (13
migrations, all `✅`), `npm run seed` clean (seed-r2 8 objects).
`.dev.vars` present at S' (`# DEC-183` / `DEV_MODE=1`, no other
content) and auto-loaded by `wrangler dev` — confirmed by dev-mailbox-
dependent checks passing without any external mail secret. `wrangler
dev` on port 8787, `/health` 200, then `npm run walkthrough`: **6/6
modules PASS** (producer, review, speaker, public, data, scale), exit
code 0, including every DEC-175 negative-authz probe: producer's
unauthenticated block (`/admin` -> 302, `/api/v1/contacts` -> 401,
`/api/v1/review/plans` -> 401, `/files/:id` -> 401); review's
out-of-scope-reviewer 404-not-403 pair; speaker's 8-check
speaker2-cross-tenant block (portal submission 404 existence-hiding,
task-assignment form/complete 403, uploaded file 403, three
organizer-API-as-speaker-session 403s).

DEC-180/181 impact on walkthrough login/logout: DEC-180 (rate limiter
counts failures only) has no observable effect — every walkthrough
login is a single successful attempt, the limiter never engages.
DEC-181 (`csrfFormOrHeader` on `/logout` and the portal sign-out
token) is **not exercised by the walkthrough at all** — grepped
`scripts/walkthrough/**` for `logout`, zero hits; no module calls
`/logout` or the portal sign-out route. Neither DEC-180 nor DEC-181
altered any walkthrough login flow that IS exercised (organizer form
login with `chq_csrf` cookie contract, speaker portal login, bearer-
token mint) — all passed identically to prior waves' recorded runs.

Server killed after the run (`pkill -f "wrangler dev"`); confirmed no
lingering listener on 8787.

**Note for the record (out of scope for this log-only lane, flagged
for the scribe/planner):** the post-S' commit `bdc472b` ("scribe wave
11") adds an `AIRTABLE_TOKEN=...` line to the tracked `.dev.vars` file
on `main`, alongside `DEV_MODE=1`. This postdates S' and is therefore
not part of the tree verified here, but it is a secret-shaped value
committed to a tracked file, which appears to conflict with the STAGE
1 zero-secret invariant. Not actioned by this lane (out of scope, log-
only); surfacing since it is newer than every sha this gate is allowed
to touch.

OPEN ITEMS: 1 (non-blocking, out of scope — the post-S' `.dev.vars`
`AIRTABLE_TOKEN` addition noted above; does not affect this
walkthrough's PASS result since it postdates S')

RESULT: PASS (6/6 modules PASS at S' = `7561cc1`, all DEC-175 probes
confirmed, DEC-180/181 do not alter walkthrough login/logout behavior
as exercised — logout itself is untested by the walkthrough harness)
