# Contacts v12 DESKTOP (1600) per-frame render verdicts — directory/record residue (w26-a)

**Coverage: 3 of Contacts' 12 desktop frames.** This file owns the three
directory/record frames waves 23-25 did NOT claim: `:28` "Directory · 1600",
`:229` "Contact · drawer", `:808` "New contact".

Per DEC-976, a per-frame verdict is owned by whichever file actually
renders and asserts that frame, so coverage is partitioned by file rather
than by whoever happened to write it: `v12m-w23-g` (DEC-976) records the
other four rendered so far — `:312` (Duplicates), `:352` (Segments),
`:617` (Pipeline), `:720` (Import CSV) — in its own coverage line in
`contacts-desktop-v12.md`. The remaining five desktop frames in
`docs/design/Chautauqua Contacts.dc.html` carry no per-frame render
verdict in any file; this coverage line states that, and claims nothing
about when one might appear.

Per-frame render VERDICTS, entered through the app's real routes
(`ContactsPage` at `/contacts`) and asserted against jsdom DOM
structure/order/text — jsdom applies no stylesheet, so no claim here is a
computed-style read. Receipts live in
`app/src/pages/Contacts-directory.desktop-frame-verdicts.render.test.tsx`.

STRICTLY MEASUREMENT ONLY (DEC-651 wave-26): this document and its test file
render, verdict, and file divergences in prose — they move no desktop byte
and edit no component or stylesheet, even where a real divergence is found
below.

## Frame :28 "Directory · 1600"

**MATCHES**, with one additive text divergence noted below. Entered via
`ContactsPage` → `ContactsApp.tsx`.

- Title-row action cluster order — `Import CSV` / `Export CSV` / `New
  contact`, frame :60-62 — matches `.chq-contacts-title-actions` exactly
  (order and labels; `Export CSV` renders as an `<a>` carrying the filtered
  CSV export href, same element type the frame draws).
- The title-row summary (frame :57's `318 people · 41 speakers · 6 possible
  duplicates`) matches `.chq-summary`'s 3-clause shape verbatim, with live
  figures substituted by `ContactsApp.tsx`'s `summary` computation
  (DEC-432/DEC-809). The wordmark row's own `N of M` counter (frame :56 has
  no home there — the wordmark row is the app shell's) instead lands on this
  H1 line as `.chq-contacts-head-count`, per `src/decisions-data/DEC-919.md`.
- Tab chip strip order — Directory / Duplicates·N / Segments·N / Pipeline
  (frame :67 onward) — matches `.chq-chipstrip[role=tablist]` exactly, with
  search + segment-filter select at the row's right end while the Directory
  tab is active, matching the frame's own right-aligned search+segment
  cluster.
- Directory table head — `Name and email` / `Company` / `Labels` (frame
  :98) — matches `<thead>` column order exactly (checkbox and the trailing
  action column are both unlabelled in both frame and tree). A row renders
  name+email stacked, company+title stacked, the labels meta string, and an
  `Open` action (frame :112) — **matches, never the phone frame's `Email`
  action** (`ContactsTable.tsx`'s `isPhone` branch is what would draw
  `Email` instead; desktop takes the `Open` branch).
- Pager — `Showing N–M of T` left, `Previous`/`Next` right (frame :116) —
  matches structurally; the frame's own placeholder text reads "Showing 2 of
  2 matching" (no en dash, because both fixture rows fit on one page) while
  the live `paginationSummary` helper renders an N–M range once the total
  exceeds one page. Same left-group/right-group DOM order either way.
- The rail's two lead sections render in frame order — "Where they work"
  (frame :127) before "Saved segments" — as `.chq-section-label` text inside
  `.chq-contacts-rail`, with a real company club derived from
  `stats.topCompanies`.

## Frame :229 "Contact · drawer"

**MATCHES**, with one order **DIVERGENCE** in the action bar. Entered via
`ContactsApp.tsx`'s `?openContact=<id>` one-shot URL state → `ContactDrawer`.

- The drawer opens as a `role="dialog"` labelled "Contact detail", with a
  `Close` control (frame :238) and a name/company-title header — matches.
- The drawer's four field groups render in the frame's own `contactGroups`
  order (frame :936/942/946/952): **Contact, Profile, an event-scoped group
  ("This event" in the frame; the tree names it after the organiser's actual
  current event, or the generic "On this event" fallback — a label
  substitution only, group order and count are unchanged), Notes.**
- **DIVERGES (order only):** the frame's sticky action bar (frame :265-268)
  reads, in literal DOM order, `Delete this contact`, `Cancel`, `Save`,
  `Email`, `Add to event`. The tree keeps `Delete this contact` far left
  exactly as the frame does, but its right-hand action group orders `Email`,
  `Add to event`, `Cancel`, `Save` — the two secondary actions (Email, Add
  to event) sit BEFORE Cancel/Save rather than after. All five controls are
  present with identical labels; only their order within the right-hand
  group differs from the frame's literal sequence. Adjudicated on the same
  axis as DEC-902's wave-14m wording disposition, applied here to order
  rather than wording: membership matches the frame exactly (the floor is
  met), and the tree's order carries more information than the frame's flat
  left-to-right sequence — it groups the two content-producing actions
  (Email, Add to event) together and ahead of the form-commit pair
  (Cancel, Save), a functional grouping the frame's list doesn't express —
  so disposition (b) applies: blessed, not open debt.

## Frame :808 "New contact"

**MATCHES.** Entered via `ContactsApp.tsx`'s `New contact` button →
`NewContactModal`.

- Header title "New contact" + subtitle "Added to the org, not to an event"
  (frame :816) — matches verbatim.
- Field order — First name/Last name paired (frame :821), Email, then
  Company/Title paired (frame :836) — matches exactly. The two optional
  fields (Company, Title) carry an additive " · optional" suffix in the tree
  that the frame's own section labels don't draw literally — the shared
  `FormRow`/DEC-917 convention every other modal in the app already uses,
  additive text only, field identity and order unaffected.
- Action row — `Add the contact` (primary) then `Cancel` (frame :847) —
  matches the frame's literal DOM order exactly.
- The closing scope sentence ("This adds someone to your directory. To put
  them on an event, use **Add to an event** on their row afterwards.", frame
  :846) — matches verbatim, including the bolded control name.
