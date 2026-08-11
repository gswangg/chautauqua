# task-w3-e - J9 agenda + calendar-invite-update browser pass @ cf35a87

DEC-259 wave-3 lane, fix-authorized inside its owned file list (`app/src/
pages/Agenda.tsx`, `app/src/pages/agenda/**`, `src/routes/agenda.ts`,
`src/server/repo/agenda.ts`, `src/mail/ics.ts`, `src/domain/schedule.ts`,
plus test files). This is evidence about SPEC J9 (agenda drag-drop
scheduling, warn-never-block conflicts, publish/purge) and DEC-007 (.ics
stable UID / bumped SEQUENCE), not a DEC-256 battery section — it does not
claim a FROZEN SHA and cannot by itself satisfy the DEC-069/DEC-256 exit
predicate.

Own worktree `chautauqua-wt/task-w3-e`, own port 8834, boot sequence:
`npm ci` -> `npm run build` -> `npm run db:migrate` -> `npm run seed` ->
`npx tsx scripts/ensure-dev-vars.ts` -> `npx wrangler dev --port 8834
--var PUBLIC_BASE_URL:http://localhost:8834`. Driven with Playwright
chromium via real mouse `page.mouse.move/down/up` sequences (not
`dispatchEvent`/`dragTo` shortcuts), logged in via the real `/login` form
as `sbek-organizer@example.com` / `SbekTest!2027-org` (docs/fixtures/
sample-data.json), against event "DevFlow Conf 2027". Console `error`/
`pageerror` events and `/api/*` 4xx/5xx responses were captured on every
page with zero allowlisting throughout every run; none were ever raised by
the running app itself (the one 500 seen, item 6, was a deliberately
`page.route`-injected fault, not a real server error). Driver scripts
lived at `.scratch/drive*.ts` inside the worktree for the duration of the
run and were deleted before this commit (scratch-only, DEC-259 lane
craft).

The worktree was wiped by an external process mid-task (after the initial
build+seed+first exploratory drag pass, before any commit existed) — it
was recreated from `main` (branch `task-w3-e` had no prior commits to
lose), rebuilt/reseeded, and the SessionCard/DayGrid fix below was
committed immediately once verified, before continuing further browser
exploration, specifically to avoid losing it a second time. All findings
and screenshots below are from the final, post-fix, post-recreation state.

## Fix found and applied: drop-onto-occupied-slot was silently swallowed

