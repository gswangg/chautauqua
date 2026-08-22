# Settings v12 DESKTOP (1600) edit-view + refusal-band per-frame render verdicts (w24-b, DEC-032/DEC-651)

Per-frame render VERDICTS for the remaining four Settings desktop frames —
the three edit views not yet verdicted by render, plus the save-refusal
STATE frame — entered through the app's real routes and asserted against
jsdom DOM structure (never a computed style — jsdom applies no stylesheet)
or, for one claim that is inherently a CSS fact, against the app's own
stylesheet TEXT. Receipts live in
`app/src/pages/Settings-panels.desktop-frame-verdicts.render.test.tsx`.
Modelled on `speakers-desktop-v12.md`'s two-file pair (DEC-930 wave-158
amendment).

STRICTLY MEASUREMENT ONLY (the mandate's desktop freeze): this document and
its test file render, verdict, and file divergences in prose — they move no
desktop byte and edit no component or stylesheet, even where a real
divergence is found below.

DEC-651 wave-24 amendment governs how the two non-plain-page frames are
entered: `:1021` (a nested edit view, not a Modal/Menu badge but reached the
same way a drilled screen is) is driven by firing the real "Edit" link from
the Saved-embeds screen; `:1215` (a page STATE) is driven by a real mockApi
PATCH rejection through `EventSettingsPanel`'s own save flow, never by
mounting a refusal band directly.

**DEC-032 wave-24 amendment (HARD CITATION CONSTRAINT):** `Chautauqua
Settings.dc.html` lines 1111–1214 are the DEVIATIONS §6 deviation-deferred
extent for **"Settings · editing your data"** — quoting DEC-032's own
ruling, `no schema column, no endpoint and no rubric back a retention
setting`, so that frame is DEFERRED and not verdicted here or anywhere in
this wave's lanes. Likewise `:1507`+ (Import from Sessionboard) is
DEFERRED. Every citation in this document and its companion test sits at or
after line 1215, never inside either deferred extent — so the absence of
`:1111` from this file's frame list is adjudicated, not silent.

## Frame :869 "Settings · editing the speaker portal"

**RESOLVED (wave 9, DEC-919 amendment).** Entered via `SettingsPage` at
`/settings?section=portal&edit=1`.

- The frame's boxed, static readout of the welcome text
  (`docs/design/Chautauqua Settings.dc.html:905`,
  `border:1px solid #BAB6A6; border-radius:4px; background:#FAF8F2;
  padding:13px; min-height:96px; font-size:15px; line-height:1.65;
  color:#3F4237`) now mounts above the editable field —
  `PortalSettingsPanel.tsx`'s `WelcomeNoteReadout` (already built for the
  read drill, DEC-919 wave-157 clause (a)) is reused with a
  `chq-settings-portal-welcome-readout-edit` modifier class
  (`settings-drill-rows.css`) that carries the frame's desktop box
  unconditionally, fed by the STORED `welcomeMessage`, never the
  in-progress `form.welcomeMessage`. `:906`'s persistent caption ("Takes
  the full measure · appears above the task list") now renders once, as a
  sibling paragraph directly below the readout, no longer doubled as the
  textarea's own field hint (DEC-613).
- **MATCHES**: "What speakers may edit" (the pill strip, closing consequence
  sentence) and "Resources · N" (frame :924) render in the edit form, in
  that order — the section headings and their content both land in the
  frame's own sequence.
- **MATCHES**: the edit form footer is Cancel then Save changes (frame
  :938), Cancel first in document order.

## Frame :950 "Settings · editing people and roles"

**Re-verdicted, correcting a stale prior finding — MATCHES on the specific
point this task's brief expected DIVERGES.** (DEC-099 wave-14m clause 1:
this paragraph narrates a finding already retired by this re-verdict.)
Entered via `SettingsPage` at `/settings?section=people&edit=1`.

- The task brief carried forward a known prior finding: "the edit footer
  draws a left-flush 'Change your own password' link that
  `PeopleRolesPanel.tsx` does not build." Rendered against the current
  tree, that is no longer true — `PeopleRolesPanel.tsx`'s own DEC-919
  wave-130 amendment comment records that the link was since built into
  `SettingsEditForm`'s existing `destructive` footer slot (not a new one),
  and the render receipt confirms it: a link reading "Change your own
  password" with `href="/account/password"` renders in the edit footer,
  matching `docs/design/Chautauqua Settings.dc.html:1007` verbatim. This
  wave's job is to re-verdict honestly rather than repeat a stale claim,
  per the campaign's own recurring lesson that a scribe or brief finding is
  a claim about the tree at a point in time, not a receipt of the tree
  today.
