# Contacts v12 phone audit (task w1-f)

> A finding recorded here is a claim about the tree, not a permanent record.
> It is re-derived against current code before it is scheduled, and once it
> stops reproducing it is rewritten as RESOLVED with a file:line citation of
> where the behaviour now lives (DEC-976 wave-106). Finding 3 (the
> `MergePage.tsx` consequence-box split) was re-derived at wave-17 and no
> longer reproduces: `.chq-contacts-merge-rule-box` now renders a SINGLE
> `<p>` and both the named-record and generic-record spans exist, toggled
> by width — RESOLVED (w2-c, DEC-919), see that section below for
> receipts.
>
> Findings 1 and 2 (the match-columns/phone-pager findings, distinct
> from the "Finding 3" above) are RESOLVED as of the DEC-663 wave-108
> amendment — see that section below for receipts.
>
> The "Import CSV · 390" and "Contact · 390" per-frame verdict rows below
> were also re-derived at wave-17 (DEC-663): Import CSV's missing
> `backLink` is RESOLVED and its verdict row now reads MATCHES; the
> Contact row's "always-on Close" clause is RETIRED (CSS now hides it at
> phone), narrowing that row to its one surviving structural gap
> (H2-vs-H1, Finding 4). The Merge row's `.chq-contacts-merge-picks`
> block is ADJUDICATED as a frame-silent addition, not an open
> divergence — see that row below.

