## 2026-08-15 task-w42-b — stage-1 exit ledger @ 8b647c67

QUALIFYING

INVALIDATED BY: src/** app/src/** migrations/** package.json

SEQ NOTE (DEC-068): this task's brief pre-allocated sequence `0215` for
this section. At worktree cut, `0215` was already occupied by
`docs/verification-log/index/0215-2026-08-15-task-w40-g-triage-closure-2e99b272.md`
(a wave-40 sibling, merged to `main` ahead of this lane's branch cut).
Per DEC-068 ("THE PLANNER MINTS THE SEQ... collides -> allocate at plan
time"), this is a genuine seq collision discovered at run time, not an
assembler-time collision to resolve by re-running; taking neither side
is not applicable here since `0215` is legitimate content already on
`main`. This section takes the next free sequence number instead:
`0216`. Recorded here rather than silently renumbering so a reader can
reconcile the brief's stated `0215` against the actual filename.

STEP 0 — `git merge --no-edit main`: "Already up to date." (this
worktree was cut from `main` tip `8b647c67`, which already contains
`task-w42-a`'s triage-closure section, index file
`docs/verification-log/index/0210-2026-08-15-task-w42-a-triage-closure-e01f237e.md`
— confirmed present at this HEAD).

`npm run ref-state` receipt (verbatim):

> DEC-644 three-sha boundary: HEAD `8b647c674ed96b612558b7928788936b3621b067`;
> newest first-parent product-code-bearing sha
> `ed5c679e59828c5600cb84b51208056f7e38a445`; every live ref (`main`,
> `manual-qa`, `task-custodian-w68-4`, `task-w42-b`, `task-w68-d`,
> `task-w71-c`, `task-w71-d`, `task-w71-e`) confirmed an ancestor of HEAD
> via `git merge-base --is-ancestor`. NON-ancestor refs (NOT confirmed via
> `git merge-base --is-ancestor`): `mail-rich-shape-fallback`,
> `task-w17-i`, `task-w68-b`, `task-w68-c`, `task-w68-e`, `task-w71-a`,
> `task-w72-a`, `task-w72-b`, `task-w72-c`, `task-w72-d`, `task-w72-e`,
> `task-w72-f`, `task-w72-g`, `task-w72-h`, `task-w72-i`, `task-w72-j`.

Product sha used for STEP 1 (taken from the receipt above, USED AS
PRINTED, matches the brief's expectation): `ed5c679e59828c5600cb84b51208056f7e38a445`.

## STEP 1 — `npm run exit:predicate -- --product-sha ed5c679e59828c5600cb84b51208056f7e38a445`

Printed table (verbatim) and process exit code:

```
SLOT               STATUS  SHA       HEADER
build-test-bundle  PASS    14db7b30  ## 2026-08-15 task-w40-a — build+test+bundle @ 14db7b30
walkthrough        PASS    14db7b30  ## 2026-08-15 task-w40-b — walkthrough @ 14db7b30
perf-smoke         PASS    2e99b272  ## 2026-08-15 task-w40-c — perf-smoke @ 2e99b272
spec-audit         PASS    14db7b30  ## 2026-08-15 task-w40-d — spec-audit @ 14db7b30
triage-closure     FAIL    2e99b272  ## 2026-08-15 task-w40-g — triage-closure @ 2e99b272
```

stderr: `exit-predicate: not all five DEC-069 slots are PASS at product
sha ed5c679e59828c5600cb84b51208056f7e38a445.`

Process exit code: `1`.

### Slot-by-slot re-derivation (index file + sha behind each verdict)

1. **build-test-bundle** — PASS, sourced from
   `docs/verification-log/index/0198-2026-08-15-task-w40-a-build-test-bundle-14db7b30.md`
   @ `14db7b30`. Matches the brief's expectation.
2. **walkthrough** — PASS, sourced from
   `docs/verification-log/index/0199-2026-08-15-task-w40-b-walkthrough-14db7b30.md`
   @ `14db7b30`. Matches the brief's expectation.
3. **spec-audit** — PASS, sourced from
   `docs/verification-log/index/0200-2026-08-15-task-w40-d-spec-audit-14db7b30.md`
   @ `14db7b30`. Matches the brief's expectation.
4. **perf-smoke** — PASS, sourced from
   `docs/verification-log/index/0201-2026-08-15-task-w40-c-perf-smoke-2e99b272.md`
   @ `2e99b272`. Matches the brief's expectation.
5. **triage-closure** — FAIL, sourced from
   `docs/verification-log/index/0215-2026-08-15-task-w40-g-triage-closure-2e99b272.md`
   @ `2e99b272` (`RESULT: FAIL`, `OPEN ITEMS: 3`) — **NOT** the brief's
   expected source. `classifyScope`/`gradePredicate` picks the
   most-recently-*appended* (highest-sequence, i.e. last in
   `docs/verification-log.md`) triage-closure section that is an
   ancestry-valid PASS/FAIL verdict, and `0215` (task-w40-g, seq 0215)
   sorts after `0210` (task-w42-a, seq 0210) in the assembled log despite
   task-w40-g's own content describing an earlier, now-superseded polling
   attempt against a stale `main` tip (`9f78158b`, pre-dating
   task-w42-a's landed triage-closure section). Both sections are
   ancestry-valid at product sha `ed5c679e...` (`git merge-base
   --is-ancestor` holds for both `2e99b272` and `e01f237e`), so the
   mechanical last-appended rule — not staleness of content — decides
   the slot, and it decides FAIL. Read mechanically, not fabricated: this
   ledger does **not** substitute `0210`'s PASS/`OPEN ITEMS: 1` result for
   the mechanically-graded `0215` FAIL/`OPEN ITEMS: 3` result.

## STEP 2 — wave-42 sibling adjudication sections at this HEAD (DEC-644 honesty clause)

| Branch | Index file | CONFIRMED-DEFECT count | OPEN ITEMS | RESULT |
|---|---|---|---|---|
| task-w42-c | `docs/verification-log/index/0211-2026-08-15-task-w42-c-contacts-integrity-adjudication-824aac9b.md` | 1 (multi-id contact merge non-atomicity, `mergeContacts` src/server/repo/contacts/merge.ts:703-714; named wave-43 owner) | 1 | PASS |
| task-w42-d | `docs/verification-log/index/0212-2026-08-15-task-w42-d-content-lifecycle-adjudication-e01f237e.md` | 0 (both claims investigated and not confirmed against current tree) | 0 | PASS |
| task-w42-e | `docs/verification-log/index/0213-2026-08-15-task-w42-e-gate-gap-adjudication-824aac9b.md` | 2 (`autoSchedule` window-blind `existing` filter; `scripts/perf-seed.ts` perf-speaker wiring gap) | 2 | FAIL |
| task-w42-f | `docs/verification-log/index/0214-2026-08-15-task-w42-f-tier-1-fidelity-recheck-824aac9b.md` | 0 (9/11 sub-clauses re-derived clean, remaining 2 out of scope for this recheck per its own text) | 0 | PASS |

All four sibling sections named in this task's brief (0211/task-w42-c,
0212/task-w42-d, 0213/task-w42-e, 0214/task-w42-f) are present at this
HEAD — none is `PENDING-OWNED`.

## RESULT

`RESULT: PASS` requires (a) all five exit-predicate slots PASS **and**
(b) every present sibling section reports zero CONFIRMED-DEFECT rows
**and** (c) no sibling is PENDING-OWNED. Condition (c) holds (all four
present). Conditions (a) and (b) both fail:

- (a) fails: `triage-closure` slot reads FAIL (see STEP 1 slot 5 above).
- (b) fails: `task-w42-c` (1 CONFIRMED-DEFECT: contacts-merge
  atomicity) and `task-w42-e` (2 CONFIRMED-DEFECT: `autoSchedule320`
  window-blind filter; `perf-seed.ts` perf-speaker wiring gap) both
  report CONFIRMED-DEFECT rows > 0.

RESULT: FAIL — stage-1 exit predicate is NOT satisfied at product sha
`ed5c679e59828c5600cb84b51208056f7e38a445`: the mechanically-graded
triage-closure slot reads FAIL (superseded by a higher-sequence stale
section, `0215` over `0210` — see STEP 1 item 5), and 3 total
CONFIRMED-DEFECT rows remain open across wave-42 siblings (1 from
task-w42-c, 2 from task-w42-e). Blocking items, verbatim owners as
filed by their originating sections:
1. Mechanically-graded triage-closure FAIL — `0215` (task-w40-g)
   supersedes `0210` (task-w42-a) by append order despite being content-stale;
   no code fix applies here (this is a sequencing/assembly artifact, not
   a product defect) — owner: wave-43 lane, retire or renumber the
   stale `0215` section (or otherwise make the assembler/exit-predicate
   ancestry-aware of content staleness, not just append order) so a
   fresh, correctly-ordered triage-closure PASS can be read.
2. `mergeContacts` multi-id merge non-atomicity (CONFIRMED-DEFECT,
   `src/server/repo/contacts/merge.ts:703-714`) — owner: wave-43 lane
   `task-w43 contacts-merge-atomicity`.
3. `autoSchedule()` window-blind `existing` filter (CONFIRMED-DEFECT) —
   owner: named in `docs/verification-log/index/0213-...md`.
4. `scripts/perf-seed.ts` perf-speaker wiring gap (CONFIRMED-DEFECT,
   scripts-only) — owner: `scripts/perf-seed.ts`, wave-43 lane.

OPEN ITEMS: 4

Full detail: `docs/verification-log/task-w42-b-stage-1-exit-ledger-8b647c67.md`.
