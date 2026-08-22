# Admin 390 interactive offenders — named roster (DEC-851 amendment, wave 27)

Task w27-a. `ADMIN_MOBILE_INTERACTIVE_OFFENDERS_CEILING = 79` (`scripts/render-sweep-lib.ts:525`)
is a real measured number and `ADMIN_MOBILE_PASS_BLOCKING = true`
(`scripts/render-sweep-lib.ts:445`), but the offender rows the live gate prints
are stdout only — nothing in the tree named a single one. This is that
naming pass: every offender the live gate reported, one row per measured
control, classified against the three exemption idioms already in the tree.

## How this was measured

- Command: `npm run gate:render-sweep` (== `tsx scripts/render-sweep.ts`), run
  to completion. The script self-boots a migrated + seeded `wrangler dev` on
  an OS-ephemeral local port and kills it by its own PID on exit — no
  `--remote`, no fixed port, no deploy.
- Product sha measured: `d755468ea6962338ab52129caf0dd6d2ce1ea687` (this
  worktree's `main`-derived HEAD at the time of the run, before this
  roster/test were added).
- Exit code: non-zero, as expected — `ADMIN_MOBILE_PASS_BLOCKING` is `true`
  and the measured total exceeds the ceiling (see below). A non-zero exit is
  not a failure of this task; it is the gate doing its job.
- **RE-MEASURED, task w4-bi:** `test/admin-390-offender-roster.scan.test.ts`
  went red — `RECORDED_TOTAL` parsed from this file (80) exceeded
  `ADMIN_MOBILE_INTERACTIVE_OFFENDERS_CEILING` (79) — so this task re-ran
  `npm run gate:render-sweep` fresh against `main`, ROOT-CAUSE-ing rather
  than re-wording the total. Two things had changed since wave 27, both
  visible only by re-measuring, never by re-reading the old roster:
  1. `ADMIN_MOBILE_ROUTE_MANIFEST` gained two `?edit=1` route entries not
     visited by the wave-27 run (`app/src/routeManifest.ts` lines 101,192, DEC-144
     wave-28 amendment, landed after this file was written) —
     `/admin/submissions/seed_submission_0001?edit=1` and
     `/admin/settings?section=portal&edit=1`. The first re-visits the SAME
     `.chq-check-hit`-wrapped row-select checkbox the non-edit route already
     rosters (real, but the same idiom-2 exemption, not a new gap). The
     second is genuinely NEW: a bare `.chq-check` inside `PortalSettingsPanel.tsx`'s
     "Show resources" toggle, wrapped only in `SettingsField`'s own
     unstyled `<label>` (`app/src/pages/settings/SettingsEditForm.tsx:99`)
     — the same "wrapped in a label with zero floor CSS" shape row 9 below
     already names for `PlanEditor.tsx`'s `.chq-review-checkbox-label`, one
     more sighting of the same systemic gap, not a new species of defect.
  2. The re-measurement also confirmed the population's OWN pre-existing
     "1 over" (the wave-27 `80` was 1 over the `79` ceiling even before the
     two new routes) was real and still un-fixed — three sites shared the
     exact same width-floor CSS shape wave 26's field-guide entry had
     already named systemically: `.chq-link-button`'s and `.chq-pill`'s
     phone rules set `min-height:44px` with non-zero horizontal padding but
     no `min-width`, so a short label (`Edit`, `Files`) clears the height
     floor and misses the width one. **Fixed in this task**: `min-width:
     44px` added to both rules (`app/src/styles.css`, the `.chq-link-button`
     block and a new dedicated `.chq-pill` block split out of the shared
     `.chq-pill, .chq-rail-link, .chq-checkbox-label, .chq-btn-tertiary`
     min-height rule so `.chq-rail-link`/`.chq-checkbox-label`/
     `.chq-btn-tertiary` are untouched). This retired all four sightings of
     the gap at once (`/admin/submissions/seed_submission_0001` and its new
     `?edit=1` twin, `/admin/speakers/seed_contact_0001`,
     `/admin/content?view=files` — rows 11-13 below are now FIXED, not
     UNCLASSIFIED).
  - Re-measured total after the fix: **79**, exactly at the ceiling. Sha
    re-measured: this task's own worktree HEAD (`v12m-w4-bi`, after the
    `styles.css` fix, before this file's own edit).
  - The `.chq-auth-back` (row 14) and `.chq-wordmark` (row 15) gaps are the
    SAME width/height-floor shape and were deliberately left unfixed — out
    of this task's narrow scope (naming + the two sites that were tipping
    the ceiling over, not a full sweep of every site sharing the pattern).
