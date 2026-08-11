# task-w12-c — walkthrough @ 7f7477e

DEC-188 wave-12 gate lane: full `npm run walkthrough` battery at S'' = the
`merge task-w12-a` commit, verifying DEC-187's zero-setup `.dev.vars`
bootstrap on a genuinely fresh checkout (no pre-existing `.dev.vars`
anywhere in the gate worktree).

## S'' derivation (DEC-114, DEC-188)

`git -C /Users/wednesdayniemeyer/Documents/gniemeyer/Projects/chautauqua
log --first-parent --oneline -5` from `main`'s tip:

```
7f7477e merge task-w12-a
35eef1d scribe wave 12
9fc982c merge task-w11-d
431a1c0 merge task-w11-b
8d88882 merge task-w11-c
```

`7f7477e` ("merge task-w12-a") is the newest code-bearing first-parent
commit — matches DEC-188's expected S'' exactly; w12-a's merge is present,
so the FAIL-precondition branch does not apply.

`git merge-base --is-ancestor 2dd2f33 7f7477e` exits 0 — ancestry
satisfied.

## Precondition grep set (17 prior markers + DEC-187 + tracked-file check)

All confirmed present at `7f7477e` via `git show 7f7477e:<path> | grep`:

- 6 DEC-177 w6-fix anchors: `DEC-167` in `src/domain/contacts.ts`,
  `ICS_ORGANIZER_EMAIL` in `src/mail/ics.ts`, `unknown track id` in
  `src/routes/api/forms.ts`, `anonymized === false` in
  `src/server/repo/files.ts`, `openDate`/`openAt: plan.openDate` in
  `app/src/pages/review/PlanEditor.tsx`, `FORM_TASK_FIELD_SPECS` in
  `scripts/seed.ts` — all PRESENT.
- 6 DEC-177 harness-closure anchors: `DEC-174` in `scripts/seed.ts`;
  `DEC-173` in both `scripts/walkthrough/public.ts` and
  `scripts/walkthrough/speaker.ts`; `DEC-175` in
  `scripts/walkthrough/producer.ts`, `scripts/walkthrough/speaker.ts`, and
  `scripts/walkthrough/review.ts` — all PRESENT.
- 5 DEC-185 markers: `DEC-179` in `src/lib/csv.ts`, `DEC-180` in
  `src/lib/rate-limit.ts`, `DEC-181` in `src/server/middleware.ts`,
  `DEC-182` in `src/server/http.ts`, `DEC-183` in `wrangler.jsonc` — all
  PRESENT (17/17 total).
- DEC-187 markers: `DEC-187` present in both `scripts/ensure-dev-vars.ts`
  and `test/wrangler-config.test.ts`; `"ensure-dev-vars"` present in
  `package.json` (`"predev": "tsx scripts/ensure-dev-vars.ts"`).
- `git ls-tree -r 7f7477e --name-only | grep '^\.dev\.vars'` shows only
  `.dev.vars.example` tracked; `.dev.vars` is NOT tracked.

No precondition miss.

## Fresh detached gate worktree

`git worktree add --detach
/Users/wednesdayniemeyer/Documents/gniemeyer/Projects/chautauqua-wt/gate-w12-c
7f7477e` — confirmed no pre-existing `.dev.vars` in the new worktree
before any command ran (`ls .dev.vars` -> No such file or directory).

- `npm ci --prefer-offline --no-audit --no-fund`: clean, 423 packages.
- `npm run db:migrate`: PASS, 13/13 migrations applied.
- `npm run seed`: PASS (contacts/submissions/files/R2 objects seeded, 8
  R2 objects put).
- Boot: `npx tsx scripts/ensure-dev-vars.ts && npx wrangler dev --port
  8787`. First line of output: **`ensure-dev-vars: created .dev.vars from
  .dev.vars.example`** — direct evidence the DEC-187 zero-setup bootstrap
  materializes `.dev.vars` from the tracked `.dev.vars.example` on a
  checkout with no `.dev.vars` present, with no secret ever read or
  echoed (the script's own contract: never reads/prints the file, only
  reports "created"/"exists"). This local generated copy (not the main
  worktree's `.dev.vars`, which is never touched or read by this gate)
  is the only `.dev.vars` referenced anywhere in this evidence.
- `curl http://127.0.0.1:8787/health` returned `{"ok":true}` on the first
  attempt (server up almost immediately).

## `npm run walkthrough` result

All modules reported PASS, matching the module order printed by
`scripts/walkthrough.ts`'s own summary:

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

6/6 modules green (producer, review, speaker, public, data, scale — the
"scale" module covers J11/J12 CRM+API surfaces plus the 6-step bulk-scale
probe; "public" covers J9/J10). Includes the DEC-175 object-level authz
probes inside `speaker.ts` (existence-hiding 404s, cross-speaker 403s on
task-assignment forms/files, organizer-API 403s for a speaker session) —
all `ok`.

DEC-187/DEC-175 `/dev/mailbox` 200 assertions specifically exercised and
passed (each is a hard `assert`/`assertStatus` that would abort the run
and flip the enclosing module to FAIL on any non-200):

- `scripts/walkthrough/speaker.ts:401` — `GET /dev/mailbox?perPage=50`
  asserted `status === 200` after a bulk onboarding reminder; module
  `speaker` reported PASS.
- `scripts/walkthrough/producer.ts:450` — `GET /dev/mailbox` asserted
  status 200 confirming the claim-link confirmation email; module
  `producer` reported PASS.
- `scripts/walkthrough/scale.ts:301` — `GET /dev/mailbox` asserted status
  200 in step 5 (no-auto-email-on-status-change probe); module `scale`
  reported PASS.

Since the harness aborts the whole run on any assertion failure and all
six modules printed PASS with no errors, these three mailbox-200
assertions are proven to have executed and passed on this clean
checkout — direct proof DEC-187 restores the dev mailbox after the
`.dev.vars` untrack (629d57e) without reintroducing a tracked secret
file.

Server was stopped after the run (`pkill -f "wrangler dev --port 8787"`);
port 8787 confirmed free afterward.

## OPEN ITEMS

0

## RESULT

PASS
