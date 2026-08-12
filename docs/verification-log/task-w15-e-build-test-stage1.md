# task-w15-e: build/test/bundle/render-sweep evidence lane (first BLOCKING mobile + type-floor wave)

Evidence lane, log-only per this task's brief, except the single named `CONTRAST_BLOCKING` flip
governed by DEC-436/DEC-443 (not exercised this run — see §5).

Tree: `main` @ `01815c51fa7abb5c93289b5efe69cfb8bc2866a8` ("scribe wave 15"), worktree
`task-w15-e`. Note on provenance: this worktree/branch was torn down mid-run by concurrent
orchestrator activity elsewhere in the swarm (main had advanced to a later wave-17+ sha and
`git worktree list` no longer showed `task-w15-e` while this lane's earlier build/test/bundle
commands were still in flight). The commit object `01815c5...` was still reachable in the object
store, so the worktree and branch were recreated pointing at the *same* sha and every command
below was re-run cleanly from a fresh `npm ci` on that recreated worktree — nothing in this log is
carried over from the torn-down run. `git status --short` is empty in the final worktree (all
local-dev state lives under gitignored `.wrangler/state`).

## 1. Build

```
npm ci --prefer-offline --no-audit --no-fund --silent   # clean node_modules, exit 0
npm run build   # tsc --noEmit && tsc --noEmit -p app/tsconfig.json && vite build --config app/vite.config.ts
```

Result: **PASS**. Both `tsc --noEmit` passes produced no output (0 errors); `vite build` succeeded
(154 modules transformed, built in 670ms). SPA main-entry gz size (build-only run):
`public/admin/assets/index-BSzgTq9I.js` = 183.82 kB raw / 59.95 kB gz.

## 2. Tests

```
npm test --silent   # vitest run
```

Result: **PASS** — 274 test files, 2285 tests, all green, 0 failures.

```
 Test Files  274 passed (274)
      Tests  2285 passed (2285)
   Start at  04:40:18
   Duration  24.60s (transform 5.30s, setup 0ms, collect 64.91s, tests 30.25s, environment 17.71s, prepare 16.88s)
```

`test/tap-target-floor.test.ts` (2 tests, part of the 2285) is the static desktop-source-scan half
of the 44px tap-target invariant (DEC-393/394: no stylesheet under `app/src/**/*.css`,
`src/**/*.css.ts`, or `src/views/theme.ts` may contain the stale `min-height: 40px` literal) — both
tests passed. Several tests print expected stderr from intentionally-simulated mailer failures
(DEC-238 taxonomy tests, e.g. `users-create-mailer-failure`) — asserted-expected output, not
failures.

## 3. Bundle check

```
npm run bundle:check   # tsx scripts/bundle-check.ts
```

Result: **PASS**. Entry bundle `index-BSzgTq9I.js` + `index-C7tew5xN.css` = **62.06 kB gzip**
against a 300.00 kB budget (~20.7% of budget). Largest individual chunk: `Contacts-CstO7YEJ.js` at
39.32 kB raw / 9.48 kB gzip (well under any per-chunk concern). `bundle:check PASSED`.

## 4. `npm run db:migrate && npm run seed`, then `npm run gate:render-sweep`

`npm run db:migrate` applied all 18 migrations cleanly (0000 through 0018, all ✅).
`npm run seed` completed cleanly: wrote `.seed.sql` (538 statements), applied it, and put 8 R2
objects into the local `chautauqua-files` bucket via `seed-r2.ts`.

Note for future lanes: `scripts/render-sweep.ts`'s `main()` is fully self-contained — it re-runs
`vite build`, `wrangler d1 migrations apply`, `tsx scripts/seed.ts`, `wrangler d1 execute
--file=.seed.sql`, and `tsx scripts/seed-r2.ts` itself before booting its own `wrangler dev` on a
free port (this is also how `.github/workflows/ci.yml`'s `render-sweep` job invokes it — bare
`npm run gate:render-sweep`, no separate migrate/seed/dev step). Running `npm run seed` a second
time against an already-seeded local D1 file therefore throws `UNIQUE constraint failed:
pipeline_entry.org_id, pipeline_entry.contact_id` (seed data is not idempotent). This lane hit that
exact error on its first attempt (having run `db:migrate && seed` manually first per the task
brief, then invoked `gate:render-sweep`, which reseeds internally). To get a real gate reading, the
local `.wrangler/state/v3/{d1,r2}` directories were cleared and `db:migrate` was re-run (seed was
*not* re-run manually a second time) before invoking `gate:render-sweep`, letting its own internal
migrate+seed(no-op migrate, fresh seed) proceed without conflict. A `npm run dev` server was also
started once per the task brief to confirm it boots against the migrated+seeded local state (see
below) and was killed before the gate run, since `gate:render-sweep` boots its own independent
`wrangler dev` instance on its own free port rather than attaching to one already running — running
both concurrently is unnecessary and does not change what the gate measures.

`npm run dev` boot check (against the migrated+seeded state, before being killed for the gate run):
booted clean on `http://localhost:8787` — `env.DB`, `env.FILES`, `env.ASSETS`, `env.MAIL_FROM_EMAIL`,
`env.MAIL_FROM_NAME`, `env.DEV_MODE`, `env.PUBLIC_BASE_URL` all bound, `[wrangler:info] Ready on
http://localhost:8787`. Killed cleanly (`kill <pid>`) before the gate run; confirmed no stray
`wrangler dev` process remained for this worktree afterward.

