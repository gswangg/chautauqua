# task-w23-f — STAGE-1 EXIT GATE 6/6: fresh-clone + cron-tick proof

## FROZEN SHA

`e3d558ea5628cbe1a7260489c2c5ddc1d487c7db` (main tip at worktree creation; commit
subject "scribe wave 23").

## DEC-361 presence check (10 w21/w22 merges are ancestors of FROZEN SHA)

All ten confirmed via `git merge-base --is-ancestor <commit> e3d558e...` = true:

| Task | Commit |
|---|---|
| task-w21-a | `4a3db4a` |
| task-w21-b | `79f4718` |
| task-w21-c | `e3dc68b` |
| task-w21-d | `1905c4c` |
| task-w21-e | `effe4ea` |
| task-w22-a | `78625ef` |
| task-w22-b | `5c7fb14` |
| task-w22-c | `d962b70` |
| task-w22-d | `20311b1` |
| task-w22-e | `b3c7438` |

Port assigned/used: **8855** (DEC-361), exclusively.

## Fresh-clone proof

Clone: `git clone /Users/wednesdayniemeyer/Documents/gniemeyer/Projects/chautauqua
/Users/wednesdayniemeyer/Documents/gniemeyer/Projects/chautauqua-freshclone-w23`,
checked out to FROZEN SHA above.

Zero-secret check before running anything:
- `ls -a` in clone root: no `.dev.vars`, no `.env*` — only `.dev.vars.example`
  tracked alongside normal repo files.
- `git ls-files | grep -iE 'dev\.vars|\.env'` → exactly `.dev.vars.example`.

Quickstart followed verbatim (README.md lines 15-27):
```
npm i        (ran as `npm ci`)
npm run db:migrate
npm run seed
npm run dev
```
- `npm ci` — installed 366 packages clean (4 pre-existing npm-audit advisories,
  unrelated to secrets/build).
- `npm run db:migrate` — all 19 migration files (`0000`..`0018`) applied `✅`
  against local D1 with zero manual intervention.
- `npm run seed` — seeded `devflow-conf-2027` demo event + 8 R2 objects
  (headshots/resource file), zero manual intervention, zero secrets.
- `npm run dev` — **note on how this was exercised**: to pin the port to 8855
  and to set `PUBLIC_BASE_URL` per README's non-default-port instructions
  (README.md lines 41-45, DEC-296), the `predev` hook
  (`tsx scripts/ensure-dev-vars.ts && vite build --config app/vite.config.ts`)
  was run explicitly, `.dev.vars`'s `PUBLIC_BASE_URL` was edited to
  `http://localhost:8855` (exactly the fallback the README itself prescribes
  for non-default ports), and `npx wrangler dev --port 8855` was run in place
  of the bare `npm run dev` (which has no built-in port flag). This is not a
  README defect — it is the documented alternate-port procedure — but it is
  worth flagging: my first attempt ran `npx wrangler dev --port 8855 --var
  PUBLIC_BASE_URL:...` directly, **skipping** the `predev` hook, which meant
  `.dev.vars` was never created and `DEV_MODE` was unset, so `/dev/mailbox`
  404'd (guarded server-side per DEC-005/DEC-183 on `env.DEV_MODE === '1'`,
  `src/server/app.ts:51-64`). Re-running through `ensure-dev-vars.ts` (the
  actual `predev` step) fixed this immediately — this was a self-inflicted
  test-harness error, not a gap in the README or product code.

Assertions (verbatim status codes, port 8855, `PUBLIC_BASE_URL=http://localhost:8855`):

| Assertion | Result |
|---|---|
| `GET /health` | `200` |
| `GET /login` | `200` |
| `GET /e/devflow-conf-2027/sessions` | `200`, 12060 bytes, non-empty |
| `GET /admin` unauthenticated | `302` -> `http://localhost:8855/login` |
| `GET /admin` after organizer login (`sbek-organizer@example.com` /
  `SbekTest!2027-org`, from `docs/fixtures/sample-data.json` via README's
  "For evaluators" table) | `200`, serving `<script type="module"
  src="/admin/assets/index-wZmPmRXe.js">`; that asset itself independently
  verified `200`, 180198 bytes |
