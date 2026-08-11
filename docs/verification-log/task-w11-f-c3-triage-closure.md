# task-w11-f - triage-closure @ 84e2c04

FROZEN SHA: 84e2c04de087310f39877140cb6e239fab018e6c
WAVE-10 GATE: PASS
OPEN ITEMS: 0
RESULT: PASS
RECHECK SHA: n/a

## Protocol

`S=$(git rev-parse refs/heads/main)` = `84e2c04de087310f39877140cb6e239fab018e6c`.
`git merge-base --is-ancestor 84e2c04de087310f39877140cb6e239fab018e6c
refs/heads/main` confirmed (exit 0). Work done inside
`git worktree add /Users/wednesdayniemeyer/Documents/gniemeyer/Projects/chautauqua-wt/task-w11-f -b task-w11-f main`
(detached-equivalent: HEAD landed exactly on `main`'s tip at the moment of
creation and was never advanced). No product code, tests, decisions/,
field-guide/, or docs/eval-findings.md was touched by this lane. No port
was needed — every row below is settled by static file:line evidence, not
by running a server.

## WAVE-10 CONTENT GATE (DEC-303), all seven re-run at S

| id | check | result |
|---|---|---|
| G1 | `src/routes/root.tsx` contains `res.status !== 304` | PASS (line 47) |
| G2 | `.dev.vars.example` contains `PUBLIC_BASE_URL=http://localhost:8787` AND `src/server/origin.ts` contains `firstLoopbackCandidate` | PASS (`.dev.vars.example:6`; `origin.ts:107,114,123`) |
| G3 | `src/routes/public/index.tsx` sets `Cache-Control: no-store` on the non-200 path | PASS (`publicNotFound` helper, line 55, wired at every `publicNotFound(c, ...)` call site, e.g. lines 93/113/115/127/129) |
| G4 | `src/routes/agenda.ts` contains `parseBoundedInt` and `gridMin: { min: 1, max: 480 }` | PASS (line 140 fn def; line 133 bound) |
| G5 | `src/server/repo/attribution.ts` contains `isNull(schema.participant.titleAtTime)` | PASS (line 40) |
| G6 | `src/routes/api/forms.ts` + `src/server/repo/forms.ts` implement the 409/`cascade=1` field delete | PASS (`forms.ts` route lines 217-218 gate on `cascade=1`; `src/server/repo/forms.ts:281` cascade comment/impl) |
| G7 | `src/routes/api/events.ts` contains `name: "General"` | PASS (line 223) |

All seven present at S. `WAVE-10 GATE: PASS` — no MISSING ids, no polling
needed.

## Scope note on the task's "twelve rows" estimate

The task text estimates "f cites 7, g cites 2, h cites 1 — twelve rows
total". Re-reading each source log's own `OPEN ITEMS:` line directly
(not the prose estimate) gives 7 + 2 + 1 = **10**, which is also what a
manual count of each log's adjudication table (rows marked STILL OPEN /
OPEN ITEM N) produces. Recorded as found — ten rows below, not adjusted
to force a match to twelve. No row was invented or dropped to hit either
number.

## Adjudication — one row per OPEN ITEM cited by task-w8-{f,g,h}-c2-*.md

