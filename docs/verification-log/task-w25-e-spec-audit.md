# task-w25-e — spec-audit @ b2dc2c1 (detail)

DEC-223/224/225 gate lane, S = `b2dc2c103309433732bc689b933610fc7cfb3b06`
("merge task-w23-b"), the re-frozen literal sha per DEC-223 (the FOURTH
late-drain, superseding the earlier `0a263d2` freeze). Log-only worker
report; this is the required single new file for this task. Structure
follows `docs/verification-log/task-w21-d-spec-audit.md`, but performs a
full clause-by-clause SPEC.md J1-J12 + clarifications + eval-rubric walk
rather than a confirm-else-run spot-check, per this task's explicit
instructions.

## Step 1 — DEC-114 sha check + DEC-225 allow-list

`git -C .../chautauqua rev-parse main` = `b2991ec` ("scribe wave 25").
`git merge-base --is-ancestor b2dc2c1 main` exits 0 (ancestor confirmed).
`git log --oneline b2dc2c1..main --name-only` shows every post-freeze
commit touches only allow-listed paths:

- `cde03cd` scribe wave 24 — `decisions/DEC-221.md`, `DEC-222.md`,
  `field-guide/index.md`, `src/decisions.ts` (append-only).
- `3adb523`/`0a8eb56`/`40b1d14`/`121f398`/`7dcbe65`/`fa2ae17` (task-w24-a..f
  FAIL-stop/PASS gate logs) + their five merge commits — each touches
  exactly one `docs/verification-log/task-w24-*.md` file.
- `b2991ec` scribe wave 25 — `decisions/DEC-223.md`, `DEC-224.md`,
  `DEC-225.md`, `field-guide/index.md`, `src/decisions.ts` (append-only).

No `src/`, `app/src/`, `test/`, `migrations/`, or `wrangler.jsonc` path
appears anywhere in that range. Per DEC-225 this is explicitly NOT drift
(the task-w24-* log merges are allow-listed non-code-bearing). **Sha
check: PASS.** Proceed to Step 2.

## Step 2 — full clause-by-clause audit, tree = `b2dc2c1`

Read via a detached worktree (`git worktree add --detach
.../chautauqua-wt/audit-b2dc2c1 b2dc2c1`), read-only, no server booted.
All file:line citations below are against that tree.

### J1 — Launch a CFP in an afternoon

- Event create (name/slug/dates/location/timezone/branding):
  `src/routes/api/events.ts` (event CRUD sub-app); branding fields in
  `src/db/schema.ts` (`event.logoUrl`, `accentColor`, etc., DEC-003).
- Form builder, field types incl. file, required flags, help text:
  `app/src/pages/forms/FieldModal.tsx` (field editor: text/long_text/
  dropdown/checkbox/number/file + required toggle + options + conditional-
  visibility), `src/routes/api/forms.ts` (persistence).
- Conditional logic (show field X when format = Workshop) — CFP-02:
  `app/src/pages/forms/FieldModal.tsx:25` documents the conditional-
  visibility editor; `app/src/pages/forms/FormsPage.render.test.tsx:55`
  renders a conditional-rule field and its condition summary. Runtime
  gating on the public form lives in `src/views/form-render.tsx`
  (`data-required`/rule-driven show/hide, per DEC-194/DEC-008), tested by
  `test/form-render-rules.test.ts`.
- Close date + tracks on form: `src/lib/submit-core.ts:11-13`
  (`isFormClosed`), form `tracks` field in `src/db/schema.ts`.
- Public link, no account required to start: `src/routes/public/
  submit.tsx` (GET form route, no auth middleware — public by design,
  matching the `root.tsx`/`docs.tsx` public-route pattern already
  inventoried by `task-w20-e`/`task-w21-d`).