- **RESOLVED-BY-RULING (wave 9)**: the frame's edit footer also draws a
  Cancel/Save-changes pair (`:1009`-`:1010`, alongside the password link).
  The tree's edit footer instead carries a single "Close" primary and no
  Cancel, no Save changes — this form has no fields to submit, every role
  change and removal writes immediately from the row-level controls, so
  there is nothing for a Save action to commit and no unsaved state for a
  Cancel to discard. The single "Close" primary stands; this is not filed
  as buildable debt.
- **MATCHES**: a non-self row carries its own "Reset password" action
  (frame :998) and a "Remove" control (disabled, org-scoped accounts are
  never removable from here), and "Invite someone" heads the People
  section.

## Frame :1021 "Settings · editing one saved embed"

**DIVERGES** (two points). Reached at
`/settings?section=public-pages&view=embeds`, then drilled by firing the
real "Edit" link on the saved embed row (DEC-651 wave-24; DEC-728's own
nested-screen precedent for `:578`, its own phone-sibling entry).

- The frame's H1 is the embed's own name, verbatim — "AI track sessions"
  (`docs/design/Chautauqua Settings.dc.html:1047`). The tree instead heads
  the edit form "Editing · <name>" (a level-2 heading, not the frame's
  level-1 H1) — a labelling divergence, not a missing-control one; the
  embed's actual name still renders, just prefixed and demoted a heading
  level.
- The frame's footer draws three controls: a left-flush "Turn this embed
  off" link (`:1097`), then Cancel, then Save changes. The tree's
  `EmbedsPanel` edit view ships only a single Save-changes primary — no
  Cancel, no off-switch anywhere in the form. (`SavedEmbedsPanel.tsx`'s own
  comment above its row actions separately records a related, adjacent
  disagreement: DELETE is a real, reachable endpoint the frame never draws
  a control for at all — recorded there, not re-litigated here, since this
  file only verdicts the edit view itself.)
- **MATCHES**: the boxed Snippet readout (frame :1086, the "Snippet"
  eyebrow label heading the block at `:1082`-`:1093`) carries a "Copy
  snippet" action and a "Preview" link, both present and both wired to the
  same URL the panel builds.

**Re-verdicted (DEC-099 wave-14m clause 1) — both points above are stale;
current tree MATCHES.** The two findings above describe `SavedEmbedsPanel
.tsx`'s row list, not the real edit destination. Rendered against the
current tree, editing a saved embed lands on `EmbedsPanel.tsx`
(`editingId` set), whose edit head is `‹ Public pages` above `<h1>{name}
</h1>` — the embed's own name verbatim as a real H1, not "Editing ·
<name>" (`EmbedsPanel.tsx`'s own comment above that head names DEC-728 and
records "never 'Editing · <name>'"), and whose footer is the three-control
`.chq-settings-edit-footer` — a left-flush "Turn this embed off", then
Cancel, then Save changes, in that DOM order (`EmbedsPanel.tsx`'s comment
above the footer names DEC-728 and the frame's own `:1096-1101` line
range). Both points this section originally filed are built; nothing
remains open here.

## Frame :1215 "Settings · save rejected by the server"

**MATCHES verbatim on the refusal band itself; DIVERGES-by-wording
additively (structural contract MATCHING).** A STATE frame, reached by
driving a real save rejection — changing the Slug field and submitting
while the mocked `PATCH /api/v1/events/:id` returns a bare 409 conflict
with no fields map (DEC-651 wave-24; never by rendering a refusal band
component directly).

- **MATCHES verbatim**: the refusal band's title, "Nothing was saved"
  (`docs/design/Chautauqua Settings.dc.html:1243`), and its body sentence,
  "The public URL you chose is already taken by another event in this org.
  Everything else on this page is fine and is still here." (`:1244`), both
  render byte-for-byte inside a `.chq-settings-refusal-panel` — this is the
  DEC-124 amendment (wave 134) panel, built specifically to carry this
  frame's own wording, and the render receipt confirms it still does,
  exactly.
