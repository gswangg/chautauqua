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

## Worked example (the task's own motivating case — OWNED, not repaired here)

`src/routes/portal/portal.css.ts:1031`'s `.chq-portal-actions-footer {
display: none; }` is a bare container class, not itself interactive. Its
markup mount, `src/routes/portal/edit.tsx`, renders the profile form's
inline Save submit button as a descendant. This is the confirmed root of
wave-38's desktop double-Save defect. Both `src/routes/portal/portal.css.ts`
and `src/routes/portal/profile.tsx` are held by in-flight `v12m-w38-a` /
`v12m-w38-f`, which are landing the double-Save repair — this task's brief
explicitly forbids touching either file. Recorded here as OWNED.

## Population (measured at authoring time, 2026-08-22)

Each row: stylesheet — selector — markup file where the interactive
descendant was found. None of these carry a `/* phone-hidden: */` receipt.
No CSS was edited to produce this roster; adjudication (receipt vs. repair)
is left to a future wave per row, except the OWNED row above.

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
22. `app/src/styles.css` — `.chq-shell:has([data-chq-phone-head]) .chq-header` (target token `chq-header`) — `src/routes/docs.tsx`
23. `app/src/styles.css` — `.chq-nav` — `src/routes/public/shell.tsx`
24. `app/src/styles.css` — `.chq-header-identity .chq-user-identity` (target token `chq-user-identity`) — `app/src/App.tsx`
25. `app/src/styles.css` — `.chq-main:has([data-chq-phone-dock]) ~ .chq-tabbar` (target token `chq-tabbar`) — `app/src/App.tsx`
26. `app/src/styles.css` — `.chq-shell:has(.chq-phone-dock) .chq-tabbar` (target token `chq-tabbar`) — `app/src/App.tsx`
27. `app/src/styles.css` — `body:has(.chq-scrim [data-chq-phone-dock]) .chq-tabbar` (target token `chq-tabbar`) — `app/src/App.tsx`
28. `src/routes/docs-site.css.ts` — `.chq-docs-nav` — `src/routes/docs-site.tsx`
29. **`src/routes/portal/portal.css.ts` — `.chq-portal-actions-footer` — `src/routes/portal/edit.tsx` — OWNED by in-flight `v12m-w38-a`/`v12m-w38-f`, not repaired here (see worked example above).**
30. `src/routes/portal/portal.css.ts` — `.chq-portal-shell > .chq-portal-footer .chq-portal-signout` (target token `chq-portal-signout`) — `src/routes/portal/shared.tsx`
31. `src/routes/portal/portal.css.ts` — `.chq-portal-taskform-submit` — `src/routes/portal/tasks/views.tsx`

Rows 30 and 31 sit in `src/routes/portal/portal.css.ts` alongside the OWNED
row 29 but name different selectors/elements than the ones `v12m-w38-a`/
`v12m-w38-f` are landing a repair for (`.chq-portal-actions-footer`
specifically); this task's brief forbids touching that file at all, so
these two are recorded unadjudicated rather than distinguished further.

## Disposition

None of the 31 rows above were receipted or repaired by this task — the
task's own scope is "widen the population, declare the ceiling, write the
roster"; adjudicating each row against its v12 frame (does the hidden
container's capability have a re-lined phone-width replacement, a verified
navigation dead-end, or is it a genuine unaddressed capability-removal
defect) is a future wave's work, one row (or a small owned batch) at a
time, per the same discipline `PHONE_HIDDEN_UNRECEIPTED_CEILING`'s own
closing-paragraph history already models.
