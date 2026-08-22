# Settings 390 panel frame verdicts: Event and People and roles (w31-f)

Companion audit to `docs/design/audit/settings-v12.md` (the index) and its
`settings-v12/w10-frame-verdicts.md` submodule (the per-frame verdict
table, produced by `app/src/pages/Settings.frame-verdicts.render.test.tsx`).
That table already carries a one-line DIVERGES verdict for both frames
below; this file is the **per-literal** closure task w31-f was assigned —
the two frames tied for the worst unclaimed Settings coverage (4 of 7
drawn literals each, DEC-976 wave-31 "a citation count is not a coverage
measure"). Every literal below now has its own byte-for-byte
`verbatimLine` receipt and a render assertion, in
`app/src/pages/settings/SettingsPanels.frame390.render.test.tsx`.

## Frame `docs/design/Chautauqua Settings.dc.html:316-338` — "Settings · Event"

| # | Literal | Line | Verdict | Receipt |
|---|---|---|---|---|
| 1 | `‹ Settings` back link, 44px | :318 | MATCHES | shell (`Settings.tsx` `.chq-settings-back`) |
| 2 | `Event` H1, drill size | :319 | MATCHES | shell (`.chq-settings-drill-title`) |
| 3 | per-field label eyebrow (`{{ f.label }}`) | :325 | MATCHES (SHAPE) | `SummarySection.tsx` `.chq-settings-row-label` |
| 4 | per-field 46px value box (`{{ f.value }}`) | :326 | MATCHES (SHAPE) | `SummarySection.tsx` `.chq-settings-row-value` |
| 5 | optional per-field note (`{{ f.note }}`) | :328 | MATCHES (SHAPE) | `SummarySection.tsx` `.chq-settings-row-hint` (Slug row) |
| 6 | footer "Save", flex:1, filled, min-height:46px | :335 | MATCHES, read-drill only | `EventSettingsPanel.tsx` `readFooterPrimary` → `.chq-settings-drillrow-footer-primary` (DEC-919 wave-156) |
| 7 | footer "Cancel", bordered, min-height:46px | :336 | **DIVERGES (DEC-919 wave-156, adjudicated below)** | never renders in the READ drill |

**Row 7 — DIVERGES, adjudicated (DEC-919 wave-156):** the frame draws one
static screen with the READ view's field rows *and* what is, in the built
product, the shared EDIT-view footer band
(`.chq-settings-edit-footer`/`SettingsEditForm.tsx`, Save+Cancel, byte-
identical 46px/flex:1/bordered geometry). DEC-919 wave-156 already ruled
that a READ drill has no form to submit, so its own footer renders
Save-only (as a navigation into the edit drill, never a save-nothing) —
"Cancel has nothing to cancel here" (`Settings.frame-verdicts.render.test
.tsx`'s existing verdict). This file re-verifies that split rather than
re-litigating it: `SettingsPanels.frame390.render.test.tsx`'s "footer dock"
test asserts Save renders and Cancel does not in the READ drill, and its
companion test confirms the frame's Save+Cancel PAIR *does* both render
together — in the EDIT drill's `.chq-settings-edit-footer`, one screen
lower than this frame depicts. That companion test also notes a second,
independent, wording-only divergence: the edit-view primary's copy is "Save
changes" (`SettingsEditForm.tsx`'s shared `SettingsSaveButton`, landed for
a different reason — see that file's own header comment on the "Save" vs
"Save changes" ruling), not the frame's bare "Save" — a DEC-967 SHAPE
question, not a missing-capability one, and out of this task's scope to
change (`SettingsEditForm.tsx` is not in this task's MAY-FIX list).

## Frame `docs/design/Chautauqua Settings.dc.html:552-569` — "Settings · People and roles"

| # | Literal | Line | Verdict | Receipt |
|---|---|---|---|---|
| 1 | `‹ Settings` back link, 44px | :554 | MATCHES | shell (`Settings.tsx` `.chq-settings-back`) |
| 2 | `People and roles` H1 | :555 | MATCHES | shell (`.chq-settings-drill-title`) |
| 3 | per-person name (`{{ p.name }}`) | :561 | MATCHES (SHAPE) | `PeopleRolesPanel.tsx` rows → `.chq-settings-row-label` |
| 4 | ellipsised email (`{{ p.email }}`) | :562 | MATCHES (SHAPE, fallback label) | same row primitive; `OTHER` fixture has no name, label falls back to email |
| 5 | `{{ p.role }} · {{ p.scope }}` eyebrow | :563 | **DIVERGES (half, DEC-576 wave-31, adjudicated below)** | role renders (`.chq-settings-row-value`); scope half omitted |
| 6 | per-row bordered 44px "Change" | :565 | **DIVERGES (DEC-576 wave-31, adjudicated below)** | never renders on the read path |
| 7 | full-width filled 46px "Invite someone", below the list | :568 | MATCHES | `.chq-settings-drillrow-footer-primary`, after the last row (DEC-919 wave-156) |

**Rows 5 and 6 — DIVERGES, DEVIATIONS.md §6-blessed, never re-litigated
(DEC-576 wave-31 "the later ruling wins, and is never re-litigated"):**

> Per-person scope column and per-row Change on people-and-roles read view —
> users are org-scoped (09--02/--14).
> — `docs/design/DEVIATIONS.md` §6 ("Deferred post-deadline")

The build's per-person row is `{ label: personLabel(user), value:
roleLabel(user.role), hint?: <reviewer scope note> }`
(`PeopleRolesPanel.tsx`) — the role renders, the frame's `· {{ p.scope }}`
half never does, and no per-row "Change" control exists on the read drill
(its only "Change" is the section-head action, which drills into the edit
view where the real per-row role control lives). Both are named,
adjudicated deferrals; `SettingsPanels.frame390.render.test.tsx` verdicts
each with its own `it()` rather than building either.

**Row 7:** DEC-919 wave-156 hoisted "Invite someone" out of the edit-gated
children into `SummarySection`'s `readFooterPrimary` slot so it renders
unconditionally after the person list on the READ drill, opening the
existing invite dialog directly (no navigation into the edit drill first).
Verified by document-position (`compareDocumentPosition`) and by actually
clicking the control and asserting the dialog opens in place.

## Companion half: `settings.css` terminal `@media (max-width: 700px)` block

**HARD BAN — read-only.** `settings.css` is owned by an in-flight lane this
wave (DEC-385 wave-30 "a verdict lane may land its own fix only inside
files it exclusively owns this wave; on a stylesheet another in-flight lane
owns, it files a DIVERGES row instead"). This task only *reads* it (via
`readFileSync`, pinned by source text in `SettingsPanels.frame390.render
.test.tsx`'s last `describe` block) to confirm:

- there is exactly one terminal `@media (max-width: 700px) { … }` block,
  and it is the file's last construct (nothing but whitespace follows its
  closing brace);
- the phone-only `.chq-settings-row-label` eyebrow rule realizing frame
  literal #3 above (Event) is present byte-for-byte;
- the phone-only `.chq-settings-readout` 46px box rule (the general
  register the frame's boxed value cells draw from) is present byte-for-
  byte.

No edits landed against this file. Any further gap discovered in it is
this cluster's other in-flight lane's to resolve, not this task's.

## Files

- **Created:** `app/src/pages/settings/SettingsPanels.frame390.render.test.tsx`,
  this file.
- **Not touched:** `settings.css` (read-only per HARD BAN),
  `EventSettingsPanel.tsx`, `PeopleRolesPanel.tsx` (both already correctly
  implement DEC-919 wave-156's read/edit split; no fix was needed — the gap
  this task closed was in *coverage*, not in the product).
