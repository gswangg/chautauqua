# task-w4-a — build+test @ c211d4c

Frozen product sha S = `c211d4c02bb49c9d01f0730b9d8788c156d3a459` ("merge task-w3-d").

## STEP 0 — DEC-250 freeze check

```
$ git -C /Users/wednesdayniemeyer/Documents/gniemeyer/Projects/chautauqua log --stat c211d4c02bb49c9d01f0730b9d8788c156d3a459..origin/main
(no output — merge-base(c211d4c, origin/main) == origin/main, i.e. origin/main
is an ANCESTOR of c211d4c, not ahead of it; zero commits reachable from
origin/main that aren't already in c211d4c's ancestry)

$ git -C /Users/wednesdayniemeyer/Documents/gniemeyer/Projects/chautauqua log --stat c211d4c02bb49c9d01f0730b9d8788c156d3a459..main
commit 93a16b6c99679326df90b299039892c23fc4606f
    scribe wave 4

 decisions/DEC-250.md |  3 ++
 decisions/DEC-251.md |  3 ++
 field-guide/index.md | 80 ++++++++++++++++++++++++++--------------------------
 src/decisions.ts     |  2 ++
 4 files changed, 48 insertions(+), 40 deletions(-)
```

Local `main` has exactly one commit after S (93a16b6, "scribe wave 4"),
touching only `decisions/`, `field-guide/`, and `src/decisions.ts` — all
allow-listed by DEC-250. `origin/main` is not ahead of S at all (it is an
ancestor). No product-path drift detected. Freeze check: PASS.

## STEP 1 — fresh detached worktree at S

Worktree: `/Users/wednesdayniemeyer/Documents/gniemeyer/Projects/chautauqua-wt/task-w4-a-verify`
(detached HEAD at c211d4c02bb49c9d01f0730b9d8788c156d3a459).

### npm ci

```
$ npm ci --prefer-offline --no-audit --no-fund
added 423 packages in 2s
```

### npm run build (tsc --noEmit ×2 + vite build)

```
$ npm run build
> tsc --noEmit && tsc --noEmit -p app/tsconfig.json && vite build --config app/vite.config.ts

vite v6.4.3 building for production...
transforming...
✓ 133 modules transformed.
rendering chunks...
computing gzip size...
20 output files (1 html, 1 css, 18 js chunks) written to ../public/admin
✓ built in 779ms
```

Both `tsc --noEmit` passes (root + `app/tsconfig.json`) completed with no
errors (no output = clean). Vite build: 133 modules transformed, 20 output
files (index.html + index CSS chunk + 18 JS chunks). Largest chunk
`index-BODoIhSY.js` at 180.16 kB raw / 58.90 kB gzip.

### npm test (vitest run)

```
$ npm test --silent
 Test Files  184 passed (184)
      Tests  1573 passed (1573)
   Start at  10:08:46
   Duration  15.36s
```

184 files / 1573 tests, all green. This is above the wave-2 baseline
(180 files / 1517 tests) and consistent with wave-3 additions.

Two suites intentionally print to stderr as part of asserting DEC-238
best-effort mailer-failure behavior (mailer throws are caught and
reported, not raised) — not test failures, both suites pass:

- `test/tasks-remind-now-mailer-failure.test.ts` (1 test, passed) — logs
  `reminder email failed for bad@example.com Error: simulated provider
  rejection`
- `test/users-create-mailer-failure.test.ts` (1 test, passed) — logs
  `account-creation welcome email failed (account still created): Error:
  simulated provider outage`

No React act()/console.error warnings beyond the expected React Router
v7 future-flag deprecation notices (benign, framework-level, present in
render-smoke tests across pages/*.render.test.tsx).

### npm run bundle:check (300 kB gzip budget)

```
$ npm run bundle:check
> tsx scripts/bundle-check.ts

Entry bundle: index-BODoIhSY.js + index-easpJsYc.css = 58.86 kB gzip (budget 300.00 kB)
bundle:check PASSED
```

Entry bundle (index JS + index CSS) = 58.86 kB gzip, well under the
300 kB budget. Largest non-entry chunk is `Contacts-DLups3lO.js` at
8.96 kB gzip.

## Summary

| Check | Result |
| --- | --- |
| DEC-250 freeze (no post-S product drift) | PASS |
| npm ci | PASS (423 packages) |
| npm run build (tsc ×2 + vite) | PASS (133 modules, 20 output files) |
| npm test (vitest run) | PASS (184 files / 1573 tests) |
| npm run bundle:check | PASS (58.86 kB / 300 kB gzip budget) |

OPEN ITEMS: 0
RESULT: PASS
