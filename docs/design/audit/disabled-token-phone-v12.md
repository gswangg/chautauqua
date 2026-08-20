# Disabled token audit — phone (<=700px) blocks (DEC-367, wave-87 amendment, w5-i; re-derived DEC-745, wave-100, task w3-c)

`test/disabled-token-uses.scan.test.ts` was extended in its own idiom: the
population gains every rule inside a `@media (max-width: <=700px)` block
across `app/src/**/*.css` and `src/**/*.css.ts` (directory-walked, DEC-808),
and a use there is legal only when its selector resolves to an inert
control (`:disabled`, `[disabled]`, `[aria-disabled]`) or to the codebase's
own drag-handle token (`.chq-forms-field-drag`, derived from source by
finding the class attached to the element that wraps the `⋮⋮` glyph in
`app/src/pages/forms/FieldList.tsx` — never hand-named).

## Method

Every stylesheet under `app/src/**` and `src/**` (`.css` / `.css.ts`) was
walked; every `@media` block whose condition contains `max-width: <=700px`
was extracted with brace-counting; every rule inside such a block composing
`var(--chq-disabled)` or `var(--chq-disabled-bg)` was collected and checked
against the two legal uses above.

## Result: one hit, already legal

The scan finds exactly **one** rule in the whole tree that composes the
Disabled token inside a phone (<=700px) block:

- `app/src/pages/comms/comms.css` — `@media (max-width: 700px)` —
  `.chq-comms-preview-nav button:disabled` — legal (inert control, `:disabled`
  in the selector; this is the same pager-arrow-with-no-page-to-go-to rule
  the ruling itself cites as an example, already named in the base scan's
  `LEGAL_USES` table).

This is unchanged by the wave-100 amendment below — the checkbox/radio
`:disabled` rules the base (non-phone) scan was missing are both top-level
declarations (`app/src/styles.css:2114` sits after its enclosing
`@media (max-width: 700px)` block already closed at line ~2000; `src/views/theme.ts:368`
carries no enclosing media query at all), so neither one ever entered the
phone-block population above. The phone-block result was, and remains,
exactly one hit.

No offender was found anywhere else in the tree, including in every
cluster held by a live wave-4/wave-5 lane (`styles.css`, `review.css`,
`settings.css`, `speakers.css`, `task-view.css`, `content.css`,
`agenda.css`, `forms.css`, `overview.css`, `scorecard.css`, `comms.css`,
`contacts-panels.css`, `portal.css.ts`, `cfp.css.ts`, `docs-site.css.ts`,
and everything under `src/routes/public/css/`) and in the two files this
lane was permitted to fix directly (`app/src/components/*.css`,
`src/routes/tools.css.ts` — neither composes the Disabled token at all,
let alone inside a phone block).

**No FIX was needed in this wave**: the two files this lane owns were
already clean, and every other file's phone-scoped use of the token was
already a legal one. The mandate's fourth Tier-2 sweep is now built and
green with a non-vacuous population (the scan's own tripwire asserts at
least one hit exists and at least one of them is a known legal use, so a
regex that silently stopped matching would fail loudly rather than reading
as "zero offenders" by accident).

## If a future phone-block rule wants to reach for the token

It has exactly two doors: an inert control (`:disabled` / `[disabled]` /
`[aria-disabled]`) or the derived drag-handle class. Everything else is a
de-emphasis reflex and the remedy is weight, not lightness — 800 -> 600 at
`var(--chq-muted)` (`#565A4B`, 6.28:1) — not the Disabled register. A
genuine third case that is neither should get a
`/* PHONE-DISABLED-EXEMPT: <reason> */` comment directly above the rule
(structural, two-sided: the scan re-parses whatever rule currently follows
the comment, so a stale exemption over a since-fixed or since-moved rule
fails loudly with an explicit delete-this-line message rather than quietly
outliving the code it once excused).

## Wave-100 amendment (DEC-745): the BASE scan gained two named accounts

This audit had gone stale on one point: it only ever measured the
phone-block extension (DEC-367), and never re-derived the BASE
(non-phone) scan's own live population after `no LEGAL_USES row is dead`
and the "unaccounted rules" check went red on main. Re-run against the
live tree (task w3-c), the base scan's population is **14** rules
composing `var(--chq-disabled)` / `var(--chq-disabled-bg)` across the
whole tree (12 already had a named `LEGAL_USES` account; 2 did not):

```
app/src/pages/comms/comms.css :: .chq-comms-preview-nav button:disabled
app/src/pages/review/review.css :: .chq-review-add-link[aria-disabled='true']
app/src/pages/review/review.css :: .chq-review-field-disabled
app/src/pages/review/review.css :: .chq-review-field-disabled .chq-review-checkbox-label
app/src/pages/submissions/detail.css :: .chq-detail-session-details-fields #submission-format:disabled, .chq-detail-session-details-fields #submission-audience-level:disabled
app/src/pages/submissions/submissions.css :: .chq-submissions-clone:disabled
app/src/styles.css :: .chq-btn:disabled, .chq-btn[aria-disabled='true']
app/src/styles.css :: .chq-btn:disabled:hover, .chq-btn[aria-disabled='true']:hover, .chq-btn:disabled:active, .chq-btn[aria-disabled='true']:active
app/src/styles.css :: .chq-link-button:disabled, .chq-link-button:disabled:hover
app/src/styles.css :: input[type='checkbox']:disabled, input[type='radio']:disabled           <- was unaccounted
src/routes/portal/portal.css.ts :: .chq-portal-preview-download
src/views/theme.ts :: input[type=checkbox]:disabled, input[type=radio]:disabled               <- was unaccounted
src/views/theme.ts :: button:disabled, .chq-btn:disabled, button[aria-disabled=true], .chq-btn[aria-disabled=true]
src/views/theme.ts :: button:disabled:hover, .chq-btn:disabled:hover, button[aria-disabled=true]:hover, .chq-btn[aria-disabled=true]:hover, button:disabled:active, .chq-btn:disabled:active, button[aria-disabled=true]:active, .chq-btn[aria-disabled=true]:active
```

Per DEC-745, a checkbox/radio that cannot be toggled is B8's first legal
use (an inert control) — the same door `button:disabled` already walks
through. `test/disabled-token-uses.scan.test.ts` gained two named
`LEGAL_USES` accounts, one per file/spelling (`app/src/styles.css` quotes
its attribute values, `src/views/theme.ts` does not, so the two selector
strings never collide):

- `input[type='checkbox']:disabled, input[type='radio']:disabled` (`app/src/styles.css`)
- `input[type=checkbox]:disabled, input[type=radio]:disabled` (`src/views/theme.ts`)

Neither styles.css nor theme.ts was edited — both were already correct
(the ruling was about the GUARD, not the CSS). A new `NAMED_FILE_ACCOUNTS`
stale-account tripwire (mirroring
`app/src/phone-horizontal-overflow.scan.test.ts`'s `STALE_EXEMPTIONS`
shape) now fails loudly, naming the file, if either account's selector
ever stops matching a rule in its own named file.
