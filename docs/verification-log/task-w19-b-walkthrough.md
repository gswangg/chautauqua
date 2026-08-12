# 2026-08-10 task-w19-b — walkthrough @ 8c7f479

Full detail for the `## 2026-08-10 task-w19-b — walkthrough @ 8c7f479` section
of `docs/verification-log.md` (extracted per the contention-decomposition of
that file; see the stub entry there for `RESULT` summary).

Wave-19 five-gate battery (DEC-135), walkthrough scope, at fresh port
8881.

**STEP 1 — sha derivation (DEC-114/DEC-129).** Worktree cut from `main`
tip `9038b5c` ("scribe wave 19"). First-parent walk: `9038b5c`'s diff
(`git diff --name-only 9038b5c^ 9038b5c`) touches only
`decisions/DEC-135.md`, `field-guide/index.md`, and `src/decisions.ts`
— checked the `src/decisions.ts` hunk directly and it is a single
pure `export const DEC_135 = "...";` string-constant append, no other
change — so `9038b5c` falls inside DEC-114's bookkeeping-exclusion
set and is not code-bearing. Its first parent `8c7f479` ("merge
task-w18-c") touches `src/routes/public/submit.tsx` and
`test/submit-hidden-file-field.test.ts` — code-bearing. `8c7f479` is
therefore the newest code-bearing main sha.
`git merge-base --is-ancestor 675219f 8c7f479` exits 0 — ancestor
check passes (DEC-129).

**STEP 2 — behavioral preflight of DEC-130..133 (DEC-135, marker
alone insufficient).** All four read directly from the
`8c7f479`-identical worktree tree (the only diff between `9038b5c` and
`8c7f479` is the excluded bookkeeping above, so HEAD's working tree is
behaviorally identical to `8c7f479` for this check):
- DEC-130 (`src/domain/schedule.ts`): `autoSchedule` builds
  `roomIndex`/`speakerIndex` incremental occupancy maps from
  `existing` up front and checks candidate placements against those
  maps via an `overlaps()` helper — no call to `findConflicts` and no
  `[...placed, candidate]` trial-array pattern anywhere in the
  function body. Marker present.
- DEC-131 (`src/mail/ics.ts` `escapeText`, lines 39-47): the
  replace-chain order is `\r\n`→`\n`, then bare `\r`→`\n`, THEN the
  backslash/semicolon/comma/newline escaping passes — CR is fully
  normalized to `\n` before any escaping touches the string. Marker
  present.
- DEC-132 (`src/routes/public/submit.tsx`): the file-validation loop
  (~line 415) has `if (!isVisible(field, answers)) continue;` before
  any upload validation or `answers[field.id] = "pending"` write; the
  post-submission upload loop (~line 479) has
  `if (cleaned[field.id] !== "pending") continue;` gating every R2
  put / file-row insert. Marker present.
- DEC-133 (`src/server/repo/submissions/status.ts`, ~line 207): builds
  `missing = requested.filter(id => !foundIdSet.has(id))` and throws
  `ApiError("invalid", ...)` naming the missing ids BEFORE the
  per-row `changeStatus`/UPDATE loop that follows. Marker present.

All four markers present and behaviorally verified — preflight PASS,
proceeding to STEP 3.

**STEP 3 — install/build/migrate/seed/wrangler-dev/walkthrough.**
`npm ci` (node_modules already present, skipped per guard) then
`npm run build`: clean (tsc x2 + vite build, no errors). Port 8881 had
no prior listener. `rm -rf .wrangler/state` then `npm run db:migrate`:
all 10 migrations applied (0000..0009), 2 commands executed
successfully against local D1. `npm run seed`: completed, 6 objects
put into local R2 bucket `chautauqua-files`, no errors. Started
`npx wrangler dev --port 8881` in the background; log showed
`[wrangler:info] Ready on http://localhost:8881` within ~6s.

`npm run walkthrough -- --url http://localhost:8881` — all six
modules ran (five required by this task plus a bonus `scale` module
the harness runs by default), full summary:

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

No FAIL lines, no PLANNER: lines in the run. Producer/review modules
(head of the run, scrolled past in the capture below) both reported
their own internal `ok`/pass lines with no failures before speaker's
tail (captured in full below):

- speaker module: co-presenter invites (A/B/C), IDOR rejection on
  foreign participant rows, invitation accept/decline, bulk accept of
  A/B/C, DEC-108 invite-visibility gates on `/sessions` and
  `/speakers`, portal bio edit round-trip, form-close-date portal-edit
  gating (accepted vs unaccepted), upload allowlist/size-cap
  rejection, version-chain re-upload (v1→v2 `previous_file_id`),
  comment/reply thread, content-approval visibility gate — all `ok`.
- public module: J9 agenda/drag-place/auto-schedule/conflict-surface
  checks and J10 all five public surfaces (sessions/speakers/agenda/
  schedule/gallery) + embed variants + `.ics` idempotent UID + three
  visibility gates (non-accepted, content-unapproved, hidden
  participant) + DEC-108 invite-visibility gate — all `ok`.
- data module: J11 contacts/CSV-import/merge/segments/bulk-email
  (incl. >100 cap rejection)/dashboard-stats, J12 bearer-token mint +
  cookie-less GET + revocation + role-403 + exports (csv/json,
  showflow.csv columns) + cross-org 404 + `/docs/api` 200 — all `ok`.
- (Note: a second walkthrough re-run against the same live server for
  transcript-capture purposes hit an expected `409 conflict` on
  `provision second reviewer via /api/v1/users` — the walkthrough
  creates fixture users that are not idempotent across repeat runs
  against unreset state; this is a re-run artifact, not a defect, and
  the FIRST run captured above is the authoritative PASS record for
  this gate.)

**EXTRA spot-check (DEC-131, read-only).** Fetched the seeded public
itinerary export:
`curl -s "http://localhost:8881/e/devflow-conf-2027/schedule.ics?ids=seed_submission_0004,seed_submission_0005,seed_submission_0006"`
— 3 VEVENTs, including a folded multi-line `DESCRIPTION` with
seed-fixture text. Byte-level check (Python, and corroborated by
`od -c`): 41 total `\r` bytes in the response body; a scan of every
byte confirmed each `\r` is immediately followed by `\n` — 0 bare/bad
CRs. `od -c` tail sample:
```
0002600    w   o   r   k       a   g   a   i   n   s   t   .  \r  \n   E
0002620    N   D   :   V   E   V   E   N   T  \r  \n   E   N   D   :   V
0002640    C   A   L   E   N   D   A   R  \r  \n
```
No bare `\r` observed anywhere in the file (line terminators and
RFC-5545 §3.1 75-octet folds are the only source of `\r`, always
paired with `\n`). Spot-check PASS, consistent with DEC-131.

Server killed (`lsof -ti :8881 | xargs kill`) after the spot-check;
port confirmed free.

RESULT: PASS
