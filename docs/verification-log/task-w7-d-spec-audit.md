# task-w7-d — spec-audit gate detail

SPEC §8/§9 static audit, code-frozen per DEC-077 (log-only lane), fresh
worktree of `main`. Newest code-bearing short-sha per DEC-091: `d12eb25`
("merge task-w6-d"). `main`'s actual tip at branch time was `9e7ac53`
("scribe wave 7"), but `git diff d12eb25..9e7ac53 -- . ':!docs'
':!decisions' ':!field-guide'` shows only a one-line whitespace tweak plus
a DEC-102 append in `src/decisions.ts` (a compile-checked constant string,
not a functional change) between `d12eb25` and the tip — so `d12eb25`
remains the newest code-bearing sha, matching the field guide's expected
value exactly.

## Delta scope (`git diff 3d1e838..HEAD`, mirroring task-w5-e)

Code-bearing commits between the prior audited sha (`3d1e838`, task-w5-e)
and `d12eb25` are exactly the four task-w6-* fix lanes named in this
task's brief:

- `baae2be` "Fix pubcache hit path leaking internal 86400 Cache-Control
  (DEC-099)" → merged at `6a209c1` "merge task-w5-e" (this merge commit's
  diff is the spec-audit doc from the previous lane, non-code-bearing;
  the code fix itself is `baae2be`, folded into wave-6's `771e06c` "merge
  task-w6-b").
- `37feeac` "Close contact-takeover hole in public submit confirmation
  (DEC-098)" → merged at `347df55` "merge task-w6-c".
- `dbd0007` "DEC-100: atomic submission seq allocation via SQL fragment"
  and `4386519` "Contact merge: repoint file/file_comment FKs, dedupe
  shared-submission participants (DEC-101)" → merged at `de8d492` "merge
  task-w6-e" and `d12eb25` "merge task-w6-d" respectively.
- `adf5a24` "merge task-w5-c-walkthrough-recovered" — a walkthrough gate
  re-run merge (log-only), non-code-bearing.

`git diff d12eb25..HEAD -- . ':!docs' ':!decisions' ':!field-guide'`
confirms no other product/test/script/config file changed after
`d12eb25`; only `src/decisions.ts`'s DEC-102 append and bookkeeping
(`docs/verification-log*`, `decisions/DEC-102.md`,
`docs/eval-findings.md`, `field-guide/index.md`) land afterward, matching
DEC-102's own description ("barrier vacuous, four gates parallel").

`git diff 3d1e838..d12eb25 --stat -- . ':!docs' ':!decisions'
':!field-guide'` (12 files, 541/52 +/-) touches exactly: `src/decisions.ts`,
`src/routes/public/submit.tsx`, `src/server/pubcache.ts`,
`src/server/repo/contacts.ts`, `src/server/repo/submissions/create.ts`,
`src/server/repo/submissions/seq.ts` (new), `src/server/repo/submit.ts`,
and their five new/extended test files — exactly the four fixes, no
incidental changes.

## Fix conformance

1. **DEC-098** (`src/routes/public/submit.tsx`): a `ConfirmationState`
   union (`"fresh" | "pending-existing-contact" | "has-account"`,
   submit.tsx:207) drives `ConfirmationPage` (submit.tsx:209-231). The
   claim-URL anchor renders only in the `else` branch (`state !==
   "has-account" && state !== "pending-existing-contact"`, i.e.
   `"fresh"`, submit.tsx:226-229); `"pending-existing-contact"` renders
   copy that says a password-setup link was emailed plus a `/login`
   fallback, no claim URL in the markup (submit.tsx:220-224). At the call
   site (submit.tsx:497-539), `claimToken`/`claimUrl` are minted via
   `createClaimToken` and included in the emailed text/html
   (submit.tsx:498-522) whenever `!existingUser`, regardless of
   `contactIsFresh` — the email always carries the link; only the
   on-screen `confirmationState` (submit.tsx:535-539) gates whether that
   same URL also appears in the HTML response. Conforms.

2. **DEC-099** (`src/server/pubcache.ts`): `export const
   CLIENT_CACHE_CONTROL = "public, max-age=60,
   stale-while-revalidate=300"` (pubcache.ts:47), byte-identical to
   `setCacheHeaders`'s literal in `src/routes/public.tsx:61`
   (`c.header("Cache-Control", "public, max-age=60,
   stale-while-revalidate=300")`). On a cache hit, `servePublicGet`
   rebuilds a fresh `Response` and overwrites `Cache-Control` to
   `CLIENT_CACHE_CONTROL` before returning (pubcache.ts:92-95), while the
   stored copy is written with `CLIENT_CACHE_CONTROL_OVERRIDE =
   "public, max-age=86400"` (pubcache.ts:46, applied at pubcache.ts:104).
   Conforms.

