# 2026-08-10 task-w20-b — perf-smoke confirm @ 8c7f479

Full detail for the `## 2026-08-10 task-w20-b — perf-smoke confirm @ 8c7f479` section
of `docs/verification-log.md` (extracted per the contention-decomposition of
that file; see the stub entry there for `OPEN ITEMS` / `RESULT` summary).

Wave-20 confirm-else-run (DEC-136), perf-smoke scope, DEC-129-guarded.

STEP 1 (DEC-114 sha derivation): first-parent walk from `main` tip
`d9be564` ("scribe wave 20") back through `7fd9da7`/`5f89797`/
`992987b`/`24f6f84`/`8e84281`/`9038b5c`: each of `d9be564`, `9038b5c`,
and the four `w19-*` merge commits touches only `docs/verification-log.md`
(and, for `d9be564`/`9038b5c`, `decisions/`, `field-guide/index.md`, and
a pure single-line `export const DEC_1xx = "...";` string-constant
append to `src/decisions.ts`) — bookkeeping, excluded per DEC-114. The
next first-parent commit, `8c7f479` ("merge task-w18-c"), touches
`src/routes/public/submit.tsx` and `test/submit-hidden-file-field.test.ts`
— code-bearing. Adopted sha: `8c7f479` (matches the task's expected sha).
`git merge-base --is-ancestor 675219f 8c7f479` exits 0 — ancestor guard
PASS (DEC-129).

STEP 2 (DEC-135 behavioral preflight, read directly from source, not
marker import): confirmed all four independently at the adopted sha's
worktree:
- DEC-130 `src/domain/schedule.ts`: `autoSchedule` builds incremental
  `roomIndex`/`speakerIndex` occupancy maps; zero `findConflicts` calls
  inside the function body (only a DEC-130 comment mentions the name;
  the helper remains separately exported/used elsewhere). PRESENT.
- DEC-131 `src/mail/ics.ts` `escapeText` (lines 39-47): `\r\n`->`\n`
  then bare `\r`->`\n` as the first two `.replace()` calls, before the
  backslash/semicolon/comma/newline escaping. PRESENT.
- DEC-132 `src/routes/public/submit.tsx`: file loop gated on
  `if (!isVisible(field, answers)) continue;` (line 415) before writing
  the `"pending"` placeholder; the later upload-consuming pass (line 479)
  gated on `if (cleaned[field.id] !== "pending") continue;`. PRESENT.
- DEC-133 `src/server/repo/submissions/status.ts`: `updateSubmissionStatuses`
  computes `missing` and `throw new ApiError("invalid", ...)` (line 209)
  strictly before the per-row mutation loop starting at line 213.
  PRESENT.

All four markers present and pre-mutation/pre-loop — preflight PASS.

STEP 3 (DEC-136 confirm-else-run): grepped `docs/verification-log.md`
for a perf-smoke section citing the adopted sha and found
`## 2026-08-10 task-w19-c — perf-smoke @ 8c7f479` (this file, above).
Read that section's own RESULT/OPEN ITEMS per DEC-137 (locate by
header, do not trust neighboring homonym sections): full p95 table
against DEC-088 scale (2,000 submissions / 300 accepted+placed, 12
reviewers) all `ok` under the 150ms budget (submissions list 26.0ms,
submissions list q=Kubernetes 26.2ms, submission detail 44.1ms, event
overview 27.2ms, organizer agenda 37.8ms, public sessions page 19.4ms,
public agenda 21.1ms, schedule.ics 150 ids 33.8ms, plan progress
17.9ms, rating PUT 9.2ms), DEC-080 301-id cap assertion confirmed via
the script's synchronous-throw contract, and a STEP 4 untimed DEC-130
auto-schedule POST at perf scale (`POST /api/v1/events/seed_perf_event/
agenda/auto-schedule` against the 2,000-submission/300-accepted
perf-seeded event) already recorded: `STATUS: 200`, `DURATION_MS: 40`.
Section ends `OPEN ITEMS: 0` / `RESULT: PASS`. This is CASE
PASS+OPEN-ITEMS-0, and the section already contains evidence of the
untimed DEC-130 auto-schedule POST at perf scale, so no additional
wrangler-dev boot/perf-seed run was needed for that requirement.

Cheap spot-check per this task's brief:
`npx vitest run test/schedule.test.ts test/status-bulk-full-match.test.ts`
— 2 files, 17 tests, all green (`Test Files 2 passed (2)`, `Tests 17
passed (17)`), confirming no drift in the DEC-130/DEC-133 code paths
since `task-w19-c`'s run. No servers were started (not needed — the
cited section already carries the untimed DEC-130 spot-check evidence).

OPEN ITEMS: 0

RESULT: PASS
