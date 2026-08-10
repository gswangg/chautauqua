# task-w4-b — J1-J12 walkthrough + scale gate @ main 3878d4f

Log-only lane (DEC-077/090/093): code at the derived code-bearing sha is
frozen for this gate; this file and the `docs/verification-log.md` append
are the only writes made in this worktree. No product code or scripts were
changed (a temporary one-line debug edit to `scripts/walkthrough/scale.ts`'s
truncation length, made to capture the full 400 response body for root-cause
diagnosis, was reverted with `git checkout --` before commit; `git status`
confirms zero diff from `main` other than the two doc appends).

## Derived code-bearing sha (DEC-091/093)

Worktree created from `main` at `79c4bb3` ("merge task-w3-e"). Per DEC-091/
093 the code-bearing sha is the last commit that changed product code/
scripts/config, excluding scribe/bookkeeping/log-only-lane commits. Walking
back from `79c4bb3`: `281a31b` (scribe wave 4), `c505dea` (spec-audit,
log-only), `d6bc978`/`fc32e81` (task-w3-b build+test gate, log-only per
DEC-077), `1c75d92`/`31fa021` (task-w3-a barrier, log-only), `f9a33fd`
(scribe wave 3) all non-code-bearing, landing at `3878d4f` ("merge
task-w2-d") — the last commit before the wave-3 gate wave, matching the
task's expected sha. Confirmed via
`git diff --stat 3878d4f..HEAD -- . ':(exclude)docs/verification-log.md' ':(exclude)docs/verification-log' ':(exclude)docs/eval-findings.md'`:
only `decisions/DEC-090..093.md` (new decision docs), `field-guide/index.md`,
and `src/decisions.ts` (adds the four new decision-constant references,
no functional change) differ — i.e. the code under test at HEAD is
functionally identical to `3878d4f`.

## Setup

- Worktree: `/Users/wednesdayniemeyer/Documents/gniemeyer/Projects/chautauqua-wt/task-w4-b`
  on branch `task-w4-b`.
- `npm ci --prefer-offline --no-audit --no-fund --silent` — clean install.
- `npm run build` — `tsc --noEmit` (root + `app/tsconfig.json`) then
  `vite build --config app/vite.config.ts`. Succeeded.
- `npm run db:migrate` — all 10 migrations
  (`0000_secret_matthew_murdock.sql` through `0009_review_rounds.sql`)
  applied clean.
- `npm run seed` — seed SQL applied with no errors; R2 seed put 6 objects
  into local bucket `chautauqua-files`.
- `npx wrangler dev --port 8801` (8801 reserved for this lane, never
  8787/8803). Server came up clean: `[wrangler:info] Ready on
  http://localhost:8801`, bindings KV/DB/FILES/ASSETS all local,
  `DEV_MODE=1`.

## Walkthrough run

`npm run walkthrough -- --url http://localhost:8801`. Ran all SIX areas
in the `WALKTHROUGH_AREAS` order (`scripts/walkthrough-lib.ts`): producer,
review, speaker, public, data, scale.

### producer (J1, J2, J3, J5) — PASS, 5 checks, all `ok`

### review — PASS, 16 checks, all `ok`

Queue scoping/sort/anonymization, scorecard round-trip, max-evaluations
cap, reviewer/organizer authz (403/404 cross-org, DEC-039), progress
tracking, remind targeting + email_log rows, results sort + CSV export.

### speaker — PASS, 50 checks, all `ok`, `all checks passed`

Full J6-J8 sweep including participant invite/accept/decline (DEC-070),
form-close-date edge cases, upload allowlist/size-cap, version-chain
uploads, comment/reply thread, content-approval visibility gate.

### public (J9, J10) — PASS, 29 checks, all `ok`

Agenda API, public site routes (sessions/speakers/agenda/schedule/
gallery), embed routes chromeless, three visibility gates.

### data (J11, J12) — PASS, all named steps completed, module's own
`PASS data` summary confirms.

### scale — **FAIL** at step 6 of 6

```
Running step 1 (110 fresh contacts + submissions + participants)...
PASS step1 (110 fresh contacts + submissions + speaker participants)
Running step 2 (one bulk accept, 110 ids)...
PASS step2 (one bulk POST, 110 ids, updated=110)
Running step 3 (onboarding task_assignments for a sample of fresh contacts)...
PASS step3 (onboarding task_assignments exist for 5 sampled fresh contacts)
Running step 4 (re-accept is exactly-once)...
PASS step4 (re-POST identical bulk request: assignment counts unchanged, exactly-once)
Running step 5 (no auto-email on status change)...
PASS step5 (dev mailbox message count unchanged by bulk accept)
Running step 6 (purge-refresh probe)...
FAILED: step6: POST portal edit (title -> marker)
  expected status 302, got 400
WALKTHROUGH FAILED at scale
```

Confirms the DEC-086/089 scale-area probes for steps 1-5:
- **step2**: one bulk POST with 110 ids reports `updated=110`
  (DEC-078/079 chunking exercised in a single request).
- **step3**: onboarding `task_assignments` (5 cells) exist for sampled
  fresh contacts.
- **step4**: an identical re-POST of the same 110-id bulk-accept leaves
  assignment counts unchanged (exactly-once).
- **step5**: the dev-mailbox message count is unchanged by the bulk
  accept (status changes never auto-email).

**step6 does NOT pass.** Root-cause (captured by temporarily widening the
`assertStatus` body-truncation length in a local, reverted edit — see
above): the portal-edit POST is rejected 400 with the on-page validation
error `"Select at least one track."` The seeded event's CFP form
(`devflow-conf-2027`) has required tracks (`Track *` fieldset with three
checkboxes: AI Engineering / Platform & Infra / Developer Experience), and
`purgeRefreshProbe()` in `scripts/walkthrough/scale.ts` builds two forms:
the original public-submit form (lines ~384-392) correctly copies a
`trackIds` value scraped from the `/submit` page's `name="trackIds"
value="..."` markup (line 392: `if (trackMatch) fullForm.set("trackIds",
trackMatch[1]!);`), but the later portal-edit form (lines ~465-473) only
copies `dropdownValues` (the `<select>` fields) and never sets `trackIds`
at all. Server-side validation (`src/routes/portal/edit.tsx:196-199` ->
`validateTrackChoice`) correctly rejects the edit with 400 because zero
tracks were selected — this is the product code behaving as designed
(DEC-041 required-track enforcement on submission edit), not a product
defect. The defect is in the walkthrough script itself: `scale.ts`'s
`purgeRefreshProbe` never copies the track selection into the edit-form
POST, so it can never validate the DEC-083 immediate-purge title change it
is meant to probe. Per DEC-092 the portal-edit write path itself is the
sanctioned probe mechanism (the prior GAP NOTE about "no organizer
PATCH-title endpoint" is not being re-raised here) — the gap is narrowly a
missing `trackIds` field in one FormData build inside `scale.ts`, not a
product-code or design gap.

This lane is log-only (DEC-077/090/093): no fix was applied here. Flagging
for the sole `docs/eval-findings.md` owner (task-w4-e, triage-closure,
chained behind this walkthrough task per DEC-093) as a **script bug**, not
a **product bug**: `scripts/walkthrough/scale.ts`'s `purgeRefreshProbe`
needs `editForm.set("trackIds", trackMatch[1]!)` (reusing the same
`trackMatch` already scraped for the initial public submission, or a fresh
scrape of the edit page's `name="trackIds" value="..."` markup) before its
POST.

## grep for FAIL/PLANNER across the full run

```
$ grep -n -iE 'FAIL|PLANNER:' <full walkthrough output>
171:FAILED: step6: POST portal edit (title -> marker)
174:WALKTHROUGH FAILED at scale
```

Two matches, both from the single step-6 script-bug root cause above; no
`PLANNER:` lines.

RESULT: FAIL
