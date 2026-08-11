# task-w13-b - walkthrough @ f6983e6

FROZEN SHA: f6983e6 (scribe wave 13)
WAVE-12 GATE: PASS (all 7 anchors present on first check, no polling needed)
DRIZZLE-ORM AT S: 0.45.2 (package.json `"drizzle-orm": "^0.45.2"`, installed `node_modules/drizzle-orm/package.json` version 0.45.2; no `drizzle.config.ts`, no `drizzle-kit` dependency)
OPEN ITEMS: 3
RESULT: FAIL
RECHECK SHA: f6983e6 (no code changes made; log-only lane)

## Setup

- `npm ci --prefer-offline --no-audit --no-fund` — clean install.
- `npm run build` — OK, `public/admin` written (18 chunks, `vite build` succeeded).
- `rm -rf .wrangler/state`
- `npm run db:migrate` — 17 migration files applied (`0000_secret_matthew_murdock.sql` .. `0017_review_recusal.sql`, note `0011` does not exist in this numbering — not a gap, confirmed by `ls migrations/*.sql | wc -l` = 17, matching the migrate table output), all ✅.
- `npm run seed` — OK, `seed-r2: put 8 object(s) into local R2 bucket 'chautauqua-files'`.
- Server did not respond on `/health` until `.dev.vars` was created from `.dev.vars.example` (DEV_MODE=1, PUBLIC_BASE_URL adjusted to `http://localhost:8791`) — `.dev.vars` is gitignored and not present in a fresh worktree; this is expected local dev setup, not a defect (per DEC-183/296). `npx wrangler dev --port 8791` then came up; `GET /health` → `{"ok":true}` on first poll after `.dev.vars` was in place.

## WAVE-12 GATE (DEC-314), W1..W7

All anchors found immediately (no bounded poll needed):

- W1: `drizzle-orm` `^0.45.2` in package.json; no `drizzle.config.ts`; no `drizzle-kit` in package.json.
- W2: `PERF_CLASS_BUDGET_MS`/`gradePerfCheck` — defined in `scripts/perf-smoke-lib.ts`, imported by `test/perf-smoke.test.ts`.
- W3: `measureOverheadFloor` in `scripts/perf-smoke.ts:210`; `cls: "public"` used at `scripts/perf-smoke.ts:324,329,336`.
- W4: `getPublicAgendaByIds` defined `src/server/repo/public.ts:768`, imported and called from `src/routes/public/index.tsx:22,197`.
- W5: `<meta name="viewport" ...>` present in `src/routes/dev/mailbox.tsx` (both list and detail templates).
- W6: `/docs/api` and `/dev/mailbox` present in the render-sweep manifest (`test/render-sweep-lib.test.ts` and route references confirmed).
- W7: `ACTIVE_INVITE_STATUSES` defined `src/domain/acceptance.ts:80`, used in `src/server/repo/tasks.ts:14,365`; `src/routes/review/{index,plans,reviewer,recusals,shared}.ts` exist, `src/routes/review.ts` does not.

## Walkthrough — per-module results

