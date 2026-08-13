# task-w37-d — build+test+bundle, full transcript-level detail

Scope: DEC-068/DEC-069 evidence lane. `docs/verification-log.md`'s last dated
section (`## 2026-08-12 task-w25-f`) is eleven waves stale — nothing on main
currently carries a green full-suite receipt at the current sha. This task
re-runs the three sanctioned gates fresh, in this worktree, at its own sha,
and records the results verbatim. LOG-ONLY: nothing in product code was
touched or fixed as part of this run.

sha at time of run (worktree HEAD, branch `task-w37-d` off `main`):
`68289a92`

## 1. `npm run build`

Command: `tsc --noEmit && tsc --noEmit -p app/tsconfig.json && vite build --config app/vite.config.ts`

Result: exit 0, clean. Output tail:

```
✓ 220 modules transformed.
rendering chunks...
computing gzip size...
...
../public/admin/assets/index-Cofti4PN.js                  190.69 kB │ gzip: 62.06 kB
✓ built in 988ms
```

(Two `didn't resolve at build time` notices for `/fonts/FamiljenGrotesk-var.woff2`
and `/fonts/Figtree-var.woff2` are pre-existing vite warnings about runtime-
resolved static assets, not errors — build exits 0.)

RESULT: PASS

## 2. Full test suite via `scripts/with-test-lock.sh`

Command: `sh scripts/with-test-lock.sh npx vitest run` (the sanctioned
serialized full-suite entrypoint per DEC-068/DEC-069's predecessor lanes;
`npm test` and `npm run test:full` both route through this same script per
`package.json`).

Verbatim summary line from the run:

```
 Test Files  638 passed (638)
      Tests  6629 passed (6629)
   Start at  13:20:59
   Duration  127.34s (transform 4.95s, setup 5.27s, collect 88.10s, tests 56.80s, environment 18.98s, prepare 22.04s)
```

638 files / 6629 tests, 0 failures, 0 skipped. Includes the new
`test/decisions-parity.test.ts` (4 tests, part of this same task) passing
alongside the rest of the suite in this same run.

RESULT: PASS

## 3. `npm run bundle:check`

Command: `tsx scripts/bundle-check.ts`

Verbatim result line:

```
Entry bundle: index-Cofti4PN.js + index-l7CESiyf.css = 65.29 kB gzip (budget 300.00 kB)
bundle:check PASSED
```

65.29 kB gzip against the SPEC §7 300 KB budget — well under budget (~21.8%
of budget consumed).

RESULT: PASS

## OPEN ITEMS: 0

No red gates in this run. All three steps (build, full test suite via the
lock script, bundle check) are green at sha `68289a92`. This is a log-only
evidence lane; no product code was modified to make any of these three gates
pass — they were already green on `main` at this sha, they were simply
eleven waves un-re-verified.

RESULT: PASS
