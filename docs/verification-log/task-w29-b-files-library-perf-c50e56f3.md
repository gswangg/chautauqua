# task-w29-b — files library perf fix @ c50e56f3

Worktree `/Users/wednesdayniemeyer/Documents/gniemeyer/Projects/chautauqua-wt/task-w29-b`,
branch `task-w29-b`, base `main`. Sole edits: `src/server/repo/files-library.ts`
plus (per DEC-773's sanctioned FK-fix clause) `src/db/schema/org.ts`,
`migrations/0040_contact_headshot_file_id.sql`,
`src/server/repo/profile.ts`'s `setContactHeadshot`,
`src/server/repo/contacts/merge.ts`'s merge write, and
`scripts/seed.ts`'s demo headshot seeding — everywhere `contact.headshot_url`
is written, kept in sync with the new `headshot_file_id` FK.

## 1. Instrument first (DEC-773 wave-29 amendment)

Added temporary `console.error` timers around the four passes
(`computeKindCounts`, deliverable-roots, `loadDeliverableChains`,
headshot-roots) in `listEventDeliverableFiles`, ran `npm run seed` then
`npm run perf:seed`, `wrangler dev --port 8892 --local`, and
`PERF_URL=http://localhost:8892 npm run perf:smoke` (default profile,
event=perf-2k, 2000 submissions, 800 contacts). Captured from the
`wrangler dev` log across the 30 measured `files library (page 1)` calls
(stable across iterations):

| pass | time |
|---|---|
| `computeKindCounts` (total) | ~440-472ms |
| &nbsp;&nbsp;`computeKindCounts`/deliverableGroups (`group by kind`) | ~0-1ms |
| &nbsp;&nbsp;`computeKindCounts`/headshotCount (`count(distinct file.id)`, old `HEADSHOT_JOIN`) | **~452-471ms** |
| deliverable-roots (bounded root scan) | ~3-5ms |
| `loadDeliverableChains` (eager, over ALL matching submissionIds) | ~6-10ms |
| headshot-roots (selectDistinct, same old `HEADSHOT_JOIN`) | ~2-8ms |

**Finding contradicts the task's stated diagnosis.** The task description's
CAUSE (`loadDeliverableChains` materializing every file row of every
matching submission, defeating DEC-344) measured 6-10ms — cheap, not the
bottleneck. The actual dominant cost (~92% of the read) was
`computeKindCounts`'s headshot `count(distinct file.id)` aggregate, driven
by the old `HEADSHOT_JOIN` predicate:
`contact.headshot_url = '/headshots/' || file.id` — a join condition built
from a per-row string concatenation, which no index can serve (forces a
scan/nested-loop over the contact×file cross product for every request).
Interestingly the SAME predicate, reused verbatim by the headshot-roots
list query later in the same function, measured only 2-8ms there — almost
certainly SQLite's local page cache already warm from the first (identical
shape) scan a few statements earlier in the same request; this does not
change that the predicate itself is unindexable and the numbers would not
hold under concurrent/cold-cache load or a colder page cache generally.

Per DEC-773's wave-29 amendment ("ONLY IF your timings show the headshot
branch dominant, apply the sanctioned FK fix"): the timings clearly show
the headshot branch dominant, so step 3 (the FK fix) was applied in
addition to step 2 (the totalSizeBytes aggregate, done regardless since it
was explicitly mandated and closes a real DEC-344 bounded-cost gap even
though it wasn't this seed's dominant cost).

## 2. totalSizeBytes: chain-tip SQL aggregate, no chain materialization

`loadDeliverableChains(db, submissionIds)` was previously called eagerly
over **every** matching `deliverableRoots`' `submissionId` (not just the
current page) purely so `totalSizeBytes` could sum each chain's latest
version's `sizeBytes` in JS. Replaced with one SQL aggregate
(`buildDeliverableTipWhere`): the same event/kind/q predicates
`buildDeliverableWhere` composes, swapping the chain-ROOT test
(`previous_file_id IS NULL`) for a chain-TIP test
(`not exists (select 1 from file s where s.previous_file_id = f.id)`) and
summing `sizeBytes` server-side. `kind` is invariant across a chain
(enforced by the DEC-020 version-chain rule in `files-versions.ts`'s
`getReplacesTarget`), so filtering the tip's kind is equivalent to
filtering the root's.

`loadDeliverableChains` is now called exactly once, AFTER the page is
computed, scoped to only the page's own submissions — matching the
DEC-344 bounded-cost rule the module's own doc comment claims (previously
violated for this one path, as the module's `:296-306` comment already
admitted).

