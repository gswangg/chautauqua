## 2026-08-15 task-w42-e — gate-gap adjudication @ 824aac9b

QUALIFYING (this scope classifies to null under `classifyScope` — no
triage/perf/walkthrough/spec-audit/build+test token — deliberately: this
is an ADJUDICATION lane, not a fifth exit-predicate slot)

INVALIDATED BY: src/** app/src/** migrations/** package.json

DEC-644 three-sha boundary: HEAD `824aac9b` ("merge-train: annotate
outerEnv() return as NodeJS.ProcessEnv so delete typechecks"), confirmed
via `npm run ref-state`, `main` an ancestor of HEAD.

Full detail: docs/verification-log/task-w42-e-gate-gap-adjudication-824aac9b.md

FILE, NEVER FIX (frozen wave, DEC-453) — adjudicates the two gate-found
product gaps named by section 0195 (`autoSchedule320` FAIL,
task-w36-f) and section 0197 (`resolveBaseUrl` OPEN ITEM, task-w37-d) that
no lane has owned since.

ROW 1 (0195 `autoSchedule320`, unplacedTotal=298 vs reasons.length=237) —
**CONFIRMED-DEFECT.** Traced algebraically: `autoSchedule()`
(src/domain/schedule.ts:438-528) gives every element of its `sessions`
input exactly one placed-or-unplaced outcome (the `for (const session of
ordered)` loop at :468 has no early return, no skip), so
`unplacedFromRun.length` is exactly `sessions.length - newlyPlaced.length`
by construction, and `runAutoSchedule` (src/server/repo/agenda/
auto-schedule.ts:39-169) reports every one of those via `unplacedReasons`
(:158-166, plus `cappedUnplaced` for the write-cap tail, :151-157) — no
row is silently dropped from the REASONS side. The gap is upstream, in
what `sessions` even contains: `runAutoSchedule`'s `existing` filter
(auto-schedule.ts:58-59) is `s.slot !== null` with NO day-range check, so
ANY accepted session that already has a `schedule_slot` row — even one
whose `day` now falls outside the event's current window — is classified
"existing" (already placed) and excluded from `unscheduledAccepted`
(:70), hence never enters `sessions`, hence can never earn a reason.
`getAgendaPayload` (src/server/repo/agenda/payload.ts:58-83) uses a
DIFFERENT, stricter placed test — `s.slot && isDayWithinEventRange(...)`
(:59) — so an out-of-window-slotted session is NOT counted placed there;
`scheduleSummary` (src/domain/schedule.ts:397-407) then reports it as
`unplaced` in `summary.unplaced` (the walkthrough's `unplacedTotal`).
Units mismatch, not an instrument bug: `unplacedTotal` (payload,
window-aware) counts sessions genuinely unplaced-or-orphaned;
`reasons.length` (auto-schedule run, window-blind) counts only sessions
the run itself was given a chance to place. The 61-row delta is exactly
the count of accepted sessions whose existing `schedule_slot.day` lies
outside `[event.startDate, event.endDate]` at scale-battery seed time.
This is the SAME "slot survives outside the window" state DEC-844 already
names and requires the product to surface (`unscheduledByWindow` on
PATCH /events/:eventId) — auto-schedule's `existing`/`unscheduledAccepted`
split is the one place left that still treats an out-of-window slot as
"placed", contradicting DEC-844's own premise that such a slot "silently
vanishes from the public agenda" and must be treated as unscheduled.
CONFIRMED-DEFECT. Minimal fix direction: reuse `isDayWithinEventRange`
(already imported by payload.ts, not yet by auto-schedule.ts) to split
`accepted` the same way in auto-schedule.ts — an out-of-window slot moves
from `existing` into `unscheduledAccepted`/`sessions`, so the run either
re-places it (freeing the write-cap-aware paths already in place) or
reports one of the existing named reasons for it; no new reason vocabulary
needed. Wave-43 owner: `src/server/repo/agenda/auto-schedule.ts` (touches
only that file + its test). `test/schedule-unplaced-reasons.test.ts`
(read in full, 125 lines) does NOT cover this parity gap — every case in
it calls the pure `autoSchedule()`/`describeUnplaced()` functions directly
with hand-built `existing`/`sessions` arrays; none of its cases build an
`accepted` row with an out-of-window `slot` and drive it through
`runAutoSchedule`'s own existing/unscheduled split, so the gap this row
adjudicates is untested, not merely under-tested.

ROW 2 (0197 `resolveBaseUrl` OPEN ITEM) — **DEV-ONLY CONFIGURATION
FOOTGUN, not a stage-1 product defect.** Read `resolveBaseUrl` and
`firstLoopbackCandidate` in full (src/server/origin.ts:107-136,168-182).
Outside dev mode the function ALWAYS either uses a configured
`PUBLIC_BASE_URL` verbatim or throws (fail loudly) if unset (:123-128) —
production/deployed links are never at risk; a non-loopback
`PUBLIC_BASE_URL` "always wins outright" by explicit design (:84-85,
:111-115). The exposure 0197 names only fires when ALL of these hold at
once: `DEV_MODE === "1"`, `wrangler.jsonc` carries a `routes`/
`custom_domain` entry (the file's own header comment at :3-4 names this
"the operator's own host; human stage-2 wiring, untouchable"), the caller
is a scripted fetch under that route-shadowed `wrangler dev` (so no
loopback request-URL origin, `Origin`, or `Referer` is observable), and
the checked-in `.dev.vars` default happens to be loopback but on a
different port than the operator is actually running on. SPEC §8's
canonical local flow is `npm i && ... && npm run dev` (SPEC.md:361) with
no route/custom-domain entry in play; the `routes`/`custom_domain`
wiring this footgun depends on is exactly the "platform wiring" SPEC's
M4 milestone assigns to the stage-2 swarm (SPEC.md:409: "stage-2 swarm:
platform wiring + deploy (provision, Resend key, `wrangler deploy`)").
docs/clarifications.md:33's framing for the analogous email case — "Stage
1 builds the full comms surface against a dev sink; the real provider is
stage-2 wiring" — applies the same way here: the REAL origin for any real
deployment is exactly what stage-2's provisioning fixes by setting
`PUBLIC_BASE_URL` to the actual served host, which this code already
requires and enforces outside dev mode. Widening `firstLoopbackCandidate`
to trust more of the request as 0197's own candidate fix directions
propose would also cut against DEC-296's deliberate, already-amended
(wave 38) safety gating that keeps attacker-supplied headers out of
mailed links — the narrower dev-only surface is the intended shape, not
an oversight. NOT a CONFIRMED-DEFECT; classified out of stage-1 scope.
The `scripts/walkthrough.ts` pre-flight (task-w37-d) remains the correct
stage-1-scope mitigation for the one caller stage-1 code actually ships
(the walkthrough/harness); a human or scripted client bypassing that
pre-flight during local swarm development is a dev-workflow risk, not a
product one.

0195's other two counted OPEN ITEMS, same classes:
- perf-smoke harness gap (`e963d388`, wave-35): CONFIRMED-DEFECT, but
  scoped entirely to `scripts/**` (perf-seed.ts never wired to
  perf-seed-lib.ts's new perf-speaker fixture rows, per that commit's own
  message) — no `src/**`/`app/src/**` change needed, so it is fixable
  inside a future FROZEN-wave-compatible scripts-only lane rather than
  waiting on a code wave. Wave-43 owner: `scripts/perf-seed.ts`.
- `plan progress (page 1)` perf-smoke FAIL by 0.6ms adjusted (53.2ms raw
  / 50.6ms adjusted vs 50ms read budget) — logged by 0195 itself as
  "non-mandate observation... not this task's scope", and the SAME row
  `task-w35-a` (wave 35, `a0b8501b`) already flagged as unstable across
  runs (1 of 3 FAILed there too, at 60.0ms, under the smaller `default`
  profile). Classified ADVISORY / marginal-and-noisy, not adjudicated as
  a CONFIRMED-DEFECT by this row — a fresh measurement (not a code read)
  would be needed to separate real regression from run-to-run noise
  before naming a fix owner; route named for whichever wave picks this up:
  `src/routes/review/plans-progress.ts`.

RESULT: FAIL — 2 CONFIRMED-DEFECT items remain open (autoSchedule320
window-blind `existing` filter; perf-seed.ts perf-speaker wiring gap);
`resolveBaseUrl` OPEN ITEM reclassified NOT-A-DEFECT (dev-only footgun,
stage-2 resolves it); `plan progress` FAIL left ADVISORY, unadjudicated.
OPEN ITEMS: 2
