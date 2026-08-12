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
  design/README.md. Tokens: paper F4F1E8/surface FAF8F2/ink 1B1D17/
  muted 565A4B/hairline E1DDCE/border BAB6A6/olive 4E5C31, NO RED,
  self-hosted fonts. Floors: 10px type, 44px phone tap, AA, no shadows/
  new deps. Sidebar DELETED, top header+phone tab bar; Overview=
  worklist v2. CSS lane: styles.css+theme.ts=ONE lane; page lanes add
  co-located <area>.css, .chq-<area>-*, never redefine shared class.
  SSR THEME_CSS+co-located surface module, escapes text so CSS ->
  dangerouslySetInnerHTML value-free constant. Settings=ONE route,
  phone=client-state swap. #A8A392=ONLY off-palette hex. ONE dialog
  contract: .chq-scrim/.chq-modal STATIC child, Escape via
  useEscapeKey.ts. Agenda phone=arm-then-tap, one room, 30-min
  default. Gate lanes own ONE log file only.
- REDESIGN w4-5 (DEC-385..391): ONE phone switch `@media (max-width:
  700px)` in EVERY stylesheet (900px=intermediate); 44px controls
  CENTRED FLEX, chip strips overflow-x:auto. Phone cards=CSS on SAME
  markup (thead hidden, tr->card); card=exactly desktop row's cells,
  ambiguous cell gets data-label via td::before, no markup added.
  Render-sweep gains ADVISORY admin mobile pass (390x844), `-redesign`
  log suffix, reports never throw. D1 binds are PRIMITIVES — epoch-ms
  NUMBER never `new Date()`. Guard: test/breakpoint-conformance.test.ts
  — only 700/900 max-widths.
- REDESIGN w6 (DEC-392..399): first behavioural changes since freeze,
  all defect fixes. 392 phone chrome=tab bar ALONE, More sheet
  UNCONDITIONAL (reviewers keep Sign out). 393 tap floor 40->44px
  EVERYWHERE, guard bans literal `min-height: 40px`. 394 one-wave-only
  CSS lane split SPA/SSR. 395 client gates fetches on role, not
  catch(). 396 compose bulk endpoints join DEC-182 maxCount. 397
  PREVIEW NEVER MINTS CREDENTIALS. 398 form task's form PICKED BY
  NAME (findFormForEvent=isDefault). 399 pubcache bump CLOSED 3rd time
  (DEC-201/333/348+366) — stop re-raising it.
- REDESIGN w7 (DEC-400..405): 400 overview WIRE keys are DEC-370's —
  `triage`=v2 rows, `triage-counts`=v1 aggregate; a pass-through handler
  can't be pinned by a repo-mocked route test, so the guard is repo-level
  + type-assignability vs app/src/pages/overview/types.ts (client is the
  contract of record, DEC-246). 401 mobile pass measures max element
  right edge as well as scrollWidth and NAMES up to 3 offenders +
  minControl selector (structure only, never text). 402 every `<table
  className="chq-table">` carries a page-prefixed 2nd class. 403 desktop
  sweep = SPA routes UNION every no-login surface the mobile pass visits.
  404 phone-only `overflow-wrap: anywhere` on the shell (styles.css +
  theme.ts = ONE lane again, DEC-394 expired) replaces per-page patches.
  405 NO document-level `overflow-x: hidden` — it hid content AND lied to
  the gate; a genuinely wide region gets its own overflow-x:auto scroller
  in its own stylesheet.