**Found (browser):** dragging a session card and dropping it directly on
top of an already-placed card (as opposed to an empty grid cell) was a
complete no-op — no PUT fired, no state changed, nothing. Confirmed via
`document.elementFromPoint(cx, cy)` at the target card's screen center:
it resolved to the placed `SessionCard`'s own DOM node (`.chq-session-
card-title`), not the `.chq-day-grid-cell` beneath it — and `SessionCard`
had no `onDrop` handler of its own, only `DayGrid`'s cells did. Since
placed cards are CSS-grid items that fully cover the cell(s) they occupy,
this made it **impossible to ever create a room or speaker conflict via
drag-and-drop when the target slot was already occupied** — directly
undermining SPEC J9's warn-never-block model, which only works if
organizers can actually place a session onto an occupied slot in the
first place.

**Fix (owned files):** `app/src/pages/agenda/SessionCard.tsx` now accepts
optional `onDragOver`/`onDrop` props, wired onto the card's root div.
`app/src/pages/agenda/DayGrid.tsx` passes its own `handleDragOver`/
`handleDrop(e, session.roomId, session.startMin)` through when rendering
placed cards, so dropping directly on an occupied card now reaches the
same placement path as dropping on an empty cell (targeting that card's
own room/day/startMin — i.e. "land here" means "double-book this slot").

**Regression test:** `app/src/pages/agenda/Agenda.render.test.tsx` gained
a second test that fires a `drop` DOM event directly on an occupied
placed card's element (via a small jsdom-safe `FakeDataTransfer`) and
asserts the tray count decrements (i.e. the PUT reached the server).
Verified failing before the SessionCard/DayGrid change (`git stash` the
two files, rerun — fails with "Unscheduled (1)" never reaching (0)) and
passing after. Full suite: `npm run build` + `npx vitest run` ->
**187 files / 1613 tests, all green**.

## (1) Real mouse drag persists across a hard reload

Logged in, navigated to `/admin/agenda`. Dragged "Rethinking Config
Management: Lessons from Production" from the unscheduled tray onto an
empty day-grid cell using a real `mousedown` -> multi-step `mousemove` ->
`mouseup` sequence (not a single `dragTo` call). Summary counter went
"N unplaced" -> "N-1 unplaced" immediately. `page.reload()` (hard
navigation, not SPA route change): the card reappeared in the day grid at
the same room/time — a fresh `GET .../agenda` round-trip, not client
cache.

## (2) Conflicts warn, never block; live counter updates

Two independent conflict scenarios were manufactured live, purely via
drag, on top of the seed data's one pre-existing room conflict
(SES-001/SES-004, deliberately seeded by `scripts/seed.ts`):

- **Speaker overlap:** accepted a second Priya Raman submission
  (`seed_submission_0003`, previously `pending`) via the real Submissions
  detail page's status `<select>`. Dragged it from the tray into an empty
  cell in a *different* room, overlapping SES-001's (also Priya Raman)
  time window. Counter: `1 unplaced/5, 1 conflicts` -> after drag
  `4 unplaced, 2 conflicts`, GET `/agenda` confirmed a new
  `{"kind":"speaker_overlap","submissionIds":["seed_submission_0001",
  "seed_submission_0003"]}` entry. No room conflict was introduced (pure
  speaker isolation, different rooms).
- **Room overlap (the fix above):** dragged an unscheduled session
  directly onto SES-004's already-placed card (same room/time). Counter
  jumped `2 conflicts` -> `4 conflicts` (two new `room_overlap` pairs,
  since the dropped session now overlaps both SES-001 and SES-004 in that
  room). Conflict chips rendered `⚠ Speaker + Room conflict` /
  `⚠ Room conflict` / `⚠ Speaker conflict` across the affected cards.

**Never blocks:** `.chq-error-banner` count was `0` after every one of
these placements — the PUT always returns 200 with the refreshed
`{conflicts, summary}` envelope; conflicts are reported, never rejected
(`src/routes/agenda.ts`'s PUT handler has no conflict check at all, only
`accepted`-status + room-belongs-to-event validation).

## (3) Track colors in both the day grid and the list view

`SessionCard`'s left border color is set from the session's track
(`tracks.find(...).color`), and the same component renders both inside
`DayGrid` (`.chq-day-grid-placed-card`) and inside `UnscheduledTray`
(the list view). Captured `borderLeftColor` via
`locator.evaluateAll(... el.style.borderLeftColor)` on both containers
after the drag: day-grid cards showed `rgb(22, 163, 74)` /
`rgb(37, 99, 235)` etc. matching the tray cards' colors for the same
tracks; untracked sessions fell back to `var(--chq-border)` in both
places identically.

## (4) Auto-schedule places remaining sessions without new room conflicts, safely re-runnable

Clicked "Auto-schedule": toast reported "placed N session(s), 0 unplaced,
1 conflict(s)" — the conflict count stayed at the pre-existing seeded
value (auto-schedule's greedy placer, `src/domain/schedule.ts`, only
considers a room+time free if it produces zero *new* conflicts against
everything already placed — verified live, not just by unit test).
Clicked "Auto-schedule" again immediately: toast reported "placed 0
session(s)" and the counters were unchanged — re-running with nothing
left to place is a safe no-op, not an error or a duplicate-placement bug.

## (5) Publish purges the public cache; public agenda reflects the change

Clicked "Publish schedule" -> toast "Schedule live — N sessions public."
(`POST .../agenda/publish`, `src/routes/agenda.ts`). Opened
`/e/devflow-conf-2027/agenda` in a fresh page/tab: the newly
auto-scheduled sessions (previously unplaced) appeared in the public day
grid immediately, with track names and speaker bylines, on the very next
request — no manual cache-bust needed. (Per `src/server/pubcache.ts`'s
design, documented in `src/routes/agenda.ts`: the purge is the global
`bumpPublicVersionMiddleware`, which bumps the KV-stored cache version
after *any* successful mutating request, not just `/publish` specifically
— `/publish` is a deliberate organizer-facing moment, not a separate purge
mechanism. Confirmed the public page reflected the drag+autoschedule
mutations that preceded it.)

## (6) Optimistic placement rolls back loudly on server rejection

Reachable: used `page.route('**/slot', ...)` to intercept the next real
`PUT /api/v1/submissions/:id/slot` browser request and fulfill it with a
synthetic `500 {"error":{"code":"internal","message":"Simulated server
failure"}}` — this exercises the real `handlePlace` optimistic-update code
path in `app/src/pages/Agenda.tsx` end-to-end (drag -> optimistic
`setAgenda` -> real fetch -> real `ApiError` thrown on non-2xx -> catch ->
`setAgenda(previous)` + `setError`), only the network response is
synthetic. Dragged a tray session onto an empty cell: the request was
intercepted and rejected. Result: `.chq-error-banner` appeared with text
**"Placement failed: Simulated server failure"**; the session ended back
in the unscheduled tray (count restored to include it) and was **not**
left sitting in the day grid — the rollback is visible and loud, not a
silent revert. (A true end-to-end server-side 500 wasn't separately forced
since there's no reachable UI path to make the real server error other
than a bug; the interception targets the exact same client code path a
real 500 would.)

## (7) DEC-007 stable UID / bumped SEQUENCE / LOCATION-only-when-assigned

Used `seed_submission_0005` ("A Practical Guide to Service Meshes"),
which the seed data places with a real day/time (`2027-05-13`,
`600-645`) but `roomId: null` — exactly the "no room yet" case DEC-007
exists for. Via `/admin/comms`'s real Compose wizard: selected it,
checked "Attach calendar invite (.ics)", wrote a plain-text body, sent.
Downloaded the resulting `.ics` from `/dev/mailbox/:id/ics`:

```
UID:chq-seed_submission_0005@chautauqua
SEQUENCE:1
DTSTART:20270513T170000Z
DTEND:20270513T174500Z
(no LOCATION line)
```

Then, via the real agenda drag-drop, assigned it to `seed_room_0001`
(Main Stage) at the same time. Went back to Comms, selected the same
submission again, sent a second "room update" invite. Second `.ics`:

```
UID:chq-seed_submission_0005@chautauqua   <- SAME
SEQUENCE:3                                 <- bumped (> 1)
LOCATION:Main Stage                        <- now present
(no video-link pattern anywhere: zoom/meet.google/teams.microsoft all absent)
```

UID identical across both sends (confirmed byte-equal), SEQUENCE bumped
(both the room-assignment drag and the second send call
`bumpIcsSequence`/`upsertSlot`+comms' own per-send bump, per DEC-007's
"caller bumps on schedule-affecting changes" contract — the jump from 1
to 3 rather than 1 to 2 is expected, not a bug: the room-assignment PUT
itself is a schedule-affecting change and bumps once, then the second
send bumps once more), LOCATION only appears once a room exists, and no
video link is ever emitted (`src/mail/ics.ts` has no video-link field at
all — confirmed by source read, not just absence in this sample).

## Owned-file changes

- `app/src/pages/agenda/SessionCard.tsx` — added optional `onDragOver`/
  `onDrop` props, wired to the card's root div.
- `app/src/pages/agenda/DayGrid.tsx` — passes `handleDragOver`/
  `handleDrop` through to placed cards so an occupied slot is a valid drop
  target, matching an empty cell.
- `app/src/pages/agenda/Agenda.render.test.tsx` — new regression test
  (`accepts a drop directly on an already-occupied placed card`), verified
  red before / green after the fix above.

No other defects found inside the owned file list (`src/routes/agenda.ts`,
`src/server/repo/agenda.ts`, `src/mail/ics.ts`, `src/domain/schedule.ts`
were read in full and exercised live for every item above; all matched
their documented contracts).

## Open items (outside owned files, left for the wave-4 planner)

- No functional defect found outside the owned list during this pass.
  `app/src/pages/comms/ComposeWizard.tsx`'s merge-field validation
  rejected a body containing `{{firstName}}` for at least one recipient
  in one exploratory attempt ("One or more recipients are missing merge
  fields") — worked around by using a plain-text body instead, since
  `app/src/pages/comms/**` is not in this lane's owned file list and the
  invite flow itself (UID/SEQUENCE/LOCATION) was unaffected. Not filed as
  a hard OPEN ITEM since it wasn't reproduced as a confirmed defect (could
  be correct behavior — the merge-field set may legitimately not include
  `firstName` for the participant-shaped recipient used here) and is
  outside J9/DEC-007 scope; flagging only as a note for whichever lane
  next touches Comms.

OPEN ITEMS: 0
RESULT: PASS
