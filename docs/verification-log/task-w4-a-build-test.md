# task-w4-a — build+test gate detail

DEC-069 build+test gate, wave-4 (DEC-093: gates run in parallel at
code-bearing sha 3878d4f, DEC-076 barrier vacuous per DEC-093's ruling
that wave-3's gate tasks never landed).

## Sha derivation (DEC-091, independently re-derived)

Walked `git log` from this worktree's `main` tip `79c4bb3` ("merge
task-w3-e") backward, skipping commits that touch only
`docs/verification-log*`, `docs/eval-findings.md`, `field-guide/index.md`,
`decisions/*.md`, or string-constant appends to `src/decisions.ts`
(DEC-090):

- `79c4bb3` (merge task-w3-e) — only `docs/verification-log.md`.
- `281a31b` ("scribe wave 4") — `decisions/DEC-092.md`,
  `decisions/DEC-093.md`, `field-guide/index.md`, and
  `src/decisions.ts` (verified: pure two-line `export const DEC_092 = ...`
  / `DEC_093 = ...` string-constant appends, no other change).
- `c505dea` (spec-audit task-w3-e) — only `docs/verification-log.md`.
- `d6bc978` (merge task-w3-b) — only `docs/verification-log.md`.
- `fc32e81` (task-w3-b build+test gate) — only `docs/verification-log.md`.
- `1c75d92` (merge task-w3-a) — only `docs/verification-log.md`.
- `31fa021` (wave-2 closeout barrier task-w3-a) — only
  `docs/verification-log.md`.
- `f9a33fd` ("scribe wave 3") — `decisions/DEC-090.md`,
  `decisions/DEC-091.md`, `field-guide/index.md`, and `src/decisions.ts`
  (verified: pure two-line string-constant appends for DEC_090/DEC_091).
- `3878d4f` ("merge task-w2-d") — code-bearing (brings in DEC-089's
  walkthrough scale area: `scripts/walkthrough/scale.ts`,
  `scripts/walkthrough-lib.ts`, `test/walkthrough-lib.test.ts`, per
  `git show --stat` on the merge). This is the derived sha.

Matches the expected result (`3878d4f`) stated in the task brief, and
matches task-w3-b's independent wave-3 derivation of the same sha. All
worktree commits above `3878d4f` (including this task's own worktree
tip) are non-code-bearing bookkeeping/decision-record commits, so build
and test results measured at this worktree's `main` tip apply unchanged
to `3878d4f`.

## Pre-existing section found at this sha

`docs/verification-log.md` already contains a
`## 2026-08-10 task-w3-b — build+test @ 3878d4f` section (a late
wave-3 straggler per the task brief's note). Per instructions, this
task independently re-ran and verified that section's claims rather
than duplicating a full new section.

## Commands run (fresh worktree `task-w4-a`, `git worktree add ... main`)

- `npm ci --prefer-offline --no-audit --no-fund --silent`: clean
  install, no output/errors.
- `npm run build` (`tsc --noEmit` root + `tsc --noEmit -p
  app/tsconfig.json` + `vite build --config app/vite.config.ts`):
  clean, 0 type errors. Vite: 125 modules transformed, 17 output
  chunks; entry `index-DOwNDQO_.js` 179.18 kB / gzip 58.63 kB (largest
  chunk) — identical module count, chunk names, and sizes to
  task-w3-b's run.
- `npm run bundle:check` (DEC-058 budget = 300.00 kB gzip): entry
  bundle `index-DOwNDQO_.js` + `index-easpJsYc.css` = **58.60 kB gzip**
  — PASSED, well under budget. Identical figure to task-w3-b's run.
- `npm test --silent` (vitest run): **94 test files, 971 tests, all
  passed**, 0 failed, 0 skipped. Duration 6.51s. Identical file/test
  counts to task-w3-b's and task-w3-a's runs.

## Package/file/test counts

- Test files: 94 (all passed)
- Tests: 971 (all passed, 0 failed, 0 skipped)
- Vite output chunks: 17 (125 source modules transformed)

## Bundle size vs DEC-058 budget

- Entry bundle (JS + CSS) gzip: 58.60 kB
- Budget: 300.00 kB
- Margin: 241.40 kB under budget (~19.5% of budget used)

## Product code changes made

None. This is a log-only lane per DEC-077/090/093: no product code,
scripts, or tests were modified. Only `docs/verification-log.md` and
this detail file were added/appended.

RESULT: PASS
