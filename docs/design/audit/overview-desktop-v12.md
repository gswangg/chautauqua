# Overview v12 DESKTOP (1600) per-frame render verdicts (w23-c, DEC-976 wave-23 amendment)

Per-frame render VERDICTS for the five Overview frames the wave-23 amendment
names (`:353` "Widths · what a wide monitor gets" is the ledger's own
hand-excluded explainer panel and is not adjudicated here), entered through
the app's real routes and asserted against jsdom DOM structure (never a
computed style — jsdom applies no stylesheet) or, for the two claims that are
inherently a CSS fact, against the app's own stylesheet TEXT. This
supersedes `test/desktop-frame-ledger.scan.test.ts`'s citation-only CLAIMED
credit for these five frames specifically: every row below was RENDERED, not
merely cited. Receipts live in
`app/src/pages/Overview.desktop-frame-verdicts.render.test.tsx`.

STRICTLY MEASUREMENT ONLY (the mandate's desktop freeze, DEC-976 wave-105's
asymmetric-honesty rule): this document and its test file render, verdict,
and file divergences in prose — they move no desktop byte and edit no
component or stylesheet, even where a real divergence is found below.

## Frame :28 "What needs you today · 1600"

**MATCHES, with one filed DIVERGES.** (DEC-099 wave-14m clause 1: the one
item this heading names, §03's "Ask for changes" control, is
CLOSED-with-receipt below via DEC-720 wave-8 — this heading narrates that
closed finding.) Entered via `OverviewPage` at
`/overview`, populated with a fixture whose four actionable totals (one
overdue task, one triage submission, one content approval, one unplaced
session) sum to four — the SAME arithmetic `headlineText()` runs to produce
the h1, not a copy of the frame's literal string.

- The headline (docs/design/Chautauqua Overview.dc.html:65) MATCHES: with
  that fixture, `headlineCount()`'s sum lands on the frame's own "Four
  things need your attention" by construction, not by hardcoding the frame's
  copy — the tree computes the count, spells it, and pluralizes it
  (`headlineText()` in overview/rows.ts), which is a stronger claim than a
  literal string match would be.
- The toolbar (docs/design/Chautauqua Overview.dc.html:67-68) MATCHES:
  `Export` then `New submission`, in that order, both real links.
- §01's caption (docs/design/Chautauqua Overview.dc.html:77) MATCHES:
  "Skips anyone reminded in the last hour" renders once an overdue row
  exists.
- §02's triage card (docs/design/Chautauqua Overview.dc.html:106-109)
  MATCHES: Accept / Decline / Waitlist / Read the abstract render in the
  frame's order — all four controls, not a phone-width subset (Waitlist's
  phone stand-down, DEC-610 wave-83 amendment, is a `max-width:700px`-only
  rule and does not apply at this frame's 1600 width).
