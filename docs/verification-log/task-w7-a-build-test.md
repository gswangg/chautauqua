# task-w7-a — build+test gate (wave 7)

Fresh worktree of `main` at `9e7ac53` ("scribe wave 7").

## sha derivation (DEC-091)

Walked `git log main` from tip, checking each commit's changed paths
against the DEC-090 exemption list (docs/verification-log*, docs/
eval-findings.md, field-guide/index.md, decisions/*.md, src/
decisions.ts string-constant appends):

```
9e7ac53 scribe wave 7            <- exempt: decisions/DEC-102.md,
                                     field-guide/index.md, and
                                     src/decisions.ts (diff is only a
                                     trailing DEC_102 = "..." append +
                                     one blank-line removal — pure
                                     string-constant append, exempt
                                     per DEC-090)
4e2d53e merge task-w5-f          <- exempt: merge commit, no own diff
                                     beyond fast-forwarded content
0828e32 task-w5-f: triage-closure gate @ b638f75 — dispositions, PASS
                                  <- exempt: docs/verification-log.md
                                     only
d12eb25 merge task-w6-d          <- newest CODE-BEARING commit
                                     (merges task-w6-d, which lands
                                     wave-6 fix content per prior
                                     wave's DEC-101/100/099/098 work)
```

Newest code-bearing sha: **d12eb25** ("merge task-w6-d"). This matches
the task's expectation exactly.

## Commands (run in worktree
`/Users/wednesdayniemeyer/Documents/gniemeyer/Projects/chautauqua-wt/task-w7-a`,
HEAD `9e7ac53`, which is content-identical to `d12eb25` for all
code/test/config paths since every commit between them is a verified
DEC-090-exempt bookkeeping-only commit)

- `npm ci --prefer-offline --no-audit --no-fund --silent`: skipped
  (node_modules already present from harness bootstrap).
- `npm run build` (`tsc --noEmit && tsc --noEmit -p app/tsconfig.json
  && vite build --config app/vite.config.ts`): PASS. Both tsc passes
  clean (0 errors). Vite build: 125 modules transformed, 17 output
  files, entry `index-DOwNDQO_.js` 179.18 kB / gzip 58.63 kB, built in
  577ms.
- `npm run bundle:check`: PASS. Entry bundle (`index-DOwNDQO_.js` +
  `index-easpJsYc.css`) = 58.60 kB gzip vs 300.00 kB budget.
- `npm test --silent`: PASS. **96 test files / 984 tests**, all green,
  0 failures. Duration 6.27s.

## Post-run re-check (DEC-091)

Re-ran `git -C /Users/wednesdayniemeyer/Documents/gniemeyer/Projects/chautauqua log --oneline -5 main`
after the test run completed: tip is still `9e7ac53 scribe wave 7`, no
code-bearing merge landed on `main` during this run. sha `d12eb25`
stands as the newest code-bearing commit for this gate section.

OPEN ITEMS: 0

RESULT: PASS
