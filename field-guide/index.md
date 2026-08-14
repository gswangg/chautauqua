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
- FINDINGS w34-40 (compacted, do NOT re-file). Closed defects across all seven waves; TENANT axis now covers
  PATH+BODY/QUERY (w37/w40-a). Shapes: A REDACTOR IS SHAPES NOT ONE REGEX; CSRF != AUTHZ; A PROOF NOBODY HAS
  SHOWN A VIOLATION TO IS NOT A PROOF; A THROWING DB CANNOT PROVE A REFUSAL NEEDING A READ -- use REAL ROWS
  (node:sqlite+drizzle sqlite-proxy); A 5xx IS NOT A REFUSAL; A REFUSAL THAT MUTATES IS NOT A REFUSAL; AN
  ALLOWLIST KEYED BY USER INPUT IS AN OWN-PROPERTY QUESTION; A WRITE GUARD THAT DOESN'T MATCH THE READ
  PREDICATE MINTS INVISIBLE ROWS; A PREDICATE FAMILY IS A LATTICE; A FIGURE THE API PROMISES AND A LATER WAVE
  DELETES IS A DECISION REVERSED WITHOUT A DECISION; A "NEXT" TAKING ITEM[0] OF A LIST THAT KEEPS DONE ITEMS
  NEVER TERMINATES; A ROW COUNT IS NOT A PEOPLE COUNT; A PICKER FED BY PAGE 1 CANNOT PICK; A POPULATION
  DERIVED BY PATH SHAPE IS BLIND TO THE ID IN THE BODY.
- FINDINGS w41 (compacted, do NOT re-file). CLOSED: export cap refusal narrowing (exports.ts), portal wrong-
  owner proven only via mocked resolvers, /contacts/stats double O(N) scan, /contacts/duplicates/check per-
  keystroke full scan, spa-count-source-ledger apiGet blind spot (FilesLibrary.tsx). Shapes: A REFUSAL WHOSE
  ADVICE THE CALLER CANNOT FOLLOW IS A DEAD END; A MOCKED RESOLVER PROVES THE CALL NOT THE FILTER; TWO SCANS
  FOR ONE NUMBER IS ONE TOO MANY; A SCAN'S POPULATION IS BLIND TO THE HELPER IT DIDN'T ENUMERATE; A BUNDLE
  THAT FAILS WHOLE LOSES THE PARTS THAT WORKED.
- FINDINGS w42 (verified AT THE FILE on main). The mandate's three ⚡ STRAGGLERS ARE LANDED IN CODE — EMB-01
  snippet+in-place Show more (public/cards.tsx SessionDescription), CFP close fast path ("Close the call" +
  confirm, CallForPapersPanel.tsx:313-320/459), AIA-04 cross-room speaker_overlap (domain/schedule.ts:366) with
  both-card render tests; they close on MEASUREMENT (orchestrator), NOT on a planner re-filing them. Also STALE
  and NOT re-filed: PlanEditor "applies immediately", criterion-row share column, /logout, password-reset flow,
  weighted-score caption, embed .ics picker, home landmarks, CFP create-account CTA, contacts ?tab= deep links,
  RecentSends/History one reader (templatesById now REQUIRED), portal replace-file version chain, headshot-vs-bio
  (DEC-574), CSV bio overwrite (DEC-575), pipeline/public/archive bounds. Review-lens: #1 content_status is BY
  DESIGN (overview publishedSessionCount + contentApproval worklist + walkthrough/public.ts gate checks) and #3
  `npm run deploy` is SPEC §0 STAGE 2 — neither is a defect. TAKEN: (2) isEpochMs = Number.isInteger, unbounded
  (validators.ts:60) -> 1e18 closeDate persists and 500s the public CFP forever via dayLabelToYmd; (4) only 1 of
  5 R2-serving routes asserts the served Content-Type (files.ts:644 vs portal/tasks.tsx:707/746,
  portal/profile.tsx:465, portal/tasks/resources.tsx:49). NEW: /docs/api's ~90 endpoint rows are hand-typed
  against a >100-route /api/v1 surface; the reviewer real-row probes cover cross-ORG but not same-org wrong-PLAN
  or in-plan out-of-scope.
  Shapes: AN INTEGER IS NOT A DATE — A BOUNDARY PREDICATE THAT ADMITS 1e18 SHIPS A PERMANENT 500 TO A PUBLIC
  PAGE. TWO BOUNDARY PREDICATES THAT DON'T AGREE (isEpochMs vs isIsoDate) ARE ONE MISSING INVARIANT. A
  SERIALIZER INVARIANT HELD BY THE WRITER IS HELD BY NOBODY. A HAND-TYPED API DOC IS A MANIFEST — DERIVE IT OR
  IT LIES. CROSS-ORG IS NOT CROSS-PLAN. A MANDATE ITEM CLOSES ON MEASUREMENT; RE-FILING IT BURNS A LANE.
