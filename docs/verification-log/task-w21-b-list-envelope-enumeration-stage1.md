# task-w21-b — List-envelope enumeration artifact (DEC-473)

Log-only lane (touches no `src/`, `app/src/`, `scripts/`, `test/`, `migrations/`, `decisions/`, or
`package.json` file). This is the re-runnable enumeration artifact DEC-473 requires: a mechanical
command + raw output + one row per site in exactly four fixed classes + a live probe against the
2k perf seed, so task-w21-f's SPEC.md:353 row can cite it instead of prose.

## 0. sha

Derived directly in this worktree, not copied from any prior log:

```
$ git -C /Users/wednesdayniemeyer/Documents/gniemeyer/Projects/chautauqua-wt/task-w21-b rev-parse HEAD
bf56ba715a36bcde8bbdb9e01edf7b573c38b0de
```

This is `main`'s tip at the moment `task-w21-b`'s worktree was created ("scribe wave 21"). All
line numbers, repo-function citations, and probe results below are read at this exact sha.

**Process note (not a product finding):** partway through this task the shared
`chautauqua-wt/` directory briefly lost this worktree (and several sibling wave-21 worktrees) to
an out-of-band process — `ls` showed the directory gone, then `git worktree list` came back empty
of everything but `main`. No commits existed at the loss point, so nothing was lost; the worktree
was recreated fresh (`git worktree add ... task-w21-b`, branch had also been deleted so it was
recreated from `main`) and re-verified to be at the same sha above before continuing. Also
observed while investigating: the *actual* current `main` in the parent repo has since moved far
past wave 21 (`refs/heads/main` now resolves to a different commit than this artifact's sha, with
`round-22`..`round-28` tags visible) while this single task was in flight — i.e. real wall-clock
time elapsed here is much larger than "one task" suggests. This artifact is scoped to and valid
for the sha above only, per DEC-448 ("a PASS ledger is evidence about its own sha only").

## 1. Enumeration command

```
rg -n --multiline --pcre2 "c\.json\(\s*\{[^}]*\bitems\b" src/routes
```

