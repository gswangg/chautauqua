# task-w22-c: public list row ceiling (DEC-477, +DEC-453)

## Defect

SPEC.md:73-76 requires every list view to be designed for the top of the
200-800 speaker range. Before this change:

- `src/server/repo/public/bounds.ts:9` `MAX_PUBLIC_ROWS = 600`
- `src/routes/public/query.ts:10` `MAX_PUBLIC_PAGE = 50`
- `src/routes/public/shell.tsx:20` `PER_PAGE = 12`
- `50 * 12 = 600 = MAX_PUBLIC_ROWS` (both ceilings agreed, but at the wrong
  number) — at 800 speakers the last 200 were unreachable from
  `/e/:slug/speakers`, `/gallery`, and `/embed/*.json`, while `total` kept
  reporting 800.

## Fix

- `MAX_PUBLIC_PAGE` 50 -> 100 (`src/routes/public/query.ts`)
- `MAX_PUBLIC_ROWS` 600 -> 1200 (`src/server/repo/public/bounds.ts`),
  `100 * 12 = 1200`, which clears SPEC.md's 800.
- `hasMore` in `src/routes/public/sessions.tsx` and
  `src/routes/public/speakers.tsx` (both `SpeakersContent` and
  `GalleryContent`) now also tests `items.length < MAX_PUBLIC_ROWS` /
  `speakers.length < MAX_PUBLIC_ROWS`, not just `page < MAX_PUBLIC_PAGE` —
  a `?limit=100` embed (`src/routes/public/dispatch.tsx:29`) can hit the row
  ceiling by page 12, long before the page ceiling bites, and would
  otherwise link to a page identical to its own (DEC-433's own rule).
- Added `test/public-row-ceiling.test.ts`: a drift guard
  (`MAX_PUBLIC_PAGE * PER_PAGE === MAX_PUBLIC_ROWS`) plus `hasMore`-at-the-
  ceiling checks for `SessionsContent`, `SpeakersContent`, and
  `GalleryContent` (present at `MAX_PUBLIC_ROWS - 1` of 2000, absent at
  `MAX_PUBLIC_ROWS` of 2000).
- Updated `test/public-bounds.test.ts`, `test/public-speakers-pagination.test.ts`,
  and `test/public-sessions-pagination.test.ts`, which asserted the old
  600 row ceiling, to assert 1200.
- Added a new perf-smoke check "public speakers page at row ceiling"
  (`scripts/perf-smoke.ts`) hitting `/e/${PERF_EVENT_SLUG}/speakers?page=100`
  — the deepest reachable page at the new ceiling — in the same `public`
  budget class as the existing "public speakers page" check.

## Measurement (DEC-448/DEC-453 — measured, not asserted from code presence)

Commands run, in order, from the worktree
`/Users/wednesdayniemeyer/Documents/gniemeyer/Projects/chautauqua-wt/task-w22-c`:

```
npm run db:migrate
npm run seed
npm run perf:seed
npm run dev -- --port 8822        # backgrounded
PERF_URL=http://localhost:8822 npm run perf:smoke
```

Raw `perf:smoke` output (full run, all checks):

```
p95 over 30 measured iterations (overhead floor: 3.3ms, raw ceiling: 150ms):

  submissions list (page 1)                 raw=    12.6ms  floor=   3.3ms  adjusted=     9.3ms  budget(read)=50ms  PASS
  submissions list (q=Kubernetes)           raw=    17.8ms  floor=   3.3ms  adjusted=    14.5ms  budget(read)=50ms  PASS
  submission detail                         raw=    20.1ms  floor=   3.3ms  adjusted=    16.8ms  budget(read)=50ms  PASS
  event overview                            raw=    47.9ms  floor=   3.3ms  adjusted=    44.6ms  budget(read)=50ms  PASS
  organizer agenda (300 accepted)           raw=    34.4ms  floor=   3.3ms  adjusted=    31.1ms  budget(read)=50ms  PASS
  public sessions page                      raw=     5.8ms  floor=   3.3ms  adjusted=     2.5ms  budget(public)=150ms  PASS
  public agenda                             raw=    10.4ms  floor=   3.3ms  adjusted=     7.1ms  budget(public)=150ms  PASS
  schedule.ics 150 ids                      raw=    51.6ms  floor=   3.3ms  adjusted=    48.3ms  budget(public)=150ms  PASS
  public speakers page                      raw=     4.6ms  floor=   3.3ms  adjusted=     1.3ms  budget(public)=150ms  PASS
  public speakers page at row ceiling       raw=     7.1ms  floor=   3.3ms  adjusted=     3.7ms  budget(public)=150ms  PASS
  public gallery page                       raw=     4.5ms  floor=   3.3ms  adjusted=     1.2ms  budget(public)=150ms  PASS
  public schedule page                      raw=     8.8ms  floor=   3.3ms  adjusted=     5.5ms  budget(public)=150ms  PASS
  agenda.ics                                raw=     7.7ms  floor=   3.3ms  adjusted=     4.3ms  budget(public)=150ms  PASS
  schedule.ics (bare, whole agenda)         raw=     4.0ms  floor=   3.3ms  adjusted=     0.7ms  budget(public)=150ms  PASS
  plan progress (12 reviewers)              raw=    25.2ms  floor=   3.3ms  adjusted=    21.9ms  budget(read)=50ms  PASS
  contacts list (q=perf)                    raw=     5.5ms  floor=   3.3ms  adjusted=     2.2ms  budget(read)=50ms  PASS
  rating PUT                                raw=    10.4ms  floor=   3.3ms  adjusted=     7.1ms  budget(write)=100ms  PASS
  onboarding grid (800 speakers x 5 tasks)  raw=    11.8ms  floor=   3.3ms  adjusted=     8.5ms  budget(read)=50ms  PASS
  reviewer queue                            raw=    16.5ms  floor=   3.3ms  adjusted=    13.2ms  budget(read)=50ms  PASS
  email log list (page 1)                   raw=     6.7ms  floor=   3.3ms  adjusted=     3.3ms  budget(read)=50ms  PASS
  files library (page 1)                    raw=    26.6ms  floor=   3.3ms  adjusted=    23.3ms  budget(read)=50ms  PASS
  plan results (page 1)                     raw=    33.9ms  floor=   3.3ms  adjusted=    30.6ms  budget(read)=50ms  PASS
  pipeline list (page 1)                    raw=    20.0ms  floor=   3.3ms  adjusted=    16.7ms  budget(read)=50ms  PASS
  org users list (page 1)                   raw=    15.1ms  floor=   3.3ms  adjusted=    11.8ms  budget(read)=50ms  PASS

perf:smoke OK
```

The new "public speakers page at row ceiling" row (deepest reachable public
speakers page, `?page=100`, at the new `MAX_PUBLIC_ROWS = 1200` / `MAX_PUBLIC_PAGE
= 100` ceiling): **raw p95 = 7.1ms, adjusted p95 = 3.7ms**, against the
`public` class budget of 150ms — well under budget, no need to invoke step 5
(lowering the ceiling).

## Result

MAX_PUBLIC_ROWS = 1200 / MAX_PUBLIC_PAGE = 100 stands as measured; no
reduction needed. Full test suite (`npm test --silent`) after the change:
295 test files, 2684 tests, all passed. `npm run build` clean.
