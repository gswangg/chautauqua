# SPA classless-control 390 population (DEC-180 wave-154 amendment)

Task v12m-w10-na. Every SPA tap-target ratchet in
`app/src/phone-tap-target-scan/` (the base scan, the row-action-anchor
lens, `anchor-floor.ts`) is keyed on class TOKENS taken from markup — an
`<a>`/`<Link>`/`<NavLink>`/`<button>`/`<select>`/`<textarea>`/`<input>`
declaring no `className=` at all contributes no token and is ungradeable
by construction. The SSR half of the product already learned this
(`app/src/phone-tap-target-ssr-classless-anchor.scan.test.ts`, wave
v12m-w17 task w17-c) and drained its own population to zero, but no SPA
mirror was ever built — the lane assigned to build it, `v12m-w9-kf`, is
`git rev-list --count main..v12m-w9-kf` = 0 (committed nothing).

## Population

Every `app/src/**/*.tsx` tag (excluding `*.test.*`) in
`{a, Link, NavLink, button, select, textarea, input}` declaring no
`className=`, keyed on its nearest enclosing element's chq- token via a
depth-only tag-stack walk **scoped per file** — the same grammar
`ssr.ts`'s `classlessAnchorSites` already uses for the SSR half, moved
into `core.ts`'s `classlessTagSites` and shared (not forked, DEC-613) by
both `ssr.ts` and the new `spa-classless.ts`.

Measured on this branch (`app/src/phone-tap-target-spa-classless-control
.scan.test.ts`'s tripwire test): **15 raw sites** across 11 files before
any drain in this lane, comment-stripped first (DEC-374).

## Predicate

Same three-clause floor `anchor-floor.ts`'s row-action-anchor lens and
`ssr.ts`'s classless-anchor lens both use: `min-height >= 44px` AND
literal `display: flex` (+ `align-items: center`) AND non-zero horizontal
padding, all inside some `@media (max-width: <=700px)` block, on a
selector reaching the site through its enclosing chq- token (the bare
element itself, or a descendant combinator off `.<token>`).

## Ceiling

`SPA_CLASSLESS_CONTROL_CEILING` in `app/src/phone-tap-target-scan/ceilings
.ts`, two-sided from the start (seeded by forcing the constant to `-1` and
reading the printed offender list on this branch, DEC-808 clause a) —
never a number copied from the task text.

## Offender ledger

| # | Site | Enclosing token | Disposition |
|---|------|------|-------------|
| 1 | `pages/Agenda.tsx:352` `<Link>` | `chq-agenda-held-back` (also `chq-attention-frame`) | **Floored** — `agenda.css` terminal `@media (max-width:700px)`, `.chq-agenda-held-back a` |
| 2 | `pages/NotFound.tsx:54` `<Link>` | `chq-notfound-links` | **Floored** — new terminal `@media (max-width:700px)` block added to `not-found.css` (none existed before), `.chq-notfound-links a` |
| 3 | `pages/NotFound.tsx:55` `<Link>` | `chq-notfound-links` | **Floored** — same rule as #2 |
| 4 | `pages/settings/EventSettingsPanel.tsx:353` `<Link>` | `chq-event-unscheduled-notice` | **Floored** — `settings.css` terminal block, `.chq-event-unscheduled-notice a` |
| 5 | `pages/settings/PortalSettingsPanel.tsx:245` `<a>` | *(no enclosing chq- token — ungradeable by construction)* | **Floored** — given its own `className="chq-settings-portal-preview-link"` directly on the tag (the only way to make a token-with-no-ancestor site gradeable at all), then floored in `settings.css`'s terminal block |
| 6 | `pages/speakers/RosterPanel.tsx:352` `<Link>` | `chq-speakers-roster-duplicate-hint` | **Floored** — `speakers.css` terminal block, `.chq-speakers-roster-duplicate-hint a` |
| 7 | `pages/speakers/SpeakerDetailPage.tsx:510` `<a>` | `chq-speaker-detail-portal-bio-links` | **Floored** — `speakers.css` terminal block, `.chq-speaker-detail-portal-bio-links a` |
| 8 | `pages/speakers/SpeakerDetailPage.tsx:571` `<Link>` | `chq-speaker-detail-sessions-row` | **Floored** — `speakers.css` terminal block, `.chq-speaker-detail-sessions-row a` |
| 9 | `pages/contacts/ContactDrawer.tsx:756` `<Link>` (delete-confirm body) | `chq-contacts-record-label` (nearest still-open ancestor per the walk) | **Floored** — `contacts.css` terminal block, `.chq-contacts-record-label a` |
| 10 | `pages/submissions/SubmissionDetailPage.tsx:1232` `<Link>` (scheduled placement) | `chq-detail-placement` | **Floored** — `detail.css` terminal block, `.chq-detail-placement a` |
| 11 | `pages/submissions/SubmissionDetailPage.tsx:1350` `<a>` (answer file download) | `chq-answer-row` | **Floored** — `detail.css` terminal block, `.chq-answer-row a` |
| 12 | `pages/contacts/AddToEventModal.tsx:216` `<Link>` | `chq-add-to-event-result` | **Shell finding, left in the ceiling** — token declared in `app/src/styles.css`; task's HARD SCOPE forbids editing the shell sheet from a page lane |
| 13 | `pages/contacts/BulkEmailModal.tsx:435` `<Link>` | `chq-bulk-email-result` | **Shell finding, left in the ceiling** — same reason, `app/src/styles.css` |
| 14 | `pages/contacts/DuplicateEmailNotice.tsx:87` `<Link>` | `chq-contacts-duplicate-email-notice` | **Shell finding, left in the ceiling** — same reason, `app/src/styles.css` |
| 15 | `pages/contacts/NewContactModal.tsx:205` `<Link>` | `chq-contacts-new-contact-duplicate-hint` | **Shell finding, left in the ceiling** — same reason, `app/src/styles.css` |

11 of 15 drained this lane. The 4 remaining are the shell-owned rows the
task explicitly carves out ("A shell-owned token stays in the ceiling and
gets a finding row in the audit doc instead") — every one keys on a token
declared in `app/src/styles.css`, which this task's HARD SCOPE forbids
editing. `SPA_CLASSLESS_CONTROL_CEILING = 4` reflects exactly this
remainder; a future shell-owned lane can drain rows 12-15 by adding an
element-qualified `.chq-add-to-event-result a` / `.chq-bulk-email-result
a` / `.chq-contacts-duplicate-email-notice a` /
`.chq-contacts-new-contact-duplicate-hint a` rule to `styles.css`'s
terminal `@media (max-width: 700px)` block (or a `tap-floor-exempt`
comment, if a design review finds these are decoration rather than a real
tap target) and re-measuring by forcing the ceiling to `-1`.

## Notes

- `PortalSettingsPanel.tsx:245`'s anchor is the one truly ungradeable site
  in the raw 15 — no ancestor in the file carries any `chq-` token at all
  (`(no enclosing chq- token)`), so no CSS selector could ever reach it.
  It was given its own class directly on the tag rather than left
  reported forever; this both makes it gradeable and floors it in one
  step, and drops the *raw population* itself from 15 to 14 (it is no
  longer a classless site once it carries a class).
- `v12m-w9-kg` is noted in-flight (committed-unmerged, floors five
  settings-cluster anchors) — this lane's population was measured on
  `main` only, per the task's instruction not to anticipate it; the merge
  train re-measures the integrated tree.