- Verbatim block captured, beginning
  `render-sweep: admin mobile interactive offenders (DEC-253/DEC-367/DEC-808)...`
  through the `total interactive offenders` line:

```
render-sweep: admin mobile interactive offenders (DEC-253/DEC-367/DEC-808)...
  /admin/overview: 1 offender(s): a.chq-overview-link-inline w=135px h=15px
  /admin/submissions: 30 offender(s): input.chq-check w=18px h=18px | input.chq-check w=18px h=18px | input.chq-check w=18px h=18px | input.chq-check w=18px h=18px | input.chq-check w=18px h=18px | input.chq-check w=18px h=18px | input.chq-check w=18px h=18px | input.chq-check w=18px h=18px | input.chq-check w=18px h=18px | input.chq-check w=18px h=18px | input.chq-check w=18px h=18px | input.chq-check w=18px h=18px | input.chq-check w=18px h=18px | input.chq-check w=18px h=18px | input.chq-check w=18px h=18px | input.chq-check w=18px h=18px | input.chq-check w=18px h=18px | input.chq-check w=18px h=18px | input.chq-check w=18px h=18px | input.chq-check w=18px h=18px | input.chq-check w=18px h=18px | input.chq-check w=18px h=18px | input.chq-check w=18px h=18px | input.chq-check w=18px h=18px | input.chq-check w=18px h=18px | input.chq-check w=18px h=18px | input.chq-check w=18px h=18px | input.chq-check w=18px h=18px | input.chq-check w=18px h=18px | input.chq-check w=18px h=18px
  /admin/submissions/seed_submission_0001: 2 offender(s): input.chq-check w=18px h=18px | button.chq-detail-section-action.chq-link-button w=29px h=44px
  /admin/speakers/seed_contact_0001: 1 offender(s): button.chq-link-button w=39px h=44px
  /admin/speakers/tasks/seed_task_0001: 9 offender(s): input.chq-check.chq-taskview-check w=18px h=18px | input.chq-check.chq-taskview-check w=18px h=18px | input.chq-check.chq-taskview-check w=18px h=18px | input.chq-check.chq-taskview-check w=18px h=18px | input.chq-check.chq-taskview-check w=18px h=18px | input.chq-check.chq-taskview-check w=18px h=18px | input.chq-check.chq-taskview-check w=18px h=18px | input.chq-check.chq-taskview-check w=18px h=18px | input.chq-check.chq-taskview-check w=18px h=18px
  /admin/content?view=files: 1 offender(s): button.chq-pill.is-active w=40px h=44px
  /admin/content/seed_submission_0001: 1 offender(s): input.chq-file.chq-content-upload-input w=1px h=44px
  /admin/contacts: 25 offender(s): input.chq-check w=18px h=18px | input.chq-check w=18px h=18px | input.chq-check w=18px h=18px | input.chq-check w=18px h=18px | input.chq-check w=18px h=18px | input.chq-check w=18px h=18px | input.chq-check w=18px h=18px | input.chq-check w=18px h=18px | input.chq-check w=18px h=18px | input.chq-check w=18px h=18px | input.chq-check w=18px h=18px | input.chq-check w=18px h=18px | input.chq-check w=18px h=18px | input.chq-check w=18px h=18px | input.chq-check w=18px h=18px | input.chq-check w=18px h=18px | input.chq-check w=18px h=18px | input.chq-check w=18px h=18px | input.chq-check w=18px h=18px | input.chq-check w=18px h=18px | input.chq-check w=18px h=18px | input.chq-check w=18px h=18px | input.chq-check w=18px h=18px | input.chq-check w=18px h=18px | input.chq-check w=18px h=18px
  /admin/review/plans/new: 1 offender(s): input.chq-check w=18px h=18px
  /admin/review/plans/seed_evaluation_plan_0001: 1 offender(s): input.chq-check w=18px h=18px
  /admin/review/plans/seed_evaluation_plan_0001/submissions/seed_submission_0002: 4 offender(s): input.chq-review-choice-input w=18px h=18px | input.chq-review-choice-input w=18px h=18px | input.chq-review-choice-input w=18px h=18px | input.chq-check w=18px h=18px
  /account/password: 1 offender(s): a.chq-auth-back w=37px h=44px
  /account/password: 1 offender(s): a.chq-auth-back w=37px h=44px
  /dev/mailbox: 1 offender(s): a.chq-wordmark w=113px h=28px
  /dev/mailbox/seed_email_log_0001: 1 offender(s): a.chq-wordmark w=113px h=28px
render-sweep: admin mobile total interactive offenders: 80 (ceiling 79)
```

