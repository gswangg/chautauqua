# task-w9-b — build+test @ 38860f9

## S derivation (DEC-114/DEC-176/DEC-177/DEC-178)

First-parent walk from `main` tip (`aa7bf95`, "merge task-w8-b") skips
back past `aa7bf95` itself: that merge touches only
`docs/verification-log.md` + `docs/verification-log/task-w8-b-build-
test.md` (log-only, per DEC-114 disambiguation of "code-bearing").
The next first-parent commit, `38860f9` ("merge task-w8-a"), touches
`scripts/seed.ts`, `scripts/walkthrough/{producer,public,review,
speaker}.ts` — genuine code. So **S = 38860f9**, the newest
code-bearing commit, matching the task's own note that task-w9-a "has
ALREADY merged into main" (landed under the stale/reused branch name
`task-w8-a`; content confirmed to carry the DEC-173/174/175 tags
required of task-w9-a, not any earlier wave). `git merge-base
--is-ancestor 2dd2f33 38860f9` exits 0 (confirmed, exit=0).

## Precondition greps at S — all HIT

- `DEC-167` in `src/domain/contacts.ts` (1 hit)
- `ICS_ORGANIZER_EMAIL` in `src/mail/ics.ts` (1 hit)
- `unknown track id` in `src/routes/api/forms.ts` (1 hit)
- `anonymized === false` in `src/server/repo/files.ts` (1 hit)
- `openDate` in `app/src/pages/review/PlanEditor.tsx` (3 hits)
- `FORM_TASK_FIELD_SPECS` in `scripts/seed.ts` (3 hits)
- `DEC-174` in `scripts/seed.ts` (1 hit)
- `DEC-173` in `scripts/walkthrough/public.ts` and
  `scripts/walkthrough/speaker.ts` (both hit)
- `DEC-175` in `scripts/walkthrough/producer.ts`,
  `scripts/walkthrough/speaker.ts`, `scripts/walkthrough/review.ts`
  (all three hit)

## Method

Verified at S directly: `git worktree add --detach
chautauqua-wt/task-w9-b-S 38860f9` (separate, disposable worktree —
kept the `task-w9-b` branch worktree clean of any detached-HEAD
state). Confirmed `git diff --stat 38860f9 aa7bf95` shows only the
two log-only files above, i.e. S is a strict prefix of `main` tip with
zero code delta.

## Build

`npm ci --prefer-offline --no-audit --no-fund --silent` clean. `npm
run build` (`tsc --noEmit` root + `tsc --noEmit -p app/tsconfig.json`
+ `vite build --config app/vite.config.ts`) — PASS. Vite: 131 modules
transformed, 19 output assets (18 JS chunks + 1 CSS) under
`public/admin/assets/`.

## bundle:check (DEC-058, 300 KB gzip budget)

`npm run bundle:check` — PASS. Entry bundle (`index-Dtj2KjKK.js` +
`index-easpJsYc.css`) = **58.86 kB gzip** vs **300.00 kB** budget.
Largest non-entry chunk `Contacts-Dlv-_vzj.js` at 32.64 kB raw / 8.84
kB gzip.

## Tests

`npm test --silent` — PASS. **151 test files / 1332 tests**, all
green, 0 failures. Includes the full `app/src/**/*.render.test.tsx`
render-sweep battery. Duration ~14.0s.

These numbers independently reproduce the `task-w8-b` gate's results
at the identical S (expected: both wave-9 gates target the same
frozen sha per DEC-178).

## OPEN ITEMS

0

## RESULT

PASS
