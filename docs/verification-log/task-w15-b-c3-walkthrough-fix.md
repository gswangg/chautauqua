# task-w15-b - walkthrough probe repair (DEC-326) @ f0d56ce

FROZEN SHA: f0d56ce (scribe wave 15, branch point for this worktree)
OPEN ITEMS: 1
RESULT: PARTIAL (both assigned stale probes repaired and proven; one
  pre-existing, out-of-scope test defect in `public.ts` newly reached and
  logged, not fixed)
RECHECK SHA: c47fe7b (this task's commit on branch task-w15-b)

## Scope

Per DEC-326 / task-w15-b: repair the two stale walkthrough probes named in
this task (`scripts/walkthrough/producer.ts` J5 hardcoded slot date,
`scripts/walkthrough/public.ts` J10 Settings embed-generator check reading
a decomposed-away `Settings.tsx`). `scripts/` only, no `src/` changes.

## Setup

- `npm ci --prefer-offline --no-audit --no-fund --silent` — clean install.
- `npm run build` (`tsc --noEmit` x2 + `vite build`) — PASS.
- `npm test` (vitest) — 226 files / 1885 tests, ALL PASS (no test touched
  by this lane; confirms the two script edits don't regress anything
  covered by the suite — the walkthrough scripts aren't part of `npm test`).
- `rm -rf .wrangler/state`
- `npm run db:migrate` — 17 migration files applied (0000..0017, no 0011,
  matches the established numbering gap), all ✅.
- `npm run seed` — OK, `seed-r2: put 8 object(s) into local R2 bucket
  'chautauqua-files'`.
- `cp .dev.vars.example .dev.vars`, `PUBLIC_BASE_URL` adjusted to
  `http://localhost:8795` per this wave's assigned port (w15-b=8795,
  per field guide "Ports this wave").
- `npx wrangler dev --port 8795` — came up clean, `GET /health` ->
  `{"ok":true}`.

## Fix 1: producer.ts J5 stale slot date

`scripts/walkthrough/producer.ts:651-656` hardcoded `day: "2027-09-01"`
for the J5 ICS-scheduling slot PUT against the seeded `devflow-conf-2027`
event, whose actual window is `2027-05-12..2027-05-14`
(`scripts/seed.ts:287-288`). Fixed by threading the event's own
`startDate` in:

- `runJ5` gained an explicit `eventStartDate: string` parameter (inserted
  between `eventId` and `capEventId`).
- The slot PUT body now uses `day: eventStartDate` instead of the literal.
- The call site in `main()` (`await runJ5(organizerJar, seededEvent.id,
  seededEvent.startDate, capEventId)`) passes `seededEvent.startDate`,
  already held from the `GET /api/v1/events` fetch earlier in `main()`.

Checked whether the same handler also schedules against `capEventId` (the
overflow event created at `seedOverflowEvent`, its own
`startDate: "2027-09-01"`/`endDate: "2027-09-03"`): `grep -n 'day:'` over
the whole file confirmed exactly one slot-scheduling call in the file
(the one fixed above); the `capEventId` overflow-cap compose
preview/send calls (lines ~630-642) never call `PUT .../slot`, so no
second date needed threading. No new literal date was hardcoded.

## Fix 2: public.ts J10 Settings embed-generator check

`scripts/walkthrough/public.ts:517-529` read
`app/src/pages/Settings.tsx` looking for the `/embed/` URL-building
logic, but that logic was decomposed out (`app/src/pages/settings/
embedSnippet.ts` owns `buildEmbedUrl`, `app/src/pages/settings/
EmbedsPanel.tsx` renders it; `Settings.tsx` now only mounts
`<EmbedsPanel />`). Retargeted the static assertion:

- Asserts `Settings.tsx` still mounts `<EmbedsPanel`.
- Asserts `embedSnippet.ts` contains the `/embed/${slug}/${surface}`
  path template (DEC-289 anchor) and the `.json` suffix used for the
  json embed format.
- Asserts `EmbedsPanel.tsx` actually calls `buildEmbedUrl` (proves the
  panel is the live consumer, not a dead file).
- Kept the live fetch probe unchanged:
  `${BASE_URL}/embed/${EVENT_SLUG}/sessions` -> expect 200.

## Verification: producer module, full run (proves J5 now completes)

```
Running J1 (launch a CFP)...
  ok
Running J2 (public submit + claim) against devflow-conf-2027...
  ok
Running J3 (triage at volume) against devflow-conf-2027...
  ok
Seeding the >100-recipient overflow fixture...
  ok
Running J5 (compose: merge fields, cap, ICS, HTML escaping) against devflow-conf-2027...
  ok
Running DEC-175 authz probes (unauthenticated requests)...
  ok

producer walkthrough OK (J1, J2, J3, J5)
```

`npx tsx scripts/walkthrough/producer.ts --url http://localhost:8795`
exits 0. J5's templates/merge-field/100-cap/real-send+ICS/HTML-escaping
assertions all ran for the first time and all passed (previously the
module aborted on the very first J5 HTTP call, per
`task-w13-b-c3-walkthrough.md` OPEN ITEM 1).

## Verification: public module — reaches and passes the retargeted check, then hits a newly-reached OPEN ITEM

`npx tsx scripts/walkthrough/public.ts --url http://localhost:8795`
tail (last lines before the module aborts):

```
ok   J10 /embed/devflow-conf-2027/sessions renders chromeless, no frame-blocking headers
ok   J10 /embed/devflow-conf-2027/speakers renders chromeless, no frame-blocking headers
ok   J10 /embed/devflow-conf-2027/agenda renders chromeless, no frame-blocking headers
ok   J10 /embed/devflow-conf-2027/schedule renders chromeless, no frame-blocking headers
ok   J10 /embed/devflow-conf-2027/gallery renders chromeless, no frame-blocking headers
ok   J10 Settings embed-generator snippet URLs match live /embed routes
ok   J10 visibility gate: non-accepted submission is absent from every surface
ok   J10 visibility gate: accepted-but-content-unapproved session is absent from every surface
FAIL [J10 visibility gate: hidden participant is absent from every surface]: visibility gate leak: 'Wk HiddenSpeaker Marker 1786477323724' found in raw HTML of /e/devflow-conf-2027/sessions
```

Exit code 1 (`check()` throws on first failure, aborting the module, same
pattern as `task-w13-b-c3-walkthrough.md`). The retargeted "J10 Settings
embed-generator..." check (this task's Fix 2) itself PASSES, and 27
`ok` lines run before this point — proving Fix 2 works and the module now
runs well past its old abort point (`task-w13-b-c3` never got here; it
aborted at the exact check this task repaired).

## OPEN ITEM 1 (newly reached, out of this task's scope — NOT a product defect, NOT fixed)

`scripts/walkthrough/public.ts:604-650`, the check "J10 visibility gate:
hidden participant is absent from every surface", asserts that hiding a
submission's only participant (`PATCH
/api/v1/submissions/:id/participants/:participantId {visible:false}`)
removes the *entire submission* — including its title, used as `marker`
— from every public/embed surface (`assertAbsentEverywhere(marker, id)`
at line 650, whose loop body at lines 568-580 checks `!html.includes(marker)`
for every surface).

This premise contradicts **DEC-274**, which is binding and explicitly
documents the opposite as intentional, current behavior:
`src/server/repo/public.ts:1-17` states session-rooted public queries
(`/sessions`, `/agenda`, `/schedule`, `/gallery`, embeds) use
`visibleSessionConditions()` alone (`submission.status='accepted' AND
submission.content_status='approved'`, no reference to participant) and
left-join participant, so "a session with zero participants, or whose
participants are all hidden, is still publicly visible with
`speakers: []`" — DEC-274.md's own text: "a TBA keynote or a session
whose speaker is not yet announced must still appear on the program with
an empty speaker line," fixing an earlier bug where such sessions
silently vanished. The submission's *title* (`marker` in this test) is
therefore expected to keep appearing on `/sessions` etc. even after its
only participant is hidden — only the participant's *name* should stop
appearing (verified separately: speaker-rooted queries, e.g.
`getPublicSpeakers`/`getPublicSpeakerDetail`, DO apply the composite gate
and would correctly drop the hidden speaker).

This is a stale/incorrect test assumption in `public.ts`, not a product
regression — the code is working exactly as DEC-274 specifies. It was
never reached before this task's fixes (both `task-w13-b-c3-walkthrough.md`
and this task's own pre-fix run aborted earlier, at the Settings check
this task repaired). Fixing this check is outside this task's assigned
scope (only the two named probes: producer.ts J5 date, public.ts Settings
embed-generator check) and would require changing the test's fixture
setup/assertion, which risks second-guessing intended design without a
decision authorizing it. Left untouched per instruction (no assertion
weakened, no src/ touched); flagged here for the planner to assign as a
follow-up narrow-fix task. Its presence blocks the remaining downstream
checks in `public.ts` (from line 651 onward — the DEC-108/DEC-112
invite-visibility gate and everything after) from running in this pass.

## POST-S DELTA

`git -C /Users/wednesdayniemeyer/Documents/gniemeyer/Projects/chautauqua log --oneline f0d56ce..main -- src app migrations scripts test`:

```
8c90b60 Fix schedule.ics empty-agenda bug and public onError cache leak (DEC-323, DEC-324)
```

One commit landed on `main` after this worktree's branch point, already
covered by the field guide (DEC-323/324, the whole-agenda `schedule.ics`
fix and the public `onError` cache-header fix) — unrelated to this task's
two assigned probes and to OPEN ITEM 1 above. Per DEC-280 a non-empty
delta is never a STOP; noted for completeness only.

## Cleanup

`wrangler dev` on port 8795 stopped after the run. `.dev.vars` remains
gitignored (not committed). No side effects left in the shared repo
(worktree-local `.wrangler/state`, D1, R2 only).
