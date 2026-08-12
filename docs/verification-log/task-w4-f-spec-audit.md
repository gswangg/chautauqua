# 2026-08-10 task-w4-f — spec-audit @ d8d1cbd

Full detail for the `## 2026-08-10 task-w4-f — spec-audit @ d8d1cbd` section
of `docs/verification-log.md` (extracted per the contention-decomposition of
that file; see the stub entry there for `OPEN ITEMS` / `RESULT` summary).

DEC-069/DEC-163 static spec-audit gate lane. Worktree cut from `main`
tip `f357477` ("scribe wave 4").

**Frozen sha derivation.** `git log --first-parent --oneline` from
`main` tip: `f357477` ("scribe wave 4") touches only `decisions/`,
`field-guide/index.md`, and a bare-constant-append diff in
`src/decisions.ts` — bookkeeping-only per DEC-114. The prior
first-parent commit, `d8d1cbd` ("merge task-w3-c"), touches
`app/src/lib/api.ts`, `app/src/pages/content/*`, `src/domain/files.ts`,
`src/lib/zip.ts`, `src/routes/files.ts`, `src/server/repo/files.ts`,
and three test files — code-bearing. `d8d1cbd` is therefore the
frozen battery sha per DEC-163. `git merge-base --is-ancestor 2dd2f33
d8d1cbd` exits 0 — descends from `2dd2f33` (DEC-129).

**Method.** Read every file directly via `git show d8d1cbd:<path>`
(not the mutable worktree, to avoid drift). Ran `npm run build` and
`npm test --silent` against the tree checked out at `d8d1cbd` as a
sanity floor before the static review (both green: build clean,
151/151 test files, 1308/1308 tests passed), then restored the
worktree to `main` tip with `git reset --hard HEAD` before writing
this log entry — no other file touched.

**§8/§9 route surface + DEC-012/013 audit:**
- `src/index.ts` is the sole sub-app mount point; every route module
  (`pipelineRoutes`, `fileApiRoutes`, `fileServeRoutes`, etc.) is
  imported and `app.route(...)`'d only there. No other file calls
  `.route(` on a Hono sub-app instance. DEC-012 marker present.
- List envelopes (`{items,total,page,perPage}`) and error envelope
  (`{error:{code,message,fields?}}` via the shared `ApiError` class)
  used consistently across the audited surface — `GET /api/v1/pipeline`
  (`src/routes/api/pipeline.ts:65-68`), `GET
  /api/v1/events/:eventId/files` (`src/routes/files.ts:~185`), `GET
  /api/v1/submissions/:id/revisions` (`src/routes/api/submissions.ts:
  ~193-201`). DEC-013 marker present.

**Newest surface — `/api/v1/pipeline` (DEC-157, CRM-07/08):**
`src/routes/api/pipeline.ts` mounts `requireOrganizer` on `/pipeline`
and `/pipeline/*` (lines 16-17); every mutating route
(`POST /pipeline`, `PATCH /pipeline/:id`, `POST
/pipeline/:id/notes`) carries `csrfJson`; every `:id` lookup goes
through `requireOwnedEntry` -> `repo.findEntryForOrg(db, id, orgId)`,
scoping by `orgId` (no IDOR). `src/server/repo/pipeline.ts:12` fixes
`PIPELINE_STAGES = ["identified","contacted","interested","confirmed",
"declined"]` — exactly five stages, validated via `isPipelineStage` on
every write. Moves and notes are both persisted as
`pipeline_activity` rows (`kind: "move"|"note"`) rather than mutating
history away — `repo.moveEntry`/`repo.addNote` (referenced from the
route file) both append via the same activity table. The route-file
header comment and `src/server/repo/pipeline.ts`'s header both assert
"never imports a mailer" — grep of the two files' import lists (and
of `src/server/repo/pipeline.ts` in full) confirms no `mail` import
anywhere in the module. Zero deviations found.

**Newest surface — submission revisions (DEC-158, CNT-11):**
`src/server/repo/revisions.ts` provides `appendSubmissionRevision`/
`listRevisions`/`getRevision`, called from two write paths:
`PATCH /api/v1/submissions/:id` (`src/routes/api/submissions.ts:
~178-186`, organizer-only + csrfJson + org-ownership check) and the
portal-edit locked-field sync (`src/server/repo/portal-edit.ts:
~174-227`, the CNT-11 comment block). Both snapshot pre-edit state via
`getSubmissionContent`, apply the update through
`updateSubmissionFields`, and only append a revision row if
title/description actually changed. `POST /api/v1/submissions/:id/
revisions/:revisionId/restore` (`src/routes/api/submissions.ts:
~204-241`) is organizer-only + csrfJson, resolves the revision scoped
to `submissionId` via `getRevision` (no IDOR — `getRevision` filters
by both `id` and `submissionId`), and calls the *same*
`updateSubmissionFields` path as the PATCH handler, appending its own
history row attributed to the restorer. No email import anywhere in
`src/server/repo/revisions.ts` or the submissions route file's
revision handlers. `migrations/0013_submission_revision.sql` is a
pure `CREATE TABLE`/`CREATE INDEX` pair — append-only per DEC-015.
Zero deviations found.

**Newest surface — files library + archive (DEC-159/DEC-160):**
`GET /api/v1/events/:eventId/files` (`src/routes/files.ts:~181-190`)
is `requireOrganizer`, scopes via `getEventFilesScope` +
`scope.orgId !== auth.orgId` check, returns the standard list
envelope. `POST /api/v1/events/:eventId/files/archive`
(`src/routes/files.ts:~195-232`) is `requireOrganizer` + `csrfJson`,
same org-ownership check, validates `fileIds` is a non-empty string
array capped at `MAX_ARCHIVE_FILES = 50` (`src/routes/files.ts:194`)
— exactly the `<=50` budget from §9/DEC-160. `resolveLatestVersions`
loudly 404s on any unknown/non-deliverable id (no silent skip, per
the inline comment and house fail-loud invariant). ZIP is built via
`buildZip` from `src/lib/zip.ts`, which lives in the pure-core `lib/`
directory (DEC-002) — confirmed by grep: zero `from "node:` / `from
"cloudflare:` imports across every file in `src/{auth,domain,forms,
mail,lib}` at this sha. Entry names are grouped
`${seq}-${slugifyTitle(title)}/${filename}` — one folder per
submission, matching "folder-per-session" (field guide Wave 3). Zero
deviations found.

**Pure-core boundary (DEC-002), full sweep at this sha:** grepped
every file under `src/auth`, `src/domain`, `src/forms`, `src/mail`,
`src/lib` for `from "node:` / `from "cloudflare:` — zero matches.

**Status-change/email invariant:** no content-status, pipeline-stage,
or revision-restore handler audited above imports or calls a mailer.

OPEN ITEMS: 0

RESULT: PASS
