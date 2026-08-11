# task-w27-e — spec-audit @ f01459a (detail)

DEC-232/233 exit-battery lane, S = `f01459a1d52b6867586dd0b5b7c81dfe09601cfd`
("merge task-w26-d"), the frozen literal sha per DEC-232 (re-frozen after the
wave-27 planning-time late-drain of task-w26-a..d). Log-only worker report;
this is the required single new file for this task. Structure follows
`docs/verification-log/task-w25-e-spec-audit.md`'s full clause-by-clause
methodology, re-run against the current freeze plus the mandatory DEC-227..230
fix re-confirmations.

## Step 1 — DEC-232 sha check + allow-list

`git -C .../chautauqua rev-parse main` = `2b5619d` ("scribe wave 27").
`git -C .../chautauqua merge-base --is-ancestor f01459a main` exits 0
(ancestor confirmed). `git -C .../chautauqua diff --stat f01459a 2b5619d`
shows exactly five changed files, all allow-listed:

- `decisions/DEC-232.md`, `decisions/DEC-233.md`, `decisions/DEC-234.md`
  (new decision docs — `decisions/**`).
- `field-guide/index.md` (scribe compaction — `field-guide/**`).
- `src/decisions.ts` (pure string-constant append — 5 lines added, DEC-114/
  DEC-232 allow-listed pattern).

No `src/`-code path other than the `src/decisions.ts` constant append,
`app/`, `test/`, `migrations/`, or `wrangler.jsonc` change appears in the
range. Per DEC-232 this is explicitly NOT drift. **Sha check: PASS.**
Proceed to Step 2.

## Step 2 — full clause-by-clause audit, tree = `f01459a`

Read via a detached worktree (`git worktree add --detach
.../chautauqua-wt/task-w27-e-frozen f01459a`), read-only, no server booted.
All file:line citations below are against that tree. Since the `f01459a`
tree is unchanged from the `b2dc2c1`-era implementation surface plus the
wave-26 fix quartet (DEC-227..230), the J1-J12 walk below re-confirms the
same implementation citations as `task-w25-e` (no `src/`, `app/src/`, or
`test/` files differ in application logic between those points except the
four fix commits themselves — `61d073d`, `b90db97`, `553e389`, `4a46c2e` —
and their four merge commits), with the fix-specific sections expanded per
this task's explicit instructions.

### J1 — Launch a CFP in an afternoon

Event create/branding, form builder incl. field types + required flags +
conditional visibility, close-date gate, public link/draft resume: same
citations as `task-w25-e` J1 — `src/routes/api/events.ts`, `src/db/
schema.ts`, `app/src/pages/forms/FieldModal.tsx`, `src/routes/api/forms.ts`,
`src/views/form-render.tsx` (DEC-194/DEC-008), `src/lib/submit-core.ts:11-13`
(`isFormClosed`), `src/routes/public/submit.tsx`. **CFP-01/02/03/04/07**
CONFORM.

### J2 — Submit a talk without friction

Required-field gating (now exercising the DEC-227 checkbox fix — see below),
confirmation email w/ claim link (`src/routes/public/submit.tsx:509-540`,
DEC-098 three-branch safety at lines 195-209), edit-stays-open-after-
acceptance override (`src/domain/edit-lock.ts:10-19`). **CFP-05/06/08/09/16**
CONFORM; CFP-08 testability remains `manual` per rubric, dev-sink
(`src/routes/dev/mailbox.tsx`, `src/mail/dev-sink.ts`) satisfies the
alternate-pass path.

### J3 — Triage hundreds of submissions without drowning

Submissions table/saved views/filters/bulk: `app/src/pages/submissions/
SubmissionsTable.tsx`, `src/routes/api/views.ts`, `src/routes/api/
submissions.ts`. Status pipeline: `src/domain/status.ts`. Bulk chunking
(DEC-193): `app/src/pages/submissions/bulk.ts`. **CFP-12** CONFORMS.

### J4 — Run committee review in waves

Evaluation plan/assignment/scorecard/anonymization: `src/domain/
evaluation.ts`, `src/routes/review.ts`. **DEC-212** re-confirmed exact:
`src/domain/evaluation.ts:78-85` — line 78 `// DEC-212: a rating-less
scorecard (all dropdown/text criteria, no...` comment, short-circuit body
returning `{ count: evals.length, average: 0, perCriterion: {} }` before
`computeWeightedScore` is invoked. **DEC-211** re-confirmed exact: `src/
routes/review.ts:625-628` — line 625 `// DEC-211: existence-hiding 404 for a
submission outside the plan's event,` comment, `getSubmissionSummaryInEvent`
guard through line 628's `ApiError("not_found", ...)`. **DEC-213**
re-confirmed exact: `src/routes/review.ts:300-311` — line 300 `// DEC-213:
independent of the whole-plan criteria/scale guard above, a` comment
introducing the per-round resolved-criteria freeze guard body. **ABS-01/03/
05/10** CONFORM.