Findings surfaced building the "Import CSV · 390" one-column-per-screen
pager against `docs/design/Chautauqua Contacts.dc.html:483` ('Import CSV ·
390', body :487-511) and `app/src/pages/contacts/ImportWizard.tsx` +
`contacts-panels.css`. Fixable items landed in this task; the items below
need a decision or land outside this task's scope
(`app/src/pages/contacts/**` only: `ImportWizard.tsx`,
`contacts-panels.css`, `contacts-phone-frames.test.ts`, and the
`ImportWizard.*.render.test.tsx` files; no shared page header/footer band,
no touching `app/src/styles.css` or `src/views/theme.ts`).

1. **RESOLVED (DEC-663 wave-108, ruling B).** Two phone docks used to stack
   at the bottom of the match-columns step. The frame draws exactly one
   footer pair at :508-511 (`Next column` / `Skip`), full-width and pinned
   below the scrolling body. `contacts-panels.css`'s terminal
   `@media (max-width: 700px)` block now hides ModalFrame's shared footer
   (`.chq-modal-actions`) whenever the page-owned
   `.chq-contacts-import-phone-dock` is present, via
   `.chq-contacts-import:has([data-chq-phone-dock]) .chq-modal-actions {
   display: none; }` (`app/src/pages/contacts/contacts-panels.css:1777`,
   appended at the sheet's single terminal block per DEC-385) —
   reusing the same `[data-chq-phone-dock]` attribute contract that
   app/src/styles.css`.chq-main:has([data-chq-phone-dock])` (drift-proof
   citation, DEC-967 wave-115 shape -- this declaration has drifted from
   the line number originally cited here) already uses. `.chq-modal-actions`'s "Import N
   rows" / "Cancel" survive elsewhere on screen: "Import N rows" ->
   the phone dock's own last-column primary ("Review N rows",
   `ImportWizard.tsx` ~1028); "Cancel" -> ModalFrame's header Close control
   (`.chq-modal-close-btn`, `app/src/components/ModalFrame.tsx` ~132),
   which is never hidden at any width. Pinned by
   `ImportWizard.phoneColumns.render.test.tsx`'s "hides the shared
   ModalFrame footer..." test.

2. **RESOLVED (DEC-663 wave-108, ruling A).** The frame's "N rows match an
   existing contact" note position (`docs/design/Chautauqua
   Contacts.dc.html:506`, `padding: 16px 0 0`) does render at phone — but
   as the wizard's own, already-computed same-file dedupe note
   ("Same-file email repeat: N rows · the later row wins", sourced from
   `dedupeCount`), not the frame's literal existing-contact-match wording
   (which needs `plan.updated`, unavailable until the dry run runs).
   `contacts-panels.css`'s `.chq-contacts-import-dedupe { padding-top:
   16px; }` (line 1464, landed wave v12m-w9-h) re-spaces this SAME node
   under the phone radio list rather than hiding it — the previous
   `display: none` phone-hidden rule this finding described was itself
   stale by the time wave-108 re-derived it. The frame-accurate
   plan-sourced sentence still lands separately on the Review step
   (`.chq-contacts-import-matched`) once the dry run has actually run.
   Pinned by `ImportWizard.phoneColumns.render.test.tsx`'s "re-spaces the
   same-file dedupe note..." test.

3. **"Next column" and "Skip" never reach the primary Import action.**
   The frame does not show what happens after the last column (:508-511
   only draws mid-pagination state, column 2 of 5). This task's narrowest
   reasonable reading: the pager clamps at the last column and lets the
   organizer use the shared modal footer's "Import N rows" to finish (see
   finding 1 — that footer is still visible, just as a second stacked
   dock). If the intended flow is instead "Next column" on the last
   column advances straight to Review/commit, that is a state-machine
   decision this task's scope forbids inventing.

## Resolution (DEC-663, wave-87 amendment, task w5-g)

Findings 2 and 3 are decided. Finding 1 (two stacked docks) is unchanged
and stays filed — it belongs to the shell/header-footer lane.

**Finding 3 — RULED.** On the LAST column, the phone pager's primary no
longer reads "Next column"; it reads `Review N rows` (the same
`countOf(dataRows.length, 'row')` phrase the desktop primary already
used) and runs the exact same `runPreview()` call the desktop Review step
runs, landing on the Review step. "Skip" on the last column does the
same, after first clearing that column's mapping — it passes `runPreview`
an explicit override-mapping argument rather than reading the `mapping`
state closure, since `setColumnMapping`'s state update has not yet
applied when the click handler calls `runPreview` in the same tick.
`Next column` / `Skip` are, on every column but the last, unchanged.
There is no longer a cul-de-sac: the pager's own footer becomes a path
into the dry run, and the organizer never has to fall back on the shared
modal footer's primary to finish matching columns (finding 1's stacked
second dock remains visible during pagination, but is no longer the only
way forward on the last column).

**Finding 2 — RULED.** The frame's phone-position note ("N rows match an
existing contact by email · those get updated") renders ONLY from the
dry run's own `plan.updated` count, and renders NOTHING before that plan
exists. Concretely: the wizard already had exactly this note on the
Review step (`.chq-contacts-import-matched`, sourced from `plan.updated`,
landed with the desktop review-step redesign) — nothing new was needed
there. What changed is the match-columns/phone-pager step: the same-file
dedupe note (`.chq-contacts-import-dedupe`, sourced from `dedupeCount`,
a different measurement — an in-file email collision, not an
existing-contact match) that this task previously substituted at that
phone position is now DESKTOP-ONLY. `contacts-panels.css` hides
`.chq-contacts-import-dedupe` at `max-width:700px` instead of
repositioning it under the phone radio list; it keeps rendering "beneath
the column grid" on desktop, where it is true. The phone pager shows
nothing in that position pre-dry-run — a missing line, never a number
with no plan behind it.

Both rulings are implemented in `ImportWizard.tsx` (the phone dock's
button logic) and `contacts-panels.css` (`.chq-contacts-import-dedupe`'s
phone-hidden rule); new coverage in
`ImportWizard.phoneColumns.render.test.tsx`.

**Finding 3 — RESOLVED (w2-c, DEC-919).** `docs/design/Chautauqua
Contacts.dc.html:535` ("Merge · 390") draws the consequence block as ONE
line: `Labels combine, notes are appended · 3 submissions and 1 task move
to the record you keep`. `MergePage.tsx`'s `.chq-contacts-merge-rule-box`
(`app/src/pages/contacts/MergePage.tsx:365-382`) now renders this as a
SINGLE `<p className="chq-contacts-merge-rule-box-rule">` — the combine
rule and the `.chq-contacts-merge-impact` submissions/tasks span sit
inline in that one paragraph, not two stacked `<p>`s, matching the
frame's single line. The record-name half is also resolved: the
paragraph carries both a `.chq-contacts-merge-impact-name` span (first/
last name) and a `.chq-contacts-merge-impact-generic` span ("the record
you keep"), toggled by width in `contacts-panels.css:1814-1818` — desktop
keeps the name (its head band already names the kept record at :526),
phone swaps to the frame's generic phrasing, since the phone head band
does the same. This finding no longer reproduces against the tree; kept
here only as the citation the "Merge · 390" verdict row below points to.

**Finding 4 — RESOLVED (v12m-w21-m, DEC-613 wave-21 ruling).**
`docs/design/Chautauqua Contacts.dc.html:410` sets the "Contact · 390"
head H1 at `font-size:25px; font-weight:700; letter-spacing:-0.04em;
line-height:1.05`. `ContactDrawer`'s title renders through the shared
`.chq-modal-title` class, which this task's ruling (parked since filing
"for whoever owns modal-frame.css") now closes: inside
`app/src/components/modal-frame.css`'s ONE terminal
`@media (max-width: 700px)` block, `.chq-modal .chq-modal-title` now
sets `font-size: var(--chq-type-page-title-phone-drill)` and
`letter-spacing: var(--chq-type-page-title-tracking)` — the same two
tokens (`25px` / `-0.04em`) `.chq-phone-head-drill .chq-page-title`
already uses for every other full-screen drill head. Desktop is
untouched: the top-level `.chq-modal .chq-modal-title { font-size: 23px; }`
rule stands, single-direction (DEC-385). Receipted by
`app/src/components/modal-frame-title-phone-drill.test.ts`, which also
enumerates the population this register applies to: all four Contacts
390 drill heads (`ContactDrawer` :410, `PipelineBoard` :450,
`ImportWizard` :490, `MergePage` :525) draw the identical figures, and
no other `ModalFrame` call site in `app/src` has a 390-width dialog frame
drawn anywhere in `docs/design/*.dc.html` to contradict it. The
companion H2-vs-H1 structural gap this row also names is ruled the
OTHER way — settled, not built — see `docs/design/DEVIATIONS.md` §7.

**Finding 5 — whether the shell header stands down for the whole
Contacts cluster during a 390 drill is a SHELL decision, outside any
page document's file scope (DEC-964, DEC-893).** `PipelineBoard.tsx` and
`DuplicatesView.tsx` now carry `.chq-phone-head`/`.chq-phone-head-drill`
for their 390 drill heads. Per DEC-964 the stand-down of the outer shell
chrome is decided by the shell, not page-locally: the only current setter
of `data-chq-phone-head` is `Scorecard.tsx:531`, and no Contacts root
sets it. `ContactsApp.tsx`'s own landing head
(`.chq-contacts-title-row` / `.chq-contacts-tabstrip-row`) IS stood down
via a markup gate (`!(isPhone && panel !== 'directory')`) so it does not
double up above a drill's own head band; the outer app shell chrome
above `.chq-page` for Contacts is a separate register surface. Recorded
here as a register fact about where the decision lives, not as a claim
on anyone's calendar (DEC-518).

## Per-frame render verdicts (w13-ri, DEC-976 wave-157)

Contacts had FIVE width:390px frames in `docs/design/Chautauqua
Contacts.dc.html` and none had ever been rendered against a per-frame
verdict before this task — several carried the CLOSED claims above,
closed on grep evidence rather than a render. Receipts for every row below
live in `app/src/pages/Contacts.frame-verdicts.render.test.tsx`, entered
through the real route each frame is actually reached by (`ContactsPage`
for the four `/contacts` frames, `MergePage` for its own `/contacts/merge`
route) — never a sub-component mounted directly.

| Frame | Verdict | What diverges |
| --- | --- | --- |
| `Chautauqua Contacts.dc.html` "Contacts" (390 landing) | DIVERGES (narrowed, src/decisions-data/DEC-518.md wave-160 amendment) | Re-derived against the tree (src/decisions-data/DEC-976.md wave-155 directory-qualified citation): the head band now CONFORMS on its narrowing apparatus. `FilterRulesPanel.tsx` renders `.chq-contacts-filter-chipstrip` (an "All of" caption, one dismissible chip per active rule, and a dashed "+ Rule" control) and discloses the full desktop rule builder behind that control rather than rendering it in full; `SegmentPillStrip.tsx` renders `.chq-contacts-segment-pills` (an "All" pill plus one "{name} · {count}" pill per saved segment); `ContactsApp.tsx` renders `.chq-contacts-head-count` (`{total} of {stats.total}`) right-flushed on the H1 line. The BODY still DIVERGES: the frame draws a headerless per-row card (name / company·role / tags, one boxed "Email" action) ending in a shell tab-bar footer, while the actual read is the SAME desktop `<table class="chq-table chq-contacts-table">` at every width — a checkbox column and a `['', 'Name and email', 'Company', 'Labels', '']` header row. The per-row action itself now MATCHES: `ContactsTable.tsx`'s `useIsPhone` gate renders "Email" (opening the shared `BulkEmailModal`) instead of the desktop "Open", narrowing the remaining divergence to the header row and checkbox column alone. Receipted in `app/src/pages/Contacts.frame-verdicts.render.test.tsx`'s `frame :179 Contacts landing` it(). |
| `Chautauqua Contacts.dc.html` "Contact · 390" | DIVERGES (narrowed further, v12m-w21-m, DEC-613 wave-21) | The frame draws its own full-screen route: a `‹ Contacts` back link and nothing else in the head band. The actual screen is `ContactDrawer`, mounted through the shared `ModalFrame` as a `role="dialog"` portal — an H2 title, not the frame's own H1. The row's earlier "always-on Close button beside the back link" clause is RETIRED: `contacts-panels.css`'s terminal `max-width:700px` block now blanks `.chq-contacts-drawer .chq-modal-close-btn` at phone (v12m-w15-th, DEC-663 wave-159), leaving the back link as the drill's sole escape, matching the frame. The two-control dock below (`Email <name>` / `Edit`, DEC-959) matches exactly, and the title-register gap (Finding 4) is now RESOLVED — `.chq-modal-title` matches the frame's `25px/700/-0.04em/1.05` at 390. The one surviving divergence is the H2-vs-H1 structural gap itself, and it is SETTLED not open: `docs/design/DEVIATIONS.md` §7 rules a `ModalFrame` dialog's title stays an `<h2>` referenced by `aria-labelledby`, since the frame's `<h1>` is a drawing convention for a full-screen drill and demoting the page's real H1 for a dialog would trade an accessibility contract for a pixel-level resemblance. |
| `Chautauqua Contacts.dc.html` "Pipeline · 390" | MATCHES | Back link, H1, the "N people" caption, the five-stage chip strip, the per-row card ending in a "Move ›" control, and the "Add someone"/"Filter" dock all render exactly as drawn. |
| `Chautauqua Contacts.dc.html` "Import CSV · 390" | RESOLVED (DEC-663 wave-17) → MATCHES | The frame draws a `‹ Contacts` back link in the head band (`:489`). This row previously read DIVERGES because `ImportWizard` passed `ModalFrame` no `backLink` prop; it now does (`app/src/pages/contacts/ImportWizard.tsx``backLink={{ label: '‹ Contacts', onClick: onClose }}`, landed by commit f2fd0c43), and the shared `Close` control it would have stacked beside is CSS-hidden at phone by the same `.chq-contacts-import .chq-modal-close-btn` rule cited on the Contact row above. The one-column-per-screen pager body (eyebrow, column name, samples, "Import it as" rule, radio targets) and its "Next column"/"Skip" dock match, per findings 1-2 (RESOLVED, DEC-663 wave-108) above. |
| `Chautauqua Contacts.dc.html` "Merge · 390" | ADJUDICATED, frame-SILENT addition (DEC-663 wave-17) → MATCHES | The frame body goes straight from the head band into the field-by-field compare rows — no picker block. `MergePage` renders an additional `.chq-contacts-merge-picks` radio-list block (one radio per contact, with email/company/title) above the compare rows, with no frame counterpart. Per DEC-663's wave-17 ruling this is NOT an open divergence: the compare rows are drawn showing the result of a keep/drop choice already made, which a static frame cannot depict being made, so `.chq-contacts-merge-picks` seeds that choice rather than duplicating a peer of it — removing it would leave the 390 screen unable to express the merge's primary decision (a capability removal DEC-919 forbids), and hiding it at phone only would fork the merge's semantics by width. Same disposition `docs/design/audit/account-docs-v12.md`'s "Change password · 390" row already uses for the sign-in-persists hint: an addition the frame is silent on, not a MATCHES/DIVERGES call. The consequence box is RESOLVED (Finding 3 above, w2-c) — the per-field keep/drop pair and the "Merge them"/"Not a duplicate" footer both match as drawn. |

## Finding 6 — the 390 head's two intrusions are a real, unowned residual (task v12m-w16-ui-r3-e, src/decisions-data/DEC-976.md amendment, src/decisions-data/DEC-180.md amendment)

Five wave-16 lanes each pinned their OWN piece of the Contacts 390 head
(`FilterRulesPanel.ruleChips.render.test.tsx`,
`FilterRulesPanel.builderDisclosure.render.test.tsx`,
`SegmentPillStrip.render.test.tsx`, `DirectoryRail.phone390.render.test.tsx`,
`ContactsApp.headCounter.render.test.tsx`), but until this task nothing
asserted how those pieces sit together in one document. `docs/design/Chautauqua
Contacts.dc.html:180-198` draws the phone head as ONE uninterrupted column —
counter (`:183`) directly above the H1 (`:185`), the H1 directly above the
search box (`:186`), the search box directly above the "All of … + Rule"
rule-chip strip (`:187`), and that strip directly above the All/Speakers ·
41/Reviewers pill strip (`:194`) — ending in the scrolling card list
(`:201`). `app/src/pages/contacts/ContactsApp.head390.render.test.tsx` is
the new composition receipt: it asserts that six-node DOM order with
`compareDocumentPosition` (order, not mere presence) and passes for the
five pieces the frame actually draws.

It also measures — and pins BY NAME, so the receipt fails loudly the day
someone reshuffles it further — two intrusions the frame does not draw and
that neither existing strip can absorb, because they live in different
React parents from the strips they'd have to merge into:

1. `.chq-contacts-title-actions` (Import CSV / Export CSV / New contact,
   DEC-711 amendment wave 4) sits between the head counter and the search
   box. The frame has no control cluster on this band at all — Import/
   Export/New have no drawn home at 390.
2. The Directory/Duplicates/Segments/Pipeline `role="tablist"` panel
   switcher (DEC-710) sits between the search box and the rule-chip strip.
   The frame draws no panel switcher on the Contacts landing at any width.

Neither can be reordered into place: `.chq-contacts-title-actions` is a
sibling of the H1 inside `.chq-contacts-title-row`, while the search box
and rule strip live one component down in `.chq-contacts-tabstrip-row` /
`FilterRulesPanel` — moving either intrusion between them would require
relocating it into a different parent than the JSX that already owns it.
Neither can be hidden either: `src/decisions-data/DEC-919.md`'s carve-out
only permits a stand-down when "every capability it carried has a
surviving full-screen path already on this page," and this landing has no
phone dock (`.chq-phone-dock` / `data-chq-phone-dock`) the way Pipeline and
Duplicates do — hiding the tablist would strand Duplicates/Segments/
Pipeline with no way in, and hiding the title-actions cluster would strand
Import/Export/New the same way DirectoryRail's stand-down would have
stranded Segments/Duplicates without their tab-chip escape hatches
(`DirectoryRail.phone390.render.test.tsx`). So this is a REAL residual,
not a defect this lane can close by editing `ContactsApp.tsx` or
`contacts.css` — doing so would be a Contacts-page lane silently deciding a
shell-level design question `docs/design/DESIGN-RULINGS.md` has not
adjudicated.

**Named owners (DEC-180 wave-156: a finding names its owning sheet, not
just the shell need; DEC-976 wave-16-r5 amendment: the phone-dock candidate
is FORECLOSED, decided below, not re-adjudicated by a future lane):**

- **`app/src/styles.css`** — a shell head band that carries the wordmark
  row, the counter and the H1 as the frame draws them, so a page-level
  action cluster (Import/Export/New) and a page-level panel switcher
  (the tablist) would sit in shell chrome ABOVE this page's own head,
  never inside the counter→H1→search→strip column the frame draws as one
  piece. This is the same shell-vs-page register split
  `docs/design/audit/contacts-v12.md`'s Finding 5 (above) already names for
  the wordmark row itself. This sheet is the RESIDUAL'S SOLE OWNER (see
  below).
- ~~A Contacts-landing phone dock, built in `app/src/pages/contacts/`~~ —
  **FORECLOSED (DEC-976 wave-16-r5 amendment).** `app/src/styles.css`
  suppresses the shell tab bar for any page that mounts a dock —
  `.chq-shell:has(.chq-phone-dock) .chq-tabbar` `display: none;` and
  `.chq-main:has([data-chq-phone-dock]) ~ .chq-tabbar` `display: none;` —
  but the Contacts 390 landing frame draws the shell tab bar as its own
  footer: `docs/design/Chautauqua Contacts.dc.html:214`
  `flex-shrink:0; border-top:1px solid #1B1D17; background:#EFEBDF;
  padding:10px 8px 14px; display:flex; gap:2px`, with `:215`
  `<sc-for list="{{ tabs }}" as="t" hint-placeholder-count="5">`. Mounting
  a dock on this screen would delete the footer the frame draws — trading
  one frame divergence for a worse one. `app/src/pages/contacts/
  PipelineBoard.tsx` legitimately mounts `<div className="chq-phone-dock"
  data-chq-phone-dock>` because Pipeline is a one-screen-at-a-time phone
  DRILL with its own frame and its own band (DEC-964), not the landing —
  that precedent does not transfer.

With the dock candidate foreclosed, the residual has exactly ONE owner:
`app/src/styles.css`. Both intrusions — the `.chq-contacts-title-actions`
cluster (Import CSV / Export CSV / New contact) AND the Directory/
Duplicates/Segments/Pipeline `role="tablist"` panel switcher — now land on
that one sheet; there is no second candidate left to split them across.
This lane narrows the finding and names the owner; it does not fix the
residual, which stays outside the Contacts subtree and unassigned here.
Scheduled owner-lane: none yet — a future wave should open a dedicated
lane against `app/src/styles.css`, and that lane's fix will need to update
`ContactsApp.head390.render.test.tsx`'s two "recorded residual" assertions
(they are written to fail once the intrusion moves) rather than leaving
them as permanent truths.

## Finding 7 — the shared `.chq-chipstrip` token carries the same clipped-ring defect this page's own strips had (task v12m-w16-ui-r5-a, src/decisions-data/DEC-383.md wave-16-r5 amendment)

This page's two page-owned head strips (`.chq-contacts-filter-chipstrip`,
`.chq-contacts-segment-pills`) were `overflow-x: auto` scroll containers
clipping the house `:focus-visible` ring (a standing outward
`outline-offset: 2px` in `app/src/styles.css`) on every 44px-tall
focusable child, top and bottom, plus the first child's leading edge at
scrollLeft 0 — fixed for those two by scoping an inset
`outline-offset: -2px` under each strip's own class inside contacts.css's
terminal `@media (max-width: 700px)` block.

**Named owner (DEC-180 wave-156: a finding names its owning sheet, not
just the shell need):** the SAME defect lives one level up, in
`app/src/styles.css`'s shared `.chq-chipstrip` token — the identical
`overflow-x: auto` scroll-container shape used by this page's own
Directory/Duplicates/Segments/Pipeline `role="tablist"` strip, and by
every other `.chq-chipstrip` consumer across the product. Because that
token is declared once and shared, the fix landed here (page-scoped,
inside `contacts.css`) cannot reach it — a page-local override can only
correct the two strips this page owns outright, not the shared token
every other page also draws its ring through. Scheduled owner-lane: none
yet — this is the shell lane's fix (`app/src/styles.css`), not this
page's; filed here per DEC-180, not assigned.

## Merge · 390 — render verdict (task w29-a, DEC-976 wave-29)

Before this task the "Merge · 390" frame (`docs/design/Chautauqua
Contacts.dc.html:522-546`) had no dedicated markup-level verdict — only
`MergePage.phoneFrame.test.ts` (a source-text scan over `MergePage.tsx`'s
JSX and `contacts-panels.css`'s CSS text) and
`Contacts.frame-verdicts.render.test.tsx`'s single shallow `it()` (renders
the route, checks the H1/picks/footer buttons exist, no dock-scoped
control-order or 44px-floor receipt). `MergePage.frame390.render.test.tsx`
is the new markup-level receipt: it mounts the real `/contacts/merge`
route (the same harness `MergePage.render.test.tsx` uses, `mockApi` +
`MemoryRouter`), and asserts:

- Exactly one `<h1>` reading `Merge two records` (:525).
- Exactly one back anchor whose accessible text ends in `Duplicates`
  (:524) — asserted on the anchor's own trailing text, not innerText
  equality, since the phone rule blanks the `Contacts · ` prefix span via
  CSS only (jsdom renders it regardless).
- The pair counter (:526) matching `/^\d+ of \d+ pairs · /`, shape-graded
  per DEC-967 wave-29 rather than pinned to the frame's own sample
  ("1 of 6 pairs · Marcus Okafor").
- At least one compare row (:530-:532) carrying a label span plus a keep
  span and a drop/blank/combine span.
- The consequence line (:535) rendering in exactly ONE
  `.chq-contacts-merge-rule-box-rule` element containing "Labels combine,
  notes are appended".
- The dock's two controls (:537-:538), scoped to `.chq-contacts-merge-footer`
  and read in DOM order — `dockButtons[0]` carries the `Merge them`
  phone-label span, `dockButtons[1]` reads `Not a duplicate` — using a
  3+-record duplicate group fixture so DEC-992's "Swap which is kept"
  control (which only mounts for a two-record pair) never intervenes as a
  third button between them.
- A static 44px-floor receipt (DEC-393): both `.chq-contacts-merge-footer
  .chq-btn` and `.chq-contacts-merge-not-duplicate` floor at >=44px inside
  `contacts-panels.css`'s one terminal `@media (max-width: 700px)` block
  (comment-stripped via `test/helpers/strip-css-comments`), read to be 48px
  for both — well clear of the floor, no CSS change needed.
- `.chq-contacts-merge-picks` is present and recorded here, per the table
  above, as the DEC-663 wave-17 blessed frame-silent addition (the compare
  rows show the result of a keep/drop choice a static frame cannot depict
  being made) — not a divergence this task reopens.

**Verdict: MATCHES.** No DIVERGES row and no `contacts-panels.css` change
were needed — every dock control this task's DEC-385 terminal-phone-block
scope covers already floors at 48px, and every frame body line above
renders through the real route. This confirms, at the markup level for the
first time, the disposition the table's existing "Merge · 390" row already
claimed on weaker (source-scan) evidence.
