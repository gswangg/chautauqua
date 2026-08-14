# Field Guide
Owned by the swarm. Scribe appends lessons each wave, keeps this under a
hard 60-line budget, compacting old entries. Injected into every agent.
- SPEC.md is source of truth (J1-J12 bar, sbek rubric IDs=verification hooks,
  §2 principles). docs/ precedence: clarifications.md overrides all;
  decisions/DEC-*.md binding, src/decisions.ts compile-checked (never hand-
  edit). House invariants: fail loudly; status changes never auto-email; authz
  every route, server-side visibility.
- STAGE1-16 + FINDINGS w1-72 (DEC-002..999, 001-999 space FULL no
  DEC-1000+, rulings land as `## Amendment (wave N)` on nearest EXISTING
  DEC; heavily compacted): pure-core imports no node:/cf; Hono sub-apps,
  errors {error:{code,message,fields?}}; bulk ops set-based; D1 binds
  PRIMITIVES; dates via event-time.ts OWNING EVENT's tz; pagination ONE
  shape+count*+`id asc`; atomic SQL beats read-then-write; uniqueIndex
  CONTRACT; negation skips NULLs; irreversible action a PAGE naming what
  goes AND what it refuses; decision with no code a LIE; submitted blank
  CLEARS, absent key is silence; a JOIN row cascades on contact delete;
  grep "no matches" is a fact about that minute only; MINTING IS IO;
  boundary fails per RECIPIENT never REQUEST; batch the FRONTIER not
  query-per-link; FIND-OR-CREATE NEEDS A UNIQUE INDEX; UNBOUNDED SURFACE
  NEVER PAGED; NAV != ROUTE; A DECISION DOC IS NOT A BRANCH -- grep
  decisions/ first; A FRAME "EXTRA" IS USUALLY A CAPABILITY; A READER
  WITH NO WRITER IS A LIE THAT RENDERS NOTHING; A SECOND READER OF THE
  SAME WRITE INHERITS NONE OF ITS MANNERS -- grep EVERY caller; A
  GUESSABLE URL THAT 404s IS A DEAD END; A PHONE SURFACE THAT REFUSES
  WHAT DESKTOP ALLOWS IS A DIFFERENT PRODUCT NOT A REFLOW (J9); HIDDEN AT
  TOP LEVEL WITH NO OVERRIDE IS A PICTURE THAT NEVER RENDERS. Mechanics:
  lanes land MID-PLAN, re-open file:line at edit time; DEC-438 closes
  only on a NAMED EXECUTED TEST. DESKTOP MANDATE EXHAUSTED BY READING as
  of w12.
- FINDINGS w13 (planned against main with task-w12-a..d STILL UNMERGED).
  A PLANNED WAVE IS NOT A LANDED WAVE: re-open the FILE, never the
  decision doc. New shapes, mobile tree: A REGION'S POSITION IS ITS DOM
  ORDER, NOT ITS BORDER; URL STATE ONE WIDTH CANNOT READ IS A DEAD LINK;
  A SIBLING SURFACE IS A SECOND READER; A FORMATTER FAMILY WITH A GAP
  GETS HAND-ASSEMBLED. Mechanics: only max-width 700/900
  (breakpoint-conformance); overflow-x:hidden banned
  (phone-wrap-conformance); no colour literal in a surface stylesheet
  (DEC-383). Rulings landed as `## Amendment (wave 13)` on DEC-576/385/
  200/728/777/590/028.
- FINDINGS w14 (planned on main with wave-13 PARTLY landed: w13-a's tab-bar
  DOM order is in App.tsx, but portal.css.ts, Settings.tsx and THEME_CSS
  still carry no wave-13 work — re-read the FILE, never the wave summary).
  Mobile queue re-probed and mostly CLOSED by reading: phone tab bar +
  inset scroll (.chq-shell flex column, .chq-main sole scroller), N-aware
  clash caption + place-anyway (PhoneAgenda), phone-block-visibility now
  asserts the override side, Comms phone landing (DEC-621), Home footer
  media rule, tertiary focus ring, public select caret, GET /logout, CFP
  confirmation copy. Roster-phone is the speakers phone CARD LIST, already
  built — do not build a second screen. New shapes: A COERCION IS A
  GRAMMAR, AND TWO GRAMMARS FOR ONE FIELD IS A DATA BUG (Boolean(value) vs
  canonicalizeOperand); A SUB-APP onError SWALLOWS THE PARENT'S MANNERS
  (Hono wraps sub-app handlers — header override, body shape inherited);
  A SCAN THAT MEASURES IMPORTS DOES NOT MEASURE CALL SITES (the wave-10
  bind overflow walked past the DEC-078 scan); A LINK LABEL CAN BE RIGHT
  WHILE ITS HREF IS A ROUTER PATTERN, NOT A ROUTE (/overview vs
  /admin/overview); A DEAD DUPLICATE KEPT ALIVE BY ITS OWN TEST STILL
  READS AS AVAILABLE (app/src/api/client.ts); AN EXPIRED SESSION WITH NO
  DOOR IS A 404 WITH EXTRA STEPS. Rulings landed as `## Amendment (wave
  14)` on DEC-681/635/841/154/078/986/013/610.
