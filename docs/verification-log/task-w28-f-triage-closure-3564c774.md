# task-w28-f: triage-closure @ 3564c774

Read-only closure sweep. LOG-ONLY per DEC-069/DEC-453 — nothing under
`src/`, `app/src/`, `scripts/`, `test/`, `migrations/`, `package.json`
touched. `git rev-parse HEAD` at start: `3564c7747e211f0e5857091e5909536c56e31b4a`
(short `3564c774`).

## Population

Every `OPEN ITEMS:` line in `docs/verification-log.md` from
`## 2026-08-15 task-w9-d` (line 3416) to EOF (line 3890). That range contains
exactly these sections, each with its own `OPEN ITEMS:` line (or, for
task-w25-a, an un-numbered RESULT paragraph naming the surviving items):

- task-w9-d @ 79f7b7ae — `OPEN ITEMS: 9` (:3466)
- task-w25-e @ 7378401d — un-numbered list, 2 members (:3537)
- task-w25-a @ 1950921d — un-numbered RESULT paragraph, 4 members (:3581-3585)
- task-w26-f @ 73f380f2 [DIAGNOSTIC] — `OPEN ITEMS: 1` (:3621)
- task-w27-b @ ceda66f2 [DIAGNOSTIC] — `OPEN ITEMS: 2` (:3667)
- task-w27-e @ ceda66f2 [DIAGNOSTIC] — `OPEN ITEMS: 1` (:3727)
- task-w27-d @ ceda66f2 [DIAGNOSTIC] — `OPEN ITEMS: 5` (:3784)
- task-w27-c @ ceda66f2 [DIAGNOSTIC] — `OPEN ITEMS: 1` (:3843, explicitly the
  same defect task-w26-f already carries — not a new member)
- task-w27-g @ ceda66f2 [DIAGNOSTIC] — `OPEN ITEMS: 1` (:3877)

Pre-w9-d triage-closure files in `docs/verification-log/`
(`task-w25-f-triage-closure.md` @ `b2dc2c1`, `task-w27-f-triage-closure.md` @
`f01459a`, and the several other `f01459a`-pinned wave-27 gate detail docs
with no corresponding entry in `docs/verification-log.md`) are pinned to
shas that predate this range's anchor (`task-w9-d` @ `79f7b7ae`) and are
already reconciled by construction — this task's brief explicitly starts the
population at `task-w9-d`, so they are not re-opened here.

`git log ceda66f2..HEAD --oneline -- src/ app/src/ migrations/ package.json`
= 3 commits: `900f8326` (drop `line-height:1` on display-face headings,
DEC-991), `d8974cf6` (merge repair wave 26, 4 cross-lane fixes), `0d0e24e8`
(merge of `900f8326` as task-w27-a). These are the only product-tree changes
between the DIAGNOSTIC sections' measured sha and the current tip.

## Item-by-item grading

### task-w9-d (9 items, :3468-3494)

