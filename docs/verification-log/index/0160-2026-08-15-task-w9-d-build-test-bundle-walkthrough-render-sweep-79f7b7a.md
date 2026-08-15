## 2026-08-15 task-w9-d — build+test+bundle+walkthrough+render-sweep @ 79f7b7ae

Full detail: `docs/verification-log/task-w9-d-build-test-bundle-walkthrough-render-sweep.md`.
First runtime receipt since `## 2026-08-13 task-w37-d — build+test+bundle @
68289a92`; waves w1-w8 landed on main with no walkthrough/render-sweep
evidence in that gap. Log-only lane per DEC-069/DEC-453: nothing under
`src/`, `app/src/`, `scripts/`, `test/`, `migrations/`, `decisions/`, or
`package.json` touched. `npm run build`: clean (0 tsc errors, vite `✓ built
in 1.08s`). Full suite via `sh scripts/with-test-lock.sh npx vitest run`:
**1008 test files / 11029 tests passed**, 0 failures (no lock contention
hit). `npm run bundle:check`: entry bundle 69.12 kB gzip vs the SPEC §7 300
KB budget — PASS. `npm run db:migrate` (36 migrations) + `npm run seed` +
`npx wrangler dev --port 8817` clean; listener verified as this worktree's
own PID via `lsof -i :8817` at each of 3 restarts, `/health` -> `{"ok":true}`
each time (a fresh worktree has no `.dev.vars` until the `predev` hook or
`scripts/ensure-dev-vars.ts` runs — bare `wrangler dev` skips it and 404s
`/dev/mailbox`; ran the script directly to unblock, not a product defect —
see detail doc).

`npm run walkthrough` (clean single pass, freshly re-seeded): producer PASS,
review PASS, speaker/public/data/scale each FAIL on exactly one new-content
check: `scripts/walkthrough/speaker.ts:460` (completed task not shown as
"Completed" in `/portal/tasks`), `scripts/walkthrough/public.ts:436` (no
"Track filters" nav on `/e/devflow-conf-2027/sessions`),
`scripts/walkthrough/data.ts:467` (showflow.csv header has grown a trailing
`kind` column the script doesn't expect), `scripts/walkthrough/scale.ts:394`
(`readMailboxCount` fetches `/dev/mailbox` with no cookie/credentials; per
`DEC_546` in `src/decisions-data/part3.ts:133` the route is now
organizer-only + org-scoped, so the unauthenticated GET returns the `/login`
page instead of a message count — the walkthrough helper was not updated
when DEC-546 landed). No `PLANNER:` lines anywhere.

`npm run gate:render-sweep` (own server/port, torn down by the script; exit
code 1): desktop 45/60 PASS, public-mobile 15/26 PASS, admin-mobile 24/28
PASS, font-floor 114/114 PASS, type-role 6/7 PASS (advisory),
contrast 59/60 PASS (advisory), interaction-state 2/4 PASS (advisory). Full
per-row tables and selector-level detail in the detail doc; distinct
failure classes: `chq-visually-hidden` label/button vertical clip on public
session/speaker/agenda/gallery pages (desktop + mobile + embed variants),
`chq-auth-wordmark` clip on `/login`/`/logout`, `/admin/submissions/forms`
header clip, `/portal/preview` 404 (organizer, both desktop and admin
mobile), `/admin/*` empty-rendered-text + 404, `/portal/tasks` mobile
horizontal overflow (`main.chq-measure` 560px > 390px viewport),
`/admin/submissions` mobile search-input tap-target 26px < 44px, one
type-role weight-count mismatch on `.chq-overview-deadline-value` (group),
one contrast FAIL on `/admin/review/plans/seed_evaluation_plan_0001`
(ratio 2.43), and two interaction-state FAILs (a disabled-selector that
never resolved, and `.chq-cfp-step-next`'s focus outline not matching the
expected token).

OPEN ITEMS: 9

1. `scripts/walkthrough/speaker.ts:460` — completed general task not shown
   as "Completed" in `/portal/tasks`.
2. `scripts/walkthrough/public.ts:436` — no "Track filters" nav found on
   `/e/devflow-conf-2027/sessions`.
3. `scripts/walkthrough/data.ts:467` — showflow.csv export header carries
   an extra trailing `kind` column vs. the walkthrough script's expected
   header constant (unclear which side is stale).
4. `scripts/walkthrough/scale.ts:394` (`readMailboxCount`) — unauthenticated
   fetch of `/dev/mailbox`; DEC-546 (`src/decisions-data/part3.ts:133`) made
   the route organizer-only + org-scoped, so this helper has been stale
   since DEC-546 landed.
5. Render-sweep desktop/mobile: `chq-visually-hidden` label/button vertical
   clip (clip=18px) across public `/sessions`, `/speakers`, `/agenda`,
   `/gallery` and their `/embed/...` counterparts (both viewports).
6. Render-sweep: `/admin/submissions/forms` — `div.chq-forms-header-titles`
   and `h1` vertical clip (desktop + admin-mobile).
7. Render-sweep: `/portal/preview` — 404 (console error on desktop, status
   404 on admin-mobile).
8. Render-sweep mobile: `/portal/tasks` horizontal overflow 170px
   (`main.chq-measure` 560px in a 390px viewport); `/admin/submissions`
   search input 26px tall, under the 44px tap-target floor.
9. Render-sweep advisory: type-role `.chq-overview-deadline-value` (group)
   weight-count mismatch; contrast FAIL on
   `/admin/review/plans/seed_evaluation_plan_0001` (ratio 2.43,
   `label.chq-review-checkbox-label`); interaction-state FAILs on a
   never-resolved disabled selector and `.chq-cfp-step-next`'s focus
   outline token mismatch.

RESULT: FAIL — build/test/bundle are green; walkthrough and render-sweep
each surface genuine, reproducible open items (not fixed in this log-only
lane per DEC-069/DEC-453 scope).

