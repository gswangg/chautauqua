# task-w15-d — c3 wave-14 LIVE regression (DEC-327/DEC-320(ii), confirmation lane 2 of 2)

FROZEN SHA: 2fe1ea0 (merge task-w15-b)
OPEN ITEMS: 0
RESULT: PASS
RECHECK SHA: 2fe1ea0 (no code changes made; log-only lane, code-frozen)

## Scope

Six probes, live over a `wrangler dev` instance, exactly the six surfaces
wave 14 moved (DEC-317/318/319/321/322 — DEC-320 itself is the exit
decision, not a surface). Code-frozen: nothing outside this file was
touched. Port 8796 (assigned to this lane; 8787/8791-8795 not reused).

## Setup

- `npm run build` — `tsc --noEmit` (root) + `tsc --noEmit -p app/tsconfig.json`
  + `vite build` all green (18 admin chunks, ~180 kB / 58.9 kB gzip main
  chunk) at `2fe1ea0`.
- `rm -rf .wrangler/state`
- `npm run db:migrate` — 17/17 migrations applied.
- `npm run seed` — D1 rows seeded, 8 R2 objects put into local
  `chautauqua-files` bucket.
- `cp .dev.vars.example .dev.vars`, then edited `PUBLIC_BASE_URL` to
  `http://localhost:8796` (per DEC-296, matching the assigned port).
- `npx wrangler dev --port 8796` — `GET /health` -> `{"ok":true}`.

### Anomaly during this lane (worth flagging for the swarm)

Mid-lane, the worktree at
`/Users/wednesdayniemeyer/Documents/gniemeyer/Projects/chautauqua-wt/task-w15-d`
was found emptied (only `.wrangler/` survived) and `git worktree list`
against the main repo no longer showed it — the `wrangler dev` process
had also died. `main`'s tip had also moved backward relative to what this
lane started against (`f0d56ce` "scribe wave 15" at lane start ->
`2fe1ea0` "merge task-w15-b" after recreating the worktree), consistent
with concurrent swarm activity elsewhere in the repo rather than local
corruption (the branch cited in this lane's original assignment,
`task-w15-d`, had also vanished as a ref). Recovery: deleted the stray
`task-w15-d-retry` branch left by a failed `worktree add`, recreated the
worktree fresh via `git worktree add ... -b task-w15-d main`, and reran
the entire setup (build/migrate/seed/dev.vars/wrangler dev) and every
probe from scratch against the new instance. All results below are from
the POST-recovery run, are self-consistent, and match the pre-recovery
partial run byte-for-byte on every probe that was re-run (Probes 1 and 2
were run once before the anomaly and once after, with identical status
codes and error shapes both times). No file outside this log was written
or left behind by the recovery.

## Probe 1 — DEC-317 portal authz (three sub-checks)

Setup: `POST /api/v1/events/:eventId/submissions` (organizer, no
`contact`) to build a bare submission, then
`POST /api/v1/submissions/:id/participants` (DEC-070 invite endpoint) to
add a second contact — this reproduces "a submission with two
participants" without any direct DB write.

### 1a — declined co-speaker loses read+write+file access, existence-hidden

- Created submission `subA` owned by speaker1 (Priya Raman,
  `sbek-speaker@example.com`), invited speaker2 (Marcus Okafor) as a
  co-presenter: `POST /api/v1/submissions/subA/participants` ->
  `201 {"inviteStatus":"invited", ...}`.
- Speaker1 uploaded a file to `subA` while still an active participant:
  `POST /api/v1/submissions/subA/files` -> `201` (fileId
  `sybh7tni24bmhvf76pdr`).
- Speaker2 declined: `POST /portal/invitations/:participantId`
  `{action: "decline"}` -> `302`.
