# task-w27-a build+test exit gate @ f01459a

DEC-232/233 wave-27 frozen sha: `f01459a1d52b6867586dd0b5b7c81dfe09601cfd` ("merge task-w26-d").

## STEP 1: sha check

Re-derived main's first-parent chain from the task-w27-a worktree (branched
off main at `2b5619d`):

```
2b5619d scribe wave 27
f01459a merge task-w26-d   <-- newest code-bearing commit
b2a5545 merge task-w26-b
225e7f8 merge task-w26-c
4e44499 merge task-w26-a
3afd8b9 scribe wave 26
...
```

`git show --stat 2b5619d` touches only `decisions/DEC-232.md`,
`decisions/DEC-233.md`, `decisions/DEC-234.md`, `field-guide/index.md`, and
`src/decisions.ts` (pure string-constant appends for DEC_232/233/234, plus a
literal-string edit to the existing `DEC_131` doc-string escaping `\n` ->
`\\n`, which is a string-content-only change inside `src/decisions.ts`, not
product logic). This matches the DEC-232/233 allow-list (decisions/**,
field-guide/**, docs/verification-log/**, docs/eval-findings.md, or pure
string-constant appends to src/decisions.ts). No other post-freeze commits
found on the first-parent chain above `f01459a`.

**Result: newest code-bearing commit == f01459a1d52b6867586dd0b5b7c81dfe09601cfd. Sha check PASSED — no drift, no rebind needed.**

## STEP 2: build + full test suite @ f01459a

Ran in a detached worktree:
`git worktree add --detach /Users/wednesdayniemeyer/Documents/gniemeyer/Projects/chautauqua-wt/task-w27-a-run f01459a`

- `npm ci --prefer-offline --no-audit --no-fund --silent` — clean, no errors.
- `npm run build` (`tsc --noEmit && tsc --noEmit -p app/tsconfig.json && vite build`) — **PASSED**, 132 modules transformed, no type errors.
- `npx vitest run` (full suite: test/** plus app/src/**/*.render.test.tsx):

```
 Test Files  161 passed (161)
      Tests  1448 passed (1448)
   Duration  18.76s
```

(w25-a baseline was 158 files / 1420 tests; wave 26/27 added 3 new test
files — test/forms.test.ts checkbox cases folded into the existing file,
plus test/cookie-flags.test.ts, test/track-delete-references.test.ts,
test/timezone-dst.test.ts — net +3 files / +28 tests vs baseline, consistent
with the 4 wave-26 fix lanes.)

- `npm run bundle:check` — **PASSED**. Entry bundle 58.86 kB gzip vs 300 kB budget.

### Wave-26 fix test files (named individually per task instructions)

Ran in isolation: `npx vitest run test/forms.test.ts test/cookie-flags.test.ts test/track-delete-references.test.ts test/timezone-dst.test.ts`

```
 ✓ test/timezone-dst.test.ts (12 tests) 18ms
 ✓ test/forms.test.ts (28 tests) 4ms
 ✓ test/track-delete-references.test.ts (5 tests) 3ms
 ✓ test/cookie-flags.test.ts (7 tests) 6ms

 Test Files  4 passed (4)
      Tests  52 passed (52)
```

- `test/forms.test.ts` — all 28 tests pass, including the 4 DEC-227 checkbox
  cases confirmed present by name:
  - "DEC-227: rejects an unchecked required checkbox (value false) as required"
  - "DEC-227: rejects an absent required checkbox as required"
  - "DEC-227: accepts a checked required checkbox and cleans it to true"
  - "DEC-227: a non-required unchecked checkbox still cleans to false without error"
- `test/cookie-flags.test.ts` (DEC-228) — all 7 tests pass.
- `test/track-delete-references.test.ts` (DEC-229) — all 5 tests pass.
- `test/timezone-dst.test.ts` (DEC-230) — all 12 tests pass.

### DST sanity probe (DEC-230)

Ran from the worktree:

```
npx tsx -e "
import { zonedMinutesToUtc } from './src/lib/timezone';
const a = zonedMinutesToUtc('2027-03-14',150,'America/New_York').toISOString();
const b = zonedMinutesToUtc('2027-11-07',90,'America/New_York').toISOString();
console.log('spring gap:', a, a === '2027-03-14T07:30:00.000Z');
console.log('fall overlap:', b, b === '2027-11-07T05:30:00.000Z');
"
```

Output:

```
spring gap: 2027-03-14T07:30:00.000Z true
fall overlap: 2027-11-07T05:30:00.000Z true
```

Both expectations match exactly: the spring-forward gap resolves forward
(07:30Z), and the fall-back overlap resolves to the earlier instant (05:30Z).

`.dev.vars` was never read or printed (DEC-187); the wrangler-config test
suite creates its own `.dev.vars` from `.dev.vars.example` internally
without this agent inspecting its contents.

The detached worktree at
`/Users/wednesdayniemeyer/Documents/gniemeyer/Projects/chautauqua-wt/task-w27-a-run`
was removed after verification (`git worktree remove ... --force`).

## Summary

- Build: PASS
- Full vitest suite: 161 files / 1448 tests, 0 failures
- bundle:check: PASS
- 4 wave-26 fix test files (forms.test.ts DEC-227 x4, cookie-flags.test.ts
  DEC-228, track-delete-references.test.ts DEC-229, timezone-dst.test.ts
  DEC-230): all PASS
- DST sanity probe (spring gap forward, fall overlap earlier): both match exactly

**RESULT: PASS**

**OPEN ITEMS:** none. No new defects found. This lane (task-w27-a) is one of
six wave-27 exit-battery gates (task-w27-a..f, DEC-233); stage-1 completion
is declared at wave 28 only on 6/6 same-sha PASS with zero new verified
defects across all six lanes.
