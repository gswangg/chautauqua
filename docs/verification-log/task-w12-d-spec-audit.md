# 2026-08-10 task-w12-d — spec-audit @ 3b7ed3d

Full detail for the `## 2026-08-10 task-w12-d — spec-audit @ 3b7ed3d` section
of `docs/verification-log.md` (extracted per the contention-decomposition of
that file; see the stub entry there for the header/RESULT summary).

DEC-069 spec-audit gate (static sweep, no server). Step 1 sha
re-derivation per DEC-114: expected `3543f09` per DEC-116 did NOT hold
once re-walked mechanically against the actual first-parent chain.
`e9ec7e0` ("scribe wave 11") is a 0-diff no-op against `3543f09` on
every non-bookkeeping path (confirmed: `git diff 3543f09 e9ec7e0 --
scripts/walkthrough/speaker.ts` is empty; `src/decisions.ts` only
gains pure string-constant appends). `3b7ed3d` ("merge task-w11-a") is
NOT a no-op: its first-parent diff against `e9ec7e0` touches
`scripts/walkthrough/speaker.ts` with substantive additions (Hotel
GET-only distinct-from-Flight handling, the DEC-108 A/B/C
invite-visibility probe block) not present at `3543f09`/`e9ec7e0` — so
per DEC-114's mechanical test it IS code-bearing, matching the
independent derivations already logged by task-w11-b (build+test) and
task-w11-c (walkthrough), both anchored at `3b7ed3d`. Everything after
`3b7ed3d` on the first-parent chain up through the current tip
(`15a422a` scribe wave 12, `546cbcc` merge task-w11-e, `e309b59` merge
task-w11-b, `2b4a5b9` merge task-w11-c) is confirmed non-code-bearing:
`git diff 3b7ed3d 2b4a5b9 -- . ':!docs/verification-log.md'
':!decisions' ':!field-guide'` returns only `src/decisions.ts` (pure
string-constant appends), and `git diff 3b7ed3d 546cbcc --
scripts/walkthrough/speaker.ts` is empty (546cbcc's merge re-lands
content already present since 3b7ed3d, an empty re-merge on that
path). Newest code-bearing sha for wave-12 gates: `3b7ed3d` ("merge
task-w11-a"). This is a genuine, mechanically-derived deviation from
DEC-116's stated expectation, not a defect — DEC-116's premise (that
`3543f09` alone already satisfied DEC-112 without task-w11-a landing)
turned out not to hold once task-w11-a actually merged; the resulting
speaker.ts content is additive test coverage only (no product-code
behavior change), consistent with build+test/walkthrough already
passing at this sha.

Step 2 sweep (file:line evidence against the working tree, confirmed
byte-identical to `3b7ed3d` on every path outside
`docs/verification-log.md`/`decisions/`/`field-guide/`/pure
`src/decisions.ts` appends):

- DEC-098 claim same-request only: `src/routes/public/submit.tsx:194-203`
  (three-state doc comment: fresh/returning-no-user/existing-user) and
  `:499-503` (claimUrl/claimToken minted inline in the same submit
  request, only when `contactId` corresponds to a no-user case — no
  separate claim-mint endpoint exists).
- DEC-099 pubcache hit-path restore: `src/server/pubcache.ts:82-88`.
  Hit branch (`if (hit)`) rebuilds a fresh `Response` and sets
  `Cache-Control` back to `CLIENT_CACHE_CONTROL` (line 87, defined
  line 49 as `"public, max-age=60, stale-while-revalidate=300"`)
  before returning; the stored copy carries
  `CLIENT_CACHE_CONTROL_OVERRIDE` (line 44, `"public, max-age=86400"`)
  only in cache, never on a client-facing response. `test/pubcache.test.ts`
  (16 tests) exercises both branches.
- DEC-100 atomic seq: `src/server/repo/submissions/seq.ts:13-15`,
  `submissionSeqSubquery` builds `(SELECT COALESCE(MAX(seq), 0) + 1
  FROM submission WHERE event_id = ...)` inline. Confirmed all three
  submission-insert call sites use it (`src/server/repo/submit.ts:168`,
  `src/server/repo/submissions/create.ts:59,102`); grep for `MAX(` in
  `src/server/repo/submissions/` shows only the one definition, no
  bare `SELECT MAX` + separate `INSERT` remains. `test/submission-seq.test.ts`.
- DEC-101 six-FK contact merge: `src/server/repo/contacts.ts:164-179`
  (`MergeRepointOp` type lists `participant | task_assignment |
  email_log | user | file | file_comment`; `buildMergeRepointOps`
  maps all six) and `:489-532` (dedupe-before-repoint at 494-512 using
  `chunkIds`; repoint loop at 514-532 covers all six tables including
  `file.uploadedByContactId` at line 525 and
  `fileComment.authorContactId` at lines 527-530).
  `test/contacts-repo.test.ts` (17 tests, incl. explicit
  file/file_comment and same-submission-dedupe assertions).
- DEC-104 chunkIds sweep: `src/server/repo/overview.ts:170`
  (`for (const batch of chunkIds(placedIds))`). Repo-wide sweep: every
  file using `inArray(` also uses `chunkIds` or carries an explicit
  "DEC-104-exempt" two-literal-bounded comment (verified via `grep -rln
  "inArray(" src/server --include="*.ts" | xargs grep -L "chunkIds\|DEC-104-exempt"`
  — zero results). Guard suites: `test/chunk-sweep-overview.test.ts`,
  `-agenda`, `-misc`, `-exports` (all green).
- DEC-108 public visibility gate: `src/server/repo/public.ts:38`
  (`visibleSubmissionConditions`) and `:239` (speaker-hydration query),
  both `inArray(schema.participant.inviteStatus, ["none", "accepted"])`.
  `test/public-invite-visibility.test.ts` (3 tests); runtime-proved by
  task-w11-c's walkthrough log (A/accepted shown, B/declined and
  C/pending absent, on both `speaker.ts` and `public.ts` probes).
