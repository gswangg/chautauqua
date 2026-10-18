# Admin 390 interactive offenders — named roster (DEC-851 amendment, wave 27)

Task w27-a named the gate's offenders for the first time. Task w4-bi fixed
`.chq-link-button`/`.chq-pill`'s width-floor gap. **RE-MEASURED, task
v12m-w11-tc (DEC-393/DEC-382):** re-ran the live gate fresh against this
task's own worktree rather than trusting this file's prior prose — DEC-393
governs exactly that: "the admin-390 tap floor is settled by re-running the
live gate, never by reading the offender roster's prose." This file's own
row 9 called `.chq-review-checkbox-label` "a class with no CSS rule of any
kind"; that is FALSE on this tree — `app/src/pages/review/review.css`
declares `min-height: 44px` for that selector today, both at its base rule
and again in its own terminal phone block (a prior task fixed it without
updating this roster). The whole roster below is re-derived from a fresh
run, not patched line-by-line.

## How this was measured

- Command: `npm run gate:render-sweep` (== `tsx scripts/render-sweep.ts`), run
  to completion twice in this task's worktree: once BEFORE any fix (to
  confirm the tree's real starting population), once AFTER (to confirm the
  fix and produce the number recorded below). Self-boots a migrated + seeded
  `wrangler dev` on an OS-ephemeral local port, killed by its own PID on exit
  — no `--remote`, no fixed port, no deploy.
