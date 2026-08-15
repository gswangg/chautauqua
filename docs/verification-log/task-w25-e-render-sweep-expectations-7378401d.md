# task-w25-e — reconcile three render-sweep expectations @ 7378401d

Scope: DEC-643 (type-role pass), DEC-409 (interaction-state pass), DEC-253
(mobile pass) — four render-sweep instrument mismatches filed as product
defects that were actually the instrument's expectation being wrong, or the
probe not inducing the interaction it claims to measure.

## (1) Type-role tie: `evaluateDeadlineNearestWeights`

The old evaluator demanded EXACTLY one `.chq-overview-deadline-value` at
weight 700. DEC-611's wave-2 amendment made nearest-deadline emphasis a SET
— a tie marks every cell sharing the minimum value (pinned by
`app/src/pages/overview/rows.test.ts:180-189`,
`buildDeadlineCells`/rows.ts:113-136 marks every cell whose `display` text
equals the nearest cell's `display` text). The DOM-observable proxy for
"deadline value" is exactly that displayed text (rows.ts's own DEC-370
amendment: the tie is measured on the DISPLAYED value, not raw ms).

Fixed `evaluateDeadlineNearestWeights` (scripts/render-sweep-lib.ts) to take
`{ weight, value }[]` (value = the cell's rendered text, "Today" / "N
day(s)" / "—"), rank each value (`parseDeadlineRank`: "—" → unset, "Today" →
0, "N days" → N), and require: every cell at the minimum rank reads weight
700, every cell NOT at the minimum rank reads weight 400 (so a cell at 700
that isn't at the true minimum still fails — the case the old "count === 1"
check could not catch when exactly one wrongly-bolded cell existed), and
when no cell has a set value at all, no cell may read 700.

`scripts/render-sweep.ts`'s `measureTypeRoles` now also reads each deadline
cell's `textContent` alongside its font-weight (`deadlineCells` replaces
`deadlineWeights`).

Unit tests: test/render-sweep-type-roles.test.ts — 9 evaluateDeadlineNearestWeights
cases covering exact match, tied minimum (both 700, PASS), untied 700s
(FAIL), zero-700-while-set (FAIL), all-unset (PASS with 0 cells at 700),
700-while-all-unset (FAIL), stray non-400/700 weight (FAIL), and the
Today-ranks-below-1-day case.

## (2) Mobile pass `expectedStatus`

`ADMIN_MOBILE_ROUTE_MANIFEST` mapped `ROUTE_MANIFEST` down to `{ path, role
}`, dropping `expectedStatus`. `/portal/preview` (organizer,
`expectedStatus: 404` in ROUTE_MANIFEST — the DEC-747 existence-hiding 404,
src/routes/portal/preview.tsx:96-145) therefore always read `status 404 !==
200` FAIL on the mobile pass even once the equivalent desktop row passed.

Added `expectedStatus?: number` to `MobileRouteEntry`
(scripts/render-sweep-lib.ts), carried it through
`ADMIN_MOBILE_ROUTE_MANIFEST`'s `.map()` (scripts/render-sweep.ts), and
`evaluateMobileRoute` now compares `observed.status` against `entry.expectedStatus
?? 200` (was a hardcoded `!== 200`).

`filterExpectedStatusConsoleNoise`'s parameter type was narrowed from
`RouteManifestEntry` to a structural `{ expectedStatus?: number }` so the
same filter is reusable by `MobileRouteEntry`. NOTE (gap flagged per
instructions): the mobile pass's `MobileObservation`/`visitMobileRoute` does
not currently collect console errors at all (only overflow/tap-target/clip
are measured) — there is nothing today for the reused filter to strip on
the mobile pass. Wiring console-error collection into the mobile pass is a
larger change outside this task's stated file scope; recorded as an OPEN
ITEM below rather than expanded silently.

