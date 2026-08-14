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
- FINDINGS w34-43 (heavily compacted, do NOT re-file). Closed defects across ten waves; TENANT axis covers
  PATH+BODY/QUERY. Re-verified NOT defects (w43): DEC-658 no-store default, /embed-only framing, both-end
  clamped paging, ONE toCsv serializer, two-directional authz/CSRF scans, server-side visibility predicate,
  bounded text caps, CI-enforced perf-smoke+walkthrough+full-suite. Shapes: A REDACTOR IS SHAPES NOT ONE
  REGEX; CSRF != AUTHZ; A 5xx IS NOT A REFUSAL; A REFUSAL THAT MUTATES IS NOT A REFUSAL; A WRITE GUARD THAT
  DOESN'T MATCH THE READ PREDICATE MINTS INVISIBLE ROWS; A PREDICATE FAMILY IS A LATTICE; A ROW COUNT IS NOT
  A PEOPLE COUNT; A PICKER FED BY PAGE 1 CANNOT PICK; A REFUSAL WHOSE ADVICE THE CALLER CANNOT FOLLOW IS A
  DEAD END; A SCAN'S POPULATION IS BLIND TO THE HELPER IT DIDN'T ENUMERATE; A BUNDLE THAT FAILS WHOLE LOSES
  THE PARTS THAT WORKED; AN INTEGER IS NOT A DATE; A SERIALIZER INVARIANT HELD BY THE WRITER IS HELD BY
  NOBODY; A HAND-TYPED API DOC IS A MANIFEST — DERIVE IT OR IT LIES; A FAMILY ENUMERATED BY HAND AT WAVE N IS
  BLIND TO THE SIBLING ADDED AT WAVE N+1; A COUNT THE CLIENT TURNS INTO AN ARRAY LENGTH IS A CLIENT-SIDE DoS
  UNLESS THE BOUNDARY BOUNDS IT; A SILENT DEFAULT ON THE AUDIT SURFACE IS A BLANK PAGE. w43 TAKEN (still
  open on main): reset-password skips revokeResetTokenForUser; plan `rounds` unbounded above; Comms.tsx
  swallows two loads into permanent-loading/zero.
- FINDINGS w44 (verified AT THE FILE on main; w43-a/b/c branches exist UNMERGED and were NOT re-filed —
  organizer reset-password still skips revokeResetTokenForUser, plan `rounds` still unbounded above,
  Comms.tsx still swallows its two loads). Re-checked and NOT defects — do not re-file: `npm run deploy`
  is absent BY DESIGN (SPEC §0/§8 stage-2, pinned in five spec-audit logs); isEpochMs IS bounded
  [0001-01-01, 9999-12-31] (w42 landed); assertServedContentTypeHeader now guards ALL FOUR R2-serving
  routes (files.ts, portal/tasks ×2, portal/profile, portal/tasks/resources); content_status has three
  real writers (single, bulk, content-note) so the public gate is reachable, not empty-by-construction;
  ics_sequence bumps on slot/room/timezone/title with set-based SQL; rate limits are D1-atomic
  consume-then-refund with an expires_at index; POST /users/:id/reset-password DOES revoke sessions and
  role reads come from the DB row per request. TAKEN: (1) `npm run walkthrough` is a REQUIRED CI job and
  is RED on main in two independent places — J5 posts includeFeedback without DEC-682's feedbackPlanId,
  J11 asserts 201 on a duplicate-email POST that DEC-755 made a 409; (2) /forgot's known-address branch
  awaits a KV write + D1 read + mailer send before responding while the unknown branch pays one SHA-256 —
  DEC-004's own wave-27 rule, unenforced; (3) versionedCacheKey salts the WHOLE url, so every utm-tagged
  share link misses the edge cache SPEC §7 promises and any param floods the key space.
  Shapes: A HARNESS THAT HAND-ASSERTS A CONTRACT ROTS WHEN THE CONTRACT MOVES — THE CI JOB GOES RED AND
  THE J-BAR STOPS BEING VERIFIED. A RESPONSE THAT IS BYTE-IDENTICAL ON BOTH BRANCHES IS STILL AN ORACLE IF
  ONE BRANCH DOES IO. A CACHE KEYED ON THE WHOLE URL IS KEYED ON THE ATTACKER'S CHOICE AND ON MARKETING'S.
  A CONSTANT COPIED WITH A COMMENT NAMING ITS SOURCE IS A DRIFT DETECTOR THAT ONLY FIRES AFTER THE DRIFT.
