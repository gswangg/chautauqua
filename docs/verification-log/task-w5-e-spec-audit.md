# task-w5-e — spec-audit gate detail

Re-run (DEC-096) SPEC §8/§9 static audit, code-frozen per DEC-077
(log-only lane), fresh worktree of `main` (branched from task-w5-a's
merge). Newest code-bearing short-sha per DEC-091: `3d1e838` ("merge
task-w5-a").

## Delta scope (`git diff 3878d4f..HEAD --stat`)

The diff against the last code-bearing gate sha (3878d4f) is larger than
"only the two script fixes" because it spans all of wave 4 (which also
landed between 3878d4f and this branch point), not just w5-a. Breaking it
down honestly:

- Code-bearing, in scope for DEC-094/095/096: `scripts/perf-smoke.ts`,
  `scripts/perf-smoke-lib.ts` (new), `scripts/walkthrough/scale.ts`,
  `test/perf-smoke.test.ts` — exactly the task-w5-a fix commit
  (`b638f75`).
- Bookkeeping (DEC-090 non-code-bearing): `decisions/DEC-090.md` through
  `DEC-096.md`, `src/decisions.ts` (7-line append, compile-checked
  constants for those same decisions — required by the repo's own
  "code depending on decision DEC-NNN must reference its constant"
  rule, not a functional change), `docs/eval-findings.md`,
  `docs/verification-log.md` + `docs/verification-log/*.md` (wave-3/4
  gate logs), `field-guide/index.md`.
- No other `src/`, `app/`, migration, or config file appears in the
  diff. Confirmed via `git diff 3878d4f..HEAD -- src/lib scripts/
  perf-seed-lib.ts src/routes`, which is empty.

This matches the task's expectation once wave-4's already-merged
bookkeeping is accounted for.

## SPEC §8/§9 checks (mirroring task-w3-e/w13-e/w15-e/w16-d)

- `README.md:19-22` quickstart (`npm i`, `db:migrate`, `seed`, `dev`)
  matches SPEC.md:361 verbatim.
- `README.md:34-62` "For evaluators" persona credentials
  (organizer/speaker/speaker2/reviewer rows) match
  `docs/fixtures/sample-data.json` `identities` block verbatim,
  byte-for-byte on email/password for all four personas.
- `.github/workflows/ci.yml`: `build-and-test` job (lines 13-24) runs
  `npm run build`, `npm run bundle:check`, `npm test`; `perf-smoke` job
  (lines 26-54) runs `npm run perf:smoke` against a migrated+seeded
  `wrangler dev`; `walkthrough` job (lines 57-84) runs `npm run
  walkthrough` — SPEC.md:367 "CI: typecheck + unit tests" plus the
  DEC-063 perf/walkthrough jobs both present, unchanged since w16-d.
- SPEC §9 four invariants still have passing regression tests, same
  locations as w3-e/w16-d: close-date lock / speaker isolation
  (`test/edit-lock.test.ts`, `test/submit-core.test.ts`), hidden-speaker
  exclusion (`test/task-file-access.test.ts`, `test/headshot-gate.test.ts`),
  decision-never-auto-emails (`test/spec9-invariants.test.ts`). All five
  files present and passing in the full run below.

## DEC-094/095 fix conformance

- **DEC-095 (scale.ts)**: `purgeRefreshProbe` (step 6) now parses the
  portal edit page for a checked `trackIds` checkbox
  (`editGetBody.match(/name="trackIds" value="([^"]+)"[^>]*checked/)`,
  scale.ts:472), falling back to the submit page's captured track id if
  none is found, then sets that value on the edit POST's FormData
  (scale.ts:487) before submitting — matching what a real browser would
  send for a single-checked track checkbox. Fail-loud: `fail(...)` if
  neither source yields a track id (scale.ts:474-476), no silent
  fallback to an empty/omitted field.
- **DEC-094 (perf-smoke.ts)**: `fetchAcceptedSubmissionIds` paginates at
  `PERF_MAX_PER_PAGE = 200` (perf-smoke.ts:159-186) via
  `planPerfPages(count, maxPerPage)` (perf-smoke-lib.ts:51-60, tested in
  test/perf-smoke.test.ts). The cap probe (perf-smoke.ts:204-206) fetches
  exactly 300 real accepted ids, appends one syntactically-valid
  nonexistent id (`sub_cap_probe_nonexistent_0001`), and asserts the
  `.ics` request with all 301 ids returns exactly 400
  (perf-smoke.ts:207-211) — the assertion itself is unchanged from the
  pre-fix version, only the id-collection strategy changed.
- **No-eval-gaming check**: confirmed no product file was modified to
  accommodate either probe. `git diff 3878d4f..HEAD -- src/lib
  scripts/perf-seed-lib.ts src/routes` is empty — `src/lib/pagination.ts`'s
  200-item clamp and `scripts/perf-seed-lib.ts`'s 300-accepted seed
  literal both stand exactly as ratified by DEC-094; the probes were
  adapted to the product's real contract, not the reverse.

## Build + test

`npm run build`: PASS (tsc x2 + vite build, no errors).

`npm test --silent`: ALL PASS — 94 test files, 976 tests, 0 failures
(5 more tests than task-w3-e's 971, from the new
`test/perf-smoke.test.ts` cases added by the DEC-094 fix commit; no
regressions). `test/edit-lock.test.ts`, `test/submit-core.test.ts`,
`test/task-file-access.test.ts`, `test/headshot-gate.test.ts`,
`test/spec9-invariants.test.ts` all present and green.

No product/test/script/config changes made in this lane (DEC-077
code-frozen gate); this commit touches only `docs/verification-log.md`
and this file.

OPEN ITEMS: 0

RESULT: PASS
