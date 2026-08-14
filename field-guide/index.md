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
  (J9); SUB-APP onError SWALLOWS PARENT'S MANNERS; WIDTH BEATS MAX-WIDTH.
  max-width 700/900; no overflow-x:hidden; no colour literal in surface CSS.
- FINDINGS w16-24 (heavily compacted). Shapes: SCAN BINDS ONE CALL SHAPE
  MISSES SIBLING; GUARD THAT NARROWS < NONE; MINT != DELIVERY; CATCH
  RETURNING A DEFAULT IS NOT A GUARD; MIDDLEWARE SCOPE IS REGISTRATION
  ORDER; A HEADER VALUE IS ASCII-ONLY (RFC 5987); ENCODING/NAME CP437 (zip
  bit 11). Amendments DEC-528/837/841/914/048/438/628/635/949/252/547/550/
  715/745/078/024/678/948/713/098/939/402/908/879/459/432/994/180/083/996/
  499/451/274/276/775/425/160/037/454.
- FINDINGS w25 (wave 24 partial). Security review-lens items handed to w25
  were ALREADY FIXED -- DO NOT RE-FILE. Shape: A REVIEW LENS READS A
  SNAPSHOT, NOT THE TREE. w25 pivots to V8 design intake (docs/design/
  DESIGN-RULINGS.md now authority alongside frames). Amendments DEC-945/
  154/014/825/633/900/967/745/662/989.
- FINDINGS w26 (w25 still in flight so w26 avoided auth.tsx, content
  worklist, review.css, submission detail, portal shell). Shapes: A
  RENDERER WITH NO SEEDED DATA LOOKS EXACTLY LIKE A MISSING FEATURE (check
  the writer first); NO RED -- invalid = weight+rule, not colour; A
  DISABLED CONTROL WITH A REASON TEACHES, A HIDDEN ONE DOESN'T; A CLOSURE
  PROVEN AT THE REPO IS NOT PROVEN AT THE ROUTE. Amendments DEC-896/616/
  124/746/160/930/922/782/883/739.
- FINDINGS w27 (verified on main at HEAD=`scribe wave 26`; w26 IN FLIGHT so
  w27 avoids settings/*, ContactDrawer, public submit, portal tasks routes,
  FilesLibrary, SpeakerDetailPage, seed, ComposeWizard). RE-VERIFIED STALE,
  do NOT re-file: auth-session unscoped delete, resolveBaseUrl Host
  fallback, /account/password rate limit, VIDEO_MAX_BYTES, /embed/e/*
  double cache, tasks.ts remindNow catch, content-notes mint-before-send,
  submit.tsx R2 delete, criteria 6th track, FormsPage Save, breaks modal,
  templates measure, RecentSends/History one reader, distribute copy,
  /schedule 10--12, portal 560, 1180 public pair, B8 focus/disabled tokens,
  reviewer plan hub, PageSkeletons. STILL OPEN and taken this wave: password
  reset (nothing exists), B9 email shell (7 sites emit bare <p>), B7 empty
  states (.chq-empty is one line), scorecard draft (submittedAt ALREADY
  nullable, every READER treats null as draft -- only the write stamps
  it), login peek-then-increment, portal 403 bare catch, Airtable
  Retry-After, embed option bounds. Shapes: A READ SIDE THAT ALREADY MODELS
  THE STATE MEANS "SCHEMA CHANGE" EXCUSE IS STALE; A LIMITER THAT PEEKS IS
  NOT A LIMITER UNDER CONCURRENCY; A CATCH NAMING ONE CAUSE MUST MATCH ONE
  ERROR TYPE; MINT-REVOKE VS MINT-SUPERSEDE DECIDED BY WHO CLAIMS THE LOSS;
  AN EMAIL IS A SURFACE; EMAIL CSS HAS NO CUSTOM PROPERTIES -- the one
  sanctioned colour-literal file. Amendments DEC-949/004/994/037/678/948/
  180/873/265/839/417/725/029/663.
