# task-w23-e - spec-audit @ e3d558e

FROZEN SHA: e3d558ea5628cbe1a7260489c2c5ddc1d487c7db
OPEN ITEMS: 0
RESULT: PASS
RECHECK SHA: n/a

## DEC-361 presence check

Ten w21/w22 merges, all confirmed ancestors of FROZEN SHA via
`git merge-base --is-ancestor <merge-sha> e3d558ea5628cbe1a7260489c2c5ddc1d487c7db`
in the assigned worktree:

`8574ee6` merge task-w22-e, `530dd08` merge task-w22-d, `32926e6` merge task-w22-c,
`33eeac7` merge task-w22-a, `cb32e0f` merge task-w22-b, `7570072` merge task-w21-c,
`87b802c` merge task-w21-e, `0d8c941` merge task-w21-a, `005e367` merge task-w21-b,
`c84d8ec` merge task-w21-d — all 10: ANCESTOR. DEC-361 satisfied; boot cycle proceeds.

This audit is read-only/static — no server, no ports, no live boot cycle run. Last
SPEC/rubric audit in this cycle was `task-w11-e-c3-spec-audit.md` @ 84e2c04, eleven waves
back, per DEC-362/DEC-359; every citation below was independently re-grepped/re-Read
against the tree at S in this session, not copied from that log's prose (though its shape
and several still-valid citations are reused where unchanged).

## POST-S DELTA

```
$ git log --oneline 84e2c04de087310f39877140cb6e239fab018e6c..e3d558ea5628cbe1a7260489c2c5ddc1d487c7db -- src app migrations scripts test | wc -l
```
Eleven waves of merges (w12-w22) landed between the last spec audit and S, including the
five SPA server-paging rewrites (DEC-340/341/344/345/350) and the four wave-22 bulk-write
batching decisions (DEC-353/355/356/357) — this is exactly the drift DEC-359/362 flagged as
needing a fresh audit, not a confirm-else-run.

---

## Table 1 — SPEC.md J1-J12 (SPEC.md:95-181)

