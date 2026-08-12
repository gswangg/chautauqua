# 2026-08-10 task-w5-f — spec-audit @ 64ec7de

Full detail for the `## 2026-08-10 task-w5-f — spec-audit @ 64ec7de` section
of `docs/verification-log.md` (extracted per the contention-decomposition of
that file; see the stub entry there for `OPEN ITEMS` summary).

Static log-only audit per DEC-069/DEC-139/DEC-165/DEC-166 (no code changes;
gaps recorded as open items, not fixed). Fresh worktree from `main`.

**STEP 1 — frozen sha.** First-parent walk from `main` HEAD (`5ee31ae`,
"merge task-w4-g"), skipping bookkeeping merges (`53e4a64` merge task-w4-d,
`fc1e6ef` merge task-w4-f, `54005df` merge task-w4-e, `5ee31ae` merge
task-w4-g — each touches only `docs/verification-log.md`, confirmed via
`git show <sha> --stat`) lands on `64ec7de` ("merge task-w5-a"), the last
code-bearing commit: `.github/workflows/ci.yml` +12 lines adding the
`render-sweep` job. Verified `git show 64ec7de:.github/workflows/ci.yml`
contains `render-sweep:` (line 87) / `npm run gate:render-sweep` (line 97),
and `git merge-base --is-ancestor 2dd2f33 64ec7de` succeeds (descends from
the campaign-3 reset). Frozen sha: **`64ec7de`**. The working tree's code
(everything except `docs/verification-log.md`) is identical between
`64ec7de` and current `main` HEAD (`5ee31ae`), since the four intervening
merges are verification-log-only; `npm run build` + `npm test --silent`
were run directly in this worktree (checked out from `main`) as an
equivalent proxy.

`npm run build`: PASS (tsc x2 + vite build, no errors).
`npm test --silent`: PASS — 151 test files, 1308 tests, 0 failures.

**STEP 2a — SPEC §8/9 + README/CI audit.**
- README quickstart (`npm i` / `npm run db:migrate` / `npm run seed` /
  `npm run dev`) matches `package.json` scripts verbatim (`README.md:18-23`
  vs `package.json` scripts block). README's "Dev: render-sweep gate"
  section (`README.md:34-46`) documents `npm run gate:render-sweep`
  (`package.json` scripts: `"gate:render-sweep": "tsx scripts/render-sweep.ts"`),
  matching DEC-165/166.
- README evaluator credentials (`README.md:71-76`) match
  `docs/fixtures/sample-data.json` `identities.{organizer,speaker,speaker2,
  reviewer}.{email,password}` verbatim (checked programmatically — all 4
  email/password pairs match exactly).
- `.github/workflows/ci.yml` has four jobs: `build-and-test` (npm run
  build + bundle:check + test, lines 13-24), `perf-smoke` (line 26),
  `walkthrough` (line 57), `render-sweep` (line 87-97: `npx playwright
  install --with-deps chromium` then `npm run gate:render-sweep`, no
  manual migrate/seed steps — DEC-166 shape, the script self-boots its own
  migrated/seeded `wrangler dev`).
