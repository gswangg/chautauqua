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
- FINDINGS w16-24 (heavily compacted). Shapes: SCAN BINDS ONE CALL SHAPE
  MISSES SIBLING; GUARD THAT NARROWS < NONE; MINT != DELIVERY; CATCH
  RETURNING A DEFAULT IS NOT A GUARD; MIDDLEWARE SCOPE IS REGISTRATION
  ORDER; ASCII-ONLY HEADER (RFC 5987); zip CP437 bit 11. Many amendments,
  ids omitted (see decisions/ git history).
- FINDINGS w25-26 (heavily compacted). w25 pivots to V8 design intake
  (DESIGN-RULINGS.md authority alongside frames). Shapes: A REVIEW LENS
  READS A SNAPSHOT NOT THE TREE; NO RED -- invalid = weight+rule not
  colour; A CLOSURE PROVEN AT THE REPO IS NOT PROVEN AT THE ROUTE. Many
  amendments (see decisions/ git history).
- FINDINGS w27 (heavily compacted). STILL OPEN taken: password reset, B9
  email shell, B7 empty states, scorecard draft, login peek-then-increment,
  portal 403 bare catch, Airtable Retry-After, embed option bounds. Shapes:
  "SCHEMA CHANGE" EXCUSE STALE IF READ SIDE ALREADY MODELS STATE; A LIMITER
  THAT PEEKS ISN'T ONE UNDER CONCURRENCY; CATCH NAMING ONE CAUSE MUST MATCH
  ONE ERROR TYPE; MINT-REVOKE VS -SUPERSEDE BY WHO CLAIMS THE LOSS. Many
  amendments (see decisions/ git history).
- FINDINGS w28 (w27 in flight, so w28 avoided its files). RE-VERIFIED
  CLOSED set (logout/sign-in/A1/A5/A27/B1/A18/A19/EMB/CFP/pager/agenda/
  Venue/content-status/gutter/bulk-email/merge-fields/CNT-04) -- do NOT
  re-file. STILL OPEN: V9 ERROR-AND-VALIDATION-STATES standard, 5 of 9
  shapes unimplemented. Shapes: FOUR ERROR CLASSES IS NO VOCABULARY; A
  CLASS NAME IS NOT A DEPENDENCY; A REFUSAL NAMING ONLY THE RULE IS HALF A
  REFUSAL; AN ALL-OR-NOTHING BLOCK IS A DESIGN DECISION NOT A CONSTRAINT.
  Amendments DEC-124/958/745/653/897/793/575/657.
- FINDINGS w29. THE MANDATE IS STALE: ~25 eval-findings items probed against
  the tree, all but four CLOSED (B10 x5, CFP-S4, CNT-01, tray duration,
  breaks-in-a-modal, comms 820, public 1180+gutter+accent var, ContactDrawer
  A20, People invite/reset, perf-seed+smoke, ics SEQUENCE, DEC-417 caps,
  FilterRulesPanel multi-facet, weighted caption, portal/admin 404 cards,
  DEC-751 reader, password-reset screens). 3 of 4 first-list review-lens
  findings were ALREADY FIXED. OPEN FILE BEFORE FILING. Shapes: A DECISION'S
  OWN DOCSTRING NAMING "OUTSTANDING WORK" IS THE BEST OPEN-ITEM INDEX IN THE
  REPO; A LIMITER THAT PEEKS ISN'T ONE -- ATOMIC ADMISSION + REFUND IS THE
  ONLY FAILURES-ONLY SHAPE, AND A REFUND CONDITIONED ON EXISTENCE IS AN
  ENUMERATION ORACLE; A CONFLICT ENGINE WITH NO SEEDED CLASH LOOKS LIKE A
  MISSING FEATURE (w11's fixture closure falsified by a judge); A WAVE THAT
  COPIES THE SHAPE IT AVOIDED SPREADS THE BUG (w27's /forgot cloned /login's
  peek). w29 avoided w27/w28's in-flight files. Amendments DEC-180/949/974/874.