3. **DEC-100** (`src/server/repo/submissions/seq.ts`): `submissionSeqSubquery`
   builds `(SELECT COALESCE(MAX(seq), 0) + 1 FROM submission WHERE
   event_id = ?)` (seq.ts:13-16) and is imported/used at all three insert
   sites: `src/server/repo/submit.ts:168` (`createSubmission`),
   `src/server/repo/submissions/create.ts:59` (`createSubmission`) and
   `:102` (`cloneSubmission`). `grep -rn "nextSubmissionSeq\|nextSeq"
   src/ test/` finds only `src/lib/submit-core.ts:71`'s unrelated
   `nextSeqRef` (a DEC-003 display-ref formatter, pre-existing, not the
   removed SELECT-then-INSERT allocator) plus its own test and a
   `claim-onscreen-scope.test.ts` comment referencing the old name
   historically. No compat shim; the old helper is gone repo-wide.
   Conforms.

4. **DEC-101** (`src/server/repo/contacts.ts`): `buildMergeRepointOps`
   maps over `["participant", "task_assignment", "email_log", "user",
   "file", "file_comment"]` (contacts.ts:179) — six ops, including
   `file` and `file_comment`. `mergeContacts` (contacts.ts:473-540)
   updates the kept contact row, then dedupe-deletes mergeId's
   participant rows on submissions the kept contact already participates
   in (contacts.ts:495-509), then applies the six `buildMergeRepointOps`
   repoints (contacts.ts:514-533, `file`→`uploadedByContactId`,
   `file_comment`→`authorContactId`), then deletes the merged contact row
   (contacts.ts:535). Order matches the load-bearing comment at
   contacts.ts:467-472 (dedupe-delete → six repoints → contact delete).
   Conforms.

## Other §8/§9 re-checks

- `README.md:19-22` quickstart (`npm i`, `db:migrate`, `seed`, `dev`)
  still matches `SPEC.md:361` verbatim.
- `README.md`'s "For evaluators" persona table (organizer/speaker/
  speaker2/reviewer emails+passwords) still matches
  `docs/fixtures/sample-data.json`'s `identities` block byte-for-byte.
- `.github/workflows/ci.yml`: `build-and-test` job still runs `npm run
  build` (line 22), `npm run bundle:check` (line 23), `npm test` (line
  24); `perf-smoke` job still runs `npm run perf:smoke` (line 52);
  `walkthrough` job still runs `npm run walkthrough` (line 82).
  Unchanged since task-w5-e.
- SPEC §9 invariant regression tests still present and green:
  `test/edit-lock.test.ts`, `test/submit-core.test.ts`,
  `test/task-file-access.test.ts`, `test/headshot-gate.test.ts`,
  `test/spec9-invariants.test.ts`.
- Regression tests for the four wave-6 fixes are present: `test/
  pubcache.test.ts` (`CLIENT_CACHE_CONTROL` hit-path assertion at line
  113, "DEC-099: a hit is re-served with the client-facing
  Cache-Control..."), `test/claim-onscreen-scope.test.ts` (195 lines,
  DEC-098 confirmation-state coverage across all three states),
  `test/submission-seq.test.ts` (DEC-100 atomic-subquery coverage),
  `test/contacts-repo.test.ts` (extended +125 lines, DEC-101 six-op
  repoint + dedupe coverage).

## Build + test

`npm run build`: PASS (tsc x2 + vite build, no errors).

`npm test --silent`: ALL PASS — 96 test files, 984 tests, 0 failures (up
from task-w5-e's 94 files / 976 tests: +2 files / +8 tests from the
DEC-098/100/101 fix commits' new test files
(`test/claim-onscreen-scope.test.ts`, `test/submission-seq.test.ts`) and
extended `test/contacts-repo.test.ts`/`test/pubcache.test.ts`/
`test/api-submissions.test.ts`; no regressions).

No product/test/script/config changes made in this lane (DEC-077
code-frozen gate); this commit touches only `docs/verification-log.md`
and this file.

OPEN ITEMS: 0

RESULT: PASS
