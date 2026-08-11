# task-w17-e - full six-module `npm run walkthrough` orchestrator run @ da2b177

FROZEN SHA: da2b177d83fd2dcd695b49e636bcbdab8dd70c90
OPEN ITEMS: 0 (one KNOWN-PENDING, see below — not a new open item)
RESULT: FAILED (orchestrator aborted at `scale`, KNOWN-PENDING against task-w17-b)
RECHECK SHA: n/a — this lane is code-frozen (docs/verification-log/ only); no repair made here

## Purpose (DEC-330/DEC-329)

This is the first `-c3-` log to record `npm run walkthrough` running all six
modules — producer, review, speaker, public, data, scale — in order,
sequentially, against a single accumulating seeded D1 database. Prior `-c3-`
logs (`task-w17-a`, `task-w17-c`, etc.) each exercised a single module's
script directly; this run is the orchestrator itself
(`scripts/walkthrough.ts`), which aborts the whole run at the first module
failure and is the only place the mid-run state accumulation (e.g. the
`public` module's pagination interaction at
`scripts/walkthrough/public.ts:~628`, where by the time `public` runs the
event already holds a dozen-plus accepted sessions from `producer`/`review`/
`speaker`) is observable.

## Task premise verified before running

Per the task brief, task-w17-a's probe repair
(`db17ed6 Repair DEC-274-contradicting visibility probe in
walkthrough/public.ts`) is required for this orchestrator to get past
`public`. Confirmed present on this branch's history before starting:

```
git log --oneline -5
da2b177 merge task-w17-a
db17ed6 Repair DEC-274-contradicting visibility probe in walkthrough/public.ts
1fbc7f6 scribe wave 17
7a1c0f8 merge task-custodian-w16-3
6206b4a Decompose src/server/repo/public.ts into src/server/repo/public/ submodules
```

Branched via `git -C .../chautauqua worktree add .../chautauqua-wt/task-w17-e
-b task-w17-e main` — landed exactly on `main`'s tip at that moment
(`da2b177`), which is task-w17-a's merge commit.

## Setup (exact commands run)

```
npm ci --prefer-offline --no-audit --no-fund
npm run build                       # tsc x2 + vite build — clean, 0 errors
rm -rf .wrangler/state
npm run db:migrate                  # 18 migrations, all ✅
npm run seed                        # seed-r2 put 8 object(s)
cp .dev.vars.example .dev.vars
# .dev.vars: PUBLIC_BASE_URL edited 8787 -> 8793
npx wrangler dev --port 8793 &
npm run walkthrough -- --url http://localhost:8793
```

`wrangler dev` came up clean on `http://localhost:8793` with all bindings
(KV/EMAIL/DB/FILES/ASSETS + `PUBLIC_BASE_URL`/`DEV_MODE`) resolved.

## Per-module verbatim tails + `formatAreaPass` lines

### producer

```
Running DEC-175 authz probes (unauthenticated requests)...
  ok

producer walkthrough OK (J1, J2, J3, J5)
PASS producer
```

### review

```
ok: results are sorted by weighted aggregate score descending
ok: results CSV downloads with a row per result (plus header)

review walkthrough: OK (all checks passed)
PASS review
```

(20/20 individual `ok:` checks passed — DEC-039 cross-org, DEC-175
existence-hiding, laggard-remind email_log checks all included.)

### speaker

```
ok   DEC-175 speaker session on organizer API GET /api/v1/events/:id/submissions -> 403
ok   DEC-175 speaker session on organizer API GET /api/v1/contacts -> 403
ok   DEC-175 speaker session on organizer API GET /api/v1/events/:id/email-log -> 403

walkthrough/speaker.ts: all checks passed
PASS speaker
```

(89 individual `ok` checks passed, including the DEC-111 self-healed form
tasks, DEC-244 deliverable panel, DEC-070 invite endpoint, DEC-108
invite_status gate on public surfaces, DEC-175 IDOR/existence-hiding probes.)

### public

```
ok   J10 visibility gate: non-accepted submission is absent from every surface
ok   J10 visibility gate: accepted-but-content-unapproved session is absent from every surface
ok   J10 visibility gate (DEC-274): hidden participant's name vanishes everywhere but the session stays public with speakers:[]
ok   J10 DEC-108 invite-visibility gate: accepted invitee shown, pending and declined invitees absent

walkthrough/public.ts OK — all J9/J10 checks passed
PASS public
```

This is the module task-w17-a's repair unblocked; every J9 (agenda D&D,
conflict surfacing, auto-schedule) and J10 (all 5 public surfaces + embeds +
DEC-274/DEC-108 gates) check passed with the state accumulated by
producer/review/speaker already in the DB — including more than a dozen
accepted sessions by this point (the pagination interaction the task brief
names at `scripts/walkthrough/public.ts:~628` did not surface a failure;
the module's own `PER_PAGE=12`-aware pagination-follow checks
(`ok   J10 /sessions: cards + track filter nav present` and the earlier
DEC-274/DEC-108 checks) passed against that accumulated state).

### data

```
-- J12: export of another org's event 404s
-- J12: GET /docs/api returns 200

walkthrough:data OK — J11/J12 checks passed
PASS data
```

