# 2026-08-10 task-w4-g — triage-closure @ d8d1cbd

Full detail for the `## 2026-08-10 task-w4-g — triage-closure @ d8d1cbd` section
of `docs/verification-log.md` (extracted per the contention-decomposition of
that file; see the stub entry there for `OPEN ITEMS` summary).

DEC-163 battery lane (triage-closure). Frozen sha: `d8d1cbd` ("merge
task-w3-c"), matching the sibling `task-w4-f — spec-audit` section
above — its "Frozen sha derivation" paragraph shows the first-parent
walk from that lane's `f357477` worktree tip finding `f357477` itself
bookkeeping-only (DEC-114) and `d8d1cbd` code-bearing, so `d8d1cbd` is
the newest code-bearing first-parent sha as of wave-4's consolidation.
`git merge-base --is-ancestor 2dd2f33 d8d1cbd` exits 0 — descends from
the campaign-3 reset (DEC-129 homonym guard satisfied). Every file
cited below as closing evidence is present in the tree at `d8d1cbd`
(spot-checked via `git cat-file -e d8d1cbd:<path>` for all 31 files
referenced).

**PLANNER flag (do not act on unilaterally — reporting only, no code
touched, no other file modified).** `src/decisions.ts` at the current
main tip (`fc1e6ef`) carries `DEC_165`: "Wave-4 battery lanes never
executed; consolidation is already complete on main via the merge
train; the battery re-issues as wave 5 with task-w5-a as preflight and
the frozen sha defined by the w5-a merge." That is only partially
true as of this section: `task-w4-f` DID execute (spec-audit @
`d8d1cbd`, RESULT: PASS, appended above). This triage-closure section
is a second wave-4 lane landing after DEC-165 was written. Per DEC-163
the wave-4 battery needs all six lanes converged on one sha to satisfy
DEC-069; only two of six materialized (`task-w4-f` spec-audit and this
triage-closure) before the planner moved on to a wave-5 re-issue — so
the wave-4 battery, taken alone, is NOT a complete DEC-069 battery and
does not itself support a stage-1 exit declaration. This section's
own scope (eval-findings closure + prior-log open-items sweep, per the
task-w4-g brief) is unaffected by that gap and is reported in full
below; the battery-completeness question is left to the planner/DEC-165's
wave-5 re-issue, not resolved here.

**Section A (ratify) — CLOSED.**
- P0 admin redirect loop (`wrangler.jsonc` `html_handling: "none"`):
  `test/admin-assets-config.test.ts` (parses the real `wrangler.jsonc`,
  asserts the asset-redirect-defeating config is present).
- `/admin/submissions` "n is not iterable" crash (`SubmissionsTable`
  reading `apiGet('/events/:id/forms').then(r => r.fields)` instead of
  `apiList(...).items`): `app/src/pages/submissions/
  Submissions.render.test.tsx` (mounts the real page against a mocked
  fetch shaped like the real single-object `/forms` wire contract).

**Section B (P1) — CLOSED.**
- Plan-detail "Invalid time value" crash: `app/src/lib/dates.ts`
  (`formatDateOnly`/`formatDate`/`msToDateInput`, DEC-146 null-safe
  helpers) + `app/src/pages/review/Review.render.test.tsx` (null
  `openAt`/`closeAt`/`roundCriteria` render without throwing).
- Reviewer queue/event-selector lockout: `src/routes/api/events.ts`
  reachable-by-reviewers fix (DEC-141) pinned by
  `test/events-reviewer-access.test.ts`.
- Empty `.ics` itinerary export: `?ids=` query-param round trip
  (DEC-140) pinned by `test/itinerary-roundtrip.test.ts` (scrapes real
  checkbox values out of rendered HTML, round-trips every id to a
  matching VEVENT).
- Overlapping session blocks eating pointer events: `src/lib/
  overlap-lanes.ts` (`assignLanes`) pinned by `test/overlap-lanes.test.ts`.
- Speaker portal profile not visible to organizer (SPK-08 round trip,
  DEC-142): pinned by `test/contact-profile-roundtrip.test.ts` and
  `test/contacts-profile-admin.test.ts` (admin PATCH bio/socialLinks/
  headshot) plus the `ContactDrawer` portal-profile plumbing.
- CSV import silent-drop + duplicate-instead-of-merge: pinned by
  `test/contacts-import.test.ts` (real route, in-memory fake Db,
  repeat-import updates not duplicates).
- Near-duplicate detection missing same-name+company match (DEC-143):
  pinned by `test/contacts.test.ts` `findDuplicateGroups` describe
  block ("flags same-name same-company contacts even across different
  emails (DEC-143)", "joins a blank-company contact into a
  named-company group (DEC-143)").

**Section C (P2, by weight) — CLOSED.**
- EMB-01 (card date/time/room), EMB-02 (keyword search), EMB-07 (day
  switcher): `test/public.test.ts` describe blocks `SessionCard
  schedule rendering (EMB-01...)`, `EMB-02: keyword search (q)
  server-side substring filter`, `AgendaContent / ScheduleContent day
  switcher (EMB-07)`.
- EMB-05/08/13 drill-ins (DEC-151): `test/public.test.ts`
  `sessionDetailPath / speakerDetailPath (DEC-151 ?from= back-link)`
  and `parseNameQuery (DEC-151 ?q= name search)`.
- EMB-04/12 headshots: `test/headshot-gate.test.ts` (serve-scope gate)
  + Section E seed evidence below (`headshot_url` on >=3 contacts).
- CNT-09 admin session editing + CNT-12 content-approval reachability:
  `test/api-submissions.test.ts` (`PATCH /api/v1/submissions/:id
  (CNT-09 admin session editing)`) and `app/src/pages/submissions/
  SubmissionDetailPage.render.test.tsx` ("approves content via the
  always-visible control (no files required)").
- CNT-10 admin editing of speaker bio/headshot: `test/
  contacts-profile-admin.test.ts` (`PATCH /contacts/:id bio +
  socialLinks (CNT-10)`, `POST /contacts/:id/headshot (CNT-10)`).
- ABS-01 per-round scorecards (DEC-147): `test/evaluation.test.ts`
  (`criteriaForRound (DEC-147)`) and `test/round-criteria.test.ts`.
- ABS-03 free-text criterion (DEC-148): `test/evaluation.test.ts`
  (`validateEvaluationScores (DEC-148 'text' kind)`) and `test/
  round-criteria.test.ts` (round-2 required text criterion).
- CRM-11 bulk-email templates/preview parity (DEC-150): `test/
  contacts-bulk-email-preview-route.test.ts`.
- CRM-02 multi-criteria filter + non-lossy segments (DEC-149): `test/
  contacts-rules-param.test.ts` (`parseRulesQueryParam`) and
  `app/src/pages/contacts/FilterRulesPanel.tsx`.
- CRM-12 metrics-strip dashboard: `app/src/pages/contacts/
  ContactsApp.render.test.tsx` ("ContactsApp render smoke (CRM-12
  top-companies drill-through)") and `app/src/pages/contacts/
  StatsStrip.tsx`.
- TZ task due-date off-by-one: UTC-aware `formatDateOnly`
  (`app/src/lib/dates.ts` + `app/src/lib/dates.test.ts`, DEC-153) used
  by `app/src/pages/speakers/OnboardingGrid.tsx`.

**Section D (optional) — CLOSED.**
- CRM-07/08 sourcing pipeline (DEC-157): `test/pipeline-api.test.ts`
  and `app/src/pages/contacts/PipelineBoard.render.test.tsx`.
- CRM-10 push-contact-into-event (DEC-156): `test/
  contacts-add-to-event.test.ts`.
- CNT-11 content version history + restore (DEC-158): `test/
  submission-revisions.test.ts` (+ `test/api-submissions.test.ts`,
  `test/portal-edit-speaker-locked.test.ts` for locked-field sync).
- CNT-13/14 files library + ZIP bulk download (DEC-159/DEC-160):
  `test/files-library.test.ts` and `test/files-archive-route.test.ts`.
- AIA-07 explicit publish (DEC-155): `test/agenda-publish.test.ts`
  (`POST .../agenda/publish (AIA-07, DEC-155)`).
- AIA-08 accepted-only unscheduled tray: `test/agenda-repo.test.ts`
  (`getAgendaPayload unscheduled tray (AIA-08: accepted-only)`).
- Admin 404 catch-all (DEC-154): `app/src/App.render.test.tsx`
  (renders `NotFound` at an unknown `/admin/*` path).
- Sign-out control (DEC-154): `test/portal-signout.test.ts` (portal
  shell "Sign out" form) — the admin-side sign-out is part of the same
  `PortalLayout`/nav-shell pattern.
- Contact-editor a11y labels: `app/src/pages/contacts/ContactDrawer.tsx`
  has `<label htmlFor=...>` for first name/last name/email/company
  fields (code inspected directly at `d8d1cbd`; no dedicated a11y unit
  assertion beyond the existing `ContactDrawer` render coverage).

**Section E (seed) — CLOSED.** `test/seed.test.ts` ("sets
headshot_url on at least 3 contacts, backed by the real
docs/fixtures/headshot.png fixture") plus DEC-145's grading-window-
aligned accepted session/tasks/deliverable-version/comment-thread seed
enrichment (wave-1 commit `1f2e243`).

**Section F (permanent gates) — CLOSED.**
- F.1 serial browser render-sweep gate (DEC-144): `scripts/
  render-sweep.ts` + `scripts/render-sweep-lib.ts`, pinned by `test/
  render-sweep-lib.test.ts`, enumerating the full route surface via
  `app/src/routeManifest.ts` (seed-literal params, no hand-picked
  list).
- F.2 parallel-safe component-render smokes (DEC-161): 17
  `*.render.test.tsx` files under `app/src/` (App, Overview, Agenda,
  Comms, Speakers, Settings, Review, Scorecard, Submissions,
  SubmissionDetailPage, ContentApp, FilesLibrary, FormsPage,
  ContactsApp x2, PipelineBoard, BulkEmailModal) — vitest + jsdom + RTL
  against fixture-shaped mocks, one per named page component.

**Prior campaign-3 verification-log sweep.** `grep -n "^## "
docs/verification-log.md | awk -F'@ ' '{print $2}' | sort -u` lists 20
distinct cited shas in this file; running `git merge-base --is-ancestor
2dd2f33 <sha>` against each shows exactly one descends from the
campaign-3 reset: `d8d1cbd` (the `task-w4-f — spec-audit` section
above, RESULT: PASS, OPEN ITEMS: 0 — no unresolved item to carry
forward). The other 19 predate `2dd2f33` and are first-campaign
homonyms per DEC-129 (including five sections literally titled
`task-w4-a/b/c/d/e @ 3878d4f`); none contribute an open item against
the current tree.

**This section's OPEN ITEMS count (eval-findings closure only, per
the task-w4-g brief).** Every eval-findings.md Sections A-F item has
closing evidence in the tree at `d8d1cbd` (cited above); the sole
prior valid campaign-3 section carries no open item. No waivers used
or needed.

OPEN ITEMS: 0
