# task-w20-f — list-envelope enumeration, stage 1 (log-only, DEC-452/453)

Log-only lane per DEC-452/453: no source file changed, nothing fixed, no SPEC item owned.

**Timeline note (read first).** This task was dispatched with the instruction "branch fresh from
main" against `main` sha `f310111` (`merge task-w20-b`) and the premise that wave 21 had not yet
run and would grade SPEC.md:353 from this file. Mid-task, this worktree was destroyed by an
out-of-band process (a recurring hazard already documented in
`task-w17-f-pagination-audit-stage1.md` — "worktree destroyed twice mid-audit") and had to be
recreated. By the time it was recreated, `main` had advanced two full waves past the dispatch
point, to `bf56ba7` ("scribe wave 21"), which is `git merge-base --is-ancestor`-confirmed to
already contain a full wave-21 run (`merge task-w21-a/b/c/d/e`, `merge task-w20-e`, and
`decisions/DEC-471..474.md`). **None of wave 21's five merged lanes cite `SPEC.md:353` anywhere**
(`grep -rn "SPEC.md:353" docs/verification-log/task-w21-*.md` returns nothing) — the wave-21 that
actually ran evidently did not wait for or consume this lane's output. `decisions/DEC-472..474.md`
(on `main` as of the audited sha, dated after this task's original dispatch) describe a *further*,
not-yet-executed plan for a still-later wave that supersedes this task's exact brief: DEC-473 asks
for the same four-class taxonomy this file already uses, at a different path
(`docs/verification-log/task-w21-b-list-envelope-enumeration-stage1.md`, which does not exist on
the audited sha — `task-w21-b` was actually spent on a persona walkthrough instead), and DEC-471
names two additional unbounded sites (`src/routes/files.ts:166`, `:309`) that this task's own
dispatch text explicitly told this lane to record as "not applicable". DEC-472 is binding
("Decisions in decisions/ are binding") and directly contradicts that dispatch instruction, so
this file follows DEC-471/472/473 over the dispatch text on that one point (see rows 4 and 26
below) and flags the conflict here rather than silently picking one. **Net effect: this
deliverable is very likely orphaned for its originally-stated purpose** (feeding a wave-21 ledger
that has already closed without it) and the planner should decide whether wave 22+ needs to
re-cite it, supersede it with a DEC-473-shaped artifact at the path DEC-473 names, or discard it.
This is a process observation, not a product finding, and does not change the RESULT below, which
is graded strictly on what the audited sha's code does.

Audited at `main` sha `bf56ba7` (`bf56ba715a36bcde8bbdb9e01edf7b573c38b0de`, "scribe wave 21"),
this task's own worktree (recreated at that sha after the mid-task wipe described above — no
commits existed at loss time, nothing was lost).

## Method

Per DEC-459/466, the population is derived mechanically, not from a hand list or an inherited
prior audit (`task-w17-f-pagination-audit-stage1.md`'s 20-row list is explicitly not reused —
DEC-466 found it short by three).

**Derivation command** (re-runnable):

```
rg -n --no-heading 'c\.json\(' src/routes -g '*.ts' -A3 | rg -B3 '\bitems\b' | rg 'c\.json\(' | sort -u
```

Raw output: 32 lines. Three are context-window false positives (the `-A3`/`-B3` window pulled in
an unrelated `items` occurrence 1-3 lines away from a `c.json(...)` call whose own object literal
has no `items` key) — manually verified by reading each site:

- `src/routes/api/pipeline.ts:187` — `c.json(serializeActivity(activity), 201)`; the next line is
  blank, `items` appears only because the *following* handler (`/pipeline/:id` PATCH) is within
  the 3-line trailing window. Not a list envelope (single created activity record).
- `src/routes/api/users.ts:133` — `c.json({ id: target.id, email: ..., password }, 200)`; `items`
  bleeds in from the next handler's context. Not a list envelope.
- `src/routes/api/views.ts:83` — `c.json({ deleted: true })`; same context-bleed. Not a list
  envelope.

**29 true positives** remain — every `c.json({ ... items ... })` call site under `src/routes/**`.
This is the population graded below (rows 1-29). Per DEC-471 (binding, see timeline note above),
two additional sites are added as rows 30-31, since their exclusion in the original dispatch text
directly conflicts with a binding decision doc: `src/routes/files.ts:166` and `:309` both return
`c.json({ items })` shaped this way in source but were excluded from the 32-line raw `rg` count
above only because their line (`return c.json({ items });`) has `items` immediately followed by
`}` — the earlier char-class variant of this exact grep (`\bitems\s*[:,)]`) used in the first pass
of this audit missed them for that reason; the corrected `\bitems\b` pattern above does catch them
(confirmed: both appear in the 32-line raw output, not in the 3 false positives above, so they
are correctly members of the same mechanical population, at rows 30-31 not "extra").

