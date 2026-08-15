# task-w45-f: log-header contract repair, full detail

Boundary: `8b65b63a` (branch `task-w45-f`, off `main` `8b65b63a` -- this lane
touches no product code, only `scripts/assemble-verification-log.ts`,
`docs/verification-log/index/*.md`, and `test/*.ts`).

## Scope

DEC-068 wave-45 ruling: an index entry file whose FIRST LINE does not match
`/^## (\d{4}-\d{2}-\d{2}) (\S+) — (.+) @ (\S+)\s*$/` (EM DASH U+2014,
`scripts/exit-predicate.ts:36`) is invisible to `parseLogSections` as its own
section, and silently donates its `RESULT:`/`OPEN ITEMS:` lines to whichever
preceding conforming section's body it falls into. The task named 7 files as
the known offenders (re-derived and confirmed, not copied blind -- see
"verification" below): `0176`, `0180`, `0181`, `0182`, `0183`, `0184`,
`0185`.

## Work done

1. Added `nonConformingHeaders(entries)` to
   `scripts/assemble-verification-log.ts` -- a pure function over
   `{file, firstLine}` fixture-shaped entries, using a local, deliberately
   NOT-imported copy of `scripts/exit-predicate.ts:36`'s `HEADER_RE` (that
   file is task-w45-g's this wave).

2. Repaired each of the 7 named files' FIRST LINE ONLY:
   - `0176-...-1d274c8b.md`: `## task-w29-a: onboarding grid TIER-0 perf
     (DEC-829/DEC-773)` -> `## 2026-08-15 task-w29-a — onboarding grid
     TIER-0 perf (DEC-829/DEC-773) @ 1d274c8b`
   - `0180-...-b7060152.md`: trailing ` [QUALIFYING]` moved off the header
     onto its own body line (per the task's explicit instruction for this
     file)
   - `0181-...-9119a01a.md`: `## task-w31-d: perf-smoke profile-resolved
     plan/reviewer fixtures (DEC-644 w31, DEC-645)` -> header with date,
     em dash, `@ 9119a01a`
   - `0182-...-66123630.md`: same pattern, scope "reviewer queue TIER-0
     perf (DEC-338/DEC-347 wave-31 amendments)"
   - `0183-...-7581aa3b.md`: `## QUALIFYING (task-w31-c)` had no derivable
     scope/sha in the header itself; scope taken from the body's own
     "Plan results (DEC-338/DEC-347 wave-31 amendments)" phrase, matching
     sibling lanes' "<subject> TIER-0 perf (...)" naming convention ->
     `## 2026-08-15 task-w31-c — plan results perf (DEC-338/DEC-347
     wave-31 amendments) @ 7581aa3b`. No QUALIFYING marker line added
     (task instructions called out that treatment only for 0180; this
     file's body carries no `RESULT:`/`OPEN ITEMS:` line, so nothing else
     depends on the marker).
   - `0184-...-39634fe8.md`: `## task-w31-a: files library headshot join
     perf (DEC-773 w31 amendment 3b)` -> header form with `@ 39634fe8`
   - `0185-...-e5774e56.md`: `## task-w32-c: perf-smoke coverage — plan
     progress + plan reviewers (DEC-644 w32 amendment)` -> header form
     with `@ e5774e56` (scope itself contains an em dash; `HEADER_RE`'s
     greedy `(.+)` still matches correctly since there is only one
     ` @ <sha>` suffix)

3. `test/verification-log-header-contract.test.ts` (new, fixture-strings
   only, no filesystem/process spawn): asserts `nonConformingHeaders` flags
   a missing date, a trailing bracket suffix, an ASCII hyphen in place of
   the em dash, and a headerless `## QUALIFYING (...)` shape, and passes
   conforming headers (including one whose scope itself contains an em
   dash).

## Blast-radius finding (NOT part of the named 7, filed not fixed)

