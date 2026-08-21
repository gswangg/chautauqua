# Phone agenda clash-card one-tap resolution (task w33-c, DEC-895)

## What shipped

The pack's last unbuilt drawn CONTROL — `docs/design/Chautauqua
Agenda.dc.html:171`, the clash card's filled `#F4F1E8`-on-`#1B1D17`
control, `min-height:44px`, reading `Move DFC-047 to 11:30`.

- `src/domain/schedule-copy.ts` gained two pure exported helpers:
  `conflictMoveLabel(ref, startMin)` and `conflictMoveCaption(roomName)`,
  the ONE renderers for the "Move X to hh:mm" label and its "Next free slot
  in ROOM" caption respectively.
- `src/server/repo/overview/scheduling.ts`'s `buildConflictResolutionFor`
  now calls `conflictMoveLabel` instead of inlining the template — a
  call-site swap only, nothing else in that function changed.
- `app/src/pages/overview/AgendaWorkSection.tsx`'s "Next free slot in
  {roomName}" caption now calls `conflictMoveCaption` — this WAS a
  one-line change, so it landed (task step 2's conditional).
- `app/src/lib/schedule-vocabulary.ts` (the existing app/→src/ boundary
  crossing for schedule vocabulary) gained re-exports for
  `conflictMoveLabel`, `conflictMoveCaption`, `nextFreeSlot`, and the
  `PlacedSession`/`BlockedInterval`/`NextFreeSlotInput` types, so
  PhoneAgenda.tsx never imports straight from `src/domain/schedule*`
  (matching the file's own stated no-straight-import contract).
- `app/src/pages/Agenda.tsx` threads its existing `dayBreaks` (already
  day-scoped) down to `PhoneAgenda` as a new `breaks` prop. Production's
  only caller always passes it.
- `app/src/pages/agenda/PhoneAgenda.tsx`'s `slot.kind === 'clash'` branch
  gained a `computeClashMove` helper and renders its result as a NEW last
  child of the `.chq-panel.chq-phone-slot-clash` card, after the sessions
  list — v12m-w32-f's spelled `chq-flag` span and the session-button list
  were not touched. `computeClashMove` calls the SAME `nextFreeSlot` scan
  `buildConflictResolutionFor` runs server-side: picks the later of the
  clash's sessions (ties broken toward the last entry in slot order),
  searches only the room it currently occupies, excludes it from
  `existing`, and passes the threaded breaks as `blocked` (never
  defaulted at the computation site — see the CONTENTION note below for
  the one place a default WAS added, and why it's narrower than that).
  Tapping the control calls the page's existing `onPlace` — no new
  endpoint.
- `app/src/pages/agenda/agenda.css` — one new rule,
  `.chq-phone-slot-clash-move`, inside the file's ONE terminal `@media
  (max-width: 700px)` block, at the 44px floor with centred flex and
  non-zero horizontal padding, using only `--chq-on-ink`/`--chq-ink`/
  `--chq-r-ctl-phone` tokens (DEC-383). Also added to the file's top-level
  desktop leak-guard `display: none` selector list (every other
  `.chq-phone-slot-*` class is already there).
- `src/decisions.ts`'s `DEC_895` constant (already present in
  `src/decisions-data/part4.ts`, used elsewhere) is referenced (`void
  DEC_895`) from both `src/domain/schedule-copy.ts` and
  `app/src/pages/agenda/PhoneAgenda.tsx`.

## Interpretation calls (design gaps, narrowest reading taken)

1. **TBD-room clashes never render the control.** The task instruction
   says "search the room the later session currently occupies" and says
   nothing about a TBD fallback (unlike `buildConflictResolutionFor`,
   which falls back to `fallbackRooms` when `roomId` is null). A clash
   inside the phone view's TBD bucket has `roomId === null` for both
   sessions, so there is no single room to search into under the given
   instruction. `computeClashMove` returns `null` for this case rather
   than inventing a multi-room search the frame doesn't describe. If the
   pack later wants TBD clashes to also offer a move (into whichever room
   is free), that is a new design decision, not a narrow reading of this
   one.

2. **No day-crossing.** `nextFreeSlot` is called with `days: [day]` only
   (the currently-viewed day), not the full event `days` array
   `buildConflictResolutionFor` searches. This matches `onPlace`'s own
   signature (`(submissionId, roomId, startMin, endMin)` — no day
   parameter; `Agenda.tsx`'s `handlePlace` always writes to `activeDay`),
   so a cross-day suggestion could never actually be placed by this
   control regardless.

3. **`breaks` prop is optional (`breaks?: ScheduleBreakRow[]`, defaulted
   to `[]` in the destructure), not required.** The task's instruction to
   "never default `blocked` to empty" is honored at the computation
   site — `computeClashMove`'s `blocked` parameter is always the prop as
   given, never silently substituted. The prop itself is optional purely
   so five pre-existing `PhoneAgenda.*.render.test.tsx` files (not owned
   by this task, exercising unrelated slices of the component) don't all
   need a breaks fixture added to their local `baseProps` builders.
   `Agenda.tsx`, the only production caller, always passes the real
   `dayBreaks` array. This is flagged rather than silently done because
   it is the one place this task's "never default to empty" instruction
   and "don't touch files outside OWNED FILES" instruction pull in
   opposite directions; the production call site keeps the strict
   reading, the component's public type does not.

4. **No caption under the phone control.** Unlike the desktop Overview row
   (`AgendaWorkSection.tsx`'s "Next free slot in {roomName}" caption under
   its button), the frame at `Agenda.dc.html:160-172` draws the clash
   card's ink panel with exactly ONE more child after the sessions list —
   the control itself, no caption span. `conflictMoveCaption` was still
   built (task step 1 required it unconditionally) and is wired into the
   desktop row, but PhoneAgenda.tsx does not call it — there is nothing in
   the frame for it to render.

## Contention

`v12m-w32-f` (unmerged, 1 commit at start of this task) owns the spelled
clash flag inside this same card (`chq-flag` span, replacing
`countOf(slot.sessions.length, 'session')` with "Two sessions in this
slot"). This task's diff to `PhoneAgenda.tsx`'s clash branch adds the new
move control as a sibling AFTER the existing `slot.sessions.map(...)`
block and does not touch the `chq-flag` span, `phoneSlots.ts`, or the
session-button list — the merge train should union the two edits rather
than reverting either. Cite `v12m-w32-f`'s edit at (its own) `PhoneAgenda.
tsx`'s clash-branch `chq-flag` span when merging.

## Tests

New file `app/src/pages/agenda/PhoneAgenda.clashMove390.render.test.tsx`:
a runtime `verbatimLine()` check pinning `Agenda.dc.html:171`'s exact
markup, plus three cases — (1) a clashing pair with a free later slot in
the same room: exactly one control named `Move DFC-047 to 9:30` (the
room's next free grid slot once the later session itself is excluded from
occupancy), tapping it calls `onPlace('later-id', 'r1', 570, 600)`, the
earlier session's own card renders no move control; (2) the room fully
booked for the rest of the day: no control renders; (3) a break covering
the only otherwise-free run: no control renders (proves `blocked` is
threaded, not defaulted — case 1's identical placed-sessions setup DOES
render a control without the break).

All targeted tests green: the new file (4 tests), every
`PhoneAgenda.*.render.test.tsx` (dock-membership 11, falsifiability 4,
phone-head, w49 4), `agenda-phone-frame.test.ts` (23),
`AgendaWorkSection.render.test.tsx` (17), `overview-place-suggestion.
test.ts`, and every file `grep -rln "Move .*to \|Next free slot in "`
named across `test`/`app/src`/`src`. Standalone `npm run build` (tsc ×2 +
vite) is clean.
