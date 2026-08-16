## TIER 0 (continued) — verification-log & render-sweep closures

### Verification-log walkthrough items (docs/verification-log.md:3468-3478) — all FOUR fixed, harness-side

Script bugs, not product defects: (1) `scripts/walkthrough/speaker.ts:459-467`
now asserts `chq-portal-flag-done` (DEC-366 froze "Done"/"To do"); (2)
`scripts/walkthrough/public.ts:437` now asserts
`id="chq-pub-filter-trackId"` (DEC-919 wave-40); (3)
`scripts/walkthrough/data.ts:492-497` show-flow header now includes
trailing `kind` (DEC-022 wave-66); (4)
`scripts/walkthrough/scale.ts:393-407` `readMailboxCount` now threads an
authenticated organizer cookie jar (DEC-546). FALSIFYING CHECK: the
`task-w36-b` wave-36 walkthrough re-run at `f5783479`
(`docs/verification-log/task-w36-b-walkthrough-f5783479.md`) exercised all
six areas including `data`/`scale` PASS with zero FAIL lines — the harness
fixes are live-exercised, not merely present in source.

### Render-sweep items closed in the tree (carried, quoted)

- `/portal/tasks` measure fix — `src/routes/portal/portal.css.ts:417-430`
  (`min-width: 0` on `.chq-measure`, DEC-253 wave-25 amendment).
  DISCHARGED this wave (DEC-358): re-read the gate this task was asked to
  weigh, `scripts/render-sweep.ts`/`scripts/render-sweep-lib.ts`'s DEC-253
  mobile pass. `/portal/tasks` IS one of the entries in the BLOCKING
  `MOBILE_ROUTE_MANIFEST` (`scripts/render-sweep.ts:160`), and
  `evaluateMobileRoute` (`scripts/render-sweep-lib.ts:265-286`) fails the
  route on ANY page-level horizontal overflow
  (`document.scrollingElement.scrollWidth` / `maxElementRight` vs
  `window.innerWidth`, 1px slack). This IS a genuine falsifying check for
  THIS row specifically (not just a generic assertion of no relation): a
  reverted `min-width: 0` on `.chq-measure` is exactly the kind of
  unconstrained-flex-child overflow this assertion exists to catch on a
  narrow (390px) viewport, and the row is in the manifest that actually
  blocks the gate. Caveat: this reasons from the assertion's shape and the
  manifest membership, not from an actual booted-server run (out of scope
  for a docs-only task with no server to boot) — a wave-40 owner should take
  one real `npm run gate:render-sweep` reading to make this a runtime
  reading rather than a code-read.
- `/admin/submissions` filterbar 44px floor —
  `app/src/pages/submissions/submissions.css:557-564` (DEC-253/DEC-367).
  CORRECTION (DEC-358 wave-39): the delegating task description characterized
  the render-sweep mobile-pass floor as 40px — that's WRONG as re-read this
  wave. `scripts/render-sweep-lib.ts:258` defines
  `MIN_TAP_TARGET_PX = 44` exactly (comment at `:264` cites DEC-393), and
  `evaluateMobileRoute` (`:280-286`) fails any route whose
  `minControlHeight < MIN_TAP_TARGET_PX`. `/admin/submissions` (role
  `organizer`) is a member of `ADMIN_MOBILE_ROUTE_MANIFEST`
  (`scripts/render-sweep.ts:191-193`, filtered from `ROUTE_MANIFEST` by
  role), and `ADMIN_MOBILE_PASS_BLOCKING = true`
  (`scripts/render-sweep-lib.ts:387`) — this pass blocks the gate, it is not
  advisory. So the 44px claim is NOT rounded up from 40px — the gate's own
  constant is 44px, matching the row's claim exactly. DISCHARGED on the same
  code-read basis and same caveat as the `/portal/tasks` row above (no
  booted-server reading taken this task; a wave-40 owner should take one).

