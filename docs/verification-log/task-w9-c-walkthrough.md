# task-w9-c — walkthrough @ 38860f9

Wave-9 exit-gate battery (DEC-069/176/177/178 rebinding), walkthrough
lane, log-only (no code changes). Fresh worktree
`/Users/wednesdayniemeyer/Documents/gniemeyer/Projects/chautauqua-wt/task-w9-c`
cut from `main` (branch `task-w9-c`), tip `aa7bf95` ("merge task-w8-b").

## STEP 1 — sha derivation, ancestor check

DEC-178 names the frozen sha S as "the `merge task-w9-a` commit". This
worktree's `main` tip is `aa7bf95` ("merge task-w8-b"), whose two
parents are `38860f9` ("merge task-w8-a") and `b1073e6` ("task-w8-b:
build+test gate @ 38860f9"). Both `aa7bf95` itself and `b1073e6`
diff docs-only against their parents (`git diff --name-only <p> <c>`
lists only `docs/verification-log.md` and
`docs/verification-log/task-w8-b-build-test.md`) — non-code-bearing
per DEC-114. Walking first-parent past those, the newest code-bearing
commit is `38860f9` ("merge task-w8-a"), which merges `52dd2b2`
("w8-a: harness-closure lane — DEC-173/174/175 walkthrough fixes +
authz probes") — i.e. exactly the DEC-178-mandated harness-closure
content, landed under a `task-w8-a` branch/commit name rather than
`task-w9-a`.

There is no commit literally titled `merge task-w9-a` reachable as a
recent ancestor of `main`'s current tip: `git log --all --oneline |
grep "merge task-w9-a"` does find two commits with that exact message
(`8026fad`, `56ddb09`), and `git merge-base --is-ancestor 8026fad
aa7bf95` does exit 0 — but both are ~217/394 commits back in the
first-parent walk (committed `08-10 10:15` / `02:03`, hours before the
current wave-8/9 work at `19:xx`-`20:xx`), i.e. relics from an earlier,
unrelated numbering cycle baked into this repo's ancestry, not this
wave's work. Per DEC-114's mechanical rule ("a commit is code-bearing
iff its first-parent diff outside the bookkeeping set is non-empty")
and per the DEC-177/178 convention of "verified against the tree, not
summaries," the correct S for this wave's battery is the actual newest
code-bearing commit, `38860f9`. This is the same S already used by
`task-w8-c`'s walkthrough gate (`docs/verification-log.md`, section
`## 2026-08-10 task-w8-c — walkthrough @ 38860f9`) and `task-w8-e`'s
render-sweep gate — i.e. wave 9's code lane (task-w9-a) never landed as
a distinct commit; the DEC-178-mandated content shipped one wave label
early, under task-w8-a. Flagging this naming/wave-number discrepancy
for the scribe; proceeding with S = `38860f9` since it is the
mechanically-correct frozen sha and it does carry every artifact DEC-178
requires.

`git merge-base --is-ancestor 2dd2f33 aa7bf95` exits 0 — DEC-139
ancestor check passes (equivalently at `38860f9`, since `2dd2f33`
predates it).

## STEP 2 — DEC-177/178 precondition greps

All twelve anchors independently re-verified present at this worktree's
`aa7bf95` (== `38860f9`'s tree, since HEAD is docs-only past it):

Six w6 anchors:
- `DEC-167` in `src/domain/contacts.ts:165`
- `ICS_ORGANIZER_EMAIL` in `src/mail/ics.ts:15`
- `unknown track id` in `src/routes/api/forms.ts:113`
- `anonymized === false` in `src/server/repo/files.ts:153`
- `openDate` in `app/src/pages/review/PlanEditor.tsx:107,138`
- `FORM_TASK_FIELD_SPECS` in `scripts/seed.ts:19,909`

Closure anchors:
- `DEC-173` in `scripts/walkthrough/public.ts:440` and
  `scripts/walkthrough/speaker.ts:923`
- `DEC-174` in `scripts/seed.ts:975`
- `DEC-175` in `scripts/walkthrough/producer.ts:773+`,
  `scripts/walkthrough/speaker.ts:1156+`, and
  `scripts/walkthrough/review.ts:312,603+`

No miss — gate proceeds (not a precondition FAIL).

## STEP 3 — install/build/migrate/seed/wrangler-dev/walkthrough

`npm ci` (node_modules already present from a prior wave-9 sibling
worktree checkout, skipped). `npm run build`: clean — dual `tsc
--noEmit` + `vite build --config app/vite.config.ts`, 131 modules
transformed, no errors. `rm -rf .wrangler/state` then `npm run
db:migrate`: 13 migrations applied (`0000_secret_matthew_murdock`
through `0010_round_criteria`, then `0012_pipeline`,
`0013_submission_revision`; the `0011` gap is the DEC-164-sanctioned
numbering skip). `npm run seed`: completed clean, 8 objects put into
local R2 bucket `chautauqua-files`, no errors.

Started `npx wrangler dev --port 8832` in the background (port fixed
per DEC-178, distinct from the concurrently-running sibling worktrees
task-w9-d/task-w9-e observed on other ports during this run — expected
per DEC-176's concurrent-sibling-gate precedent, left untouched). `GET
/health` returned `{"ok":true}` (200) on the first poll after ~5s.

`npm run walkthrough -- --url http://localhost:8832` ran all six
modules in the fixed DEC-062 order (producer -> review -> speaker ->
public -> data -> scale) in a single orchestrator invocation with
**zero FAIL/PLANNER: lines** anywhere in the output.

### Per-area results

- **producer**: J1 (launch a CFP) ok, J2 (public submit + claim) ok,
  J3 (triage at volume) ok, J5 (compose: merge fields, cap, ICS, HTML
  escaping) ok, plus the DEC-175 unauthenticated-probe block ok
  (`DEC-175 unauthenticated GET /admin -> 302`, `DEC-175
  unauthenticated GET /api/v1/contacts -> 401`, `DEC-175
  unauthenticated GET /api/v1/review/plans -> 401`, `DEC-175
  unauthenticated GET /files/:id -> 401`). PASS.
- **review**: 19/19 checks PASS, including both DEC-175 out-of-scope
  probes: `ok: DEC-175 reviewer GET of an out-of-scope submission's
  review detail -> 404 (not 403)` and `ok: DEC-175 out-of-scope detail
  probe is not 403 (existence-hiding, not authz-denial)`, plus the PUT
  variant: `ok: DEC-175 reviewer PUT evaluation for an out-of-scope
  submission -> 404 (not 403)` / `ok: DEC-175 out-of-scope evaluation
  probe is not 403 (existence-hiding, not authz-denial)`. Confirms the
  reviewer out-of-scope case is 404-not-403 (existence-hiding) per
  DEC-175 semantics. PASS.
- **speaker**: all checks PASS, specifically including
  `ok   find my own general task's assignment id via /portal/tasks`
  and `ok   complete a general task via its own form action` — **(a)
  confirmed**: this round-trip (previously FAIL at `64ec7de`,
  task-w5-c) now PASSES; the DEC-174 seed override (`contactIdx 0` /
  "Announce participation" forced to `pending` for the demo speaker) is
  live and unblocked it. All 8 DEC-175 speaker-lens probes present and
  `ok`: `DEC-175 speaker2 GET speaker1's portal submission -> 404
  (existence-hiding)`, `DEC-175 speaker2 GET speaker1's task-assignment
  form -> 403`, `DEC-175 speaker2 POST speaker1's task-assignment form
  -> 403`, `DEC-175 speaker2 POST-complete speaker1's task assignment
  -> 403`, `DEC-175 speaker2 GET speaker1's uploaded file -> 403`,
  `DEC-175 speaker session on organizer API GET
  /api/v1/events/:id/submissions -> 403`, `DEC-175 speaker session on
  organizer API GET /api/v1/contacts -> 403`, `DEC-175 speaker session
  on organizer API GET /api/v1/events/:id/email-log -> 403`. PASS.
- **public**: all checks PASS, specifically including
  `ok   J10 /speakers: alphabetical by surname, headshot/title/company`
  — **(b) confirmed**: this check (previously FAIL at `64ec7de`,
  task-w5-c) now PASSES via the DEC-173 anchor-tolerant name extractor.
  PASS.
- **data**: J11/J12 all PASS (contact search/create/CSV-import/
  history/dedupe-merge/segment/bulk-email+cap/dashboard-stats; bearer
  token mint/cookie-less GET/revocation/role-403/exports/
  showflow.csv/cross-org 404/`/docs/api`). PASS.
- **scale**: all 6 steps PASS (110 fresh contacts+submissions+
  participants; bulk-accept of 110 ids; onboarding task_assignments
  sampled for 5 fresh contacts; re-accept exactly-once; no auto-email
  on bulk status change; purge-refresh probe). PASS.

**(c) DEC-175 authz probes — confirmed executed** across all three
lenses, quoted verbatim above: producer's unauthenticated block (4
checks, 302/401/401/401), review's out-of-scope reviewer block (4
checks, both 404-not-403 with explicit existence-hiding assertions),
and speaker's cross-speaker/cross-role block (8 checks, 404/403 mix
correctly distinguishing existence-hiding from plain authz-denial). No
403-where-404-expected or vice-versa observed.

Server killed after the run: the `npm exec wrangler dev --port 8832`
process tree (`npm`, `wrangler` CLI, `wrangler-dist/cli.js dev`, both
`esbuild --service` helpers, and the `workerd` child bound to
`:8832`) was killed with `kill -9` across all PIDs (an initial `kill`
of the top-level PIDs left a respawned `workerd` still listening;
a second round targeting every PID in the `lsof -i :8832` process
group fully cleared it). `lsof -i :8832` confirmed empty (port free)
after the second round.

## OPEN ITEMS: 0

## RESULT: PASS (6/6 modules PASS at S = `38860f9` — producer, review,
speaker, public, data, scale all clean, zero FAIL/PLANNER: lines;
(a) speaker general-task mark-complete round-trip PASS via DEC-174;
(b) public /speakers name-ordering check PASS via DEC-173; (c) every
DEC-175 authz probe across producer/review/speaker PASSes with correct
404-vs-403 existence-hiding semantics, including the reviewer
out-of-scope 404-not-403 case. Wave-number note for the scribe: DEC-178
named S as "the merge task-w9-a commit," but no such commit exists in
this wave's actual history — the DEC-178-mandated harness closure
shipped one commit/label early as `task-w8-a` (merged `38860f9`), and
that is the sha this gate (and `task-w8-c` before it) actually ran
against. This duplicates `task-w8-c`'s walkthrough gate content at the
same S; independently re-run and re-confirmed here per the wave-9
battery assignment.)
