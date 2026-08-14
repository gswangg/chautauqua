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
  (docs/design/DESIGN-RULINGS.md authority alongside frames). Shapes: A
  REVIEW LENS READS A SNAPSHOT, NOT THE TREE; A RENDERER WITH NO SEEDED
  DATA LOOKS LIKE A MISSING FEATURE; NO RED -- invalid = weight+rule, not
  colour; A CLOSURE PROVEN AT THE REPO IS NOT PROVEN AT THE ROUTE.
  Amendments DEC-945/154/014/825/633/900/967/745/662/989/896/616/124/746/
  160/930/922/782/883/739.
- FINDINGS w27 (heavily compacted). STILL OPEN taken: password reset, B9
  email shell, B7 empty states, scorecard draft (submittedAt nullable, only
  write stamps it), login peek-then-increment, portal 403 bare catch,
  Airtable Retry-After, embed option bounds. Shapes: "SCHEMA CHANGE" EXCUSE
  STALE IF READ SIDE ALREADY MODELS STATE; A LIMITER THAT PEEKS ISN'T ONE
  UNDER CONCURRENCY; CATCH NAMING ONE CAUSE MUST MATCH ONE ERROR TYPE;
  MINT-REVOKE VS -SUPERSEDE BY WHO CLAIMS THE LOSS; EMAIL CSS HAS NO CUSTOM
  PROPERTIES. Amendments DEC-949/004/994/037/678/948/180/873/265/839/417/
  725/029/663.
- FINDINGS w28 (w27 IN FLIGHT so w28 avoids auth.tsx, styles.css, mailer
  send sites, scorecard PUT, portal/tasks/shared.ts, airtable, api/embeds,
  speakers/*, import REVIEW step). RE-VERIFIED
  CLOSED, do NOT re-file: /logout, sign-out footer, sign-in 460, A1
  bulk-approve, A5/A27/B1/A18/A19, EMB bio+desc snippet, CFP create-account
  CTA, per-version Delete, results pager, agenda ?day=, "Add room/track",
  Venue label, content status band, public gutter, bulk-email placeholders,
  merge custom-field keys, CNT-04 portal chain (DEC-922 w26).
  STILL OPEN taken: V9 ERROR-AND-VALIDATION-STATES standard -- 5 of 9
  shapes unimplemented anywhere (plan editor, content upload, settings
  clash, compose partial, import file-level). Shapes: FOUR ERROR CLASSES IS
  NO VOCABULARY (.chq-error box, .chq-field-error 11px caps,
  .chq-form-row-error, unprefixed class="field-error" in portal); A CLASS
  NAME IS NOT A DEPENDENCY -- surfaces emit vocabulary + render-test before
  CSS module lands, so a standard fans out WIDE; A REFUSAL NAMING ONLY THE
  RULE IS HALF A REFUSAL (say formats, why, what survived); AN
  ALL-OR-NOTHING BLOCK IS A DESIGN DECISION, NOT A CONSTRAINT. Amendments
  DEC-124/958/745/653/897/793/575/657.
