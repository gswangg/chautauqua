# Settings v12: per-frame verdict, all nine 390 READ frames (w10-ne)

<!-- Submodule of docs/design/audit/settings-v12.md — see that file's index.
     Extracted, no content change, wave 15 contention decomposition.
     DEC-976 amendment wave 154. -->

## task-w10-ne: per-frame verdict, all nine 390 READ frames — closing the
phoneA "frame-count" open clause

`docs/probes/metafid-phoneA-2026-08-19.md` carried one self-declared open
clause since wave 118: "the frame-count clause ('five of nine frames never
rendering as drawn') was NOT re-measured this wave and stays open." This
task actually rendered all nine, entered through `Settings.tsx`'s real
panel routing (`<MemoryRouter initialEntries={['/settings?section=<key>']}>
<SettingsPage /></MemoryRouter>`, never a panel mounted directly), and
recorded a verdict per frame below. Render receipts:
`app/src/pages/Settings.frame-verdicts.render.test.tsx` (9 passing tests,
one per frame, each opening with a DEC-967 `verbatimLine` citation of the
frame's own caption line).

The original "five of nine" undercounted: at the time, **eight of nine
diverge**, only Public pages matches. No divergence found is a phone-CSS or
markup-ORDER fix (DEC-385) — every one is a genuine content/control gap,
most already catalogued above by earlier lanes, in the app's deliberate
DEC-728 read/edit split (a `SummarySection` head-first "Change" drill in
front of plain read rows, converged wave 15, adopted identically by every
panel in this cluster) versus the frame's per-screen field-list-then-Save/
Cancel-footer anatomy. Rebuilding that split is a cross-cutting
architectural change spanning every panel in the cluster, well outside a
page-scoped task — flagged, not attempted, consistent with every prior
lane's disposition of the same family of gap.

**Amendment (wave 156):** the `:578` Saved-embeds row closed (DEC-728) —
Saved embeds now renders as its own screen, a nested drill under Public
pages; the `:347` Tracks-and-rooms and `:393` Your-data read drills closed
the same wave (tasks qe/qb), and `:444` Call for papers / `:510` Speaker
portal closed in wave 157 (task re, DEC-919 clauses (a)/(b)). **Two of nine
diverge; the landing, Tracks and rooms, Your data, Call for papers, Public
pages, Speaker portal and Saved embeds match.** The remaining two rows
(`:316`, `:552`) are instances of the DEC-728 read/edit-split gap named
above.

**Amendment (wave 17, task w17-d, DEC-919):** every 390 drill frame in this
family draws the head band as ONE title and nothing else above the body
rows — no second label, no head action, for Event specifically (Tracks and
rooms, People and roles keep a head action; only Event's frame draws a
footer primary that already reaches the same edit surface).

docs/design/Chautauqua Settings.dc.html:319
`<h1 style="margin:0; font-family:'Familjen Grotesk', sans-serif; font-size:26px; font-weight:700; letter-spacing:-0.04em; line-height:1">Event</h1>`

docs/design/Chautauqua Settings.dc.html:335
`<span style="flex:1; background:#4E5C31; color:#F7F9F0; border-radius:6px; min-height:46px; display:flex; align-items:center; justify-content:center; font-size:14px; font-weight:700">Save</span>`

`SummarySection`'s own head (`SummarySection.tsx`) duplicated that title as
a second `<h2>` at 390, alongside `Settings.tsx`'s existing
`.chq-settings-drill-title` H1 twin. Closed for every `SummarySection`
read drill (Event, Tracks and rooms, People and roles, Public pages) by a
single direct-child-scoped rule appended to settings.css's terminal
`@media (max-width: 700px)` block (`.chq-settings-panel >
.chq-settings-section-head > h2`); the h2 carried no capability of its
own, `aria-label={label}` on the panel `<section>` already supplies the
accessible name. Event's head "Change" action additionally stands down at
390, scoped by a new `data-chq-section` attribute on `SummarySection`'s
root — a re-line onto the frame's own footer "Save" (cited above), which
DEC-919 wave-156 already renders in the read drill and which opens the
identical `?section=event&edit=1` drill. No other section's head action is
touched.

**Amendment (wave 45, DEC-919): "Cancel" CLOSED, ruled permanently
unbuilt.** The `:316` row's `**Still unbuilt:**` clause below was the last
open clause in this nested audit directory and read as scheduled work
rather than as an adjudication. `src/decisions-data/DEC-919.md`'s
"Amendment (wave 45)" rules it CLOSED: the frame's footer pair
(`:335`/`:336`) is the EDIT view's footer drawn in the read drill's slot;
"Save" re-lines onto the edit surface (wave-156, above) and "Cancel" has
neither state to discard (a read view holds no form) nor a destination of
its own -- its only possible destination, the section index, is already
reached by the drill header's own `‹ Settings` back link the same frame
draws at `:318`. DESIGN-RULINGS item 6 rules two affordances for one
destination out, so building it would trade one recorded omission for one
ruled-against duplication. This is a RULING, not a DEVIATIONS entry -- no
override of the pack is sought, the drawn control is satisfied at the
composition level. Pinned by
`app/src/pages/settings/EventSettingsPanel.readDrill.render.test.tsx`,
which asserts the read drill's footer band draws exactly one control and
the screen carries exactly one back-affordance to the section index.

| Frame | Verdict | What diverges |
| --- | --- | --- |
| `:275` Settings (landing) | MATCHES | Index row order (label + "Open" + detail) equals the frame's `mobileGroups` order; DEC-691/DEC-747 rail order. |
| `:316` Settings · Event | DIVERGES (narrowed, DEC-919 wave-17) | CLOSED wave 17 (task w17-d, DEC-919): the head band now shows the frame's ONE title — `SummarySection`'s own duplicate `<h2>` is hidden at 390 (`.chq-settings-panel > .chq-settings-section-head > h2`, settings.css terminal block), leaving `Settings.tsx`'s `.chq-settings-drill-title` H1 as the sole visible label. The head's "Change" action also stands down at 390 (`.chq-settings-panel[data-chq-section='event'] > .chq-settings-section-head > .chq-settings-section-action`) — a RE-LINE, not a removal: the frame's own footer "Save" (`.chq-settings-drillrow-footer-primary`, `settings-drill-rows.css`) already renders in read mode and opens the identical `?section=event&edit=1` drill the head action opened. **CLOSED-with-receipt (wave 45, DEC-919):** "Cancel" has nothing to cancel in a read view (no form is open to discard) and no destination of its own -- its only possible destination, the section index, is already reached by the drill header's own back link. Ruled permanently unbuilt, not deferred, by `src/decisions-data/DEC-919.md`'s "Amendment (wave 45)"; pinned by `app/src/pages/settings/EventSettingsPanel.readDrill.render.test.tsx` `describe('Settings · Event 390 read drill (DEC-919 wave-45)'`. |
| `:347` Settings · Tracks and rooms | MATCHES | CLOSED wave 156 (task qe-tracks-rooms-read-drill): the read view now renders a boxed 44px "Edit" per row plus a dashed "Add a track"/"Add a room" row closing each list (frame `:364,367,379,382`), phone-only via `settings-lists.css`'s terminal `@media (max-width: 700px)` block; both drill into the section's existing edit surface (`?section=tracks-rooms&edit=1`), reusing `useTracksRoomsPanel`'s existing `toggleAddTrack`/`toggleAddRoom` state rather than minting a second one. Your-data's own per-row Download/Revoke gap (`:409,423`) is closed separately by task qb-settings-yourdata-read-drill, same wave. |
| `:393` Settings · Your data | MATCHES | Per-row boxed "Download" (Exports) and "Revoke" (API tokens) actions, plus the filled 46px full-width "New token" primary, all render in the read drill (task qb-settings-yourdata-read-drill, wave 156). Download performs in place against the existing export hrefs; Revoke opens `ApiTokensPanel`'s existing `ConfirmDialog`; New token enters `?section=your-data&edit=1`, landing on the already-open create form. Closes the still-open remainder of the masked-tokens/Revoke/New-token finding (wave 118). |
| `:444` Settings · Call for papers | MATCHES | Per-question list (`:467-475`, one row + boxed "Edit" per question) now renders in the read drill (task re, wave 157, DEC-919 clause (b)); each row's boxed "Edit" carries that question's own `id` to `/submissions/forms?fieldId=…` so the tap lands on the field that was tapped, not the builder's index. Field editing itself still stays in the form builder — delegation decides the destination, never whether the control exists. |
| `:481` Settings · Public pages | MATCHES | Row order (name, path, state, View, Embed code) matches; no head-first gate at all (DEC-896 B10 DROP — the frame itself draws no edit view for this section). Sole omission is the DEVIATIONS §6-blessed Publish/Unpublish toggle (`:495`, never rendered, not even disabled). |
| `:510` Settings · Speaker portal | MATCHES | Welcome note (`:518`) now renders the stored welcome text verbatim inside a boxed ~88px readout matching the frame's padding/line-height/overflow treatment (task re, wave 157, DEC-919 clause (a)). Desktop's pre-existing computed "Shown above the task list · N paragraph(s)" line stays mounted, frozen, alongside it — CSS (settings-drill-rows.css's terminal max-width block) is the only thing deciding which one is visible at which width. |
| `:552` Settings · People and roles | DIVERGES (narrowed, DEC-919 wave-156) | No per-row boxed "Change" (`:560`) — DEVIATIONS.md §6 blesses this omission (users are org-scoped), not re-litigated. The always-on primary "Invite someone" (`:565`) now renders in read mode too (`.chq-settings-drillrow-footer-primary`, `settings-drill-rows.css`), opening the panel's existing invite dialog directly — its own surface, not a form submit. The wave-17 h2 de-duplication (see `:316`'s row) applies here too — the head's "Change" action itself is untouched (kept, since it is People's only route to role editing at 390 per DEVIATIONS §6). |
| `:578` Settings · Saved embeds | MATCHES (nested) | Closed wave 156, DEC-728: renders as its own 390 screen at `?section=public-pages&view=embeds` (a nested drill under Public pages, not an eighth `SECTIONS` entry — DEC-747/DEC-691). Own back-link ("‹ Public pages", returning to the Public pages read drill rather than the section index — DESIGN-RULINGS:247), own H1 ("Saved embeds", via `Settings.tsx`'s existing `phoneDrillTitle` machinery) and the "N on · N off" summary (`:582`) directly under it all render. Public pages' own read drill, at rest, now carries the screen's entry point instead of always mounting the full row list inline. Row-shape differences (Turn on/off + Get code pair vs. "four flush buttons") already documented in `docs/probes/metafid-phoneA-2026-08-19.md`. |

**Nothing in this list (besides the now-closed `:578` row) is a
phone-block-CSS or markup-order fix** — every remaining row is a missing
control, each requiring new markup/wiring (per-row action buttons, full-text
readouts) rather than a reflow of what already renders. Left as findings for
whoever owns the next architectural pass on this cluster, per this task's
design-gap instruction.