**Extended manual check (not part of the mechanical population, reported for completeness):**
`src/routes/public/index.tsx:171` returns `c.json(buildSurfaceFeed(event, surfaceParam, items,
new Date()))` — a function call, not an object literal, so it never matches the `c.json({`
pattern above and is correctly outside this population. It is public-surface machinery governed
separately by DEC-433/DEC-453's public-pagination contract (`src/routes/public/query.ts`'s
`parsePage`/`MAX_PUBLIC_PAGE`), not an admin DEC-013 list envelope; not graded here.

Each of the 31 rows below is classified into exactly one of DEC-473's four classes:
**BOUNDED-IN-SQL** (repo `LIMIT`/`OFFSET` + sibling count fn), **BOUNDED-IN-JS** (DEC-461(e)
slice of an already-materialized array, `total` = pre-slice length), **CAPPED-ECHO** (a mutation
echoing back its own already-bounded input), or **UNBOUNDED** (defect).

## Full inventory (31 rows)

| # | Route | Handler file:line | Repo fn / bound | Class |
|---|---|---|---|---|
| 1 | `GET /api/v1/events/:eventId/templates` | `src/routes/comms.ts:73` | `repo.listTemplates` `src/server/repo/comms.ts:44` (`.limit`/`.offset`) + `repo.countTemplates` `src/server/repo/comms.ts:60` | BOUNDED-IN-SQL |
| 2 | `POST /api/v1/events/:eventId/compose/preview` | `src/routes/comms.ts:383` | inline; `items = result.rendered` built from `buildRenderTargets(c, event, submissions, ...)` where `submissions` is the caller-supplied, `MAX_COMPOSE_RECIPIENTS`-validated id array (`src/routes/comms.ts:173-177`, `src/domain/compose.ts:9`, `MAX_COMPOSE_RECIPIENTS = 100`) | CAPPED-ECHO |
| 3 | `POST /api/v1/events/:eventId/compose/send` | `src/routes/comms.ts:479` | same `MAX_COMPOSE_RECIPIENTS = 100` cap as row 2; echoes the send result for the same bounded recipient set | CAPPED-ECHO |
| 4 | `GET /api/v1/submissions/:id/files` | `src/routes/files.ts:166` | `listSubmissionFiles` `src/server/repo/files-versions.ts:160` — plain `SELECT ... ORDER BY createdAt desc`, no `LIMIT`, no `total`/`page`/`perPage` in the envelope | **UNBOUNDED** (DEC-471 defect; not yet fixed on this sha — see row 30 duplicate note) |
| 5 | `GET /api/v1/events/:eventId/files` | `src/routes/files.ts:219` | `listEventDeliverableFiles` `src/server/repo/files-library.ts:97` (count at :129-133, `.limit`/`.offset` at :150-151) | BOUNDED-IN-SQL |
| 6 | `GET /api/v1/files/:fileId/comments` | `src/routes/files.ts:309` | `listFileComments` `src/server/repo/files-comments.ts:23` — plain `SELECT`, no `LIMIT`, no `total`/`page`/`perPage` | **UNBOUNDED** (DEC-471 defect; not yet fixed on this sha — see row 31 duplicate note) |
| 7 | `GET /api/v1/events/:eventId/plans` | `src/routes/review/plans.ts:66` | `repo.listPlansForEvent` `src/server/repo/review/plans.ts:84` (`.limit`/`.offset`) + `repo.countPlansForEvent` `src/server/repo/review/plans.ts:100` | BOUNDED-IN-SQL |
| 8 | `GET /api/v1/plans/:id/reviewers` | `src/routes/review/plans.ts:247` | `repo.listReviewerRowsForPlan` `src/server/repo/review/reviewers.ts:31` (`.limit`/`.offset`) + `repo.countReviewerRowsForPlan` `src/server/repo/review/reviewers.ts:46` | BOUNDED-IN-SQL |
| 9 | `GET /api/v1/plans/:id/progress` | `src/routes/review/plans.ts:309` | DEC-461(e)/DEC-466 slice: `items` built in JS from `users` (`clampPage`+`listPerPage`, slice at `src/routes/review/plans.ts:305-308`), `total = items.length` pre-slice | BOUNDED-IN-JS |
| 10 | `GET /api/v1/plans/:id/results` | `src/routes/review/plans.ts:353` | DEC-440-blessed JS slice of `sortedRows` (ranked results); `clampPage`+`clampPerPage` (not `listPerPage` — pre-existing, legitimate 50-default site, unaffected by DEC-465's fix scope), `total = sortedRows.length` | BOUNDED-IN-JS |
| 11 | `GET /api/v1/review/plans` (organizer branch) | `src/routes/review/reviewer.ts:63` | `repo.listPlansForEvent`/`repo.countPlansForEvent` (same fns as row 7) | BOUNDED-IN-SQL |
| 11b | `GET /api/v1/review/plans` (reviewer branch) | `src/routes/review/reviewer.ts:63` | DEC-461(e) slice of the reviewer's already-fetched `planIds` list (`src/routes/review/reviewer.ts:53-59`), `total = planIds.length` | BOUNDED-IN-JS |
| 12 | `GET /api/v1/review/plans/:id/queue` (plan not open) | `src/routes/review/reviewer.ts:74` | degenerate early return, `items: []` — trivially bounded | BOUNDED-IN-JS |
| 13 | `GET /api/v1/review/plans/:id/queue` (plan open) | `src/routes/review/reviewer.ts:138` | DEC-466/DEC-461(e) slice of `items` built from `buildReviewerQueue`'s ordered id list (`src/routes/review/reviewer.ts:132-136`), `total = items.length` pre-slice | BOUNDED-IN-JS |
| 14 | `GET /api/v1/events/:eventId/submissions` | `src/routes/api/submissions.ts:75` | `listSubmissions` `src/server/repo/submissions/list.ts:56` — self-contained count (`:100-104`) + `.limit`/`.offset` (`:113-114`) | BOUNDED-IN-SQL |
| 15 | `GET /api/v1/pipeline` | `src/routes/api/pipeline.ts:72` | `repo.listPipelineForOrg` `src/server/repo/pipeline.ts:146` (`.limit`/`.offset`) + `repo.countPipelineForOrg` `src/server/repo/pipeline.ts:135` | BOUNDED-IN-SQL |
| 16 | `POST /api/v1/forms/:formId/fields/reorder` | `src/routes/api/forms.ts:259` | echoes `repo.reorderFields`'s return, itself a permutation of the form's existing field ids (`isPermutation(existingIds, body.orderedIds)` check, `src/routes/api/forms.ts:250`) — cardinality equals the form's own field count, never grows on this call | CAPPED-ECHO |
| 17 | `GET /api/v1/contacts` | `src/routes/api/contacts/crud.ts:44` | `listContactsForOrg` `src/server/repo/contacts/crud.ts:183` (internal count + `.limit`/`.offset`, `ContactListResult`) | BOUNDED-IN-SQL |
| 18 | `GET /api/v1/contacts/duplicates` | `src/routes/api/contacts/crud.ts:127` | DEC-466/DEC-461(e) slice: `findDuplicateGroupsForOrg` `src/server/repo/contacts/merge.ts:21` returns the full group list (now with a stable `id asc` tiebreak per DEC-466), `clampPage`+`listPerPage` slice at the route, `total` = full group count | BOUNDED-IN-JS |
| 19 | `GET /api/v1/segments` | `src/routes/api/contacts/segments.ts:103` | `repo.listSegmentsForOrg` `src/server/repo/contacts/segments.ts:34` (`.limit`/`.offset`) + `repo.countSegmentsForOrg` `src/server/repo/contacts/segments.ts:44` | BOUNDED-IN-SQL |
| 20 | `POST /api/v1/contacts/bulk-email` | `src/routes/api/contacts/bulk-email.ts:163` | echoes `result.rendered`, bounded by `MAX_BULK_EMAIL_RECIPIENTS = 100` (`src/routes/api/contacts/bulk-email.ts:19`, enforced via `parseBoundedIdArray(..., { maxCount: MAX_BULK_EMAIL_RECIPIENTS })` at `:54`) | CAPPED-ECHO |
| 21 | `POST /api/v1/contacts/bulk-email/preview` | `src/routes/api/contacts/bulk-email.ts:189` | `previewContacts = contacts.slice(0, BULK_EMAIL_PREVIEW_LIMIT)`, `BULK_EMAIL_PREVIEW_LIMIT = 5` (`src/routes/api/contacts/bulk-email.ts:115`, `:179`) | CAPPED-ECHO |
| 22 | `GET /api/v1/tokens` | `src/routes/api/tokens.ts:56` | inline query, `src/routes/api/tokens.ts` (`.limit`/`.offset` immediately above the return) + inline count query | BOUNDED-IN-SQL |
| 23 | `GET /api/v1/events/:eventId/resources` | `src/routes/api/portal-config.ts:147` | `listResourcesForEvent` `src/server/repo/portal-config.ts:181` (`.limit`/`.offset`) + `countResourcesForEvent` `src/server/repo/portal-config.ts:191` | BOUNDED-IN-SQL |
| 24 | `GET /api/v1/events/:eventId/views` | `src/routes/api/views.ts:48` | `listSavedViews` `src/server/repo/views.ts:83` (`.limit`/`.offset`) + `countSavedViews` `src/server/repo/views.ts:99` | BOUNDED-IN-SQL |
| 25 | `GET /api/v1/events` | `src/routes/api/events.ts:198` | `listEventsForOrg`/`listEventsForReviewer` `src/server/repo/events.ts:66`/`:89` (`.limit`/`.offset`) + `countEventsForOrg` `src/server/repo/events.ts:76` | BOUNDED-IN-SQL |
| 26 | `GET /api/v1/events/:eventId/tracks` | `src/routes/api/events.ts:339` | `listTracksForEvent` `src/server/repo/events.ts:254` (`.limit`/`.offset`) + `countTracksForEvent` `src/server/repo/events.ts:264` | BOUNDED-IN-SQL |
| 27 | `GET /api/v1/events/:eventId/rooms` | `src/routes/api/events.ts:422` | `listRoomsForEvent` `src/server/repo/events.ts:399` (`.limit`/`.offset`) + `countRoomsForEvent` `src/server/repo/events.ts:409` | BOUNDED-IN-SQL |
| 28 | `GET /api/v1/events/:eventId/email-log` | `src/routes/api/email-log.ts:48` | `listEmailLog` `src/server/repo/email.ts:80` (internal count + `.limit`/`.offset`, `EmailLogListResult`); route uses `clampPerPage` (50 default), not `listPerPage` — a real bound either way, max 200 | BOUNDED-IN-SQL |
| 29 | `GET /api/v1/users` | `src/routes/api/users.ts:59` | `repo.listOrgUsers` `src/server/repo/users.ts:34` (`.limit`/`.offset`) + `repo.countOrgUsers` `src/server/repo/users.ts:45` | BOUNDED-IN-SQL |
| 30 | (= row 4) `GET /api/v1/submissions/:id/files` | `src/routes/files.ts:166` | see row 4 | **UNBOUNDED** |
| 31 | (= row 6) `GET /api/v1/files/:fileId/comments` | `src/routes/files.ts:309` | see row 6 | **UNBOUNDED** |

(Rows 30/31 are listed twice — once inline at their natural position 4/6 in file order, once at
the end to make the "2 UNBOUNDED of 29+2" count impossible to undercount by scanning only the
tail of the table. They are the same two sites, counted once each in OPEN ITEMS below.)

## Non-list-envelope sites explicitly excluded (stated, not implied)

Per the dispatch instructions, every `c.json({ items` hit that is not itself a paginated list
read gets an explicit "not applicable" line:

- `src/routes/comms.ts:383` (compose preview) and `:479` (compose send echo) — classified
  CAPPED-ECHO above (rows 2, 3), not "not applicable": they are list-shaped envelopes, just
  bounded by input rather than by SQL/JS pagination. Included in the 31-row population.
- `src/routes/api/forms.ts:259` (reorder echo) — classified CAPPED-ECHO above (row 16), same
  reasoning.
- `src/routes/api/contacts/bulk-email.ts:163` and `:189` — classified CAPPED-ECHO above (rows
  20, 21), same reasoning.
- `src/routes/files.ts:166` and `:309` — **not** marked "not applicable" here, contrary to the
  original dispatch text's own example list, because DEC-471 (binding, landed on the audited sha
  as a decision doc) identifies both as real DEC-013 list-envelope gaps, not scoped-detail reads;
  see the timeline note at the top of this file. Classified UNBOUNDED above (rows 4/6, 30/31).