### J5 — Decide and notify, deliberately

Status endpoints (`src/routes/api/submissions.ts`) contain no `mailer.`
call; notify is a separate compose/preview/send act (`src/routes/
comms.ts:350-377`, `src/domain/compose.ts`, 100-recipient cap, DEC-015
append-only `email_log`). **CFP-¬auto-email rules** CONFORM.

### J6 — Onboarding runs itself

Acceptance auto-creates speaker/session/default tasks: `src/domain/
acceptance.ts`. Dashboard grid: `app/src/pages/overview`, `src/routes/api/
overview.ts`/`pipeline.ts`. Cron reminders: `wrangler.jsonc:34`, `src/
index.ts:2,77`, `src/domain/reminders.ts`. **DEC-214** re-confirmed exact:
`src/routes/tasks.ts:273` — `// DEC-214: the owning speaker (never the
organizer, whose completion is a` comment opening the kind-gate guard body
(form/`responseJson`, file_request/`fileId` checks) through line 289; a
second header-restatement anchor exists at line 39 (not a duplicate
finding). **CNT-01/07, SPK tasks** CONFORM.

### J7 — Speakers self-serve everything

Branded portal, one-record-two-views edit surfaces scoped to
`auth.userId` (object-level ownership by construction), session invite
accept/decline (DEC-108 `participant.inviteStatus`), `requireSpeaker`
gating on every portal route. **SPK-07/08, CNT-02/03** CONFORM.

### J8 — Collect, review, and approve content

Typed uploads (`src/routes/files.ts`, `src/domain/files.ts`), version chain
(`src/server/repo/files.ts:66`, `previous_file_id`), comment thread (`src/
routes/files.ts:235,245,252,260,266`), content-status enum (`src/db/
schema.ts:184`) gated at the public query layer (J10). **CNT-12** CONFORMS.

### J9 — Build the agenda under constant change

Grid/tray placement (`app/src/pages/agenda`, `src/routes/agenda.ts`),
warn-never-block conflicts + counter (`src/domain/schedule.ts:2,26-66,
70-79`), auto-schedule (`src/domain/schedule.ts:108`), track colors
(schema `color` field). **AIA-01/03/04** CONFORM.

### J10 — Publish continuously to the website

Five public surfaces (`src/routes/public/{sessions,speakers,agenda,cards,
detail}.tsx`, `dispatch.tsx`, `index.tsx`), .ics w/ stable UID + SEQUENCE
bump (`src/mail/ics.ts`), embed generator (`src/routes/public/shell.tsx`,
`dispatch.tsx`, `app/src/pages/Settings.tsx`). Accepted+visible+content-
approved-only enforced in SQL, never app code: `src/server/repo/
public.ts:1-10` header + `visibleSubmissionConditions()` (DEC-108 chain at
lines 34/38). **EMB-01/04/06/14/16** CONFORM.

### J11 — Reuse the network next event

Contact directory/CSV import/history/merge/segments/dashboard: `src/domain/
contacts.ts`, `src/server/repo/contacts.ts`, `src/routes/api/contacts.ts`.
Contact -> speaker -> public ladder never collapses (same DEC-108 gate as
J10, no direct contact -> public-page path). **CRM-01, CRM area** CONFORM.

### J12 — The data stays theirs

Exports (`src/routes/api/exports.ts:1-7,27-38,43`), REST bearer tokens
(`src/routes/api/tokens.ts:1-19`), Airtable **NOT implemented**
(`grep -rli airtable src app` returns zero hits on the `f01459a` tree,
DEC-061 confirms stage-2 deferral). **CFP/CRM export+API items** CONFORM
(Airtable explicitly deferred).

## Step 3 — DEC-227..230 wave-26 fix quartet, exact-line re-confirmation

All four fixes and their required regression-test files were re-read
directly on the `f01459a` tree (not inferred from the prior audit):

