# Settings v12 phone conformance — audit findings

Findings surfaced while implementing w3-e (SETTINGS AT 390 (I): the landing
plus two drills — Chautauqua Settings.dc.html :275-312, :347-389, :393-440).

## Shell tab bar needed at Settings phone widths — App.tsx/styles.css, not this task's files

The landing frame's footer (:299-311) draws the shell's five-tab dock, not a
page-level control. This task's constraints forbid touching
`app/src/styles.css`/`app/src/App.tsx`, and per the task instructions the
correct move is to record the need here rather than build a second dock.
Per the field guide (w2), the tab bar shell is already mounted
(`App.tsx:290`), so this is very likely already satisfied for `/admin/settings`
with no further work — flagging only because this task's own files cannot
verify it (no shell markup lives in `app/src/pages/settings/**`).

## Tracks/rooms and Your-data read views: no per-row Edit/Download/Revoke affordance yet

The two drill frames (:347-389, :393-440) draw each track/room/export/token
row with a boxed 44px `Edit`/`Download`/`Revoke` action beside it
(`Chautauqua Settings.dc.html:364,409,423`), plus dashed `Add a track`/
`Add a room` buttons (`:367`). The current architecture (`TracksRoomsPanel`,
`YourDataPanel`) instead wraps each section's whole body in ONE
`SummarySection` with a single section-level `Add`/`Change` action that
drills into a separate edit form (`?section=<key>&edit=1`) — the read view
itself renders plain rows with no per-row button at all.

**Why not rebuilt this task**: the task's WHAT TO BUILD section scopes three
concrete deliverables (landing list, footer=shell-dock, back-link+H1
register) and none of them ask for a per-row-action redesign of the two
panels' read markup; DEVIATIONS §6 separately defers Your data's retention
select/revoke-token footer specifically, which reads as this same family of
gap already being tracked as post-deadline. Rebuilding the summary-vs-edit
split into per-row inline actions is a real architectural change (new
markup, new endpoints wiring per row) well outside a ~10-15 minute geometry
slice, so it was left as-is and is flagged here per the task's design-gap
instruction rather than attempted narrowly and left half-built.

**What this task did instead**: the existing generic phone reflow
(`.chq-settings-panel li`, `.chq-settings-panel .chq-table`,
`.chq-settings-panel .chq-link-button`, all in settings.css's consolidated
terminal media block) already gives every row in EITHER panel's edit-mode
list a 44px boxed action and a one-column stack, matching the frame's row
anatomy for whichever view (read summary vs. edit list) a future task
chooses to line up with the mock's row-level affordance. The read-view gap
above is the only piece left open.

**Amendment (wave 156, task qe-tracks-rooms-read-drill):** the Tracks/rooms
half of this finding is CLOSED — `TracksRoomsPanel`'s read view now renders
the boxed per-row `Edit` and dashed `Add a track`/`Add a room` row described
above, phone-only, drilling into the section's existing edit surface. The
`YourDataPanel` half (Exports `Download`, API tokens `Revoke`, frame
`:409,423`) is untouched and stays open exactly as documented here.

## settings.css: five scattered max-width blocks consolidated into one terminal block

