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
- FINDINGS w34-38 (compacted, do NOT re-file). Closed defects across all four waves; TENANT axis now
  covers PATH params (w37) but BODY/QUERY ids were open until w40-a below. Shapes: A REDACTOR IS SHAPES
  NOT ONE REGEX; CSRF != AUTHZ; A PROOF NOBODY HAS SHOWN A VIOLATION TO IS NOT A PROOF; A THROWING DB
  CANNOT PROVE A REFUSAL NEEDING A READ -- use REAL ROWS (node:sqlite+drizzle sqlite-proxy); A 5xx IS
  NOT A REFUSAL; A REFUSAL THAT MUTATES IS NOT A REFUSAL; AN ALLOWLIST KEYED BY USER INPUT IS AN OWN-
  PROPERTY QUESTION; A WRITE GUARD THAT DOESN'T MATCH THE READ PREDICATE MINTS INVISIBLE ROWS; A
  PREDICATE FAMILY IS A LATTICE: spot-check one, drift all.
- FINDINGS w39-40 (compacted, do NOT re-file). CLOSED: MergePage page-1 scan past group 200; Scorecard
  page-vs-envelope count + submitAndAdvance item[0] non-terminating loop; DuplicatesView page-length under
  org-total header; PlanEditor reviewers.length vs progress endpoint total; EnrollDialog perPage=200 picker.
  TENANT axis now covers PATH+BODY/QUERY. Shapes: A FIGURE THE API PROMISES AND A LATER WAVE DELETES IS A
  DECISION REVERSED WITHOUT A DECISION; A RULING BINDS THE ENDPOINT NOT THE COMPONENT THAT PROMPTED IT; A
  "NEXT" TAKING ITEM[0] OF A LIST THAT KEEPS DONE ITEMS NEVER TERMINATES; A ROW COUNT IS NOT A PEOPLE COUNT;
  A PICKER FED BY PAGE 1 CANNOT PICK; A POPULATION DERIVED BY PATH SHAPE IS BLIND TO THE ID IN THE BODY.
- FINDINGS w41 (verified AT THE FILE on main; w40's b/c LANDED — Scorecard envelope+terminating advance,
  pipeline enroll search — while w40 a/d/e were still in flight and are NOT re-filed; the four review-lens
  claims (files.ts prototype allowlist, tasks assign guard, ReviewerQueue paging, cron narrowing) are ALL
  STALE — closed at files.ts:103, tasks.ts:437, ReviewerQueue.tsx:117, reminders.ts:637-687).
  NEW, taken: (1) export cap refusals for email-log/evaluations name no narrowing at all (exports.ts:126-134
  hints only submissions/contacts) — at J5/J4 volumes both cross EXPORT_MAX_ROWS=20000 and J12 fails for the
  biggest customer; listEmailLog(email.ts:149) is the predicate to REUSE. (2) portal wrong-owner is proven
  only against MOCKED resolvers (portal-idor-probe.test.ts) — the cross-org probes' own header names why
  that is not proof. (3) /contacts/stats re-runs findDuplicateGroupsForOrg (stats.ts:83) for a number the
  rail's own envelope already carries (ContactsApp.tsx:223 discards res.total): two O(N) scans per mount, and
  the scan's refusal takes the whole headline down. (4) /contacts/duplicates/check scans the entire directory
  per keystroke-settle and refuses past 20k — the hint dies when it matters. (5) spa-count-source-ledger's
  population is apiList-only and its prose falsely claims MergePage is the ONE apiGet-envelope reader
  (FilesLibrary.tsx:73 is another).
  Shapes: A REFUSAL WHOSE ADVICE THE CALLER CANNOT FOLLOW IS A DEAD END, NOT A GUARD. A MOCKED RESOLVER
  PROVES THE CALL, NOT THE FILTER. TWO SCANS FOR ONE NUMBER IS ONE SCAN TOO MANY — AND ITS REFUSAL TAKES
  HOSTAGES. A CHECK ABOUT ONE ROW THAT READS EVERY ROW. A SCAN'S POPULATION IS BLIND TO THE HELPER IT
  DIDN'T ENUMERATE; A FALSE SENTENCE IN A SCAN'S OWN PROSE IS A DECISION WITH NO CODE. A BUNDLE THAT FAILS
  WHOLE LOSES THE PARTS THAT WORKED.
