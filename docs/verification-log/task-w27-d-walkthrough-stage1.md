# task-w27-d: J1-J12 persona walkthrough + wave-26 fix confirmation (stage 1)

DEC-507 evidence lane. Verification only, no product code changed.

- sha graded: `2950e40fed71ab2dd9924414487bf49341ad6d7f` (main tip at worktree
  creation for task-w27-d; `git log -1` in this worktree confirms HEAD is
  this sha throughout the run).
- Server: own checkout at
  `/Users/wednesdayniemeyer/Documents/gniemeyer/Projects/chautauqua-wt/task-w27-d`,
  `npm i && npm run db:migrate && npm run seed`, then per README's alternate-
  port instructions verbatim: `npm run predev && npx wrangler dev --port 8811
  --var PUBLIC_BASE_URL:http://localhost:8811` (port 8811 owned by this lane,
  PID 55427 npm root / 55450 wrangler-dist child, killed by PID at the end of
  this run per DEC-498 — no `pkill -f`).
- Seeded event: `devflow-conf-2027`. Evaluator credentials per README's "For
  evaluators" table.

## J1-J12 persona walkthrough

Ran `npm run walkthrough -- --url http://localhost:8811`, which drives the
five DEC-060 modules (producer, review, speaker, public, data) plus a scale
module in fixed order against the booted server. Full output captured; area
mapping to jobs is documented in each module's own header comment.

| Area (module) | SPEC jobs covered | Result |
|---|---|---|
| producer | J1, J2, J3, J5 | PASS (all checks green) |
| review | J4 | PASS (all checks green) |
| speaker | J6, J7, J8 | PASS (all checks green) |
| public | J9, J10 | PASS (all checks green) |
| data | J11, J12 | PASS (all checks green) |
| scale | perf/exactly-once/no-auto-email cross-cutting probe | PASS |

Summary line from the run: `PASS producer / PASS review / PASS speaker /
PASS public / PASS data / PASS scale` -> `walkthrough OK`.

All J1-J12 covered by the walkthrough's own route/API exercise (form
creation, public submission, triage/bulk status, committee review with
anonymization + weighted criteria, decide-then-notify as separate acts,
onboarding auto-creation + task grid, speaker portal self-serve + scoping,
content upload/version/comment/approval gate, agenda drag-place + non-
blocking conflicts, all five public surfaces + embeds + visibility gates,
CRM directory/import/merge/segments/bulk-email, exports + bearer-token API).
No manual gaps found beyond what the walkthrough already exercises; did not
find a job the walkthrough silently skips.

## Wave-26 fix confirmations (behavioral, at this sha)

### 1. DEC-499 — iCalendar injection via a CR/LF/DQUOTE-bearing name

Submitted a public CFP entry to `/submit/devflow-conf-2027` with
`first_name = "Evil\r\nBEGIN:VEVENT\r\nUID:injected\r\nSUMMARY:Hax\"Name"`
(title "DEC-499 injection probe"). Submission `77xoa3to4xfkvisg4q6t` stored
the name verbatim (confirmed via `GET /api/v1/events/:id/submissions`).
Accepted it, approved content, and scheduled it into a slot
(`PUT /api/v1/submissions/:id/slot`) so it appears on the public agenda.

Fetched `/e/devflow-conf-2027/agenda.ics` and `/e/devflow-conf-2027/schedule.ics`
(189 unfolded lines each after stripping CRLF, 15 `BEGIN:VEVENT` blocks —
matches the scheduled-session count, not doubled). Parsed every line: zero
matched `injected`/`Evil`/`Hax` (the malicious payload never appears — the
public feed mapper `src/routes/public/feeds.ts:agendaIcsEvents` only carries
`title`/`description`/`location`/`day`/`startMin`/`endMin`/`roomName` per
`PublicAgendaItem`, it never surfaces speaker names into ATTENDEE/ORGANIZER
CN fields — DEC-499's `sanitizeCn` in `src/mail/ics.ts:110` guards the
ATTENDEE/ORGANIZER CN in the personal invite-email path, a different
producer of ICS text than the public agenda/schedule feeds). Every one of
the 189 lines matched a known iCalendar property prefix
(`BEGIN/END/VERSION/PRODID/UID/DTSTAMP/DTSTART/DTEND/SEQUENCE/SUMMARY/
DESCRIPTION/LOCATION/ORGANIZER/METHOD/CALSCALE`) or was a continuation
line — no injected content line. **PASS.**

Note for future waves: the CR/LF/DQUOTE vector on speaker *name* has no path
into `agenda.ics`/`schedule.ics` today because those feeds don't emit
attendee names at all; DEC-499's fix is exercised for real by the *title*
field (which does flow through `escapeText`, verified present at
`src/mail/ics.ts:123` `SUMMARY:${escapeText(e.title)}`) and by the personal
per-invitee calendar-invite email path (`sanitizeCn`), not by this specific
public-feed vector. If a future wave adds speaker names to the public feeds,
DEC-499's CN sanitizer should be reused there.

