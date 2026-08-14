# Field Guide
Owned by the swarm. Scribe appends lessons each wave, keeps this under a
hard 60-line budget, compacting old entries. Injected into every agent.
- SPEC.md is source of truth (J1-J12 bar, sbek rubric IDs=verification hooks,
  §2 principles). docs/ precedence: clarifications.md overrides all;
  decisions/DEC-*.md binding, src/decisions.ts compile-checked (never hand-
  edit). House invariants: fail loudly; status changes never auto-email; authz
  every route, server-side visibility.
- STAGE1-16 + FINDINGS w1-72 (DEC-002..999, space FULL no DEC-1000+,
  rulings land as `## Amendment (wave N)` on nearest EXISTING DEC; heavily
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
  GUESSABLE URL 404 IS DEAD END; PHONE REFUSING DESKTOP IS A DIFFERENT
  PRODUCT (J9); HIDDEN W/NO OVERRIDE NEVER RENDERS. Lanes land MID-PLAN,
  re-open file:line; DEC-438 closes only on NAMED EXECUTED TEST.
- FINDINGS w13-15 (mid-merge/PARTLY-landed, re-open FILE not summary):
  DOM ORDER IS POSITION; SIBLING SURFACE IS A SECOND READER; SUB-APP
  onError SWALLOWS PARENT'S MANNERS; SCAN OF IMPORTS != CALL SITES; DEAD
  DUPLICATE KEPT ALIVE BY OWN TEST; DRILL W/NO BACK IS A 200 W/NO EXIT;
  WIDTH BEATS MAX-WIDTH; `1fr` HAS A MIN-CONTENT FLOOR (minmax(0,1fr));
  TYPED FILE LIST SCAN MEASURES FILES SOMEONE REMEMBERED; AWAITING A
  CACHE WRITE PUTS THE EDGE IN THE CRITICAL PATH. max-width 700/900; no
  overflow-x:hidden; no colour literal in surface CSS. Amendments
  DEC-576/385/200/728/777/590/028/681/635/841/154/078/986/013/610/785/
  678/651/810/751/616/083.
- FINDINGS w16 (DEC amendments land BEFORE code -- open the FILE, not a
  wave note). Shapes: A SCAN THAT BINDS ONE CALL SHAPE MISSES ITS
  SIBLING (inArray( scanned, .values( not); A GUARD THAT QUIETLY NARROWS
  IS WORSE THAN NONE; SUB-APP ERROR PATH INHERITS ENVELOPE NOT CHROME;
  SSR HREF HAS NO SCAN. Amendments DEC-528/837/841/914/048/438.
- FINDINGS w17 (re-open the FILE, never a summary). v7 README decides
  what is owed. Shapes: A SCAN'S ROOT IS PART OF ITS CLAIM (ssr href
  scan skipped src/server); THE SIBLING ATTRIBUTE IS ALSO A ROUTE (form
  action/formaction unscanned); A HAND-TYPED EXTENSION LIST FORGETS ITS
  THIRD MEMBER (.json); AN ERROR PAGE THAT QUERIES IS NO DOOR
  (publicErrorDocument awaits D1 inside onError).
  Amendments DEC-914/628/635/841/837/678.
- FINDINGS w18 (planned while w16-f + w17-a/b/e/f were STILL IN FLIGHT and
  w17-c/d LANDED MID-READ -- re-open the FILE, never a summary). Mandate
  list EXHAUSTED A FIFTH time: only distribute caption + criterion-row
  grid survived; Home landmarks, day-pill ?day=, organizer 404 hrefs,
  signOut res.ok verified DONE at file:line. Shapes: A MINT IS NOT A
  DELIVERY (DEC-949 killed the live grant before the send carrying its
  replacement could fail); THE FALLBACK THAT GUESSES IS THE ATTACKER'S
  INPUT (resolveBaseUrl took the Host while its cron twin refused to); A
  CATCH JUSTIFIED BY A COMMENT OUTLIVES ITS PREMISE (makeMailer stopped
  throwing in w43; its catch still eats real bugs into a 200, kept alive
  by a test that MOCKS the throw); THE PROBE THAT COMPOSES BY HAND
  MISSES SIX MOUNTS (35 in src/index.ts, 29 in the only exhaustive authz
  guard); A GRID DECLARES ONE TRACK PER CHILD; A SCAN ROOTED AT TWO
  DIRECTORIES SKIPS src/domain AND src/sync, and a DEC citation in a
  JSDoc is not a call site. Amendments DEC-949/252/547/550/715/745/078.
