# task-w17-d — render sweep + contrast gate @ 408af6fc

DEC-144/DEC-139/DEC-253 render-sweep gate + DEC-426 contrast pass, run
LOCAL against `scripts/render-sweep.ts`'s own self-booted, migrated+seeded
`wrangler dev` on a free port it selected itself (no fixed port passed,
no server pre-started by this task).

## Harness fixes landed in this task (scope: scripts/render-sweep.ts,
scripts/render-sweep-lib.ts, test/render-sweep-lib.test.ts)

Two rows in `app/src/routeManifest.ts` declare `expectedStatus: 404`
deliberately (`/portal/preview` organizer — DEC-747, `/admin/*` organizer
— DEC-945 chromeless catch-all). Both were unconditionally FAILing the
gate regardless of product code, for two harness-side reasons fixed here:

1. **Console-error false positive.** Chromium logs a console `error` for
   the top-level navigation's own failed resource load whenever the
   response status is non-200 ("Failed to load resource: the server
   responded with a status of 404 (Not Found)") — a direct, unavoidable
   byproduct of the row's own `expectedStatus`, never a signal of a
   product defect. Added `filterExpectedStatusConsoleNoise` in
   `scripts/render-sweep-lib.ts`, wired into `evaluateRoute`: strips
   exactly one occurrence of that message per row when
   `entry.expectedStatus` matches the observed (and expected) status; any
   OTHER console error on the same page still fails the row (unit-tested:
   "only strips one occurrence, leaving a genuine second 404 ... visible").
2. **False "empty rendered text".** `visitRoute`'s `isAdminSpaRoute` check
   treated every `/admin/*` path as the React SPA and waited for `#root`
   (5s timeout, then empty string), but the DEC-945 chromeless 404 is a
   plain server-rendered `NotFoundDocument` (`src/routes/root.tsx`) with
   no `#root` at all. Now only rows whose `expectedStatus` is 200 (the
   default) are graded as SPA routes.

Both rows now PASS (confirmed by rerun: desktop sweep went from 45/60 to
47/60, the exact +2 these two rows account for; the admin/organizer
"empty rendered text" and both routes' console-error reasons no longer
appear in the FAIL table).

Added 5 unit tests to `test/render-sweep-lib.test.ts` covering
`filterExpectedStatusConsoleNoise` directly and one `evaluateRoute`
end-to-end case. `npx vitest run test/render-sweep-lib.test.ts`: 87/87
PASS (was 82/82 before this task's 5 new tests).

Per the AUTHORITY RULE / SCOPE RULE, no other file was touched —
`app/src/routeManifest.ts` names no route that no longer exists, so it
was not touched.

## Gate run (npm run gate:render-sweep)

Self-booted `wrangler dev` on a free local port it selected itself.
Logged in as organizer/reviewer/speaker via the real `/login` form with
seeded credentials.

**Desktop pass (BLOCKING): 47/60 routes passed.** 13 real product
defects remain — all vertical-clip offenders (DEC-620 probe), NOT
harness bugs, NOT fixed here per SCOPE RULE:

- `/admin/submissions/forms` (organizer): `div.chq-forms-header-titles`
  clip=3px, `h1` clip=3px.
- `/e/devflow-conf-2027/{sessions,speakers,gallery,agenda}` and the
  `/embed/devflow-conf-2027/{sessions,agenda,speakers,gallery}` +
  `/embed/e/seed_embed_0001` mirrors (public): `label.chq-visually-hidden`
  / `button.chq-visually-hidden` clip=18px (scrollHeight 19 > clientHeight
  1); `/e/.../speakers` and `/embed/.../speakers` additionally show
  `div.chq-pub-speaker-list-photo` clip=4px (84 > 80).
- `/logout` (organizer, speaker) and `/login` (public):
  `h1.chq-auth-wordmark` clip=3px (scrollHeight 31 > clientHeight 28).

**Mobile pass @ 390x844 (BLOCKING, DEC-253): 15/26 routes passed.** Same
family of vertical-clip offenders at the mobile viewport (scaled
clientHeight), plus one distinct real defect:

- `/portal/tasks` (speaker): horizontal overflow 170px (scrollWidth 560 >
  viewport 390) — widest offender `main.chq-measure w=560px right=560px`.

**Admin mobile pass @ 390x844 (advisory, DEC-387, non-blocking): 24/28.**
`/admin/submissions` search input 26px tap target (< 44px minimum);
`/admin/submissions/forms` same header clip family; `/admin/*`
(chromeless 404) and `/logout` clip family. Note: `/portal/preview`
still reads FAIL here ("status 404 !== 200") — `ADMIN_MOBILE_ROUTE_MANIFEST`
(`scripts/render-sweep.ts`) maps `ROUTE_MANIFEST` down to `{ path, role }`
only, dropping `expectedStatus`, and `MobileRouteEntry` /
`evaluateMobileRoute` (`render-sweep-lib.ts`) have no `expectedStatus`
field at all — the same class of bug fixed above for the desktop pass,
unfixed here on the mobile-manifest side. Left alone: this pass is
explicitly advisory (`ADMIN_MOBILE_PASS_BLOCKING` false) and does not
affect the gate's exit code; flagged as an OPEN ITEM below rather than
expanded into scope.

**Type-floor pass (advisory): 114/114 PASS.**

**Type-role pass (advisory, /admin/overview desktop): 6/7.**
`.chq-overview-deadline-value (group)` (deadline-strip-nearest): expected
exactly 1 cell at weight 700, observed 2 (weights: 400,700,700,400). Real
product defect, not a harness bug.

**Contrast pass WCAG AA (BLOCKING — `CONTRAST_BLOCKING = true` per
DEC-436's flip rule, `scripts/render-sweep-contrast.ts`): 59/60 PASS.**
`/admin/review/plans/seed_evaluation_plan_0001` (organizer): worst ratio
2.43 on `label.chq-review-checkbox-label` (fg `rgb(142,138,122)` on bg
`rgb(221,216,200)`), also `button.chq-link-button.chq-review-editor-footer-delete`
ratio 3.06. Real product defect, not a harness bug.

**Interaction-state pass (advisory, DEC-409): 2/4.**
- `.chq-review-field-disabled .chq-review-checkbox-label`
  (review-anonymize-disabled): "instrument-blocked: selector never
  resolved" — the selector never matches any element on the measured
  page/route. Possible harness-side stale selector (candidate for a
  future w17-repair task; NOT fixed here — advisory-only, and diagnosing
  whether the selector is stale vs. the product markup changed needs more
  investigation than this task's scope affords).
- `.chq-cfp-step-next` (cfp-primary-focus): outline mismatch (3px/none/
  `#F7F9F0`/0px vs. expected 2px/solid/`#4E5C31`/2px). Real product
  defect.

**Gate exit code: 1** (desktop + mobile + contrast passes are BLOCKING and
each has real, unfixed product-code offenders as catalogued above — none
attributable to this task's harness fixes, which are confirmed working).

## Contrast script (npx tsx scripts/render-sweep-contrast.ts)

Ran clean, exit 0. This module is pure evaluation/formatting code with no
direct-execution entrypoint or side effects (the in-page contrast
measurement itself is inlined in `scripts/render-sweep.ts`'s
`page.evaluate` callback per DEC-411, never imported from this file) — so
running it standalone is a no-op module load/typecheck, not a second
server-backed pass. The actual contrast measurement already ran embedded
inside `npm run gate:render-sweep` above (59/60, BLOCKING).

## AUTHORITY RULE check

No measured pixel value here was cross-checked against a specific
`docs/design/*.dc.html` numeric spec in this task (the offenders above are
internal DOM `scrollHeight`/`clientHeight` mismatches, contrast ratios,
and outline-style mismatches — not viewport-width/gutter measurements),
so the DEC-358 Home-820px/1372@114 exemption does not apply to anything
found here.

RESULT: FAIL — 2 harness bugs fixed (both DEC-747/DEC-945 rows now PASS);
13 desktop + 11 mobile BLOCKING clip/overflow product defects and 1
BLOCKING contrast offender remain unfixed (out of scope per SCOPE RULE),
plus advisory type-role/interaction-state offenders. Gate exit code 1 at
tip 408af6fc.

OPEN ITEMS: 14
1. `/admin/submissions/forms` (organizer, desktop+admin-mobile):
   `div.chq-forms-header-titles` / `h1` vertical clip 3px.
2. `/e/devflow-conf-2027/sessions` + `/embed/.../sessions` (public,
   desktop+mobile): `label/button.chq-visually-hidden` clip 18px.
3. `/e/devflow-conf-2027/speakers` + `/embed/.../speakers` (public,
   desktop+mobile): same visually-hidden clip, plus
   `div.chq-pub-speaker-list-photo` clip 4px.
4. `/e/devflow-conf-2027/gallery` + `/embed/.../gallery` (public,
   desktop+mobile): visually-hidden clip 18px.
5. `/e/devflow-conf-2027/agenda` + `/embed/.../agenda` (public,
   desktop+mobile): visually-hidden clip 18px.
6. `/embed/e/seed_embed_0001` (public, desktop+mobile): visually-hidden
   clip 18px.
7. `/logout` (organizer, speaker; desktop+mobile+admin-mobile) and
   `/login` (public, desktop+mobile): `h1.chq-auth-wordmark` clip 3px.
8. `/portal/tasks` (speaker, mobile 390x844): horizontal overflow 170px,
   `main.chq-measure` w=560px.
9. `/admin/submissions` (organizer, admin-mobile 390x844):
   `input.chq-input.chq-submissions-filterbar-search` 26px tap target
   (< 44px minimum).
10. `.chq-overview-deadline-value` /admin/overview (organizer, type-role
    advisory): 2 cells at weight 700, expected exactly 1.
11. `/admin/review/plans/seed_evaluation_plan_0001` (organizer, contrast
    BLOCKING): `label.chq-review-checkbox-label` ratio 2.43,
    `button.chq-link-button.chq-review-editor-footer-delete` ratio 3.06 —
    both below WCAG AA 4.5:1.
12. `.chq-review-field-disabled .chq-review-checkbox-label`
    (review-anonymize-disabled, interaction-state advisory):
    instrument-blocked, selector never resolved — needs triage (stale
    harness selector vs. changed product markup, not determined by this
    task).
13. `.chq-cfp-step-next` (cfp-primary-focus, interaction-state advisory):
    focus outline mismatch vs. expected 2px solid `#4E5C31`.
14. `ADMIN_MOBILE_ROUTE_MANIFEST` / `MobileRouteEntry` (harness,
    advisory-only, non-blocking): no `expectedStatus` support, so
    `/portal/preview` always reads FAIL "status 404 !== 200" on the admin
    mobile pass even though the desktop pass's equivalent row now passes
    correctly — same class of bug as the two fixed in this task, left
    unfixed here because the pass is advisory and doesn't affect gate
    exit code.