`total` was left as the existing bounded root-scan length
(`deliverableRoots.length + headshotRoots.length`) — already cheap (3-8ms
measured) and already enforces `MAX_FILE_LIBRARY_SCAN` via the root
query's own `.limit(MAX_FILE_LIBRARY_SCAN + 1)` + throw, which the HARD
CONTRACT requires to survive unchanged. Re-deriving `total` from a second
aggregate query would have been redundant (both a root-count and a
tip-count agree, since each chain has exactly one root and one tip) and
adds a query for no measured benefit.

## 3. Headshot join: contact.headshot_file_id FK

- `src/db/schema/org.ts`: `contact.headshotFileId` (nullable text),
  indexed (`contact_headshot_file_id_idx`).
- `migrations/0040_contact_headshot_file_id.sql`: adds the column, the
  index, and backfills every existing `/headshots/<fileId>` row via
  `substr`.
- `HEADSHOT_JOIN` in `files-library.ts` is now
  `eq(schema.contact.headshotFileId, schema.file.id)` — a plain indexable
  equality, used identically at all three of its call sites
  (`computeKindCounts`'s headshot count, `listEventDeliverableFiles`'s
  headshot-roots list, `resolveHeadshotVersions`).
- `buildHeadshotWhere`'s existence filter moved from
  `isNotNull(contact.headshotUrl)` to `isNotNull(contact.headshotFileId)`
  (the new join key).
- Kept in sync everywhere `headshot_url` is written, so the FK never
  drifts stale: `profile.ts`'s `setContactHeadshot` (the creation path),
  `contacts/merge.ts`'s merge write (re-derives `headshotFileId` from
  whichever `headshotUrl` `planMerge` kept, via the same
  `/headshots/<fileId>` parse the migration's backfill uses — merge writes
  `headshotUrl` directly rather than through `setContactHeadshot`, so it
  needed its own mirror write or the FK would silently go stale on every
  contact merge), and `scripts/seed.ts`'s demo headshot seeding (the one
  production `UPDATE contact SET headshot_url = ...` outside
  `setContactHeadshot`). `headshot_url` itself and
  `profile.ts`'s `getHeadshotServeScope` (an unrelated reverse
  `headshot_url` equality lookup for the served-file route) are untouched
  — serve/authz behavior is unchanged, per the HARD CONTRACT.

## 4. Before/after — `PERF_URL=http://localhost:8892 npm run perf:smoke` (default profile)

Setup each run: `npm run seed`, `npm run perf:seed`,
`npx wrangler dev --port 8892 --local`, `perf:smoke`, then killed the
server.

**Before** (this task's own baseline measurement, `c50e56f3`'s parent tree,
matches the `ceda66f2` receipt at `docs/verification-log.md:3750-3759`
within noise):

```
files library (page 1)   raw=466.1ms  floor=2.1ms  adjusted=463.9ms  budget(read)=50ms  FAIL
    raw p95 466.1ms exceeds 150ms ceiling; adjusted p95 463.9ms exceeds read class budget 50ms
```

**After** (`c50e56f3`, this task's fix):

```
files library (page 1)   raw=17.7ms  floor=4.7ms  adjusted=13.0ms  budget(read)=50ms  PASS
```

`files library (page 1)` now PASSes both the 150ms raw ceiling and the
50ms read-class budget — from the worst read in the harness (raw ~3.1x
over ceiling) to comfortably under budget.

Remaining FAILs in the same `perf:smoke` run (`onboarding grid`,
`reviewer queue`, `plan results`) are pre-existing, own by other
DEC-829/773-adjacent tasks per the field guide, and out of this task's
`files-library.ts`-scoped ownership — untouched here.

## 5. Tests

`npx vitest related src/server/repo/files-library.ts` plus every existing
`test/*files-library*`/`test/*file-version*`/`test/*archive*`: 227 test
files / 1613 tests, all green (`npm run build` also green, strict
`tsc --noEmit` both root and `app/`).

Adding `contact.headshot_file_id` (any schema column addition) rippled
into every test file that hand-rolls the `contact` table (raw sqlite DDL:
23 files) or a fake-db column/join-shape (the four `files-library.ts`
fake-DB test files) — all updated in the same commit; see the commit body
for the full list and the fake-DB NOT-EXISTS/SUM-aggregate support added
to evaluate `buildDeliverableTipWhere` structurally.

## QUALIFYING

INVALIDATED BY: src/server/repo/files-library.ts, src/db/schema/**, migrations/**