- DEC-109 portal-edit file-answer carry-over:
  `src/routes/portal/edit.tsx:61-65` (stored file answer copied
  forward, never read from `body`) and `:201-205` (required forced
  false for file-kind fields only in the edit-route validation call).
  `test/portal-edit-file-field.test.ts` (8 tests).
- DEC-110 rules JSON escaping: `src/views/form-render.tsx:145`
  (`safeJson = json.replace(/</g, "\\u003c")`) and `:176-177`
  (`dangerouslySetInnerHTML={{ __html: safeJson }}` on the `<script
  type="application/json">` tag). `test/form-render-rules.test.ts`
  (2 tests).
- DEC-111 backing forms + self-heal: `src/domain/acceptance.ts:40`
  (`FORM_TASK_FIELD_SPECS`, pure data) and
  `src/server/repo/submissions/status.ts:22-63` (find-or-create by
  exact title, `isDefault: false`) and `:78-82` (self-heal: an
  existing `kind='form'` task with null `formId` gets one lazily
  attached). `test/acceptance-form-tasks.test.ts` (6 tests).
- DEC-112/DEC-116 probes: present and green per task-w11-c's
  walkthrough log at this same sha — `scripts/walkthrough/speaker.ts`
  lines ~541-566 (Hotel GET-only find/200, Flight full fill via
  `completeSelfHealedFormTask`) and `scripts/walkthrough/public.ts:658`
  (`J10 DEC-108 invite-visibility gate`). Per DEC-116 the split-file
  layout (invite-visibility in `public.ts`, form-task self-heal in
  `speaker.ts`) is authoritative, not a deviation defect.

`npm run build`: PASS (dual `tsc --noEmit` + `vite build`, 125
modules / 17 chunks, clean). Focused suite: `npx vitest run
test/pubcache.test.ts test/submission-seq.test.ts
test/contacts-repo.test.ts test/chunk-sweep-overview.test.ts
test/public-invite-visibility.test.ts test/portal-edit-file-field.test.ts
test/form-render-rules.test.ts test/acceptance-form-tasks.test.ts` — 8
files / 57 tests, all PASS.

No genuine spec gaps found in the swept areas (§8 authz/security,
§9 non-functional chunking/caching, J1/J10/J12 job coverage for the
cited DEC ranges).