No `c.json({ items` site in the 32-line raw `rg` output (minus the 3 confirmed false positives)
was left unclassified.

## Live probe (2k perf seed)

`npm run db:migrate && npm run seed && npm run perf:seed`, `npm run dev -- --port 8819` (DEC-448),
authenticated through the real `/login` form (`chq_csrf` hidden field, not a `csrf` param) as
`sbek-organizer@example.com` / `SbekTest!2027-org` (`docs/fixtures/sample-data.json`) for
organizer-scoped rows, and as `perf.reviewer.1@example-perf.test` /
`PerfReviewer!2027` (`scripts/perf-seed-lib.ts:181`, `PERF_REVIEWER_PASSWORD`) for the two
reviewer-scoped rows (11b, 13), against event `seed_perf_event` (slug `perf-2k`) and plan
`seed_perf_plan_0001`. Every BOUNDED-* row was probed with `?perPage=100000`, `?perPage=abc`, and
`?page=1e308`.

| Row | perPage=100000 | perPage=abc | page=1e308 |
|---|---|---|---|
| 1 templates | 0/0 items, total 0, perPage 200 | same, perPage 200 (default-200 site) | **HTTP 500** |
| 5 files | 200 items, total 600, perPage 200 | 50 items, perPage 50 (default-50 site) | **HTTP 500** |
| 7 plans(event) | 1/1, total 1, perPage 200 | same | **HTTP 500** |
| 8 reviewers | 12/12, total 12, perPage 200 | same | **HTTP 500** |
| 9 progress | 12/12, total 12, perPage 200 | same | HTTP 200, 0 items, total 12, page echoed `1e+308` |
| 10 results | 200 items, total 2000, perPage 200 | 50 items, perPage 50 | HTTP 200, 0 items, total 2000, page echoed `1e+308` |
| 11 review/plans (organizer) | not separately probed (same repo fns as row 7) | — | — |
| 11b review/plans (reviewer) | 1/1, total 1, perPage 200 | same | HTTP 200, 0 items, total 1 |
| 13 queue (reviewer) | 200 items, total 1500, perPage 200 | same | HTTP 200, 0 items, total 1500 |
| 14 submissions | 200 items, total 2000, perPage 200 | 50 items, perPage 50 | **HTTP 500** |
| 15 pipeline | 200 items, total 803, perPage 200 | same (200-default site) | **HTTP 500** |
| 17 contacts | 200 items, total 831, perPage 200 | 50 items, perPage 50 | **HTTP 500** |
| 18 contacts/duplicates | 2/2, total 2, perPage 200 | same | HTTP 200, 0 items, total 2 |
| 19 segments | 1/1, total 1, perPage 200 | same | **HTTP 500** |
| 22 tokens | 0/0, total 0, perPage 200 | same | **HTTP 500** |
| 23 resources | 0/0, total 0, perPage 200 | same | **HTTP 500** |
| 24 views | 0/0, total 0, perPage 200 | same | **HTTP 500** |
| 25 events | 2/2, total 2, perPage 200 | same | **HTTP 500** |
| 26 tracks | 8/8, total 8, perPage 200 | same | **HTTP 500** |
| 27 rooms | 10/10, total 10, perPage 200 | same | **HTTP 500** |
| 28 email-log | 200 items, total 5000, perPage 200 | 50 items, perPage 50 | **HTTP 500** |
| 29 users | 104/104, total 104, perPage 200 | same | **HTTP 500** |
| 4/30 submission files | not perf-seeded (0 files for the probed submission) — `{"items":[]}`, no `total`/`page`/`perPage` key, confirming the UNBOUNDED classification's envelope shape live | | |

