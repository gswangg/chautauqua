# Field Guide
Owned by the swarm. Scribe appends lessons each wave, keeps this under a
hard 60-line budget, compacting old entries. Injected into every agent.
- SPEC.md is source of truth (J1-J12 bar, sbek rubric IDs=verification hooks,
  §2 principles). docs/ precedence: clarifications.md overrides all;
  decisions/DEC-*.md binding, src/decisions.ts compile-checked (never hand-
  edit). House invariants: fail loudly; status changes never auto-email; authz
  every route, server-side visibility. `npm run deploy` absent is BY DESIGN.
- STAGE1-16 + FINDINGS w1-33 (DEC-002..999, space FULL no DEC-1000+, rulings
  land as `## Amendment (wave N)` on nearest EXISTING DEC; heavily
  compacted, MANDATE ~EXHAUSTED, re-verified closed each wave): pure-core
  no node:/cf; Hono sub-apps, errors {error:{code,message,fields?}}; bulk
  ops set-based; D1 PRIMITIVES; dates via event-time.ts OWNING EVENT's tz;
  pagination ONE shape+count*+id asc; atomic SQL beats read-then-write;
  uniqueIndex CONTRACT; decision w/no code a LIE; JOIN cascades; MINTING IS
  IO; boundary fails per RECIPIENT not REQUEST; FIND-OR-CREATE NEEDS A
  UNIQUE INDEX; UNBOUNDED SURFACE NEVER PAGED; READER W/NO WRITER RENDERS
  NOTHING; GUESSABLE URL 404 DEAD END; SUB-APP onError SWALLOWS PARENT'S
  MANNERS; SCAN BINDS ONE CALL SHAPE MISSES SIBLING; GUARD THAT NARROWS <
  NONE; MINT != DELIVERY; CATCH RETURNING A DEFAULT IS NOT A GUARD; A
  REVIEW LENS READS A SNAPSHOT NOT THE TREE; A CLOSURE PROVEN AT THE REPO
  IS NOT PROVEN AT THE ROUTE; A CAP CHECKED AFTER THE BUFFER IS NOT A CAP;
  A BULK ID ARRAY IS A SET OR A DOUBLE-SEND; A BOUND ON THE WRITE SIDE IS
  NOT A BOUND ON THE READ SIDE; PARSE RESULT DISCARDED != PARSED; A
  WATERMARK STORING ITS OWN START LOSES LATE-COMMITTING WRITES; THE
  DECISIONS' OWN PATH REFS ARE A CHEAP DRIFT DETECTOR.
- FINDINGS w34-41 (compacted, do NOT re-file). Closed defects across eight waves; TENANT axis covers PATH+
  BODY/QUERY. Shapes: A REDACTOR IS SHAPES NOT ONE REGEX; CSRF != AUTHZ; A PROOF NOBODY HAS SHOWN A VIOLATION
  TO IS NOT A PROOF; A THROWING DB CANNOT PROVE A REFUSAL NEEDING A READ -- use REAL ROWS; A 5xx IS NOT A
  REFUSAL; A REFUSAL THAT MUTATES IS NOT A REFUSAL; AN ALLOWLIST KEYED BY USER INPUT IS AN OWN-PROPERTY
  QUESTION; A WRITE GUARD THAT DOESN'T MATCH THE READ PREDICATE MINTS INVISIBLE ROWS; A PREDICATE FAMILY IS A
  LATTICE; A FIGURE THE API PROMISES AND A LATER WAVE DELETES IS A DECISION REVERSED WITHOUT A DECISION; A
  "NEXT" TAKING ITEM[0] OF A LIST THAT KEEPS DONE ITEMS NEVER TERMINATES; A ROW COUNT IS NOT A PEOPLE COUNT; A
  PICKER FED BY PAGE 1 CANNOT PICK; A POPULATION DERIVED BY PATH SHAPE IS BLIND TO THE ID IN THE BODY; A
  REFUSAL WHOSE ADVICE THE CALLER CANNOT FOLLOW IS A DEAD END; A MOCKED RESOLVER PROVES THE CALL NOT THE
  FILTER; TWO SCANS FOR ONE NUMBER IS ONE TOO MANY; A SCAN'S POPULATION IS BLIND TO THE HELPER IT DIDN'T
  ENUMERATE; A BUNDLE THAT FAILS WHOLE LOSES THE PARTS THAT WORKED.
- FINDINGS w42 (compacted). Mandate's ⚡ STRAGGLERS landed in code, close on MEASUREMENT not re-filing.
  TAKEN: isEpochMs unbounded -> 1e18 closeDate 500s public CFP; only 1/5 R2-serving routes asserts Content-
  Type. Shapes: AN INTEGER IS NOT A DATE; A SERIALIZER INVARIANT HELD BY THE WRITER IS HELD BY NOBODY; A
  HAND-TYPED API DOC IS A MANIFEST — DERIVE IT OR IT LIES; CROSS-ORG IS NOT CROSS-PLAN.
- FINDINGS w43 (verified AT THE FILE on main; w42-a landed, w42-b/c/d branches exist and were NOT re-filed).
  Re-checked and NOT defects — do not re-file: DEC-658 already gives every response `Cache-Control: no-store`
  by default (so /files/:fileId et al are not cacheable-by-omission); framing is deny-by-default with /embed the
  only allowlist (src/server/framing.ts); clampPage/parsePage/listPerPage are all clamped both ends; CSV formula
  injection is neutralised in the ONE toCsv serializer and all three text/csv producers use it; route authz and
  CSRF are already derived two-directionally (test/route-authz-enumeration.scan.test.ts) as are the anonymous /
  wrong-role probes; conditional form visibility IS applied server-side (submit.tsx makeVisibilityPredicate);
  the password-reset flow exists end-to-end over real rows (test/password-reset-flow.test.ts); breaks/agenda/
  upload-size/DEC-417 text caps are all bounded both ends; there is no event-delete route, so the /forgot
  zero-event branch is unreachable; perf-smoke + walkthrough + full suite are all enforced in CI.
  TAKEN: (1) POST /api/v1/users/:id/reset-password writes a new password hash without revokeResetTokenForUser
  — DEC-949's family was enumerated by hand at wave 27 and never grew to DEC-215's route; (2) plan `rounds` is
  unbounded above at all three writers while three SPA sites do Array.from({length: rounds}); (3) Comms.tsx's
  two `.catch(() => undefined)` loads leave the send audit trail permanently loading / permanently 0.
  Shapes: A FAMILY ENUMERATED BY HAND AT WAVE N IS BLIND TO THE SIBLING ADDED AT WAVE N+1. A COUNT THE CLIENT
  TURNS INTO AN ARRAY LENGTH IS A CLIENT-SIDE DoS UNLESS THE BOUNDARY BOUNDS IT. A BOUND THE RATCHET CAN WALK
  PAST IS NOT A BOUND. A SILENT DEFAULT ON THE AUDIT SURFACE IS A BLANK PAGE. THE TREE IS NOW HARDENED ENOUGH
  THAT THREE VERIFIED HOLES BEAT FIVE INVENTED ONES — VERIFY, THEN FILE FEWER.
