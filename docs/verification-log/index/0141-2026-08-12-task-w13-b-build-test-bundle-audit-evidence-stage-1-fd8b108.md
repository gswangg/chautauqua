## 2026-08-12 task-w13-b — build+test+bundle+audit evidence, stage-1 @ fd8b108

Log-only evidence lane (DEC-419/DEC-429), no source file touched. Full
detail in `docs/verification-log/task-w13-b-build-test-stage1.md`.

`npm run build`: clean, both `tsc --noEmit` passes 0 errors, `vite build`
`✓ built in 703ms`, 31 chunks. `npm test --silent`: **268 test files
passed, 2235 tests passed**, 0 failures, 0 skipped. `npm run bundle:check`:
main SPA entry (`index-Cw320nsK.js` + `index-C7tew5xN.css`) = **62.07 kB
gzip against the 300 kB budget** (SPEC.md:355) — PASSED.

`npm audit`: 4 advisories (2 high: `form-data` GHSA-hmw2-7cc7-3qxx,
`lodash` GHSA-r5fr-rjxr-66jc/GHSA-f23m-r3pf-42rh/GHSA-xxjr-mmjv-4gpg; 2
moderate: `react-router`/`react-router-dom` GHSA-wrjc-x8rr-h8h6/
GHSA-337j-9hxr-rhxg). `npm ls` traces every one to a devDependency root
(`jsdom`, `@testing-library/jest-dom`, `react-router-dom` itself) per
`package.json:19-22` (only `hono`/`drizzle-orm` are runtime deps) —
**all 4 devDependency-only, recorded and closed in the same entry, per
DEC-429**. None reaches the shipped Worker bundle; no dedicated stage-1
lane needed. This is the exact repeat DEC-429 targets:
`task-w10-f-build-test-redesign.md:249-256`'s same 4 findings, already
devDependency-only then too.

README.md:43-46 quickstart (`npm i && npm run db:migrate && npm run seed
&& npm run dev`) confirmed verbatim against `package.json` scripts
(`db:migrate`, `seed`, `dev`); no step requires a secret — `db:migrate`/
`seed` are `--local` D1/R2, `dev`'s `predev` (`ensure-dev-vars.ts`) exists
to avoid re-tracking `.dev.vars`, not to require it.

OPEN ITEMS: 0

RESULT: PASS

