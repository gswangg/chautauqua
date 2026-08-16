## TIER 0 (continued) — dismissed / stale / do-not-re-file

### DISMISSED review-lens/instrument alarms

- **`0193`/`0195`/`0196`/`0213` `scripts/perf-seed.ts` perf-speaker wiring
  gap** — DISMISSED, FALSE, re-checked this wave. `grep -c PERF_SPEAKER
  scripts/perf-seed.ts` = 13 at `6edb5263`; perf contact/user/participant
  inserts at `scripts/perf-seed.ts:608,627,643,659`. `0210` (wave-42
  triage-closure) already ruled this CLOSED; `0213` (a sibling wave-42
  lane, same wave) re-filed it as CONFIRMED-DEFECT anyway with no
  contradicting grep of its own — re-derived directly this wave and `0210`
  is the verdict that holds. `scripts/` is out of this task's write scope
  (DEC-358 w44); nothing to fix here, the wiring already exists.
- **`0197`/`0213` row 2 `resolveBaseUrl` dev-loopback footgun** —
  NOT-A-DEFECT (standing reclassification, carried from `0213`'s own read,
  unchanged this wave). `src/server/origin.ts:123-128`: outside `devMode`,
  an unset `PUBLIC_BASE_URL` throws (`resolveBaseUrl: PUBLIC_BASE_URL is
  not set...`) rather than guessing from the request `Host` header
  (DEC-252 wave-18 amendment) — the footgun is dev-only, and stage-2
  provisioning is the actual fix surface (analogous to the email-provider
  framing in `docs/clarifications.md:33`). Re-read directly at `6edb5263`;
  standing verdict, not re-litigated.
- **Bare-email login-account budget locks the real owner out** — DISMISSED
  this wave, FIXED in-tree. `src/routes/auth-helpers.ts:69`
  (`AUTH_ACCOUNT_RATE_LIMIT_MAX`) + `src/routes/auth-login.tsx:79-135`
  (DEC-072 wave-38 amendment): the bare-email `login-account` bucket is now
  a SOFT failure budget, not an admission gate — exhausting it forces a
  WRONG password to 429 instead of 401, while the CORRECT password still
  succeeds, so a stranger who merely knows the victim's address can no
  longer lock the real owner out with no unlock path. Re-read directly at
  `b71a1358`; not a code-shape guess.
- **`api/users.ts` routes reachable without a cookie session** — DISMISSED
  this wave, FIXED in-tree. `src/routes/api/users.ts:67,138,168` — the
  list, create, reset-password and role-patch handlers all carry
  `requireCookieSession` alongside `requireOrganizer`/`csrfJson`.
  FALSIFYING CHECK: `test/users-bearer-containment.test.ts`,
  `test/credential-route-cookie-session.scan.test.ts` (a scan-lock, so a
  future route added without the guard fails it too, not just these four).
- **Task-reminder due-day label drifts from the shared helper** —
  DISMISSED this wave, FIXED in-tree.
  `src/server/repo/tasks/reminders.ts:29,148` imports and calls the shared
  `effectiveAssignmentDueDayLabel` (`src/domain/task-due.ts`) rather than
  a local recompute. FALSIFYING CHECK: `test/task-due.test.ts`.
- **`rule-match.ts` silently resolves an unknown rule op** — DISMISSED
  this wave, FIXED in-tree. `src/forms/rule-match.ts:145` throws
  `Error('unknown rule op: ' + rule.op)` rather than falling through to a
  default. FALSIFYING CHECK: `test/forms-rule-match.test.ts`.
- **`task-w17-i` (DEC-716, sign-in names the event and its open CFP)** —
  DISMISSED as an open scope, LANDED BY ANOTHER PATH. The literal
  `task-w17-i` branch (`7b78d8b6`) is still unmerged and stale, but its
  scope shipped via a different lane:
  `loadSingleEventContext` (`src/routes/auth-helpers.ts:98-106`) is
  consumed at all three `LoginPage` render sites in
  `src/routes/auth-login.tsx:50,146,169,198`. Re-read directly at
  `b71a1358`. Moved from IN FLIGHT to here — do not re-file the scope, and
  do not resurrect the `task-w17-i` branch on the strength of the old
  "OWNED BY" line.