Wave-27 measured total, now superseded (see task w4-bi note above): 80.
This was 1 OVER the then-current ceiling of 79. Re-measured, task w4-bi,
after the `.chq-link-button`/`.chq-pill` width-floor fix retired 4
sightings of one systemic gap (see above) — a genuine fix, not a re-count:

Measured total: **79**

Exactly at the ceiling. The ceiling itself is untouched
(`scripts/render-sweep-lib.ts` line 525, `= 79`) — never raised from
judgment, per the task brief, and this measurement does not ask for it to
be lowered either, since 79 is exactly the ceiling, not below it.

`/account/password` and `/dev/mailbox`/`/dev/mailbox/seed_email_log_0001`
each print twice because `ADMIN_MOBILE_ROUTE_MANIFEST`
(`scripts/render-sweep.ts`) is built by filtering
`ROUTE_MANIFEST` (`app/src/routeManifest.ts`) to `role === "organizer" ||
role === "reviewer"` — `/account/password` has separate `organizer` and
`reviewer` manifest rows (`app/src/routeManifest.ts`), and
`/dev/mailbox`(`/seed_email_log_0001`) likewise carries both roles. Each row
is visited and measured independently, so it is a real double-count of two
distinct page visits, not a printing artefact.

## The three ruled exemption idioms

