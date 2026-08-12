# task-w13-b — build+test+bundle+audit evidence, stage-1 (log-only, DEC-419)

Branch: `task-w13-b` (worktree at
`/Users/wednesdayniemeyer/Documents/gniemeyer/Projects/chautauqua-wt/task-w13-b`),
branched from `main` @ `fd8b108` (`fd8b1080d6f884c04580363bc1809eeab1a11f85`).
No source file touched — this is a pure evidence lane per DEC-419/DEC-429.

## `npm run build`

```
tsc --noEmit && tsc --noEmit -p app/tsconfig.json && vite build --config app/vite.config.ts
```

Clean. Both `tsc --noEmit` passes (root + `app/tsconfig.json`) produced
no output (0 errors). `vite build` emitted the two known font-resolution
notices (`/fonts/FamiljenGrotesk-var.woff2` and `/fonts/Figtree-var.woff2`
"didn't resolve at build time, it will remain unchanged to be resolved at
runtime" — expected, these are runtime-served static assets, not a build
error) and finished `✓ built in 703ms`, emitting 31 chunk files under
`public/admin/assets/`. **No error verbatim to record — build is green.**

## `npm test --silent`

```
Test Files  268 passed (268)
     Tests  2235 passed (2235)
  Start at  04:01:40
  Duration  40.74s
```

0 failures, 0 skipped. **No failure verbatim to record — full suite is
green.** (React Router v6→v7 future-flag deprecation warnings appear on
stderr in several `*.render.test.tsx` files — these are React Router's
own upgrade-path warnings, not test failures or assertions; every test
file they appear in is listed above as passed.)

## `npm run bundle:check`

Budget per SPEC.md:355 / `scripts/bundle-check-lib.ts:5`
(`BUDGET_BYTES = 300 * 1024`): entry JS + entry CSS gzip ≤ 300.00 kB.

Main SPA entry (`index-Cw320nsK.js` + `index-C7tew5xN.css`):

| | raw | gzip |
|---|---|---|
| `index-Cw320nsK.js` | 179.51 kB | 58.55 kB |
| `index-C7tew5xN.css` | 17.45 kB | 3.52 kB |
| **entry total** | **196.96 kB** | **62.07 kB** |

`Entry bundle: index-Cw320nsK.js + index-C7tew5xN.css = 62.07 kB gzip
(budget 300.00 kB)` — `bundle:check PASSED`. 62.07 kB is 20.7% of the
300 kB budget, 237.93 kB of headroom.

## `npm audit`

4 advisories (2 high, 2 moderate), all against transitive packages
under **devDependencies**. Classified per DEC-429 using
`package.json:19-22` — the only two entries under `"dependencies"` are
`drizzle-orm` and `hono`; every advisory below sits under
`"devDependencies"` (`@testing-library/jest-dom`, `jsdom`,
`react-router-dom`) and its transitive tree, none of which is imported
by the Worker's server code or ships in the Cloudflare Worker bundle
(`vite build` only bundles the client SPA under `app/`, which is served
as static assets from `public/admin/`, not evaluated as part of the
Worker's own module graph; `wrangler`/`vite`/`vitest`/`playwright`/`tsx`
/`esbuild` and their trees are build/test tooling that never ships
either). `npm ls <pkg>` confirms each advisory's root:

- **`form-data` 4.0.0–4.0.5** (high, CRLF injection via unescaped
  multipart field/filename names, GHSA-hmw2-7cc7-3qxx) — resolved via
  `jsdom@25.0.1 → form-data@4.0.5`. `jsdom` is a devDependency (test
  environment only). **DevDependency-only — closed, not carried
  forward.**
- **`lodash` <=4.17.23** (high, `_.template` code injection
  GHSA-r5fr-rjxr-66jc; prototype pollution via `_.unset`/`_.omit`
  GHSA-f23m-r3pf-42rh and GHSA-xxjr-mmjv-4gpg) — resolved via
  `@testing-library/jest-dom@6.6.3 → lodash@4.17.21`.
  `@testing-library/jest-dom` is a devDependency (test-assertion
  library only). **DevDependency-only — closed, not carried forward.**
- **`react-router` 6.0.0–6.28.0(+)** / **`react-router-dom`** (moderate,
  open redirect via backslash in `<Link>`/`useNavigate`
  GHSA-wrjc-x8rr-h8h6; arbitrary constructor injection via
  `deserializeErrors()` in SSR hydration GHSA-337j-9hxr-rhxg) —
  `react-router-dom@6.30.4 → react-router@6.30.4` is itself listed
  directly under `"devDependencies"` in `package.json:35`. It is
  bundled into the client SPA (`public/admin/assets/`), not into the
  Worker's own request-handling module graph, and this app does not use
  React Router SSR hydration (`deserializeErrors()`) at all — the
  Worker never executes React Router server-side. **DevDependency-only
  — closed, not carried forward.**

`npm ls form-data lodash react-router-dom react-router` output:
```
chautauqua@
├─┬ @testing-library/jest-dom@6.6.3
│ └── lodash@4.17.21
├─┬ jsdom@25.0.1
│ └── form-data@4.0.5
└─┬ react-router-dom@6.30.4
  └── react-router@6.30.4
```

**No advisory reaches the shipped Worker bundle (`hono` / `drizzle-orm`
trees are clean).** Per DEC-429, all 4 findings are recorded and closed
in this same entry — none is an open item, and none needs a dedicated
stage-1 lane. (This is the exact scenario DEC-429 exists to stop:
`task-w10-f-build-test-redesign.md:249-256` re-raised these same 4
findings as if open; they are devDependency-only and were already
closed there too.)

## README.md quickstart vs `package.json` scripts (SPEC.md:361)

`README.md:43-47`:
```sh
npm i
npm run db:migrate
npm run seed
npm run dev
```

`package.json` scripts (verbatim):
- `"db:migrate": "wrangler d1 migrations apply chautauqua --local"`
- `"seed": "tsx scripts/seed.ts && wrangler d1 execute chautauqua --local --file=.seed.sql && tsx scripts/seed-r2.ts"`
- `"dev": "wrangler dev"`

All three script names referenced by README match `package.json`
verbatim; `npm i` is the standard npm install invocation (not a
package.json script). No secret is required by any of the four steps:
`db:migrate` and `seed` both target `--local` D1/R2 (wrangler's local
dev storage emulation, no account/API key needed); `dev` runs
`predev` (`tsx scripts/ensure-dev-vars.ts && vite build ...`) then
`wrangler dev`, and `scripts/ensure-dev-vars.ts` exists specifically to
avoid re-tracking `.dev.vars` (a local-only file that "may contain a
real local secret" per its own comment) rather than to require one —
none of the four commands fails or is gated on an external credential
being present. Confirms stage-1 hard rule (SPEC.md:44-45).

## OPEN ITEMS: 0

## RESULT: PASS
