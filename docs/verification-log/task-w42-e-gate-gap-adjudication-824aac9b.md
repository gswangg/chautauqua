# task-w42-e — gate-gap adjudication @ 824aac9b (full detail)

Frozen wave (DEC-453): FILE, NEVER FIX. No `src/**`, `app/src/**`,
`migrations/**`, or `package.json` edits in this branch. This lane is the
exclusive owner of index sections 0195 and 0197 this wave (DEC-358 w42).

## Step 0 receipt

`git merge --no-edit main` inside the worktree: "Already up to date."
(HEAD `824aac9b` already carries `main`'s tip.)

`npm run ref-state`:

```
DEC-644 three-sha boundary: HEAD `824aac9b3126b1a5c17ba46c5a7d153db106ed54`;
newest first-parent product-code-bearing sha `ed5c679e59828c5600cb84b51208056f7e38a445`;
every live ref (`main`, `manual-qa`, `task-custodian-w68-4`, `task-w40-e`,
`task-w40-g`, `task-w41-c`, `task-w42-c`, `task-w42-e`, `task-w68-d`,
`task-w71-c`, `task-w71-d`, `task-w71-e`) confirmed an ancestor of HEAD via
`git merge-base --is-ancestor`. NON-ancestor refs: `mail-rich-shape-fallback`,
`task-w17-i`, `task-w41-a`, `task-w41-b`, `task-w41-d`, `task-w41-e`,
`task-w41-f`, `task-w42-a`, `task-w42-d`, `task-w68-b`, `task-w68-c`,
`task-w68-e`, `task-w71-a`, `task-w72-a`..`task-w72-j`.
```

`npm run verification-log:assemble` re-run and the regenerated
`docs/verification-log.md` committed alongside this section.

## ROW 1 — `docs/verification-log/index/0195-...md:42-56`, `autoSchedule320` FAIL

Question asked: which accepted sessions land in the payload's `unplaced`
count but never enter `sessions` (so can never appear in
`unplacedReasons`)?

Files read in full:
- `src/server/repo/agenda/auto-schedule.ts` (169 lines, all of
  `runAutoSchedule`).
- `src/server/repo/agenda/payload.ts:1-102` (`getAgendaPayload`).
- `src/domain/schedule.ts:394-528` (`scheduleSummary`, `autoSchedule`).
- `src/server/repo/agenda/rows.ts:1-100` (`loadAcceptedSessions`,
  `MAX_AGENDA_SCAN`).
- `test/schedule-unplaced-reasons.test.ts` (all 125 lines).
- `decisions/DEC-844.md` (all four sections, including the wave-68
  amendment).

### The proof, algebraically

`autoSchedule()` (`src/domain/schedule.ts:438-528`) processes every
element of its `sessions`/`ordered` input in one `for` loop (:468-525)
with no early return and no `continue` that skips recording an outcome —
every session is pushed into exactly one of `placed` or `unplaced`
(:474, :478, :497-500, or :512 via the fallthrough). So, given
`{placed, unplaced} = autoSchedule({sessions, ...})`:

```
unplaced.length === sessions.length - (placed.length - existing.length)
```

`runAutoSchedule` (`auto-schedule.ts:88-97`) calls exactly this with
`sessions = unscheduledAccepted.map(...)` (:81-86) and reports
`unplacedFromRun` (renamed from the destructured `unplaced`) verbatim into
`unplacedReasons`, plus `cappedUnplaced` for anything past
`MAX_AUTO_SCHEDULE_PLACEMENTS` (:151-157, :158-166) — so nothing computed
by `autoSchedule()` is lost between the engine and the response; the
REASONS side is complete for whatever `sessions` it was given.

The gap is entirely in what populates `sessions`:

- `auto-schedule.ts:58-59`:
  ```
  const existing: PlacedSession[] = accepted
    .filter((s): s is AcceptedSessionRow & { slot: NonNullable<...> } => s.slot !== null)
  ```
  This is the ONLY test used to decide a session is "already placed" —
  it checks `slot !== null` and nothing about which day the slot falls
  on.
- `auto-schedule.ts:70`: `unscheduledAccepted = accepted.filter((s) => s.slot === null)` —
  the complement of the same slot-null test, so `sessions` (built at
  :81-86 from `unscheduledAccepted`) never contains a session whose slot
  is non-null, REGARDLESS of whether that slot's day is inside the
  event's current window.

Compare `getAgendaPayload` (`payload.ts:58-83`), which computes the
post-run `placed`/`unscheduled` split used for `summary.unplaced`:

- `payload.ts:59`: `if (s.slot && isDayWithinEventRange(s.slot.day, event.startDate, event.endDate))`
  — a STRICTER test: a session with a non-null slot whose `day` falls
  outside `[startDate, endDate]` is NOT counted `placed`; it lands in
  `unscheduled` (:76-83).
- `scheduleSummary` (`src/domain/schedule.ts:397-407`) then computes
  `unplaced: totalAccepted - placedIds.size` where `placedIds` comes only
  from the (window-filtered) `placed` array built by that stricter test.

So `summary.unplaced` (the walkthrough's `unplacedTotal`, read via
`res.json.summary.unplaced` at `scripts/walkthrough/stress.ts:225`)
counts every accepted session that is EITHER truly slot-less OR
slotted-but-outside-the-current-window; `unplacedReasons.length` (read at
`stress.ts:226`) counts only sessions that were truly slot-less AT THE
START of the run and therefore entered `autoSchedule()`'s `sessions`
input. The 61-row delta (298 - 237) is exactly the count of accepted
sessions whose `schedule_slot.day` lay outside the aie-scale event's
`[startDate, endDate]` window at seed time — a units mismatch between
"placed" as auto-schedule's persistence path defines it (has a slot row,
any day) and "placed" as the payload/summary path defines it (has a slot
row, AND that slot is inside the current window).

