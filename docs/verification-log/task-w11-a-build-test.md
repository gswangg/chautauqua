# task-w11-a — build+test @ 7561cc1 — detail

## S' derivation

First-parent walk from local `main` (no `origin/main` ref reachable
in this sandbox worktree — `origin` points at an unfetched github
remote `git@github.com:gswangg/chautauqua.git`; walked the tracked
local `main` instead):

```
bdc472b scribe wave 11         (doc-only)
b57bdfd merge task-w9-g        (doc-only triage-closure)
7561cc1 merge task-w10-d       (code-bearing) <-- S'
44487c1 merge task-w10-b
...
```

`git merge-base --is-ancestor 2dd2f33 7561cc1` -> exit 0.

`7561cc1` diffstat:
```
src/routes/api/contacts.ts    | 10 +++----
src/routes/api/submissions.ts |  7 ++---
src/routes/files.ts           | 16 +++--------
src/routes/tasks.ts           | 15 ++++-------
src/server/http.ts            | 33 +++++++++++++++++++++++
test/api-submissions.test.ts  | 44 ++++++++++++++++++++++++++++++
test/server-http.test.ts      | 63 ++++++++++++++++++++++++++++++++++++++++++-
7 files changed, 153 insertions(+), 35 deletions(-)
```

## Precondition greps (17/17 present)

All 17 markers listed in the task spec were found via `grep -qF` in a
fresh worktree detached at `7561cc1`. No misses — see ledger section
for the full itemized list.

## Build

```
> tsc --noEmit && tsc --noEmit -p app/tsconfig.json && vite build --config app/vite.config.ts
vite v6.4.3 building for production...
✓ 131 modules transformed.
✓ built in 601ms
```
19 asset files under `public/admin/assets/` (18 JS/CSS chunks + no
extra html besides `public/admin/index.html`).

## Test

```
Test Files  152 passed (152)
     Tests  1364 passed (1364)
```
Baseline comparison: last recorded battery was 151 files / 1332 tests
at `38860f9` (wave 8/9). 152/1364 >= baseline — PASS. Delta attributed
to wave-10 fix-lane test additions (`task-w10-d` alone added
assertions to `test/api-submissions.test.ts` and
`test/server-http.test.ts`).

## bundle:check

```
Entry bundle: index-Dtj2KjKK.js + index-easpJsYc.css = 58.86 kB gzip (budget 300.00 kB)
bundle:check PASSED
```

Full per-chunk gzip breakdown (19 chunks, largest first):
index-Dtj2KjKK.js 57.52 kB, Contacts-Dlv-_vzj.js 8.84 kB,
Review-CeVxH2wr.js 6.64 kB, Content-D9fNEcCW.js 4.37 kB,
Settings-BqWdGkUU.js 4.32 kB, Submissions-CpPxzi3l.js 3.46 kB,
Comms-D38Wql4W.js 3.43 kB, FormsPage-CY_v41mm.js 3.30 kB,
Agenda-Dg4Ru1y9.js 2.86 kB, Speakers-sLOnrezb.js 2.84 kB,
SubmissionDetailPage-BJJvg_z-.js 2.84 kB, index-easpJsYc.css 1.34 kB,
Overview-BaiF3TfP.js 1.22 kB, useCurrentEvent-DjjY8QT6.js 0.40 kB,
dates-C3d6Pa2g.js 0.32 kB, filters-DykXP0H-.js 0.27 kB,
NotFound-DBv_fnKm.js 0.25 kB, columns-CCKJYxgx.js 0.23 kB,
types-CEJHopH4.js 0.21 kB.

RESULT: PASS
