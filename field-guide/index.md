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
- FINDINGS w16-24 (heavily compacted). Shapes: SCAN BINDS ONE CALL SHAPE
  MISSES SIBLING; GUARD THAT NARROWS < NONE; MINT != DELIVERY; FALLBACK
  THAT GUESSES IS ATTACKER INPUT; CATCH RETURNING A DEFAULT IS NOT A GUARD;
  MIDDLEWARE SCOPE IS REGISTRATION ORDER; SERIALIZER THAT QUOTES MUST
  STRIP THE QUOTE; CONTRACT IN DOCSTRING IS NOT A GATE; A SANITIZER AT
  SEND MAKES INTAKE A LIAR; A HEADER VALUE IS ASCII-ONLY (RFC 5987); FLAG
  THE ENCODING OR THE NAME IS CP437 (zip bit 11). Amendments DEC-528/837/
  841/914/048/438/628/635/949/252/547/550/715/745/078/024/678/948/713/098/
  939/402/908/879/459/432/994/180/083/996/499/451/274/276/775/425/160/037/454.
- FINDINGS w25 (wave 24 partial: only task-w24-b, ZIP bit-11). Security
  review-lens items handed to w25 were ALREADY FIXED -- DO NOT RE-FILE.
  Shape: A REVIEW LENS READS A SNAPSHOT, NOT THE TREE. w25 pivots to V8
  design intake (docs/design/DESIGN-RULINGS.md now authority alongside
  frames): "matches a frame or a recorded ruling" is the fidelity test.
  Shapes: TWO PRIMARIES W/ DIFFERENT SCOPES IS ONE TOO MANY; AN EXPANDED
  BAND THAT DOESN'T INHERIT THE GRID IS A SECOND TABLE; A CAPABILITY
  BEHIND A DISCLOSURE IS A CAPABILITY NOBODY FINDS; A CENTRED CARD IS NOT
  A DESKTOP DESIGN; A COUNT OF SKIPS ISN'T ACTIONABLE, TWO NAMES ARE.
  Amendments DEC-945/154/014/825/633/900/967/745/662/989.
- FINDINGS w26 (re-verified on main at HEAD=merge task-w25-d; w25 still
  IN FLIGHT so w26 avoided auth.tsx, content worklist, review.css,
  submission detail, portal shell). w25 took DESIGN-RULINGS A1/A5/A27/B1
  + DROPs + /logout; w26 takes A18/A19/A20/A26, B3, B10, error-states.
  RE-VERIFIED STALE, do NOT re-file: A19 template picker EXISTS
  (BulkEmailModal.tsx:220, only copy off-ruling); public "Create an
  account" CTA EXISTS (submit-views.tsx:452); EMB-01 card description
  EXISTS (cards.tsx:257); EMB-05/13 bio RENDERS (detail.tsx:53, gap is the
  SEED); files-library totals correct; agenda SessionCard already shows
  every speaker + conflict flag (AIA-04 is a data question).
  Shapes: A RENDERER WITH NO SEEDED DATA LOOKS EXACTLY LIKE A MISSING
  FEATURE (check the writer before a render fix); A STACK OF FULL-WIDTH
  INPUTS IS PHONE ANATOMY AT ANY WIDTH; NO RED -- invalid = weight+rule
  (1px ink border + 3px ink left edge + 13/600 ink text), not colour; A
  DISABLED CONTROL WITH A REASON TEACHES, A HIDDEN ONE DOESN'T; A
  CLOSURE PROVEN AT THE REPO IS NOT PROVEN AT THE ROUTE (CNT-04 closed
  once on the organizer path while the portal path still restarted the
  chain). Amendments DEC-896/616/124/746/160/930/922/782/883/739.