Per DEC-385 (w85), `settings.css` had five separate `@media (max-width:
700px)` blocks (starting at the pre-task lines 158, 851, 916, 1334, 1368) —
a live cascade-shadow risk matching the wave-85 finding for portal/settings/
review/speakers sheets. This task merged all five into the single terminal
block (now the file's only `@media` block), preserving the original
in-file order of their rules and keeping the non-media
`.chq-settings-delete-blockers`/`.chq-settings-section-head-consequence`
trailer AFTER the consolidated block — that trailer relies on
same-specificity source-order to win over `.chq-settings-panel li`, so it
could not simply be left where the old final block used to sit if the
block itself moved past it. `settings-phone-frames.test.ts` asserts exactly
one `@media (max-width: 700px)` block exists so a future append (this
task's own note: w3-f appends into the same batch) cannot silently reopen a
second one.

---

<!-- merged from v12m-w3-f -->

# Settings v12 phone-drill audit

## task-w3-f: Call for papers, Public pages, Speaker portal (:444-477 / :481-506 / :510-548)

Scope taken: phone-only (max-width:700px, DEC-385) geometry/typography fixes
to the panel components already assigned to this task, plus a new
settings.css phone block appended at the file's true end. Desktop is
unchanged.

### Shell (not owned by this task, no file touched)

- The `‹ Settings` back link and the section's H1 are rendered once,
  generically, by `Settings.tsx` (`.chq-settings-back` / `.chq-page-title`)
  for every drilled section, not per-panel. That shell markup/CSS is
  outside this task's FILES YOU OWN list (Settings.tsx, App.tsx,
  styles.css are all off-limits here). If the 44px-back-link / 26px-drill-
  H1 registers documented in the field guide are not yet wired for
  Settings specifically, that is shell work for whichever lane owns
  Settings.tsx/styles.css, not this panel-level task.

### Content gaps found, deliberately NOT rebuilt (narrower than "row
geometry"; flagging rather than guessing at scope)

- **CFP per-question list** (:467-475, `Questions · 8` numbered section +
  one row per question with a boxed `Edit` pill): CallForPapersPanel's own
  header comment already documents that field editing is intentionally
  delegated to the form builder route (`/submissions/forms`) rather than
  reimplemented here — the read view instead shows one summary row
  ("Custom questions: N — label, label..."). Bringing the frame's full
  per-question phone list into being would mean building new list/edit
  affordances, not adjusting the geometry of what already renders. Left
  as-is; flagged for whoever owns that product decision to bless or
  build.
- **Speaker portal Welcome note** (:518, a boxed ~88px readout of the
  actual welcome text): the read view instead renders a computed summary
  ("Shown above the task list · N paragraph(s)"), consistent with this
  panel's existing DEC-815 summary-first pattern (the same wave that
  changed *Resources* from a description to a real list left Welcome note
  as a description). Not rebuilt here; same reasoning as above.
