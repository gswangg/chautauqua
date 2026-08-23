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

- `src/routes/portal/portal.css.ts:727` (`.chq-portal-edit-dock { display:
  none; }`, top level) / `:1041` (`.chq-portal-actions-footer { display:
  none; }`, phone media block) / `:1051` (`.chq-portal-edit-dock { display:
  flex; flex: 1; }`, phone media block) — edit.tsx's in-flow Save is hidden
  on phone and its PortalLayout dock-slot twin is revealed; desktop is the
  mirror image. Exactly one copy draws at any width.
- `src/routes/portal/portal.css.ts:737` (`.chq-portal-profile-dock {
  display: none; }`, top level) / same `:1041` phone-block hide of
  `.chq-portal-actions-footer` / `:1051` `.chq-portal-profile-dock { display:
  flex; flex: 1; }` (phone media block) — profile.tsx's own comment at its
  usage (`src/routes/portal/profile.tsx`, the div wrapping the inline Save
  button) states directly: "exactly one Save control visible at any width".
- `src/routes/portal/portal.css.ts:747`/`:1233` — the same pattern a third
  time for `.chq-portal-taskform-dock`/`.chq-portal-taskform-submit`
  (`src/routes/portal/tasks/views.tsx`).

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
are kept here as a record of what was adjudicated. Rows 1–21
(`app/src/pages/**`) remain unreceipted and are this ceiling's live
population (21, matching the lowered ceiling).

1. `app/src/pages/agenda/agenda.css` — `.chq-agenda-armed-bar` — `app/src/pages/Agenda.tsx`
2. `app/src/pages/comms/comms.css` — `.chq-comms-main-landing` — `app/src/pages/Comms.tsx`
3. `app/src/pages/contacts/contacts-panels.css` — `.chq-contacts-pipeline-columns` — `app/src/pages/contacts/PipelineBoard.tsx`
4. `app/src/pages/contacts/contacts-panels.css` — `.chq-contacts-import-columns` — `app/src/pages/contacts/ImportWizard.tsx`
5. `app/src/pages/contacts/contacts-panels.css` — `.chq-contacts-import:has([data-chq-phone-dock]) .chq-modal-actions` (target token `chq-modal-actions`) — `app/src/pages/agenda/PhoneAgenda.tsx`
6. `app/src/pages/contacts/contacts.css` — `.chq-contacts-rail` — `app/src/pages/contacts/DirectoryRail.tsx`
7. `app/src/pages/contacts/contacts.css` — `.chq-contacts-segment-summary` — `app/src/pages/contacts/ContactsApp.tsx`
8. `app/src/pages/contacts/contacts.css` — `.chq-contacts-filter-rules-row` — `app/src/pages/contacts/FilterRulesPanel.tsx`
9. `app/src/pages/content/content.css` — `.chq-content-files-download-all-wrap` — `app/src/pages/content/FilesLibrary.tsx`
10. `app/src/pages/content/content.css` — `.chq-content-worklist .chq-bulkbar` (target token `chq-bulkbar`) — `app/src/pages/comms/ComposeWizard.tsx`
11. `app/src/pages/content/content.css` — `.chq-content-comment-actions` — `app/src/pages/content/CommentThread.tsx`
12. `app/src/pages/forms/forms.css` — `.chq-forms-header-actions` — `app/src/pages/forms/FormsPage.tsx`
13. `app/src/pages/overview/overview.css` — `.chq-overview-clash-eyebrow-group > .chq-overview-row-title-sm, .chq-overview-clash-eyebrow-group > .chq-overview-row-meta` (target tokens `chq-overview-row-title-sm`, `chq-overview-row-meta`) — `app/src/pages/Overview.tsx`
14. `app/src/pages/settings/settings.css` — `.chq-settings-content` — `app/src/pages/Settings.tsx`
15. `app/src/pages/settings/settings.css` — `.chq-settings-section` — `app/src/pages/settings/PeopleRolesPanel.tsx`
16. `app/src/pages/settings/settings.css` — `.chq-settings-layout[data-drilled='true'] .chq-settings-rail` (target token `chq-settings-rail`) — `app/src/pages/Settings.tsx`
17. `app/src/pages/settings/settings.css` — `.chq-settings-saved-embed-body` — `app/src/pages/settings/SavedEmbedsPanel.tsx`
18. `app/src/pages/settings/settings.css` — `.chq-settings-public-pages-own-hidden` — `app/src/pages/settings/PublicPagesPanel.tsx`
19. `app/src/pages/speakers/speakers.css` — `.chq-speakers-grid-wrap` — `app/src/pages/speakers/OnboardingGrid.tsx`
20. `app/src/pages/speakers/speakers.css` — `.chq-speakers-head-actions` — `app/src/pages/speakers/OnboardingGrid.tsx`
21. `app/src/pages/speakers/task-view.css` — `.chq-taskview-answers .chq-taskview-head-row, .chq-taskview-waiting .chq-taskview-head-row` (target token `chq-taskview-head-row`) — `app/src/pages/speakers/TaskView.tsx`
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

Rows 1–21 (`app/src/pages/**`) were NOT receipted or repaired — out of
scope for task w49-d, which owned only the shell + SSR half (rows 22–31).
Adjudicating each of those 21 against its v12 frame (does the hidden
container's capability have a re-lined phone-width replacement, a verified
navigation dead-end, or is it a genuine unaddressed capability-removal
defect) is a future wave's work, one row (or a small owned batch) at a
time, per the same discipline `PHONE_HIDDEN_UNRECEIPTED_CEILING`'s own
closing-paragraph history already models.

Rows 22–31 were adjudicated this wave. All ten take disposition (a): each
hidden container's capability has a verified, re-lined phone-side
replacement, named above by class and handler (not by copy, per DEC-613/
DEC-967 drift-proof citation and the css-comment-copy-leak scan's
constraint on the two `src/routes/**/*.css.ts` rows). None required a CSS
declaration/selector/media-query change — desktop is frozen and stays
byte-identical; only `/* phone-hidden: */` comments were added, immediately
above each rule.
