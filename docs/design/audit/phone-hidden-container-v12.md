# Phone hidden-CONTAINER ledger, phone (width:390) — DEC-808 wave-41 amendment

Instrument: `app/src/phone-hidden-container.scan.test.ts`. This ledger names
the population `app/src/phone-capability-removal.scan.test.ts` (DEC-919)
does not grade: a phone `display:none` rule whose own **SELECTOR** is not
interactive (no bare `a`/`button`/`input`/`select`/`textarea`, and no
`chq-` token ever placed directly on one of those tags) but whose target
element — the class the selector actually hides, i.e. the rightmost
compound of a descendant chain, never an ancestor segment — wraps an
interactive descendant in the real markup. Hiding a CONTAINER removes its
whole subtree's capability just as surely as hiding the control itself; a
selector-keyed filter is blind to it by construction.

**Root fact** (re-derived, not assumed): 112 phone `display:none` rules
exist in the tree at authoring time; `phone-capability-removal.scan.test.ts`'s
own `selectorIsInteractive` narrows that to the interactive-selector
population it grades, leaving 91 rules whose selector is not itself
interactive. Of those, 31 are unreceipted AND wrap an interactive descendant
in their markup mount(s) — the population this file grades.

This file MEASURES AND RATCHETS ONLY — it moves no product CSS. Its ceiling,
`PHONE_HIDDEN_CONTAINER_UNRECEIPTED_CEILING`, is registered
`OUT_OF_CAMPAIGN_SCOPE` (never `PHONE_HIDDEN_UNRECEIPTED_CEILING`, which stays
a campaign-gating row at 0): a newly-derived population must not move an
existing gate's goalposts mid-convergence. It is promoted once later waves
adjudicate each row against its own v12 frame and either receipt it (a
verified navigation dead-end or re-lined replacement) or repair it.

## wave-49 (task w49-d): SHELL + SSR half adjudicated, ceiling 31 → 21

