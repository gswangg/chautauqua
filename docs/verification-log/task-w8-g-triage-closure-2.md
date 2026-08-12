# 2026-08-10 task-w8-g — triage-closure @ 38860f9

Full detail for the `## 2026-08-10 task-w8-g — triage-closure @ 38860f9` section
of `docs/verification-log.md` (extracted per the contention-decomposition of
that file; see the stub entry there for `OPEN ITEMS` / `RESULT` summary).

DEC-069/DEC-139/DEC-176/DEC-177 gate-of-gates. Log-only lane. Full detail
also in `docs/verification-log/task-w8-g-triage-closure.md`.

**STEP 1 — sha derivation, ancestor check, DEC-177 preconditions.**
Identical derivation to `task-w8-b`: first-parent walk from `main`
lands on `38860f9` ("merge task-w8-a") directly, immediately preceded
by the doc-only `a8a4785` ("scribe wave 9") and `5d3acae` ("scribe
wave 8") — both bookkeeping (DEC-114) — so `38860f9` is the newest
code-bearing first-parent commit and is S. `git merge-base
--is-ancestor 2dd2f33 38860f9` exits 0 (descends from the campaign-3
reset, DEC-129 homonym guard satisfied). All twelve DEC-177
precondition greps hit at S (re-verified directly, matching
`task-w8-b`/`task-w8-d`/`task-w8-e`/`task-w8-c` verbatim): `DEC-167`
in `src/domain/contacts.ts`; `ICS_ORGANIZER_EMAIL` in
`src/mail/ics.ts`; `"unknown track id"` in `src/routes/api/forms.ts`;
`"anonymized === false"` in `src/server/repo/files.ts`; `openDate` in
`app/src/pages/review/PlanEditor.tsx`; `FORM_TASK_FIELD_SPECS` in
`scripts/seed.ts`; `DEC-174` in `scripts/seed.ts`; `DEC-173` in
`scripts/walkthrough/public.ts` and `scripts/walkthrough/speaker.ts`;
`DEC-175` in `scripts/walkthrough/producer.ts`,
`scripts/walkthrough/speaker.ts`, and `scripts/walkthrough/review.ts`.
No precondition miss — gate proceeds (not a precondition FAIL).

**STEP 2(a) — sibling battery, all at S = `38860f9`.** All five
required sibling sections are present in this file at the same S,
each ending `RESULT: PASS`:
- `task-w8-b — build+test @ 38860f9` — PASS (151 files / 1332 tests,
  build clean, bundle 58.86 kB gzip under 300 kB budget).
- `task-w8-c — walkthrough @ 38860f9` — PASS (6/6 modules: producer,
  review, speaker, public, data, scale; OPEN ITEMS: 0).
- `task-w8-d — perf-smoke @ 38860f9` — PASS (both runs, full p95
  table under the 150ms budget, DEC-080 301-id cap assertion held).
- `task-w8-e — render-sweep @ 38860f9` — PASS (31/31 routes; both
  persistent `task-w4-e`/`task-w5-e` FAILs — plan-detail SPA crash and
  speaker task-form 400 — now confirmed fixed).
- `task-w8-f — spec-audit @ 38860f9` — PASS (OPEN ITEMS: 0, delta vs
  `d8d1cbd` audited clean, zero secrets/credentials in the diff).

All five PASS at one S — battery complete, proceeding.

**STEP 2(b) — PLANNER marker harvest.** `git log --format='%h %B'
2dd2f33..38860f9 | grep 'PLANNER:'` returns zero hits — no literal
`PLANNER:` commit-message markers in range. Nothing to disposition;
`task-w8-a`'s product-defect probe did not fire.

**STEP 2(c) — eval-findings.md mandate closure.** `docs/
eval-findings.md` (not edited by this lane) Sections A/B/E/F closure
evidence is catalogued in-tree by `task-w4-g — triage-closure @
d8d1cbd` (this file, above) and re-verified by `task-w5-g —
triage-closure @ 5ee31ae` (this file, above): Section A —
`test/admin-assets-config.test.ts`,
`app/src/pages/submissions/Submissions.render.test.tsx`; Section B —
`app/src/lib/dates.ts` + `app/src/pages/review/Review.render.test.tsx`,
`test/events-reviewer-access.test.ts`,
`test/itinerary-roundtrip.test.ts`, `test/overlap-lanes.test.ts`,
`test/contact-profile-roundtrip.test.ts` +
`test/contacts-profile-admin.test.ts`, `test/contacts-import.test.ts`,
`test/contacts.test.ts`; Section E — `test/seed.test.ts`; Section F —
`scripts/render-sweep.ts` + `scripts/render-sweep-lib.ts` +
`test/render-sweep-lib.test.ts` and the 17
`app/src/**/*.render.test.tsx` component smokes. Every one of these
files was confirmed present at S via `git cat-file -e 38860f9:<path>`
(no miss). `task-w5-g` carried forward OPEN ITEMS: 2 — the two
render-sweep route FAILs against `d8d1cbd` (plan-detail SPA crash,
speaker task-form 400) — which `task-w8-e — render-sweep @ 38860f9`
(above) explicitly re-swept and confirmed both now PASS, attributing
the fixes to the wave-6 DEC-171 (`PlanEditor` wire-name alignment,
merged `task-w6-e`) and DEC-172 (seed backing-forms + manifest pin,
merged `task-w6-f`) landings. Combined with the wave-6 DEC-167..172
fix set (contact-merge field preservation, RFC-5546 `.ics`
ORGANIZER/ATTENDEE, form-tracks validation, reviewer file-access
plan-scoping, review SPA wire conformance, form-kind backing forms —
all re-grep-confirmed present at S per STEP 1 above) and this wave's
DEC-173/174/175 harness closure (anchor-tolerant public extractor,
seed mod-3/pending-task override, authz probes — all landed in
`task-w8-a`/`52dd2b2` and exercised PASS by `task-w8-c`'s walkthrough
above), every eval-findings.md Section C item tied to a w5-c/w5-e open
item is closed. No planner waiver needed; no gap found.

**STEP 2(d) — build+test at S.** Fresh worktree
(`/Users/wednesdayniemeyer/Documents/gniemeyer/Projects/chautauqua-wt/task-w8-g`)
checked out detached at `38860f9`. `npm ci --prefer-offline --no-audit
--no-fund --silent` clean (node_modules already present). `npm run
build` — PASS (dual `tsc --noEmit` + `vite build`, 131 modules
transformed, 19 output assets, no errors). `npm test --silent` — PASS:
**151 test files / 1332 tests, all green, 0 failures.**

**OPEN ITEMS: 0**

**RESULT: PASS**

All six task-w8-* battery sections (`task-w8-a` code lane +
`task-w8-b` build+test + `task-w8-c` walkthrough + `task-w8-d`
perf-smoke + `task-w8-e` render-sweep + `task-w8-f` spec-audit) are
PASS at one frozen S = `38860f9`, with zero open items across the
sibling battery, zero live PLANNER markers, and full eval-findings.md
mandate closure. Per DEC-069/DEC-139/DEC-176, this satisfies the
stage-1 exit predicate: the next wave should find zero open code
tasks and may declare stage-1 complete.
