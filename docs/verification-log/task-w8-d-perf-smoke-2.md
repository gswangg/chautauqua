# 2026-08-10 task-w8-d — perf-smoke @ 38860f9

Full detail for the `## 2026-08-10 task-w8-d — perf-smoke @ 38860f9` section
of `docs/verification-log.md` (extracted per the contention-decomposition of
that file; see the stub entry there for `OPEN ITEMS` / `RESULT` summary).

DEC-069/DEC-088/DEC-139/DEC-176/DEC-177 gate, wave-8/9 battery (S = the
`task-w8-a` harness-closure merge). Log-only lane; full detail also in
`docs/verification-log/task-w8-d-perf-smoke.md`.

**STEP 1 — frozen sha.** First-parent walk from `main` tip in a fresh
worktree: `main` HEAD is `38860f9` ("merge task-w8-a"), immediately
preceded (first-parent) by `a8a4785` ("scribe wave 9"), `5d3acae`
("scribe wave 8"), `466f45b` ("scribe wave 7") — all doc-only bookkeeping
— and `38860f9` is itself code-bearing (it is the merge of
`52dd2b2`, "w8-a: harness-closure lane — DEC-173/174/175 walkthrough
fixes + authz probes"). No further code-bearing commit sits after it, so
S = `38860f9`. `git merge-base --is-ancestor 2dd2f33 38860f9` exits 0 —
PASS. `git show 38860f9:.github/workflows/ci.yml` contains
`render-sweep:` (line 87) / `npm run gate:render-sweep` (line 97).
Adopted sha: **`38860f9`**.

DEC-177 precondition grep list (six w6 fixes + harness closure), all hit
in this worktree at S:
- `DEC-167` in `src/domain/contacts.ts:165`
- `ICS_ORGANIZER_EMAIL` in `src/mail/ics.ts:15`
- `"unknown track id"` in `src/routes/api/forms.ts:113`
- `"anonymized === false"` in `src/server/repo/files.ts:153`
- `openDate` in `app/src/pages/review/PlanEditor.tsx:107,143`
- `FORM_TASK_FIELD_SPECS` in `scripts/seed.ts:19,909,931`
- `DEC-174` in `scripts/seed.ts:975`
- `DEC-173` in `scripts/walkthrough/public.ts:440`
- `DEC-173` in `scripts/walkthrough/speaker.ts:923`
- `DEC-175` in `scripts/walkthrough/producer.ts:773,776,781,784,787,792,833`
- `DEC-175` in `scripts/walkthrough/speaker.ts:1156-1197`
- `DEC-175` in `scripts/walkthrough/review.ts:312,321,603,612,617,627,632`

No miss — proceeding to the gate.

**STEP 2.** `npm ci --prefer-offline --no-audit --no-fund --silent`
(clean). `npm run build` — PASS (dual `tsc --noEmit` + `vite build`, 131
modules transformed, no errors). `rm -rf .wrangler/state` — fresh
worktree, nothing present. `npm run db:migrate` — 13 migrations
(`0000`-`0010`, `0012`, `0013`) applied clean. `npm run seed` — required
first (per this gate's instructions: `perf:seed` alone seeds no
login-capable identity); ran clean, 8 R2 objects uploaded to local bucket
`chautauqua-files`. `npm run perf:seed` — first attempt's
`wrangler d1 execute --file=.perf-seed.sql` step failed transiently
(`ERROR other side closed` after ~19s, a miniflare/workerd hiccup, not a
data or schema issue — `tsx scripts/perf-seed.ts` itself, which writes
`.perf-seed.sql`, completed fine both times); re-ran
`npx wrangler d1 execute chautauqua --local --file=.perf-seed.sql`
directly and it completed clean, every batch reporting `"success": true`
(no `false` anywhere in the output). Verified DEC-088 scale directly in
D1: `SELECT count(*) FROM submission WHERE id LIKE 'seed_perf_%'` = 2000;
`... AND status='accepted'` = 300 (12 reviewers were seeded per the
script's fixed scale, not independently re-queried here).

`npx wrangler dev --port 8823` (never 8787/8801/8821/8822) started in the
background; polled `GET /health`, got `{"ok":true}` (200).

`PERF_URL=http://localhost:8823 npm run perf:smoke` — **run 1: exit 0**
("perf:smoke OK"). **Run 2: exit 0** ("perf:smoke OK"), both confirmed
via the tee'd log + `$?`. Full p95 tables (budget 150ms, all `ok` both
runs):

Run 1:
```
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

Run 2:
```
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

Run 2's latencies are uniformly higher than run 1's (still all well
under the 150ms budget) — consistent with shared-machine warm-cache
variance from a concurrent sibling lane rather than a regression; both
runs pass every row.

DEC-080 301-id schedule.ics cap assertion: `perf-smoke.ts` throws
synchronously (untimed, before the measured loop) on any non-400
response to the 301st synthetic nonexistent `schedule.ics` id request —
the clean `perf:smoke OK` exit on both runs confirms this assertion
passed both times; the script prints no separate line for it.

Server killed (`pkill -f "wrangler dev --port 8823"`); `lsof -i :8823`
confirms the port is free.

OPEN ITEMS: 0

RESULT: PASS
