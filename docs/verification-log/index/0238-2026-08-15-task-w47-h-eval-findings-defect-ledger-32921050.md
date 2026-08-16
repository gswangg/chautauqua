## 2026-08-15 task-w47-h — eval-findings rebase and wave-45 defect-ledger filing @ 32921050

NOT QUALIFYING (code wave — DEC-069: a gate inside a code wave can never qualify)

INVALIDATED BY: src/** app/src/** migrations/** package.json

DOCS ONLY (DEC-358, DEC-068, DEC-069): no file under `src/`, `app/src/`,
`migrations/`, `scripts/`, or `package.json` was touched. This is a
scribe/mandate rebase, not a five-slot gate lane.

`git merge --no-edit main`: "Already up to date" (worktree cut from
`main`'s tip). `npx tsx scripts/ref-state.ts` receipt (verbatim): DEC-644
three-sha boundary: HEAD `32921050980ed81206d66c83fe30c53b6d3681ae`; newest
first-parent product-code-bearing sha `ae1ea6aee5e4e320936a0e7511fe1e4b43f34192`;
every live ref (`main`, `manual-qa`, `task-custodian-w68-4`, `task-w46-a`,
`task-w46-b`, `task-w46-c`, `task-w46-d`, `task-w46-e`, `task-w46-f`,
`task-w47-a`, `task-w47-g`, `task-w47-h`, `task-w68-d`, `task-w71-c`,
`task-w71-d`, `task-w71-e`) confirmed an ancestor of HEAD via `git
merge-base --is-ancestor`. NON-ancestor refs: `mail-rich-shape-fallback`,
`task-w17-i`, `task-w46-g`, `task-w47-b`, `task-w47-c`, `task-w47-d`,
`task-w47-e`, `task-w47-f`, `task-w68-b`, `task-w68-c`, `task-w68-e`,
`task-w71-a`, `task-w72-a` through `task-w72-j`. Individually re-run per
ref (never trusted from `ref-state` alone) — confirms the same split.

Rebased `docs/eval-findings.md`: replaced the stale header (previously
pinned at `6edb5263`, wave 44, predating wave 45) with one derived at this
task's own runtime. Filed the omission this rebase exists to fix: wave
45's six adjudication-only lanes (`docs/verification-log/index/0230`-`0237`,
MERGED) filed seven CONFIRMED-DEFECT rows that never made it into the
mandate. All seven now recorded, each under its wave-47 owning branch,
marked IN FLIGHT (not closed): `task-w47-a` (reminder send-then-stamp
race), `task-w47-b` (portal read doors scoped in JS), `task-w47-c`
(auto-schedule accounting invariant), `task-w47-d` (import
duplicate-destination mapping), `task-w47-e` (merge preview/execute
preflight parity), `task-w47-f` (contact-history `events` unbounded),
`task-w47-g` (file version-mint race). `0236`'s 24-vs-7 malformed-header
blast-radius finding is filed alongside them but carries no wave-47 owner
— left UNOWNED. Re-homed the two orphaned wave-41 falsifiability
batch-A/batch-B remainder lists from a stale "wave-47+ lane, branch to be
named" pointer to UNOWNED (wave 45's lanes closed without taking them; no
wave-47 lane covers them either). Re-globbed every "file X exists / does
not exist" claim carried forward before carrying it — full receipts in
the detail doc, all 12 existence claims and both absence claims
re-confirmed.

Full detail: `docs/verification-log/task-w47-h-eval-findings-defect-ledger-32921050.md`.

`npm run verification-log:check`: exit 0 (verified after this file was
added, per DEC-644 — see command output below). No other test was run;
this lane touches no product code and owns no five-slot gate.

```
$ npm run verification-log:check
exit 0
```

RESULT: NOT QUALIFYING — this is a docs-only scribe/mandate rebase inside
a code wave; per DEC-069 it can never qualify for a gate slot regardless
of content. `docs/eval-findings.md` rebased and the wave-45 seven-item
defect ledger filed with wave-47 ownership; two orphaned UNFALSIFIABLE
remainder lists re-homed to UNOWNED; all carried existence/absence claims
re-globbed and re-confirmed.

OPEN ITEMS: 0 (this lane files no new CONFIRMED-DEFECT of its own; it
records seven pre-existing CONFIRMED-DEFECT rows from wave 45, already
counted at their own `0232`-`0235` filings, and one UNOWNED blast-radius
finding from `0236`, already counted there)
