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
| 1 | app/src/pages/Agenda.tsx`<p>Held back — content not approved:</p>` `<Link>` | `chq-agenda-held-back` (also `chq-attention-frame`) | **Floored** — `agenda.css` terminal `@media (max-width:700px)`, `.chq-agenda-held-back a` |
| 2 | app/src/pages/NotFound.tsx`<Link to="/overview">Overview &rsaquo;</Link>` | `chq-notfound-links` | **Floored** — new terminal `@media (max-width:700px)` block added to `not-found.css` (none existed before), `.chq-notfound-links a` |
| 3 | app/src/pages/NotFound.tsx`<Link to="/submissions">Submissions &rsaquo;</Link>` | `chq-notfound-links` | **Floored** — same rule as #2 |
| 4 | app/src/pages/settings/EventSettingsPanel.tsx`<Link to="/agenda">View agenda</Link>` | `chq-event-unscheduled-notice` | **Floored** — `settings.css` terminal block, `.chq-event-unscheduled-notice a` |
| 5 | app/src/pages/settings/PortalSettingsPanel.tsx`className="chq-settings-portal-preview-link"` | *(no enclosing chq- token — ungradeable by construction)* | **Floored** — given its own `className="chq-settings-portal-preview-link"` directly on the tag (the only way to make a token-with-no-ancestor site gradeable at all), then floored in `settings.css`'s terminal block |
| 6 | app/src/pages/speakers/RosterPanel.tsx`<p className="chq-speakers-roster-duplicate-hint" role="status">` | `chq-speakers-roster-duplicate-hint` | **Floored** — `speakers.css` terminal block, `.chq-speakers-roster-duplicate-hint a` |
| 7 | app/src/pages/speakers/SpeakerDetailPage.tsx`<p className="chq-speaker-detail-portal-bio-links">` | `chq-speaker-detail-portal-bio-links` | **Floored** — `speakers.css` terminal block, `.chq-speaker-detail-portal-bio-links a` |
| 8 | app/src/pages/speakers/SpeakerDetailPage.tsx`<div className="chq-speaker-detail-sessions-row" role="row"` | `chq-speaker-detail-sessions-row` | **Floored** — `speakers.css` terminal block, `.chq-speaker-detail-sessions-row a` |
| 9 | app/src/pages/contacts/ContactDrawer.tsx`<Link to="/contacts?tab=duplicates">Go to the Duplicates tab</Link>` (delete-confirm body) | `chq-contacts-record-label` (nearest still-open ancestor per the walk) | **Floored** — `contacts.css` terminal block, `.chq-contacts-record-label a` |
| 10 | app/src/pages/submissions/SubmissionDetailPage.tsx`<Link to="/agenda">{formatSubmissionScheduleLine(detail.slot)}</Link>` (scheduled placement) | `chq-detail-placement` | **Floored** — `detail.css` terminal block, `.chq-detail-placement a` |
| 11 | app/src/pages/submissions/SubmissionDetailPage.tsx`<a href={row.file.href}>{row.file.filename}</a>` (answer file download) | `chq-answer-row` | **Floored** — `detail.css` terminal block, `.chq-answer-row a` |
| 12 | app/src/pages/contacts/AddToEventModal.tsx`>View in Speakers</Link>` | `chq-add-to-event-result` | **Floored** — `app/src/styles.css` terminal `@media (max-width:700px)` block, `.chq-add-to-event-result a` (wave-156, task qa-shell-classless-floor) |
| 13 | app/src/pages/contacts/BulkEmailModal.tsx`<Link to="/comms?tab=history">View in Comms history</Link>` | `chq-bulk-email-result` | **Floored** — same block, `.chq-bulk-email-result a` (wave-156, task qa-shell-classless-floor) |
| 14 | app/src/pages/contacts/DuplicateEmailNotice.tsx`>Open this contact</Link>` | `chq-contacts-duplicate-email-notice` | **Floored** — same block, `.chq-contacts-duplicate-email-notice a` (wave-156, task qa-shell-classless-floor) |
| 15 | app/src/pages/contacts/NewContactModal.tsx`<p className="chq-contacts-new-contact-duplicate-hint" role="status">` | `chq-contacts-new-contact-duplicate-hint` | **Floored** — same block, `.chq-contacts-new-contact-duplicate-hint a` (wave-156, task qa-shell-classless-floor) |

