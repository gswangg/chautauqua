# 2026-08-10 task-w20-a — walkthrough confirm @ 8c7f479

Full detail for the `## 2026-08-10 task-w20-a — walkthrough confirm @ 8c7f479` section
of `docs/verification-log.md` (extracted per the contention-decomposition of
that file; see the stub entry there for `OPEN ITEMS` / `RESULT` summary).

DEC-136 confirm-else-run lane (walkthrough gate). Worktree cut from
`main` tip `d9be564` ("scribe wave 20").

**STEP 1 — sha derivation (DEC-114/DEC-129).** First-parent walk from
`d9be564` back through `9038b5c` ("scribe wave 19"), `8e84281`
("merge task-w19-a"), `24f6f84` ("merge task-w19-e"), `992987b`
("merge task-w19-d"), `5f89797` ("merge task-w19-c"), `7fd9da7`
("merge task-w19-b") — `git show --stat --first-parent -1` on each of
these six commits shows changes confined to
`docs/verification-log.md`, `docs/verification-log/*.md`,
`decisions/DEC-135.md`, `decisions/DEC-136.md`, `decisions/DEC-137.md`,
`field-guide/index.md`, and (for the two scribe commits) a
pure-string-constant-append diff in `src/decisions.ts` (`+1` and `+2`
lines respectively, each a bare `export const DEC_1xx = "...";`
addition, no other change) — all fall inside DEC-114's
bookkeeping-exclusion set. The next first-parent commit, `8c7f479`
("merge task-w18-c"), touches `src/routes/public/submit.tsx` and
`test/submit-hidden-file-field.test.ts` — code-bearing. `8c7f479` is
therefore the newest code-bearing main sha, matching the task's stated
expectation. `git merge-base --is-ancestor 675219f 8c7f479` exits 0 —
ancestor check passes (DEC-129).

**STEP 2 — behavioral preflight of DEC-130..133 (DEC-135).** Read
directly from the HEAD worktree tree (behaviorally identical to
`8c7f479` per the bookkeeping-only diff established in STEP 1):
- DEC-130 (`src/domain/schedule.ts` `autoSchedule`, ~line 121-197):
  builds `roomIndex`/`speakerIndex` `Map`s from existing placements up
  front and checks candidates against those maps; no call to
  `findConflicts` inside `autoSchedule`. Marker present.
- DEC-131 (`src/mail/ics.ts` `escapeText`, lines 39-46): replace chain
  is `.replace(/\r\n/g, "\n").replace(/\r/g, "\n")` followed by the
  backslash/`;`/`,`/`\n` escapes — CR fully normalized before
  escaping. Marker present.
- DEC-132 (`src/routes/public/submit.tsx`): file-validation loop at
  line 415 opens with `if (!isVisible(field, answers)) continue;`;
  post-submission upload loop at line 479 opens with
  `if (cleaned[field.id] !== "pending") continue;`. Marker present.
- DEC-133 (`src/server/repo/submissions/status.ts`
  `updateSubmissionStatuses`, ~line 205-211): computes
  `missing = requested.filter(id => !foundIdSet.has(id))` and throws
  `ApiError("invalid", ...)` naming the missing ids before the
  per-row `changeStatus`/UPDATE loop. Marker present.

All four markers present and behaviorally verified — preflight PASS.

**STEP 3 — DEC-136 confirm-else-run search.** `grep -n "^## "
docs/verification-log.md` located header `task-w19-b — walkthrough @
8c7f479` (line 3538, exact sha match). Per DEC-137, keyed strictly on
that section's own content (no stray conflict-marker lines present in
this section): full six-module battery (producer, review, speaker,
public, data, plus bonus scale) all reported `PASS` in the harness
summary, no `FAIL`/`PLANNER:` lines, and the section ends
`RESULT: PASS` with no `OPEN ITEMS` entries listed (i.e. 0 open
items). This is the CASE PASS + OPEN ITEMS 0 branch of DEC-136 —
confirming, not re-running the full battery.

**Confirmed prior result (quoted):** task-w19-b's walkthrough run
(port 8881, sha 8c7f479) reported all six harness modules PASS
(`producer`, `review`, `speaker`, `public`, `data`, `scale`), covering
speaker co-presenter invites/IDOR/portal-edit/upload-versioning/
comment-threads, public J9 auto-schedule + J10 five-surface visibility
gates + `.ics` idempotent UID, and data J11/J12 contacts/CSV/segments/
bulk-email/API-token/export checks — `RESULT: PASS`, 0 open items.

**Live spot-check (DEC-131, one required by DEC-136 CASE PASS).**
Fresh port 8891, zero secrets, local Miniflare only:
- `npm ci` skipped (node_modules present); `npm run build`: clean
  (tsc x2 + vite build, no errors).
- Port 8891 had no prior listener. `rm -rf .wrangler/state` then
  `npm run db:migrate`: all 10 migrations (0000..0009) applied
  successfully against local D1.
- `npm run seed`: completed, 6 objects put into local R2 bucket
  `chautauqua-files`, no errors.
- Started `npx wrangler dev --port 8891` in the background; log
  showed `[wrangler:info] Ready on http://localhost:8891`.
- Fetched the seeded organizer-scoped public itinerary export (same
  submission set as task-w19-b's spot-check, for direct comparison):
  `curl -s "http://localhost:8891/e/devflow-conf-2027/schedule.ics?ids=seed_submission_0004,seed_submission_0005,seed_submission_0006"`
  — 3 VEVENTs, each with a folded multi-line `DESCRIPTION` (CRLF
  textarea seed text).
- Byte-level check (Python, corroborated by `od -c`): 41 total `\r`
  bytes in the response body (identical count to task-w19-b's spot-
  check, as expected — same route, same seed data, unchanged code); a
  scan of every `\r` byte confirmed each is immediately followed by
  `\n` — 0 bare/bad CRs. `od -c` tail sample:
  ```
  0002600    w   o   r   k       a   g   a   i   n   s   t   .  \r  \n   E
  0002620    N   D   :   V   E   V   E   N   T  \r  \n   E   N   D   :   V
  0002640    C   A   L   E   N   D   A   R  \r  \n
  ```
  No bare `\r` observed anywhere in the file. Spot-check PASS,
  consistent with DEC-131.
- Server killed (`lsof -ti :8891 | xargs kill`) after the spot-check;
  port confirmed free.

OPEN ITEMS: 0

RESULT: PASS
