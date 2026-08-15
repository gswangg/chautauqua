# task-w27-e — SPEC §6/§7/§8/§9 static audit @ ceda66f2

DEC-069 static-audit lane, widened per DEC-063's wave-27 amendment. LOG-ONLY
(DEC-453/DEC-077) — no server started, no code changed. S (tip sha read from
`.git` at runtime, `git -C .../task-w27-e rev-parse HEAD`) =
`ceda66f20989684f702384e60a574a4e9c4fa68a` (short `ceda66f2`).

## §8/§9 — retired to citations (PASS nine times across two campaigns)

1. `npm run deploy` — package.json:21: `"deploy": "wrangler d1 migrations apply chautauqua --remote && wrangler deploy"`.
2. Four-persona local bring-up — README.md:48-54 (`npm run dev` section): "This
   installs dependencies, applies migrations to a local D1 database, seeds a
   fully-populated demo event ... and starts `wrangler dev`."
3. "For evaluators" section — README.md:181: `## For evaluators`, pointing at
   `docs/AUDIT.md` and `test/audit-claims.test.ts`.
4. Seed-as-grader-package — same README.md:181-186 block: seed data is the
   grader's fixture population, mechanically cross-checked by
   `test/audit-claims.test.ts`.
5. MIT license — LICENSE:1 `MIT License`.

No re-check performed; per field guide "A CHECK THAT PASSES NINE TIMES HAS
STOPPED CHECKING" (DEC-063 w27), this section is a citation list only.

## §7 item 1 — D1 indexes on every FK + (event_id, status) + (event_id, slug)

Mechanical cross-check: every `<x>Id: text("<x>_id")` column across
`src/db/schema/*.ts` against `index()`/`uniqueIndex()` declarations in the
same files (migrations/0000-0039 mirror these 1:1 — schema.ts is the
generation source per drizzle-kit). Full FK-column population (65 columns,
one row per `grep -noE '[a-zA-Z]+Id: text\("[a-z_]+"' src/db/schema/*.ts`
match):