- Sha measured (before-fix run): `bc0648e0bfdc15749e43d9acfbd701c1b3f47b2e`
  (this worktree's `main`-derived HEAD). Before-fix total: **79** — the
  ceiling's existing 79 was, in fact, still exactly the live count; nothing
  had drifted the total since task w4-bi despite this file's stale row-9
  classification.
- Sha measured (after-fix run): this task's own worktree HEAD, after the
  `.chq-auth-back` width-floor fix (`src/routes/auth.css.ts`) and the
  `.chq-settings-field label:has(> input.chq-check)` floor
  (`app/src/pages/settings/settings.css`) — the `.chq-wordmark` DEC-382
  exemption comment (`src/views/theme.ts`) is documentation only and does
  not change any measured box. After-fix total: **77**.
- Exit code both runs: non-zero, as expected — `ADMIN_MOBILE_PASS_BLOCKING`
  is `true` and per-route offenders remain even where the ceiling is not
  exceeded. A non-zero exit is not a failure of this task; it is the gate
  doing its job.
- Verbatim block captured (after-fix run), beginning
  `render-sweep: admin mobile interactive offenders (DEC-253/DEC-367/DEC-808)...`
  through the `total interactive offenders` line:

```
render-sweep: admin mobile interactive offenders (DEC-253/DEC-367/DEC-808)...
  /admin/overview: 1 offender(s): a.chq-overview-link-inline w=135px h=15px
  /admin/submissions: 30 offender(s): input.chq-check w=18px h=18px (x30)
  /admin/submissions/seed_submission_0001: 1 offender(s): input.chq-check w=18px h=18px
  /admin/submissions/seed_submission_0001?edit=1: 1 offender(s): input.chq-check w=18px h=18px
  /admin/speakers/tasks/seed_task_0001: 9 offender(s): input.chq-check.chq-taskview-check w=18px h=18px (x9)
  /admin/content/seed_submission_0001: 1 offender(s): input.chq-file.chq-content-upload-input w=1px h=44px
  /admin/contacts: 25 offender(s): input.chq-check w=18px h=18px (x25)
  /admin/settings?section=portal&edit=1: 1 offender(s): input.chq-check w=18px h=18px
  /admin/review/plans/new: 1 offender(s): input.chq-check w=18px h=18px
  /admin/review/plans/seed_evaluation_plan_0001: 1 offender(s): input.chq-check w=18px h=18px
  /admin/review/plans/seed_evaluation_plan_0001/submissions/seed_submission_0002: 4 offender(s): input.chq-review-choice-input w=18px h=18px (x3) | input.chq-check w=18px h=18px
  /dev/mailbox: 1 offender(s): a.chq-wordmark w=113px h=28px
  /dev/mailbox/seed_email_log_0001: 1 offender(s): a.chq-wordmark w=113px h=28px
render-sweep: admin mobile total interactive offenders: 77 (ceiling 77)
```

(the `(xN)` shorthand above collapses N identical printed lines for this
prose block only — the raw gate output repeats the same `selector w=.. h=..`
string N separate times per route, e.g. `/admin/submissions` prints
`input.chq-check w=18px h=18px` thirty times.)

**Fixed in this task** (v12m-w11-tc, DEC-393):

- `a.chq-auth-back` (`/account/password`, 37×44 → both dimensions now
  ≥44px): the phone rule at `src/routes/auth.css.ts` already carried
  `min-height: 44px` but no `min-width`/horizontal padding — the exact
  width-floor shape task w4-bi already fixed once for `.chq-link-button`/
  `.chq-pill`. Gained `min-width: 44px; align-items: center;
  justify-content: center; padding-inline: 4px;`, appended as the LAST rule
  of that sheet's one terminal `@media (max-width: 700px)` block
  (DEC-385 append-only). This retired BOTH `/account/password` sightings
  (organizer + reviewer manifest rows) — the only real count reduction in
  this task (79 → 77).
- `input.chq-check` at `/admin/settings?section=portal&edit=1`
  (PortalSettingsPanel's "Show resources" toggle,
  `SettingsEditForm.tsx`'s `SettingsField`): rendered inside a real
  `<label htmlFor>` (native click-through works) but that label carried NO
  phone floor of any kind — not `.chq-check-hit`, not
  `.chq-review-checkbox-label`, no `tap-floor-exempt:` comment anywhere
  reaching it. `.chq-settings-field label:has(> input.chq-check) {
  display: block; min-height: 44px; }` added to `app/src/pages/settings/
  settings.css`'s one terminal `@media (max-width: 700px)` block (ahead of
  the file's existing w17-d/DEC-919 terminal pair, so that pair's own
  "last two rules in the file" pin stays intact). The raw `<input>` itself
  stays 18×18 (unchanged offender count) — same as every other
  `.chq-check-hit`/`.chq-review-checkbox-label` site below, this reclassifies
  the sighting from a candidate defect to EXEMPT, it does not remove it from
  the printed total.

**Exempted by DEC-382, not restyled (this task):**

- `a.chq-wordmark` (`/dev/mailbox`, `/dev/mailbox/seed_email_log_0001`,
  113×28, height fails outright): a `tap-floor-exempt: DEC-382` comment was
  added directly above `.chq-wordmark`'s declaration in
  `src/views/theme.ts` (the shared `THEME_CSS` module). DEC-382 rules
  `/dev/mailbox` and `/docs/api` TOOLS_CSS operator chrome, outside the
  design system — this `<a class="chq-wordmark" href="/">` only renders as
  an anchor on those two operator surfaces (`src/routes/docs.tsx`'s
  `DocsPage`, `src/routes/dev/mailbox.tsx`'s mailbox list/detail views);
  every other mount (App.tsx's SPA header, `src/routes/portal/shared.tsx`)
  renders it as a non-interactive `<span>`, entirely outside the tap-floor
  population.
  Restyling this shared selector to hit the 44px floor would also inflate
  the wordmark on every real design-system surface reusing it — exactly
  the "never restyle into the design system" DEC-382 forbids. Left as
  measured, real, unfixed operator chrome.

**RETIRED wave 21 (DEC-903 amendment) — reclassified EXEMPT, not left uncounted:**

- `input.chq-check.chq-taskview-check` (`/admin/speakers/tasks/
  seed_task_0001`, 9 sightings): TaskView.tsx's select-all + per-row
  select controls. This roster previously classified them
  UNCLASSIFIED — candidate defect on the ground that no `<label>` wrapped
  them; app/src/pages/speakers/TaskView.tsx`<label className="chq-check-hit">`
  now wraps both real input sites (app/src/check-hit-receipt.scan.test.ts's
  4-site count assertion, `nearestLabelIsCheckHit` true for
  the two real inputs) — idiom 2, widened to ARIA-role
  `columnheader`/`cell` tables by DEC-991 wave-w11-te. Reclassified EXEMPT
  in row 13 below; the raw `<input>` box stays 18×18 (unchanged offender
  count), still counted in the measurement and in the roster.

## The exemption idioms

1. **`tap-floor-exempt: …` comment** — a CSS block comment whose text
   begins `tap-floor-exempt:`, sitting as the LAST comment immediately
   above the rule for the offending selector/token (no code between the
   comment's closer and the selector's opener). Mechanically:
   `hasExemptionForToken`/`lastLeadingCommentIsExempt` in
   `app/src/phone-tap-target-scan/core.ts` (lines 170-192,299-306).
   Instances reaching this roster's rows: `.chq-review-choice-input` in
   `app/src/pages/review/review.css`, `.chq-content-upload-input` in
   `app/src/pages/content/content.css`, `.chq-overview-link-inline` in
   `app/src/pages/overview/overview.css`, the top-level
   `input[type='checkbox'], input[type='radio'], .chq-check` rule in
   `app/src/styles.css`, and — new this task — `.chq-wordmark` in
   `src/views/theme.ts`, naming DEC-382 as the reason (an operator-surface
   exemption, not a wrapping-label one).
2. **Wrapping `.chq-check-hit` label** — a bare table-cell `.chq-check`
   input wrapped in `<label className="chq-check-hit">`, which carries
   `min-height:44px; min-width:44px; padding:13px; margin:-13px;` in the
   terminal `@media (max-width:700px)` block of `app/src/styles.css`.
   Receipted by `app/src/check-hit-receipt.scan.test.ts`
   (DEC-393 wave-124 / DEC-991); population is every `.chq-check` site
   immediately inside a `<td>`/`<th>`. `ContactsTable.tsx`,
   `SubmissionsTable.tsx` are the sites reaching this roster's rows.
3. **Wrapping label with its own real floor (idiom-2 analog, not
   `.chq-check-hit`)** — a `.chq-check` wrapped in some OTHER `<label>`
   that itself carries a genuine `min-height:44px` (block-level, so
   `min-height` actually applies) in the terminal phone block, same
   ergonomic contract as idiom 2 without the specific class name:
   `.chq-review-checkbox-label` (`app/src/pages/review/review.css`, base
   rule plus its own terminal phone block — `PlanEditor.tsx`'s
   `anonymized`/`required` checkboxes) and — new this task —
   `.chq-settings-field label:has(> input.chq-check)`
   (`app/src/pages/settings/settings.css`, this task's fix —
   `PortalSettingsPanel.tsx`'s "Show resources" toggle).
4. **`.chq-forms-field-drag` drag handle** — the form-builder/plan-editor
   reorder handle (`app/src/pages/forms/FieldList.tsx`,
   `app/src/pages/review/PlanEditor.tsx`), the DESIGN-RULINGS drag-handle
   exemption. Zero offenders in this run's roster carry this selector.

Anything that matches none of the four: `UNCLASSIFIED — candidate defect`.

## Roster (grouped by matching selector/site — re-measured task v12m-w11-tc, widened by wave-23 task w23-f and multi-portal, 126 rows total)

| # | Route(s) | Selector | Box (w×h) | Count | Classification |
|---|----------|----------|-----------|-------|-----------------|
| 1 | `/admin/overview` | `a.chq-overview-link-inline` | 135×15 | 1 | **EXEMPT — idiom 1** (`tap-floor-exempt:` comment in overview.css) |
| 2 | `/admin/contacts` | `input.chq-check` (ContactsTable row-select, `.chq-check-hit` wrap) | 18×18 | 25 | **EXEMPT — idiom 2** |
| 3 | `/admin/submissions` | `input.chq-check` (SubmissionsTable row-select, `.chq-check-hit` wrap) | 18×18 | 36 | **EXEMPT — idiom 2** |
| 4 | `/admin/submissions/seed_submission_0001` | `input.chq-check` (same row-select idiom, detail page) | 18×18 | 1 | **EXEMPT — idiom 2** |
| 5 | `/admin/submissions/seed_submission_0001?edit=1` | `input.chq-check` (same row-select idiom, edit panel open) | 18×18 | 1 | **EXEMPT — idiom 2** |
| 6 | `/admin/content/seed_submission_0001` | `input.chq-file.chq-content-upload-input` | 1×44 | 1 | **EXEMPT — idiom 1** (visually-hidden input, operable target is its `<label for>`, content.css) |
| 7 | `/admin/review/plans/new` | `input.chq-check` (PlanEditor `anonymized`/`required`, `.chq-review-checkbox-label` wrap) | 18×18 | 1 | **EXEMPT — idiom 3** (review.css base + phone rules) |
| 8 | `/admin/review/plans/seed_evaluation_plan_0001` | `input.chq-check` (same PlanEditor idiom) | 18×18 | 1 | **EXEMPT — idiom 3** |
| 9 | `/admin/review/plans/seed_evaluation_plan_0001/submissions/seed_submission_0002` | `input.chq-review-choice-input` (Scorecard Choice-criterion radio, `.chq-review-choice-option` label wrap) | 18×18 | 3 | **EXEMPT — idiom 1** (`tap-floor-exempt:` comment in review.css) |
| 10 | `/admin/review/plans/seed_evaluation_plan_0001/submissions/seed_submission_0002` | `input.chq-check` (same PlanEditor `.chq-review-checkbox-label` idiom, submission-scoped route) | 18×18 | 1 | **EXEMPT — idiom 3** |
| 11 | `/admin/settings?section=portal&edit=1` | `input.chq-check` (PortalSettingsPanel "Show resources" toggle, `SettingsField`'s `<label>`) | 18×18 | 1 | **EXEMPT — idiom 3, FIXED task v12m-w11-tc** (`settings.css`: `.chq-settings-field label:has(> input.chq-check)` gained `min-height:44px`) |
| 12 | `/dev/mailbox`, `/dev/mailbox/seed_email_log_0001` | `a.chq-wordmark` | 113×28 | 2 | **EXEMPT — idiom 1, DEC-382 (this task)** (`theme.ts`: operator-surface `tap-floor-exempt:` comment, `/dev/mailbox`/`/docs/api` chrome) |
| 13 | `/admin/speakers/tasks/seed_task_0001` | `input.chq-check.chq-taskview-check` (TaskView.tsx select-all + per-row select) | 18×18 | 9 | **EXEMPT — idiom 2, RETIRED wave 21 (DEC-903 amendment).** app/src/pages/speakers/TaskView.tsx`<label className="chq-check-hit">` now wraps both real input sites, receipted by app/src/check-hit-receipt.scan.test.ts`taskViewSites.filter((s) => s.nearestOpenTag === 'label' && s.nearestLabelIsCheckHit)` (w56-i: re-anchored on structural role, count-asserted at 4 total sites, rather than a hand-pinned exact line list that reddened on unrelated edits) — idiom 2 was widened to ARIA-role `columnheader`/`cell` tables by DEC-991 wave-w11-te (comment at app/src/styles.css`DEC-991 wave-w11-te`). The raw `<input>` box is unchanged (still 18×18); this reclassifies the sighting from a candidate defect to EXEMPT, it does not remove it from the printed total. |
| 14 | `/admin/contacts?import=1` | `input.chq-check` (ContactsTable row-select under the import overlay, same `.chq-check-hit` wrap as row 2) | 18×18 | 25 | **EXEMPT — idiom 2, ADDED wave 23 (task w23-f, `route-substate-390-sweep-v12.md`).** Same DOM population as row 2, reachable at a second URL once `app/src/routeManifest.ts` widened to visit `?import=1` — not a new defect. |
| 15 | `/admin/submissions/seed_submission_0001?history=0` | `input.chq-check` (same row-select idiom as rows 4-5, history-panel closed sub-state) | 18×18 | 1 | **EXEMPT — idiom 2, ADDED wave 23 (task w23-f, `route-substate-390-sweep-v12.md`).** Same DOM population as rows 4-5, reachable at a third URL once the manifest widened to visit `?history=0` — not a new defect. |
| 16 | `/admin/settings/portals/library` | `a.chq-library-portal` (the "Used by" sentence's portal links) | ~56-101×14 | 16 | **EXEMPT — idiom 1, ADDED multi-portal** (`tap-floor-exempt:` comment in `app/src/pages/portals/library.css`: inline links inside a sentence, not row actions). |
| 17 | `/admin/settings/portals/demo_mp_portal_invited` | `input.chq-check` (portal editor permissions table) | 18×18 | 1 | **EXEMPT — idiom 2, ADDED multi-portal.** |

**Row-count check: 25+36+1+1+1+1+3+1+1+2+9+1+1+25+1+16+1 = 126.** Matches the
printed total exactly (the two `.chq-auth-back` sightings from the
before-fix run are gone from this table entirely — fixed, not merely
reclassified, so they are not rows at all any more).

## Totals (re-derived wave 28, task v12m-w28-d, DEC-996 wave-28 amendment)

**The roster's own row table (below) is the single population; its sum is
checked by `test/admin-390-offender-roster.scan.test.ts` directly against
`scripts/render-sweep-lib.ts`'s `ADMIN_MOBILE_INTERACTIVE_OFFENDERS_CEILING`
— that constant is the ONE owner of the measured number now (DEC-996
wave-28 amendment; this file no longer states a second, independently-typed
"Measured total: **N**" literal for a parser to cross-check, the exact
two-copies shape DEC-613 forbids, which is how the ceiling and this roster
drifted to 77 vs 103 in the wave-25/wave-27/wave-23 merge train).**

Current value (row-table sum = ceiling): **126** (multi-portal re-derivation, 2026-10-17: the same gate run printed 126, all EXEMPT; row 3 grew by the DevFlow demo's 6 sessions, rows 16-17 are the new portal pages).

Re-derivation receipt, wave 28: ran `npm run db:migrate && npm run seed &&
npm run gate:render-sweep` to completion against this task's own worktree
HEAD (self-boots a migrated + seeded local `wrangler dev`, same recipe as
every prior live re-derivation of this number). Printed:
`render-sweep: admin mobile total interactive offenders: 103 (ceiling 77)`
— a route-for-route, selector-for-selector match to the 15-row table below
(same 17 route sightings, same box dimensions, same counts, including the
wave-23 `/admin/contacts?import=1` and
`/admin/submissions/seed_submission_0001?history=0` rows). The
machine-written companion roster
(`docs/design/audit/admin-mobile-tap-floor-390-v12.md`, overwritten by that
same run) independently classified all 103 as EXEMPT, 0 CANDIDATE —
agreeing with every row's classification below.

77 (DEC-393, v12m-w11-tc) + 26 (wave 23, task w23-f's route-substate
widening — see `docs/design/audit/route-substate-390-sweep-v12.md`) = 103.
This was always the tree's real, current population; a wave-25 lane
misread this file's own prose out of chronological order and "lowered" the
ceiling from 103 back to 77 (task w27-a's amendment text, which pre-dates
wave 23's widening but was applied to the constant afterward) — the
wave-28 re-derivation above confirms the correct, current, live number is
103, and the ceiling has been raised back to it with this run as its
receipt (DEC-967: measured, not invented; DEC-996 wave-28 amendment:
raising a ceiling to match a real, re-measured population is honest —
lowering a roster to match a stale ceiling is not).

- **EXEMPT** (idioms 1-3, rows 1-10, 12, 14-15): **93** (1+25+30+1+1+1+1+1+3+1+2+25+1).
- **FIXED, DEC-393 (v12m-w11-tc)** (row 11 — reclassified EXEMPT via idiom
  3, no longer a candidate defect; still counted in the 103 since the raw
  `<input>` box is unchanged): **1**.
- **RETIRED, DEC-903 (wave 21 amendment)** (row 13 — reclassified EXEMPT
  via idiom 2, no longer a candidate defect; still counted in the 103
  since the raw `<input>` box is unchanged): **9**.
- **Genuinely retired, DEC-393 (v12m-w11-tc)** (`.chq-auth-back`, formerly
  2 sightings at `/account/password`, both dimensions now ≥44px): **2** —
  the whole reason the total moved from 79 to 77.
- **ADDED, wave 23 (task w23-f)** (rows 14-15 — the manifest-widening's own
  new sightings, both EXEMPT — idiom 2 on arrival, never a candidate
  defect): **26** — the whole reason the total moved from 77 to 103.
- **ADDED, multi-portal (2026-10-17)** (row 3's +6 from the DevFlow demo
  seed's sessions, rows 16-17 on the new portal pages, all EXEMPT on
  arrival): **23** — the whole reason the total moved from 103 to 126.
- Idiom 4 (`.chq-forms-field-drag`): 0 offenders in this roster.

The 9 offenders in row 13 were previously classified as one code-level
gap, not 9 independent defects — **TaskView.tsx's `.chq-check` selects**
had no wrapping `<label>` at all. RETIRED wave 21 (DEC-903 amendment):
`<label className="chq-check-hit">` now wraps both real input sites (see
row 13 above), so idiom 2 reaches them and they are EXEMPT, still counted
in the 77.
