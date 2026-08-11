# task-w8-b — build+test @ 38860f9

## S derivation (DEC-176/DEC-177)

First-parent walk from `main` tip lands directly on `38860f9` ("merge
task-w8-a"), which is already the newest first-parent commit — no
bookkeeping-only commits (DEC-114) needed to be skipped past it. This
matches S per the task's own note that task-w8-a "has ALREADY merged
into main." `git merge-base --is-ancestor 2dd2f33 38860f9` exits 0
(confirmed).

## Precondition greps at S — all HIT

- `DEC-167` in `src/domain/contacts.ts`
- `ICS_ORGANIZER_EMAIL` in `src/mail/ics.ts`
- `unknown track id` in `src/routes/api/forms.ts`
- `anonymized === false` in `src/server/repo/files.ts`
- `openDate` in `app/src/pages/review/PlanEditor.tsx`
- `FORM_TASK_FIELD_SPECS` in `scripts/seed.ts`
- `DEC-174` in `scripts/seed.ts`
- `DEC-173` in `scripts/walkthrough/public.ts` and `scripts/walkthrough/speaker.ts`
- `DEC-175` in `scripts/walkthrough/producer.ts`, `scripts/walkthrough/speaker.ts`, `scripts/walkthrough/review.ts`

## Build

Fresh worktree `chautauqua-wt/task-w8-b` branched from `main` @
`38860f9` (branch `task-w8-b`, worktree HEAD = S). `npm ci
--prefer-offline --no-audit --no-fund --silent` clean (node_modules
pre-existing from a prior lane in this worktree area, verified
present and consistent). `npm run build` (`tsc --noEmit` root +
`tsc --noEmit -p app/tsconfig.json` + `vite build`) — PASS. Vite:
131 modules transformed, 19 output assets (18 JS chunks + 1 CSS) under
`public/admin/assets/`, largest entry chunk `index-Dtj2KjKK.js`
180.16 kB raw / 58.90 kB gzip (pre bundle-check re-measurement; see
below for bundle:check's own numbers, which differ slightly due to
minifier determinism but agree in shape).

## bundle:check (DEC-058, 300 KB gzip budget)

`npm run bundle:check` — PASS. Entry bundle (`index-Dtj2KjKK.js` +
`index-easpJsYc.css`) = **58.86 kB gzip** vs **300.00 kB** budget.
19 chunk files enumerated, largest non-entry chunk `Contacts-
Dlv-_vzj.js` at 32.64 kB raw / 8.84 kB gzip.

## Tests

`npm test --silent` — PASS. **151 test files / 1332 tests**, all
green, 0 failures. Includes the full `app/src/**/*.render.test.tsx`
render-sweep battery (17 files) and the walkthrough-lib/portal/schema/
edit-lock/spec9-invariants suites. Duration ~14.6s.

## OPEN ITEMS

0

## RESULT

PASS