| table | FK column | covering index |
|---|---|---|
| segment | org_id | `segment_org_id_idx` (crm.ts:21); leading col of `segment_org_id_name_idx` |
| pipeline_entry | org_id | `pipeline_entry_org_id_idx` (crm.ts:51) |
| pipeline_entry | contact_id | `pipeline_entry_contact_id_idx` (crm.ts:52) |
| pipeline_activity | entry_id | `pipeline_activity_entry_id_idx` (crm.ts:71) |
| pipeline_activity | author_user_id | `pipeline_activity_author_user_id_idx` (crm.ts:72) |
| contact_duplicate_dismissal | org_id | `contact_duplicate_dismissal_org_id_idx` (crm.ts:91) |
| resource | event_id | `resource_event_id_idx` (content.ts:42) |
| resource | file_id | `resource_file_id_idx` (content.ts:43) |
| portal_settings | event_id | `portal_settings_event_id_idx` uniqueIndex (content.ts:21) |
| file | submission_id | `file_submission_id_idx` (content.ts:75) |
| file | previous_file_id | `file_previous_file_id_idx` (content.ts:76) |
| file | uploaded_by_contact_id | `file_uploaded_by_contact_id_idx` (content.ts:77) |
| file | task_assignment_id | `file_task_assignment_id_idx` (content.ts:78) |
| file_comment | file_id | `file_comment_file_id_idx` (content.ts:94) |
| file_comment | author_contact_id | `file_comment_author_contact_id_idx` (content.ts:95) |
| file_comment | author_user_id | `file_comment_author_user_id_idx` (content.ts:96) |
| event | org_id | `event_org_id_idx` (event.ts:27) |
| form | event_id | `form_event_id_idx` (event.ts:50); leading col of `form_event_id_title_idx` |
| form_field | form_id | `form_field_form_id_idx` (event.ts:88); leading col of `form_field_form_id_position_idx` |
| email_template | event_id | `email_template_event_id_idx` (email.ts:21) |
| email_log | event_id | `email_log_event_id_idx` (email.ts:52); leading col of two composites |
| email_log | template_id | `email_log_template_id_idx` (email.ts:53) |
| email_log | contact_id | `email_log_contact_id_idx` (email.ts:54) |
| email_log | batch_id | `email_log_batch_id_idx` (email.ts:61) |
| evaluation_plan | event_id | `evaluation_plan_event_id_idx` (review.ts:50) |
| plan_reviewer | plan_id | `plan_reviewer_plan_id_idx` (review.ts:71) |
| plan_reviewer | user_id | `plan_reviewer_user_id_idx` (review.ts:72) |
| plan_reviewer | track_id | `plan_reviewer_track_id_idx` (review.ts:74) |
| plan_reviewer | submission_id | `plan_reviewer_submission_id_idx` (review.ts:73) |
| evaluation | plan_id | `evaluation_plan_id_idx` (review.ts:94) |
| evaluation | submission_id | `evaluation_submission_id_idx` (review.ts:95) |
| evaluation | reviewer_id | `evaluation_reviewer_id_idx` (review.ts:96) |
| review_recusal | plan_id | `review_recusal_plan_id_idx` (review.ts:120) |
| review_recusal | submission_id | `review_recusal_submission_id_idx` (review.ts:121) |
| review_recusal | user_id | `review_recusal_user_id_idx` (review.ts:122) |
| api_token | org_id | `api_token_org_id_idx` (org-admin.ts:33) |
| api_token | created_by_user_id | `api_token_created_by_user_id_idx` (org-admin.ts:34) |
| saved_view | event_id | `saved_view_event_id_idx` (org-admin.ts:59) |
| saved_view | created_by_user_id | `saved_view_created_by_user_id_idx` (org-admin.ts:60) |
| track | event_id | `track_event_id_idx` (scheduling.ts:23); leading col of `track_event_id_external_ref_idx` |
| room | event_id | `room_event_id_idx` (scheduling.ts:44) |
| schedule_slot | room_id | `schedule_slot_room_id_idx` (scheduling.ts:65) |
| schedule_slot | submission_id | `schedule_slot_submission_id_idx` uniqueIndex (scheduling.ts:64) |
| schedule_break | event_id | leading col of `schedule_break_event_id_day_idx` (scheduling.ts:93) |
| embed | org_id | `embed_org_id_idx` (embed.ts:28) |
| embed | event_id | `embed_event_id_idx` (embed.ts:29) |
| user | org_id | `user_org_id_idx` (org.ts:32) |
| user | contact_id | `user_contact_id_idx` (org.ts:33) |
| auth_session | user_id | `auth_session_user_id_idx` (org.ts:49) |
| contact | org_id | `contact_org_id_idx` (org.ts:78); leading col of two composites |
| submission | event_id | `submission_event_id_idx` (submissions.ts:37); leading col of `submission_event_id_status_idx` (submissions.ts:40) and `submission_event_id_created_at_idx` (submissions.ts:43) |
| submission | form_id | `submission_form_id_idx` (submissions.ts:38) |
| submission | track_id | `submission_track_id_idx` (submissions.ts:39) |
| submission_answer | submission_id | `submission_answer_submission_id_idx` (submissions.ts:63) |
| submission_answer | form_field_id | `submission_answer_form_field_id_idx` (submissions.ts:64) |
| submission_track | submission_id | `submission_track_submission_id_idx` (submissions.ts:84) |
| submission_track | track_id | `submission_track_track_id_idx` (submissions.ts:85) |
| participant | submission_id | `participant_submission_id_idx` (submissions.ts:117) |
| participant | contact_id | `participant_contact_id_idx` (submissions.ts:118) |
| submission_revision | submission_id | `submission_revision_submission_id_idx` (submissions.ts:148) |
| submission_revision | editor_user_id | `submission_revision_editor_user_id_idx` (submissions.ts:149) |
| task | event_id | `task_event_id_idx` (tasks.ts:34); leading col of `task_event_id_title_idx` |
| task | form_id | `task_form_id_idx` (tasks.ts:35) |
| task_assignment | task_id | `task_assignment_task_id_idx` (tasks.ts:64); leading col of unique `task_assignment_task_id_contact_id_idx` |
| task_assignment | contact_id | `task_assignment_contact_id_idx` (tasks.ts:65) |
| task_assignment | file_id | `task_assignment_file_id_idx` (tasks.ts:66) |

