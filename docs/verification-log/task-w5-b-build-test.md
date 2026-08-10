# task-w5-b — build+test detail @ 64ec7de

## SHA derivation (DEC-114/165)

Walked `git log --first-parent main` from HEAD. HEAD itself
(`64ec7de merge task-w5-a`) is not a bookkeeping-only commit (no
docs/verification-log*, docs/eval-findings.md, decisions/*.md,
field-guide/index.md, or pure-string-constant-only src/decisions.ts
change), so it is the adopted sha without needing to walk further.

Verified:
- `git show 64ec7de:.github/workflows/ci.yml` contains a `render-sweep:`
  job running `npm run gate:render-sweep` — confirms this sha is
  task-w5-a's merge or later (DEC-166).
- `git merge-base --is-ancestor 2dd2f33 64ec7de` — exit 0, confirms
  descent from the required base commit (DEC-129/139).

Both STEP 1 checks pass. Adopted sha: **64ec7de**.

## STEP 2 results

- `npm ci --prefer-offline --no-audit --no-fund --silent` — clean
  (node_modules pre-existed in the fresh worktree checkout; skipped
  per the `[ -d node_modules ] ||` guard — confirmed present and valid).
- `npm run build` (`tsc --noEmit && tsc --noEmit -p app/tsconfig.json
  && vite build --config app/vite.config.ts`) — PASS. 131 modules
  transformed. 19 output files under `public/admin/` (18 chunks/CSS +
  index.html).
- `npm run bundle:check` (DEC-058, 300KB gzip budget) — PASS. Entry
  bundle (`index-CD2-kLqP.js` + `index-easpJsYc.css`) = 58.86 kB gzip,
  well under the 300.00 kB budget. Largest secondary chunk:
  `Contacts-D95Rc0Kq.js` at 8.83 kB gzip.
- `npm test --silent` (vitest) — PASS. **151 test files, 1308 tests**,
  0 failures. Duration 12.41s.

## File/module counts

- `src/**/*.ts` (pure-core + Worker routes): 93 files.
- `app/src/**/*.{ts,tsx}` (admin SPA): 150 files.
- Vite output: 131 modules transformed into 18 chunk/CSS assets +
  index.html under `public/admin/`.

## Notes

- No product/test/script/config changes were made in this worktree —
  this is a log-only build+test confirmation lane per DEC-069/165.
- A homonym `## ... task-w5-b — build+test @ b638f75` section already
  exists earlier in this file (an older campaign, different sha). Per
  DEC-129, sections are identified by sha, not branch/task-id; that
  section was left untouched.
