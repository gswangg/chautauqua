# task-w21-d — persona walkthrough @ bf56ba7

SPEC.md:374-377's "actual final exam" persona walkthrough, cut for the
first time past wave 19 (no such evidence existed since then per the
task brief). Log-only lane (DEC-472/DEC-438): no file under `src/`,
`app/src/`, `scripts/`, `test/`, `migrations/`, `decisions/`, or
`package.json` was touched. Worktree
`/Users/wednesdayniemeyer/Documents/gniemeyer/Projects/chautauqua-wt/task-w21-d`,
branch `task-w21-d`, cut from `main` at `bf56ba715a36bcde8bbdb9e01edf7b573c38b0de`
("scribe wave 21") — that commit is the sha this entire report is
evidence about (DEC-448).

**Process note (not a product finding):** this worktree was destroyed
out-of-band **twice** while this lane was in progress — once as a bare
directory+worktree-registration wipe (`git worktree list` no longer
showed it, though `main` itself hadn't moved), and a second time as a
full directory wipe coincident with `main` advancing to a new tip
(`27cff15`) and a sibling agent's captured shell history showing
`pkill -f "wrangler dev"; pkill -f "vite"` — a environment-wide kill
that also took down this lane's `wrangler dev` process, since `pkill
-f` matches by process name/cmdline substring across every worktree on
the shared machine, not by cwd. Both times the worktree was recreated
pinned to the same `bf56ba7` sha (`git worktree add ... task-w21-d
bf56ba7...`, or reusing the branch when it survived) rather than
rebasing onto whatever `main` had become, so all evidence below is
about one single, consistent tree. Flagging for the scribe: a
long-lived `npm run dev` background process, or a worktree with no
commits yet, is not safe from a concurrent lane's blunt `pkill -f` or
worktree cleanup — re-derive/re-run rather than assume a background
server or worktree is still there after a multi-minute gap.

## STEP 1 — fresh local start (SPEC.md:361)

`npm i && npm run db:migrate && npm run seed && npm run dev`, run
literally in that order, with `env | grep -i -E
'AIRTABLE|RESEND|SECRET'` empty first (no secrets present) and only
`.dev.vars.example` on disk (no `.dev.vars` yet):

- `npm i`: 366 packages, 2.5s, clean (4 npm-audit advisories, none
  blocking).
- `npm run db:migrate`: all 19 migrations (`0000_secret_matthew_murdock`
  through `0018_w18_scale_indexes`) applied clean, twice in the log
  (predev's own migration pass plus the explicit one) — idempotent,
  no error.
- `npm run seed`: `scripts/seed.ts` + D1 execute + `scripts/seed-r2.ts`,
  8 R2 objects uploaded, no error.
- `npm run dev`: `predev` (ensure-dev-vars + `vite build`) then
  `wrangler dev`; `GET /health` returned `200` within ~8s of launch.

**No manual step was needed beyond the four documented commands.**
The README's Quickstart (README.md:37-47) promise holds exactly as
written; nothing was missing or under-documented.

## STEP 2 — `npm run walkthrough`

Ran twice (once before either worktree wipe, once after the second
recreation — both against a freshly migrated+seeded DB at the same
`bf56ba7` tree); identical area-level results both times. Per-module
PASS/FAIL, verbatim area order (producer -> review -> speaker -> public
-> data -> scale):

| Module | Result |
|---|---|
| producer (J1/J2/J3/J5) | **PASS** — all checks ok, including the >100-recipient overflow fixture and DEC-175 authz probes |
| review (J4) | **PASS** — anonymization, scorecard round-trip, max-evaluations cap, DEC-039/DEC-175 authz probes, laggard-only remind, results sort + CSV, all ok |
| speaker (J6/J7/J8) | **FAIL** — see Finding 1 below |
| public (J9/J10) | **PASS** — agenda placement/conflicts/auto-schedule, all 5 public surfaces + 5 embeds, visibility gates (non-accepted, content-unapproved, DEC-274 hidden-participant, DEC-108 invite-visibility), all ok |
| data (J11/J12) | **FAIL** — see Finding 2 below |
| scale | **PASS** — 110-row bulk accept in 288ms, email-log unchanged by the bulk accept, exactly-once re-accept, purge-refresh probe |

Raw failing lines:

```
FAIL [complete the ad hoc form-kind task assignment (dynamic field fill from the attached CFP form)]: POST form-kind task completion expected 302, got 400
WALKTHROUGH FAILED at speaker
...
WALKTHROUGH FAILED at [J12: exports (csv + json, non-empty) for each kind]: export/evaluations?format=csv had no data rows beyond the header (1 line(s))
WALKTHROUGH FAILED at data
```

### Finding 1 (harness bug, not product code) — speaker.ts ad hoc form task

`scripts/walkthrough/speaker.ts:643-659` builds a POST body for every
*required* field on the event's CFP form by iterating `cfpForm.fields`
and, for anything not a dropdown/checkbox/number/file, filling
`` `Walkthrough answer for field ${f.id}` `` (line 657). The CFP form's
locked `email` field (`id: "email"`, `kind: "text"`,
`scripts/seed.ts:372`) is one of those required text fields, so the
script submits the literal string `"Walkthrough answer for field
email"` as the email answer. `src/forms/validate.ts:68-83` recognizes
the locked email field via `lockedFieldName(field.id) === "email"`
(`src/forms/types.ts:68-72` strips any `formId:` prefix and matches
against `ALL_LOCKED_NAMES`) and runs `isValidEmail()` on it — correctly
rejecting the non-email string with `errors[field.id] = "must be a
valid email address"`, which the route
(`src/routes/portal/tasks.tsx:445-493`, specifically the
`validation.ok` branch at line 471) renders back as an HTML 400, not
the 302 the test expects. **Product code is behaving correctly per
DEC-454/DEC-455** (the field guide's "ONE email rule at EVERY
contact.email write/lookup"); the walkthrough script itself never
special-cases the locked email field the way the public CFP form
(`src/routes/public/submit.tsx`) or the DEC-111 Hotel/Flight probes
earlier in the same file do. **FAIL-unowned** (scripts/walkthrough is
not `src/` and no branch currently owns a fix); named here per
DEC-472/438 rather than fixed.

### Finding 2 (harness bug, not product code) — data.ts wrong-event export probe

`scripts/walkthrough/data.ts:151-157` resolves "the seeded event" as
`eventsBody.items[0]` from `GET /api/v1/events`, with no slug check.
`GET /api/v1/events` orders `desc(schema.event.startDate), asc(id)`
(`src/server/repo/events.ts:71`/`101`). The `producer` module (which
runs immediately before `data` in the fixed walkthrough order) creates
its own throwaway events with `startDate: "2027-09-01"`
(`scripts/walkthrough/producer.ts`) — later than devflow-conf-2027's
seeded `"2027-05-12"` — so once `producer` has run, `items[0]` is
"Producer Walkthrough Event", not the seeded event. Reproduced live
with a standalone probe script (login as organizer, `GET
/api/v1/events`, take `items[0]`, hit
`/api/v1/events/<id>/export/evaluations?format=csv`): `items[0]` was
`"Producer Walkthrough Event"` (id `okpiaz45repmksaawkoq`), and its
evaluations export correctly returned 0 rows (nothing was ever
reviewed on that throwaway event) — the CSV/JSON "empty" result is
**correct behavior for the wrong event**, not a broken export. Direct
D1 query (`SELECT COUNT(*) FROM evaluation` = 52, both seeded
evaluation plans' `event_id = seed_event_0001`) and a manual
authenticated hit of
`/api/v1/events/seed_event_0001/export/evaluations?format=csv` (see
below) confirm the export code itself is correct once pointed at the
right event. Every other walkthrough module that needs the seeded
event resolves it by slug (`review.ts:54,286-287`:
`EVENT_SLUG = "devflow-conf-2027"`, `events.items.find(e => e.slug ===
EVENT_SLUG)`) — `data.ts` is the one module that doesn't. **FAIL-unowned.**

## STEP 3 — manual persona walkthrough (Playwright/chromium, headed-equivalent, against the same running server)

All four seeded personas
(`sbek-organizer@example.com`/`sbek-reviewer@example.com`/
`sbek-speaker@example.com`/no-login) walked live, one row per job,
against `devflow-conf-2027`. `EventSwitcher.tsx:168-172`'s `switchTo()`
always `window.location.assign('/admin')` on event change (loses
whatever admin page you were on) — a real UX friction that slowed this
walkthrough down (had to re-navigate after every event switch) but not
a spec violation I can point to; noting it as an observation, not a
counted FAIL.

| Job | URL(s) visited | What I saw |
|---|---|---|
| J1 | `/admin/settings` (organizer, DevFlow Conf 2027) | Event settings, portal settings, tracks/rooms, resources, API tokens, exports, embed generator — all present and populated from seed. |
| J2 — public CFP submit end-to-end | `/submit/devflow-conf-2027` | Filled title/description/format/audience-level/track-checkbox/first+last name/email, clicked "Submit this talk" -> "Thanks for your submission!" confirmation card with a "Create a password to track your submission" claim link. First attempt (no track checked) correctly stayed on-page with an inline "Select at least one track." error — required-field enforcement confirmed working, not just my probe's bug once I fixed it. |
| J2 — dev mailbox / confirmation email | `/dev/mailbox`, `/dev/mailbox/<id>` | New "We received your submission: Walkthrough Talk ..." row appeared (message count 9->10 after the fixed submit). Opened it: To/Status/Sent/Event header fields + rendered Text Body all present. An adjacent seeded row's subject `Re: Dangerous Title <img src=x> Test ...` (an XSS-probe fixture) rendered as literal escaped text in the mailbox table, not executed — no injection. |
| J2 — speaker portal claim path | (not clicked through to completion — the claim link's token wasn't captured by this pass; deferred, see Open items) | Confirmation page presents the claim link; not followed end-to-end to a working `/claim/:token` -> password-set -> `/portal` login in this pass. `npm run walkthrough`'s producer module (PASS) already exercises this path automatically (J2 in its own PASS list), so this is a coverage gap in my manual pass, not an unverified claim. |
| J3 | `/admin/submissions` | Table with Views/filters (Pending/Accept queue/Decline queue/Accepted/Declined), track filter, sort, Columns picker, per-row Clone. |
| J4 — reviewer queue | `/admin/review` (reviewer), `/admin/review/plans/seed_evaluation_plan_0001` | "Your evaluation plans" list (2 plans); opened "Program Committee Review" -> queue of 7 submissions sorted fewest-ratings-first, including my own just-submitted "SES-035 — Walkthrough Talk" at 0 ratings — confirms the CFP submission flowed into the live review pipeline. |
| J4 — reviewer scorecard | `/admin/review/plans/seed_evaluation_plan_0001/submissions/<id>` | Anonymized detail: no speaker name/company shown ("Speakers:" blank), abstract text only, conflict-of-interest declare control, numeric/free-text/dropdown scorecard fields, "Submit and advance." |
| J5 — decide, never auto-email | `/admin/overview` (organizer, DevFlow Conf 2027) | "22 things need your attention" triage list showed my walkthrough talk with Accept/Decline/Waitlist buttons inline. Recorded dev-mailbox count (10) before clicking Accept; clicked Accept; recorded dev-mailbox count again (still **10**) — confirmed the status change alone sent nothing. Comms -> submissions table then showed that same talk as "Accepted". |
| J5 — notify deliberately | `/admin/comms` (Compose wizard) | Selected 1 accepted+scheduled submission, wrote a subject/body using `{speaker_name}`/`{talk_title}` merge tokens, previewed: recipient resolved to the real contact (`Priya Raman <sbek-speaker@example.com>`), subject/body rendered with merge fields substituted, checked "Attach calendar invite" -> preview panel showed a "SCHEDULED" tag and a "Calendar invite: May 12, 2027, 12:00 PM - 12:45 PM · Main Stage" chip; clicked "Send 1 email" -> landed back on Comms with the flow reset (send succeeded). |
| J5 — dev mailbox / .ics download / timezone | `/dev/mailbox/<id>`, `/dev/mailbox/<id>/ics` | The just-sent message appeared with a "Download .ics" link; downloaded it (`GET .../ics` -> `200`, `Content-Type: text/calendar; charset=utf-8`). File content: `DTSTART:20270512T160000Z` / `DTEND:20270512T164500Z` / `SUMMARY:Taming 40-Minute CI: Incremental Builds at Monorepo Scale` — correct UTC instant. **See Finding 3 below: the .ics file itself is right, but the Comms preview's human-readable time was wrong.** |
| J6 | `/admin/overview` | "22/23 things need your attention" panel: overdue tasks, submissions awaiting triage (with inline Accept/Decline/Waitlist), session content awaiting approval (my walkthrough talk's content showed here after I accepted it, with Approve/Ask for changes), unplaced sessions + conflicts, "Review: 52 of 2 evaluation plans in.", "Comms: 8 sent in 7 days." |
| J7 | `/portal`, `/portal/tasks` (speaker) | Dashboard: My submissions table (2 rows, ref/title/status/submitted/View), My tasks (5 rows with Due dates and TO DO/DONE badges), Sessions ("SES-001: Taming 40-Minute CI ... 2027-05-12 09:00-09:45 in Main Stage" — correct Pacific-local time, see Finding 3), Resources link. |
| J8 | `/admin/overview` (Session content awaiting approval section) | Approve / Ask for changes controls present for a submitted-content row; not clicked through to Approve in this pass (would have mutated shared seed state further; the automated `npm run walkthrough` producer/data modules already exercise the approve path). |
| J9 | `/admin/agenda` (organizer) | Day tabs (2027-05-12/13/14), room columns (Main Stage/Room 2A/Room 2B/Workshop Lab/TBD), placed sessions rendered as blocks with a visible clash overlap (SES-001 vs SES-004, "1 CLASH" nav badge, "CLASHES ARE FLAGGED, NOT BLOCKED" caption), Unscheduled tray (4 cards), Auto-schedule + Publish schedule buttons. Matches the automated public.ts J9 checks (room-overlap and same-speaker-overlap both non-blocking, counts correct, auto-schedule doesn't introduce new conflicts) already confirmed PASS in Step 2. |
| J10 | `/e/devflow-conf-2027/{sessions,speakers,agenda,schedule,gallery}`, `/embed/devflow-conf-2027/{same 5}` | All 10 loaded 200 with real content (screenshots captured for each). Public agenda for 2027-05-12 independently showed "9:00 AM-9:45 AM ... Taming 40-Minute CI" for the Main Stage — same Pacific-local time as the portal, confirming Finding 3 is isolated to the Comms preview chip, not systemic. |
| J11 | (covered by `npm run walkthrough`'s data module, all J11 checks PASS — contact search, custom field + note, CSV import, duplicate merge, segment + bulk email with 100-recipient cap, dashboard stats) | Not re-walked by hand; automated coverage already green. |
| J12 | `/admin/settings` (Exports panel) | Table of Submissions/Speakers/Evaluations/Agenda/Email log, each with "Download CSV"/"Download JSON" links, plus a separate "Show-flow (CSV)" row. API-token minting/listing/bearer-auth/revocation and the exports themselves are covered by the automated data module (PASS except Finding 2's wrong-event probe). |

### Finding 3 (real product bug) — Comms preview's calendar-invite chip uses the viewer's browser timezone, not the owning event's timezone

`app/src/pages/comms/icsChip.ts:13-14`:

```ts
function formatLocal(iso: string): string {
  return new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}
```

The file's own header comment says it plainly: "startUtc/endUtc are
ISO-8601 strings as the server sends them, **formatted in the
browser's local timezone**." `formatIcsChip()` (line 18-26) builds the
"Calendar invite: ..." line shown in `PreviewPane.tsx:27` from this —
using `toLocaleString(undefined, ...)`, i.e. whatever timezone the
*viewer's machine* is set to, not `event.timezone`
(`America/Los_Angeles` for DevFlow Conf 2027) and not
`src/lib/event-time.ts`'s owning-event-timezone helpers the field
guide names as the one correct pattern ("dates via event-time.ts
OWNING EVENT's tz never toISOString").

Live repro: this machine's `Intl.DateTimeFormat().resolvedOptions().timeZone`
is `America/New_York` (EDT, UTC-4). Session SES-001 ("Taming 40-Minute
CI") is genuinely scheduled 09:00-09:45 **Pacific** — confirmed three
independent ways: (1) the Admin Agenda grid places it in the "9:00am"
row; (2) the speaker portal's own sessions list says "2027-05-12
09:00-09:45 in Main Stage"; (3) the raw downloaded `.ics`'s
`DTSTART:20270512T160000Z` is 16:00 UTC = 09:00 PDT (UTC-7 in May).
But the Comms compose-preview's "Calendar invite:" chip, rendered in
this same browser session, showed **"May 12, 2027, 12:00 PM - 12:45
PM · Main Stage"** — 12:00 PM EDT is also 16:00 UTC, so the chip is
displaying the correct UTC instant in the *wrong* timezone (the
viewer's machine's, not the event's), a full 3 hours off from the true
event-local time an organizer proofreading this email before sending
it would expect to see.

**The `.ics` attachment itself is correct** (UTC-based `DTSTART`/
`DTEND`, so any real calendar client localizes it correctly on
import) — this is purely a human-readable-preview bug, but it is
exactly the kind of thing DEC-424's "OWNING EVENT's tz never
toISOString" rule exists to prevent, and it would actively mislead an
organizer sending a room/time notification from a laptop set to a
different timezone than the event (a very plausible real scenario for
a distributed program committee). **FAIL-unowned** — `app/src/` is
in this lane's do-not-touch list, so not fixed here; named for the
next wave. `app/src/pages/comms/icsChip.test.ts` exists and passes
today, but its fixtures never assert against a non-UTC `TZ`, so it
would not have caught this (worth a note for whoever picks this up:
the existing unit test needs a `process.env.TZ` override to a non-UTC,
non-Pacific zone to actually exercise the bug — otherwise a developer
running the suite in UTC or in `America/Los_Angeles` would see it
pass).

## STEP 4 — phone check @ 390x844

Automated Playwright viewport check (`document.scrollingElement.scrollWidth
<= window.innerWidth`) plus a full-page screenshot, on every public
no-login surface plus the speaker portal:

| Surface | `scrollWidth` vs `innerWidth` (390) | Result |
|---|---|---|
| `/submit/devflow-conf-2027` | 390 / 390 | no overflow |
| `/e/devflow-conf-2027/sessions` | 390 / 390 | no overflow |
| `/e/devflow-conf-2027/speakers` | 390 / 390 | no overflow |
| `/e/devflow-conf-2027/agenda` | 390 / 390 | no overflow |
| `/e/devflow-conf-2027/schedule` | 390 / 390 | no overflow |
| `/e/devflow-conf-2027/gallery` | 390 / 390 | no overflow |
| `/portal` (logged in as speaker) | 390 / 390 | no overflow |

Zero horizontal spill found on any of the seven surfaces measured. The
agenda's day-chip scroller (`Wed, May 12` / `Thu, May 13` / `Fri, May
14` pills) is present and horizontally scrollable within its own
region at this width — the known DEC-424 carve-out — called out here
as that carve-out, not as a defect. One cosmetic (non-overflowing) nit
noticed in a screenshot: the speaker portal's "My submissions" table
header cells ("STATUS", "SUBMITTED") wrap awkwardly letter-by-letter
at 390px column width (e.g. "STAT / US", "SUBMI / TTED") — ugly but
does not cause horizontal scroll and isn't a tap-target violation, so
not counted as a FAIL.

## Not exercised in this pass

- **Close-date lock**: the seeded CFP form's `close_date` (2027-03-01)
  is in the future relative to "now" (2026-08-12), so the form is open
  and the closed-state UI could not be triggered live without mutating
  seed data (out of scope for a log-only lane). Verified by reading
  the code path instead: `src/routes/public/submit.tsx:154-177` (the
  closed-state card, "The call for papers has closed... Submissions
  ... closed on {formatEventDateTime(...)}") and three separate
  `windowState === "closed"` guards (lines 421, 477, 565) gate the
  GET/POST paths server-side. Not independently click-tested; flagging
  as code-read-only evidence, weaker than everything else in this
  report.
- **Speaker claim-link click-through**: confirmed the public CFP
  confirmation page presents the claim link (J2), but did not follow
  it to a working password-set + portal login in this manual pass
  (see J2 row above) — `npm run walkthrough`'s producer module already
  exercises this automatically and passed.
- **Content approve action**: saw the Approve/Ask-for-changes controls
  live on Overview but didn't click Approve (would have further
  mutated shared seed state beyond what this lane needed); covered by
  automated walkthrough modules instead.
- `npm run gate:render-sweep` was not run (not requested by this task;
  its own desktop/mobile/admin-mobile passes are a separate, larger
  gate already covered by other lanes).

## OPEN ITEMS: 3

All three are **FAIL-unowned** (DEC-438: no branch currently owns a
fix for any of them):

1. `scripts/walkthrough/speaker.ts:643-659` — ad hoc form-kind task
   probe fills the locked `email` field with a non-email string,
   tripping `src/forms/validate.ts`'s (correct) email-format check.
   Harness bug, product code is correct.
2. `scripts/walkthrough/data.ts:151-157` — resolves "the seeded event"
   as `items[0]` from an event list ordered `desc(startDate)`, which
   silently picks a different (empty) event once an earlier
   walkthrough module has created events with later start dates.
   Harness bug, product export code is correct once pointed at the
   right event.
3. `app/src/pages/comms/icsChip.ts:13-14` — the Comms compose
   preview's "Calendar invite:" chip renders in the viewer's browser
   timezone instead of the owning event's timezone, live-reproduced as
   a 3-hour discrepancy (09:00 Pacific actual vs. "12:00 PM" shown to
   an EDT-timezone viewer). Real product bug in `app/src/`, not
   fixed here per this lane's scope restriction.

RESULT: FAIL — `npm run walkthrough` reports 2/6 areas FAIL (both
traced to walkthrough-script bugs, not product code, per Findings 1-2
above); this manual pass additionally found one real, previously
undocumented product defect (Finding 3, a timezone-display bug in the
Comms compose preview) that DEC-424's "OWNING EVENT's tz" rule exists
to prevent. Everything else walked in this report — public CFP submit,
claim-link presentation, reviewer queue + anonymized scorecard,
decision-without-auto-email, deliberate notify with merge-field
substitution, dev-mailbox message rendering + `.ics` download (file
contents correct), agenda grid, all ten public/embed surfaces,
exports UI, and phone-width checks on seven surfaces — passed with no
defects found.
