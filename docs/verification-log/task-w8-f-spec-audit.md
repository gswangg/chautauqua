# task-w8-f — spec-audit @ 38860f9

## S derivation (DEC-176/177) and precondition greps

Identical to task-w8-b's derivation (docs/verification-log/task-w8-b-build-test.md):
first-parent walk from `main` tip lands directly on `38860f9` ("merge
task-w8-a"), matching the task's own note that task-w8-a has already merged
into main. `git merge-base --is-ancestor 2dd2f33 38860f9` exits 0. All
twelve DEC-177 precondition greps at S = `38860f9` HIT (checked via `git
show 38860f9:<path> | grep`, not the mutable worktree):

- `DEC-167` in `src/domain/contacts.ts`
- `ICS_ORGANIZER_EMAIL` in `src/mail/ics.ts`
- `unknown track id` in `src/routes/api/forms.ts`
- `anonymized === false` in `src/server/repo/files.ts`
- `openDate` in `app/src/pages/review/PlanEditor.tsx`
- `FORM_TASK_FIELD_SPECS` in `scripts/seed.ts`
- `DEC-174` in `scripts/seed.ts`
- `DEC-173` in `scripts/walkthrough/public.ts` and `scripts/walkthrough/speaker.ts`
- `DEC-175` in `scripts/walkthrough/producer.ts`, `scripts/walkthrough/speaker.ts`, `scripts/walkthrough/review.ts`

## Baseline

`task-w4-f — spec-audit @ d8d1cbd` (docs/verification-log.md, full J1-J12
static audit): RESULT PASS, OPEN ITEMS: 0. `git merge-base --is-ancestor
d8d1cbd 38860f9` exits 0, confirming `d8d1cbd` is an ancestor of S.

## Changed surface: `git diff --name-only d8d1cbd..38860f9`

45 files. By category:

- **Wave-6 fix set (product code):** `src/domain/contacts.ts` (DEC-167),
  `src/mail/ics.ts` + `src/routes/comms.ts` + `src/routes/public/index.tsx`
  (DEC-168, ORGANIZER/ATTENDEE consumers), `src/routes/api/forms.ts`
  (DEC-169), `src/server/repo/files.ts` + `src/routes/files.ts` (DEC-170),
  `app/src/pages/review/PlanEditor.tsx` + `app/src/pages/review/types.ts`
  (DEC-171).
- **DEC-172/174 seed + manifest (fixtures/dev tooling, not product code):**
  `scripts/seed.ts`, `app/src/routeManifest.ts`.
- **DEC-173/175 walkthrough harness (tooling, not product code):**
  `scripts/walkthrough/{producer,public,review,speaker}.ts`.
- **Pure refactor, no behavior change (task-custodian-w4-1, predates wave
  6, already inside the diff range):** `src/routes/public.tsx` decomposed
  into `src/routes/public/{shell,cards,query,sessions,speakers,agenda,
  detail,dispatch,index}.tsx` — commit `3c6d52e` message states "no
  behavior change"; re-exports the same public symbols from `index.tsx` so
  `../routes/public` imports resolve unchanged; build+test green at that
  commit per its own message (151 files/1308 tests).
- **Tests added/updated for the above:** `test/contacts-repo.test.ts`,
  `test/contacts.test.ts`, `test/compose-ics.test.ts`,
  `test/ics-crlf-escaping.test.ts`, `test/itinerary-roundtrip.test.ts`,
  `test/mail.test.ts`, `test/forms-api.test.ts`,
  `test/reviewer-file-access.test.ts`, `test/seed.test.ts`,
  `app/src/pages/review/Review.render.test.tsx`,
  `app/src/pages/review/Scorecard.render.test.tsx`.
- **CI/tooling:** `.github/workflows/ci.yml` (render-sweep job, DEC-166 —
  predates wave 6, already merged before d8d1cbd per prior log section but
  reappears in this diff range only because of the `d8d1cbd` baseline cut;
  content unchanged from what task-w4-e's render-sweep gate already
  exercised).
- **Bookkeeping (decisions/, field-guide, verification-log — DEC-114, no
  audit needed):** `decisions/DEC-163.md`..`DEC-178.md`,
  `field-guide/index.md`, `src/decisions.ts`, `docs/verification-log.md`,
  `docs/verification-log/task-w5-b-build-test.md`.

## Per-area verdicts

**DEC-167 (contact merge, J11 dedupe/merge, J7/J10 speaker profile) —
PASS.** `src/domain/contacts.ts:165-199` extends fill-if-blank to
phone/bio/headshotUrl exactly per the decision text; socialLinks merged
per-key (verified by reading the surrounding block); notes lossless-append
with the `\n\n---\n\n` separator. `mergeContacts` persists the columns
(confirmed by grep for the merged field names flowing into the repo write).
Matches SPEC J11 (no silent data loss on merge) and clarifications.md has
no contact-merge override.

**DEC-168 (.ics ORGANIZER/ATTENDEE, RFC 5546) — PASS.** `src/mail/ics.ts`
emits `ORGANIZER;CN="...":mailto:...` unconditionally and
`ATTENDEE;CN;ROLE=REQ-PARTICIPANT;PARTSTAT=NEEDS-ACTION;RSVP=TRUE:mailto:...`
only for REQUEST, with fail-loud asserts (`buildIcsCalendar: METHOD:REQUEST
requires an attendee` / `...PUBLISH must not have an attendee`) — matches
the house fail-loud invariant. `ICS_ORGANIZER_EMAIL =
"noreply@chautauqua.local"` is a stage-1 dev-local placeholder constant,
not a live secret or external dependency — no stage-2 leakage. Compose
(`src/routes/comms.ts`) uses REQUEST with the recipient as attendee; public
schedule download (`src/routes/public/index.tsx`) uses PUBLISH with no
attendee — matches the decision's split exactly. Standards-compliance
requirement (explicit SPEC .ics rule) satisfied.

**DEC-169 (form tracks validation, J1 CFP submission integrity) — PASS.**
`src/routes/api/forms.ts:104-118` dedupes, validates every id against
`listTracksForEvent`, fails the whole PATCH with `{error:{fields:{tracks}}}`
on any unknown/foreign id; `null`/`[]` semantics preserved unchanged. This
closes the "one typo bricks the public CFP" defect described in the
decision without touching the `/submit/:slug` intersection logic itself.

**DEC-170 (reviewer file authz, §4 "reviewer (assigned plans only)" +
anonymization) — PASS.** `src/server/repo/files.ts:128-153` requires a
NON-anonymized plan (`p.anonymized === false`) that both assigns the
reviewer and passes `isSubmissionInReviewerScope`; `reviewerHasPlanForEvent`
deleted outright (grep confirms zero remaining references in `src/` — no
compatibility shim, consistent with the house "no backwards-compat" rule).
Denial stays 403. This closes the cross-plan-access + anonymization-bypass
gap directly against the SPEC §4 role scoping.

**DEC-171 (review SPA wire conformance, render-sweep mock fidelity) —
PASS.** `PlanEditor.tsx` now reads `openDate`/`closeDate`/
`filters?.trackIds ?? []`/`maxEvaluations` matching the actual
GET/PATCH `/api/v1/plans/:id` `PlanRecord` shape (verified field names
present in `app/src/pages/review/types.ts`); saves send the matching wire
keys. `Review.render.test.tsx`/`Scorecard.render.test.tsx` updates keep
mocks aligned with the real wire shape per the DEC-171 rule.

**DEC-172/DEC-174 (seed backing forms + manifest pin) — fixtures/dev
tooling only, correctly out of product code.** `scripts/seed.ts` inserts
one backing form per form-kind onboarding task template with
`is_default: false` and null open/close dates (`getDefaultForm` cannot
surface it publicly — verified no public-form-listing code path was
touched), `FORM_TASK_FIELD_SPECS` fields inserted in order,
`task.form_id` set. `app/src/routeManifest.ts` pins
`TASK_ASSIGNMENT_ID` to a pending form-kind assignment owned by the seeded
speaker persona. No product-code file references fixture values — only
`scripts/seed.ts` (fixture data) and `app/src/routeManifest.ts` (a
dev/test-only route-enumeration manifest, not runtime product logic) were
touched.

**DEC-173/DEC-175 (walkthrough harness fixes) — harness only, correctly
out of product code.** `scripts/walkthrough/{producer,public,review,
speaker}.ts` are CLI verification scripts, not served/runtime code.

**Refactor `3c6d52e` (public.tsx decomposition) — PASS, no regression.**
Symbol re-exports from `src/routes/public/index.tsx` keep all existing
import sites (`grep -rn 'routes/public"' src app` — mount point
`src/index.ts` still imports `publicRoutes` from `../routes/public`
unchanged) resolving to the same values; DEC-012/013 sub-app-mount
invariant unaffected (still only `src/index.ts` calls `.route(`).

## Baseline verdict re-affirmation (spot check)

`task-w4-f`'s PASS/0-open-items verdict at `d8d1cbd` covered §8/9 route
surface, DEC-012/013 mount discipline, envelope shape, and the pipeline/
files/submissions surfaces. None of those audited files
(`src/index.ts`, `src/routes/api/pipeline.ts`, `src/routes/api/
submissions.ts`) appear in the `d8d1cbd..38860f9` changed-file list, so
that verdict is unregressed by this diff. The two render-sweep FAILs
recorded against `d8d1cbd` (task-w4-e: `/admin/review/plans/:planId`
crash, `/portal/tasks/:id/form` 400) are exactly the defects DEC-171/172
fix — consistent with, not contradicting, the prior log's disposition that
they were "open, uncontested" as of `d8d1cbd`.

## Stage-2 leakage / secrets check

`git diff d8d1cbd..38860f9 -- src/ app/src/` grepped for
`api[_-]?key|secret|process\.env\.[A-Z_]*KEY|sendgrid|twilio|stripe|aws_|
openai` (case-insensitive) — zero hits. `ICS_ORGANIZER_EMAIL` is a
hardcoded dev-local placeholder string, not an env var or external
credential; email continues to route through the existing dev sink
(`email_log`), unchanged by this diff. No new external-service
dependency, no required secret, no code requiring an API key or
deployment.

## OPEN ITEMS

0

## RESULT

PASS