- **Wave-39 plan-progress rewrite undercounts `total`** — DISMISSED this
  wave, review-lens question re-read and found FALSE.
  `src/routes/review/plans-progress.ts:129-131` computes
  `const total = users.length;` BEFORE `users.slice(start, start + perPage)`
  runs — `total` still reads the full reviewer set, never the paged
  slice's length. The wave-39 fan-out-kill refactor (DEC-829) did not
  change this semantic.
- **"DEC-358 cited with no backing"** — DISMISSED, `decisions/DEC-358.md:9-11`
  carries the wave-27 compaction amendment verbatim; a decision file is its
  own backing.
- **"37 failing tests"** — DISMISSED, suite green, reconfirmed at `f5783479`
  by `task-w36-a`: `docs/verification-log/task-w36-a-build-test-f5783479.md`
  — "Test Files 1084 passed (1084)", "Tests 11898 passed (11898)", bundle
  69.20 kB gzip vs 300 kB budget.
- **DEC-244 "version 2" walkthrough defect** — DISMISSED, instrument bug,
  repaired, PASS twice — `docs/verification-log.md:3912-3930` (ad hoc
  `file_request` task minted+assigned same-run so no seed loop
  pre-completed it; repaired script creates both versions itself).
- **`migrations/0039_user_name.sql` untracked-file alarm** — DISMISSED,
  `docs/verification-log/task-w28-c-perf-smoke-c6dbdb7c.md:15`: "all 39
  migrations (`0001`..`0039`) applied ✅" — tracked and applied. Migration
  count reconfirmed current: `task-w36-b`'s walkthrough ran `db:migrate` to
  43 migrations at `f5783479` clean.
- **"routes lacking `requireOrganizer`"** — DISMISSED, mount-guarded: admin
  sub-apps are guarded at the mount point, not re-declared per route, and
  several handlers additionally carry inline `c.var.auth.role` checks a
  route-signature grep for the literal string does not recognize — grepping
  under-reports the guarded surface by construction.
- **"`.chq-participation-menu-caret` contrast row has no gate check"** —
  RESOLVED, not just dismissed. `task-w35-b` found the gap; `task-w36-e`
  built the gate row and closed it (see TIER 0 CLOSED entry above). Do not
  re-file.

### STALE-ON-MEASUREMENT (do not re-file — closed, re-checked this wave)

- **`.chq-review-checkbox-label` contrast** ratio 3.09 — NOT a live defect.
  Closed via DEC-426's wave-29 exemption path: an inactive-component
  disabled-token pair (`--chq-disabled` on `--chq-disabled-bg`) is exempt
  under WCAG 2.1 SC 1.4.3, recorded as `EXEMPT-BY-RULE` rather than a FAIL
  — `scripts/render-sweep-contrast.ts:77-84,112-115` (the `exempted`/
  `exemptNote` fields), asserted by `test/render-sweep-contrast.test.ts:61`.
  Reconfirmed present in `task-w36-e`'s wave-36 fresh full-gate run at
  `f5783479` (contrast `60/60`, advisory, zero FAIL rows).
- **Mobile render-sweep console-error collection** — CLOSED, DEC-253
  wave-30 amendment: `scripts/render-sweep.ts:1023-1032` attaches the same
  `console`/`pageerror` collectors to the phone-viewport pass that the
  desktop pass already had, because a phone-only component (e.g.
  `PhoneAgenda`) mounts only at 390px and the desktop pass never observed
  its errors. Not a live gap.
- **Chunked/absent-`Content-Length` `application/x-www-form-urlencoded` and
  `multipart/form-data` body refusal** — CLOSED, DEC-020 wave-30 amendment
  (body-limit ceiling): `src/server/body-limit.ts:30-55` refuses an absent
  `Content-Length` for exactly those two content-types (buffered whole
  BEFORE auth by `csrfForm`'s `c.req.parseBody()`,
  `src/server/middleware.ts:283`), leaving JSON/other bodies (read only
  inside handlers behind `requireRole`/`csrfJson`) unrestricted by design —
  not a live gap.
