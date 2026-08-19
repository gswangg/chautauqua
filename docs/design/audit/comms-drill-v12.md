# Comms drill pair (v12 mobile, wave 7)

## Built this wave

- `docs/design/Chautauqua Comms.dc.html:288` (Templates · 390) and `:337`
  (Send history · 390) both draw the shell's own drill-head band. Both
  `app/src/pages/comms/TemplatesTab.tsx` and
  `app/src/pages/comms/HistoryTab.tsx` now mount the shared
  `.chq-phone-head`/`.chq-phone-head-drill` vocabulary (declared since wave
  1 in `app/src/styles.css:2190-2211`, zero renderers before this wave) by
  adding those two classes to the existing titles wrapper, and
  `.chq-phone-back` to the existing `‹ Comms` breadcrumb button (DEC-576,
  wave-7 amendment: mount, never re-declare).
- Both breadcrumbs' `onClick` now also calls a new optional `onBack` prop.
  `Comms.tsx` passes `() => setPhoneEntered(false)` so the phone control
  returns to the Comms phone landing, not to the desktop Compose tab
  (`Comms.tsx`'s own comment confirms `phoneEntered` is read only inside
  the ≤700px media query, so this is inert at desktop widths). The
  original `navigate('/comms?tab=compose')` / `goToCompose()` call is kept
  alongside it so desktop's tab-strip back behaviour, which this task is
  not scoped to touch, is unchanged.

## Held for a later wave — do not build without re-checking ownership first

- **Templates' dock** (frame `:325-328`, the Save/Cancel pair) needs
  `.chq-phone-dock`, per this task's brief. NOT built this wave: wiring a
  second `.chq-phone-dock` collides with the shell dock/tab-bar
  exclusivity ruling (DEC-576) that two in-flight branches (`v12m-w3-i`,
  `v12m-w4-i`, per the field guide's wave-5/7 branch ledger) are both
  landing concurrently. Re-derive which of those merged before wiring
  this.
- **Templates' phone-frame count line.** The frame draws a third line in
  the head band — `5 saved` (`Chautauqua Comms.dc.html:290`) — directly
  under the `<h1>`. `TemplatesTab.tsx`'s only count ("Saved · N") lives
  further down, inside the desktop-shared `.chq-section-head`, not in the
  head band, and the desktop pin (`Chautauqua Comms.dc.html:227-229`)
  confirms the desktop head has no count line at all — so this is new
  phone-only copy, not an existing element to relocate. Left unbuilt this
  wave (narrowest interpretation of "wrap the existing head"); a future
  wave should add a `{templates.length} saved` line inside the
  `.chq-phone-head-drill` wrapper if the planner wants full frame parity
  here.
- **History's count line is close but not exact.** `HistoryTab.tsx`'s
  existing `countLine` (`countOf(total, 'send')`) is wrapped into the new
  head band as-is; the frame's fuller copy — `57 sends · 4 in the last 7
  days` — is not reproduced (no "in the last 7 days" clause exists in this
  file today). Not built this wave; flagged for the same reason as above.
