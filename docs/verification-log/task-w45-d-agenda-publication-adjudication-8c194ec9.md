# task-w45-d — agenda/publication adjudication @ 8c194ec9

FILE, NEVER FIX (DEC-069 w45). Scope: `src/server/repo/agenda/auto-schedule.ts`
(J9 fail-loud invariant reachability), `src/mail/ics.ts` +
`src/server/repo/ics-sequence.ts` + `src/routes/public/feeds.ts` (J10 UID/
SEQUENCE stability), `src/routes/public/index.tsx` (J10 cancellation
behavior). No file under `src/**`/`app/src/**`/`migrations/**`/`package.json`
was touched to produce this adjudication.

## Claim 1 — J9 fail-loud invariant, `auto-schedule.ts:193-198`

**Verdict: CONFIRMED-DEFECT.** State IS reachable.

Trace (current code, all line numbers `src/server/repo/agenda/auto-schedule.ts`
unless noted):

1. `accepted = loadAcceptedSessions(...)` (:54) snapshots the DB. Session `S`
   has `slot === null` at this instant, so it lands in `unscheduledAccepted`
   (:89) and is handed to `autoSchedule()` (:100-116) as one of `sessions`.
2. `autoSchedule()` (pure, `src/domain/schedule.ts`) places `S` in its
   `result` — S is genuinely placeable given the snapshot it was given.
3. **Concurrently**, a second write (a manual `PUT .../slots/:submissionId`
   via `upsertSlot`, `src/server/repo/agenda/slots.ts:45-79`, which is a
   plain `INSERT ... ON CONFLICT DO UPDATE` on `scheduleSlot.submissionId`
   with zero re-validation of `event.startDate/endDate` inside the
   transaction — the route's `isDayWithinEventRange` check at
   `src/routes/agenda.ts:93` runs once, before the write, against whatever
   the event's window was at THAT request's read time) commits a
   `schedule_slot` row for the SAME `S`, with a `day` that is outside the
   event's CURRENT window. This is reachable without even needing a second
   auto-schedule call: an organizer's manual drag-drop request racing a
   concurrent `PATCH /events/:eventId` window-narrowing request (DEC-844)
   is enough — the PUT's own range check ran against the pre-PATCH window.
