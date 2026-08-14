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
  atomic SQL beats read-then-write; uniqueIndex CONTRACT; decision w/no code
  a LIE; JOIN cascades; MINTING IS IO; boundary fails per RECIPIENT not
  REQUEST; FIND-OR-CREATE NEEDS A UNIQUE INDEX; UNBOUNDED SURFACE NEVER
  PAGED; grep decisions/ first; READER W/NO WRITER RENDERS NOTHING;
  GUESSABLE URL 404 DEAD END; SUB-APP onError SWALLOWS PARENT'S MANNERS.
- FINDINGS w16-33 (heavily compacted; do NOT re-file, see decisions/ git
  history; MANDATE ~EXHAUSTED on this list, re-verified closed each wave).
  Shapes: SCAN BINDS ONE CALL SHAPE MISSES SIBLING; GUARD THAT NARROWS <
  NONE; MINT != DELIVERY; CATCH RETURNING A DEFAULT IS NOT A GUARD; A
  REVIEW LENS READS A SNAPSHOT NOT THE TREE; A CLOSURE PROVEN AT THE REPO
  IS NOT PROVEN AT THE ROUTE; A LIMITER THAT PEEKS ISN'T ONE UNDER
  CONCURRENCY; A CAP CHECKED AFTER THE BUFFER IS NOT A CAP; A BULK ID ARRAY
  IS A SET OR A DOUBLE-SEND; A BOUND ON THE WRITE SIDE IS NOT A BOUND ON
  THE READ SIDE; A SHARED COMPONENT W/ONLY ITS OWN TEST MARKS THE SHAPE
  NOBODY BUILT; PARSE RESULT DISCARDED != PARSED; AMENDMENT W/NO CALL SITE
  IS OPEN; A WATERMARK STORING ITS OWN START LOSES LATE-COMMITTING WRITES
  -- read back, stamp forward; A STAMP FIRED ON A NON-CHANGE IS A WORKLIST
  EVICTION -- grep the stamp's 2nd reader for a LIMIT; A FIGURE COMPUTED
  FOR NOBODY IS A HOT-ROUTE TAX; THE DECISIONS' OWN PATH REFS ARE A CHEAP
  DRIFT DETECTOR. Amendments DEC-124/958/745/653/897/793/575/657/180/949/
  974/874. `npm run deploy` absent is BY DESIGN (README stage-2 deploy).
- FINDINGS w34 (all re-verified AT THE FILE before filing). TAKEN, verified OPEN: /forgot mails and
  logs `${origin}/reset/<token>` into email_log while redactClaimUrls (claim.ts:128) knows only
  `/claim/`, so Comms "Show what was sent" (comms.ts:800) hands any peer organizer a live 1h
  takeover link; POST /reset/:token consumes at :176 BEFORE validating, so a mistyped confirm burns
  the grant and the retry form posts to a dead token; the CFP confirmation - the one email every
  submitter gets - is hand-assembled at submit.tsx:711 instead of renderEmailHtml, and
  email-shell-sweep's "every send site is accounted for" test asserts the SAME predicate in both
  branches, so it never enumerated anything (6 listed, 8 real sites).
- Re-verified CLOSED w34, do NOT re-file: parseBoundedIdArray dedupes AND all 17 call sites use the
  RESULT (incl. bulk-email.ts:43 - w32-a landed); touchSubmissionsForContacts/ForTracks have real
  call sites (portal-edit, profile, contacts/crud, events, contacts/import, sessionboard, merge) and
  profile.ts already guards on a real name change; conditional visibility (forms/visibility.ts);
  /logout POST + ?signed-out=1; MIME hardening (control-char strip, base64 CTE, multipart/mixed);
  EMB-01 snippet + Show more (public/cards.tsx:151); review progress completed<=assigned (DEC-707);
  file serving nosniff; resolveBaseUrl header-poisoning.
- Shapes: A REDACTOR IS A SET OF CREDENTIAL SHAPES, NOT ONE REGEX - the second credential path ships
  disclosed. CONSUME-BEFORE-VALIDATE TURNS A TYPO INTO A DEAD LINK; the gate belongs immediately in
  front of the WRITE. A GUARD WHOSE TWO BRANCHES ASSERT THE SAME THING ENUMERATES NOTHING. A SIDE
  EFFECT PLACED INSIDE ONE BRANCH OF AN ORACLE-CLOSED PAIR RE-OPENS THE ORACLE (resolveBaseUrl inside
  `if (user)`). PROVEN IN-PROCESS IS NOT PROVEN AT RUNTIME - the walkthrough is the higher bar, and it
  must mint its own throwaway account rather than rotate a published credential.
