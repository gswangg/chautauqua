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

**DIVERGES.** Entered via `SettingsPage` at `/settings?section=portal&edit=1`.

- The frame draws a boxed, static readout of the welcome text
  (`docs/design/Chautauqua Settings.dc.html:905`,
  `border:1px solid #BAB6A6; ... min-height:96px ...`) sitting ABOVE the
  actual editable field, with a persistent hint below it (`:906`, "Takes
  the full measure · appears above the task list"). The tree ships a plain
  `.chq-textarea` in that field's place, with no separate readout box —
  `PortalSettingsPanel.tsx`'s own STILL-OPEN comment (near line 133)
  already records this exact gap as a desktop item no wave has spent yet.
  This verdict confirms the gap still stands: no element carrying a
  readout class exists anywhere in the edit form, and the hint text
  survives, reused as the textarea's own field hint.
- **MATCHES**: "What speakers may edit" (the pill strip, closing consequence
  sentence) and "Resources · N" (frame :924) render in the edit form, in
  that order — the section headings and their content both land in the
  frame's own sequence.
- **MATCHES**: the edit form footer is Cancel then Save changes (frame
  :938), Cancel first in document order.

## Frame :950 "Settings · editing people and roles"

**Re-verdicted, correcting a stale prior finding — MATCHES on the specific
point this task's brief expected DIVERGES.** Entered via `SettingsPage` at
`/settings?section=people&edit=1`.

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
- **DIVERGES** (a different, real gap the re-verdict surfaces): the frame's
  edit footer also draws a Cancel/Save-changes pair (`:1009`-`:1010`,
  alongside the password link). The tree's edit footer instead carries a
  single "Close" primary and no Cancel, no Save changes — this form has no
  fields to submit (every role change and removal writes immediately, per
  the row-level controls), so there is nothing for a Save action to commit.
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
- **MATCHES**: unsaved edits survive the refusal — no refetch, no reset;
  the Slug field still carries the value the organiser typed.

## Summary

| Frame | Verdict |
| --- | --- |
| :869 Settings · editing the speaker portal | DIVERGES (welcome-note readout box not built; footer/section order MATCHES) |
| :950 Settings · editing people and roles | Re-verdicted MATCHES on the password link (was stale DIVERGES); DIVERGES on Cancel/Save-changes footer shape |
| :1021 Settings · editing one saved embed | DIVERGES (H1 wording; footer missing Cancel/Turn-off) |
| :1215 Settings · save rejected by the server | MATCHES verbatim on the refusal band; DIVERGES additively (extra ErrorSummary block, different wording) |
| :1111 Settings · editing your data | DEFERRED — DEVIATIONS §6: `no schema column, no endpoint and no rubric back a retention setting` (DEC-032), un-citable this wave |

None of the four verdicted frames is a clean, unqualified MATCH — each
carries at least one real, filed divergence — and one prior finding (the
People-and-roles password link) is corrected from stale DIVERGES to
MATCHES by this wave's re-verdict. No desktop byte was moved and no
component or stylesheet was edited to produce any of the above.
