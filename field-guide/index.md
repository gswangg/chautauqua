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
- REDESIGN w1-5 (DEC-366..391): stage-1 FUNCTION FROZEN. Mandate=docs/
  design/README.md. Tokens: paper F4F1E8/surface FAF8F2/ink 1B1D17/
  muted 565A4B/hairline E1DDCE/border BAB6A6/olive 4E5C31, NO RED, no
  shadows/new deps. CSS lane: styles.css+theme.ts=ONE lane; page lanes
  add co-located <area>.css, .chq-<area>-*, never redefine shared
  class. SSR THEME_CSS+co-located surface module. #A8A392=ONLY off-
  palette hex. ONE dialog contract: .chq-scrim/.chq-modal STATIC
  child, Escape via useEscapeKey.ts. ONE phone switch `@media
  (max-width: 700px)` EVERYWHERE (900px=intermediate); 44px controls
  CENTRED FLEX, chip strips overflow-x:auto. Phone cards=CSS on SAME
  markup (thead hidden, tr->card); ambiguous cell gets data-label via
  td::before. Render-sweep gains ADVISORY admin mobile pass (390x844).
  D1 binds are PRIMITIVES — epoch-ms NUMBER never `new Date()`.
- REDESIGN w6-7 (DEC-392..405): first behavioural changes since freeze,
  defect fixes. 392 phone chrome=tab bar ALONE, More sheet
  UNCONDITIONAL. 393 tap floor 40->44px EVERYWHERE, guard bans literal
  `min-height: 40px`. 395 client gates fetches on role, not catch().
  396 compose bulk endpoints join DEC-182 maxCount. 397 PREVIEW NEVER
  MINTS CREDENTIALS. 398 form task's form PICKED BY NAME
  (findFormForEvent=isDefault). 399 pubcache bump CLOSED 3rd time —
  stop re-raising it. 400 overview WIRE keys are DEC-370's — `triage`=
  v2 rows, `triage-counts`=v1 aggregate, guard is repo-level + type-
  assignability. 401 mobile pass measures max element right edge +
  scrollWidth, NAMES offenders + minControl selector. 402 every
  `<table className="chq-table">` carries a page-prefixed 2nd class.
  403 desktop sweep = SPA routes UNION every no-login surface. 404
  phone-only `overflow-wrap: anywhere` on the shell (styles.css+
  theme.ts=ONE lane again). 405 NO document-level `overflow-x: hidden`
  — a wide region gets its own overflow-x:auto scroller.
- REDESIGN w8 (DEC-406..409): 406 EVERY interactive control carries a
  shell class (chq-btn+tier, chq-input/select/textarea/check); three
  surfaces never got it — submission detail, compose steps 1-2, forms
  FieldModal — one lane each; repo-wide source guard lands w9 against a
  clean tree, not while three lanes each fix a third. 407 walkthrough
  runs ALL five areas + prints a summary; an area failure never hides
  another; J2 asserts /\bcloses\b/i, never retired chrome copy. 408
  public dates use event.timezone via src/lib/event-time.ts (THROWS on
  bad tz, no UTC fallback), never toUTCString; CFP header keeps the word
  "closes". 409 :focus-visible 2px olive/2px offset in BOTH stylesheet
  roots; `outline: none`/`outline: 0` banned everywhere.
  SETTLED — stop re-raising: DEC-386's dropped phone per-row triage and
  DEC-380's dropped breaks/"move X"/unscheduled duration are mock-only
  affordances with no endpoint or no owner-contract. Not backlog. If a
  future wave wants row triage it lands desktop AND phone together on
  SubmissionsTable's own optimistic path (DEC-193), not as layout.