- **DEC-227** (required checkbox rejects `false`): `src/forms/
  validate.ts:75-83` — `case "checkbox": {` opens at line 75, `const
  boolValue = Boolean(value);` at line 76, `if (field.required &&
  boolValue !== true) { errors[field.id] = "required"; continue; }` at
  lines 77-79, `cleaned[field.id] = boolValue;` at 81, block closes at 83.
  Task cited "~lines 75-83" — matches exactly. Regression test:
  `test/forms.test.ts`
  present, contains `requiredAgreeField` (line 45, `kind: "checkbox",
  required: true`) and an optional-checkbox counterpart (`required: false`
  at line 41) — both required and non-required checkbox cases exercised.
- **DEC-228** (Secure/HttpOnly cookie builders + 8 mint sites): `src/auth/
  cookies.ts:83-113` — `isSecureRequest` (83-86), `buildCsrfCookie`
  (94-101, `HttpOnly` unconditional + conditional `Secure`), `
  buildDraftCookie` (104-113, same pattern, `Path=/submit`). Task cited
  "~lines 83-110" — matches (builder bodies extend two lines past 110 to
  113, immaterial). All eight mint sites verified present, at the exact
  lines the task cited: `src/routes/auth.tsx:53`, `account.tsx:41`,
  `portal/index.tsx:55`, `portal/edit.tsx:58`, `portal/profile.tsx:124`,
  `portal/tasks.tsx:72`, `public/submit.tsx:85` (CSRF) and `:369` (draft
  cookie) — all eight call `buildCsrfCookie`/`buildDraftCookie` with
  `{ secure: isSecureRequest(c.req.url) }`. Zero remaining hand-minted
  `chq_csrf=` cookie strings anywhere in `src/` (`grep -rn "chq_csrf=" src
  | grep -v cookies.ts:` returns empty). Regression test:
  `test/cookie-flags.test.ts` present.
- **DEC-229** (deleteTrack referential guard, never cascades): `src/
  server/repo/events.ts:270-315` — `deleteTrack` (line 270) checks, in
  order: primary `submission.trackId` refs (274-281, 409 "referenced by
  one or more submissions"), `submissionTrack` join refs (283-290, same
  409 message), form `tracks_json` selection (296-299, 409 "referenced by
  a form's track selection"), evaluation-plan `filters_json.trackIds`
  (301-305, 409 "referenced by an evaluation plan's track filter"), and
  every plan's `plan_reviewer.track_id` scope (307-312, 409 "referenced by
  a reviewer's track scope") — the actual `db.delete` only runs at line
  314 once all five guards clear, confirming never-cascades. Task cited
  "~lines 270-315" — matches exactly (guard block spans 270-314, function
  closes at 315). Regression test: `test/track-delete-references.test.ts`
  present.
- **DEC-230** (two-candidate DST algorithm): `src/lib/timezone.ts:56-95` —
  `zonedMinutesToUtc` computes `offsetBefore`/`offsetAfter` a day on
  either side of the target wall-clock instant (67-68), branches on
  `offsetBefore === offsetAfter` for the unambiguous case (73-77), else
  validates each raw candidate by round-tripping it back through
  `offsetMsAt` (79-81): overlap (`validBefore && validAfter`, lines 83-87)
  resolves to `Math.min(candidateBefore, candidateAfter)` — the EARLIER
  instant, matching DEC-230; gap (neither candidate validates, lines
  91-94) resolves to `Math.max(candidateBefore, candidateAfter)` — FORWARD
  to the post-transition instant, matching DEC-230. Task cited "~lines
  29-95" (which includes the `offsetMsAt` helper at 29-51 feeding the
  algorithm) — matches exactly. Regression test: `test/
  timezone-dst.test.ts` present.

All four regression-test files confirmed present in the `f01459a` tree via
direct `ls`: `test/forms.test.ts`, `test/cookie-flags.test.ts`, `test/
track-delete-references.test.ts`, `test/timezone-dst.test.ts`. Full
execution against a booted server was not performed — this gate is
explicitly read-only/no-server per the task instructions; build/test
execution is the separate `task-w27-a` (build+test) gate lane's
responsibility.

## Step 4 — prior quartet + DEC-215 anchor re-confirmation (unchanged lines)

Re-read directly on `f01459a`, all identical to the `task-w25-e` citations
(no commit between `b2dc2c1` and `f01459a` touches these files' cited
lines except the four DEC-227..230 fix commits handled in Step 3 above):

- **DEC-211**: `src/routes/review.ts:625` (`// DEC-211: existence-hiding
  404 for a submission outside the plan's event,`).
- **DEC-212**: `src/domain/evaluation.ts:78` (`// DEC-212: a rating-less
  scorecard (all dropdown/text criteria, no...`).
- **DEC-213**: `src/routes/review.ts:300` (`// DEC-213: independent of the
  whole-plan criteria/scale guard above, a`).
