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
  atomic SQL beats read-then-write; uniqueIndex CONTRACT; irreversible
  action a PAGE naming what goes/refuses; decision w/no code a LIE; JOIN
  cascades; MINTING IS IO; boundary fails per RECIPIENT not REQUEST;
  FIND-OR-CREATE NEEDS A UNIQUE INDEX; UNBOUNDED SURFACE NEVER PAGED;
  NAV != ROUTE; grep decisions/ first; READER W/NO WRITER RENDERS NOTHING;
  GUESSABLE URL 404 DEAD END; SUB-APP onError SWALLOWS PARENT'S MANNERS;
  WIDTH BEATS MAX-WIDTH, 700/900; no colour literal in surface CSS.
- FINDINGS w16-30 (heavily compacted, many items re-verified closed each
  wave; do NOT re-file, see decisions/ git history). Shapes: SCAN BINDS
  ONE CALL SHAPE MISSES SIBLING; GUARD THAT NARROWS < NONE; MINT !=
  DELIVERY; CATCH RETURNING A DEFAULT IS NOT A GUARD; MIDDLEWARE SCOPE IS
  REGISTRATION ORDER; A REVIEW LENS READS A SNAPSHOT NOT THE TREE; A
  CLOSURE PROVEN AT THE REPO IS NOT PROVEN AT THE ROUTE; A LIMITER THAT
  PEEKS ISN'T ONE UNDER CONCURRENCY; AN ALL-OR-NOTHING BLOCK IS A DESIGN
  DECISION NOT A CONSTRAINT; A DECISION'S OWN DOCSTRING NAMING
  "OUTSTANDING WORK" IS THE BEST OPEN-ITEM INDEX; ATOMIC ADMISSION+REFUND
  IS THE ONLY FAILURES-ONLY LIMITER SHAPE; A CAP CHECKED AFTER THE BUFFER
  IS NOT A CAP -- gate ahead of the FIRST body reader; A BULK ID ARRAY IS
  A SET OR IT IS A DOUBLE-SEND; A BOUND ON THE WRITE SIDE IS NOT A BOUND
  ON THE READ SIDE (DEC-839 stored options bounded, live ?q= wasn't); A
  SHARED COMPONENT WITH ONLY ITS OWN TEST AS CONSUMER MARKS THE SHAPE
  NOBODY BUILT. Amendments DEC-124/958/745/653/897/793/575/657/180/949/
  974/874.
- FINDINGS w31. MANDATE ESSENTIALLY EXHAUSTED: ~30 further items probed at
  the file, ALL already closed (Venue label, criterion share column,
  session-card snippet+Show more, task instructions, import Match-the-
  columns, weighted-score caption, embed .ics format, /dev/mailbox
  DEV_MODE gating, public visibility gates, agenda optimistic rollback,
  perf-smoke endpoints, seed fixtures, speaker+content detail routes,
  password reset, ResponseModal Reopen, pipeline fit/age, filter rules).
  Do NOT re-file from eval-findings.md without opening the file first.
  TAKEN (verified open): read-side filter strings unbounded (parseListQuery
  / parseContactListQuery / ?rules=) while writes have DEC-417; email-log
  ?status= and breaks ?day= passed to SQL unvalidated; /docs/api hand-
  maintained with no enumerator; README claims MIT with no LICENSE file.
  Shapes: A BOUND ON THE WRITE SIDE IS NOT A BOUND ON THE READ SIDE
  (filters, not just ?q=); AN UNVALIDATED FILTER IS A CONFIDENT WRONG
  ANSWER (empty 200 beats a 400 only for the attacker); A HAND-MAINTAINED
  PUBLIC CLAIM (docs page, licence) NEEDS AN ENUMERATOR NOT TRUST; THE
  ROUTE ENUMERATOR ALREADY EXISTS -- test/pubcache-purge-classification
  .test.ts resolves mounts+nesting, reuse it, never re-parse.
