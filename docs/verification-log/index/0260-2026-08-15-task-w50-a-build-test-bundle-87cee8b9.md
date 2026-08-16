## 2026-08-15 task-w50-a — build+test+bundle @ 87cee8b9

QUALIFYING

INVALIDATED BY: src/** app/src/** migrations/** package.json

Step 0 sync-then-measure: `git merge --no-edit main` in this worktree (cut
directly from `main` tip) reported "Already up to date." on every attempt.
`npx tsx scripts/ref-state.ts` receipt (verbatim):

DEC-644 three-sha boundary: HEAD `87cee8b9fec30d190f93156c99ddf7011b68bc92`;
newest first-parent product-code-bearing sha
`c6f5ab28ccf4c4a06096f95a460a66ad0be0687b`; every live ref (`main`,
`manual-qa`, `task-custodian-w68-4`, `task-w47-a`, `task-w47-g`, `task-w47-h`,
`task-w48-a`, `task-w48-c`, `task-w48-f`, `task-w49-f`, `task-w49-g`,
`task-w50-a`, `task-w50-b`, `task-w68-d`, `task-w71-c`, `task-w71-d`,
`task-w71-e`) confirmed an ancestor of HEAD via `git merge-base
--is-ancestor`. NON-ancestor refs (NOT confirmed via `git merge-base
--is-ancestor`): `mail-rich-shape-fallback`, `task-w17-i`, `task-w48-b`,
`task-w48-d`, `task-w48-e`, `task-w48-g`, `task-w49-a`, `task-w49-b`,
`task-w49-c`, `task-w49-d`, `task-w49-e`, `task-w49-h`, `task-w68-b`,
`task-w68-c`, `task-w68-e`, `task-w71-a`, `task-w72-a`, `task-w72-b`,
`task-w72-c`, `task-w72-d`, `task-w72-e`, `task-w72-f`, `task-w72-g`,
`task-w72-h`, `task-w72-i`, `task-w72-j`.

Individual `git merge-base --is-ancestor <sha> HEAD` re-check for every
`task-w49-*` ref (never a glob over `.git/refs/heads/*`, never the
`.git/packed-refs` `refs/heads/main` line): `task-w49-a` NOT-ANCESTOR,
`task-w49-b` NOT-ANCESTOR, `task-w49-c` NOT-ANCESTOR, `task-w49-d`
NOT-ANCESTOR, `task-w49-e` NOT-ANCESTOR, `task-w49-f` ANCESTOR, `task-w49-g`
ANCESTOR, `task-w49-h` NOT-ANCESTOR. Bounded poll: 3 attempts of `git merge
--no-edit main` (each "Already up to date."), ~5s apart; no change across
attempts. Per instructions, proceeding without blocking: `task-w49-a`,
`task-w49-b`, `task-w49-c`, `task-w49-d`, `task-w49-e`, `task-w49-h` are
named as still non-ancestor of HEAD.

MEASURED_SHA = `git rev-parse --short HEAD` = `87cee8b9` (taken after the
last sync, before this commit; no product-code commit landed on `main`
during the heavy phase — no freeze violation).

`npm run build` (worker `tsc --noEmit`, app `tsc --noEmit -p
app/tsconfig.json`, then `vite build --config app/vite.config.ts`): clean,
BUILD_EXIT=0.

Full suite run inside one lock acquisition per DEC-644 (`sh
scripts/with-test-lock.sh sh -c 'npm run build; echo "BUILD_EXIT=$?"; npx
vitest run; echo "VITEST_EXIT=$?"; npm run bundle:check; echo
"BUNDLE_EXIT=$?"'`, all three commands run unconditionally with `;`, never
`&&`, never nesting `npm test`/`test:full` inside the wrapper):

```
BUILD_EXIT=0
 Test Files  13 failed | 1104 passed (1117)
      Tests  19 failed | 12163 passed (12182)
     Errors  1 error
VITEST_EXIT=1
Entry bundle: index-07JDGepC.js + index-DpG2gFFa.css = 69.20 kB gzip (budget 300.00 kB)
bundle:check PASSED
BUNDLE_EXIT=0
```

All three commands ran unconditionally inside the single lock acquisition;
the `vitest run` non-zero exit did not suppress the subsequent
`bundle:check` reading (DEC-644 w50).

DEFECTS FILED (owner: wave-51 lane, per DEC-453 — this frozen gate lane does
not fix, files only):

1. `src/server/repo/tasks/reminders.ts:434` — `TypeError: db.update(...)
   .set(...).where(...).returning is not a function` inside
   `sendReminderEmails`, called from `remindNow` (:582) and
   `sendDueRemindersForEvent` (:804). Single root cause, 12 failing tests
   across 9 files: `test/reminder-drafts.test.ts:269`,
   `test/reminder-portal-link.test.ts:219,231,253`,
   `test/reminders-batched-stamp.test.ts:204`,
   `test/reminders-portal-link-batched.test.ts:215` (plus 1 unhandled
   rejection from the same call site), `test/reminders-timezone.test.ts:191,
   239,270`, `test/tasks-due-reminders-mailer-failure.test.ts:173`,
   `test/tasks-remind-now-mailer-failure.test.ts` (2 tests). The claim-write
   at `reminders.ts:434` calls `.returning({ id: schema.taskAssignment.id
   })` on an update chain the test doubles/driver do not implement.
   `test/chunk-sweep-misc.test.ts:72` independently asserts the source at
   this location should read `for (const batch of
   chunkIds(sentAssignmentIds)) { ... inArray(schema.taskAssignment.id,
   batch)` (a chunked, `inArray`-batched update with no `.returning()`) but
   the file instead now reads the DEC-023 barrel-header comment followed by
   a non-chunked `.returning()` call — i.e. the batching/chunking shape the
   scan test expects was replaced by a single unchunked update using
   `.returning()`, which is unsupported by the exercised db path. Fix
   belongs in `src/server/repo/tasks/reminders.ts` (restore
   `chunkIds`-batched `inArray` update, or make `.returning()` supported by
   whatever db shim these tests exercise).

2. `test/login-account-budget.test.ts:251` — failing test: "DEC-072
   wave-66: login-account restores a spoof-proof per-account budget beside
   the (email,ip) pair budget > DEC-072 wave-38: with the account budget
   exhausted, a WRONG password from a fresh IP still 429s (the budget still
   throttles brute force)". `expect(wrongFromFreshIp.status).toBe(429)` got
   `401` instead — the per-account budget documented at DEC-072 is no
   longer throttling a fresh-IP attempt once the account budget is
   exhausted. Fix belongs in the login-account-budget enforcement path
   (src/routes/auth-login.tsx and/or its rate-limit helper) or, if the test
   itself is stale relative to a since-landed DEC-072 amendment, in
   `test/login-account-budget.test.ts:251`.

3. `test/schema-migration-parity.scan.test.ts:355` — same root cause as
   `migrations/0043_file_version_chain_unique.sql` and
   `0000_secret_matthew_murdock.sql`'s `file_previous_file_id_idx` /
   `file_previous_file_id_unique` declaring indexes with no matching
   `src/db/schema/**.ts` declaration. Per wave-49 field-guide finding (DEC-
   358), this defect is task-w47-g's (`9a541796`, adds
   `migrations/0043_file_version_chain_unique.sql`), committed but still
   unmerged into `main`; re-measured here, not re-fixed, per DEC-358 w49
   ("a row owned by a committed-but-unmerged branch is re-measured, never
   re-fixed").

4. `test/unique-index-guard-coverage.scan.test.ts:114` — same root cause as
   item 3 (`file_previous_file_id_unique` has no ALLOWLIST entry); also
   task-w47-g's, re-measured not re-fixed.

5. `test/spec9-invariants.test.ts:131` — `canEditSubmission("accepted",
   pastClose, now, "America/Los_A...")` expected `false`, got `true`. Per
   the wave-49 field-guide finding (DEC-522), this is a clock-dependent
   test defect, not a product regression: the test feeds `Date.now() - 24h`
   where `isFormClosed` requires a DAY LABEL, and `dayLabelToYmd` reads the
   UTC calendar date, so this row is red for ~7 hours of every UTC day.
   Re-measured true at this wall-clock time; fix belongs in
   `test/spec9-invariants.test.ts` (freeze `now`/day label per the pattern
   at `test/edit-lock.test.ts:9-11`), not in
   `src/domain/edit-lock.ts`.

6. `test/verification-log-verdict-contract.test.ts:248` — the shrink-only
   ratchet's known-offenders set gained one new member not yet in
   `LEGACY_VERDICT_VIOLATIONS`:
   `docs/verification-log/index/0238-2026-08-15-task-w47-h-eval-findings-defect-ledger-32921050.md`.

7. `test/verification-log-verdict-contract.test.ts:259` — the same file
   (`0238-...-task-w47-h-...md`) carries a RESULT line whose token is
   `NOT` (i.e. reads `RESULT: NOT ...` rather than `PASS`/`FAIL`), which
   `verdictToken` cannot classify as PASS or FAIL. Both item 6 and item 7
   trace to the same file; fix belongs in either amending
   `0238-...md`'s RESULT line to end PASS/FAIL, or adding it to
   `LEGACY_VERDICT_VIOLATIONS` if it is deliberately non-conforming.

RESULT: FAIL — BUILD_EXIT=0, VITEST_EXIT=1 (19/12182 tests failed across 13
files, 1 additional unhandled-rejection error, all 7 root causes filed
above, owner: wave-51 lane), BUNDLE_EXIT=0 (bundle:check PASSED, entry
bundle 69.20 kB gzip vs 300 kB budget — ran unconditionally inside the same
lock acquisition despite the vitest failure, per DEC-644 w50). No freeze
violation observed: no product-code commit landed on `main` during the
heavy phase.
OPEN ITEMS: 7
