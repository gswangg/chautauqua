# Comms v12 DESKTOP (1600) per-frame render verdicts (w23-e, DEC-976 wave-23 amendment; extended w37-g, DEC-976 wave-37 amendment)

Per-frame render VERDICTS for seven of Comms' nine desktop (1600) frames in
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
conformance (DEC-967). w37-g (DEC-976 wave-37 amendment) closes three more of
the five frames this document's own w23-e wave left un-adjudicated: `:28`,
`:453`, `:750` — the three APP frames of the compose wizard component,
reached by DRIVING the wizard (advancing steps, triggering the real
send-blocked refusal) rather than rendering any state in isolation
(DEC-651).

STRICTLY MEASUREMENT ONLY (the mandate's desktop freeze): this document and
its test file render, verdict, and file divergences in prose — they move no
desktop byte and edit no component or stylesheet, even where a real
divergence is found below.

## Frames covered this wave

- `:222` "Templates" (1600) — w23-e
- `:360` "Compose · step 1 of 4" (1600) — w23-e
- `:544` "Comms · nothing sent yet" (1600) — w23-e
- `:589` "Comms · history" (1600) — w23-e
- `:28` "Compose · step 3 of 4 · 1600" (1600) — w37-g
- `:453` "Compose · step 4 of 4" (1600) — w37-g
- `:750` "Compose · send blocked" (1600) — w37-g

## Frames NOT covered (honest remainder)

`docs/design/Chautauqua Comms.dc.html` draws nine 1600px desktop frames in
total; seven now carry a real render receipt (above). The remaining two are
a DISTINCT, DEFERRED population, not an oversight:

- `:686` "What each template renders"
- `:712` "DevFlow Conf 2027"

Both are the **Emails shell** — a template-preview surface rendered at a
**560px measure** (`:695`'s own `{{ e.name }}` loop scaffolding sits inside
this same 560px shell), not the 1600px app chrome every frame above renders
inside. It is a DIFFERENT RENDERER (the standalone email-preview component,
never `CommsPage`/`ComposeWizard`) and a DIFFERENT POPULATION (one email
body per template, not one app screen per wizard/tab state) than the seven
1600px APP frames this document verdicts. Closing it is a distinct task —
"not covered" here names a population this document does not own, not a gap
nobody has looked at. `:695` (`{{ e.name }}`) itself remains excluded from
the population entirely by the ledger's own template-interpolation
pattern.

## Frame `:222` "Templates" (1600)

**MATCHES**, with one additive structural DIVERGES noted below, governed by
DEC-902 wave-8 (a frame's control list is a floor, not a ceiling). Entered
via `?tab=templates`.

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
  because it is a defect — an additive control the tree draws beyond the
  frame's own list, blessed by DEC-902 wave-8.
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
structure — governed by DEC-902 wave-9 (demo-state and pill-count rows) and
DEC-967 ("frame sample data is not product copy"). Entered via
`?tab=compose` (the default tab, `ComposeWizard`'s real first step).

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
  the product's real flow), filed here per the mandate — blessed by
  DEC-902 wave-9 (demo-state row) and DEC-967 (frame sample data is not
  product copy).
- The question head (frame :404, "Nothing sends until step 4") MATCHES
  verbatim, beside the "Who is this going to?" `<h2>`.
- **DIVERGES**: the frame draws exactly THREE status filter pills —
  Accepted/Declined/Waitlisted (frame :408-410). The tree renders all SIX
  `SUBMISSION_STATUSES` pipeline literals (`Pending`, `Accept queue`,
  `Decline queue`, `Accepted`, `Declined`, `Waitlisted`) as pills — an
  already-established, cross-surface vocabulary choice (every status pill
  filter in the product renders the full pipeline, not a decided-only
  subset), not new debt — the pill-count row DEC-902 wave-9 blesses by name
  (removing three would remove filtering).
- The recipient table (frame :425, column order checkbox/Submission/
  Speaker/Status/Slot) MATCHES in order — the tree's own header reads
  "Speakers" (plural) where the frame prints "Speaker" (singular), a
  one-word copy variance, not a structural mismatch — and an unslotted row
  correctly carries the "No slot yet" flag (`chq-flag`).
- The footer (frame :443, right-flushed Cancel + "Next: choose a template")
  MATCHES.

## Frame `:544` "Comms · nothing sent yet" (1600, fresh empty state)

**MATCHES** on every text/structure claim the frame draws inside its own
1600px shell; **DIVERGES (additively)** on what surrounds that shell,
governed by DEC-902 wave-8 (the always-present tablist is an additive
control the frame's own shell never drew, blessed as a floor-not-ceiling
row). Entered via `?tab=compose` with an all-time-empty batch list and zero
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

## Frame `:589` "Comms · history" (1600) — CLOSED-with-receipt (DEC-964 wave-8, task w8-a)

**MATCHES** on page chrome above the frame's own shell, and on every claim
the frame draws inside it. Entered via `?tab=history` (`HistoryTab`'s real
mount).

- **CLOSED** (was DIVERGES): the frame draws exactly ONE page-level heading
  inside its shell — the drill head's own `<h1>History</h1>` (frame :616),
  with no second "Comms" H1 or tablist above it (Templates and History are
  each drawn as a full, self-contained screen in the pack). `Comms.tsx`'s
  page-level head band (H1 + rhythm subtitle + Compose/Templates/History
  tablist) now stands down whenever `tab === 'templates' || tab ===
  'history'`, at every width — the `isPhone &&` guard that used to scope
  this to phone only is gone. Receipt:
  `app/src/pages/Comms.desktop-frame-verdicts.render.test.tsx`'s "MATCHES
  (DEC-964 wave-8, task w8-a): the frame draws ONE 'History' H1 as its own
  drill head; the tree no longer renders a page-level 'Comms' H1 or tablist
  above it at any width". `HistoryTab.tsx`'s own doc comments (previously
  naming this as a cross-file gap it "cannot remove") are updated in the
  same commit.
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

## Frame `:28` "Compose · step 3 of 4 · 1600" (1600, the review step)

**MATCHES** on the review step's own section head; **DIVERGES** on how a
send is actually committed, governed by DEC-976 wave-37 (Ruling B1: send
moves to a dedicated step 4). Entered via `?tab=compose`: select a
submission, advance to the template step, fill Subject/Body, "Next:
preview" — the component's own review step (`step === 'preview'` in
`ComposeWizard.tsx`), which the frame's own STEP header numbers "3 of 4".

- The "Recipients · N" section head (frame :81) MATCHES — the tree's own
  `.chq-section-head` reads `Recipients · 1` for a one-recipient fixture,
  same label, same count-after-the-count-noun order the frame draws with its
  demo "23".
- **DIVERGES**: the frame draws this step's own primary as "Send N emails"
  (frame :144) — a control that, per the frame's own script, commits the
  send from THIS step. The tree's step-3 primary instead reads "Next: send
  ›" (`ComposeWizard.tsx`'s `chq-btn-primary`, `onClick={() =>
  setStep('sent')}`) and never posts to `/compose/send` from here — DEC-976
  wave-37's Ruling B1 (already documented inline in `ComposeWizard.tsx`: "Send moves to step
  4 -- this primary only advances; the dedicated ConfirmDialog is gone
  because step 4 pre-send IS the confirmation"). No control matching
  `/^Send \d+ emails?$/` exists on this step at all.

## Frame `:453` "Compose · step 4 of 4" (1600, the send report)

**MATCHES** on the report's own head, skipped section, and footer;
**DIVERGES** on one grid value, governed by DEC-238 (findings wave 5,
already landed) and DEC-976 wave-37. Entered by completing the wizard drive
above through to `POST /compose/send`, mocking a response with two
`already_sent_recently` skips (`step === 'sent' && sendResult` in
`ComposeWizard.tsx`).

- The report head (frame :497-498, "Send complete" eyebrow + "N of M
  speakers were emailed" headline) MATCHES: eyebrow text and headline shape
  both render, with N/M sourced from the real `sendResult`/`sentTotal`
  (1 of 3 in this fixture), never the frame's fixed demo "21 of 23".
- The skipped section (frame :514-527, "Two were skipped" / "Nothing was
  sent to these two" / per-row name+email+reason / the dedupe-window note)
  MATCHES verbatim for a two-skip fixture, including the frame's own
  spelled-out count ("Two", not "2").
- The footer (frame :533-534, "Compose another" secondary + "Back to Comms"
  primary) MATCHES.
- **DIVERGES** (governed by DEC-238 and DEC-976 wave-37, as this section's
  own head records): the frame's "Sent" grid value names a from-address (frame
  :509, "Just now, by you · from hello@devflowconf.com"). The tree's
  `.chq-comms-send-report-grid` renders "Just now, by you" alone — the
  composer holds no from-address field to report (already documented
  inline in `ComposeWizard.tsx`: "The client never invents/hard-codes a
  from-address... A future wave that gives the composer a from-address
  appends ' · from <address>'"). Not new debt — a known, named gap, not a
  fabrication.

## Frame `:750` "Compose · send blocked" (1600)

**DIVERGES** on composition (dedicated screen vs. inline banner);
**MATCHES** on the banner's own action labels, governed by DEC-976 wave-37
and DEC-051 (the ics-unscheduled preflight refusal, already landed). Entered
by reaching the review step with three unscheduled submissions selected,
then toggling "Attach calendar invite" there — the real preflight
(`POST /compose/preview` with `attachIcs: true`) rejects as not-scheduled,
and `ComposeWizard.tsx`'s own inline comment names this exact frame as its
source: `/* Frame 07-comms--13 ("Check before sending")... */`. This IS the
app's send-blocked state — no banner component is rendered in isolation
(DEC-651); the refusal is reached by driving the real toggle.

- **DIVERGES** (governed by DEC-976 wave-37 and DEC-051, as this section's
  own head records): the frame draws send-blocked as its own dedicated screen —
  a fresh `<h1>Check before sending</h1>` (frame :763) replacing the
  ordinary review-step layout entirely. The tree renders no such screen and
  no such heading anywhere in the DOM: the refusal is an inline
  `role="alert"` banner (`.chq-comms-refusal-banner`) injected into the
  ORDINARY review step, with the "Recipients · 3" section and "Attachments
  and merge fields" panel still visible beside it, unchanged. A real,
  structural divergence — the frame's full-screen interstitial vs. the
  tree's in-place banner — filed here per the mandate, not a defect (the
  banner names the same blocked submissions, in place, without a navigation
  round-trip).
  - The frame's own blocking COPY (frame :768, "One merge field will not
    resolve for 3 of the 23") is a *different* refusal than the one this
    drive reaches — that sentence belongs to DEC-660's pre-emptive
    merge-field advisory band (template step, `.chq-comms-merge-warning`,
    already covered by `ComposeWizard.mergeWarning.render.test.tsx`), not
    the ics-unscheduled preflight this frame's own header breadcrumb
    ("Comms · Compose · step 3") and secondary actions ("Send to the N who
    have a slot", "Edit the template", "Place all N first") actually match.
- **MATCHES**: the banner's "Edit the template" secondary (frame :792) and
  "Place all three first" primary (frame :793, for three unscheduled
  submissions) render verbatim inside the alert banner
  (`within(banner).getByRole('button', {name: 'Edit the template'})` /
  `getByRole('link', {name: 'Place all three first'})`).

## Summary

| Frame | Verdict |
| --- | --- |
| :222 Templates (1600) | MATCHES (one additive, cosmetic table-vs-div DIVERGES, DEC-902 wave-8) |
| :360 Compose · step 1 of 4 (1600) | DIVERGES on demo state (no pre-selection, 6 pills not 3), DEC-902 wave-9 + DEC-967; structurally MATCHES |
| :544 Comms · nothing sent yet (1600) | MATCHES inside the frame's own shell; DIVERGES additively (tablist always present at desktop), DEC-902 wave-8 |
| :589 Comms · history (1600) | CLOSED-with-receipt (DEC-964 wave-8, task w8-a): MATCHES on page chrome (no page-level Comms H1/tablist at any width) and inside the frame's own shell |
| :28 Compose · step 3 of 4 (1600) | MATCHES on the review section head; DIVERGES on send commitment (step-3 "Send N emails" vs. the tree's "Next: send ›" deferring to step 4, DEC-976 wave-37 Ruling B1) |
| :453 Compose · step 4 of 4 (1600) | MATCHES on report head/skipped section/footer; DIVERGES on the Sent grid's from-address (frame names one, tree has none to report), DEC-238 + DEC-976 wave-37 |
| :750 Compose · send blocked (1600) | DIVERGES on composition (dedicated screen vs. inline alert banner); MATCHES on the banner's own action labels, DEC-976 wave-37 + DEC-051 |

All seven frames render successfully through the real route with no
fabricated fixture shortcuts; none of the divergences found are new debt —
each is either a landed, ruled improvement (DEC-993, Ruling B1), an
already-documented cross-file gap (`HistoryTab.tsx`'s / `ComposeWizard.tsx`'s
own comments), or the frame's own demo data/composition choosing a state the
app's real interaction model does not reproduce byte-for-byte. Two of
Comms' nine desktop frames remain a distinct, deferred population — the
Emails shell at its own 560px measure, a different renderer entirely (see
"Frames NOT covered" above) — not silently folded into this ledger's
100/100 citation claim.
