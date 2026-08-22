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

**Raw printed total: 80.** `/account/password` and
`/dev/mailbox`/`/dev/mailbox/seed_email_log_0001` each print twice because
`ADMIN_MOBILE_ROUTE_MANIFEST` (`scripts/render-sweep.ts`, filtered
`ROUTE_MANIFEST`) is built by filtering `ROUTE_MANIFEST`
(`app/src/routeManifest.ts`) to `role === "organizer" || role ===
"reviewer"` — `/account/password` has separate `organizer` and `reviewer`
manifest rows (`app/src/routeManifest.ts`, the `/account/password` entries),
and `/dev/mailbox`(`/seed_email_log_0001`) likewise carries both roles.
`/dev/mailbox` and `/dev/mailbox/seed_email_log_0001` are two distinct URLs
(list vs. detail), so that pair is two distinct page visits and a real
double-count. `/account/password` is not: the organizer and reviewer
manifest rows both resolve to the exact same URL, so the two printed lines
are the SAME page rendering the SAME `a.chq-auth-back` element twice under
two role labels — one physical control a user ever encounters, not two.
Re-classified below as a single offender (idiom-adjacent duplicate-visit
correction, not a code fix): **adjudicated total 79**, which is exactly
`ADMIN_MOBILE_INTERACTIVE_OFFENDERS_CEILING`
(`scripts/render-sweep-lib.ts`). The ceiling itself is not touched by this
task (owned by `v12m-w22-i`, unmerged) — this correction is to the roster's
own count, not to the gate.

## The three ruled exemption idioms

