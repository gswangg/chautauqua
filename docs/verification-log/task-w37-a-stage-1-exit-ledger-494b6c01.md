# task-w37-a — stage-1 exit ledger @ 494b6c01

DEC-069/DEC-644/DEC-068 constrained, DOCS ONLY (DEC-069 wave-37 amendment:
no src/, app/src/, migrations/, or package.json file touched by this
lane). This is DEC-069's REQUIRED FIFTH SECTION (the triage-closure
section, never yet produced) plus a grading pass reading the four
required gate sections that already landed on main during wave 36.

## Ref truth, derived at this lane's own runtime (not inherited from the brief)

```
$ git rev-parse HEAD
494b6c016c726178b53c76a55c33512bd2449422

$ git log --first-parent -1 --format=%H -- src/ app/src/ migrations/ package.json
3a041507287b2dca3abeda3e0648a41ddeba9707

$ git log --first-parent --oneline 3a041507287b2dca3abeda3e0648a41ddeba9707..HEAD -- src app migrations package.json
(empty — no product commit has landed on the first-parent line since 3a041507)

$ git merge-base --is-ancestor 3a041507287b2dca3abeda3e0648a41ddeba9707 HEAD && echo YES
YES

$ git for-each-ref refs/heads
(29 refs; only task-w3* glob matches enumerated below — task-w17-i,
task-w68-*, task-w71-*, task-w72-* excluded per the DEC-644 glob)
786642f7... refs/heads/mail-rich-shape-fallback
494b6c01... refs/heads/main
845dc7cb... refs/heads/manual-qa
864b681e... refs/heads/task-w36-c
76431743... refs/heads/task-w36-e
3b3b56c7... refs/heads/task-w36-f
494b6c01... refs/heads/task-w37-a
494b6c01... refs/heads/task-w37-b
494b6c01... refs/heads/task-w37-c
(plus task-w17-i, task-w68-*, task-w71-*, task-w72-*, none matching task-w3*)
```

Per-ref ancestry (`git merge-base --is-ancestor <ref> HEAD`):

- `task-w36-c` (864b681e): NOT-ANCESTOR of HEAD. `git merge-base
  --is-ancestor main task-w36-c` also NO. This is a genuinely divergent,
  unmerged branch tip — but its own content (the perf-smoke receipt files)
  is independently present on `main` via a *different* commit
  (`ac713fcfd957a9984268995f48ee0d35bec79618`), confirmed by `git log
  --first-parent --name-only -1 ac713fcf` listing
  `docs/verification-log/index/0190-2026-08-15-task-w36-c-perf-smoke-f5783479.md`
  and `docs/verification-log/task-w36-c-perf-smoke-f5783479.md`. Field
  guide pattern: COMMITTED-UNMERGED lane whose payload reached main by a
  separate scribe/assembly commit.
- `task-w36-e` (76431743): NOT-ANCESTOR of HEAD, same pattern — content
  present on main via commit `172d3d7596ecd7ded6f8ef081f77110b5aa45ee0`
  (`docs/verification-log/index/0190-2026-08-15-task-w36-e-render-sweep-f5783479.md`).
- `task-w36-f` (3b3b56c7): ANCESTOR of HEAD. `git log --first-parent
  --name-only -1 3b3b56c7` = `merge task-w36-b`, and this exact sha is
  already on main's first-parent line per the earlier `git log
  --first-parent --name-only -40` scan — this ref is fully subsumed, not a
  live divergent lane.
- `task-w37-a`, `task-w37-b`, `task-w37-c`: ANCESTOR (identical to HEAD at
  read time — zero commits of their own yet, per this wave's own briefs).

Newest product-bearing sha (3a041507) unchanged since wave 36 confirms
every wave-36 gate section (all headered `f5783479`, one commit past
3a041507 on the first-parent line) is **QUALIFYING**, not VOID, at this
boundary.

## The four required gate sections, as they exist on main today

All five wave-36 receipts (a, b, c, d, e) are present on `main`, each
merged via its own commit (not all via `task-w36-f`'s merge — `task-w36-a`,
`-b`, `-c`, `-d`, `-e` each landed as a standalone commit:
`45b9ff51`/`3b3b56c7`/`ac713fcf`/`980b094b`/`172d3d75` respectively; see
the `git log --first-parent --name-only -40` scan). Grading each against
DEC-069's four required rows:

### 1. build+test+bundle — `task-w36-a`

Header: `## 2026-08-15 task-w36-a — build+test+bundle @ f5783479` — present
at `docs/verification-log/index/0190-2026-08-15-task-w36-a-build-test-f5783479.md`.

RESULT line, verbatim:
```
RESULT: PASS (build clean, 1084/1084 test files and 11898/11898 tests
green, bundle 69.20 kB gzip vs 300 kB budget) at f5783479, with all
three live w3*-glob sibling refs (task-w35-a, task-w35-e, task-w35-f)
confirmed ANCESTOR.
OPEN ITEMS: 0
```