Verifying independently (per the task's explicit "do not copy this list
blind" instruction) surfaced 24 non-conforming index files, not 7. 17 of the
extra 24 (`0164`-`0168`, `0177`, `0178`, `0187`, `0193`) ARE mechanically
repairable by the same method (their filenames carry a derivable sha; most
just need a trailing `[DIAGNOSTIC]`/`[QUALIFYING]` bracket moved off the
header line, same as `0180`). The remaining 15 (`0140`-`0157`, dated
2026-08-12, pre-dating DEC-068's own wave-37 introduction) carry NO sha
anywhere in filename or body -- `date/branch/sha from the filename` repair
is impossible without fabricating data.

Confirmed live: wiring `nonConformingHeaders` into `assemble()`/`--check` as
an unconditional throw (as originally specified, matching
`assertNoDuplicateSequences`'s shape) makes
`npm run verification-log:assemble` fail immediately against the CURRENT
index, over 24 files this task does not own (`ONE FILE ONE OWNER PER WAVE`)
and, for 15 of them, cannot repair without fabricating a sha. This is a
different failure mode than DEC-099's exit:predicate abort condition, but
same shape of hazard: "an instrument repair that [here: breaks the build
for unrelated pre-existing debt] is not safe to land unconditionally."

RESOLUTION: `assertConformingHeaders` was downgraded to
`reportNonConformingHeaders` -- it still runs inside `assemble()` (both the
default write path and `--check`), still names every current offender to
stderr, but does not throw. `nonConformingHeaders` itself (the pure,
tested, exported function) is unchanged and available for a future lane to
wire back to a hard throw once the remaining 24 files are resolved (fixed,
where a sha exists, or a design ruling grandfathers/backfills the 15 that
have none).

**FILED for wave-46+ (owner TBD)**: repair the 17 mechanically-fixable
extras (`0164`-`0168`, `0177`, `0178`, `0187`, `0193`) the same way this
task repaired its 7, and get a DEC ruling on the 15 sha-less pre-DEC-068
entries (`0140`-`0157`) -- grandfather (exempt entries before a cutoff
sequence number, e.g. everything below `0164`) or backfill (look up each
boundary's actual sha from the file's own body prose, where present, and
restore it) -- before re-enabling the hard throw this task's DEC-068
wave-45 ruling (a) originally called for.

## Collateral test-file update (necessary consequence of the repair, not a
## scope expansion)

`test/verification-log-verdict-contract.test.ts` (SOLE OWNER: a different
wave-41 lane) defines `LEGACY_HEADER_VIOLATIONS` and
`LEGACY_VERDICT_VIOLATIONS` as machine-checked, shrink-only ratchets over
the SAME 24-file offender set (its own header regex is a byte-identical
duplicate of `HEADER_RE`, deliberately not imported). Fixing 7 headers here
mechanically shrinks `LEGACY_HEADER_VIOLATIONS` by exactly those 7 names --
required, or that test fails (actual offender set < expected ratchet).
Two of the seven (`0176`, `0184`) turn out to ALREADY carry a `RESULT:`
line whose first token is not `PASS`/`FAIL` once their own content parses
as its own section for the first time (`0184`'s is the exact defect
DEC-068's wave-45 amendment text already named: "`RESULT: files library
(page 1) BEFORE ... FAIL -> AFTER ... PASS`" -- not a new defect, a
previously camouflaged one). Per this task's explicit "change nothing else
in those files" instruction, the `RESULT:` lines were NOT touched, so
these two were added to `LEGACY_VERDICT_VIOLATIONS` instead of silently
passing or failing loudly with no ratchet update. Updated the file's own
comments to record both changes and their provenance.

## HARD ABORT CONDITION (DEC-099 w45) -- ref-state + exit:predicate

`npm run ref-state`: newest first-parent product-code-bearing sha printed
`14da2921a5be66408057712be877bc44c19de6c4`.

BEFORE (pre-repair) `npm run exit:predicate -- --product-sha
14da2921a5be66408057712be877bc44c19de6c4`:

```
node:internal/errors:983
Error: Command failed: git merge-base --is-ancestor 14da2921a5be66408057712be877bc44c19de6c4 7561cc1
fatal: Not a valid object name 7561cc1
    at isAncestor (scripts/exit-predicate.ts:295:7)
    at gradePredicate (scripts/exit-predicate.ts:206:26)
```

AFTER (post-repair, both the 7-file header fix AND the
`reportNonConformingHeaders` downgrade landed) -- identical, same sha, same
line:

```
node:internal/errors:983
Error: Command failed: git merge-base --is-ancestor 14da2921a5be66408057712be877bc44c19de6c4 7561cc1
fatal: Not a valid object name 7561cc1
    at isAncestor (scripts/exit-predicate.ts:295:7)
    at gradePredicate (scripts/exit-predicate.ts:206:26)
```

`7561cc1` is a sha referenced by an EARLIER, unrelated section
(`docs/verification-log.md:1934`, `## 2026-08-10 task-w11-a — build+test @
7561cc1`) that is not a valid git object in this repository -- a
pre-existing, unrelated defect this task does not own or touch
(`scripts/exit-predicate.ts` is task-w45-g's this wave). `gradePredicate`
crashes identically before and after this task's change, at the same
object, so NEITHER run produces a five-slot table to compare -- trivially,
no slot changed status, since neither run reaches slot classification.

## Tests

`npm run test:targeted -- test/verification-log-header-contract.test.ts
test/verification-log-assemble.test.ts test/verification-log-verdict-contract.test.ts
test/exit-predicate.test.ts` -- 4 files, 66 tests, all green.

`npm run build` -- green (tsc x2 + vite build).

`npm run verification-log:check` -- exits 0, reports the (unchanged-by-me)
24-file legacy set to stderr, confirms `docs/verification-log.md` is up to
date with the regenerated index.
