# task-w13-a - build-test @ f6983e6

FROZEN SHA: f6983e66a51d23e88931ce45dac6d0374a3d5463
WAVE-12 GATE: PASS (W1-W7 all anchors present)
DRIZZLE-ORM AT S: ^0.45.2
OPEN ITEMS: 0
RESULT: PASS
RECHECK SHA: f6983e66a51d23e88931ce45dac6d0374a3d5463 (no post-S delta; recheck not needed)

## WAVE-12 CONTENT GATE (DEC-314)

| Anchor | Target | Match |
|---|---|---|
| W1a | package.json contains `"drizzle-orm": "^0.45.2"` | 1 match (line 20) |
| W1b | package.json contains NO `drizzle-kit` | 0 matches |
| W1c | drizzle.config.ts does not exist | confirmed absent (`ls` -> No such file) |
| W2a | scripts/perf-smoke-lib.ts contains `PERF_CLASS_BUDGET_MS` and `gradePerfCheck` | 3 matches (lines 18, 24, 80/87) |
| W2b | scripts/perf-smoke.ts contains `measureOverheadFloor` and `cls: "public"` | 5 matches (lines 210, 216, 226, 324, 329, 336) |
| W3a | src/server/repo/public.ts exports `getPublicAgendaByIds` | 1 match (line 768) |
| W3b | src/routes/public/index.tsx calls `getPublicAgendaByIds` | 3 matches (lines 22, 192, 197) |
| W4 | src/routes/dev/mailbox.tsx contains `<meta name="viewport"` | 2 matches (lines 44, 92) |
| W5 | scripts/render-sweep.ts contains `/docs/api` and `/dev/mailbox` paths | 2 matches (lines 80, 81) |
| W6 | src/server/repo/tasks.ts contains `ACTIVE_INVITE_STATUSES` | 3 matches (lines 14, 353, 365) |
| W7 | src/routes/review/index.ts exists; src/routes/review.ts does not | confirmed (index.ts present, flat review.ts absent) |

All 7 anchors resolved at S on first read — no retries needed. WAVE-12 GATE: PASS.

## (1) Clean install — `rm -rf node_modules && npm ci --prefer-offline --no-fund`

```
added 366 packages, and audited 367 packages in 2s

4 vulnerabilities (2 moderate, 2 high)

To address all issues, run:
  npm audit fix

Run `npm audit` for details.
```

Real clean install succeeded (DEC-308 lockfile rewrite verified installable). The 4 vulnerabilities are addressed under items (4)/(5) below.

## (2) `npm run build` — dual tsc --noEmit (root + app/) then vite build

```
> build
> tsc --noEmit && tsc --noEmit -p app/tsconfig.json && vite build --config app/vite.config.ts

vite v6.4.3 building for production...
transforming...
✓ 138 modules transformed.
rendering chunks...
computing gzip size...
../public/admin/index.html                                 0.41 kB │ gzip:  0.27 kB
../public/admin/assets/index-easpJsYc.css                  4.59 kB │ gzip:  1.38 kB
[... 18 more chunk lines ...]
../public/admin/assets/index-Cre-ehTW.js                 180.20 kB │ gzip: 58.92 kB
✓ built in 695ms
```

Both `tsc --noEmit` invocations (root tsconfig.json, app/tsconfig.json) exited 0 with no diagnostics before vite ran (the `&&` chain would have stopped otherwise). Vite transformed 138 modules and wrote `public/admin/index.html` + `public/admin/assets/*` (verified present via `ls public/admin`). This repo's app is an admin SPA only — there is no separate `public/` (non-admin) build target in app/vite.config.ts, so `public/admin` being written is the full expected output.

## (3) `npm test`

```
 Test Files  219 passed (219)
      Tests  1847 passed (1847)
   Start at  14:58:45
   Duration  24.94s (transform 5.12s, setup 0ms, collect 69.87s, tests 30.34s, environment 17.15s, prepare 17.60s)
```

219 files / 1847 tests, all passed, 0 skipped, 0 failed. (React Router future-flag `console.warn` lines from React Router v6 are informational only, not failures.)

## (4) `npm audit --omit=dev` (DEC-308 requirement)

```
found 0 vulnerabilities
```

MUST print exactly this per DEC-308 — confirmed, exit 0.

## (5) `npm audit` (dev included, for the record — DEC-302)

```
4 vulnerabilities (2 moderate, 2 high)
```

Advisories: `form-data` (high, CRLF injection), `lodash` (high, prototype pollution / code injection x3), `react-router`/`react-router-dom` (moderate, open redirect + SSR hydration constructor injection). Verified all 4 are devDependency-only: `package.json` places `react-router-dom` under `"devDependencies"` (line 35); `form-data` and `lodash` are transitive dev-only deps (not present anywhere in `dependencies`, and `npm audit --omit=dev` above shows 0). Per DEC-302, devDependency-only advisories are NOT open items. Count: 4 (0 counted as open items).

## (6) `npm run bundle:check`

```
Entry bundle: index-Cre-ehTW.js + index-easpJsYc.css = 58.88 kB gzip (budget 300.00 kB)
bundle:check PASSED
```

## Additional assertions

**tsconfig strict / no new loosening vs 84e2c04:**

```
$ grep -n '"strict"' tsconfig.json app/tsconfig.json
tsconfig.json:6:    "strict": true,
app/tsconfig.json:8:    "strict": true,

$ git diff 84e2c04 -- tsconfig.json app/tsconfig.json
(empty — no diff at all, byte-identical to 84e2c04)
```

Both tsconfigs are `strict: true` and textually unchanged since 84e2c04 — no `skipLibCheck`-style loosening.

**No disabled tests:**

```
$ grep -rn '\.skip(\|it\.todo\|xit(\|describe\.skip' test app/src | wc -l
       0
```

**package.json diff vs 84e2c04, one-line summary:**

```
$ git diff --stat 84e2c04 -- package.json
 package.json | 3 +--
 1 file changed, 1 insertion(+), 2 deletions(-)
```

One-line summary: the only change since 84e2c04 is DEC-308's `drizzle-orm` bump from `^0.36.4` to `^0.45.2` and removal of the `drizzle-kit` devDependency (no other dependency drift).

## POST-S DELTA

```
$ git -C /Users/wednesdayniemeyer/Documents/gniemeyer/Projects/chautauqua log --oneline f6983e66a51d23e88931ce45dac6d0374a3d5463..refs/heads/main -- src app migrations scripts test
(empty)
```

`refs/heads/main` at delta-check time is `f6983e66a51d23e88931ce45dac6d0374a3d5463` — identical to FROZEN SHA. No post-S delta on any of `src app migrations scripts test`. Per DEC-280 a non-empty delta would never be a STOP, but here the delta is empty, so no re-check of any claim above is required. RECHECK SHA = FROZEN SHA.