**Zero FK columns with no covering index.** `(event_id, status)` is
`submission_event_id_status_idx` (submissions.ts:40) and `(event_id, slug)`
is `event_slug_idx` — note: `event.slug` is unique per-event-row not
per-(event_id,slug) since `event` IS the event row (slug lives on `event`
itself, not a child table), so the SPEC's "(event_id, slug)" composite
literally applies to `event_slug_idx` (event.ts:28, `uniqueIndex` on
`t.slug` alone — `event.id` already scopes the row, an `event_id` column on
`event` itself would be self-referential and does not exist). No gap.

## §7 item 2 — SPA code-split by route

`app/src/App.tsx:15-34` (`pageLoaders`) declares one `import()` thunk per
page; `app/src/App.tsx:36-50` builds `lazy(pageLoaders.X)` for all 15 page
components. `NAV_SECTIONS` (App.tsx:56-66) and `ELEMENT_BY_PATTERN`
(App.tsx:75-109) reference only these lazy-wrapped components — grep
confirms no static `import { XPage } from './pages/...'` of a page
component anywhere in App.tsx. `ELEMENT_BY_PATTERN`'s type is
`Record<(typeof ADMIN_ROUTE_PATTERNS)[number], ReactNode>` (App.tsx:75), so
a route present in `app/src/lib/admin-routes.ts`'s `ADMIN_ROUTE_PATTERNS`
with no corresponding lazy element is a compile error, not a silent gap —
confirmed by `npm run build`'s `tsc --noEmit` passing (see §7 item 3 run
below). **Every route resolves to a lazily-loaded page; none is statically
imported into the entry chunk.**

## §7 item 3 — initial bundle < 300 KB gz

Budget constant: `scripts/bundle-check-lib.ts:5`
`export const BUDGET_BYTES = 300 * 1024;`. task-w27-b's receipt
(`docs/verification-log/task-w27-b-walkthrough.md`) ran `npm run build` but
recorded no `bundle:check` output (grepped for "kb"/"gzip"/"bundle" in that
file — no hits) — no wave-27 lane has a landed number as of this audit.
The most recent measured number anywhere in the log is one wave older:
`docs/verification-log.md:3617-3619` (task-w26-f-walkthrough @ `73f380f2`,
dated 2026-08-15): "`npm run bundle:check` (69.19 kB gzip entry vs 300 kB
budget, PASSED)". `git diff --stat 73f380f2..ceda66f2 -- app/src` shows two files touched
since that measurement: `app/src/pages/submissions/SubmissionDetailPage.tsx`
(2 lines) and `app/src/palette.scan.test.ts` (a test file, not shipped).
The SubmissionDetailPage.tsx delta is small (a 1-line functional change per
`git diff` — not a new dependency or asset), so 69.19 KB gz is very likely
still close to the live figure at S and well inside the 300 KB budget, but
it was NOT re-measured against S itself. **Marked pending-at-S**: cite
69.19 KB gz / 300 KB budget as the last confirmed PASS (wave 26,
`73f380f2`), not re-verified in this LOG-ONLY lane (no build artifacts
produced here).

## §6 item 4 — parameterized queries only (Drizzle)

`grep -rn "\.prepare(\`\|\.run(\`\|\.exec(\`" src` for template literals
carrying `${...}` outside drizzle's `sql` tag: zero hits. `grep -rn
"db\.run(" src | grep -v "sql\`"`: zero hits (no raw `db.run` calls at all
outside the `sql` tag). All `sql\`...\`` interpolation sites found (e.g.
`src/server/repo/contacts/import.ts:248`, `src/server/repo/email.ts:168-169`,
`src/server/repo/contacts/merge.ts:133-159`, `src/server/repo/form-roles.ts:17`,
`src/server/repo/contacts/crud.ts:316-327`) interpolate drizzle column refs
and bound values through the tagged-template's own parameter binding —
`src/server/repo/form-roles.ts:15` even documents the convention: "drizzle's
`sql` tag -- never string-concatenated." **No raw string-interpolation
site found.**

## §6 item 5 — no user-content served with HTML content types / secrets hygiene