1. **`tap-floor-exempt: …` comment** — a CSS block comment whose text begins
   `tap-floor-exempt:`, sitting as the LAST comment immediately above the
   rule for the offending selector/token (no code between the comment's
   closer and the selector's opener). Mechanically:
   `hasExemptionForToken`/`lastLeadingCommentIsExempt` in
   `app/src/phone-tap-target-scan/core.ts` (lines 170-192,299-306). The JSX form
   (`{/* tap-floor-exempt: inline-in-prose ... */}`, `src/routes/public/submit-views.tsx`)
   is one instance of this idiom; a CSS-comment instance directly above a
   rule (e.g. `.chq-review-choice-input` in `app/src/pages/review/review.css`,
   `.chq-content-upload-input` in `app/src/pages/content/content.css`,
   `.chq-overview-link-inline` in `app/src/pages/overview/overview.css`,
   and the top-level `input[type='checkbox'], input[type='radio'], .chq-check`
   rule in `app/src/styles.css`) is another.
2. **Wrapping `.chq-check-hit` label** — a bare table-cell `.chq-check`
   input wrapped in `<label className="chq-check-hit">`, which carries
   `min-height:44px; min-width:44px; padding:13px; margin:-13px;` in the
   terminal `@media (max-width:700px)` block of `app/src/styles.css`
   (`:2803`). Receipted by `app/src/check-hit-receipt.scan.test.ts`
   (DEC-393 wave-124 / DEC-991), whose own derived population is every
   `.chq-check` site immediately inside a `<td>`/`<th>` (not any other
   wrapper). `ContactsTable.tsx`, `SubmissionsTable.tsx`,
   `ComposeWizard.tsx`, `SessionList.tsx` are the wrapped sites.
3. **`.chq-forms-field-drag` drag handle** — the form-builder/plan-editor
   reorder handle (`app/src/pages/forms/FieldList.tsx` line 299,
   `app/src/pages/review/PlanEditor.tsx` lines 1908,2046), the DESIGN-RULINGS
   drag-handle exemption. Zero offenders in this run's roster carry this
   selector, so it classifies nothing below.

Anything that matches none of the three: `UNCLASSIFIED — candidate defect`.

## Roster (grouped by matching selector/site — re-measured task w4-bi, 79 rows total)

| # | Route(s) | Selector | Box (w×h) | Count | Classification |
|---|----------|----------|-----------|-------|-----------------|
| 1 | `/admin/contacts` | `input.chq-check` (ContactsTable row-select, wrapped `<label className="chq-check-hit">`, `ContactsTable.tsx` lines 108,144) | 18×18 | 25 | **EXEMPT — idiom 2** (`.chq-check-hit` wrap, receipted by `check-hit-receipt.scan.test.ts`) |
| 2 | `/admin/submissions` | `input.chq-check` (SubmissionsTable row-select, wrapped `<label className="chq-check-hit">`, `SubmissionsTable.tsx` lines 521,561) | 18×18 | 30 | **EXEMPT — idiom 2** |
| 3 | `/admin/submissions/seed_submission_0001` | `input.chq-check` (same SubmissionsTable row-select idiom, detail page) | 18×18 | 1 | **EXEMPT — idiom 2** |
| 4 | `/admin/submissions/seed_submission_0001?edit=1` | `input.chq-check` (same row-select idiom; new manifest row, DEC-144 wave-28 amendment, revisits the same detail page with the edit panel open — the row-select checkboxes are unaffected by the panel) | 18×18 | 1 | **EXEMPT — idiom 2** |
| 5 | `/admin/review/plans/seed_evaluation_plan_0001/submissions/seed_submission_0002` | `input.chq-review-choice-input` (Scorecard.tsx Choice-criterion radio, wrapped `<label htmlFor className="chq-review-choice-option">`, floored `min-height:44px` at `review.css:1768`) | 18×18 | 3 | **EXEMPT — idiom 1** (`tap-floor-exempt:` comment directly above `.chq-review-choice-input`, `review.css:1780-1784`, naming the wrapping label as the tap anchor) |
| 6 | `/admin/overview` | `a.chq-overview-link-inline` | 135×15 | 1 | **EXEMPT — idiom 1** (`tap-floor-exempt:` comment, `overview.css:500-502`: "a URL inside a sentence is content, and flooring it would break the line box") |
| 7 | `/admin/content/seed_submission_0001` | `input.chq-file.chq-content-upload-input` | 1×44 | 1 | **EXEMPT — idiom 1** (`tap-floor-exempt:` comment, `content.css:431-434`: visually-hidden input, operable target is its `<label for>`) |
| 8 | `/admin/speakers/tasks/seed_task_0001` | `input.chq-check.chq-taskview-check` (TaskView.tsx select-all + per-row select, `TaskView.tsx` lines 570,591) | 18×18 | 9 | **UNCLASSIFIED — candidate defect.** These sit bare inside `<span role="columnheader">`/`<span role="cell">`, not `<td>`/`<th>`, and are not wrapped in ANY `<label>` — no `.chq-check-hit`, no other wrap. The top-level `tap-floor-exempt:` comment on `.chq-check` (idiom 1, `styles.css:1948`) claims "every option-list/toggle site already renders its `.chq-check` inside its own `<label>`"; that claim is false for these two sites specifically, and `check-hit-receipt.scan.test.ts`'s population walk only looks for `<td>`/`<th>`/`<label>` nesting, so it never sees these ARIA-div-table cells either. Neither the CSS comment's premise nor the one test that checks it covers this population — a receipt gap, not a receipt. |
| 9 | `/admin/review/plans/new`, `/admin/review/plans/seed_evaluation_plan_0001`, `/admin/review/plans/seed_evaluation_plan_0001/submissions/seed_submission_0002` | `input.chq-check` (PlanEditor.tsx `anonymized`/`required` checkboxes, wrapped `<label className="chq-review-checkbox-label">`, `PlanEditor.tsx` lines 1609,2150) | 18×18 | 3 | **UNCLASSIFIED — candidate defect.** `.chq-review-checkbox-label` has zero rules anywhere in `review.css` or `styles.css` (`grep` for the token returns nothing) — no floor of any kind, phone or desktop. Not `.chq-check-hit`, no `tap-floor-exempt:` comment for this wrapper or for `.chq-check` reaching it. |
| 10 | `/admin/settings?section=portal&edit=1` | `input.chq-check` (PortalSettingsPanel.tsx "Show resources" toggle, wrapped only in `SettingsField`'s own generic `<label>`, `SettingsEditForm.tsx:99`; new manifest row, DEC-144 wave-28 amendment — this section's edit panel didn't exist in the wave-27 measurement) | 18×18 | 1 | **UNCLASSIFIED — candidate defect.** Same shape as row 9: a real `<label>` wraps the checkbox, but neither `SettingsField`'s bare `<label>` nor any selector reaching it carries a phone floor of any kind — `grep` for a `.chq-settings-field label` or equivalent floor rule in `settings.css`/`styles.css` returns nothing. Not `.chq-check-hit` (not a table cell), no `tap-floor-exempt:` comment. |
| 11 | ~~`/admin/submissions/seed_submission_0001`~~ | ~~`button.chq-detail-section-action.chq-link-button`~~ | ~~29×44~~ | n/a | **FIXED, task w4-bi.** `.chq-link-button`'s phone rule (`app/src/styles.css`, the `.chq-link-button` block) gained `min-width: 44px; justify-content: center;` alongside its existing `min-height:44px; padding:0 6px;` — height already cleared the floor, width now does too regardless of label length. No longer an offender (confirmed by re-running `npm run gate:render-sweep`); the `?edit=1` twin of this route (which would otherwise have rostered the same offender a second time) never appears in the offender list at all. |
| 12 | ~~`/admin/speakers/seed_contact_0001`~~ | ~~`button.chq-link-button`~~ | ~~39×44~~ | n/a | **FIXED, task w4-bi.** Same `.chq-link-button` fix as row 11 — this site shares the exact same rule, so one CSS change retired both sightings. |
| 13 | ~~`/admin/content?view=files`~~ | ~~`button.chq-pill.is-active`~~ | ~~40×44~~ | n/a | **FIXED, task w4-bi.** `.chq-pill`'s phone rule (`app/src/styles.css`) was split out of the shared `.chq-pill, .chq-rail-link, .chq-checkbox-label, .chq-btn-tertiary` min-height block into its own dedicated `.chq-pill { min-width: 44px; justify-content: center; }` rule — `.chq-rail-link`/`.chq-checkbox-label`/`.chq-btn-tertiary`, whose own content already reliably clears 44px, are untouched. No longer an offender. |
| 14 | `/account/password` (×2, organizer + reviewer manifest rows) | `a.chq-auth-back` | 37×44 | 2 | **UNCLASSIFIED — candidate defect, left unfixed (out of scope for task w4-bi).** `src/routes/auth.css.ts` line 356's phone rule is `min-height: 44px` only, no width, no horizontal padding declared on this selector at all — same width-floor gap pattern rows 11-13 had, before their fix. |
| 15 | `/dev/mailbox`, `/dev/mailbox/seed_email_log_0001` | `a.chq-wordmark` | 113×28 | 2 | **UNCLASSIFIED — candidate defect, left unfixed (out of scope for task w4-bi).** `app/src/styles.css:308` declares this class exactly once, no `@media` override, no `min-height`, no exemption comment anywhere. Height fails outright (28 < 44), not just the width dimension. |

**Row-count check (live rows only, rows 11-13 struck through as fixed):
25+30+1+1+3+1+1+9+3+1+2+2 = 79.** Matches the printed total exactly.

## Totals

- Measured total (re-measured, task w4-bi): **79**, exactly at the ceiling
  of 79. Ceiling left unchanged (never raised from judgment; not asked to
  be lowered either, since 79 is not below the ceiling it names).
- **EXEMPT** (idiom 1 or 2, rows 1, 2, 3, 3b, 4, 5, 6): **62**
  (25 + 30 + 1 + 1 + 3 + 1 + 1).
- **UNCLASSIFIED — candidate defect** (rows 7, 8, 8b, 12, 13): **17**
  (9 + 3 + 1 + 2 + 2).
- **FIXED, task w4-bi** (rows 9, 10, 11 — no longer offenders, not counted
  in the 79): **3** (1 + 1 + 1).
- Idiom 3 (`.chq-forms-field-drag`): 0 offenders in this roster.

The 17 remaining unclassified rows are grouped into four distinct
code-level gaps, not 17 independent defects:

- **TaskView.tsx's `.chq-check` selects** (9) have no wrapping `<label>` at
  all — a markup gap, not a floor gap.
- **PlanEditor.tsx's `.chq-check` selects** (3) are wrapped in
  `.chq-review-checkbox-label`, a class with no CSS rule of any kind.
- **PortalSettingsPanel.tsx's `.chq-check` select** (1, row 8b) is wrapped
  in `SettingsField`'s own generic `<label>`, which likewise carries no
  phone floor of any kind — the same "labelled but unfloored" shape as
  PlanEditor.tsx's gap above, a second sighting of the same systemic issue
  under a different wrapper class.
- **The `.chq-auth-back` width-floor gap** (2, row 14) is the same shape
  the now-fixed `.chq-link-button`/`.chq-pill` sites had — a
  `min-height:44px` rule with no `min-width` — left unfixed here as out of
  this task's narrow scope (the two fixed selectors were the ones tipping
  the ceiling over; this task did not sweep every site sharing the
  pattern).
- **`.chq-wordmark`** (2) has no phone floor treatment at all.

None of these four remaining gaps are scheduled or fixed by task w4-bi —
naming them is that task's scope for the remainder. The `.chq-link-button`/
`.chq-pill` width-floor gap (formerly rows 11-13) WAS fixed by task w4-bi,
since it was the specific gap whose growth (two new `?edit=1` route
sub-states plus its own pre-existing 1-over) pushed the recorded total over
the ceiling; see the "How this was measured" section above.
