# task-w42-b — stage-1 exit ledger, full detail

Companion to
`docs/verification-log/index/0216-2026-08-15-task-w42-b-stage-1-exit-ledger-8b647c67.md`
(sequence 0216 taken instead of the brief's pre-allocated 0215, which was
already occupied by `0215-2026-08-15-task-w40-g-triage-closure-2e99b272.md`
at worktree cut — see the SEQ NOTE in the index section).

Scope: DEC-069/DEC-644/DEC-099/DEC-068. Frozen wave, adjudication/reporting
only — no `src/**`, `app/src/**`, `migrations/**`, or `package.json` byte
touched.

## STEP 0 — sync and receipt

`git -C <worktree> merge --no-edit main` reported "Already up to date."
(worktree cut directly from `main` tip `8b647c67`). Confirmed
`docs/verification-log/index/0210-2026-08-15-task-w42-a-triage-closure-e01f237e.md`
present at this HEAD via `ls`.

`npm run ref-state` receipt, pasted verbatim in the index section above,
repeated here for the detail record:

DEC-644 three-sha boundary: HEAD
`8b647c674ed96b612558b7928788936b3621b067`; newest first-parent
product-code-bearing sha `ed5c679e59828c5600cb84b51208056f7e38a445`; every
live ref (`main`, `manual-qa`, `task-custodian-w68-4`, `task-w42-b`,
`task-w68-d`, `task-w71-c`, `task-w71-d`, `task-w71-e`) confirmed an
ancestor of HEAD via `git merge-base --is-ancestor`. NON-ancestor refs
(NOT confirmed via `git merge-base --is-ancestor`):
`mail-rich-shape-fallback`, `task-w17-i`, `task-w68-b`, `task-w68-c`,
`task-w68-e`, `task-w71-a`, `task-w72-a`, `task-w72-b`, `task-w72-c`,
`task-w72-d`, `task-w72-e`, `task-w72-f`, `task-w72-g`, `task-w72-h`,
`task-w72-i`, `task-w72-j`.

## STEP 1 — mechanical exit predicate

Command: `npm run exit:predicate -- --product-sha
ed5c679e59828c5600cb84b51208056f7e38a445`.

Output table and stderr/exit code reproduced verbatim in the index
section. Exit code `1` (not all five slots PASS).

Per-slot re-derivation, matching what the script actually resolved by
reading `docs/verification-log.md`'s parsed sections and grading the
most-recently-appended, ancestry-valid section per slot
(`scripts/exit-predicate.ts`'s `gradePredicate`):

- **build-test-bundle**: only classifying section is `task-w40-a`
  (`0198`, header `14db7b30`, `RESULT: PASS`). PASS.
- **walkthrough**: only classifying section is `task-w40-b` (`0199`,
  header `14db7b30`, `RESULT: PASS`). PASS.
- **spec-audit**: only classifying section is `task-w40-d` (`0200`,
  header `14db7b30`, `RESULT: PASS`). PASS.
- **perf-smoke**: only classifying section is `task-w40-c` (`0201`,
  header `2e99b272`, `RESULT: PASS`). PASS.
- **triage-closure**: TWO sections classify to this slot at this HEAD —
  `task-w42-a` (`0210`, header `e01f237e`, `RESULT: PASS`,
  `OPEN ITEMS: 1`) and `task-w40-g` (`0215`, header `2e99b272`,
  `RESULT: FAIL`, `OPEN ITEMS: 3`). `gradePredicate` reverses the section
  array (document/append order, which is filename-sequence order once
  assembled) to try the most-recently-appended candidate first; because
  `0215` > `0210` in sequence number, `task-w40-g`'s section is tried
  first, is ancestry-valid at the product sha (`git merge-base
  --is-ancestor <productSha> 2e99b272` holds), and its verdict (FAIL) is
  returned without ever considering `task-w42-a`'s PASS. This is not a
  bug in this ledger's reading — it is exactly what the mechanical
  predicate does, and this ledger reports it as read, per the brief's
  explicit instruction not to fabricate a triage-closure verdict.

  Content-level note (not a re-grading, just an observation for the
  wave-43 owner): `task-w40-g`'s own section text describes a polling
  attempt cut from an *older* `main` tip (`9f78158b`) that predates
  `task-w42-a`'s work entirely, and its 3 open items are (1) an
  "absent perf-smoke slot" that `task-w40-c`'s later-merged section
  (`0201`, now present) already answers, (2) a duplicate spec-audit
  index-file pair, and (3) an `exit-predicate.ts` crash-on-unresolvable-sha
  bug that did not reproduce on this run (the script printed a clean
  five-row table, not a crash). None of these three items describes an
  outstanding *product* defect at the current boundary; they describe
  a state that has since moved on. But per this task's own scope
  (mechanical reading, not adjudication), this ledger does not
  reclassify or renumber `0215` to make triage-closure read PASS — that
  is filed as OPEN ITEM 1 for a wave-43 lane.

## STEP 2 — sibling enumeration

All four named wave-42 siblings (`0211`/task-w42-c, `0212`/task-w42-d,
`0213`/task-w42-e, `0214`/task-w42-f) are present at this HEAD. Full
per-section counts and RESULT lines are quoted in the index section's
table. None is `PENDING-OWNED`.

## Overall verdict

`RESULT: FAIL`, four OPEN ITEMS, exactly as filed in the index section.
The blocking conditions are independent of each other:

1. The triage-closure slot's mechanical FAIL is a sequencing/assembly
   artifact (a stale, higher-numbered section outranking a fresher,
   lower-numbered one), not itself a product defect — but it is exactly
   what DEC-069's exit predicate reads, so it blocks the gate as
   specified.
2. task-w42-c's CONFIRMED-DEFECT (contacts-merge non-atomicity) and
   task-w42-e's two CONFIRMED-DEFECTs (`autoSchedule320` window-blind
   filter; `perf-seed.ts` wiring gap) are real, adjudicated,
   filed-not-fixed defects per DEC-453's frozen-wave "file, never fix"
   rule.

Per this task's brief, wave 43 is therefore the code wave that must fix
exactly these enumerated rows (plus, if the wave-43 owner judges it in
scope, resolve the `0215`/`0210` sequencing artifact so a subsequent
mechanical read produces a genuine triage-closure PASS), and wave 44
must re-run all five slots in one frozen wave once that lands.
