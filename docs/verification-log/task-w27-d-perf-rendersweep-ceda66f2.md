# task-w27-d — perf-smoke + render-sweep @ ceda66f2

Tip sha S = `ceda66f2` (main HEAD at worktree creation; `git log -1 --oneline`
confirmed `ceda66f2 scribe wave 27`).

Setup performed in a detached worktree at
`/Users/wednesdayniemeyer/Documents/gniemeyer/Projects/chautauqua-wt/task-w27-d`:
`npm ci` (node_modules already present from an earlier lane, reused), `npm run
build` (clean, no errors), `rm -rf .wrangler`, `npm run db:migrate` (39/39
migrations applied), `npx tsx scripts/ensure-dev-vars.ts` (created
`.dev.vars` from the example), `npx wrangler dev --port 8883`.

GAP FLAGGED (narrowest interpretation taken): the task instructions listed
`npm run perf:seed` directly after `db:migrate`, but `perf:seed` only
inserts `seed_perf_`-prefixed rows and explicitly depends on the regular
demo seed already having created the organizer/reviewer/speaker identities
it logs in as (see `scripts/perf-seed.ts:1-11`, "on top of the demo seed's
~19 users"; `scripts/perf-smoke.ts` logs in via
`docs/fixtures/sample-data.json`'s `identities.organizer`, which only exists
after `npm run seed`). Running `perf:seed` first without `npm run seed`
produced `POST /login failed: expected 302, got 401`. I ran `npm run seed`
(demo seed) once, then `npm run perf:seed`, and the login succeeded. This
should be folded into the documented recipe for future perf-smoke lanes.

## PART 1 — perf smoke

### `npm run perf:seed` + `PERF_URL=http://localhost:8883 npm run perf:smoke` (default profile, event=perf-2k, 2000 submissions, 800 contacts)

30 measured iterations each, overhead floor 2.7ms, raw ceiling 150ms.

PASS (26):
- submissions list (page 1): raw 13.3ms / adjusted 10.7ms vs budget(read) 50ms
- submissions list (q=Kubernetes): raw 18.3ms / adj 15.7ms vs 50ms
- submission detail: raw 28.1ms / adj 25.4ms vs 50ms
- event overview: raw 27.3ms / adj 24.7ms vs 50ms
- organizer agenda (300 accepted): raw 22.5ms / adj 19.9ms vs 50ms
- public sessions page: raw 8.7ms / adj 6.1ms vs budget(public) 150ms
- public agenda: raw 9.2ms / adj 6.5ms vs 150ms
- schedule.ics 150 ids: raw 50.6ms / adj 47.9ms vs 150ms
- public speakers page: raw 6.6ms / adj 4.0ms vs 150ms
- public speakers page at row ceiling: raw 13.9ms / adj 11.3ms vs 150ms
- public speakers deepest page: raw 12.6ms / adj 10.0ms vs 150ms
- public sessions deepest rows: raw 12.6ms / adj 9.9ms vs 150ms
- public gallery page: raw 8.4ms / adj 5.7ms vs 150ms
- public schedule page: raw 12.0ms / adj 9.3ms vs 150ms
- public programme (whole agenda): raw 7.8ms / adj 5.1ms vs 150ms
- home hub (anonymous): raw 12.1ms / adj 9.5ms vs 150ms
- agenda.ics: raw 5.4ms / adj 2.7ms vs 150ms
- schedule.ics (bare, whole agenda): raw 5.5ms / adj 2.9ms vs 150ms
- contacts list (q=perf): raw 8.0ms / adj 5.3ms vs 50ms
- rating PUT: raw 14.2ms / adj 11.6ms vs budget(write) 100ms
- contacts duplicates: raw 10.1ms / adj 7.4ms vs 50ms
- email log list (page 1): raw 12.3ms / adj 9.7ms vs 50ms
- pipeline list (page 1): raw 7.9ms / adj 5.2ms vs 50ms
- org users list (page 1): raw 5.5ms / adj 2.9ms vs 50ms
- contacts bulk-email preview (50 recipients): raw 8.8ms / adj 6.1ms vs 100ms
- onboarding remind preview (all outstanding): raw 24.2ms / adj 21.6ms vs 100ms
- submission PATCH (description edit): raw 14.1ms / adj 11.4ms vs 100ms
- pipeline stage move: raw 11.1ms / adj 8.5ms vs 100ms
- bulk status change: raw 44.7ms / adj 42.1ms vs 100ms
- schedule slot PUT: raw 21.0ms / adj 18.3ms vs 100ms
- task assignment check-off: raw 10.9ms / adj 8.3ms vs 100ms

FAIL (4):
- onboarding grid (800 speakers x 5 tasks): raw 118.8ms / adjusted 116.1ms vs budget(read) 50ms — exceeds
- reviewer queue: raw 88.0ms / adjusted 85.4ms vs 50ms — exceeds
- files library (page 1): raw 477.0ms / adjusted 474.4ms vs 50ms — also exceeds the 150ms raw ceiling
- plan results (page 1): raw 71.8ms / adjusted 69.1ms vs 50ms — exceeds

