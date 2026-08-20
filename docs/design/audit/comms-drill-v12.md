# Comms drill pair (v12 mobile, wave 7)

> A finding recorded here is a claim about the tree, not a permanent record.
> It is re-derived against current code before it is scheduled, and once it
> stops reproducing it is rewritten as RESOLVED with a file:line citation of
> where the behaviour now lives (DEC-976 wave-106).

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

- **RESOLVED (wave 106, app/src/pages/comms/TemplatesTab.tsx:196,369)** —
  Templates' dock (frame `:325-328`, the Save/Cancel pair). Re-derived
  against main: `TemplatesTab.tsx:196` sets `data-chq-phone-dock` on the
  page root while `editingId` is set, and the existing footer wrapper
  (`.chq-comms-editor-actions`, line 369) now also carries
  `.chq-phone-dock`, per DEC-621's wave-98 amendment comment nearby
  ("mount, never re-declare"). The dock/tab-bar exclusivity
  concern is resolved by the same attribute contract `styles.css:2302`
  (`.chq-main:has([data-chq-phone-dock]) ~ .chq-tabbar`) uses elsewhere.
  Closed.
- **RESOLVED (wave 106, app/src/pages/comms/TemplatesTab.tsx:203,227)** —
  Templates' phone-frame count line. Re-derived against main: the head
  band is now `.chq-comms-templates-head chq-phone-head
  chq-phone-head-drill` (line 203) and contains
  `<span className="chq-comms-templates-head-count">{templates.length}
  saved</span>` (line 227), directly under the `<h1>`, matching frame
  :290's `5 saved` line. Closed.
- **RESOLVED (wave 106, app/src/pages/comms/HistoryTab.tsx:141-142,171)**
  — History's count line. Re-derived against main: `HistoryTab.tsx:141-142`
  now builds `countLine` as `` `${countOf(total, 'send')} · ${rhythm.sentLast7Days}
  in the last 7 days` `` when `rhythm` is available (falling back to the
  bare count otherwise), rendered at line 171 inside the
  `.chq-phone-head-drill` band — matching frame :337's `57 sends · 4 in
  the last 7 days` copy. Covered by
  `app/src/pages/comms/HistoryTab.render.test.tsx`'s "renders the head
  with a count line built from total + rhythm.sentLast7Days" test.
  Closed.
