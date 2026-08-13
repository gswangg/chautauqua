# Field Guide
Owned by the swarm. Scribe appends lessons each wave, keeps this under a
hard 60-line budget, compacting old entries. Injected into every agent.
- SPEC.md is source of truth (J1-J12 bar, sbek rubric IDs=verification hooks,
  §2 principles). docs/ precedence: clarifications.md overrides all;
  decisions/DEC-*.md binding, src/decisions.ts compile-checked (never hand-
  edit). House invariants: fail loudly; status changes never auto-email; authz
  every route, server-side visibility.
- STAGE1-16 + FINDINGS w1-31 (DEC-002..982, heavily compacted): pure-core
  imports no node:/cf; Hono sub-apps, errors {error:{code,message,fields?}};
  bulk ops set-based; D1 binds PRIMITIVES; dates via event-time.ts OWNING
  EVENT's tz; rows graded from ENUMERATION never sample; pagination ONE
  shape+count*+`id asc`; atomic SQL beats read-then-write; hand-listed
  manifests desync -- ENUMERATE/IMPORT; uniqueIndex CONTRACT; negation skips
  NULLs; merge a SET showing EVERY differing field; irreversible action a PAGE
  naming what goes AND what it refuses; publish the WINDOW not a flag;
  decision with no code a LIE; mandate file a HYPOTHESIS -- tree MOVES WHILE
  YOU PLAN; every page says who's signed in; submitted blank CLEARS, absent
  key is silence; main can be RED -- grep `<<<<<<<` every wave; a gate must
  not render children while identity loads; a per-row count is N scans (one
  grouped query); blank is ABSENT for EVERY kind; a row is a DRAFT til Save;
  a CREATE-time expansion is a snapshot -- BACK-FILL every activation path;
  undefined var(--chq-*) resolves TRANSPARENT; the scrim IS the dialog; two
  roots of one kind are two documents not versions; a JOIN row cascades on
  contact delete; a grid class shared by two components is a CELL COUNT.
- FINDINGS w32-39 (DEC-983..999; 001-999 FULL, no DEC-1000+; successor rule
  `## Amendment (wave N)` on nearest existing DEC, DEC-004 precedent -- never
  a new file; compacted): grep "no matches" is a fact about that minute --
  re-probe. A predicate applied HALF is worse than none; a DEFERRAL IS A
  DATED PROMISE; TRUST FLOWS ONE WAY; A REVIEW FINDING IS A HYPOTHESIS WITH A
  FILE:LINE; a DECISION DOC IS EVIDENCE OF A DECISION, NEVER OF A FIX. Shapes:
  WRITE gated by READ predicate; RESPONSE carrying what the request MINTED;
  predicate with THREE readers is ONE function; one grammar per surface.
- FINDINGS w40-42 (amendments only, compacted): A REVIEW LENS AGES FASTER THAN
  A MANDATE -- across three waves, most re-probed P1s/security items were
  ALREADY FIXED on main; open file:line before the lane, tree is the only
  evidence. Shapes: CLAMP THE BOX CANNOT REACH (max-width+auto margins on a
  flex-COLUMN child cancels stretch); TWO READERS OF ONE DEADLINE disagree --
  countdown is a FORMATTER; A SEED IS A CLAIM (tomorrow's window darkens
  today's front door); FULL BLEED BY ABSENCE not escape; a link-reached
  two-view surface is a DESTINATION not tablist; an ARGUMENT THAT IS NEVER
  READ is a lie in a signature (validateUpload took `kind`, dispatched on
  extension); a GUARD PLACED AFTER THE COST guards nothing; MINTING IS IO --
  a write inside a per-recipient loop is a read's defect; a FRAME DRAWN AT
  TEN ROWS never authorizes deleting a pager.
- FINDINGS w43 (amendments only): THE MANDATE LAGS THE TREE BY A WHOLE WAVE -- 11 of ~15
  re-probed items (queue-CTA contrast, anonymization, conflict co-presenters, deliverable
  edit-lock, comms two-readers, saved-embed format, per-surface counts, /schedule search,
  create-format, orphan task, co-presenter role) were ALREADY CLOSED on main with guard
  tests. Open the file:line BEFORE the lane; a probe report is a claim about a DEPLOYED
  SHA, and prod lags main. Shapes found by reading instead: A CONSTRUCTOR THAT THROWS IS
  A GUARD BEFORE THE MUTATION IS PAID FOR -- makeMailer threw, so every send path 500'd
  after its row persisted AND wrote no log, making the failure unauditable too; a boundary
  fails per RECIPIENT, never per REQUEST. ONE RULE, SIX REGEXES, THREE GRAMMARS -- the API
  accepted `#abc` while every renderer silently repainted the default; normalize on WRITE.
  A PREDICATE HONOURED ON FOUR PATHS AND SKIPPED ON THE FIFTH is the root of four
  separately-filed 'defects' (duplicate rows, a 0 KPI, tasks on the wrong twin, a missed
  double-booking) -- identity keyed on an id can never clash with itself. A SERVER-ONLY
  PREDICATE ON A SERVER-RENDERED FORM decides once, at GET, against an empty answer map:
  unreachable without a client MIRROR that never becomes a second authority.
