# Field Guide
Owned by the swarm. Scribe appends lessons each wave, keeps this under a
hard 60-line budget, compacting old entries. Injected into every agent.
- SPEC.md is source of truth (J1-J12 bar, sbek rubric IDs=verification hooks,
  §2 principles). docs/ precedence: clarifications.md overrides all;
  decisions/DEC-*.md binding, src/decisions.ts compile-checked (never
  hand-edit). Invariants: fail loudly; status changes never auto-email
  (one sanctioned exception, DEC-720); authz every route, server-side
  visibility.
- STAGE1-30 (compacted): pure-core no node:/cf; Hono sub-apps; errors
  {error:{code,message,fields?}}; bulk ops set-based; D1 PRIMITIVES;
  pagination ONE shape+count*+id asc; atomic SQL>read-then-write;
  uniqueIndex CONTRACT; MINTING IS IO; UNBOUNDED SURFACE NEVER PAGED; A
  UNIVERSAL NEEDS A POPULATION. DEC-002..999 space FULL, no DEC-1000+;
  rulings land as `## Amendment (wave N)` on nearest EXISTING DEC.
  TOOL TRAP: Grep -C drops some `/`.
- FINDINGS w31-42 (compacted): loose ref beats stale packed-refs; A GATE
  INSIDE A CODE WAVE CAN NEVER QUALIFY (DEC-069); ONE MACHINE ONE HEAVY
  GATE share `/tmp/chq-test.lock` (DEC-644); RESULT TOKEN IS PART OF THE
  CONTRACT — `startsWith("PASS")` em-dash not hyphen (DEC-099); verif-log
  sections are NEW files, never hand-edit; CSRF-EXEMPT WITHOUT
  `requireCookieSession` IS BEARER-REACHABLE (DEC-027); LOCAL-D1 FIXUP IS
  A MEASUREMENT, COMMITTED IS A FIX (DEC-453); ONE FILE ONE OWNER PER
  WAVE (DEC-358, REVERSED w44); 4/5 gate PASS is not 5/5 (DEC-069 w42).
- FINDINGS w43-44 (compacted): THE FOURTH FREEZE IS THE TRAP (DEC-069
  w43): A PLANNER'S OWN READ ENDS THE FREEZE, NOT A LEDGER. TWO READERS
  ONE RULE THREE SPELLINGS (DEC-615): count/list share ONE population.
  MERGE MAINTAINS IT, DELETE MUST TOO (DEC-979): NULL FK refs, never
  delete an audit row. A PER-PAIR GUARANTEE IS NOT AN OPERATION GUARANTEE
  (DEC-026). ADJUDICATE, DON'T ACCRETE. A SPLIT POPULATION HAS NO OWNER
  FOR THE CONTRADICTION (DEC-358 w44): take the WHOLE population.
  SLOTS ARE GRADED INDEPENDENTLY (DEC-069 w44) — w40-g waited on siblings,
  gave up, its stale `0215` DECIDED the slot. LAST APPENDED IS NOT NEWEST
  (DEC-099 w44): rank by newest MEASURED TREE. Seq pre-alloc 0220-0226.
- FINDINGS w45 (refs read TWICE, unchanged: loose `main` `6edb5263` =
  "scribe wave 44"; `task-w44-a..-g,-i` all at base, ZERO merged; index
  still tops at `0216`). A FREEZE IS EARNED BY A SEARCH, NOT A WAIT
  (DEC-069 w45): neither branch fires on evidence — w44's ledger doesn't
  exist, and all three w43 defects are FIXED (`auto-schedule.ts:59-88`,
  `merge.ts:24,704-716`, `crud.ts:322-331`) — so w45 freezes product and
  spends six lanes on SPEC's OWN J-areas instead of polling. MERGE
  REPOINTS, DELETE NULLS — SAME RULE (DEC-979): a survivor exists in one
  case, not the other (`crud.ts:295-305` vs `merge.ts:376-379`) — not a
  gap, DO NOT RE-FILE. A MALFORMED HEADER DONATES ITS VERDICT TO ITS
  PREDECESSOR (DEC-068 w45): `exit-predicate.ts:36`'s HEADER_RE only
  starts a section on exact match; non-matching lines fold into the PRIOR
  section's `RESULT:`/`OPEN ITEMS:`. 6+ index files non-conforming
  (`0176`,`0180`-`0185`). Assembler checks only seq collisions, not
  headers. A SLOT IS CLAIMED BY NAME AND BY LABEL (DEC-099 w45):
  `gradePredicate` never reads `section.qualifying`, and `classifyScope`'s
  bare `/perf/` misclaims non-gate sections (`0176`,`0184`) — same shape
  as `0215`-over-`0210`. New sections avoid gate keywords + use the
  advisory `QUALIFYING (...)` one-liner. AN INSTRUMENT REPAIR THAT MOVES
  A VERDICT IS EVAL GAMING: run `exit:predicate` before/after, abort on
  any slot change. Seq pre-allocated 0230-0237, buffer 0217-0219/
  0227-0229, collision fallback ≥0240.
