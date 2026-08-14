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
  wave; do NOT re-file, see decisions/ git history). Shapes: SCAN BINDS ONE
  CALL SHAPE MISSES SIBLING; GUARD THAT NARROWS < NONE; MINT != DELIVERY;
  CATCH RETURNING A DEFAULT IS NOT A GUARD; MIDDLEWARE SCOPE IS
  REGISTRATION ORDER; A REVIEW LENS READS A SNAPSHOT NOT THE TREE; A
  CLOSURE PROVEN AT THE REPO IS NOT PROVEN AT THE ROUTE; A LIMITER THAT
  PEEKS ISN'T ONE UNDER CONCURRENCY; AN ALL-OR-NOTHING BLOCK IS A DESIGN
  DECISION NOT A CONSTRAINT; "OUTSTANDING WORK" IN A DECISION'S OWN
  DOCSTRING IS THE BEST OPEN-ITEM INDEX; ATOMIC ADMISSION+REFUND IS THE
  ONLY FAILURES-ONLY LIMITER SHAPE; A CAP CHECKED AFTER THE BUFFER IS NOT
  A CAP; A BULK ID ARRAY IS A SET OR A DOUBLE-SEND; A BOUND ON THE WRITE
  SIDE IS NOT A BOUND ON THE READ SIDE; A SHARED COMPONENT WITH ONLY ITS
  OWN TEST AS CONSUMER MARKS THE SHAPE NOBODY BUILT. Amendments
  DEC-124/958/745/653/897/793/575/657/180/949/974/874.
- FINDINGS w31 (compacted; MANDATE ESSENTIALLY EXHAUSTED, ~30 items
  re-verified closed, do NOT re-file from eval-findings.md without opening
  it). TAKEN (verified open then): read-side filter strings unbounded
  (parseListQuery/parseContactListQuery/?rules=) while writes have DEC-417;
  email-log ?status=/breaks ?day= unvalidated into SQL; /docs/api
  hand-maintained no enumerator; README claims MIT no LICENSE file. Shapes:
  AN UNVALIDATED FILTER IS A CONFIDENT WRONG ANSWER; A HAND-MAINTAINED
  PUBLIC CLAIM NEEDS AN ENUMERATOR NOT TRUST; reuse test/pubcache-purge
  -classification.test.ts's resolver, never re-parse.
- FINDINGS w32. Mandate + v2/v9 design handoff re-probed AT THE FILE: everything
  I could test by grep is CLOSED (body-limit Content-Length gate DEC-020 w30,
  embed option bounds + cross-event trackId, Retry-After clamp, atomic login
  limiter, assertOwnAssignmentOr403 typed catch, portal replace-chain CNT-04,
  conditional CFP visibility, duplicate-at-create DEC-788, .ics/xml in
  EMBED_FORMATS, seed<->fixtures binding, CI, LICENSE, scheduled-tick
  isolation, completed<=assigned). Do NOT re-file without opening the file.
- THE TREE MOVES UNDER YOU MID-PLAN: parseBoundedIdArray gained its dedupe
  between two of my own greps -- re-verify a finding IMMEDIATELY before filing.
  TAKEN w32 (verified open): bulk-email.ts:40 discards parseBoundedIdArray's
  RESULT then re-reads the raw body (DEC-182 w30 half-landed); DEC-725's w30
  contact/track-rename touch is a decision with no code. Shapes: A PARSE CALL
  WHOSE RESULT IS DISCARDED IS NOT A PARSE; AN AMENDMENT WITHOUT A CALL SITE IS
  AN OPEN ITEM -- grep each amendment for the call sites it names; A GUARD'S
  NAME IN A SCAN IS NOT A REFUSAL AT RUNTIME (probe was GET+anon-only 14 waves);
  A SECOND READER BOUNDS A STAMP (submission.updated_at also orders the
  producer worklist -- touch only when the serialized string changed).