Header sha `f5783479`: `git merge-base --is-ancestor 3a041507... f5783479...`
exits 0 (3a041507 is an ancestor of f5783479, and no product commit landed
between them) → **QUALIFYING**.

### 2. J1-J12 persona walkthrough — `task-w36-b`

Header: `## 2026-08-15 task-w36-b — J1-J12 persona walkthrough @ f5783479` —
present at `docs/verification-log/index/0190-2026-08-15-task-w36-b-walkthrough-f5783479.md`.

RESULT line, verbatim:
```
RESULT: PASS — all six walkthrough areas (producer, review, speaker,
public, data, scale) PASS at product sha 3a041507 (HEAD f5783479 is
docs-only on top of it), including the DEC-063-amended break-lifecycle
(producer/J9), printable programme, and anonymous hub sections, once a
gitignored local .dev.vars port mismatch — precedented, not a product
defect — was corrected per task-w26-f's own fix.
OPEN ITEMS: 0
```

Same header sha `f5783479` → **QUALIFYING**.

### 3. perf smoke — `task-w36-c`

Header: `## 2026-08-15 task-w36-c — perf-smoke gate, default profile, at
own tip @ f5783479` — present at
`docs/verification-log/index/0190-2026-08-15-task-w36-c-perf-smoke-f5783479.md`.

RESULT line, verbatim:
```
RESULT: FAIL (`reviewer queue`, 1 of 3 runs PASS, row remains OPEN at this
boundary despite carrying every ancestor fix task-w35-a credited) / PASS
(`plan results (page 1)`, 3 of 3 runs PASS, row CLOSED at this boundary) at
f5783479c7a1b8c96ef1506c3cfff1661fd6e338. `files library (page 1)` and
`onboarding grid (800 speakers x 5 tasks)` both closed, 3 of 3 PASS each.
`portal home`/`portal tasks`/`portal submission detail` (task-w35-d, an
ancestor) all PASS 3 of 3, but only reachable via this lane's
measurement-only local D1 fixup — unreachable via the documented recipe
alone until `scripts/perf-seed.ts`'s missing perf-speaker insert loop
(FINDING above) is landed.
OPEN ITEMS: 4
```

Same header sha `f5783479` → **QUALIFYING**, but RESULT is FAIL.

### 4. SPEC §6/§7/§8/§9 static audit — `task-w36-d`

Header: `## 2026-08-15 task-w36-d — SPEC static-audit gate @ f5783479` —
present at
`docs/verification-log/index/0190-2026-08-15-task-w36-d-spec-audit-f5783479.md`.

RESULT line, verbatim:
```
RESULT: QUALIFYING.
OPEN ITEMS: 1 — the `< 300 KB gz` figure at this exact HEAD
(`f5783479`) is `PENDING-OWNED(task-w36-a)`; the last known ancestor
reading (`c6dbdb7c`, 69.19 kB gz) is 126 commits stale and not re-inferred
as still-PASS. All other §6/§7/§8/§9/rubric items above are CONFIRMED with
a quoted file:line or grep at this HEAD.
```

Same header sha `f5783479` → **QUALIFYING**. Note: this section's own
`RESULT:` line literally reads `QUALIFYING`, not `PASS`/`FAIL`, in its
source file — quoted verbatim above rather than reinterpreted.

Cross-reference (not a fix, DEC-453): sibling `task-w36-a`'s receipt,
landed at the identical header sha `f5783479`, independently reports a
fresh `bundle:check` figure — `Entry bundle: index-9Qx35kD0.js +
index-DpG2gFFa.css = 69.20 kB gzip (budget 300.00 kB)` / `bundle:check
PASSED` — which answers task-w36-d's own `PENDING-OWNED(task-w36-a)` row.
This lane does not edit `task-w36-d`'s file to fold that in; it is left as
a triage-closure row below with a named wave-38 owner to do that citation
work formally.

### Advisory row (not one of the four required rows) — render-sweep, `task-w36-e`

Header: `## 2026-08-15 task-w36-e render-sweep @ f5783479` — present at
`docs/verification-log/index/0190-2026-08-15-task-w36-e-render-sweep-f5783479.md`.
RESULT line, verbatim: `RESULT: PASS — exit code 0, all seven passes 100%
clean...` / `OPEN ITEMS: 0`. QUALIFYING. Listed for completeness only;
DEC-069 names four required sections, not five.

## Stage-1 exit predicate verdict

Per DEC-069: exit requires all four required gate sections to read
`RESULT: PASS` at (or after) the newest product-bearing sha, plus a
triage-closure section reading `OPEN ITEMS: 0`. At this boundary:

- build+test+bundle: PASS, QUALIFYING.
- walkthrough: PASS, QUALIFYING.
- perf smoke: **FAIL**, QUALIFYING (i.e. the FAIL is a fresh, valid
  reading — not stale).
- SPEC static audit: QUALIFYING (its own RESULT line literally reads
  "QUALIFYING", carrying 1 still-open dependency).
- triage closure: produced by this lane below, `OPEN ITEMS: 5`.

