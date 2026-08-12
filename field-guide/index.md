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
- REDESIGN w1-5 (DEC-366..391, docs/design/README.md): FUNCTION FROZEN.
  Tokens: paper F4F1E8/surface FAF8F2/ink 1B1D17/muted 565A4B/hairline
  E1DDCE/border BAB6A6/olive 4E5C31, NO RED/shadows/new deps.
  styles.css+theme.ts=ONE lane; page lanes add .chq-<area>.css, never
  redefine shared class. ONE dialog contract, ONE phone switch @700px,
  44px controls. D1 binds PRIMITIVES — epoch-ms NUMBER not `new Date()`.
- REDESIGN w6-8 (DEC-392..409): 393 tap floor 44px, no min-height:40px.
  397 PREVIEW NEVER MINTS CREDENTIALS. 399 pubcache bump CLOSED. 400
  overview wire: `triage`=v2 rows, `triage-counts`=v1 aggregate. 401
  mobile pass measures max right edge+scrollWidth, names offenders. 402
  every chq-table carries a page-prefixed 2nd class. 403 desktop sweep =
  SPA routes UNION no-login surfaces. 404 phone-only overflow-wrap:
  anywhere on shell. 405 no document-level overflow-x:hidden. 406 every
  control carries a shell class (guard deferred to w9). 408 public dates
  via src/lib/event-time.ts (throws, no UTC fallback). 409 focus-visible
  2px olive in both stylesheet roots, outline:none banned.
  SETTLED: DEC-386/380 dropped phone affordances are mock-only.
- REDESIGN w9 (DEC-410..414): 410 control-class guard REPO-WIDE (app/src
  only, SSR exempt). 411 tsx/esbuild keepNames breaks named closures in
  page.evaluate (__name ReferenceError); every Playwright page gets
  addInitScript raw-string shim BEFORE any evaluate -- four waves of
  "mobile pass" numbers were this instrument failure. Phone manifest =
  WHOLE portal (6 routes). Gate lanes log-only; never flip
  ADMIN_MOBILE_PASS_BLOCKING. 412 walkthrough: design owns copy, SPEC 9
  owns behaviour; never soften an assertion. 413 portal dates use the
  OWNING EVENT's tz per ROW. 414 390px overflow: overflow-x:auto+
  flex-shrink:0 or wrap, never overflow:hidden/sub-44px; RE-MEASURE
  first.
- REDESIGN w10 (DEC-415..419): 415 speaker portal-edit WRITES
  job_title/company/bio to contact (trim, ''->null, absent key=leave
  alone); NEVER submission_answer, NEVER participant.*_at_time (DEC-258
  snapshot frozen). 416 unknown track id rejected BEFORE the
  zero-offered early return (DEC-301 only relaxes "at least one");
  hydrateSessions' track join is event-scoped. 417 ONE parseBoundedText
  beside parseBoundedIdArray in src/server/http.ts; caps NAME 200/TEXT
  2000/LONG 20000/RICH 100000 in src/forms/validate.ts; oversized=400
  naming the field, never a D1 SQLITE_TOOBIG 500; CSV import bounded in
  BYTES+ROWS. 418 public list queries carry LIMIT in SQL + separate
  COUNT(DISTINCT); join fan-out bounds a distinct-key subquery FIRST
  then hydrates by id; speakers/gallery reuse sessions' show-more. 419
  build-test/perf-smoke/render-sweep gates re-run on redesigned tree,
  LOG-ONLY, one file each, never flip a blocking flag or fix what they
  name; an instrument failure is never written down as a number.
  STALE-LENS, do not re-open: comms preview id-guard/mints-tokens both
  fixed on main (comms.ts:163,:348). DEC-399 pubcache bump CLOSED.
