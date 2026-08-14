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
  GUESSABLE URL 404 DEAD END; PHONE REFUSING DESKTOP IS DIFFERENT PRODUCT
  (J9); SUB-APP onError SWALLOWS PARENT'S MANNERS; WIDTH BEATS MAX-WIDTH,
  700/900; no overflow-x:hidden; no colour literal in surface CSS.
- FINDINGS w16-26 (heavily compacted). Shapes: SCAN BINDS ONE CALL SHAPE
  MISSES SIBLING; GUARD THAT NARROWS < NONE; MINT != DELIVERY; CATCH
  RETURNING A DEFAULT IS NOT A GUARD; MIDDLEWARE SCOPE IS REGISTRATION
  ORDER; ASCII-ONLY HEADER (RFC 5987); zip CP437 bit 11; A REVIEW LENS
  READS A SNAPSHOT NOT THE TREE; NO RED -- invalid = weight+rule not
  colour; A CLOSURE PROVEN AT THE REPO IS NOT PROVEN AT THE ROUTE. Many
  amendments, ids omitted (see decisions/ git history).
- FINDINGS w27-28 (heavily compacted). RE-VERIFIED CLOSED (do NOT re-file):
  password reset, B9/B7, scorecard draft, login/portal 403, Airtable
  Retry-After, embed option bounds, logout/sign-in/A1/A5/A27/B1/A18/A19/
  EMB/CFP/pager/agenda/Venue/content-status/gutter/bulk-email/merge-
  fields/CNT-04. Shapes: A LIMITER THAT PEEKS ISN'T ONE UNDER CONCURRENCY;
  A CLASS NAME IS NOT A DEPENDENCY; AN ALL-OR-NOTHING BLOCK IS A DESIGN
  DECISION NOT A CONSTRAINT. Amendments DEC-124/958/745/653/897/793/575/657.
- FINDINGS w29 (compacted). MANDATE STALE: ~25 eval-findings items probed,
  all but four CLOSED (see decisions/ git history for full list). OPEN
  FILE BEFORE FILING. Shapes: A DECISION'S OWN DOCSTRING NAMING
  "OUTSTANDING WORK" IS THE BEST OPEN-ITEM INDEX; ATOMIC ADMISSION+REFUND
  IS THE ONLY FAILURES-ONLY LIMITER SHAPE, REFUND-ON-EXISTENCE IS AN
  ENUMERATION ORACLE; A WAVE THAT COPIES THE SHAPE IT AVOIDED SPREADS THE
  BUG. Amendments DEC-180/949/974/874.
- FINDINGS w30. MANDATE STILL STALE: of 8 review-lens items, 5 were ALREADY
  FIXED on main (Airtable MAX_RETRY_AFTER_MS clamp, portal 403 typed catch,
  embed option bounds+own-event check, mail RFC-2047/multipart-mixed/
  random boundary, home hub). Probed-and-closed too: CFP create-account
  CTA, public speaker bio, results pager/Download-CSV, aria-pressed,
  scorecard draft caption, compose pre-flight, settings slug clash, CNT-04
  chain guard, files totals, nav prefetch, with-test-lock. TAKEN (verified
  open, file open): request-body ceiling, id-array dedupe, touch-on-rename,
  plan-editor error shape (9th of 9), public string-param bounds. Shapes:
  A CAP CHECKED AFTER THE BUFFER IS NOT A CAP -- size gate belongs ahead of
  the FIRST body reader, csrfForm MIDDLEWARE parseBodys before any
  handler; A BULK ID ARRAY IS A SET OR IT IS A DOUBLE-SEND (chunked IN()
  re-returns a repeated id, requireFullMatch only sees MISSING ones); A
  BOUND ON THE WRITE SIDE IS NOT A BOUND ON THE READ SIDE (DEC-839 bounded
  stored options; live ?q= stayed unbounded -> unbounded SQL AND cache
  keys); A DECLARED-BUT-NEVER-SET useState IS A READER WITH NO WRITER; A
  SHARED COMPONENT WITH ONLY ITS OWN TEST AS CONSUMER MARKS THE SHAPE
  NOBODY BUILT (ErrorSummary => 9th error frame). w30 avoided w27/28/29
  files.
