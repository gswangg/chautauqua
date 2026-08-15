## 2026-08-10 task-w7-d — spec-audit @ d12eb25

Full detail: docs/verification-log/task-w7-d-spec-audit.md

Re-derived newest code-bearing sha per DEC-091: `d12eb25` ("merge
task-w6-d") — matches the field guide's expected value; everything after
it on `main`'s tip (`9e7ac53`) is bookkeeping (DEC-102 append in
`src/decisions.ts` plus docs/decisions/field-guide). Scoped `git diff
3d1e838..HEAD`: the code-bearing delta is exactly the four task-w6-*
fix lanes (DEC-098/099/100/101) plus bookkeeping, as expected. All four
fixes verified conformant with file:line evidence in the full detail
doc. README quickstart/persona table, `.github/workflows/ci.yml`
build+bundle:check+test/perf-smoke/walkthrough jobs, and SPEC §9
invariant regression tests all re-confirmed present and unchanged.
Regression tests for the four new fixes confirmed present
(`test/pubcache.test.ts`, `test/claim-onscreen-scope.test.ts`,
`test/submission-seq.test.ts`, `test/contacts-repo.test.ts`).

`npm run build`: PASS. `npm test --silent`: ALL PASS — 96 files, 984
tests, 0 failures.

OPEN ITEMS: 0

RESULT: PASS

