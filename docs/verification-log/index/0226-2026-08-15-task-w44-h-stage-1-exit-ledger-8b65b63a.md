## 2026-08-15 task-w44-h — stage-1 exit ledger @ 8b65b63a

QUALIFYING

INVALIDATED BY: src/** app/src/** migrations/** package.json

### STEP 0 — bounded sync-poll (verbatim)

`git merge --no-edit main`: "Already up to date." (worktree cut directly
from `main` tip `8b65b63a`).

Live `task-w43-*` refs at worktree cut: none (`git for-each-ref` on
`refs/heads` returned zero refs matching `task-w43-`; the branches were
deleted after merging, consistent with wave-45's own note that w43's
defects landed in product code already present on this HEAD).

Live `task-w44-*` refs at worktree cut: `task-w44-e`
(`a1552f12094965644df8e9f164a1e74b51d4c7ea`), `task-w44-h` (self,
`8b65b63ace26b79e23a2d19dd5b8d91a3eca9ed2`), `task-w44-i`
(`da1e44af077270688e0ddcfe8bd036f3af5e122f`).

Per-ref ancestry (`git merge-base --is-ancestor <sha> HEAD`), verbatim:

- `a1552f12094965644df8e9f164a1e74b51d4c7ea` (task-w44-e) — ANCESTOR
- `da1e44af077270688e0ddcfe8bd036f3af5e122f` (task-w44-i) — ANCESTOR

All required refs (task-w43-* population empty; both live task-w44-*
refs) are ancestors of HEAD on the first check. Poll attempts used: 0
(no retry needed); poll budget of 10 was not exhausted.

`npx tsx scripts/ref-state.ts` receipt (verbatim):

> DEC-644 three-sha boundary: HEAD `8b65b63ace26b79e23a2d19dd5b8d91a3eca9ed2`;
> newest first-parent product-code-bearing sha
> `14da2921a5be66408057712be877bc44c19de6c4`; every live ref (`main`,
> `manual-qa`, `task-custodian-w68-4`, `task-w44-e`, `task-w44-h`,
> `task-w44-i`, `task-w45-a`, `task-w45-c`, `task-w68-d`, `task-w71-c`,
> `task-w71-d`, `task-w71-e`) confirmed an ancestor of HEAD via
> `git merge-base --is-ancestor`. NON-ancestor refs (NOT confirmed via
> `git merge-base --is-ancestor`): `mail-rich-shape-fallback`,
> `task-w17-i`, `task-w45-b`, `task-w45-d`, `task-w68-b`, `task-w68-c`,
> `task-w68-e`, `task-w71-a`, `task-w72-a`, `task-w72-b`, `task-w72-c`,
> `task-w72-d`, `task-w72-e`, `task-w72-f`, `task-w72-g`, `task-w72-h`,
> `task-w72-i`, `task-w72-j`.

Product sha used for STEP 1 (taken from the receipt above, USED AS
PRINTED): `14da2921a5be66408057712be877bc44c19de6c4`.
MEASURED_SHA (short HEAD after last sync): `8b65b63a`.

### STEP 1 — `npm run exit:predicate -- --product-sha 14da2921a5be66408057712be877bc44c19de6c4`

The run does **not** produce a five-row table. It crashes uncaught
(verbatim):

```
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
```

Process exit code: `1` (uncaught exception, not the script's own
`allPass` exit(1) path).

This is the SAME confirmed defect task-w44-f already filed at
`docs/verification-log/index/0225-2026-08-15-task-w44-f-triage-closure-6edb5263.md`
("0215 item 3 / instrument crash on unresolvable ancient sha"), which
crashed on a different unresolvable ancient header sha (`6807b67`, from
`docs/verification-log/index/0128`/`0133`) at that lane's runtime.
Here, at this lane's runtime, the crash instead resolves through
`docs/verification-log/index/0100`-`0105` (wave-11, header sha
`7561cc1`, one candidate for each of all five slots — build-test-bundle,
walkthrough, perf-smoke, spec-audit, and triage-closure — since
`task-w11-a` through `task-w11-f` between them classify to every slot).
`git cat-file -t 7561cc1` also fails with "Not a valid object name" in
both this worktree and the shared parent repo: the object is gone
(unreachable, garbage-collected — it is referenced only in prose/log
text, not by any ref), not merely absent from this worktree's fetch.
This confirms 0225's diagnosis generalizes: ANY sufficiently old,
now-unreachable header sha anywhere in the classified candidate set
crashes `gradePredicate`'s per-slot `.map`, regardless of which one is
hit first. `scripts/exit-predicate.ts:259`'s `isAncestor` only treats
git exit status `1` ("not an ancestor") as a valid `false`; status `128`
("not a valid object name") is rethrown uncaught.

Per this task's HARD SCOPE, `scripts/exit-predicate.ts` is not touched
here (owned by task-w44-g). task-w44-g's fix, now merged at this HEAD
(commit `aa485c78`, "exit-predicate: rank slot candidates by newest
measured tree (DEC-099 w44)"), addresses the DEC-099 candidate-ranking
question only — it does not add a catch for git exit status 128 around
unresolvable ancient shas. The crash defect 0225 filed remains **STILL
OPEN** at this HEAD, per 0225's own escalation language ("If not merged
by wave-44 close: wave-45 lane, `scripts/exit-predicate.ts:259`"): since
task-w44-g's landed fix does not cover this specific crash, ownership
rolls to a wave-45 lane as 0225 itself specified.

### Manual slot re-derivation (since the script produces no table)

Working from `docs/verification-log.md` document order and applying
`classifyScope`/`slotOutcome` by hand, restricted to sections whose sha
is confirmed (`git cat-file -t`) to be a live object and ancestry-valid
(`git merge-base --is-ancestor <productSha> <sectionSha>` holds) at
product sha `14da2921...`:

1. **build-test-bundle** — latest ancestry-valid, verdict-bearing
   candidate is `docs/verification-log/index/0220-2026-08-15-task-w44-a-build-test-bundle-6edb5263.md`
   @ `6edb5263`. File exists; confirmed
   (`git merge-base --is-ancestor 14da2921... 6edb5263` exits 0).
   `RESULT: FAIL — 3/12081 tests failed in test/contacts-repo.test.ts`.
   **Slot: FAIL.**
2. **walkthrough** — `docs/verification-log/index/0221-2026-08-15-task-w44-b-walkthrough-6edb5263.md`
   @ `6edb5263`. File exists, ancestry-valid. `RESULT: PASS`. **Slot: PASS.**
3. **perf-smoke** — `docs/verification-log/index/0222-2026-08-15-task-w44-c-perf-smoke-6edb5263.md`
   @ `6edb5263`. File exists, ancestry-valid. `RESULT: PASS`. **Slot: PASS.**
4. **spec-audit** — `docs/verification-log/index/0223-2026-08-15-task-w44-d-spec-audit-6edb5263.md`
   @ `6edb5263`. File exists, ancestry-valid. `RESULT: PASS`. **Slot: PASS.**
5. **triage-closure** — latest ancestry-valid, `OPEN ITEMS`-bearing
   candidate is `docs/verification-log/index/0225-2026-08-15-task-w44-f-triage-closure-6edb5263.md`
   @ `6edb5263`. File exists, ancestry-valid. `OPEN ITEMS: 1` (the crash
   defect itself). **Slot: FAIL.**

No other wave-44 or later section for these slots exists between seq
0217-0225 (this lane's own seq is 0226). This manual derivation is
DIAGNOSTIC ONLY — it does not substitute for a working `exit:predicate`
run, is not authoritative the way an uncrashed five-row table would be,
and is offered strictly to show that even a fixed instrument would read
**two** slots FAIL (build-test-bundle, triage-closure) at this product
sha, independent of the crash.

task-w44-g merged before this lane's runtime; its ranking rule
(DEC-099 w44, newest-measured-tree) is the rule in force. Applied by
hand above (step 5), it and the plain append-order rule select the same
section (`0225`) for triage-closure, because `0225` is both the
highest-sequence AND newest-measured-tree (`6edb5263`) candidate — no
divergence to report here.

### STEP 2 — wave-44 sibling census

| Seq | Section | Status at HEAD | RESULT | OPEN ITEMS |
|---|---|---|---|---|
| 0220 | task-w44-a build+test+bundle | PRESENT | `FAIL — 3/12081 tests failed in test/contacts-repo.test.ts (mergeContacts suite), root-caused to a test-mock/production call-order desync from the DEC-026 w43 preflight hoist` | 1 |
| 0221 | task-w44-b walkthrough | PRESENT | `PASS — all six walkthrough areas pass at product sha 6edb5263` | 0 |
| 0222 | task-w44-c perf-smoke | PRESENT | `PASS — every one of 117 check-rows under budget across all three` [profiles] | 0 |
| 0223 | task-w44-d spec-audit | PRESENT | `PASS` | 0 |
| 0224 | task-w44-e render-sweep (advisory) | PRESENT | `PASS — exit code 0, all seven render-sweep passes clean (desktop...)` | 0 |
| 0225 | task-w44-f triage-closure | PRESENT | `FAIL — 1 CONFIRMED-DEFECT item remains open: scripts/exit-predicate.ts:259's isAncestorOfProductSha uncaught-crashes on an unresolvable ancient header sha` | 1 |

All six wave-44 sections (0220-0225) are PRESENT at this HEAD; none is
absent.

CONFIRMED-DEFECT rows filed by these sections:

1. `docs/verification-log/index/0220` (task-w44-a) — `mergeContacts`
   test-mock/production call-order desync in `test/contacts-repo.test.ts`
   (root-caused to the DEC-026 w43 preflight hoist). Owner named in
   0220's own text: **wave-45 lane**.
2. `docs/verification-log/index/0225` (task-w44-f) — the exit-predicate
   crash on an unresolvable ancient header sha
   (`scripts/exit-predicate.ts:259`). Owner per 0225's escalation clause,
   since task-w44-g's merged fix (`aa485c78`) does not cover it: **wave-45
   lane**.

Total CONFIRMED-DEFECT rows across present wave-44 siblings: **2**.

## RESULT

`RESULT: PASS` requires ALL of: (a) five slots PASS at one product sha
via a working `exit:predicate` run, (b) every wave-44 sibling section
PRESENT, (c) zero CONFIRMED-DEFECT rows across them. (b) holds (all six
present, none absent). (a) and (c) both fail:

- (a) fails outright: `npm run exit:predicate` crashes uncaught at this
  product sha and produces no five-row table at all (see STEP 1). Even
  the manual, diagnostic-only re-derivation above shows two slots would
  read FAIL (build-test-bundle, triage-closure) if the instrument were
  fixed — so a working run would not read all-PASS either.
- (c) fails: 2 CONFIRMED-DEFECT rows remain open across wave-44 siblings
  (0220's contacts-repo test-mock desync; 0225's exit-predicate crash).

RESULT: FAIL — stage-1 exit predicate is NOT satisfied at product sha
`14da2921a5be66408057712be877bc44c19de6c4`: `npm run exit:predicate`
crashes uncaught rather than producing a graded five-row table (an
unresolvable ancient header sha, `7561cc1`, git-exit-status 128, is not
handled by `isAncestor`'s status-1-only catch), and manual
diagnostic re-derivation independently confirms two slots would read
FAIL even under a fixed instrument (build-test-bundle: `test/contacts-repo.test.ts`
mock desync; triage-closure: the crash defect itself, self-referentially
open). Blocking items, verbatim owners as filed by their originating
sections:
1. `scripts/exit-predicate.ts:259`'s `isAncestor` uncaught-crashes on any
   unresolvable ancient header sha (git status 128 unhandled) —
   CONFIRMED-DEFECT, filed by `docs/verification-log/index/0225`, still
   open after task-w44-g's merged ranking fix (`aa485c78`) — owner:
   wave-45 lane, `scripts/exit-predicate.ts:259` (treat an unresolvable
   git object as not-ancestor, or retire/renumber the stale ancient
   sections per DEC-099's shrink-only ratchet).
2. `mergeContacts` test-mock/production call-order desync in
   `test/contacts-repo.test.ts` (3/12081 tests failing) — CONFIRMED-DEFECT,
   filed by `docs/verification-log/index/0220` — owner: wave-45 lane
   (named in 0220's own text).

OPEN ITEMS: 2

Full detail: `docs/verification-log/task-w44-h-stage-1-exit-ledger-8b65b63a.md`.
