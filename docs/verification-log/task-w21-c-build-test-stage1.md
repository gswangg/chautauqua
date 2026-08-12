# task-w21-c — build/test evidence, wave 21 (DEC-472, DEC-438, DEC-448)

Log-only lane. No file under `src/`, `app/src/`, `scripts/`, `test/`, `migrations/`,
`decisions/`, or `package.json` was touched. This document plus the appended section in
`docs/verification-log.md` are the only outputs.

## sha and ancestry

Own worktree, own sha (derived, not copied from any other agent's report):

```
$ git rev-parse HEAD
bf56ba715a36bcde8bbdb9e01edf7b573c38b0de

$ git log --oneline -8
bf56ba7 scribe wave 21
3764993 merge task-w20-e
f310111 merge task-w20-b
43e6889 DEC-469: seed pipeline_entry/user rows + perf-smoke checks for pipeline/users
3959482 merge task-w20-a
dff4903 merge task-w20-d
089bbf6 Update /progress load-shed regression test for the DEC-466 wire change
cf87f9d DEC-465: collapse five perPage helper duplicates into listPerPage
```

DEC-472 requires grading every row from file:line at the sha or `merge-base --is-ancestor`,
never from a DEC doc or the field guide's narration. The wave-21 field guide entry (compacted
from DEC-471/472/473) states "w20 planned 5 source lanes; ONLY task-w20-c reached main." That
claim does **not** hold at this sha: `git log --oneline -8` above shows `merge task-w20-e`,
`merge task-w20-b`, `merge task-w20-a`, and `merge task-w20-d` all present as commits on `main`'s
history feeding into `bf56ba7`, and a direct ancestry check confirms it:

```
$ for c in 3764993 f310111 43e6889 3959482 dff4903; do
    git merge-base --is-ancestor $c HEAD && echo "$c ancestor: yes" || echo "$c ancestor: no"
  done
3764993 ancestor: yes
f310111 ancestor: yes
43e6889 ancestor: yes
3959482 ancestor: yes
dff4903 ancestor: yes
```

All five listed wave-20 merge commits are ancestors of `HEAD` at the sha this lane's worktree
was created from (`main` at the time of worktree creation, unchanged since — this lane made no
commits that would move the branch tip forward from that base other than this evidence commit
itself). Whatever happened between the w20 ledger closing (DEC-470, "only task-w20-c merged") and
`bf56ba7`, the tree at `bf56ba7` carries all five. This is a correction to the field guide's
w20/w21 narration, not a re-litigation of DEC-472's method — DEC-472's method (file:line +
ancestor check, never guide prose) is exactly what surfaces the correction.

## DEC-472 spot-checks (read, not narrated)

Three specific readings requested by this task, each with file:line at `bf56ba7`:

1. **`src/lib/pagination.ts` exports `listPerPage`?** TRUE.
   ```
   src/lib/pagination.ts:32:export function listPerPage(raw: string | number | null | undefined): number {
   ```

2. **`src/routes/api/pipeline.ts` still reads `clampPerPage(c.req.query("perPage") ?? 200)`?**
   FALSE — it now reads `listPerPage`, not `clampPerPage`:
   ```
   src/routes/api/pipeline.ts:67:  const perPage = listPerPage(c.req.query("perPage")); // DEC-465
   src/routes/api/pipeline.ts:72:  return c.json({ items: items.map(serializeEntry), total, page, perPage });
   ```
   (The envelope also carries `total`, consistent with DEC-461's `{page?:{limit,offset}}` /
   sibling-count shape.)

3. **`app/src/pages/contacts/PipelineBoard.tsx` still renders `{entries.length}`?** FALSE — it
   renders `{total}`, with an explicit DEC-468 comment explaining why:
   ```
   app/src/pages/contacts/PipelineBoard.tsx:23:  // DEC-468: the server caps a page at 200 rows -- `total` is the envelope's
   app/src/pages/contacts/PipelineBoard.tsx:24:  // true count, never `entries.length`, so the caption and the "Load more"
   app/src/pages/contacts/PipelineBoard.tsx:26:  const [total, setTotal] = useState(0);
   app/src/pages/contacts/PipelineBoard.tsx:42:        setTotal(res.total);
   app/src/pages/contacts/PipelineBoard.tsx:89:          <span className="chq-contacts-pipeline-caption">{total} people</span>
   app/src/pages/contacts/PipelineBoard.tsx:121:      {entries.length < total && (
   ```

**Conclusion: at `bf56ba7`, wave 20's DEC-465/466/468 fixes are all landed and present in the
tree** — contradicting the compacted w20/w21 field-guide narration that only `task-w20-c` merged.
This is the concrete evidence behind that correction; no source file was touched to produce it.

## Worktree note (process observation, not a product finding)

Mid-lane, this lane's worktree directory (`/Users/wednesdayniemeyer/Documents/gniemeyer/Projects/
chautauqua-wt/task-w21-c`) and its branch (`task-w21-c`) both disappeared from
`git worktree list` / `git branch -a` while the first `npm test` run was executing — an
out-of-band process (concurrent sibling-lane worktree cleanup) removed them. No commit existed at
that point, so nothing was lost; the worktree was recreated with `git worktree add ... -b
task-w21-c main`, landing on the identical `bf56ba7` sha, and every command below was re-run
clean from a fresh `npm ci`. The one flaky-looking failure this produced (`Error: Cannot find
module 'ms'` mid-vitest-run, from a `node_modules` in an inconsistent state left over from the
interrupted first `npm ci`/first test run racing the directory's removal) is a workspace-integrity
artifact of that removal, not a real test failure — the second, clean run is the one reported
below and it is fully green.

## npm run build

Exit code 0. `tsc --noEmit` (root tsconfig) + `tsc --noEmit -p app/tsconfig.json` + `vite build
--config app/vite.config.ts`. 155 modules transformed, built in 667ms (vite phase; full `npm run
build` wall time including both `tsc --noEmit` passes was ~8.3s across two back-to-back runs).

```
> build
> tsc --noEmit && tsc --noEmit -p app/tsconfig.json && vite build --config app/vite.config.ts