Run from the repo root. `--multiline --pcre2` is required so the pattern's `[^}]*` can cross
newlines and catch call sites where `c.json({` opens on one line and `items:` appears on the next
(ripgrep's default single-line mode misses these entirely).

**Verification against the four cited wrapped/multi-line forms:** at this sha the four sites named
in the task prompt have drifted by a few lines from their originally-cited numbers (files were
edited since DEC-473 was written — e.g. `contacts/crud.ts` gained a `void DEC_466` line comment).
The *shapes* match exactly (all four are two-line `c.json({` / `items: ...,` pairs) — confirming
the command's multiline handling works — but the exact numbers at this sha are:

| Named in task prompt | Actual at this sha | Multi-line, in raw output? |
|---|---|---|
| `src/routes/api/tokens.ts:66` | `src/routes/api/tokens.ts:56-57` | yes |
| `src/routes/api/contacts/crud.ts:41` | `src/routes/api/contacts/crud.ts:44-45` | yes |
| `src/routes/api/submissions.ts:77` | `src/routes/api/submissions.ts:75-76` | yes |
| `src/routes/api/contacts/bulk-email.ts:189` | `src/routes/api/contacts/bulk-email.ts:189-190` | yes (exact match) |

All four appear in the raw output below (confirmed by inspection) — the command is correct; only
the prose's line numbers were stale for three of the four. No command fix was needed.

## 2. Raw output

```
$ rg -n --multiline --pcre2 "c\.json\(\s*\{[^}]*\bitems\b" src/routes
src/routes/files.ts:166:  return c.json({ items });
src/routes/files.ts:219:  return c.json({ items: result.items, total: result.total, page: result.page, perPage: result.perPage });
src/routes/files.ts:309:  return c.json({ items: comments });
src/routes/comms.ts:73:  return c.json({ items: items.map(serializeTemplate), total, page, perPage });
src/routes/comms.ts:383:  return c.json({ items });
src/routes/comms.ts:479:  return c.json({ sent: result.rendered.length - failed.length, failed, items: result.rendered });
src/routes/api/email-log.ts:48:  return c.json({ items, total, page, perPage });
src/routes/api/events.ts:198:  return c.json({ items, total, page, perPage });
src/routes/api/events.ts:339:  return c.json({ items, total, page, perPage });
src/routes/api/events.ts:422:  return c.json({ items, total, page, perPage });
src/routes/review/plans.ts:66:  return c.json({ items, total, page, perPage });
src/routes/review/plans.ts:247:  return c.json({ items, total, page, perPage });
src/routes/review/plans.ts:309:  return c.json({ items: pagedItems, total, page, perPage, round });
src/routes/review/plans.ts:353:  return c.json({ items, total: sortedRows.length, page, perPage, round });
src/routes/api/forms.ts:259:  return c.json({ items: reordered.map(toPublicField) });
src/routes/api/portal-config.ts:147:  return c.json({ items, total, page, perPage });
src/routes/api/tokens.ts:56:  return c.json({
src/routes/api/tokens.ts:57:    items: rows.map((r) => ({
src/routes/api/pipeline.ts:72:  return c.json({ items: items.map(serializeEntry), total, page, perPage });
src/routes/api/users.ts:59:  return c.json({ items, total, page, perPage });
src/routes/api/submissions.ts:75:  return c.json({
src/routes/api/submissions.ts:76:    items: result.items,
src/routes/api/submissions.ts:220:  return c.json({ items, total, page, perPage });
src/routes/api/views.ts:48:  return c.json({ items, total, page, perPage });
src/routes/api/contacts/segments.ts:103:    return c.json({ items: items.map(serializeSegment), total, page, perPage });
src/routes/api/contacts/bulk-email.ts:163:    return c.json({ sent: result.rendered.length - failed.length, failed, items: result.rendered });
src/routes/api/contacts/bulk-email.ts:189:    return c.json({
src/routes/api/contacts/bulk-email.ts:190:      items: result.rendered.map((r) => ({ contactId: r.contactId, email: r.email, subject: r.subject, bodyText: r.text })),
src/routes/api/contacts/crud.ts:44:    return c.json({
src/routes/api/contacts/crud.ts:45:      items: result.items.map(serializeContact),
src/routes/api/contacts/crud.ts:127:    return c.json({ items, total, page, perPage });
src/routes/review/reviewer.ts:63:  return c.json({ items: plans, total, page, perPage });
src/routes/review/reviewer.ts:74:    return c.json({ items: [], total: 0, page, perPage, open: false });
src/routes/review/reviewer.ts:138:  return c.json({ items: pagedItems, total, page, perPage, open: true, recused: recusedOut });
```

**Line count of raw output: 34** (4 sites are 2-line matches — `tokens.ts:56-57`,
`submissions.ts:75-76`, `bulk-email.ts:189-190`, `contacts/crud.ts:44-45` — the other 26 sites are
single-line matches), giving **30 unique `c.json({...items...})` call sites** under `src/routes`.
(Verified: `wc -l` on the same command reports 34.)

## 3. Per-site classification (one row per unique site, exactly one of four classes)

Class key: **SQL** = BOUNDED-IN-SQL, **JS** = BOUNDED-IN-JS, **ECHO** = CAPPED-ECHO, **UNB** =
UNBOUNDED.

| # | file:line | method + path | class | citation |
|---|---|---|---|---|
| 1 | `src/routes/files.ts:166` | GET `/api/v1/submissions/:id/files` | **UNB** | `listSubmissionFiles` (`src/server/repo/files-versions.ts:160`) has no `.limit()`/`.offset()`; route has no page/perPage params at all — bare `{items}`. |
| 2 | `src/routes/files.ts:219` | GET `/api/v1/events/:eventId/files` | SQL | `listEventDeliverableFiles` — `.limit(params.perPage)`/`.offset(offset)` at `src/server/repo/files-library.ts:154-155`; sibling count at `:134`. |
| 3 | `src/routes/files.ts:309` | GET `/api/v1/files/:fileId/comments` | **UNB** | `listFileComments` (`src/server/repo/files-comments.ts:23-33`) has no `.limit()`; route has no page/perPage params — bare `{items}`. |
| 4 | `src/routes/comms.ts:73` | GET `/api/v1/events/:eventId/templates` | SQL | `listTemplates`/`countTemplates`, `src/server/repo/comms.ts:44-56` (`.limit(page.limit).offset(page.offset)` at `:54`) and `:60-66`. |
| 5 | `src/routes/comms.ts:383` | POST `/api/v1/events/:eventId/compose/preview` | ECHO | `MAX_COMPOSE_RECIPIENTS = 100` at `src/domain/compose.ts:9`, enforced on `input.submissionIds` via `resolveComposeInput` → `src/routes/comms.ts:177` (`maxCount: MAX_COMPOSE_RECIPIENTS`); `requireFullMatch` (`:359`) guarantees the echoed set never exceeds the validated input. |
| 6 | `src/routes/comms.ts:479` | POST `/api/v1/events/:eventId/compose/send` | ECHO | Same `resolveComposeInput`/`MAX_COMPOSE_RECIPIENTS` path as row 5 (`src/routes/comms.ts:177`, `src/domain/compose.ts:9`). |
| 7 | `src/routes/api/email-log.ts:48` | GET `/api/v1/events/:eventId/email-log` | SQL | `listEmailLog`, `src/server/repo/email.ts:99-102` (`.limit(params.perPage).offset(...)`), count at `:104-110`. Note: route uses the legacy `clampPerPage` (default 50), not `listPerPage` — still SQL-bounded, just a different default/max than the DEC-465 sites. |
| 8 | `src/routes/api/events.ts:198` | GET `/api/v1/events` | SQL | `listEventsForOrg`/`listEventsForReviewer` + counts, `src/server/repo/events.ts:66,76,89,114`. |
| 9 | `src/routes/api/events.ts:339` | GET `/api/v1/events/:eventId/tracks` | SQL | `listTracksForEvent`/`countTracksForEvent`, `src/server/repo/events.ts:254,264`. |
| 10 | `src/routes/api/events.ts:422` | GET `/api/v1/events/:eventId/rooms` | SQL | `listRoomsForEvent`/`countRoomsForEvent`, `src/server/repo/events.ts:399,409`. |
| 11 | `src/routes/review/plans.ts:66` | GET `/api/v1/events/:eventId/plans` | SQL | `listPlansForEvent`/`countPlansForEvent`, `src/server/repo/review/plans.ts:84-95` (`.limit(page.limit).offset(page.offset)` at `:94`), `:100-105`. |
| 12 | `src/routes/review/plans.ts:247` | GET `/api/v1/plans/:id/reviewers` | SQL | `listReviewerRowsForPlan`/`countReviewerRowsForPlan`, `src/server/repo/review/reviewers.ts:31-43` (`.limit(page.limit).offset(page.offset)` at `:41`), `:46-50`. |
| 13 | `src/routes/review/plans.ts:309` | GET `/api/v1/plans/:id/progress` | JS | DEC-466/DEC-461(e) blessed slice: `const total = items.length` at `src/routes/review/plans.ts:306`, `items.slice(start, start + perPage)` at `:308` — `total` is the pre-slice length. |
| 14 | `src/routes/review/plans.ts:353` | GET `/api/v1/plans/:id/results` | JS | `const items = sortedRows.slice(start, start + perPage)` at `src/routes/review/plans.ts:352`, `total: sortedRows.length` (pre-slice) inline in the same return at `:353`. Note: this route still calls the legacy `clampPerPage` (`:349`), not `listPerPage` — it was not migrated when DEC-465 collapsed the other five copies; still correctly bounded, just on the old default (50) instead of DEC-465's default (200). |
| 15 | `src/routes/api/forms.ts:259` | POST `/api/v1/forms/:formId/fields/reorder` | **UNB** | Echoes `repo.reorderFields(...)` → `repo.listFields(formId)` (`src/server/repo/forms.ts:104-111`), which has no `.limit()`. No `MAX_FIELDS`-style cap exists anywhere in `src/routes/api/forms.ts` (checked the field-create handler at `:145-177`: no count-of-existing-fields check before insert). An org's own form's field count is organizer-authored, not adversarial input from an outside party, but DEC-459 forbids a "naturally small" exemption without an enumeration proving it — none exists here, so this is graded UNBOUNDED. No branch found that fixes it (searched `task-w20-*`/`task-w21-*` diffs reachable from this sha's ancestry — none touch `src/routes/api/forms.ts` or `src/server/repo/forms.ts`). **FAIL-unowned.** |
| 16 | `src/routes/api/portal-config.ts:147` | GET `/api/v1/events/:eventId/resources` | SQL | `listResourcesForEvent`/`countResourcesForEvent`, `src/server/repo/portal-config.ts:181-189,191-197`. |
| 17 | `src/routes/api/tokens.ts:56` | GET `/api/v1/tokens` | SQL | Inline in the route: `.limit(perPage).offset((page-1)*perPage)` at `src/routes/api/tokens.ts:46-47`, count query at `:51`. |
| 18 | `src/routes/api/pipeline.ts:72` | GET `/api/v1/pipeline` | SQL | `listPipelineForOrg`/`countPipelineForOrg`, `src/server/repo/pipeline.ts:146,135`. |
| 19 | `src/routes/api/users.ts:59` | GET `/api/v1/users` | SQL | `listOrgUsers`/`countOrgUsers`, `src/server/repo/users.ts:34-42,45-49`. |
| 20 | `src/routes/api/submissions.ts:75` | GET `/api/v1/events/:eventId/submissions` | SQL | `listSubmissions`, `src/server/repo/submissions/list.ts:56-...` (`.limit(...)` at `:113`, `.offset(...)` at `:114`), count at `:103`. |
| 21 | `src/routes/api/submissions.ts:220` | GET `/api/v1/submissions/:id/revisions` | SQL | `listRevisions`/`countRevisions`, `src/server/repo/revisions.ts:46-...` (`.limit(page.limit).offset(page.offset)` at `:65`), `:81-87`. |
| 22 | `src/routes/api/views.ts:48` | GET `/api/v1/events/:eventId/views` | SQL | `listSavedViews`/`countSavedViews`, `src/server/repo/views.ts:83-95,99-...`. |
| 23 | `src/routes/api/contacts/segments.ts:103` | GET `/api/v1/segments` | SQL | `listSegmentsForOrg`/`countSegmentsForOrg`, `src/server/repo/contacts/segments.ts:34-41,44-47`. |
| 24 | `src/routes/api/contacts/bulk-email.ts:163` | POST `/api/v1/contacts/bulk-email` | ECHO | `MAX_BULK_EMAIL_RECIPIENTS = 100` at `src/routes/api/contacts/bulk-email.ts:19`, enforced via `parseBoundedIdArray(body.contactIds, "contactIds", { maxCount: MAX_BULK_EMAIL_RECIPIENTS })` at `:54`. |
| 25 | `src/routes/api/contacts/bulk-email.ts:189` | POST `/api/v1/contacts/bulk-email/preview` | ECHO | `BULK_EMAIL_PREVIEW_LIMIT = 5` at `src/routes/api/contacts/bulk-email.ts:115`, applied as `contacts.slice(0, BULK_EMAIL_PREVIEW_LIMIT)` at `:179`. |
| 26 | `src/routes/api/contacts/crud.ts:44` | GET `/api/v1/contacts` | SQL (default path) / JS (segment/rules path) | Default path (no `segmentId`/rules): `.limit(params.perPage).offset(offset)` at `src/server/repo/contacts/crud.ts:203-204`, count at `:191-195`. When `segmentId` or `rules` are present, falls through to the DEC-336 documented whole-directory JS path: `const sorted = ...` / `const total = sorted.length` / `.slice(start, start + params.perPage)` at `:225-228` — same pre-slice `total` pattern as the other blessed JS-slices. One route, two internally-bounded code paths; neither is unbounded. |
| 27 | `src/routes/api/contacts/crud.ts:127` | GET `/api/v1/contacts/duplicates` | JS | DEC-466/DEC-461(e) blessed slice: `const total = groups.length` at `src/routes/api/contacts/crud.ts:123`, `groups.slice(start, start + perPage)` at `:125`. |
| 28 | `src/routes/review/reviewer.ts:63` | GET `/api/v1/review/plans` | SQL (organizer path) / JS (reviewer path) | Organizer: `repo.listPlansForEvent`/`repo.countPlansForEvent` (SQL, cited in row 11) called with `{limit, offset}` at `src/routes/review/reviewer.ts:47-48`. Reviewer: DEC-461(e) blessed slice — `total = planIds.length` at `:56-57`, `planIds.slice(...)` at `:58`. |
| 29 | `src/routes/review/reviewer.ts:74` | GET `/api/v1/review/plans/:id/queue` (plan closed) | JS | Trivial: literal `{ items: [], total: 0, ... }` — an empty array is bounded by construction, no computation to cite. |
| 30 | `src/routes/review/reviewer.ts:138` | GET `/api/v1/review/plans/:id/queue` (plan open) | JS | DEC-466/DEC-461(e) blessed slice: `const total = items.length` at `src/routes/review/reviewer.ts:135`, `items.slice(start, start + perPage)` at `:137`. |

**Tally: 24 SQL/JS/ECHO-bounded classifications (some routes span two of these), 2 UNBOUNDED
(rows 1 and 3, both in `src/routes/files.ts`), 1 additional UNBOUNDED not previously named in any
DEC (row 15, `src/routes/api/forms.ts:259`).**

## 4. Live probe (DEC-453: a response body is a measurement, a LIMIT in source is a claim)

Setup, exactly as specified, run against this sha:

```
cd /Users/wednesdayniemeyer/Documents/gniemeyer/Projects/chautauqua-wt/task-w21-b
npm ci --prefer-offline --no-audit --no-fund --silent
npm run db:migrate
npm run seed                       # demo seed first — perf:seed builds on top of it and needs
                                    # the sbek-organizer/sbek-reviewer identities to exist
npm run perf:seed                  # 2k submissions, 12 perf reviewers, seed_perf_plan_0001
npx vite build --config app/vite.config.ts
npx wrangler dev --port 8799 &     # local dev server
```

Logged in as the seeded organizer (`sbek-organizer@example.com` / `docs/fixtures/sample-data.json`
`identities.organizer`) and as `perf.reviewer.1@example-perf.test` / `PerfReviewer!2027` (one of
the 12 perf-seed reviewers on `seed_perf_plan_0001` — "unrestricted" in the sense of not being
recused from anything), via `POST /login` with the `chq_csrf` double-submit cookie pattern (same
flow `scripts/perf-smoke.ts`'s `login()` uses). GET rows and the two safe echo/preview rows were
hit with `fetch`; results below are the actual `status` / `items.length` / `total` from the
response body, not source inspection.

| # | file:line | route | status | items.length | total | note |
|---|---|---|---|---|---|---|
| 1 | files.ts:166 | GET `/api/v1/submissions/:id/files` | 200 | 0 | N/A (no `total` key) | sampled submission `seed_perf_submission_2000` has zero files seeded; confirms the response is `{items}` only — `total` genuinely absent from the wire, matching row 1's UNBOUNDED classification (no pagination fields at all) |
| 2 | files.ts:219 | GET `/api/v1/events/:eventId/files` | 200 | 50 | 600 | default `perPage` (legacy `clampPerPage`) = 50; 600 files seeded |
| 3 | files.ts:309 | GET `/api/v1/files/:fileId/comments` | UNPROBED | — | — | sampled file (`seed_perf_file_1200`, a handout on submission 1800) had zero comments seeded, and no comment-bearing file id was readily enumerable within this task's scope; classification (row 3, UNBOUNDED) is source-verified independently (no `.limit()` in `listFileComments`, no page params on the route) even though a >1-row live response wasn't captured |
| 4 | comms.ts:73 | GET `/api/v1/events/:eventId/templates` | 200 | 0 | 0 | perf-seed does not seed templates for this event |
| 5 | comms.ts:383 | POST compose/preview | UNPROBED | — | — | requires a valid submissionIds payload + resolved recipients; not exercised live in this pass — classification rests on the `MAX_COMPOSE_RECIPIENTS` source citation only |
| 6 | comms.ts:479 | POST compose/send | UNPROBED | — | — | same as row 5; also would send real mail via the dev sink — deliberately not fired live to avoid polluting `email_log`/dev mailbox state for other concurrent lanes |
| 7 | email-log.ts:48 | GET email-log | 200 | 50 | 5000 | default perPage 50 (legacy `clampPerPage`); 5,000 rows seeded |
| 8 | events.ts:198 | GET /events | 200 | 2 | 2 | demo seed event + perf-seed event |
| 9 | events.ts:339 | GET tracks | 200 | 8 | 8 | |
| 10 | events.ts:422 | GET rooms | 200 | 10 | 10 | |
| 11 | plans.ts:66 | GET plans | 200 | 1 | 1 | |
| 12 | plans.ts:247 | GET reviewers | 200 | 12 | 12 | matches `PERF_REVIEWER_COUNT` |
| 13 | plans.ts:309 | GET progress | 200 | 12 | 12 | pre-slice total, matches reviewer count |
| 14 | plans.ts:353 | GET results | 200 | 50 | 2000 | default perPage 50 (legacy `clampPerPage`, not migrated to `listPerPage`) |
| 15 | forms.ts:259 | POST fields/reorder | UNPROBED | — | — | mutation requiring a full valid permutation payload of the form's existing field ids; not exercised live (would require first enumerating the seeded CFP form's exact field id list) — classification (UNBOUNDED) rests on source citation only |
| 16 | portal-config.ts:147 | GET resources | 200 | 0 | 0 | none seeded |
| 17 | tokens.ts:56 | GET tokens | 200 | 0 | 0 | none seeded |
| 18 | pipeline.ts:72 | GET pipeline | 200 | 200 | 803 | absent `perPage` → `listPerPage` default 200 (DEC-465); 803 seeded, correctly capped at 200 with true `total` |
| 19 | users.ts:59 | GET users | 200 | 104 | 104 | |
| 20 | submissions.ts:75 | GET submissions | 200 | 50 | 2000 | default perPage 50 (legacy `clampPerPage`) |
| 21 | submissions.ts:220 | GET revisions | 200 | 0 | 0 | sampled submission has no revisions seeded |
| 22 | views.ts:48 | GET views | 200 | 0 | 0 | none seeded |
| 23 | segments.ts:103 | GET segments | 200 | 1 | 1 | |
| 24 | bulk-email.ts:163 | POST bulk-email | UNPROBED | — | — | would send real mail; deliberately not fired live |
| 25 | bulk-email.ts:189 | POST bulk-email/preview | UNPROBED | — | — | requires a specific contactIds+subject/body payload against seeded contacts; not exercised this pass, echo-cap (`BULK_EMAIL_PREVIEW_LIMIT=5`) verified by source only |
| 26 | contacts/crud.ts:44 | GET contacts | 200 | 50 | 831 | default path (no segmentId/rules), 831 contacts seeded |
| 27 | contacts/crud.ts:127 | GET contacts/duplicates | 200 | 2 | 2 | pre-slice total |
| 28 | reviewer.ts:63 | GET review/plans (reviewer) | 200 | 1 | 1 | reviewer path (DEC-461(e) slice), the one plan the perf reviewer is assigned to |
| 29 | reviewer.ts:74 | GET queue (closed plan) | UNPROBED | — | — | `seed_perf_plan_0001` is open at seed time — the closed-plan branch wasn't exercised live; classification rests on the literal `{items:[],total:0}` in source |
| 30 | reviewer.ts:138 | GET queue (open plan) | 200 | 200 | 1500 | absent `perPage` → `listPerPage` default 200; 1500-item queue capped correctly with true `total` |

Any row marked UNPROBED above is explicitly not silently PASS: rows 3, 5, 6, 15, 24, 25, 29 (7 of
30) rest on source-code citation only for this pass, not a live measurement.

## 5. DEC-472 branch-ancestry check

The task named `task-w20-a`, `task-w20-b`, `task-w21-a` as candidate unmerged-fix branches.

```
$ git -C .../task-w21-b log --oneline bf56ba715a36bcde8bbdb9e01edf7b573c38b0de | grep -c "merge task-w20-a\|merge task-w20-b"
8
```

`task-w20-a` and `task-w20-b` are **already merged and are ancestors of this sha** (visible
directly in `git log` on `bf56ba7` itself — `3959482 merge task-w20-a`, `f310111 merge task-w20-b`
both precede it). Neither carries an open fix relevant to this enumeration's UNBOUNDED rows.

`task-w21-a`'s local branch ref no longer exists in this worktree by the time this section was
written (deleted after merging elsewhere in the parent repo, concurrently with this task). Its
merge commit was located by content: `d5e549f629eb2c1aaefca442de5e71f2eccace20` ("merge task-w21-a",
parent `bf56ba7`) touches exactly `src/routes/files.ts`, `src/server/repo/files-comments.ts`,
`src/server/repo/files-versions.ts`, and adds `test/files-list-bounds.test.ts` — i.e. it is the fix
for this artifact's rows 1 and 3 (the two `src/routes/files.ts` UNBOUNDED sites).

```
$ git -C .../task-w21-b merge-base --is-ancestor d5e549f629eb2c1aaefca442de5e71f2eccace20 bf56ba715a36bcde8bbdb9e01edf7b573c38b0de
$ echo $?
1   # false — d5e549f is NOT an ancestor of this sha
```

**Result: false.** At this sha (`bf56ba7`), `task-w21-a`'s fix for rows 1 and 3 has not landed —
those two rows are correctly graded UNBOUNDED here, not silently described as fixed. (Per DEC-472,
this is reported as a fact about the branch relative to this sha; it is not evidence that the fix
is good or bad, only that it postdates this sha and this artifact's PASS/FAIL below does not credit
it.)

Row 15 (`src/routes/api/forms.ts:259`) has no candidate branch among the three named — it is a
newly-found site this pass, not previously tracked by any DEC or in-flight branch.

## 6. Result

- Rows 1, 3 (`src/routes/files.ts:166`, `:309`): UNBOUNDED. **PENDING-OWNED(task-w21-a)** — fix
  exists as commit `d5e549f` but is not an ancestor of this artifact's sha (§5); not credited here.
- Row 15 (`src/routes/api/forms.ts:259`): UNBOUNDED. **FAIL-unowned** — no branch among
  `task-w20-a`/`task-w20-b`/`task-w21-a` touches `src/routes/api/forms.ts` or
  `src/server/repo/forms.ts`; not previously named in any DEC found in `src/decisions.ts` or the
  field guide. This is a genuinely new finding.
- Row 22's legacy-`clampPerPage` usage (`plans.ts:353`) and rows 7/20 (`email-log.ts`,
  `submissions.ts`) similarly still on the pre-DEC-465 default of 50 rather than `listPerPage`'s
  200: not a bound defect (both are still SQL-bounded, sibling-counted, and probed live with a
  correct `total`), just an inconsistency in which default/max a caller gets depending on the
  route — noted, not counted as an open item.

OPEN ITEMS: 3 (2 PENDING-OWNED(task-w21-a): rows 1, 3; 1 FAIL-unowned: row 15)

RESULT: FAIL — 27 of 30 sites are correctly bounded (SQL, JS-slice-with-pre-slice-total, or a
named recipient cap) and, where probed live, report a true `total` at 2k/5k/800-seeded scale.
3 sites remain genuinely unbounded at this sha: 2 have a fix in flight on `task-w21-a` (not yet an
ancestor of this sha, so not credited per DEC-472) and 1 (`src/routes/api/forms.ts:259`, the
form-fields reorder echo) is a new, previously-untracked, unowned defect this enumeration surfaced.
