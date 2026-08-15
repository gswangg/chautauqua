## 2026-08-15 task-w40-g — triage-closure @ 2e99b272

QUALIFYING

INVALIDATED BY: src/** app/src/** migrations/** package.json

DEC-644 three-sha boundary block, produced by `npm run ref-state` at
worktree cut from `main` tip `9f78158b`:
DEC-644 three-sha boundary: HEAD `9f78158b4d45fab55d57259ad7b4b63adcc5d317`;
newest first-parent product-code-bearing sha
`ed5c679e59828c5600cb84b51208056f7e38a445`; every live ref (`main`,
`manual-qa`, `task-custodian-w68-4`, `task-w40-c`, `task-w40-e`,
`task-w40-g`, `task-w68-d`, `task-w71-c`, `task-w71-d`, `task-w71-e`)
confirmed an ancestor of HEAD via `git merge-base --is-ancestor`.
NON-ancestor refs: `mail-rich-shape-fallback`, `task-w17-i`, `task-w40-b`,
`task-w40-d`, `task-w40-f`, `task-w68-b`, `task-w68-c`, `task-w68-e`,
`task-w71-a`, `task-w72-a..j`. `--product-sha` for this lane =
`ed5c679e59828c5600cb84b51208056f7e38a445`.

Polled the boundary up to 10 times (`git merge --no-edit main`,
re-assemble, sleep 180s) per this task's STEP 1: build+test+bundle,
walkthrough and spec-audit landed (`task-w40-a`, `task-w40-b`, `task-w40-d`,
all header `14db7b30`); perf-smoke never landed within the budget.
`git log --oneline --all` shows `task-w40-c: perf-smoke gate reading @
2e99b272 — RESULT PASS` merged (`deee555e`) only after the polling budget
closed, so **perf-smoke is graded ABSENT here; task-w40-c owed it**.
MEASURED_SHA (after final sync, before this lane's own commit) =
`git rev-parse --short HEAD` = `2e99b272`.

Grading the three present slots (ancestry self-confirmed via `git
merge-base --is-ancestor ed5c679e... 14db7b30`, exit 0 for all three —
ANCESTOR, not VOID):
1. build+test+bundle — `task-w40-a` @ `14db7b30`: `RESULT: PASS (build
   clean, 1092/1092 test files and 12002/12002 tests green, entry bundle
   69.20 kB gzip vs 300 kB budget) at 14db7b30, sole live task-w39-* ref
   (task-w39-e) confirmed ANCESTOR, zero retries needed.` / `OPEN ITEMS: 0`.
2. walkthrough — `task-w40-b` @ `14db7b30`: `RESULT: PASS — all six
   walkthrough areas pass at product sha 14db7b30 (no product edits made;
   frozen wave per this task's brief, docs/** only).` / `OPEN ITEMS: 0`.
3. spec-audit — `task-w40-d` @ `14db7b30` (two byte-identical index-file
   copies exist post-merge, see OPEN ITEM 2 below): `RESULT: PASS` /
   `OPEN ITEMS: 0`.
4. perf-smoke — ABSENT at this lane's sync boundary (owed by `task-w40-c`,
   delivered but not synced in time — see item 1 below).

Enumerated open items (deduplicated):
1. Absent perf-smoke slot at this lane's sync boundary — `task-w40-c`
   delivered `RESULT PASS` (commit `d1db93f9`) but merged (`deee555e`)
   after this lane's 10-attempt polling budget closed. Owner: wave-41 lane
   (confirm task-w40-c's perf-smoke section once fully synced, or re-run).
2. Duplicate `task-w40-d` spec-audit index files —
   `docs/verification-log/index/0200-2026-08-15-task-w40-d-spec-audit-14db7b30.md`
   and `.../0201-2026-08-15-task-w40-d-spec-audit-14db7b30.md` are
   byte-identical, producing a duplicate section in the assembled log.
   Owner: wave-41 lane (delete the later-numbered duplicate, re-assemble;
   `--renumber` has no content-dedup step).
3. `scripts/exit-predicate.ts:259` (`isAncestorOfProductSha`) rethrows any
   git failure other than exit status 1 uncaught; running `npm run
   exit:predicate -- --product-sha ed5c679e...` against this lane's corpus
   crashes on `git merge-base --is-ancestor ed5c679e... 6807b67`
   (`docs/verification-log.md:2470`'s ancient, unresolvable header sha)
   because no later perf-smoke section in this lane's corpus satisfies
   ancestry (the one that would, task-w40-c's, is item 1's absent slot).
   Owner: wave-41 lane (treat an unresolvable git object as not-ancestor,
   or retire the stale `6807b67` section per DEC-099's shrink-only
   ratchet).

Full detail:
docs/verification-log/task-w40-g-triage-closure-2e99b272.md.

`npm run exit:predicate -- --product-sha
ed5c679e59828c5600cb84b51208056f7e38a445` did not produce the five-row
table — it crashed (`fatal: Not a valid object name 6807b67`, see OPEN
ITEM 3), process exit code 1. Reported honestly rather than deferred, per
DEC-069 wave-27/28 amendments.

RESULT: FAIL — `npm run exit:predicate` crashed (exit code 1) rather than
producing a five-row table (OPEN ITEM 3), and this lane's own
triage-closure OPEN ITEMS count is 3, not 0, so the stage-1 exit predicate
is NOT SATISFIED at this boundary by manual cross-check either.
OPEN ITEMS: 3
