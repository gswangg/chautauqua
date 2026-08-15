## 2026-08-15 task-w45-f — log-header contract repair @ 8b65b63a

QUALIFYING (advisory to the DEC-069 predicate — this scope classifies to none of the five slots)

INVALIDATED BY: src/** app/src/** migrations/** package.json

ref-state receipt: `npm run ref-state` -- DEC-644 three-sha boundary: HEAD
`8b65b63ace26b79e23a2d19dd5b8d91a3eca9ed2`; newest first-parent
product-code-bearing sha `14da2921a5be66408057712be877bc44c19de6c4`; every
live ref confirmed an ancestor of HEAD via `git merge-base --is-ancestor`.

Files found non-conforming to DEC-068's header contract (verified
independently, not copied blind) and what was done to each -- the 7 named
by the task, all repaired (FIRST LINE ONLY, date/branch/sha from filename,
scope verbatim from existing title text):
- `0176-...-1d274c8b.md`: colon-style `## task-w29-a: <scope>` -> dated
  em-dash header with `@ 1d274c8b`.
- `0180-...-b7060152.md`: trailing ` [QUALIFYING]` moved off the header
  line onto its own body line.
- `0181-...-9119a01a.md`, `0182-...-66123630.md`: colon-style -> dated
  em-dash header with sha.
- `0183-...-7581aa3b.md`: `## QUALIFYING (task-w31-c)` (no scope/sha in
  header at all) -> scope taken from body prose "Plan results
  (DEC-338/DEC-347 wave-31 amendments)", matching sibling naming
  convention; sha `7581aa3b` from filename.
- `0184-...-39634fe8.md`, `0185-...-e5774e56.md`: colon-style -> dated
  em-dash header with sha.

Full detail (repair rationale, blast-radius finding on 24 vs 7 offenders,
collateral update to test/verification-log-verdict-contract.test.ts's
shrink-only ratchets, both exit:predicate tables verbatim):
`docs/verification-log/task-w45-f-log-header-contract-repair-8b65b63a.md`.

BLAST-RADIUS FINDING (filed, not fixed): independent verification found 24
non-conforming index files, not the 7 named. 17 are mechanically repairable
the same way (sha derivable from filename: `0164`-`0168`, `0177`, `0178`,
`0187`, `0193`); 15 (`0140`-`0157`, pre-dating DEC-068's wave-37
introduction) carry no sha anywhere and need a DEC ruling (grandfather vs.
backfill) before repair. Wiring the header check as an unconditional throw
in `assemble()`/`--check` (as this task's ruling originally specified)
breaks `npm run verification-log:assemble` immediately against the current
corpus over this out-of-scope debt; downgraded to a non-throwing report
(`reportNonConformingHeaders`, same `nonConformingHeaders` export
underneath) pending that cleanup. **Owner TBD, wave-46+.**

exit:predicate BEFORE repair (`--product-sha
14da2921a5be66408057712be877bc44c19de6c4`):
```
Error: Command failed: git merge-base --is-ancestor 14da2921a5be66408057712be877bc44c19de6c4 7561cc1
fatal: Not a valid object name 7561cc1
    at isAncestor (scripts/exit-predicate.ts:295:7)
    at gradePredicate (scripts/exit-predicate.ts:206:26)
```

exit:predicate AFTER repair (identical sha, identical crash site):
```
Error: Command failed: git merge-base --is-ancestor 14da2921a5be66408057712be877bc44c19de6c4 7561cc1
fatal: Not a valid object name 7561cc1
    at isAncestor (scripts/exit-predicate.ts:295:7)
    at gradePredicate (scripts/exit-predicate.ts:206:26)
```
`7561cc1` (referenced by the unrelated, earlier `## 2026-08-10 task-w11-a`
section) is not a valid git object in this repository -- a pre-existing
defect outside this task's scope. Neither run reaches slot classification,
so trivially no slot changed status; no revert triggered.

RESULT: PASS — 7 named files' headers repaired and individually verified
against the DEC-068 regex; nonConformingHeaders pure function added and
tested (8 fixture-string cases); npm run build green; targeted tests green
(66/66 across 4 files, including the two collaterally-updated ratchets in
test/verification-log-verdict-contract.test.ts); npm run
verification-log:check exits 0; exit:predicate crashes identically
before/after on an unrelated pre-existing missing-object defect, so no
slot verdict changed (HARD ABORT CONDITION not triggered).
OPEN ITEMS: 1 (blast-radius finding above: 24 vs 7 non-conforming files,
17 mechanically fixable + 15 needing a DEC ruling on sha-less legacy
entries, filed for wave-46+, owner TBD)