`perf:smoke` exited non-zero (script's own gate), as expected given the FAILs above.

### `npm run perf:seed:aie` + `PERF_URL=http://localhost:8883 npm run perf:smoke:aie` (aie profile, event=perf-aie, 2500 submissions, 6000 contacts)

30 measured iterations, overhead floor 4.1ms, raw ceiling 150ms.

PASS (27, all reads/writes except the two below); SKIPPED (3, by design —
DEC-644/DEC-645: `rating PUT`, `reviewer queue`, `plan results (page 1)` are
`default`-profile-only fixtures, not run under `aie`).

FAIL (2):
- onboarding grid (800 speakers x 5 tasks): raw 999.8ms / adjusted 995.7ms vs budget(read) 50ms — also exceeds the 150ms raw ceiling
- files library (page 1): raw 418.8ms / adjusted 414.7ms vs 50ms — also exceeds the 150ms raw ceiling

Notable PASS numbers under aie's heavier contact load: contacts duplicates
raw 30.5ms/adj 26.4ms (vs 50ms); bulk status change raw 91.8ms/adj 87.8ms
(vs 100ms, closest write-budget margin observed).

Both perf-smoke runs FAILED overall (script exit non-zero). These are
existing, pre-existing-at-tip failures (onboarding grid, reviewer queue,
files library, plan results) — not introduced by this lane, which made no
code changes (LOG-ONLY).

## PART 2 — render sweep

`npx playwright install chromium` — already installed, no-op.
`npm run gate:render-sweep` — built its own admin SPA bundle, applied
migrations + its own seed data, booted `wrangler dev` on a self-selected
free port (50729), logged in as organizer/reviewer/speaker, ran all 7
groups, then cleaned up its own server.

Seven pass-group counts:
- desktop: 59/60
- public-mobile: 26/26
- admin-mobile: 27/28
- font-floor: 114/114
- type-role: 7/7 (advisory)
- contrast: 57/60 (advisory)
- interaction-state: 2/4 (advisory)

### Failing rows

1. `/admin/submissions/forms` (organizer, desktop) — FAIL: 2 vertical clip
   offender(s): `div.chq-forms-header-titles` clip=3px (scrollHeight 57 >
   clientHeight 54) | `h1` clip=3px (scrollHeight 31 > clientHeight 28).
   **OWNED-BY-task-w27-a** — confirmed via
   `git -C /Users/wednesdayniemeyer/Documents/gniemeyer/Projects/chautauqua log --all --oneline`,
   which shows a `task-w27-a` branch (checked out in a sibling worktree,
   not yet merged into `main`) whose stated job this wave is exactly this
   clip fix. This worktree's tip (`ceda66f2`) predates that merge, so this
   is the pre-existing defect task-w27-a is landing a fix for, not a new
   regression.
2. `/admin/submissions/forms` (organizer, admin-mobile, 390x844) — FAIL:
   same structural selectors, same underlying bug: `div.chq-forms-header-titles`
   clip=3px (scrollHeight 54 > clientHeight 51) | `h1` clip=3px
   (scrollHeight 28 > clientHeight 25). **OWNED-BY-task-w27-a** (same as
   above — one bug, two viewport rows).
3. `/admin/speakers` (organizer) — contrast FAIL: worst
   `span.chq-participation-menu-caret` ratio=1.02, fg=rgb(86,90,75)
   bg=rgb(78,92,49), well under WCAG AA. Genuinely open, not attributed to
   any in-flight task this wave.
4. `/admin/speakers/seed_contact_0001` (organizer) — contrast FAIL: same
   selector/colors, ratio=1.02. Same underlying bug as #3 (one CSS rule, two
   routes).
5. `/admin/review/plans/seed_evaluation_plan_0001` (organizer) — contrast
   FAIL: `label.chq-review-checkbox-label` ratio=3.09, fg=rgb(125,120,105)
   bg=rgb(221,216,200), below the 4.5:1 AA threshold for normal text.
   Genuinely open.
6. `.chq-review-field-disabled .chq-review-checkbox-label`
   (review-anonymize-disabled, disabled state) — interaction-state FAIL:
   `instrument-blocked: selector never resolved` — the probe never found
   this compound selector in the DOM state it visited. Genuinely open (probe
   or markup gap; not investigated further per LOG-ONLY scope).
7. `.chq-cfp-step-next` (cfp-primary-focus, focus state) — interaction-state
   FAIL: `instrument-blocked: selector unreachable via keyboard Tab within
   25 presses`. This is the exact probe task-w25-e's `:focus-visible` fix
   was meant to resolve end-to-end
   (`docs/verification-log.md:3519-3525` flagged it as never having been run
   live). Now run live at this tip: **it still fails** — the element is not
   reachable via 25 Tab presses from page load on `/submit/devflow-conf-2027`
   (or wherever the cfp step-next control lives). The fix task-w25-e landed
   does not resolve this end-to-end; still an open item.

OPEN ITEMS (excluding the 2 rows owned by in-flight task-w27-a): 5
distinct genuine failures — 2 contrast-CSS bugs (`.chq-participation-menu-
caret` shared across 2 routes; `.chq-review-checkbox-label` on 1 route) and
2 interaction-state probe failures (`.chq-review-field-disabled
.chq-review-checkbox-label` selector-never-resolved; `.chq-cfp-step-next`
keyboard-unreachable — confirming task-w25-e's fix does NOT resolve this
live).

No code was changed in this lane (LOG-ONLY per DEC-453/DEC-077). Both
wrangler dev instances (perf-smoke's port-8883 server and render-sweep's
self-selected-port server) were killed after use; the render-sweep server
self-terminates as part of the script. `.wrangler` state from this run is
local to the worktree and was not touched afterward.

RESULT: perf-smoke FAILED (4 read-budget overruns under default profile —
onboarding grid, reviewer queue, files library, plan results — 2 of which
persist and worsen under aie profile: onboarding grid, files library);
render-sweep found 5 genuinely open advisory/structural failures plus 2
rows already owned by in-flight task-w27-a.
