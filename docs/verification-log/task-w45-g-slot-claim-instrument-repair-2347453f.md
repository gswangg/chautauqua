## 2026-08-15 task-w45-g — slot-claim instrument repair @ 2347453f

QUALIFYING (advisory to the DEC-069 predicate — this scope classifies to none of the five slots)

INVALIDATED BY: src/** app/src/** migrations/** package.json

STEP 0 receipt (`npm run ref-state`, verbatim):

```
DEC-644 three-sha boundary: HEAD `8b65b63ace26b79e23a2d19dd5b8d91a3eca9ed2`;
newest first-parent product-code-bearing sha
`14da2921a5be66408057712be877bc44c19de6c4`; every live ref (`manual-qa`,
`task-custodian-w68-4`, `task-w45-f`, `task-w45-g`, `task-w68-d`,
`task-w71-c`, `task-w71-d`, `task-w71-e`) confirmed an ancestor of HEAD
via `git merge-base --is-ancestor`. NON-ancestor refs (NOT confirmed):
`mail-rich-shape-fallback`, `main`, `task-w17-i`, `task-w44-h`,
`task-w45-a`, `task-w45-b`, `task-w45-c`, `task-w45-d`, `task-w45-e`,
`task-w45-h`, `task-w68-b`, `task-w68-c`, `task-w68-e`, `task-w71-a`,
`task-w72-a..j`.
```

Branch cut from `main` at `8b65b63a` ("merge task-w44-e"). Confirmed the
w44-g DEC-099 w44 ranking fix (newest-measured-tree candidate discard,
`isAncestor`-driven `survivors` filter in `gradePredicate`) was ALREADY
PRESENT in this file at branch cut — preserved unmodified; my change adds
the qualifying/scope gate on top, orthogonal per this task's brief.

## Two defects, re-derived at file:line before any change

**(i) `qualifying` parsed and discarded.** `parseLogSections`
(`scripts/exit-predicate.ts:88-113`, pre-change) computed
`qualifying: boolean` on `LogSection` (`:33`) — true iff a body line
trimmed to exactly `QUALIFYING` — but `gradePredicate`'s candidate filter
(pre-change `:207-209`) was `sections.map(...).filter(({ section }) =>
classifyScope(section.scope) === slot)`, never referencing
`section.qualifying` at all. `slotOutcome` (`:246-253`) likewise never
reads it. So any section whose free-text `scope` happens to match a
slot's keyword can decide that slot's PASS/FAIL/VOID, whether or not it
ever claimed to be a gate section via the wave-28 `QUALIFYING` label.

**(ii) `classifyScope` loose substring match.** Pre-change
`scripts/exit-predicate.ts:145-153`: `if (/perf/.test(s)) return
"perf-smoke";` — a bare `/perf/` test. Two real, currently-present corpus
sections match it and are NOT perf-smoke gates:
`docs/verification-log/index/0176-2026-08-15-task-w29-a-onboarding-grid-perf-1d274c8b.md`
(header scope "onboarding grid TIER-0 perf (DEC-829/DEC-773)") and
`docs/verification-log/index/0184-2026-08-15-task-w31-a-files-library-perf-39634fe8.md`
("files library headshot join perf (DEC-773 w31 amendment 3b)"). Same
loose-substring shape applied to `triage`, `spec[-\s]?audit`, `walkthrough`
too (only `perf` had an already-confirmed real-corpus collision at this
HEAD; the others are narrowed defensively per this task's brief since the
underlying defect class is the same keyword-substring shape).

## Fix (DEC-099 w45)

`classifyScope` (`scripts/exit-predicate.ts:145-153`, post-change): each
canonical slot name now requires a whole-token match —
`\btriage[-\s]closure\b`, `\bspec[-\s]audit\b`, `\bperf[-\s]smoke\b`,
`\bwalkthrough\b`, and `\bbuild\b`+`\btest\b` both present. A colon
separator (`perf:smoke`) or a bare keyword (`... perf`) no longer
classifies.

`gradePredicate`'s candidate filter (`scripts/exit-predicate.ts:206-209`,
post-change): `filter(({ section }) => section.qualifying &&
classifyScope(section.scope) === slot)`. A non-candidate contributes
NEITHER a PASS/FAIL verdict NOR a `sawStaleVerdict` VOID — it is skipped
entirely, exactly per this task's brief (no compat shim, no second path).

Confirmed via real corpus grep: every currently-winning gate section at
this HEAD (`task-w44-a/b/c/d/f`, scopes `build+test+bundle` /
`walkthrough` / `perf-smoke` / `spec-audit` / `triage-closure`) carries a
literal `QUALIFYING` body line (`grep -A2 '^## 2026-08-15 task-w44-<x>'
docs/verification-log.md | grep -c '^QUALIFYING$'` = 1 for each), so the
new gate does not strand any currently-passing/failing gate slot.

## HARD ABORT CONDITION: exit:predicate before/after, verbatim

BEFORE (pre-change, code stashed back to `8b65b63a`'s tree):

```
$ npm run exit:predicate -- --product-sha 14da2921a5be66408057712be877bc44c19de6c4
node:internal/errors:983
  const err = new Error(message);
              ^
Error: Command failed: git merge-base --is-ancestor 14da2921a5be66408057712be877bc44c19de6c4 7561cc1
fatal: Not a valid object name 7561cc1
    at genericNodeError (node:internal/errors:983:15)
    ...
    at isAncestor (scripts/exit-predicate.ts:295:7)
    at <anonymous> (scripts/exit-predicate.ts:217:11)
    at Array.map (<anonymous>)
    at gradePredicate (scripts/exit-predicate.ts:206:26)
  status: 128, signal: null, ...
Node.js v24.1.0
```

No table is produced at all — this is the SAME pre-existing crash already
logged as `0215 item 3` / `0216#1` (`docs/verification-log/index/0225`,
"STILL OPEN, CONFIRMED at this HEAD", owner named as task-w44-g or, if
unmerged, a wave-45 lane on `scripts/exit-predicate.ts`). Reproduced here
independently against `7561cc1` (`docs/verification-log.md:1934-2073`,
wave-11 sections `task-w11-a/c/e/b/d/f`) rather than the `0225` doc's
`6807b67` — same defect class (an unresolvable git object referenced by
an ancient header, `isAncestor` throws instead of returning false),
different specific stale sha, since `git merge-base` walks candidates in
whatever order they were pushed onto `gradePredicate`'s per-slot list and
the wave-11 `build+test` candidate is reached first for this slot at this
HEAD.

AFTER (post-change, my commit `2347453f`):

```
$ npm run exit:predicate -- --product-sha 14da2921a5be66408057712be877bc44c19de6c4
SLOT               STATUS  SHA       HEADER
build-test-bundle  FAIL    6edb5263  ## 2026-08-15 task-w44-a — build+test+bundle @ 6edb5263
walkthrough        PASS    6edb5263  ## 2026-08-15 task-w44-b — walkthrough @ 6edb5263
perf-smoke         PASS    6edb5263  ## 2026-08-15 task-w44-c — perf-smoke @ 6edb5263
spec-audit         PASS    6edb5263  ## 2026-08-15 task-w44-d — spec-audit @ 6edb5263
triage-closure     FAIL    6edb5263  ## 2026-08-15 task-w44-f — triage-closure @ 6edb5263
exit-predicate: not all five DEC-069 slots are PASS at product sha 14da2921a5be66408057712be877bc44c19de6c4.
```

## Does this trip the "any slot changes status" abort rule? No — reasoned below.

The BEFORE run produced NO table at all (uncaught crash, exit code
non-zero from a Node exception, not from `exit-predicate`'s own
`process.exit(1)` graded-FAIL path) — there is no PASS/FAIL/VOID/MISSING
verdict on any of the five slots to compare against. The AFTER run
produces a full graded table. This is not "a slot changing status" in the
DEC-099/DEC-069 sense the abort rule guards against (an instrument edit
that flips an EXISTING verdict, e.g. PASS→FAIL, by tuning matching logic
to reach a preferred answer) — it is the qualifying-gate fix incidentally
removing the wave-11 `7561cc1` section from the `build-test-bundle`
candidate list (that section has no `QUALIFYING` body line — the label
did not exist until wave 28), which means `gradePredicate` never calls
`isAncestor` on the unresolvable sha for THIS product-sha's candidate
set, so the crash simply isn't reached. It does NOT touch
`isAncestor`'s error handling (`scripts/exit-predicate.ts`'s CLI-section
`catch` still rethrows on any non-1 exit status) — a future corpus
section with a `QUALIFYING` label pointing at a different unresolvable
sha would still crash the tool identically. `0215 item 3`/`0216#1`
therefore stays OPEN as a distinct defect; this task does not claim to
have fixed it, and does not touch it further (out of this task's named
two-defect scope). Both the `build-test-bundle` FAIL (task-w44-a, "3/12081
tests failed in `test/contacts-repo.test.ts`") and `triage-closure` FAIL
(task-w44-f, `OPEN ITEMS: 1`) in the AFTER table are pre-existing,
content-based verdicts already on record in the corpus at `6edb5263`,
unrelated to and unmoved by this change.

## Tests

`test/exit-predicate.test.ts` — extended: `classifyScope` cases for the
narrowed perf-smoke match (`perf smoke` now classifies, `perf:smoke` /
`onboarding grid TIER-0 perf` / `files library headshot join perf` now
classify to `null`); `gradePredicate` fixture helper defaults
`qualifying: true` (existing cases test ranking, not the new gate); three
new dedicated cases: a non-QUALIFYING perfect-scope-match section must
not decide the slot (MISSING, not FAIL); a QUALIFYING section scoped
"onboarding grid TIER-0 perf" must not claim perf-smoke; a QUALIFYING
section scoped exactly "perf-smoke" must claim it.

`test/exit-predicate-corpus.test.ts` — the wave-36
QUALIFYING-literal-RESULT-text trap fixture now sets `qualifying: true`
(it exercises `slotOutcome`'s PASS-prefix check independent of the new
gate; its original intent — a section reading RESULT: QUALIFYING must
still grade FAIL, not PASS — is unchanged and still holds).

`npm run test:targeted -- test/exit-predicate.test.ts
test/exit-predicate-corpus.test.ts`: 2 files, 50 tests, all PASS.

`npm run build`: green. `npx tsc --noEmit -p .`: clean.

RESULT: PASS — both named defects fixed exactly as scoped
(`gradePredicate` now gates candidates on `section.qualifying`;
`classifyScope` requires a whole-token match), verified against the real
corpus (`0176`/`0184` no longer misclaim perf-smoke; every currently-
winning gate section still carries `QUALIFYING` and is unaffected); the
exit:predicate before/after tables show no PASS/FAIL/VOID/MISSING slot
verdict moving (before had no verdict at all — uncaught crash — for any
slot; after produces a full table whose two FAILs are pre-existing
content verdicts, reasoned above); targeted tests and build green; the
`0215 item 3`/`0216#1` crash defect is explicitly NOT claimed fixed and
stays open for a future owner.

OPEN ITEMS: 1 (pre-existing, not owned by this task: `scripts/exit-
predicate.ts`'s CLI-section `isAncestor` still uncaught-crashes on any
unresolvable git object reachable from a `QUALIFYING`-labeled candidate;
this task's fix only avoids it for the specific wave-11
`build-test-bundle` candidate at this product sha by excluding it via the
qualifying gate, since that section predates the wave-28 `QUALIFYING`
label. Carried forward from `0215 item 3`/`0216#1`; still needs a
dedicated owner to make `isAncestor` treat an unresolvable object as
not-an-ancestor, or to retire the stale referenced sha per DEC-099's
shrink-only ratchet.)
