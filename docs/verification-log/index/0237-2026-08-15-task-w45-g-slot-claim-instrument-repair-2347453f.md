## 2026-08-15 task-w45-g — slot-claim instrument repair @ 2347453f

QUALIFYING (advisory to the DEC-069 predicate — this scope classifies to none of the five slots)

INVALIDATED BY: src/** app/src/** migrations/** package.json

Two DEC-069 slot-claim defects fixed in `scripts/exit-predicate.ts`: (i)
`gradePredicate`'s candidate filter never read the parsed
`LogSection.qualifying` flag, so any scope-matching section could decide
a gate slot whether or not it carried the wave-28 `QUALIFYING` label; (ii)
`classifyScope` was a loose keyword substring match (bare `/perf/`),
misclaiming real corpus sections like `0176` ("onboarding grid TIER-0
perf") and `0184` ("files library headshot join perf") that are not
perf-smoke gates. Fixed per DEC-099 w45: a section is now a slot
candidate only if BOTH `qualifying === true` AND `classifyScope` matches
the canonical name as a whole token.

Preserved w44-g's newest-measured-tree ranking (`survivors`/`isAncestor`
discard in `gradePredicate`), already present at branch cut and
orthogonal to this change (theirs orders candidates, mine filters the
candidate set).

`npm run exit:predicate -- --product-sha
14da2921a5be66408057712be877bc44c19de6c4` before this change: uncaught
crash (no table produced at all — the pre-existing, already-logged
`0215 item 3`/`0216#1` defect, reproduced here against wave-11's
`7561cc1`). After: full five-row table (`build-test-bundle` FAIL,
`walkthrough` PASS, `perf-smoke` PASS, `spec-audit` PASS,
`triage-closure` FAIL — both FAILs are pre-existing content verdicts on
`task-w44-a`/`task-w44-f`, unrelated to this change). No slot's
PASS/FAIL/VOID/MISSING status moved — before had none at all (crash);
full reasoning and both verbatim tables in the detail doc. The crash
defect itself is NOT claimed fixed here (out of this task's two-defect
scope) and stays open for a future owner.

Full detail:
`docs/verification-log/task-w45-g-slot-claim-instrument-repair-2347453f.md`.

`npm run test:targeted -- test/exit-predicate.test.ts
test/exit-predicate-corpus.test.ts`: 2 files, 50 tests, PASS. `npm run
build`: green. `npx tsc --noEmit -p .`: clean.

RESULT: PASS — both named defects fixed and verified against the real
corpus; no gate slot verdict moved; targeted tests and build green.

OPEN ITEMS: 1 (pre-existing, not owned by this task: `isAncestor`
uncaught-crashes on an unresolvable git object reachable from a
`QUALIFYING`-labeled candidate; this fix only sidesteps it for the
wave-11 candidate at this product sha by excluding it via the qualifying
gate. Carried forward from `0215 item 3`/`0216#1`.)
