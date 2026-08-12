# task-w7-g — J1-J12 walkthrough @ 1e1b6e5 (DEC-384, log-only)

Fresh worktree `/Users/wednesdayniemeyer/Documents/gniemeyer/Projects/chautauqua-wt/task-w7-g`
cut from `main` (branch `task-w7-g`). This is the first walkthrough run
since the wave-6 behaviour changes (DEC-396 compose-cap, DEC-397
preview-mints-no-tokens, DEC-398 findFormForEvent/default-form).

**Worktree note**: the original worktree used for the run below (build
+ seed + dev + walkthrough, all captured against `1e1b6e5`) was torn
down mid-task by something external to this agent (its `.git` worktree
link vanished between tool calls, and `main`'s tip had advanced 10
commits to `97dbac0` by the time this was noticed). Only this log file
survived on disk; it was copied into a freshly re-added `task-w7-g`
worktree (cut from the then-current `main`) to commit it. `1e1b6e5` is
confirmed still a valid ancestor of the new worktree's `HEAD`
(`git merge-base --is-ancestor 1e1b6e5... HEAD` exits 0), so the run
below remains a faithful point-in-time gate against that frozen sha;
it was not re-run against the newer tip.

## FROZEN SHA

```
$ git -C /Users/wednesdayniemeyer/Documents/gniemeyer/Projects/chautauqua-wt/task-w7-g rev-parse HEAD
1e1b6e5cfb6bdfd28557e0e5e2bcfd76cc5c8ede
```
(worktree tip == `main` tip at time of cut; commit subject "scribe wave 7")

## EXACT COMMANDS (in order)

```
npm ci --prefer-offline --no-audit --no-fund
npm run build
npm run db:migrate
npm run seed
npm run dev -- --port 8788      # backgrounded
npm run walkthrough -- --url http://localhost:8788
```

