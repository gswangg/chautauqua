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
  violations in a RATCHET not allowlist (DEC-099); ASSEMBLER MINTS
  COLLIDING SEQS, conflict -> take NEITHER side, re-run (DEC-068); A
  BRANCH MINUTES OLD AT BASE IS RUNNING NOT DEAD (DEC-069 w37); verif-log
  sections are NEW files under `docs/verification-log/index/`, never
  hand-edit the monolith; WAVE 38 A CODE WAVE VOIDS THE BATTERY (DEC-069
  w38); A BUDGET KEYED ON A VICTIM IS A WEAPON (DEC-072); CSRF-EXEMPT
  WITHOUT `requireCookieSession` IS BEARER-REACHABLE (DEC-027).
- FINDINGS w39-40 (compacted): LAND THE LAST OFFENDER, THEN FREEZE (DEC-069
  w39). A CHUNKED NARROWING IS A FAN-OUT (DEC-829). A READING TAKEN UNDER
  LOAD IS NOT A READING (DEC-644 w39). A LABEL IS NOT A MEASUREMENT
  (DEC-358 w39): discharge by READING the check. `--renumber` fixes seq
  collisions (DEC-068 w39). RESULT TOKEN IS PART OF THE CONTRACT
  (DEC-069/099 w40): `exit-predicate.ts:217` grades `startsWith("PASS")`;
  scope must be a canonical literal or `classifyScope` returns null =
  MISSING; ASCII hyphen for `—` drops a section into the PREVIOUS one's
  body. ONE MACHINE, ONE HEAVY GATE (DEC-644 w40): share the DEFAULT
  `/tmp/chq-test.lock`, never nest `npm test` inside `with-test-lock.sh`.
  SYNC BEFORE YOU NAME A SHA (DEC-069 w40). LOCAL-D1 FIXUP IS A
  MEASUREMENT, A COMMITTED ONE IS A FIX (DEC-453 w40).
- FINDINGS w41 (main `9f78158b` = merge task-w40-a atop `14db7b30` scribe
  wave 40; packed `refs/heads/main` `42074604` still the stale trap). THE
  BATTERY IS IN FLIGHT, SO THE VERDICT IS NOT IN (DEC-069 w41): only
  task-w40-a merged (PASS, 12002 tests, 69.20 kB gz); w40-b/-d committed
  unmerged; w40-c/-e/-f at base and minutes old = RUNNING. Neither branch
  of wave-40's conditional fired, so wave 41 is the SECOND FROZEN wave —
  docs/scripts/test/decisions/field-guide only. A CODE WAVE VOIDS A
  PASSING SLOT TOO: `exit-predicate.ts:201` counts a section only when the
  product sha is an ancestor of it, product = `src/ app/src/ migrations/
  package.json` (`ref-state.ts:17`), everything else allow-listed. THE
  CONTRACT NEEDS AN INSTRUMENT, NOT A MEMO (DEC-099 w41): RESULT-token/
  scope-literal/em-dash need a corpus test w/ shrink-only RATCHET plus
  fixture negative controls. TOP OF THE PRECEDENCE CHAIN HAD NO LEDGER
  (DEC-518 w41): rubric/SPEC§9/AUDIT have derived two-directional tests;
  `docs/clarifications.md`, which overrides all, had none. A TRAP YOU WARN
  ABOUT IS STILL A TRAP (DEC-644 w41): `test`/`test:full` both ARE
  `with-test-lock.sh` -> nesting deadlocks 45min; fixed w/
  `CHQ_TEST_LOCK_HELD`, inline + loud, never release the outer lock. ONE
  FILE, ONE OWNER PER WAVE (DEC-358 w41): rebase lane may change an OWNER
  label (plan fact), never discharge status (verification fact). Verified
  fixed in-tree, do not re-file: all four review-lens alarms, task-w17-i's
  DEC-716 scope, plans-progress `total`.
