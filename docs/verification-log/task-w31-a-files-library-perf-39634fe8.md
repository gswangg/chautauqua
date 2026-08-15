# task-w31-a: TIER-0 PERF — files library headshot join predicate

Branch `task-w31-a`, tip `39634fe8`. SOLE OWNER of
`src/server/repo/files-library.ts`. Constrained by DEC-773 (wave-29 AND
wave-31 amendments), DEC-347 (wave-31), DEC-829.

## Diagnosis confirmed

`HEADSHOT_JOIN` at `src/server/repo/files-library.ts:215` (pre-fix) was:

```
const HEADSHOT_JOIN = sql`${schema.contact.headshotUrl} = '/headshots/' || ${schema.file.id}`;
```

`file.id` sat inside a concatenation on the right-hand side of the equals,
so no SQLite planner could drive `file` by its primary key. With
`participant ⋈ submission ⋈ contact` as the outer relation, this is a full
nested-loop scan of `file` per outer row, executed at all three call sites:
`computeKindCounts` (:266-274 pre-fix), `listEventDeliverableFiles`'s
headshot branch (:356-372), and `resolveHeadshotVersions` (:558-573) — the
first two both run on every page-1 request.

## Fix applied (DEC-773 wave-31 amendment, option 3b)

Single shared `HEADSHOT_JOIN` constant rewritten so the indexed column
stands alone, plus an explicit prefix guard to preserve exact equivalence
with the old concatenated form:

```
const HEADSHOT_JOIN = sql`${schema.file.id} = substr(${schema.contact.headshotUrl}, 12) and substr(${schema.contact.headshotUrl}, 1, 11) = '/headshots/'`;
```

All three call sites reference this one constant, so all three moved
together. No migration added; `migrations/0040_headshot_file_id.sql` was
NOT created (3b was measured sufficient — see below). No change to the
`EventDeliverableChainPage` envelope, the deliverables-before-headshots
merge order / tie-break (:419-425), the dedupe-by-file-id rule (:382-387),
any `MAX_FILE_LIBRARY_SCAN` refusal, or DEC-902's kindCounts independence
from the selected kind.

## Tests

- `test/files-library-headshot-join.scan.test.ts` (new): (a) a source scan
  asserting the concatenated `'/headshots/' ||` predicate never reappears
  in `files-library.ts`; (b) behavioural coverage over a REAL in-memory
  SQLite engine (`node:sqlite` + `drizzle-orm/sqlite-proxy`, same technique
  as `test/cross-org-file-bytes-probe.test.ts`) proving (i) a headshot file
  resolves to exactly one row, and (ii) a contact whose `headshot_url` is
  shaped like `<11 arbitrary chars><real file id>` — i.e. NOT
  `/headshots/<id>` — never matches, proving the prefix guard is
  load-bearing and not decorative.
- Updated the fake-DB join-predicate evaluators in
  `test/files-library.test.ts`, `test/files-headshots.test.ts`,
  `test/task-upload-content.test.ts`, and
  `test/participant-reader-declined-exclusion.test.ts` to match the
  rewritten predicate's shape (file.id referenced once, contact.headshotUrl
  referenced twice) — these suites mock `drizzle-orm`'s `sql` join
  conditions structurally and were asserting the OLD `... || file.id`
  shape.

Targeted run: `npx vitest related src/server/repo/files-library.ts --run`
→ 229 test files / 1625 tests passed. Full `npm run build` green.

## Measurement (DEC-347 wave-31 amendment: paired before/after, port 8894)

Setup performed once: `npx tsx scripts/ensure-dev-vars.ts` (then manually
set `PUBLIC_BASE_URL=http://localhost:8894` in the gitignored `.dev.vars`),
`npx vite build --config app/vite.config.ts`, `npm run db:migrate`,
`npm run seed`, `npm run perf:seed`.

**BEFORE** (branch point, pre-fix code via `git stash`), `wrangler dev
--port 8894`, `PERF_URL=http://localhost:8894 npm run perf:smoke`:

```
files library (page 1)   raw=485.4ms  floor=4.3ms  adjusted=481.1ms  budget(read)=50ms  FAIL
    raw p95 485.4ms exceeds 150ms ceiling; adjusted p95 481.1ms exceeds read class budget 50ms
```

Matches the last full receipt's numbers
(`docs/verification-log/task-w28-c-perf-smoke-c6dbdb7c.md:72-73`: raw
484.4ms / adjusted 481.5ms) within run-to-run noise, confirming this lane
started from the same unfixed state.

**AFTER** (fix restored via `git stash pop`, worker code picked up live by
`wrangler dev`'s bundler — no rebuild step needed for server code; `npm run
perf:seed` re-run first to reset the perf fixture's mutated-by-writes state
left over from the BEFORE run's write checks), same `wrangler dev --port
8894`, same `perf:smoke`:

```
files library (page 1)   raw=20.3ms  floor=3.0ms  adjusted=17.3ms  budget(read)=50ms  PASS
```

**Ratio**: raw 485.4ms → 20.3ms (~23.9x reduction); adjusted 481.1ms →
17.3ms (~27.8x reduction). The row now PASSes its 50ms read-class budget
with comfortable margin.

Sibling lanes (w31-b/c/d) were running concurrently on this machine during
both BEFORE and AFTER runs (confirmed via `ps aux` showing a
`task-w31-b`-scoped `wrangler d1 execute` process mid-run), so both
absolutes are load-inflated by an unrecordable, shared amount — the DELTA
above is the grade, per DEC-347's wave-31 amendment. `wrangler dev` was
killed and port 8894 confirmed free after each measurement pass.

## Other rows (out of scope for this lane)

`reviewer queue` (adjusted 55.9ms, budget 50ms) and `plan results (page 1)`
(adjusted 70.7ms, budget 50ms) both still FAIL in the AFTER run — these are
declared-overlap rows owned by sibling w31 lanes (w31-b/c/d per the task
brief), unrelated to `files-library.ts`, and untouched by this change.

## Open items

None for this fix's own scope. DEC-773 wave-29's clause (1) (SQL-aggregate
`total`/`totalSizeBytes` instead of the JS chain walk at :331-351/:392-399)
was NOT applied — the headshot-join fix alone brought the row from 481ms
to 17.3ms adjusted, well under the 50ms budget, so per the task's own
ordering ("only if the row is STILL over budget after the headshot branch
is fixed") that further change was not needed and was not made.