| # | Item | Grade | Evidence |
|---|------|-------|----------|
| 1 | `speaker.ts:460` completed task not shown "Completed" | CLOSED | `scripts/walkthrough/speaker.ts:459-467` — probe rewritten to assert `chq-portal-flag-done` per DEC-366's frozen "Done"/"To do" wording; confirmed by inline comment citing `src/routes/portal/tasks/views.tsx:237-238`. |
| 2 | `public.ts:436` no "Track filters" nav | CLOSED | `scripts/walkthrough/public.ts:428-443` — DEC-919 (wave-40 amendment) replaced the pill nav with `PublicFilterSelectForm`; probe now asserts `id="chq-pub-filter-trackId"`. |
| 3 | `data.ts:467` showflow.csv extra trailing `kind` column | CLOSED | `scripts/walkthrough/data.ts:483-497` — expected header constant now ends `...,deck_url,kind`. |
| 4 | `scale.ts:394` `readMailboxCount` unauthenticated fetch (DEC-546 stale) | CLOSED | `scripts/walkthrough/scale.ts:393-408` — `readMailboxCount` now takes an `organizerJar` and calls `jarFetch`, per DEC-546 org-scoped `/dev/mailbox`. |
| 5 | `chq-visually-hidden` label/button vertical clip (public pages) | CLOSED | Confirmed a false positive of the pre-truthful clip probe, not a real defect — task-w25-a's receipt (`docs/verification-log.md:3576-3578`): "Every one of the 11 `chq-visually-hidden`/... false positives from task-w17-d's receipt no longer appears" after the probe fix (`scripts/render-sweep-lib.ts` `isGenuineClipOffender`). |
| 6 | `/admin/submissions/forms` `.chq-forms-header-titles`/`h1` clip | CLOSED | `900f8326` deleted `line-height: 1` at `app/src/pages/forms/forms.css:47-49` (also `comms.css` and `src/routes/auth.css.ts` siblings), per DEC-991's wave-27 amendment; confirmed genuine at task-w25-a (probe-verified), fix landed after. |
| 7 | `/portal/preview` 404 (organizer, desktop + admin-mobile) | CLOSED | `app/src/routeManifest.ts:153` — `{ path: "/portal/preview", role: "organizer", expectedStatus: 404 }` — a deliberate non-200. `scripts/render-sweep.ts:185-193` — the w25-e fix explicitly carries `expectedStatus` through `ADMIN_MOBILE_ROUTE_MANIFEST` too ("carries expectedStatus through from ROUTE_MANIFEST... made every such row read a permanent... FAIL... even once the desktop pass's equivalent row passed"), so both passes now treat this route's 404 as expected. Note: task-w25-a's own receipt (run after task-w25-e's fix, per `git merge-base --is-ancestor 7378401d 1950921d`) still lists `/portal/preview` 404 among admin-mobile "surviving FAILs" — that line in the prose is stale/inconsistent with its own tip's code; the code at the current tip unambiguously carries the fix. |
| 8a | `/portal/tasks` mobile horizontal overflow 170px | CLOSED | `src/routes/portal/portal.css.ts:417-431` — DEC-253 wave-25 amendment adds `min-width: 0; max-width: 100%; overflow-y: auto;` to `.chq-portal-shell > .chq-measure` at phone width. |
| 8b | `/admin/submissions` search-input tap-target 26px < 44px | CLOSED | `app/src/pages/submissions/submissions.css:557-564` — DEC-253/DEC-367 phone-only `min-height: 44px` on `.chq-submissions-filterbar-search`/`-select`. |
| 9a | type-role `.chq-overview-deadline-value` (group) weight-count mismatch | CLOSED | task-w25-e item 1 (`docs/verification-log.md:3507-3513`) re-expressed `evaluateDeadlineNearestWeights` per DEC-611's wave-2 amendment (SET semantics, not single-cell); confirmed `test/render-sweep-type-roles.test.ts` 34/34 passing at that task's RESULT. |
| 9b | contrast FAIL `label.chq-review-checkbox-label` (ratio 2.43) | OPEN-unowned | Same defect class re-measured (ratio 3.09) and confirmed still failing at task-w27-d (`docs/verification-log.md:3779-3780`); no commit since `ceda66f2` touches `app/src/pages/review/review.css` (`git log ceda66f2..HEAD -- app/src/pages/review/review.css` empty). Folded into the w27-d cluster below (not double-counted). |
| 9c | interaction-state: disabled selector never resolved | OPEN-unowned | Same defect, task-w27-d (`:3780-3782`, `.chq-review-field-disabled .chq-review-checkbox-label`). Folded into w27-d cluster below. |
| 9d | interaction-state: `.chq-cfp-step-next` focus outline mismatch | OPEN-unowned | Same defect, re-tested live and still failing at task-w27-d (`:3772-3776`, "instrument-blocked: selector unreachable via keyboard Tab within 25 presses"). Folded into w27-d cluster below. |

### task-w25-e (2 items, :3537-3540)

| Item | Grade | Evidence |
|------|-------|----------|
| Mobile pass has no console-error collection at all | OPEN-unowned | `scripts/render-sweep-lib.ts:246` `evaluateMobileRoute` and its `MobileObservation`/`MobileRouteResult` types (:12-233) carry no `consoleErrors` field or check — confirmed by grep: `consoleErrors` only appears in the desktop-pass code path (`scripts/render-sweep.ts:806-809`, `render-sweep-lib.ts` `evaluateRoute`/`filterExpectedStatusConsoleNoise`), never in the mobile evaluator. No commit since `7378401d` touches this file's mobile path. |
| Item 3's keyboard-Tab focus-visible fix unverified end-to-end | superseded | Run live at task-w27-d (`:3772-3776`): "still fails ... instrument-blocked". Folded into the w27-d `.chq-cfp-step-next` item below — not double-counted. |

### task-w25-a (surviving items, :3581-3585, un-numbered)

| Item | Grade | Evidence |
|------|-------|----------|
| `.chq-forms-header-titles`/`h1` clip | CLOSED | Same as w9-d#6 — `900f8326`. |
| `/admin/submissions` tap-target | CLOSED | Same as w9-d#8b. |
| `/portal/preview` 404 | CLOSED | Same as w9-d#7 (this receipt's own mention of it as a surviving FAIL is stale relative to its own tip's code, see w9-d#7 note). |
| `/portal/tasks` horizontal overflow | CLOSED | Same as w9-d#8a. |

### task-w26-f / task-w27-c (DEC-244 "version 2", :3618-3621 and :3843, same item)

| Item | Grade | Evidence |
|------|-------|----------|
| `GET /portal/tasks` deliverable panel never shows "version 2" for a re-uploaded ad hoc `file_request` task | PENDING-OWNED(task-w28-a) | `task-w28-a` (live branch, `git log main..task-w28-a` = 2 commits, HEAD `0778816b`, not an ancestor of my tip) — commit `9bf312cf` "Repair DEC-244 walkthrough instrument: create both file versions in-run" rewrites the walkthrough block to upload twice (version 1 then version 2) instead of asserting "version 2" after a single upload against a premise (seed pre-completion) the field guide's DEC-244 amendment already identified as false. Commit `0778816b` records a PASS walkthrough gate at `c6dbdb7c` using the repaired instrument. Not yet merged to `main`/this branch's tip — per DEC-453, PENDING-OWNED, not OPEN-unowned, not CLOSED. |

### task-w27-b (2 items, :3667-3670) [DIAGNOSTIC @ ceda66f2]

| # | Item | Grade | Evidence |
|---|------|-------|----------|
| 1 | In-process test SQLite fixture bootstrap missing `user.name` column | CLOSED | `d8974cf6` ("Merge repair (wave 26): cross-lane integration fixes") point 1 — added `name text` to every hand-written mirrored `create table user` DDL across probe/real-row test files. `task-w28-b`'s build+test gate (commit `bb702a52`, at `c6dbdb7c` which is an ancestor of my tip) confirms `1061/1061` test files, `11745/11745` tests passing. |
| 2 | `POST /api/v1/users` 500s `db.select is not a function` in `getAnchorEventForOrg` | CLOSED | `d8974cf6` point 2 — `test/users-name-persistence.test.ts` now mocks `getAnchorEventForOrg` directly (confirmed at :23-26 in the current tree) instead of the stale `listEventsForOrg` mock, matching task-w26-d's owned single-row helper (`src/server/repo/events.ts:93-99`, real `db.select()` implementation, unrelated to the stub-db test bug). Confirmed by the same `1061/1061`/`11745/11745` green suite. |

### task-w27-e (1 item, :3727) [DIAGNOSTIC @ ceda66f2]

| Item | Grade | Evidence |
|------|-------|----------|
| §7-3 bundle size not re-measured after wave-27 changes | CLOSED | `task-w28-b` (commit `bb702a52`, at `c6dbdb7c`, ancestor of my tip): `npm run bundle:check` — entry `69.19 kB gzip` vs the 300 kB budget, PASS. `git log c6dbdb7c..HEAD -- app/src/ src/` is empty (only the `task-w27-g` merge, docs-only, followed), so this measurement is current at my tip. |

### task-w27-d (5 items, :3784) [DIAGNOSTIC @ ceda66f2]

Render-sweep contrast (57/60, 3 FAILs) + interaction-state (2/4, 2 FAILs) = 5,
matching the section's own `OPEN ITEMS: 5` count (the "2 rows already owned
by task-w27-a" clip FAILs are explicitly excluded from this count per the
section's own RESULT prose, and are CLOSED above via `900f8326`).

| # | Item | Grade | Evidence |
|---|------|-------|----------|
| A | `.chq-participation-menu-caret` contrast 1.02 on `/admin/speakers` | OPEN-unowned | `app/src/pages/speakers/speakers.css:390-394` — `color: var(--chq-muted)` unchanged; `git log ceda66f2..HEAD -- app/src/pages/speakers/speakers.css` empty. |
| B | `.chq-participation-menu-caret` contrast 1.02 on `/admin/speakers/seed_contact_0001` | OPEN-unowned | Same CSS rule as A, different route instance; same evidence. |
| C | `.chq-review-checkbox-label` contrast 3.09 on `/admin/review/plans/seed_evaluation_plan_0001` | OPEN-unowned | `app/src/pages/review/review.css:776-786` — `color: var(--chq-ink-2)` unchanged; `git log ceda66f2..HEAD -- app/src/pages/review/review.css` empty. |
| D | `.chq-cfp-step-next` focus-visible outline, keyboard-Tab-unreachable | OPEN-unowned | `src/views/theme.ts:170` (the `:focus-visible` rule task-w25-e's probe fix targeted) — confirmed re-run live at task-w27-d and still failing ("instrument-blocked: selector unreachable via keyboard Tab within 25 presses"); `git log ceda66f2..HEAD -- src/views/theme.ts` empty. |
| E | `.chq-review-field-disabled .chq-review-checkbox-label` disabled-state selector never resolved | OPEN-unowned | `app/src/pages/review/review.css:1695-1700` / `app/src/pages/review/PlanEditor.tsx:1337-1345` (gated on async `planHasSubmittedReview`); `git log ceda66f2..HEAD` empty for both files. |

Also observed at task-w27-d, out of this population's mechanical scope (not
listed under an `OPEN ITEMS:` line — PART 1 perf-smoke is a separate,
un-enumerated finding in the same DIAGNOSTIC section): 4 read-budget
overruns (default profile) / 2 persisting (aie profile). Re-confirmed
still FAILing by `task-w28-c` (live branch, commit `a8dacd1b`, log-only
receipt — does not fix, only re-measures at `c6dbdb7c`). Not counted in
`n` below (not part of the mechanical `OPEN ITEMS:` population this task's
brief defines), flagged here for honesty: perf-smoke remains open and,
per DEC-453, its branch (`task-w28-c`) only re-measured — no fix landed —
so this is OPEN-unowned in substance even though outside my counted
population.

### task-w27-g (1 item, :3877-3884) [DIAGNOSTIC @ ceda66f2]

| Item | Grade | Evidence |
|------|-------|----------|
| Admin Speakers toolbar right-cluster missing `[List \| Grid]` view-mode toggle | OPEN-unowned | `docs/design/README.md:350` states the toggle; `app/src/pages/speakers/GridFilters.tsx` renders only a search input and task-status select — grep for `"List \| Grid"`/`viewMode` across `app/src/pages/speakers/` returns nothing. `git log ceda66f2..HEAD -- app/src/pages/speakers/` empty. |

## Verified starting points (re-confirmed with my own quote)

- w9-d item 1 closed at `scripts/walkthrough/speaker.ts:459-467` — CONFIRMED (see above, matches).
- w9-d item 4 closed at `scripts/walkthrough/scale.ts:393-408` — CONFIRMED (see above, matches).
- `/portal/tasks` mobile overflow closed at `src/routes/portal/portal.css.ts:417-431` — CONFIRMED, quoted `.chq-portal-shell > .chq-measure { ... min-width: 0; ... max-width: 100%; overflow-y: auto; }`.
- `/admin/submissions` tap-target closed at `app/src/pages/submissions/submissions.css:557-564` — CONFIRMED, quoted `.chq-submissions-filterbar-search, .chq-submissions-filterbar-select { min-height: 44px; }`.
- Contrast offender addressed by `--chq-disabled: #7d7869` at `src/views/theme.ts:38` and `app/src/styles.css:30` — CONFIRMED both declare `--chq-disabled: #7D7869`/`#7d7869`, but this token is unrelated to the two contrast FAILs still open at the current tip (items C/A/B above use `--chq-ink-2` and `--chq-muted`, not `--chq-disabled`) — this fix closes a *different*, earlier B8-disabled-register contrast concern (per its own comment, "w25-g/DEC-745 amendment; w25-c/DEC-436 amendment"), not items A/B/C in this triage. Flagging this disagreement as instructed: the brief's framing implies this fix addresses "the contrast offender" (singular) from this population, but the population's surviving contrast items use different CSS custom properties.

## Count

- CLOSED: 20 (9 w9-d items collapse to 8 distinct grades after 9a/9b/9c/9d
  split — see table; plus 4 w25-a duplicates of w9-d#6/7/8a/8b; plus DEC-244
  is PENDING not CLOSED; plus w27-b's 2, w27-e's 1)
- PENDING-OWNED: 1 — DEC-244 "version 2" (`task-w28-a`)
- OPEN-unowned: **7** — participation-menu-caret contrast x2 (A, B),
  review-checkbox-label contrast (C), cfp-step-next focus-visible (D),
  review-field-disabled selector-never-resolved (E), speakers toolbar
  List|Grid toggle missing, mobile render-sweep pass has no console-error
  collection.

OPEN ITEMS: 7
