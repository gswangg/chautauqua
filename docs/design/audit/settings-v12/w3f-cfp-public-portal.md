# Settings v12 phone-drill audit (w3-f)

<!-- Submodule of docs/design/audit/settings-v12.md — see that file's index.
     Extracted, no content change, wave 15 contention decomposition.
     Previously merged from v12m-w3-f into the monolithic settings-v12.md. -->

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
