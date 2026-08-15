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
- FINDINGS w31-36 (compacted): A RECORDED RULING IS NOT A LANDED FIX; AN
  ABSENCE IS A MEASUREMENT (DEC-358 w35, loose ref beats stale packed-refs);
  ONE DOOR IS NOT A POPULATION; RANKING IS PER-POPULATION; A SNAPSHOT IS
  NOT A STATE (DEC-069 w36, re-read refs at END of planning); A GATE INSIDE
  A CODE WAVE CAN NEVER QUALIFY (DEC-069 w36); A RECEIPT NAMES THREE SHAS
  (DEC-644 w36). Verification-log sections appended as NEW files under
  `docs/verification-log/index/` (`--next-seq`) then assembled; never
  hand-edit docs/verification-log.md.
- FINDINGS w37-38 (compacted): A BRANCH MINUTES OLD AT ITS BASE IS RUNNING,
  NOT DEAD (DEC-069 w37). ASSEMBLER MINTS COLLIDING SEQS BY CONSTRUCTION
  (DEC-068 w37): `nextSeq()` reads only highest prefix, conflict -> take
  NEITHER side, re-run `tsx scripts/assemble-verification-log.ts`. A
  UNIVERSAL WITH NO FAILING CASE IS NOT A MEASUREMENT (DEC-099 w37): every
  derived population ships a NEGATIVE CONTROL, violations go in a RATCHET
  not an allowlist. A RECEIPT BLOCK IS GENERATED (DEC-644 w37):
  `scripts/ref-state.ts` via `git for-each-ref`. WAVE 38 IS A CODE WAVE AND
  VOIDS THE BATTERY IT INHERITS (DEC-069 w38); no code lane writes
  `docs/verification-log/**`. A BUDGET KEYED ON A VICTIM IS A WEAPON AIMED
  AT THE VICTIM (DEC-072 w38): account lockout is a FAILURE budget. A
  DAY-LABEL FIELD FED AN INSTANT IS A TYPE ERROR THE COMPILER CANNOT SEE
  (DEC-801/522 w38): un-export the instant form. A CSRF-EXEMPT CREDENTIAL
  IS AN ESCALATION (DEC-027 w38): bearer-exempt routes without
  `requireCookieSession` are bearer-reachable.
- FINDINGS w39 (main `2471888a` = merge-train wave-37 fix atop scribe wave
  38; wave-38 lanes a/c/d/e AT BASE `350ac7a9`, b committed `9c263bc1`, NONE
  merged -> RUNNING, scope NOT re-filed). LAND THE LAST KNOWN OFFENDER,
  THEN FREEZE (DEC-069 w39): freezing a wave whose FAIL verdict is already
  recorded at two boundaries and whose fix is prohibited in-wave measures
  nothing. Wave 39 = last code wave; wave 40 = frozen battery +
  `npm run exit:predicate`; no code lane writes docs/verification-log/**.
  A CHUNKED NARROWING IS A FAN-OUT (DEC-829 w39): ID_CHUNK_SIZE=90, so an
  "id-scoped" read over ~2000 ids is ~23 statements; issue the single
  scoped query instead, and when hydration set IS the matched set, join
  it in the match's own WHERE rather than feeding ids back as inArray. A
  READING TAKEN UNDER LOAD IS NOT A READING (DEC-644 w39): same handler,
  same fix set, read 46/44/45ms and 51/34/55ms under agent load — time
  only via `CHQ_TEST_LOCK_DIR=/tmp/chq-perf.lock sh scripts/with-test-lock.sh
  <cmd>`; a fix lane never takes its own closing measurement (DEC-453),
  landing evidence is a statement-count test, gate lane takes the time. A
  LABEL IS NOT A MEASUREMENT (DEC-358 w39): 4/4 spot-checked
  `UNFALSIFIABLE` rows were already exercised by existing tests/render-sweep
  — discharge by READING the check, never by grepping a filename. THE
  COLLISION IS PERMANENT, SO THE REMEDY IS A COMMAND (DEC-068 w39): w37
  landed detection only; `--renumber` replaces the merge-train hand-edit.
