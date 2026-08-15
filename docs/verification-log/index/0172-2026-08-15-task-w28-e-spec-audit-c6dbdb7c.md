## 2026-08-15 task-w28-e — spec-audit @ c6dbdb7c

QUALIFYING

INVALIDATED BY: src/** app/src/** migrations/** package.json

§8/§9 nine-times-green per DEC-063: cited from
`docs/verification-log/task-w27-e-spec-audit-ceda66f2.md` and
`task-w27-e-spec-audit.md`; only the two rot-prone facts re-checked this
lane — quickstart (`README.md:45-48`) still matches package.json's
`db:migrate`/`seed`/`dev` script names verbatim, and the "For evaluators"
persona table (`README.md:213-219`) still matches
`docs/fixtures/sample-data.json`'s seeded emails/passwords verbatim (both
quoted in full in the companion doc). §6 Security (SPEC.md:306-321) graded
clause by clause, 9 clauses, all confirmed with a quoted file:line except
two sub-details recorded NOT RE-CHECKED (constant-time-compare/session-
rotation detail past the PBKDF2 iteration constant; speaker→/admin
403/redirect). §7 Performance (SPEC.md:322-358): server + perceived
runtime budgets and CI perf smoke NOT RE-CHECKED (LOG-ONLY, no running
instance). The two never-checked structural claims resolved: (a) FK-index
coverage — zero schema/migration delta since `ceda66f2`'s exhaustive
65-row FK table, so its "zero gaps" finding carries forward unchanged
(confirmed via empty `git diff --stat ceda66f2..c6dbdb7c -- src/db/schema
migrations`); (b) code-splitting comes from `app/src/App.tsx`'s
`lazy(pageLoaders.X)`, not `app/vite.config.ts` (which sets no
`manualChunks`); bundle budget re-measured fresh at S (`npm run build &&
npm run bundle:check`, read-only, not committed): `Entry bundle:
index-BhPrbvpM.js + index-DpG2gFFa.css = 69.19 kB gzip (budget 300.00 kB)
bundle:check PASSED` — closes the "pending-at-S" open item left by
`task-w27-e-spec-audit-ceda66f2.md`. Full clause-by-clause table:
`docs/verification-log/task-w28-e-spec-audit-c6dbdb7c.md`.

RESULT: PASS — all quotable §6/§7 clauses confirmed with file:line
evidence or a covering earlier receipt; no clause graded PASS without
either a fresh quote or an explicit unchanged-tree carry-forward; runtime-
only clauses (latency/perf budgets, CI perf smoke) and two security sub-
details recorded NOT RE-CHECKED rather than assumed.
OPEN ITEMS: 4 (constant-time-compare/session-rotation detail; speaker→
/admin redirect detail; §7 server+perceived runtime budgets, unmeasurable
without a running instance; §7 CI perf smoke, requires seed+dev server)

