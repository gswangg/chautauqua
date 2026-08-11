# task-w20-f — triage-closure @ 6807b67 — detail

Verification-only lane. Companion to the summary section appended to
`docs/verification-log.md` under the same heading. This file adds raw
command transcripts / evidence not needed in the summary.

## STEP 1 — sha derivation commands

```
$ git log --oneline -10
d35cd68 merge task-w20-d
1ff4b3e merge task-w20-c
ba0db9f task-w20-d: render-sweep gate PASS @ 6807b67 (DEC-206)
d1c13d2 merge task-w20-a
edb5a52 task-w20-c: perf-smoke gate PASS @ 6807b67 (port 8952)
92f8d4d task-w20-a: verification-log build+test PASS @ 6807b67 (DEC-206/205/197/114)
78bb286 scribe wave 20
6807b67 merge task-w18-b
16f6020 DEC-200: self-service password change route, strip password from welcome email
668acc6 scribe wave 19

$ git diff --stat 6807b67..HEAD -- . ':!docs/verification-log.md' ':!docs/verification-log'
 decisions/DEC-205.md |  3 +++
 decisions/DEC-206.md |  3 +++
 field-guide/index.md | 60 ++++++++++++++++++++++++++--------------------------
 src/decisions.ts     |  2 ++
 4 files changed, 38 insertions(+), 30 deletions(-)
```

All four post-`6807b67` deltas are inside the DEC-114 bookkeeping
exclusion set (decision docs, field guide, and two pure-string
`src/decisions.ts` constant appends — no logic touched). Sha remains
`6807b67`.

## STEP 2 — battery locations

- `task-w20-a — build+test @ 6807b67`: `docs/verification-log.md` on
  `main` (merged, `d1c13d2`), full detail
  `docs/verification-log/task-w20-a-build-test.md`.
- `task-w20-b — walkthrough @ 6807b67`: unmerged branch `task-w20-b`
  (tip `3106e5c`), full detail
  `docs/verification-log/task-w20-b-walkthrough.md` on that branch.
- `task-w20-c — perf-smoke @ 6807b67`: `docs/verification-log.md` on
  `main` (merged, `1ff4b3e`), port 8952.
- `task-w20-d — render-sweep @ 6807b67`: `docs/verification-log.md`
  on `main` (merged, `d35cd68`), 31/31 routes, OPEN ITEMS: 1
  (`/account/password` not in `app/src/routeManifest.ts`, compensated
  with manual curl 302 evidence) — non-blocking.
- `task-w20-e — spec-audit @ 6807b67`: unmerged branch `task-w20-e`
  (tip `2416c76`), full detail
  `docs/verification-log/task-w20-e-spec-audit.md` on that branch.

All five confirmed `RESULT: PASS` at the frozen sha within the first
poll (~10 minutes elapsed from task start, well under the 45-minute
window).

## STEP 4 — hygiene evidence

```
$ git grep -n -E '^(<<<<<<<|=======|>>>>>>>)' -- .
(no output, exit 1)

$ git branch -a
+ main
+ task-w20-b
+ task-w20-e
* task-w20-f
  tmp-main-check
```

## STEP 6 — own build/test transcript (abridged)

```
$ npm run build
...
✓ built in 596ms

$ npx vitest run test/auth.test.ts
 ✓ test/auth.test.ts (21 tests) 6430ms
 Test Files  1 passed (1)
      Tests  21 passed (21)
```
