# Desktop field-width ledger (B10)

DEC-896/DEC-808, wave-28 task w28-c. Instrument: `test/desktop-field-width.scan.test.ts`.

DESIGN-RULINGS B10: "Field width follows content, not the column." This
ledger enumerates every `max-width:<N>px` the pack draws on a field wrapper
inside a desktop `Settings · editing …` frame in
`docs/design/Chautauqua Settings.dc.html`, resolves each to its declared
value in `app/src/pages/settings/settings.css`, and grades the two against
each other. It **measures and files only** -- desktop stays frozen, no CSS
byte changed by this lane.

## Population

readdirSync over `docs/design` finds one `*.dc.html` file with any
`Settings · editing` label: `Chautauqua Settings.dc.html`. Its label/extent
walk (identical to `test/desktop-frame-ledger.scan.test.ts`'s own) finds 7
such labels, all desktop (none carry a `width:390px`+`height:844` phone
marker). One is excluded per DEVIATIONS.md §6:

- `Settings · editing your data` (line 1111) -- DEVIATIONS §6 marks this
  extent a user-deferred, unbuilt feature. Grading a drawn field width
  against code that implements nothing would book a deferred feature as
  covered rather than honestly leaving it ungraded.

(DEVIATIONS §6's other deferred extent, `Import from Sessionboard`, line
1507-EOF, never qualifies for this population in the first place -- its
label does not begin `Settings · editing` -- and is named in the same
excluded-extents const purely so no line inside it is ever cited by
accident.)

The 6 surviving frames draw **11** field-wrapper widths:

| Frame | Drawn widths |
|---|---|
| `Settings · editing the call for papers` | 420 (pair), 200, 420 |
| `Settings · editing the event` | 420, 420 (pair), 300, 460 |
| `Settings · editing tracks and rooms` | 320, 280 |
| `Settings · editing the speaker portal` | 420 |
| `Settings · editing one saved embed` | 620 (pair) |
| `Settings · editing people and roles` | *(none drawn)* |

## Rows

Citations below are drift-proof: bare path, then a backtick quote resolved
against the whole file, never `path:NNN`.

### `Settings · editing the call for papers` (`CallForPapersPanel.tsx`)

1. **Opens/Closes pair, drawn `max-width:420px`.** First two field labels:
   "Opens", "Closes". Both resolve via
   `app/src/pages/settings/CallForPapersPanel.tsx` to
   `<SettingsField ... width="date">` twice. `--chq-field-w-date: 200px`.
   Pair arithmetic: 200 + 18 (gap) + 200 = 418 ≈ 420 (2px slack).
   **matches** (EQUIVALENT-AT-THE-DRAWN-WIDTH -- see Adjudications).
2. **Time zone, drawn `max-width:200px`.** Label "Time zone" resolves via
   `CallForPapersPanel.tsx` to `<SettingsField label="Time zone" width="date">`
   (a read-only mirror of the event's own zone, deliberately reusing the
   `date` width kind). `--chq-field-w-date: 200px`. **matches**.
3. **Form name, drawn `max-width:420px`.** Label "Form name" resolves via
   `CallForPapersPanel.tsx` to `<SettingsField label="Form name" width="slug">`.
   `--chq-field-w-slug: 420px`. **matches**.

### `Settings · editing the event` (`EventSettingsPanel.tsx`)

4. **Event name, drawn `max-width:420px`.** Frame label "Event name"
   resolves via `EventSettingsPanel.tsx` to
   `<SettingsField label="Event name" ... width="slug">` (DEC-613 wave-24
   amendment renamed the field's label from "Name" to the frame's own
   "Event name"). `--chq-field-w-slug: 420px`. **matches**.
5. **Starts/Ends pair, drawn `max-width:420px`.** Frame labels "Starts",
   "Ends" resolve via `EventSettingsPanel.tsx` to two
   `<SettingsField ... width="date">` calls labeled "Starts"/"Ends" (DEC-613
   wave-24 amendment renamed these from "Start date"/"End date"). Pair
   arithmetic: 200 + 18 (gap) + 200 = 418 ≈ 420 (2px slack). **matches**
   (EQUIVALENT-AT-THE-DRAWN-WIDTH, same shape as row 1 -- see
   Adjudications).
6. **Time zone, drawn `max-width:300px`.** Label "Time zone" resolves via
   `EventSettingsPanel.tsx` to `<SettingsField label="Time zone" width="timezone">`.
   `--chq-field-w-timezone: 300px`. **matches**.
7. **Venue, drawn `max-width:460px`.** Label "Venue" resolves via
   `EventSettingsPanel.tsx` to `<SettingsField label="Venue" width="venue">`.
   `--chq-field-w-venue: 460px`. **matches**.

### `Settings · editing tracks and rooms` (`TracksRoomsPanel.tsx`)

8. **Track name row, drawn `max-width:320px`.** This is a repeated
   existing-track list row (`<sc-for list="{{ editTracks }}">`), not a
   labeled field -- the nearest span is the drag-handle glyph, not a real
   label. **unresolved** (`no-label-match`). Coincidence note: the drawn
   value (320) equals `--chq-field-w-name: 320px`, the same kind
   `TracksRoomsPanel.tsx`'s own "New track name" `SettingsField` uses --
   but this ledger's label-exact join cannot attribute a list row to that
   call site, so the row is filed honestly rather than guessed.
9. **Room name field, drawn `max-width:280px`.** Same repeated-row shape
   (`<sc-for list="{{ editRooms }}">`) -- no adjacent label span.
   **unresolved** (`no-label-match`).

### `Settings · editing the speaker portal` (`PortalSettingsPanel.tsx`)

10. **Resource name, drawn `max-width:420px`.** Repeated resource-row shape
    (`<sc-for list="{{ editResources }}">`) -- no adjacent label span (the
    frame's actual labeled `SettingsField`s in this panel, "Welcome note"/
    "Logo URL"/"Accent colour"/"Show resources", are all `width="full"` or
    `width="name"`, none drawn with `max-width:420px` in this frame).
    **unresolved** (`no-label-match`).

### `Settings · editing one saved embed` (`EmbedsPanel.tsx`)

11. **Name/Surface/Format/Track 2x2 grid, drawn `max-width:620px`.** First
    two field labels "Name", "Surface". `EmbedsPanel.tsx` renders this
    section with its own `.chq-settings-embed-field-pair` grid
    (`grid-template-columns: 1fr 1fr; gap: 12px;` --
    `app/src/pages/settings/settings.css`), never `SettingsField`/
    `SettingsFieldPair` -- so neither label resolves against any
    `SettingsField` call site. **unresolved** (`no-label-match`). See
    Adjudications: this is a genuinely different, fluid (non-token) width
    register, not a B10 field-width divergence.

## Grade totals

- **matches: 7** (rows 1, 2, 3, 4, 5, 6, 7)
- **diverges: 0**
- **unresolved: 4** (rows 8, 9, 10, 11)

`FIELD_WIDTH_DIVERGENCE_CEILING = 0`, `FIELD_WIDTH_UNRESOLVED_CEILING = 4`,
both re-measured on this branch (DEC-613 wave-24 amendment) by forcing to
`-1` and reading the printed row list, both two-sided per
`test/campaign-ratchet-two-sided.scan.test.ts`.

## Adjudications

- **Row 1 (CFP Opens/Closes pair) is EQUIVALENT-AT-THE-DRAWN-WIDTH, not a
  divergence.** The frame draws the two-up pair as
  `grid-template-columns:1fr 1fr; gap:18px; max-width:420px`, and B10's own
  prose says `1fr 1fr`. `app/src/pages/settings/settings.css`'s
  `.chq-settings-field-pair` instead uses
  `grid-template-columns: auto auto; justify-content: start; gap: 18px`
  with two fixed-width `date` members: 200 + 18 + 200 = 418 ≈ 420. The code
  and the frame draw the SAME resulting width by two different CSS
  mechanisms (a fluid `1fr 1fr` track vs. two `auto` tracks sized by their
  own fixed-width children) -- filed as equivalent, no CSS changed.

- **Rows 4 and 5 were UNRESOLVED before DEC-613's wave-24 amendment, and
  now resolve.** The prior label mismatch (Event "Name"/"Start date"/"End
  date" vs. frame "Event name"/"Starts"/"Ends") defeated this ledger's
  label-exact join, which deliberately never fuzzy-matches a near-miss
  label (DEC-393's own "own-text-exact" precedent -- fuzzy-matching would
  risk silently attributing the wrong control's width). DEC-613's wave-24
  amendment renamed `EventSettingsPanel.tsx`'s three field labels to the
  frame's own words ("Name" -> "Event name", "Start date" -> "Starts",
  "End date" -> "Ends"; "Slug" deliberately kept, see DEVIATIONS.md), which
  drains the join: row 4 resolves via `width="slug"` to
  `--chq-field-w-slug: 420px` against the drawn 420 (**matches**), and row
  5's pair resolves the same arithmetic equivalence as row 1's CFP pair,
  200 + 18 + 200 = 418 ≈ 420 (**matches**, EQUIVALENT-AT-THE-DRAWN-WIDTH).

- **Row 11 (saved-embed 2x2 grid) resolves to a DIFFERENT, non-token
  register, not a B10 field-width divergence.** `EmbedsPanel.tsx` never
  uses the shared `SettingsField`/`SettingsFieldPair` components this
  ledger's MATCH SIDE is built from -- its own
  `.chq-settings-embed-field-pair` rule
  (`app/src/pages/settings/settings.css`) is a fluid `1fr 1fr` grid with no
  fixed px width at all, so there is no declared value to compare the
  drawn 620px against. This is an honest absence of a comparable fact, not
  a measured gap.

- **Rows 8, 9, 10 (tracks/rooms/resources list rows) are all the same
  shape: a repeated `<sc-for>` row's own name field, never adjacent to a
  labeled `SettingsField`.** The pack draws these rows' name/seats boxes at
  a fixed width for visual rhythm, but the corresponding React code
  (`TracksRoomsPanel.tsx`, `PortalSettingsPanel.tsx`/`ResourcesPanel.tsx`)
  renders each EXISTING track/room/resource dynamically -- there is no
  per-row `SettingsField` call site this join's label-exact text match can
  ever resolve to (the only `SettingsField` calls in these files are the
  "New track name"/"New room name"/"Seats" ADD-item fields, which the
  frame draws in a different section this population doesn't reach).
  Filed as instrument-completeness UNRESOLVED, consistent with
  `test/desktop-control-floor.scan.test.ts`'s own precedent for the
  identical dynamic-list-row shape.
