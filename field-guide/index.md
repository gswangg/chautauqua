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
  INSIDE A CODE WAVE CAN NEVER QUALIFY (DEC-069); A RECEIPT NAMES THREE
  SHAS / IS GENERATED via `scripts/ref-state.ts` (DEC-644); A UNIVERSAL
  NEEDS A NEGATIVE CONTROL, violations in a RATCHET not allowlist
  (DEC-099); ASSEMBLER MINTS COLLIDING SEQS BY CONSTRUCTION, conflict ->
  take NEITHER side, re-run assembler (DEC-068); A BRANCH MINUTES OLD AT
  ITS BASE IS RUNNING NOT DEAD (DEC-069 w37); verification-log sections
  are NEW files under `docs/verification-log/index/`, never hand-edit the
  monolith; WAVE 38 A CODE WAVE VOIDS THE BATTERY (DEC-069 w38); A BUDGET
  KEYED ON A VICTIM IS A WEAPON (DEC-072); CSRF-EXEMPT WITHOUT
  `requireCookieSession` IS BEARER-REACHABLE (DEC-027).
- FINDINGS w39 (compacted): LAND THE LAST KNOWN OFFENDER, THEN FREEZE
  (DEC-069 w39): wave 39 = last code wave, wave 40 = frozen battery. A
  CHUNKED NARROWING IS A FAN-OUT (DEC-829): join in the match's own WHERE
  rather than feeding ids back as inArray. A READING TAKEN UNDER LOAD IS
  NOT A READING (DEC-644 w39): fix lane never takes its own closing
  measurement, landing evidence is a statement-count test. A LABEL IS NOT
  A MEASUREMENT (DEC-358 w39): discharge by READING the check. THE
  COLLISION IS PERMANENT, THE REMEDY IS A COMMAND (DEC-068 w39):
  `--renumber` replaces merge-train hand-edits.
- FINDINGS w40 (main `57f683ce` = merge task-w39-c atop scribe wave 39;
  wave-38 lanes ALL merged and all four defects verified fixed in-tree;
  wave-39 a/b/d/e at base `ee5f73d4`, minutes old -> RUNNING, scope NOT
  re-filed). THE RESULT TOKEN IS PART OF THE CONTRACT (DEC-069 w40):
  `exit-predicate.ts:217` grades `result.startsWith("PASS")`, so wave-36's
  `RESULT: QUALIFYING` graded FAIL and that slot could never read satisfied
  — QUALIFYING is a BODY line, never the RESULT token; scope strings must be
  the literals build+test+bundle / walkthrough / perf-smoke / spec-audit /
  triage-closure or `classifyScope` returns null and the slot reads MISSING.
  A HEADER TYPO IS A SILENT DROP (DEC-099 w40): an ASCII hyphen for `—`
  makes a whole section parse as the PREVIOUS section's body; the corpus
  test's shrink-only RATCHET is the only thing that notices. ONE MACHINE,
  ONE HEAVY GATE (DEC-644 w40): all gate phases take the DEFAULT
  `/tmp/chq-test.lock` so perf is timed on a quiet box — and NEVER nest
  `npm test`/`test:full` inside `with-test-lock.sh`, it deadlocks on its own
  lock. SYNC BEFORE YOU NAME A SHA (DEC-069 w40): `git merge --no-edit main`,
  poll while any `task-w39-*` ref is a non-ancestor, then name HEAD.
  A LOCAL-D1 FIXUP IS A MEASUREMENT, A COMMITTED ONE IS A FIX (DEC-453 w40).
