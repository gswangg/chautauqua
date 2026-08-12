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
  apps, errors {error:{code,message,fields?}}; 322 safeExternalUrl
  allowlist; 335-337 SQL EXISTS+LIKE ESCAPE; 353 archive 40MB TOTAL-
  byte guard; 355-358 bulk ops set-based/CLOSED. Gates LOG-ONLY. Stage
  2=separate swarm.
- REDESIGN w1-3 (DEC-366..384): stage-1 FUNCTION FROZEN. Mandate=docs/
  design/README.md + 11 *.dc.html + screens/*.png. Tokens: paper
  F4F1E8/surface FAF8F2/ink 1B1D17/muted 565A4B/hairline E1DDCE/border
  BAB6A6/olive 4E5C31, NO RED, self-hosted fonts. Floors: 10px type,
  44px phone tap, AA, no shadows, no new deps. Sidebar DELETED, top
  header+phone 5-tab bar; Overview=worklist v2. CSS lane: app/src/
  styles.css + theme.ts=ONE lane (368/372); page lanes add co-located
  <area>.css, .chq-<area>-*, never redefine shared class. SSR THEME_CSS
  + co-located surface module; hono/jsx escapes text so SSR CSS ->
  dangerouslySetInnerHTML value-free constant, accent=validated hex
  in style ATTRIBUTE. Settings=ONE route, phone=client-state swap.
  #A8A392=ONLY off-palette hex. ONE dialog contract: .chq-scrim
  backdrop, .chq-modal STATIC child, Escape via useEscapeKey.ts.
  styles.css CLOSES SPA vocabulary. Agenda phone=arm-then-tap, one
  room, 30-min default. Phone tabs=Overview/Submissions/Speakers/
  Content/More, EXPLICIT path list. Gate lanes own ONE log file only.
- REDESIGN w4-5 (DEC-385..391): ONE phone switch `@media (max-width:
  700px)` in EVERY stylesheet (900px=intermediate); 16px gutters, 27px
  title, controls min-height 44px CENTRED FLEX, chip strips overflow-
  x:auto. Phone cards=CSS on SAME markup (thead hidden, tr->card, td-
  >block); card=exactly desktop row's cells. Render-sweep gains
  ADVISORY admin mobile pass (390x844), `-redesign` log suffix. D1
  binds are PRIMITIVES — timestamp compare in raw sql`` takes epoch-ms
  NUMBER never `new Date()` (test/d1-bind-safety.test.ts). Gates
  REPORT, never throw. Phone-card labels: default order/nth-child, no
  markup added; ambiguous cell gets data-label via td::before. SETTLED
  not deferred: agenda "move X"=arm placed card then tap free slot;
  Submissions "Read"=tap row title, Accept/Decline=bulk bar. Guard:
  test/breakpoint-conformance.test.ts — only 700/900 max-widths.
- REDESIGN w6 (DEC-392..399): first behavioural changes since DEC-366
  freeze, all defect fixes. 392 phone admin chrome = tab bar ALONE:
  <=700px hides .chq-nav + header email/Sign out; More control/sheet
  UNCONDITIONAL so reviewers (one section) keep Sign out. 393 tap
  floor 44px EVERYWHERE; MIN_TAP_TARGET_PX 40->44 (theme.ts .chq-nav
  a, portal.css.ts fixed); guard test/tap-target-floor.test.ts bans
  literal `min-height: 40px`. 394 scoped split of the one CSS lane:
  styles.css+event-switcher.css (SPA) vs theme.ts+*.css.ts (SSR), this
  wave only. 395 client stops asking for what it may not have —
  useNavExceptions fetches only when role==='organizer'. 396 compose
  submissionIds joins DEC-182 at maxCount MAX_COMPOSE_RECIPIENTS. 397
  PREVIEW NEVER MINTS CREDENTIALS: mintClaimTokens flag; preview
  renders /claim/PREVIEW_CLAIM_TOKEN, zero KV puts. 398 form task's
  form PICKED BY NAME, validated vs task's own event; event has MANY
  forms (DEC-015/111), findFormForEvent now means isDefault=true. 399
  pubcache bump CLOSED 3rd time (DEC-201/333/348+DEC-366) — stop.
