# task-w13-a — build+test @ 3b7ed3d

Full detail for the `## 2026-08-10 task-w13-a — build+test @ 3b7ed3d`
section of `docs/verification-log.md`.

NOTE: an earlier round-0 namesake section, `## 2026-08-10 task-w13-a —
build+test @ 0ee30dd` (and this file's prior content, same header), does
NOT count per DEC-118/DEC-119 — `0ee30dd` is not this wave's derived sha
and that section predates the wave-13 campaign. This file's content is
replaced in full below; the round-0 section in `docs/verification-log.md`
is left untouched (append-only per DEC-015/DEC-068) but is superseded.

## Sha derivation (DEC-091/DEC-114)

Fresh worktree of `main` (tip `a6eb789`, "scribe wave 13"). Walked
first-parent from tip, checking each commit's name-only diff against the
bookkeeping-exclusion set (`docs/verification-log.md`,
`docs/verification-log/**`, `docs/eval-findings.md`, `field-guide/**`,
`decisions/**`, pure `src/decisions.ts` string-constant appends):

- `a6eb789` ("scribe wave 13"): touches only `decisions/DEC-118.md`,
  `decisions/DEC-119.md`, `field-guide/index.md`, `src/decisions.ts`
  (pure `DEC_118`/`DEC_119` constant appends). Non-code-bearing.
- `9a441aa`, `3cfa744`, `f723430`, `2aad317` (wave-12 merges) and their
  topic commits (`73b939b`, `d7cf2f4`, `051c4b7`, `ce18923`), plus the
  wave-11 tail (`3d5d34f`, `e309b59`, `2b4a5b9`, `546cbcc`, `df5b8c2`,
  `0ec7035`, `6cd04a3`, `15a422a`): every one of these touches only
  `docs/verification-log.md` (or, for `15a422a`, the same bookkeeping
  set as `a6eb789` above). Non-code-bearing.
- `3b7ed3d` ("merge task-w11-a"): first-parent diff vs `e9ec7e0` touches
  `scripts/walkthrough/speaker.ts` only — a real content change (not one
  of the exempt bookkeeping paths). **Code-bearing.**

Confirms the task's expected result: newest code-bearing sha is
**`3b7ed3d`**; `15a422a` ("scribe wave 12") and `546cbcc` ("merge
task-w11-e") sit above it in bookkeeping-only territory, matching the
task brief exactly.

## Existing PASS section found (DEC-103 verify-or-run)

`docs/verification-log.md` already contains two independent build+test
sections citing `@ 3b7ed3d` ending `RESULT: PASS`:

- `## 2026-08-10 task-w11-b — build+test @ 3b7ed3d` (line ~1438): `npm
  run build` clean (tsc x2 + vite, 18 admin SPA chunks), `npm test`
  104 test files / 1030 tests, 0 failures. Names specific green suites
  (`test/public-invite-visibility.test.ts`,
  `test/portal-edit-file-field.test.ts`,
  `test/form-render-rules.test.ts`,
  `test/acceptance-form-tasks.test.ts`, the four chunk-sweep guard
  suites).
- `## 2026-08-10 task-w12-a — build+test @ 3b7ed3d` (line ~1538):
  independent re-derivation (via a different worktree tip, `15a422a`)
  arriving at the same `3b7ed3d` conclusion; reruns the gate and
  reports `npm run build` clean (18 chunks under
  `public/admin/assets/`) and `npm test` — **104 test files passed,
  1030 tests passed**, 0 failed, 0 skipped, duration 5.77s.

Both sections agree exactly on file/test counts (104 files / 1030
tests) and on PASS. Per DEC-103 (verify-or-run), re-running the full
gate a third time for the same sha is unnecessary; this task spot-checks
the claims instead of re-running.

## Spot-check performed

In this task's own fresh worktree (branched from `main` at `a6eb789`,
which contains `3b7ed3d` on its first-parent chain unchanged since):

- `find . -path ./node_modules -prune -o -name "*.test.ts" -print | wc
  -l` → **104** — matches both cited sections' "104 test files" exactly.
- `find src -name "*.ts" | wc -l` → 87 source files present, consistent
  with a normally-populated `src/` tree (no missing/truncated checkout).
- `package.json` scripts intact (`build`, `bundle:check`, `test` all
  defined as expected by the gate sequence).

No discrepancy found between the cited sections' claims and this
worktree's tree state. Baseline drift check: `task-w7-a @ d12eb25` was
96 files / 984 tests; the confirmed `3b7ed3d` count (104 files / 1030
tests) is higher, consistent with wave 9-11 adding code and tests as
expected — no unexplained shrinkage.

RESULT: PASS (confirmed, not re-run — DEC-103 verify-or-run; see
task-w11-b and task-w12-a sections in `docs/verification-log.md` for
the underlying full gate runs)
