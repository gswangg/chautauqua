# 2026-08-10 task-w5-c — walkthrough @ 64ec7de

Full detail for the `## 2026-08-10 task-w5-c — walkthrough @ 64ec7de` section
of `docs/verification-log.md` (extracted per the contention-decomposition of
that file; see the stub entry there for `OPEN ITEMS` / `RESULT` summary).

Wave-6 exit-gate battery (DEC-165/166), walkthrough lane, log-only (no
code changes). Fresh worktree of `main` at port 8801.

**STEP 1 — sha derivation.** Worktree cut from `main` tip, first-parent
log: `64ec7de` ("merge task-w5-a") is the newest commit and is not a
bookkeeping/scribe commit (compare `54005df`/`fc1e6ef`/`5c91fae`
underneath it, the latter being "scribe wave 5"). `64ec7de:.github/
workflows/ci.yml` contains the `render-sweep:` job
(`npm run gate:render-sweep`), satisfying the w5-a-must-contain-CI-job
requirement. `git merge-base --is-ancestor 2dd2f33 64ec7de` exits 0 —
ancestor check passes. Frozen sha: **`64ec7de7f1fcd4582c8482b9c7b9059a1e57e0a3`**.

**STEP 2 — install/build/migrate/seed/wrangler-dev/walkthrough.**
`npm ci`, then `npm run build`: clean (`tsc --noEmit` x2 + `vite
build`, 131 modules, no errors). `rm -rf .wrangler/state` then `npm run
db:migrate`: **13 migrations applied** — `0000_secret_matthew_murdock`
through `0010_round_criteria`, then `0012_pipeline`, `0013_
submission_revision` (the `0011` gap is the DEC-164-sanctioned
numbering skip). `npm run seed`: completed clean, 8 objects put into
local R2 bucket `chautauqua-files`, no errors. Started `npx wrangler
dev --port 8801` in the background; `GET /health` returned 200 within
~8s.

`npm run walkthrough -- --url http://localhost:8801` ran the fixed
DEC-062 order producer → review → speaker → public → data → scale.
The orchestrator (`scripts/walkthrough.ts`) halts the whole run at the
first per-area module `FAIL` (each area module calls `process.exit(1)`
inside its own `check()` helper on assertion failure), so the full-run
invocation above stopped at speaker; the three areas after it (public,
data, scale) were then run individually via `npx tsx scripts/
walkthrough/<area>.ts --url http://localhost:8801` against the same
live server, for full-coverage recording in this log (still the same
gate execution, same sha, same server instance — no code changes,
purely additional read-only invocations of the existing harness).

Per-area results:
- **producer**: 5/5 checks PASS (J1 launch CFP, J2 public submit+claim,
  J3 triage at volume, overflow-recipient seeding, J5 compose/ICS/
  HTML-escaping). PASS.
- **review**: 16/16 checks PASS (assignment queue ordering/anonymized
  detail/scorecard round-trip/max-evaluations cap/role-403s/DEC-039
  cross-org 404s/progress+remind/results sort+CSV). PASS.
