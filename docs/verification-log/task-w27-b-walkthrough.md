# task-w27-b — walkthrough @ f01459a

Wave-27 exit-gate battery (DEC-233), walkthrough lane, verification-only
(no product-code changes). Sha check performed from `main` in the source
repo; run performed in a separate detached worktree
`/Users/wednesdayniemeyer/Documents/gniemeyer/Projects/chautauqua-wt/run-w27-b`
checked out at the DEC-232/223-frozen literal sha
`f01459a1d52b6867586dd0b5b7c81dfe09601cfd` ("merge task-w26-d"). This
document lands on the `task-w27-b` branch/worktree, cut from `main`
(tip `2b5619d`, "scribe wave 27") only after STEP 1 confirmed that tip
is allow-listed drift.

## STEP 1 — DEC-232 sha check + allow-list

`main`'s tip is `2b5619d` ("scribe wave 27"), one commit ahead of the
frozen literal `f01459a`. `git show --stat 2b5619d` touches only
`decisions/DEC-232.md`, `decisions/DEC-233.md`, `decisions/DEC-234.md`,
`field-guide/index.md`, and `src/decisions.ts` (append-only per DEC-224)
— every path is on the DEC-225 allow-list
(`decisions/`, `field-guide/`, `verification-log/`, `eval-findings.md`,
`decisions.ts` appends). No drift; no FAIL-stop. Proceeding with S =
`f01459a1d52b6867586dd0b5b7c81dfe09601cfd`.

## STEP 2 — fresh install/build/migrate/seed/wrangler-dev/walkthrough

Detached worktree `run-w27-b` cut at `f01459a`. `rm -rf .wrangler`,
`npm ci --prefer-offline --no-audit --no-fund --silent` (clean, no
output = no errors), `npm run build` (dual `tsc --noEmit` + `vite
build --config app/vite.config.ts`, 132 modules transformed, no
errors), `npm run db:migrate` (13 migrations applied, `0011` gap is
the known numbering skip), `npm run seed` (clean, 8 objects put into
local R2 bucket `chautauqua-files`, no errors), `npx tsx
scripts/ensure-dev-vars.ts` (`created .dev.vars from
.dev.vars.example`; contents never read or printed, per DEC-187).

Started `npx wrangler dev --port 8965` in the background (DEC-233
port). `GET /` returned 200 within ~8s of startup.

`npm run walkthrough -- --url http://localhost:8965` ran all six
modules in the fixed order (producer -> review -> speaker -> public ->
data -> scale) with **zero FAIL/PLANNER: lines**.

### Summary

```
PASS producer
PASS review
PASS speaker
PASS public
PASS data
PASS scale

walkthrough OK
```

All J1-J12 checks passed, including the DEC-175 existence-hiding/authz
probes across producer/review/speaker, the DEC-108 invite-visibility
gates on public surfaces, and all 6 scale steps (110 fresh
contacts+submissions+participants, bulk-accept, onboarding task
assignments, exactly-once re-accept, no-auto-email-on-bulk-accept,
purge-refresh probe).

## STEP 3 — targeted fix checks (curl transcripts)

All requests below ran against the same live `run-w27-b` server
(port 8965), after the full walkthrough above completed, using the
seeded organizer (`sbek-organizer@example.com`, per
`docs/fixtures/sample-data.json`) and unauthenticated public sessions.

### (1) DEC-227 — required checkbox end-to-end

Logged in as organizer (`GET /login` for `chq_csrf`, `POST /login`
form-encoded -> 302, `chq_session` cookie minted). Added a checkbox
field to the devflow-conf-2027 CFP form:

```
POST /api/v1/forms/seed_form_0001/fields  (header x-chq-csrf: 1)
{"section":"session","kind":"checkbox","label":"Walkthrough W27b Consent","required":true}
=> 201 {"id":"tyj2742ofm626issqbun", ..., "required":true, "locked":false}
```

`GET /submit/devflow-conf-2027` now renders
`<input type="checkbox" id="field__tyj2742ofm626issqbun"
name="field__tyj2742ofm626issqbun" ... value="true"/>`.

Baseline submission count via `GET
/api/v1/events/seed_event_0001/submissions?perPage=200`: **161**.

POST the public submit form with valid CSRF (`chq_csrf` cookie +
matching hidden field) but the checkbox field omitted entirely
(unchecked checkboxes are simply absent from form-encoded bodies):

```
POST /submit/devflow-conf-2027 (chq_csrf cookie + field, no field__tyj2742ofm626issqbun)
=> 400 Bad Request
   body re-renders the form with:
   <p role="alert" class="field-error">required</p>  (immediately after the checkbox's <label>)
   (also "Select at least one track." — trackIds omitted too, expected/unrelated)
```

Submission count re-checked: still **161** — zero new rows from the
rejected POST.

Re-POST with the same CSRF, the checkbox checked
(`field__tyj2742ofm626issqbun=true`) and a track selected
(`trackIds=seed_track_0001`):

```
POST /submit/devflow-conf-2027 (checkbox=true, trackIds=seed_track_0001)
=> 200 OK, body: "Thanks for your submission!" + claim link
```

Submission count re-checked: **162** (161 -> 162, exactly one new
row). DEC-227 confirmed end-to-end: server-side `required` validation
on a checkbox field blocks the POST with zero side effects, and
succeeds once checked.

### (2) DEC-228 — cookie attributes

