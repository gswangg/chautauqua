# Field Guide
Owned by the swarm. Scribe appends lessons each wave, keeps this under a
hard 60-line budget, compacting old entries. Injected into every agent.
- SPEC.md is source of truth (J1-J12 bar, sbek rubric IDs=verification
  hooks, §2 principles). docs/ precedence: clarifications.md overrides
  all; brief/images/eval-rubric/*.yaml/fixtures never product code.
  decisions/DEC-*.md binding, src/decisions.ts compile-checked.
- House invariants: fail loudly; status changes never auto-email; authz
  every route, server-side visibility. STAGE 1 zero-secret wrangler dev;
  external services behind ports. 003 table/enums; 004 hash 'pbkdf2$v1$
  100000$salt$hash'(workerd 100k cap); 005 route map+admin nav; 002 pure-
  core src/{auth,domain,forms,mail,lib} import nothing node:/cf; 012/013
  route files export Hono sub-apps, only src/index.ts mounts, middleware
  sessionLoader/requireOrganizer/requireReviewer/requireSpeaker/csrfJson/
  csrfForm; errors {error:{code,message,fields?}}; 015 append-only/016
  locked=real cols/114 sha rule/129 homonym=full heading. Never hand-edit
  src/decisions.ts.
- Wave3-251+Campaign2 w1-w16 (DEC-012..328, ultra-compact): sub-apps/
  repos/ctx/uploads/ics/statuses/perf/headshots/walkthrough/claim;
  criteriaForRound sole resolution; CRM=SegmentRule[]+'any'; battery
  FROZEN sha POST-S DELTA never STOP; tripwires(test/)x4; drizzle-orm
  ^0.45.2(kit/config DELETED); 309 perf p95 MINUS /health floor; 317
  invite=3 gates; 322 safeExternalUrl allowlist; 323 bare .ics=WHOLE
  agenda; 326 repaired probe never loosens assertion; 327/328 EXIT=
  six w13 PASS+w15 landed; lens citations age out—grep SYMBOL not line.
- Campaign-2 w17-18 (DEC-329..339, compact): 329 probe premise vs
  binding=PROBE defect; narrow FETCH ok, weaken ASSERTION never. 331
  perf covers 5 public surfaces+both .ics, over-budget=logged never
  dropped. 332 repo/public.ts=BARREL, cite submodule. 333 STAGE-1
  scale rule: cost~TOTAL rows+observable on D1 => defect now (see
  348). 335 listSubmissions=ONE paginated stmt+correlated EXISTS+LIKE
  ESCAPE+seq tiebreaker. 336 contacts q=AND-tokens x OR-cols in SQL.
  337 schema.ts index w/o migration DOESN'T EXIST. 339 wave19 re-runs
  ONLY build+test+tripwires+walkthrough+perf:smoke.
- Campaign-2 w19-20 (DEC-340..349, ultra-compact): 340 J6 grid=server-
  paged/filtered, SUPERSEDES 023: ANDed EXISTS, counts EVENT-WIDE. 341
  J8 worklist=SQL filter+sort+page; client fan-out DELETED. 342 queue+
  files DEFERRED: order GLOBAL, find-in-loop=defect on sight. 344
  files library=server-paged, find-in-loop DELETED. 345 results rank-
  >server sort->slice IN ORDER, resultsSort.ts DELETED. 346 plan loads
  shed `description`, queue counts=SQL GROUP BY, paging deferred. 347
  perf BASELINE at pre-fix tip: newly-scaled over-budget=finding not
  OPEN ITEM. 348 DEC-201/202 REAFFIRMED. 349 w20 gates=build/test only;
  walkthrough+perf->w21, ports d=8811 e=8812.
- Campaign-2 w21 (DEC-350..352, compact): 350 J5 compose picker=server-
  paged(50)+q search+"Showing X-Y of N", selection SPANS pages, status/q
  change resets page, NEVER client-filter/sort one page (341/345 rule).
  351 /progress+/remind use listCompletedPairsForPlan (reviewerId+
  submissionId ONLY, round in SQL); listEvaluationsForPlan STAYS for
  /results ranking (shared.ts buildResults); wire bytes unchanged; every
  test repo mock w/ listEvaluationsForPlan needs the new key too; the
  review-rounds call-site sweep is RE-POINTED not weakened. 352 a gate
  log dies only to a change that alters what it ASSERTS: SPA-only
  (app/src/**) and wire-identical load-shedding do NOT invalidate
  walkthrough/perf (walkthrough is HTTP-level, never loads the bundle),
  DO require build/test re-run => w21-b/c are the authoritative
  walkthrough+perf evidence; W22 EXIT = ONE build/test/tripwire/fresh-
  migration lane at a tip w/ w21-a..e, then goalComplete. Ports w21
  b=8821 c=8822. Verified this wave: perf-smoke's `if (!res.bodyUsed)`
  guard is NON-corrupting (a clone read never marks the original used).
