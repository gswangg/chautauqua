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
  atomic SQL beats read-then-write; uniqueIndex CONTRACT; negation skips
  NULLs; irreversible action a PAGE naming what goes/refuses; decision
  w/no code a LIE; blank CLEARS, absent key silent; JOIN cascades; MINTING
  IS IO; boundary fails per RECIPIENT not REQUEST; batch the FRONTIER;
  FIND-OR-CREATE NEEDS A UNIQUE INDEX; UNBOUNDED SURFACE NEVER PAGED; NAV
  != ROUTE; grep decisions/ first; FRAME "EXTRA" IS A CAPABILITY; READER
  W/NO WRITER RENDERS NOTHING; SECOND READER INHERITS NO MANNERS;
  GUESSABLE URL 404 DEAD END; PHONE REFUSING DESKTOP IS DIFFERENT PRODUCT
  (J9); HIDDEN W/NO OVERRIDE NEVER RENDERS; DOM ORDER IS POSITION; SUB-APP
  onError SWALLOWS PARENT'S MANNERS; DEAD DUPLICATE KEPT ALIVE BY OWN
  TEST; WIDTH BEATS MAX-WIDTH; TYPED FILE LIST SCAN MEASURES FILES
  REMEMBERED. max-width 700/900; no overflow-x:hidden; no colour literal
  in surface CSS. Lanes land MID-PLAN, re-open file:line.
- FINDINGS w16-20 (compacted). Shapes: SCAN BINDS ONE CALL SHAPE MISSES
  SIBLING; GUARD THAT NARROWS < NONE; SIBLING ATTRIBUTE IS ALSO A ROUTE;
  HAND-TYPED LIST FORGETS 3RD MEMBER; MINT != DELIVERY; FALLBACK THAT
  GUESSES IS ATTACKER INPUT; CATCH JUSTIFIED BY COMMENT OUTLIVES PREMISE;
  PROBE BY HAND MISSES MOUNTS; POLICY IN ONE HOOK ISN'T A POLICY;
  RECEIVER IS PART OF CALL SHAPE; CAST IS NOT A KEY; ALLOW-LIST REASON
  NAMING A DELEGATE IS A CLAIM, RESOLVE OR DELETE; TRIPWIRE COUNTING
  FILES != COUNTING MATCHES; DUPLICATED ENUM MESSAGE DRIFTS BY LAST
  MEMBER ADDED. REFUSED: no public "create account" CTA on /submit.
  Amendments DEC-528/837/841/914/048/438/628/635/949/252/547/550/715/
  745/078/024/678/948/713/098/939/402/908/879.
- FINDINGS w21-22 (compacted). Shapes: CATCH RETURNING A DEFAULT IS NOT A
  GUARD; MARKDOWN ENUMERATION PINNED TO ITS SHA; ALLOWLIST W/NO STALE
  DIRECTION IS PERMISSION; ROLLBACK IS STILL AN ORDERING; SIBLING FIGURES
  IN ONE FUNCTION DRIFT; A DELETE KEYED ON CLIENT INPUT NEEDS THE OWNER
  PREDICATE; UNAUTHENTICATED ROUTES GOT THE RATE LIMITS (authenticated !=
  safe from oracle/CPU-sink); ADVERTISED CAP THE PLATFORM REFUSES IS A
  LIE; MIDDLEWARE SCOPE IS REGISTRATION ORDER. Amendments DEC-635/713/
  459/078/432/994/180/879/083.
- FINDINGS w23 (planner re-verified on main). Wave 21 LANDED (scans all
  present; submit.tsx rollback row-delete-FIRST, ledger EMPTY). Wave 22
  STILL IN FLIGHT (auth-session.ts, account.tsx, domain/files.ts, pubcache
  prefix UNTOUCHED): HANDS OFF. Five review-lens items re-confirmed STALE
  (origin.ts/tasks.ts/authz probe/claim mint/inArray migration). Shapes:
  THE SERIALIZER THAT QUOTES MUST STRIP THE QUOTE (ics sanitizeCn strips
  `"`, MIME addressHeader doesn't -- one file, two answers); SANITIZE THE
  ADDRESS, NOT JUST THE LABEL (`<${email}>`/`mailto:${email}` raw,
  isValidEmail admits `<>,;`); A CONTRACT IN THE DOCSTRING IS NOT A GATE
  (hydrateSessions read by id w/ no gate, "caller already checked" x7);
  THE INVARIANT SCAN THAT ONLY READS (DEC-451 guards select(), not
  update()/delete()); ONE THROWING GETTER, TWO HAND-COPIES. Amendments
  DEC-996/499/451/274/276/775.
