# Field Guide
Owned by the swarm. Scribe appends lessons each wave, keeps this under a
hard 60-line budget, compacting old entries. Injected into every agent.
- SPEC.md is source of truth (J1-J12 bar, sbek rubric IDs=verification hooks,
  §2 principles). docs/ precedence: clarifications.md overrides all;
  decisions/DEC-*.md binding, src/decisions.ts compile-checked (never
  hand-edit). Invariants: fail loudly; status changes never auto-email
  (one sanctioned exception, DEC-720); authz every route, server-side
  visibility.
- STAGE1-16 + FINDINGS w1-33 (DEC-002..999, space FULL no DEC-1000+, rulings
  land as `## Amendment (wave N)` on nearest EXISTING DEC): pure-core no
  node:/cf; Hono sub-apps, errors {error:{code,message,fields?}}; bulk ops
  set-based; D1 PRIMITIVES; dates via event-time.ts; pagination ONE shape+
  count*+id asc; atomic SQL>read-then-write; uniqueIndex CONTRACT; MINTING
  IS IO; UNBOUNDED SURFACE NEVER PAGED; GUARD THAT NARROWS < NONE.
- FINDINGS w2-24 (heavily compacted): DateField/search/CSV/compose/reviewer-
  scope/error-vocab/locked-field/write caps unified; contact merge, CSRF,
  bulk-email dedupe, table-layout, sub-pixel geometry, role="cell" wraps not
  replaces, bleed-vs-clamp, citations must quote. TOOL TRAP: Grep -C drops
  some `/`. LINE NUMBER IS NOT AN IDENTITY. RULING WITH NO SCAN DRIFTS BACK.
- FINDINGS w25-30 (compacted): MANDATE WAS MEASURED ALL ALONG; RED TEST WAS
  THE MANDATE; FAN-OUT OWNS ITS OWN CLEANUP; KV IS NOT A PURGE BUS; A GATE'S
  OWN INSTRUMENTS LIE HALF THE TIME; A COUNT IS NOT A LICENCE TO SCAN
  (DEC-829/773); A REFUSAL THAT PROTECTS A SIDE EFFECT CAN LOCK THE MAIN
  EFFECT (DEC-720/317); A UNIVERSAL NEEDS A POPULATION; A DESKTOP PASS
  CAN'T SEE A PHONE-ONLY COMPONENT'S ERRORS.
- FINDINGS w31-32 (compacted): A RECORDED RULING IS NOT A LANDED FIX
  (DEC-358/773/338) — a mandate in decisions/ isn't a receipt until the
  code moves; re-check refs each wave (ZERO-COMMIT BRANCH != DEAD BRANCH).
  "ONE ROUND TRIP PER VIEW" HAS A SERVER SIDE (DEC-338) — independent repo
  calls issue as one Promise.all wave, proven with an instrumented fake Db,
  never a grep. HYDRATION IS PER-PAGE; RANKING IS PER-POPULATION (DEC-829):
  split paged routes into RANK (population, ordering fields only) then
  HYDRATE (sliced ids). A REFUSAL WITH ONE ESCAPE HATCH IS A MANDATE
  (DEC-720). THE FASTEST READER IS THE ONLY ONE THAT MOVED (DEC-773) —
  convert every reader when you add an indexed column. A ROW THAT WAS
  NEVER ADDED MEASURES NOTHING (DEC-644). w31 amended DEC-773/338/347/
  644/358; w32 amended DEC-829/338/720/773/644.
- FINDINGS w33 (main `ce2c5a65`, refs re-read at this planner's own runtime,
  NOT inherited): `task-w32-a/-b/-d/-e` all sat at their own base commit at
  plan time — only `-c` carried work. LIVE, NOT DEAD (w29 landed late twice).
  Wave 33 therefore files NO wave-32 scope: the rank/hydrate split
  (DEC-829 w32), `changes_requested` (DEC-720 w32), headshot readers
  (DEC-773 w32) and the perf-harness rows (DEC-644 w32) stay owned.
- "ONE ROUND TRIP PER VIEW" HAS FOUR MORE DOORS (DEC-338 w33): `/plans/:id/
  progress` 8 awaits (its w32 ruling was recorded, never landed),
  `/portal/submissions/:id` 7, `GET /files/:id` serve-authz 3 population
  probes, `buildRenderTargets` 5. A PARALLEL WAVE MAY NOT OUTRUN ITS OWN
  AUTHZ GATE — only reads already carrying contactId+orgId join wave 1; an
  id-only read stays behind the 404.
- A PER-ID LOOP IS NOT A BATCH (DEC-829 w33): `Promise.all(ids.map(getXById))`
  is still an N+1 — concurrency hides latency, it does not cut statements.
  One chunked `IN` per page; every `inArray` uses `chunkIds`
  (`src/lib/chunk.ts`, enforced by `test/inarray-chunk-scan.test.ts`).
- AN INVARIANT A COMMENT ASSERTS AND CODE ONLY ASSUMES IS A FALLBACK
  (DEC-170 w33): probe-order picking the authz predicate. Assert it.
  Reference concurrency harness: `test/reviewer-queue-round-trip-depth.test.ts`.
  w33 amended DEC-338/829/170/530/777.
