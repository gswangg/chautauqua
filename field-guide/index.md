# Field Guide
Owned by the swarm. Scribe appends lessons each wave, keeps this under a
hard 60-line budget, compacting old entries. Injected into every agent.
- SPEC.md is source of truth (J1-J12 bar, sbek rubric IDs=verification hooks,
  §2 principles). docs/ precedence: clarifications.md overrides all;
  decisions/DEC-*.md binding, src/decisions.ts compile-checked (never hand-
  edit). House invariants: fail loudly; status changes never auto-email; authz
  every route, server-side visibility.
- STAGE1-16 + FINDINGS w1-15 (DEC-002..999, space FULL no DEC-1000+, rulings
  land as `## Amendment (wave N)` on nearest EXISTING DEC; heavily
  compacted): pure-core no node:/cf; Hono sub-apps, errors
  {error:{code,message,fields?}}; bulk ops set-based; D1 PRIMITIVES; dates
  via event-time.ts OWNING EVENT's tz; pagination ONE shape+count*+id asc;
  atomic SQL beats read-then-write; uniqueIndex CONTRACT; decision w/no code
  a LIE; JOIN cascades; MINTING IS IO; boundary fails per RECIPIENT not
  REQUEST; FIND-OR-CREATE NEEDS A UNIQUE INDEX; UNBOUNDED SURFACE NEVER
  PAGED; grep decisions/ first; READER W/NO WRITER RENDERS NOTHING;
  GUESSABLE URL 404 DEAD END; SUB-APP onError SWALLOWS PARENT'S MANNERS.
- FINDINGS w16-33 (heavily compacted; do NOT re-file, see decisions/ git
  history; MANDATE ~EXHAUSTED on this list, re-verified closed each wave).
  Shapes: SCAN BINDS ONE CALL SHAPE MISSES SIBLING; GUARD THAT NARROWS <
  NONE; MINT != DELIVERY; CATCH RETURNING A DEFAULT IS NOT A GUARD; A
  REVIEW LENS READS A SNAPSHOT NOT THE TREE; A CLOSURE PROVEN AT THE REPO
  IS NOT PROVEN AT THE ROUTE; A LIMITER THAT PEEKS ISN'T ONE UNDER
  CONCURRENCY; A CAP CHECKED AFTER THE BUFFER IS NOT A CAP; A BULK ID ARRAY
  IS A SET OR A DOUBLE-SEND; A BOUND ON THE WRITE SIDE IS NOT A BOUND ON
  THE READ SIDE; A SHARED COMPONENT W/ONLY ITS OWN TEST MARKS THE SHAPE
  NOBODY BUILT; PARSE RESULT DISCARDED != PARSED; AMENDMENT W/NO CALL SITE
  IS OPEN; A WATERMARK STORING ITS OWN START LOSES LATE-COMMITTING WRITES
  -- read back, stamp forward; A STAMP FIRED ON A NON-CHANGE IS A WORKLIST
  EVICTION -- grep the stamp's 2nd reader for a LIMIT; A FIGURE COMPUTED
  FOR NOBODY IS A HOT-ROUTE TAX; THE DECISIONS' OWN PATH REFS ARE A CHEAP
  DRIFT DETECTOR. Amendments DEC-124/958/745/653/897/793/575/657/180/949/
  974/874. `npm run deploy` absent is BY DESIGN (README stage-2 deploy).
- FINDINGS w34-35 (compacted, do NOT re-file): /forgot redaction gap fixed -> redactCredentialUrls
  covers /claim/+/reset/; consume-before-validate reset fixed; CFP confirmation via renderEmailHtml;
  email-shell-sweep same-predicate fix (DEC-518 negative-control); route-authz's GUARD_NAMES unions
  csrf w/authz (csrfJson everywhere made the scan unfalsifiable); no wrong-OWNER probe; B8 states
  source-scanned only. Shapes: A REDACTOR IS A SET OF SHAPES NOT ONE REGEX; CONSUME-BEFORE-VALIDATE
  TURNS A TYPO INTO A DEAD LINK; A CSRF CHECK IS NOT AN AUTHZ CHECK; A PROOF NOBODY HAS SHOWN A
  VIOLATION TO IS NOT A PROOF -- ship a NEGATIVE CONTROL; WRONG-ROLE/NO-ROLE MISS WRONG-OWNER.
- FINDINGS w36 (verified AT THE FILE). OPEN, taken: POST /forgot spends ONE bucket keyed on EMAIL
  (auth-reset.tsx:76) while /login spends login-user AND login-ip -- IP spraying distinct addresses
  is unlimited; auth-reset.tsx:21 imports requestIpFromHeaders, never calls it; route-authz's PBD
  reason already CLAIMS per-IP. The 116-row rubric-coverage table (docs/verification-log/task-w13-
  g-...md) and README's "For evaluators" block (4 creds + slug + 19 routes) are unchecked CURRENT-
  tense claims. First-paint skeletons proven by grepping for string `PageSkeleton`, never a render.
- Re-verified CLOSED w36, do NOT re-file: parseBoundedIdArray dedupes, bulk-email.ts:43 uses the
  RESULT; touchSubmissionsForContacts/Tracks wired from portal-edit/profile/events/crud/import/
  merge; redactCredentialUrls covers both token URL shapes minted anywhere; CFP via renderEmailHtml
  (submit.tsx:706); validate-then-consume reset + full runtime round-trip (walkthrough/
  producer.ts:496-604); resolveBaseUrl refuses Host header outside DEV_MODE; rate_limit prunes
  inline; CSV formula injection closed (DEC-179); framing deny-by-default; ics in embed picker.
- Shapes: A PER-IDENTITY BUCKET IS NOT A BUDGET -- pair with a per-IP one. A LEDGER'S REASON IS A
  CLAIM. CURRENT-TENSE PROSE IS A LIE WITH A TIMESTAMP -- a coverage claim carried forward must be
  re-derived at test time. GREPPING A MODULE FOR AN IDENTIFIER PROVES AN IMPORT, NOT A PAINT.
