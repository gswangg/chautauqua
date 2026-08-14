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
  w/no code a LIE; JOIN cascades; MINTING IS IO; boundary fails per
  RECIPIENT not REQUEST; FIND-OR-CREATE NEEDS A UNIQUE INDEX; UNBOUNDED
  SURFACE NEVER PAGED; NAV != ROUTE; grep decisions/ first; FRAME "EXTRA"
  IS A CAPABILITY; READER W/NO WRITER RENDERS NOTHING; SECOND READER
  INHERITS NO MANNERS; GUESSABLE URL 404 DEAD END; PHONE REFUSING DESKTOP
  IS DIFFERENT PRODUCT (J9); HIDDEN W/NO OVERRIDE NEVER RENDERS; SUB-APP
  onError SWALLOWS PARENT'S MANNERS; WIDTH BEATS MAX-WIDTH. max-width
  700/900; no overflow-x:hidden; no colour literal in surface CSS.
- FINDINGS w16-22 (heavily compacted). Shapes: SCAN BINDS ONE CALL SHAPE
  MISSES SIBLING; GUARD THAT NARROWS < NONE; MINT != DELIVERY; FALLBACK
  THAT GUESSES IS ATTACKER INPUT; CATCH RETURNING A DEFAULT IS NOT A
  GUARD; MIDDLEWARE SCOPE IS REGISTRATION ORDER. Amendments DEC-528/837/
  841/914/048/438/628/635/949/252/547/550/715/745/078/024/678/948/713/
  098/939/402/908/879/459/432/994/180/083.
- FINDINGS w23 (compacted). Wave 21/22 LANDED. Shapes: SERIALIZER THAT
  QUOTES MUST STRIP THE QUOTE; CONTRACT IN DOCSTRING IS NOT A GATE.
  Amendments DEC-996/499/451/274/276/775.
- FINDINGS w24 (planner re-verified on main). Wave 23 FULLY LANDED. Mandate
  residue RE-VERIFIED STALE (do not re-file): criteria 6th track, distribute
  copy, agenda day pills, ics embed picker, headshots (DEC-773), pipeline
  fit/rationale, remind contactIds, multi-room seed, origin.ts cron parity,
  claim grace (DEC-949), authz index mounts. Shapes: A SANITIZER AT SEND
  MAKES INTAKE A LIAR (isValidEmail vs addressValue); A HEADER VALUE IS
  ASCII-ONLY (RFC 5987); FLAG THE ENCODING OR THE NAME IS CP437 (zip bit
  11). Amendments DEC-425/160/037/454.
- FINDINGS w25 (planner re-verified on main; wave 24 partially landed -- only
  task-w24-b, the ZIP bit-11/zipEntryPath work). EVERY security review-lens item
  handed to this wave was ALREADY FIXED: auth-session delete carries the userId
  predicate, /account/password has the DEC-180 limiter, VIDEO_MAX_BYTES is 95MB
  derived from WORKERS_REQUEST_BODY_MAX_BYTES, resolveBaseUrl throws outside dev,
  createClaimToken supersedes with a 48h grace, the two /embed cache registrations
  are disjoint and runtime-proven, tasks.ts's fabricated-200 catch is gone, submit
  rollback commits the row delete before R2. DO NOT RE-FILE ANY OF THESE.
  Shape: A REVIEW LENS READS A SNAPSHOT, NOT THE TREE -- open the file:line before
  planning a fix, or you plan a wave against last week's code.
  Wave 25 pivots to the V8 design intake (docs/design/DESIGN-RULINGS.md is now
  authority alongside the frames): "matches a frame or a recorded ruling" is the
  closed fidelity test. Shapes: TWO PRIMARIES WITH DIFFERENT SCOPES IS ONE TOO MANY
  (worklist Approve-ready vs Approve-selected); AN EXPANDED BAND THAT DOESN'T
  INHERIT THE GRID IS A SECOND TABLE; A CAPABILITY BEHIND A DISCLOSURE IS A
  CAPABILITY NOBODY FINDS; A CENTRED CARD IS NOT A DESKTOP DESIGN (full-column
  buttons + one-field-per-row = phone anatomy at any width); A COUNT OF SKIPS IS
  NOT ACTIONABLE, TWO NAMES ARE. Amendments DEC-945/154/014/825/633/900/967/745/
  662/989.
