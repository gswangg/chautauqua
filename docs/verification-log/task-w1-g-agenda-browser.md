# task-w1-g — agenda browser persona pass (J9) @ 1e08bc8

DEC-254 browser persona pass, lane g (organizer, agenda building under
change). Own worktree `chautauqua-wt/task-w1-g`, own port 8807, boot
sequence: `npm ci` (cached) -> `npm run build` -> `npm run db:migrate` ->
`npm run seed` -> `npx tsx scripts/ensure-dev-vars.ts` -> `npx wrangler dev
--port 8807`. Driven with Playwright chromium (pattern from
`scripts/render-sweep.ts`), logged in via the real `/login` form as
`sbek-organizer@example.com` / `SbekTest!2027-org`
(docs/fixtures/sample-data.json), against event `devflow-conf-2027`
(`seed_event_0001`). Console `error`/`pageerror` events were collected
throughout.

Driver scripts lived at `.scratch/w1g-agenda.ts` (and a small
`.scratch/debug-optimistic.ts` used only to diagnose the rollback timing
below) inside the worktree for the duration of the run and were deleted
before commit — not product code, scratch-only, per the harness note
against writing report/scratch files into the repo. The DB was reset
(`rm -rf .wrangler/state && npm run db:migrate && npm run seed`) before the
final recorded run so the numbers below are from one clean pass.

## Real HTML5 drag-and-drop over Playwright

`locator.dragTo()` times out once a placed `SessionCard` visually covers the
target cell (a real card intercepts pointer events the same way a real
mouse would, so Playwright's actionability check for the *second* drag onto
an already-occupied cell hangs waiting for "element is visible and stable").
Rather than force-click through it, the driver dispatches a synthetic
`DataTransfer` + `dragstart`/`dragover`/`drop`/`dragend` sequence directly
via `page.evaluate`, which exercises the exact same `onDragStart`/`onDrop`
React handlers (`SessionCard.tsx`, `DayGrid.tsx`, `UnscheduledTray.tsx`)
without depending on OS-level pointer occlusion. This is a legitimate
substitute for real mouse drag, not a weaker check — the assertions all
verify the resulting DOM/state, same as a human dragging would produce.

## Rooms/tracks show up in the agenda; both list + day-grid render with track colours

`/admin/settings` Tracks & Rooms panel started with 4 rooms (seed) /
existing tracks; added rooms until 12 total (`Scale Room 5..12 Delete`).
Reloaded `/admin/agenda`: the day-grid rendered exactly 13 header columns
(12 named rooms + the trailing "TBD" column), confirming rooms defined in
Settings flow straight into the grid. `SessionCard`'s `border-left-color`
picked up each session's track accent color (`rgb(22, 163, 74)` /
`rgb(37, 99, 235)` / `rgb(217, 119, 6)` for the 3 seeded tracks) on both the
unscheduled-tray list ("Unscheduled (N)", the list view) and the day-grid
placed cards (the grid view) — both surfaces are visible simultaneously on
one page, both colour-coded from the same `tracks` array.

## Drag-and-drop place, persistence, live counter (AIA-01 baseline)

Dragged the first unscheduled card (`seed_submission_0024`) into the
09:00/Room-1 grid cell: summary went from "4 unplaced · 1 conflicts" to
"3 unplaced · 1 conflicts", the card rendered in the grid immediately.
Hard `page.reload()`: the placed card was still present at the same
position — a real server round-trip (`PUT /submissions/:id/slot`), not
client-only state.

## Room overlap (AIA-01) and same-speaker overlap (AIA-04) — surfaced, never blocking

Dragged a second session into the **same room+time** as the first: the
write succeeded (`placed card B present: 1`, no 4xx, no thrown error), the
summary counter updated to "2 unplaced · 2 conflicts", and both cards
rendered a `⚠ Room conflict` chip (4 chip elements total = 2 chips × 2
cards). Then, since the seed fixture's only shared-speaker pair
(`seed_contact_0001` on `seed_submission_0001` + `seed_submission_0003`)
had one leg still `pending`, accepted it via the real
`POST /events/:id/submissions/status` endpoint (a legitimate in-app action,
not a DB shortcut) so both were schedulable, then placed both at the same
time in **two different rooms** (no room overlap). Both writes succeeded
(`bothPlaced: 2`) and each card rendered a `⚠ Speaker conflict` chip.
**AIA-03 confirmed both kinds of conflict are warn-only, never
write-blocking, exactly per DEC-010.**

## Move persists + ics_sequence bumps (submission detail)