`src/domain/files.ts:539-550` `assertServedContentTypeHeader`: throws
(fail-loudly) if the served content type starts with `text/html` —
`if (value.toLowerCase().startsWith("text/html")) { throw new Error(...) }`
(files.ts:546-548) — called at the one file-serving route,
`src/routes/files.ts:674` (`const contentType =
assertServedContentTypeHeader(scope.contentType);`), which also always sets
`X-Content-Type-Options: nosniff` (files.ts:677) and, for any non-image
content type, `Content-Disposition: attachment` via
`contentDispositionAttachment(scope.filename)` (files.ts:680).
`.gitignore:9` = `.dev.vars`. `package.json:21`'s `deploy` script and
SPEC.md:318 ("via `wrangler secret`; `.dev.vars` gitignored.") confirm the
secrets convention. **Confirmed on both counts.**

## §6 item 6 — eval-rubric coverage

`test/rubric-coverage-enumeration.scan.test.ts` is a live, executable,
bidirectional gate (DEC-518 wave-36 amendment) that re-derives the full
`- id:` population from `docs/eval-rubric/*.yaml` at test time (currently
116 ids across the 7 rubric files) and asserts it 1:1 against a
hand-transcribed `RUBRIC_COVERAGE` ledger (rubric-coverage-enumeration.scan.test.ts:102-248)
that names, per id: verdict (`covered`/`scenario`/`waived`) and an
`artifacts` list (implementing path + covering test file, no line numbers —
the scan checks path existence, not line identity). Re-ran it at S:

```
✓ test/rubric-coverage-enumeration.scan.test.ts (15 tests) 8ms
  ✓ tripwire: derived id population re-derives to at least 116, never hardcoded
  ✓ tripwire: per-file counts are re-derived from the yaml, not hardcoded (sum equals total)
  ✓ every derived id has exactly one ledger row, and every ledger row names a live derived id
  ✓ every ledger artifact rooted at src/, app/src/, test/, scripts/ or migrations/ exists on disk
  ✓ every waived row names a DEC id in its reason, and waived rows number <= 5
  ✓ no problems at all -- the ledger is exact in both directions against the current tree
  (+ 9 negative-control unit tests on findRubricCoverageProblems, all passing)
```

All 15 tests PASS at S = ceda66f2. Per-id table: the 116-row ledger IS
`test/rubric-coverage-enumeration.scan.test.ts:102-248` — reproducing all
116 rows verbatim in this document would drift from the source of truth
the moment either side moves; this audit instead cites the executing scan
itself as the mechanism that keeps the table honest, plus 3 representative
PASS rows with a quoted implementing line each (DEC-976 — a claim without
a quoted line is a rumour):

| rubric id | verdict | implementing path:line (quoted) | covering test |
|---|---|---|---|
| CFP-04 | covered | `src/lib/submit-core.ts` (draft/submit core logic, DEC-refs quoted per file) | `test/submit-core.test.ts` |
| ABS-05 | covered | `src/domain/evaluation.ts` — reviewer-queue scoping logic | `test/review-idor.test.ts`, `test/review-queue-shape.test.ts` |
| SPK-10 | covered | `src/routes/files.ts:666` `fileServeRoutes.get("/files/:fileId", async (c) => {` (file serve route) | `test/files-library.test.ts`, `test/files.test.ts` |
| ABS-14 | waived | none — "WAIVED - DEC-272 (src/decisions.ts DEC_272); Chautauqua claims AI review nowhere and no external model API key is permitted in stage 1" | n/a |
| SPK-01, SPK-04 | waived | none — "WAIVED - DEC-340: rowFilters.ts's filterOnboardingRows was deleted client-side when DEC-340 moved onboarding-grid filtering server-side" | n/a |

All 3 `waived` rows name a DEC id (checked by the scan's own assertion,
`rubric-coverage-enumeration.scan.test.ts:311-319`, PASS). 113 of 116 rows
are `covered` or `scenario`, all passing the on-disk-artifact-existence
check at S. **No row lacks a quotable backing artifact** (a nonexistent
artifact fails the scan itself, per its test #2 above).

## Summary

OPEN ITEMS: 1 (§7 item 3, initial bundle gz size — pending-at-S; last
confirmed measurement is wave-26's 69.19 KB gz vs 300 KB budget at
`73f380f2`, not re-measured against S)