Unit tests: existing test/render-sweep-lib.test.ts evaluateMobileRoute/
filterExpectedStatusConsoleNoise suites (87 tests) still pass unmodified —
the new field is optional and defaults preserve prior behavior for every
row that doesn't set it.

## (3) `cfp-primary-focus` keyboard focus

`measureFocusState` (scripts/render-sweep.ts) called `locator.focus()` —
Chromium's `:focus-visible` heuristic keys off input modality, and a
`<button>`'s programmatic `.focus()` does not reliably read as a keyboard
interaction, so `:focus-visible { outline: 2px solid var(--chq-brand) }`
(src/views/theme.ts:170, `--chq-brand: #4E5C31` at theme.ts:55, inlined
before CFP_CSS at src/routes/public/submit-views.tsx:47-69 — confirmed
present in the cascade) never actually applied even though the rule is
real. Fixed the probe to blur any residual focus, then walk `page.keyboard.
press("Tab")` (up to 25 presses) until `document.activeElement` matches the
target selector, throwing a distinct "selector unreachable via keyboard Tab"
error if it never does — this is a REAL keyboard interaction, so the
subsequent `getComputedStyle` read measures whatever ring (or lack of one)
a keyboard user actually sees.

Per the task's own instruction, this probe fix could not be exercised here
(no booted `wrangler dev` + Playwright chromium in this worker's sandbox —
`npm run gate:render-sweep` needs a live server). Product CSS was NOT
touched. If a `gate:render-sweep` run still reads FAIL/no-outline after this
fix, that is an OPEN ITEM for the next campaign to record, not a signal to
edit theme.ts.

## (4) `review-anonymize-disabled` triage

`.chq-review-field-disabled .chq-review-checkbox-label` is real markup
(app/src/pages/review/PlanEditor.tsx:1337-1345): it renders when
`planHasSubmittedReview` (`Object.values(evaluationCountsByRound).some(count
=> count > 0)`, PlanEditor.tsx:448) is true. `evaluationCountsByRound` is
fetched asynchronously (`setEvaluationCountsByRound` inside the plan-detail
load effect, PlanEditor.tsx:267,497) — it starts as `{}` and only flips
`planHasSubmittedReview` true once that fetch resolves and React re-renders.
`measureDisabledState`'s old `locator.count() === 0` check snapshots
immediately with no wait, so it could race that state update and read 0
matches even though the class attaches a beat later on the SAME route
(seed_evaluation_plan_0001 has 31 seeded evaluations, scripts/seed.ts,
`countEvaluationsByRound` counts ALL evaluation rows regardless of
submitted/draft status — src/server/repo/review/plans.ts:354-363 — so the
class is genuinely expected to attach).

Re-pinned (not deleted): `measureDisabledState` now `locator.waitFor({
state: "attached", timeout: 5000 })` instead of an instantaneous `.count()`,
returning null (→ instrument-blocked) only if the selector truly never
attaches within 5s. Same route, same selector — this is "give the
instrument time to observe the real render state" per DEC-976, not a route
change.

## RESULT

PASS (targeted): `npx vitest run test/render-sweep-type-roles.test.ts
test/render-sweep-interaction-states.test.ts` — 34/34 passed.
Also verified no regression: `npx vitest run test/render-sweep-lib.test.ts`
— 87/87 passed. `npx tsc --noEmit` and `npm run build` both clean.

## OPEN ITEMS

- (2) Mobile pass has no console-error collection at all today; the reused
  `filterExpectedStatusConsoleNoise` has nothing to filter there yet. Not
  fixed here — outside this task's file scope (would require adding
  `page.on("console", ...)` wiring to `visitMobileRoute` and a
  `consoleErrors` field on `MobileObservation`/`MobileRouteResult`).
- (3) The keyboard-Tab focus fix is unverified end-to-end (needs a live
  `npm run gate:render-sweep` run, not available in this sandbox). If the
  outline is still absent after a real run, record that as its own OPEN
  ITEM rather than editing theme.ts — per the task's own instruction.