- **speaker**: 15 checks PASS, then **1 FAIL**: `find my own general
  task's assignment id via /portal/tasks` — "could not find a 'Mark
  complete' form action on /portal/tasks". Root cause (read-only
  investigation, no fix applied): `src/routes/portal/tasks.tsx`
  `TaskRow` only renders the `Mark complete` form when `t.kind ===
  "general"` and `t.status !== "complete"`. The onboarding fixture's 5
  canonical tasks (`src/domain/acceptance.ts` `DEFAULT_ONBOARDING_
  TASKS`) place its two `general`-kind tasks at array indices 2
  ("Finalize talk description") and 4 ("Announce participation").
  `scripts/seed.ts`'s per-assignment completion formula is `isComplete
  = (contactIdx + taskIdx) % 3 !== 0`; for the seeded walkthrough
  speaker (`contactIdx === 0`, the first accepted submission),
  `taskIdx 2 → 2%3=2` and `taskIdx 4 → 4%3=1` are both non-zero, so
  BOTH general tasks are pre-seeded `complete` for that specific
  speaker, leaving zero pending general-kind tasks to click "Mark
  complete" on. Confirmed live via `curl` login as
  `sbek-speaker@example.com`: `/portal/tasks` shows "Finalize talk
  description — Completed" and "Announce participation — Completed",
  with only the `form`-kind (Hotel stay, `Fill out form` link) and
  `file_request`-kind (Finalize bio+headshot, `Upload` form) tasks
  still pending. This is a seed/walkthrough coupling bug, not a
  product-code defect: the deterministic mod-3 formula happens to
  complete both general tasks for `contactIdx 0` regardless of which
  accepted submission is used, so the walkthrough's own general-task
  round-trip check (lines 446-459 of `scripts/walkthrough/speaker.ts`)
  can never pass against this seed as currently written. FAIL,
  blocking the rest of the speaker module (co-presenter/invitation/
  edit-lock/comment-thread checks after this point never ran).
- **public**: 15 checks PASS (event resolve, J9 agenda/schedule/
  auto-schedule/conflict-surface, J10 sessions/agenda/schedule/gallery
  pages, session-card+track-filter markup), then **1 FAIL**: `J10
  /speakers: alphabetical by surname, headshot/title/company` —
  "expected at least 2 speakers to check ordering". Root cause
  (read-only investigation, no fix applied): the check's extractor
  regex `/<strong>\s*([^<]+?)\s*<\/strong>/g` in `scripts/walkthrough/
  public.ts` (~line 440) assumes speaker names render as bare text
  directly inside `<strong>...</strong>`. Live markup fetched via
  `curl http://localhost:8801/e/devflow-conf-2027/speakers` shows
  names actually render as `<strong><a href="...">Toni
  Brightwell</a></strong>` — an anchor nested inside the `<strong>`
  tag — so `[^<]+?` (no `<` allowed) never matches and `names.length`
  is 0, well below the `>= 2` assertion, even though the page visibly
  lists many speakers (Toni Brightwell, Xan Chen, Alex Delgado, and
  more, confirmed alphabetical by surname on manual inspection). This
  is a stale-selector bug in the walkthrough script (or the product
  markup changed after the check was written) — not a missing feature.
  FAIL, blocking the rest of the public module (embeds, `.ics`,
  visibility-gate checks after this point never ran).
- **data**: 21/21 checks PASS (J11 contact search/create/CSV-import/
  history/dedupe-merge/segment/bulk-email+cap/dashboard-stats; J12
  bearer-token mint/cookie-less GET/revocation/role-403/exports/
  showflow.csv/cross-org 404/`/docs/api`). PASS.
- **scale**: 6/6 steps PASS (110 fresh contacts+submissions+
  participants; one bulk-accept of 110 ids; onboarding task_assignments
  sampled for 5 fresh contacts; re-accept exactly-once; no auto-email
  on bulk status change; purge-refresh probe). PASS.

Server killed (`lsof -ti :8801 | xargs kill -9`, plus the parent
`wrangler dev`/`npm exec` processes) after the run; port confirmed
free (`lsof -i :8801` empty). An unrelated `wrangler dev --port 18787`
process from a different repo checkout was observed running
concurrently on the machine and was left untouched (out of scope,
different port).

OPEN ITEMS: (1) `scripts/walkthrough/speaker.ts`'s "find my own general
task" check is incompatible with `scripts/seed.ts`'s deterministic
mod-3 completion formula for the walkthrough's fixed `contactIdx 0`
speaker — either the seed formula or the check needs to change so at
least one `general`-kind task is left pending for that speaker; (2)
`scripts/walkthrough/public.ts`'s speaker-name extractor regex does
not match the live `/speakers` page markup (name wrapped in a nested
`<a>` inside `<strong>`) and needs updating to tolerate the anchor.
Both are walkthrough-harness/seed defects, not product-route defects —
manual `curl` spot-checks of the underlying pages/data showed correct
behavior in both cases. No code changes made in this log-only lane.

RESULT: FAIL — 2 of 6 areas (speaker, public) each hit exactly 1 FAIL
line (0 PLANNER: lines anywhere); producer, review, data, scale are
clean PASS. Both failures are traced to walkthrough-script/seed
mismatches (see OPEN ITEMS), not product-code defects.
