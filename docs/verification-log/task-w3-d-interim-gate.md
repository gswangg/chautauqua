# task-w3-d: Interim gate on post-drain main + review-walkthrough harness repair

Purpose (DEC-069, DEC-139, DEC-239): first full-suite verification of `main`
after the wave-2 a/b/c/e merges (the last recorded gate,
`docs/verification-log/task-w2-d-interim-gate.md`, predates them), plus a
repair of `scripts/walkthrough/review.ts`'s `QueueItem` shape, which had gone
stale against the DEC-239 reviewer-queue wire contract
(`{submissionId, ref, title, ratingsCount, alreadyRatedByMe}`), so the module
can run as part of the wave-4 exit battery.

Environment: fresh worktree of `main`, branch `task-w3-d`, checked out at
commit `c1ff005a3c8ddf91278f514b391322eb857585f9` ("scribe wave 3"). Node
v24.1.0, npm 11.3.0. Worktree path:
`/Users/wednesdayniemeyer/Documents/gniemeyer/Projects/chautauqua-wt/task-w3-d`.

## Part 1 — gate

### 1. Install

```
cd <worktree> && ([ -d node_modules ] || npm ci --prefer-offline --no-audit --no-fund --silent)
```

Result: **PASS** (node_modules already present in the fresh worktree checkout
via the shared install cache; no errors).

### 2. Production build

```
npm run build
```

runs `tsc --noEmit && tsc --noEmit -p app/tsconfig.json && vite build --config app/vite.config.ts`.

Result: **PASS**. Both `tsc --noEmit` passes completed with zero type errors.
`vite build` succeeded: 133 modules transformed, 19 output chunks emitted to
`public/admin/assets/`, built in 598ms. No warnings, no errors.

### 3. Test suite

```
npm test --silent
```

Result: **PASS**.

```
 Test Files  184 passed (184)
      Tests  1559 passed (1559)
   Duration  13.12s
```

All `*.render.test.tsx` files under `app/src/` ran and passed (jsdom
environment). Several tests intentionally log `stderr` as part of exercising
DEC-238 best-effort mailer-failure paths (`comms-send-mailer-failure`,
`contacts-bulk-email-mailer-failure`, `tasks-remind-now-mailer-failure`,
`users-create-mailer-failure`) — expected simulated-provider-rejection log
lines from code under test, not failures. `test/review-queue-shape.test.ts`
(DEC-239 reviewer queue item wire shape) is present and green, confirming the
server side of the contract this task's Part 2 harness fix depends on.

### 4. Bundle check

```
npm run bundle:check
```

Result: **PASS**. Entry bundle (`index-*.js` + `index-*.css`) = 58.86 kB gzip
against a 300 kB budget.

## Mechanical fixes applied (Part 1)

**None.** No type errors, no duplicate imports, no test failures were
encountered on this fresh worktree of the merged tree. The four wave-2
lanes (a/b/c/e) merged clean of mechanical fallout.

## Semantic conflicts found

**None observed in files outside this wave's other lanes' exclusion list.**
All 184 test files / 1559 tests, both typecheck passes, the production
build, and the bundle-size check are green on a fresh worktree of `main` at
`c1ff005a3c8ddf91278f514b391322eb857585f9`. No repro to hand off.

## Part 1 verdict

Gate: **PASS** — install, typecheck (both tsconfigs), vitest (server + app,
incl. all `*.render.test.tsx`), production build, and bundle-check are all
green with zero code changes required.

## Part 2 — review-walkthrough harness repair

`scripts/walkthrough/review.ts` declared

```ts
interface QueueItem {
  id: string;
}
```

