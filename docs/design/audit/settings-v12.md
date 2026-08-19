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

### Deferred-by-ruling, cited not re-flagged

- Public-pages Publish/Unpublish toggle (:495, `{{ p.toggle }}`) —
  DEVIATIONS.md §6 names 09--07's toggle explicitly as deferred
  post-deadline, no backing data. Not rendered at all (never as a disabled
  control), per that ruling.
