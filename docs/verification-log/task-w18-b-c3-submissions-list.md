# task-w18-b: listSubmissions one paginated statement (DEC-333, DEC-335)

## Scope

- `src/server/repo/submissions/list.ts`: deleted the `allowedIds` candidate-id
  machinery, the `allowedIds.size > ID_CHUNK_SIZE` JS-pagination fallback, and
  the exported `sortSubmissionRows` JS sort mirror. `q` and `trackId` are now
  pushed into the `conditions` array as `or(...)` clauses (title LIKE / a
  correlated `exists` subquery against participant+contact for `q`; direct
  `eq(trackId)` / a correlated `exists` subquery against `submission_track`
  for `trackId`). `total` and the page are each a single SQL statement
  against that WHERE clause. Per-page enrichment (participants, tracks,
  answers) is unchanged — still chunked by `chunkIds`.
- `src/server/repo/submissions/query.ts`: added pure `likeContains(raw)` —
  lowercases, escapes `\`, `%`, `_` with a leading backslash, wraps in
  `%...%`.
- `orderByForSort` gained a `seq` tiebreaker on every branch (matching the
  branch's primary direction) so OFFSET paging is stable across ties.
- `src/server/repo/submissions.ts`: removed `sortSubmissionRows` from the
  barrel re-export.
- `test/api-submissions.test.ts`: deleted the `sortSubmissionRows` describe
  block and the `>ID_CHUNK_SIZE` batched-fallback describe block (dead code
  path, deleted). Added: unit tests for `likeContains` (lowercasing,
  escaping `%`, `_`, `\`, combined), and a fake-db test asserting a q+trackId
  call issues exactly 3 core queries (event-prefix lookup, count, page) plus
  2 enrichment batches (5 total `db.select()` calls), with `limit`/`offset`
  args captured on the page query.

## Commands run

```
cd chautauqua-wt/task-w18-b
npm run build                         # tsc x2 + vite build -> clean
npx vitest run test/api-submissions.test.ts   # 29/29 passed
npm test --silent                     # 226 files, 1886/1886 passed
npm run db:migrate                    # 17 migrations applied (idempotent)
npm run seed                          # seed script + seed.sql + seed-r2
npx wrangler dev --port 8796          # local dev server
```

## Live probe (organizer session, PORT 8796, seed_event_0001, 30 submissions)

Logged in as `sbek-organizer@example.com` (docs/fixtures/sample-data.json)
via GET /login (csrf token) + POST /login (form), then called
`/api/v1/events/seed_event_0001/submissions` with a session cookie.

- (a) `q=Raman` (speaker surname): total=2, items are the two submissions
  co-authored by Priya Raman — not a title match, proving the participant/
  contact EXISTS subquery works.
- (b) `q=Vector` (title word): total=1, "From Zero to Vector Databases: A
  Field Guide" — title LIKE branch works.
- (c) `trackId=seed_track_0001`: total=12 (narrows from 30). `trackId=seed_track_0001&q=Raman`:
  total=0 — the two Raman submissions from (a) are not in track 1, so the
  combined filter is a genuine AND/intersection, not an OR/union (a union
  would have returned >=12).
- (d) `page=1&perPage=5&sort=ref` vs `page=2&perPage=5&sort=ref`: both report
  total=30; page 1 = seed_submission_0001..0005, page 2 =
  seed_submission_0006..0010 — disjoint, same total, confirming
  limit/offset paging over the single statement.
- (e) `q=100%25` (i.e. literal `100%`): total=0 (of 30) — the `%` in the
  query string is escaped via `likeContains`'s `ESCAPE '\'` bind rather than
  being treated as a SQL wildcard, so it does not degrade to a match-
  everything `%...%` pattern. Strict subset (0 < 30) confirmed.

All five probe assertions passed.

## OPEN ITEMS: 0

## RESULT: PASS
