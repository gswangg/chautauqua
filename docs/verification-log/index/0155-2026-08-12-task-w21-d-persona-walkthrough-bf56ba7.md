## 2026-08-12 task-w21-d — persona walkthrough @ bf56ba7

Log-only lane (DEC-472/438): no file under `src/`, `app/src/`, `scripts/`, `test/`,
`migrations/`, `decisions/`, or `package.json` was touched. SPEC.md:374-377's "actual final exam"
persona walkthrough had no evidence past wave 19; this cuts one at `bf56ba7` ("scribe wave 21").
Full detail (fresh-install log, `npm run walkthrough` per-module table + two harness-bug root
causes, a full J1-J12 manual browser table citing URL + what was seen per persona, phone-width
table for seven surfaces, and one newly-found real product defect) is in
`docs/verification-log/task-w21-d-walkthrough-stage1.md`.

`npm i && npm run db:migrate && npm run seed && npm run dev` (README.md:37-47's exact Quickstart)
worked with zero secrets present and no undocumented manual step. `npm run walkthrough`: 4/6
areas PASS (producer, review, public, scale), 2/6 FAIL — both traced to walkthrough-script bugs,
not product code: `scripts/walkthrough/speaker.ts:643-659` feeds the locked CFP `email` field a
non-email string, correctly rejected by `src/forms/validate.ts`'s DEC-454 email check (400, not
the script's expected 302); `scripts/walkthrough/data.ts:151-157` resolves "the seeded event" as
`items[0]` of a `desc(startDate)`-ordered list with no slug check, so once the `producer` module
(which runs first) creates its own later-dated throwaway events, `data.ts` silently probes exports
against the wrong (empty) event — the "evaluations export has no rows" FAIL is correct behavior
for the wrong event, not a broken export (52 evaluation rows exist in D1 scoped to the real seeded
event; every other walkthrough module resolves the seeded event by slug, `data.ts` is the outlier).

The manual J1-J12 pass (Playwright/chromium against the same running server, all four seeded
personas) found no further defects in: public CFP submit end-to-end (required-track validation +
confirmation + dev-mailbox email), reviewer queue + anonymized scorecard, decision-without-
auto-email (dev-mailbox count unchanged 10->10 across an Accept click), Comms compose -> preview
(merge-field substitution correct) -> send -> dev-mailbox message -> `.ics` download (file content
correct: right UTC instant, right title), agenda grid (clash badge, tray, per the already-PASSing
automated J9 checks), all five public surfaces + five embeds, exports UI, and zero horizontal
overflow at 390x844 across `/submit/<slug>`, all five `/e/<slug>/*` surfaces, and `/portal` (the
agenda's own horizontally-scrolling day-chip strip is the known DEC-424 carve-out, not a defect).

It did find one real, previously-undocumented product defect: `app/src/pages/comms/icsChip.ts:
13-14`'s `formatLocal()` renders the Comms compose-preview's "Calendar invite: ..." chip via
`new Date(iso).toLocaleString(undefined, ...)` — the *viewer's browser* timezone, not the owning
event's. Live-reproduced as a 3-hour discrepancy: session SES-001 is genuinely scheduled
09:00-09:45 **Pacific** (confirmed three ways — the Admin Agenda grid, the speaker portal's own
session line, and the downloaded `.ics`'s `DTSTART:20270512T160000Z` = 09:00 PDT), but the Comms
preview chip, viewed from a machine set to `America/New_York`, showed "12:00 PM - 12:45 PM." The
`.ics` attachment itself is correct (UTC-based, any real calendar client localizes it right) — only
the human-readable admin preview is wrong, which is exactly the class of bug DEC-424's "OWNING
EVENT's tz never toISOString" rule exists to prevent, and could mislead an organizer proofreading a
room/time email before sending it. Not fixed here (`app/src/` is out of this lane's scope).

This worktree was destroyed out-of-band twice mid-lane (once a bare worktree/branch wipe, once a
full directory wipe coincident with a sibling agent's `pkill -f "wrangler dev"; pkill -f "vite"` —
which kills every worktree's dev server on the shared machine, not just its own); both times it was
recreated pinned to the same `bf56ba7` sha rather than rebasing onto whatever `main` had become, so
this report is evidence about one consistent tree throughout. Flagged in the linked log as a
process observation for the scribe, not a product finding.

OPEN ITEMS: 3, all FAIL-unowned (DEC-438) — `scripts/walkthrough/speaker.ts:643-659`,
`scripts/walkthrough/data.ts:151-157` (both harness bugs, product code is correct), and
`app/src/pages/comms/icsChip.ts:13-14` (real product bug, timezone-display only, `.ics` file
contents unaffected).

RESULT: FAIL — 2/6 `npm run walkthrough` areas FAIL (both harness bugs, not product bugs) plus one
newly-found real product defect (Finding 3, Comms preview timezone display) that this lane could
not fix per its log-only scope. Every other job/persona/surface walked by hand in this report
passed with no defects found.