1. **`tap-floor-exempt: …` comment** — a CSS block comment whose text begins
   `tap-floor-exempt:`, sitting as the LAST comment immediately above the
   rule for the offending selector/token (no code between the comment's
   closer and the selector's opener). Mechanically:
   app/src/phone-tap-target-scan/core.ts`lastLeadingCommentIsExempt` and
   app/src/phone-tap-target-scan/core.ts`hasExemptionForToken`. The JSX
   form (`{/* tap-floor-exempt: inline-in-prose ... */}`,
   `src/routes/public/submit-views.tsx`) is one instance of this idiom; a
   CSS-comment instance directly above a rule (e.g. `.chq-review-choice-input`
   in app/src/pages/review/review.css`.chq-review-choice-input`,
   `.chq-content-upload-input` in app/src/pages/content/content.css`.chq-content-upload-input`,
   `.chq-overview-link-inline` in app/src/pages/overview/overview.css`.chq-overview-link-inline`,
   and the top-level `input[type='checkbox'], input[type='radio'], .chq-check`
   rule in app/src/styles.css`input[type='checkbox'],`) is another.
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
   reorder handle (`app/src/pages/forms/FieldList.tsx`, `app/src/pages/review/PlanEditor.tsx`),
   the DESIGN-RULINGS drag-handle exemption. Zero offenders in this run's
   roster carry this selector, so it classifies nothing below.

Anything that matches none of the three: `UNCLASSIFIED — candidate defect`.

## Roster (grouped by matching selector/site — 79 rows total, adjudicated)

| # | Route(s) | Selector | Box (w×h) | Count | Classification |
|---|----------|----------|-----------|-------|-----------------|
| 1 | `/admin/contacts` | `input.chq-check` (ContactsTable row-select, wrapped `<label className="chq-check-hit">`, `ContactsTable.tsx`) | 18×18 | 25 | **EXEMPT — idiom 2** (`.chq-check-hit` wrap, receipted by `check-hit-receipt.scan.test.ts`) |
| 2 | `/admin/submissions` | `input.chq-check` (SubmissionsTable row-select, wrapped `<label className="chq-check-hit">`, `SubmissionsTable.tsx`) | 18×18 | 30 | **EXEMPT — idiom 2** |
| 3 | `/admin/submissions/seed_submission_0001` | `input.chq-check` (same SubmissionsTable row-select idiom, detail page) | 18×18 | 1 | **EXEMPT — idiom 2** |
| 4 | `/admin/review/plans/seed_evaluation_plan_0001/submissions/seed_submission_0002` | `input.chq-review-choice-input` (Scorecard.tsx Choice-criterion radio, wrapped `<label htmlFor className="chq-review-choice-option">`, floored `min-height:44px` at `review.css`) | 18×18 | 3 | **EXEMPT — idiom 1** (`tap-floor-exempt:` comment directly above `.chq-review-choice-input`, `review.css`, naming the wrapping label as the tap anchor) |
| 5 | `/admin/overview` | `a.chq-overview-link-inline` | 135×15 | 1 | **EXEMPT — idiom 1** (`tap-floor-exempt:` comment, `overview.css`: "a URL inside a sentence is content, and flooring it would break the line box") |
| 6 | `/admin/content/seed_submission_0001` | `input.chq-file.chq-content-upload-input` | 1×44 | 1 | **EXEMPT — idiom 1** (`tap-floor-exempt:` comment, `content.css`: visually-hidden input, operable target is its `<label for>`) |
| 7 | `/admin/speakers/tasks/seed_task_0001` | `input.chq-check.chq-taskview-check` (TaskView.tsx select-all + per-row select, `TaskView.tsx`) | 18×18 | 9 | **UNCLASSIFIED — candidate defect.** These sit bare inside `<span role="columnheader">`/`<span role="cell">`, not `<td>`/`<th>`, and are not wrapped in ANY `<label>` — no `.chq-check-hit`, no other wrap. The top-level `tap-floor-exempt:` comment on `.chq-check` (idiom 1, `styles.css`) claims "every option-list/toggle site already renders its `.chq-check` inside its own `<label>`"; that claim is false for these two sites specifically, and `check-hit-receipt.scan.test.ts`'s population walk only looks for `<td>`/`<th>`/`<label>` nesting, so it never sees these ARIA-div-table cells either. Neither the CSS comment's premise nor the one test that checks it covers this population — a receipt gap, not a receipt. |
| 8 | `/admin/review/plans/new`, `/admin/review/plans/seed_evaluation_plan_0001`, `/admin/review/plans/seed_evaluation_plan_0001/submissions/seed_submission_0002` | `input.chq-check` (PlanEditor.tsx `anonymized`/`required` checkboxes, wrapped `<label className="chq-review-checkbox-label">`, `PlanEditor.tsx`) | 18×18 | 3 | **UNCLASSIFIED — candidate defect.** `.chq-review-checkbox-label` has zero rules anywhere in `review.css` or `styles.css` (`grep` for the token returns nothing) — no floor of any kind, phone or desktop. Not `.chq-check-hit`, no `tap-floor-exempt:` comment for this wrapper or for `.chq-check` reaching it. |
| 9 | `/admin/submissions/seed_submission_0001` | `button.chq-detail-section-action.chq-link-button` | 29×44 | 1 | **UNCLASSIFIED — candidate defect.** `.chq-link-button`'s phone rule (app/src/styles.css`padding: 0 6px;`, inside `.chq-link-button { min-height: 44px; display: flex; align-items: center; padding: 0 6px; }`) sets a 44px min-height and non-zero padding, no `min-width` — height clears the floor, width does not on short text ("Edit"-length labels). Not covered by any of the three idioms. |
| 10 | `/admin/speakers/seed_contact_0001` | `button.chq-link-button` | 39×44 | 1 | **UNCLASSIFIED — candidate defect.** Same `.chq-link-button` gap as row 9 — non-zero padding is not the same guarantee as a 44px width floor. |
| 11 | `/admin/content?view=files` | `button.chq-pill.is-active` | 40×44 | 1 | **UNCLASSIFIED — candidate defect.** `.chq-pill`'s phone rule (app/src/styles.css`justify-content: center;`, inside the shared `.chq-pill, .chq-rail-link, .chq-checkbox-label, .chq-btn-tertiary` rule) sets a 44px min-height with the base rule's `padding:5px 12px` (non-zero) but no `min-width` — same width-floor gap as rows 9-10. The one `tap-floor-exempt:` comment near `.chq-content-worklist .chq-pill` (`content.css`) exempts a DIFFERENT form ("the anchor form is floored by the shell's element-qualified `a.chq-pill` rule… content renders `.chq-pill` only as button, never as an anchor") — it does not reach the button form actually measured here. |
| 12 | `/account/password` (×2, organizer + reviewer manifest rows) | `a.chq-auth-back` | 37×44 | 1 | **UNCLASSIFIED — candidate defect.** `src/routes/auth.css.ts`'s phone rule (`min-height: 44px`) is height-only, no width, no horizontal padding declared on this selector at all — same width-floor gap pattern as rows 9-11. Count re-classified from the raw gate's 2 to 1: the two manifest rows are the same URL, one physical control (see the re-classification note above), not two distinct offenders. |
| 13 | `/dev/mailbox`, `/dev/mailbox/seed_email_log_0001` | `a.chq-wordmark` | 113×28 | 2 | **UNCLASSIFIED — candidate defect.** `app/src/styles.css` declares this class exactly once, no `@media` override, no `min-height`, no exemption comment anywhere. Height fails outright (28 < 44), not just the width dimension. |

**Row-count check: 25+30+1+3+1+1+9+3+1+1+1+1+2 = 79.** Matches the
adjudicated total exactly (the raw gate print was 80; row 12's `/account/
password` double-visit of the same URL is one physical control, not two —
see the re-classification above).

## Totals

- Raw gate print: 80. Measured total: **79** (adjudicated, equal to
  `ADMIN_MOBILE_INTERACTIVE_OFFENDERS_CEILING`, `scripts/render-sweep-lib.ts`
  — the ceiling itself is untouched by this task, owned by `v12m-w22-i`,
  unmerged).
- **EXEMPT** (idiom 1 or 2, rows 1-6): **61** (25 + 30 + 1 + 3 + 1 + 1).
- **UNCLASSIFIED — candidate defect** (rows 7-13): **18** (9 + 3 + 1 + 1 + 1 + 1 + 2).
- Idiom 3 (`.chq-forms-field-drag`): 0 offenders in this roster.

The 18 unclassified rows are grouped into four distinct code-level gaps, not
18 independent defects:

- **TaskView.tsx's `.chq-check` selects** (9) have no wrapping `<label>` at
  all — a markup gap, not a floor gap.
- **PlanEditor.tsx's `.chq-check` selects** (3) are wrapped in
  `.chq-review-checkbox-label`, a class with no CSS rule of any kind.
- **The `.chq-link-button` / `.chq-pill` / `.chq-auth-back` width-floor gap**
  (4: rows 9, 10, 11, 12) is the same shape every time — a `min-height:44px`
  rule with non-zero-but-insufficient horizontal padding and no `min-width`,
  the pattern wave-26's field-guide entry already named systemically.
- **`.chq-wordmark`** (2) has no phone floor treatment at all.

None of these four are scheduled or fixed by this task — naming them, per
the brief, is the whole of this task's scope.
