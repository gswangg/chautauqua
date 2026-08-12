# 2026-08-10 task-w12-a — build+test @ 3b7ed3d

Full detail for the `## 2026-08-10 task-w12-a — build+test @ 3b7ed3d` section
of `docs/verification-log.md` (extracted per the contention-decomposition of
that file; see the stub entry there for `RESULT` summary).

DEC-069/DEC-114 re-derivation walk from `main` tip `15a422a` ('scribe
wave 12'), first-parent, back to the last confirmed-void sha `d12eb25`:

- `15a422a` ('scribe wave 12'): diff vs `3b7ed3d^1`..`3b7ed3d` touches
  only `decisions/DEC-116.md`, `decisions/DEC-117.md`,
  `field-guide/index.md`, and `src/decisions.ts` — the latter is a
  pure string-constant append (`DEC_116`/`DEC_117` lines only, no
  other edits). Non-code-bearing per DEC-114.
- `3b7ed3d` ('merge task-w11-a'): first-parent diff (`e9ec7e0`..`3b7ed3d`)
  touches `scripts/walkthrough/speaker.ts` only — a real, non-empty
  change (186 insertions/13 deletions: re-lands the DEC-112
  invite-visibility and Hotel/Flight backing-form probes per DEC-113's
  original placement, on top of task-w10-e's already-landed DEC-116
  layout). `scripts/walkthrough/**` is not in DEC-114's bookkeeping
  exclusion set (docs/verification-log.md,
  docs/verification-log/**, docs/eval-findings.md, field-guide/**,
  decisions/**, pure src/decisions.ts string appends), so this commit
  is mechanically **code-bearing** per DEC-114's literal text.
- `2d686bd` (the task-w11-a topic commit merged by `3b7ed3d`): same
  file, same content — subsumed by the merge commit above.
- `e9ec7e0` ('scribe wave 11'): diff vs `3543f09` touches only
  `decisions/DEC-113.md`, `DEC-114.md`, `DEC-115.md`,
  `field-guide/index.md`, `src/decisions.ts` (pure string appends).
  Non-code-bearing.
- `3543f09` ('merge task-w10-e'): DEC-116's stated expected sha.

**Finding — DEC-116/DEC-117's "expected 3543f09" is stale at this
worktree's tip.** DEC-116 anticipated this exact scenario ("If a
stray task-w11-* branch ever merges later, DEC-103's duplicate-section
rule applies") but its own "expected newest code-bearing sha ...
3543f09" line and DEC-117's "no code barrier" framing were written
when task-w11-a had not yet merged. In this worktree (branched from
`main` at `15a422a`), task-w11-a's merge (`3b7ed3d`) is present and,
per DEC-114's mechanical file-path test, its first-parent diff
(`scripts/walkthrough/speaker.ts`) lies outside the bookkeeping
exclusion set — so it IS code-bearing, and `3b7ed3d` (not `3543f09`)
is the newest code-bearing sha at this tip. Flagging for the scribe:
either (a) DEC-114's bookkeeping-exclusion set should explicitly add
`scripts/walkthrough/**` and `scripts/perf-smoke.ts` (verification
tooling, not product code, not covered by `npm run build`/`npm test`
per `tsconfig.json`'s `include: ["src","test"]`), or (b) wave-12 gates
should cite `3b7ed3d` going forward. This task does not decide between
them (code-frozen, DEC-077) — it records the mechanical result and
proceeds with DEC-103 verify-or-run at both candidate shas, since no
`RESULT: PASS` build+test section exists at either `3543f09` or
`3b7ed3d` (latest build+test section is `task-w7-a — build+test @
d12eb25`, already ruled void by DEC-069 since code merged after it).

Ran the full gate against this worktree's tip (`15a422a`, which
contains both `3543f09` and `3b7ed3d` on its first-parent chain, so a
single run covers both candidate shas — neither introduces any
`src/` or `test/` or `app/` change beyond what's already checked in):

- `node_modules` present, no `npm ci` needed.
- `npm run build` (`tsc --noEmit` root, `tsc --noEmit -p
  app/tsconfig.json`, `vite build --config app/vite.config.ts`): clean,
  zero errors, Vite bundle emitted (18 chunks under
  `public/admin/assets/`).
- `npm test` (`vitest run`): **104 test files passed (104), 1030 tests
  passed (1030)**, 0 failed, 0 skipped. Duration 5.77s.

No failures of any kind.

RESULT: PASS