`npm run db:migrate` is required before `npm run seed` — the seed
script's own `wrangler d1 execute .seed.sql` step assumes the schema
already exists (confirmed by first attempting `npm run seed` with no
prior migration: it failed with `no such table: email_log`). This
matches the documented order in `README.md:44-49` ("This installs
dependencies, applies migrations to a local D1 database, seeds a...").
Not a defect — just the correct invocation order, noted here since the
task prompt only listed `npm ci` / `npm run build` / `npm run seed` /
`npm run dev` / `npm run walkthrough` without `db:migrate` explicitly.

## PER-COMMAND TRANSCRIPT

### `npm ci --prefer-offline --no-audit --no-fund`
```
added 366 packages in 6s
```
Exit code: 0

### `npm run build`
```
> build
> tsc --noEmit && tsc --noEmit -p app/tsconfig.json && vite build --config app/vite.config.ts

vite v6.4.3 building for production...
transforming...

/fonts/FamiljenGrotesk-var.woff2 referenced in /fonts/FamiljenGrotesk-var.woff2 didn't resolve at build time, it will remain unchanged to be resolved at runtime

/fonts/Figtree-var.woff2 referenced in /fonts/Figtree-var.woff2 didn't resolve at build time, it will remain unchanged to be resolved at runtime
✓ 154 modules transformed.
rendering chunks...
computing gzip size...
../public/admin/index.html                                  0.62 kB │ gzip:  0.33 kB
../public/admin/assets/Settings-ir1DHQKL.css                3.46 kB │ gzip:  0.95 kB
../public/admin/assets/Speakers-BG5PBYj4.css                4.02 kB │ gzip:  0.96 kB
../public/admin/assets/FormsPage-BJZJaevv.css               4.08 kB │ gzip:  1.03 kB
../public/admin/assets/SubmissionDetailPage-CqgRUx_S.css    4.37 kB │ gzip:  1.16 kB
../public/admin/assets/Content-ZNNVBerL.css                 4.39 kB │ gzip:  1.05 kB
../public/admin/assets/Overview-VbSISKfW.css                4.66 kB │ gzip:  1.11 kB
../public/admin/assets/Comms-C4xPwDIn.css                   4.80 kB │ gzip:  1.12 kB
../public/admin/assets/Contacts-Bghxb9Tv.css                5.28 kB │ gzip:  1.21 kB
../public/admin/assets/Agenda-BUVBFwyi.css                  5.61 kB │ gzip:  1.25 kB
../public/admin/assets/Review-lOhh-lE9.css                  5.86 kB │ gzip:  1.19 kB
../public/admin/assets/Submissions-Bu6LtK62.css             6.63 kB │ gzip:  1.37 kB
../public/admin/assets/ImportWizard-Brj78QY4.css            7.19 kB │ gzip:  1.37 kB
../public/admin/assets/index-BhyHW5ao.css                  17.80 kB │ gzip:  3.57 kB
../public/admin/assets/types-CEJHopH4.js                    0.35 kB │ gzip:  0.22 kB
../public/admin/assets/filters-DykXP0H-.js                  0.47 kB │ gzip:  0.28 kB
../public/admin/assets/columns-H9BM_BWy.js                  0.47 kB │ gzip:  0.31 kB
../public/admin/assets/NotFound-rpYY6qWQ.js                 0.57 kB │ gzip:  0.34 kB
../public/admin/assets/dates-C3d6Pa2g.js                    0.68 kB │ gzip:  0.33 kB
../public/admin/assets/ImportWizard-DyQXWsM7.js             7.34 kB │ gzip:  2.81 kB
../public/admin/assets/Overview-BzDFOtI1.js                10.86 kB │ gzip:  2.88 kB
../public/admin/assets/SubmissionDetailPage-Cldk5yyM.js    11.12 kB │ gzip:  3.12 kB
../public/admin/assets/FormsPage-sw5kNPAP.js               11.84 kB │ gzip:  3.72 kB
../public/admin/assets/Submissions-BpDgIcPh.js             14.15 kB │ gzip:  4.19 kB
../public/admin/assets/Comms-KTg1PMC_.js                   16.02 kB │ gzip:  4.53 kB
../public/admin/assets/Agenda-DCAe37fG.js                  16.41 kB │ gzip:  4.93 kB
../public/admin/assets/Content-BC1ZCbar.js                 18.13 kB │ gzip:  5.32 kB
../public/admin/assets/Speakers-DrYy2_8Y.js                19.00 kB │ gzip:  4.84 kB
../public/admin/assets/Settings-BZqzMxqs.js                22.17 kB │ gzip:  5.68 kB
../public/admin/assets/Review-Civ2WA2A.js                  35.93 kB │ gzip:  8.72 kB
../public/admin/assets/Contacts-DutvFhp5.js                40.20 kB │ gzip:  9.71 kB
../public/admin/assets/index-B8fHke0M.js                  183.82 kB │ gzip: 59.96 kB
✓ built in 1.40s
```
Exit code: 0

### `npm run db:migrate`
Ran to a clean `.wrangler/state` (verified twice, see RECHECK below).
Output is 18 `wrangler d1 migrations apply` batches (`0000_secret_
matthew_murdock.sql` ... `0018_w18_scale_indexes.sql`), each printed as
a full progress table; condensed here to the final state (full raw
output captured locally in `.migrate2.log` inside the worktree, not
committed — this file's `POST-S DELTA` below shows the worktree stays
clean of everything except this log):
```
🚣 4 commands executed successfully.
... (17 more `wrangler d1 migrations apply` batches, each showing the growing
    ✅/🕒️ progress table) ...
┌──────────────────────────────────┬────────┐
│ name                             │ status │
├──────────────────────────────────┼────────┤
│ 0000_secret_matthew_murdock.sql  │ ✅     │
│ 0001_worthless_arachne.sql       │ ✅     │
│ 0002_narrow_vulcan.sql           │ ✅     │
│ 0003_w2c_form_open_date.sql      │ ✅     │
│ 0004_wave3.sql                   │ ✅     │
│ 0005_w4_segment.sql              │ ✅     │
│ 0006_w4_api_token.sql            │ ✅     │
│ 0007_w4_saved_view.sql           │ ✅     │
│ 0008_w7_ics_sequence.sql         │ ✅     │
│ 0009_review_rounds.sql           │ ✅     │
│ 0010_round_criteria.sql          │ ✅     │
│ 0012_pipeline.sql                │ ✅     │
│ 0013_submission_revision.sql     │ ✅     │
│ 0014_task_deliverable_kind.sql   │ ✅     │
│ 0015_participant_attribution.sql │ ✅     │
│ 0016_w4c2_fk_indexes.sql         │ ✅     │
│ 0017_review_recusal.sql          │ ✅     │
│ 0018_w18_scale_indexes.sql       │ ✅     │
└──────────────────────────────────┴────────┘
```
Exit code: 0

### `npm run seed`
```
> seed
> tsx scripts/seed.ts && wrangler d1 execute chautauqua --local --file=.seed.sql && tsx scripts/seed-r2.ts

Wrote 538 statements to .../.seed.sql
Wrote 8 asset manifest entries to .../.seed-assets/manifest.json
...
🚣 538 commands executed successfully.
[ 538x {"results": [], "success": true, "meta": {"duration": 0-1}} ]
...
Creating object "sub/seed_submission_0001/seed_file_0001-slides-v1.pdf" in bucket "chautauqua-files".
Upload complete.
Creating object "sub/seed_submission_0001/seed_file_0002-slides-v2.pdf" in bucket "chautauqua-files".
Upload complete.
Creating object "sub/seed_submission_0004/seed_file_0003-poster.png" in bucket "chautauqua-files".
Upload complete.
Creating object "resource/seed_file_0004-speaker-slide-template.pdf" in bucket "chautauqua-files".
Upload complete.
Creating object "headshot/seed_contact_0001/seed_file_0011-headshot.png" in bucket "chautauqua-files".
Upload complete.
Creating object "headshot/seed_contact_0002/seed_file_0012-headshot.png" in bucket "chautauqua-files".
Upload complete.
Creating object "headshot/seed_synth_contact_0001/seed_file_0013-headshot.png" in bucket "chautauqua-files".
Upload complete.
Creating object "headshot/seed_synth_contact_0020/seed_file_0014-headshot.png" in bucket "chautauqua-files".
Upload complete.
seed-r2: put 8 object(s) into local R2 bucket 'chautauqua-files'
```
Exit code: 0
(the 538 identical `{"results":[],"success":true,"meta":{"duration":N}}`
JSON entries from the D1 batch-exec response are elided above for
readability; every entry has `"success": true`.)

### `npm run dev -- --port 8788` (backgrounded, `wrangler dev`)
```
> dev
> wrangler dev --port 8788

 ⛅️ wrangler 4.120.0 (update available 4.121.0)
Using secrets defined in .dev.vars
Your Worker has access to the following bindings:
Binding                                                     Resource                  Mode
env.KV (de4b864736784b1c8c8e1ae875971c43)                   KV Namespace              local
env.EMAIL (unrestricted)                                    Send Email                local
env.DB (chautauqua)                                         D1 Database               local
env.FILES (chautauqua-files)                                R2 Bucket                 local
env.ASSETS                                                  Assets                    local
env.MAIL_FROM_EMAIL ("hello@chautauqua.cc")                 Environment Variable      local
env.MAIL_FROM_NAME ("Chautauqua")                           Environment Variable      local
env.DEV_MODE ("(hidden)")                                   Environment Variable      local
env.PUBLIC_BASE_URL ("(hidden)")                            Environment Variable      local

⎔ Starting local server...
[wrangler:info] Ready on http://localhost:8788
```
Server confirmed up (`Ready on http://localhost:8788`) before the
walkthrough was invoked.

### `npm run walkthrough -- --url http://localhost:8788`
```
> walkthrough
> tsx scripts/walkthrough.ts --url http://localhost:8788

Running J1->J12 walkthrough against http://localhost:8788
Order: producer -> review -> speaker -> public -> data -> scale

--- producer ---
Running J1 (launch a CFP)...
  ok
Running J2 (public submit + claim) against devflow-conf-2027...
FAILED: J2 submit page shows a deadline
  expected a 'Submissions close ...' deadline line
WALKTHROUGH FAILED at producer
```
**Exit code: 1**

Note on module count: the task prompt names the five DEC-060 modules
as producer/review/speaker/public/data. The actual `WALKTHROUGH_AREAS`
constant (`scripts/walkthrough-lib.ts:15`) is
`["producer", "review", "speaker", "public", "data", "scale"]` — a
sixth "scale" module (DEC-355-358 bulk-op probes) now exists and runs
last. Flagging the discrepancy; not fixing (log-only task). Moot here
since the run never got past `producer`.

## OPEN ITEMS

### OI-1 — J2 fails: submit page has no "Submissions close" text (BLOCKING — walkthrough exit 1)

- **What failed**: `scripts/walkthrough/producer.ts:377-379` asserts
  `/Submissions close/i.test(getBody)` against the response body of
  `GET /submit/devflow-conf-2027`. The live page does not contain that
  string anywhere, so the assertion throws and the runner aborts before
  any further module (review/speaker/public/data/scale) executes.
- **Root cause read**: `src/routes/public/submit.tsx:246-248` renders
  the close-date line as:
  ```
  {form.closeDate ? (
    <span class="chq-cfp-sub">Call for papers · closes {new Date(form.closeDate).toUTCString()}</span>
  ) : null}
  ```
  i.e. the copy is `"Call for papers · closes <date>"`, not
  `"Submissions close <date>"`. `git -C .../task-w7-g log --oneline -3
  -- src/routes/public/submit.tsx` shows this file was last touched by
  `c537c53 Re-skin public CFP form + terminal states to DEC-366..377
  design mock` — the wave-1..3 redesign that changed the public CFP
  copy — while the walkthrough probe (`c47fe7b Repair two stale
  walkthrough probes per DEC-326 (w15-b)` is the newest touch on
  `producer.ts` and predates the redesign restyle) was never updated
  to match the new copy.
- **Decision coverage**: no decision in `decisions/` pins the literal
  string "Submissions close" or "Call for papers · closes"; DEC-366..384
  (the redesign mandate) governs the visual restyle but is silent on
  exact copy. This reads as a walkthrough-probe/product-copy drift, not
  a product defect against any stated decision — but it is a real
  regression from the walkthrough's own historical baseline (the assert
  clearly used to match something), left unnoticed because a J-level
  battery had not run against this text since the redesign landed.

