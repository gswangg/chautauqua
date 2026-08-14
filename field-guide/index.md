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
- FINDINGS w34 (compacted; landed/re-verified, do NOT re-file): /forgot reset-link redaction gap
  (redactClaimUrls only knows `/claim/`); consume-before-validate on POST /reset/:token; CFP
  confirmation hand-assembled not via renderEmailHtml; email-shell-sweep's same-predicate-both-
  branches non-enumeration (fixed w35 via DEC-518 negative-control rule). Shapes: A REDACTOR IS A SET
  OF CREDENTIAL SHAPES NOT ONE REGEX; CONSUME-BEFORE-VALIDATE TURNS A TYPO INTO A DEAD LINK; A GUARD
  WHOSE TWO BRANCHES ASSERT THE SAME THING ENUMERATES NOTHING; PROVEN IN-PROCESS IS NOT PROVEN AT
  RUNTIME.
- FINDINGS w35 (all verified AT THE FILE before filing). OPEN, taken: route-authz-enumeration.scan
  harvests `csrf\w+|sessionLoader|noStoreByDefault` into GUARD_NAMES (:340/:368) and accepts any of
  them as proof of authorization (:509/:526) -- every mutating route carries csrfJson, so the one
  direction the scan exists for cannot fail; POST /forgot + POST /reset/:token sit unledgered under
  it. No same-role-WRONG-OWNER probe exists (anonymous GET, anonymous mutation and wrong-ROLE probes
  all vary the role); portal IDOR coverage is a sample, not an enumeration. B8 interaction states are
  source-scanned only, never measured, though render-sweep already measures font floor + type roles.
- Re-verified CLOSED w35, do NOT re-file: criteria-row 6th/share track; distribute copy (DEC-745);
  .chq-btn-tertiary focus-visible; CNT-04 portal replace CHAINS versions (portal/tasks.tsx:597
  getReplacesTarget + chainRestarted disclosure); CNT-01 task instructions (tasks.ts:74-99); CFP-S4
  one-click close (CallForPapersPanel.tsx:220-230); pipeline fitScore/rationale (schema/crm.ts:44);
  saved embed disabled = empty 200 (saved-embed.tsx:60); GET / anonymous event hub + role redirects
  (root.tsx:429, DEC-581/582); rate_limit.expires_at INDEXED; seed's day-1 multi-block rows + 4-up/
  2-up + breaks (seed.ts:2352-2437); validate-then-consume reset + hoisted resolveBaseUrl
  (auth-reset.tsx:191-236 -- w34-c LANDED); perf smoke enforces 30+ endpoint budgets and exits 1.
- Shapes: A CSRF CHECK IS NOT AN AUTHORIZATION CHECK -- a guard vocabulary that unions them lets every
  mutating route self-certify. A PROOF NOBODY HAS SHOWN A VIOLATION TO IS NOT A PROOF: every scan
  ships a NEGATIVE CONTROL over a pure predicate. WRONG-ROLE AND NO-ROLE PROBES MISS WRONG-OWNER.
  SOURCE-SCANNED IS NOT MEASURED -- the render sweep is where a CSS rule proves it renders.
