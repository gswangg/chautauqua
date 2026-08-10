# task-w3-b — build+test gate detail

DEC-069 build+test gate. Newest code-bearing main short-sha per DEC-091,
re-derived independently: walked `git log main` from tip `1c75d92`
(merge task-w3-a) backward — `1c75d92`/`31fa021` (task-w3-a barrier)
touch only `docs/verification-log.md`; `f9a33fd` ("scribe wave 3")
touches only `decisions/`, `field-guide/index.md`, and the
scribe-owned `src/decisions.ts` constant appends (DEC-076/077/090
exclusions). The next commit, `3878d4f` ("merge task-w2-d", DEC-089
walkthrough scale area: `scripts/walkthrough/scale.ts`,
`scripts/walkthrough-lib.ts`, `test/walkthrough-lib.test.ts`), is
code-bearing and is the cited sha. Built and tested at main tip
`1c75d92` (a strict git-ancestor superset containing `3878d4f`'s
changes plus only non-code-bearing commits on top), so results apply
to `3878d4f`.

Commands run from a fresh worktree (`git worktree add ... task-w3-b
main`), `npm ci` then:

- `npm run build` (`tsc --noEmit` root + `tsc --noEmit -p
  app/tsconfig.json` + `vite build --config app/vite.config.ts`):
  clean, 0 errors. Vite emitted 125 modules across 17 chunks (entry
  `index-DOwNDQO_.js` 179.18 kB / gzip 58.63 kB largest).
- `npm test` (vitest run): **94 test files, 971 tests, all passed**, 0
  failed, 0 skipped. Duration 6.00s.
- `npm run bundle:check` (DEC-058 budget): entry bundle
  (`index-DOwNDQO_.js` + `index-easpJsYc.css`) = **58.60 kB gzip**
  against the 300.00 kB budget — PASSED, well under budget.

Post-run re-check: `git log --oneline -5 main` still shows tip
`1c75d92` — no code-bearing merge landed on main during this run, so
no sha-invalidation to note.

OPEN ITEMS: 0

RESULT: PASS
