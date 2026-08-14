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
  THE READ SIDE; PARSE RESULT DISCARDED != PARSED; AMENDMENT W/NO CALL
  SITE IS OPEN; A WATERMARK STORING ITS OWN START LOSES LATE-COMMITTING
  WRITES -- read back, stamp forward; A FIGURE COMPUTED FOR NOBODY IS A
  HOT-ROUTE TAX; THE DECISIONS' OWN PATH REFS ARE A CHEAP DRIFT DETECTOR.
  Amendments DEC-124/958/745/653/897/793/575/657/180/949/974/874. `npm run
  deploy` absent is BY DESIGN (README stage-2 deploy).
- FINDINGS w34-36 (heavily compacted, do NOT re-file): redactCredentialUrls covers /claim/+/reset/;
  consume-before-validate reset fixed; CFP via renderEmailHtml; route-authz's GUARD_NAMES split from
  CSRF_GUARD_NAMES; parseBoundedIdArray dedupes+used; touchSubmissionsForContacts/Tracks wired
  everywhere; resolveBaseUrl refuses Host outside DEV_MODE; CSV formula injection closed (DEC-179);
  framing deny-by-default. Shapes: A REDACTOR IS A SET OF SHAPES NOT ONE REGEX; CONSUME-BEFORE-
  VALIDATE TURNS A TYPO INTO A DEAD LINK; A CSRF CHECK IS NOT AN AUTHZ CHECK; A PROOF NOBODY HAS
  SHOWN A VIOLATION TO IS NOT A PROOF -- ship a NEGATIVE CONTROL; WRONG-ROLE/NO-ROLE MISS WRONG-
  OWNER; A PER-IDENTITY BUCKET IS NOT A BUDGET; CURRENT-TENSE PROSE IS A LIE WITH A TIMESTAMP;
  GREPPING A MODULE FOR AN IDENTIFIER PROVES AN IMPORT, NOT A PAINT.
- FINDINGS w37 (verified AT THE FILE, not inherited). Re-probed and CLOSED, do NOT re-file: /forgot
  now spends forgot-ip AND forgot (w36-a landed); every anonymous-reachable limiter pairs an IP bucket
  (login/forgot/submit/draft/claim); reset tokens are newest-only + revoked on any other password path;
  markdown is escape-FIRST (quotes escaped, http(s)-only hrefs); every byte route sets nosniff +
  attachment; criteria-row 6th track, distribute caption, CFP-builder Save, CFP close-now fast path,
  EMB-01 snippet, agenda slot "Place <ref> at HH:MM" aria-label, publish {placed,public,heldBack},
  useCurrentEvent stale-id self-heal, session expiry enforced at middleware.ts:71.
- OPEN, taken w37: the TENANT axis is SPOT-CHECKED, NEVER ENUMERATED. anonymous/anonymous-mutation/
  role-refusal/portal-owner probes exist; none drives a route POPULATION with another ORG's ids over
  REAL rows -- SPA event context is client-controlled (localStorage chq.currentEventId), so
  /api/v1/events/:id/* is attacker-parameterized by design.
- Shapes: A MOCKED RESOLVER PROVES THE ROUTE CALLS IT, NOT THAT IT FILTERS. A THROWING DB CANNOT PROVE
  A REFUSAL THAT REQUIRES A READ -- tenant checks need REAL ROWS (node:sqlite + drizzle sqlite-proxy
  over migrations/ DDL, test/rate-limit-atomicity.test.ts, stays FAST-tier). SPOT-CHECKED IS NOT
  ENUMERATED: without a two-directional ledger the NEXT route is uncovered. A 5xx IS NOT A REFUSAL.
  A REFUSAL THAT MUTATES IS NOT A REFUSAL -- snapshot the victim's rows. For byte routes the status
  is half the proof: assert the STORE WAS NEVER ASKED for the foreign key.
- Rejected on inspection: an ownership-PREDICATE text scan over read/write chains --
  test/write-scoping-invariant.scan.test.ts:37-42 rules a text scan cannot decide a delegate guard is
  real; the convention is load-then-check behind an org-scoped resolver, probed at the ROUTE.