| # | citing log:line | item | file:line evidence read at S | verdict |
|---|---|---|---|---|
| 1 | task-w8-f-c2-triage-closure.md:55 | wave-1 baseline doc (185f/1584t) vs task-w2-a's fresh measurement (184f/1573t), restatement 1, in `docs/verification-log/task-w1-a-origin-walkthrough.md` | n/a — historical count inside a verification log, not product code | WAIVED — DEC-293 ("the doc-typo pair is WAIVED here in the manner of DEC-272 ... It must not appear as an OPEN ITEM in any future section"). Not counted in OPEN ITEMS. |
| 2 | task-w8-f-c2-triage-closure.md:63 | same stale-count item, restatement 2 (via `task-w3-a-c2-wave2-closeout.md:65-77`) | n/a | WAIVED — DEC-293, same waiver, same non-count. |
| 3 | task-w8-f-c2-triage-closure.md:70 | public `/e/:slug/sessions/:id` 404 carries a 60s `Cache-Control` header set before the not-found branch | `src/routes/public/index.tsx:48-55` `publicNotFound()` sets `Cache-Control: no-store` and returns the 404 in one call, invoked at every not-found branch in the file (lines 93, 113, 115, 127, 129, 148, 150, 162, 164, 185, 231) — `setCacheHeaders(c)` (the 60s success-path header) is never called on any of these paths; the two are mutually exclusive branches, not sequential calls | CLOSED — DEC-297. `src/routes/public/index.tsx:48-55` (`publicNotFound`). |
| 4 | task-w8-f-c2-triage-closure.md:73 | SPK-03: no event-speaker-roster-scoped/bulk CSV import | `src/routes/api/contacts.ts:349-360` (`POST /contacts/import` now accepts an optional `body.eventId`; validated against `getEventForOrg`); `:391-401` (imported/updated contacts not already on the roster are pushed onto the event via `listAcceptedContactIds`/add-to-event in the same request, returning `addedToEvent`); `app/src/pages/contacts/ImportWizard.tsx:14,19,77,200` (wizard accepts and forwards `eventId`) | CLOSED — DEC-290 (`src/decisions.ts` `DEC_290`, imported at `contacts.ts:25`). |
| 5 | task-w8-f-c2-triage-closure.md:74 | SPK-15: no first-class travel-preference/logistics field, only generic `customFields` JSON | `app/src/pages/contacts/customFields.ts:6` (`export const TRAVEL_KEY = 'travel_logistics'`), `:2,36` (reserved key surfaced as a labeled "Travel & logistics" textarea; hand-typed duplicate key is a loud validation error) | CLOSED — DEC-292 (`src/decisions.ts:297` `DEC_292`). |
| 6 | task-w8-f-c2-triage-closure.md:75 | EMB-15: embed panel offers only iframe-snippet-per-surface, no branding/color/content-filter/field-selection config | `app/src/pages/settings/EmbedsPanel.tsx:1-26` + `app/src/pages/settings/embedSnippet.ts:1-41` (organizer embed builder: output-format-as-path-suffix picker, `fields` allowlist, ics fixed-feed option); `src/routes/public/index.tsx:138,224` + `src/routes/public/feeds.ts` (server-side JSON/ics feed surfaces consuming the same params) | CLOSED — DEC-289 (`src/decisions.ts` `DEC_289`, referenced throughout `src/routes/public/*.tsx` and `app/src/pages/settings/embedSnippet.ts`). |
| 7 | task-w8-f-c2-triage-closure.md:77 | emailed absolute links resolve to `http://chautauqua.cc` instead of `http://localhost:8787` even with a loopback `Origin`/`Referer` | `src/server/origin.ts:95-118` (`resolveBaseUrl`): dev-mode loopback-header sniffing (`firstLoopbackCandidate`, lines 123-132) now runs even when a loopback `PUBLIC_BASE_URL` default is configured (lines 106-109), and `.dev.vars.example:6` ships `PUBLIC_BASE_URL=http://localhost:8787` as the dev default so a fresh clone never falls through to `requestOrigin` | CLOSED — DEC-296. |
| 8 | task-w8-g-c2-fresh-clone.md:62-86 | `/admin` intermittently 500s for a logged-in organizer (304-treated-as-failure) | `src/routes/root.tsx:36-50` (`fetchAdminShell`): `if (!res.ok && res.status !== 304)` — a 304 from the ASSETS binding on a conditional revisit is now treated as success, only a genuinely non-ok/non-304 status throws | CLOSED — DEC-295 (`void DEC_295;` at `root.tsx:21`; see also WAVE-10 GATE G1 above). |
| 9 | task-w8-g-c2-fresh-clone.md:88-109 | CFP-confirmation claim link off-origin (`chautauqua.cc` not `localhost:8787`) | same evidence as row 7 (`src/server/origin.ts:95-132`, `.dev.vars.example:6`) — this is the identical underlying defect cited independently by the fresh-clone lane | CLOSED — DEC-296, same evidence as row 7. |
| 10 | task-w8-h-c2-rubric-coverage.md:190-193 | SPK-03 (rubric-coverage phrasing): no single event-scoped or bulk speaker-roster CSV import | same evidence as row 4 (`src/routes/api/contacts.ts:349-401`, DEC-290) | CLOSED — DEC-290, same evidence as row 4. |

Ten rows, matching the sum of each source log's own `OPEN ITEMS:` count
(7 + 2 + 1). Two are WAIVED per DEC-293 and excluded from the OPEN ITEMS
count; the remaining eight are CLOSED with file:line evidence read
directly at S. Nothing in this batch is STILL OPEN.

## DEC-306 note (not an open item, recorded per task instruction)

