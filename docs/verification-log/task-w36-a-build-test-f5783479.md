# task-w36-a — build+test+bundle gate @ f5783479

QUALIFYING (DEC-069 required section 1, DEC-644 wave-36 boundary).
FROZEN-PRODUCT lane: wrote only under docs/; touched no src/, app/src/,
migrations/, package.json, test/, or scripts/ file.

## 1. Boundary (DEC-644 wave-36)

- `git rev-parse HEAD` (this lane's tip, task-w36-a):
  `f5783479c7a1b8c96ef1506c3cfff1661fd6e338`
- `git log --first-parent -1 --format=%H -- src/ app/src/ migrations/ package.json`
  (newest product-bearing sha on the first-parent line):
  `3a041507287b2dca3abeda3e0648a41ddeba9707`
- Every live ref matching `task-w3*` in `git for-each-ref refs/heads`
  (excludes task-w17-i, task-w68-*, task-w71-*, task-w72-* — none match
  the `task-w3*` glob), each checked with
  `git merge-base --is-ancestor <ref> HEAD`:
  - `task-w35-a`: exit 0 -> ANCESTOR
  - `task-w35-e`: exit 0 -> ANCESTOR
  - `task-w35-f`: exit 0 -> ANCESTOR
  - `task-w36-a`: exit 0 -> ANCESTOR (self, trivial)

## 2. Build

`npm run build` (`tsc --noEmit && tsc --noEmit -p app/tsconfig.json &&
vite build --config app/vite.config.ts`): clean. Worker and app both
type-check with no errors. Vite build emitted 276 transformed modules,
finished in 1.17s, no errors (two expected font-asset resolution notices
for `/fonts/FamiljenGrotesk-var.woff2` and `/fonts/Figtree-var.woff2`,
which resolve at runtime, not build time — pre-existing, non-fatal).

## 3. Full test suite

Entrypoint: `sh scripts/with-test-lock.sh npx vitest run` (sanctioned
full-run entrypoint per test policy for a verification lane).

Verbatim summary:

```
 Test Files  1084 passed (1084)
      Tests  11898 passed (11898)
   Start at  16:17:34
   Duration  223.09s (transform 8.01s, setup 7.89s, collect 148.34s, tests 119.09s, environment 29.22s, prepare 37.15s)
```

No failures. All stderr/stdout noise observed during the run
(`test/scheduled-isolation.test.ts`'s deliberate job-failure logging,
`test/html-error-shape.test.ts`'s deliberate unhandled-error logging) is
expected test-fixture output from tests that assert on that exact
behavior (DEC-812 job isolation, DEC-841 HTML-vs-API error shape), not a
failure signal.

## 4. Bundle check

`npm run bundle:check`:

```
Entry bundle: index-9Qx35kD0.js + index-DpG2gFFa.css = 69.20 kB gzip (budget 300.00 kB)
bundle:check PASSED
```

69.20 kB gzip against the SPEC §7 300.00 kB budget — well within budget
(23% of budget consumed).

## 5. Failures filed

None. Build, full test suite, and bundle check all passed cleanly at
this boundary; there is nothing to file.

RESULT: PASS (build clean, 1084/1084 test files and 11898/11898 tests
green, bundle 69.20 kB gzip vs 300 kB budget) at f5783479, with all
three live w3*-glob sibling refs (task-w35-a, task-w35-e, task-w35-f)
confirmed ANCESTOR.
OPEN ITEMS: 0
