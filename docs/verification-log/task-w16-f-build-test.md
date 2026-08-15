# task-w16-f: build + test gate (verification wave 16)

- `git rev-parse HEAD` (worktree base, before this task's log-only commit): `9b21309c7240cfb6622dcea0f15ebe981060dcd6`
- Worktree: `/Users/wednesdayniemeyer/Documents/gniemeyer/Projects/chautauqua-wt/task-w16-f`
- Render-sweep port: the sweep script (`scripts/render-sweep.ts`) manages its own `wrangler dev` process via an internal `findFreePort()` call rather than accepting an external server — see "Port note" below. Actual port used this run: **53401**. No manually-started `--port 8875` server was used to serve the sweep (see note).

## 1. Typecheck (`npm run build`)

`tsc --noEmit && tsc --noEmit -p app/tsconfig.json && vite build --config app/vite.config.ts`

**PASS.** Worker typecheck, SPA typecheck, and the SPA vite build (`app/dist` bundle) all completed with zero errors. Full output tail:

```
✓ 276 modules transformed.
../public/admin/assets/index-DitZzjP_.js 201.78 kB │ gzip: 65.47 kB
✓ built in 1.13s
```

## 2. Full suite (`npm run test:full` = `sh scripts/with-test-lock.sh vitest run`)

**1 failed / 1033 passed test files; 1 failed / 11258 passed tests.**

**FAILING TEST:**

- File: `test/spa-mutation-contract.scan.test.ts`
- Test title: `SPA admin mutation <-> route contract (DEC-817 amendment, findings wave 13) > every extracted key appears as a token in its resolved route module's source`
- Failure detail:
  ```
  app/src/pages/settings/PeopleRolesPanel.tsx:113 POST /users: key "firstName" not found in src/routes/api/users.ts
  app/src/pages/settings/PeopleRolesPanel.tsx:113 POST /users: key "lastName" not found in src/routes/api/users.ts
  ```

**Verification — this is the scan test correctly catching a real product gap, not a stale test.** `app/src/pages/settings/PeopleRolesPanel.tsx` (`handleInvite`, around line 113) POSTs `{ email, role, firstName, lastName }` to `/api/v1/users`. Read `src/routes/api/users.ts`'s `POST /api/v1/users` handler in full: it reads only `record.email` and `record.role` from the body (`normalizeEmail(...)`, `isOrgUserRole(...)`); `firstName`/`lastName` are never referenced anywhere in the file, and `repo.createUser` (`src/server/repo/users.ts:94`, `CreateUserInput`) has no first/last name fields either — the org-user table has no name columns at all (the closest thing, `contact.firstName`/`contact.lastName`, is a *different* table used only for the "display name" fallback at `src/server/repo/users.ts:186-192`, unrelated to this endpoint). So the SPA form silently drops the organizer's typed first/last name on every invite; nothing 400s, nothing persists them. This is a genuine SPA<->route drift the scan test is designed to catch, not a broken fixture or selector.

- `git log --oneline -5 -- src/routes/api/users.ts app/src/pages/settings/PeopleRolesPanel.tsx test/spa-mutation-contract.scan.test.ts` shows the newest touch to any of the three is `4781e6bd` (the scan test's own DEC-817 amendment landing in wave 13) — no unmerged wave-14/15 branch (task-w14-d, task-w15-a..e) owns `src/routes/api/users.ts` or `PeopleRolesPanel.tsx`, so this is not "waiting on a branch"; it is an un-filed product gap. Per REPAIR SCOPE this task does not fix product behaviour a test is correctly catching, so `src/routes/api/users.ts` / `repo/users.ts` / `PeopleRolesPanel.tsx` are left untouched. Flagging for the next planner: either the SPA drops the two fields (and stops collecting them), or `POST /api/v1/users` needs a name column + persistence path.

All other 1033 test files passed, including every `*.scan.test.ts` invariant scan, `test/decisions-parity.test.ts`, `test/schema.test.ts`, `test/response-headers-scan.test.ts` (345 assertions), and `test/source-no-control-bytes.test.ts` (726 assertions). Two pre-existing `unhandled error`/`stderr` traces in the run (`test/cookie-flags.test.ts`, `test/html-error-shape.test.ts`, `test/scheduled-isolation.test.ts`, `test/users-create-mailer-failure.test.ts`) are the tests' own intentional thrown-error fixtures logged by vitest, not failures — all four files report ✓ PASS.

## 3. Render sweep (`npx tsx scripts/render-sweep.ts`)

### Port note (deviation from task instructions, documented per DEC-060 wave-16 amendment's spirit)

The task instructions said to start `npx wrangler dev --port 8875` in the background and then run the render sweep "against it," pinning 8875 to avoid colliding with task-w16-c's 8871 and task-w16-d's 8873. However `scripts/render-sweep.ts`'s `main()` (line ~945-965) does not accept an external server or a port argument — it calls its own `findFreePort()` (OS-assigned ephemeral port, this run: 53401), runs its own `db:migrate` + `seed` + `wrangler dev` spawn, and tears the server down at the end. There is no way to make it target a pre-started server on 8875. I killed the manually-started 8875 `wrangler dev` process before running the script (to avoid two processes racing to write the same `.wrangler/state` D1/R2 local storage in this worktree) and let the script manage its own server end-to-end, which is the only mode the tool supports. This worktree's `wrangler dev` never bound 8875 or 8873/8871 during the actual sweep, so no port collision occurred regardless; flagging the instruction/tool mismatch for the scribe/planner in case a future wave wants render-sweep.ts to accept a `--port` override for parity with the walkthrough/perf-smoke lanes.

### Desktop pass (`ROUTE_MANIFEST`, blocking) — 45/60 routes passed

All 60 manifest rows visited (`app/src/routeManifest.ts`). Every FAIL below has `expectedStatus` unset (defaults to 200) and `expectedLandedPath` unset (defaults to `entry.path`) **except** `/portal/preview` (`role: organizer`, `expectedStatus: 404` per routeManifest.ts:153) and `/admin/*` (`role: organizer`, `expectedStatus: 404` per routeManifest.ts:214) — both of those matched their expected status; their failures are on other criteria (console error / empty body), not status/landedPath.

FAILING rows (15):
| path | role | reason |
|---|---|---|
| /admin/submissions/forms | organizer | 2 vertical clip offenders: `div.chq-forms-header-titles` clip=3px, `h1` clip=3px |
| /portal/preview | organizer | expectedStatus 404 matched; 1 console error (404 loading a resource) |
| /e/devflow-conf-2027/sessions | public | 5 vertical clip offenders, all `.chq-visually-hidden` label/button (clip=18px, scrollHeight 19 > clientHeight 1) |
| /e/devflow-conf-2027/speakers | public | 5 vertical clip offenders (`.chq-visually-hidden` x4 + `div.chq-pub-speaker-list-photo` clip=4px) |
| /e/devflow-conf-2027/gallery | public | 4 vertical clip offenders, all `.chq-visually-hidden` |
| /e/devflow-conf-2027/agenda | public | 4 vertical clip offenders, all `.chq-visually-hidden` |
| /logout | organizer | 1 vertical clip offender: `h1.chq-auth-wordmark` clip=3px |
| /logout | speaker | 1 vertical clip offender: `h1.chq-auth-wordmark` clip=3px |
| /admin/* | organizer | expectedStatus 404 matched; empty rendered text + 1 console error (404 loading a resource) |
| /embed/devflow-conf-2027/sessions | public | 5 vertical clip offenders, all `.chq-visually-hidden` |
| /embed/devflow-conf-2027/agenda | public | 4 vertical clip offenders, all `.chq-visually-hidden` |
| /embed/devflow-conf-2027/speakers | public | 5 vertical clip offenders (`.chq-visually-hidden` x4 + `div.chq-pub-speaker-list-photo` clip=4px) |
| /embed/devflow-conf-2027/gallery | public | 4 vertical clip offenders, all `.chq-visually-hidden` |
| /login | public | 1 vertical clip offender: `h1.chq-auth-wordmark` clip=3px |
| /embed/e/seed_embed_0001 | public | 5 vertical clip offenders, all `.chq-visually-hidden` |

45 other rows PASS (all landed on their expected path at their expected status with non-empty body and no console/page errors).

### Mobile pass (`MOBILE_ROUTE_MANIFEST`, 390x844, blocking) — 15/26 routes passed

FAILING rows (11), all `status 200` (as expected) but with the vertical-clip / overflow reasons below:
| path | reason |
|---|---|
| /e/devflow-conf-2027/sessions | 5 clip offenders, all `.chq-visually-hidden` |
| /e/devflow-conf-2027/speakers | 5 clip offenders (`.chq-visually-hidden` x2 + `div.chq-pub-speaker-list-photo` x3, clip=4px) |
| /e/devflow-conf-2027/agenda | 2 clip offenders, `.chq-visually-hidden` |
| /e/devflow-conf-2027/gallery | 2 clip offenders, `.chq-visually-hidden` |
| /embed/devflow-conf-2027/sessions | 4 clip offenders, `.chq-visually-hidden` |
| /embed/devflow-conf-2027/agenda | 2 clip offenders, `.chq-visually-hidden` |
| /embed/devflow-conf-2027/speakers | 5 clip offenders (`.chq-visually-hidden` x2 + photo x3) |
| /embed/devflow-conf-2027/gallery | 2 clip offenders, `.chq-visually-hidden` |
| /login | 1 clip offender: `h1.chq-auth-wordmark` clip=3px |
| /embed/e/seed_embed_0001 | 4 clip offenders, `.chq-visually-hidden` |
| /portal/tasks | horizontal overflow 170px (scrollWidth 560 > viewport 390) — widest: `main.chq-measure` w=560px |

15 other rows PASS.

### Admin mobile pass (390x844, advisory, non-blocking per `ADMIN_MOBILE_PASS_BLOCKING=false`) — 24/28 routes passed

FAILING rows (4):
| path | reason |
|---|---|
| /admin/submissions | control height 26px < 44px tap target (`input.chq-input.chq-submissions-filterbar-search`) |
| /admin/submissions/forms | 2 clip offenders: `div.chq-forms-header-titles` clip=3px, `h1` clip=3px |
| /portal/preview | **reported as `status 404 !== 200`** — this row is filtered straight from `ROUTE_MANIFEST` (which correctly carries `expectedStatus: 404` for this entry, and the desktop pass above honors it), but `evaluateMobileRoute` in `scripts/render-sweep-lib.ts:198-229` hard-codes `if (observed.status !== 200)` and never reads `entry.expectedStatus` at all (unlike `evaluateRoute`, which does `entry.expectedStatus ?? 200`). This is a genuine harness bug — the row's real behavior (404, correct per DEC-945 chromeless-404) is spuriously reported FAIL because the mobile evaluator ignores the manifest's declared expectation. Non-blocking (advisory pass) so it did not flip the gate's exit code, but it is a false negative worth a dedicated fix in `scripts/render-sweep-lib.ts`. Out of this task's repair scope (not a vitest test, not a typecheck error) — flagged for the next planner/scribe.
| /logout | 1 clip offender: `h1.chq-auth-wordmark` clip=3px |

24 other rows PASS.

### Type-floor pass (10px minimum, advisory) — 114/114 PASS

### Type-role pass (`/admin/overview` desktop, advisory) — 6/7 PASS
FAIL: `.chq-overview-deadline-value` (group) / `deadline-strip-nearest` — expected exactly 1 cell at font-weight 700, observed 2 (weights: 400,700,700,400).

### Contrast pass (WCAG AA, advisory) — 59/60 PASS
FAIL: `/admin/review/plans/seed_evaluation_plan_0001` (organizer) — minRatio 2.43, worst offender `label.chq-review-checkbox-label` fg=rgb(142,138,122) bg=rgb(221,216,200) (ratio 2.43); also `button.chq-link-button.chq-review-editor-footer-delete` ratio 3.06.

### Interaction-state pass (B8 focus/hover/disabled, advisory) — 2/4 PASS
FAIL 1: `.chq-review-field-disabled .chq-review-checkbox-label` (review-anonymize-disabled/disabled) — instrument-blocked: selector never resolved on the page visited.
FAIL 2: `.chq-cfp-step-next` (cfp-primary-focus/focus) — outline-width 3px !== expected 2px; outline-style none !== expected solid; outline-color #F7F9F0 !== expected #4E5C31; outline-offset 0px !== expected 2px.

### Overall gate result

`failed = true` (desktop pass 45/60 and mobile pass 15/26 are blocking; admin-mobile/type-role/contrast/interaction-state are advisory-only per each pass's own `*_BLOCKING` flag in `render-sweep-lib.ts`, so those alone would not have flipped the gate). `gate:render-sweep OK` was **not** printed; the script exited non-zero (`process.exitCode = 1`).

## Repair scope taken

None applied. The one `vitest` failure is a genuinely-caught product gap (SPA sends `firstName`/`lastName`, route never reads them), not a stale test — left as-is per REPAIR SCOPE, documented above with the exact source lines for the next planner. No typecheck errors existed to fix. No render-sweep failures were "genuinely broken tests" in this task's sense (they are the render sweep itself, not vitest); the one harness bug found in the admin-mobile pass (`evaluateMobileRoute` ignoring `entry.expectedStatus`) is a script defect, not a test or typecheck error, so it is documented rather than patched, per this task's narrow repair scope.