### Why this is a product gap, not just a naming mismatch

`decisions/DEC-844.md` establishes the product's own stance on this exact
state (a `schedule_slot` row surviving outside the event's current
window): it "silently vanishes from the public agenda, agenda.ics and
schedule.ics while the row still sits in D1" and the product now names
this state as unscheduled-by-window everywhere else that matters
(`unscheduledByWindow` on PATCH /events/:eventId; the wave-68 amendment
extends the same treatment to breaks). Auto-schedule's `existing` filter
is the one remaining place that still treats such a slot as "placed" for
purposes of deciding whether a session gets a chance to be (re)scheduled
or reported — which contradicts the payload/summary path it feeds into.
A session parked outside the window can never surface a reason, never
gets a chance at re-placement by `runAutoSchedule`, and yet DOES count
against `unplacedTotal` in every read of the agenda — a real, observable
inconsistency an organizer or the eval harness can see today, not an
artifact of how the walkthrough measures it.

CONFIRMED-DEFECT.

### Minimal fix direction (not implemented — frozen wave)

`auto-schedule.ts` already imports nothing from `./days`; add the same
`isDayWithinEventRange` import `payload.ts` uses and split `accepted` the
same way payload.ts does: an accepted session counts `existing` (already
placed, excluded from the run) only when `s.slot !== null &&
isDayWithinEventRange(s.slot.day, event.startDate, event.endDate)`;
everything else (slot-null OR slot-outside-window) becomes part of
`unscheduledAccepted`/`sessions`, so it either gets re-placed by this run
(freeing it from the stale out-of-window slot, consistent with DEC-844's
"never blocks" stance — a write, not a delete) or earns one of the
existing named `unplaced` reasons. No new reason vocabulary is required.
This keeps `sessions.length` and the window-aware `unplaced` definition
in the same units, closing the gap at the source rather than papering
over it in the walkthrough's grading.

Wave-43 owner: `src/server/repo/agenda/auto-schedule.ts` (plus its
existing test file, `test/schedule-unplaced-reasons.test.ts`, extended
with a case that builds an `accepted` row carrying an out-of-window slot
and drives it through `runAutoSchedule`, not just the pure
`autoSchedule()`/`describeUnplaced()` functions).

### Does `test/schedule-unplaced-reasons.test.ts` cover this?

No. Read all 125 lines: every `it(...)` case (`no_rooms_configured`,
`duration_exceeds_day`, `no_free_slot`, `speaker_double_booked`, plus the
four `describeUnplaced` copy tests) calls the pure `autoSchedule()` or
`describeUnplaced()` functions directly with hand-built `sessions`/
`existing`/`unplaced` arrays. None of them exercises
`runAutoSchedule`'s own `accepted` → `existing`/`unscheduledAccepted`
split, and none builds a session with a non-null, out-of-window slot. The
file covers per-reason copy/labelling only, not this parity.

## ROW 2 — `docs/verification-log/index/0197-...md:35-50`, `resolveBaseUrl` OPEN ITEM

Files read in full: `src/server/origin.ts` (183 lines — `resolveBaseUrl`,
`firstLoopbackCandidate`, `hostHeaderLoopbackOrigin`,
`resolveBaseUrlForCron`); `SPEC.md:359-388` (§8 Deployment & operations,
§9 Verification); `docs/clarifications.md:1-45`.

