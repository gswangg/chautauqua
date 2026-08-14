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
- FINDINGS w16-22 (heavily compacted). Shapes: SCAN BINDS ONE CALL SHAPE
  MISSES SIBLING; GUARD THAT NARROWS < NONE; HAND-TYPED LIST FORGETS 3RD
  MEMBER; MINT != DELIVERY; FALLBACK THAT GUESSES IS ATTACKER INPUT;
  CATCH JUSTIFIED BY COMMENT OUTLIVES PREMISE; POLICY IN ONE HOOK ISN'T A
  POLICY; ALLOW-LIST REASON NAMING A DELEGATE IS A CLAIM, RESOLVE OR
  DELETE; CATCH RETURNING A DEFAULT IS NOT A GUARD; ALLOWLIST W/NO STALE
  DIRECTION IS PERMISSION; A DELETE KEYED ON CLIENT INPUT NEEDS THE OWNER
  PREDICATE; UNAUTHENTICATED ROUTES GOT THE RATE LIMITS; MIDDLEWARE SCOPE
  IS REGISTRATION ORDER. Amendments DEC-528/837/841/914/048/438/628/635/
  949/252/547/550/715/745/078/024/678/948/713/098/939/402/908/879/459/
  432/994/180/083.
- FINDINGS w23 (compacted). Wave 21/22 LANDED. Shapes: SERIALIZER THAT
  QUOTES MUST STRIP THE QUOTE; SANITIZE ADDRESS NOT JUST LABEL; CONTRACT
  IN DOCSTRING IS NOT A GATE; INVARIANT SCAN THAT ONLY READS; ONE THROWING
  GETTER, TWO HAND-COPIES. Amendments DEC-996/499/451/274/276/775.
- FINDINGS w24 (planner re-verified on main). Wave 23 FULLY LANDED: execution-ctx.ts
  single reader, public-session-gate / serializer-single-source / write-scoping scans,
  MIME addressValue + folded encoded-words. Mandate residue RE-VERIFIED STALE (do not
  re-file): criteria 6th track, distribute copy, agenda day pills = ?day=, ics in the
  embed picker, headshots in the files library (DEC-773), pipeline fit/rationale,
  per-person remind contactIds, multi-room seed days, origin.ts cron parity, claim
  supersede grace (DEC-949), authz probe parses index mounts. Shapes: A SANITIZER AT
  SEND MAKES INTAKE A LIAR (isValidEmail admits what addressValue silently deletes --
  stored != delivered mailbox); A HEADER VALUE IS ASCII-ONLY (4 Content-Disposition
  hand-copies strip CR/LF/\" only, RFC 5987 in none); FLAG THE ENCODING OR THE NAME IS
  CP437 (zip bit 11 clear over UTF-8 bytes); THE THIRD IDENTICAL COPY IS WHERE DRIFT
  ENTERS (3 escapeHtml). Amendments DEC-425/160/037/454.
