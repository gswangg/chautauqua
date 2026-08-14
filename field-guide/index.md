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
  contact delete; grep "no matches" is per-minute only; MINTING IS IO;
  boundary fails per RECIPIENT not REQUEST; batch the FRONTIER; FIND-OR-
  CREATE NEEDS A UNIQUE INDEX; UNBOUNDED SURFACE NEVER PAGED; NAV != ROUTE;
  grep decisions/ first; FRAME "EXTRA" IS A CAPABILITY; READER W/NO WRITER
  RENDERS NOTHING; SECOND READER INHERITS NO MANNERS -- grep EVERY caller;
  GUESSABLE URL 404 IS DEAD END; PHONE REFUSING DESKTOP IS A DIFFERENT
  PRODUCT (J9); HIDDEN W/NO OVERRIDE NEVER RENDERS. Mechanics: lanes land
  MID-PLAN, re-open file:line; DEC-438 closes only on NAMED EXECUTED TEST.
  DESKTOP MANDATE EXHAUSTED BY READING as of w12.
- FINDINGS w13 (mid-merge, re-open FILE not decision doc). DOM ORDER IS
  POSITION; URL STATE ONE WIDTH CAN'T READ IS DEAD; SIBLING SURFACE IS A
  SECOND READER; FORMATTER GAP GETS HAND-ASSEMBLED. max-width 700/900
  only; no overflow-x:hidden; no colour literal in surface CSS (DEC-383).
  Amendments DEC-576/385/200/728/777/590/028.
- FINDINGS w14 (wave-13 PARTLY landed — re-read FILE not wave summary).
  Mobile closed by reading: tab bar+inset scroll, N-aware clash caption,
  phone-block-visibility override side, Comms phone landing, Home footer,
  tertiary focus ring, select caret, GET /logout, CFP copy. Shapes: ONE
  COERCION GRAMMAR PER FIELD (Boolean(v) vs canonicalizeOperand); SUB-APP
  onError SWALLOWS PARENT'S MANNERS (Hono); SCAN OF IMPORTS != SCAN OF
  CALL SITES; LINK LABEL RIGHT, HREF A ROUTER PATTERN NOT A ROUTE; DEAD
  DUPLICATE KEPT ALIVE BY OWN TEST READS AVAILABLE; EXPIRED SESSION W/NO
  DOOR IS A 404 W/EXTRA STEPS. Amendments DEC-681/635/841/154/078/986/
  013/610.
- FINDINGS w15 (planned on main AFTER wave 14 fully landed — the tree
  moved mid-read: App.tsx's signOut gained its res.ok guard between two
  reads of the same file. Re-open the FILE, always). The gate-4/delta-2
  desktop mandate is now EXHAUSTED BY READING a second time: scorecard
  body+stacked rail, queue footer/recusal action, cap row, breaks
  disclosure, header sign-out, 1180 public pair, /schedule rail, .ics in
  the embed picker, weighted caption, not-chasing copy, delete page's
  single confirm, seed's 12 placed sessions — all present in the tree.
  What was left were four SHAPES, not features: A SECOND READ/EDIT TOGGLE
  INSIDE A DRILL MEANS THE DRILL RENDERS NOTHING (public-pages edit=1);
  A DRILL WITH NO BACK IS A 200 WITH NO EXIT (SummarySection hid its own
  action while editing); WIDTH BEATS MAX-WIDTH ON ONE ELEMENT, SO THE
  SHARED PRIMITIVE SILENTLY VOIDS THE PER-PAGE RULE (.chq-modal 560 vs
  .chq-contacts-import 640) and `1fr` HAS A MIN-CONTENT FLOOR — a long
  <option> is a layout constraint (use minmax(0,1fr), again); A SCAN WITH
  A TYPED FILE LIST MEASURES THE FILES SOMEONE REMEMBERED (DEC-678's
  PAGE_FILES missed Overview/ContentApp/FormsPage — derive from App.tsx's
  pageLoaders). Also: AWAITING A CACHE WRITE PUTS THE EDGE IN THE
  VISITOR'S CRITICAL PATH. Rulings landed as `## Amendment (wave 15)` on
  DEC-728/785/678/651/810/751/616/083.