All 15 drained. Rows 1-11 by task `v12m-w10-na`; rows 12-15 were left as
shell findings by that task ("A shell-owned token stays in the ceiling
and gets a finding row in the audit doc instead" — every one keys on a
token declared in `app/src/styles.css`, which `v12m-w10-na`'s HARD SCOPE
forbade editing from a page lane) and were drained by the shell lane
`v12m-w12-qa` (task qa-shell-classless-floor, DEC-180 wave-156 amendment)
in the same commit that lowered the ceiling: an element-qualified
`.chq-add-to-event-result a` / `.chq-bulk-email-result a` /
`.chq-contacts-duplicate-email-notice a` /
`.chq-contacts-new-contact-duplicate-hint a` rule (each with `min-height:
44px`, literal `display: flex`, `align-items: center`, non-zero
horizontal padding) was appended to `styles.css`'s terminal `@media
(max-width: 700px)` block. Re-measured by forcing the ceiling to `-1`:
0 live offenders. `SPA_CLASSLESS_CONTROL_CEILING = 0`.

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

## SSR classless NON-ANCHOR control population (task v12m-w40-e, DEC-393)

Explicitly disjoint from everything above (the SPA population, `app/src/**`)
and from `SSR_CLASSLESS_ANCHOR_CEILING` (`app/src/phone-tap-target-ssr-
classless-anchor.scan.test.ts`, owned by v12m-w39-e, which grades the SAME
`src/routes/**` surface's classless `<a>` sites). Neither of those two
ratchets ever looked at a classless `<input>`/`<select>`/`<textarea>`/
`<button>` under `src/routes/**` — an EMPTY population, not a
zero-offender one (DEC-808).

### Population

Every `src/routes/public/**/*.tsx` and `src/routes/portal/**/*.tsx` tag
(excluding `*.test.*`) in `{input, select, textarea, button}` declaring no
`class=`/`className=`, excluding `<input type="hidden">` (inert, no hit
box), keyed on its nearest enclosing element's `chq-` token via the same
depth-only tag-stack walk (`core.ts`'s `classlessTagSites`) the SPA and
SSR-anchor populations above already share.

The wave-35-h roster in this same audit doc's sibling,
`public-390-request-verdicts-v12.md`, named seven such rows by
`path:line`; four of the seven line numbers had drifted onto unrelated
lines by the time this task ran. Re-derived at HEAD instead of trusted:
**7 raw sites**, unchanged in count from the wave-35-h roster, spread
across 3 files:

| # | Site | Tag | Enclosing token(s) | Disposition |
|---|------|-----|---------------------|-------------|
| 1 | `src/routes/portal/edit.tsx` — Tracks fieldset checkbox (`name="trackIds"`) | `<input>` | `chq-cfp-option` | **Exempt (composition)** — already carried by portal.css.ts line 572's pre-existing exempt-composition receipt (the wrapping `<label class="chq-cfp-option">` is the floored click/tap surface) |
| 2 | `src/routes/portal/edit.tsx` — co-presenter Role `<select id="cp-role">` | `<select>` | `chq-field`, `chq-portal-copresenter-role` | **Floored** — `portal.css.ts` terminal `@media (max-width:700px)` block, new `.chq-portal-copresenter-role select` rule (`display:flex; align-items:center; padding:0 12px`), additive beside the pre-existing `min-height:48px` rule on the same selector |
| 3 | `src/routes/portal/tasks/views.tsx` — task-upload `<input type="file">` | `<input>` | `chq-portal-actions` | **Floored** — `portal.css.ts` terminal block, new `.chq-portal-actions input[type=file], .chq-card input[type=file]` rule (`display:flex; align-items:center; min-height:44px; padding:0 12px`) |
| 4 | `src/routes/portal/tasks/views.tsx` — reupload `<input type="file">` (completed file_request) | `<input>` | `chq-card` | **Floored** — same rule as #3 |
| 5 | `src/routes/public/submit-views.tsx` — `TrackChoices` radio (`name="trackIds"`) | `<input>` | `chq-cfp-option` | **Exempt (composition)** — cfp.css.ts line 147's new exempt-composition receipt, mirroring portal.css.ts line 572's identical shape for the SAME shared class |
| 6 | `src/routes/public/submit-views.tsx` — `FormatChoices` radio (session-format) | `<input>` | `chq-cfp-option` | **Exempt (composition)** — same receipt as #5 (same class) |
| 7 | `src/routes/public/submit-views.tsx` — `AudienceChoices` radio (audience-level pill) | `<input>` | `chq-cfp-option`, `chq-cfp-pill` | **Exempt (composition)** — same receipt as #5 (first token `chq-cfp-option` resolves the exemption) |

### Predicate

Same three-clause floor every other population in this directory uses:
`min-height >= 44px` AND literal `display: flex` (+ `align-items: center`)
AND non-zero horizontal padding, all inside some
`@media (max-width: <=700px)` block, on a selector reaching the site
through its enclosing chq- token — reached via a parent-scoped selector
(`.chq-portal-actions input[type=file]`, `.chq-portal-copresenter-role
select`), never by inventing a new class on the element itself.

### Ceiling

`SSR_CLASSLESS_CONTROL_CEILING` in the dedicated
`app/src/phone-tap-target-scan/ssr-classless-control-ceiling.ts` module
(deliberately NOT `ceilings.ts`, which `SSR_CLASSLESS_ANCHOR_CEILING` and
`v12m-w39-e` occupy) — two-sided from the start, seeded by forcing the
constant to `-1` and reading the printed offender list on this branch.
Re-measured after the three fixes and one new exemption above: **0**.

### Companion side-effect

The new `.chq-cfp-option` composition receipt in `cfp.css.ts` added one
row to `test/tap-floor-exempt-premise.scan.test.ts`'s UNVERIFIABLE-PREMISE
population (it names no distinct companion class, mirroring its
portal.css.ts line 572 twin, so the instrument correctly cannot settle it
either way) — `TAP_FLOOR_EXEMPT_UNVERIFIABLE_PREMISE_CEILING` moved
77 -> 78 in the same commit, re-measured on this branch.
