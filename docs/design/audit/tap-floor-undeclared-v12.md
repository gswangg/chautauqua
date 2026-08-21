# Tap-floor v12 audit: undeclared-height offenders (task w9-l, DEC-367 wave-120 PREDICATE REPAIR)

The base tap-target scan (`app/src/phone-tap-target.scan.test.ts`'s
`findOffenders()`, DEC-253/DEC-367) has always dropped a candidate BEFORE
testing it against the 44px floor whenever its top-level rule declares
neither `height` nor `min-height` at all:

```
const height = declaredHeightPx(body);
if (height === undefined || height >= TAP_FLOOR_PX) continue;
```

`height === undefined` (nothing declared) and `height >= TAP_FLOOR_PX`
(already conforming) take the SAME `continue` — so a control that never
named a height was invisible to the ratchet meant to catch sub-floor
controls. That is the inverse of the truth: a control with no declared
height cannot reach 44px except by accident of line-height.
The rule opened at app/src/pages/review/review.css`.chq-review-queue-footer-showall {`
(drift-proof citation, DEC-967 wave-115 -- as of this wave the rule body
opens with `font-family: inherit;` before `border: none;` and
`background: none;`, so the selector line alone is what still resolves
verbatim; the older three-clause single-line quote no longer exists in
the file) declares font-family, border, background,
padding and font-size — and no height of any kind. It styles a real
button element at app/src/pages/review/ReviewerQueue.tsx`className="chq-review-queue-footer-showall"`
(drift-proof citation, DEC-967 wave-115), the same shape used again at
app/src/pages/review/PlanEditor.tsx`className="chq-review-queue-footer-showall"`
(drift-proof citation, DEC-967 wave-115). That is
the proof —
the live 390 probe (`docs/probes/metafid-phoneB-ssr-2026-08-19.md`)
measured it at 52×30, sub-floor, while `findOffenders()` and both SSR tap
ratchets all read clean.

This audit file is the instrument's first receipt, not a drain: no
stylesheet is touched in the task that produced it (DEC-991 forbids
authoring exemptions ahead of the fixes they would excuse). It exists so a
future lane can pick a row and fix it without re-deriving the population.

## Predicate

New population, scanned by `app/src/phone-tap-target-scan/undeclared.ts`
(`findUndeclaredHeightOffenders`), wired into
`app/src/phone-tap-target-undeclared.scan.test.ts`:

- **Candidate**: a token in the base tap-target population (a `chq-…`
  class in a class position on `<input>`/`<select>`/`<button>`, or on
  `<a>` carrying `chq-btn`) whose top-level rule declares NO `height`
  property (neither `height` nor `min-height`) at all.
- **Cleared** by any of:
  1. a phone-scoped (`max-width: <=700px`) rule reaching the token with
     `min-height >= 44px`;
  2. **composition** — every markup site carrying the token also carries
     a token that is itself floored (declares `height`/`min-height`
     `>= 44px` somewhere, top-level or phone-scoped), derived from the
     TSX class lists, never hand-listed. This is what removes
     `.chq-btn-primary`/`.chq-btn-secondary` from the population: they
     only ever appear beside the floored `.chq-btn`.
  3. a named `/* tap-floor-exempt: <reason> */` comment over the rule.

## Measurement method

Force `UNDECLARED_HEIGHT_OFFENDERS_CEILING` to `-1` in
`app/src/phone-tap-target-undeclared.scan.test.ts` so the offender-ceiling
`it()` fails unconditionally, run

```
npx vitest run --config vitest.fast.config.ts app/src/phone-tap-target-undeclared.scan.test.ts
```

and read the offender list the failure message prints — never trust a
previously recorded number or this doc's own table. Do this in a
throwaway edit (revert the `-1` afterwards); do not commit it.

## CLOSED (wave 19, task w19-d)

