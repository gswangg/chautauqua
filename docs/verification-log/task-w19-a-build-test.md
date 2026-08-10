# task-w19-a — build+test @ 8c7f479

## Sha derivation (DEC-114)

Walked `git log --first-parent --format=%h -n 40 HEAD` from `9038b5c`
(scribe wave 19). For each sha, `git diff --name-only <sha>^ <sha>`:

- `9038b5c` (scribe wave 19): `decisions/DEC-135.md`,
  `field-guide/index.md`, `src/decisions.ts` — the `src/decisions.ts`
  diff is a single pure string-constant append (`DEC_135`). Not
  code-bearing per DEC-114's exemption list.
- `8c7f479` (merge task-w18-c): `src/routes/public/submit.tsx`,
  `test/submit-hidden-file-field.test.ts` — code-bearing.

Newest code-bearing sha: `8c7f479`.

Guard: `git merge-base --is-ancestor 675219f 8c7f479` — passes
(`675219f` is an ancestor). DEC-129 satisfied.

## Preflight (DEC-135, behavioral, all read via `git show 8c7f479:<path>`)

- **DEC-130** (`src/domain/schedule.ts`): `autoSchedule` builds
  `roomIndex`/`speakerIndex` maps of `{startMin,endMin}` intervals
  per `day|roomId` / `day|contactId` key, seeded from `existing`, and
  checks candidate placements against those buckets via an `overlaps`
  helper. No call to `findConflicts` inside `autoSchedule`, no
  `[...placed, candidate]` re-scan pattern. PRESENT.
- **DEC-131** (`src/mail/ics.ts`): `escapeText` — `.replace(/\r\n/g,
  "\n").replace(/\r/g, "\n")` run before the backslash/`;`/`,`/`\n`
  escapes. PRESENT.
- **DEC-132** (`src/routes/public/submit.tsx`): file-validation loop
  (`for (const field of fileFields)`) at line 415 has `if
  (!isVisible(field, answers)) continue;` as its first statement. The
  post-create upload loop (line 479) has `if (cleaned[field.id] !==
  "pending") continue;` as its first statement — hidden fields never
  set the "pending" placeholder so this loop skips them too. PRESENT.
- **DEC-133** (`src/server/repo/submissions/status.ts`):
  `updateSubmissionStatuses` runs the chunked event-scoped SELECT
  into `rows`, computes `missing` against the requested id set, and
  `throw new ApiError("invalid", ...)` naming `unknown ids: ...`
  BEFORE the acceptance-planning/UPDATE loop that follows. PRESENT.

All four markers present by behavior (not just import) — proceeding
to gates (no fix needed, no STOP).

## Gates

Environment: node v24.1.0, npm 11.3.0, tsc Version 5.9.3, vite
6.4.3, vitest 3.2.7. Worktree HEAD was `9038b5c` (scribe wave 19,
strictly non-code-bearing atop `8c7f479` per the derivation above —
no `src/**`/`test/**` diff between the two), so gates were run at
HEAD, which is behavior-identical to `8c7f479` for build/test
purposes.

- `npm run build` (`tsc --noEmit && tsc --noEmit -p app/tsconfig.json
  && vite build --config app/vite.config.ts`): exit 0. 125 modules
  transformed, vite build succeeded, entry bundle
  `index-DOwNDQO_.js` 179.18 kB raw / 58.63 kB gzip.
- `npm test` (vitest run): **113 test files passed (113), 1076 tests
  passed (1076)**, 0 failures. Duration 9.28s.
  - Wave-18 fix test files confirmed present and green:
    `test/schedule.test.ts` (DEC-130), `test/ics-crlf-escaping.test.ts`
    (DEC-131), `test/status-bulk-full-match.test.ts` (DEC-133) — all
    three appear in the full run's pass list.
  - DEC-132 test file (per `git show --stat 8c7f479`, which shows
    `test/submit-hidden-file-field.test.ts` as the only test file
    touched by the task-w18-c merge): re-run in isolation via `npm
    test -- test/submit-hidden-file-field.test.ts` — 3 tests passed.
- `npm run bundle:check`: exit 0, `bundle:check PASSED`. Entry bundle
  58.60 kB gzip vs 300.00 kB budget.

## Result

RESULT: PASS