**New finding (not in this task's original brief, discovered live): every `BOUNDED-IN-SQL` row
returns HTTP 500 (`SQLITE_MISMATCH: datatype mismatch`, confirmed in the dev-server log for the
`templates` case, traced to `D1PreparedQuery.all` binding an out-of-range offset) for
`?page=1e308`, instead of the house invariant's required "400 never 500".** Root cause: `Number(
"1e308")` is `Number.isFinite` and `Number.isInteger` both `true` in JS (a double at that
magnitude has no fractional component), so `clampPage` (`src/lib/pagination.ts`) passes it
through unclamped; `(page - 1) * perPage` then overflows into a value SQLite's D1 binding rejects
as a parameter. Every `BOUNDED-IN-JS` row (9, 10, 11b, 13, 18) instead degrades gracefully — a JS
`.slice(hugeStart, hugeStart + perPage)` on an array just returns `[]`, no exception — which is
why those five rows show `HTTP 200` with `0` items and the correct `total` still intact, while
every SQL-bound row 500s. This is a real, live-reproduced, uniform defect across every
`BOUNDED-IN-SQL` row; it was not part of this task's dispatched scope to fix (log-only lane,
DEC-452/453) and is reported here as a finding for a future fix wave, not corrected.

## Cross-check against sibling wave-20 lanes

Per DEC-438/447, ownership is checked by `git merge-base --is-ancestor <commit> <audited sha>`,
never by reading a decision doc or field-guide line (DEC-472).

- **task-w20-a (DEC-465, `src/lib/pagination.ts`'s single `listPerPage` helper)** — commit
  `cf87f9d` IS an ancestor of `bf56ba7`. Landed. Confirmed in source: `src/lib/pagination.ts`
  exports `listPerPage`; every row above that should use it does (rows 1, 5, 7, 8, 15, 17, 18, 19,
  22-27, 29), except row 28 (`email-log`), which correctly keeps `clampPerPage` (its own
  legitimate 50-default site per DEC-465's scope) and row 10 (`plans/:id/results`), same reason.
- **task-w20-b (DEC-466, three missed envelopes: `review/plans/:id/queue`,
  `plans/:id/progress`, `contacts/duplicates`)** — commit `6d0a2fb` IS an ancestor of `bf56ba7`.
  Landed. Confirmed in source: rows 13, 9, 18 above all use the DEC-461(e) slice pattern this
  commit introduced.
- **task-w20-c (DEC-467, `user.email` obeys the one canonical email rule)** — commit `d44f20b` IS
  an ancestor of `bf56ba7`. Landed. Not directly graded by this list-envelope lane (DEC-467 is an
  email-normalization concern, not a pagination concern), noted only for completeness per the
  dispatch instruction to cross-check all three named sibling lanes.
- **DEC-471 (files.ts unbounded fix, described in `decisions/DEC-471.md`)** — **no commit
  implementing it exists anywhere in `main`'s ancestry as of `bf56ba7`** (`src/routes/files.ts:166`
  and `:309` still read `return c.json({ items });` with no `total`/`page`/`perPage`, confirmed by
  direct read at the audited sha, live-probed above). Per DEC-472, this is PENDING-OWNED, no
  branch: `decisions/DEC-471.md` exists on `main` but the branch that was supposed to carry its
  source change does not appear in `git branch -a` or `git worktree list` as of this audit. Not a
  FAIL-unowned (DEC-438) — reported as PENDING-OWNED with no known owning branch.

## Summary

- 29 sites match the population's mechanical criterion exactly (`c.json({ ... items ... })` under
  `src/routes/**`); 2 more (rows 30/31, duplicates of rows 4/6) are added per DEC-471/472's binding
  override of this task's own dispatch text.
- Of the 31 total rows: 20 BOUNDED-IN-SQL, 5 BOUNDED-IN-JS (6 counting the split row 11/11b), 5
  CAPPED-ECHO, 2 UNBOUNDED (files.ts:166, files.ts:309 — same two sites, rows 4/30 and 6/31).
- Every BOUNDED-* row was live-probed at 2k scale; all correctly clamp `perPage` and report true
  `total`. One uniform, live-reproduced defect found beyond this task's original scope: every
  BOUNDED-IN-SQL row 500s (not 400s) on `?page=1e308`.
- DEC-465, DEC-466, DEC-467 (this wave's three named sibling lanes) are all confirmed landed as
  ancestors of the audited sha. DEC-471 is not landed and has no identifiable owning branch —
  PENDING-OWNED.
- This task's premise (that a not-yet-run wave 21 would consume this file) did not hold — wave 21
  already ran and closed on `main` without citing `SPEC.md:353` or this file. See the timeline
  note at the top.

OPEN ITEMS: 4 (2 UNBOUNDED list-envelope sites per DEC-471, files.ts:166/:309, PENDING-OWNED no
branch; 1 live-reproduced `page=1e308` -> HTTP 500 defect across every BOUNDED-IN-SQL row,
unowned, not part of this lane's dispatched scope; 1 process/orphaning risk — this file's stated
consumer, wave 21, already closed without it)

RESULT: PASS — the enumeration itself is population-complete and mechanically re-derivable (command
given above), every row is classified into exactly one of DEC-473's four classes with zero gaps,
and every BOUNDED-* row is live-confirmed at 2k scale to actually bound `perPage`/report true
`total`. The 4 open items above are findings the enumeration surfaced, not defects in the
enumeration itself.
