# Settings · Call for papers · 390 — frame verdict (w30-f)

Task w30-f (DEC-976, DEC-385): SETTINGS · CALL FOR PAPERS · 390 — frame
verdict for the CFP settings drill at phone width.

**Frame**: docs/design/Chautauqua Settings.dc.html:441 ("Settings · Call
for papers" title span; the task's stated anchor line 444 is the frame's
390-badge span two lines above the title, the drill container itself opens
at :444; corrected citations in the new test use the exact verbatim lines
the design file carries — :441 title span, :453 Copy link pill, :457/:458
Closes readout + relative chip, :463 the `sc-for` custom-questions loop).

## Verdict: already built, this lane is a receipt only

`CallForPapersPanel.tsx` already implements every piece of drill anatomy
this frame draws at phone width:

- `‹ Settings` back control (`Settings.tsx`'s `chq-settings-back` button)
  and the `Call for papers` drill title (`chq-settings-drill-title` h1,
  driven by `SECTIONS`' `label`).
- Public link readout (`chq-settings-readout`, the submit URL) + the
  full-width 44px `Copy link` pill (`chq-link-button chq-settings-cfp-copy-btn`,
  frame :453).
- Closes readout (`chq-settings-readout`, absolute datetime via
  `formatDateTimeInZone(dayLabelEndInstant(...))`, frame :457) with the
  relative countdown chip (`chq-settings-row-note`, `` `IN ${countOf(daysLeft,
  'day')}`.toUpperCase() ``, frame :458) rendered inside the SAME
  `chq-settings-drill-field-row` as the Closes label/readout — beside the
  row, not as a sibling row of its own, exactly as :383's code comment
  claims.
- `Questions · N` cap (`QuestionsSection`, `chq-settings-section-label`)
  and one 14px list row per non-locked custom question
  (`chq-settings-questions-row`) with its `{{ kind }} · {{ required }}`
  meta line and a boxed `Edit` control (`chq-settings-inline-action`,
  frame :453/:2129-2130 register) linking to the form builder with the
  field's id.
- 44px floor: every interactive element the frame draws in this drill
  (`Copy link`, each question row's `Edit`) is hooked to a class the phone
  `@media` rules in `settings.css` already give `min-height:44px` +
  centred flex + horizontal padding (`.chq-settings-cfp-copy-btn`,
  `.chq-settings-questions-row .chq-settings-inline-action`,
  `.chq-link-button.chq-settings-inline-action`).

No markup gap was found — the frame's copy for this drill was already
built (per prior waves' DEC-781/DEC-919/DEC-731 work). `CallForPapersPanel.tsx`
was NOT touched by this lane; no CSS file was touched (out of scope per this
lane's hard file ban on `settings.css`, `PublicPagesPanel.tsx`,
`SavedEmbedsPanel.tsx`).

## New receipt

`app/src/pages/settings/CallForPapersPanel.frame390.render.test.tsx` mounts
the real `CallForPapersPanel` through `SettingsPage`'s actual
`?section=cfp` route (mirroring
`PortalSettingsPanel.welcome-390.render.test.tsx`'s harness shape) and
grades:

1. `‹ Settings` back control + `Call for papers` drill title.
2. Public link readout (graded by shape — a `/submit/<slug>` URL, never a
   hardcoded literal) + the `Copy link` pill's class hook.
3. Closes readout (graded by shape — `\d+ \w{3} \d{4}, \d{2}:\d{2}` with
   the `, ` separator) and the `IN N DAYS` relative chip, asserting BOTH
   render AND that the chip lives inside the same
   `.chq-settings-drill-field-row` as the Closes label (not a new row).
4. `Questions · 2` cap (for the mock's two non-locked fields) and one
   `listitem` per question, each asserted by shape (`{{ type }} · {{ req
   }}` meta, an `Edit` link control) — never by the mock's seeded label
   text.
5. The 44px-floor class hooks on `Copy link` and every `Edit` control.

## No DIVERGES rows filed

No selector this lane would have needed to touch under the CSS hard-ban
was found missing or misapplied — the existing `settings.css` phone rules
already give this drill's controls their 44px floor and the frame's
box/chip placement. Nothing to hand off.