The orchestrator (`npm run walkthrough`) runs modules sequentially and aborts the whole run at the first module failure, so after `producer` failed each remaining module (`review`, `speaker`, `public`, `data`) was invoked directly (`npx tsx scripts/walkthrough/<area>.ts --url http://localhost:8791`, same fixture/session helpers) to get all five per-module results, per this task's explicit ask. `scale` is a sixth module known to `scripts/walkthrough-lib.ts` (`WALKTHROUGH_AREAS`) but out of this task's scope (not named in the task's 5-module list) and was not run.

### producer — FAIL (1 open item)

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
FAILED: J5 PUT schedule slot (for ICS)
  expected status 200, got 400
  body: {"error":{"code":"invalid","message":"Slot day is outside the event date range","fields":{"day":"Outside 2027-05-12..2027-05-14"}}}
```

J1/J2/J3 pass (3/3 checks reached); J5 aborts on its first HTTP call. Not a 500/SQL/drizzle error — a domain-validation 400.

**OPEN ITEM 1**: `scripts/walkthrough/producer.ts` line ~652 hardcodes `day: "2027-09-01"` for the J5 ICS-scheduling slot PUT against `devflow-conf-2027`, whose seeded event date range is `2027-05-12..2027-05-14` (`docs/fixtures` seed via `scripts/seed.ts:286`). The API correctly rejects the out-of-range date (working as designed); the walkthrough fixture's hardcoded day is stale relative to the seeded event window. This blocks J5's ICS/compose assertions from running at all. Reproduced twice (identical failure both before and after an unrelated worktree-recreation event, see Notes). Out of this lane's scope to fix (scripts/ is forbidden for a log-only lane).

### review — PASS (all checks)

Full tail:
```
ok: DEC-175 reviewer PUT evaluation for an out-of-scope submission -> 404 (not 403)
ok: DEC-175 out-of-scope evaluation probe is not 403 (existence-hiding, not authz-denial)
ok: progress reflects the main reviewer's full completion
ok: progress reflects the second reviewer's partial completion (laggard)
ok: remind sends only to the laggard reviewer
ok: remind writes an email_log row for the laggard, none for the completed reviewer
ok: results are sorted by weighted aggregate score descending
ok: results CSV downloads with a row per result (plus header)

review walkthrough: OK (all checks passed)
```
This module exercises create-plan -> assign-reviewer -> reviewer-queue -> submit-scorecard -> organizer-progress/results end to end against the task-custodian-w12-2 three-sub-app decomposition (`src/routes/review/{index,plans,reviewer,recusals,shared}.ts`) with zero route-shadowing symptoms (no 404/403-where-200-expected, no double-registration errors).

### speaker — PASS (all checks)

Full tail:
```
ok   upload a valid Presentation deliverable (v1)
ok   re-upload chains previous_file_id (v2 replaces v1)
ok   the version chain + both versions are downloadable (full history)
ok   producer comment + speaker reply thread round-trips
ok   content approval gate: flipping content-status changes public /e/<slug>/sessions visibility (verify only)
ok   DEC-175 speaker2 GET speaker1's portal submission -> 404 (existence-hiding)
ok   DEC-175 speaker2 GET speaker1's task-assignment form -> 403
ok   DEC-175 speaker2 POST speaker1's task-assignment form -> 403
ok   DEC-175 speaker2 POST-complete speaker1's task assignment -> 403
ok   DEC-175 speaker2 GET speaker1's uploaded file -> 403
ok   DEC-175 speaker session on organizer API GET /api/v1/events/:id/submissions -> 403
ok   DEC-175 speaker session on organizer API GET /api/v1/contacts -> 403
ok   DEC-175 speaker session on organizer API GET /api/v1/events/:id/email-log -> 403

walkthrough/speaker.ts: all checks passed
```

### public — FAIL (2 open items: 1 pre-existing static-check regression, 1 ORM-probe-discovered defect)

Tail (last 14 lines before the run aborts on its first failing assertion):
```
ok   J10 /e/devflow-conf-2027/agenda returns 200 with content
ok   J10 /e/devflow-conf-2027/schedule returns 200 with content
ok   J10 /e/devflow-conf-2027/gallery returns 200 with content
ok   J10 /sessions: cards + track filter nav present
ok   J10 /speakers: alphabetical by surname, headshot/title/company
ok   J10 /agenda: per-day time grid, track colors present in markup
ok   J10 /schedule: itinerary key + .ics link carries ?ids=
ok   J10 /gallery returns headshot grid
ok   J10 schedule.ics downloads twice with identical UID lines
ok   J10 /embed/devflow-conf-2027/sessions renders chromeless, no frame-blocking headers
ok   J10 /embed/devflow-conf-2027/speakers renders chromeless, no frame-blocking headers
ok   J10 /embed/devflow-conf-2027/agenda renders chromeless, no frame-blocking headers
ok   J10 /embed/devflow-conf-2027/schedule renders chromeless, no frame-blocking headers
ok   J10 /embed/devflow-conf-2027/gallery renders chromeless, no frame-blocking headers
FAIL [J10 Settings embed-generator snippet URLs match live /embed routes]: Settings.tsx embed snippet builder missing /embed/ path
```
J9 (agenda placement) and most of J10 pass (27 `ok` lines total before this line); the module aborts on this static check.

**OPEN ITEM 2**: `walkthrough/public.ts`'s `J10 Settings embed-generator snippet URLs match live /embed routes` check reports `Settings.tsx embed snippet builder missing /embed/ path`. Not a 500/SQL error, and not touched by the drizzle upgrade's changed routes (this is a static-content assertion against `app/src/pages/Settings.tsx`'s embed-snippet builder, unrelated to `src/routes/public/index.tsx` or `getPublicAgendaByIds`). Flagged as an open item since it blocks the rest of the public module's checks from running; no product-code fix made (out of this lane's scope).

**OPEN ITEM 3 (ORM-upgrade probe finding — see below)**: `GET /e/devflow-conf-2027/schedule.ics` with no `ids` query param returns `200` with an empty `VCALENDAR` (0 `VEVENT`s) even though the event has 12 accepted+content-approved+scheduled sessions visible via the organizer agenda and the public `/e/devflow-conf-2027/schedule` HTML page. Root cause identified by reading `src/routes/public/index.tsx:197-204`: when `ids.length === 0`, `agenda` is correctly populated via `getPublicAgenda(...)` (the whole-agenda path), but the `events` array a few lines below is still built by `ids.filter((id) => agendaById.has(id)).map(...)` — filtering the (empty) `ids` array instead of falling back to `agenda` when no ids were requested. This means the whole-agenda `schedule.ics` path (DEC-315/312's "the whole-agenda path must still work" requirement) is silently broken: it always returns 0 events unless `?ids=` is supplied. Not a 500/SQL/drizzle-stack-trace — no exception is thrown, the endpoint just silently returns an empty calendar. Cited: `src/routes/public/index.tsx:197` (`const agenda = ...`) and `:200-204` (`const events = ids.filter(...)`).

### data — PASS (all checks)

Full tail:
```
-- J11: create contact + custom field + note
-- J11: contact appears in search by unique tag
-- J11: CSV import with column mapping
-- J11: per-contact history (find a seeded contact with submissions + emails)
-- J11: duplicate merge combines two contacts without losing history
-- J11: create segment + filter by it
-- J11: bulk-email the segment (logged to email_log with per-recipient rows)
-- J11: bulk-email cap (>100 recipients rejects)
-- J11: dashboard stats (returning speakers, top companies)
-- J12: mint bearer token (cookie + CSRF)
-- J12: bearer token works cookie-less on GET /api/v1/events
-- J12: bearer token works cookie-less on GET /api/v1/events/:eventId/submissions
-- J12: revoked token gets 401
-- J12: speaker-role session hitting an organizer endpoint gets 403
-- J12: exports (csv + json, non-empty) for each kind
-- J12: showflow.csv fixed columns
-- J12: export of another org's event 404s
-- J12: GET /docs/api returns 200

walkthrough:data OK — J11/J12 checks passed
```

### Module summary

| module   | result | notes |
|----------|--------|-------|
| producer | FAIL   | J1/J2/J3 pass; J5 aborts on stale fixture date (OPEN ITEM 1) |
| review   | PASS   | all checks, incl. J4 end-to-end through the review sub-app split |
| speaker  | PASS   | all checks |
| public   | FAIL   | J9 + most of J10 pass; static embed-snippet check aborts module (OPEN ITEM 2); separately, ORM probe found the whole-agenda schedule.ics defect (OPEN ITEM 3) |
| data     | PASS   | all checks |

## ORM-upgrade acceptance probes (drizzle-orm 0.36.4 -> 0.45.2, DEC-312 SQL WHERE)

Fixture ids used (from the live seeded `devflow-conf-2027` / `seed_event_0001` D1 database, resolved via the organizer agenda + submission-detail APIs, filtered to `status=accepted` AND `contentStatus=approved` AND has a schedule slot — i.e. the same `visibleSessionConditions()` gate `getPublicAgenda`/`getPublicAgendaByIds` apply): `seed_submission_0001`, `seed_submission_0004`, `seed_submission_0005`.

1. **`GET /e/devflow-conf-2027/schedule.ics?ids=seed_submission_0001,seed_submission_0004,seed_submission_0005`** — `200 OK`. Exactly 3 `BEGIN:VEVENT` blocks, `UID:chq-seed_submission_0001@chautauqua`, `UID:chq-seed_submission_0004@chautauqua`, `UID:chq-seed_submission_0005@chautauqua` — matches the 3 requested ids exactly, no extras. **PASS.**

2. **`GET /e/devflow-conf-2027/schedule.ics`** (no ids, whole-agenda path) — `200 OK`, but returns an *empty* calendar (0 `VEVENT`s) despite 12 accepted+approved+scheduled sessions existing. **This is OPEN ITEM 3 above** — the whole-agenda path is broken by a filter-against-the-wrong-array bug in `src/routes/public/index.tsx` (not a drizzle/SQL failure; the query itself, `getPublicAgenda`, executes fine — confirmed separately via `/e/devflow-conf-2027/agenda` and `/e/devflow-conf-2027/schedule` HTML, both of which render session content from the same underlying data). **FAIL** (task expects "the whole-agenda path must still work").

3. **`GET /e/devflow-conf-2027/schedule.ics?ids=<hidden-or-unscheduled id>`** — tried both flavors: (a) a `declined` submission id (`seed_submission_0030`) and (b) an `accepted`-but-not-yet-placed submission id (`iufzqgxxvmetrol6yexk`, confirmed absent from the organizer agenda's `placed` list). Both return `200 OK` with an empty `VCALENDAR` (0 `VEVENT`s) — silently dropped, never leaked, no 500/SQL error. **PASS.**

4. **`assignToAllAccepted: true` task creation, real D1** — logged in as the seeded organizer, `POST /api/v1/events/seed_event_0001/tasks` with `{kind:"general", title:"w13-b DEC-312 probe task", required:false, assignToAllAccepted:true}` (CSRF header `x-chq-csrf: 1`) → `201 Created`. Cross-checked via `GET /api/v1/events/seed_event_0001/onboarding`: the new task appears against exactly **16** contact rows. Independently computed the expected count as the number of distinct speaker `contactId`s across the event's 18 `accepted` submissions via `GET /api/v1/submissions/:id` details → **16** distinct contact ids — exact match. No 500/SQL error from the `inArray(participant.inviteStatus, ACTIVE_INVITE_STATUSES)` WHERE clause (`src/server/repo/tasks.ts:356-369`) against real D1. **PASS.**

5. **J4 review surface end-to-end** — covered by the full `review` module run above (create plan -> assign reviewer -> reviewer queue -> submit scorecard -> organizer progress/results), all checks passed, including DEC-175 existence-hiding probes that specifically exercise cross-sub-app boundaries in the `plans`/`reviewer`/`recusals` split. No route-shadowing symptoms observed. **PASS.**

## Notes

- Mid-task, the worktree directory `chautauqua-wt/task-w13-b` was unexpectedly deleted in full (all files, `.git` link, `node_modules` gone, only an empty `.wrangler` directory survived) by an external process while a background `wrangler dev` process for this lane was live and a `for`-loop probing `review`/`speaker`/`public`/`data` modules was mid-flight (the loop's overall 2-minute tool timeout appears to have SIGKILLed the whole process group, including the backgrounded server). The worktree was recreated (`git worktree add ... -b task-w13-b main`, then `git reset --hard f6983e6` to restore the same FROZEN SHA `S` used for the WAVE-12 GATE checks and the `producer`/`review` runs already completed), and setup (build/migrate/seed/boot) was redone from scratch. All results in this log are from the post-recreation run, cross-checked against the pre-deletion `producer`/`review` runs (identical `producer` J5 failure both times; `review` fully passed both times) for consistency. No evidence this deletion was caused by anything this lane did; flagging in case other wave-13 lanes hit the same worktree-loss symptom under concurrent load.
- `.dev.vars` does not exist in a fresh worktree (gitignored); without it `DEV_MODE` is unset and `/dev/mailbox` 404s, which J2 depends on. Copying `.dev.vars.example` -> `.dev.vars` (adjusting `PUBLIC_BASE_URL` to the assigned port per the file's own DEC-296 comment) is expected local setup, not a defect — but future `-c3-` lanes on non-default ports should budget for this step explicitly in SETUP.

## POST-S DELTA

`git log --oneline S..refs/heads/main -- src app migrations scripts test` (S = f6983e6):

```
(empty — no commits touching src/, app/, migrations/, scripts/, or test/ landed on main between S and the current main tip)
```

Per DEC-280, a non-empty delta would never be a STOP; here the delta affecting in-scope paths is empty regardless.
