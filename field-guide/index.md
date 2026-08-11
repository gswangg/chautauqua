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
  FROZEN sha POST-S DELTA never STOP, recusal/WAIVES ABS-14;
  tripwires(test/)x4; drizzle-orm ^0.45.2(kit/config DELETED); 309 perf
  p95 MINUS /health floor; 310 getPublicAgendaByIds never hydrate whole
  agenda; 312 SQL WHERE normative; 317 invite=3 gates; 319 batch=100+
  dedupe; 322 safeExternalUrl allowlist; 323 bare .ics=WHOLE agenda;
  326 repaired probe never loosens assertion; 327/328 EXIT=six w13
  PASS+w15 landed; lens citations age out—grep SYMBOL not line.
- Campaign-2 w17-18 (DEC-329..339, compact): 329 probe premise vs
  binding=PROBE defect; narrow FETCH ok, weaken ASSERTION never. 330
  EXIT=327+w17 green. 331 perf covers 5 public surfaces+both .ics
  feeds, over-budget=logged never dropped. 332 repo/public.ts=BARREL,
  cite submodule, DEC_258 marker. 333 STAGE-1 scale rule: cost~TOTAL
  rows+observable on D1 => defect now (201/202 stage-2-only, see 348).
  334 dashboard=SQL COUNT/MAX. 335 listSubmissions=ONE paginated
  stmt+correlated EXISTS+LIKE ESCAPE+seq tiebreaker. 336 contacts
  q=AND-tokens x OR-cols in SQL, matchesContactQuery deleted. 337
  schema.ts index w/o migration DOESN'T EXIST. 338 perf covers grid/
  queue/email-log, optional removed. 339 wave19 re-runs ONLY build+
  test+tripwires+walkthrough+perf:smoke.
- Campaign-2 w19-20 (DEC-340..349, compact): 340 J6 grid=server-paged/
  filtered/searchable, SUPERSEDES 023: ANDed correlated EXISTS, q=AND-
  tokens x OR-cols, counts EVENT-WIDE. 341 J8 worklist=SQL
  contentStatus filter+sort+page-bounded deliverableCounts; client
  fan-out DELETED (tab-over-one-page was CORRECTNESS bug). 342 queue+
  files DEFERRED w/ triggers: queue order GLOBAL (naive slice=new
  bug); find-in-loop=defect on sight. 343 w17-e closes ONLY by green
  SIX-module orchestrator. 344 files library=server-paged (roots
  WHERE previous_file_id IS NULL+kinds+q), chains/lead-speaker PAGE-
  BOUNDED, find-in-loop DELETED, resolveLatestVersions never scans
  event. 345 results=buildResultsRows rank->server sort->slice IN
  THAT ORDER; SPA resultsSort.ts DELETED (paging w/o moving sort=
  DEC-341's bug); csv ignores paging. 346 plan loads shed
  `description` (PlanSubmissionRef vs SubmissionSummary), queue
  counts=SQL GROUP BY; queue PAGING still deferred (Scorecard). 347
  w20 perf=BASELINE at pre-fix tip: over-budget on NEWLY-seeded rows=
  finding owned by fix lane, at UNCHANGED scale=OPEN ITEM. 348
  DEC-201/202 REAFFIRMED (pubcache bump stays,
  narrowing stage-2); lens items agenda-range/remindNow-cap/list-
  pagination/overview-Math.max verified STALE at symbol. 349 w20
  gates=build/test only; walkthrough+authoritative perf->w21 at ONE
  sha w/ all w19+w20 lanes, ports d=8811 e=8812.