- As speaker2 (now declined):
  - `GET /portal/submissions/subA` -> **404** (existence-hiding — the
    submission-detail loader's `PORTAL_VISIBLE_INVITE_STATUSES` gate,
    `src/domain/acceptance.ts:93`, consumed at `src/server/repo/portal.ts:133`,
    excludes `declined`).
  - `GET /portal/submissions/subA/edit` -> **404** (`loadEditableSubmission`'s
    `ACTIVE_INVITE_STATUSES` gate, `src/server/repo/portal-edit.ts:80`).
  - `POST /portal/submissions/subA/edit` -> **404** (same loader, re-checked
    server-side per `src/routes/portal/edit.tsx:220-224`, never trusting a
    stale client render).
  - `GET /files/:fileId` (speaker1's upload) -> **403** — `canAccessFile`
    (`src/server/repo/files-authz.ts:111`) with `getSubmissionScope`'s
    `ACTIVE_INVITE_STATUSES` filter (`files-authz.ts:9,42`) excluding the
    declined contact from `participantContactIds`, and
    `uploadedByContactId` belonging to speaker1, not speaker2.

### 1b — still-'invited' participant: read yes, edit no

- Fresh submission `subB`, speaker2 invited and left unanswered
  (`inviteStatus: "invited"`).
- `GET /portal/submissions/subB` -> **200** (`PORTAL_VISIBLE_INVITE_STATUSES`
  includes `invited`, `src/domain/acceptance.ts:93`).
- `GET /portal/submissions/subB/edit` -> **404** (`ACTIVE_INVITE_STATUSES`
  excludes `invited` — read and write really are two different gates).

### 1c — self-upload clause survives a later status change

`canTransitionInvite` (`src/server/repo/portal.ts:494-496`) only allows a
transition FROM `invited`, and file-upload write-authz
(`authzSubmissionWrite`, `src/routes/files.ts:60-75`) requires the
uploader's own participant row to already be in `ACTIVE_INVITE_STATUSES`
— so there is no way, purely through the documented HTTP surface, to
reach "declined, and I uploaded this file myself" (an `invited` row can't
upload; only `none`/`accepted` can, and neither of those can decline).
To exercise the OR-branch of `canAccessFile`
(`uploadedByContactId === auth.contactId`,
`src/server/repo/files-authz.ts:118`) against a live declined row, this
probe: (i) had speaker2 **accept** `subB` (`POST /portal/invitations/:id`
`{action:"accept"}` -> `302`, now active), (ii) speaker2 self-uploaded a
file to `subB` (`POST /api/v1/submissions/subB/files` -> `201`,
`uploadedByContactId` = speaker2's own contact id), then (iii) used a
direct local-D1 SQL statement (`npx wrangler d1 execute chautauqua
--local --command "UPDATE participant SET invite_status='declined' WHERE
id='<participantId>'"`) purely as test-data setup — no product code was
touched, and the subsequent assertions are all live HTTP calls through
the running app — to fast-forward the row to `declined`, simulating the
only state DEC-317's own text describes ("regardless of what you later
did with the invitation") that the current API has no transition path
to construct.
- Post-flip, `GET /portal/submissions/subB` -> **404** (declined, as
  expected — confirms the flip took, mirroring 1a).
- `GET /files/:selfUploadedFileId` -> **200**,
  `content-disposition: attachment; filename="own-deck.pdf"` — the
  self-upload clause holds even though the same contact's portal-detail
  read is now blocked.

Both the pre-recovery and post-recovery runs produced identical status
codes and JSON error shapes at every step of Probe 1.

## Probe 2 — DEC-317 compose atomic preflight

- Built a submission with **zero** active participants: created via
  `POST /api/v1/events/:eventId/submissions` with no `contact` (zero
  participant rows), invited speaker2
  (`POST /api/v1/submissions/:id/participants`), then speaker2 declined
  (`POST /portal/invitations/:id {action:"decline"}` -> `302`) — leaving
  the submission's only participant row `invite_status='declined'`.
  `GET /api/v1/submissions/:id` confirms `participants: [{...,
  "inviteStatus":"declined"}]`.
- `GET /api/v1/events/:eventId/email-log?perPage=1` -> `total: 3` (baseline).
- `POST /api/v1/events/:eventId/compose/preview`
  `{submissionIds:[id], subject, bodyText}` -> **400**
  `{"error":{"code":"invalid","message":"Some selected sessions have no
  eligible recipients","fields":{"<submissionId>":"no eligible
  recipients"}}}` — matches `noRecipientFields`
  (`src/routes/comms.ts:213`) exactly, keyed per-submission-id.
- `POST /api/v1/events/:eventId/compose/send` with the identical body ->
  **same 400**, same fields shape (`src/routes/comms.ts:371-374`).
- `GET /api/v1/events/:eventId/email-log?perPage=1` -> `total: 3`,
  **unchanged** — the atomic preflight (DEC-019/DEC-317) rejected the
  whole batch before any `mailer.send` call, nothing half-sent.

## Probe 3 — DEC-318 agenda/public schedule parity

- Fixture event `devflow-conf-2027`: `startDate=2027-05-12`,
  `endDate=2027-05-14`.
- Picked an already-accepted seeded submission
  (`seed_submission_0027`, "Beyond the Hype: Monorepo Tooling in
  Practice") and placed it on the event's last day:
  `PUT /api/v1/submissions/seed_submission_0027/slot`
  `{day:"2027-05-14", startMin:540, endMin:600}` -> `200`.
- BEFORE shrink: admin agenda `summary = {"unplaced":3,"conflicts":1}`;
  public session page mentions the scheduled time.
- Shrunk the event: `PATCH /api/v1/events/:eventId`
  `{..., endDate:"2027-05-13"}` -> `200` (no validator blocks this even
  though a slot now falls outside the new range — DEC-318's premise).
- AFTER shrink:
  - Admin agenda `summary = {"unplaced":5,"conflicts":1}` (unplaced count
    rose by 2 — the target session plus one more pre-existing
    out-of-range row) and `GET /api/v1/events/:eventId/agenda`'s
    `unscheduled[]` array now contains
    `{"submissionId":"seed_submission_0027", "ref":"SES-027", ...}` with
    no day/time fields — `isDayWithinEventRange`
    (`src/server/repo/agenda.ts:42`, applied at `:280` and `:336`)
    reclassified it live.
  - `GET /e/devflow-conf-2027/agenda` -> `200`, body does **not** mention
    the target title or `05-14` anywhere.
  - `GET /e/devflow-conf-2027/agenda.ics` -> `200`, does not mention the
    target title.
  - `GET /e/devflow-conf-2027/sessions/seed_submission_0027` -> `200`,
    does not mention `05-14`, does say "Not yet scheduled".
  - `GET /e/devflow-conf-2027/schedule.ics?ids=seed_submission_0027` ->
    `200`, body is `BEGIN:VCALENDAR...END:VCALENDAR` with **no VEVENT** —
    the stale itinerary is entirely absent, not just unscheduled-flagged.
  - `GET /embed/devflow-conf-2027/sessions.json` -> `200`, the target
    entry is present (correctly — this surface always lists accepted
    sessions) but with `"day":null,"startMin":null,"endMin":null,
    "roomName":null` — unscheduled, no stale time leaking through.
  - No surface published a stale slot anywhere.

## Probe 4 — DEC-319 reminder cap/dedupe

- `GET /api/v1/events/:eventId/email-log?perPage=1` -> `total: 3` before.
- 1st `POST /api/v1/events/:eventId/onboarding/remind` `{}` -> `200
  {"sent":9,"failed":[],"skipped":0,"remaining":0}`; email-log total ->
  `12` (9 new rows, matches `sent`).
- 2nd identical call, inside the 1h `MANUAL_DEDUPE_WINDOW_MS`
  (`src/domain/reminders.ts:12`) -> `200
  {"sent":0,"failed":[],"skipped":9,"remaining":0}`; email-log total
  still `12` — **no new rows**, every contact deduped.
- The `MAX_REMINDER_BATCH=100` cap itself (`src/domain/reminders.ts:11`)
  is unit-covered in `test/reminders-batch.test.ts` (not re-derived here
  by seeding 300 speakers, per the task's own note) —
  `npx vitest run test/reminders-batch.test.ts` -> **10/10 passed**,
  including `"caps at MAX_REMINDER_BATCH by default, sorted by contactId
  ascending"` and `"yields 100 groups and remaining=150 for 250
  contacts, stable contactId ordering"`.

## Probe 5 — DEC-321 CFP job title/company/bio, blank-only fill

- `GET /api/v1/events/:eventId/forms` confirms the default CFP form's
  field set now includes `job_title`, `company`, `bio` locked fields
  (`src/forms/types.ts:45-51`, `src/server/repo/forms.ts:101`,
  `OPTIONAL_LOCKED_SPEAKER_FIELDS`).
- Submitted `POST /submit/devflow-conf-2027` with a fresh email plus
  `field__<formId>:job_title="Director of Testing"`,
  `field__<formId>:company="Acme Corp"`,
  `field__<formId>:bio="Probe5 speaker bio text."` -> `200` (confirmation
  page, claim link rendered).
- New submission created with a brand-new contact,
  `participant.inviteStatus:"none"` (self-submitted).
- Accepted (`POST .../submissions/status {ids, status:"accepted"}` ->
  `200`), content-approved (`POST
  /api/v1/submissions/:id/content-status {"contentStatus":"approved"}` ->
  `200`), participant explicitly set `visible:true`.
- `GET /api/v1/contacts/:contactId` -> `{"title":"Director of
  Testing","company":"Acme Corp","bio":"Probe5 speaker bio text."}` — the
  contact columns, not a `submission_answer` blob (DEC-016 "locked = real
  cols").
- `GET /e/devflow-conf-2027/speakers` HTML contains both "Director of
  Testing" and "Acme Corp" for this speaker.
- `GET /api/v1/events/:eventId/export/speakers?format=csv` row:
  `Probe5,Speaker,<email>,Acme Corp,Director of Testing,,true` — company
  and title columns populated (header:
  `firstName,lastName,email,company,title,acceptedSessions,visible`,
  `src/server/repo/exports.ts:231`).
- Re-submitted the CFP with the **same email** and a **different**
  `job_title`/`company`/`bio` -> `200`. `GET /api/v1/contacts/:contactId`
  afterward: **unchanged** — still `"title":"Director of
  Testing","company":"Acme Corp","bio":"Probe5 speaker bio text."` — the
  blank-only fill rule held; a non-empty stored value was never
  overwritten by a later CFP submission.

## Probe 6 — DEC-322 safeExternalUrl allowlist

- `PATCH /api/v1/contacts/:contactId`
  `{"socialLinks":{"twitter":"https://twitter.com/probe5speaker",
  "linkedin":"javascript:alert(1)"}}` -> `200` (the writer itself still
  accepts any string — validation is at render, per DEC-322's design).
- `GET /e/devflow-conf-2027/speakers/:contactId` raw HTML:
  - Exactly **one** social anchor rendered:
    `<a href="https://twitter.com/probe5speaker" rel="noopener noreferrer
    nofollow" target="_blank">` — matches
    `src/routes/public/detail.tsx:38-43` verbatim (both `rel` tokens and
    `target="_blank"` present).
  - The `javascript:` link was dropped entirely (not rendered as inert
    text either) — `safeExternalUrl` (`src/domain/contacts.ts:36`,
    consumed at `src/server/repo/public.ts:644`) returned `null` for it.
  - The literal string `javascript:` does **not** appear anywhere in the
    raw page HTML (`detailPage.includes("javascript:")` -> `false`).

## Summary

All six DEC-317/318/319/321/322 surfaces confirmed live and unchanged
since wave 14 landed. Zero open items. This lane made no code changes —
FROZEN SHA and RECHECK SHA are identical (`2fe1ea0`).
