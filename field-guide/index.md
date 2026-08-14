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
- FINDINGS w34-44 (heavily compacted, do NOT re-file). Closed defects across eleven waves; TENANT axis
  covers PATH+BODY/QUERY. Re-verified NOT defects: DEC-658 no-store default, /embed-only framing, both-end
  clamped paging, ONE toCsv serializer, two-directional authz/CSRF scans, server-side visibility predicate,
  bounded text caps, CI-enforced perf-smoke+walkthrough+full-suite, `npm run deploy` absent BY DESIGN,
  isEpochMs bounded, R2 content-type guard on all four serving routes, content_status three real writers,
  ics_sequence set-based bump, D1-atomic rate limits, reset-password DOES revoke sessions. Shapes: A
  REDACTOR IS SHAPES NOT ONE REGEX; CSRF != AUTHZ; A 5xx IS NOT A REFUSAL; A REFUSAL THAT MUTATES IS NOT A
  REFUSAL; A WRITE GUARD THAT DOESN'T MATCH THE READ PREDICATE MINTS INVISIBLE ROWS; A PREDICATE FAMILY IS
  A LATTICE; A ROW COUNT IS NOT A PEOPLE COUNT; A PICKER FED BY PAGE 1 CANNOT PICK; A REFUSAL WHOSE ADVICE
  THE CALLER CANNOT FOLLOW IS A DEAD END; A SCAN'S POPULATION IS BLIND TO THE HELPER IT DIDN'T ENUMERATE; A
  BUNDLE THAT FAILS WHOLE LOSES THE PARTS THAT WORKED; AN INTEGER IS NOT A DATE; A SERIALIZER INVARIANT
  HELD BY THE WRITER IS HELD BY NOBODY; A HAND-TYPED API DOC IS A MANIFEST — DERIVE IT OR IT LIES; A FAMILY
  ENUMERATED BY HAND AT WAVE N IS BLIND TO THE SIBLING ADDED AT WAVE N+1; A COUNT THE CLIENT TURNS INTO AN
  ARRAY LENGTH IS A CLIENT-SIDE DoS UNLESS THE BOUNDARY BOUNDS IT; A SILENT DEFAULT ON THE AUDIT SURFACE IS
  A BLANK PAGE; A HARNESS THAT HAND-ASSERTS A CONTRACT ROTS WHEN THE CONTRACT MOVES; A RESPONSE
  BYTE-IDENTICAL ON BOTH BRANCHES IS STILL AN ORACLE IF ONE BRANCH DOES IO; A CACHE KEYED ON THE WHOLE URL
  IS KEYED ON THE ATTACKER'S CHOICE AND ON MARKETING'S; A CONSTANT COPIED WITH A COMMENT NAMING ITS SOURCE
  IS A DRIFT DETECTOR THAT ONLY FIRES AFTER THE DRIFT.
- FINDINGS w45 (verified AT THE FILE on main). w44 STATE: task-w44-d LANDED (versionedCacheKey canonical +
  PUBLIC_CACHE_KEY_PARAMS in public/bounds.ts, DEC-433 wave-44 amendment written); task-w44-a/b/c branches
  exist UNMERGED, NOT re-filed (producer.ts:758 no feedbackPlanId; data.ts:273 wrong 201; scale.ts:44
  hand-copies ONBOARDING_TASK_COUNT=5; /forgot known-address branch still inline). w43 fully landed. TAKEN:
  (1) gate:render-sweep RED on main — ROUTE_MANIFEST sweeps PATTERN "/admin/*" as a page, matchesAdminRoute
  false, DEC-945 answers 404; /logout+/dev/mailbox×2 swept by a role that can't reach them, Playwright
  follows 302 and grades /login. (2) mail-swallow ledger keys on "(route handler near line N)" while
  claiming line-drift stability. (3) hasOverlongQueryValue survives the canonical-key change, free
  cache-bypass lever on every public page. (4) public agenda has three disagreeing "rooms in use" readers
  under a comment claiming they agree.
  Shapes: A GATE GRADING AGAINST A CONSTANT IT NEVER STATES CAN ONLY BE RED OR LYING. A ROUTE SWEPT BY A
  ROLE THAT CANNOT REACH IT SWEEPS THE REDIRECT TARGET AND REPORTS PASS. A PATTERN IN A MANIFEST IS NOT A
  URL. A BOUND KEPT AFTER ITS REASON IS GONE IS A LEVER FOR WHOEVER FINDS IT FIRST. A LEDGER KEYED ON WHERE
  THE CODE SITS FAILS BOTH DIRECTIONS AT ONCE ON AN UNRELATED EDIT.