`src/server/repo/contacts/merge.ts`'s `task_assignment` tie-break was
re-read at S per the task's explicit instruction not to re-open it: the
`else` branch pushes `mergeTask.id` (not `keepTask.id`) into the delete
list in every case except `mergeComplete && !keepComplete`, so the KEPT
row survives by construction in the asymmetric case too, and
`task_assignment` is one of the seven `CONTACT_FK_TABLES` entries
(`src/server/repo/contacts/query.ts`) that gets repointed before the
losing contact row is deleted. Confirmed correct per DEC-306; not logged
as an open item.

## Sweep of docs/eval-findings.md

`grep -n '^## [A-Z]\.' docs/eval-findings.md` at S returns sections A, B,
C, D (unchanged shape from DEC-293's read). This file is a separate,
older PRODUCTION-round findings artifact (predates the campaign-2 wave-8
citations above; header dates it "LIVE production" not local `wrangler
dev`), not itself one of the eight cited wave-8 logs — swept per the
task's explicit instruction, not because it is in the primary citation
set.

Section A's two rows are self-labeled RATIFY, not OPEN, and are already
landed: `src/auth/password.ts:16` `ITERATIONS = 100_000` (workerd's cap,
DEC-004/DEC-237); `src/routes/public/submit.tsx:624` wraps the
confirmation send in try/catch (best-effort, row already persisted).

Sections B/C/D's rows describe browser-observed defects (reviewer
assignment "User not found", queue links to `/submissions/undefined`,
CRM merge no-op, deliverables dashboard, file version history, file
comment threads, submissions table track/format columns, review results
dropdown column) that this product-read-only lane cannot re-run live in
a browser without a port, so each was spot-checked against the product
surface it names rather than re-run end-to-end:

- reviewer queue links: `app/src/pages/review/ReviewerQueue.tsx:106`
  `<Link to={`/review/plans/${planId}/submissions/${item.submissionId}`}>`
  — keyed off `item.submissionId`, not an undefined field.
- CRM merge route: `src/routes/api/contacts.ts:415`
  `POST /contacts/merge` exists and is exercised by
  `test/contacts-duplicates-merge-route.test.ts` (cited COVERED at
  CRM-06 in task-w8-h-c2-rubric-coverage.md).
- submissions table track/format: `app/src/pages/submissions/
  SubmissionsTable.tsx:30-34` `trackNames()` — "DEC-243: render track
  NAMES, not the raw count of trackIds" — plus a `findFormatField`
  column deriver (line 7, 72-73).
- file version history: `app/src/pages/content/VersionList.tsx` +
  `app/src/pages/content/version-chain.ts` (cited COVERED at CNT-04).
- file comment threads: `app/src/pages/content/CommentThread.tsx` (cited
  COVERED at CNT-05, `src/routes/files.ts:258/265`).
- review results dropdown criterion: `app/src/pages/review/
  PlanEditor.tsx:474,519-520` dropdown criterion kind exists end-to-end;
  `src/domain/evaluation.ts:242` `aggregateDropdownCriterion` keeps the
  dropdown distribution out of the numeric average (cited COVERED at
  ABS-03/ABS-10).

Every named symptom traces to a code path that DEC-243/DEC-289/DEC-290/
DEC-292/DEC-295/DEC-296/DEC-297 or the pre-existing rubric-coverage
evidence (task-w8-h-c2-rubric-coverage.md, CNT-04/CNT-05/CFP-06/ABS-10 =
COVERED) already shows implemented and test-covered at S. None reads as
genuinely open against the current tree. This is a spot-check against
named files/behavior, not a live-browser re-run of every D-tier polish
item (D-section items are UI-feel/timing observations — e.g. "no visible
confirmation", "occasionally no-ops" — that are not mechanically
verifiable by static file:line reading without a running server, and
this lane was not instructed to open port 8794 speculatively). No row
from this file is added to OPEN ITEMS; flagging the spot-check-not-
exhaustive caveat rather than silently treating the sweep as complete.

## POST-S DELTA

```
```

Empty — `git log --oneline 84e2c04de087310f39877140cb6e239fab018e6c..refs/heads/main -- src app migrations scripts test` returned nothing, confirming zero product commits landed on `main` between this lane's freeze and the moment this log was written (DEC-303/DEC-280).

## OPEN ITEMS: 0

RESULT: PASS — all ten adjudicated rows from task-w8-{f,g,h}-c2-*.md are
either WAIVED (DEC-293, x2, historical doc-typo, never counted) or
CLOSED with file:line/DEC evidence read directly at S (x8). The
docs/eval-findings.md sweep found no row genuinely open against the
current tree. DEC-306's flagged claim is confirmed correct, not opened.
