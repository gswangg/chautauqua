# 2026-08-10 task-w19-c — perf-smoke @ 8c7f479

Full detail for the `## 2026-08-10 task-w19-c — perf-smoke @ 8c7f479` section
of `docs/verification-log.md` (extracted per the contention-decomposition of
that file; see the stub entry there for `OPEN ITEMS` / `RESULT` summary).

STEP 1: DEC-114 newest code-bearing sha on `main`, first-parent walk from
`9038b5c` (branch tip, "scribe wave 19"): `9038b5c` itself touches only
`decisions/DEC-135.md`, `field-guide/index.md`, and a pure single-line
constant append to `src/decisions.ts` (`export const DEC_135 = ...`) —
bookkeeping, excluded per DEC-114. The next first-parent commit,
`8c7f479` ("merge task-w18-c"), touches `src/routes/public/submit.tsx`
and `test/submit-hidden-file-field.test.ts` — code-bearing. Adopted sha:
`8c7f479`.

Ancestor guard: `git merge-base --is-ancestor 675219f 8c7f479` exits 0 —
PASS.

STEP 2 (DEC-135 behavioral preflight, all four DEC-130..133 fix markers
read directly from source at this sha):

- DEC-130 (`src/domain/schedule.ts`): `autoSchedule` uses incremental
  per-room/per-speaker occupancy interval indexes (comment at line 121:
  "Incremental occupancy indexes (DEC-130): avoid re-running
  findConflicts"); grepped the body of `autoSchedule` for `findConflicts`
  and `[...placed, candidate]` — zero matches inside the function.
  `findConflicts` still exists as a separately-exported helper (used
  elsewhere, e.g. line 79) but is never called from `autoSchedule`.
  Marker PRESENT.
- DEC-131 (`src/mail/ics.ts`): `escapeText` (lines 39-47) normalizes
  `\r\n` -> `\n` and lone `\r` -> `\n` as its first two `.replace()`
  calls, before the backslash/semicolon/comma/newline escaping. Marker
  PRESENT.
- DEC-132 (`src/routes/public/submit.tsx`): file-field processing loop
  is gated on `if (!isVisible(field, answers)) continue;` (line 415)
  before ever assigning the `"pending"` placeholder, and the later
  upload-consuming pass at line 479 only proceeds when
  `cleaned[field.id] === "pending"` (skipping hidden fields, which never
  got the placeholder). Marker PRESENT.
- DEC-133 (`src/server/repo/submissions/status.ts`): `updateSubmissionStatuses`
  computes `missing` (requested ids not found for this event) and
  `throw new ApiError("invalid", ...)` at line 209, strictly before the
  mutation loop (`for (const row of rows) { ... }` starts after the
  throw, at line 213). Marker PRESENT.

All four markers present and pre-mutation/pre-loop as required — preflight
PASS, proceeding to the live run.

STEP 3: `lsof -ti:8882 | xargs -r kill -9` (nothing running). `rm -rf
.wrangler/state` — none present (fresh worktree). `npm run db:migrate`:
10 migrations `0000`..`0009` applied clean. `npm run seed`: required
first (per the w16-c/w18 precedent — `perf:seed` alone seeds only
synthetic `seed_perf_`-prefixed rows, not the login-capable
`sbek-organizer@example.com` fixture identity `perf-smoke.ts` logs in
as); ran clean, 6 R2 objects uploaded. `npm run perf:seed`: DEC-088 scale
(2,000 submissions / 300 accepted+placed, 12 reviewers), all SQL batches
`"success": true`. `npx wrangler dev --port 8882` started in background,
`GET /` 200 OK, ready log observed.

`PERF_URL=http://localhost:8882 npm run perf:smoke` — exit 0 ("perf:smoke
OK"). Full p95 table (budget 150ms, all `ok`):

```
submissions list (page 1)            26.0ms  ok
submissions list (q=Kubernetes)      26.2ms  ok
submission detail                    44.1ms  ok
event overview                       27.2ms  ok
organizer agenda (300 accepted)      37.8ms  ok
public sessions page                 19.4ms  ok
public agenda                        21.1ms  ok
schedule.ics 150 ids                 33.8ms  ok
plan progress (12 reviewers)         17.9ms  ok
rating PUT                            9.2ms  ok
```

DEC-080 cap assertion (301-id `schedule.ics` -> exactly 400, run untimed
before the measured loop, `perf-smoke.ts:211-219`): the script throws
synchronously on any non-400 response, so the clean `perf:smoke OK` exit
confirms this assertion passed (301st synthetic nonexistent id rejected
with 400 as required by the DEC-080 cap).

STEP 4: DEC-130 scale spot-check, run AFTER the timed loop per the task
brief. Logged in as the same seeded fixture organizer
(`docs/fixtures/sample-data.json` `identities.organizer`, same
GET-csrf-cookie / POST-form / `chq_session` flow as `perf-smoke.ts`'s
`login()`), then `POST /api/v1/events/seed_perf_event/agenda/auto-schedule`
(route at `src/routes/agenda.ts:101`, `requireOrganizer` + `csrfJson` ->
sent `x-chq-csrf: 1` header per `CSRF_HEADER` in `src/auth/cookies.ts`,
JSON body `{}` so all four `AutoScheduleBody` fields fall back to
`DEFAULT_AUTO_SCHEDULE_PARAMS`) against the perf-seeded event (2,000
submissions / 300 accepted, matching the DEC-088 scale). Result:
`STATUS: 200`, `DURATION_MS: 40` — success, well under any CPU-time/
timeout ceiling, no error.

Server stopped (`lsof -ti:8882 | xargs -r kill -9`) after the run.

OPEN ITEMS: 0

RESULT: PASS