- **`logoUrl` XSS** — CLOSED via `safeImageSrc`
  (`src/domain/brand-url.ts:25`), applied at the portal settings read door
  (`src/server/repo/portal/data.ts:167`) — rejects non-`http(s)`/`data:`
  image sources before they reach a self-hosted branding `<img src>`. Not a
  live gap.
- **Content-note zero-recipient 400** — CLOSED, DEC-317/DEC-720 wave-30
  amendment: `src/routes/content-notes.ts:8` — zero recipients is
  deliberately not an error (the durable content-status write proceeds
  regardless of whether any recipient exists to notify). Not a live gap.
- **AUDIT.md compose recipient cap claim** — CLOSED, DEC-618: `docs/AUDIT.md`
  previously mis-stated the compose cap as `MAX_PER_PAGE=200`; the real
  cap is `MAX_COMPOSE_RECIPIENTS = 100`
  (`src/domain/compose.ts:9`, enforced at
  `src/routes/comms/compose-core.ts:107-109`). The doc was corrected, and
  `test/audit-claims.test.ts` now resolves every `METHOD /path` backtick
  span against the composed route table so a future drift fails a test
  instead of sitting silently. Not a live gap.
- **Acceptance task fan-out** (one task minted per accepted participant
  rather than one per submission) — DELIBERATE, DEC-932. Not a live gap.

### RULED-NOT-IMPLEMENTED (DEC-358 wave-31 amendment)

No item currently qualifies for this tier at this boundary (`494b6c01`) —
every DEC amendment checked across waves 29-37 (DEC-773 wave-29/31, DEC-830
wave-29, DEC-829 wave-32, DEC-644 wave-31/32/35/36/37, DEC-099 wave-35,
DEC-426 wave-36) has either a landed, ref-verified fix or, as of this wave,
a resolved joint-boundary reading (see TIER 0 OWNED above — both rows now
have a verdict, one CLOSED and one a confirmed FAIL/regression, neither is
"zero commits" or "no reading yet"). Section kept (empty) so a future wave
files into it rather than re-deriving the header, and so "checked, none
found" is itself a citation.

### DISMISSED-VERIFIED-CLOSED (carried, wave 24-29 boundaries, not re-checked this wave beyond ref presence)

