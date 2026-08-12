# task-w16-b: J1-J12 persona walkthrough (LOG-ONLY, stage 1)

Scope per DEC-448: fresh `npm run db:migrate && npm run seed` + `npm run
walkthrough` transcription, plus a human-style Playwright walk of the two
surfaces wave 15 changed that had never been walked by a human — the
assisted-chasing reminder-preview dialog (SPEC §10 #3) and the review
results/reviewer-queue payload-width rewrite (DEC-439/DEC-440) — plus the
DEC-411/DEC-424 mobile spill check on public surfaces. No source file
changed; this file is the only artifact.

Booted per DEC-448: `npm run dev -- --port 28787` (the `predev` hook ran
`ensure-dev-vars` + the app build; no manual `.dev.vars` copy, no bare
`wrangler dev`). **Gotcha for future workers**: another worktree's stale
`wrangler dev` was already squatting on the default port 8787 (a leftover
process from `task-w16-d`). Running `npm run walkthrough` with no `--url`
silently hits whatever is on `localhost:8787` — which may be a *different
worktree's* seeded DB, not your own. Always pass an explicit `--url` for
a port you booted yourself in your own worktree.

## Job 1 — `npm run walkthrough` (fresh migrate+seed, own server on :28787)

First attempt against the *stray* port-8787 server (not mine) produced a
spurious `FAIL: org2-organizer POST /login (expected 302, got 401)` in the
`review` module — discarded once traced to hitting the wrong worktree's
server/DB. Re-run against my own freshly migrated+seeded server on
`:28787` (`npm run walkthrough -- --url http://localhost:28787`):

```
Summary:
  PASS producer
  PASS review
  PASS speaker
  PASS public
  PASS data
  PASS scale

walkthrough OK
```

All J1–J12 checks (producer J1/J2/J3/J5, review J4, speaker J6/J7/J8,
public J9/J10, data J11/J12, scale) passed with no failures — full ok-line
transcript captured during the run; representative excerpt:

- producer: `Running J1 (launch a CFP)... ok`, `J2 ... ok`, `J3 (triage at
  volume) ... ok`, `J5 (compose: merge fields, cap, ICS, HTML escaping)
  ... ok`, DEC-175 authz probes `ok`.
- review: queue = exactly {track A} ∪ {extra submission}, fewest-ratings-
  first order, anonymized detail has no speaker fields, scorecard round-
  trips, max-evaluations cap rejects overflow, reviewer→admin-settings/
  results 403, second-org organizer→404 (DEC-039), DEC-175 existence-
  hiding (404 not 403) on out-of-scope submission/evaluation, progress/
  remind/results-sort/CSV all `ok`.
- speaker: full onboarding-task, form-task, file_request+deliverable+
  comment-thread, invite/accept/decline, portal edit, close-date gate,
  upload-cap/allowlist, version chain, DEC-175 IDOR probes all `ok`.
- public: J9 agenda placement/conflicts/auto-schedule/counts, J10 all five
  public surfaces + embeds + visibility gates (DEC-108/DEC-274) all `ok`.
- data: J11 contacts/CSV import/merge/segment/bulk-email(+cap), J12 bearer
  token mint/cookie-less/revoke/403/exports/docs, all `ok`.
- scale: 110-row bulk accept 247ms, email-log unchanged, exactly-once
  re-accept, no auto-email, purge-refresh probe — all `PASS`.

## Job 2a — SPEC §10 #3 assisted chasing: onboarding grid → "Review reminders"

Browser walk (Playwright, real chromium, organizer login) of
`/admin/speakers` → "Remind all outstanding" → the preview dialog backed by
`POST /api/v1/events/:eventId/onboarding/remind/preview`
(`src/routes/tasks.ts:465`), then the real send
(`POST /api/v1/events/:eventId/onboarding/remind`), then `/dev/mailbox`.

| Assertion | Evidence | Result |
|---|---|---|
| Opening the preview sends NOTHING | `/dev/mailbox` row-marker count before opening the dialog: 21 (later run: 51). After the preview POST resolved (200, `drafts=100`/`21`) and the dialog was showing, count re-checked: unchanged (21→21, 51→51) before Send was clicked. | PASS |
| Recipient list matches who actually receives | Preview response `drafts` array (100 then 21 contacts, decreasing as outstanding contacts got reminded) rendered verbatim in the dialog's `<ul class="chq-speakers-remind-recipients">`, one `name · email` row per draft; the subsequent send response (`{"sent":100,...}` then `{"sent":21,"skipped":109,"remaining":0}`) matches the same count of drafts shown. | PASS |
| Drafted subject/text is byte-identical to what lands in `/dev/mailbox` | Captured first draft from the preview JSON: `subject: "Action needed: outstanding tasks for DevFlow Conf 2027"`, `text` a 5-line outstanding-tasks list. After Send, located that same recipient's row in `/dev/mailbox`, opened its detail page: `<title>` (untransformed, unlike the CSS-uppercased `.chq-section-label`) reads exactly `"Action needed: outstanding tasks for DevFlow Conf 2027 - Dev mailbox - Chautauqua"` — subject matches. `<pre class="chq-tool-pre">` body text string-equality-checked against the preview draft's `text`: **`true`** (exact `===` match in the script, including the em-dashes and line breaks). Both draft and sent message are built from `buildReminderMessage` (`src/server/repo/tasks/reminders.ts:83`) as designed — confirmed no divergence. | PASS |

Note: the mailbox list/detail page visually renders the subject in
ALL CAPS via a CSS `text-transform: uppercase` on `.chq-section-label` —
this is a rendering artifact, not a data difference; the `<title>` tag
(unstyled) and the raw JSON preview both carry the original mixed-case
string, which is what was compared for byte-identity.

## Job 2b — Review results + reviewer queue after DEC-439/DEC-440 rewrite

Confirmed `src/routes/review/shared.ts:259` (`buildResults`) calls
`listPlanFilteredSubmissions(c.var.db, plan, { withTrackIds: false })` per
DEC-439, and reads only `submission_id`/`scores_json` per DEC-440.

| Assertion | Evidence | Result |
|---|---|---|
| Results count/average/perCriterion/perDropdown match seeded evaluations | Fetched `GET /api/v1/plans/:id/results` (161 total rows, 50 on page 1) and the rendered `/admin/review/plans/:id/results` table; row values match 1:1 (e.g. SES-001 average 4.33, count 2, content-quality 4.00, delivery 5.00, dropdown "Maybe x2 / Approve x0" in both API JSON and rendered table). | PASS |
| Ranking order correct | Programmatically checked the full 50-row API page: strictly non-increasing by `average`, and within an `average` tie, non-increasing by `count` — held for every adjacent pair (top 11 rows tied at 4.333.., ordered count 2 before count 1, as DEC-345 specifies). | PASS |
| Reviewer queue = exactly the requesting reviewer's assignment, fewest-ratings-first | Logged in as the seeded reviewer, `GET /api/v1/review/plans/:id/queue` returned `total: 7, open: true`, `ratingsCount` sequence `[0,0,0,0,0,1,1]` — non-decreasing (fewest-ratings-first). Admin `/admin/review` page for the reviewer role rendered "Your evaluation plans" with the two assigned plans, matching the API-scoped set. | PASS |
| DEC-440 invariant survived (JS aggregation, throws on missing score, no SQL AVG/GROUP BY) | Read `src/domain/evaluation.ts`: `aggregateSubmission` sums `evals[].scores[criterion.id]` in a JS loop and does `throw new Error('aggregateSubmission: missing score for criterion "…"')` when a score is absent (not coerced to 0/NULL); `aggregateDropdownCriterion` likewise throws on a missing/non-string/out-of-range dropdown value. `src/routes/review/shared.ts` calls these two functions directly (`aggregateSubmission`, `aggregateDropdownCriterion` imported and invoked at lines 280/284) — no `AVG(...)`/`GROUP BY` SQL was found replacing them; `listPlanFilteredSubmissions`/`listEvaluationScoresForPlan` fetch raw rows only. | PASS |

## Job 3 — Public surfaces at 390x844 (DEC-411 shim, DEC-424 real-spill rule)

`addInitScript({ content: PAGE_EVALUATE_KEEPNAMES_SHIM })` applied first on
every page (per DEC-411, verbatim shim from `scripts/render-sweep-lib.ts`).
Spill check: `element.scrollWidth > element.clientWidth` on the element
itself, walking up the ancestor chain to exclude anything inside an
element whose own `overflow-x` is `auto`/`scroll` (DEC-424).

| Route | docScrollWidth | Real spill offenders |
|---|---|---|
| `/e/devflow-conf-2027/sessions` | 390 | 0 |
| `/e/devflow-conf-2027/speakers` | 390 | 0 |
| `/e/devflow-conf-2027/agenda` | 390 | 0 (see note) |
| `/e/devflow-conf-2027/schedule` | 390 | 0 (see note) |
| `/e/devflow-conf-2027/gallery` | 390 | 0 |

Note: the raw scan flagged `DIV.chq-pub-agenda-day-scroll` on
agenda/schedule (`scrollWidth=775, clientWidth=358`). Traced to
`src/routes/public/public.css.ts:169`:
`.chq-pub-agenda-day-scroll { overflow-x: auto; ... }` and
`src/routes/public/agenda.tsx:39` — this div *is* the intentional
horizontal scroller (DEC-424's carve-out), not a child spilling out of one.
No document-level (`documentElement.scrollWidth === 390` on every route)
or true off-scroller spill was found. PASS.

## OPEN ITEMS: 0

## RESULT: PASS

All J1–J12 walkthrough modules pass on a freshly migrated+seeded local
server; both wave-15 surfaces (assisted-chasing reminder dialog, review
results/queue post-DEC-439/440) behave correctly under a real browser with
no divergence between preview and sent content, correct aggregation/
ordering, and no un-owned regression; public surfaces have zero real
horizontal spill at 390x844.
