# 2026-08-10 task-w15-g — build+test @ 675219f

Full detail for the `## 2026-08-10 task-w15-g — build+test @ 675219f` section
of `docs/verification-log.md` (extracted per the contention-decomposition of
that file; see the stub entry there for `RESULT` summary).

**(1) Sha re-derivation (DEC-114):** walked `git log --first-parent`
from `main` tip `21ea856` ('scribe wave 15'). `git diff --name-only
21ea856^ 21ea856` touches only `decisions/DEC-127.md`,
`field-guide/index.md`, and `src/decisions.ts` (the latter a pure
string-constant append — `export const DEC_127 = "..."`, verified via
`git diff` on that path alone). All three fall inside the
non-code-bearing set, so `21ea856` is non-code-bearing. Newest
code-bearing `main` commit per DEC-114 is `675219f` ('merge
task-w14-k'), matching the expected sha. Build/test were run at the
worktree's `HEAD` (`21ea856`), which is code-identical to `675219f`
(only the three non-code-bearing paths above differ) — no working-tree
mutation beyond this file was made or retained.

**(2) DEC-127 six-marker preflight:** all six wave-14 fix markers
present in-tree:
- `DEC-120` in `src/routes/tasks.ts` (lines 36, 235) — task-assign
  org-scope guard.
- `LOCKED_SPEAKER_FIELDS` in `src/server/repo/portal-edit.ts` (lines
  16, 123-125, 184-185) — locked speaker fields.
- `requireFullMatch` in `src/routes/comms.ts` (lines 30, 303, 337) —
  compose full-set id-drop guard.
- `DEC-123` in `src/routes/review.ts` (lines 137, 224) — plan
  criteria/scale immutability guard.
- `MAX_TEXT_LENGTH` in `src/forms/validate.ts` (lines 8, 59) — answer
  length caps.
- `kind: "rating"` in `scripts/perf-seed.ts` (line 273) — perf-seed
  rating criteria fix.

Preflight: PASS (0 missing).

**(3) Build:** `npm run build` (`tsc --noEmit` root + `app/tsconfig.json`,
then `vite build --config app/vite.config.ts`) completed clean, no
type errors, Vite bundle emitted (18 chunks, largest
`index-DOwNDQO_.js` 179.18 kB). Build outcome: PASS.

**(4) Test:** `npm test` (vitest run) — **110 test files passed, 1064
tests passed**, 0 failed, 0 skipped. Includes all six new wave-14 fix
test files: `tasks-assign-org-scope.test.ts` (3 tests, DEC-120),
`portal-edit-speaker-locked.test.ts` (5 tests) and
`portal-edit-speaker-locked-route.test.ts` (3 tests, locked speaker
fields), `compose-full-set` — covered under `test/compose.test.ts` (12
tests, `requireFullMatch`), `plan-criteria-guard.test.ts` (7 tests,
DEC-123), `answer-length-caps.test.ts` (10 tests, MAX_TEXT_LENGTH).
Test outcome: PASS. Duration 6.84s.

Working tree confirmed clean (`git status --short`) before and after
this run other than this log append; no code file was modified.

RESULT: PASS
