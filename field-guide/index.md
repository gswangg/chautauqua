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
  100000$salt$hash' (workerd 100k cap); 005 route map+admin nav; 002
  pure-core src/{auth,domain,forms,mail,lib} import nothing node:/cf;
  012/013 route files export Hono sub-apps, only src/index.ts mounts,
  middleware sessionLoader/requireOrganizer/requireReviewer/
  requireSpeaker/csrfJson/csrfForm; errors {error:{code,message,
  fields?}}; 015 append-only/016 locked=real cols/114 sha rule/129
  homonym=full heading. Never hand-edit src/decisions.ts.
- Wave3-251+Campaign2 w1-w10 (DEC-012..302, ultra-compact): sub-apps/
  repos/ctx; uploads/ics/statuses/perf/headshots/walkthrough/claim;
  exit battery+render-sweep+findings; criteriaForRound sole
  resolution; CRM=SegmentRule[]+'any'; CSV/login-limiter/email-ci-dup/
  SSR/checkbox/cascades; batteries LATE, grep-not-prose. resolveBaseUrl
  +RELATIVE hrefs; mobile 390x844; 8 battery sections a-h (g=fresh-
  clone verbatim, h=rubric ids->file:line+test); migrations hand-
  authored, fresh clone never builds public/admin (gitignored); 271-
  273 recusal/WAIVES ABS-14/recommendation!=6th status; 270/279-281
  wave-N battery protocol (FROZEN sha, POST-S DELTA never STOP); 282
  seven contact FK tables; 283 assignToAll=ACTIVE only; 285/286 pre-
  register defects, logs MANDATORY; 287 exit=grep 8 files (superseded
  w11-13 by 303/304/307/315); tripwires(test/) docs-route-coverage/
  spa-contract-sweep/schema-fk-indexes/migration-parity; 289-292 embed
  PATH SUFFIX, roster optional eventId, GET/custom fields=key/value+
  `travel_logistics`; 293-302: waive 2 doc-typo rows, treadmill=w11-
  only, 304=success, PUBLIC_BASE_URL=localhost:8787 DEV_MODE-only,
  public non-200=>no-store, schedule int+bounds 400, NULL backfill,
  field delete 409/cascade=1, event='General', npm audit --omit=dev.
- Campaign-2 w11 (DEC-303..306)=BATTERY-ONLY: 303 main moves UNDER
  planner, each lane resolves S=refs/heads/main via 7-item WAVE-10
  GATE (poll if missing); 305 ports a-h(8791-8794/8787), '-c3-'
  MANDATORY; 304 superseded 307/315; 306 merge.ts tie-break refuted.
- Campaign-2 w12 (DEC-307..312)=NARROWING-FIX, not exit. Harness
  replans at lowWater=8, planner sees wave N DISPATCHED not merged.
  307: read battery ONE WAVE LATE — w12 saw a/c/d FAIL, 304 predicate
  ALREADY failed. Fixes: 308 drizzle-orm ^0.45.2 (kit+config DELETED);
  309 perf classes graded p95 MINUS /health floor, schedule.ics=
  public; 310 getPublicAgendaByIds (never hydrate whole agenda); 311
  mobile bar +=/docs/api+/dev/mailbox, join MOBILE_ROUTE_MANIFEST; 312
  SQL WHERE normative, no app-code filters.
- Campaign-2 w13 (DEC-313..316)=CLOSING battery, log-only lanes.
  VERIFIED: ALL w12 merged+task-custodian-w12-2, main=fa37629. 313:
  re-run a/b(8791)/c(8792)/d(own port)/g(8787 verbatim) + NEW i
  citation-delta, j eval-findings §D; e/h stand (drizzle 0.36.4->
  0.45.2 is runtime-SQL, live-D1 lanes=its test, 500/SQL=OPEN ITEM
  verbatim; custodian split review.ts->review/{index,plans,reviewer,
  recusals,shared}.ts, killing 14 w11-h citations). 314: letters keep
  meaning, '-c3-' MANDATORY, ports planner-assigned, WAVE-12 GATE
  W1..W7 polls 10x60s then PARTIAL+PROCEEDS. 315 exit: seven w13 -c3-
  logs OPEN ITEMS:0/RESULT:PASS (main OR worktree) => goalComplete;
  partial => ZERO tasks; FAIL => narrow fix on cited lines only. 316:
  §D row=OPEN ITEM only if action fails; latency out of scope.
