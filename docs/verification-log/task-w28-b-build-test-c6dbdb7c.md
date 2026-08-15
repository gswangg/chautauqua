# task-w28-b — build + full test suite + bundle gate @ c6dbdb7c

QUALIFYING full-suite run for wave 28. Sole full-suite runner this wave
per task charter (DEC-069 wave-28 amendment, DEC-129).

`git -C <worktree> rev-parse HEAD` recorded FIRST, before any other
command: `c6dbdb7cc615248d1a49485d63320570168f4c7b` (main tip at cut,
"scribe wave 28"). All grading below is against this literal.

## 1. `npm run build`

Command: `npm run build` (= `tsc --noEmit && tsc --noEmit -p
app/tsconfig.json && vite build --config app/vite.config.ts`)

Exit code: 0.

tsc error count (root + app, both invocations): 0.

vite: `✓ 276 modules transformed.` ... `✓ built in 1.14s` (repeat run:
`1.15s`). Two benign font-resolution notices for
`/fonts/FamiljenGrotesk-var.woff2` and `/fonts/Figtree-var.woff2` ("didn't
resolve at build time, it will remain unchanged to be resolved at
runtime") — pre-existing runtime-resolved asset pattern, not an error.

## 2. Full suite, exclusively through the lock

Command: `sh scripts/with-test-lock.sh npx vitest run`

Exit code: 0.

```
Test Files  1061 passed (1061)
     Tests  11745 passed (11745)
  Start at  13:26:10
  Duration  228.32s (transform 8.37s, setup 8.26s, collect 153.76s,
                      tests 119.83s, environment 29.50s, prepare 38.11s)
```

No skipped, no failing files, no failing tests. Ran once, straight
through the lock — no contention encountered, no selective re-run.

Notable: `test/spa-mutation-contract.scan.test.ts` is part of this green
1061/1061 — the wave-16-era red scan (`expect(gaps).toEqual([])` at
`:560`) remains GREEN at this tip, consistent with task-w27-b's finding
that wave-26 lane c's fix holds.

## 3. `npm run bundle:check`

Command: `npm run bundle:check` (= `tsx scripts/bundle-check.ts`)

Exit code: 0.

```
Entry bundle: index-BhPrbvpM.js + index-DpG2gFFa.css = 69.19 kB gzip
(budget 300.00 kB)
bundle:check PASSED
```

69.19 kB gzip against the SPEC §7 300 kB budget — well within budget
(230.81 kB headroom).

## Summary

All three qualifying checks (build, full test suite via lock, bundle
gate) PASS clean at `c6dbdb7c`. No fix-up performed; this is a
measurement-only lane per DEC-453 (a gate that repairs the product
cannot report on the sha it measured).

OPEN ITEMS: 0