- **DEC-214**: `src/routes/tasks.ts:273` (`// DEC-214: the owning speaker
  (never the organizer, whose completion is a`), module-header
  restatement also present unchanged at line 39.
- **DEC-215**: `src/routes/api/users.ts:95` (`// DEC-215: organizer-
  triggered password re-issue for an org user (reviewer`) — endpoint
  declaration and one-time-password-in-JSON-only body confirmed present
  in the same file, `test/users-api.test.ts` and `test/
  users-reset-password.test.ts` both present in the tree.

All five anchors hold at the exact line numbers previously confirmed;
zero drift since `task-w25-e`.

## Step 5 — docs/eval-rubric/*.yaml rubric-ID sweep

`grep -n "^  - id:" docs/eval-rubric/*.yaml | wc -l` = **116** rubric IDs
on the `f01459a` tree — identical total and identical per-file breakdown
to the `task-w25-e` count (`01-call-for-papers.yaml` 20, `02-abstract-
management.yaml` 17, `03-speaker-management.yaml` 19, `04-content-
management.yaml` 17, `05-ai-agenda.yaml` 10, `06-public-widgets.yaml` 19,
`07-speaker-crm.yaml` 14). No rubric file was added, removed, or
ID-modified between `b2dc2c1` and `f01459a`. All atomic IDs resolve to the
same implementation citations walked in Step 2 above (CFP-01..16, ABS-01/
03/05/10, SPK-07/08, CNT-01/02/03/07/12, AIA-01/03/04, EMB-01/04/06/14/16,
CRM-01, plus the remaining UI-depth/roundtrip/scoping IDs on the same
already-cited surfaces per the `task-w25-e` disposition, unaffected by the
wave-26 fix commits which are narrowly scoped to validate.ts/cookies.ts/
events.ts/timezone.ts). The scenario IDs (`-S1..S4` per file) remain
covered by the DEC-069 walkthrough gate lane, not this static-audit lane.

No requirement anywhere in J1-J12, clarifications.md, or the rubric set
was found without implementation evidence in the `f01459a` tree.

## Deferred (stage-2, explicitly out of scope per this task)

- Real deployment / `wrangler deploy` (SPEC §8, M4 milestone) — no
  deploy-pipeline code present.
- Real Resend email provider wiring — `grep -rli "resend.com\|api.resend"
  src app` returns zero hits; dev sink only (`src/mail/dev-sink.ts`).
- Airtable one-way sync (J12, DEC-061 item 5) — zero hits, confirmed above.
- DNS / CI deploy pipeline — absent.
- Resend webhooks (DEC-061 item 8) — `grep -rlin "webhook" src` returns
  zero hits.

None of the above are counted as findings; they are correctly absent from
the stage-1 tree, per DEC-061's binding text closing the SPEC §10 list.

## Disposition

Every J1-J12 job clause, every clarifications.md scope confirmation, and
every atomic eval-rubric ID resolves to cited implementation (file:line)
with covering tests where the rubric calls for `auto`/`auto-partial`
testability. The wave-26 DEC-227..230 fix quartet, the prior wave-22 defect
-fix quartet (DEC-211/212/213/214), and DEC-215 all re-confirmed at their
exact current line numbers on the `f01459a` tree:

- DEC-227: `src/forms/validate.ts:76-80` (checkbox `boolValue !== true`
  required-rejection), `test/forms.test.ts` present.
- DEC-228: `src/auth/cookies.ts:83-113` (builders), all 8 mint sites
  confirmed at the task's cited lines, zero hand-minted cookies remain,
  `test/cookie-flags.test.ts` present.
- DEC-229: `src/server/repo/events.ts:270-315` (five-guard 409, never
  cascades), `test/track-delete-references.test.ts` present.
- DEC-230: `src/lib/timezone.ts:56-95` (two-candidate DST, gap->forward,
  overlap->earlier), `test/timezone-dst.test.ts` present.
- DEC-211: `src/routes/review.ts:625` (in-event existence-hiding check).
- DEC-212: `src/domain/evaluation.ts:78-85` (rating-less short-circuit).
- DEC-213: `src/routes/review.ts:300-311` (roundCriteria freeze).
- DEC-214: `src/routes/tasks.ts:273-289` (speaker-side kind gates).
- DEC-215: `src/routes/api/users.ts:95-115` (reset-password endpoint),
  `test/users-api.test.ts` + `test/users-reset-password.test.ts` both
  present.

**OPEN ITEMS: 0** (5 stage-2 items correctly deferred, not findings).

**RESULT: PASS**
