# Wave 74 receipts (docs-only lane, task-w74-e)

Runtime: `main` at `ba170df7770483af738d36ebe72b0b987877bb583` ("scribe
wave 74") in this worktree at the time of this read, `date -u
+%Y-%m-%dT%H-%M` = `2026-08-16T10-10`. Per DEC-069 wave 74 is a CODE
wave, so this lane files no `docs/verification-log/index/` section —
this file, the `docs/eval-findings.md` header rebase, its index repair,
and the `## Amendment (wave 74)` filed on `decisions/DEC-358.md` are the
whole deliverable of this lane. All citations were re-derived AT THIS
TASK'S OWN RUNTIME per DEC-903 (a finding is a claim about a snapshot,
not about main) and DEC-358's rebase rule.

NOTE ON SCOPE OVERLAP: at plan time, no decision carried a `## Amendment
(wave 74)` heading. By the time this lane started, `ba170df7` ("scribe
wave 74") had already landed `## Amendment (wave 74)` sections on
`decisions/DEC-069.md`, `decisions/DEC-346.md`, `decisions/DEC-707.md`,
`decisions/DEC-829.md`, `decisions/DEC-919.md`, `decisions/DEC-932.md`
and `decisions/DEC-988.md`, plus five lines appended to
`field-guide/index.md`. The DEC-069, DEC-829 and DEC-932 amendments
already state substantially the same rulings this lane's brief assigned
(wave-74-is-a-code-wave; the plans-results CSV bound; the acceptance
back-fill's fourth filing). Per this lane's own instruction — "if a
heading exists, file under a distinguishing title rather than
duplicating" — this lane does NOT re-file those three; it verified each
against the tree and found them accurate, and records that verification
here instead. `decisions/DEC-358.md` had no wave-74 heading and gets one
from this lane, distinguished by title from the wave-74 heading already
present on the other three DECs.

## 1. IN FLIGHT census, rebuilt from `.git/refs/heads/*` loose refs and
the TAIL of `.git/logs/HEAD` at this task's own runtime (never
`.git/packed-refs`, per the standing DEC-358 method — this repo's
packed-refs is still a live trap from an interleaved earlier campaign)

Ancestors of `main` at this runtime (merged, closed, do not re-file):
all `task-w73-*` branches (`-a` through `-e`) — confirmed via
`git merge-base --is-ancestor <ref> main` for each. The reflog tail
shows a full wave-73 merge train (`task-w72-n`, `task-w72-p`,
`task-w73-a` through `-e`) landing between `b85dffb1` ("scribe wave 73")
and `ba170df7` ("scribe wave 74"), followed by a standalone "Delta-probe
6" commit (`9087ce9d`) and then the scribe commit itself — `ba170df7`
was written directly, with no wave-74 branch merges preceding it.

NOT ancestors of `main` at this runtime (live, unmerged) — the five
wave-74 branches:
- `task-w74-a` — no unique commits yet (identical to `main` tip);
  scope per `decisions/DEC-707.md`'s and `decisions/DEC-346.md`'s
  wave-74 amendments (`reviewer.ts`'s `needsMoreRatings` predicate
  folded into `plans-progress.ts`'s `assigned` denominator, plus the
  queue envelope's `cappedOut` field) — verified NOT YET landed in code:
  `grep -n cappedOut src/routes/review/reviewer.ts` returns nothing at
  this runtime.
- `task-w74-b` — no unique commits yet; scope per `decisions/DEC-988.md`'s
  wave-74 amendment (`PortalData.showResourcesByEventId`, per-event
  resource gating) — verified NOT YET landed: `grep -n
  showResourcesByEventId src/server/repo/portal/data.ts` returns nothing.
- `task-w74-c` — no unique commits yet; scope unassigned to this lane
  (do not guess further than the DEC amendments already state).
- `task-w74-d` (`bf77164e`, "Speakers track facet: use shared
  PublicFilterSelectForm, add submit-pairing scan") — LIVE, in progress.
  Scope per `decisions/DEC-919.md`'s wave-74 amendment: delete the
  hand-inlined `TrackFacetSelect` in `src/routes/public/speakers.tsx`
  (its only submit sits at `left:-9999px` with no `onchange` on the
  select) and consume the shared `PublicFilterSelectForm` instead —
  verified NOT YET landed on `main`: `TrackFacetSelect` is still defined
  at `src/routes/public/speakers.tsx:76` and used at `:243,326` at this
  runtime. OFF-LIMITS to this lane and to any future wave until it lands
  — do not re-file the speakers-facet defect, it is owned.
- `task-w74-e` (this branch) — in progress, writing this file.

`task-w74-a`, `-b`, `-c` having zero unique commits at this runtime does
NOT mean they are inactive; it means their work had not yet been
committed when this lane read the tree. A future wave rebuilding this
census must re-derive from loose refs at ITS OWN runtime, not copy this
paragraph forward.

## 2. DO-NOT-CHASE verified this wave

(a) **DEC-932 — acceptance task back-fill, fourth filing.** Re-read
`src/server/repo/submissions/status.ts:345-350` (`activateAcceptedParticipants`)
at `ba170df7`: unchanged shape, cross-joins every event task onto every
newly-active participant. `decisions/DEC-932.md`'s wave-74 amendment
(already on `main`, not re-filed by this lane) restates the standing
ruling from findings-wave-6 and the wave-43 amendment: DELIBERATE, the
J6 grid is dense by design, `POST /tasks/:id/assign` is additive not a
ceiling, and `test/onboarding-task-backfill.test.ts` +
`test/acceptance-backfill-scope.test.ts` pin the invariant that the
back-fill only ever inserts missing pairs. Confirmed both test files
still exist at this runtime. No task filed.

(b) **DEC-829 — `/plans/:id/results?format=csv` bound.** Verified this
wave: `MAX_PLAN_SUBMISSION_SCAN` (`src/server/repo/review/submissions.ts:22`)
and `EXPORT_MAX_ROWS` (`src/server/repo/exports/table.ts:24`) are both
`20000` at this runtime. `decisions/DEC-829.md`'s wave-74 amendment
(already on `main`, not re-filed by this lane) correctly rules that a
sibling `EXPORT_MAX_ROWS` guard on the CSV path would be a refusal that
can never fire ahead of the scan-cap refusal already in place. No task
filed.

(c) **FINAL-FREEZE item 7(c), "seeded reviewer assignments overlap
broadly" — DOES NOT REPRODUCE.** Re-read `scripts/seed.ts:1375-1392` at
this runtime: four reviewers are assigned one track each against a
single seeded evaluation plan, with exactly one track (track 1) doubled
between two reviewers. That is a narrow, single overlap, not the broad
overlap the FINAL-FREEZE item describes. No task filed; this DO-NOT-CHASE
is recorded here rather than as a DEC amendment, since no standing DEC
governs the seed's reviewer-assignment shape.

(d) **FINAL-FREEZE item 3, "public search submit is off-screen" —
CLOSED for the general public search, OPEN and OWNED for the speakers
track facet.** Re-read `src/routes/public/filters.tsx:45-50` and
`src/routes/public/css/chrome.css.ts:149-170` at this runtime: the
general public search submit is a real, visibly-styled magnifier
button — CLOSED. The related but distinct defect on
`src/routes/public/speakers.tsx`'s `TrackFacetSelect` (no `onchange`,
submit at `left:-9999px`) is real and is `task-w74-d`'s scope this wave
(see section 1 above) — recorded here as IN FLIGHT, not re-filed as a
new item.

## 3. Files touched by this lane

- `docs/eval-findings.md` — header rebased from wave 62 (`80a3eac3`) to
  wave 74 (`ba170df7`); the stale wave-67 "mandate hygiene pass" block
  (branches all now ancestors of `main`) pruned; decomposition index
  repaired to list files 13 and 14 (already on disk, previously
  unlisted) and this new file 15.
- `docs/eval-findings/15-wave74-receipts.md` — this file (new).
- `decisions/DEC-358.md` — `## Amendment (wave 74, task-w74-e)` appended,
  distinguished by title from the wave-74 headings already on
  DEC-069/DEC-829/DEC-932/DEC-346/DEC-707/DEC-919/DEC-988.

Not touched, per this lane's own scope fence: `field-guide/index.md`
(scribe-owned), any file under `src/` or `app/src/`, and the DEC-069/
DEC-829/DEC-932 amendments already landed by `ba170df7`.
