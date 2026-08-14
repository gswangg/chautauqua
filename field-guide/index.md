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
  w/no code a LIE; blank CLEARS, absent key silent; JOIN cascades on
  contact delete; MINTING IS IO; boundary fails per RECIPIENT not REQUEST;
  batch the FRONTIER; FIND-OR-CREATE NEEDS A UNIQUE INDEX; UNBOUNDED
  SURFACE NEVER PAGED; NAV != ROUTE; grep decisions/ first; FRAME "EXTRA"
  IS A CAPABILITY; READER W/NO WRITER RENDERS NOTHING; SECOND READER
  INHERITS NO MANNERS; GUESSABLE URL 404 IS DEAD END; PHONE REFUSING
  DESKTOP IS A DIFFERENT PRODUCT (J9); HIDDEN W/NO OVERRIDE NEVER
  RENDERS. Lanes land MID-PLAN, re-open file:line; DEC-438 closes only
  on NAMED EXECUTED TEST. DESKTOP MANDATE EXHAUSTED BY READING as of w12.
- FINDINGS w13-14 (mid-merge/PARTLY-landed, re-open FILE not doc/summary).
  DOM ORDER IS POSITION; URL STATE ONE WIDTH CAN'T READ IS DEAD; SIBLING
  SURFACE IS A SECOND READER; ONE COERCION GRAMMAR PER FIELD; SUB-APP
  onError SWALLOWS PARENT'S MANNERS; SCAN OF IMPORTS != SCAN OF CALL
  SITES; LINK LABEL RIGHT, HREF A ROUTE NOT A ROUTER PATTERN; DEAD
  DUPLICATE KEPT ALIVE BY OWN TEST; EXPIRED SESSION W/NO DOOR IS A 404
  W/EXTRA STEPS. max-width 700/900; no overflow-x:hidden; no colour
  literal in surface CSS (DEC-383). Amendments DEC-576/385/200/728/777/
  590/028/681/635/841/154/078/986/013/610.
- FINDINGS w15 (re-open FILE always, tree moves mid-read). Desktop mandate
  EXHAUSTED BY READING a second time (scorecard, queue, cap row, breaks,
  sign-out, public pair, .ics picker, delete confirm, seed sessions).
  Shapes: SECOND READ/EDIT TOGGLE INSIDE A DRILL RENDERS NOTHING
  (public-pages edit=1); DRILL W/NO BACK IS A 200 W/NO EXIT
  (SummarySection); WIDTH BEATS MAX-WIDTH ON ONE ELEMENT so a SHARED
  PRIMITIVE VOIDS THE PER-PAGE RULE; `1fr` HAS A MIN-CONTENT FLOOR (use
  minmax(0,1fr)); TYPED FILE LIST SCAN MEASURES FILES SOMEONE REMEMBERED
  (derive from source, DEC-678); AWAITING A CACHE WRITE PUTS THE EDGE IN
  THE VISITOR'S CRITICAL PATH. Amendments DEC-728/785/678/651/810/751/
  616/083.
- FINDINGS w16 (planned on main with wave 15 STILL IN FLIGHT -- DEC
  amendments land BEFORE code: `## Amendment (wave N)` is a PLAN, not a
  landing -- open the FILE). Residue EXHAUSTED BY READING a THIRD time:
  mailer MIME, scorecard aria-checked, CFP builder Save, auth card sizing,
  agenda z-order (DEC-900), pipeline move-to, comms templates, segment
  upsert (DEC-809), version tags (DEC-818), contact cascade, topCompanies,
  conditional-field JS, /logout GET, portal 404-before-redirect, public
  accent clip (DEC-768), FK indexes, servedContentType+nosniff -- all
  present at file:line. Shapes: A SCAN THAT BINDS ONE CALL SHAPE MISSES
  ITS SIBLING (inArray( scanned, .values( not -- forms.ts seeds 80/100
  D1 binds unwatched); A GUARD THAT QUIETLY NARROWS IS WORSE THAN NONE
  (hand-typed TAB_SURFACES); SUB-APP ERROR PATH INHERITS ENVELOPE NOT
  CHROME (public 5xx naked, its 404 a full card); SSR HREF HAS NO SCAN
  (link-targets stops at app/src). Amendments DEC-528/837/841/914/048/438.
