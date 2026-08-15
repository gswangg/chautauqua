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
  GATE share `/tmp/chq-test.lock` (DEC-644); RESULT TOKEN em-dash not
  hyphen (DEC-099); verif-log sections are NEW files, never hand-edit;
  CSRF-EXEMPT WITHOUT `requireCookieSession` IS BEARER-REACHABLE
  (DEC-027); LOCAL-D1 FIXUP IS A MEASUREMENT, COMMITTED IS A FIX
  (DEC-453); ONE FILE ONE OWNER PER WAVE (DEC-358, REVERSED w44); 4/5
  gate PASS is not 5/5 (DEC-069 w42).
- FINDINGS w43-45 (compacted): THE FOURTH FREEZE IS THE TRAP (DEC-069
  w43) sharpened by w45 to A FREEZE IS EARNED BY A SEARCH, NOT A WAIT.
  TWO READERS ONE RULE THREE SPELLINGS (DEC-615). MERGE REPOINTS, DELETE
  NULLS — SAME RULE (DEC-979): survivor exists in one case not the
  other, DO NOT RE-FILE. A PER-PAIR GUARANTEE IS NOT AN OPERATION
  GUARANTEE (DEC-026). ADJUDICATE, DON'T ACCRETE. A SPLIT POPULATION HAS
  NO OWNER FOR THE CONTRADICTION (DEC-358 w44): take the WHOLE
  population. SLOTS ARE GRADED INDEPENDENTLY (DEC-069 w44) — w40-g
  waited on siblings, its stale `0215` DECIDED the slot. LAST APPENDED
  IS NOT NEWEST (DEC-099 w44): rank by newest MEASURED TREE. A
  MALFORMED HEADER DONATES ITS VERDICT TO ITS PREDECESSOR (DEC-068 w45).
  A SLOT IS CLAIMED BY NAME AND BY LABEL (DEC-099 w45): bare `/perf/`
  misclaims non-gate sections. AN INSTRUMENT REPAIR THAT MOVES A VERDICT
  IS EVAL GAMING.
- FINDINGS w46 (refs read at my own runtime; loose `main` `8b65b63a` =
  "merge task-w44-e", packed `42074604` still the stale trap). THE FREEZE
  ENDED BY LANDING, NOT BY WAITING (DEC-069 w46): wave 44's battery IS on
  disk — `0220`-`0225` — 0220 build+test FAIL and 0225 triage FAIL ⇒ the
  w45 branch condition fires on its CODE arm. AN OWNER LINE NAMES A
  BRANCH, NOT A WAVE (DEC-358 w46): 0225's owner task-w44-g merged
  carrying only the DEC-099 recency fix, so its crash item is UNOWNED;
  same decay orphaned both eval-findings "owner: a wave-45 lane" lists.
  A MERGE-TRAIN FIX CLOSES A ROW BUT NOT ITS SECTION: `85452d06` fixed
  0220's fakeDb desync; the FAIL section survives until re-run.
  FAIL-BLIND IS NOT FAIL-LOUD (DEC-099 w46): exit-predicate rethrows git
  128 on an unresolvable ancient sha and grades NOTHING — degrade
  per-section with a warn, not per-run. A MALFORMED HEADER DONATES ITS
  VERDICT (DEC-068 w46): 9 index files fail HEADER_RE, fold into their
  predecessor — repair in the ASSEMBLER via a filename-derived synthetic
  header, NEVER hand-edit, NEVER terminate on any `## ` line (0216 uses
  `## STEP 1`/`## RESULT` sub-headers). A SNAPSHOT IS ABOUT A
  PARTICIPATION, A HEADER IS ABOUT A PERSON (DEC-258 w46). AN IP THAT
  COLLAPSES TO "unknown" IS ONE BUCKET FOR EVERYONE (DEC-949 w46) — make
  it a FAILURE budget like login's (DEC-072 w38), not an admission gate.
  Wave 47 is the FROZEN battery: five slots at one product sha, then read.
