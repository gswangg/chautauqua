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
  onError SWALLOWS PARENT'S MANNERS; SCAN OF IMPORTS != CALL SITES; DEAD
  DUPLICATE KEPT ALIVE BY OWN TEST; WIDTH BEATS MAX-WIDTH; `1fr` HAS
  MIN-CONTENT FLOOR; TYPED FILE LIST SCAN MEASURES FILES REMEMBERED.
  max-width 700/900; no overflow-x:hidden; no colour literal in surface
  CSS. Lanes land MID-PLAN, re-open file:line.
- FINDINGS w16-19 (DEC amendments land BEFORE code -- open FILE, never a
  wave note; mandate re-exhausted each wave, verified DONE at file:line).
  Shapes: A SCAN THAT BINDS ONE CALL SHAPE MISSES ITS SIBLING; A GUARD
  THAT QUIETLY NARROWS IS WORSE THAN NONE; A SCAN'S ROOT IS PART OF ITS
  CLAIM; THE SIBLING ATTRIBUTE IS ALSO A ROUTE (formaction unscanned); A
  HAND-TYPED EXTENSION LIST FORGETS ITS THIRD MEMBER; A MINT IS NOT A
  DELIVERY; FALLBACK THAT GUESSES IS THE ATTACKER'S INPUT (resolveBaseUrl
  took Host); CATCH JUSTIFIED BY COMMENT OUTLIVES ITS PREMISE; PROBE THAT
  COMPOSES BY HAND MISSES SIX MOUNTS; GRID DECLARES ONE TRACK PER CHILD;
  A POLICY THAT LIVES IN ONE HOOK IS NOT A POLICY (401->/login only in
  useMe); GUARD THAT MATCHES ONE SPELLING OF className MEASURES NOTHING;
  RECEIVER IS PART OF THE CALL SHAPE (fileStore.delete missed by
  store.delete guard). REFUSED on design authority: no public "create an
  account" CTA on /submit. Amendments DEC-528/837/841/914/048/438/628/
  635/949/252/547/550/715/745/078/024/678/948/713/098.
- FINDINGS w20 (mid-flight plan, re-open FILE never a wave note). Mandate
  EXHAUSTED 7th time: ~25 open-list items re-checked at file:line, ALL
  closed but ONE (state-band insets, user-filed). Shapes: A CAST IS NOT A
  KEY (`{a,b,c} as Record<FileKind,_>` shipped an undefined typed number
  across the wire); AN ALLOW-LIST REASON THAT NAMES A DELEGATE IS A CLAIM,
  NOT PROSE -- resolve it or delete it; A GUARD BOUND TO AN ATTRIBUTE
  SPELLING SHOULD BE BOUND TO THE ELEMENT (`<table` beats
  `className="chq-table`); A TRIPWIRE THAT COUNTS FILES DOES NOT COUNT
  MATCHES; SECOND READER INHERITS NO MANNERS, AGAIN (DEC-908's
  locked-built-in exclusion lived on ONE page, scorecard re-printed
  title/abstract); A DUPLICATED ENUM MESSAGE DRIFTS BY EXACTLY THE MEMBER
  ADDED LAST. Amendments DEC-939/678/402/908/879.
