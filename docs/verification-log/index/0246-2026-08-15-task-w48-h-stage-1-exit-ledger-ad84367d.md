## 2026-08-15 task-w48-h — stage-1 exit ledger @ ad84367d

QUALIFYING

INVALIDATED BY: src/** app/src/** migrations/** package.json

This is the wave-48 single chain link: read the DEC-069 predicate
mechanically against the tree as it stands (it necessarily sees every
sibling gate lane's merged section, plus everything that landed on `main`
after wave 48 up to this measurement) and publish the wave-49 branch
condition. Scope literal `stage-1 exit ledger` classifies to `null` under
`classifyScope` (scripts/exit-predicate.ts:168-176) -- it names none of the
five required-scope keywords, so this section can never itself claim a
slot it did not measure.

## STEP 0 -- sync-then-poll

`git -C <worktree> merge --no-edit main` reported "Already up to date." on
the FIRST attempt (retry count: 0) -- this branch was cut from `main` after
task-w48-g had already merged, so `main` already carried the merge commit
`0e8787f5` at branch-cut time and no poll iterations were needed. All five
required sibling sections plus the advisory render-sweep section were
present in `docs/verification-log/index/` immediately:

- `0240-2026-08-15-task-w48-a-build-test-bundle-0ecff8aa.md`
- `0241-2026-08-15-task-w48-b-walkthrough-243b3094.md`
- `0242-2026-08-15-task-w48-c-perf-smoke-0ecff8aa.md`
- `0243-2026-08-15-task-w48-d-spec-audit-243b3094.md`
- `0245-2026-08-15-task-w48-g-triage-closure-243b3094.md`
- (advisory) `0244-2026-08-15-task-w48-f-render-sweep-243b3094.md`

`npx tsx scripts/ref-state.ts` receipt (VERBATIM):

> DEC-644 three-sha boundary: HEAD `0e8787f51b3a04422487527ba2cb546c6134398b`;
> newest first-parent product-code-bearing sha
> `ad84367d6af28d51c716c972ee54c92a67144d2c`; every live ref
> (`task-custodian-w52-4`, `task-custodian-w68-4`, `task-w48-h`,
> `task-w68-d`, `task-w71-c`, `task-w71-d`, `task-w71-e`) confirmed an
> ancestor of HEAD via `git merge-base --is-ancestor`. NON-ancestor refs
> (NOT confirmed via `git merge-base --is-ancestor`): `mail-rich-shape-fallback`,
> `main`, `manual-qa`, `task-w17-i`, `task-w52-a`, `task-w52-b`,
> `task-w52-c`, `task-w52-d`, `task-w52-e`, `task-w68-b`, `task-w68-c`,
> `task-w68-e`, `task-w71-a`, `task-w72-a`, `task-w72-b`, `task-w72-c`,
> `task-w72-d`, `task-w72-e`, `task-w72-f`, `task-w72-g`, `task-w72-h`,
> `task-w72-i`, `task-w72-j`.

MEASURED_SHA = `ad84367d6af28d51c716c972ee54c92a67144d2c` (the
newest first-parent product-code-bearing sha per the receipt above; note
`main` itself reads NON-ancestor of THIS worktree's HEAD only because this
worktree's own uncommitted `task-w48-h` branch-tip commit has not yet been
fast-forwarded back into `main` -- `main` was the ancestor this branch was
cut from, per STEP 0's "Already up to date").

## STEP 1 -- assemble, check, predicate (all VERBATIM below)

`npm run verification-log:assemble` -- ran clean, wrote
`docs/verification-log.md` from 242 entries. It printed its standing
advisory (report-only, not blocking, per the `task-w45-f`/DEC-068 wave-46
finding) naming 24 pre-existing non-conforming-header filenames
(`0140`..`0193`, all pre-wave-27 or diagnostic entries); none of them are
this wave's siblings and none of them changed.

`npm run verification-log:check` exited 0 ("docs/verification-log.md is up
to date."), with the same 24-file advisory printed. No duplicate 4-digit
prefix was reported, so `verification-log:renumber` was NOT invoked and
nothing moved.

`npm run exit:predicate -- --product-sha ad84367d6af28d51c716c972ee54c92a67144d2c`
printed (VERBATIM):

```
SLOT               STATUS  SHA  HEADER
build-test-bundle  VOID    -    -
walkthrough        VOID    -    -
perf-smoke         VOID    -    -
spec-audit         VOID    -    -
triage-closure     VOID    -    -
exit-predicate: not all five DEC-069 slots are PASS at product sha ad84367d6af28d51c716c972ee54c92a67144d2c.
```

Process exit code: 1.

Per-slot accounting (scripts/exit-predicate.ts:240-283, `gradePredicate`):
every candidate section for all five slots carries `QUALIFYING` and
classifies correctly by whole-token keyword match, so each of the five
slots DOES have candidate sections. The VOID verdict is `sawStaleVerdict`
(gradePredicate:250-265), not `MISSING`: for every candidate,
`isAncestor(productSha, section.sha)` (i.e. "is `ad84367d` an ancestor of
the section's own measurement sha?") is FALSE, because every wave-48
sibling section measured an EARLIER tree (`0ecff8aa` or `243b3094`) than
`ad84367d`, which landed strictly after all of wave 48's gate runs (`git
merge-base --is-ancestor ad84367d6af28d51c716c972ee54c92a67144d2c
0ecff8aa` and `...243b3094` both exit 1 -- confirmed by direct invocation
in this worktree). This is the mechanism working as designed
(exit-predicate.ts:192-197's documented "later product code has landed
since that section ran and it is stale"): `ad84367d` is genuinely the
newest first-parent product-bearing commit on this tree (per ref-state
above), landed via wave-49 through wave-51+ merges plus a subsequent
"mandate" commit (`git log` on this worktree shows `ad84367d` followed
immediately by `02575938 mandate: user-filed participant-remove P1
fixed...`, then eleven `merge task-w5{0,1}-*` commits and the `thunderdome`
regeneration commit at HEAD) -- no gate section anywhere in the corpus has
yet run AT OR AFTER that tree. Because `valid.length === 0` for every
slot before the survivor/ranking step ever executes, the DEC-099 w44
newest-measured-tree ranking rule and plain append order do NOT diverge
for any of the five slots at this product sha: there is nothing to rank
because there are zero ancestry-valid candidates to choose among. (Per
wave-48's own `0245` STEP-1-evidence line, the equivalent run at
the wave-48-boundary sha `243b3094` was ALSO five-row VOID for the same
reason -- no gate section had yet run at-or-after `243b3094` either, at
that earlier measurement point.)

## STEP 2 -- sibling census (wave-48 sections)

| Section | Present | RESULT (first token) | OPEN ITEMS |
|---|---|---|---|
| `0240` task-w48-a build-test-bundle @ `0ecff8aa` | PRESENT | FAIL (2/12144 tests failed, `test/decision-path-references.scan.test.ts:122`) | 2 |
| `0241` task-w48-b walkthrough @ `243b3094` | PRESENT | FAIL (producer area J1 fails) | 1 |
| `0242` task-w48-c perf-smoke @ `0ecff8aa` | PRESENT | PASS (117/117 check-rows under budget) | 0 |
| `0243` task-w48-d spec-audit @ `243b3094` | PRESENT | FAIL (SPEC §9 close-date-lock invariant) | 1 |
| `0244` task-w48-f render-sweep @ `243b3094` (advisory, not one of the five required slots) | PRESENT | PASS (exit 0, 7/7 render-sweep passes clean) | 0 |
| `0245` task-w48-g triage-closure @ `243b3094` | PRESENT | FAIL (3 STILL-OPEN rows: cron reminder dedupe race, file version mint race, unfalsifiable perf-seed speaker wiring) | 3 |

All six wave-48 sections (five required + one advisory) are PRESENT.
Total STILL-OPEN / OPEN ITEMS count summed across all six sibling sections:
2 + 1 + 0 + 1 + 0 + 3 = **7**.

## STEP 3 -- branch-condition verdict

`RESULT: PASS` requires ALL of: (a) five slots PASS at one product sha
from a working predicate run; (b) every wave-48 sibling section PRESENT;
(c) zero still-open rows in `0245`'s triage-closure section. (b) holds.
(a) and (c) both fail: the predicate run above is a working, non-crashing
run, but it reads five-row VOID (not PASS) at the one product sha
`ad84367d`, and `0245` itself reads `OPEN ITEMS: 3` (not 0).

RESULT: FAIL — the DEC-069 predicate mechanically reads five-row VOID at
product sha `ad84367d6af28d51c716c972ee54c92a67144d2c` (no gate section in
the corpus has run at-or-after that tree; every wave-48 sibling measured
an earlier sha), and wave-48's own triage-closure section (`0245`) carries
3 still-open rows. Per this section's own STEP 3 rule, wave 49 is NOT the
code wave that inherits an all-PASS ledger -- it is the code wave that (i)
lands or re-derives the two named wave-47 fixes still absent from this
tree at `0245` rows 1 and 7 (DEC-023 claim-before-send cron dedupe,
`task-w47-a`; DEC-818 unique-index file-version-mint contract,
`task-w47-g`), (ii) resolves `0245` row 14's unfalsifiable perf-seed
speaker-wiring claim with a committed test, and (iii) re-runs (or has a
sibling lane re-run) each of the four content-bearing gate slots
(build-test-bundle, walkthrough, spec-audit, and re-confirm perf-smoke) at
a product sha at-or-after `ad84367d`, since none of the corpus's existing
sections measures a tree new enough to decide any slot at this sha.
OPEN ITEMS: 7
