## 2026-08-12 task-w21-b — list-envelope enumeration artifact (DEC-473)

Log-only lane (DEC-473/DEC-472/DEC-466/DEC-459/DEC-453): no source file changed. Produces the
re-runnable enumeration artifact DEC-473 requires — a mechanical `rg` command over
`src/routes/**/*.ts` for `c.json(` calls whose object literal contains an `items` key (multiline
so wrapped forms like `tokens.ts`/`crud.ts`/`submissions.ts`/`bulk-email.ts` are caught), one row
per unique site in exactly four fixed classes (BOUNDED-IN-SQL / BOUNDED-IN-JS / CAPPED-ECHO /
UNBOUNDED, citing the specific repo function + limit/offset or cap constant for each), and a live
probe against the `npm run perf:seed` 2k-submission/5k-email-log/800-file/831-contact/803-pipeline
fixture logged in as the seeded organizer and a perf-seeded (unrecused) reviewer. Full table is in
`docs/verification-log/task-w21-b-list-envelope-enumeration-stage1.md`.

Sha derived fresh in this task's own worktree (per DEC-448, never copied from a prior log):
`bf56ba715a36bcde8bbdb9e01edf7b573c38b0de`. The enumeration command returns 34 raw lines / 30
unique sites (4 are two-line wrapped matches). 27 of 30 are correctly bounded — either a real SQL
`LIMIT`/`OFFSET` with a sibling count function, a DEC-461(e)-blessed JS slice reporting the
pre-slice array length as `total`, or a named recipient cap (`MAX_COMPOSE_RECIPIENTS=100`,
`MAX_BULK_EMAIL_RECIPIENTS=100`, `BULK_EMAIL_PREVIEW_LIMIT=5`) on a mutation echo — and, where
live-probed, all report a true `total` at seeded scale (e.g. `/api/v1/pipeline` returns exactly
200 of 803 with `perPage` absent, matching DEC-465's `listPerPage` default; `/api/v1/review/plans/
:id/queue` returns exactly 200 of a 1,500-item queue). 3 rows remain genuinely unbounded: two
(`src/routes/files.ts:166` `GET /api/v1/submissions/:id/files`, `:309`
`GET /api/v1/files/:fileId/comments` — both ship bare `{items}`, exactly DEC-471's finding) have a
fix in flight on `task-w21-a`, confirmed by content (commit `d5e549f`, touching exactly
`src/routes/files.ts` + `src/server/repo/files-{comments,versions}.ts` +
`test/files-list-bounds.test.ts`) but `git merge-base --is-ancestor d5e549f <this sha>` is
**false** — the branch's local ref had already been deleted (merged elsewhere in the parent repo
concurrently with this task) by the time this was checked, so the fix's presence was verified by
locating its merge commit by diff content rather than by branch name, and it is correctly *not*
credited to this sha per DEC-472. The third (`src/routes/api/forms.ts:259`,
`POST /api/v1/forms/:formId/fields/reorder`, echoing an uncapped `repo.listFields` with no
`MAX_FIELDS`-style ceiling anywhere in the field-create path) is a new finding this pass — not
named in any prior DEC or field-guide entry, and no branch among `task-w20-a`/`task-w20-b`/
`task-w21-a` touches the file.

7 of the 30 rows (2 mail-sending mutations deliberately not fired live to avoid polluting shared
`email_log`/dev-mailbox state for concurrent lanes, the closed-plan queue branch, the bulk-email
preview cap, the fields-reorder mutation, and one comments/one submission-files GET whose sampled
records happened to have zero seeded rows to page through) are marked UNPROBED and rest on source
citation only — none are silently counted as PASS.

Process note, not a product finding: this worktree's directory and branch both briefly vanished
mid-task (same class of out-of-band worktree churn task-w17-f hit) and were recreated fresh off
`main`; separately, the parent repo's actual `main` was observed to have advanced multiple whole
waves (round-tags into the high 20s) while this single log-only task was still in flight, which is
how `task-w21-a`'s branch ref ended up already deleted by the time this artifact checked its
ancestry.

OPEN ITEMS: 3 (2 PENDING-OWNED(task-w21-a): `src/routes/files.ts:166,309`; 1 FAIL-unowned:
`src/routes/api/forms.ts:259`)

RESULT: FAIL — 27 of 30 list-envelope sites under `src/routes` are correctly bounded and, where
live-probed against the 2k-scale perf seed, report a true `total`; 3 are UNBOUNDED at this sha (2
PENDING-OWNED on `task-w21-a`, not credited here per DEC-472; 1 newly-found and unowned). Per
DEC-453 this PASS/FAIL is evidence about sha `bf56ba715a36bcde8bbdb9e01edf7b573c38b0de` only.

