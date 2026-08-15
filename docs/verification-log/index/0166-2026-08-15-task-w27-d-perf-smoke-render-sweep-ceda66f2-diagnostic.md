## 2026-08-15 task-w27-d — perf-smoke + render-sweep @ ceda66f2 [DIAGNOSTIC]

INVALIDATED BY: src/**, app/src/**/*.css, src/**/*.css.ts, src/views/theme.ts, app/src/routeManifest.ts, scripts/perf-*, scripts/render-sweep*

Detached worktree at tip `ceda66f2` (`main` at worktree creation). LOG-ONLY
lane (DEC-453/DEC-077) — no code changed. Full detail:
docs/verification-log/task-w27-d-perf-rendersweep-ceda66f2.md.

GAP FLAGGED: `perf:seed` depends on `npm run seed` (demo seed) having
already created the organizer identity `perf:smoke` logs in as; the task
recipe omitted this step and hit `POST /login failed: expected 302, got
401` until `npm run seed` was run first. Recommend this be folded into the
documented perf-smoke recipe.

PART 1 (perf smoke, PERF_URL=http://localhost:8883, `wrangler dev` on
8883, killed after use):
- default profile (event=perf-2k, 2000 submissions, 800 contacts): 26 PASS
  / 4 FAIL — onboarding grid (800x5 tasks) adj 116.1ms vs 50ms budget;
  reviewer queue adj 85.4ms vs 50ms; files library (page 1) adj 474.4ms vs
  50ms (also breaches 150ms raw ceiling); plan results (page 1) adj 69.1ms
  vs 50ms.
- aie profile (event=perf-aie, 2500 submissions, 6000 contacts): 27 PASS /
  2 FAIL (rating PUT, reviewer queue, plan results SKIPPED by design per
  DEC-644/DEC-645, profile-only fixtures) — onboarding grid adj 995.7ms vs
  50ms (also breaches 150ms raw ceiling); files library (page 1) adj
  414.7ms vs 50ms (also breaches 150ms raw ceiling).
- Both runs exited non-zero (script's own gate). Pre-existing at this tip,
  not introduced by this lane.

PART 2 (render sweep, `npm run gate:render-sweep`, self-selected port,
self-cleaned):
- desktop 59/60, public-mobile 26/26, admin-mobile 27/28, font-floor
  114/114, type-role 7/7, contrast 57/60, interaction-state 2/4.
- `/admin/submissions/forms` clip (desktop + admin-mobile,
  `div.chq-forms-header-titles`/`h1`, 3px each): confirmed
  **OWNED-BY-task-w27-a** via `git log --all` showing an unmerged
  `task-w27-a` branch checked out in a sibling worktree whose stated job
  this wave is this exact fix; this tree's tip predates that merge.
- `.chq-cfp-step-next` keyboard-Tab focus probe (task-w25-e's fix,
  flagged at docs/verification-log.md:3519-3525 as never run live): now
  run live at this tip — **still fails**
  (`instrument-blocked: selector unreachable via keyboard Tab within 25
  presses`). The fix does not resolve this end-to-end.
- Other genuinely open FAILs: `.chq-participation-menu-caret` contrast
  1.02 on `/admin/speakers` + `/admin/speakers/seed_contact_0001`;
  `.chq-review-checkbox-label` contrast 3.09 on
  `/admin/review/plans/seed_evaluation_plan_0001`;
  `.chq-review-field-disabled .chq-review-checkbox-label` disabled-state
  probe selector-never-resolved.

OPEN ITEMS: 5
RESULT: perf-smoke FAILED (4 read-budget overruns, default profile; 2
persist/worsen under aie); render-sweep found 5 genuinely open items plus
2 rows already owned by in-flight task-w27-a; task-w25-e's cfp-step-next
keyboard focus-visible fix confirmed NOT resolved live.

