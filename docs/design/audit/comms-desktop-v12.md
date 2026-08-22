# Comms v12 DESKTOP (1600) per-frame render verdicts (w23-e, DEC-976 wave-23 amendment)

Per-frame render VERDICTS for four of Comms' nine desktop (1600) frames in
`docs/design/Chautauqua Comms.dc.html`, entered through the app's real route
(`CommsPage` via `MemoryRouter` + `?tab=<tab>`, DEC-710) and asserted against
jsdom DOM structure/order/text — never a computed style, since jsdom applies
no stylesheet — or, for the one claim that is inherently a CSS fact, against
the app's own `comms.css` stylesheet TEXT. Comms' phone half already carries
a real render receipt (`Comms.frame-verdicts.render.test.tsx`, the three 390
frames); this document and its sibling test file
(`app/src/pages/Comms.desktop-frame-verdicts.render.test.tsx`) are the FIRST
real render receipt for any of Comms' desktop frames — the cluster's
existing citation-only ledger (`docs/design/audit/comms-v12.md`, owned by an
in-flight branch and untouched here) scores desktop by citation, not
conformance (DEC-967).

STRICTLY MEASUREMENT ONLY (the mandate's desktop freeze): this document and
its test file render, verdict, and file divergences in prose — they move no
desktop byte and edit no component or stylesheet, even where a real
divergence is found below.

## Frames covered this wave

- `:222` "Templates" (1600)
- `:360` "Compose · step 1 of 4" (1600)
- `:544` "Comms · nothing sent yet" (1600)
- `:589` "Comms · history" (1600)

## Frames NOT covered this wave (honest remainder)

`docs/design/Chautauqua Comms.dc.html` draws nine 1600px desktop frames in
total; five are un-adjudicated by any render receipt after this wave:

- `:28` "Compose · step 3 of 4 · 1600"
- `:453` "Compose · step 4 of 4"
- `:750` "Compose · send blocked"
- `:686` "What each template renders"
- `:712` "DevFlow Conf 2027"

`:695` (`{{ e.name }}`, the per-template email-preview loop inside the
`:686` frame) is a template-interpolation placeholder, excluded from the
population entirely by the ledger's own template-interpolation pattern —
not a frame this document owes a verdict on.

## Frame `:222` "Templates" (1600)

**MATCHES**, with one additive structural DIVERGES noted below. Entered via
`?tab=templates`.

- The drill head (frame :229, `Templates` H1) MATCHES: breadcrumb "‹ Comms",
  H1 "Templates", and a "New template" primary render inside
  `.chq-comms-templates-head`, in that composition.
- **DIVERGES (additively, cosmetic)**: the frame draws the saved-templates
  list as a bare two-column `<div style="display:grid; grid-template-
  columns:1fr auto...">` row (frame :239) — the tree instead renders that
  same list as a real `<table>` with `Name` / `Last used` column heads
  (`TemplatesTab.tsx`'s `.chq-comms-templates-table`). Same content, same
  reading order, a more semantic DOM shape than the frame drew — filed as a
  DIVERGES per this task's mandate to record any structural mismatch, not
  because it is a defect.
- Opening Templates MATCHES the frame's own assumption (frame :250,
  `Acceptance` eyebrow): the editor auto-selects the first saved template
  (`TemplatesTab.tsx`'s DEC-890 amendment-4 effect), with "Duplicate"
  beside the eyebrow exactly as drawn.
- **MATCHES (DEC-993)**: the frame draws "Insert a field" as a permanently
  open panel (frame :265's caret span sits directly above every merge-field
  row with no closed state at all). The tree instead renders a CLOSED
  "Insert a field ▾" trigger (`aria-expanded="false"`, no `role="menu"` in
  the DOM until clicked) — a landed, ruled improvement (DEC-993 "merge
  fields are a dropdown"), not the frame's shape. Clicking it opens the
  menu with all fields.
- The editor footer (frame :270-271, `Save` + `Use in a send`) MATCHES —
  and, notably, MATCHES the frame's own DESKTOP pairing exactly, unlike the
  discrepancy `Comms.frame-verdicts.render.test.tsx` already docket for the
  390 Templates frame (which draws `Save` + `Cancel`; the app's phone
  footer is `Save` + `Use in a send` too, so it is the 390 FRAME, not the
  tree, that is inconsistent between its own two widths).

## Frame `:360` "Compose · step 1 of 4" (1600)

**DIVERGES** on the frame's own demo STATE (default selection), MATCHES on
structure. Entered via `?tab=compose` (the default tab, `ComposeWizard`'s
real first step).

- The step strip (frame :375, `Recipients`/`Template`/`Preview`/`Send`)
  MATCHES in title and order.
- **DIVERGES**: the frame's own demo data opens step 1 with 23 recipients
  ALREADY selected — the step strip reads "23 accepted speakers" (frame
  :376) and the bulk bar is drawn armed ("23 selected", "Kept as you change
  filters…", frame :401-410). The tree's real entry starts with `EMPTY_
  SELECTION` (`ComposeWizard.tsx`): the step-strip detail reads "None
  selected yet" and the bulk bar renders its idle hint ("Tick rows to email
  selected submissions.") until a row is checked. This is a genuine, if
  cosmetic, divergence between the frame's populated demo state and the
  app's actual cold-start state — not a defect (selecting-then-composing is
  the product's real flow), filed here per the mandate.
- The question head (frame :404, "Nothing sends until step 4") MATCHES
  verbatim, beside the "Who is this going to?" `<h2>`.
- **DIVERGES**: the frame draws exactly THREE status filter pills —
  Accepted/Declined/Waitlisted (frame :408-410). The tree renders all SIX
  `SUBMISSION_STATUSES` pipeline literals (`Pending`, `Accept queue`,
  `Decline queue`, `Accepted`, `Declined`, `Waitlisted`) as pills — an
  already-established, cross-surface vocabulary choice (every status pill
  filter in the product renders the full pipeline, not a decided-only
  subset), not new debt.
- The recipient table (frame :425, column order checkbox/Submission/
  Speaker/Status/Slot) MATCHES in order — the tree's own header reads
  "Speakers" (plural) where the frame prints "Speaker" (singular), a
  one-word copy variance, not a structural mismatch — and an unslotted row
  correctly carries the "No slot yet" flag (`chq-flag`).
- The footer (frame :443, right-flushed Cancel + "Next: choose a template")
  MATCHES.

## Frame `:544` "Comms · nothing sent yet" (1600, fresh empty state)

**MATCHES** on every text/structure claim the frame draws inside its own
1600px shell; **DIVERGES (additively)** on what surrounds that shell.
Entered via `?tab=compose` with an all-time-empty batch list and zero
seven-day totals (Comms.tsx's own `isFreshEmpty` two-signal check).

- The head subtitle (frame :571, "No sends on this event") MATCHES
  verbatim, replacing the send-rhythm sentence exactly as the frame draws.
- The empty-state heading (frame :575, "You have not emailed anyone yet")
  and the decided-but-untold reason line (frame :576, "N submissions have a
  decision and nobody has been told. Every send is logged here
  afterwards.") MATCH, with N sourced from the real accepted-submissions
  count (`Comms.tsx`'s `decidedUntoldCount` fetch) rather than the frame's
  fixed demo "23".
- The primary/secondary pair (frame :578-579, "Tell the N accepted
  speakers" / "Read the templates ›") MATCHES: the primary label falls back
  to "Tell your accepted speakers" only while the count hasn't settled,
  never a fabricated number (DEC-678); the secondary link text and
  destination (`/comms?tab=templates`) match.
- **DIVERGES (additively)**: the frame's own :548 shell draws ONLY the H1 +
  empty-state block — no `role="tablist"` region anywhere inside it. The
  tree always renders the page-level Compose/Templates/History tablist
  above every tab's body, including this fresh-empty state (it is gated
  down only at PHONE width, per DEC-919's wave-159 duplicate-mount
  amendment — desktop never drops it). A real, pre-existing, deliberate
  choice (the tab strip is how an organizer reaches Templates/History from
  a fresh event), filed here as the mandate requires.

## Frame `:589` "Comms · history" (1600)

**DIVERGES** on page chrome above the frame's own shell; **MATCHES** on
every claim the frame draws inside it. Entered via `?tab=history`
(`HistoryTab`'s real mount).

- **DIVERGES**: the frame draws exactly ONE page-level heading inside its
  shell — the drill head's own `<h1>History</h1>` (frame :616), with no
  second "Comms" H1 or tablist above it (Templates and History are each
  drawn as a full, self-contained screen in the pack). The tree renders the
  page-level "Comms" H1 + Compose/Templates/History tablist ABOVE the
  History drill head at every desktop width — `Comms.tsx` only stands that
  band down when `isPhone && (tab === 'templates' || tab === 'history')`,
  and `isPhone` is always false at 1600px. This gap is already named in
  `HistoryTab.tsx`'s own doc comment ("Comms.tsx… unconditionally renders
  its own 'Comms' H1 + tab pills… which this file cannot remove") — a
  known, pre-existing, cross-file divergence this render receipt confirms
  rather than discovers.
- The drill head itself (frame :616-621: breadcrumb, count line, Export
  CSV, Compose) MATCHES: "‹ Comms", a "N send(s)" count line, a bordered
  "Export CSV" anchor, and a filled "Compose" primary, all present and in
  the frame's order.
- The chip row (frame :626, "All sends" filled/active by default, one chip
  per saved template) MATCHES in shape — the frame's own demo chips name
  send CATEGORIES ("Acceptance"/"Decline"/"Reminders"); the tree's chips
  are one real per-template name each (`HistoryTab.tsx`'s `templateChips`),
  which is the more general, correct behaviour for an organizer's own
  template set, not a divergence in mechanism.
- The batch table's column heads (frame :635, When/Subject/Recipients/
  Template) MATCH, rendered over the SAME `--chq-comms-batch-grid` the rows
  below use (`RecentSends.tsx`'s `columnHeads` prop), so heads and cells
  cannot drift apart.
- A batch row's "Open" toggle (frame :644) MATCHES: `aria-expanded="false"`
  at rest, flips to a "Close" state (`aria-expanded="true"`) on click,
  arming the recipients disclosure region (`.chq-comms-batch-recipients`).

## Summary

| Frame | Verdict |
| --- | --- |
| :222 Templates (1600) | MATCHES (one additive, cosmetic table-vs-div DIVERGES) |
| :360 Compose · step 1 of 4 (1600) | DIVERGES on demo state (no pre-selection, 6 pills not 3); structurally MATCHES |
| :544 Comms · nothing sent yet (1600) | MATCHES inside the frame's own shell; DIVERGES additively (tablist always present at desktop) |
| :589 Comms · history (1600) | DIVERGES on page chrome (page-level Comms H1 + tablist always render above it); MATCHES inside the frame's own shell |

All four frames render successfully through the real route with no
fabricated fixture shortcuts; none of the divergences found are new debt —
each is either a landed, ruled improvement (DEC-993), an already-documented
cross-file gap (`HistoryTab.tsx`'s own comment), or the frame's own demo
data choosing a populated/selected state the app's real cold start does not
start in. Five of Comms' nine desktop frames remain un-adjudicated by any
render receipt after this wave (see "Frames NOT covered" above) — that
remainder is left for a later lane, not silently folded into this ledger's
100/100 citation claim.
