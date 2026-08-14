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
  GUESSABLE URL 404 IS DEAD END; PHONE REFUSING DESKTOP IS DIFFERENT
  PRODUCT (J9); HIDDEN W/NO OVERRIDE NEVER RENDERS. Lanes land MID-PLAN,
  re-open file:line.
- FINDINGS w13-15 (mid-merge/PARTLY-landed, re-open FILE not summary):
  DOM ORDER IS POSITION; SIBLING SURFACE IS A SECOND READER; SUB-APP
  onError SWALLOWS PARENT'S MANNERS; SCAN OF IMPORTS != CALL SITES; DEAD
  DUPLICATE KEPT ALIVE BY OWN TEST; DRILL W/NO BACK IS A 200 W/NO EXIT;
  WIDTH BEATS MAX-WIDTH; `1fr` HAS A MIN-CONTENT FLOOR; TYPED FILE LIST
  SCAN MEASURES FILES SOMEONE REMEMBERED; AWAITING A CACHE WRITE PUTS
  THE EDGE IN THE CRITICAL PATH. max-width 700/900; no overflow-x:hidden;
  no colour literal in surface CSS. Amendments DEC-576/385/200/728/777/
  590/028/681/635/841/154/078/986/013/610/785/678/651/810/751/616/083.
- FINDINGS w16-17 (DEC amendments land BEFORE code -- open the FILE, not
  a wave note; v7 README decides what is owed). Shapes: A SCAN THAT
  BINDS ONE CALL SHAPE MISSES ITS SIBLING; A GUARD THAT QUIETLY NARROWS
  IS WORSE THAN NONE; SUB-APP ERROR PATH INHERITS ENVELOPE NOT CHROME;
  A SCAN'S ROOT IS PART OF ITS CLAIM; THE SIBLING ATTRIBUTE IS ALSO A
  ROUTE (formaction unscanned); A HAND-TYPED EXTENSION LIST FORGETS ITS
  THIRD MEMBER; AN ERROR PAGE THAT QUERIES IS NO DOOR. Amendments
  DEC-528/837/841/914/048/438/628/635.
- FINDINGS w18 (mid-flight plan, re-open FILE never summary). Mandate
  EXHAUSTED 5th time. Shapes: A MINT IS NOT A DELIVERY; FALLBACK THAT
  GUESSES IS THE ATTACKER'S INPUT (resolveBaseUrl took Host, cron twin
  refused); CATCH JUSTIFIED BY COMMENT OUTLIVES ITS PREMISE; PROBE THAT
  COMPOSES BY HAND MISSES SIX MOUNTS; GRID DECLARES ONE TRACK PER CHILD;
  SCAN ROOTED AT TWO DIRS SKIPS src/domain+src/sync; DEC citation in
  JSDoc is not a call site. Amendments DEC-949/252/547/550/715/745/078.
- FINDINGS w19 (mid-flight plan, re-open FILE never a wave note). Mandate
  EXHAUSTED 6th time, all verified DONE at file:line. Shapes: A POLICY
  THAT LIVES IN ONE HOOK IS NOT A POLICY (401->/login only in useMe,
  every other endpoint left organizer on a dead page); GUARD THAT
  MATCHES ONE SPELLING OF className MEASURES NOTHING (template-literal
  chq-page invisible); HINT FOR A FILE THE SCAN NEVER VISITS IS DEAD
  CONFIG; RECEIVER IS PART OF THE CALL SHAPE (fileStore.delete missed by
  store.delete guard); SCAN'S ROOT IS PART OF ITS CLAIM AGAIN -- name
  EXCLUSIONS, assert naming stays complete. REFUSED on design authority:
  no public "create an account" CTA on /submit. Amendments DEC-024/678/
  948/713/098.