4. Back in `runAutoSchedule`: `S` is in `allNewPlacements` (:119, not in
   `existingIds` since `S` had no slot at :54's read) and (assuming the
   ~2000-row write cap isn't hit) in `newPlacements`, not `cappedPlacements`.
5. The insert at :143-147 attempts to write `S`'s computed placement, but
   `onConflictDoNothing({ target: scheduleSlot.submissionId })` (:146)
   silently skips it — a row for `S` already exists (from step 3). `S` is
   NOT added to `writtenSubmissionIds` (:148).
6. `payload = getAgendaPayload(db, eventId, event)` (:158) issues a FRESH
   read (`payload.ts:40-52`) that now sees the step-3 row. Since that row's
   `day` is outside the event range, `payload.ts:59`'s
   `isDayWithinEventRange` test is false, so `S` is NOT pushed to `placed`
   (`payload.ts:60-78`) — it falls to `unscheduled` (`payload.ts:79-87`).
   `scheduleSummary` (`src/domain/schedule.ts:406-416`) computes
   `unplaced = totalAccepted - placedIds.size`, and `S` is not in
   `placedIds`, so `payload.summary.unplaced` counts `S`.
7. `unplacedReasons` is built at :177 as
   `[...unplacedFromRun, ...cappedUnplaced, ...outOfRangeUnplaced]`.
   - `unplacedFromRun`: `S` is NOT here — `autoSchedule()` placed it
     successfully at step 2 (its own snapshot had no conflict).
   - `cappedUnplaced`: `S` is NOT here — it was in `newPlacements`, not
     `cappedPlacements` (step 4).
   - `outOfRangeUnplaced` (:84-87): built from `outOfRangeSlotted`, which is
     filtered from `slotted` (:64-66), which is filtered from `accepted`
     — the STALE :54 snapshot, taken BEFORE the step-3 write. `S` had
     `slot === null` in that snapshot, so `S` is not in `slotted` and
     therefore not in `outOfRangeUnplaced` either.
8. `S` is in none of the three lists, so `unplacedReasons.length` is one
   short of `payload.summary.unplaced`. The `!==` check at :193 fires and
   line 194 throws a raw `Error` — Hono's default error handling turns an
   uncaught `Error` into a 500, so the organizer who merely clicked
   "auto-schedule" (a normal, everyday action) gets a server error caused
   entirely by an unrelated concurrent write they have no visibility into.

**Symmetric case (concurrent slot IS in range):** step 6 changes — `S`'s
step-3 row now passes `isDayWithinEventRange` at `payload.ts:59`, so `S` IS
pushed to `placed` and is NOT counted in `payload.summary.unplaced`. `S`
contributes 0 to both sides of the :193 comparison (absent from
`unplacedReasons`, absent from the unplaced count) — no mismatch, no throw.
**Verdict for the symmetric case: not defective** — the in-range race
resolves silently and correctly because the fresh :158 read is authoritative
and `S`'s reason-list absence doesn't matter when it isn't unplaced.

**User-visible harm:** a 500 response to a normal organizer action
(auto-schedule), triggered by an ordinary concurrent write (a manual
drag-drop, or a window-narrowing PATCH landing between another request's
range check and its commit) — not a malicious or contrived input.

**Fix direction (not applied — FILE, NEVER FIX):** the invariant compares a
STALE reason accounting (`outOfRangeUnplaced`, sourced from the :54
snapshot) against a FRESH classification (`payload`, sourced from a :158
re-read). Either (a) derive `outOfRangeUnplaced` from a re-read taken AFTER
the writes at :143-147 land (mirroring the payload's own timing), or (b)
loosen the invariant to tolerate submissions whose slot changed underneath
the run (diff `payload.unscheduled` ids against the three reason lists and
synthesize a `race_lost_to_concurrent_write` reason for any id present in
neither), so the 500 becomes a correctly-labeled unplaced reason instead of
an organizer-facing crash. Suggested wave-46 owner:
`src/server/repo/agenda/auto-schedule.ts` (touches only that file + its
test, mirroring the shape of the already-fixed wave-42→43 defect at rows
0213/0215).

**Not previously filed:** this is distinct from the wave-42/43
`autoSchedule320` defect (0213/0215, `main` window-blind `existing` filter)
— that defect is CONFIRMED FIXED on this HEAD: `auto-schedule.ts:64-68` now
splits `slotted` into `inRangeSlotted`/`outOfRangeSlotted` via
`isDayWithinEventRange`, exactly the fix 0213 prescribed. This adjudication
is a NEW race-condition-shaped gap in the now-fixed code, not a re-file of
the old one.

## Claim 2 — J10 .ics stable UIDs / SEQUENCE

**Verdict: CONFIRMED, no defect. UID is stable and shared across all three
producers; SEQUENCE is monotonic.**

- UID derivation: `uidFor(submissionId)` (`src/mail/ics.ts:115-117`) returns
  `` `chq-${submissionId}@chautauqua` `` — keyed purely on the DB primary key
  of the submission row, which is immutable. Room (`scheduleSlot.roomId`),
  time (`startMin`/`endMin`/`day`), and title (`submission.title`) are all
  mutable fields that never enter the UID computation, so a room change, a
  time change, a title change, and re-publication all leave the UID
  unchanged — confirmed by inspection, no code path derives UID from any of
  those three fields.
- Same UID across all three producers, each cited at its call site:
  - compose attachment: `src/routes/comms/send.ts:208`
    (`uidSubmissionId: rendered.submissionId`)
  - agenda.ics / schedule.ics (share one mapper): `agendaIcsEvents`
    (`src/routes/public/feeds.ts:190-201`, `uidSubmissionId: item.submissionId`
    at :192), called from `src/routes/public/index.tsx:390` (schedule.ics)
    and `:416` (agenda.ics) — both route handlers pass through the identical
    mapper, per the code comment at `feeds.ts:186-189` ("mirrors ...
    schedule.ics handler") and `index.tsx:405-408` ("same UIDs/SEQUENCE as
    schedule.ics").
  - all three feed `uidSubmissionId` values trace to `submission.id` /
    `PublicAgendaItem.submissionId`, which is the same column.
- SEQUENCE monotonicity: `submission.icsSequence` is the ONE field read into
  every `IcsEventInput.sequence` (`send.ts:209` `slot.icsSequence`;
  `feeds.ts:193` `item.icsSequence`). It is written EXCLUSIVELY through
  `bumpIcsSequences`/`bumpIcsSequencesForRoom`/`bumpIcsSequencesForEvent`
  (`src/server/repo/ics-sequence.ts:15-25,33-47,59-74`), each an atomic
  `UPDATE ... SET ics_sequence = ics_sequence + 1` (:22,37,63) — additive
  only, no code path in the tree sets `icsSequence` to a literal or resets
  it. Monotonic per UID by construction.

## Claim 3 — cancellation on unschedule / content-unapprove

**Verdict: DELIBERATE-BY-DESIGN, not a defect.**

At `src/routes/public/index.tsx:365-398` (schedule.ics) and `:409-420`
(agenda.ics), both handlers source their VEVENT list from
`getPublicAgenda`/`getPublicAgendaByIds`, which already apply the single
shared visibility gate (DEC-022: `submission.status='accepted' AND
submission.content_status='approved' AND participant.visible=1`, enforced
in SQL). A session that is unscheduled (its `schedule_slot` row deleted via
`unscheduleSlot`, `src/server/repo/agenda/slots.ts:81-84`) or whose content
is un-approved simply no longer satisfies that query, so it is absent from
`agenda`/`agendaById` on the NEXT feed fetch — no VEVENT is emitted for it,
and none is emitted with `STATUS:CANCELLED`/`METHOD:CANCEL` either. The
in-code comment at :374-377 states this is intentional: "a submission id
that isn't in `agendaById` is either unscheduled or no longer publicly
visible, and is silently dropped from the export (a stale itinerary link
never leaks a hidden session)." This is consistent with DEC-022's own
premise ("visibility is enforced once... impossible to leak hidden content
through") and with SPEC J10's closing sentence ("Only accepted + visible +
content-approved records render, enforced in the query") — neither DEC-022
nor SPEC.md names `METHOD:CANCEL`/`STATUS:CANCELLED` as a requirement, and
emitting one would require re-serializing the hidden session's title/time
into a feed response specifically to announce its removal — the opposite of
DEC-022's leak-proofing goal for content that failed the visibility gate
(e.g. a rejected/un-approved submission). No SPEC/DEC clause is violated by
the silent-drop behavior; not filed CONFIRMED-DEFECT.

**Caveat (advisory, not a defect):** subscribers who already imported a
VEVENT (via `.ics` download or a standing subscription URL) get no explicit
signal that a specific event vanished — most calendar clients will simply
leave the stale imported copy in place until the user re-imports, since a
"disappear from the next full feed fetch" model has no cancellation carrier
in a one-shot download flow (schedule.ics/agenda.ics are not push
subscriptions in stage 1). This is a UX gap, not a SPEC/DEC violation — no
clause requires push-style CANCEL semantics, and DEC-022's Stage-1 caching
section explicitly accepts "bounded 60s staleness" as the stage-1 contract
for these surfaces generally, so a stale downloaded snapshot is within the
system's already-accepted staleness model. Recorded here as a note for a
future wave, not filed as an OPEN ITEM.

## Targeted tests (DEC-644 w45)

`npm run test:targeted -- test/ics-sequence-bumps.test.ts
test/ics-sequence-bump.test.ts test/ics-crlf-escaping.test.ts
test/ics-text-control-bytes.test.ts test/ics-download.test.ts
test/compose-ics.test.ts test/schedule-ics-id-scoped.test.ts
test/public-ics-unconfigured.test.ts test/resolve-ics-organizer-email.test.ts
test/agenda-unplaced-accounting.test.ts test/auto-schedule-persistence.test.ts
test/auto-schedule-breaks.test.ts test/agenda-auto-schedule-params.test.ts`
(13 files, 15-file cap respected)

Result: `Test Files  13 passed (13)` / `Tests  153 passed (153)`. None of
these 153 tests exercises the claim-1 concurrent-write race (confirmed by
reading the full list of file names — every one either drives
`autoSchedule()`/`describeUnplaced()` directly with hand-built inputs, or
exercises the write-cap path, or the ics text/sequence pure builders) — the
gap this adjudication files is untested, not merely under-tested, matching
the same characterization 0213 gave its own row 1.

## RESULT

RESULT: FAIL — 1 CONFIRMED-DEFECT item remains open (claim 1: J9
`unplacedReasons`/`payload.summary.unplaced` fail-loud invariant reachable
via a concurrent-write race at `auto-schedule.ts:54` vs `:143-147` vs
`:158`, 500 to the organizer, not yet owned by any wave-46 lane). Claims 2
and 3 adjudicated CONFIRMED (no defect) and DELIBERATE-BY-DESIGN
respectively.
OPEN ITEMS: 1
