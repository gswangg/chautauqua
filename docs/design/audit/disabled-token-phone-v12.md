# Disabled token audit — phone (<=700px) blocks (DEC-367, wave-87 amendment, w5-i)

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
