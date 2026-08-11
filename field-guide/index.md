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
  dedupe; 322 safeExternalUrl allowlist; 323 bare schedule.ics=WHOLE
  agenda; 326 repaired probe never loosens assertion; 327 EXIT=six w13
  PASS+w15 landed; 328 lens citations age out—grep SYMBOL not line.
- Campaign-2 w17 (DEC-329..332): 329 probe premise vs binding DEC=
  PROBE defect, narrowing a FETCH allowed/weakening ASSERTION never;
  274 REAFFIRMED hiding participant hides SPEAKER. 330 EXIT=327+w17-a/
  b/d/e green. 331 perf covers 5 public surfaces+agenda.ics+BARE
  schedule.ics, over budget=logged finding never raised/dropped. 332
  repo/public.ts=BARREL, cite submodule, decomposition never sheds
  guards (DEC_258 marker every module).
- Campaign-2 w18 (DEC-333..339): 333 STAGE-1 scale rule=cost scales w/
  TOTAL rows not page size AND observable on local D1=>product defect
  now (201/202 stage-2-only stay CLOSED). 334 dashboard numbers=SQL
  COUNT/MAX never materialized rows; aggregateCommsCounts DELETED. 335
  listSubmissions=ONE paginated stmt, correlated EXISTS, LIKE escapes
  \\%_ w/ ESCAPE, ORDER BY carries seq tiebreaker. 336 contacts q=exact
  AND-tokens x OR-cols in SQL (266 kept), matchesContactQuery deleted.
  337 index in schema.ts w/o CREATE INDEX migration DOESN'T EXIST. 338
  perf covers onboarding grid/reviewer queue/email-log; `optional:true`
  removed. 339 wave19 re-runs ONLY build+test+tripwires,walkthrough,
  perf:smoke. Ports a=8795 b=8796 c=8797 d=8798.
- Campaign-2 w19 (DEC-340..343): 340 J6 grid=server-paged/filtered/
  searchable roster, SUPERSEDES 023 envelope: all filters ANDed inside
  ONE correlated EXISTS (=rowFilters semantics), q=likeContains AND-
  tokens x OR-cols, order lower(last),lower(first),id, perPage 50/
  max200, counts EVENT-WIDE never page-local. 341 J8 worklist=SQL
  contentStatus filter + sort=worklist + page-bounded deliverableCounts
  (chain roots,247); client per-row files fan-out+filterByContentStatus/
  sortForWorklist DELETED (SPEC §7 one round trip; tab-over-one-page
  was a CORRECTNESS bug). 342 reviewer queue + /events/:id/files
  reviewed and DEFERRED w/ triggers: queue order is global (build
  ReviewerQueue + Scorecard next-unrated) so a naive slice=new bug,
  18.5ms measured; files-library unobservable till seed has file rows,
  quadratic participantRows.find-in-loop is a defect on sight. 343
  w17-e FAILED closes ONLY by a green SIX-module orchestrator; w19
  gates freeze pre-d/e, wave20 re-runs build+test+tripwires, full
  walkthrough, perf:smoke — nothing else. Ports b=8801 c=8802 d=8803.
