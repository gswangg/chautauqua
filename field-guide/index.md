# Field Guide
Owned by the swarm. Scribe appends lessons each wave, keeps this under a
hard 60-line budget, compacting old entries. Injected into every agent.
- SPEC.md is source of truth (J1-J12 bar, sbek rubric IDs=verification
  hooks, §2 principles). docs/ precedence: clarifications.md overrides
  all; decisions/DEC-*.md binding, src/decisions.ts compile-checked
  (never hand-edit). House invariants: fail loudly; status changes
  never auto-email; authz every route, server-side visibility.
- STAGE1 (DEC-002..365, COMPLETE): pure-core src/{auth,domain,forms,
  mail,lib} import nothing node:/cf; 004 hash 'pbkdf2$v1$100000$salt$
  hash'; 012/013 route files export Hono sub-apps, errors {error:
  {code,message,fields?}}; 353 archive 40MB TOTAL-byte guard; bulk ops
  set-based/CLOSED. Gates LOG-ONLY.
- REDESIGN w1-5 (DEC-366..391, mandate=docs/design/README.md): FUNCTION
  FROZEN. Tokens: paper F4F1E8/surface FAF8F2/ink 1B1D17/muted 565A4B/
  hairline E1DDCE/border BAB6A6/olive 4E5C31, NO RED/shadows/new deps.
  styles.css+theme.ts=ONE lane; page lanes add co-located <area>.css,
  .chq-<area>-*, never redefine shared class. ONE dialog contract
  (.chq-scrim/.chq-modal, useEscapeKey.ts). ONE phone switch `@media
  (max-width:700px)`; 44px controls; phone cards=CSS on same markup.
  D1 binds are PRIMITIVES — epoch-ms NUMBER never `new Date()`.
- REDESIGN w6-7 (DEC-392..405): 392 phone chrome=tab bar ALONE. 393 tap
  floor 44px EVERYWHERE, guard bans `min-height: 40px`. 397 PREVIEW
  NEVER MINTS CREDENTIALS. 399 pubcache bump CLOSED — stop re-raising.
  400 overview wire keys: `triage`=v2 rows, `triage-counts`=v1
  aggregate. 401 mobile pass measures max element right edge +
  scrollWidth, NAMES offenders + minControl selector. 402 every
  `<table className="chq-table">` carries a page-prefixed 2nd class.
  403 desktop sweep = SPA routes UNION every no-login surface. 404
  phone-only `overflow-wrap: anywhere` on shell. 405 NO document-level
  `overflow-x: hidden` — wide region gets its own overflow-x:auto
  scroller.
- REDESIGN w8 (DEC-406..409): 406 EVERY interactive control carries a
  shell class; repo-wide source guard deferred to w9 on purpose. 407
  walkthrough runs ALL five areas + summary; J2 asserts /\bcloses\b/i,
  never retired chrome copy. 408 public dates use event.timezone via
  src/lib/event-time.ts (THROWS on bad tz, no UTC fallback). 409
  :focus-visible 2px olive/2px offset in BOTH stylesheet roots;
  `outline: none`/`outline: 0` banned everywhere.
  SETTLED — stop re-raising: DEC-386/380's dropped phone triage/breaks
  affordances are mock-only, not backlog.
- REDESIGN w9 (DEC-410..414): 410 control-class guard is REPO-WIDE now
  (app/src only -- theme.ts styles bare button/input at ELEMENT level,
  SSR exempt BY DESIGN); the guard's lane fixes what it names, no
  allowlist. 411 tsx runs esbuild keepNames: a named closure inside
  page.evaluate becomes __name(fn,"x") and dies in the page context --
  every Playwright page gets addInitScript({content: raw-string shim})
  BEFORE any evaluate. Four waves of "mobile pass" numbers were this
  instrument failure, not measurements. Phone manifest = the WHOLE
  portal (6 routes), not /portal alone. Gate lanes stay log-only; never
  flip ADMIN_MOBILE_PASS_BLOCKING (flips the wave AFTER first
  all-PASS). 412 walkthrough repair: design owns copy (re-pin the
  assertion to the smallest surviving token), SPEC 9 owns behaviour
  (fix the product); never delete/soften an assertion; one lane per
  area, own port each. 413 portal dates use the OWNING EVENT's tz,
  carried per ROW (portal spans events); all 4 portal queries already
  join event. 414 a 390px overflow is closed by overflow-x:auto +
  flex-shrink:0 or wrap -- never overflow:hidden, never a sub-44px
  control; RE-MEASURE before fixing, a stale offender is how a gate
  stays red while a lane reports success.