Re-ran `npx vitest run --config vitest.fast.config.ts
app/src/phone-tap-target-undeclared.scan.test.ts`: 7/7 green, all 23 rows
below fixed. `app/src/phone-tap-target-undeclared.scan.test.ts`'s
`export const UNDECLARED_HEIGHT_OFFENDERS_CEILING = 0;` and its "stays at
or under the undeclared-height offender ceiling" test both pass, meaning
`findUndeclaredHeightOffenders()` now measures ZERO offenders against the
live tree. Per DEC-069 wave-140 this table is annotated CLOSED, not
deleted, so a future regression (ceiling raised back above 0, or a new
undeclared-height token appearing) reads as a regression against this
row, not a blank page.

## Measured truth: 23 offenders, 13 sheets (wave 120, task w9-l) -- HISTORICAL, superseded by the CLOSED note above

| Sheet | Selector | Token |
| --- | --- | --- |
| `app/src/components/event-switcher.css` | `.chq-eventswitcher-menu-item` | `chq-eventswitcher-menu-item` |
| `app/src/pages/agenda/agenda.css` | `.chq-day-grid-clash-item` | `chq-day-grid-clash-item` |
| `app/src/pages/comms/comms.css` | `.chq-comms-template-name` | `chq-comms-template-name` |
| `app/src/pages/contacts/contacts-panels.css` | `.chq-add-to-event-card` | `chq-add-to-event-card` |
| `app/src/pages/contacts/contacts-panels.css` | `.chq-contacts-pipeline-card-fit-edit` | `chq-contacts-pipeline-card-fit-edit` |
| `app/src/pages/contacts/contacts-panels.css` | `.chq-contacts-pipeline-card-name` | `chq-contacts-pipeline-card-name` |
| `app/src/pages/contacts/contacts.css` | `.chq-contacts-name` | `chq-contacts-name` |
| `app/src/pages/contacts/contacts.css` | `.chq-contacts-record-value` | `chq-contacts-record-value` |
| `app/src/pages/review/review.css` | `.chq-review-choice-input` | `chq-review-choice-input` |
| `app/src/pages/review/review.css` | `.chq-review-editor-footer-delete` | `chq-review-editor-footer-delete` |
| `app/src/pages/review/review.css` | `.chq-review-queue-footer-showall` | `chq-review-queue-footer-showall` |
| `app/src/pages/review/review.css` | `.chq-review-sort-button` | `chq-review-sort-button` |
| `app/src/pages/settings/settings.css` | `.chq-settings-portal-add-resource` | `chq-settings-portal-add-resource` |
| `app/src/pages/speakers/speakers.css` | `.chq-participation-menu-action` | `chq-participation-menu-action` |
| `app/src/pages/speakers/speakers.css` | `.chq-participation-menu-item` | `chq-participation-menu-item` |
| `app/src/pages/speakers/speakers.css` | `.chq-speaker-detail-task-remind` | `chq-speaker-detail-task-remind` |
| `app/src/pages/speakers/speakers.css` | `.chq-speakers-task-edit-item` | `chq-speakers-task-edit-item` |
| `app/src/pages/submissions/detail.css` | `.chq-detail-section-action` | `chq-detail-section-action` |
| `app/src/pages/submissions/submissions.css` | `.chq-submissions-clone` | `chq-submissions-clone` |
| `app/src/pages/submissions/submissions.css` | `.chq-submissions-viewtabs-save` | `chq-submissions-viewtabs-save` |
| `app/src/styles.css` | `.chq-empty-escape` | `chq-empty-escape` |
| `app/src/styles.css` | `.chq-nav-link` | `chq-nav-link` |
| `app/src/styles.css` | `.chq-section-action` | `chq-section-action` |

`.chq-review-queue-footer-showall` is the row this task's description
names as the live probe's proof (52×30 measured at 390). None of the
other 22 have been independently probed; they are offenders by the same
predicate, not yet confirmed by a device measurement.

Each row's fix is additive-only inside its sheet's terminal
`@media (max-width: 700px)` block (DEC-385): `min-height: 44px` +
centred flex + non-zero horizontal padding on the control itself, or a
named `tap-floor-exempt` comment where the control is not, in fact, a
phone tap target (e.g. decorative/never-rendered-on-phone). This lane does
not decide which; it only measures.
