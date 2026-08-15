## 2026-08-15 task-w25-e — render-sweep expectation reconciliation @ 7378401d

Full detail: docs/verification-log/task-w25-e-render-sweep-expectations-7378401d.md

Reconciled three render-sweep instrument expectations that contradicted the
product (DEC-643/DEC-409/DEC-253) plus one instrument-blocked row's triage:

1. `evaluateDeadlineNearestWeights` demanded exactly one weight-700 cell;
   DEC-611's wave-2 amendment makes nearest-deadline emphasis a SET (a tie
   marks every cell sharing the minimum value —
   app/src/pages/overview/rows.test.ts:180-189). Re-expressed as: every
   cell at the minimum displayed value reads 700, every other cell reads
   400 (so a wrongly-bolded non-minimum 700 cell still fails), zero 700s
   while a deadline is set still fails.
2. `ADMIN_MOBILE_ROUTE_MANIFEST` dropped `expectedStatus`, so
   `/portal/preview`'s deliberate 404 (src/routes/portal/preview.tsx:96-145)
   always FAILed the mobile pass even once desktop passed. Carried
   `expectedStatus` through `MobileRouteEntry`/`evaluateMobileRoute`, same
   as the desktop pass.
3. `cfp-primary-focus`'s probe used `locator.focus()` (not read as a
   keyboard interaction by Chromium's `:focus-visible` heuristic for a
   `<button>`), so the real `:focus-visible` rule in src/views/theme.ts:170
   never applied to the measurement. Fixed the probe to induce a real
   `page.keyboard.press("Tab")` walk before reading the outline. Product
   CSS untouched; unverified end-to-end (needs a live gate run) — flagged
   as an OPEN ITEM if still absent after a real run.
4. `review-anonymize-disabled`'s selector is real markup
   (PlanEditor.tsx:1337-1345, gated on `planHasSubmittedReview`, an
   asynchronously-fetched value) but the probe's `locator.count()===0`
   snapshotted with no wait. Re-pinned (same route) by waiting for the
   selector to attach (5s) instead of an instant unwaited count.

RESULT: PASS (targeted) — `npx vitest run test/render-sweep-type-roles.test.ts
test/render-sweep-interaction-states.test.ts`: 34/34. No regression:
`npx vitest run test/render-sweep-lib.test.ts`: 87/87. `npx tsc --noEmit`
and `npm run build`: clean.

OPEN ITEMS: mobile pass has no console-error collection at all (item 2's
reused `filterExpectedStatusConsoleNoise` has nothing to filter there yet
— out of this task's file scope); item 3's keyboard-Tab fix is unverified
end-to-end (no live server in this sandbox).