**The stage-1 exit predicate is NOT satisfied.** 3 of 4 required rows are
green; perf smoke is red (reviewer queue), and the triage-closure count is
5, not 0.

## Triage closure (DEC-069's required fifth section)

Every `OPEN ITEMS:` count > 0 found in the wave-36 receipts above,
expanded to a file:line and a named wave-38 owner lane. Nothing below is
fixed by this lane (DEC-453 — a lane that fixes what it measures cannot
report on the sha it measured; this is a docs-only, frozen-product wave
besides).

1. **Reviewer queue perf instability.** `src/routes/review/reviewer.ts`,
   the `GET /api/v1/review/plans/:id/queue` handler. Measured at
   `f5783479` (`task-w36-c-perf-smoke-f5783479.md`): 1 of 3 runs PASS
   (raw 54.2/36.5/58.5ms, adjusted 51.5/34.1/55.3ms against the 50ms read
   class budget), despite carrying its credited `task-w32-b` fix (proven
   ancestor). Owner: wave-38 lane — perf-stability pass on the reviewer
   queue handler (investigate whether the `Promise.all` wave still
   dominates, or whether it is measurement-machine variance, per
   task-w36-c's own framing).
2. **Plan progress perf instability (non-mandate).**
   `src/routes/review/plans-progress.ts`. Measured at `f5783479`: 1 of 3
   runs PASS (raw 60.7/43.0/56.5ms, adjusted 58.1/40.7/53.2ms against the
   50ms read budget) — the same instability pattern `task-w35-a` already
   logged at `a0b8501b` (55.3/47.1/60.0ms there). Owner: wave-38 lane —
   perf-stability pass on `plans-progress.ts`'s `GET .../progress`
   handler.
3. **`scripts/perf-seed.ts` missing the perf-speaker insert loop.**
   `scripts/perf-seed.ts` (mirror site: the existing reviewer-minting
   loop at `scripts/perf-seed.ts:440-470`) has no function that inserts
   the `user`/`contact`/`participant`/`task_assignment` rows
   `scripts/perf-seed-lib.ts`'s `PERF_SPEAKER_USER_ID` /
   `PERF_SPEAKER_CONTACT_ID` / `perfSpeakerParticipantId` /
   `perfSpeakerTaskAssignmentId` / `isPerfSpeakerTaskAssignmentComplete`
   are exported for — `grep -n "PERF_SPEAKER\|perfSpeaker"
   scripts/perf-seed.ts` returns zero matches. Effect: the documented
   recipe (`npm run seed` → `npm run perf:seed` → `wrangler dev` → `npm
   run perf:smoke`) throws in `login()` (`expected 302, got 401`) before
   any check runs — the entire perf-smoke harness is blocked without a
   manual local-D1 fixup. Owner: wave-38 lane — add the perf-speaker
   insert loop to `scripts/perf-seed.ts`.
4. **`scripts/perf-seed-lib.ts`'s `perfSpeakerAcceptedIndexes` doc comment
   assumes seed order, not the admin list's actual descending order.**
   `scripts/perf-seed-lib.ts` (the `perfSpeakerAcceptedIndexes` doc
   comment) and the matching comment at `scripts/perf-smoke.ts`'s
   `portalSubmissionId` line assume the perf speaker's participant rows
   should attach to the first N ids in seed order
   (`seed_perf_submission_1501..1505`), but `GET
   /api/v1/events/:id/submissions?status=accepted` page 1 — what
   `fetchAcceptedSubmissionIds`/`icsIds[0]` actually reads — returns
   **descending** order, so page 1 of the default profile's 300 accepted
   submissions is `_1800, _1799, ... _1798` and `icsIds[0]` is `_1800`,
   not `_1501`. Implementing item 3 per the current doc comment
   reproduces `portal submission detail failed during warmup: 404`
   (task-w36-c's own first attempt hit this exact failure before
   correcting to `_1800..1796`). Owner: wave-38 lane — same lane as item
   3, sequenced after it (fix the doc comment and the insert loop
   together, drawing indices from the admin list's actual page-1 order or
   querying it directly rather than assuming seed order).
5. **SPEC static audit's `PENDING-OWNED(task-w36-a)` bundle row not yet
   folded in.** `docs/verification-log/task-w36-d-spec-audit-f5783479.md`
   recorded the `< 300 KB gz` figure as `PENDING-OWNED(task-w36-a)`
   because, at the moment `task-w36-d` read `task-w36-a`'s ref, it was
   identical-to-HEAD (no product-fresh figure landed on it yet). Sibling
   `docs/verification-log/task-w36-a-build-test-f5783479.md`, landed at
   the identical header sha `f5783479`, already carries the fresh number
   (`69.20 kB gzip (budget 300.00 kB)` — `bundle:check PASSED`). No lane
   has re-run the SPEC static-audit section to cite that figure and
   retire the `PENDING-OWNED` label. Owner: wave-38 lane — next SPEC
   static-audit run cites `task-w36-a`'s 69.20 kB figure directly (not a
   fresh `bundle:check` invocation — that number already exists at this
   exact sha) and closes this row.

OPEN ITEMS: 5
