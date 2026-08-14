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
- FINDINGS w16-19 (compacted). Shapes: SCAN BINDS ONE CALL SHAPE MISSES
  SIBLING; GUARD THAT NARROWS < NONE; SCAN'S ROOT IS PART OF ITS CLAIM;
  SIBLING ATTRIBUTE IS ALSO A ROUTE; HAND-TYPED LIST FORGETS 3RD MEMBER;
  MINT != DELIVERY; FALLBACK THAT GUESSES IS ATTACKER INPUT; CATCH
  JUSTIFIED BY COMMENT OUTLIVES PREMISE; PROBE BY HAND MISSES MOUNTS;
  GRID DECLARES ONE TRACK/CHILD; POLICY IN ONE HOOK ISN'T A POLICY;
  RECEIVER IS PART OF CALL SHAPE. REFUSED: no public "create account"
  CTA on /submit. Amendments DEC-528/837/841/914/048/438/628/635/949/
  252/547/550/715/745/078/024/678/948/713/098.
- FINDINGS w20 (compacted). Mandate exhausted 7th time, ~25 items
  re-verified. Shapes: CAST IS NOT A KEY; ALLOW-LIST REASON NAMING A
  DELEGATE IS A CLAIM, RESOLVE OR DELETE; GUARD BOUND TO ELEMENT NOT
  ATTRIBUTE SPELLING; TRIPWIRE COUNTING FILES != COUNTING MATCHES;
  SECOND READER INHERITS NO MANNERS AGAIN; DUPLICATED ENUM MESSAGE
  DRIFTS BY LAST MEMBER ADDED. Amendments DEC-939/678/402/908/879.
- FINDINGS w21 (planner re-verified on main; review-lens items 3+4 --
  public onError JSON envelope, signOut res.ok -- were ALREADY FIXED, as
  were the origin/tasks/claim/probe items: VERIFY BEFORE FILING). Mandate
  open list still exhausted; wave-21 work is guards weaker than the
  decisions they cite. Shapes: A CATCH THAT RETURNS A DEFAULT IS NOT A
  GUARD (DEC-635 said ".catch that THROWS"; scan only checked `.catch(`
  existed and its own message recommended `() => ({})` -- 28 sites
  answered a malformed body with 200/{}); A MARKDOWN ENUMERATION IS
  PINNED TO ITS SHA (157-route authz inventory is prose at d034a9e0, its
  runtime twin probes 3 files and says "representative" -- re-derive the
  population at TEST TIME); AN ALLOWLIST WITH NO STALE DIRECTION IS
  PERMISSION (inarray/insert scans verify only that the named FILE
  exists, pre-clearing future reuses of the pair); A ROLLBACK IS STILL
  AN ORDERING (submit.tsx deleted R2 objects before the row-delete,
  ledgered "deserves its own wave"); SIBLING FIGURES IN ONE FUNCTION
  DRIFT (speakerCount filters role+invite+org, returningSpeakers
  filtered none of the three). Amendments DEC-635/713/459/078/432.
