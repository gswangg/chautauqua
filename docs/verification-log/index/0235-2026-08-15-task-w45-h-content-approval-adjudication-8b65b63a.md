## 2026-08-15 task-w45-h — content-approval adjudication @ 8b65b63a

QUALIFYING (advisory to the DEC-069 predicate — this scope classifies to none of the five slots)

INVALIDATED BY: src/** app/src/** migrations/** package.json

`npm run ref-state` receipt (verbatim): DEC-644 three-sha boundary: HEAD
`8b65b63ace26b79e23a2d19dd5b8d91a3eca9ed2`; newest first-parent
product-code-bearing sha `14da2921a5be66408057712be877bc44c19de6c4`; every
live ref (`main`, `manual-qa`, `task-custodian-w68-4`, `task-w44-e`,
`task-w44-h`, `task-w44-i`, `task-w45-a`, `task-w45-e`, `task-w45-h`,
`task-w68-d`, `task-w71-c`, `task-w71-d`, `task-w71-e`) confirmed an
ancestor of HEAD via `git merge-base --is-ancestor`. NON-ancestor refs
(NOT confirmed via `git merge-base --is-ancestor`): `mail-rich-shape-fallback`,
`task-w17-i`, `task-w45-b`, `task-w45-c`, `task-w45-d`, `task-w68-b`,
`task-w68-c`, `task-w68-e`, `task-w71-a`, `task-w72-a`, `task-w72-b`,
`task-w72-c`, `task-w72-d`, `task-w72-e`, `task-w72-f`, `task-w72-g`,
`task-w72-h`, `task-w72-i`, `task-w72-j`. `git merge --no-edit main`
reported "Already up to date."

| # | Claim | Verdict | Evidence |
|---|-------|---------|----------|
| 1 | Every public read door gates unapproved content in SQL, not JS | NO DEFECT | Every enumerated door routes through a gated repo query, in the SQL `where`, never a JS post-filter: `src/server/repo/public/sessions.ts:167,264` (`visibleSessionConditions()` + per-participant `visibleParticipantConditions()` at :178 etc.) for list; `src/server/repo/public/detail.ts:117,215` for detail/speaker-drill-in; `src/server/repo/public/speakers.ts:50` (`visibleSubmissionConditions()`) for the speakers/gallery surface (`src/routes/public/speakers.tsx` is a pure render component with no query of its own — data arrives already gated via `getPublicSpeakers`, called from `src/routes/public/index.tsx:497` and `src/routes/public/dispatch.tsx:140,171`); `src/server/repo/public/agenda.ts:56,206,247` for agenda; `src/server/repo/public/counts.ts:42,59` for counts; saved embeds (`src/routes/public/saved-embed.tsx:52-90`) never issue their own query, they redirect to or render through the already-gated feed/dispatch routes (`renderSurfaceContent`, `./dispatch`); feeds/.ics (`src/routes/public/index.tsx:365-398,409-424`) call `getPublicAgenda`/`getPublicAgendaByIds` (agenda.ts, gated) and `feeds.ts` is a pure mapper with no db access; embed cards (`src/routes/public/cards.tsx`) is likewise a pure render template consuming already-gated `PublicSession` rows, no query. Gate source: `src/server/repo/public/gates.ts:25-56` (`visibleSessionConditions`/`visibleParticipantConditions`/`visibleSubmissionConditions`), all composed with Drizzle `and(...)` inside each caller's `.where(...)`. |
| 2 | Version numbers are minted atomically | CONFIRMED-DEFECT | `src/server/repo/files-versions.ts:477-511` (`insertFile`) is a plain read-then-write: SELECT `schema.file.versionNo` for `previousFileId` (:483-487), compute `versionNo = pred.versionNo + 1` in JS (:492), then a separate `db.insert` (:495-509) — two statements, no transaction wrapper visible at this call site. `src/db/schema/content.ts:47-80` defines only non-unique btree indexes on `file` (`file_submission_id_idx`, `file_previous_file_id_idx`, `file_uploaded_by_contact_id_idx`, `file_task_assignment_id_idx`) — no `uniqueIndex` on `(previous_file_id)` or `(submission_id, kind, version_no)` that would make two concurrent re-uploads both minting version N impossible. Per house rule (MINTING IS IO; atomic SQL beats read-then-write; uniqueIndex is a CONTRACT), this is read-then-write with no unique-index backstop. |
| 3 | Upload UI accepted-types/size-caps and server enforcement share one constant, no drift | NO DEFECT | Both sides read `src/domain/files.ts`. Client: `allowedUploadExtensions()` drives the `accept` attribute at `src/views/form-render.tsx:124`, `src/routes/portal/tasks/views.tsx:277,308`, and `HEADSHOT_EXTENSIONS` at `src/routes/portal/profile.tsx:179`; help text is built by `uploadHintText`/similar callers of the same file's `DOCUMENT_MAX_BYTES`/`IMAGE_MAX_BYTES`/`VIDEO_MAX_BYTES`/`HEADSHOT_MAX_BYTES` constants (`src/domain/files.ts:67-96,466`). Server: `validateUpload` (same file, :113 onward, enforcing `sizeBytes > DOCUMENT_MAX_BYTES` etc. at :206,218,230,251,273) is called directly from every upload route — `src/routes/api/portal-config.ts:225`, `src/routes/portal/tasks.tsx:406,557`, `src/routes/files.ts` (per DEC-020). One module, one set of constants, no duplicated literal found on either side (DEC-020's wave-67 amendment already closed a prior hand-typed-MB-number drift in this same file — this claim re-confirms it holds at this HEAD). |
| 4 | DEC-020 reopen consequence (raw upload demotes a published session to pending with no organizer action) | INTENDED — not a defect | Explicitly ruled at `decisions/DEC-020.md`, Amendment (wave 43): "Adjudicating the second content-lifecycle claim: ... RULING: DELIBERATE and ADEQUATELY DISCLOSED; no product change." The ruling cites SPEC J8 ("unapproved content never reaches public surfaces") and DEC-274's session gate as the reason the demotion itself is correct, and finds the disclosure requirement (wave-10/wave-58 amendments) already satisfied at both doors: organizer (`src/routes/files.ts:237,246-247`, `contentReviewReopened` on the 201) and speaker portal, twice (`src/routes/portal/tasks/views.tsx:188-195` `ReuploadReviewNotice` pre-upload; `src/routes/portal/tasks.tsx:629-630` post-upload receipt), with a plain-handout negative control (`deliverableKind` null renders nothing) covered by wave-43's own falsifying tests (`test/content-reopen-disclosure.test.ts`, `test/content-reupload-reopens.test.ts`, `test/portal-tasks.test.ts`). This adjudication re-reads the ruling and the current code (`src/server/repo/files-content-status.ts:105-117` `reopenContentReview`, `src/server/pubcache.ts:355-362,396-400` PUBLIC_AFFECTING classification) and finds it unchanged and self-consistent — no re-file. |

TARGETED TESTS (`npm run test:targeted`, 15 files): `test/files-repo.test.ts`
(16), `test/content-reupload-reopens.test.ts` (11), `test/content-reopen-
disclosure.test.ts` (4), `test/public-invite-visibility.test.ts` (10),
`test/public-cacheability-enumeration.test.ts` (5), `test/public-session-
gate.scan.test.ts` (4), `test/public-speakers-facet-parity.test.ts` (8),
`test/public-feeds.test.ts` (25), `test/public-gallery.test.ts` (6),
`test/participant-invite-audience.scan.test.ts` (4), `test/files-upload-
stream.test.ts` (1), `test/files-allowlist-prototype.test.ts` (26),
`test/content-status-single-writer.test.ts` (9), `test/files-
headshots.test.ts` (8), `test/public-embed-links.test.ts` (7). Result:
`Test Files  15 passed (15)` / `Tests  144 passed (144)`.

Full detail: `docs/verification-log/task-w45-h-content-approval-adjudication-8b65b63a.md`.

RESULT: PASS — 3 of 4 claims NO DEFECT / INTENDED, 1 CONFIRMED-DEFECT (claim 2, version-mint race)
OPEN ITEMS: 1
