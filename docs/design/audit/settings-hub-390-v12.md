# Settings hub · 390 real-mount verdict (task w32-b, DEC-032/DEC-976/DEC-967/DEC-989/DEC-874/DEC-180)

`docs/design/Chautauqua Settings.dc.html:275-312` ("Settings" 390 landing)
was the pack's last unclaimed zero-instrument phone frame: its only prior
citers, `app/src/pages/settings/settings-phone-frames.test.ts` and
app/src/pages/settings/settings-phone-390.frames.test.ts`SETTINGS_TSX`, both assert
against that read as file TEXT — a source scan, not a conformance
receipt (DEC-976/DEC-967). This is that frame's first real-mount verdict.

**Receipt**: `app/src/pages/settings/Settings.hub390.render.test.tsx`,
mounting the real `SettingsPage` through `MemoryRouter` + `mockApi`, copying
the harness from `app/src/pages/Settings.frame-verdicts.render.test.tsx`
(never a sub-panel, never a second mock stack). MEASUREMENT ONLY —
`Settings.tsx` and `settings.css` are untouched by this lane. Every literal
the frame's extent (:275-312) draws is enumerated below (DEC-180: no
hand-listing) and verdicted.

## Verdict table

| Frame line | Drawn literal / element | Verdict | Notes |
|---|---|---|---|
| :278 | `chautauqua` wordmark span | **VERDICTED AT THE SHELL** | Owned by the app shell, `App.tsx`'s `Header()` (`chq-header` > `chq-wordmark`), not `SettingsPage` — a real mount of `SettingsPage` alone mints neither class. Per `src/decisions-data/DEC-576.md`'s `## Amendment (wave 22)`, this band is verdicted ONCE at the shell rather than per page; see docs/design/audit/shell-header-390-v12.md`Verdict table` (DIVERGES-fixed: the wordmark's phone-width 20px/-2.5px pair was missing and is now landed). |
| :279 | right-flushed event-name span (`DevFlow 2027` sample) | **VERDICTED AT THE SHELL** | Same shell ownership as :278 — `App.tsx`'s `Header()` renders `<EventSwitcher />` in the identity slot, not a bare span. Verdicted at the shell per the same DEC-576 amendment; see docs/design/audit/shell-header-390-v12.md`the divergence` (DIVERGES-blessed: the control substitutes for the frame's plain span, a substitution DEC-576's own base ruling already blessed at every width, not a new call made here). |
| :281 | H1 `Settings` at the 27px cluster-landing register | **MATCHES** | Real mount: `getByRole('heading', {name:'Settings', level:1})` carries class `chq-page-title` only — never `chq-settings-drill-title` (the 26px drill twin), and the page wrapper carries `data-drilled="false"`. settings.css's phone layer (CSS companion, below) confirms no `.chq-page-title` rule outside `[data-drilled='true']` sets 26px, so the un-drilled H1 falls through to `styles.css`'s shared `--chq-type-page-title-phone-size: 27px` — the cluster-landing register, not the drill register. |
| :285-293 | one row per `mobileGroups` entry: 16px/600 label, `Open` (13px/700, brand-olive), 13px muted detail line | **MATCHES** | `SettingsPage`'s `SECTIONS` array is `mobileGroups`. Row count in the real mount equals `SECTIONS.length` (7, derived from the population, never a hand-listed number — DEC-180). Every row carries its section's `label`/`detail` text (graded by SHAPE per DEC-967, not pinned) on classes `chq-settings-rail-link-label`/`-detail`, and an `Open` span (`chq-settings-rail-link-open`) sharing the label's baseline row wrapper (`chq-settings-rail-link-row`), distinct from the detail line beneath it — same order the frame draws. |
| :295 | closing sentence `Embed codes are easier to copy on a laptop` | **MATCHES** | Real mount: renders as a `<p className="chq-settings-rail-note">`, plain text — no `role`, no `disabled`/`aria-disabled` attribute, not nested in a `button`/`a`/`[role=button]`. Confirms the DEC-032 ruling directly (the disabled token's two legal uses — inert control, drag handle — apply to neither this nor any other reading of the sentence). |
| :299-306 | footer tab-bar strip (`{{ tabs }}`) | **MATCHES** | This is the SHELL tab bar drawn inside the device box (`App.tsx`), not a page-level dock — settings.css's own drilled-register comment states this directly ("The footer is the shell tab bar (App.tsx), not a page-level dock — nothing to build here."). Real mount confirms the negative: `SettingsPage`'s own render tree mints zero `[data-chq-phone-dock]` elements at the landing (DEC-989 wave-85: a page dock stacked here would double the footer band). |
| CSS companion | settings.css terminal `@media (max-width: 700px)` block | **MATCHES** | Brace-matched via the sibling scan's own `phoneLayer()`/`rule()` helpers (reused, not re-derived, from `settings-phone-frames.test.ts`). `[data-drilled='true'] .chq-page-title` is the only rule in the phone layer setting `.chq-page-title`'s `font-size` to 26px; no unscoped `.chq-page-title` rule in the phone layer sets 26px. The phone-only landing furniture (`chq-settings-rail-link-open`/`-detail`, `chq-settings-rail-note`) carries an explicit desktop `display:none` outside the media block (DEC-385 narrow-overrides-wide). |

## Summary

Five of seven drawn regions **MATCH** from this lane's own `SettingsPage`
real mount. Two (:278 wordmark, :279 event name) are owned by the app
shell (`App.tsx`'s `Header()`), outside `SettingsPage`'s own render tree —
not a product defect, a scope boundary of "mount the page, not the shell."
Task w22-e (`src/decisions-data/DEC-576.md`'s `## Amendment (wave 22)`)
closed that gap with the shell-level receipt this doc's table now cites
for both rows, so no row in this document is left recording an unowned
scope hole (DEC-976: a receipt the render harness cannot actually give is
never silently marked MATCHES; it is now cited to the receipt that CAN
give it).

No DIVERGES rows (DEC-099 wave-14m clause 1: this sentence records the
absence of a divergence): every literal this lane could instrument through
a real mount of `SettingsPage` matched the frame.
