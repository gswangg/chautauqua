# task-w26-f — J1-J12 walkthrough @ 73f380f2

DIAGNOSTIC ONLY. Per DEC-069's wave-26 amendment, this receipt does NOT
qualify for the exit predicate: wave 26 lands five code lanes, so code has
merged on top of the sha measured here by the time this file is read. Its
sole purpose is to hand wave 27's pure gate battery a defect list before
that wave runs, not to certify the tip.

Measured sha (first command run in the worktree, before any other step):

```
$ git rev-parse HEAD
73f380f2defc9495f3971367eead0dd666c3c863
```

## Setup

```
npx tsx scripts/ensure-dev-vars.ts        # created .dev.vars from .dev.vars.example
npx vite build --config app/vite.config.ts   # OK, "built in 986ms"
npm run db:migrate                        # OK, 38/38 migrations applied
npm run seed                              # OK, "seed-r2: put 35 object(s)..."
```

`.dev.vars`'s default `PUBLIC_BASE_URL=http://localhost:8787` (DEC-296)
does not match the port this lane chose (8823 — no sibling worktree in
this session was found holding 8787/8799/8811/8823/8835/8847). Left as-is
for the first boot, the walkthrough's J2 step failed on an off-origin
scraped reset-link host (`resolveScrapedHref` refuses the mismatch) — this
is a harness/env-var mismatch on this lane's own setup, not a product
defect, so it was corrected (`.dev.vars` is gitignored, not `src/`) and
the D1/R2 local state was wiped and re-seeded for a clean, single,
authoritative run:

```
rm -rf .wrangler/state
npm run db:migrate
npm run seed
npx wrangler dev --port 8823   # background; waited for GET / -> 200
npx tsx scripts/walkthrough.ts --url http://localhost:8823
```

Boot log confirmed bindings resolved locally (KV/D1/R2/ASSETS/EMAIL) and
`GET / 200 OK` before the walkthrough was launched.

## Walkthrough result (single clean run against fresh seed)

```
Summary:
  PASS producer
  PASS review
  FAIL speaker
  PASS public
  PASS data
  PASS scale

walkthrough FAILED
```

### The one failing check

```
FAIL [GET /portal/tasks shows the DEC-244 deliverable panel for the
completed 'Walkthrough ad hoc file task <ts>' assignment]: row is missing
'version 2'
```

Repro: log in as the seeded speaker (Priya, `contactIdx 0`, seeded via
`scripts/seed.ts`'s DEC-739 pre-completion loop which mints this speaker's
ad hoc file-request assignment at `version_no=1`), organizer creates a
`kind='file_request'` ad hoc task, assigns it to the speaker,
`POST /portal/tasks/:assignmentId/upload` (multipart, replacing the
existing version — lands at version 2 per chain semantics), then
`GET /portal/tasks` as the speaker. The DEC-244 deliverable panel row for
that assignment renders the uploaded filename and the "Uploaded file"
aria-label section (both assertions pass) but the row text never contains
the string `version 2` — assertion at
`scripts/walkthrough/speaker.ts:805`.

Likely site (not fixed, per instructions — flagging only): the "version
{fileExtras.version}" render at
`src/routes/portal/tasks/views.tsx:296` and the version-chain resolution
in `src/routes/portal/tasks.tsx:175-188` (`loadTasksPageData`, which
throws on an unresolved chain but does not obviously assert the same
completed-then-replaced ordering the walkthrough exercises). Not
diagnosed further — this lane does not fix or code-read past the
assertion site per its own charter.

## Cheap regression signal (walkthrough completed with a Summary/exit, so per the brief's "if and only if" this ran)

```
npm run build          # tsc --noEmit (root + app) + vite build -> PASS, "built in 1.04s"
npm run bundle:check   # entry bundle 69.19 kB gzip / 300.00 kB budget -> bundle:check PASSED
```

## What this receipt does NOT cover

- No full test suite run (belongs to the merge train / wave 27, via
  `scripts/with-test-lock.sh`), per instructions.
- No render sweep (`task-w25-a`/`task-w25-e` own those scripts and were
  reported in flight at dispatch time), per instructions.
- Nothing was fixed. The `version 2` defect above is reported, not
  repaired.

RESULT: FAIL — one J1-J12 walkthrough check fails at the speaker lane:
`GET /portal/tasks` never renders "version 2" in the DEC-244 deliverable
panel for a completed file_request assignment that was uploaded a second
time (REPLACE onto an already-complete assignment, chain-latest
`version_no=2`), per `scripts/walkthrough/speaker.ts:805`.
OPEN ITEMS: 1
1. `scripts/walkthrough/speaker.ts:805` (assertion) / repro route
   `POST /portal/tasks/:assignmentId/upload` then
   `GET /portal/tasks` as the speaker role, for an ad hoc
   `kind='file_request'` task assignment whose DEC-739-seeded speaker
   already has a version_no=1 file on it — the DEC-244 deliverable panel
   row omits the string "version 2". Candidate source: rendering at
   `src/routes/portal/tasks/views.tsx:296` and chain resolution at
   `src/routes/portal/tasks.tsx:175-188`; not diagnosed further by this
   lane.