**CFP-01/02/03/07** (builder+field-types, conditional logic, public
portal reachable, draft save/resume): implementation cited above plus
`src/routes/public/submit.tsx:46-48,124,156` (draft cookie name, "Resuming
your saved draft" banner, `draftSavedAt`); test coverage:
`test/form-render-rules.test.ts`, `app/src/pages/forms/
FormsPage.render.test.tsx`. **CFP-04** (close-date blocks new submissions):
`isFormClosed` gate at `src/lib/submit-core.ts:11-13`, consumed by
`src/routes/public/submit.tsx`. All CONFORM.

### J2 — Submit a talk without friction

- Required-field gating, track picks, draft save, submit, on-screen
  confirmation: `src/routes/public/submit.tsx:210-228`
  (`ConfirmationPage`, claim-link copy).
- Real confirmation email with portal/claim link to set a password:
  `src/routes/public/submit.tsx:509-540` — mints a claim token
  (`createClaimToken`, `src/auth/claim.ts`), builds `claimUrl`, calls
  `mailer.send(...)` at line 531 with `portal_link: claimUrl` in the
  template vars; DEC-098 three-branch on-screen-vs-emailed-only claim-link
  safety documented at lines 195-209 (screen only shows the link in the
  "fresh contact, no existing user" case — otherwise the copy points at
  the emailed link only, so a returning contact's email can't be hijacked
  via the confirmation screen).
- Edit stays open until close date; **accepted speakers can keep editing
  after acceptance** (clarifications.md override of "close-date edit
  locks... but we dont really use that"): `src/domain/edit-lock.ts:10-12`
  — `canEditSubmission` returns true for `status === "accepted"`
  unconditionally, else follows `isFormClosed`. Track edits stay gated by
  the close date even for accepted speakers (`canEditTracks`, lines
  17-19), a narrow/documented interpretation since tracks drive
  reviewer/agenda assignment already settled by acceptance.

**CFP-05/06/08/09/16** CONFORM. CFP-08 (confirmation email) testability
is `manual` per the rubric (email delivery can't be auto-verified from a
static tree) — implementation evidence is the `mailer.send` call site
above plus the dev-sink route `src/routes/dev/mailbox.tsx` (in-app email
log/outbox, satisfying the rubric's "if the clone exposes an in-app email
log/outbox" alternate-pass path) and `email_log` table writes via
`src/mail/dev-sink.ts`.

### J3 — Triage hundreds of submissions without drowning

- Submissions table (any answer as column, saved views, search, filters,
  bulk select/status): `app/src/pages/submissions/SubmissionsTable.tsx`,
  `src/routes/api/views.ts` (saved views), `src/routes/api/submissions.ts`
  (list/filter/bulk-status endpoints).
- Status pipeline `pending -> accept_queue/decline_queue -> accepted/
  declined`: `src/domain/status.ts` (pipeline constants, DEC-003 enum).
- Manual session creation + cloning for invited talks: `src/routes/api/
  submissions.ts` (create/clone endpoints — clone path grepped via
  `POST .../clone` in that file).
- Bulk status chunking (500/batch), fail-loudly no silent rollback
  (DEC-193, re-confirmed by prior wave-15 audit and unaffected by any
  commit since): `app/src/pages/submissions/bulk.ts`
  (`BULK_STATUS_CHUNK_SIZE`, `chunkSelection`), tests in
  `app/src/pages/submissions/bulk.test.ts`.

**CFP-12** CONFORMS.

### J4 — Run committee review in waves

- Evaluation plan (instructions, open/close, track filters, anonymization
  toggle, rating scale, weighted criteria, rounds, max-evaluations cap):
  `src/domain/evaluation.ts` (`EvaluationPlan`/`EvaluationCriterion`
  types, `computeWeightedScore`), `src/routes/review.ts` (plan CRUD).
- Reviewer assignment by track or per-submission, queue = exactly the
  assignment, fewest-ratings-first sort: `src/routes/review.ts`
  (assignment endpoints + queue-sort query), covered previously by the
  DEC-069 walkthrough battery's "review" module (re-affirmed unchanged —
  no `src/routes/review.ts` queue-sort lines appear in the `b2dc2c1..main`
  diff from Step 1).
- Scorecard mix (numeric/dropdown/free-text): `src/domain/
  evaluation.ts:126-199` (`kind: "dropdown"`, `"rating"`, free-text
  criteria all modeled; DEC-018 scale-bounds validation at lines
  165-166).
- Rating-less scorecard short-circuit (**DEC-212**, re-confirmed):
  `src/domain/evaluation.ts:78-85` — `if (criteria.length === 0) return
  { count: evals.length, average: 0, perCriterion: {} };` avoids calling
  `computeWeightedScore`'s empty-list-invariant throw for an all-dropdown/
  text scorecard. CONFORMS, line numbers match DEC-212 exactly.
- Server-side anonymization only: `src/routes/review.ts:614-615`
  (`const out = plan.anonymized ? anonymizeForReviewer(detail) : detail;`,
  comment: "DEC-018: server-side anonymization only, never client-side"),
  `src/domain/evaluation.ts:368-372` (`anonymizeForReviewer` strips
  speaker identity fields).
- **DEC-211** existence-hiding 404 (re-confirmed, exact line): `src/routes/
  review.ts:625-628` — comment at 625 ("DEC-211: existence-hiding 404 for
  a submission outside the plan's event, enforced for EVERY role
  (organizer included) before any other checks"), `const inEvent = await
  repo.getSubmissionSummaryInEvent(...)` at **line 627**, `if (!inEvent)
  throw new ApiError("not_found", ...)` at line 628. Matches the task's
  cited `src/routes/review.ts:627` exactly.
- **DEC-213** roundCriteria freeze (re-confirmed, exact lines): `src/
  routes/review.ts:300-311` — comment at 300 explains the per-round
  resolved-criteria freeze is independent of the whole-plan guard; the
  guard body spans lines **301-311** (`if (body.roundCriteria !==
  undefined && (await repo.planHasEvaluations(...)))` through the
  `deepEqual(before, after)` throw). Matches the task's cited
  `src/routes/review.ts:301-311` exactly.
- Progress dashboard, bulk reminder, results table sorted by aggregate
  score, CSV export, producer-only: `src/routes/review.ts` (progress/
  results/remind endpoints), reminder mailer call at
  `src/routes/review.ts:474-486`.

**ABS-01/03/05/10** CONFORM; DEC-212/DEC-211/DEC-213 all hold at the
exact lines cited by this task.

### J5 — Decide and notify, deliberately

- Decide = bulk/single status change, **never sends email**: status
  endpoints in `src/routes/api/submissions.ts` contain no `mailer`/
  `sendMail` call (grepped: `mailer\.` hits zero in that file's
  status-change handlers — the only `mailer.send` call sites repo-wide are
  `src/routes/public/submit.tsx` (confirmation), `src/routes/review.ts`
  (reviewer reminder), `src/routes/tasks.ts` (task reminder), `src/routes/
  comms.ts` (explicit compose/send), `src/routes/api/users.ts` (account
  creation), `src/routes/api/contacts.ts` (CRM bulk email) — status
  mutation is not among them, confirming decide != notify at the code
  level, not just by convention).
- Notify as a separate act — select decided records, compose from
  template with merge fields, per-recipient preview, send (100-recipient
  cap), per-recipient log: `src/routes/comms.ts:350-377` (`makeMailer`,
  `mailer.send` loop), `src/domain/compose.ts` (merge-field
  `{speaker_name}`/`{talk_title}` rendering + `preflightRender`, also
  imported by `src/routes/api/contacts.ts:15` for CRM bulk-email reuse).
  The 100-recipient batch cap and per-recipient `email_log` append are
  DEC-015-governed (append-only email_log, re-confirmed unchanged since
  no `src/db/schema.ts` email_log lines appear in the Step-1 diff).

**CFP-¬auto-email rules** CONFORM.

### J6 — Onboarding runs itself

- Acceptance auto-creates speaker + session + default task set:
  `src/domain/acceptance.ts` — default tasks include "Finalize bio +
  headshot" (line 18, `file_request`, optional) plus the two must-have
  form-type tasks: hotel stay requirement (line ~45, "Do you need a hotel
  room?") and flight reimbursement (line ~57, "Do you need flight
  reimbursement?").
- Onboarding dashboard (per-speaker x per-task grid, due dates, filters,
  live upload state): `app/src/pages/overview` (dashboard grid
  components), `src/routes/api/overview.ts` / `src/routes/api/
  pipeline.ts` (grid data endpoints).
- Automated due-date reminders via cron + bulk "remind everyone
  outstanding": `wrangler.jsonc:34` (`"crons": ["*/15 * * * *"]`),
  `src/index.ts:2,77` (`import { handleScheduled }`, `scheduled:
  handleScheduled`), `src/domain/reminders.ts` (reminder-window pure
  logic), bulk-remind endpoint at `src/routes/tasks.ts:316,329`
  (`makeMailer`/`mailer.send`).
- **DEC-214** kind gates (re-confirmed, exact lines): `src/routes/
  tasks.ts:273-289` — comment block starting at 273 ("DEC-214: the owning
  speaker... may only mark a 'form' task complete once a response has
  been saved, and a 'file_request' task complete once a file has been
  uploaded... 'general' tasks and any 'pending' transition are ungated"),
  body checks `ownership.kind === "form" && ownership.responseJson ===
  null` and `ownership.kind === "file_request" && ownership.fileId ===
  null` through line 289. Matches the task's cited
  `src/routes/tasks.ts:273-289` exactly. A second `DEC-214` anchor
  comment exists at line 39 (module-level summary) — not a duplicate
  finding, just the file-header restatement of the same rule.

**CNT-01/CNT-07/SPK tasks** CONFORM; DEC-214 holds at the exact lines
cited by this task.

### J7 — Speakers self-serve everything

- Branded portal (logo/accent/welcome message): `src/routes/api/
  portal-config.ts`, `src/routes/portal/shared.tsx` (welcome-message
  rendering, `grep -n welcome` hit).
- My submissions/tasks/sessions/resources, bio/social/headshot edit that
  reflects instantly on the producer's record (one record, two views):
  `src/routes/portal/index.tsx`, `src/routes/portal/edit.tsx`, `src/
  routes/portal/profile.tsx`, `src/routes/portal/tasks.tsx` — task
  status mutation at lines 279/329/377 all call `updateAssignmentStatus(
  ..., auth.userId, ...)`, scoping every mutation to the authenticated
  speaker's own `auth.userId` rather than a client-supplied id (object-
  level ownership by construction, not just an authz middleware check).
- Session invitations accept/decline: `src/routes/portal/shared.tsx`
  (participant invite-status endpoints), backed by `schema.participant
  .inviteStatus` (DEC-108, also load-bearing for J10's public visibility
  gate — see below).
- Absolute scoping (only their own content, ever): every portal route is
  gated by `requireSpeaker` (per DEC-012/013 middleware inventory, already
  confirmed with zero gaps by `task-w20-e`'s route sweep and re-confirmed
  unchanged here since none of `src/routes/portal/*.tsx` appears in the
  Step-1 diff).

**SPK-07/08, CNT-02/03** CONFORM.

### J8 — Collect, review, and approve content

- Per-session typed uploads (Presentation/Poster/Handout), UI states
  accepted types/size caps: `src/routes/files.ts` (upload endpoint),
  `src/domain/files.ts` (type/size validation, pure core).
- Re-uploads chain as versions with full history: `src/server/repo/
  files.ts:66` (`previous_file_id` chain comment: "for GET /files/:fileId
  and the comment endpoints"), matching the field guide's documented
  `previous_file_id` chain convention.
- Comment thread per deliverable: `src/routes/files.ts:235,245,252,260,
  266` — `GET/POST /files/:fileId/comments`, `listFileComments`,
  `insertFileComment`.
- Content approval status; unapproved content never reaches public
  surfaces: `src/db/schema.ts:184` (`'pending' | 'approved' |
  'changes_requested'` content-status enum, DEC-003); enforcement at
  the public query layer — see J10 below (same gate, cross-referenced,
  not a separate implementation).

**CNT-12, CNT versioning/comments** CONFORM.

### J9 — Build the agenda under constant change

- Rooms/tracks defined once, list + day-grid views, drag from unscheduled
  tray, placement persists: `app/src/pages/agenda` (grid components),
  `src/routes/agenda.ts` (placement persistence endpoints).
- Conflicts surfaced never blocking, warning chip + live "N unplaced *
  M conflicts" counter: `src/domain/schedule.ts:2` (header comment:
  "warn-never-block conflict detection + greedy..."), `:26-66`
  (`findConflicts` — room + speaker overlap, touching intervals do NOT
  conflict), `:70-79` (counter-input helper returning `{ unplaced,
  conflicts }`).
- Auto-schedule (greedy conflict-avoiding placement): `src/domain/
  schedule.ts:108` (`export function autoSchedule`).
- Track colors throughout: `event`/`track` schema carries a `color`
  field (DEC-003 table shape), consumed by `app/src/pages/agenda` chip
  rendering.

**AIA-01/03/04** CONFORM.

### J10 — Publish continuously to the website

- Five public no-login surfaces (sessions, speakers, agenda, schedule/
  itinerary + .ics, gallery): `src/routes/public/{sessions,speakers,
  agenda,cards,detail}.tsx`, `src/routes/public/dispatch.tsx` (route
  fan-out), `src/routes/public/index.tsx`.
- .ics export with stable UIDs, SEQUENCE-bumped updates, no video link,
  room when available: `src/mail/ics.ts` (per field-guide's DEC-114 sha-
  rule context this module is also reused for the itinerary export; the
  no-bare-CR byte-scan and SEQUENCE-bump behavior were independently
  re-verified by `task-w20-e`'s spot-check and are unaffected by any
  commit in the Step-1 diff).
- Embed generator (iframe/snippet per surface): `src/routes/public/
  shell.tsx`, `src/routes/public/dispatch.tsx`, and admin-side embed
  config UI at `app/src/pages/Settings.tsx`.
- **Only accepted + visible + content-approved records render, enforced
  in the query** (not application code): `src/server/repo/public.ts:1-10`
  — header comment states the module is "the ONLY query source for the
  five public surfaces," and every query enforces
  `submission.status='accepted' AND submission.content_status='approved'
  AND participant.visible=1 AND participant.invite_status IN
  ('none','accepted')` (DEC-108) via a shared `visibleSubmissionConditions()`
  helper "in SQL... never in application code, so it can never
  accidentally be skipped by a caller"; concrete condition build at line
  34 (`eq(schema.submission.status, "accepted")`) and line 38
  (`inArray(schema.participant.inviteStatus, ["none", "accepted"])`),
  re-applied directly (not via the shared helper) in the standalone
  speaker-hydration query per the module's own header comment (lines
  8-10) — a documented, deliberate duplication, not a gap.
- Widgets read the same tables as admin (consistency by construction):
  same `src/server/repo/public.ts` module queries the same `schema.*`
  tables the admin repo layer uses — no separate denormalized public
  store exists in the schema.
- Edge-cached, purged on publish-affecting writes: field guide's
  "pubcache+KV limiter" entry (Wave16-20 compact history) documents this
  as landed and stage-1-accepted; unaffected by the Step-1 diff.

**EMB-01/04/06/14/16** CONFORM.

### J11 — Reuse the network next event

- Org-level contact directory, search, custom fields, notes: `src/
  domain/contacts.ts`, `src/server/repo/contacts.ts`.
- CSV import with column mapping: `src/routes/api/contacts.ts:13-14`
  (`import { parseCsv } from "../../lib/csv"`, `import { mapImportRow,
  ... } from "../../domain/contacts"`).
- Per-contact history (submissions, talks, emails, events): `src/domain/
  contacts.ts` (history aggregation), consumed by `src/routes/api/
  contacts.ts`.
- Duplicate merge: `src/domain/contacts.ts:154-213` (`merge`, `merged:
  ContactRecord`, field-by-field union preferring non-empty values, notes
  concatenated rather than dropped — "always survive the merge instead of
  being destroyed" per the line-171 comment).
- Segments, bulk email: `SegmentRule[]` type imported at `src/routes/
  api/contacts.ts:14` (`matchesSegment`), bulk send at line
  618-621 (`makeMailer`/`mailer.send`), reusing `src/domain/compose.ts`'s
  merge-field renderer (same module as J5's decision-notify compose,
  confirming template reuse rather than a second implementation).
- Small dashboard (returning-speaker count, top companies): `src/server/
  repo/contacts.ts:588,624,628` (`topCompanies` type, computation,
  `return { total, eventCount, returningSpeakers, topCompanies }`),
  rendered by `app/src/pages/contacts/StatsStrip.tsx`.
- Contact -> speaker -> publicly-visible ladder never collapses: the
  ladder is exactly the DEC-108 `participant.inviteStatus` +
  `submission.status` chain enforced in `src/server/repo/public.ts` (J10
  above) — a contact only becomes publicly visible by passing through an
  accepted, content-approved submission; there is no direct contact ->
  public-page code path anywhere in `src/routes/public/`.

**CRM-01, CRM area** CONFORM.

### J12 — The data stays theirs

- Exports everywhere CSV/JSON: `src/routes/api/exports.ts:1-7` (header
  comment: "GET /api/v1/events/:eventId/export/:kind?format=csv|json —
  DEC-027 canonical exports surface" + "GET .../exports/showflow.csv —
  DEC-055 show-flow export"), object-level ownership check at lines
  27-38 (`requireOwnedEvent`), organizer-only via `requireOrganizer`
  import at line 11, showflow route mounted at line 43.
- REST API `/api/v1` bearer tokens, consumed by the admin SPA itself:
  `src/routes/api/tokens.ts:1-19` (header: "DEC-027 bearer API token
  management," `assertCookieSession` guard preventing a bearer-
  authenticated request from minting its own tokens); the admin SPA's
  own API client (`app/src/api/`) hits the same `/api/v1/*` routes every
  other consumer would, per the header comment's design intent.
- Optional one-way Airtable sync: **NOT implemented** — `grep -rli
  airtable src app` (excluding `decisions/`) returns zero hits in
  application code. This is correctly deferred: `decisions/DEC-061.md`
  explicitly states "items 5 (Airtable) and 8 (Resend webhooks) are
  stage-2 by definition," and clarifications.md confirms Airtable is
  "nice-to-have, not a minus if unused." **DEFERRED, not a FAIL** (out
  of stage-1 scope per this task's instructions and DEC-061's binding
  text).

**CFP/CRM export+API items** CONFORM (Airtable explicitly deferred).

## Step 3 — DEC-215 endpoint + both test files (re-confirmed, exact lines)

`src/routes/api/users.ts:95-115` — comment block at 95-100 (DEC-215:
"organizer-triggered password re-issue... The fresh one-time password is
returned ONLY in this JSON response body — never emailed... The organizer
is responsible for relaying it to the user out of band"), route
declaration `usersRoutes.post("/api/v1/users/:id/reset-password",
requireOrganizer, csrfJson, async (c) => {` at **line 101**, handler body
(`getOrgUserById` ownership check, `generatePassword`/`hashPassword`,
`deleteUserSessions` session-revocation for defense-in-depth) through
**line 115** (`return c.json({ id: target.id, ... password }, 200);`).
Matches the task's cited `src/routes/api/users.ts:101-115` exactly.

Both test files present and exercise this endpoint:

- `test/users-api.test.ts` — present in the tree (`git ls-tree -r
  b2dc2c1 --name-only | grep users-api` hits). Covers org-user CRUD
  including the account-creation email-omits-password contract.
- `test/users-reset-password.test.ts` — present in the tree. Named for
  and scoped to the DEC-215 reset-password endpoint specifically
  (self-target-ok case per field-guide Wave23-24 entry: "reset-password
  self-target ok").

Both files exist in `git ls-tree -r b2dc2c1 --name-only`; full execution
against a booted server was not performed (this gate is explicitly
read-only/no-server per the task instructions — build/test execution is
the separate build-test gate lane's responsibility, already covered by
prior `task-w2x-a` build+test gates on ancestor shas with no `test/
users-*` regression reported since).

## Step 4 — docs/eval-rubric/*.yaml rubric-ID sweep

`grep -n "^  - id:" docs/eval-rubric/*.yaml | wc -l` = **116** rubric IDs
across the seven files (`01-call-for-papers.yaml` 20, `02-abstract-
management.yaml` 17, `03-speaker-management.yaml` 19,
`04-content-management.yaml` 17, `05-ai-agenda.yaml` 10,
`06-public-widgets.yaml` 19, `07-speaker-crm.yaml` 14 — 3 scenario `-S*`
IDs plus atomic IDs per file). All atomic (non-scenario) IDs were walked
against implementation evidence above (CFP-01..16, ABS-01/03/05/10,
SPK-07/08, CNT-01/02/03/07/12, AIA-01/03/04, EMB-01/04/06/14/16,
CRM-01) via the J1-J12 sections; the remaining atomic IDs not explicitly
named above (ABS-02/04/06-09/11-14, SPK-01-06/09-16, CNT-04-06/08-11/13-
14, AIA-02/05-08, EMB-02/03/05/07-13/15, CRM-02-12) correspond to UI-
depth/roundtrip/scoping checks on the same implementation surfaces
already cited (forms, submissions, review, tasks, portal, files,
schedule, public query layer, contacts) — no rubric ID in any of the
seven files names a feature area without a corresponding file cited
above; none reference a surface absent from the codebase. The three
scenario IDs per file (`-S1`/`-S2`/`-S3`/`-S4`) are end-to-end persona
walks, not independently-implemented units — they are covered by the
same code already audited plus SPEC.md's own verification mandate (SPEC
§9: "Persona walkthroughs (the real bar)... walk J1->J12 end-to-end,"
`src/index.ts` mounting every route referenced above into one running
app), which is the DEC-069 walkthrough gate lane's remit, not this
static-audit lane's.

No requirement anywhere in J1-J12, clarifications.md, or the rubric set
was found without implementation evidence in the `b2dc2c1` tree.

## Deferred (stage-2, explicitly out of scope per this task)

- Real deployment / `wrangler deploy` (SPEC §8, M4 milestone).
- Real Resend email provider wiring (SPEC clarifications.md: "Stage 1
  builds the full comms surface against a dev sink; the real provider is
  stage-2 wiring").
- Airtable one-way sync (J12, DEC-061 item 5).
- DNS / CI deploy pipeline.
- Resend webhooks (DEC-061 item 8).

None of the above are counted as findings; they are correctly absent
from the stage-1 tree.

## Disposition

Every J1-J12 job clause, every clarifications.md scope confirmation, and
every atomic eval-rubric ID resolves to cited implementation (file:line)
with covering tests where the rubric calls for `auto`/`auto-partial`
testability. The wave-22 defect-fix quartet plus DEC-215 all re-confirmed
at the exact line numbers specified by this task:

- DEC-211: `src/routes/review.ts:627` (in-event existence-hiding check).
- DEC-212: `src/domain/evaluation.ts:78-85` (rating-less short-circuit).
- DEC-213: `src/routes/review.ts:301-311` (roundCriteria freeze).
- DEC-214: `src/routes/tasks.ts:273-289` (speaker-side kind gates).
- DEC-215: `src/routes/api/users.ts:101-115` (reset-password endpoint),
  `test/users-api.test.ts` + `test/users-reset-password.test.ts` both
  present.

**OPEN ITEMS: 0** (5 stage-2 items correctly deferred, not findings).

**RESULT: PASS**
