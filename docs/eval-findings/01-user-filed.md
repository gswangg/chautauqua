## USER-FILED P1 (2026-08-16, on prod) — FIXED + a scan gap to close

**Remove co-presenter failed live**: "No route matches DELETE /api/v1/submissions/:id/
participants/:pid" — the detail page's Remove action shipped with NO server half (its
render test mocks the API). Orchestrator built the route (ad84367d: scoped delete, lead
protection, 20/20 tests) and hotfix-deployed (version 8c4c5170). **SCAN GAP for the
swarm: the DEC-817 SPA↔route mutation-contract scan missed the DELETE verb** — extend it
to enumerate EVERY api* helper call (get/post/patch/DELETE) in app/src against
registered routes, so a UI control can never again ship without its endpoint.


