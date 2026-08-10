# Verification Log
Append-only. One dated section per run.

## 2026-08-10 task-w12-a — build+test @ 01c6ace

Note: task order specified sha f6e3422; main had advanced to 01c6ace
(merge task-w11-a) by the time this worktree was created from main, so
that is the commit actually verified.

- install (`npm ci --no-audit --no-fund`): PASS — 334 packages, no errors.
- build (`npm run build` = `tsc --noEmit` root + `tsc --noEmit -p app/tsconfig.json` + `vite build`): PASS — no type errors, vite build succeeded (largest chunk `index-B-gQOmpT.js` 179.18 kB / 58.62 kB gz).
- unit tests (`npm test` = `vitest run`): PASS — 81 test files, 859 tests, 0 failures. Duration ~5.3s.

No failing tests found; no fixes were required. All-green run, logged per DEC-068 (commit is mandatory regardless).

## 2026-08-10 task-w12-c — commit-body triage @ f6e3422

Harvested every `PLANNER:`/"OUT-OF-AREA DEFECT"/"Gap for the planner"/"Out-of-area
note" line recorded in the branch-side commits (`git log <merge>^2 --not
<merge>^1`) of the nine wave-8/10 merges: task-w8-b (1b7fc19), task-w8-c
(e96c11a), task-w8-d (b19e1dd), task-w8-e (6b6ef85), task-w8-f (b310272),
task-w8-g (9d34b59), task-w10-b (9db60be), task-w10-c (d82b612), task-w10-d
(92767e1). task-w10-b/c/d's single commits each ship a DEC-064/065/066/067
fix directly (no defect note left behind — nothing to triage there).

| note | source commit | status |
| --- | --- | --- |
| CRITICAL: blanket `contactsRoutes.use("*", requireOrganizer)` (and same pattern in events.ts, portal-config.ts) leaks the organizer gate onto every sibling `/api/v1` sub-app mounted later in src/index.ts, 403ing reviewer/speaker access to `/api/v1/me`, `/api/v1/review/*`, task-assignment PATCH, etc. | 6b6ef85 (w8-e), also independently flagged in b19e1dd (w8-d) | fixed-cite: src/routes/api/{events,contacts,portal-config}.ts now scope `requireOrganizer` per own path prefix (e.g. contacts.ts:24-27 `contactsRoutes.use("/contacts", ...)` / `.use("/contacts/*", ...)` / `.use("/segments", ...)` / `.use("/segments/*", ...)`, each router carrying an explanatory NOTE comment pointing at events.ts). Regression tests: test/api-route-composition.test.ts (dynamic full-app mount, 3 sub-apps + meRoutes), test/w10-verify-no-blanket-wildcard.test.ts (extends the same check to every remaining `/api/v1` sub-app: submissions, overview, views, agenda, tasks, fileApi). Both green on current main. |
| Unbatched `allowedIds` `inArray(...)` in listSubmissions' q/trackId candidate-id narrowing (src/server/repo/submissions.ts) would hit the same ~100-bound-parameter D1 ceiling as the batch that e96c11a fixed elsewhere in the same file, once a text/track filter matches >100 submissions in one event. | e96c11a (w8-c) | fixed-cite: src/server/repo/submissions.ts:241-243 — `if (allowedIds !== null && allowedIds.size > ID_CHUNK_SIZE) { const idBatchesForFilter = chunkIds([...allowedIds]); ... }` batches the candidate-id set through the same `chunkIds` helper (ID_CHUNK_SIZE=100) used for the direct id-list path. Covered by test/api-submissions.test.ts. |
| GET /api/v1/contacts/:id (serializeContact in src/routes/api/contacts.ts) stores `socialLinksJson` (written by the speaker portal's profile edit, src/server/repo/portal.ts) but never returned it — bio round-tripped, social links did not. | 6b6ef85 (w8-e) | fixed-here: src/routes/api/contacts.ts serializeContact now returns `socialLinks: row.socialLinksJson ? JSON.parse(row.socialLinksJson) : null`, mirroring the existing `customFields` pattern. Regression test: test/contacts-social-links.test.ts (2 cases: populated + null). |
| No admin or public route creates a co-presenter `participant` row with `invite_status='invited'` — J7 invite accept/decline is otherwise untestable end-to-end; speaker.ts works around it with a direct `wrangler d1 execute --local` INSERT. | 6b6ef85 (w8-e) | open-PLANNER: grepped src/routes/api/*.ts and src/routes/portal/*.tsx on current main — still no endpoint sets `participant.inviteStatus` to `"invited"` (only src/server/repo/portal.ts's accept/decline transition reads/consumes it, and src/server/repo/submissions.ts / submit.ts only ever write `"none"` at submission-create time). PLANNER: needs a real "invite co-presenter" admin/organizer endpoint (submissions or contacts route) that inserts a `participant` row with `invite_status='invited'` and sends the invite email — feature gap, not a regression, too large for this task's fix-in-place scope. |
| No admin API exists to toggle `participant.visible` after a submission is created — public.ts's hidden-participant visibility-gate walkthrough check works around this with a direct `wrangler d1 execute --local` UPDATE. | b310272 (w8-f) | open-PLANNER: grepped src/routes/api/*.ts on current main — `participant.visible` is still only ever written at submission-create/submit time (src/server/repo/submissions.ts:513, submit.ts) and read (never mutated) elsewhere (exports.ts, public.ts). PLANNER: needs an organizer-facing "hide/show this speaker" endpoint — feature gap, out of this task's fix-in-place scope (>a few lines: new route + repo mutation + authz + test). |
| scripts/seed.ts creates exactly one org, so the "another org's eventId -> 404" export walkthrough check (data.ts) falls back to a nonexistent eventId rather than a genuine cross-org id; still exercises the requireOwnedEvent not-found branch but doesn't assert true cross-tenant isolation on that surface specifically. | 9d34b59 (w8-g) | open-PLANNER: confirmed scripts/seed.ts on current main still inserts exactly one `org` row (single `insertStmt("org", ...)` call). True cross-org export-isolation coverage would need either a second seeded org (seed.ts is explicitly out of this task's file scope, and fixture data must stay demo-only per the no-eval-gaming rule) or a dedicated unit test constructing two orgs directly via the repo layer against a fake db — left as a PLANNER item, not a regression. |

## 2026-08-10 task-w12-b — walkthrough @ f6e3422

Note: task order specified sha f6e3422; main had advanced to 01c6ace
(merge task-w11-a) by the time this worktree was created from main, so
that is the commit actually verified.

Replicated `.github/workflows/ci.yml` lines 57-85 (the `walkthrough` job)
locally: `npm ci --no-audit --no-fund`, `npm run db:migrate`, `npm run
seed`, `npx wrangler dev` in the background, polled `/health` until up,
then `npm run walkthrough` (DEC-062 order: producer -> review -> speaker
-> public -> data).

Note on port: port 8787 was already bound by another concurrently-running
worktree's `wrangler dev` process at the time of this run (a swarm-wide
resource conflict, not a product defect); the first attempt's `curl -sf
http://localhost:8787/health` polling loop reported "up" against that
other process's server, and the review module then failed
(`org2-organizer POST /login` → `expected 302, got 401`) because the
throwaway second-org row inserted via `wrangler d1 execute --local` from
this worktree landed in *this worktree's* local D1 state, not the other
process's. Re-ran wrangler dev on port 8797 (this worktree only) and
re-polled `/health` on that port before invoking `npm run walkthrough
-- --url http://localhost:8797`; all five modules then passed cleanly.
No product-code or walkthrough-script fix was needed — this was a
local port collision between two concurrently-active worker worktrees,
not a defect in the CI job itself (CI runs one job per runner, so this
collision cannot occur there).

- install (`npm ci --no-audit --no-fund`): PASS.
- build (`npm run build`): PASS — no type errors, vite build succeeded.
- `npm run db:migrate`: PASS — all 9 migrations applied (0000-0008).
- `npm run seed`: PASS — D1 rows + 6 R2 objects seeded.
- `wrangler dev` + `/health` poll: PASS (port 8797, after the 8787
  collision described above).
- `npm run walkthrough` (producer -> review -> speaker -> public -> data):
  ALL PASS.
  - PASS producer (J1, J2, J3, J5)
  - PASS review (J4 — queue ordering/anonymization/scorecard/cap/authz/
    remind/results/CSV, all `ok`)
  - PASS speaker (J6/J7/J8 — onboarding tasks, portal, invitations,
    deliverable versioning, comment thread, content-approval gate, all
    `ok`)
  - PASS public (J9/J10 — agenda scheduling, conflict surfacing,
    auto-schedule, all public/embed surfaces, visibility gates, all `ok`)
  - PASS data (J11/J12 — contacts/CSV import/merge/segments/bulk-email
    cap, bearer tokens, exports, `/docs/api`, all `ok`)

No FAIL lines, no PLANNER: lines. All five walkthrough modules green on
this run; no product-code changes were required.

## 2026-08-10 task-w13-a — build+test @ 0ee30dd

- install (`npm ci --no-audit --no-fund`): PASS — 334 packages, no errors.
- build (`npm run build`): PASS — `tsc --noEmit` (root + app), then
  `vite build` succeeded, no type errors.
- `npm run bundle:check`: PASS — entry bundle 58.59 kB gzip (budget
  300.00 kB).
- `npm test` (`vitest run`): PASS — 82 test files, 861 tests, all green.
  Duration 5.10s.

No product-code changes were required; all CI build-and-test steps
mirrored exactly from `.github/workflows/ci.yml` lines 13-24 passed on
first run.

RESULT: PASS

## 2026-08-10 task-w13-b — walkthrough @ 0ee30dd

Mirrored CI 'walkthrough' job exactly: `npm ci --no-audit --no-fund`,
`npm run db:migrate` (all 9 migrations 0000-0008 applied), `npm run seed`
(D1 rows + 6 R2 objects), `npx wrangler dev --port 8787` backgrounded,
`/health` poll succeeded well within 60s, then `npm run walkthrough`.

- PASS producer (J1, J2, J3, J5 — all `ok`)
- PASS review (J4 — queue ordering/anonymization/scorecard/cap/authz/
  remind/results/CSV, all `ok`)
- PASS speaker (J6/J7/J8 — onboarding tasks, portal, invitations,
  deliverable versioning, comment thread, content-approval gate, all
  `ok`)
- PASS public (J9/J10 — agenda scheduling, conflict surfacing,
  auto-schedule, all public/embed surfaces, visibility gates, all `ok`)
- PASS data (J11/J12 — contacts/CSV import/merge/segments/bulk-email
  cap, bearer tokens, exports, `/docs/api`, all `ok`)

No FAIL lines, no PLANNER: lines. All five walkthrough modules green on
the first run at this sha; no product-code or script changes were
required.

RESULT: PASS

## 2026-08-10 task-w13-d — perf-smoke @ 0ee30dd

Mirrored the CI `perf-smoke` job (.github/workflows/ci.yml lines 26-55)
exactly in the task-w13-d worktree: `npm ci --no-audit --no-fund`, `npm
run db:migrate` (9 migrations, 0000-0008, all applied), `npm run seed`,
`npm run perf:seed` (2k-row scale), `npx wrangler dev --port 8787` in
background, polled `/health` (up after 1s, well under the 60s budget),
then `npm run perf:smoke`.

Budget: p95 < 150ms (PERF_P95_BUDGET_MS in scripts/perf-smoke-lib.ts),
30 measured iterations per check:

- submissions list (page 1): 10.7ms — PASS (budget 150ms)
- submissions list (q=Kubernetes): 10.2ms — PASS (budget 150ms)
- submission detail: 13.2ms — PASS (budget 150ms)
- event overview: 7.6ms — PASS (budget 150ms)

`npm run perf:smoke` exited 0 ("perf:smoke OK") on the first run — no
product-code, repo-query, or migration fix was required.

Also ran `npm run build` (PASS, no type errors) and `npm test` (861/861
tests passed across 82 files) in the same worktree to confirm the branch
builds and tests standalone.

RESULT: PASS
