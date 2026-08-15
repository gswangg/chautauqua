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
- FINDINGS w2-30 (heavily compacted): DateField/search/CSV/compose/reviewer-
  scope/error-vocab/locked-field/write caps unified; contact merge, CSRF,
  bulk-email dedupe, table-layout, sub-pixel geometry, role="cell" wraps not
  replaces, bleed-vs-clamp, citations must quote. TOOL TRAP: Grep -C drops
  some `/`. LINE NUMBER IS NOT AN IDENTITY. RULING WITH NO SCAN DRIFTS BACK.
  MANDATE WAS MEASURED ALL ALONG; RED TEST WAS THE MANDATE; FAN-OUT OWNS
  ITS OWN CLEANUP; KV IS NOT A PURGE BUS; A COUNT IS NOT A LICENCE TO SCAN
  (DEC-829/773); A REFUSAL THAT PROTECTS A SIDE EFFECT CAN LOCK THE MAIN
  EFFECT (DEC-720/317); A UNIVERSAL NEEDS A POPULATION; A DESKTOP PASS
  CAN'T SEE A PHONE-ONLY COMPONENT'S ERRORS.
- FINDINGS w31-33 (compacted): A RECORDED RULING IS NOT A LANDED FIX
  (DEC-358/773/338) — re-check refs each wave (ZERO-COMMIT BRANCH != DEAD
  BRANCH). "ONE ROUND TRIP PER VIEW" HAS A SERVER SIDE (DEC-338): indep.
  repo calls issue as one Promise.all wave, proven with an instrumented
  fake Db, never a grep — doors: `/plans/:id/progress`, `/portal/
  submissions/:id`, `GET /files/:id`, `buildRenderTargets`. A PARALLEL
  WAVE MAY NOT OUTRUN ITS OWN AUTHZ GATE. HYDRATION IS PER-PAGE; RANKING
  IS PER-POPULATION (DEC-829): split into RANK then HYDRATE. A PER-ID
  LOOP IS NOT A BATCH — one chunked `IN`, `chunkIds` (`src/lib/chunk.ts`,
  `test/inarray-chunk-scan.test.ts`). A REFUSAL WITH ONE ESCAPE HATCH IS
  A MANDATE (DEC-720). THE FASTEST READER IS THE ONLY ONE THAT MOVED
  (DEC-773). A ROW NEVER ADDED MEASURES NOTHING (DEC-644). AN INVARIANT
  A COMMENT ASSERTS AND CODE ONLY ASSUMES IS A FALLBACK (DEC-170) —
  assert it; ref `test/reviewer-queue-round-trip-depth.test.ts`. w31-33
  amended DEC-773/338/347/644/358/829/720/170/530/777.
- FINDINGS w34 (main `af4601d3`): ALL FIVE w32 lanes MERGED (rank/hydrate
  split, `changes_requested` both doors, DEC-459 probe IN tree);
  `task-w33-a/-b/-c/-e` at `af4601d3` (zero-commit, LIVE), `-d` at
  `26d1e48a`. w34 files no w33 scope. STALE-ON-MEASUREMENT, do not re-file:
  chunked-urlencoded body limit (fixed), `logoUrl` XSS (`safeImageSrc`),
  content-note zero-recipient 400, AUDIT compose cap (100), acceptance
  task fan-out (DEC-932 DELIBERATE — filed thrice).
- "ONE ROUND TRIP PER VIEW" HAS A PUBLIC SIDE AND A WRITE SIDE (DEC-774/155/
  598 w34): `dispatch.tsx` 7 awaits, agenda GET ~8, portal `/tasks` 5 waves,
  submission create/edit 4 serialized validators. A CONDITIONAL READ STAYS
  CONDITIONAL — collapse waves, never fetch-then-discard; COUNT must not
  move. PROMISE.ALL CHANGES WHICH ERROR WINS (DEC-598/155): two reads in
  one wave each throwing ApiError use `allSettled` + re-throw SOURCE order.
- A CHECK WITH A SHAPE HOLE IS WHY THE DOC DRIFTED (DEC-618 w34):
  `audit-claims` only parsed backtick spans starting `/`, so
  `POST /admin/content-notes` (nonexistent route) survived.
- A GUARD JUSTIFIED BY A FALSE MECHANISM INVITES ITS OWN REMOVAL (DEC-060
  w34): Hono DOES merge the mount prefix (`hono-base.js:262`, `url.js:94`);
  guard stays right, reason was not. Real enforcement = `role-refusal-
  probe.test.ts`. w34 amended DEC-774/099/891/155/598/618/060.
