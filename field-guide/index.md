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
  WATERMARK STORING ITS OWN START LOSES LATE-COMMITTING WRITES -- read
  back, stamp forward; THE DECISIONS' OWN PATH REFS ARE A CHEAP DRIFT
  DETECTOR.
- FINDINGS w34-36 (compacted, do NOT re-file): redactCredentialUrls, consume-before-validate reset,
  CFP via renderEmailHtml, route-authz GUARD_NAMES split, parseBoundedIdArray, resolveBaseUrl Host
  guard, CSV formula injection closed. Shapes: A REDACTOR IS A SET OF SHAPES NOT ONE REGEX; CONSUME-
  BEFORE-VALIDATE TURNS A TYPO INTO A DEAD LINK; A CSRF CHECK IS NOT AN AUTHZ CHECK; A PROOF NOBODY HAS
  SHOWN A VIOLATION TO IS NOT A PROOF -- ship a NEGATIVE CONTROL; WRONG-ROLE/NO-ROLE MISS WRONG-OWNER;
  A PER-IDENTITY BUCKET IS NOT A BUDGET; CURRENT-TENSE PROSE IS A LIE WITH A TIMESTAMP; GREPPING A
  MODULE FOR AN IDENTIFIER PROVES AN IMPORT, NOT A PAINT.
- FINDINGS w37 (verified AT THE FILE). CLOSED, do NOT re-file: /forgot spends both IP+per-identity
  buckets; reset tokens newest-only + revoked on other password paths; markdown escape-FIRST; byte
  routes nosniff+attachment; criteria-row 6th track, CFP-builder Save/close-now, EMB-01, agenda aria-
  label, publish {placed,public,heldBack}, useCurrentEvent self-heal, session expiry middleware.ts:71.
  OPEN, taken w37: TENANT axis is SPOT-CHECKED not ENUMERATED (SPA event context is client-controlled).
  Shapes: A MOCKED RESOLVER PROVES THE ROUTE CALLS IT, NOT THAT IT FILTERS. A THROWING DB CANNOT PROVE
  A REFUSAL NEEDING A READ -- use REAL ROWS (node:sqlite+drizzle sqlite-proxy). SPOT-CHECKED IS NOT
  ENUMERATED. A 5xx IS NOT A REFUSAL. A REFUSAL THAT MUTATES IS NOT A REFUSAL. For byte routes: assert
  the STORE WAS NEVER ASKED for the foreign key. Rejected: text-scan ownership-predicate proofs --
  the convention is load-then-check behind an org-scoped resolver, probed at the ROUTE.
- FINDINGS w38 (verified AT THE FILE). Four review-lens defects CONFIRMED OPEN and taken: (1) `ext in
  DOCUMENT_EXT_CONTENT_TYPE` walks Object.prototype -- `deck.constructor` clears validateUpload
  UNAUTHENTICATED via public CFP (src/domain/files.ts:187/194/201/208/375); (2) POST /tasks/:id/assign
  validates ORG membership while the grid lists ROSTER and reminders chase CHASEABLE -> 200 plus an
  invisible, never-chased row; (3) ReviewerQueue.tsx fetches with no perPage, clamped to 200, prints
  the page as the whole queue (no pager, envelope `total` discarded); (4) sendDueRemindersForEvent
  reads listOutstandingForEvent UNFILTERED, throws past MAX_REMINDER_SCAN with advice its only caller
  (the cron) cannot take, then runDueReminders buries the event in failedEventIds forever.
  Shapes: AN ALLOWLIST KEYED BY USER INPUT IS AN OWN-PROPERTY QUESTION -- `in` is a prototype walk. A
  WRITE GUARD THAT DOESN'T MATCH THE READ PREDICATE MINTS INVISIBLE ROWS. A CLIENT THAT COUNTS ITS PAGE
  LIES ABOUT THE WHOLE -- counts come off the envelope, BEFORE the slice. A REFUSAL WHOSE REMEDIATION
  NAMES A PARAMETER THE CALLER CANNOT SUPPLY IS A BUG IN THE CALLER -- bound the READ, never reject the
  pass. A PREDICATE FAMILY IS A LATTICE: spot-check one, drift all.
  Re-verified CLOSED: mailer MIME, portal replace-file version chains, CFP-05 CTA, results caption,
  no `#day` anchors. docs/eval-findings.md residue list ~EXHAUSTED -- verify AT THE FILE before filing.
