# task-w11-b — walkthrough @ 7561cc1 (detail)

DEC-186/DEC-185/DEC-177 wave-11 battery, walkthrough lane, log-only
(no code changes; ledger append only).

## S' derivation (DEC-114 first-parent walk)

`git log --first-parent --oneline` from `main` (tip observed at task
start: `bdc472b` "scribe wave 11"):

```
bdc472b scribe wave 11
b57bdfd merge task-w9-g
7561cc1 merge task-w10-d      <- S'
44487c1 merge task-w10-b
...
```

- `bdc472b` ("scribe wave 11") touches `.dev.vars`, `decisions/DEC-186.md`,
  `field-guide/index.md`, `src/decisions.ts` — bookkeeping (new decision
  doc + its compile-checked constant + field-guide compaction), not a
  code-bearing feature commit; skipped per DEC-114.
- `b57bdfd` ("merge task-w9-g") diffs `docs/verification-log.md` and
  `docs/verification-log/task-w9-g-triage-closure.md` only — doc-only;
  skipped per DEC-114.
- `7561cc1` ("merge task-w10-d") is therefore the newest code-bearing
  first-parent commit. **S' = `7561cc1`**, matching the DEC-186/field-guide
  expectation exactly.

Ancestor check: `git merge-base --is-ancestor 2dd2f33 7561cc1` exits 0
(DEC-139 campaign-3 lineage confirmed).

**Note for the record (out of scope for this gate, flagged for the
scribe/planner):** `bdc472b`'s `.dev.vars` diff adds a line
`AIRTABLE_TOKEN=pathzAthDnBQJC2IF.9...` alongside the existing
`DEV_MODE=1`. This commit is *after* S' and therefore not part of the
tree under test here, but it is a secret-shaped value committed to a
tracked file on `main`, which appears to conflict with the STAGE 1
zero-secret invariant. Not actioned by this log-only lane (out of
scope); surfacing for a future gate/scribe pass since it postdates S'.

## Precondition greps (17: 12 DEC-177 anchors + 5 DEC-185 markers) — all HIT at S'

1. `DEC-167` in `src/domain/contacts.ts:165` — hit
2. `ICS_ORGANIZER_EMAIL` in `src/mail/ics.ts:15` — hit
3. `"unknown track id"` in `src/routes/api/forms.ts:113` — hit
4. `"anonymized === false"` in `src/server/repo/files.ts:153` — hit
5. `openDate` in `app/src/pages/review/PlanEditor.tsx:107,138,143` — hit
6. `FORM_TASK_FIELD_SPECS` in `scripts/seed.ts:19,909,931` — hit
7. `DEC-174` in `scripts/seed.ts:975` — hit
8. `DEC-173` in `scripts/walkthrough/public.ts:440` — hit
9. `DEC-173` in `scripts/walkthrough/speaker.ts:923` — hit
10. `DEC-175` in `scripts/walkthrough/producer.ts:773+` — hit
11. `DEC-175` in `scripts/walkthrough/speaker.ts:1156+` (8 probes) — hit
12. `DEC-175` in `scripts/walkthrough/review.ts:312+` (4 probes) — hit
13. `DEC-179` in `src/lib/csv.ts:145` — hit
14. `DEC-180` in `src/lib/rate-limit.ts:41` — hit
15. `DEC-181` in `src/server/middleware.ts:262` — hit
16. `DEC-182` in `src/server/http.ts:51` — hit
17. `DEC-183` in `wrangler.jsonc:39` — hit

No miss. Not a precondition FAIL.

## Fresh worktree run

Fresh detached worktree at `7561cc1`
(`/Users/wednesdayniemeyer/Documents/gniemeyer/Projects/chautauqua-wt/task-w11-b-Sprime`).

- `npm ci --prefer-offline --no-audit --no-fund --silent` — clean.
- `npm run build` — PASS, 0 tsc errors (root + app), vite build clean
  (131 modules, `index-*.js` 180.16 kB / gzip 58.90 kB).
