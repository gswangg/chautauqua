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
- FINDINGS w13-15 (mid-merge/PARTLY-landed, re-open FILE not summary;
  desktop mandate EXHAUSTED BY READING twice). DOM ORDER IS POSITION;
  SIBLING SURFACE IS A SECOND READER; SUB-APP onError SWALLOWS PARENT'S
  MANNERS; SCAN OF IMPORTS != CALL SITES; LINK LABEL RIGHT/HREF A ROUTE
  NOT PATTERN; DEAD DUPLICATE KEPT ALIVE BY OWN TEST; DRILL W/NO BACK IS
  A 200 W/NO EXIT; WIDTH BEATS MAX-WIDTH (SHARED PRIMITIVE VOIDS PER-PAGE
  RULE); `1fr` HAS A MIN-CONTENT FLOOR (minmax(0,1fr)); TYPED FILE LIST
  SCAN MEASURES FILES SOMEONE REMEMBERED (DEC-678); AWAITING A CACHE
  WRITE PUTS THE EDGE IN THE VISITOR'S CRITICAL PATH. max-width 700/900;
  no overflow-x:hidden; no colour literal in surface CSS (DEC-383).
  Amendments DEC-576/385/200/728/777/590/028/681/635/841/154/078/986/
  013/610/785/678/651/810/751/616/083.
- FINDINGS w16 (planned on main with wave 15 STILL IN FLIGHT -- DEC
  amendments land BEFORE code: `## Amendment (wave N)` is a PLAN, not a
  landing -- open the FILE). Residue EXHAUSTED BY READING a THIRD time:
  mailer MIME, scorecard aria-checked, CFP builder Save, auth card sizing,
  agenda z-order, pipeline move-to, comms templates, segment upsert,
  version tags, contact cascade, topCompanies, conditional-field JS,
  /logout GET, portal 404-before-redirect, public accent clip, FK
  indexes, servedContentType+nosniff -- all at file:line. Shapes: A SCAN
  THAT BINDS ONE CALL SHAPE MISSES ITS SIBLING (inArray( scanned,
  .values( not); A GUARD THAT QUIETLY NARROWS IS WORSE THAN NONE
  (hand-typed TAB_SURFACES); SUB-APP ERROR PATH INHERITS ENVELOPE NOT
  CHROME; SSR HREF HAS NO SCAN. Amendments DEC-528/837/841/914/048/438.
- FINDINGS w17 (planned mid-wave-16 merge: a-e landed WHILE I read, f in
  flight -- re-open the FILE, never a summary). Mandate list EXHAUSTED BY
  READING a FOURTH time (checkbox grammar, organizer 404 hrefs, signOut
  res.ok, GET /logout, sessions sort, bulk-template forward path,
  Match-the-columns, plan progress counter, speakers import link, PLACED
  copy, headshot+bio one form, agenda block intrinsic size -- all at
  file:line). v7 README (docs/design) decides what is owed: /sessions
  per-day capping NOT in v7 -- do not build it. Shapes: A SCAN'S ROOT IS
  PART OF ITS CLAIM (ssr href scan skipped src/server -- the very file
  whose links were wrong); THE SIBLING ATTRIBUTE IS ALSO A ROUTE (form
  action/formaction unscanned); A HAND-TYPED EXTENSION LIST FORGETS ITS
  THIRD MEMBER (.json fell out of the feed predicate); AN ERROR PAGE THAT
  QUERIES IS NO DOOR (publicErrorDocument awaits D1 inside onError).
  Amendments DEC-914/628/635/841/837/678.