- **`task-w29-f` / `0174`-G / `0210` "admin Speakers `[List | Grid]`
  toolbar missing"** — VOID, DISMISSED-VERIFIED-CLOSED, RE-FILED AND
  RE-DISMISSED AGAIN THIS WAVE (third time this row has been closed — see
  RESTATED DO-NOT-RE-FILE note below). The wave-28 gate quoted
  `docs/design/README.md:350` under the heading `:343` "Public filter bar —
  one idiom, four surfaces" (`:345` names Sessions/Agenda/Speakers/Home as
  the four PUBLIC surfaces this row governs), then searched the admin
  onboarding-grid toolbar — irrelevant, never named by that quote. The
  named controls are already built PUBLIC-side: `SpeakerViewToggle`
  (`src/routes/public/speakers.tsx:20`, rendered `:235`/`:314`,
  `aria-current` at `:45`/`:52`) and `TrackFacetSelect` (`:72-103`);
  verified by `test/public-speakers-filter-bar.render.test.ts`. Re-verified
  at `6edb5263` this wave (file:line re-read directly, not inherited) and
  independently cross-checked against task-w44-f's own `0225` row for the
  same item, same verdict. **RESTATED, STRONGER: do not re-file this row a
  fourth time.** It was ruled VOID here at the wave-37/38 boundary, closed
  again as DISMISSED-VERIFIED-CLOSED at wave-41, and STILL re-filed as an
  open item by wave-42's `0210` triage-closure section — a `docs/design/
  README.md` heading naming the PUBLIC surfaces is not evidence of an
  ADMIN gap, and grepping for a control under `app/src/pages/speakers/**`
  will never find it because it was never spec'd to live there. Do not
  touch `app/src/pages/speakers/**` on this basis.
- `src/routes/tasks.ts` onboarding-grid status refuses unrecognised tokens
  — `src/routes/tasks.ts:164-213` (DEC-340 wave-18 amendment).
  FALSIFYING CHECK (wave-39, DEC-358): `test/onboarding-grid-query.test.ts` —
  opened and confirmed it exercises `parseOnboardingGridQuery` directly
  (not the route), asserting (a) a lone unrecognised `status` throws
  `ApiError('invalid')` with `fields.status` set, (b) a lone unrecognised
  `overdueOnly` token throws the same shape, and (c) `status: "bogus"` +
  `inviteStatus: "nope"` together throw ONE `ApiError` whose `fields` names
  BOTH `status` AND `inviteStatus` — i.e. the accumulate-both-bad-tokens
  shape at `:208-210` is covered, not just the single-bad-token case.
  Reverting the accumulate-then-throw block to a first-bad-token-wins throw
  would fail the two-bad-tokens assertion.
- `countEvaluationsBySubmission` caps `MAX_PLAN_SUBMISSION_SCAN + 1` —
  `src/server/repo/review/evaluations.ts`. FALSIFYING CHECK (wave-39,
  DEC-358): `test/review-repo-aggregates.test.ts`'s
  "refuses past MAX_PLAN_SUBMISSION_SCAN distinct submissions, in submission
  vocabulary" — builds `MAX_PLAN_SUBMISSION_SCAN + 1` distinct-submission
  fixture rows through a fake db that recovers and applies the repo
  function's actual drizzle `where` bindings, then asserts the call rejects
  with an `ApiError` whose message contains
  `"more than {cap} submissions"`. Reverting the cap check would resolve
  instead of reject.
- `isSubmissionInReviewerScope` shares `resolveReviewerSubmissions`'s cap —
  `src/server/repo/review/submissions.ts:396-407` vs `:241-252`. This claim
  was FALSE AS AN "already covered" claim: every existing call site that
  imports `isSubmissionInReviewerScope` (`review-idor.test.ts`,
  `admin-list-bounds-review.test.ts`, `eval-scorecard-caps.test.ts`, and
  others) mocks the function rather than exercising its real cap-refusal —
  a revert of the `:401-407` cap check would have passed every test in the
  tree silently before this wave. WRITTEN this wave:
  `test/tier0-falsifiability.test.ts` — asserts, against the real function
  and the real `MAX_REVIEWER_SCOPE_ROWS` constant, that (a) a plan_reviewer
  read of `MAX_REVIEWER_SCOPE_ROWS + 1` rows rejects with an `ApiError`
  naming the cap, (b) exactly-at-cap resolves without throwing. Observable
  behavior only (thrown error + message), never query shape/call order, per
  this wave's co-ownership note with task-w39-d/e.
- `clearSessionCookie` appends `Secure` like `buildSessionCookie` —
  `src/auth/cookies.ts:32-44` vs `:18-30`. FALSIFYING CHECK (wave-39,
  DEC-358): `test/cookie-flags.test.ts`'s `clearSessionCookie` describe
  block — asserts (a) `secure:false` omits `Secure` entirely, (b)
  `secure:true` appends `; Secure` as the last attribute, and (c) a direct
  attribute-name-order comparison against `buildSessionCookie({secure:true})`
  (minus the token/Max-Age value) so the two builders' Secure-placement
  can't silently drift apart. Reverting either builder to unconditionally
  omit/include `Secure` fails (a)/(b); reordering one relative to the other
  fails (c).
- Public sessions LIST hydrates speakers via `visibleParticipantConditions()`
  — `src/server/repo/public/sessions.ts:405-417`. FALSIFYING CHECK (wave-39,
  DEC-358): `test/public-invite-visibility.test.ts`'s "the hydrateSessions
  speaker-hydration query gates on visibleParticipantConditions()" — slices
  `hydrateSessions`'s body around its `schema.participant.submissionId,
  batch` call site and asserts the literal `visibleParticipantConditions()`
  call appears in that slice (not merely present anywhere in the file).
  Removing the call from that query's `.where(...)` (even while leaving the
  function/import elsewhere) fails this. Weaker than a runtime probe, but
  pinned to the actual call site, so a revert of THIS behavior (not just
  deletion of the function) is caught; `test/participant-invite-audience.scan.test.ts`'s
  scan-lock backs this further (a marker-less rewrite of the query fails
  that scan too), cited as supporting, not primary.
- `isSlugTaken` has no `orgId` predicate, DELIBERATE (`/e/:slug` global
  namespace) — `src/server/repo/events.ts:141-147`. DELIBERATE-BY-DESIGN,
  not a defect; falsifiability n/a.
- **DISCHARGED — batch A, `docs/mandates/w41-falsifiability-batch-a.md`,
  `task-w41-d`, MERGED.** Six items opened and closed with a named
  FALSIFYING CHECK each (all test files re-confirmed present at `6edb5263`
  this wave): per-person reminder scope on send AND preview
  (`src/routes/tasks.ts:564-613`, DEC-694) —
  `test/reminders-contact-scope.test.ts`; Comms preview `.ics` chip
  formatted in the event's own timezone
  (`app/src/pages/comms/icsChip.ts:18-19`, DEC-494) —
  `app/src/pages/comms/icsChip.test.ts`; reviewer multi-track scope renders
  a list, never "All tracks" (`src/domain/evaluation/progress.ts:39`,
  DEC-845) — `test/evaluation.test.ts`; EMB session-card speaker
  title/company (`src/routes/public/cards.tsx:102-116`) —
  `test/public-speaker-identity-line.test.ts`; seeded dates all relative to
  one seed clock (`scripts/seed.ts:261-278`, DEC-591) — NEW test written
  that wave, `test/tier0-falsifiability.test.ts`; portal edit-toggles
  (`app/src/pages/settings/PortalSettingsPanel.tsx:306`) —
  `app/src/pages/settings/PortalSettingsPanel.render.test.tsx`. Do not
  re-file these six as UNFALSIFIABLE.
  - **Accepted speakers keep editing past close** (`src/domain/edit-lock.ts:22`,
    DEC-041) — FALSIFYING CHECK: `test/edit-lock.test.ts` — opened and
    confirmed it directly asserts `canEditSubmission("accepted", PAST_CLOSE,
    NOW, LA)` is `true` (labelled "DEC-041 amendment, wave 6") while the
    sibling `"pending" + closed` case is `false` — the accepted-stays-open
    carve-out is exercised against its own negative control, not just
    asserted in isolation. (Discharged wave-39, carried unchanged.)
  - **Pipeline fit score + rationale** (`src/domain/pipeline-fit.ts`) —
    FALSIFYING CHECK: `test/pipeline-fit.test.ts` — opened and confirmed
    `sortByFit` (descending by score, null/unrated last, non-mutating) and
    `validateFitScore`/`validateRationale` (integer 1-5 or null; bounded
    text or null; throw a named `ApiError` field rather than coerce) are
    each exercised directly against the real functions, not a shape guess.
    (Discharged wave-39, carried unchanged.)
  - Phone-block override assertion —
    `app/src/phone-block-visibility.test.ts:186-205`; Comms phone landing —
    `app/src/phone-block-visibility.test.ts:109-121` (DEC-621). Already
    exempt from the UNFALSIFIABLE label (cited inline in the source batch).

  **DISCHARGED wave-46 (`task-w46-f`, DEC-358 amendment): four items from the
  batch-A remainder below, each with a real exercised falsifying check
  written after confirming the claim true at this worker's own runtime.**
  Saved embeds exist — `src/db/schema/embed.ts`,
  `src/routes/public/saved-embed.tsx` — CONFIRMED TRUE. FALSIFYING CHECK:
  `test/tier0-falsifiability-w46.test.ts` (schema columns + a real
  `GET /embed/e/:embedId` request through `publicRoutes`: unknown 404s,
  disabled is an empty 200 per DEC-822, enabled renders the event name).
  `/account/password` has real Cancel + 820 bare-page column —
  `src/routes/account.tsx:139-144` — CONFIRMED TRUE. FALSIFYING CHECK:
  `test/tier0-falsifiability-w46.test.ts` (renders `PasswordPage`, asserts
  a real `<a href={backHref}>Cancel</a>`, and that `BARE_PAGE_CSS`'s
  `.chq-bare-page` rule carries `max-width: 820px`). Overview §01
  skips-last-hour caption — `app/src/pages/Overview.tsx:325` — CONFIRMED
  TRUE. FALSIFYING CHECK:
  `app/src/pages/Overview.caption.w46.render.test.tsx` (mounts the real
  `OverviewPage`; caption renders with ≥1 overdue row, is absent at zero).
  Home footer media rule — `src/routes/public/home.css.ts:72-76` —
  CONFIRMED TRUE. FALSIFYING CHECK: `test/tier0-falsifiability-w46.test.ts`
  (asserts the `@media (max-width: 700px)` block's `.chq-home-footer` rule
  is present and differs from the base rule, and that `root.tsx` actually
  renders a `<footer class="chq-home-footer">` the rule targets).

  **DISCHARGED wave-49 (`task-w49-f`, DEC-358: the batch-A remainder,
  re-homed UNOWNED by wave 47's `task-w47-h`, decayed to that state after
  wave 45's lanes closed without taking it and none of wave 47's lanes a-g
  covered it either — this branch is the owner) — five items, each
  CONFIRMED TRUE at this worker's own runtime with a real exercised
  falsifying check. Full detail in
  `docs/mandates/w41-falsifiability-batch-a.md`'s wave-49 entry.**
  `npm run deploy` exists — `package.json:26`. FALSIFYING CHECK:
  `test/tier0-falsifiability-w49-batch-a.test.ts`. Settings edit-view field
  widths are tokens — `app/src/pages/settings/settings.css:17-21`
  (DEC-896). FALSIFYING CHECK:
  `test/tier0-falsifiability-w49-batch-a.test.ts`. Phone agenda N-aware
  clash caption — `app/src/pages/agenda/PhoneAgenda.tsx:186`. FALSIFYING
  CHECK: `app/src/pages/agenda/PhoneAgenda.w49.render.test.tsx`. Phone
  agenda "Place here anyway" — `:167-176,199-208`. FALSIFYING CHECK:
  `app/src/pages/agenda/PhoneAgenda.w49.render.test.tsx`. Phone password
  fixed footer + Cancel — `src/routes/auth.css.ts` (media block shifted
  under wave 48's `:has()` re-scoping). FALSIFYING CHECK:
  `test/tier0-falsifiability-w49-batch-a.test.ts`.

  The batch-A remainder's sixth item, the Home footer media rule
  (`src/routes/public/home.css.ts:72-76`), was already discharged wave-46
  — see the entry above; nothing remains open from this batch.
- **DEC-099 wave-35 Vary: Cookie population + fix** — `task-w35-c`
  (`beb58e29` at filing, MERGED as of this wave — `3a041507` on `main`'s
  first-parent line per `task-w36-a`/`task-w36-b`/`task-w36-c`/`task-w36-e`'s
  shared "merge task-w35-c" citation): built
  `test/public-cacheability-enumeration.test.ts`, enumerating every GET
  route under `/e/*`, `/embed/*` and `/` and asserting `Cache-Control !=
  no-store <=> Vary: Cookie`; found and fixed a real violation in
  `publicNotFound`/`publicErrorDocument`/`publicRoutes.onError`. CLOSED —
  no longer a pointer, the fix is confirmed landed and merged.
  FALSIFYING CHECK: `test/public-cacheability-enumeration.test.ts`.

### DO-NOT-RE-FILE (carried, waves 14-23, not re-checked this wave beyond ref presence)

**DISCHARGED — batch B, `docs/mandates/w41-falsifiability-batch-b.md`,
`task-w41-e`, MERGED.** Eight items, each with a named FALSIFYING CHECK
(all test files re-confirmed present at `6edb5263` this wave; two were
written new that wave and re-confirmed non-tautological): `createUser`
insert-then-select onConflictDoNothing race guard
(`src/server/repo/users.ts:98-129`, DEC-552) —
`test/tier0-falsifiability-legacy.test.ts` (new that wave); `send.ts`'s
unconditional `bumpIcsSequences` (`src/routes/comms/send.ts:243-258`) —
`test/tier0-falsifiability-legacy.test.ts` (new that wave); bulk-email
two-stage dedupe (`src/routes/api/contacts/bulk-email.ts:214-250`,
DEC-238) — `test/contacts-bulk-email-dedupe.test.ts`; breaks validation
accumulates (`src/routes/api/breaks.ts:130-166`) —
`test/schedule-breaks.test.ts`; `MAX_PARTICIPANTS_PER_SUBMISSION` binds
all four participant-writer doors
(`src/routes/api/submissions.ts:598`, `src/server/repo/portal-edit.ts:487`,
`src/routes/api/contacts/import.ts:194`,
`src/server/repo/import/sessionboard.ts:622`) —
`test/api-participants.test.ts`, `test/portal-copresenter.test.ts`,
`test/contacts-import-participant-cap.test.ts`,
`test/sessionboard-participant-cap.test.ts`; mail envelope via
`addressValue` (`src/mail/email-binding.ts:236-240`) —
`test/mail-envelope-address.test.ts`; duplicate `trackIds` deduped on both
write doors (DEC-598) — `test/submission-tracks-are-a-set.test.ts`;
saved-view cap predicate is authorship not visibility
(`src/routes/api/views.ts:87`, DEC-422) —
`test/saved-view-cap-authorship.test.ts`. Both new-test items surfaced no
actual defect (coverage gaps only, per the mandate's own text). Do not
re-file these eight as UNFALSIFIABLE.

**STILL UNFALSIFIABLE (batch B remainder, not reached that wave) —
OWNED-BUT-UNMERGED this wave: `task-w49-g` (`73c2a306`, "discharge unowned
batch-B falsifiability remainder (DEC-358)") claims the items below with
re-confirmed-true checks and new/upgraded falsifying tests per its own
commit message; committed, NOT an ancestor of HEAD at this runtime. Same
caveat as batch A above — a named branch is a plan fact, not this lane's
own re-verified discharge; do not read as CLOSED until `task-w49-g` lands
or a lane independently re-runs its checks:**
`answerFieldRoleCondition` missing event join — DISMISSED, DEC-592 wave-18
amendment (`src/server/repo/form-roles.ts:16`);
`countEvaluationsBySubmission`'s whole-plan map — DISMISSED, DEC-449;
reviewer plan window on lone-submission read + file authz
(`src/routes/review/reviewer.ts:288`,
`src/server/repo/files-authz.ts:185-209`, DEC-018); `task-w14-d` AUTH_CSS
`.chq-field-invalid` cascade
(`app/src/components/error-states.css:31`, DEC-124 wave-14 amendment);
`task-w15-c/d` `updateEvent` slug guard (`src/server/repo/events.ts:224-259`,
DEC-111); `task-w15-d` sessionboard participant cap
(`src/server/repo/import/sessionboard.ts:620-627`, DEC-604); `task-w15-b`
send.ts intra-batch collapse (`src/routes/comms/send.ts:125-138`, DEC-238);
`task-w8-c` review round name+window
(`app/src/pages/review/ReviewerQueue.tsx:31,508`); `task-w8-d` compose
step-1 slot+footer
(`app/src/pages/comms/ComposeWizard.tsx:713-716,1226-1230`); `task-w8-b`
Submissions→Comms `?ids=` handoff
(`app/src/pages/submissions/BulkActionBar.tsx:77`); `task-w8-e` Comms
History pager (`app/src/pages/comms/HistoryTab.tsx:42-160`); `task-w10-b`
MERGED; `task-w17-b` perf-seed/perf-smoke harness bugs MERGED (`956fe263`);
`task-w23-e` frame-citation quoting audit MERGED (`c0fe6948`);
`task-w18-b/c/d/e/f/g` (reviewer-scope, compose defaults, History Export,
files-library table-layout, templates Delete, ENVELOPE_ALLOWLIST) all
MERGED between `956fe263` and `39ac22d0`; `task-w23-f` MERGED via
`f519f562` (DEC-902 column contract + DEC-937 review phone label). This
remainder is still UNFALSIFIABLE (no per-item exercised check named) except
items that already cite a test file inline elsewhere in this doc (e.g.
`test/audit-claims.test.ts`-adjacent items).

