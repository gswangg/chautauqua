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
- FINDINGS w21 (planner re-verified on main; review-lens items 3+4 --
  public onError JSON envelope, signOut res.ok -- ALREADY FIXED, as were
  origin/tasks/claim/probe items: VERIFY BEFORE FILING). Shapes: CATCH
  RETURNING A DEFAULT IS NOT A GUARD (DEC-635 wanted ".catch that
  THROWS"; 28 sites answered malformed body with 200/{}); MARKDOWN
  ENUMERATION PINNED TO ITS SHA (re-derive population at TEST TIME, not
  prose); ALLOWLIST W/NO STALE DIRECTION IS PERMISSION; ROLLBACK IS
  STILL AN ORDERING (submit.tsx deleted R2 before row-delete); SIBLING
  FIGURES IN ONE FUNCTION DRIFT. Amendments DEC-635/713/459/078/432.
- FINDINGS w22 (planner re-verified on main; mandate open list exhausted
  8th time, ~12 P1/P2s already landed). TWO of four review-lens items were
  STALE: content-notes "minting destroys live grant" is FALSE since DEC-949
  wave-18 (grant re-put w/ 48h grace); "/embed/e/* cached twice" is FALSE --
  Hono compose advances only on next(), a use() after a sub-app mount never
  wraps it; that registration is LOAD-BEARING. Shapes: A DELETE KEYED ON
  CLIENT INPUT NEEDS THE OWNER PREDICATE (issueSession deleted by tokenHash
  alone let login-with-another's-cookie revoke THEIR session); THE
  UNAUTHENTICATED ROUTES GOT THE RATE LIMITS (login/claim/submit metered,
  /account/password ran unmetered 100k-PBKDF2 -- authenticated != safe from
  oracle/CPU-sink); AN ADVERTISED CAP THE PLATFORM REFUSES IS A LIE (250 MB
  recordings vs 100 MB Workers body ceiling -- derive caps from a named
  platform limit); MIDDLEWARE SCOPE IS REGISTRATION ORDER -- COUNT THE
  PASSES, DON'T READ THE use() LINES. Amendments DEC-994/180/879/083.