### 4a. `npm run gate:render-sweep` — full transcript summary

Ran to completion, exit code **0**. Full raw output captured in this worktree at
`.render-sweep-out.txt` (gitignored, not committed — reproduced/summarized below).

**Desktop route sweep (BLOCKING, DEC-144/139):** `42/42 routes passed` — every
`app/src/routeManifest.ts` entry, all three personas (organizer/reviewer/speaker) plus public,
returned status 200 with non-empty rendered content and zero console/page errors.

**Mobile overflow + tap-target sweep, 390×844 (BLOCKING, DEC-253):** `21/21 mobile routes passed`
— zero horizontal overflow (`overflowPx` 0 on every route) and every measured primary control
≥44px tall (`minControlPx` 44 or 48 on every route with controls; `/docs/api` and `/dev/mailbox`
have no matched controls, reported `-`, correctly excluded from the floor check).

**Admin mobile sweep, 390×844 — ADMIN_MOBILE_PASS (now BLOCKING per `ADMIN_MOBILE_PASS_BLOCKING =
true` in `scripts/render-sweep-lib.ts:257`):** `20/20 mobile routes passed` — zero overflow, every
control ≥44px, across all 20 admin/account routes at the phone breakpoint for all three personas.
**Verdict: PASS.** No offenders to name.

**Type-floor sweep, 10px minimum — FONT_FLOOR (now BLOCKING per `FONT_FLOOR_BLOCKING = true` in
`scripts/render-sweep-lib.ts:295`):** `83/83 font-floor checks passed` (desktop + mobile viewports
across every route/persona combination in the manifest). Smallest observed value was exactly the
10px floor (e.g. `/admin/overview` organizer desktop = 10px, `/portal` speaker mobile = 10px);
largest was 13px (`/embed/devflow-conf-2027/speakers`). **Verdict: PASS.** No offenders to name.

**WCAG AA contrast sweep — advisory, desktop-only (DEC-426, flip governed by DEC-436/443):**
`41/42 contrast checks passed`. One offender, unchanged from the prior wave's finding
(`docs/verification-log/task-w13-a-render-sweep-stage1.md`):

| route | role | minRatio | required | offender |
|---|---|---|---|---|
| `/admin/submissions/forms` | organizer | 3.06 | 4.5 (normal text) | `td` text, `fg=rgb(142,138,122)` on `bg=rgb(244,241,232)` (the `--chq-disabled` foreground token against the table row background) |

Same three identical `td` matches reported (the ratio is uniform across the offending column's
rows). This is a real, reproducible offender on this lane's own run, not a stale/carried-over
number — measured directly against this branch's built bundle and seeded data.

Because this run is **not** all-PASS (41/42), `CONTRAST_BLOCKING` (DEC-436's flip rule, reused
verbatim by DEC-426/443) stays `false` — see §5.

Since `ADMIN_MOBILE_PASS_BLOCKING` and `FONT_FLOOR_BLOCKING` are both `true` this wave and both
passed all-PASS (20/20, 83/83), and `CONTRAST_BLOCKING` stayed `false` (advisory, does not
contribute to the exit code per `scripts/render-sweep.ts:790`), the overall gate exited **0**
(`gate:render-sweep OK`) with no failing blocking check.

## 5. CONTRAST_BLOCKING flip check (DEC-443, DEC-436's unchanged rule)

`scripts/render-sweep-contrast.ts:25` reads `export const CONTRAST_BLOCKING = false;` on this
branch. This lane's own contrast run (§4a) read **41/42, not all-PASS** (one named, reproducible
offender at `/admin/submissions/forms`). Per DEC-436/443 the flip only fires from the flipping
lane's own all-PASS run — this run is not all-PASS, so **no flip is made**. `CONTRAST_BLOCKING`
remains `false` in this branch; no source file was changed by this task (per its evidence-lane
scope, "log-only except the one constant" — the constant's precondition was not met).

## 6. Open items for the ledger

- **FAIL-unowned:** none from build/test/bundle — all green. The one contrast offender
  (`/admin/submissions/forms` `td` text, `--chq-disabled` fg on row bg, ratio 3.06) is an
  **advisory, non-blocking** finding, already known and logged in a prior wave
  (`task-w13-a-render-sweep-stage1.md`) — not new, not gate-failing, carried forward unowned for a
  future contrast-remediation task per DEC-430 (remedy must change pixels, never the instrument).
- **PENDING-OWNED:** none newly surfaced by this lane.
- Blocking gates this wave (desktop route sweep, mobile overflow+tap-target sweep,
  ADMIN_MOBILE_PASS, FONT_FLOOR) all read all-PASS; the gate script's own exit code (0) confirms
  none of them failed.

RESULT: **PASS** — build, tests, bundle:check, and all four now-relevant BLOCKING render-sweep
checks (desktop route sweep, mobile 390px overflow/tap-target sweep, ADMIN_MOBILE_PASS,
FONT_FLOOR) all green on this branch's own run. The WCAG AA contrast advisory pass reads 41/42
(one named, previously-known, non-blocking offender) — `CONTRAST_BLOCKING` correctly stays `false`
per this lane's own reading.