Re-derived the roster with the ceiling forced to `-1` (the DEC-808 idiom —
never trust a prior wave's description). Confirmed 31 rows unchanged since
wave-41. Adjudicated the ten SHELL + SSR rows (6 in `app/src/styles.css`, 1 in
`src/routes/docs-site.css.ts`, 3 in `src/routes/portal/portal.css.ts`)
against their v12 frames; all ten take disposition (a) — a
`/* phone-hidden: */` receipt naming the phone-side affordance that reaches
the same capability. Desktop CSS is unchanged; only comments were added.
`PHONE_HIDDEN_CONTAINER_UNRECEIPTED_CEILING` lowered from 31 to 21, measured
(not assumed) by re-running the scan with the receipts in place. The
remaining 21 rows, all under `app/src/pages/**`, are NOT this task's
population and are unchanged below.

### The wave-38 "double-Save defect" was already repaired (worked example)

`src/routes/portal/portal.css.ts`'s `.chq-portal-actions-footer { display:
none; }` (the phone-scoped copy) was wave-41's motivating example, recorded
as OWNED by `v12m-w38-a`/`v12m-w38-f` — neither branch exists any more.
Checking the live tree rather than trusting that history: the double-Save
repair is in fact already built.

- `src/routes/portal/portal.css.ts:731` (`.chq-portal-edit-dock { display:
  none; }`, top level) / `:1041` (`.chq-portal-actions-footer { display:
  none; }`, phone media block) / `:1051` (`.chq-portal-edit-dock { display:
  flex; flex: 1; }`, phone media block) — edit.tsx's in-flow Save is hidden
  on phone and its PortalLayout dock-slot twin is revealed; desktop is the
  mirror image. Exactly one copy draws at any width.
- `src/routes/portal/portal.css.ts:741` (`.chq-portal-profile-dock {
  display: none; }`, top level) / same `:1041` phone-block hide of
  `.chq-portal-actions-footer` / `:1051` `.chq-portal-profile-dock { display:
  flex; flex: 1; }` (phone media block) — profile.tsx's own comment at its
  usage (`src/routes/portal/profile.tsx`, the div wrapping the inline Save
  button) states directly: "exactly one Save control visible at any width".
- `src/routes/portal/portal.css.ts:751` (`.chq-portal-taskform-dock {
  display: none; }`, top level) — the same pattern a third time; the phone
  media block further down hides `.chq-portal-taskform-submit` and reveals
  the dock copy that `src/routes/portal/tasks/views.tsx` draws. Written as
  one citation carrying its own receipt rather than two adjacent code spans,
  which read as each other's quote (DEC-008 wave-10 precedent).

So `.chq-portal-actions-footer` is disposition (a), not (b): its phone-hidden
receipt names "the calling page's own dock button
(.chq-portal-edit-dock/.chq-portal-profile-dock), revealed by the matching
phone media rule ... through the same PortalLayout dock slot". No repair was
needed in this lane — the repair already landed on a prior wave's tree; this
wave's job was recognizing that and writing the receipt.

## Population (measured at authoring time, 2026-08-22; SHELL+SSR rows now receipted)

Each row: stylesheet — selector — markup file where the interactive
descendant was found. Rows 22–31 (below) carry a `/* phone-hidden: */`
receipt as of wave-49 and no longer appear in `CONTAINER_OFFENDERS`; they
are kept here as a record of what was adjudicated. Rows 1, 2, 9–12, and
19–21 carry a wave-52 disposition (below); rows 3–8 and 13–18 remain
unreceipted and are this ceiling's live population (13, matching the
lowered ceiling).

## wave-52 (task w52-d): nine more `app/src/pages/**` rows adjudicated, ceiling 21 → 13

Re-derived the roster with the ceiling forced to `-1` (the DEC-808 idiom).
Confirmed the 21 rows unchanged since wave-49. Adjudicated rows 1, 2, 9,
10, 11, 12, 19, 20, 21 against their v12 frames. Eight take disposition
(a), a `/* phone-hidden: */` receipt naming the phone-side affordance that
reaches the same capability by class and handler; one
(`app/src/pages/agenda/agenda.css` `.chq-agenda-armed-bar`) takes
disposition (b), a verified navigation dead-end. One row — 21,
`app/src/pages/speakers/task-view.css`'s `.chq-taskview-answers
.chq-taskview-head-row, .chq-taskview-waiting .chq-taskview-head-row` —
was disposition (c), a **REAL DEFECT**, DEC-808: no v12 phone (390) frame
exists anywhere in the pack for this screen (`docs/design/Chautauqua
Speakers.dc.html`'s only "Task response" frame is drawn at the 1600
desktop width, line 597 onward, with no 390 companion), and hiding the
head row removed the row's `toggleAll` "select every answer" /
"select everyone still waiting" checkbox with no phone-side replacement —
`TaskView.tsx`'s per-row checkboxes still let a speaker select rows one
at a time, but there was no single control anywhere in the phone surface
that reached the same select-all/select-none capability the desktop head
checkbox provides. Left unreceipted at wave-52's close; **built and
receipted wave-54 (task w54-c)** — see Disposition below.
`PHONE_HIDDEN_CONTAINER_UNRECEIPTED_CEILING` lowered from 21 to 13 (21 − 8
receipted) at wave-52, then to 12 (13 − 1, row 21's receipt landing) at
wave-54, each measured (not assumed) by re-running the scan with the
receipts in place. Desktop CSS is unchanged; only comments (plus, for row
21, a new phone-only control gated inside the file's one terminal phone
block) were added. Rows 3–8 and 13–18, all still under
`app/src/pages/**`, are unchanged and remain unadjudicated below.

1. **RECEIPTED** `app/src/pages/agenda/agenda.css` — `.chq-agenda-armed-bar` — `app/src/pages/Agenda.tsx`. Disposition (b), verified navigation dead-end: the `onArm` setter for the bar's `armed` state is only ever passed to DayGrid/UnscheduledTray inside Agenda.tsx's `!isPhone` branch, so `armed` can never become truthy at 390 and the bar's own Unschedule/Cancel buttons (rendered only `{armed && ...}`) can never paint; PhoneAgenda keeps its own `armed` state and draws the equivalent `.chq-phone-footer-armed` footer band instead.
2. **RECEIPTED** `app/src/pages/comms/comms.css` — `.chq-comms-main-landing` — `app/src/pages/Comms.tsx`. Disposition (a): re-lined as the sibling `.chq-comms-phone-landing` band (frame docs/design/Chautauqua Comms.dc.html:177, gated `isPhone`), whose own draft-card/Recent-Sends entry controls set `phoneEntered` true — the same flag that drops this class and reveals Compose/Templates/History here.
3. `app/src/pages/contacts/contacts-panels.css` — `.chq-contacts-pipeline-columns` — `app/src/pages/contacts/PipelineBoard.tsx`
4. `app/src/pages/contacts/contacts-panels.css` — `.chq-contacts-import-columns` — `app/src/pages/contacts/ImportWizard.tsx`
5. `app/src/pages/contacts/contacts-panels.css` — `.chq-contacts-import:has([data-chq-phone-dock]) .chq-modal-actions` (target token `chq-modal-actions`) — `app/src/pages/agenda/PhoneAgenda.tsx`
6. `app/src/pages/contacts/contacts.css` — `.chq-contacts-rail` — `app/src/pages/contacts/DirectoryRail.tsx`
7. `app/src/pages/contacts/contacts.css` — `.chq-contacts-segment-summary` — `app/src/pages/contacts/ContactsApp.tsx`
8. `app/src/pages/contacts/contacts.css` — `.chq-contacts-filter-rules-row` — `app/src/pages/contacts/FilterRulesPanel.tsx`
9. **RECEIPTED** `app/src/pages/content/content.css` — `.chq-content-files-download-all-wrap` — `app/src/pages/content/FilesLibrary.tsx`. Disposition (a): re-lined as the sticky `.chq-phone-dock`'s own "Download all" `chq-btn-primary` button, same `handleDownloadAll` handler and disabled state, at the frame's 48px dock height (docs/design/Chautauqua Content.dc.html:359).
10. **RECEIPTED** `app/src/pages/content/content.css` — `.chq-content-worklist .chq-bulkbar` (target token `chq-bulkbar`) — `app/src/pages/comms/ComposeWizard.tsx`. Disposition (a): re-lined as the per-row Approve/Open verbs (rest state) plus the header's own Select toggle, which arms `.chq-content-worklist-selecting .chq-bulkbar` — entering Select is the only route to bulk approval on phone, matching the frame's tab-bar-only footer at rest (docs/design/Chautauqua Content.dc.html:198).
11. **RECEIPTED** `app/src/pages/content/content.css` — `.chq-content-comment-actions` — `app/src/pages/content/CommentThread.tsx`. Disposition (a): re-lined as `CommentThread.tsx`'s own `.chq-phone-dock` footer (Ask for changes / Send note), same `submit(true)`/`submit(false)` handlers as this inline row — the frame draws one action pair, docked, never two.
12. **RECEIPTED** `app/src/pages/forms/forms.css` — `.chq-forms-header-actions` — `app/src/pages/forms/FormsPage.tsx`. Disposition (a): re-lined as `.chq-forms-phone-footer`'s own "Save the form" / "Preview" dock, wired to the same `handleSaveWindow` handler, at the frame's dock geometry (docs/design/Chautauqua Submissions.dc.html:485-487).
13. `app/src/pages/overview/overview.css` — `.chq-overview-clash-eyebrow-group > .chq-overview-row-title-sm, .chq-overview-clash-eyebrow-group > .chq-overview-row-meta` (target tokens `chq-overview-row-title-sm`, `chq-overview-row-meta`) — `app/src/pages/Overview.tsx`
14. `app/src/pages/settings/settings.css` — `.chq-settings-content` — `app/src/pages/Settings.tsx`
15. `app/src/pages/settings/settings.css` — `.chq-settings-section` — `app/src/pages/settings/PeopleRolesPanel.tsx`
16. `app/src/pages/settings/settings.css` — `.chq-settings-layout[data-drilled='true'] .chq-settings-rail` (target token `chq-settings-rail`) — `app/src/pages/Settings.tsx`
17. `app/src/pages/settings/settings.css` — `.chq-settings-saved-embed-body` — `app/src/pages/settings/SavedEmbedsPanel.tsx`
18. `app/src/pages/settings/settings.css` — `.chq-settings-public-pages-own-hidden` — `app/src/pages/settings/PublicPagesPanel.tsx`
19. **RECEIPTED** `app/src/pages/speakers/speakers.css` — `.chq-speakers-grid-wrap` — `app/src/pages/speakers/OnboardingGrid.tsx`. Disposition (a): re-lined as `.chq-speakers-cards` immediately below — the frame's own "Matrix becomes one card per speaker" collapse (docs/design/Chautauqua Speakers.dc.html:130), same data, same row handlers.
20. **RECEIPTED** `app/src/pages/speakers/speakers.css` — `.chq-speakers-head-actions` — `app/src/pages/speakers/OnboardingGrid.tsx`. Disposition (a): re-lined as `.chq-speakers-phone-head-actions` immediately below — the frame's own Remind outstanding / Filter phone action row (docs/design/Chautauqua Speakers.dc.html:141).
21. **RECEIPTED** `app/src/pages/speakers/task-view.css` — `.chq-taskview-answers .chq-taskview-head-row, .chq-taskview-waiting .chq-taskview-head-row` (target token `chq-taskview-head-row`) — `app/src/pages/speakers/TaskView.tsx`. Was disposition (c), a REAL DEFECT (DEC-808): no v12 phone (390) frame exists for this screen at all — `docs/design/Chautauqua Speakers.dc.html`'s only "Task response" frame is drawn at the 1600 desktop width (line 597 onward), no 390 companion — and hiding the head row removed its `toggleAll` "select every answer"/"select everyone still waiting" checkbox with no phone-side replacement. **BUILT wave-54 (task w54-c), now disposition (a)**: the always-mounted bulk bar renders an `All {n}` control (`.chq-taskview-bulk-selectall`, same file, floored to 44px only inside the terminal phone block), present in both its idle and armed branches, calling the same `toggleAll` this row's checkbox calls — the house's one existing select-all idiom (DEC-825, Content's `All {n}`), per DEC-989.
22. **RECEIPTED** `app/src/styles.css` — `.chq-shell:has([data-chq-phone-head]) .chq-header` (target token `chq-header`) — reaches App.tsx's real shell header (the scan's own subtree resolution happened to report `src/routes/docs.tsx`, an unrelated standalone `/docs/api` page whose own unrelated `chq-header` class token also carries an `<a>`; App.tsx's shell header — the actual target of this selector — independently carries `.chq-nav` links and the Sign out button). Receipt: the opting-in page's own `data-chq-phone-head` band (back affordance) plus, for Sign out, that same drill-in's `data-chq-phone-signout` band (App.tsx); a reviewer — the only role that ever sets `data-chq-phone-head` — has a single primary section, so App.tsx's `PhoneTabBar` never mounts and there was no nav to lose.
23. **RECEIPTED** `app/src/styles.css` — `.chq-nav` — `app/src/App.tsx` (Header). Receipt: duplicate of a twin that stays on screen — App.tsx's `PhoneTabBar` renders the same `NavLinks` data as the persistent bottom tab bar, plus the More sheet for sections that don't fit the primary slots.
24. **RECEIPTED** `app/src/styles.css` — `.chq-header-identity .chq-user-identity` (target token `chq-user-identity`) — `app/src/App.tsx`. Receipt: duplicate of a twin that stays on screen — `PhoneTabBar`'s More sheet carries its own Sign out whenever a tab bar mounts; `app/src/styles.css`'s own very next rule (`.chq-shell:not(:has(.chq-tabbar)):not(:has([data-chq-phone-signout])) .chq-header-identity .chq-user-identity { display: inline-flex; }`) restores this identity block's Sign out whenever no tab bar mounts, so the capability is never actually lost at 390.
25. **RECEIPTED** `app/src/styles.css` — `.chq-main:has([data-chq-phone-dock]) ~ .chq-tabbar` (target token `chq-tabbar`) — `app/src/App.tsx`. Receipt: re-lined as the page's own `data-chq-phone-dock` band's primary action(s) (e.g. Content's phone Select-mode dock, docs/design/Chautauqua Content.dc.html:278).
26. **RECEIPTED** `app/src/styles.css` — `.chq-shell:has(.chq-phone-dock) .chq-tabbar` (target token `chq-tabbar`) — `app/src/App.tsx`. Receipt: re-lined as the shell's own `.chq-phone-dock` band's primary action(s) — the docked drill-in twin this rule's own preceding comment documents (Settings/Submissions/Review).
27. **RECEIPTED** `app/src/styles.css` — `body:has(.chq-scrim [data-chq-phone-dock]) .chq-tabbar` (target token `chq-tabbar`) — `app/src/App.tsx`. Receipt: re-lined as the portalled modal dock's own primary action(s), reached across the `.chq-scrim` boundary (e.g. ImportWizard.tsx via ModalFrame) — the same capability the two narrower rules above (25, 26) re-line for an in-shell dock.
28. **RECEIPTED** `src/routes/docs-site.css.ts` — `.chq-docs-nav` — `src/routes/docs-site.tsx`. Receipt: re-lined in place by the very next rule in the same file (`.chq-docs-article-frame:has(.chq-docs-contents-checkbox:checked) .chq-docs-nav { display: flex; }`), driven by the sr-only `.chq-docs-contents-checkbox` toggle.
29. **RECEIPTED** `src/routes/portal/portal.css.ts` — `.chq-portal-actions-footer` — `src/routes/portal/edit.tsx` (also composed by `profile.tsx`). NOT the double-Save defect wave-38's history named — see the worked example above: that repair already landed. Receipt: re-lined as the calling page's own dock button (`.chq-portal-edit-dock` for edit.tsx, `.chq-portal-profile-dock` for profile.tsx), revealed by the matching phone media rule through the same `PortalLayout` dock slot.
30. **RECEIPTED** `src/routes/portal/portal.css.ts` — `.chq-portal-shell > .chq-portal-footer .chq-portal-signout` (target token `chq-portal-signout`) — `src/routes/portal/shared.tsx`. Receipt: duplicate of a twin that stays on screen — `shared.tsx`'s header identity cluster (`.chq-portal-header-signout` form/button) already carries the same `POST /logout` control at 390.
31. **RECEIPTED** `src/routes/portal/portal.css.ts` — `.chq-portal-taskform-submit` — `src/routes/portal/tasks/views.tsx`. Receipt: re-lined as `.chq-portal-taskform-dock` (the rule immediately above it in the same file), the same `PortalLayout` dock slot, single Submit control.

## Disposition

Rows 22–31 were adjudicated wave-49. All ten take disposition (a): each
hidden container's capability has a verified, re-lined phone-side
replacement, named above by class and handler (not by copy, per DEC-613/
DEC-967 drift-proof citation and the css-comment-copy-leak scan's
constraint on the two `src/routes/**/*.css.ts` rows).

Rows 1, 2, 9, 10, 11, 12, 19, 20, 21 were adjudicated wave-52 (task
w52-d). Eight took disposition (a) or (b) as recorded above, each named
by class and handler, never by quoting product copy. One — row 21,
`app/src/pages/speakers/task-view.css`'s
`.chq-taskview-answers .chq-taskview-head-row, .chq-taskview-waiting
.chq-taskview-head-row` — took disposition (c), **REAL DEFECT** (DEC-808):
no v12 phone (390) frame exists in the pack for the Task response screen
at all (`docs/design/Chautauqua Speakers.dc.html`'s only frame for it is
drawn at the 1600 desktop width), and hiding the head row removed the
row's `toggleAll` select-all/select-none checkbox with no phone-side
replacement — per-row checkboxes remained but there was no single control
that reached the same bulk-selection capability at 390. It was left
unreceipted and unrepaired at wave-52's close, not that task's population
to repair, only to adjudicate and record.

**Wave-54 (task w54-c) built and receipted row 21**, closing the
campaign's last disposition-(c) row in this doc: it is now disposition
(a), and the ten rows below (all still `app/src/pages/**`) are the only
ones left unadjudicated.

None of the eighteen adjudicated rows (wave-49's ten, wave-52's nine —
eight receipted at the time plus row 21, now also receipted as of
wave-54) required a CSS declaration/selector/media-query change to any
EXISTING rule — desktop is frozen and stays byte-identical; only
`/* phone-hidden: */` comments were added immediately above each hide
rule, plus (row 21 only) a new phone-only `.chq-taskview-bulk-selectall`
control and its own floor rule inside the file's one terminal phone
block.

Rows 3–8 and 13–18 (`app/src/pages/**`, 12 rows) were NOT receipted or
repaired — out of scope for task w52-d, which owned exactly the nine rows
named above. Adjudicating each of those 12 against its v12 frame (does
the hidden container's capability have a re-lined phone-width
replacement, a verified navigation dead-end, or is it a genuine
unaddressed capability-removal defect, DEC-808) is a future wave's work,
one row (or a small owned batch) at a time, per the same discipline
`PHONE_HIDDEN_UNRECEIPTED_CEILING`'s own closing-paragraph history
already models.
