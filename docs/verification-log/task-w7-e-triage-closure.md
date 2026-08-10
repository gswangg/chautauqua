# task-w7-e — triage-closure @ 0d4996e

Docs-only lane (DEC-069/077/090/102). Runs after task-w7-b's walkthrough
gate (per DEC-093) so it can cite that run's evidence. Newest observed
`main` commit at branch time: `0d4996e` ("merge task-w7-b"); the newest
*code-bearing* commit per DEC-091 remains **d12eb25** ("merge
task-w6-d") — everything after it on this ancestry chain
(`de8d492`/`d12eb25` sibling merges, `9e7ac53` scribe, `b17595e`/`52b9eaa`
task-w7-a build+test, `7af78d9`/`8eff481` task-w7-d spec-audit,
`075fc16`/`4a1997b` task-w7-c perf-smoke, `8c19466` scribe, `9801e40`/
`0d4996e` task-w7-b walkthrough) is gate-result docs or pure
string-constant appends to `src/decisions.ts` — confirmed via `git diff
d12eb25..HEAD --stat` (only `docs/`, `decisions/`, `field-guide/`, and a
`src/decisions.ts` append touch anything).

## (1) docs/eval-findings.md — round-1 findings

Re-read in full: still states "Round 1 ... is fully dispositioned. Zero
open findings remain in this file." Confirmed accurate — no new
round-1-scope findings have surfaced since task-w4-e closed it, and the
two script-only items it forward-references (walkthrough scale step 6,
perf-smoke 301-id cap probe) are covered by item (2) below. Left
unchanged (not stale).

## (2) Two script-only open items from task-w4-e-triage-closure.md §(3)

Both confirmed **CLOSED** by commit `b638f75` (DEC-094/095/096, merged
`3d1e838`), with runtime proof from this wave's own gates:

- **Walkthrough scale step 6** (`purgeRefreshProbe` missing `trackIds`
  on the portal-edit FormData): fixed at `scripts/walkthrough/scale.ts` —
  the portal-edit `FormData` now derives `trackIds` from the edit page's
  checked track checkboxes (same pattern as the earlier public-submit
  FormData in the same function) before POSTing to
  `/portal/submissions/:id/edit`. Runtime proof: this wave's
  `task-w7-b` walkthrough section (`## 2026-08-10 task-w7-b —
  walkthrough @ d12eb25`, `docs/verification-log.md`) reports "ALL SIX
  AREAS PASS in order — producer, review, speaker, public, data, scale"
  and explicitly "step 6 confirms the DEC-092 portal-edit purge-refresh
  probe (DEC-095 checked-`trackIds` fix) still passes", `RESULT: PASS`,
  `OPEN ITEMS: 0`.
- **Perf-smoke 301-id cap probe** (single `perPage=301` request
  unreachable against the 200-row pagination clamp / 300-accepted seed):
  fixed at `scripts/perf-smoke.ts:166` (`planPerfPages(count,
  PERF_MAX_PER_PAGE)` pagination) and `scripts/perf-smoke.ts:194-209`
  (301-id cap assertion built as 300 real accepted ids + one synthetic
  `sub_cap_probe_nonexistent_0001` id, still asserting the `.ics`
  endpoint returns 400). Runtime proof: this wave's `task-w7-c`
  perf-smoke section (`## 2026-08-10 task-w7-c — perf-smoke @ d12eb25`)
  explicitly states "DEC-089/DEC-080/DEC-094 cap probe PASSES" with the
  server log line `GET /e/perf-2k/schedule.ics 400 Bad Request (3ms)` as
  evidence — this closes the item task-w4-c originally recorded.

Both script-only items are genuinely closed.

## (3) Four wave-6 review-lens defects — fixed on main with regression tests

- **DEC-098 claim takeover**: `src/routes/public/submit.tsx:207`
  (`type ConfirmationState = "fresh" | "pending-existing-contact" |
  "has-account"`) plus the `:194-206` comment explaining the on-screen
  claim link is only rendered for the "fresh" state (new contact created
  by this exact request) — no claim URL is ever shown for
  `pending-existing-contact`/`has-account`. Regression test:
  `test/claim-onscreen-scope.test.ts` (present).
- **DEC-099 pubcache hit Cache-Control**: `src/server/pubcache.ts:46`
  defines `CLIENT_CACHE_CONTROL` (max-age=60, stale-while-revalidate=300)
  and `:87` (`restored.headers.set("Cache-Control",
  CLIENT_CACHE_CONTROL)`) restores it on cache hits so hits re-serve the
  same client-facing header as misses. Regression test:
  `test/pubcache.test.ts` (present).
- **DEC-100 seq race**: `src/server/repo/submissions/seq.ts` —
  `submissionSeqSubquery` builds `(SELECT COALESCE(MAX(seq), 0) + 1 FROM
  submission WHERE event_id = <eventId>)` as a raw SQL fragment passed
  directly into the INSERT statement's `seq` column (atomic under
  SQLite/D1's single-writer model), replacing a SELECT-then-INSERT race.
  Regression test: `test/submission-seq.test.ts` (present).
- **DEC-101 merge repoints/dedupe**: `src/server/repo/contacts.ts:179`
  (`planMerge`, plans repoints across all six FK tables: `participant`,
  `task_assignment`, `email_log`, `user`, `file`,
  `file_comment.author_contact_id`) and `:467-494`
  (`applyMerge`/dedupe-delete-before-repoint doc comment: "Dedupe
  participant rows BEFORE repointing: if both contacts are already
  participants on the same submission, delete the duplicate row rather
  than repointing it into a UNIQUE-violating dupe"). Regression test:
  `test/contacts-repo.test.ts` (present).

All four confirmed fixed on main with regression tests in place.

## (4) Scan of all prior FAIL sections in docs/verification-log.md

Swept every `RESULT: FAIL` section present on `main` at this branch
point:

- **task-w3-c** (walkthrough scale step6 400): CLOSED by `b638f75`,
  re-confirmed PASS at task-w5-c and every walkthrough gate since
  (w6/w7-b). No longer open.
- **task-w3-d** (perf-smoke 301-id abort): CLOSED by `b638f75`'s
  `planPerfPages` pagination fix; the cap-probe portion re-confirmed
  PASS at task-w7-c (see (2) above). The perf-smoke gate's *overall*
  result at `d12eb25` is nonetheless FAIL — but for a different,
  unrelated reason (see below), not this original defect.
- **task-w4-b** (walkthrough, duplicate report of the same scale step6
  script bug as w3-c): CLOSED, same fix/evidence as w3-c.
- **task-w4-c** (perf-smoke, duplicate report of the same 301-id script
  bug as w3-d): CLOSED, same fix/evidence as w3-d.
- **task-w4-e** (triage-closure; itself reported `OPEN ITEMS: 2` — the
  two script-only items dispositioned as CLOSED in (2) above):
  CLOSED, no remaining open item from this section.
- **task-w7-c** (perf-smoke @ `d12eb25`): reports `OPEN ITEMS: 1`,
  `RESULT: FAIL` — a **genuinely new, still-open defect**, distinct
  from every item above. `GET /api/v1/events/:eventId/overview` throws
  `D1_ERROR: too many SQL variables` at `src/server/repo/overview.ts:170`
  (`inArray(schema.participant.submissionId, placedIds)` with an
  unbounded ~300-entry `placedIds` array — one bind parameter per id,
  exceeding D1's local SQLite bind-variable ceiling) when exercised at
  the DEC-088 perf-seed scale (300 accepted+placed submissions). This
  blocks the "event overview" perf-smoke timed check and every check
  after it in script order (`public sessions page`, `public agenda`,
  `schedule.ics 150 ids`, `plan progress`, `rating PUT` never ran; no
  p95 data was collected/printed for any check that wave). **Verified
  still unfixed at this task's own worktree tip** (`0d4996e`,
  content-identical to `d12eb25` for this path): `grep -n
  "inArray(schema.participant.submissionId" src/server/repo/overview.ts`
  still shows the same unbounded call at line 176 (no `chunkIds` /
  `ID_CHUNK_SIZE` batching applied, unlike the DEC-078 pattern already
  used at `src/server/repo/submissions/status.ts:15`,
  `src/server/repo/public.ts:13`, and `src/server/repo/comms.ts:11`).
  No task since task-w7-c on this branch's ancestry has touched
  `src/server/repo/overview.ts` (`git log --oneline -- \
  src/server/repo/overview.ts` shows only the original `e76e8ad`
  "Overview worklist dashboard (DEC-030)" commit). This is a genuine
  product-code scale defect, not ratified by any decision doc, and not
  within this docs-only lane's authority to fix per DEC-077/090.

  Note: an unmerged sibling branch `task-w8-b` (not an ancestor of this
  branch's `main` tip, confirmed via `git merge-base --is-ancestor
  6cadd6a HEAD` -> not an ancestor) independently re-ran the perf-smoke
  gate and reports the identical defect still present at `d12eb25`
  ("confirms task-w7-c overview-500 scale defect, RESULT: FAIL") — this
  is corroborating evidence from a parallel lane, not a fix, and it has
  not merged into `main` as of this task's branch point.

- No other `RESULT: FAIL` sections found in `docs/verification-log.md`
  (task-w3-c/d, task-w4-b/c/e are the full set; all confirmed above).

## Unmerged task-w6-a-retry branch

Per this task's instruction to confirm the unmerged `task-w6-a-retry`
branch carries nothing needed: its scope (the scripts fixes) is already
landed at `b638f75`/`3d1e838` per the field guide and confirmed live in
(2) above. `git branch --list 'task-w6-a-retry*'` in this repo's local
branch list returns nothing reachable/relevant beyond what's already on
`main`; no action needed.

## Conclusion

Three of the four sweep categories in this task ((1) eval-findings,
(2) the two script-only items, (3) the four wave-6 defects) are fully
closed. Category (4)'s sweep of prior FAIL sections surfaces **one
genuinely open, unratified product defect**: the `overview.ts:170`
unbounded `inArray` D1 bind-variable-limit crash at perf scale, first
recorded by task-w7-c and still present, unfixed, on `main` at this
task's branch point. Per this task's own instructions, this docs-only
lane does not fix it — it is recorded honestly as an open item.

`npm run build` and `npm test --silent` were NOT re-run as part of this
lane's own verification gate (this is a triage-closure/sweep task, not
a build+test or walkthrough/perf-smoke gate) — the most recent
same-sha `npm test` result cited above (task-w7-c: 96 files / 984
tests, all PASS) stands unchanged, since no code-bearing commit has
landed between `d12eb25` and this task's branch point.

OPEN ITEMS: 1

1. `src/server/repo/overview.ts:170`'s unbounded
   `inArray(schema.participant.submissionId, placedIds)` throws
   `D1_ERROR: too many SQL variables` at DEC-088 perf-seed scale (~300
   accepted+placed submissions), blocking the perf-smoke gate's "event
   overview" check and everything after it. First surfaced by
   task-w7-c; independently reconfirmed still open by unmerged sibling
   task-w8-b; still open at this task's own `main` tip (`0d4996e`,
   code-bearing sha `d12eb25`). Needs a code-bearing fix (e.g. chunked
   `IN` queries per the DEC-078 `ID_CHUNK_SIZE` pattern already used in
   `src/server/repo/{submissions/status,public,comms}.ts`) in a future
   wave; out of scope for this docs-only lane.

RESULT: FAIL — one genuinely open, unratified product defect
(`src/server/repo/overview.ts:170` D1 bind-variable-limit crash on
event overview at perf scale) found during the mandatory FAIL-section
sweep; all other categories in this task's scope ((1) eval-findings,
(2) the two script-only items, (3) the four wave-6 defects, (4) the
rest of the FAIL-section sweep, unmerged task-w6-a-retry) are closed.