| `GET /dev/mailbox` | `200` |
| `GET /docs/api` | `200` |

Login mechanics: `GET /login` to obtain `chq_csrf` cookie + matching hidden
form value, then `POST /login` (form-encoded: `chq_csrf`, `email`,
`password`) per `src/routes/auth.tsx:140-195` (`csrfForm` middleware) ->
`302` to `/admin` with `chq_session` cookie set.

No step required a secret, an external account, or an undocumented manual
file edit — the one `.dev.vars` edit performed (`PUBLIC_BASE_URL` for a
non-default port) is explicitly documented in README.md lines 41-45 as the
correct procedure for exactly this situation, not a workaround for a gap.

## Cron proof

Server killed (`pkill -f "wrangler dev --port 8855"`), restarted as:
```
npx wrangler dev --port 8855 --test-scheduled
```
(booted from the same `.dev.vars`/migrated+seeded local D1/R2 state left by
the fresh-clone proof above — no re-migrate/re-seed needed.) Wrangler startup
banner for this run **omitted** the "Scheduled Workers are not automatically
triggered during local development" warning that was present in the earlier
non-`--test-scheduled` boot, confirming the flag took effect.

`email_log` row count before tick (`wrangler d1 execute chautauqua --local
--command "SELECT COUNT(*) as cnt FROM email_log"`): **3**

Fired: `GET http://localhost:8855/__scheduled?cron=*%2F15+*+*+*+*`
-> `200`, body `Ran scheduled event`.

Wrangler log for the tick (`grep -iE "error|exception|stack|unhandled|throw"`
over the full session log): **no matches**. Raw log lines for the tick:
```
scheduled trigger fired */15 * * * *
[wrangler:info] GET /__scheduled 200 OK (23ms)
```

`email_log` row count after tick: **3** (delta 0 — acceptable per task spec;
whether a reminder is due depends on seed dates, and DEC-023 reminders are
due-date-driven, not guaranteed-fire-every-tick).

Code path confirmed present and matching SPEC's per-event resilience
requirement (read, not modified):
- `src/index.ts` -> `src/server/scheduled.ts:9` `handleScheduled()` ->
  `runDueReminders(env)` (line 17 call site, comment: "Reminders first: a
  sync failure must not cost anyone their reminder.")
- `src/routes/tasks.ts:419` `export async function runDueReminders(env)`:
  iterates `listEventIdsWithOutstandingAssignments(db)` and wraps each
  event's `sendDueRemindersForEvent(...)` call in its own `try { } catch
  (err) { console.error(...) }` (DEC-238 class 1: "one event's failure (bad
  row, mailer outage, etc.) must not abort the tick for every other event").
  This is the resilience guarantee SPEC requires (one bad recipient/event
  must not abort the tick) and it is structurally present, not merely
  unit-tested.

## Teardown

- `pkill -f "wrangler dev --port 8855"`, waited, then `lsof -i :8855` ->
  empty output (confirmed clean).
- `rm -rf /Users/wednesdayniemeyer/Documents/gniemeyer/Projects/chautauqua-freshclone-w23`
  — clone directory deleted, confirmed absent from parent listing.

## OPEN ITEMS: 0

## RESULT: PASS

## RECHECK SHA

Worktree HEAD re-verified post-run: `e3d558ea5628cbe1a7260489c2c5ddc1d487c7db`
— unchanged from FROZEN SHA (no drift during this gate's run). Note: `main`
in the primary repo advanced to `2ac621fda14bcfb6b57b9340bc5eede389929a39`
during this gate's execution (other workers' concurrent merges); this does
not affect the FROZEN SHA this gate certified, per DEC-361 (drift logged,
never blocks this gate).

## POST-S DELTA

`email_log` row count: 3 (pre-tick) -> 3 (post-tick), delta 0. Acceptable per
task instructions: either delta is acceptable since reminder due-ness
depends on seed dates (DEC-023); a 500 or thrown error would have been the
disqualifying signal, and none occurred.