- **§03 CLOSED-with-receipt** (docs/design/Chautauqua Overview.dc.html:127-128,
  DEC-720 wave-8 amendment): the frame draws `Approve` then `Ask for
  changes` — a second DECISION, sending the submission back to its
  speaker. The tree now renders all three controls in the frame's order —
  `Approve`, `Ask for changes`, `Open` — with `Ask for changes` firing the
  same optimistic row-removal + rollback path as `Approve`, posting
  `{ contentStatus: 'changes_requested' }` to the row's own
  `/submissions/:id/content-status` endpoint (the silent, no-email flip
  DEC-720's wave-32 amendment already built; `Open` is kept per DEC-902 — a
  frame's control list is a floor, not a ceiling). Receipt:
  `app/src/pages/Overview.render.test.tsx` ("renders §03 controls Approve /
  Ask for changes / Open in DOM order..." and "'Ask for changes' posts
  changes_requested and removes the row optimistically...") and
  `app/src/pages/Overview.desktop-frame-verdicts.render.test.tsx`
  ("MATCHES (DEC-720 wave-8): §03 draws Approve / \"Ask for changes\" /
  Open, in that order").
- §04's overflow (docs/design/Chautauqua Overview.dc.html:164) MATCHES: with
  a fixture whose unplaced total exceeds the (empty) rows array, §04 renders
  a plain `<div class="chq-overview-overflow">` below the row list — the
  same "summary line below the list, never a nav link above it" shape the
  frame's own §04 caption uses, matching §01's identical overflow idiom one
  section up.

## Frame :308 "New event"

**MATCHES.** This frame's own subtitle is "From the event switcher in any
header" — it is chrome shared by every page, not part of `OverviewPage`'s
own component tree (`EventSwitcher` lives in `App.tsx`'s `<Header>`, a
sibling of the routed page content, never a child of it). Entered via the
real `App` shell (its own `BrowserRouter`) navigated to `/admin/overview`,
so the header a user actually sees while on Overview is the genuine chrome
under test — never `EventSwitcher` mounted as an isolated sub-component.

- Opening "New event…" from the Overview header's switcher menu shows a
  `role="dialog"` titled "New event" (docs/design/Chautauqua
  Overview.dc.html:308/314) carrying a `Close` control
  (docs/design/Chautauqua Overview.dc.html:317) — MATCHES.
- The modal's action row (docs/design/Chautauqua Overview.dc.html:343-344)
  MATCHES: `Create the event` (primary) precedes `Cancel` (secondary), same
  order as the frame.

This frame's full field-by-field contract (placeholders, validation,
Escape-to-dismiss) is already covered in depth by
`app/src/components/EventSwitcher.render.test.tsx`; the two checks above are
this cluster's own receipt that the modal is genuinely reachable from
Overview's header, not a re-derivation of EventSwitcher's own suite.

## Frame :432 "Overview · a brand-new event"

**MATCHES.** Entered via `OverviewPage` at `/overview`, with a payload whose
every worklist total and v1 aggregate is zero — the exact predicate
`isBrandNewEvent()` in Overview.tsx checks.

- The h1 reads "Overview" with a "· nothing scheduled" summary clause beside
  it (docs/design/Chautauqua Overview.dc.html:458-459) — MATCHES, the event
  name resolved from the same `/events` fetch the slug-resolution effect
  already runs, never a literal.
- The empty state's headline and reason sentence (docs/design/Chautauqua
  Overview.dc.html:462-463) render verbatim — MATCHES.
- The two-action row (docs/design/Chautauqua Overview.dc.html:465-466)
  MATCHES: `Set up the call for papers` (primary, routes to
  `/settings?section=cfp`) precedes `Add a speaker by hand ›` (secondary,
  routes to `/speakers`), same order and same two destinations as the
  frame.

## Frame :476 "States · hover, pending, drag"

**MATCHES for the states Overview implements; DIVERGES (by omission, not
defect) for the two it does not draw at all.** (DEC-380 wave-130
amendment, "a frame's drawing does not create a data model" — its inverse
here: a system-wide catalogue frame's drawing does not create a control
this specific page never needed; see the bullet below.) This frame is a
system-wide
token catalogue rather than a page-specific screen, so it is verdicted
against the SPECIFIC control families Overview's own stylesheet draws,
never against a re-read of the pack as its own proof.

- The frame's own rule for its Buttons section (docs/design/Chautauqua
  Overview.dc.html:491, "Each tier darkens in its own family · nothing
  moves") MATCHES: `overview.css`'s secondary tier
  (`.chq-overview-btn`) and tertiary tier (`.chq-overview-link-btn`) each
  declare their own `transition: background-color`/`transition: color`
  rule, and none of the four control-tier rules read (primary, toolbar
  primary, secondary, tertiary) carries a `transform` or `box-shadow`
  declaration anywhere — colour-only, matching "nothing moves" exactly.
- **DIVERGES by omission**: the frame also catalogues a "Pending" tier
  (docs/design/Chautauqua Overview.dc.html:690, counted/uncountable
  progress, the button becomes its own progress indicator) and a "Drag"
  tier (dragged card / origin slot / valid target, for agenda session
  reordering). Overview draws neither: `overview.css` carries no
  `cursor:progress` declaration anywhere (its Accept/Decline/Approve/Remind
  actions are simple optimistic toggles with loud rollback, never an
  in-flight counted send or upload) and no `draggable`/`chq-drag*` token at
  all — session drag-and-drop is Agenda's own page, not Overview's. This is
  not a broken control (there is nothing broken); it is the frame
  documenting a design-system pattern this specific page never needed,
  filed here for completeness rather than silently assumed. **Adjudicated
  (DEC-380 wave-130 amendment):** the ruling that a frame's drawing does
  not create a data model applies by the same logic to a frame's drawing
  not creating a control family a page has no use for — Pending/Drag are
  recorded here for completeness, not scheduled as debt.

## Frame :689 "Loading · the first paint"

**MATCHES.** Overview's own use of the shared `PageSkeleton` primitive
(`variant="list"`), rendered synchronously on the very first paint while
`loading || !payload` — verdicted by querying the DOM immediately after
`render()`, before the mocked fetch's microtask has a chance to resolve,
which is what actually proves "the first frame", not merely "eventually".

- The frame's own six-row rule (docs/design/Chautauqua Overview.dc.html:726,
  "Six rows, always") MATCHES: exactly six `.chq-skeleton-row` elements
  render, from the shared `SKELETON_ROWS = 6` constant in
  `PageSkeleton.tsx` — never a guess at the real count.
- The frame's own no-shimmer/tone rule (docs/design/Chautauqua
  Overview.dc.html:731, "Blocks never shimmer or pulse... the skeleton uses
  #EFEBDF, the same tone as a hovered row") MATCHES, verdicted against
  `page-skeleton.css`'s and `styles.css`'s own stylesheet TEXT (jsdom
  applies no stylesheet, so a computed-style read would be fiction):
  `page-skeleton.css` contains no `@keyframes` and no `animation:`
  declaration anywhere, and `.chq-skeleton-bar`'s background token,
  `var(--chq-surface-sunk)`, resolves in `styles.css` to `#efebdf` — the
  frame's own literal, case aside.

## Summary

| Frame | Verdict |
| --- | --- |
| :28 What needs you today · 1600 | MATCHES (§03 "Ask for changes" CLOSED-with-receipt, DEC-720 wave-8) |
| :308 New event | MATCHES |
| :432 Overview · a brand-new event | MATCHES |
| :476 States · hover, pending, drag | MATCHES for Buttons; DIVERGES by omission (no Pending/Drag controls exist on this page) — adjudicated, DEC-380 wave-130 |
| :689 Loading · the first paint | MATCHES |

4 of 5 frames now MATCH outright as rendered; the remaining partial row is a
documentation-catalogue frame whose Pending/Drag tiers this specific page
simply never draws. §03's "Ask for changes" gap (Overview previously had no
"request changes" action, only a decision-free `Open` link) closed this
wave (DEC-720 wave-8 amendment) — see the CLOSED-with-receipt bullet above.