- **Public pages section-head consequence label** ("Unpublishing returns
  404...") and PortalSettingsPanel's extra Onboarding-tasks / Access /
  Open-the-portal rows are not drawn inside the phone frame's own citation
  span at all (desktop-only annotation / summary rows beyond what :510-548
  shows). Left rendering as extra information; not a defect, just noting
  the frame doesn't draw them so no phone-specific geometry was owed for
  them.

### w1-e frame-citation repair note (DEC-976 amendment wave 98)

- **`.chq-settings-summary-row` padding vs. People and roles frame rows**
  (`app/src/pages/settings/settings.css:1877-1881`): the pre-existing
  comment cited both the Your data drill (`:393-441`) and the People and
  roles drill (`:552-575`) for one shared "`padding:15px 0; border-bottom:
  1px solid #E1DDCE`" quote, backing a rule that declares `padding: 14px
  0`. Checked each half against the frame bytes: Your data's own rows
  (`:404`, `:417`) read `padding:14px 0` — matching the CODE, not the
  comment's `15px` quote — while People and roles' rows (`:559`) read
  `padding:15px 0` — matching the comment's quote, not the code. Neither
  half of the citation was internally consistent, and on top of that
  `.chq-settings-summary-row` (the class this comment describes) is only
  ever applied inside the Your data drill (`ResourcesPanel.tsx`,
  `ApiTokensPanel.tsx`) — the People and roles panel renders a wholly
  different class, `chq-settings-people-row` (`PeopleRolesPanel.tsx`,
  desktop `padding:12px 0` at `settings.css:708`, no phone-scoped
  override at `:1535`). Repaired the comment to cite only `:404` (Your
  data, the drill this rule actually governs) with the quote corrected to
  `padding:14px 0`, matching both the code and that frame line, and
  dropped the People-and-roles half rather than inventing a citation for
  a rule that never applied to that drill. Filed here rather than fixed
  in code: whether People and roles' 15px phone-row rhythm (`:559`)
  deserves its own phone-scoped padding bump on `.chq-settings-people-row`
  (currently 12px, from the desktop rule) is a real, separate gap for a
  future wave — not something this comments-only task may touch.

### Deferred-by-ruling, cited not re-flagged

- Public-pages Publish/Unpublish toggle (:495, `{{ p.toggle }}`) —
  DEVIATIONS.md §6 names 09--07's toggle explicitly as deferred
  post-deadline, no backing data. Not rendered at all (never as a disabled
  control), per that ruling.

---

<!-- w10-ne (DEC-976 amendment wave 154) -->

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
the same wave (tasks qe/qb). **Four of nine diverge; the landing, Tracks and
rooms, Your data, Public pages and Saved embeds match.** The remaining four
rows (`:316`, `:444`, `:510`, `:552`) are all instances of the DEC-728
read/edit-split gap named above.

| Frame | Verdict | What diverges |
| --- | --- | --- |
| `:275` Settings (landing) | MATCHES | Index row order (label + "Open" + detail) equals the frame's `mobileGroups` order; DEC-691/DEC-747 rail order. |
| `:316` Settings · Event | DIVERGES (narrowed, DEC-919 wave-156) | Read view is `SummarySection`'s head-first "Change" (button precedes every row); frame draws content rows then a Save/Cancel footer. The footer's "Save" primary now renders in read mode too (`.chq-settings-drillrow-footer-primary`, `settings-drill-rows.css`), pressing it enters the edit drill (`?section=event&edit=1`) rather than saving nothing — a read view holds no form to submit. "Cancel" has nothing to cancel in read mode and stays unbuilt. |
| `:347` Settings · Tracks and rooms | MATCHES | CLOSED wave 156 (task qe-tracks-rooms-read-drill): the read view now renders a boxed 44px "Edit" per row plus a dashed "Add a track"/"Add a room" row closing each list (frame `:364,367,379,382`), phone-only via `settings-lists.css`'s terminal `@media (max-width: 700px)` block; both drill into the section's existing edit surface (`?section=tracks-rooms&edit=1`), reusing `useTracksRoomsPanel`'s existing `toggleAddTrack`/`toggleAddRoom` state rather than minting a second one. Your-data's own per-row Download/Revoke gap (`:409,423`) is closed separately by task qb-settings-yourdata-read-drill, same wave. |
| `:393` Settings · Your data | MATCHES | Per-row boxed "Download" (Exports) and "Revoke" (API tokens) actions, plus the filled 46px full-width "New token" primary, all render in the read drill (task qb-settings-yourdata-read-drill, wave 156). Download performs in place against the existing export hrefs; Revoke opens `ApiTokensPanel`'s existing `ConfirmDialog`; New token enters `?section=your-data&edit=1`, landing on the already-open create form. Closes the still-open remainder of the masked-tokens/Revoke/New-token finding (wave 118). |
| `:444` Settings · Call for papers | DIVERGES | Per-question list (`:467-475`, one row + boxed "Edit" per question) collapsed to one computed summary row — form-builder delegation, already documented above. |
| `:481` Settings · Public pages | MATCHES | Row order (name, path, state, View, Embed code) matches; no head-first gate at all (DEC-896 B10 DROP — the frame itself draws no edit view for this section). Sole omission is the DEVIATIONS §6-blessed Publish/Unpublish toggle (`:495`, never rendered, not even disabled). |
| `:510` Settings · Speaker portal | DIVERGES | Welcome note (`:518`, full boxed readout) collapsed to a computed one-line summary ("Shown above the task list · N paragraph(s)") — already documented above (DEC-815). |
| `:552` Settings · People and roles | DIVERGES (narrowed, DEC-919 wave-156) | No per-row boxed "Change" (`:560`) — DEVIATIONS.md §6 blesses this omission (users are org-scoped), not re-litigated. The always-on primary "Invite someone" (`:565`) now renders in read mode too (`.chq-settings-drillrow-footer-primary`, `settings-drill-rows.css`), opening the panel's existing invite dialog directly — its own surface, not a form submit. |
| `:578` Settings · Saved embeds | MATCHES (nested) | Closed wave 156, DEC-728: renders as its own 390 screen at `?section=public-pages&view=embeds` (a nested drill under Public pages, not an eighth `SECTIONS` entry — DEC-747/DEC-691). Own back-link ("‹ Public pages", returning to the Public pages read drill rather than the section index — DESIGN-RULINGS:247), own H1 ("Saved embeds", via `Settings.tsx`'s existing `phoneDrillTitle` machinery) and the "N on · N off" summary (`:582`) directly under it all render. Public pages' own read drill, at rest, now carries the screen's entry point instead of always mounting the full row list inline. Row-shape differences (Turn on/off + Get code pair vs. "four flush buttons") already documented in `docs/probes/metafid-phoneA-2026-08-19.md`. |

**Nothing in this list (besides the now-closed `:578` row) is a
phone-block-CSS or markup-order fix** — every remaining row is a missing
control, each requiring new markup/wiring (per-row action buttons, full-text
readouts) rather than a reflow of what already renders. Left as findings for
whoever owns the next architectural pass on this cluster, per this task's
design-gap instruction.
