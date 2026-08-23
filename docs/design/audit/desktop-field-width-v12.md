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
    `SettingsField` call site. WAVE 26: the ledger's MATCH SIDE now also
    tries a plain-`<label>` pair-wrapper tier for exactly this shape (see
    WAVE 26 section below); `.chq-settings-embed-field-pair` itself carries
    a literal (non-token) `max-width: 620px;`, and both "Name" and
    "Surface" occur, in order, as plain `<label>` leading text inside its
    one occurrence in `EmbedsPanel.tsx`. **matches** (620 == 620,
    EQUIVALENT-AT-THE-DRAWN-WIDTH -- DEC-896 wave-24 amendment already
    adjudicates this exact pairing in `settings.css`'s own comment).

## Grade totals

- **matches: 8** (rows 1, 2, 3, 4, 5, 6, 7, 11)
- **diverges: 0**
- **unresolved: 3** (rows 8, 9, 10)

`FIELD_WIDTH_DIVERGENCE_CEILING = 0`, `FIELD_WIDTH_UNRESOLVED_CEILING = 3`,
both re-measured on this branch (wave-26 amendment) by forcing to `-1` and
reading the printed row list, both two-sided per
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

- **Row 11 (saved-embed 2x2 grid) is EQUIVALENT-AT-THE-DRAWN-WIDTH, not a
  B10 field-width divergence (wave-26 amendment).** `EmbedsPanel.tsx` never
  uses the shared `SettingsField`/`SettingsFieldPair` components this
  ledger's SettingsField-based MATCH SIDE tier is built from -- but its own
  `.chq-settings-embed-field-pair` rule
  (`app/src/pages/settings/settings.css`) DOES carry a literal `max-width:
  620px;` (a fluid `1fr 1fr` grid capped at a fixed px ceiling, not an
  unbounded one). The wave-26 plain-label pair-wrapper tier resolves "Name"
  and "Surface" as that class's own plain-`<label>` leading text and reads
  its literal max-width directly (never through a `--chq-field-w-*`
  token). 620 == 620. See the WAVE 26 section below.

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

## WAVE 26 (DEC-808 amendment, task w26-i): draining the 4 ungraded rows

**Before:** `FIELD_WIDTH_UNRESOLVED_CEILING = 4` (rows 8, 9, 10, 11),
`FIELD_WIDTH_DIVERGENCE_CEILING = 0`, forced to `-1` and re-measured on
this branch to confirm.

**MATCH SIDE widened:** a new PLAIN-LABEL PAIR WRAPPER tier
(`test/desktop-field-width.scan.test.ts`'s `extractLiteralMaxWidthClasses`
/ `resolvePlainLabelPair`) resolves a pair row whose SettingsField-pair
tier fails by instead reading a class's own LITERAL (non
`--chq-field-w-*`-token) `max-width:<N>px` in `settings.css`, when both
member labels occur, in order, as a plain `<label>`'s own leading text
inside exactly one occurrence of that class -- honesty-preserving: two
occurrences of the class, or two different qualifying classes, both leave
the row UNRESOLVED rather than picking a winner (mirrors the
SettingsField-pair tier's own "either member fails -> UNRESOLVED, never a
guessed partial sum" discipline).

**Rows 8, 9, 10 (tracks/rooms/resources list-row names) were
investigated and confirmed to have NO available widening.** Each is the
repeated-`<sc-for>`-row shape the file's own LABEL SIDE (item 2, untouched
this wave) already documents as honestly unresolvable: the frame draws no
adjacent label span for these rows, so `forwardLabels` correctly finds the
row's own nearest onward span (a "Remove" action link, not a field label)
-- widening the MATCH side cannot repair a LABEL side miss. Traced each
row's code counterpart to confirm no repair was available under any
reasonable widening: `TracksRoomsPanel.tsx`'s existing-track/room name
inputs live in `app/src/pages/settings/tracksRooms/TrackEditRow.tsx` /
`RoomEditRow.tsx` (a subdirectory `settingsSourceFiles()` does not walk),
each carrying a composed `aria-label` (`` `Track name for ${track.name}` ``
/ `` `Room name for ${room.name}` ``) but a FLUID `width: 100%` (not a
`--chq-field-w-*` token) -- even a composed-label match would still resolve
to a non-numeric, incomparable width, same as this file's own existing
`full`-kind handling. `PortalSettingsPanel.tsx`'s resource-name row
delegates to `ResourcesPanel.tsx`'s `.chq-settings-portal-resource-name`,
which carries no label at all (no `aria-label`, no adjacent `<label>`) and
no width declaration of any kind in `settings.css`. Both are documented
here so a later wave does not re-attempt the same investigation from zero.

**After:** re-measured by forcing both ceilings to `-1` again on this
branch: **0 divergences, 3 unresolved** (rows 8, 9, 10; row 11 now
resolves **matches**). `FIELD_WIDTH_DIVERGENCE_CEILING` stays `0` (no row
newly resolved to a divergence -- row 11 resolves to an exact 620==620
match, consistent with DEC-896 wave-24's own already-adjudicated
equivalence). `FIELD_WIDTH_UNRESOLVED_CEILING` lowered `4` -> `3`. No CSS
byte touched; desktop stays frozen.

## WAVE 39 (DEC-808 wave-39, residue read-out, task w39-g)

`FIELD_WIDTH_UNRESOLVED_CEILING` was one of three named UNOWNED residues
never re-verified since wave-26 landed it. Forced to `-1` and the offender
list read back on this branch: still EXACTLY 3, the same rows (8, 9, 10 --
`Chautauqua Settings.dc.html:827`/`:846`/`:929`, tracks/rooms/resources
repeated-row names), each still `no-label-match` for the same reason wave
26's Adjudications section already gives. Desktop stays frozen; no code or
CSS byte touched. No drift since wave 26. Ceiling stays at 3.