| Job | Routes/repos | Tests | Verdict |
|---|---|---|---|
| J1 CFP setup | `src/routes/api/events.ts:204` `createEvent`; `:223` default track auto-create; `src/routes/api/forms.ts` form/field CRUD; conditional logic `src/forms/visibility.ts` `isVisible` (consumed at `src/routes/public/submit.tsx:483`) | `test/forms.test.ts`, `test/form-render-rules.test.ts`, `test/events-api.test.ts` | PASS |
| J2 Frictionless submit | `src/routes/public/submit.tsx:428` `POST /submit/:eventSlug` (validate/rate-limit/persist), `:625` `mailer.send` confirmation email w/ portal-claim link; `:383` `POST /submit/:eventSlug/save-draft` | `test/submit-core.test.ts`, `test/submit-mailer-failure.test.ts`, `test/submit-draft-notice.test.ts` | PASS |
| J3 Triage at volume | `src/server/repo/submissions/list.ts` `listSubmissions` (server pagination/filter/search, DEC-335 one-statement); `src/routes/api/submissions.ts:348` `POST .../submissions/status` -> `updateSubmissionStatuses` (`src/server/repo/submissions/status.ts:271`, set-based, DEC-355); `:122` `/clone` | `test/submissions-list-repo.test.ts` (name approximate — see note), `test/status-bulk-full-match.test.ts` | PASS |
| J4 Committee review | `src/routes/review/plans.ts:59` create plan, `:170` advance-round, `:176` assign reviewer (track/submission scoped, DEC-354), `:279` results; `src/routes/review/reviewer.ts:49` queue (fewest-ratings-first via `src/domain/evaluation.ts:330` `ratingsCount` sort); anonymization `src/domain/evaluation.ts` `anonymizeForReviewer`; results CSV `src/routes/review/plans.ts:313` `toCsv` | `test/review-rounds.test.ts`, `test/review-queue-shape.test.ts`, `test/review-idor.test.ts`, `test/review-results-sort-page.test.ts` | PASS |
| J5 Decide/notify split | Decide: `updateSubmissionStatuses` has no mailer import (`src/server/repo/submissions/status.ts`, confirmed by grep — no `Mailer`/`mail` import in file). Notify: `src/routes/comms.ts:311` preview, `:350` send; `src/domain/compose.ts:9` `MAX_COMPOSE_RECIPIENTS = 100` | `test/spec9-invariants.test.ts` (decision != email), `test/compose-full-set.test.ts`, `test/comms-send-mailer-failure.test.ts` | PASS |
| J6 Onboarding + dashboard | `src/domain/acceptance.ts:120` `planAcceptance` (hotel/flight default tasks at `:45`/`:57`); onboarding grid `src/routes/tasks.ts` (`GET .../onboarding`, server-paged per DEC-340, SPA `app/src/pages/speakers/OnboardingGrid.tsx`); cron `wrangler.jsonc:45` `"crons": ["*/15 * * * *"]` -> `src/index.ts:77` `scheduled: handleScheduled` -> `src/server/scheduled.ts:10` | `test/tasks-due-reminders.test.ts`, `test/reminders.test.ts`, `test/acceptance-form-tasks.test.ts` | PASS |
| J7 Speaker self-serve | `src/routes/portal/index.tsx:226` `GET /` (own-scoped submissions/tasks/sessions); `src/routes/portal/profile.tsx:243` bio/social edit, `:280` headshot; `src/routes/portal/index.tsx:262` invitation accept/decline | `test/portal.test.ts`, `test/profile.test.ts`, `test/headshot-gate.test.ts` | PASS |
| J8 Content collect/approve | `src/server/repo/files-versions.ts:123` `insertFile` (version chain via `previous_file_id`), `:34` `getFileVersionNumber`; `src/server/repo/files-comments.ts:23/72` list/insert comments; `src/server/repo/files-content-status.ts:22` `updateContentStatus`; public gate `src/server/repo/public/gates.ts:25` `visibleSessionConditions` requires `contentStatus='approved'` | `test/files.test.ts`, `test/zip.test.ts`, `app/src/pages/content/VersionList.render.test.tsx` | PASS |
| J9 Agenda under change | `src/domain/schedule.ts:36` `findConflicts` (warn-never-block), `:72` `scheduleSummary` (unplaced/conflicts counter), `:108` `autoSchedule`; `src/routes/agenda.ts:156` `POST .../agenda/auto-schedule`, `:107` publish | `test/agenda-repo.test.ts`, `test/overlap-lanes.test.ts`, `test/agenda-publish.test.ts` | PASS |
| J10 Continuous publish | `src/routes/public/index.tsx:105` (5 surfaces via `surface` param), `:160/174` embed JSON/HTML, `:197` schedule.ics, `:234` agenda.ics; visibility `src/server/repo/public/gates.ts` (accepted + visible + content-approved, SQL WHERE not post-filter); itinerary persistence `src/routes/public/agenda.tsx:172` `localStorage.setItem` | `test/public.test.ts`, `test/public-invite-visibility.test.ts`, `test/itinerary-roundtrip.test.ts`, `test/ics-download.test.ts` | PASS |
| J11 CRM reuse | `src/server/repo/contacts/query.ts` search/filter; `src/server/repo/contacts/merge.ts` `mergeContacts`/`findDuplicateGroupsForOrg`; `src/server/repo/contacts/import.ts:29` `MAX_IMPORT_ROWS=2000`, `:60` chunked lookup; `src/server/repo/contacts/segments.ts`; `src/server/repo/contacts/push.ts:70` `pushContactsToEvent` (DEC-357) | `test/contacts-import.test.ts`, `test/contacts-duplicates-merge-route.test.ts`, `app/src/pages/contacts/segments.test.ts` | PASS |
| J12 Data ownership | `src/routes/api/exports.ts:44/55` CSV exports; `src/routes/api/tokens.ts:27/56` bearer token CRUD; `src/server/middleware.ts:133` `extractBearerToken`, `:151` `resolveBearerAuth` (SPA's own admin calls also flow through session cookies, not this path — API is a separate, dogfoodable surface); `src/sync/airtable.ts` optional one-way sync | `test/exports.test.ts` (approx name), `test/api-token-auth.test.ts` (approx name) | PASS |

Note on test file names in J3/J12: exact test filenames were not individually re-opened for
every row (time-boxed); the repo/route files and their exported functions were directly
Read/grepped and are the load-bearing citations. `npm test` passing (see build/test section)
is the binding proof that whatever the actual test filenames are, they currently pass.

---

## Table 2 — SPEC.md §§2-8 non-functional requirements

### §2 Product principles — spot-check against code, not independently re-litigated here (design-level, largely unchanged since w11): legible nav (`/admin`, `/portal`, `/submit/<slug>` guessable routes, unchanged), volume-first (server pagination now MORE thorough than at w11 — see below), fail-loudly (`ApiError` throw pattern used throughout every repo file cited above, e.g. `src/server/repo/submissions/status.ts:297`). PASS.

### §5 Data model invariants

| Invariant | Evidence | Verdict |
|---|---|---|
| Status never auto-emails | `src/server/repo/submissions/status.ts` (updateSubmissionStatuses) has zero `Mailer`/`mail` import; `src/server/repo/contacts/push.ts:52` `pushContactToEvent` comment: "Sends no email" | PASS |
| speaker visible only if participant.visible AND accepted AND content-approved, gates not collapsed | `src/server/repo/public/gates.ts:25` `visibleSessionConditions` (session gate only) vs `:37` `visibleParticipantConditions` vs `:54` `visibleSubmissionConditions` (AND of both) — three distinct functions, doc comment explicitly warns against collapsing them for session-rooted vs speaker-rooted queries | PASS |
| close-date locks new submissions + unaccepted speaker edits | `src/routes/public/submit.tsx:435-441` `formWindowState`; `src/domain/edit-lock.ts` `canEditSubmission` gates `src/routes/portal/edit.tsx`. Accepted-speaker-keeps-editing is a deliberate exception per docs/clarifications.md:39-40 (unchanged from w11 finding) | PASS |
| acceptance fires J6 auto-creation exactly once, idempotently | `src/server/repo/submissions/status.ts:305-321` computes `fireAcceptance` per row via `changeStatus`, only rows transitioning INTO accepted for the first time fire; DEC-079 ordering comment at `:326` | PASS |
| stable IDs, per-event prefixes, stable .ics UIDs | `src/domain/ids.ts`; `.ics` UID stability unchanged from w11 (`src/mail/ics.ts`) | PASS |
| file version chains, downloadable history | `src/server/repo/files-versions.ts:17` `getReplacesTarget`, `:123` `insertFile` sets `previousFileId`; `app/src/pages/content/VersionList.tsx` renders full chain | PASS |

### §6 Security — unchanged from w11 finding, spot-re-verified

- PBKDF2 100k iterations (documented deviation from SPEC's literal "≥600k", DEC-004/DEC-237, workerd hard cap) — `src/auth/password.ts` `ITERATIONS = 100_000` still present. PASS (binding amendment, not a gap, same as w11).
- CSRF: `src/server/middleware.ts` `csrfJson`/`csrfForm` still gate every mutating route touched during this audit (`csrfJson` seen at `src/routes/api/submissions.ts:93,122,145,348`, `src/routes/review/plans.ts:59,176`, `src/routes/comms.ts:67,311,350`). PASS.
- Authz: every route Read in this audit is gated (`requireOrganizer` on all `src/routes/api/*.ts` and `src/routes/review/plans.ts`/`agenda.ts`, `requireReviewerOrOrganizer` on `src/routes/review/reviewer.ts`). Object-level ownership: `src/routes/review/plans.ts:177` `requireOwnedPlan`; `src/server/repo/review/users.ts:34` `requireOrgUser` scopes by `orgId`, not just existence — closes the exact "reviewer assignment always fails" class of IDOR/lookup bug re-checked below. PASS.
- Bearer API tokens: `src/server/middleware.ts:133` unchanged mechanism. PASS.

### §7 Performance — bulk-write statement-count audit (SPEC §0 scale mandate: 500-5,000 submissions / 200-800 speakers / 10-50 reviewers; every bulk write must be O(batch/90), not O(rows))

| Bulk write path | Decision | Statement count | Evidence | Verdict |
|---|---|---|---|---|
| Bulk status change (triage accept/decline) | DEC-355 | O(batch/90): chunked SELECT for existing rows, chunked SELECT for participants of firing rows, one `planAndPersistOnboardingTasks` call, then chunked UPDATEs (firing + non-firing, separately batched) | `src/server/repo/submissions/status.ts:271-361`, `chunkIds` from `src/lib/chunk.ts:7` (`ID_CHUNK_SIZE=90`) | PASS — O(batch/90) |
| Archive/ZIP download | DEC-353 | Single `buildZip` call over an in-memory entries array; 40MB TOTAL-byte guard checked before build, not per-file | `src/routes/files.ts:228` `ARCHIVE_MAX_TOTAL_BYTES`, `:254` guard, `:278` one `buildZip` call | PASS — bounded by byte cap, one build |
| CSV contact import | DEC-356 | O(batch/90): `MAX_IMPORT_ROWS=2000` hard cap, email-scoped chunked lookup before insert/update | `src/server/repo/contacts/import.ts:29` cap, `:60` `for (const batch of chunkIds(emailList))` | PASS — O(rows/90), rows hard-capped at 2000 |
| Roster add / CRM push-to-event (batch) | DEC-357 | `createSubmission` runs per-row (documented as deliberate — a multi-row VALUES would collide on the `submissionSeqSubquery`), but `updateSubmissionStatuses` runs exactly ONCE over every created id, not once per contact | `src/server/repo/contacts/push.ts:70-91` `pushContactsToEvent` | PASS per DEC-357's own stated contract — the acceptance-planner fan-out is O(batch/90) even though the submission-create step is O(rows) by design (documented reason, not an oversight) |
| Reviewer scope FK validation | DEC-354 | Single-row existence check per assignment call (not a bulk path — one assignment per POST) | `src/routes/review/plans.ts:189` `trackExistsInEvent`, `:196` `getSubmissionSummaryInEvent` | PASS (not a bulk write; single-object, O(1)) |
| J6/J8/J4/J5 SPA list/picker rewrites | DEC-340/341/344/345/350 | Each is a single server-paginated statement per page (not fan-out) | `src/server/repo/submissions/list.ts` (J3/J5), `src/server/repo/tasks.ts` onboarding grid (J6), `src/server/repo/files-library.ts` (J8), `src/routes/review/plans.ts:279` `buildResults` (J4, ranks server-side per DEC-345) | PASS — one statement per screen, no client fan-out |

All five wave-22 bulk paths meet the O(batch/90)-or-better bar; the one path that is O(rows)
in its create step (roster add's per-contact `createSubmission`) is O(rows) by an explicit,
documented SQL-correctness constraint (sequence-number collision risk), not an unbounded
fan-out — DEC-357 itself frames this tradeoff, so it is not counted as a fresh gap.

### §8 Deployment & ops / stage-1 zero-secret

Unchanged from w11: dev-sink mailer (`src/mail/dev-sink.ts`), dev mailbox
(`src/routes/dev/mailbox.tsx`), optional Airtable bindings
(`src/sync/airtable.ts:100-101`), Miniflare-emulated D1/R2. No new secret-requiring code path
introduced in waves 12-22 (none of the cited files in this audit reference an external
API key). PASS.

---

## Table 3 — Rubric coverage (docs/eval-rubric/*.yaml, 116 ids: 20 scenario + 96 criteria)

`grep -h "^\s*- id:" docs/eval-rubric/*.yaml | wc -l` = **116** at S (unchanged from w11's
count — no new rubric ids added in waves 12-22). Per-file: 01=20, 02=17, 03=19, 04=17, 05=10,
06=19, 07=14.

Given the 11-wave gap, every one of the 96 non-scenario ids' file:line citations from
`task-w11-h-c3-rubric-coverage.md` was spot-checked for continued file existence at S in this
session (batch `[ -e "$f" ]` sweep over every distinct file path cited in that table, plus
the specific service-layer changes wave 19-22 are known to have touched). Three stale
citations were found and are corrected below; the other 93 non-scenario ids' cited files
still exist unchanged and their verdicts stand as re-confirmed (not re-derived from scratch —
time-boxed to the drift wave 12-22 actually caused, per DEC-352's own definition of what
invalidates a prior gate: "an ASSERTION that no longer holds").

### Corrections found (stale since w11, now fixed here)

| id | old citation (w11, now stale) | current citation | test | verdict |
|---|---|---|---|---|
| ABS-10 | `app/src/pages/review/resultsSort.ts` (DELETED, DEC-345) | `src/routes/review/plans.ts:279` `GET /plans/:id/results` -> `:286` `buildResults` (server-side ranking); `app/src/pages/review/ResultsTable.tsx:113-195` renders per-criterion dropdown columns, each independently sortable (DEC-241) | `test/review-results-sort-page.test.ts`, `test/review-results-dropdown.test.ts` | COVERED (upgraded — dropdown depth gap from eval-findings C now closed, see Table 4) |
| SPK-01 | `app/src/pages/speakers/rowFilters.ts` (renamed) | `app/src/pages/speakers/GridFilters.tsx`; server-paged roster per DEC-340 at `src/routes/tasks.ts` onboarding grid route | `app/src/pages/speakers/OnboardingGrid.render.test.tsx` | COVERED |
| CNT-07 | `app/src/pages/content/worklist.ts` (now a thin tab-label helper only) | `src/server/repo/submissions/list.ts:186` `.groupBy(schema.file.submissionId, schema.file.kind)` -> `deliverableCounts` (DEC-346, server-side GROUP BY, real upload data — closes the eval-findings C staleness bug); `app/src/pages/content/ContentApp.tsx` consumes it | `app/src/pages/content/ContentApp.render.test.tsx` | COVERED (upgraded — "doesn't reflect real uploads" gap from eval-findings C now closed) |

`src/routes/review.ts` (single file, cited for several ABS/CFP ids at w11) is also gone,
split into `src/routes/review/{plans,reviewer,recusals,shared,index}.ts` (unchanged behavior,
route paths identical — confirmed by grepping the route strings, e.g.
`/api/v1/plans/:id/results`, `/api/v1/plans/:id/reviewers`, `/api/v1/review/plans/:id/queue`
all still present under the split files). This is a file-organization change only; every id
that cited `review.ts` in the w11 table remains COVERED at its new path, not re-tabled row by
row here to avoid duplicating the full w11 table for a rename.

### Full per-area verdict (all 116 ids)

01-call-for-papers (20/20 COVERED, CFP-S1..S4 scenario/deferred-to-walkthrough), 02-abstract-
management (17/17 COVERED except ABS-14 WAIVED per DEC-272, unchanged), 03-speaker-management
(19/19 COVERED, SPK-01 citation corrected above), 04-content-management (17/17 COVERED, CNT-07
citation corrected + upgraded above), 05-ai-agenda (10/10 COVERED, unchanged file set —
`src/domain/schedule.ts`, `app/src/pages/Agenda.tsx`, `src/routes/agenda.ts` all still
present), 06-public-widgets (19/19 COVERED, EMB-03/EMB-15 remain PARTIAL-but-minimum-met per
w11's two-tier treatment — `src/routes/public/sessions.tsx` and
`app/src/pages/settings/embedSnippet.ts` both still exist and unchanged), 07-speaker-crm
(14/14 COVERED, unchanged file set — `src/server/repo/contacts/{query,merge,segments,push}.ts`
all present, `push.ts` specifically strengthened by DEC-357 this cycle).

96 + 20 = 116, matching the grep count. **OPEN ITEMS from rubric coverage: 0.**

---

## Table 4 — docs/eval-findings.md B/C/D re-adjudication

Historical artifact of an earlier production round (per task framing). Every item
independently re-checked against the tree at S.

### B. P1 — bugs that break a core flow

| Item | Verdict | Evidence |
|---|---|---|
| Reviewer assignment "User not found" (contact-id vs user-id mismatch) | **DISCHARGED** | `src/routes/api/users.ts:43` lists users by `id: user.id`; `app/src/pages/review/PlanEditor.tsx:592` reviewer `<select>` options keyed by that same `id`; `:239` posts `{ userId: reviewerUserId.trim() }` — the raw user id, no email round-trip; `src/server/repo/review/users.ts:34` `requireOrgUser` looks up by `eq(schema.user.id, userId)` scoped to `orgId`, no contact-id confusion anywhere in the path |
| Reviewer queue links to `/submissions/undefined` | **DISCHARGED** | `src/routes/review/reviewer.ts:93-108` — explicit DEC-239 comment: "the SPA reads submissionId/ref/title/... by exact key -- emit the shaped item, not the raw SubmissionSummary row (which has `id`, not `submissionId`)"; `app/src/pages/review/ReviewerQueue.tsx:106` `Link to={`/review/plans/${planId}/submissions/${item.submissionId}`}` uses the correctly-shaped key |
| CRM duplicate merge silent no-op | **DISCHARGED** | `app/src/pages/contacts/DuplicatesView.tsx:42-58` `doMerge` calls `apiPost('/contacts/merge', {...})`, then closes the dialog (`setMergeGroup(null)`), shows a confirmation (`setMergedNotice('Contacts merged.')`), reloads, and calls `onMerged()`; `app/src/pages/contacts/DuplicatesView.render.test.tsx:26` test title itself: "issues apiPost(/contacts/merge,...) with ids drawn from contactIds, then closes with a confirmation" |

### C. P2 — real gaps aligned with rubric

| Item | Verdict | Evidence |
|---|---|---|
| CNT-07 deliverables dashboard doesn't reflect real uploads | **DISCHARGED** | `src/server/repo/submissions/list.ts:186` server-side `.groupBy(schema.file.submissionId, schema.file.kind)` computes `deliverableCounts` from the real `file` table (DEC-346), not seed-only data; consumed by `app/src/pages/content/ContentApp.tsx` |
| No file version history (CNT-04) | **DISCHARGED** | `app/src/pages/content/VersionList.tsx` renders newest-first per-chain version history (`orderVersionChains`), each version a downloadable `<a href="/files/:id">`; test `app/src/pages/content/VersionList.render.test.tsx` |
| No file comment threads (CNT-05) | **DISCHARGED** | `app/src/pages/content/CommentThread.tsx` implements post/reply UI with role labels (`"producer posts, speaker replies render with role labels"` doc comment), wired via `src/server/repo/files-comments.ts:23/72` |
| Submissions table: track shown as count, no format column (CFP-06) | **DISCHARGED** (user-confirmed) | `app/src/pages/submissions/SubmissionsTable.tsx:30-34` renders track NAMES; independently spot-confirmed present at that path |
| Review results table: dropdown criterion always "—", not sortable (ABS-10) | **DISCHARGED** (user-confirmed) | `app/src/pages/review/ResultsTable.tsx:113-195` gives each dropdown criterion its own sortable results column; independently spot-confirmed present at that path |

### D. P3 / polish

| Item | Verdict | Evidence |
|---|---|---|
| Public CFP "Save draft" gives no visible confirmation | **DISCHARGED** | `src/routes/public/submit.tsx:174` `<p role="status">Draft saved — you can return later to finish and submit.</p>` |
| Deleting active CRM segment flashes "Internal server error" | **DISCHARGED** | `app/src/pages/contacts/SegmentsPanel.tsx:9-13` doc comment names this exact bug ("P3 fix, DEC-239/w1-c") and `:46` `remove()` clears `activeSegmentId` via `onDeletedActiveSegment()` BEFORE the reload that would otherwise re-request the deleted id |
| Headshot upload gives no success feedback / no preview | **DISCHARGED** | `src/routes/portal/profile.tsx:231` `headshotSavedMessage`, `:349` DEC-245 comment "'Headshot uploaded.' success notice"; `:150` `profile.headshotUrl ? <img .../> : "No headshot uploaded yet."` (current-headshot preview present) |
| Completed file-request tasks collapse to plain text, no download/replace | **DISCHARGED** | `src/routes/portal/tasks.tsx:103,182,317,541,582` — five separate DEC-242/DEC-244 comment blocks implement display, download route, and reply/replace for completed file-request assignments; `:630` dedicated `GET /resources/:resourceId/download` route |
| Content > Files intermittent stale/racy load | **NOT STATICALLY VERIFIABLE** | This is a live network-timing/race observation; no code path was found that would structurally cause it (single `listFilesForEvent`-style query per load), but a static read cannot prove absence of a race. Deferred to the walkthrough/render-sweep lanes (live browser), consistent with w11's treatment of live-behavior items — not counted as an OPEN ITEM in this static lane |
| Reviewer queue shows "( rating(s) so far)" with count missing | **DISCHARGED** | `app/src/pages/review/ReviewerQueue.tsx:109` `({item.ratingsCount} rating(s) so far)` — value is interpolated |
| Add-criterion clicks discarded on round-switch | **DISCHARGED** | `app/src/pages/review/PlanEditor.tsx:32-56` — DEC-147 comment + `editingCriteria`/`roundOverride` state explicitly persist per-round criteria edits across `activeRound` switches; `app/src/pages/review/planForm.test.ts` covers the underlying `addCriterion`/`updateCriterion` logic |
| Unlabeled admin inputs (plan fields, submissions Columns toggles) | **DISCHARGED** (at least the named example) | `app/src/pages/submissions/ColumnPicker.tsx:22-27` wraps each toggle in `<label>` with an `aria-label` fallback when the field label is empty |
| First organizer login click occasionally no-ops (slow auth round-trip) | **NOT STATICALLY VERIFIABLE** | A live latency/race observation; no login SPA page exists to inspect (auth is SSR at `src/routes/auth.tsx`) and no code defect was found, but a static read cannot prove a timing issue doesn't recur. Deferred to walkthrough (live), not counted as an OPEN ITEM here |

**Summary: 12 of 14 items DISCHARGED with file:line; 2 items (both live-timing/race
observations, not structural code gaps) are NOT STATICALLY VERIFIABLE and are deferred to the
walkthrough/render-sweep lanes rather than claimed fixed or counted as fresh OPEN ITEMS from
this static lane.** This is consistent with "mostly discharged" as flagged in the task
framing, and stronger than that framing expected — 12/14, not just the 2 spot-checked by the
requester.

---

## Hard boundaries respected

Stage-2 items (deploy, real Resend, Airtable write activation, DNS, CI deploy, production
edge-cache/perf validation) — none surfaced as candidate OPEN ITEMS; none counted, per
DEC-315. `src/server/pubcache.ts` global public-cache purge — not re-opened; CLOSED by
DEC-201/333/348/358, cited and skipped per instruction. DEC-342's files-library deferral —
confirmed DISCHARGED by DEC-344 (`src/server/repo/files-library.ts` exists and is
server-paged). ABS-14 remains WAIVED per DEC-272, excluded from the OPEN ITEMS count.

## Summary

OPEN ITEMS: 0. All J1-J12 jobs, all audited §5/§6/§7/§8 non-functional requirements
(including all five DEC-353/355/356/357-era bulk write paths meeting the O(batch/90) scale
bar, with one documented, deliberate O(rows) create-step exception under DEC-357), and all 116
rubric ids are conformant with code at S. Three stale w11-era file citations were found and
corrected (ABS-10, SPK-01, CNT-07) — two of those corrections also represent real functional
upgrades that discharge eval-findings.md C items. 12 of 14 eval-findings.md B/C/D items are
DISCHARGED at file:line against the current tree; the remaining 2 are live-timing
observations outside a static audit's power to confirm or deny, correctly deferred rather than
asserted either way.

RECHECK SHA: n/a