### scale (FAILED — orchestrator aborted here)

```
--- scale ---
Running step 1 (110 fresh contacts + submissions + participants)...
PASS step1 (110 fresh contacts + submissions + speaker participants)
Running step 2 (one bulk accept, 110 ids)...
PASS step2 (one bulk POST, 110 ids, updated=110)
Running step 3 (onboarding task_assignments for a sample of fresh contacts)...
FAILED: step3: sampled contact 5idyuk36a7uen6e6irrk has onboarding task_assignments
  expected 5 task_assignment cells, got 0
WALKTHROUGH FAILED at scale
```

Process exit code: `1`.

No final `Summary` block / `walkthrough OK` line was reached — the
orchestrator aborts the whole run at the first module failure (by design,
per this task's brief), and `scale` is the sixth and last module, so the
run terminated immediately after this failure with no further output.

## Classification (DEC-329)

`FAILED: step3 ... expected 5 task_assignment cells, got 0` at `scale` step
3 is a probe-vs-product question this lane does not own the resolution of:
`scripts/walkthrough/scale.ts` is owned by task-w17-b this wave, not by
task-w17-e or task-w17-a.

Checked whether task-w17-b's repair has landed on `main` as of this run:

```
git -C chautauqua log --oneline --all | grep -n 'task-w17-b\|first campaign-3 run of walkthrough scale'
831a0c0 task-w17-b: first campaign-3 run of walkthrough scale.ts + probe repair

git -C chautauqua merge-base --is-ancestor 831a0c0 main
# exit 1 (not an ancestor)  =>  NOT merged into main yet
```

`831a0c0`'s own commit message names exactly this failure mode: step 1 built
the 110 fresh participants via `POST /submissions/:id/participants`, which
always writes `inviteStatus='invited'` (DEC-070) and is correctly excluded
from onboarding planning by `isActiveParticipant` (DEC-274/278) — i.e. a
stale probe premise in `scale.ts`, not a product defect, repaired by
switching to `POST /events/:eventId/submissions` with an inline contact
(`inviteStatus='none'`).

Per the task's carve-out: **this failure is recorded as KNOWN-PENDING
against task-w17-b, not as a new OPEN ITEM.** Ran at frozen sha
`da2b177d83fd2dcd695b49e636bcbdab8dd70c90`, which predates task-w17-b's
`831a0c0` (not yet merged to `main` at the time of this run or at the time
this log was written). This lane made no edit to
`scripts/walkthrough/scale.ts` — that file is out of scope here (owned by
task-w17-b).

## POST-S DELTA (DEC-280 — never a STOP)

```
git -C chautauqua log --oneline da2b177d83fd2dcd695b49e636bcbdab8dd70c90..main -- src app migrations scripts test
00ad80a merge task-w17-d
5b89101 merge task-w17-c
b49373f perf-smoke: time all five public surfaces + whole-agenda .ics (DEC-331)
ef57424 DEC-332: restore DEC-258 frozen-attribution guard in public/{sessions,speakers}.ts

git -C chautauqua diff --stat da2b177d83fd2dcd695b49e636bcbdab8dd70c90..main -- src app migrations scripts test
 scripts/perf-smoke.ts              | 74 ++++++++++++++++++++++++++++++++++++++
 src/server/repo/public/sessions.ts |  6 ++++
 src/server/repo/public/speakers.ts |  6 ++++
 3 files changed, 86 insertions(+)
```

Four product commits landed on `main` between this lane's freeze (`da2b177`,
task-w17-a's merge) and the moment this log was written: task-w17-c
(`b49373f` perf-smoke, DEC-331) and task-w17-d (`ef57424`, DEC-332 restoring
the DEC-258 attribution guard in `public/sessions.ts`/`public/speakers.ts`),
plus their merge commits. None of these four touch
`scripts/walkthrough/scale.ts`, `src/server/repo/onboarding*`, or any
`task_assignment`-writing path, so the delta does not change the `scale`
classification above. Logged per DEC-280 as a delta, not treated as a STOP.

## Result

- producer: PASS (all `ok`/formatAreaPass checks)
- review: PASS (20/20 `ok:` checks)
- speaker: PASS (89/89 `ok` checks)
- public: PASS (all J9/J10 checks, unblocked by task-w17-a's DEC-274 probe
  repair, run against the mid-run accumulated state as intended)
- data: PASS (all J11/J12 checks)
- scale: FAILED at step 3 — KNOWN-PENDING against task-w17-b's unmerged
  `831a0c0` probe repair (`scripts/walkthrough/scale.ts`, DEC-086/DEC-089),
  not a new OPEN ITEM, not this lane's file to edit.

RESULT: FAILED (orchestrator exit code 1, aborted at `scale`) — but the sole
failing check is KNOWN-PENDING against task-w17-b's already-identified,
not-yet-merged repair. Five of six modules (producer, review, speaker,
public, data) passed in full, in sequence, against the single shared
accumulating seeded database, including `public`'s pagination-interaction
checks that only this full-orchestrator run exercises.

RECHECK SHA: n/a — no code was changed by this lane (code-frozen per task
brief); a recheck belongs to whichever future lane lands task-w17-b's merge
and re-runs this orchestrator.