- **DIVERGES-by-wording, additively**: the tree renders a SECOND block
  alongside the refusal panel — the shared `ErrorSummary` component,
  carrying a count-driven heading ("One thing needs fixing before these
  settings can be saved") and its own kept-edits sentence, "Nothing was
  lost. Your edits are still below." Neither string is drawn anywhere in
  the frame; the frame draws exactly one refusal band, not two. The
  structural CONTRACT still matches the frame's evident intent — a
  page-level "nothing was saved" notice plus a field-level marker under the
  offending control (Slug) — but the tree expresses that contract with one
  more visible block than the frame draws, and with different prose on
  that second block. No component is restyled or the ErrorSummary
  suppressed to match; desktop is frozen and this wave measures only.
  **Adjudicated (DEC-124 wave-134 amendment):** the ruling that built
  `.chq-settings-refusal-panel` says so explicitly — the panel is "kept
  alongside — never instead of — the existing Slug `chq-field-error` and
  its `ErrorSummary` anchor: the panel names what was lost at the level of
  the whole save, the field error still marks the one control the server
  actually named." The second block is a deliberate, ruled keep, not
  unfiled debt.
- **MATCHES**: unsaved edits survive the refusal — no refetch, no reset;
  the Slug field still carries the value the organiser typed.

## Summary

| Frame | Verdict |
| --- | --- |
| :869 Settings · editing the speaker portal | RESOLVED (wave 9, DEC-919): welcome-note readout box built above the field, caption re-lined below it; footer/section order MATCHES |
| :950 Settings · editing people and roles | Re-verdicted MATCHES on the password link (was stale DIVERGES, DEC-099); Cancel/Save-changes footer shape RESOLVED-BY-RULING (wave 9) — no fields to submit, single Close primary stands |
| :1021 Settings · editing one saved embed | Re-verdicted MATCHES (was DIVERGES, DEC-099 — H1 and three-control footer both built via DEC-728, see re-verdict above) |
| :1215 Settings · save rejected by the server | MATCHES verbatim on the refusal band; DIVERGES additively RESOLVED-BY-RULING (DEC-124 wave-134 — extra ErrorSummary block kept deliberately, see above) |
| :1111 Settings · editing your data | DEFERRED — DEVIATIONS §6: `no schema column, no endpoint and no rubric back a retention setting` (DEC-032), un-citable this wave |

As of wave 9, two of the four verdicted frames closed: :869's welcome-note
readout was built (DEC-919 wave-9 amendment) and :950's Cancel/Save-changes
footer gap was RESOLVED-BY-RULING (the form has nothing to commit). :1021
and :1215 remained filed divergences as of wave 9, and one prior finding
(the People-and-roles password link) was corrected from stale DIVERGES to
MATCHES by wave 9's re-verdict. As of wave 14m (DEC-099 clause 1), both
:1021 and :1215 also closed on re-verdict: :1021's H1 and footer were
built via DEC-728 (`EmbedsPanel.tsx`, not the row-list file the original
finding read), and :1215's second block is RESOLVED-BY-RULING (DEC-124
wave-134 — the refusal panel is kept deliberately alongside
`ErrorSummary`, not a gap between them).

## Amendment (wave 24, DEC-896): field-grid container width closed

`docs/design/audit/desktop-field-width-v12.md`'s row 11 filed the :1021
frame's Name/Surface/Format/Track 2x2 field grid (drawn `max-width:620px`
at `:1057`) as UNRESOLVED — "an honest absence of a comparable fact" —
because that ledger's join has no container-grid tier (it grades field
CONTROLS, not the grid that lays them out). DEC-896's wave-24 amendment
rules this an actual divergence, not an absence: settings.css`.chq-settings-embed-field-pair {`
declared no max-width at any width, so
the grid spanned the full 820px settings measure against DESIGN-RULINGS
B10 ("Field width follows content, not the column"). The frame demands
the fix directly: `docs/design/Chautauqua Settings.dc.html`'s field-grid
style reads `padding:16px 0 0; display:grid; grid-template-columns:1fr 1fr; gap:16px; max-width:620px` (DEC-896), and `settings.css`'s
top-level `.chq-settings-embed-field-pair` rule now carries
`max-width: 620px;` to match it, pinned by a CSS-shape assertion in
`app/src/pages/settings/EmbedsPanel.render.test.tsx`. This closes row 11
of the field-width ledger **on the product side only** — the ledger file
itself (`test/desktop-field-width.scan.test.ts` and its audit doc) stays
untouched here (DEC-896): its label/extent grammar labels every drawn
`max-width:(\d+)px` occurrence inside a frame extent as one FIELD width,
so a container `<div>` that lays out two fields side by side is never
itself a labelled field and has no row shape in that join; its own
counts do not move.
