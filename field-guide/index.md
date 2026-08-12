# Field Guide
Owned by the swarm. Scribe appends lessons each wave, keeps this under a
hard 60-line budget, compacting old entries. Injected into every agent.
- SPEC.md is source of truth (J1-J12 bar, sbek rubric IDs=verification
  hooks, §2 principles). docs/ precedence: clarifications.md overrides
  all; decisions/DEC-*.md binding, src/decisions.ts compile-checked
  (never hand-edit). House invariants: fail loudly; status changes
  never auto-email; authz every route, server-side visibility.
- STAGE1 (DEC-002..365, COMPLETE w23-24): pure-core src/{auth,domain,
  forms,mail,lib} import nothing node:/cf; 003 table/enums; 004 hash
  'pbkdf2$v1$100000$salt$hash'; 012/013 route files export Hono sub-
  apps, errors {error:{code,message,fields?}}; 015 append-only/016
  locked=real cols; 322 safeExternalUrl allowlist; 335-337 SQL EXISTS+
  LIKE ESCAPE; 353 archive 40MB TOTAL-byte guard; 355-358 bulk ops set-
  based/CLOSED. Gates LOG-ONLY (own ONE file). Stage 2=separate swarm.
- REDESIGN w1 (DEC-366..371): stage-1 FUNCTION FROZEN. Mandate=docs/
  design/README.md + 11 *.dc.html + screens/*.png, just under
  clarifications.md. 367 tokens: paper F4F1E8/surface FAF8F2/ink
  1B1D17/muted 565A4B/hairline E1DDCE/border BAB6A6/olive 4E5C31. NO
  RED. Fonts self-hosted /fonts/*-var.woff2. Floors: 10px type, 44px
  phone tap, AA, no shadows, no new deps. 369 sidebar DELETED, top
  header+phone 5-tab bar. 370 Overview=worklist v2. 368/372 CSS: app/
  src/styles.css + theme.ts=ONE lane; page lanes add co-located
  <area>.css, .chq-<area>-*, never redefine shared class. 371/373 SSR:
  THEME_CSS + one co-located surface module. 374 TRAP: hono/jsx escapes
  & < > " ' in text — SSR CSS -> dangerouslySetInnerHTML, value-free
  constant; per-event accent=validated hex in style ATTRIBUTE. 375
  Settings=ONE route, phone=client-state swap. 376 #A8A392=ONLY off-
  palette hex (383 allowlists this one; no non-inset box-shadow). 378
  ONE dialog contract — .chq-scrim only backdrop, .chq-modal STATIC
  child, Escape via useEscapeKey.ts. 379 styles.css CLOSES SPA
  vocabulary; --chq-ink-strong #2E2A24=secondary-btn ink in BOTH token
  files. 380 agenda phone=arm-then-tap, one room, 30-min default. 381
  phone tabs=Overview/Submissions/Speakers/Content/More from EXPLICIT
  path list. 384 gate lanes own ONE log file only.
- REDESIGN w4 (DEC-385..387): 385 ONE phone switch `@media (max-width:
  700px)` in EVERY stylesheet (900px=intermediate). Metrics: 16px
  gutters, 27px title, 29px headline, controls min-height 44px via
  CENTRED FLEX, chip strips overflow-x:auto+flex-shrink:0; shell owns
  .chq-tabbar bottom offset. 386 phone cards=CSS on SAME markup (thead
  hidden, tr->card, td->block); Speakers' .chq-speakers-cards=ONLY
  sanctioned dup phone DOM; card=exactly desktop row's cells. 387
  render-sweep gains ADVISORY admin mobile pass (organizer+reviewer,
  /admin/* excluded, 390x844); ADMIN_MOBILE_PASS_BLOCKING=false flips
  true after first all-PASS. Redesign logs use `-redesign` suffix.
- REDESIGN w5 (DEC-388..391): 388 D1 binds are PRIMITIVES — a timestamp
  compare inside raw sql`` takes epoch-ms NUMBER (`< ${now}`, cf
  tasks.ts:238), never `new Date()`; test/d1-bind-safety.test.ts scans
  src/**. 500'd /admin/overview for every organizer across w1-3, unseen
  by unit tests (fake-db never binds params). 389 gates REPORT, never
  throw: nav/login failure = FAIL row + printed summary + exit 1, so
  "unmeasured" != "measured and broken". 390 phone-card labels: default
  is order/nth-child on existing <td>, NO markup added; a cell
  meaningless without its header gets data-label (from same th
  string) via td::before at the 10px floor. 391 SETTLED not deferred:
  phone agenda "move X" = arm a placed card then tap a free slot
  (PhoneAgenda, already built); Submissions "Read" = tap row title,
  Accept/Decline = bulk bar — never reintroduce per-row status
  buttons. 385 has a guard: test/breakpoint-conformance.test.ts — only
  max-widths in app/src + src css are 700/900; no min-width queries.