vite v6.4.3 building for production...
transforming...
✓ 155 modules transformed.
rendering chunks...
computing gzip size...
../public/admin/assets/index-C47BAmZI.js                  183.82 kB │ gzip: 59.96 kB
../public/admin/assets/Contacts-BJzopT0S.js                 40.72 kB │ gzip:  9.82 kB
../public/admin/assets/Review-BSeI4MOR.js                   36.14 kB │ gzip:  8.79 kB
[... full per-chunk table omitted here, unchanged between the two runs ...]
✓ built in 667ms
```

Both TypeScript passes (root + `app/`) produced no diagnostics (no output between the command
line and the vite banner = 0 errors on both `tsc --noEmit` invocations; `tsc --noEmit` prints
nothing on success).

## npm test (vitest run)

Exit code 0. **293 test files, 2669 tests, 0 failures.**

```
 Test Files  293 passed (293)
      Tests  2669 passed (2669)
   Start at  06:43:00
   Duration  25.42s (transform 4.82s, setup 0ms, collect 67.89s, tests 33.93s, environment 14.51s, prepare 17.13s)
```

No test failed on the clean re-run. (The first, pre-worktree-loss run hit the `ms`-module
`MODULE_NOT_FOUND` crash described above — that is an environment/`node_modules` integrity
failure external to any test file, not a test failure, and is not counted as a FAIL: exit code 1
came from a fatal Node.js require error inside `debug`/`tinypool`, before or during a worker's
setup, not from a vitest assertion. Reported here for transparency per DEC-438's own-evidence
rule, but the row's verdict rests on the clean, reproducible run.)

## npm run bundle:check

Exit code 0. Entry bundle (largest-chunk `index` JS + its CSS) gzip size vs. SPEC.md:355's 300 KB
initial-bundle bar:

```
Entry bundle: index-C47BAmZI.js + index-BOb7RLKn.css = 62.06 kB gzip (budget 300.00 kB)
bundle:check PASSED
```

62.06 KB gzip against a 300 KB budget — comfortable margin (≈21% of budget).

## npm run gate:render-sweep

Exit code 0, `gate:render-sweep OK`. Sweep covers desktop pass, mobile pass (390×844), admin
mobile pass (advisory), a type-floor pass (10px minimum, advisory — **83/83 font-floor checks
passed**), and a contrast pass (WCAG AA — **42/42 contrast checks passed**). No `FAIL` line
anywhere in the full output (grepped for `FAIL` across the entire 4950-line log; zero matches).

Current value of the blocking flag read directly from source, not assumed:

```
scripts/render-sweep-contrast.ts:33:export const CONTRAST_BLOCKING = true;
```

`CONTRAST_BLOCKING = true` at this sha, and the contrast sweep is currently all-PASS (42/42), so
the flag's blocking behavior is not being tested against a failing case by this run — it is
consistent with green, not proven to actually gate a regression. (The comment at line 31 says the
flag was flipped to `true` on the premise "flip only if your own run reads all-PASS," which this
run's 42/42 confirms remains true at `bf56ba7`.)

## Zero-secrets check (stage-1 bar)

- `.dev.vars` at this sha is byte-identical in content to the checked-in `.dev.vars.example`
  (both contain only `DEV_MODE=1` and `PUBLIC_BASE_URL=http://localhost:8787` — no API keys, no
  tokens, no external-account values). `.dev.vars` is gitignored (`.gitignore:9`) and was created
  fresh by `scripts/ensure-dev-vars.ts` during the `gate:render-sweep` run ("ensure-dev-vars:
  created .dev.vars from .dev.vars.example"), not hand-edited.
- `npm run build` and `npm test` both succeeded (exit 0) with no `.dev.vars` values beyond the
  two lines above present anywhere in the environment used for these runs.
- `git ls-files | xargs grep -lIE "(sk-[a-zA-Z0-9]{20,}|AKIA[0-9A-Z]{16}|-----BEGIN (RSA|EC|OPENSSH) PRIVATE KEY-----)"`
  across every tracked file at `bf56ba7` returned zero matches.

## OPEN ITEMS: 1

Field-guide correction owed (PENDING-OWNED, scribe/next-wave-planner, not this lane's to fix per
DEC-452/453/472's log-only-lane boundary): the wave 20/21 field-guide entries currently narrate
"w20 planned 5 source lanes; ONLY task-w20-c reached main... no listPerPage, pipeline still
`clampPerPage(q ?? 200)`, PipelineBoard still `{entries.length}`." At `bf56ba7` that is FALSE on
all three counts — `listPerPage` exists and is used by pipeline, and PipelineBoard renders
`total`. This is not a source-code defect (the code is correct and this lane's spot-checks
confirm it); it is a field-guide/ledger-narration gap that should be corrected by whichever lane
next has write access to `docs/decisions-log` narration or the field guide, so the next wave's
planning is not misled into re-doing already-landed work.

## RESULT: PASS

Build, test, bundle:check, and gate:render-sweep are all green (exit 0) at `bf56ba7` on a clean,
reproducible re-run. Zero committed secrets. The three DEC-472 spot-checks read TRUE/FALSE/FALSE
exactly as the code shows — wave 20's pagination and total-rendering fixes are landed at this sha,
contradicting (in this lane's favor — the code is more correct than the narration claimed) the
compacted field-guide summary. One OPEN ITEM is a narration-correction handoff, not a code defect.
