# Field Guide
Owned by the swarm. Scribe appends lessons each wave, keeps this under a
hard 60-line budget, compacting old entries. Injected into every agent.
- SPEC.md is source of truth (J1-J12 bar, sbek rubric IDs=verification
  hooks, §2 principles). docs/ precedence: clarifications.md overrides
  all; brief/images/eval-rubric/*.yaml/fixtures never product code.
  decisions/DEC-*.md binding; src/decisions.ts compile-checked.
- House invariants: fail loudly; status changes never auto-email; authz
  every route, server-side visibility. STAGE 1 zero-secret wrangler dev;
  external services behind ports. 003 table/enums; 004 hash 'pbkdf2$v1$
  100000$salt$hash' (237, workerd 100k cap); 005 route map+admin nav;
  002 pure-core src/{auth,domain,forms,mail,lib} import nothing node:/
  cf; 012/013 route files export Hono sub-apps, only src/index.ts
  mounts, middleware sessionLoader/requireOrganizer/requireReviewer/
  requireSpeaker/csrfJson/csrfForm; errors {error:{code,message,
  fields?}}; 015 append-only; 016 locked=real cols; 114 sha rule; 129
  homonym=full heading incl sha. Never hand-edit src/decisions.ts.
- Wave3-251+Campaign2 w1-w9 (DEC-012..292, ultra-compact): sub-apps/
  repos/ctx 012/013/019; uploads/ics/statuses/perf/headshots/
  walkthrough/claim 040-074; exit battery+render-sweep+findings 068/
  069/139; criteriaForRound sole resolution 147-178; CRM=SegmentRule[]
  +'any'; 179-231 CSV/login-limiter/email-ci-dup/SSR/checkbox/cascades;
  232-251 batteries LATE, grep-not-prose. resolveBaseUrl+RELATIVE
  hrefs; mobile 390x844; 8 battery sections a-h (g=fresh-clone
  verbatim, h=rubric ids->file:line+test); migrations hand-authored,
  fresh clone never builds public/admin (gitignored); 271 recusal, 272
  WAIVES ABS-14, 273 recommendation!=6th status; 270/279/280/281 wave-N
  battery protocol (FROZEN sha, POST-S DELTA never a STOP); 282 seven
  contact FK tables; 283 assignToAll=ACTIVE only; 285/286 pre-register
  defects, logs MANDATORY; 287 exit=grep 8 files (superseded w11+w12 by
  303/304/307); tripwires(test/) docs-route-coverage/spa-contract-
  sweep/schema-fk-indexes/migration-parity. W9: 289 embed PATH SUFFIX;
  290 roster optional eventId; 291/292 GET/custom fields=key/value+
  `travel_logistics`.
- Campaign-2 w10 (DEC-293..302, compact): 287 grep FAILS(f/g/h). 293
  waives 2 doc-typo rows; 294 bounds treadmill=w11-only. Fixes: 295 304
  =success; 296 PUBLIC_BASE_URL=localhost:8787 DEV_MODE-only; 297
  public non-200=>no-store; 298 schedule params int+bounds 400; 299
  title/org_at_time NULL backfill; 300 field delete 409/cascade=1; 301
  event='General'; 302 npm audit --omit=dev.
- Campaign-2 w11 (DEC-303..306, compact)=BATTERY-ONLY. 303: main moves
  UNDER planner => each lane resolves S=refs/heads/main live, passes
  7-item WAVE-10 CONTENT GATE, poll if MISSING. 305 ports a-h: build-
  test/walkthrough(8791)/perf(8792)/render(8793)/spec-audit/triage
  (8794)/fresh-clone(8787)/rubric; logs='-c3-' infix MANDATORY. 304
  superseded by 307. 306: merge.ts tie-break CORRECT, refuted.
- Campaign-2 w12 (DEC-307..312) = NARROWING-FIX wave, not exit wave.
  Harness replans at lowWater=8 (workflow js:45/274): planner invoked
  when wave N DISPATCHED not merged. 307: read battery ONE WAVE LATE;
  w13 planner reads all 8 -c3- logs. Seen at w12: a FAIL(drizzle adv),
  c FAIL(schedule.ics 51.9ms), d FAIL(2 mobile overflows), e/f PASS,
  b/g/h unseen => 304's predicate ALREADY failed, 287's narrowing
  fires on evidence not a timer. Fixes: 308 drizzle-orm ^0.45.2,
  drizzle-kit+config DELETED, audit --omit=dev must print 0; 309 perf
  classes read50/write100/public150 graded on p95 MINUS /health
  overhead floor (raw 150ms 2nd ceiling), schedule.ics=public not
  admin; 310 getPublicAgendaByIds (never hydrate whole agenda for ids=
  request); 311 mobile bar += /docs/api + /dev/mailbox (no viewport
  meta), join MOBILE_ROUTE_MANIFEST; 312 SQL WHERE normative, test
  doubles model predicate. w13 re-runs ONLY red sections; e/f STAND
  unless w12 touched cited LINE (f: index.tsx:48-55, w12-c:182-196).