but the real `GET /api/v1/review/plans/:id/queue` response items are shaped
`{submissionId, ref, title, ratingsCount, alreadyRatedByMe}` per DEC-239 (see
`test/review-queue-shape.test.ts` and
`docs/verification-log/task-w2-e-findings-closure.md` Housekeeping #1). The
one usage site, `queue.items.map((i) => i.id)` at (pre-fix) line 437, was
silently reading `undefined` for every item since `id` doesn't exist on the
wire payload — every downstream assertion built on `queueIds` (ordering,
membership, ratings-count cross-check) was comparing `undefined`s against
real submission ids and would only "pass" vacuously or fail confusingly.

### Fix applied

```ts
interface QueueItem {
  submissionId: string;
  ref: string;
  title: string;
  ratingsCount: number;
  alreadyRatedByMe: boolean;
}
```

and

```ts
const queueIds = queue.items.map((i) => i.submissionId);
```

(scripts/walkthrough/review.ts, interface at line ~243, usage at line ~437.)
No other usage sites referenced `QueueItem.id` or built scorecard URLs off
it — `grep -n "queue\.items\|QueueItem"` across the file confirmed only this
one construction site and one read-only 404-probe request
(`org2Organizer.request(.../queue)`) which never destructures item shape.

`npx tsc --noEmit -p tsconfig.json` (which includes `scripts/`) is clean
after the change.

### Proof run against local wrangler dev

```
cd <worktree>
rm -rf .wrangler/state
npm run db:migrate     # applies 0000-0014, all PASS
npm run seed           # tsx scripts/seed.ts + wrangler d1 execute + seed-r2.ts
npx wrangler dev --port 18787 --inspector-port 19229 &   # non-default port: a
                                                           # concurrent sibling
                                                           # worktree's dev
                                                           # server + pkill
                                                           # collided on the
                                                           # default 8787
                                                           # mid-run (see note)
curl -s http://localhost:18787/health   # {"ok":true}
npx tsx scripts/walkthrough/review.ts --url http://localhost:18787
```

Result: **exit 0, zero FAIL lines**, all 20 checks `ok:`:

```
ok: queue contains exactly the reviewer's assignment (no unassigned submissions)
ok: queue is sorted fewest-ratings-first
ok: the pre-rated submission (1 rating) is not ordered ahead of an unrated (0-rating) peer
ok: anonymized submission detail has no speaker-identifying fields (raw payload check)
ok: scorecard round-trips numeric rating, dropdown, and free text
ok: max-evaluations cap rejects the overflow evaluation
ok: reviewer GET of admin plan settings -> 403
ok: reviewer GET of plan results -> 403
ok: second-org organizer fetching this plan's queue -> 404/403 (DEC-039)
ok: second-org organizer fetching this plan's results -> 404/403 (DEC-039)
ok: DEC-175 reviewer GET of an out-of-scope submission's review detail -> 404 (not 403)
ok: DEC-175 out-of-scope detail probe is not 403 (existence-hiding, not authz-denial)
ok: DEC-175 reviewer PUT evaluation for an out-of-scope submission -> 404 (not 403)
ok: DEC-175 out-of-scope evaluation probe is not 403 (existence-hiding, not authz-denial)
ok: progress reflects the main reviewer's full completion
ok: progress reflects the second reviewer's partial completion (laggard)
ok: remind sends only to the laggard reviewer
ok: remind writes an email_log row for the laggard, none for the completed reviewer
ok: results are sorted by weighted aggregate score descending
ok: results CSV downloads with a row per result (plus header)

review walkthrough: OK (all checks passed)
```

Note (environment, not a product bug): a concurrent sibling worktree
(`task-w3-e`) running its own gate in parallel executed a broad
`pkill -f "wrangler dev"` and its own `npm run dev` (default port 8787),
which collided with this task's first dev-server attempt on the shared
default port and produced a transient `ECONNRESET`/wrong-port failure
unrelated to the code under test. Re-run on an explicit non-default port
(`--port 18787`) with a freshly wiped `.wrangler/state`, re-migrated, and
re-seeded database produced the clean run recorded above.

## Part 2 verdict

Harness repair: **PASS**. `scripts/walkthrough/review.ts`'s `QueueItem`
interface and its one usage site now match the DEC-239 wire shape; typecheck
is clean; the module runs end-to-end against a freshly migrated + seeded
local wrangler dev instance with zero FAIL lines.
