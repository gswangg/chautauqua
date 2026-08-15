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
  OWN INSTRUMENTS LIE HALF THE TIME; A LINE QUOTED OUT OF ITS SECTION IS A
  RUMOUR; A COUNT IS NOT A LICENCE TO SCAN (DEC-829/773); A REFUSAL THAT
  PROTECTS A SIDE EFFECT CAN LOCK THE MAIN EFFECT (DEC-720/317); A CEILING
  GUARDING ONE CONTENT TYPE ISN'T A CEILING; AN ALLOWLIST MUST BE CALLED AT
  EVERY DOOR; A UNIVERSAL NEEDS A POPULATION; A DESKTOP PASS CAN'T SEE A
  PHONE-ONLY COMPONENT'S ERRORS.
- FINDINGS w31 (compacted): A RECORDED RULING IS NOT A LANDED FIX (DEC-358/
  773) — a mandate in decisions/ isn't a receipt until the code moves.
  NON-INDEXABLE "BY CONSTRUCTION" IS USUALLY NON-INDEXABLE BY SPELLING
  (DEC-773) — move the indexed column to one side before a migration. "ONE
  ROUND TRIP PER VIEW" HAS A SERVER SIDE (DEC-338) — independent repo calls
  issue as one Promise.all wave, proven with an instrumented fake Db. A PERF
  NUMBER TAKEN DURING A PARALLEL WAVE GRADES A DELTA (DEC-347). A HARNESS
  THAT SKIPS A CHECK MEASURES NOTHING (DEC-644). w31 amended DEC-773/338/
  347/644/358.
- FINDINGS w32 (main `6dbf7117`, ref-measured, NOT inherited): w31 brief was
  WRONG about w29 — task-w29-b/e landed LATE, merged. files-library fixed
  (HEADSHOT_JOIN=eq(contact.headshotFileId,file.id), migration 0040,
  481ms->13.0ms); reviewer.ts already carries DEC-829's Promise.all; w31 a/b
  re-did landed work from a pre-merge base. ZERO-COMMIT BRANCH != DEAD
  BRANCH — re-read refs at your own runtime.
- HYDRATION IS PER-PAGE; RANKING IS PER-POPULATION (DEC-829 w32). buildResults
  fetches speakers+tracks for all ~2000 plan rows before slicing though sort
  reads 6 fields; queue fetches display fields for the whole scope to emit
  200. Split paged routes: RANK (population, ordering fields only) then
  HYDRATE (sliced ids; export paths pass full set). Totals stay pre-slice.
- A REFUSAL WITH ONE ESCAPE HATCH IS A MANDATE (DEC-720 w32). Making
  `changes_requested` writable only by the mailing endpoint turns "never
  auto-email" into "this one always does"; w30 fixed only the zero-recipient
  half.
- THE FASTEST READER IS THE ONLY ONE THAT MOVED (DEC-773 w32). w29's indexed
  FK converted files-library only; profile.ts's public serve path and two
  more modules still re-parse the headshot URL string, two failure modes.
  Convert every reader when you add the column.
- A ROW THAT WAS NEVER ADDED MEASURES NOTHING (DEC-644 w32). `/plans/:id/
  progress` (7 sequential awaits) and `/plans/:id/reviewers` scale with plan
  size, never in the perf table. Lane that adds a row does not fix the route.
  DEC space FULL (001-999); w32 amended DEC-829/338/720/773/644.
