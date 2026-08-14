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
- FINDINGS w31-32 (compacted; MANDATE ~EXHAUSTED, re-verified closed each
  wave, do NOT re-file without opening eval-findings.md): filter strings,
  email-log validation, /docs/api enumerator, LICENSE, body-limit gate,
  embed bounds, Retry-After clamp, login limiter, assertOwnAssignmentOr403,
  CFP visibility, duplicate-at-create, EMBED_FORMATS, seed<->fixtures, CI,
  scheduled-tick isolation. TAKEN w32: bulk-email.ts:40 discards
  parseBoundedIdArray's result then re-reads raw body; DEC-725's w30
  rename-touch was a decision with no code. Shapes: AN UNVALIDATED FILTER IS
  A CONFIDENT WRONG ANSWER; A PARSE CALL WHOSE RESULT IS DISCARDED IS NOT A
  PARSE; AN AMENDMENT WITHOUT A CALL SITE IS AN OPEN ITEM; A SECOND READER
  BOUNDS A STAMP; THE TREE MOVES UNDER YOU MID-PLAN -- re-verify immediately.
- FINDINGS w33. Re-probed the mandate + all 8 review-lens items AT THE FILE: every one
  is CLOSED except bulk-email.ts:40, which still discards parseBoundedIdArray's result
  and re-reads the raw body at :60 -- that is OWNED BY task-w32-a (branch exists,
  unmerged at plan time). NEXT PLANNER: confirm it landed before re-filing. Also
  re-verified closed, do NOT re-file: LICENSE, email-log ?status=, README credential
  enumerator (DEC-513), CSV formula injection (DEC-179), pubcache purge classification
  (DEC-627), reminder dedupe window, aria-pressed (DEC-939), Venue label, criteria-row
  6th track, Distribute copy, password-reset flow, home hub (DEC-581/582), CI perf
  smoke. `npm run deploy` absent is BY DESIGN (README lists wrangler deploy as stage 2).
- TAKEN w33 (verified open at the file): Airtable's watermark stores the tick's own
  START and reads with strict gt(), so a row committing after the SELECT with an
  earlier updated_at is lost forever; DEC-725's stamp fires on non-changes (import
  re-upload, colour-only track patch, bio-only profile save) while overview.ts:284 is
  desc(updated_at) LIMIT 5, so a bulk import EVICTS real work from Overview;
  ContactStats computes eventCount/returningSpeakers that no surface renders.
- Shapes: A WATERMARK THAT STORES ITS OWN START LOSES ANY WRITE WHOSE TIMESTAMP
  PRECEDES ITS COMMIT -- read back, stamp forward. A STAMP FIRED ON A NON-CHANGE IS A
  WORKLIST EVICTION, NOT A NO-OP -- grep the stamp's second reader for a LIMIT. A
  FIGURE COMPUTED FOR NOBODY IS A HOT-ROUTE TAX -- enumerate endpoint field ->
  rendering consumer. THE DECISIONS' OWN PATH REFERENCES ARE A CHEAP DRIFT DETECTOR:
  a file split leaves prose pointing at a deleted path, and an exemption belongs in
  the prose, not in an allowlist nobody opens.
