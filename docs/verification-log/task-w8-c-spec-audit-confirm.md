# 2026-08-10 task-w8-c — spec-audit confirm @ d12eb25

Full detail for the `## 2026-08-10 task-w8-c — spec-audit confirm @ d12eb25` section
of `docs/verification-log.md` (extracted per the contention-decomposition of
that file; see the stub entry there for `OPEN ITEMS` / `RESULT` summary).

Verify-or-run (DEC-103): found an existing spec-audit section at the
expected sha (task-w7-d, above) ending `RESULT: PASS`. Spot-checked its
mandatory DEC-098..101 citations against the in-tree worktree (checked
out from `main` tip `8c19466`, code-bearing sha still `d12eb25` per
DEC-091 — `git log --oneline` shows only bookkeeping/gate commits after
`d12eb25`): all four hold, with only minor line-number drift from the
cited ranges (no code drift):

- `src/routes/public/submit.tsx`: `ConfirmationState` three-state type
  at line 207, `ConfirmationPage` renders `props.claimUrl` only in the
  `fresh` branch (the trailing `else`) at ~line 225; `pending-existing-
  contact` and `has-account` branches both omit any claim URL.
- `src/server/pubcache.ts`: hit path (line 87) sets
  `Cache-Control: CLIENT_CACHE_CONTROL` (`"public, max-age=60,
  stale-while-revalidate=300"`, line 49) on the restored Response,
  while the stored copy keeps `CLIENT_CACHE_CONTROL_OVERRIDE`
  (`"public, max-age=86400"`, line 44) at line 94.
- `src/server/repo/submissions/seq.ts`: `submissionSeqSubquery` used at
  `repo/submit.ts:168` and `repo/submissions/create.ts:59,102`; grepped
  `src/server/repo/submissions` for `MAX(seq)` — only the subquery's own
  definition (line 10) and unrelated `.seq` sort/format usages in
  `list.ts`/`detail.ts` — no surviving SELECT-then-INSERT helper.
- `src/server/repo/contacts.ts`: `mergeContacts` order is dedupe-delete
  (participant rows shared across submissions, ~lines 500-511) then six
  FK repoints via `buildMergeRepointOps` (participant, task_assignment,
  email_log, user, file.uploaded_by_contact_id,
  file_comment.author_contact_id, ~lines 513-528) then
  `db.delete(schema.contact)` on `mergeId` (~line 535) — matches cited
  order exactly.

No code changes this task (DEC-077 code-frozen gate; commit touches
only `docs/verification-log.md`).

OPEN ITEMS: 0

RESULT: PASS