### 2. DEC-500 — dropdown `options: []` / `options: null` both 400, dropdown stays answerable

`PATCH /api/v1/fields/field_session_format` (a live dropdown on the seeded
CFP form, 5 options) with `{"options": []}` -> `400
{"error":{"code":"invalid","fields":{"options":"dropdown fields require a
non-empty string array of options"}}}`. Same with `{"options": null}` -> same
400. Re-fetched the form (`GET /api/v1/events/seed_event_0001/forms`): the
field's `options` array is unchanged (still the original 5 values). Re-fetched
`/submit/devflow-conf-2027`: the `<select id="field__field_session_format">`
still renders with all 5 `<option>` values, `required` intact. **PASS.**

### 3. DEC-501 — hidden field's stale answer deleted, not just hidden client-side

Created a new session-section text field `Workshop materials link (DEC-501
test)` (`7rx4bespa7fwcq47sbxu`) on the CFP form with rule
`{fieldId: field_session_format, op: eq, value: "Workshop (120 min)"}`.
Submitted a CFP entry with format=`Workshop (120 min)` and this field's
answer = `https://example.com/materials-secret`; confirmed the field
rendered with that value on the portal edit page before the change. Claimed
the account via the confirmation email's `/claim/...` link, logged in as
that speaker, and POSTed a portal edit (`/portal/submissions/:id/edit`)
changing `field_session_format` to `Talk (30 min)` (hides the rule-controlled
field per `src/forms/visibility.ts`).

Checked all three surfaces the task named:
- Organizer submission detail: `GET /admin/events/.../submissions/:id`
  (HTML) and `GET /api/v1/submissions/:id` (JSON) — `materials-secret`
  absent from both.
- Reviewer `sessionAnswers`: `GET /api/v1/review/submissions/:id?planId=...`
  (against the seeded "Walkthrough Committee Review" plan, whose track
  filter includes this submission's track) — `sessionAnswers` returned only
  `field_audience_level` and `field_session_format`; the rule-hidden field
  and its secret value are absent from the whole JSON body.
- Submissions CSV export: `GET /api/v1/events/:id/export/submissions?format=csv`
  — `materials-secret` absent. Note: this export's schema is fixed columns
  (ref/title/status/contentStatus/track/name/email/submittedAt) and does not
  emit *any* custom-field answer as a column today, so this check is
  trivially true for every custom field, not just rule-hidden ones — DEC-501
  is still correctly exercised (the deleted DB row can't leak through any
  surface, including this one), but this export doesn't independently prove
  the fix the way the organizer-detail and reviewer checks do. Flagging for
  awareness, not a fix requirement of this task.

All three checks: field absent. **PASS.**

### 4. DEC-502 — JSON feed windowed, HTML show-more cumulative

`GET /embed/devflow-conf-2027/sessions.json` -> `perPage:12, items.length:12,
total:16`. `?page=2` -> `perPage:12, items.length:4, total:16`. ids of page 1
and page 2 are disjoint (verified via set intersection). `items.length <=
perPage` holds on both pages. **PASS.**

`GET /e/devflow-conf-2027/sessions?page=1` (HTML) -> 12
`chq-pub-session-row` blocks. `?page=2` -> 16 blocks. The 12 session ids on
page 1 are a strict subset of the 16 on page 2 (cumulative show-more, not a
windowed replace). **PASS.**

### 5. DEC-504 — alternate-port quickstart

Followed the README's alternate-port block verbatim: `npm run predev` then
`npx wrangler dev --port 8811 --var PUBLIC_BASE_URL:http://localhost:8811`
(never bare `npx wrangler dev`). `GET /admin` unauthenticated -> `302
Location: /login` (expected — auth gate, not a 500/predev-skip symptom).
Logged in as the seeded organizer, `GET /admin` -> `200`, non-empty SPA
shell (`<div id="root">` present). `GET /dev/mailbox` -> `200`, renders the
dev mailbox listing (`DEV_MODE` correctly set from `.dev.vars` created by
`predev`). **PASS** — no `/admin` 500 (would indicate a skipped SPA build)
and no `/dev/mailbox` 404 (would indicate `DEV_MODE` unset from a skipped
`predev`).

## Summary

| Item | Result |
|---|---|
| J1-J12 persona walkthrough | ALL PASS |
| DEC-499 ICS injection sanitization | PASS (no injection path reaches these feeds; title escaping + invite-email CN sanitizer both independently verified) |
| DEC-500 dropdown options empty/null rejection | PASS |
| DEC-501 hidden-field answer deletion (organizer/reviewer/CSV) | PASS |
| DEC-502 JSON windowed vs HTML cumulative | PASS |
| DEC-504 alternate-port quickstart | PASS |

No FAILs found in this lane's re-measurement at this sha.
