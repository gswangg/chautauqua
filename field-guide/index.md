# Field Guide
Owned by the swarm. Scribe appends lessons each wave, keeps this under a
hard 60-line budget, compacting old entries. Injected into every agent.
- SPEC.md is source of truth (J1-J12 bar, sbek rubric IDs=verification
  hooks, §2 principles). docs/ precedence: clarifications.md overrides
  all; decisions/DEC-*.md binding, src/decisions.ts compile-checked
  (never hand-edit). House invariants: fail loudly; status changes
  never auto-email; authz every route, server-side visibility.
- STAGE1 (DEC-002..365, COMPLETE at w23-24): pure-core src/{auth,domain,
  forms,mail,lib} import nothing node:/cf; 003 table/enums; 004 hash
  'pbkdf2$v1$100000$salt$hash'; 012/013 route files export Hono sub-
  apps, only src/index.ts mounts, errors {error:{code,message,fields?}};
  015 append-only/016 locked=real cols; 322 safeExternalUrl allowlist;
  335-337 SQL EXISTS+LIKE ESCAPE; J5-J8 server-paged, fan-out DELETED;
  353 archive 40MB TOTAL-byte guard; 355-358 bulk ops set-based/CLOSED.
  Gates LOG-ONLY (own ONE file, never patch product). Stage 2 (deploy/
  Resend/Airtable/DNS/CI)=separate swarm.
- REDESIGN w1 (DEC-366..371): stage-1 FUNCTION FROZEN/COMPLETE. Binding
  mandate=docs/design/README.md + 11 *.dc.html + screens/*.png, ranked
  just under clarifications.md; SPEC still governs behaviour/authz/
  data/perf. 367 tokens: paper F4F1E8/surface FAF8F2/ink 1B1D17/muted
  565A4B/hairline E1DDCE/border BAB6A6/olive 4E5C31. NO RED, no third
  accent. Fonts self-hosted /fonts/*-var.woff2. Floors: 10px type, 44px
  phone tap, AA, no shadows, no new deps. 369 sidebar DELETED, top
  header+phone 5-tab bar. 370 Overview=worklist v2. 368/372 CSS: app/
  src/styles.css + src/views/theme.ts=ONE lane; page lanes add co-
  located <area>.css, .chq-<area>-*, never redefine a shared class.
  371/373 SSR: THEME_CSS in theme.ts PLUS one co-located surface
  module (382 tools.css.ts covers /, /docs/api, /dev/mailbox); shell=
  ThemeStyles()+ONE surface style. 374 TRAP: hono/jsx escapes & < > " '
  in text — SSR CSS -> dangerouslySetInnerHTML, value-free constant;
  per-event accent=validated hex in style ATTRIBUTE.
- 375 Settings=ONE route, phone=client-state swap. 376 Contacts split
  by view; merge strike #A8A392=ONLY off-palette hex (383 allowlists
  exactly this one; sheets otherwise carry NO hex/rgb(), token files
  only; no non-inset box-shadow). 377 mock figures=illustration only.
  378 ONE dialog contract — .chq-scrim only backdrop, .chq-modal
  STATIC child, Escape via app/src/lib/useEscapeKey.ts, overlay/
  backdrop classes DELETED. 379 styles.css CLOSES SPA vocabulary (test
  proves every chq-* class has a rule); .chq-page is a stack NOT a
  measure; --chq-ink-strong #2E2A24=secondary-btn ink in BOTH token
  files. 380 agenda phone=arm-then-tap, one room, 30-min default;
  breaks/'move X' DROPPED. 381 phone tabs=Overview/Submissions/
  Speakers/Content/More from EXPLICIT path list; More carries Sign
  out; tabbar leaves <header>. 384 gate lanes own ONE log file only.
- REDESIGN w4 (DEC-385..387): 385 ONE phone switch `@media (max-width:
  700px)` in EVERY stylesheet (900px=intermediate collapse only, 699px
  ->700). Metrics fixed once: 16px gutters, 27px title, 29px headline,
  controls min-height 44px via CENTRED FLEX not padding, radius --chq-
  r-ctl-phone, chip strips overflow-x:auto+flex-shrink:0 children;
  shell owns .chq-tabbar bottom offset, no page adds one. 386 phone
  cards=CSS on SAME markup (thead hidden, tr->card, td->block, no cell
  hidden); Speakers' .chq-speakers-cards=ONLY sanctioned dup phone DOM
  (matrix can't degrade); card shows exactly desktop row's cells —
  Submissions per-row Accept/Decline/Read DROPPED (DEC-193 selection+
  refetch not a layout lane's to invent). 387 render-sweep gains an
  ADVISORY admin mobile pass (organizer+reviewer routes, /admin/*
  excluded, 390x844); ADMIN_MOBILE_PASS_BLOCKING=false flips true after
  first all-PASS. Redesign logs use `-redesign` suffix (task-w4-a/-d/-e
  already burned by stage-1).
