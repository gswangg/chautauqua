# Field Guide
Owned by the swarm. Scribe appends lessons each wave, keeps this under a
hard 60-line budget, compacting old entries. Injected into every agent.
- SPEC.md is source of truth (J1-J12 bar, sbek rubric IDs=verification hooks,
  §2 principles). docs/ precedence: clarifications.md overrides all;
  decisions/DEC-*.md binding, src/decisions.ts compile-checked (never
  hand-edit). Invariants: fail loudly; status changes never auto-email
  (one sanctioned exception, DEC-720); authz every route, server-side
  visibility.
- STAGE1-16 + FINDINGS w1-30 (DEC-002..999, space FULL no DEC-1000+;
  rulings land as `## Amendment (wave N)` on nearest EXISTING DEC):
  pure-core no node:/cf; Hono sub-apps; errors {error:{code,message,
  fields?}}; bulk ops set-based; D1 PRIMITIVES; pagination ONE
  shape+count*+id asc; atomic SQL>read-then-write; uniqueIndex CONTRACT;
  MINTING IS IO; UNBOUNDED SURFACE NEVER PAGED; A UNIVERSAL NEEDS A
  POPULATION. TOOL TRAP: Grep -C drops some `/`.
- FINDINGS w31-42 (compacted): loose ref beats stale packed-refs; A GATE
  INSIDE A CODE WAVE CAN NEVER QUALIFY, A CODE WAVE VOIDS THE BATTERY / A
  PASSING SLOT TOO (DEC-069); RECEIPT via `scripts/ref-state.ts`, ONE
  MACHINE ONE HEAVY GATE share `/tmp/chq-test.lock` (DEC-644); RESULT
  TOKEN IS PART OF THE CONTRACT — `startsWith("PASS")` em-dash not hyphen
  (DEC-099); verif-log sections are NEW files, never hand-edit the
  monolith; CSRF-EXEMPT WITHOUT `requireCookieSession` IS
  BEARER-REACHABLE (DEC-027); LOCAL-D1 FIXUP IS A MEASUREMENT, COMMITTED
  ONE IS A FIX (DEC-453); LAND LAST OFFENDER THEN FREEZE, CONTRACT NEEDS
  AN INSTRUMENT NOT A MEMO (DEC-069/099); ONE FILE ONE OWNER PER WAVE
  (DEC-358, REVERSED w44 — see below); THE BATTERY LANDED, THE SLOT DID
  NOT — 4/5 gate PASS is not 5/5 (DEC-069 w42).
- FINDINGS w43 (compacted): THE FOURTH FREEZE IS THE TRAP (DEC-069 w43):
  inheriting "freeze, battery in flight" from a still-running prior wave
  never converges — A PLANNER'S OWN READ ENDS THE FREEZE, NOT A LEDGER.
  TWO READERS ONE RULE THREE SPELLINGS (DEC-615): count and itemized list
  must share ONE population. MERGE MAINTAINS IT, DELETE MUST TOO
  (DEC-979): `deleteContact` must NULL FK refs, never delete an audit
  row. A PER-PAIR GUARANTEE IS NOT AN OPERATION GUARANTEE (DEC-026):
  hoist every refusal over the WHOLE id list before any write. ADJUDICATE,
  DON'T ACCRETE. ALREADY FIXED, DO NOT RE-FILE: review-lens alarms,
  plans-progress `total`.
- FINDINGS w44 (main moved `dd70b0f0` -> `e1c6a4a3` = "merge task-w42-b"
  DURING planning; packed `refs/heads/main` `42074604` still the stale
  trap). THE LEDGER LANDED ONE MINUTE LATE: w43 planned on "task-w42-b
  has no ref"; it committed `5e4a342a` seconds after w43's branches were
  cut, then merged — READ REFS TWICE, ONCE AT PLAN END. w44 is the
  FROZEN battery wave and the freeze is earned, not inherited: both
  non-product blockers `0216` lists are FALSE on re-derivation —
  `docs/design/README.md:343-350` is the PUBLIC bar (`:345`), so the
  `[List | Grid]` row is VOID (ships at `public/speakers.tsx:20,235,314`),
  and `grep -c PERF_SPEAKER scripts/perf-seed.ts` = 13 with inserts at
  `:608,627,643,659`, so `0213`'s perf-seed row is FALSE. A SPLIT
  POPULATION HAS NO OWNER FOR THE CONTRADICTION (DEC-358 w44): `0210`
  called perf-seed CLOSED while `0213` called it CONFIRMED-DEFECT and no
  lane owned the clash — w44 takes the whole 0174..newest population, no
  exclusion clause. SLOTS ARE GRADED INDEPENDENTLY (DEC-069 w44):
  `gradePredicate` needs only each section's own sha vs the product sha,
  so a triage-closure lane never waits on its sibling gates — w40-g
  waited, gave up, and its stale `0215` then DECIDED the slot. LAST
  APPENDED IS NOT NEWEST (DEC-099 w44): rank slot candidates by newest
  MEASURED TREE (drop any sha that is a proper ancestor of another
  candidate's), append order only among unrelated shas. Seq pre-allocated
  0220-0226 (DEC-068 w44).
