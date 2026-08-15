## 2026-08-10 task-w16-a — build+test confirm @ 675219f

Full detail: docs/verification-log/task-w16-a-build-test-confirm.md

**Step 1 (DEC-114 sha re-derivation):** walked `git log --first-parent`
from `main` tip `067a5cc` ('scribe wave 16'). Checked
`git diff --name-only <c>^ <c>` for `067a5cc`, `2280419` ('merge
task-w15-j'), `ef788c2` ('merge task-w15-h'), `472dc3a` ('merge
task-w15-g'), and `21ea856` ('scribe wave 15'): all touch only
`docs/verification-log.md`, `docs/eval-findings.md`, `field-guide/**`,
`decisions/**`, and pure string-constant appends to `src/decisions.ts`
(confirmed via `git diff` on that path alone for `21ea856` and
`067a5cc` — each adds exactly one `export const DEC_1NN = "...";`
line). All fall inside the non-code-bearing set per DEC-114, so newest
code-bearing `main` commit is `675219f` ('merge task-w14-k'), matching
the task's expected sha.

RESULT: PASS

