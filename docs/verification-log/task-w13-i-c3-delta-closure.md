# task-w13-i - delta-closure @ ba8316f

FROZEN SHA: f6983e66a51d23e88931ce45dac6d0374a3d5463 (all analysis below performed against this sha, the worktree's HEAD at the time PARTS 1-4 were executed; `git log -1 --format=%s` = "scribe wave 13")
WAVE-12 GATE: PASS (W1..W7 all present at f6983e66a51d23e88931ce45dac6d0374a3d5463, no poll needed)
DRIZZLE-ORM AT S: `node_modules/drizzle-orm/package.json` version 0.45.2; `package.json:20` `"drizzle-orm": "^0.45.2"`, no `drizzle-kit` dependency anywhere in package.json (DEC-308 intact)
OPEN ITEMS: 0
RESULT: PASS
RECHECK SHA: ba8316fb49c2f6040e8bb0611d63df3cb15b78ea (worktree re-provisioned mid-task after an external prune removed the first checkout — see POST-S DELTA; `git log --oneline f6983e6..ba8316f -- src app test scripts migrations package.json package-lock.json README.md` is EMPTY, so this recheck sha carries the identical content and every claim above still holds without re-verification)

## WAVE-12 CONTENT GATE (DEC-314, analogue of DEC-303 for wave 12)

| id | claim | evidence at S | result |
|----|-------|----------------|--------|
| W1 | drizzle-orm ^0.45.2, no drizzle-kit tooling (DEC-308) | `package.json:20` `"drizzle-orm": "^0.45.2"`; no `drizzle-kit` key in package.json | PASS |
| W2 | perf-smoke graded per SPEC §7 class budgets, schedule.ics classed `public` (DEC-309) | `scripts/perf-smoke-lib.ts:18` `PERF_CLASS_BUDGET_MS`, `:80` `gradePerfCheck`; `scripts/perf-smoke.ts:336` `cls: "public"` on the schedule.ics check | PASS |
| W3 | schedule.ics queries requested ids instead of hydrating whole agenda (DEC-310) | `src/server/repo/public.ts:768` `getPublicAgendaByIds`; called from `src/routes/public/index.tsx:197`; `test/schedule-ics-id-scoped.test.ts` exists | PASS |
| W4 | mobile overflow fix on /docs/api and /dev/mailbox, render-sweep gate extended (DEC-311) | `src/routes/dev/mailbox.tsx:44,92` viewport meta; `src/routes/docs.tsx:242` `.table-scroll { overflow-x: auto; }`; `scripts/render-sweep.ts:80-81` `/docs/api` and `/dev/mailbox` rows in `MOBILE_ROUTE_MANIFEST` | PASS |
| W5 | tasks assign-all-accepted invite filter pushed into SQL WHERE (DEC-312) | `src/server/repo/tasks.ts:14` imports `ACTIVE_INVITE_STATUSES`; `:365` `inArray(schema.participant.inviteStatus, [...ACTIVE_INVITE_STATUSES])` inside the query builder | PASS |
| W6 | `src/routes/review/` sub-app directory exists with the five decomposed modules | `ls src/routes/review/` -> `index.ts plans.ts recusals.ts reviewer.ts shared.ts` | PASS |
| W7 | `src/routes/review.ts` (the old monolith) is gone | `ls src/routes/review.ts` -> "No such file or directory" | PASS |

No item missing; no poll needed (bounded 10x60s poll per DEC-314 was not invoked).

## PART 1 — delta inventory (84e2c04de087310f39877140cb6e239fab018e6c..S)

`git log --oneline --name-only 84e2c04de087310f39877140cb6e239fab018e6c..S -- src app test scripts migrations package.json package-lock.json README.md`, deduped path list (23 paths, 8 non-merge commits: 7b93864 drizzle upgrade, a7f9ab6 perf-smoke grading, d46d1a8 schedule.ics id-scoping, 8f36e15 mobile overflow fix, 3a78ce0 tasks SQL WHERE push-down, b6ce3a9 review.ts decomposition, plus two scribe commits touching only `src/decisions.ts`):

```
package-lock.json
package.json
README.md
scripts/perf-smoke-lib.ts
scripts/perf-smoke.ts
scripts/render-sweep.ts
src/decisions.ts
src/routes/dev/mailbox.tsx
src/routes/docs.tsx
src/routes/public/index.tsx
src/routes/review.ts                    (deleted)
src/routes/review/index.ts              (added)
src/routes/review/plans.ts              (added)
src/routes/review/recusals.ts           (added)
src/routes/review/reviewer.ts           (added)
src/routes/review/shared.ts             (added)
src/server/repo/public.ts
src/server/repo/tasks.ts
test/dev-mailbox.test.ts
test/docs-page.test.ts
test/itinerary-roundtrip.test.ts
test/perf-smoke.test.ts
test/schedule-ics-id-scoped.test.ts
test/tasks-assign-all-accepted-invite-gate.test.ts
```

## PART 2 — citation recheck against the three standing wave-11 logs

Grepped `docs/verification-log/task-w11-e-c3-spec-audit.md`, `task-w11-f-c3-triage-closure.md`, `task-w11-h-c3-rubric-coverage.md` for every path above (bash `for`-loop word-splitting note: the repo's default interactive shell is zsh, where unquoted `$var` does NOT word-split — the delta-path list had to be read from a file with `while IFS= read -r`, not iterated as a bare `for p in $paths` zsh one-liner, or every grep silently ran against the whole path list as one string and reported zero hits).

### Section e (spec-audit) — hits and rechecks

| path cited | claim | recheck at S | verdict |
|---|---|---|---|
| `package.json:13` `"perf:smoke": "tsx scripts/perf-smoke.ts"` | CI perf-smoke npm script wiring | `package.json:13` still exactly `"perf:smoke": "tsx scripts/perf-smoke.ts",` | CONFIRMED (line stable) |
| `package.json:15` `"walkthrough": "tsx scripts/walkthrough.ts"` | walkthrough script wiring | `package.json:15` still exactly `"walkthrough": "tsx scripts/walkthrough.ts",` | CONFIRMED (line stable) |
| `README.md` (docs/clarifications.md audit heading, line 76) | false-positive substring match — the citation is to `docs/README.md`'s precedence note, not the delta's top-level `README.md` (which only changed by dropping the drizzle-kit migrate-command paragraph) | not a real citation of the delta path | N/A — not a claim about the changed file |
| `scripts/perf-smoke.ts` (via the `package.json:13` npm-script citation) | perf-smoke exists and is CI-wired | file exists, exports intact, `scripts/perf-smoke.test.ts` passes (38/38, see test run below) | CONFIRMED |
| `src/routes/dev/mailbox.tsx:21` `shouldMountDevMailbox(env)` | dev-mode-only mailbox mount gate | `src/routes/dev/mailbox.tsx:21` still exactly `export function shouldMountDevMailbox(env: Pick<Bindings, "DEV_MODE">): boolean {` | CONFIRMED (line stable) |
| `src/routes/public/index.tsx:55` `c.header("Cache-Control", "no-store")` (G3, DEC-297) | non-200 responses carry no-store | `publicNotFound` helper now at `:55-56` (`function publicNotFound(...)` at 55, `c.header("Cache-Control", "no-store");` at 56 — one-line shift from a doc-comment insertion above it, not a behavior change); still called from every not-found branch | CONFIRMED (line drift only, 55->55/56 combined; substance identical) |

### Section f (triage-closure) — hits and rechecks

| path cited | claim | recheck at S | verdict |
|---|---|---|---|
| `src/decisions.ts` DEC_290, DEC_292 (`:297`), DEC_289 | CSV import scoping, travel_logistics field, embed config closures | `src/decisions.ts:297` still `export const DEC_292 = "Contact custom fields are edited as key/value rows with a reserved \`travel_logistics\` key..."` — exact line preserved; DEC_290/DEC_289 constants still present (grep confirms) | CONFIRMED |
| `src/routes/public/index.tsx` G3 `publicNotFound` line 55, call sites 93/113/115/127/129 | no-store wired at every not-found branch | `publicNotFound` def at :55; call sites now at :94/114/116/128/130/149/151/163/165/186/233 (11 sites, was 11 sites at 93/113/115/127/129/148/150/162/164/185/231) — same count, +1 line drift throughout from the DEC-310 comment/logic insertion above the function | CONFIRMED (line drift only, defect claim intact — the near-miss DEC-307 flagged) |
| `src/routes/public/index.tsx:48-55` `publicNotFound()` (finding 3, CLOSED DEC-297) | 404 sets no-store before returning, `setCacheHeaders` never called on that path | function body unchanged (only line numbers shift, see above); `setCacheHeaders(c)` still only called on success paths per current read | CONFIRMED |
| `src/routes/public/index.tsx:138,224` JSON/ics feed surfaces (finding 6, CLOSED DEC-289) | EMB-15 embed feed formats | JSON-feed comment block now at `:139` (was 138), `/e/:eventSlug/agenda.ics` route now at `:230` (was 224) — both +1 line drift from the same DEC-310 insertion; `/e/:eventSlug/schedule.ics` at `:183` is the DEC-310-touched route itself and still exists | CONFIRMED |

### Section h (rubric-coverage) — hits are the dead-path case, handled in PART 3

`src/decisions.ts` (1 hit, DEC-271 citation for ABS-12) — `grep -n "DEC_271" src/decisions.ts` still resolves; `src/server/repo/tasks.ts` (1 hit) and `test/itinerary-roundtrip.test.ts` (3 hits, EMB-09/10/11) and `test/dev-mailbox.test.ts` (1 hit, CFP-08) are evidence for rubric rows unrelated to the review.ts decomposition — their cited files changed in the delta but the cited symbols/behavior did not move: `src/server/repo/tasks.ts` still has the SQL-pushdown logic the citation already described generically; `test/itinerary-roundtrip.test.ts` and `test/dev-mailbox.test.ts` still exist with matching test names and pass (see test run). `src/server/repo/public.ts` (4 hits) is evidence for CFP-08/EMB-related visibility filtering, unaffected by the id-scoped schedule.ics addition (`getPublicAgendaByIds` is a new export alongside the existing filtering functions, nothing removed). All CONFIRMED, no drift beyond what's implied by adding code.

## PART 3 — the dead-path case: `src/routes/review.ts` decomposition

### 3(a) old-path:line -> new-path:line mapping for every h citation

| h citation (old, at 84e2c04) | rubric row(s) | new location at S |
|---|---|---|
| `src/routes/review.ts:247` `POST /events/:eventId/plans` | ABS-01 | `src/routes/review/plans.ts:51` `reviewPlansRoutes.post("/api/v1/events/:eventId/plans", ...)` |
| `src/routes/review.ts:358` `advance-round` | ABS-01 | `src/routes/review/plans.ts:162` `reviewPlansRoutes.post("/api/v1/plans/:id/advance-round", ...)` |
| `src/routes/review.ts:403` `GET /plans/:id/progress` | ABS-08 | `src/routes/review/plans.ts:207` `reviewPlansRoutes.get("/api/v1/plans/:id/progress", ...)` |
| `src/routes/review.ts:569` `GET /api/v1/review/plans` | CFP-10 | `src/routes/review/reviewer.ts:30` `reviewReviewerRoutes.get("/api/v1/review/plans", ...)` |
| `src/routes/review.ts:609` `GET /review/plans/:id/queue` | ABS-05 | `src/routes/review/reviewer.ts:49` `reviewReviewerRoutes.get("/api/v1/review/plans/:id/queue", ...)` |
| `src/routes/review.ts:785` `POST .../recusals/:submissionId` | ABS-12 | `src/routes/review/recusals.ts:17` `reviewRecusalRoutes.post("/api/v1/review/plans/:planId/recusals/:submissionId", ...)` |
| `src/routes/review.ts:815` `DELETE .../recusals/:submissionId` | ABS-12 | `src/routes/review/recusals.ts:47` `reviewRecusalRoutes.delete("/api/v1/review/plans/:planId/recusals/:submissionId", ...)` |
| `src/routes/review.ts:636-640` queue exclusion (`partitionRecused`/`recusedOut`) | ABS-12 | `src/routes/review/reviewer.ts:78` `partitionRecused(...)` call, `:82-92` `recusedOut` shaping, `:116` `recused: recusedOut` in the response envelope |

Additional un-numbered generic citations in h resolved for completeness:
- ABS-02 "`POST /plans/:id/reviewers`, plan-scoped" -> `src/routes/review/plans.ts:168`
- ABS-03 / CFP-11 "scorecard submit" -> `src/routes/review/reviewer.ts:156` `reviewReviewerRoutes.put("/api/v1/review/plans/:planId/evaluations/:submissionId", ...)`
- ABS-06 "assignment route w/ `trackId`" -> `src/routes/review/plans.ts:168` (body reads `trackId` at `:177`)
- ABS-09 "`POST /plans/:id/remind`" -> `src/routes/review/plans.ts:278`
- ABS-10 / ABS-13 "`GET /plans/:id/results`" -> `src/routes/review/plans.ts:245`
- CFP-S3/ABS-S1/ABS-S3 scenario citations of the bare `src/routes/review.ts` path -> the composed `src/routes/review/` sub-app (`index.ts` + `plans.ts` + `reviewer.ts` + `recusals.ts`), scenario evidence otherwise unchanged (`task-w11-b-c3-walkthrough.md`, a live-D1 lane, is what actually exercised these — not re-run here per DEC-313's scope, only its static citations)

Every citation re-locates cleanly; no rubric row's evidence disappeared.

### 3(b) route-registration diff: old monolith vs new five-file union

`git show 84e2c04:src/routes/review.ts | grep -nE '^reviewRoutes\.(get|post|put|delete|patch)\('` (18 routes) vs the union of the same anchored grep (`^review[A-Za-z]+Routes\.(get|post|put|delete|patch)\(`) over `index.ts plans.ts reviewer.ts recusals.ts shared.ts` (18 routes). Sorted `method path` lists:

```
OLD (84e2c04, src/routes/review.ts)          NEW (S, src/routes/review/*.ts)
delete /api/v1/plans/:id                     delete /api/v1/plans/:id
delete /api/v1/plans/:id/reviewers/:reviewerId  delete /api/v1/plans/:id/reviewers/:reviewerId
delete /api/v1/review/plans/:planId/recusals/:submissionId  delete /api/v1/review/plans/:planId/recusals/:submissionId
get /api/v1/events/:eventId/plans            get /api/v1/events/:eventId/plans
get /api/v1/plans/:id                        get /api/v1/plans/:id
get /api/v1/plans/:id/progress               get /api/v1/plans/:id/progress
get /api/v1/plans/:id/results                get /api/v1/plans/:id/results
get /api/v1/plans/:id/reviewers              get /api/v1/plans/:id/reviewers
get /api/v1/review/plans                     get /api/v1/review/plans
get /api/v1/review/plans/:id/queue           get /api/v1/review/plans/:id/queue
get /api/v1/review/submissions/:id           get /api/v1/review/submissions/:id
patch /api/v1/plans/:id                      patch /api/v1/plans/:id
post /api/v1/events/:eventId/plans           post /api/v1/events/:eventId/plans
post /api/v1/plans/:id/advance-round         post /api/v1/plans/:id/advance-round
post /api/v1/plans/:id/remind                post /api/v1/plans/:id/remind
post /api/v1/plans/:id/reviewers             post /api/v1/plans/:id/reviewers
post /api/v1/review/plans/:planId/recusals/:submissionId  post /api/v1/review/plans/:planId/recusals/:submissionId
put /api/v1/review/plans/:planId/evaluations/:submissionId  put /api/v1/review/plans/:planId/evaluations/:submissionId
```

`diff` of the two sorted lists is empty — 18/18 identical, no route lost or renamed. (First attempt at this grep used an un-anchored pattern and false-matched `.get()`/`.set()` calls inside `Map` lookups deep in the route bodies — anchoring on `^review[A-Za-z]+Routes\.` at line-start was required to get a clean route-only list.)

### 3(c) mount and composition-order check

`src/index.ts:23` imports `{ reviewRoutes }` from `./routes/review`; `src/index.ts:57` `app.route("/", reviewRoutes);` — mounted exactly once.

`src/routes/review/index.ts:17-19` composition order: `reviewPlansRoutes` (`/events/:eventId/plans`, `/plans/:id*`), then `reviewReviewerRoutes` (`/review/plans`, `/review/plans/:id/queue`, `/review/submissions/:id`, `/review/plans/:planId/evaluations/:submissionId`), then `reviewRecusalRoutes` (`/review/plans/:planId/recusals/:submissionId`). No pair of registered patterns can shadow another: plans-routes all start with a literal `/events/` or `/plans/` segment (never `/review/...`); reviewer-routes and recusal-routes both start with the literal `/review/plans/` prefix but diverge at the next segment — reviewer's is a literal `queue` or a param `:id`/`:planId` immediately followed by `/evaluations/`, recusal's is always followed by the literal `recusals`. Hono's router matches on the full literal-vs-param trie per method, not first-registered-wins for distinct shapes, so even the two same-prefix families (`reviewer` vs `recusal`) cannot swallow each other: `GET /review/plans/:id/queue` (reviewer) and `POST|DELETE /review/plans/:planId/recusals/:submissionId` (recusal) differ in both method-set and their divergent literal segment (`queue` vs `recusals`), and `PUT /review/plans/:planId/evaluations/:submissionId` (reviewer) differs from the recusal pair by both method and literal segment (`evaluations` vs `recusals`). No shadowing pair found.

## PART 4 — wave-10 anchors (G1-G7) re-grepped at S

| id | claim | current file:line at S |
|---|---|---|
| G1 (DEC-295) | `src/routes/root.tsx` contains `res.status !== 304` | `src/routes/root.tsx:66` `if (res.status !== 304) {` (grep-confirmed present) |
| G2 (DEC-296) | `.dev.vars.example` has `PUBLIC_BASE_URL=http://localhost:8787`; `src/server/origin.ts` has `firstLoopbackCandidate` | `.dev.vars.example:2` `PUBLIC_BASE_URL=http://localhost:8787`; `src/server/origin.ts:11` `export function firstLoopbackCandidate(` |
| G3 (DEC-297) | `src/routes/public/index.tsx` sets `Cache-Control: no-store` on the non-200 path | `src/routes/public/index.tsx:55-56` `publicNotFound()` — see PART 2 detail above; DEC-307's flagged near-miss (wave-12-c touched `:182-197` of this file for the schedule.ics id-scoping) does NOT overlap the `:55-56` no-store contract — verified: DEC-310's diff (`d46d1a8`) only touches the `schedule.ics` handler body (now `:183-224`), never `publicNotFound` or its call sites' semantics; only their line numbers shift by the same fixed +1 offset as every other line below the inserted comment. Contract intact. |
| G4 (DEC-298) | `src/routes/agenda.ts` has `parseBoundedInt` and `gridMin: { min: 1, max: 480 }` | `src/routes/agenda.ts:24` `function parseBoundedInt(` (grep-confirmed); `gridMin: { min: 1, max: 480 }` grep-confirmed present |
| G5 (DEC-299) | `src/server/repo/attribution.ts` exists, `isNull(schema.participant.titleAtTime)` | `src/server/repo/attribution.ts` exists; `isNull(participant.titleAtTime)` grep-confirmed present |
| G6 (DEC-300) | `src/routes/api/forms.ts` + `src/server/repo/forms.ts` implement 409/`cascade=1` field delete | both files exist; 409/cascade logic grep-confirmed present in both |
| G7 (DEC-301) | `src/routes/api/events.ts` contains `name: "General"` at event create | `src/routes/api/events.ts` grep-confirmed contains `name: "General"` |

All seven wave-10 anchors still hold at S.

## Test runs (evidence-backing files for the delta and its citations)

`npx vitest run test/itinerary-roundtrip.test.ts test/dev-mailbox.test.ts test/submit-mailer-failure.test.ts test/ics-download.test.ts test/schedule-ics-id-scoped.test.ts test/tasks-assign-all-accepted-invite-gate.test.ts test/docs-page.test.ts test/perf-smoke.test.ts test/public-invite-visibility.test.ts test/round-criteria.test.ts test/review-rounds.test.ts test/rounds.test.ts test/review-queue-shape.test.ts test/review-idor.test.ts test/review-remind-mailer-failure.test.ts test/review-recusal.test.ts`

Result: **16 files passed (16), 132 tests passed (132)**, 0 failures.

`npm run build` (tsc --noEmit x2 + vite build) — clean, no type errors, admin/speaker SPA bundles emitted.

## POST-S DELTA

PARTS 1-4 above were executed against S = `f6983e66a51d23e88931ce45dac6d0374a3d5463` ("scribe wave 13"), this worktree's HEAD when the analysis was performed. Before this file was committed, an external process (another lane's `git worktree prune` from the shared main checkout, or an equivalent concurrent worktree operation — not this lane's own action) removed this task's original worktree checkout mid-task; the surviving artifact was this markdown file itself (never tracked by the deleted `.git`), which was preserved and the worktree was re-provisioned via `git -C .../chautauqua worktree add .../task-w13-i -b task-w13-i main`. At re-provisioning, `refs/heads/main` had advanced to `ba8316fb49c2f6040e8bb0611d63df3cb15b78ea` (three more merges: task-w13-a, task-w13-d/render-sweep, task-w13-c/perf-smoke — all three are wave-13 BATTERY lanes per DEC-313, i.e. log-only, no product code).

`git log --oneline f6983e6..ba8316f -- src app test scripts migrations package.json package-lock.json README.md` is EMPTY — no product-path commit landed between the two shas — so per DEC-280 (substance, not sha-identity) every claim recorded above against f6983e6 stands unchanged at ba8316f without re-verification. RESULT: PASS is reported at the re-provisioned worktree's tip, ba8316f, as required (S = worktree HEAD); FROZEN SHA above names the sha the actual grep/read/test work was performed against, for traceability. Lesson for future -c3- lanes sharing this harness: an in-flight worktree can be pruned by an unrelated concurrent lane's `git worktree prune` (harness runs many lanes against the same bare repo simultaneously) — write your verification-log file early and keep a scratch-directory backup of it, since the file itself, not the worktree, is what a resumed lane must recover from.