- `.dev.vars` present at S': `# DEC-183\nDEV_MODE=1` (no
  `AIRTABLE_TOKEN` line here — that only lands post-S' at `bdc472b`,
  see note above). `wrangler dev` auto-loads it (confirmed: dev-only
  routes such as `/dev/mailbox`, exercised via the walkthrough's
  reliance on the dev mailbox for J5/J12 checks, worked without a
  configured `RESEND`-style secret).
- `npm run db:migrate` (`wrangler d1 migrations apply chautauqua
  --local`) — 13 migrations, all `✅`.
- `npm run seed` — clean; seed-r2 put 8 objects into local R2 bucket
  `chautauqua-files`.
- `wrangler dev` (default port 8787) started in the background;
  `/health` returned `200` within a few seconds.
- `npm run walkthrough` (default `--url http://localhost:8787`) — exit
  code 0.

## Result: 6/6 modules PASS

```
PASS producer
PASS review
PASS speaker
PASS public
PASS data
PASS scale
```

- producer: J1/J2/J3/J5 all `ok`, plus `Running DEC-175 authz probes
  (unauthenticated requests)... ok` — covers unauthenticated GET
  `/admin` -> 302, `/api/v1/contacts` -> 401, `/api/v1/review/plans`
  -> 401, `/files/:id` -> 401 (source-confirmed at
  `scripts/walkthrough/producer.ts:781-792`).
- review: all `ok`, including the DEC-175 out-of-scope-reviewer block
  (`... -> 404 (not 403)` for both detail and evaluation-PUT, twice
  confirmed as existence-hiding not authz-denial).
- speaker: `organizer logs in (form login, chq_csrf cookie contract)`
  `ok`, task-assignment form completion `ok`, and the DEC-175
  speaker2-cross-tenant block (8 checks, all `ok`): portal submission
  404 (existence-hiding), task-assignment form GET/POST 403,
  task-complete 403, uploaded file 403, and three organizer-API-as-
  speaker-session 403s (`/api/v1/events/:id/submissions`,
  `/api/v1/contacts`, `/api/v1/events/:id/email-log`).
- public: `walkthrough/public.ts OK — all J9/J10 checks passed`.
- data: `walkthrough:data OK — J11/J12 checks passed` (bearer token
  mint via cookie + CSRF).
- scale: all 6 steps PASS (bulk-accept exactly-once, dev-mailbox count
  unchanged, purge-refresh visible immediately).

## DEC-180/181 impact on walkthrough login/logout flows

- **DEC-180 (login rate limiter counts failures only, success
  resets budget):** no change observed. The walkthrough's single
  organizer login and single speaker login are each one successful
  attempt; the limiter never engages. No FAIL, no behavioral
  difference from pre-DEC-180 runs recorded by sibling waves.
- **DEC-181 (`csrfFormOrHeader` on `/logout` and the portal
  sign-out token):** **not exercised by the walkthrough at all.**
  Grepped `scripts/walkthrough/**` for `logout` — zero hits; none of
  the six modules ever calls `/logout` or the portal sign-out route.
  DEC-181's CSRF requirement therefore has no observable effect on
  this gate either way (neither breaking nor confirming it); it
  remains untested by the walkthrough harness. Flagging as a coverage
  gap, not a defect — DEC-181's own unit/integration tests (if any,
  outside this lane's scope) are the actual verification surface for
  that change.

Server shutdown: `pkill -f "wrangler dev"` after the run completed;
confirmed no lingering listener on 8787.

OPEN ITEMS: 1 (non-blocking, out of scope) — the post-S' `bdc472b`
`.dev.vars` `AIRTABLE_TOKEN` addition noted above should be looked at
by a future gate/scribe pass; it does not affect this walkthrough's
PASS result since it postdates S'.

RESULT: PASS (6/6 modules PASS at S' = `7561cc1`, including all
DEC-175 negative-authz probes; DEC-180/181 do not alter walkthrough
login behavior and DEC-181's logout-CSRF change is untested by the
walkthrough harness as noted above).