### OI-2 — DEC-396/397/398 paths never exercised by this run

Because the runner aborts inside `producer`'s J2 (before J1's later
"scale"-module and before `producer`'s own J5 compose section), none of
the wave-6 behavioural-change paths were reached:

- **DEC-396 (compose `submissionIds` bounded to DEC-182's cap)**: the
  probe lives in the *same* `producer.ts` module, at J5
  (`scripts/walkthrough/producer.ts:578-745`, e.g. the >100-recipient
  `compose/preview`/`compose/send` 400-rejection assertions at lines
  630-642). J5 runs after J2 in file order and never started.
- **DEC-397 (`preview` mints no claim tokens, renders
  `/claim/<PREVIEW_CLAIM_TOKEN>`)**: `PREVIEW_CLAIM_TOKEN` is defined/
  used in `src/domain/compose.ts`, `src/routes/api/contacts.ts:591`,
  `src/routes/comms.ts:275` — but no `scripts/walkthrough/*.ts` module
  asserts on that constant or on a `/claim/` href at all (`grep -rn
  "claim/\|PREVIEW_CLAIM_TOKEN" scripts/walkthrough/*.ts` returns
  nothing). This DEC's runtime behaviour is **not covered by the
  walkthrough battery at all**, independent of today's early failure —
  a full green run would say nothing about DEC-397 either.
- **DEC-398 (`findFormForEvent` = the event's DEFAULT form, validated
  server-side)**: partially exercised. `producer.ts:190-192` (J1, which
  did run and pass) calls `GET /api/v1/events/:id/forms` and reads
  `formId` from the response, which round-trips through
  `findFormForEvent` (`src/server/repo/events.ts:296`,
  `src/server/repo/forms.ts:76`) server-side — so the "read the default
  form for an event" path was exercised and passed. No module asserts
  on the *rejection* half of DEC-398 (a form task's form validated
  against a *different* event's forms); `grep -rn
  "findFormForEvent\|wrong event\|different event" scripts/walkthrough/
  *.ts` finds nothing, so that negative case is also uncovered by the
  battery, independent of today's failure.

Net: this walkthrough run exercises essentially none of the three
wave-6 decisions' new-behaviour surfaces (DEC-396/398's negative paths,
DEC-397 entirely) — a hypothetical PASS on this run would not be
evidence for wave-6 correctness. That gap should be closed by adding
assertions to the relevant walkthrough modules; out of scope here
(log-only).

## RESULT: **FAIL**, exit code 1 (module: producer, assertion: "J2 submit page shows a deadline")

## RECHECK SHA

Rechecked against the same tree, from a clean D1/R2 state (`rm -rf
.wrangler/state`, re-ran `db:migrate` + `seed` + `dev` + `walkthrough`
end to end a second time) to confirm determinism:

```
$ git -C /Users/wednesdayniemeyer/Documents/gniemeyer/Projects/chautauqua-wt/task-w7-g rev-parse HEAD
1e1b6e5cfb6bdfd28557e0e5e2bcfd76cc5c8ede
```

Second run reproduced the identical failure verbatim:
```
--- producer ---
Running J1 (launch a CFP)...
  ok
Running J2 (public submit + claim) against devflow-conf-2027...
FAILED: J2 submit page shows a deadline
  expected a 'Submissions close ...' deadline line
WALKTHROUGH FAILED at producer
```
Exit code: 1 (deterministic, not a flake).

## POST-S DELTA

`git status --porcelain` immediately before staging this file:

```
?? docs/verification-log/task-w7-g-walkthrough.md
```

Only this log file is untracked/modified — no product, test, style,
script or config file was touched by this task.
