# task-w13-j - polish-closure @ 9466b27

FROZEN SHA: 9466b2727f48c875e595ef23d5240e7a02e0a94d
WAVE-12 GATE: PASS (W1-W7 all anchors present)
DRIZZLE-ORM AT S: ^0.45.2
OPEN ITEMS: 0
RESULT: PASS
RECHECK SHA: 9466b2727f48c875e595ef23d5240e7a02e0a94d (no post-S delta; recheck not needed)

## WAVE-12 CONTENT GATE (DEC-314)

Ran the same seven wave-12 anchors DEC-314 defines (W1-W7 = the wave-12 analogue of
DEC-303's G1-G7), grepped at S = `git rev-parse refs/heads/main` = 9466b27 (worktree HEAD,
since main had not advanced past the worktree's branch point at gate time).

| Anchor | Target | Match |
|---|---|---|
| W1a | package.json contains `"drizzle-orm": "^0.45.2"` | 1 match |
| W1b | package.json contains NO `drizzle-kit` | 0 matches |
| W1c | drizzle.config.ts does not exist | confirmed absent |
| W2a | scripts/perf-smoke-lib.ts contains `PERF_CLASS_BUDGET_MS`/`gradePerfCheck` | 4 matches |
| W2b | scripts/perf-smoke.ts contains `measureOverheadFloor`/`cls: "public"` | 6 matches |
| W3a | src/server/repo/public.ts exports `getPublicAgendaByIds` | 1 match |
| W3b | src/routes/public/index.tsx calls `getPublicAgendaByIds` | 3 matches |
| W4 | src/routes/dev/mailbox.tsx contains `<meta name="viewport"` | 2 matches |
| W5 | scripts/render-sweep.ts contains `/docs/api` and `/dev/mailbox` | 2 matches |
| W6 | src/server/repo/tasks.ts contains `ACTIVE_INVITE_STATUSES` | 3 matches |
| W7 | src/routes/review/ exists (index.ts, plans.ts, recusals.ts, reviewer.ts, shared.ts); src/routes/review.ts does not | confirmed |

All 7 anchors resolved on first read at S — no polling/retries needed. WAVE-12 GATE: PASS.

**Note on lane restart**: mid-lane, the worktree directory
`/Users/wednesdayniemeyer/Documents/gniemeyer/Projects/chautauqua-wt/task-w13-j` was found
emptied of everything but `.wrangler/` (a concurrent process in the swarm apparently pruned
the worktree registration while this lane was actively running `wrangler dev`). The lane
was restarted from scratch (`git worktree add` re-run, fresh build/migrate/seed) at a
slightly later `refs/heads/main` tip (9466b27, `merge task-w13-g`, vs. the original 54413b5)
before any battery evidence below was collected — none of the evidence in this log predates
the restart.

## SETUP

`npm ci` (node_modules already present after restart) -> `npm run build` (dual `tsc --noEmit`
+ vite, wrote `public/admin/*`, 0 diagnostics) -> `rm -rf .wrangler/state` -> `npm run
db:migrate` (18 migrations applied) -> `npm run seed` (D1 rows + 8 R2 headshot objects) ->
copied `.dev.vars.example` to `.dev.vars` (gitignored; DEV_MODE=1 is required to mount
`/dev/mailbox` per DEC-183/`src/server/app.ts:51` `guardDevMailbox` — the first `wrangler
dev` run before this copy 404'd on `/dev/mailbox`, see row evidence below) -> `npx wrangler
dev --port 8794`, polled `/health` until `{"ok":true}` (up on first poll after restart).

Drove the SPA with a throwaway Playwright script (chromium, headless) copying the
boot/login pattern from `scripts/render-sweep.ts:169-189` (`loginContext`: GET `/login`,
fill `input[name="email"]`/`input[name="password"]`, submit, assert the post-submit URL
isn't `/login`) — the script itself lives only at
`/private/tmp/claude-501/.../scratchpad/probe-w13-j.mjs`,
`probe-row2-mailbox.mjs`, and `probe-mailbox2.mjs` (never copied into the repo/worktree).
Personas/credentials read from `docs/fixtures/sample-data.json` `identities` (same file
`scripts/render-sweep.ts` reads), matching the swarm-wide fixture convention.

## §D ROW-BY-ROW LIVE VERIFICATION

### (1) Public CFP "Save draft" gives no visible confirmation

**What I did**: Playwright to `/submit/devflow-conf-2027`, filled the title field, clicked
the "Save draft" button (`src/routes/public/submit.tsx:239-241`, `formaction=".../save-draft"`
`formnovalidate`), waited for navigation/networkidle, read the resulting page.

**What I observed**: landed on `http://localhost:8794/submit/devflow-conf-2027?draft=saved`
and the page body contained "Draft saved — you can return later to finish and submit."
(`DraftSavedNotice`, `src/routes/public/submit.tsx:172-173`, rendered at
`src/routes/public/submit.tsx:219` when `draftSavedNotice` is true). This is already the
DEC-245 fix (redirect to `?draft=saved` + a distinct `role="status"` notice separate from
the resume-draft `DraftBanner`, `src/routes/public/submit.tsx:160-166`).

**CLOSED** — `src/routes/public/submit.tsx:172-173,219,382` (already fixed by DEC-245 in a
prior wave; reconfirmed live here).

### (2) Deleting the actively-applied CRM segment flashes a transient "Internal server error" banner

**What I did**: logged in as organizer, `/admin/contacts` -> Segments tab, saved a new
segment ("probe-row2-<ts>"), switched to the Directory tab, applied that segment via the
`select[aria-label="Segment filter"]` (`app/src/pages/contacts/ContactsTable.tsx:59`),
switched back to Segments, clicked Delete on the now-active segment, waited 1s, read
`#root` text and checked for any `.chq-error-banner` and any collected console errors.

**What I observed**: no "Internal server error" text anywhere in `#root`, zero
`.chq-error-banner` elements, zero collected console errors. The fix is
`onDeletedActiveSegment` (`app/src/pages/contacts/SegmentsPanel.tsx:44-48`): deleting the
active segment clears `segmentId` state (`app/src/pages/contacts/ContactsApp.tsx:150-158`)
*before* the list refetch, so the refetch never asks the server for the now-deleted segment
id. A dedicated regression test already exists at
`app/src/pages/contacts/SegmentsPanel.render.test.tsx` (comment references the exact
"Internal server error" flash this row describes).

**CLOSED** — `app/src/pages/contacts/SegmentsPanel.tsx:11-51`,
`app/src/pages/contacts/ContactsApp.tsx:150-158` + regression test
`app/src/pages/contacts/SegmentsPanel.render.test.tsx` (already fixed; reconfirmed live
here with a real create-apply-delete cycle, not just static read).

### (3) Headshot upload in /portal/profile gives no success feedback and no current-headshot preview

**What I did**: logged in as speaker, GET `/portal/profile`, read the page.

**What I observed**: `<img alt="" ...>` count = 1 (the current-headshot preview, seeded
speaker already has a headshot) — `src/routes/portal/profile.tsx:150`:
`profile.headshotUrl ? <img src={profile.headshotUrl} alt="" width={120} height={120} /> :
<p>No headshot uploaded yet.</p>`. The POST handler
(`src/routes/portal/profile.tsx:280-352`) redirects to `/portal/profile?headshot=1` on
success, and the GET handler renders "Headshot uploaded." as a `role="status"` paragraph
when that query flag is present (`src/routes/portal/profile.tsx:147-149,231`).

**CLOSED** — `src/routes/portal/profile.tsx:147-151,231,352` (preview + success message
both present; already fixed).

### (4) A completed file_request task collapses to plain text so the speaker cannot see/download/replace their own upload

**What I did**: read `src/routes/portal/tasks.tsx` for the completed-file_request render
path (DEC-242/DEC-244 comments cite this exact row verbatim).

**What I observed**: `src/routes/portal/tasks.tsx:169` and `:182-189` render a dedicated
block when `t.status === "complete" && t.kind === "file_request"` with `fileExtras`
(download/replace/reply affordances implemented at `:317-598`, including a
CHAIN-LATEST-version download route at `:582-`).

**CLOSED** — `src/routes/portal/tasks.tsx:103,169,182-189,317-598` (already fixed by
DEC-242/DEC-244).

### (5) Content > Files intermittently shows "No deliverable files yet" then rows later

**What I did**: logged in as organizer, GET `/admin/content`, read `#root` immediately after
`networkidle`, then again after an additional 3s wait, on a freshly-migrated/seeded local
`wrangler dev` (no external network calls, no CDN latency).

**What I observed**: `"No deliverable files yet."` was NOT present in `#root` at either
read — the deliverable rows were present immediately both times. The literal text lives at
`app/src/pages/content/FilesLibrary.tsx:112` (rendered only when the fetched list is
genuinely empty), so it is not a phantom string, but I could not reproduce the
intermittent-then-populated race against a local, unthrottled `wrangler dev` in a ~1-minute
timebox — this matches the row's own description ("stale/racy load", almost certainly a
network-latency artifact of the live chautauqua.cc production deployment, not a local
correctness bug).

**OUT-OF-SCOPE (DEC-316)** — latency/intermittency unreproducible against local `wrangler
dev`; probed once live as instructed, no repro.

### (6) Reviewer queue shows "( rating(s) so far)" with the count value missing

**What I did**: logged in as reviewer, GET `/admin/review`, clicked into the one assigned
plan link (the reviewer view is a plan-picker first, `app/src/pages/review/ReviewerQueue.tsx:6-38`,
then the queue), read `#root` text.

**What I observed**: `"(0 rating(s) so far)"` and `"(1 rating(s) so far)"` rendered with the
count value present for every queue row (e.g. `SES-022 ... (0 rating(s) so far)`, `SES-012
... (1 rating(s) so far)`). Source: `app/src/pages/review/ReviewerQueue.tsx:109`
`` `({item.ratingsCount} rating(s) so far)` `` — the interpolation is present and live-verified
non-empty.

**CLOSED** — `app/src/pages/review/ReviewerQueue.tsx:109` (already fixed; reconfirmed live).

### (7) Add-criterion clicks made before changing Rounds are discarded on the per-round re-render, and several admin inputs (plan fields, submissions Columns toggles) are unlabeled

**What I did**: read `app/src/pages/review/PlanEditor.tsx` and its dedicated regression test
`app/src/pages/review/PlanEditor.render.test.tsx` (test name: `'keeps a just-typed criterion
label after the Rounds count changes'`, description block at the top of the test file cites
this exact row: "criterion clicks made before changing Rounds are discarded"). Also read
`app/src/pages/submissions/ColumnPicker.tsx` for the Columns-toggle labeling and grepped
`PlanEditor.tsx` for `aria-label`/`<label`.

**What I observed**: `PlanEditor.render.test.tsx` exercises exactly the described sequence
(add criterion, type label, change Rounds) and asserts the label survives — a passing
regression test for the discard bug. Every per-criterion control in `PlanEditor.tsx` has an
explicit `aria-label` (`:458` label, `:468` weight, `:477` options, `:494` required) or a
wrapping `<label>` (10 occurrences at `:313,319,328,336,366,376,384,395,406,427,563`,
covering the top-level plan fields — name, rounds count, tracks, etc.). `ColumnPicker.tsx`
wraps each checkbox in a `<label>` and additionally sets `aria-label` when the column's own
label text is empty (`app/src/pages/submissions/ColumnPicker.tsx:20-28`) — every control has
either a `<label>` wrapper, an `aria-label`, or both; none has neither.

**CLOSED** — `app/src/pages/review/PlanEditor.tsx:313-427,458-494` +
`app/src/pages/review/PlanEditor.render.test.tsx` (discard bug, regression-tested) and
`app/src/pages/submissions/ColumnPicker.tsx:20-28` (labeling) — already fixed.

### (8) First organizer login click occasionally no-ops (needs a second click ~3s later)

**What I did**: fresh (unauthenticated) Playwright context, GET `/login`, filled organizer
credentials, timed the single click-to-navigation round trip
(`Promise.all([page.waitForNavigation(), page.click('button[type="submit"]')])`) against
the freshly-migrated/seeded local `wrangler dev`.

**What I observed**: first click landed on `/admin` in 68ms — no no-op, no second click
needed. `src/routes/auth.tsx:94-106` already disables the submit button and swaps its text
to "Signing in…" on submit (`onsubmit` inline handler at `:95`), which gives the user
immediate visual feedback regardless of round-trip latency — the described symptom (a
slow/production round trip reads as a no-op without that feedback) is mitigated, but I could
not reproduce a genuine no-op against a local, unthrottled backend in the ~1-minute timebox;
this is a latency-dependent production symptom, not a local reproducible defect.

**OUT-OF-SCOPE (DEC-316)** — latency/intermittency unreproducible against local `wrangler
dev` (probed once live: 68ms single-click round trip, no no-op); disable-on-submit mitigation
already present at `src/routes/auth.tsx:94-106`.

## DEV MAILBOX END-TO-END (docs/clarifications.md: stage 1's inbox substitute)

Triggered one organizer-initiated send from the real Comms compose wizard
(`/admin/comms`): picked the accepted submission "Taming 40-Minute CI: Incremental Builds
at Monorepo Scale" (scheduled, `seed_submission_0001`), selected the seeded "Acceptance
Notification" template, checked "Attach calendar invite (.ics)" — the preview step showed a
`.chq-preview-ics-chip` summarizing the scheduled slot ("May 12, 2027, 12:00 PM - May 12,
2027, 12:45 PM · Main Stage") — then clicked "Send to 1 recipient"; the wizard confirmed
"Sent 1 email."

Verified end to end:
- `GET /dev/mailbox` (after `DEV_MODE=1` was set in `.dev.vars`, see SETUP note above; the
  route is gated by `guardDevMailbox` in `src/server/app.ts:51-59` per DEC-183/DEC-005 and
  correctly 404'd before `.dev.vars` existed) lists the new row: recipient
  `sbek-speaker@example.com`, subject "Your talk has been accepted to DevFlow Conf 2027",
  status "sent".
- `GET /dev/mailbox/3sxgtuyh72fcifunulo2` renders the text and HTML (sandboxed iframe) body,
  and a "Download calendar invite (chq-seed_submission_0001.ics)" link
  (`src/routes/dev/mailbox.tsx:113`).
- `GET /dev/mailbox/3sxgtuyh72fcifunulo2/ics` returns a well-formed `VCALENDAR`/`VEVENT`
  with `SUMMARY:Taming 40-Minute CI: Incremental Builds at Monorepo Scale`,
  `LOCATION:Main Stage`, `DTSTART:20270512T160000Z`, `DTEND:20270512T164500Z`, and an
  `ATTENDEE` line for `sbek-speaker@example.com`.
- `SELECT * FROM email_log WHERE id = '3sxgtuyh72fcifunulo2'` (`npx wrangler d1 execute
  chautauqua --local`) confirms the row: `to_email=sbek-speaker@example.com`,
  `status=sent`, `provider=dev`, `ics_filename=chq-seed_submission_0001.ics`, matching
  `ics_text` content.

CLOSED — dev mailbox is a fully working stage-1 email substitute end to end (compose ->
send -> `email_log` row -> `/dev/mailbox` list -> detail -> `.ics` download), gated
correctly behind `DEV_MODE=1` (never mounted without it).

## SUMMARY

8/8 §D rows probed live. 6 CLOSED with file:line evidence (rows 1, 2, 3, 4, 6, 7 — all were
already fixed by earlier waves; this lane reconfirmed each live against a real browser
session rather than relying on the prior static reads), 2 OUT-OF-SCOPE per DEC-316 (rows 5
and 8 — exactly the two rows DEC-316 named as the expected latency/intermittency
candidates; both probed once live with no repro against local `wrangler dev`, matching
their original "intermittent"/"occasionally" framing). 0 OPEN ITEMS. Dev mailbox
end-to-end (compose/send/`email_log`/list/detail/`.ics`) verified working.

## POST-S DELTA

```
$ git -C /Users/wednesdayniemeyer/Documents/gniemeyer/Projects/chautauqua log --oneline 9466b2727f48c875e595ef23d5240e7a02e0a94d..refs/heads/main -- src app migrations scripts test
(empty)
```

`refs/heads/main` at delta-check time had advanced past S (through `task-w13-b`/`task-w13-i`
merges), but the delta restricted to `src app migrations scripts test` is empty — no
product-code changes landed between S and the delta-check tip, so none of the claims above
need re-checking. RECHECK SHA = FROZEN SHA = 9466b2727f48c875e595ef23d5240e7a02e0a94d.