`GET /login` (fresh cookie jar, `http://localhost:8965`):

```
Set-Cookie: chq_csrf=<token>; HttpOnly; Path=/; SameSite=Lax
```

`HttpOnly` present, `SameSite=Lax` present, **no `Secure` attribute**
(correct: plain `http://localhost`, per DEC-228's conditional-Secure
rule).

Draft cookie from the `/submit/:eventSlug/save-draft` flow: `GET
/submit/devflow-conf-2027` (fresh jar) for a `chq_csrf` token, then

```
POST /submit/devflow-conf-2027/save-draft  (chq_csrf cookie/field, field__title=...)
=> 302 Found, Location: /submit/devflow-conf-2027
   Set-Cookie: chq_draft_seed_form_0001=<token>; HttpOnly; Path=/submit; SameSite=Lax
```

`HttpOnly` present and `Path=/submit` present, as required.

Note per task-w25-b's carried-forward house-convention note: this
codebase returns `400 {"error":{"code":"invalid",...}}` for
missing/invalid CSRF, not 403 — not directly re-probed here since (1)
and the save-draft POST above both supplied valid CSRF and succeeded/
failed on their intended validation axis only.

### (3) DEC-229 — track deletion conflict guard

```
POST /api/v1/events/seed_event_0001/tracks  (x-chq-csrf: 1)
{"name":"Walkthrough W27b Throwaway Track","color":"#123456"}
=> 201 {"id":"ysi5t6zue73efjec2axc", ...}

PATCH /api/v1/forms/seed_form_0001  (x-chq-csrf: 1)
{"tracks":["seed_track_0001","seed_track_0002","seed_track_0003","ysi5t6zue73efjec2axc"]}
=> 200, tracks now includes the throwaway track

DELETE /api/v1/tracks/ysi5t6zue73efjec2axc  (x-chq-csrf: 1)
=> 409 {"error":{"code":"conflict","message":"Track is referenced by a form's track selection"}}

PATCH /api/v1/forms/seed_form_0001  (x-chq-csrf: 1)
{"tracks":["seed_track_0001","seed_track_0002","seed_track_0003"]}
=> 200, tracks no longer includes the throwaway track

DELETE /api/v1/tracks/ysi5t6zue73efjec2axc  (x-chq-csrf: 1)
=> 204 No Content
```

DEC-229 confirmed: deleting a track referenced by a form's
`tracks_json` selection 409s without cascading; once removed from the
form, the same DELETE succeeds. (The seed CFP form's `plan_reviewer
.track_id`/`filters_json` reference axes from DEC-229 were not
independently exercised here — only the `tracks_json` axis, which is
the one directly reachable via this form's public track-selection
field; no gap found, but flagging the narrower scope for the record.)

### (4) status changes never auto-email

Mailbox count read via `GET /dev/mailbox`, parsed from the `N
message(s)` string (same pattern as `scripts/walkthrough/scale.ts`'s
`readMailboxCount`). Baseline: **21**.

```
POST /api/v1/events/seed_event_0001/submissions/status
{"ids":["seed_submission_0017"],"status":"accept_queue"}
=> 200 {"updated":1}
mailbox count after: 21 (unchanged)

POST /api/v1/events/seed_event_0001/submissions/status
{"ids":["seed_submission_0017"],"status":"accepted"}
=> 200 {"updated":1}
mailbox count after: 21 (unchanged)
```

`GET /api/v1/submissions/seed_submission_0017` confirms the final
state: `"status":"accepted"`, `"acceptedAt":<epoch-ms>`. Mailbox count
stayed at 21 across the full `pending -> accept_queue -> accepted`
transition — status changes never auto-email, reconfirmed.

## Cleanup

`wrangler dev --port 8965` process tree killed (`workerd` +
`esbuild --service` helpers + top-level `wrangler`/`npm` PIDs); `lsof
-i :8965` confirmed empty afterward. The detached run worktree
`/Users/wednesdayniemeyer/Documents/gniemeyer/Projects/chautauqua-wt/run-w27-b`
was removed via `git worktree remove` after this document was written.

## OPEN ITEMS: 1 (non-blocking)

- DEC-229's conflict guard was verified only via the `tracks_json`
  reference axis (a form's track selection). The `filters_json` and
  `plan_reviewer.track_id` reference axes named in DEC-229 were not
  independently re-probed in this session — they were not newly
  reachable via any fixture data set up here. No defect found or
  suspected; flagging only for completeness of DEC-229's three-axis
  guarantee.

## RESULT: PASS (6/6 walkthrough modules PASS at S = `f01459a` —
producer, review, speaker, public, data, scale all clean, zero FAIL/PLANNER:
lines. All 4 targeted fix checks PASS with curl transcripts: (1)
DEC-227 required-checkbox end-to-end — 400+zero-new-rows when
unchecked, 200+exactly-one-new-row when checked; (2) DEC-228 —
`chq_csrf` cookie HttpOnly+SameSite=Lax+no-Secure over http, draft
cookie HttpOnly+Path=/submit; (3) DEC-229 — track DELETE 409s while
referenced by a form's `tracks_json`, 204s once removed; (4) mailbox
message count unchanged (21) across `pending -> accept_queue ->
accepted`. Zero new defects found. One non-blocking open item: DEC-229's
`filters_json`/`plan_reviewer.track_id` axes not independently
re-probed this session (only `tracks_json`).)
