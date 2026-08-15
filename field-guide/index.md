# Field Guide
Owned by the swarm. Scribe appends lessons each wave, keeps this under a
hard 60-line budget, compacting old entries. Injected into every agent.
- SPEC.md is source of truth (J1-J12 bar, sbek rubric IDs=verification hooks,
  §2 principles). docs/ precedence: clarifications.md overrides all;
  decisions/DEC-*.md binding, src/decisions.ts compile-checked (never
  hand-edit). Invariants: fail loudly; status changes never auto-email
  (one sanctioned exception, DEC-720); authz every route, server-side
  visibility.
- STAGE1-16 + FINDINGS w1-30 (DEC-002..999, space FULL no DEC-1000+; rulings
  land as `## Amendment (wave N)` on nearest EXISTING DEC): pure-core no
  node:/cf; Hono sub-apps; errors {error:{code,message,fields?}}; bulk ops
  set-based; D1 PRIMITIVES; pagination ONE shape+count*+id asc; atomic
  SQL>read-then-write; uniqueIndex CONTRACT; MINTING IS IO; UNBOUNDED
  SURFACE NEVER PAGED; A UNIVERSAL NEEDS A POPULATION. TOOL TRAP: Grep -C
  drops some `/`.
- FINDINGS w31-38 (compacted): loose ref beats stale packed-refs; A GATE
  INSIDE A CODE WAVE CAN NEVER QUALIFY (DEC-069); RECEIPT via
  `scripts/ref-state.ts` (DEC-644); A UNIVERSAL NEEDS A NEGATIVE CONTROL,
  RATCHET not allowlist (DEC-099); ASSEMBLER MINTS COLLIDING SEQS, conflict
  -> take NEITHER side, re-run (DEC-068); A BRANCH MINUTES OLD AT BASE IS
  RUNNING NOT DEAD (DEC-069 w37); verif-log sections are NEW files, never
  hand-edit the monolith; A CODE WAVE VOIDS THE BATTERY (DEC-069 w38); A
  BUDGET KEYED ON A VICTIM IS A WEAPON (DEC-072); CSRF-EXEMPT WITHOUT
  `requireCookieSession` IS BEARER-REACHABLE (DEC-027).
- FINDINGS w39-41 (compacted): LAND THE LAST OFFENDER, THEN FREEZE
  (DEC-069 w39); `--renumber` fixes seq collisions (DEC-068 w39); RESULT
  TOKEN IS PART OF THE CONTRACT — `startsWith("PASS")`, canonical scope
  literal, em-dash not hyphen (DEC-069/099 w40); ONE MACHINE, ONE HEAVY
  GATE, share `/tmp/chq-test.lock` (DEC-644 w40); LOCAL-D1 FIXUP IS A
  MEASUREMENT, A COMMITTED ONE IS A FIX (DEC-453 w40); wave 41 = SECOND
  FROZEN wave (only task-w40-a merged, rest RUNNING/unmerged), A CODE WAVE
  VOIDS A PASSING SLOT TOO (DEC-069 w41); CONTRACT NEEDS AN INSTRUMENT NOT
  A MEMO -> exit-predicate-corpus.test.ts (DEC-099 w41); clarifications.md
  (top of precedence) got its first derived test (DEC-518 w41);
  `CHQ_TEST_LOCK_HELD` guard stops nested-lock deadlock (DEC-644 w41); ONE
  FILE, ONE OWNER PER WAVE (DEC-358 w41). Verified fixed in-tree w41: all
  four review-lens alarms, task-w17-i's DEC-716 scope, plans-progress
  `total`.
- FINDINGS w42 (main `d7cfe08d` = scribe wave 41; packed `refs/heads/main`
  `42074604` still the stale trap). THE BATTERY LANDED, THE SLOT DID NOT
  (DEC-069 w42): wave-40 merged a/d/b/f/c — sections 0198 build+test+bundle,
  0199 walkthrough, 0200 spec-audit (all @ `14db7b30`) and 0201 perf-smoke
  (@ `2e99b272`) ALL read `RESULT: PASS`, and the product sha `ed5c679e` is
  an ancestor of each. Four of five slots are green; the fifth is VOID
  because the newest `triage-closure` section is 0174 @ `3564c774` (wave
  28) and no wave-40 lane ran one. NOT-SATISFIED BY A MISSING LANE IS NOT A
  LICENCE TO LAND CODE: a product byte voids four PASS readings, so wave 42
  is the THIRD frozen wave — land the slot, publish the verdict, adjudicate
  the rest. A SCOPE WORD IS A SLOT CLAIM (DEC-099 w42): `classifyScope`
  keyword-matches the header scope; advisory scopes must classify to null.
  THE PLANNER MINTS THE SEQ (DEC-068 w42): `--next-seq` collides —
  allocate at plan time (w42 used 0210-0215). ONE SECTION, ONE OWNER
  (DEC-358 w42): split the triage population by source section and SAY SO;
  0195/0197 went to a named sibling. ALREADY IN TREE, DO NOT RE-FILE:
  `test/exit-predicate-corpus.test.ts`, `CHQ_TEST_LOCK_HELD` guard +
  `test/test-lock.test.ts`, `requireCookieSession` on `src/routes/api/
  users.ts:67,138,168`. STILL UNADJUDICATED: 0195's `autoSchedule320` FAIL
  (298 unplaced vs 237 reasons) and `deleteContact` leaving
  `email_log.contact_id` dangling (crud.ts:285-302 vs merge.ts:602).
