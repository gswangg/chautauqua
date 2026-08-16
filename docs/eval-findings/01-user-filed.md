## USER RULING (2026-08-16): EVAL TURN-DIETS MUST NEVER DEGRADE THE REAL PRODUCT

"We shouldn't hack the app in obviously detrimental ways to pass the eval." Applied
retroactively: the w12-c templates[0] AUTO-APPLY is REMOVED (it silently pre-filled the
composer and made "Write from scratch" lie — the user hit the confusion live). A diet is
legitimate when it's invisible or genuinely better UX (deep links, Enter-to-commit,
fewer clicks, instant first paint); it is FORBIDDEN when it changes what the product
does without the user asking (silent pre-fills, surprising defaults, skipped
confirmations). SWARM: audit the remaining turn-diet features against this rule and
file anything that fails it.

## GATE-9 USER-FILED BATCH (all fixed + deployed 9089cac3): fixed-table width:1px column
hack (13 columns starved under table-layout:fixed, content bleeding past the measure —
scan-locked in test/fixed-table-column-hack.scan.test.ts) · explicit "Write from
scratch" now empties the composer · contacts rows baseline-align (middle floated
single-line cells against two-line COMPANY) · participant DELETE route (earlier).



## USER-FILED P1 (2026-08-16, on prod) — FIXED + a scan gap to close

**Remove co-presenter failed live**: "No route matches DELETE /api/v1/submissions/:id/
participants/:pid" — the detail page's Remove action shipped with NO server half (its
render test mocks the API). Orchestrator built the route (ad84367d: scoped delete, lead
protection, 20/20 tests) and hotfix-deployed (version 8c4c5170). **SCAN GAP for the
swarm: the DEC-817 SPA↔route mutation-contract scan missed the DELETE verb** — extend it
to enumerate EVERY api* helper call (get/post/patch/DELETE) in app/src against
registered routes, so a UI control can never again ship without its endpoint.


