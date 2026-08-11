# task-w8-d — perf-smoke @ 38860f9 — detail

DEC-069/DEC-088/DEC-139/DEC-176/DEC-177 gate, wave-8/9 battery. Log-only
lane; this file plus one `docs/verification-log.md` section are the
sole changes in this branch.

Note: an earlier, unrelated first-campaign relic file also named
`task-w8-d-triage-closure.md` already exists in this directory (from a
prior `d12eb25`-era wave-8 numbering that predates the DEC-176/177
campaign-3 rebind). This file is a separate detail doc under a distinct
filename (`-perf-smoke.md`) to avoid any collision with that relic.

## STEP 1 — frozen sha derivation

Fresh worktree branched from `main`. First-parent walk from `main` tip:

```
38860f9 merge task-w8-a          <- code-bearing (task-w8-a harness-closure merge)
a8a4785 scribe wave 9            <- doc-only bookkeeping
5d3acae scribe wave 8            <- doc-only bookkeeping
466f45b scribe wave 7            <- doc-only bookkeeping
```

`38860f9` is code-bearing and has no code-bearing commit after it on
`main`, so **S = `38860f9`**.

Ancestor check: `git merge-base --is-ancestor 2dd2f33 38860f9` exits 0
— PASS (S descends from the campaign-3 reset commit).

`ci.yml` render-sweep job present at S:
```
$ git show 38860f9:.github/workflows/ci.yml | grep -n render-sweep
87:  render-sweep:
97:      - run: npm run gate:render-sweep
```

## DEC-177 precondition grep list

Every item in DEC-177's precondition list, re-run in this worktree
(checked out at S):

| Fix | File | Hit |
|---|---|---|
| DEC-167 merge fields | `src/domain/contacts.ts` | line 165 |
| ICS_ORGANIZER_EMAIL | `src/mail/ics.ts` | line 15 |
| "unknown track id" | `src/routes/api/forms.ts` | line 113 |
| "anonymized === false" | `src/server/repo/files.ts` | line 153 |
| openDate wire name | `app/src/pages/review/PlanEditor.tsx` | lines 107, 143 |
| FORM_TASK_FIELD_SPECS | `scripts/seed.ts` | lines 19, 909, 931 |
| DEC-174 override | `scripts/seed.ts` | line 975 |
| DEC-173 (public) | `scripts/walkthrough/public.ts` | line 440 |
| DEC-173 (speaker) | `scripts/walkthrough/speaker.ts` | line 923 |
| DEC-175 (producer) | `scripts/walkthrough/producer.ts` | lines 773-833 |
| DEC-175 (speaker) | `scripts/walkthrough/speaker.ts` | lines 1156-1197 |
| DEC-175 (review) | `scripts/walkthrough/review.ts` | lines 312-632 |

All twelve present — no `RESULT: FAIL — precondition` triggered.

## STEP 2 — procedure and results

- `npm ci --prefer-offline --no-audit --no-fund --silent` — clean.
- `npm run build` — PASS: `tsc --noEmit` (root) + `tsc --noEmit -p
  app/tsconfig.json` + `vite build --config app/vite.config.ts`, 131
  modules transformed, admin SPA bundle emitted, no errors.
- `rm -rf .wrangler/state` — fresh worktree, no-op.
- `npm run db:migrate` — 13 migrations (`0000`-`0010`, `0012`, `0013`)
  applied clean via `wrangler d1 migrations apply chautauqua --local`.
- `npm run seed` — run first as required (perf:seed alone seeds only
  synthetic `seed_perf_`-prefixed rows, no login identity); clean, 8 R2
  objects uploaded to local bucket `chautauqua-files`.
- `npm run perf:seed` — `tsx scripts/perf-seed.ts` step wrote 13,757 SQL
  statements to `.perf-seed.sql` cleanly both times. The chained
  `wrangler d1 execute --file=.perf-seed.sql` step failed on its first
  invocation with `✘ [ERROR] other side closed` after ~19s (miniflare/
  workerd transport hiccup — confirmed via the wrangler debug log,
  `Error: other side closed` at `executeLocally`, no SQL/schema content
  in the stack). Re-running `npx wrangler d1 execute chautauqua --local
  --file=.perf-seed.sql` directly completed cleanly on retry — full JSON
  array of batch results, every entry `"success": true`, none `false`.
  DEC-088 scale verified directly against D1 post-seed:
  - `SELECT count(*) FROM submission WHERE id LIKE 'seed_perf_%'` -> 2000
  - `SELECT count(*) FROM submission WHERE id LIKE 'seed_perf_%' AND
    status='accepted'` -> 300
  (12 reviewers per the perf-seed script's fixed scale parameters, not
  independently re-queried).
- `npx wrangler dev --port 8823` (reserved for this lane; never
  8787/8801/8821/8822) started in background. `GET /health` polled,
  returned `{"ok":true}` (200) on an early poll.

### Run 1

```
PERF_URL=http://localhost:8823 npm run perf:smoke
```
Exit code: **0** ("perf:smoke OK").

```
p95 over 30 measured iterations (budget: 150ms):

  submissions list (page 1)            11.8ms  ok
  submissions list (q=Kubernetes)      12.5ms  ok
  submission detail                    17.8ms  ok
  event overview                       14.3ms  ok
  organizer agenda (300 accepted)      24.4ms  ok
  public sessions page                  3.5ms  ok
  public agenda                         6.3ms  ok
  schedule.ics 150 ids                 34.7ms  ok
  plan progress (12 reviewers)         18.9ms  ok
  rating PUT                            9.0ms  ok
```

### Run 2

```
PERF_URL=http://localhost:8823 npm run perf:smoke
```
Exit code: **0** ("perf:smoke OK").

```
p95 over 30 measured iterations (budget: 150ms):

  submissions list (page 1)            24.2ms  ok
  submissions list (q=Kubernetes)      38.8ms  ok
  submission detail                    46.5ms  ok
  event overview                       38.7ms  ok
  organizer agenda (300 accepted)      38.5ms  ok
  public sessions page                 11.3ms  ok
  public agenda                        18.5ms  ok
  schedule.ics 150 ids                 94.3ms  ok
  plan progress (12 reviewers)         33.9ms  ok
  rating PUT                           27.2ms  ok
```

Run 2 is uniformly slower than run 1 (still all comfortably under the
150ms budget in every row) — consistent with warm-cache/shared-machine
variance from concurrent sibling lanes running at the same time, not a
regression.

### DEC-080 cap assertion

`scripts/perf-smoke.ts` throws synchronously, untimed, before the
measured loop, on any non-400 response to the 301st synthetic
nonexistent `schedule.ics` id request. It prints no separate success
line for this assertion, so the clean `perf:smoke OK` exit on *both*
runs is the proof the assertion passed both times.

### Teardown

`pkill -f "wrangler dev --port 8823"`; confirmed via `lsof -i :8823`
(no output) that the port is free.

## OPEN ITEMS

0

## RESULT

PASS