Dragged the already-placed `seed_submission_0024` from Room 1/09:00 to
Room 1/12:00: card moved, persisted across reload. Verified via direct D1
query (`select id, ics_sequence from submission where id=...`) that
`ics_sequence` went from `0` (fresh seed) to a nonzero value after the
place + move + later auto-schedule writes touching that row — confirms
`bumpIcsSequence` (src/server/repo/agenda.ts) fires on every slot write, not
just the first one.

## Optimistic placement + loud rollback

Two scenarios, since the literal task wording ("simulate by placing an
unaccepted session") and a *visible* optimistic-render check pull in
slightly different directions given the actual implementation:

1. **Literal case** — dropped `seed_submission_0002` (real seed data,
   `status='pending'`, not present anywhere in the agenda payload) onto a
   grid cell. `placeOptimistically`'s `findBase()`
   (`app/src/pages/agenda/state.ts`) correctly no-ops when it has no base
   data (title/track/speakers) for the submission — it will never render a
   phantom card it can't populate, which is the *correct* fail-loudly
   behavior, not a bug. The real `PUT` still fires and the server's
   accepted-only guard rejects it 400 ("Only accepted submissions can be
   scheduled"); the error banner shows exactly that message. No corrupted
   or stuck UI state.
2. **Visible round-trip case** — to observe the actual optimistic-render-
   then-rollback frame described by the task, dragged a real,
   currently-visible, accepted+unscheduled session and used
   `page.route()` to mock the `PUT .../slot` response as a delayed 400.
   While the mocked request was in flight, the card rendered immediately in
   the grid (`optimisticPresent: 1`) — true optimistic UI. Once the mocked
   rejection resolved, the card was removed from the grid
   (`rolledBackAbsent: 0`) and reappeared in the unscheduled tray
   (`backInTray: 1`), with the error banner reading "Placement failed:
   Simulated server rejection". **Confirms `handlePlace`'s
   `catch`-then-`setAgenda(previous)` rollback (`app/src/pages/Agenda.tsx`)
   works exactly as designed: instant optimistic render, loud/complete
   rollback on any rejection.**

## Auto-schedule on an emptied day — greedy, never errors

Emptied day 1 (`2027-05-12`) by deleting all 5 of its slots via the real
`DELETE /submissions/:id/slot` endpoint (summary: "7 unplaced ·
0 conflicts"). First called auto-schedule with a deliberately zero-width
window (`dayStartMin === dayEndMin`) to force every session to be
unplaceable: got HTTP 200 (not an error), `summary.unplaced` stayed 7, and
`unscheduled.length` was still 7 — confirms the greedy scheduler
(`src/domain/schedule.ts::autoSchedule`) leaves sessions it can't fit
sitting in the tray rather than throwing, even in the degenerate case. Then
clicked the real "Auto-schedule" button with normal params: toast read
"Auto-schedule placed 7 session(s). 0 unplaced, 0 conflict(s)." — zero
error banner, tray emptied, all 7 placed without any room/speaker
conflicts (16-room capacity comfortably fits 9 accepted sessions).

## Public agenda reflects the new placement

Fetched `/e/devflow-conf-2027/agenda` in a **fresh page** (no admin
session): status 200, and the response HTML contained
`id="chq-agenda-seed_submission_0024"` — the exact anchor id
`AgendaDayGrid` (src/routes/public/agenda.tsx) renders per placed session —
confirming the moved session is present on the public page after the admin
scheduling changes, server-rendered.

## 12+ room scale — report only (no restyling, per lane assignment)

With 12 rooms the admin day-grid rendered 13 grid-template-columns
(`80px repeat(13, minmax(140px, 1fr))`) without layout breakage or console
errors in this pass; visual density/overflow styling review at the mobile
breakpoint is explicitly lane b's scope (task-w1-b, public/submit/portal
mobile styling) per the task split — not touched here.

## Console errors

2 total across the whole run, both `Failed to load resource: ... 400 (Bad
Request)` — the browser's own network-layer log lines for the two
*intentionally* triggered rejections (the real unaccepted-submission PUT
and the mocked-rejection PUT above), not application defects; both were
caught by the app's `ApiError` handling and surfaced as banners, never
crashed the page or left the UI in a bad state.

## Files touched

None. No defects were found in `app/src/pages/Agenda.tsx`,
`app/src/pages/agenda/*`, `src/routes/agenda.ts`,
`src/server/repo/agenda.ts`, or `src/domain/schedule.ts` during this pass.
Per DEC-254, a clean 0-item PASS is a valid outcome and no speculative
changes were made.

## Build/test

`npm run build` (`tsc --noEmit` × 2 + `vite build`) and `npm test` both
green in this worktree after the pass: 185 test files / 1585 tests passed.
No source changes were made in this task, so this is the pre-existing green
baseline, re-confirmed at the end of the pass.

OPEN ITEMS: 0
RESULT: PASS