`resolveBaseUrl` (`origin.ts:107-136`):
- Non-dev (`DEV_MODE !== "1"`): a configured `PUBLIC_BASE_URL` is used
  verbatim (:111-115, non-loopback branch always wins outright per the
  function's own doc comment :84-85); if unset, it THROWS (:123-128) —
  fail loudly, never guesses from the request. Production/deployed links
  are never exposed to this footgun by construction.
- Dev-only (`DEV_MODE === "1"`): a LOOPBACK-valued `PUBLIC_BASE_URL` (the
  shipped `.dev.vars.example` default) is treated as a fallback, not an
  override — `firstLoopbackCandidate` (:168-182) is given the chance to
  supply a loopback origin actually observed on the request (request URL
  origin, `Host` header if itself loopback, `Origin` header, `Referer`)
  first.

The exposure 0197 names requires ALL of: `DEV_MODE=1`; a `wrangler.jsonc`
`routes`/`custom_domain` entry making `new URL(c.req.url).origin` resolve
to a non-loopback (production-shadowed) host under local `wrangler dev` —
the file's own header comment names this entry "the operator's own host;
human stage-2 wiring, untouchable" (`origin.ts:3-4`); a scripted caller
that sends no loopback `Origin`/`Referer`; and a `.dev.vars` default that
happens to be loopback but on the wrong port for that operator's actual
running instance. Under those conditions `firstLoopbackCandidate` finds
nothing, and `resolveBaseUrl` falls back to the configured (stale-port)
loopback `PUBLIC_BASE_URL` (:120) rather than throwing or guessing
further.

### Classification: DEV-ONLY CONFIGURATION FOOTGUN, not a stage-1 defect

- SPEC §8 (SPEC.md:359-369) states the canonical local flow as `npm i &&
  npm run db:migrate && npm run seed && npm run dev` — with no
  `routes`/`custom_domain` entry implied. The `routes`/`custom_domain`
  wiring this footgun depends on is exactly the "platform wiring"
  SPEC.md:409 (M4 milestone) assigns to "stage-2 swarm: platform wiring +
  deploy (provision, Resend key, `wrangler deploy`)".
- `docs/clarifications.md:33` states the general stage boundary for
  exactly this class of concern: "Stage 1 builds the full comms surface
  against a dev sink; the real provider is stage-2 wiring." The same
  boundary applies to resolving the REAL served origin for mailed links:
  stage-1's job is to require and correctly use a configured
  `PUBLIC_BASE_URL` outside dev (which `resolveBaseUrl` already does,
  fail-loudly, at :123-128); actually setting that value correctly for a
  real deployment is stage-2 provisioning's job.
- DEC-296 (cited at `origin.ts:9-10`, wave-38 amendment) deliberately
  restricts the loopback-sniffing fallback to gated, dev-loopback-only
  signals specifically so an attacker-supplied `Origin`/`Referer` can
  never poison a mailed claim link in production. 0197's own candidate
  fix directions (teach scripted callers to send a loopback header, or
  widen `firstLoopbackCandidate` under a dev-only signal) are both
  DEV-workflow changes, not product-code changes — the narrower surface
  today is the intended shape of DEC-296, not an oversight it left
  behind.
- This footgun cannot bite an end user or evaluator on the deployed
  product (non-dev path never falls back to guessing); it can only bite
  someone running the app locally under a specific swarm-development
  configuration (per-worktree ports plus a route-shadowing entry).

NOT-A-DEFECT for stage-1 scope. `scripts/walkthrough.ts`'s pre-flight
(task-w37-d) remains the right stage-1 mitigation for the one caller
stage-1 code ships against this footgun.

## 0195's remaining two OPEN ITEMS, same classes

- **perf-smoke harness gap (`e963d388`, wave-35).** Read the commit
  message in full: `scripts/perf-seed-lib.ts` gained a singleton perf-
  speaker fixture spec, but `scripts/perf-seed.ts` (the actual SQL seed
  script) was never updated to insert those rows, so `perf-smoke.ts`'s
  new `/portal` login step has nothing to authenticate against.
  CONFIRMED-DEFECT, but entirely within `scripts/**` — no `src/**` or
  `app/src/**` change is implicated, so a scripts-only lane (compatible
  even with a future frozen wave) can close it. Wave-43 owner:
  `scripts/perf-seed.ts` (wire in `perf-seed-lib.ts`'s new exports to its
  SQL statement list, per that commit's own flagged gap).
- **`plan progress (page 1)` perf FAIL by 0.6ms adjusted** (53.2ms raw /
  50.6ms adjusted vs the 50ms read-class budget). 0195 itself logs this
  as "non-mandate observation... not this task's scope," and the SAME row
  was already flagged unstable by `task-w35-a` (wave 35, `a0b8501b`, 1 of
  3 runs FAILed there too, at 60.0ms, under the smaller `default`
  profile) — i.e. this has read as marginal/noisy across two separate
  scale profiles and two separate readings, not as a clean, repeatable
  regression. Classified ADVISORY here: adjudicating "real regression vs.
  run-to-run noise" needs a fresh multi-run measurement, which is outside
  this FILE-NEVER-FIX lane's remit (no code was executed for this
  adjudication — see next section). Route named for whichever wave picks
  it up: `src/routes/review/plans-progress.ts` (`GET
  /api/v1/plans/:id/progress`).

## Method note

This adjudication is a pure code-reading exercise (per DEC-453 frozen
wave: FILE, never FIX, and no route was invoked) — the ROW 1 conclusion
follows from the loop invariant in `src/domain/schedule.ts:468-525`
(every session gets exactly one outcome) plus the two DIFFERENT
placed-tests in `auto-schedule.ts:58-59` vs `payload.ts:59`, which is
provable by reading the two conditionals side by side; no fixture run was
needed to derive the 61-row delta's SOURCE (though the aie-scale battery
already observed the delta's SIZE). ROW 2's conclusion follows from
reading `resolveBaseUrl`'s branches against SPEC §8/§9's stage boundary
prose and `docs/clarifications.md`'s stage-1/stage-2 framing.