- SPEC.md §9's four invariants each map to a passing regression test:
  close-date lock -> `test/edit-lock.test.ts`, `test/submit-core.test.ts`;
  speaker isolation (cross-account IDOR) ->
  `test/task-file-access.test.ts` ("403s for another speaker (IDOR)");
  hidden-speaker exclusion -> `test/headshot-gate.test.ts` ("404s
  unauthenticated when the speaker isn't publicly visible
  (pending/hidden)"); decision-never-auto-emails ->
  `test/spec9-invariants.test.ts` (`updateSubmissionStatuses` pending ->
  declined never touches `schema.emailLog`). All four run green in the
  151/1308 suite above.

**STEP 2b — DEC-139 eval-findings mandate audit (file:line citations).**
- **Section A (CLOSED).** `wrangler.jsonc:11` `"html_handling": "none"`,
  locked by `test/admin-assets-config.test.ts:53-54`
  (`expect(config.assets.html_handling).toBe('none')`).
  `app/src/pages/submissions/SubmissionsTable.tsx:53-55` reads
  `apiGet<{fields}>('/events/:id/forms').then(r => r.fields)` (not
  `apiList(...).items`); render-tested by
  `app/src/pages/submissions/Submissions.render.test.tsx`.
- **Section B (CLOSED).**
  - Plan-date guards: `app/src/lib/dates.ts:40-45` (`formatDate`),
    `:54-64` (`formatDateOnly`, DEC-146/153, "—" for null/NaN/invalid),
    used across `app/src/pages/review/*`; render-tested by
    `app/src/pages/review/Review.render.test.tsx`.
  - Reviewer queue/membership: `src/server/repo/events.ts:61`
    `listEventsForReviewer`, wired into `GET /events` per
    `test/events-reviewer-access.test.ts` (DEC-141, "GET
    /api/v1/events must stay reachable for reviewers").
  - Populated `.ics` via id-encoding (DEC-140):
    `test/itinerary-roundtrip.test.ts:1,134` ("DEC-140 itinerary id
    round-trip (schedule HTML -> schedule.ics)"); `src/lib/itinerary.ts`.
  - Overlap lanes clickable (DEC-140): `src/lib/overlap-lanes.ts:1-7`
    (pure lane-assignment so every block's checkbox stays clickable).
  - Portal-profile surfaced to organizer (DEC-142/152):
    `src/routes/api/contacts.ts:182` ("CNT-10 (DEC-152, DEC-142): admin
    bio/social-link editing"), `app/src/pages/contacts/ContactDrawer.tsx:167`;
    tested by `test/contact-profile-roundtrip.test.ts`,
    `test/contacts-profile-admin.test.ts`.
  - CSV import persists + dupes flagged (DEC-143):
    `src/domain/contacts.ts:36` (near-dupe grouping "sub-grouped by
    normalized company per DEC-143"); import persistence tested by
    `test/contacts-import.test.ts`, `test/contacts-repo.test.ts`; dedupe
    by `test/contacts.test.ts`.
- **Section C (fixed-or-waived, cited to DEC-147..156) — all items
  resolved.** `src/decisions.ts:152-161` DEC_147 (per-round scorecards,
  ABS-01) / DEC_148 (free-text criterion, ABS-03) / DEC_149 (CRM
  multi-criteria filters, CRM-02) / DEC_150 (bulk-email template parity +
  dashboard, CRM-11/12) / DEC_151 (public drill-ins + search, EMB-02/05/08/13)
  / DEC_152 (admin bio/headshot editing, CNT-10, extends DEC-142) /
  DEC_153 (date-only display fix, TZ off-by-one) / DEC_154 (NotFound +
  sign-out) / DEC_155 (agenda publish + accepted-only tray) / DEC_156
  (push-to-event, CRM-10) — each C item traces to one of these; no waived
  item found.
- **Section D (FIXED per DEC-157..161) — all items resolved.**
  `src/decisions.ts:162-166` DEC_157 (pipeline) / DEC_158 (revisions) /
  DEC_159 (files library) / DEC_160 (ZIP) / DEC_161 (render-smoke policy).
  Verified in tree: `src/server/repo/pipeline.ts` + `src/routes/api/
  pipeline.ts` + `migrations/0012_pipeline.sql` + 4th ContactsApp tab
  (`app/src/pages/contacts/ContactsApp.tsx:9,92,157` `PipelineBoard`).
  `src/server/repo/revisions.ts` + `migrations/0013_submission_
  revision.sql`. `src/lib/zip.ts` + `src/routes/files.ts` (archive
  endpoint) + `src/server/repo/files.ts`. AIA-07 publish:
  `src/routes/agenda.ts:90,100` `POST .../agenda/publish`, tested by
  `test/agenda-publish.test.ts:78`. AIA-08 accepted-only unscheduled tray:
  `test/agenda-repo.test.ts:98` ("getAgendaPayload unscheduled tray
  (AIA-08: accepted-only)"). Sign-out (DEC-154): `app/src/App.tsx:102`,
  `src/routes/portal/shared.tsx:48`, tested by `app/src/App.render.
  test.tsx:33`. NotFound catch-all: `app/src/App.tsx:22,36,141`
  (`<Route path="*" element={<NotFoundPage />} />`). Labeled
  contact-editor inputs: `app/src/pages/contacts/ContactDrawer.tsx:129-191`
  (`htmlFor` on first/last name, email, company, title, phone, notes,
  custom fields, bio, headshot-upload).
- **Section E (seed, REQUIRED) — CLOSED.** `scripts/seed.ts:704-741`
  demo speaker (Priya Raman) gets an accepted submission +
  onboarding tasks (`:906-929`); `:1186-1244` v1->v2 file-version chain
  (`previous_file_id` at `:1228`) + `file_comment` thread (`:860-873`) on
  that submission; `:213-489` headshot-bearing contacts + near-duplicate
  "Priya"/"Marcus Okafor" contacts (DEC-145).
- **Section F (permanent gates) — CLOSED.** 17
  `app/src/**/*.render.test.tsx` files confirmed by `find` (App, Overview,
  Settings, Speakers, FormsPage, ContactsApp x2, PipelineBoard,
  BulkEmailModal, Comms, ContentApp, FilesLibrary, Review, Scorecard,
  SubmissionDetailPage, Submissions, Agenda). `scripts/render-sweep.ts`
  exists; wired into CI as the `render-sweep` job (`.github/workflows/
  ci.yml:87-97`, confirmed above).

**No genuine gaps found.** Every DEC-139-mandated eval-findings item
(Sections A-F) has file:line evidence in the tree at `64ec7de`; SPEC §8/9
README/CI/invariant checks all pass; build + full test suite (1308 tests)
green in this worktree.

OPEN ITEMS: 0
RESULT: PASS
