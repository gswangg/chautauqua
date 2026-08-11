# task-w11-c — perf-smoke detail @ 7561cc1

DEC-186/DEC-185 wave-11 exit-gate battery, perf-smoke lane, per DEC-069/
DEC-080/DEC-114/DEC-177/DEC-185 gate. Log-only; no code changes.

## STEP 1 — S' derivation

First-parent walk from `main` tip in a fresh detached worktree
(`git worktree add --detach ... 7561cc1`, confirming the sha directly):

`main` HEAD (at branch time) was `bdc472b` ("scribe wave 11"), preceded
first-parent by `b57bdfd` ("merge task-w9-g") — both doc-only
bookkeeping — and then `7561cc1` ("merge task-w10-d"), which is
code-bearing. No later code-bearing commit exists on the first-parent
spine, so:

**S' = `7561cc1`** ("merge task-w10-d") — matches DEC-185's expected sha.

`git merge-base --is-ancestor 2dd2f33 7561cc1` exits 0 — DEC-139
ancestor check PASS.

## STEP 2 — 17 preconditions (DEC-177's 12 + DEC-179..183's 5)

All 17 anchors greeped directly in the S' worktree, all present, no miss:

DEC-177 (12, six w6 fixes + harness closure):
- `DEC-167` in `src/domain/contacts.ts:165`
- `ICS_ORGANIZER_EMAIL` in `src/mail/ics.ts:15`
- `"unknown track id"` in `src/routes/api/forms.ts:113`
- `"anonymized === false"` in `src/server/repo/files.ts:153`
- `openDate` in `app/src/pages/review/PlanEditor.tsx:107,143`
- `FORM_TASK_FIELD_SPECS` in `scripts/seed.ts:19,931`
- `DEC-174` in `scripts/seed.ts:975`
- `DEC-173` in `scripts/walkthrough/public.ts:440`
- `DEC-173` in `scripts/walkthrough/speaker.ts:923`
- `DEC-175` in `scripts/walkthrough/producer.ts:773,776,781,784,787,792,833`
- `DEC-175` in `scripts/walkthrough/speaker.ts:1156-1197`
- `DEC-175` in `scripts/walkthrough/review.ts:312,321,603,612,617,627,632`

Wave-10 fixes (5):
- `DEC-179` in `src/lib/csv.ts:145` (CSV formula-escape `formatCell`)
- `DEC-180` in `src/lib/rate-limit.ts:41` (login limiter counts
  failures-only, success resets budget)
- `DEC-181` in `src/server/middleware.ts:262` (`csrfFormOrHeader` on
  `/logout` + portal token)
- `DEC-182` in `src/server/http.ts:51` (`parseBoundedIdArray`, 64-char
  id / 1000-count cap, applied at `src/routes/files.ts:201`,
  `src/routes/tasks.ts:228,293`, `src/routes/api/submissions.ts:331`,
  `src/routes/api/contacts.ts:542`)
- `DEC-183` in `wrangler.jsonc:39` (`DEV_MODE` lives in `.dev.vars`)

No miss — proceeding to the gate.

## STEP 3 — fresh worktree gate

Fresh detached worktree at `7561cc1` (separate from the log-only
`task-w11-c` branch worktree, which never ran build/tests):

- `npm ci --prefer-offline --no-audit --no-fund --silent` — clean.
- `npm run build` — PASS: dual `tsc --noEmit` (root + `app/`) clean, 0
  errors, `vite build` 131 modules transformed, built in 654ms.
- `rm -rf .wrangler/state` — fresh worktree, nothing present.
- `npm run db:migrate` — 13 migrations (`0000`-`0010`, `0012`, `0013`)
  applied clean.
- `npm run seed` — required first (perf:seed alone seeds no
  login-capable identity, per prior gates' notes); ran clean, 8 R2
  objects uploaded to local bucket `chautauqua-files`.
- `npm run perf:seed` — `tsx scripts/perf-seed.ts` + `wrangler d1
  execute --file=.perf-seed.sql`, all batches `"success": true`, no
  `false` anywhere. Verified DEC-088 scale directly in D1: `SELECT
  count(*) FROM submission WHERE id LIKE 'seed_perf_%'` = 2000;
  `... AND status='accepted'` = 300.
- `npx wrangler dev --port 8845` (unused port, confirmed free before and
  after) started in background; `GET /health` polled, `{"ok":true}`
  (200).

`PERF_URL=http://localhost:8845 npm run perf:smoke` — **run 1: exit 0**
("perf:smoke OK"). **Run 2: exit 0** ("perf:smoke OK"). Full p95 tables
(budget 150ms, all `ok` both runs):

Run 1:
```
submissions list (page 1)            12.1ms  ok
submissions list (q=Kubernetes)      17.7ms  ok
submission detail                    24.0ms  ok
event overview                       19.5ms  ok
organizer agenda (300 accepted)      27.3ms  ok
public sessions page                  5.4ms  ok
public agenda                         8.5ms  ok
schedule.ics 150 ids                 46.7ms  ok
plan progress (12 reviewers)         20.5ms  ok
rating PUT                           13.4ms  ok
```

Run 2:
```
submissions list (page 1)            15.5ms  ok
submissions list (q=Kubernetes)      15.5ms  ok
submission detail                    18.9ms  ok
event overview                       18.3ms  ok
organizer agenda (300 accepted)      25.0ms  ok
public sessions page                  4.9ms  ok
public agenda                         6.1ms  ok
schedule.ics 150 ids                 39.4ms  ok
plan progress (12 reviewers)         21.0ms  ok
rating PUT                            9.1ms  ok
```

Both runs pass every row, well under the 150ms budget.

**DEC-080 301-id `schedule.ics` cap assertion** (`perf-smoke.ts`'s
untimed one-shot check, run before the timed loop): fetches 300 real
accepted-submission ids + 1 synthetic nonexistent id (301 total) against
`GET /e/:slug/schedule.ics`; script throws synchronously on any response
other than 400. Clean `perf:smoke OK` exit on both runs confirms the
assertion passed both times (the script prints no separate line for it).

**DEC-182 1000-id bound**: audited every `parseBoundedIdArray` call site
present at S' (`src/routes/files.ts:201` `MAX_ARCHIVE_FILES`,
`src/routes/tasks.ts:228,293`, `src/routes/api/submissions.ts:331`,
`src/routes/api/contacts.ts:542` `MAX_BULK_EMAIL_RECIPIENTS`) against
`scripts/perf-smoke.ts`'s calls — perf-smoke never calls any of these
bulk-id routes (bulk archive, bulk task-assign, bulk submission action,
bulk contact email). The only multi-id call perf-smoke makes is the
`schedule.ics?ids=` query (150 in the timed check, 301 in the untimed
DEC-080 cap probe), which is bounded by DEC-080's own 300-cap logic in
`src/routes/public.tsx`, not by `parseBoundedIdArray`/DEC-182. No
DEC-182 bound was tripped by any perf-smoke call — nothing to record as
FAIL.

Server killed (`pkill -f "wrangler dev --port 8845"`); `lsof -i :8845`
confirmed the port free afterward.

Detached perf-run worktree removed (`git worktree remove --force`)
after the gate; only `docs/verification-log.md` and this detail file
were modified, in the separate `task-w11-c` log-only worktree.

## OPEN ITEMS: 0

## RESULT: PASS
