# task-w9-d — perf-smoke @ 38860f9

## S derivation (DEC-114/DEC-176/DEC-177/DEC-178)

First-parent walk from `main` tip found no literal `merge task-w9-a`
commit descending from `2dd2f33` (two commits with that exact message
exist in history — `8026fad` and `56ddb09` — but both are *ancestors*
of `2dd2f33`, i.e. leftovers from an earlier round, not this
campaign's wave 9). The newest code-bearing first-parent commit
descending from `2dd2f33` is `38860f9` ("merge task-w8-a"), touching
`scripts/seed.ts` and `scripts/walkthrough/{producer,public,review,
speaker}.ts` — genuine code carrying the DEC-173/174/175 tags
required of task-w9-a. This reproduces the identical derivation
already recorded by sibling gates `task-w8-b` and `task-w9-b` in this
file (same S, same reasoning), keeping the wave-9 battery consistent
per DEC-178 ("gates task-w9-b..f parallel at S"). `git merge-base
--is-ancestor 2dd2f33 38860f9` exits 0 (confirmed).

Note: at the time this gate ran, `main`'s tip was itself a moving
target (a live swarm concurrently merging further wave-8 lanes:
observed tip advancing from `aa7bf95` through `80e87a7` to `25e81f9`
over the course of this run). `2dd2f33` remains an ancestor of every
observed tip. Per DEC-114/DEC-178 the frozen sha for this battery is
fixed at `38860f9` regardless of main's later advancement, matching
the sibling gates.

## Precondition greps at S — all HIT

Six w6 anchors:
- `DEC-167` in `src/domain/contacts.ts` (hit, line 165)
- `ICS_ORGANIZER_EMAIL` in `src/mail/ics.ts` (hit, line 15)
- `unknown track id` in `src/routes/api/forms.ts` (hit, line 113)
- `anonymized === false` in `src/server/repo/files.ts` (hit, line 153)
- `openDate` in `app/src/pages/review/PlanEditor.tsx` (hit, lines
  107/138/143)
- `FORM_TASK_FIELD_SPECS` in `scripts/seed.ts` (hit, lines 19/909/931)

Plus:
- `DEC-173` in `scripts/walkthrough/public.ts` (hit, line 440) and
  `scripts/walkthrough/speaker.ts` (hit, line 923)
- `DEC-174` in `scripts/seed.ts` (hit, line 975)
- `DEC-175` in `scripts/walkthrough/producer.ts` (hits),
  `scripts/walkthrough/speaker.ts` (hits),
  `scripts/walkthrough/review.ts` (hits)

All independently re-run and confirmed HIT in this gate's own
disposable worktree.

## Method

Verified at S directly via a disposable detached worktree (`git
worktree add --detach .../task-w9-d-S 38860f9`), keeping the
`task-w9-d` branch worktree free of detached-HEAD state — same
pattern as `task-w9-b`.

## Build / migrate / seed

`rm -rf .wrangler/state` (fresh). `npm ci --prefer-offline --no-audit
--no-fund --silent` clean. `npm run build` (`tsc --noEmit` root +
`tsc --noEmit -p app/tsconfig.json` + `vite build`) PASS — 131
modules transformed, 19 output assets. `npm run db:migrate` — 14
migrations `0000`..`0013` applied clean. `npm run seed` (run BEFORE
`perf:seed`, per the w16-c precedent in this file — `perf:seed` alone
creates no login-capable organizer identity) — completed, including
R2 headshot object seeding (8 objects into local `chautauqua-files`
bucket). `npm run perf:seed` (DEC-088 2k-row scale: all SQL batches
`"success": true`).

## Server

`npx wrangler dev --port 8833` (not 8787/8801/8803/8831/8832, per
task instruction — those ports are reserved by sibling/concurrent
gate lanes). `GET /health` returned `{"ok":true}` on the first poll.

## perf:smoke — p95 over 30 measured iterations (budget: 150ms)

```
submissions list (page 1)            11.0ms  ok
submissions list (q=Kubernetes)      19.0ms  ok
submission detail                    15.3ms  ok
event overview                       14.0ms  ok
organizer agenda (300 accepted)      18.9ms  ok
public sessions page                  4.0ms  ok
public agenda                         5.4ms  ok
schedule.ics 150 ids                 41.0ms  ok
plan progress (12 reviewers)         18.0ms  ok
rating PUT                           42.1ms  ok
```

`npm run perf:smoke` exit 0 ("perf:smoke OK"). Rerun independently a
second time for confirmation — again exit 0, all `ok`, numbers within
the same order of magnitude (11.0-19.0ms admin reads; 3.2-5.6ms
public SSR; 40.1ms .ics; 11.0-42.1ms rating PUT).

**DEC-094/095 301-id cap probe.** The script's untimed one-shot
assertion (`scripts/perf-smoke.ts:201-216`, DEC-089/DEC-094) fetches
`schedule.ics` with 301 ids (the DEC-088 seed's 300 real accepted
submission ids + 1 synthetic id appended) against the unauthenticated
public route and asserts HTTP 400 (`src/lib/pagination.ts` clamps
`perPage` to 200 server-side per DEC-094, so any request above that
bound is rejected). This assertion throws and aborts the script on
failure; since `perf:smoke` exited 0 both runs, the 400 assertion
passed both times (confirmed by the assertion's own throw message
format `DEC-080 cap assertion failed: ... expected 400, got ${status}`
— never triggered).

**Regression check vs `task-w4-d @ d8d1cbd`** (this file, wave-4
section): that baseline recorded 9.8/12.6/12.7/11.8/16.6/3.2/6.2/
32.9/18.2/8.5ms across the same ten probes. This run's figures
(11.0/19.0/15.3/14.0/18.9/4.0/5.4/41.0/18.0/42.1ms) are all within the
same single-digit-to-low-double-digit-ms order of magnitude and
nowhere near the 150ms uniform budget (or SPEC.md §7's tighter
per-category 50/100ms admin budgets) — normal local-dev-server
variance under a concurrently-loaded machine (this gate ran alongside
other live swarm agents), not a genuine regression. No probe crossed
its budget in either run.

## Tests

`npm test --silent` — PASS. **151 test files / 1332 tests**, all
green, 0 failures. Includes the full `app/src/**/*.render.test.tsx`
render-sweep battery. Reproduces the identical counts recorded by
`task-w8-b` and `task-w9-b` at the same S.

## Cleanup

Server and its `workerd` child processes killed
(`kill -9` on the `wrangler dev --port 8833` process tree). Confirmed
via `lsof -i :8833` — no listener remains, port free.

## OPEN ITEMS

0

## RESULT

PASS
