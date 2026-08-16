## 2026-08-15 task-w49-e — instrument ledger closure @ 8adffaa4

NOT QUALIFYING (code wave — DEC-069: a gate inside a code wave can never qualify)

INVALIDATED BY: src/** app/src/** migrations/** package.json scripts/**

DOCS+TEST CLOSURE (DEC-099, DEC-068): closes two standing open items by
ruling plus exercised evidence, not by prose. No file under `src/`,
`app/src/`, `migrations/`, `scripts/`, or `package.json` was touched;
`scripts/exit-predicate.ts`'s behavior is unchanged per the task's explicit
constraint.

## (1) DEC-099 CONTRADICTION -- resolved by reversal, already landed

`decisions/DEC-099.md` already carries a `## Amendment (wave 49)` section
(landed by "scribe wave 49", commit `79886982`, before this branch's cut at
`8adffaa4`) ruling: `qualifying` is ADVISORY, and the wave-45 clause (i) --
"a slot is claimed by name and by label", which called the
never-read-by-`gradePredicate` omission a live DEFECT -- is EXPLICITLY
REVERSED and recorded as a reversal, not as original intent. No further
edit to `decisions/DEC-099.md` was needed; verified by reading the file at
this wave's own runtime (lines 57-59).

NAMED FALSIFYING CHECK: `test/exit-predicate-ancestry.test.ts:140-158`,
`describe("a section with no QUALIFYING line still grades normally (no
crash, no false claim)")`. Opened and confirmed it really exercises the
claim: it parses a fixture section with NO `QUALIFYING` body line (asserts
`sections[0].qualifying === false`), calls `gradePredicate` directly on it
with an always-true `isAncestor`, asserts `gradePredicate` does not throw,
returns all five rows, and the matching slot (`spec-audit`, which the
fixture's scope names exactly) reads `MISSING` rather than crashing or
silently inheriting a false verdict from elsewhere. This is the test named
by DEC-099's wave-46/wave-49 text ("covered by a test that asserts a
section WITHOUT the label still grades normally") -- it already exists, so
per the task's own instruction nothing new was written for this half.

FLAGGED, not corrected (task bars changing `scripts/exit-predicate.ts`):
this test also demonstrates that the CODE does not yet match the doc's
"advisory" characterization. `gradePredicate`'s candidate filter at
`scripts/exit-predicate.ts:248` is `section.qualifying && classifyScope(...)
=== slot` -- `qualifying` is a hard, mandatory precondition for candidacy,
not an advisory/ignored field. A section without the label is excluded
from deciding ANY slot outright (this test's `MISSING`, not a graded
PASS/FAIL from its `RESULT: PASS` line), which is the wave-45 shape DEC-099
wave-49 just reversed in the decision doc. The doc and the code disagree:
the doc says advisory, the code implements mandatory. This is a real,
unresolved gap between a binding ruling and shipped behavior --
recorded as an open item below, not silently reconciled by this lane.

## (2) DEC-068 BLAST RADIUS -- resolved by ruling, backed by a fresh measurement

`decisions/DEC-068.md` already carries a `## Amendment (wave 49)` section
(same "scribe wave 49" commit) ruling `0236`'s open item CLOSED BY THE
INSTRUMENT: `assembleEntry`/`deriveSyntheticHeader`
(`scripts/assemble-verification-log.ts:97-121`) synthesizes a
HEADER_RE-conforming header from the FILENAME for any non-conforming index
first line, and a sha-less legacy filename's synthetic non-hex sha resolves
NOT-AN-ANCESTOR through `gitAncestorResult`
(`scripts/exit-predicate.ts:337-359`); the 15 sha-less wave-12-to-21 files
are GRANDFATHERED as permanently slot-ineligible.

MEASUREMENT (not a code read), run fresh at this wave's own runtime:

```
$ npm run verification-log:assemble
...assemble-verification-log: first line does not match the DEC-068 header
contract (...) in: 0140-...task-w12-a-render-sweep-mobile-overflow-instrument-correction.md,
0142-...task-w13-c..., 0143-...task-w13-f..., 0144-...task-w13-g...,
0145-...task-w13-a..., 0146-...task-w13-d..., 0147-...task-w15-e...,
0148-...task-w17-e..., 0149-...task-w17-d..., 0150-...task-w17-f...,
0151-...task-w21-c..., 0152-...task-w20-f..., 0153-...task-w21-b...,
0154-...task-w21-e..., 0157-...task-w25-f..., 0164-...task-w27-b...,
0165-...task-w27-e..., 0166-...task-w27-d..., 0167-...task-w27-c...,
0168-...task-w27-g..., 0177-...task-w29-f..., 0178-...task-w29-c...,
0187-...task-w32-b..., 0193-...task-w36-c... -- a non-conforming first line
is invisible as its own section and silently donates its RESULT:/OPEN
ITEMS: lines to the preceding conforming section, overwriting that
section's verdict (task-w45-f finding; downgraded to report-only, see
docs/verification-log.md task-w45-f section).
Wrote .../docs/verification-log.md from 227 entries.
ASSEMBLE_EXIT=0

$ npm run verification-log:check
(identical warning list)
docs/verification-log.md is up to date.
CHECK_EXIT=0
```

Both commands exit 0 -- the 24-file blast radius is a loud WARNING, not a
build failure, confirming DEC-068's own wave-45/46 ruling that this is
report-only. Spot-checked that previously-non-conforming files now appear
as their OWN section rather than donating to a predecessor: grepping the
regenerated `docs/verification-log.md` shows a synthesized header
`## 2026-08-15 task-w36-c — perf smoke @ f5783479` immediately followed by
the file's real (non-conforming) first line
`## 2026-08-15 task-w36-c — perf-smoke @ f5783479 [QUALIFYING]` as the
section's own first body line, and a synthesized header
`## 2026-08-10 task-w12-a — render-sweep mobile overflow instrument
correction @ (no-sha token)` for the sha-less `0140`. Both are their own
sections, not folded into a neighbour. No index file's first line was
hand-edited.

## Regeneration and ratchet

`docs/verification-log.md` was regenerated in this same commit via
`npm run verification-log:assemble` per DEC-068's wave-48 amendment. The
regeneration surfaced one shrink-only-ratchet growth in
`test/verification-log-verdict-contract.test.ts`: `0238`
(`task-w47-h-eval-findings-defect-ledger`, landed on `main` between wave 48
and this branch's cut) ends `RESULT: NOT QUALIFYING — ...`, whose first
token is `NOT`, the identical wave-36-trap shape the ratchet already
tracks -- added to `LEGACY_VERDICT_VIOLATIONS`, a legitimate corpus growth,
not a loosened predicate. `npx vitest run
test/verification-log-verdict-contract.test.ts test/exit-predicate.test.ts
test/exit-predicate-corpus.test.ts test/exit-predicate-ancestry.test.ts`
and `npx vitest related scripts/assemble-verification-log.ts
scripts/exit-predicate.ts test/verification-log-verdict-contract.test.ts`
are all green (103/103). `npm run build` succeeds.

OVERLAP NOTICE: task-w49-h also adds an index file (`0251`) and regenerates
`docs/verification-log.md` from the same base; per DEC-068's wave-48
amendment the merge train resolves any conflict there by re-running the
assembler, never by hand-merging hunks.

RESULT: NOT QUALIFYING — instrument/decisions ledger closure, no product
code touched.

OPEN ITEMS: 1 (DEC-099 doc/code disagreement: the wave-49 ruling says
`qualifying` is advisory, but `scripts/exit-predicate.ts:248`'s
`gradePredicate` still makes `section.qualifying === true` a mandatory
candidacy precondition, matching the reversed wave-45 shape rather than the
doc's current text; this task's scope explicitly bars changing
`scripts/exit-predicate.ts`'s behavior, so the gap is filed here, unowned,
for a future wave to either fix the code to match the doc or amend the doc
to match the code -- whichever is judged correct is a design call this
lane does not make).
