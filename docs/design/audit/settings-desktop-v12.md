# Settings v12 DESKTOP (1600) per-frame render verdicts (w24-a, DEC-032/DEC-651)

Per-frame render VERDICTS for the Settings landing summary and its first
three edit drills, entered through the app's real routes and asserted
against jsdom DOM structure (never a computed style — jsdom applies no
stylesheet). Receipts live in
`app/src/pages/Settings.desktop-frame-verdicts.render.test.tsx`. Sibling to
`settings-v12.md`'s citation-only claim and to `speakers-desktop-v12.md`
(the DEC-930 wave-158 desktop-verdict contract this doc follows).

STRICTLY MEASUREMENT ONLY (the mandate's desktop freeze): this document and
its test file render, verdict, and file divergences in prose — they move no
desktop byte and edit no component or stylesheet, even where a real
divergence is found below.

DEC-651 (wave-24 amendment): each edit drill below is reached by firing the
real "Change"/"Edit the form"/"Add" control on `SettingsPage` at
`/settings`, never by mounting a panel's edit form directly — a Modal/Menu/
STATE frame is verdicted by operating the control that opens it on the real
route.

**DEFERRED, out of scope (DEC-032 wave-24):** two extents of
`docs/design/Chautauqua Settings.dc.html` are DEVIATIONS-deferred and
UN-CITABLE — a citation landing inside either would score an unbuilt
feature as covered on the desktop ledger. Per `docs/design/DEVIATIONS.md`
§6's own header, "The G13 frame-complete sweep confirmed these frames draw
features or reworks the build does not carry. The user blessed deferring
them past the submission deadline; they are scope decisions, not defects."
Line 1111 opens the "Your data" edit view's unbuilt retention block
(extent 1111–1214); line 1507 opens the unbuilt Sessionboard importer
modal (extent 1507–EOF). Neither extent is cited anywhere in this document
or its receipt test — every citation below sits at or below line 858.

## Frame :28 "Event, form, publishing, data · 1600" (Settings landing)

**MATCHES.** Entered via `SettingsPage` at `/settings`.

- The sticky rail column's own H1 reads "Settings" (frame :54), distinct
  from any per-section head — `SettingsPage`'s page-level
  `<h1 className="chq-page-title">` carries the same text at this route.
- Desktop renders every section as ONE scrolling document (frame :61, the
  760px-max column holding all seven sections) — never a drilled single
  panel the way the 390 read frames drill one section at a time. All seven
  `role="region"` panels (Event, Call for papers, Tracks and rooms, Public
  pages, Speaker portal, Your data, People and roles) mount simultaneously.
- The Call for papers section head carries its own right-aligned tertiary
  action reading "Edit the form" (frame :81) — `CallForPapersPanel`'s
  `SummarySection` call sets `actionLabel="Edit the form"`, matching the
  frame's own per-section action label exactly (unlike Event and Tracks and
  rooms, whose section heads read "Change" and "Add" respectively).

## Frame :607 "Settings · editing the call for papers"

**MATCHES.** Entered by firing the real "Edit the form" control on the Call
for papers section at `/settings`, drilling to
`?section=cfp&edit=1`.

- The back-above-H1 register (frame :632-633) matches: a "‹ Call for
  papers" back control names the SECTION, the H1 that follows reads "Edit
  the form", naming the EDIT — the same split
  `SummarySection.tsx`'s own header comment states for every edit drill in
  this cluster.
- The Questions section carries only the frame's own delegation link,
  "Open the form builder ›" (frame :678), routed to `/submissions/forms` —
  no question-CRUD builder is mounted inside this drill itself, matching
  the frame's own note that "this page owns the window and the wording
  around the form."
- The footer (frame :686-687) matches: Cancel then a filled "Save changes"
  primary, right-flushed —
  app/src/pages/settings/SettingsEditForm.tsx`Save changes` is the ONE
  place either footer word lives (DEC-896 wave-68), shared by every edit
  drill in this cluster rather than each panel improvising its own label.

## Frame :698 "Settings · editing the event"

**MATCHES**, with one omission that is a named, ALREADY-RULED deviation,
not new debt — see `docs/design/DEVIATIONS.md` §1 ("Ruled omissions"),
which forbids restating the omitted control's name any further than that
file already does; this document does not repeat it.

- The back-above-H1 register (frame :723-724) matches: "‹ Event" back
  control, "Edit the event" H1, entered by firing the real "Change"
  control on the Event section's read view.
- The Starts/Ends date pair (frame :750, a two-column grid) matches:
  `EventSettingsPanel` renders "Start date" and "End date" as a
  `SettingsFieldPair`, the app's own two-up field wrapper.
- The footer (frame :777) matches: Cancel then a filled "Save changes"
  primary, same shared `SettingsSaveButton` label as the Call for papers
  drill above.

## Frame :788 "Settings · editing tracks and rooms"

**RESOLVED-BY-RULING (DEVIATIONS "Tracks-and-rooms save model")** — a real,
pre-existing and BLESSED divergence, not new debt.
Entered by firing the real "Add" control on the Tracks and rooms section's
read view.

- The back-above-H1 register (frame :813-814) MATCHES: "‹ Tracks and
  rooms" back control, drilled screen entered the same way as the other
  two edit views.
- The per-section head actions MATCH: "Add a track" (frame :822) and "Add
  a room" both render as their own section-head links, opening the same
  add form the section-level "Add" action already opens.
- Each track row's own name control and "Remove" action (frame :827-832)
  MATCH structurally — `TrackEditRow` renders a labelled name input and a
  "Remove" button per row, matching the frame's per-row anatomy (colour
  swatch, name field, usage note, removal control).
- **The SAVE MODEL diverges**, and this divergence is already adjudicated:
  `docs/design/DEVIATIONS.md`'s "Tracks-and-rooms save model" entry
  records "per-row dirty-reveal BLESSED (G13 srv1 adjudication); frame
  09--12's page-footer model filed as post-deadline rework. The Done
  control now confirms before discarding dirty rows." The frame draws ONE
  page-level footer (frame :857-858) — a bordered "Cancel" beside a filled
  "Save changes" primary, saving every row at once. The tree instead
  reveals a per-row "Save"/"Cancel" pair the instant a row's own draft
  goes dirty (`TrackEditRow`/`RoomEditRow`), and the drill's own page-level
  footer carries a single "Done" primary with no page-level Cancel or
  "Save changes" control anywhere in the drill — confirmed by rendering the
  drill and finding no "Save changes" text and exactly the one "Cancel"
  that lives inside `SummarySection`'s own edit-drill machinery for other
  panels, absent here. The frame is stale on this point, not the tree —
  filed here as a receipt of a divergence already ruled correct, per this
  task's mandate to file divergences even where they are real and already
  blessed.

## Summary

| Frame | Verdict |
| --- | --- |
| :28 Event, form, publishing, data · 1600 | MATCHES |
| :607 Settings · editing the call for papers | MATCHES |
| :698 Settings · editing the event | MATCHES |
| :788 Settings · editing tracks and rooms | RESOLVED-BY-RULING (DEVIATIONS "Tracks-and-rooms save model") |

3 of 4 frames MATCH as rendered; the one RESOLVED-BY-RULING row is a previously-ruled,
intentional divergence (per-row dirty-reveal beats a single page-level save
footer), not new debt. No desktop byte was moved to produce this verdict.
